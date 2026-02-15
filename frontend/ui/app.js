const PRICING = {
  bed: 250,
  fridge: 300,
  box: 60,
  suitcase: 80,
  other: 120,
  handlingFee: 350,
};

const ITEM_TYPES = [
  { value: "bed", label: "Bed", price: PRICING.bed },
  { value: "fridge", label: "Fridge", price: PRICING.fridge },
  { value: "box", label: "Box", price: PRICING.box },
  { value: "suitcase", label: "Suitcase", price: PRICING.suitcase },
  { value: "other", label: "Other item", price: PRICING.other },
];

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

const statusSteps = ["submitted", "approved", "paid"];

const state = {
  items: [],
  bookingId: "",
  status: "draft",
  session: {
    token: sessionStorage.getItem("hss-token") || "",
    role: sessionStorage.getItem("hss-role") || "customer",
  },
  apiBase: localStorage.getItem("hss-api-base") || "http://localhost:8081",
};

class ApiClient {
  constructor(getState) {
    this.getState = getState;
  }

  async request(path, options = {}) {
    const { apiBase, session } = this.getState();
    const response = await fetch(`${apiBase}${path}`, {
      headers: {
        "Content-Type": "application/json",
        "X-HSS-Role": session.role || "customer",
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || data.error || `API request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  }
}

const api = new ApiClient(() => state);

function byId(id) {
  return document.getElementById(id);
}

function readText(id, fallback = "") {
  return byId(id)?.value || fallback;
}

function value(id) {
  const input = byId(id);
  return Number.parseInt(input?.value || "0", 10) || 0;
}

function showMessage(targetId, message, tone = "neutral") {
  const node = byId(targetId);
  if (!node) {
    return;
  }

  node.textContent = message;
  node.dataset.tone = tone;
}

function createItem(type = "box") {
  return {
    id: crypto.randomUUID(),
    type,
    name: "",
    photo: null,
    photoName: "",
    thumbnail: "",
    s3Key: "",
  };
}

function getItemPrice(item) {
  return PRICING[item.type] ?? PRICING.other;
}

function getItemLabel(item) {
  if (item.type === "other") {
    return item.name?.trim() ? `Other: ${item.name.trim()}` : "Other item";
  }

  const config = ITEM_TYPES.find((entry) => entry.value === item.type);
  return config?.label || "Item";
}

function calculatePricing() {
  const duration = Math.max(value("duration"), 1);
  const monthlySubtotal = state.items.reduce((total, item) => total + getItemPrice(item), 0);
  const total = monthlySubtotal * duration + PRICING.handlingFee;

  return {
    duration,
    monthlySubtotal,
    handlingFee: PRICING.handlingFee,
    total,
    itemsCount: state.items.length,
    photosCount: state.items.filter((item) => Boolean(item.photo)).length,
    otherCount: state.items.filter((item) => item.type === "other").length,
  };
}

function updateEstimate() {
  if (!byId("summary-total")) {
    return;
  }

  const { duration, monthlySubtotal, total, itemsCount, photosCount, otherCount } = calculatePricing();

  const estimate = byId("estimate");
  const monthlySubtotalNode = byId("monthly-subtotal");
  const durationLabel = byId("duration-label");

  if (estimate) {
    estimate.textContent = currency.format(total);
  }
  if (monthlySubtotalNode) {
    monthlySubtotalNode.textContent = currency.format(monthlySubtotal);
  }
  if (durationLabel) {
    durationLabel.textContent = `${duration} months`;
  }

  byId("items-summary").textContent = `${itemsCount}`;
  byId("photo-summary").textContent = `${photosCount}`;
  byId("summary-monthly").textContent = currency.format(monthlySubtotal);
  byId("summary-duration").textContent = `${duration} months`;
  byId("summary-total").textContent = currency.format(total);

  const otherRow = byId("other-summary-row");
  otherRow.classList.toggle("is-hidden", otherCount === 0);
  byId("other-summary").textContent = `${otherCount}`;

  renderThumbnailPreview();
}

function setupAuthTabs() {
  if (!document.querySelector("[data-auth-tab]")) {
    return;
  }

  const tabs = document.querySelectorAll("[data-auth-tab]");
  const panels = document.querySelectorAll("[data-auth-panel]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-auth-tab");

      tabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", selected ? "true" : "false");
      });

      panels.forEach((panel) => {
        const shouldShow = panel.getAttribute("data-auth-panel") === target;
        panel.classList.toggle("is-hidden", !shouldShow);
      });
    });
  });
}

function renderItems() {
  const itemList = byId("item-list");
  if (!itemList) {
    return;
  }

  itemList.innerHTML = state.items
    .map(
      (item, index) => `
      <article class="item-card" data-item-id="${item.id}">
        <div class="item-card-head">
          <h4>Item ${index + 1}</h4>
          <button type="button" class="btn btn-link item-remove" data-item-action="remove" ${
            state.items.length === 1 ? "disabled" : ""
          }>Remove</button>
        </div>

        <label for="item-type-${item.id}">Type</label>
        <select id="item-type-${item.id}" data-item-action="type">
          ${ITEM_TYPES.map(
            (entry) => `<option value="${entry.value}" ${item.type === entry.value ? "selected" : ""}>${entry.label} (${currency.format(entry.price)}/month)</option>`,
          ).join("")}
        </select>

        <label for="item-name-${item.id}" class="${item.type === "other" ? "" : "is-hidden"}">Describe item</label>
        <input
          id="item-name-${item.id}"
          type="text"
          maxlength="80"
          placeholder="e.g. Study lamp"
          data-item-action="name"
          value="${item.name}"
          class="${item.type === "other" ? "" : "is-hidden"}"
        />

        <label for="item-photo-${item.id}">Item photo</label>
        <input id="item-photo-${item.id}" type="file" accept="image/*" data-item-action="photo" />
        <p class="hint">${item.photoName ? `Saved: ${item.photoName}` : "No photo attached yet"}</p>
        ${item.s3Key ? `<p class="hint">S3 key: <code>${item.s3Key}</code></p>` : ""}
      </article>
    `,
    )
    .join("");

  bindItemCardEvents();
  updateEstimate();
}

function renderThumbnailPreview() {
  const container = byId("thumbnail-preview");
  if (!container) {
    return;
  }

  const thumbItems = state.items.filter((item) => item.thumbnail);
  if (!thumbItems.length) {
    container.innerHTML = "<p class='hint'>Upload photos to preview thumbnails here.</p>";
    return;
  }

  container.innerHTML = thumbItems
    .map(
      (item) => `
      <figure class="thumb-card">
        <img src="${item.thumbnail}" alt="${getItemLabel(item)}" loading="lazy" />
        <figcaption>${getItemLabel(item)}</figcaption>
      </figure>
    `,
    )
    .join("");
}

function bindItemCardEvents() {
  document.querySelectorAll("[data-item-id]").forEach((card) => {
    const itemId = card.getAttribute("data-item-id");
    const item = state.items.find((entry) => entry.id === itemId);
    if (!item) {
      return;
    }

    card.querySelectorAll("[data-item-action]").forEach((control) => {
      control.addEventListener("change", (event) => {
        const action = control.getAttribute("data-item-action");

        if (action === "type") {
          item.type = event.target.value;
          if (item.type !== "other") {
            item.name = "";
          }
          renderItems();
          return;
        }

        if (action === "name") {
          item.name = event.target.value;
          updateEstimate();
          return;
        }

        if (action === "photo") {
          const [file] = event.target.files || [];
          if (!file) {
            return;
          }

          item.photo = file;
          item.photoName = file.name;
          item.thumbnail = URL.createObjectURL(file);
          item.s3Key = `bookings/${state.bookingId || "draft"}/${item.id}-${file.name.replace(/\s+/g, "-").toLowerCase()}`;
          renderItems();
          return;
        }

        if (action === "remove") {
          if (state.items.length > 1) {
            state.items = state.items.filter((entry) => entry.id !== itemId);
            renderItems();
          }
        }
      });

      if (control.getAttribute("data-item-action") === "remove") {
        control.addEventListener("click", () => {
          if (state.items.length > 1) {
            state.items = state.items.filter((entry) => entry.id !== itemId);
            renderItems();
          }
        });
      }
    });
  });
}

function setReviewStatus(label) {
  const node = byId("review-status");
  if (node) {
    node.textContent = label;
  }
}

function updateStepper() {
  const steps = document.querySelectorAll(".stepper li");
  if (steps.length === 0) {
    return;
  }

  const currentIndex = Math.max(statusSteps.indexOf(state.status), 0);
  steps.forEach((step, index) => {
    step.classList.toggle("active", index === currentIndex);
    step.classList.toggle("done", index < currentIndex);
  });
}

function getBookingPayload() {
  const pricing = calculatePricing();
  return {
    customer_name: readText("signup-name", "Demo Student"),
    email: readText("signup-email") || readText("signin-email") || "demo@hss.co.za",
    pickup_date: readText("pickup-date"),
    pickup_window: readText("pickup-window"),
    address: readText("address"),
    items: state.items.map((item) => ({ type: item.type, name: item.name, s3Key: item.s3Key })),
    pricing,
  };
}

function setLoading(button, loading) {
  if (!button) {
    return;
  }
  button.disabled = loading;
  button.dataset.loading = loading ? "true" : "false";
}

function persistSession(loginResponse) {
  state.session.token = loginResponse.token;
  state.session.role = loginResponse.role;
  sessionStorage.setItem("hss-token", loginResponse.token);
  sessionStorage.setItem("hss-role", loginResponse.role);
}

function setupForms() {
  const signInForm = byId("signin-form");
  const signUpForm = byId("signup-form");
  const bookingForm = byId("booking-form");
  const approveOrder = byId("approve-order");
  const proceedPayment = byId("proceed-payment");

  signInForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = readText("signin-email", "demo@hss.co.za").trim();
    const submitButton = signInForm.querySelector("button[type='submit']");
    setLoading(submitButton, true);

    try {
      const login = await api.request("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      persistSession(login);
      showMessage("auth-status", `Signed in securely as ${login.role}. Session active for ${login.expires_in / 60} minutes.`, "success");
    } catch (error) {
      showMessage("auth-status", `Unable to sign in: ${error.message}`, "warning");
    } finally {
      setLoading(submitButton, false);
    }
  });

  signUpForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    showMessage("auth-status", "Account staged locally. Continue to booking submission.", "success");
  });

  bookingForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.items.length === 0) {
      showMessage("form-status", "Please add at least one item before submitting.", "warning");
      return;
    }

    const payload = getBookingPayload();
    const submitButton = bookingForm.querySelector("button[type='submit']");
    setLoading(submitButton, true);

    try {
      const booking = await api.request("/api/v1/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      state.bookingId = booking.booking_id;
      state.status = "submitted";
      approveOrder.disabled = false;
      proceedPayment.disabled = true;
      setReviewStatus(`Submitted (${booking.booking_id})`);
      updateStepper();
      showMessage("form-status", "Booking submitted to backend and awaiting staff review.", "success");
    } catch (error) {
      state.status = "submitted";
      approveOrder.disabled = false;
      proceedPayment.disabled = true;
      setReviewStatus("Submitted (local fallback)");
      updateStepper();
      showMessage("form-status", `Backend unavailable; local flow active: ${error.message}`, "warning");
    } finally {
      setLoading(submitButton, false);
    }
  });

  approveOrder?.addEventListener("click", async () => {
    if (!state.status || !["submitted", "approved"].includes(state.status)) {
      return;
    }

    setLoading(approveOrder, true);
    if (state.bookingId) {
      try {
        await api.request(`/api/v1/bookings/${state.bookingId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "approved" }),
        });
      } catch (error) {
        showMessage("form-status", `Could not update backend status: ${error.message}`, "warning");
      }
    }

    state.status = "approved";
    setReviewStatus("Approved by staff");
    proceedPayment.disabled = false;
    updateStepper();
    showMessage("form-status", "Staff approval complete. Payment unlocked.", "success");
    setLoading(approveOrder, false);
  });

  proceedPayment?.addEventListener("click", async () => {
    if (state.status !== "approved") {
      showMessage("form-status", "Payment is locked until staff approval is complete.", "warning");
      return;
    }

    setLoading(proceedPayment, true);
    if (state.bookingId) {
      try {
        const payment = await api.request(`/api/v1/bookings/${state.bookingId}/payment`, {
          method: "POST",
          body: JSON.stringify({ method: readText("payment-method", "card").toLowerCase() || "card" }),
        });
        state.status = "paid";
        setReviewStatus(`Paid (${payment.payment_reference})`);
        updateStepper();
        showMessage("form-status", `Payment captured. Reference: ${payment.payment_reference}.`, "success");
        setLoading(proceedPayment, false);
        return;
      } catch (error) {
        showMessage("form-status", `Payment fallback mode: ${error.message}`, "warning");
      }
    }

    state.status = "paid";
    const confirmationId = `HSS-${Math.floor(Math.random() * 900000 + 100000)}`;
    setReviewStatus(`Paid (${confirmationId})`);
    updateStepper();
    showMessage("form-status", `Booking confirmed locally. Confirmation ID: ${confirmationId}`, "success");
    setLoading(proceedPayment, false);
  });
}

function setupEstimateRefresh() {
  if (!byId("duration")) {
    return;
  }

  byId("duration").addEventListener("input", updateEstimate);
  byId("estimate-btn").addEventListener("click", updateEstimate);

  byId("add-item").addEventListener("click", () => {
    state.items.push(createItem());
    renderItems();
  });

  const apiBaseInput = byId("api-base");
  apiBaseInput.value = state.apiBase;
  apiBaseInput.addEventListener("change", () => {
    state.apiBase = apiBaseInput.value.trim().replace(/\/$/, "");
    localStorage.setItem("hss-api-base", state.apiBase);
    showMessage("api-status", `API base updated to ${state.apiBase}`, "success");
  });

  if (state.session.token) {
    showMessage("api-status", `Authenticated session detected (${state.session.role}).`, "success");
  }
}

setupAuthTabs();
setupForms();
setupEstimateRefresh();

if (byId("item-list")) {
  state.items.push(createItem("bed"), createItem("fridge"), createItem("box"));
  renderItems();
  updateEstimate();
  setReviewStatus("Draft");
  updateStepper();
}
