const PRICING = {
  bed: 250,
  fridge: 300,
  box: 60,
};

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

function value(id) {
  const input = document.getElementById(id);
  return Number.parseInt(input.value || "0", 10);
}

function calculateEstimate() {
  const beds = value("beds");
  const fridges = value("fridges");
  const boxes = value("boxes");
  const duration = Math.max(value("duration"), 1);

  const monthlyTotal =
    beds * PRICING.bed + fridges * PRICING.fridge + boxes * PRICING.box;
  return monthlyTotal * duration;
}

document.getElementById("estimate-btn").addEventListener("click", () => {
  const total = calculateEstimate();
  document.getElementById("estimate").textContent = currency.format(total);
});

document.getElementById("booking-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const status = document.getElementById("form-status");
  const total = calculateEstimate();

  status.textContent = `Request saved. Estimated booking value: ${currency.format(total)}. Connect this form to your backend API to persist bookings.`;
});
