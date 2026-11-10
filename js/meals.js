renderShell("meals");

const grid = document.getElementById("meal-grid");
const dialog = document.getElementById("meal-dialog");
const profile = getProfile();
const params = new URLSearchParams(location.search);
const state = { type: SLOTS.includes(params.get("type")) ? params.get("type") : "all", diet: "", q: "", fitsOnly: false };

const budget = (slot) => (profile ? profile.target * SLOT_SPLIT[slot] : null);
// A meal "fits" if it's within ±20% of that slot's calorie budget.
const fits = (m) => profile && Math.abs(m.kcal - budget(m.type)) / budget(m.type) <= 0.2;

function renderBanner() {
  const el = document.getElementById("target-banner");
  if (!profile) {
    el.innerHTML = `💡 <b>Tip:</b> <a href="calculator.html">Calculate your calories</a> first to see which meals fit your goal.`;
    document.getElementById("fits-only").parentElement.hidden = true;
    return;
  }
  el.innerHTML = `🎯 Your target is <b>${fmt(profile.target)} kcal/day</b>. Per-meal budget: ` +
    SLOTS.map((s) => `${cap(s)} ~${fmt(budget(s))}`).join(" · ") +
    ` <a href="calculator.html" class="small">Edit</a>`;
}

function filtered() {
  const q = state.q.toLowerCase();
  return MEALS.filter((m) =>
    (state.type === "all" || m.type === state.type) &&
    (!state.diet || m.tags.includes(state.diet)) &&
    (!state.fitsOnly || fits(m)) &&
    (!q || m.name.toLowerCase().includes(q) || m.ingredients.some((i) => i.name.toLowerCase().includes(q)))
  );
}

function renderGrid() {
  const plan = getPlan();
  const list = filtered();
  document.getElementById("result-count").textContent = `${list.length} meal${list.length === 1 ? "" : "s"}`;
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state card"><div class="big-emoji">🔍</div><p>No meals match these filters.</p></div>`;
    return;
  }
  grid.innerHTML = list.map((m) => {
    const inPlan = plan.slots[m.type] === m.id;
    const slotTaken = plan.slots[m.type] && !inPlan;
    return `
    <article class="meal-card ${inPlan ? "in-plan" : ""}">
      <div class="meal-top">
        <span class="meal-emoji">${m.emoji}</span>
        <span class="pill type-${m.type}">${cap(m.type)}</span>
        ${fits(m) ? `<span class="pill fit">✓ Fits budget</span>` : ""}
      </div>
      <h3>${m.name}</h3>
      <p class="muted small">${m.blurb}</p>
      <div class="meal-kcal"><b>${m.kcal}</b> kcal
        ${profile ? `<span class="muted small">· ${Math.round((m.kcal / profile.target) * 100)}% of daily</span>` : ""}
      </div>
      ${macroBar(m.protein, m.carbs, m.fat)}
      <div class="meal-meta small">
        <span>P ${m.protein}g</span><span>C ${m.carbs}g</span><span>F ${m.fat}g</span>
        <span>⏱ ${m.prepMin} min</span><span>🧊 ${m.fridgeDays >= 30 ? "freezer" : m.fridgeDays + " days"}</span>
      </div>
      <div class="tags">${m.tags.map((t) => `<span class="tag">${t}</span>`).join("")}</div>
      <div class="card-actions">
        <button class="btn btn-ghost" data-details="${m.id}">Recipe</button>
        <button class="btn ${inPlan ? "btn-done" : "btn-primary"}" data-add="${m.id}">
          ${inPlan ? "✓ In plan" : slotTaken ? `Swap into ${m.type}` : `Add as ${m.type}`}
        </button>
      </div>
    </article>`;
  }).join("");
}

function renderPlanBar() {
  const n = planCount();
  const bar = document.getElementById("plan-bar");
  bar.hidden = n === 0;
  if (!n) return;
  const plan = getPlan();
  const kcal = SLOTS.reduce((sum, s) => sum + (plan.slots[s] ? mealById(plan.slots[s]).kcal : 0), 0);
  const missing = SLOTS.filter((s) => !plan.slots[s]);
  document.getElementById("plan-bar-text").innerHTML =
    `<b>${n}/4 meals</b> · ${fmt(kcal)}${profile ? ` / ${fmt(profile.target)}` : ""} kcal per day` +
    (missing.length ? ` <span class="muted">· still need: ${missing.join(", ")}</span>` : " · ✅ Day complete");
}

function toggleMeal(id) {
  const m = mealById(id);
  const plan = getPlan();
  if (plan.slots[m.type] === id) {
    delete plan.slots[m.type];
    toast(`Removed ${m.name}`);
  } else {
    plan.slots[m.type] = id;
    toast(`${m.emoji} Added <b>${m.name}</b> as your ${m.type}`);
  }
  savePlan(plan);
  renderGrid();
  renderPlanBar();
}

function openDetails(id) {
  const m = mealById(id);
  dialog.innerHTML = `
    <button class="dialog-close" aria-label="Close">✕</button>
    <div class="dialog-head"><span class="meal-emoji lg">${m.emoji}</span>
      <div><span class="pill type-${m.type}">${cap(m.type)}</span><h2>${m.name}</h2>
      <p class="muted">${m.kcal} kcal · P ${m.protein}g · C ${m.carbs}g · F ${m.fat}g · ⏱ ${m.prepMin} min</p></div>
    </div>
    <h3>Ingredients <span class="muted small">(per serving)</span></h3>
    <ul class="ing-list">${m.ingredients.map((i) => `<li><b>${i.qty} ${i.unit}</b> ${i.name}</li>`).join("")}</ul>
    <h3>Prep steps</h3>
    <ol class="steps">${m.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
    <p class="note">🧊 Keeps ${m.fridgeDays >= 30 ? "up to a month in the freezer" : `${m.fridgeDays} days in the fridge`}.</p>
    <button class="btn btn-primary btn-block" data-add="${m.id}">${getPlan().slots[m.type] === m.id ? "Remove from plan" : `Add as ${m.type}`}</button>`;
  dialog.showModal();
}

// Choose the combination (one per slot) closest to the user's target.
function suggestDay() {
  const pool = (slot) => MEALS.filter((m) => m.type === slot && (!state.diet || m.tags.includes(state.diet)));
  const target = profile ? profile.target : 2000;
  let best = null;
  for (const b of pool("breakfast")) for (const l of pool("lunch")) for (const d of pool("dinner")) for (const s of pool("snack")) {
    const kcal = b.kcal + l.kcal + d.kcal + s.kcal;
    const protein = b.protein + l.protein + d.protein + s.protein;
    // Prefer closeness to target, small tie-breaker for more protein + a little randomness for variety
    const score = Math.abs(kcal - target) - protein * 0.5 + Math.random() * 40;
    if (!best || score < best.score) best = { score, ids: [b, l, d, s].map((m) => m.id) };
  }
  if (!best) { toast("No full day possible with this diet filter."); return; }
  const plan = getPlan();
  SLOTS.forEach((s, i) => (plan.slots[s] = best.ids[i]));
  savePlan(plan);
  renderGrid();
  renderPlanBar();
  toast("✨ Built a full day for you. Click again for a different mix.");
}

// Events
document.getElementById("type-chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  state.type = chip.dataset.type;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
  renderGrid();
});
document.getElementById("search").addEventListener("input", (e) => { state.q = e.target.value; renderGrid(); });
document.getElementById("diet").addEventListener("change", (e) => { state.diet = e.target.value; renderGrid(); });
document.getElementById("fits-only").addEventListener("change", (e) => { state.fitsOnly = e.target.checked; renderGrid(); });
document.getElementById("suggest-btn").addEventListener("click", suggestDay);

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  const det = e.target.closest("[data-details]");
  if (add) { toggleMeal(add.dataset.add); if (dialog.open) dialog.close(); }
  else if (det) openDetails(det.dataset.details);
  else if (e.target.closest(".dialog-close") || e.target === dialog) dialog.close();
});

// Init
document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.type === state.type));
renderBanner();
renderGrid();
renderPlanBar();
