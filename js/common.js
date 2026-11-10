// Shared helpers: storage, plan state, header/stepper rendering, toast.
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem("mealprep." + key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem("mealprep." + key, JSON.stringify(value)); } catch {}
  },
  remove(key) {
    try { localStorage.removeItem("mealprep." + key); } catch {}
  },
};

const getProfile = () => Store.get("profile", null);
const getPlan = () => Store.get("plan", { days: 5, slots: {} });
const savePlan = (plan) => { Store.set("plan", plan); updatePlanBadge(); };
const mealById = (id) => MEALS.find((m) => m.id === id);
const fmt = (n) => Math.round(n).toLocaleString();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function planCount() {
  return Object.values(getPlan().slots).filter(Boolean).length;
}

function updatePlanBadge() {
  const b = document.getElementById("plan-badge");
  if (!b) return;
  const n = planCount();
  b.textContent = n;
  b.hidden = n === 0;
}

function renderShell(active) {
  const links = [
    ["index.html", "Home", "home"],
    ["calculator.html", "Calorie Calculator", "calculator"],
    ["meals.html", "Meal Ideas", "meals"],
    ["plan.html", "My Prep Plan", "plan"],
  ];
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap header-inner">
      <a href="index.html" class="logo"><span>🥗</span> PrepWise</a>
      <button class="nav-toggle" aria-label="Menu" aria-expanded="false">☰</button>
      <nav class="nav">
        ${links.map(([href, label, key]) => `
          <a href="${href}" class="${key === active ? "active" : ""}">${label}
            ${key === "plan" ? '<span id="plan-badge" class="badge" hidden>0</span>' : ""}
          </a>`).join("")}
      </nav>
    </div>`;
  document.body.prepend(header);
  const toggle = header.querySelector(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open);
  });

  // User-story progress stepper on the three flow pages
  const steps = [["calculator", "Know your calories"], ["meals", "Pick your meals"], ["plan", "Prep & shop"]];
  const idx = steps.findIndex(([k]) => k === active);
  if (idx >= 0) {
    const s = document.createElement("div");
    s.className = "stepper wrap";
    s.innerHTML = steps.map(([k, label], i) => `
      <a href="${k}.html" class="step ${i < idx ? "done" : ""} ${i === idx ? "current" : ""}">
        <span class="step-num">${i < idx ? "✓" : i + 1}</span><span>${label}</span>
      </a>`).join('<span class="step-line"></span>');
    header.after(s);
  }

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="wrap">PrepWise · Calorie estimates use the Mifflin-St Jeor equation and are a starting point, not medical advice.</div>`;
  document.body.append(footer);
  updatePlanBadge();
}

function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.append(t);
  }
  t.innerHTML = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2600);
}

function macroBar(p, c, f) {
  const total = p * 4 + c * 4 + f * 9 || 1;
  return `<div class="macro-bar" title="Protein ${p}g · Carbs ${c}g · Fat ${f}g">
    <span class="mp" style="width:${(p * 4 / total) * 100}%"></span>
    <span class="mc" style="width:${(c * 4 / total) * 100}%"></span>
    <span class="mf" style="width:${(f * 9 / total) * 100}%"></span>
  </div>`;
}
