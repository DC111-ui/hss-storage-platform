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

const state = {
  items: [],
  orderSubmitted: false,
  staffApproved: false,
};

function value(id) {
  const input = document.getElementById(id);
  return Number.parseInt(input?.value || "0", 10) || 0;
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
    container.innerHTML = "<p class=\"hint\">Item thumbnails appear here once photos are uploaded.</p>";
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

function setupForms() {
  const authStatus = document.getElementById("auth-status");
  const formStatus = document.getElementById("form-status");
  const approveOrder = document.getElementById("approve-order");
  const proceedPayment = document.getElementById("proceed-payment");

  document.getElementById("signin-form").addEventListener("submit", (event) => {
    event.preventDefault();
    authStatus.textContent =
      "Signed in (demo). Next: check your dashboard or create a new booking.";
  });

  document.getElementById("signup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    authStatus.textContent =
      "Account created (demo). Next: create your first booking using the guided checkout below.";
  });

  document.getElementById("booking-form").addEventListener("submit", (event) => {
    event.preventDefault();

    if (state.items.length === 0) {
      formStatus.textContent = "Please add at least one item before submitting.";
      return;
    }

    state.orderSubmitted = true;
    state.staffApproved = false;

    approveOrder.disabled = false;
    proceedPayment.disabled = true;
    setReviewStatus("Submitted - awaiting staff review");

    formStatus.textContent =
      "Order submitted (demo). A staff member must review item details and photos before payment can continue.";
  });

  approveOrder.addEventListener("click", () => {
    if (!state.orderSubmitted) {
      return;
    }

    state.staffApproved = true;
    setReviewStatus("Approved by staff");
    formStatus.textContent =
      "Staff review complete (demo). You can now proceed to payment.";
    proceedPayment.disabled = false;
  });

  proceedPayment.addEventListener("click", () => {
    const { total } = calculatePricing();

    if (!state.staffApproved) {
      formStatus.textContent = "Payment is locked until staff approval is complete.";
      return;
    }

    const confirmationId = `HSS-${Math.floor(Math.random() * 900000 + 100000)}`;
    formStatus.textContent = `Booking confirmed (demo). Confirmation ID: ${confirmationId}. Amount due now: ${currency.format(total)}.`;
  });
}

function setupEstimateRefresh() {
  document.getElementById("duration").addEventListener("input", updateEstimate);
  document.getElementById("estimate-btn").addEventListener("click", updateEstimate);

  document.getElementById("add-item").addEventListener("click", () => {
    state.items.push(createItem());
    renderItems();
  });
}

setupAuthTabs();
setupForms();
setupEstimateRefresh();
state.items.push(createItem("bed"), createItem("fridge"), createItem("box"));
renderItems();
updateEstimate();
setReviewStatus("Not submitted");
