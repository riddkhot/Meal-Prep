renderShell("calculator");

const form = document.getElementById("calc-form");
const results = document.getElementById("results");
const errorEl = document.getElementById("form-error");

function syncUnits() {
  const units = form.units.value;
  document.getElementById("height-metric").hidden = units !== "metric";
  document.getElementById("height-imperial").hidden = units !== "imperial";
  document.querySelectorAll(".unit").forEach((u) => (u.textContent = u.dataset[units]));
  form.weight.placeholder = units === "metric" ? "70" : "155";
}
form.querySelectorAll('input[name="units"]').forEach((r) => r.addEventListener("change", syncUnits));

function calculate(inputs) {
  const kg = inputs.units === "metric" ? inputs.weight : inputs.weight * 0.453592;
  const cm = inputs.units === "metric" ? inputs.heightCm : (inputs.heightFt * 12 + (inputs.heightIn || 0)) * 2.54;
  // Mifflin-St Jeor
  const bmr = 10 * kg + 6.25 * cm - 5 * inputs.age + (inputs.sex === "male" ? 5 : -161);
  const tdee = bmr * inputs.activity;
  const floor = inputs.sex === "male" ? 1500 : 1200;
  const raw = tdee + inputs.goal;
  const target = Math.round(Math.max(raw, floor) / 10) * 10;

  // Macros: protein by bodyweight (higher when cutting/bulking), fat 27%, rest carbs
  const proteinPerKg = inputs.goal === 0 ? 1.6 : 2.0;
  const protein = Math.round(kg * proteinPerKg);
  const fat = Math.round((target * 0.27) / 9);
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4));

  return { bmr, tdee, target, protein, carbs, fat, floored: raw < floor, kg, cm };
}

function readInputs() {
  const n = (name) => parseFloat(form[name].value);
  return {
    units: form.units.value,
    sex: form.sex.value,
    age: n("age"),
    weight: n("weight"),
    heightCm: n("heightCm"),
    heightFt: n("heightFt"),
    heightIn: n("heightIn") || 0,
    activity: n("activity"),
    goal: n("goal"),
  };
}

function validate(i) {
  if (!(i.age >= 15 && i.age <= 90)) return "Please enter an age between 15 and 90.";
  if (!(i.weight > 0)) return "Please enter your weight.";
  if (i.units === "metric" && !(i.heightCm >= 120 && i.heightCm <= 230)) return "Please enter a height between 120 and 230 cm.";
  if (i.units === "imperial" && !(i.heightFt >= 4 && i.heightFt <= 7)) return "Please enter your height in feet and inches.";
  return null;
}

function renderResults(r) {
  const goalLabel = { "-500": "lose ~0.5 kg (1 lb) per week", "-250": "lose ~0.25 kg (½ lb) per week", "0": "maintain your weight", "300": "build lean muscle" }[r.goal];
  results.classList.remove("empty");
  results.innerHTML = `
    <p class="eyebrow">Your daily target</p>
    <div class="target-num">${fmt(r.target)} <small>kcal/day</small></div>
    <p class="muted">This is the amount to ${goalLabel}.</p>
    ${r.floored ? `<p class="note">We raised your target to a safe minimum. Talk to a professional before eating less than this.</p>` : ""}

    <div class="stat-row">
      <div class="stat"><span>BMR</span><b>${fmt(r.bmr)}</b><small>at complete rest</small></div>
      <div class="stat"><span>Maintenance</span><b>${fmt(r.tdee)}</b><small>with your activity</small></div>
    </div>

    <h3>Daily macros</h3>
    ${macroBar(r.protein, r.carbs, r.fat)}
    <div class="macro-legend">
      <span><i class="dot mp"></i>Protein <b>${r.protein}g</b></span>
      <span><i class="dot mc"></i>Carbs <b>${r.carbs}g</b></span>
      <span><i class="dot mf"></i>Fat <b>${r.fat}g</b></span>
    </div>

    <h3>Per-meal calorie budget</h3>
    <ul class="budget-list">
      ${SLOTS.map((s) => `<li><span>${cap(s)}</span><b>~${fmt(r.target * SLOT_SPLIT[s])} kcal</b></li>`).join("")}
    </ul>

    <a href="meals.html" class="btn btn-primary btn-lg btn-block">Next: find meals that fit →</a>`;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const inputs = readInputs();
  const err = validate(inputs);
  errorEl.hidden = !err;
  errorEl.textContent = err || "";
  if (err) return;
  const r = { ...calculate(inputs), goal: String(inputs.goal) };
  Store.set("profile", { inputs, ...r });
  renderResults(r);
  if (window.innerWidth < 860) results.scrollIntoView({ behavior: "smooth" });
  toast("✅ Target saved. Meal ideas will now be sized to it.");
});

// Prefill from a saved profile
const saved = getProfile();
if (saved && saved.inputs) {
  const i = saved.inputs;
  form.units.value = i.units;
  form.sex.value = i.sex;
  form.goal.value = String(i.goal);
  form.activity.value = String(i.activity);
  ["age", "weight", "heightCm", "heightFt", "heightIn"].forEach((k) => { if (i[k]) form[k].value = i[k]; });
  syncUnits();
  renderResults(saved);
} else {
  syncUnits();
}
