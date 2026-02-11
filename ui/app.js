const PRICING = {
  bed: 250,
  fridge: 300,
  box: 60,
  handlingFee: 350,
};

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

function value(id) {
  const input = document.getElementById(id);
  return Number.parseInt(input?.value || "0", 10) || 0;
}

function calculatePricing() {
  const beds = Math.max(value("beds"), 0);
  const fridges = Math.max(value("fridges"), 0);
  const boxes = Math.max(value("boxes"), 0);
  const duration = Math.max(value("duration"), 1);

  const monthlySubtotal =
    beds * PRICING.bed + fridges * PRICING.fridge + boxes * PRICING.box;
  const total = monthlySubtotal * duration + PRICING.handlingFee;

  return { beds, fridges, boxes, duration, monthlySubtotal, total };
}

function updateEstimate() {
  const { beds, fridges, boxes, duration, monthlySubtotal, total } =
    calculatePricing();

  document.getElementById("estimate").textContent = currency.format(total);
  document.getElementById("monthly-subtotal").textContent =
    currency.format(monthlySubtotal);
  document.getElementById("duration-label").textContent = `${duration} months`;

  document.getElementById("beds-summary").textContent = `${beds}`;
  document.getElementById("fridges-summary").textContent = `${fridges}`;
  document.getElementById("boxes-summary").textContent = `${boxes}`;
  document.getElementById("summary-monthly").textContent =
    currency.format(monthlySubtotal);
  document.getElementById("summary-duration").textContent = `${duration} months`;
  document.getElementById("summary-total").textContent = currency.format(total);
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

function setupForms() {
  const authStatus = document.getElementById("auth-status");
  const formStatus = document.getElementById("form-status");

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
    const { total } = calculatePricing();
    const confirmationId = `HSS-${Math.floor(Math.random() * 900000 + 100000)}`;

    formStatus.textContent = `Booking confirmed (demo). Confirmation ID: ${confirmationId}. Amount due now: ${currency.format(total)}. Next status: Pickup confirmed.`;
  });
}

function setupEstimateRefresh() {
  const inputs = ["beds", "fridges", "boxes", "duration"];
  inputs.forEach((id) => {
    document.getElementById(id).addEventListener("input", updateEstimate);
  });

  document.getElementById("estimate-btn").addEventListener("click", updateEstimate);
}

setupAuthTabs();
setupForms();
setupEstimateRefresh();
updateEstimate();
