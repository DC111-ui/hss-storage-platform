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
  apiBase: localStorage.getItem("hss-api-base") || "http://localhost:8081",
};

function value(id) {
  const input = document.getElementById(id);
  return Number.parseInt(input?.value || "0", 10) || 0;
}

function showMessage(targetId, message, tone = "neutral") {
  const node = document.getElementById(targetId);
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
  const { duration, monthlySubtotal, total, itemsCount, photosCount, otherCount } = calculatePricing();

  document.getElementById("estimate").textContent = currency.format(total);
  document.getElementById("monthly-subtotal").textContent = currency.format(monthlySubtotal);
  document.getElementById("duration-label").textContent = `${duration} months`;

  document.getElementById("items-summary").textContent = `${itemsCount}`;
  document.getElementById("photo-summary").textContent = `${photosCount}`;
  document.getElementById("summary-monthly").textContent = currency.format(monthlySubtotal);
  document.getElementById("summary-duration").textContent = `${duration} months`;
  document.getElementById("summary-total").textContent = currency.format(total);

  const otherRow = document.getElementById("other-summary-row");
  otherRow.classList.toggle("is-hidden", otherCount === 0);
  document.getElementById("other-summary").textContent = `${otherCount}`;

  renderThumbnailPreview();
}

function setupAuthTabs() {
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
  const itemList = document.getElementById("item-list");

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
  const container = document.getElementById("thumbnail-preview");
  const thumbItems = state.items.filter((item) => item.thumbnail);

  if (thumbItems.length === 0) {
    container.innerHTML = '<p class="hint">Item thumbnails appear here once photos are uploaded.</p>';
    return;
  }

  container.innerHTML = thumbItems
    .map(
      (item) => `
      <figure class="thumb-card">
        <img src="${item.thumbnail}" alt="Thumbnail for ${getItemLabel(item)}" />
        <figcaption>${getItemLabel(item)}</figcaption>
      </figure>
    `,
    )
    .join("");
}

function generateS3Key(fileName) {
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9.-]/g, "-");
  return `s3://hss-storage-item-photos/orders/${Date.now()}-${safeName}`;
}

function handlePhotoUpload(item, fileInput) {
  const [file] = fileInput.files;
  if (!file) {
    return;
  }

  item.photo = file;
  item.photoName = file.name;
  item.s3Key = generateS3Key(file.name);

  const reader = new FileReader();
  reader.onload = () => {
    item.thumbnail = String(reader.result || "");
    updateEstimate();
    renderItems();
  };
  reader.readAsDataURL(file);
}

function bindItemCardEvents() {
  document.querySelectorAll(".item-card").forEach((card) => {
    const item = state.items.find((entry) => entry.id === card.dataset.itemId);
    if (!item) {
      return;
    }

    card.querySelector('[data-item-action="remove"]')?.addEventListener("click", () => {
      state.items = state.items.filter((entry) => entry.id !== item.id);
      renderItems();
    });

    card.querySelector('[data-item-action="type"]')?.addEventListener("change", (event) => {
      item.type = event.target.value;
      if (item.type !== "other") {
        item.name = "";
      }
      renderItems();
    });

    card.querySelector('[data-item-action="name"]')?.addEventListener("input", (event) => {
      item.name = event.target.value;
      updateEstimate();
    });

    card.querySelector('[data-item-action="photo"]')?.addEventListener("change", (event) => {
      handlePhotoUpload(item, event.target);
    });
  });
}

function setReviewStatus(text) {
  document.getElementById("review-status").textContent = text;
}

function updateStepper() {
  const steps = document.querySelectorAll(".stepper li");
  const currentIndex = Math.max(statusSteps.indexOf(state.status), 0);
  steps.forEach((step, index) => {
    step.classList.toggle("active", index === currentIndex);
    step.classList.toggle("done", index < currentIndex);
  });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${state.apiBase}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `API request failed (${response.status})`);
  }
  return data;
}

function getBookingPayload() {
  const pricing = calculatePricing();
  return {
    customer_name: document.getElementById("signup-name").value || "Demo Student",
    email: document.getElementById("signup-email").value || document.getElementById("signin-email").value || "demo@hss.co.za",
    pickup_date: document.getElementById("pickup-date").value,
    pickup_window: document.getElementById("pickup-window").value,
    address: document.getElementById("address").value,
    items: state.items.map((item) => ({ type: item.type, name: item.name, s3Key: item.s3Key })),
    pricing,
  };
}

function setupForms() {
  const approveOrder = document.getElementById("approve-order");
  const proceedPayment = document.getElementById("proceed-payment");

  document.getElementById("signin-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("signin-email").value;

    try {
      const login = await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      showMessage("auth-status", `Signed in. Session token: ${login.token}`, "success");
    } catch (error) {
      showMessage("auth-status", `Demo sign in fallback: ${error.message}`, "warning");
    }
  });

  document.getElementById("signup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    showMessage("auth-status", "Account staged locally. Continue to booking submission.", "success");
  });

  document.getElementById("booking-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (state.items.length === 0) {
      showMessage("form-status", "Please add at least one item before submitting.", "warning");
      return;
    }

    const payload = getBookingPayload();
    try {
      const booking = await apiRequest("/api/v1/bookings", {
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
    }
  });

  approveOrder.addEventListener("click", async () => {
    if (!state.status || !["submitted", "approved"].includes(state.status)) {
      return;
    }

    if (state.bookingId) {
      try {
        await apiRequest(`/api/v1/bookings/${state.bookingId}/status`, {
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
  });

  proceedPayment.addEventListener("click", async () => {
    if (state.status !== "approved") {
      showMessage("form-status", "Payment is locked until staff approval is complete.", "warning");
      return;
    }

    if (state.bookingId) {
      try {
        const payment = await apiRequest(`/api/v1/bookings/${state.bookingId}/payment`, {
          method: "POST",
          body: JSON.stringify({ method: document.getElementById("payment-method").value || "card" }),
        });
        state.status = "paid";
        setReviewStatus(`Paid (${payment.payment_reference})`);
        updateStepper();
        showMessage("form-status", `Payment captured. Reference: ${payment.payment_reference}.`, "success");
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
  });
}

function setupEstimateRefresh() {
  document.getElementById("duration").addEventListener("input", updateEstimate);
  document.getElementById("estimate-btn").addEventListener("click", updateEstimate);

  document.getElementById("add-item").addEventListener("click", () => {
    state.items.push(createItem());
    renderItems();
  });

  const apiBaseInput = document.getElementById("api-base");
  apiBaseInput.value = state.apiBase;
  apiBaseInput.addEventListener("change", () => {
    state.apiBase = apiBaseInput.value.trim().replace(/\/$/, "");
    localStorage.setItem("hss-api-base", state.apiBase);
    showMessage("api-status", `API base updated to ${state.apiBase}`, "success");
  });
}

setupAuthTabs();
setupForms();
setupEstimateRefresh();
state.items.push(createItem("bed"), createItem("fridge"), createItem("box"));
renderItems();
updateEstimate();
setReviewStatus("Draft");
updateStepper();
