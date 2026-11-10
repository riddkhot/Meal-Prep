renderShell("plan");

const root = document.getElementById("plan-root");
const profile = getProfile();

function formatQty(qty, unit) {
  const r = (n) => (Math.round(n * 10) / 10).toString();
  if (unit === "g" && qty >= 1000) return `${r(qty / 1000)} kg`;
  if (unit === "ml" && qty >= 1000) return `${r(qty / 1000)} L`;
  if (unit === "pc") return `${Math.ceil(qty)}`; // you can't buy half a pepper
  if (unit === "tbsp" || unit === "tsp" || unit === "scoop" || unit === "clove") return `${r(qty)} ${unit}${qty > 1 && unit !== "tbsp" && unit !== "tsp" ? "s" : ""}`;
  return `${Math.round(qty)} ${unit}`;
}

function groceryList(meals, days) {
  const map = new Map();
  meals.forEach((m) => m.ingredients.forEach((i) => {
    const key = `${i.name}|${i.unit}`;
    const cur = map.get(key) || { ...i, qty: 0, usedIn: new Set() };
    cur.qty += i.qty * days;
    cur.usedIn.add(m.name);
    map.set(key, cur);
  }));
  const byCat = {};
  [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    .forEach((i) => (byCat[i.cat] ||= []).push(i));
  return byCat;
}

function render() {
  const plan = getPlan();
  const meals = SLOTS.map((s) => plan.slots[s] && mealById(plan.slots[s])).filter(Boolean);

  if (!meals.length) {
    root.innerHTML = `
      <div class="card empty-state">
        <div class="big-emoji">🍱</div>
        <h2>Your plan is empty</h2>
        <p>Pick a breakfast, lunch, dinner and snack, and we'll build your prep schedule and grocery list.</p>
        <a href="meals.html" class="btn btn-primary btn-lg">Browse meal ideas →</a>
        ${profile ? "" : `<p class="small muted">Or <a href="calculator.html">calculate your calories</a> first.</p>`}
      </div>`;
    return;
  }

  const days = plan.days;
  const t = meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.protein, c: a.c + m.carbs, f: a.f + m.fat }), { kcal: 0, p: 0, c: 0, f: 0 });
  const target = profile?.target;
  const pct = target ? Math.min(100, (t.kcal / target) * 100) : 0;
  const diff = target ? t.kcal - target : 0;
  const status = !target ? "" : Math.abs(diff) <= target * 0.1
    ? `<span class="ok">✓ On target (${diff >= 0 ? "+" : ""}${fmt(diff)} kcal)</span>`
    : diff < 0 ? `<span class="warn">${fmt(-diff)} kcal under target. Add a snack or swap in a bigger meal.</span>`
    : `<span class="warn">${fmt(diff)} kcal over target. Try a lighter swap.</span>`;
  const totalPrep = meals.reduce((a, m) => a + m.prepMin, 0);
  const grocery = groceryList(meals, days);
  const checked = Store.get("checked", {});

  root.innerHTML = `
    <div class="plan-layout">
      <div>
        <section class="card">
          <div class="row-between">
            <h2>Daily menu</h2>
            <label class="days-picker">Prep for
              <select id="days">${[3, 4, 5, 6, 7].map((d) => `<option ${d === days ? "selected" : ""}>${d}</option>`).join("")}</select>
              days
            </label>
          </div>
          <ul class="slot-list">
            ${SLOTS.map((s) => {
              const m = plan.slots[s] && mealById(plan.slots[s]);
              return m ? `
                <li class="slot">
                  <span class="meal-emoji">${m.emoji}</span>
                  <div class="slot-info"><span class="slot-name">${cap(s)}</span><b>${m.name}</b>
                    <span class="muted small">${m.kcal} kcal · P ${m.protein}g · C ${m.carbs}g · F ${m.fat}g</span></div>
                  <div class="slot-actions no-print">
                    <a href="meals.html?type=${s}" class="btn btn-ghost btn-sm">Swap</a>
                    <button class="btn btn-ghost btn-sm" data-remove="${s}" aria-label="Remove">✕</button>
                  </div>
                </li>` : `
                <li class="slot slot-empty">
                  <span class="meal-emoji">＋</span>
                  <div class="slot-info"><span class="slot-name">${cap(s)}</span><span class="muted">Nothing chosen yet</span></div>
                  <a href="meals.html?type=${s}" class="btn btn-primary btn-sm no-print">Choose ${s}</a>
                </li>`;
            }).join("")}
          </ul>

          <div class="totals">
            <div class="row-between"><b>Daily total</b><b>${fmt(t.kcal)}${target ? ` / ${fmt(target)}` : ""} kcal</b></div>
            ${target ? `<div class="progress"><span style="width:${pct}%" class="${Math.abs(diff) <= target * 0.1 ? "good" : "off"}"></span></div><p class="small">${status}</p>` : `<p class="small muted"><a href="calculator.html">Set a calorie target</a> to compare against.</p>`}
            ${macroBar(t.p, t.c, t.f)}
            <div class="macro-legend">
              <span><i class="dot mp"></i>Protein <b>${t.p}g</b>${profile ? ` / ${profile.protein}g` : ""}</span>
              <span><i class="dot mc"></i>Carbs <b>${t.c}g</b>${profile ? ` / ${profile.carbs}g` : ""}</span>
              <span><i class="dot mf"></i>Fat <b>${t.f}g</b>${profile ? ` / ${profile.fat}g` : ""}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Prep-day game plan</h2>
          <p class="muted">About <b>${Math.round(totalPrep * 0.75)}–${totalPrep} min</b> if you overlap tasks. Cook <b>${days} portions</b> of each recipe. Longest recipes come first.</p>
          <ol class="game-plan">
            ${[...meals].sort((a, b) => b.prepMin - a.prepMin).map((m) => `
              <li>
                <div class="row-between"><b>${m.emoji} ${m.name}</b><span class="muted small">⏱ ${m.prepMin} min · ${days} portions</span></div>
                <ul class="small">${m.steps.map((s) => `<li>${s}</li>`).join("")}</ul>
                ${m.fridgeDays < days ? `<p class="note small">🧊 This keeps ${m.fridgeDays} days in the fridge. Freeze ${days - m.fridgeDays} portion${days - m.fridgeDays > 1 ? "s" : ""} and thaw them the night before.</p>` : ""}
              </li>`).join("")}
          </ol>
        </section>
      </div>

      <aside class="card grocery">
        <div class="row-between"><h2>🛒 Grocery list</h2><span class="muted small">${days} days</span></div>
        ${Object.keys(grocery).sort().map((cat) => `
          <h4>${cat}</h4>
          <ul class="grocery-list">
            ${grocery[cat].map((i) => {
              const key = `${i.name}|${i.unit}`;
              return `<li><label class="${checked[key] ? "got" : ""}">
                <input type="checkbox" data-check="${key}" ${checked[key] ? "checked" : ""} />
                <span>${i.name}</span><b>${formatQty(i.qty, i.unit)}</b></label></li>`;
            }).join("")}
          </ul>`).join("")}
        <p class="small muted">Tick items as you shop. Your progress is saved on this device.</p>
      </aside>
    </div>`;
}

root.addEventListener("change", (e) => {
  if (e.target.id === "days") {
    const plan = getPlan();
    plan.days = +e.target.value;
    savePlan(plan);
    render();
  } else if (e.target.dataset.check) {
    const checked = Store.get("checked", {});
    checked[e.target.dataset.check] = e.target.checked;
    Store.set("checked", checked);
    e.target.closest("label").classList.toggle("got", e.target.checked);
  }
});

root.addEventListener("click", (e) => {
  const rm = e.target.closest("[data-remove]");
  if (!rm) return;
  const plan = getPlan();
  delete plan.slots[rm.dataset.remove];
  savePlan(plan);
  render();
});

document.getElementById("clear-btn").addEventListener("click", () => {
  if (!confirm("Clear all meals from your plan?")) return;
  savePlan({ days: getPlan().days, slots: {} });
  Store.remove("checked");
  render();
});
document.getElementById("print-btn").addEventListener("click", () => window.print());

render();
