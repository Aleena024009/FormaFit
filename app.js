'use strict';

/* ---------- Storage ---------- */

const STORE_KEY = 'formafit.v1';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

const ACTIVITY = {
  sedentary: { label: 'Sedentary (little exercise)', factor: 1.2 },
  light: { label: 'Light (1–3 days/week)', factor: 1.375 },
  moderate: { label: 'Moderate (3–5 days/week)', factor: 1.55 },
  active: { label: 'Active (6–7 days/week)', factor: 1.725 },
  athlete: { label: 'Very active (hard training + physical job)', factor: 1.9 }
};

const BMI_SCALES = {
  standard: { label: 'Standard (WHO)', healthyMax: 25, obeseMin: 30 },
  asian: { label: 'Asian (WHO Asia-Pacific)', healthyMax: 23, obeseMin: 27.5 }
};

function emptyState() {
  return {
    profile: null,
    days: {},
    plan: DAYS.map(() => ({ focus: '', exercises: [] })),
    sets: [],
    measurements: []
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return { ...emptyState(), ...JSON.parse(raw) };
  } catch (err) {
    console.warn('Could not read saved data', err);
  }
  return emptyState();
}

let state = load();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (err) {
    toast('Could not save. Storage may be full.');
  }
}

/* ---------- Helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shiftKey(key, delta) {
  const d = parseKey(key);
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

function prettyDate(key, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseKey(key).toLocaleDateString(undefined, opts);
}

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const round = (n, step = 1) => Math.round(n / step) * step;
const fmt = (n, digits = 0) => (n == null ? '–' : Number(n).toFixed(digits).replace(/\.0+$/, ''));

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

function day(key) {
  if (!state.days[key]) state.days[key] = { foods: [], water: 0, sleep: null, workoutDone: false };
  return state.days[key];
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

/* ---------- Calculations ---------- */

function latestWeight() {
  const withWeight = [...state.measurements].filter((m) => m.weight != null).sort((a, b) => a.date.localeCompare(b.date));
  return withWeight.length ? withWeight[withWeight.length - 1].weight : state.profile?.weight ?? null;
}

function calc() {
  const p = state.profile;
  if (!p) return null;
  const weight = latestWeight();
  const h = p.height;
  const bmr = 10 * weight + 6.25 * h - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const tdee = bmr * (ACTIVITY[p.activity]?.factor ?? 1.2);

  // ~7700 kcal per kg of body fat
  let adjust = 0;
  if (p.goal === 'lose') adjust = -(p.pace * 7700) / 7;
  if (p.goal === 'gain') adjust = (p.pace * 7700) / 7;

  const floor = p.sex === 'male' ? 1500 : 1200;
  const autoKcal = round(Math.max(tdee + adjust, floor), 10);
  const autoProtein = round(weight * p.proteinPerKg, 5);
  const autoWater = round(weight * 35 + (p.activity === 'sedentary' ? 0 : 500), 250);

  const hm = h / 100;
  const bmi = weight / (hm * hm);
  const scale = BMI_SCALES[p.bmiScale] ?? BMI_SCALES.standard;
  let bmiCat = 'Healthy';
  if (bmi < 18.5) bmiCat = 'Underweight';
  else if (bmi >= scale.obeseMin) bmiCat = 'Obese';
  else if (bmi >= scale.healthyMax) bmiCat = 'Overweight';

  return {
    weight,
    bmr: round(bmr, 10),
    tdee: round(tdee, 10),
    kcal: p.kcalOverride || autoKcal,
    protein: p.proteinOverride || autoProtein,
    water: p.waterOverride || autoWater,
    autoKcal,
    autoProtein,
    autoWater,
    bmi,
    bmiCat,
    healthyMin: 18.5 * hm * hm,
    healthyMax: scale.healthyMax * hm * hm
  };
}

/* ---------- Router ---------- */

const views = { today: renderToday, workout: renderWorkout, progress: renderProgress, profile: renderProfile };
let viewDate = dateKey();

function route() {
  const tab = location.hash.slice(1) || 'today';
  const view = $('#view');
  const nav = $('#tabbar');

  if (!state.profile) {
    nav.hidden = true;
    $('#greeting').textContent = 'Your body. Your strength. Your progress.';
    view.innerHTML = profileForm(true);
    bindProfileForm(true);
    return;
  }

  nav.hidden = false;
  $('#greeting').textContent = greeting();
  $$('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  (views[tab] || renderToday)();
  window.scrollTo(0, 0);
}

function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return state.profile.name ? `${part}, ${state.profile.name}` : part;
}

window.addEventListener('hashchange', route);

/* ---------- Today ---------- */

function renderToday() {
  const t = calc();
  const d = day(viewDate);
  const kcal = d.foods.reduce((s, f) => s + (f.kcal || 0), 0);
  const protein = d.foods.reduce((s, f) => s + (f.protein || 0), 0);
  const isToday = viewDate === dateKey();
  const plan = state.plan[parseKey(viewDate).getDay()];

  const circ = 2 * Math.PI * 50;
  const pct = Math.min(kcal / t.kcal, 1);
  const remaining = t.kcal - kcal;

  const knownFoods = foodHistory();

  $('#view').innerHTML = `
    <section class="card">
      <div class="daynav">
        <button class="icon" data-act="prev-day" aria-label="Previous day">◀</button>
        <strong>${isToday ? 'Today' : prettyDate(viewDate)}</strong>
        <button class="icon" data-act="next-day" aria-label="Next day" ${isToday ? 'disabled' : ''}>▶</button>
      </div>
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 120 120" role="img" aria-label="${kcal} of ${t.kcal} kcal">
          <circle class="track" cx="60" cy="60" r="50"/>
          <circle class="fill ${kcal > t.kcal ? 'over' : ''}" cx="60" cy="60" r="50"
            stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}"/>
          <text x="60" y="60">${kcal}</text>
          <text x="60" y="78" class="sub">of ${t.kcal} kcal</text>
        </svg>
        <div class="grow">
          <div class="muted small">${remaining >= 0 ? 'Remaining' : 'Over target'}</div>
          <div class="big">${Math.abs(remaining)} kcal</div>
          <div class="muted small" style="margin-top:10px">Protein ${fmt(protein)} / ${t.protein} g</div>
          <div class="bar"><span style="width:${Math.min((protein / t.protein) * 100, 100)}%"></span></div>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="row between">
        <h2>Water</h2>
        <span class="muted">${(d.water / 1000).toFixed(2)} / ${(t.water / 1000).toFixed(1)} L</span>
      </div>
      <div class="bar"><span style="width:${Math.min((d.water / t.water) * 100, 100)}%"></span></div>
      <div class="row">
        <button class="ghost grow" data-act="water" data-ml="-${state.profile.glassMl}">− ${state.profile.glassMl} ml</button>
        <button class="grow" data-act="water" data-ml="${state.profile.glassMl}">+ ${state.profile.glassMl} ml</button>
      </div>
    </section>

    <section class="card">
      <h2>Log food</h2>
      <form id="food-form" class="grid-2" autocomplete="off">
        <label style="grid-column:1/-1">Food
          <input name="name" list="food-list" required placeholder="What did you eat?">
        </label>
        <datalist id="food-list">
          ${knownFoods.map((f) => `<option value="${esc(f.name)}">`).join('')}
        </datalist>
        <label>Calories (kcal)<input name="kcal" type="number" inputmode="numeric" min="0" step="1" required></label>
        <label>Protein (g)<input name="protein" type="number" inputmode="decimal" min="0" step="0.1"></label>
        <label>Meal
          <select name="meal">${MEALS.map((m) => `<option ${m === suggestMeal() ? 'selected' : ''}>${m}</option>`).join('')}</select>
        </label>
        <button type="submit" style="align-self:end">Add</button>
      </form>
      ${MEALS.map((m) => mealList(m, d.foods.filter((f) => f.meal === m))).join('')}
      ${d.foods.length ? '' : '<p class="empty">Nothing logged yet. Foods you add are remembered so you can re-add them quickly.</p>'}
    </section>

    <section class="card">
      <div class="row between">
        <h2>Workout</h2>
        ${plan.focus ? `<span class="pill">${esc(plan.focus)}</span>` : ''}
      </div>
      ${plan.exercises.length
        ? `<ul class="list">${plan.exercises.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`
        : `<p class="empty">No plan for ${DAYS[parseKey(viewDate).getDay()]}. <a href="#workout">Set up your weekly plan</a>.</p>`}
      <button class="${d.workoutDone ? '' : 'ghost'}" data-act="toggle-workout">
        ${d.workoutDone ? '✓ Workout done' : 'Mark workout done'}
      </button>
    </section>

    <section class="card">
      <h2>Sleep</h2>
      <form id="sleep-form" class="row">
        <label class="grow">Hours slept
          <input name="sleep" type="number" inputmode="decimal" min="0" max="24" step="0.25" value="${d.sleep ?? ''}">
        </label>
        <button type="submit" style="align-self:end">Save</button>
      </form>
      ${state.profile.sleepGoal ? `<p class="muted small" style="margin:0">Goal: ${state.profile.sleepGoal} h</p>` : ''}
    </section>
  `;

  const foodForm = $('#food-form');
  foodForm.name.addEventListener('change', () => {
    const match = knownFoods.find((f) => f.name.toLowerCase() === foodForm.name.value.trim().toLowerCase());
    if (match) {
      foodForm.kcal.value = match.kcal;
      foodForm.protein.value = match.protein || '';
    }
  });
  foodForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formData(foodForm);
    day(viewDate).foods.push({
      id: uid(),
      name: f.name.trim(),
      meal: f.meal,
      kcal: Math.round(num(f.kcal) || 0),
      protein: num(f.protein) || 0
    });
    save();
    toast('Food added');
    renderToday();
  });

  $('#sleep-form').addEventListener('submit', (e) => {
    e.preventDefault();
    day(viewDate).sleep = num(e.target.sleep.value);
    save();
    toast('Sleep saved');
  });
}

function mealList(meal, foods) {
  if (!foods.length) return '';
  const kcal = foods.reduce((s, f) => s + f.kcal, 0);
  return `
    <div>
      <div class="row between"><h3>${meal}</h3><span class="muted small">${kcal} kcal</span></div>
      <ul class="list" style="margin-top:6px">
        ${foods.map((f) => `
          <li>
            <span class="grow">${esc(f.name)}</span>
            <span class="muted small">${f.kcal} kcal · ${fmt(f.protein, 1)} g</span>
            <button class="icon" data-act="del-food" data-id="${f.id}" aria-label="Remove ${esc(f.name)}">✕</button>
          </li>`).join('')}
      </ul>
    </div>`;
}

function suggestMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'Breakfast';
  if (h < 15) return 'Lunch';
  if (h < 19) return 'Snack';
  return 'Dinner';
}

// Most recent entry per food name, newest first.
function foodHistory() {
  const seen = new Map();
  Object.keys(state.days).sort().reverse().forEach((k) => {
    [...state.days[k].foods].reverse().forEach((f) => {
      const key = f.name.toLowerCase();
      if (!seen.has(key)) seen.set(key, f);
    });
  });
  return [...seen.values()];
}

/* ---------- Workout ---------- */

function renderWorkout() {
  const todayIdx = new Date().getDay();
  const exercises = new Set([...state.plan.flatMap((p) => p.exercises), ...state.sets.map((s) => s.exercise)]);
  const byDate = groupBy([...state.sets].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts), (s) => s.date);
  const prs = personalBests();

  $('#view').innerHTML = `
    <section class="card">
      <h2>Log a set</h2>
      <form id="set-form" class="grid-2" autocomplete="off">
        <label style="grid-column:1/-1">Exercise
          <input name="exercise" list="ex-list" required placeholder="e.g. Squat">
        </label>
        <datalist id="ex-list">${[...exercises].map((e) => `<option value="${esc(e)}">`).join('')}</datalist>
        <label>Weight (kg)<input name="weight" type="number" inputmode="decimal" min="0" step="0.5"></label>
        <label>Reps<input name="reps" type="number" inputmode="numeric" min="1" step="1" required></label>
        <label>Date<input name="date" type="date" value="${dateKey()}" max="${dateKey()}" required></label>
        <button type="submit" style="align-self:end">Add set</button>
      </form>
    </section>

    <section class="card">
      <h2>Weekly plan</h2>
      <p class="muted small" style="margin:0">Write your own split. One exercise per line.</p>
      ${state.plan.map((p, i) => `
        <details ${i === todayIdx ? 'open' : ''}>
          <summary>${DAYS[i]}${i === todayIdx ? ' · today' : ''} <span class="muted small" style="font-weight:400">${esc(p.focus)}</span></summary>
          <form class="plan-form" data-day="${i}" style="display:grid;gap:10px">
            <label>Focus<input name="focus" value="${esc(p.focus)}" placeholder="e.g. Lower body, Rest"></label>
            <label>Exercises<textarea name="exercises" placeholder="One per line">${esc(p.exercises.join('\n'))}</textarea></label>
            <button type="submit" class="ghost">Save ${DAYS[i]}</button>
          </form>
        </details>`).join('')}
    </section>

    ${prs.length ? `
    <section class="card">
      <h2>Personal bests</h2>
      <ul class="list">
        ${prs.map((p) => `<li><span class="grow">${esc(p.exercise)}</span><span class="muted small">${fmt(p.weight, 1)} kg × ${p.reps}</span></li>`).join('')}
      </ul>
    </section>` : ''}

    <section class="card">
      <h2>History</h2>
      ${Object.keys(byDate).length ? Object.entries(byDate).slice(0, 14).map(([date, sets]) => `
        <div>
          <h3>${prettyDate(date)}</h3>
          <ul class="list" style="margin-top:6px">
            ${sets.map((s) => `
              <li>
                <span class="grow">${esc(s.exercise)}</span>
                <span class="muted small">${s.weight != null ? fmt(s.weight, 1) + ' kg × ' : ''}${s.reps}</span>
                <button class="icon" data-act="del-set" data-id="${s.id}" aria-label="Remove set">✕</button>
              </li>`).join('')}
          </ul>
        </div>`).join('') : '<p class="empty">No sets logged yet.</p>'}
    </section>
  `;

  $('#set-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formData(e.target);
    state.sets.push({ id: uid(), ts: Date.now(), date: f.date, exercise: f.exercise.trim(), weight: num(f.weight), reps: parseInt(f.reps, 10) });
    save();
    toast('Set logged');
    const keepExercise = f.exercise;
    renderWorkout();
    $('#set-form').exercise.value = keepExercise;
    $('#set-form').weight.value = f.weight;
  });

  $$('.plan-form').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formData(form);
    state.plan[Number(form.dataset.day)] = {
      focus: f.focus.trim(),
      exercises: f.exercises.split('\n').map((s) => s.trim()).filter(Boolean)
    };
    save();
    toast(`${DAYS[form.dataset.day]} saved`);
    renderWorkout();
  }));
}

function personalBests() {
  const best = {};
  state.sets.forEach((s) => {
    if (s.weight == null) return;
    const b = best[s.exercise];
    if (!b || s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps)) best[s.exercise] = s;
  });
  return Object.values(best).sort((a, b) => a.exercise.localeCompare(b.exercise));
}

function groupBy(arr, fn) {
  return arr.reduce((acc, x) => ((acc[fn(x)] ||= []).push(x), acc), {});
}

/* ---------- Progress ---------- */

const MEASURES = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'hip', label: 'Hip', unit: 'cm' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh', label: 'Thigh', unit: 'cm' }
];
let chartKey = 'weight';

function renderProgress() {
  const t = calc();
  const list = [...state.measurements].sort((a, b) => b.date.localeCompare(a.date));
  const series = [...list].reverse().filter((m) => m[chartKey] != null);
  const unit = MEASURES.find((m) => m.key === chartKey).unit;
  const change = series.length > 1 ? series[series.length - 1][chartKey] - series[0][chartKey] : null;
  const sleepAvg = averageSleep(7);
  const workouts = Object.entries(state.days).filter(([k, d]) => d.workoutDone && k > shiftKey(dateKey(), -7)).length;

  $('#view').innerHTML = `
    <section class="card">
      <h2>Overview</h2>
      <div class="grid-3">
        <div><div class="muted small">Weight</div><div class="big">${fmt(t.weight, 1)}</div><div class="muted small">kg</div></div>
        <div><div class="muted small">BMI</div><div class="big">${fmt(t.bmi, 1)}</div><div class="muted small">${t.bmiCat}</div></div>
        <div><div class="muted small">Healthy range</div><div class="big" style="font-size:1.1rem">${fmt(t.healthyMin)}–${fmt(t.healthyMax)}</div><div class="muted small">kg at your height</div></div>
        <div><div class="muted small">Workouts</div><div class="big">${workouts}</div><div class="muted small">last 7 days</div></div>
        <div><div class="muted small">Avg sleep</div><div class="big">${sleepAvg == null ? '–' : fmt(sleepAvg, 1)}</div><div class="muted small">h, last 7 days</div></div>
        ${state.profile.targetWeight ? `<div><div class="muted small">To target</div><div class="big">${fmt(Math.abs(t.weight - state.profile.targetWeight), 1)}</div><div class="muted small">kg to ${fmt(state.profile.targetWeight, 1)}</div></div>` : ''}
      </div>
    </section>

    <section class="card">
      <div class="row between">
        <h2>Trend</h2>
        ${change != null ? `<span class="pill">${change > 0 ? '+' : ''}${fmt(change, 1)} ${unit}</span>` : ''}
      </div>
      <div class="chart-tabs">
        ${MEASURES.map((m) => `<button class="${m.key === chartKey ? '' : 'ghost'}" data-act="chart" data-key="${m.key}">${m.label}</button>`).join('')}
      </div>
      ${series.length > 1 ? lineChart(series.map((m) => ({ x: m.date, y: m[chartKey] }))) : '<p class="empty">Add at least two entries to see a trend.</p>'}
    </section>

    <section class="card">
      <h2>Add measurement</h2>
      <form id="measure-form" class="grid-2" autocomplete="off">
        <label style="grid-column:1/-1">Date<input name="date" type="date" value="${dateKey()}" max="${dateKey()}" required></label>
        ${MEASURES.map((m) => `<label>${m.label} (${m.unit})<input name="${m.key}" type="number" inputmode="decimal" min="0" step="0.1"></label>`).join('')}
        <label style="grid-column:1/-1">Note<input name="note" placeholder="Optional"></label>
        <button type="submit" style="grid-column:1/-1">Save measurement</button>
      </form>
      <p class="hint">Measure your waist at the belly button, same time of day, every 1–2 weeks. Waist and photos show progress better than the scale.</p>
    </section>

    <section class="card">
      <h2>History</h2>
      ${list.length ? `
      <div class="table-scroll">
        <table>
          <thead><tr><th>Date</th>${MEASURES.map((m) => `<th>${m.label}</th>`).join('')}<th></th></tr></thead>
          <tbody>
            ${list.map((m) => `
              <tr title="${esc(m.note)}">
                <td>${prettyDate(m.date, { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                ${MEASURES.map((x) => `<td>${fmt(m[x.key], 1)}</td>`).join('')}
                <td><button class="icon" data-act="del-measure" data-id="${m.id}" aria-label="Remove entry">✕</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="empty">No measurements yet.</p>'}
    </section>
  `;

  $('#measure-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const entry = { id: uid(), date: f.date, note: f.note.trim() };
    MEASURES.forEach((m) => (entry[m.key] = num(f[m.key])));
    if (MEASURES.every((m) => entry[m.key] == null)) {
      toast('Enter at least one measurement');
      return;
    }
    state.measurements.push(entry);
    save();
    toast('Measurement saved');
    renderProgress();
  });
}

function averageSleep(n) {
  const vals = [];
  for (let i = 0; i < n; i++) {
    const d = state.days[shiftKey(dateKey(), -i)];
    if (d?.sleep != null) vals.push(d.sleep);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function lineChart(points) {
  const W = 320, H = 160, P = { l: 34, r: 10, t: 10, b: 22 };
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.1;
  min -= pad; max += pad;
  const t0 = parseKey(points[0].x).getTime();
  const t1 = parseKey(points[points.length - 1].x).getTime() || t0 + 1;
  const sx = (x) => P.l + ((parseKey(x).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - P.l - P.r);
  const sy = (y) => P.t + (1 - (y - min) / (max - min)) * (H - P.t - P.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');

  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">
      <line class="axis" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/>
      <text x="${P.l - 4}" y="${sy(max - pad) + 4}" text-anchor="end">${fmt(max - pad, 1)}</text>
      <text x="${P.l - 4}" y="${sy(min + pad) + 4}" text-anchor="end">${fmt(min + pad, 1)}</text>
      <text x="${P.l}" y="${H - 6}">${prettyDate(points[0].x, { day: 'numeric', month: 'short' })}</text>
      <text x="${W - P.r}" y="${H - 6}" text-anchor="end">${prettyDate(points[points.length - 1].x, { day: 'numeric', month: 'short' })}</text>
      <path class="line" d="${path}"/>
      ${points.map((p) => `<circle class="dot" cx="${sx(p.x)}" cy="${sy(p.y)}" r="3"/>`).join('')}
    </svg>`;
}

/* ---------- Profile ---------- */

function profileForm(onboarding) {
  const p = state.profile || {};
  const t = onboarding ? null : calc();
  const v = (k, d = '') => esc(p[k] ?? d);
  const opt = (k, val, label, def) => `<option value="${val}" ${(p[k] ?? def) === val ? 'selected' : ''}>${label}</option>`;

  return `
    ${onboarding ? `
    <section class="card">
      <h2>Welcome to FormaFit</h2>
      <p class="muted" style="margin:0">Tell us about yourself. Your calorie, protein and water targets are calculated from these numbers. You can edit everything later in Profile.</p>
      <p class="hint">Everything stays on this device. Nothing is uploaded.</p>
    </section>` : ''}

    <form id="profile-form" style="display:grid;gap:14px" autocomplete="off">
      <section class="card">
        <h2>About you</h2>
        <div class="grid-2">
          <label style="grid-column:1/-1">Name (optional)<input name="name" value="${v('name')}"></label>
          <label>Age<input name="age" type="number" inputmode="numeric" min="13" max="100" required value="${v('age')}"></label>
          <label>Sex (for calorie formula)
            <select name="sex">${opt('sex', 'female', 'Female', 'female')}${opt('sex', 'male', 'Male', 'female')}</select>
          </label>
          <label>Height (cm)<input name="height" type="number" inputmode="decimal" min="100" max="250" step="0.1" required value="${v('height')}"></label>
          <label>${onboarding ? 'Weight' : 'Starting weight'} (kg)<input name="weight" type="number" inputmode="decimal" min="25" max="300" step="0.1" required value="${v('weight')}"></label>
          <label style="grid-column:1/-1">Activity level
            <select name="activity">${Object.entries(ACTIVITY).map(([k, a]) => opt('activity', k, a.label, 'moderate')).join('')}</select>
          </label>
        </div>
      </section>

      <section class="card">
        <h2>Goal</h2>
        <div class="grid-2">
          <label>Goal
            <select name="goal">${opt('goal', 'lose', 'Lose fat', 'lose')}${opt('goal', 'maintain', 'Maintain / recomp', 'lose')}${opt('goal', 'gain', 'Gain muscle', 'lose')}</select>
          </label>
          <label>Pace (kg/week)
            <select name="pace">${[0.25, 0.5, 0.75].map((n) => `<option value="${n}" ${(p.pace ?? 0.25) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
          </label>
          <label>Target weight (kg)<input name="targetWeight" type="number" inputmode="decimal" min="25" max="300" step="0.1" value="${v('targetWeight')}"></label>
          <label>Protein (g per kg)<input name="proteinPerKg" type="number" inputmode="decimal" min="0.8" max="3" step="0.1" required value="${v('proteinPerKg', 1.6)}"></label>
          <label>Sleep goal (hours)<input name="sleepGoal" type="number" inputmode="decimal" min="4" max="12" step="0.5" value="${v('sleepGoal', 7)}"></label>
          <label>Glass size (ml)<input name="glassMl" type="number" inputmode="numeric" min="50" max="1000" step="50" required value="${v('glassMl', 250)}"></label>
          <label style="grid-column:1/-1">BMI scale
            <select name="bmiScale">${Object.entries(BMI_SCALES).map(([k, s]) => opt('bmiScale', k, s.label, 'standard')).join('')}</select>
          </label>
        </div>
      </section>

      ${t ? `
      <section class="card">
        <h2>Your daily targets</h2>
        <p class="muted small" style="margin:0">Calculated: BMR ${t.bmr} kcal · maintenance ${t.tdee} kcal, using your latest weight (${fmt(t.weight, 1)} kg). Leave a box empty to use the calculated value.</p>
        <div class="grid-3">
          <label>Calories<input name="kcalOverride" type="number" inputmode="numeric" min="800" step="10" placeholder="${t.autoKcal}" value="${v('kcalOverride')}"></label>
          <label>Protein (g)<input name="proteinOverride" type="number" inputmode="numeric" min="20" step="5" placeholder="${t.autoProtein}" value="${v('proteinOverride')}"></label>
          <label>Water (ml)<input name="waterOverride" type="number" inputmode="numeric" min="500" step="250" placeholder="${t.autoWater}" value="${v('waterOverride')}"></label>
        </div>
        <p class="hint">These are estimates, not medical advice. Adjust them if your weight isn't moving after 2–3 weeks.</p>
      </section>` : ''}

      <button type="submit">${onboarding ? 'Start' : 'Save profile'}</button>
    </form>

    ${onboarding ? '' : `
    <section class="card">
      <h2>Your data</h2>
      <p class="muted small" style="margin:0">Data is stored only in this browser. Export a backup regularly.</p>
      <div class="row wrap">
        <button class="ghost grow" data-act="export">Export backup</button>
        <button type="button" class="ghost grow" data-act="import">Import backup</button>
        <input type="file" id="import-file" accept="application/json,.json" hidden>
      </div>
      <button class="danger" data-act="reset">Delete all data</button>
    </section>`}
  `;
}

function bindProfileForm(onboarding) {
  $('#profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formData(e.target);
    const prev = state.profile || {};
    state.profile = {
      ...prev,
      name: f.name.trim(),
      age: num(f.age),
      sex: f.sex,
      height: num(f.height),
      weight: num(f.weight),
      activity: f.activity,
      goal: f.goal,
      pace: num(f.pace),
      targetWeight: num(f.targetWeight),
      proteinPerKg: num(f.proteinPerKg),
      sleepGoal: num(f.sleepGoal),
      glassMl: num(f.glassMl),
      bmiScale: f.bmiScale,
      kcalOverride: num(f.kcalOverride),
      proteinOverride: num(f.proteinOverride),
      waterOverride: num(f.waterOverride)
    };
    // First weight also starts the measurement history.
    if (onboarding && !state.measurements.length) {
      state.measurements.push({ id: uid(), date: dateKey(), weight: state.profile.weight, note: 'Starting weight' });
    }
    save();
    toast(onboarding ? 'Welcome!' : 'Profile saved');
    if (onboarding) location.hash = '#today';
    route();
  });

  const file = $('#import-file');
  if (file) file.addEventListener('change', importBackup);
}

function renderProfile() {
  $('#view').innerHTML = profileForm(false);
  bindProfileForm(false);
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `formafit-backup-${dateKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importBackup(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || typeof data !== 'object' || !('profile' in data)) throw new Error('Not a FormaFit backup');
    if (!confirm('Replace all current data with this backup?')) return;
    state = { ...emptyState(), ...data };
    save();
    toast('Backup restored');
    route();
  } catch (err) {
    toast('Could not read that file');
  } finally {
    e.target.value = '';
  }
}

/* ---------- Actions ---------- */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.dataset.id;

  switch (el.dataset.act) {
    case 'prev-day':
      viewDate = shiftKey(viewDate, -1);
      renderToday();
      break;
    case 'next-day':
      if (viewDate < dateKey()) viewDate = shiftKey(viewDate, 1);
      renderToday();
      break;
    case 'water': {
      const d = day(viewDate);
      d.water = Math.max(0, d.water + Number(el.dataset.ml));
      save();
      renderToday();
      break;
    }
    case 'del-food': {
      const d = day(viewDate);
      d.foods = d.foods.filter((f) => f.id !== id);
      save();
      renderToday();
      break;
    }
    case 'toggle-workout': {
      const d = day(viewDate);
      d.workoutDone = !d.workoutDone;
      save();
      renderToday();
      break;
    }
    case 'del-set':
      state.sets = state.sets.filter((s) => s.id !== id);
      save();
      renderWorkout();
      break;
    case 'chart':
      chartKey = el.dataset.key;
      renderProgress();
      break;
    case 'del-measure':
      if (!confirm('Delete this measurement?')) return;
      state.measurements = state.measurements.filter((m) => m.id !== id);
      save();
      renderProgress();
      break;
    case 'export':
      exportBackup();
      break;
    case 'import':
      $('#import-file').click();
      break;
    case 'reset':
      if (!confirm('Delete all FormaFit data on this device? Export a backup first if you want to keep it.')) return;
      localStorage.removeItem(STORE_KEY);
      state = emptyState();
      viewDate = dateKey();
      location.hash = '';
      route();
      break;
  }
});

/* ---------- Boot ---------- */

route();

// Keep "Today" correct if the app stays open past midnight.
let lastToday = dateKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || dateKey() === lastToday) return;
  if (viewDate === lastToday) viewDate = dateKey();
  lastToday = dateKey();
  route();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
