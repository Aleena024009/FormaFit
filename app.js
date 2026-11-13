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

// Older saves stored plan exercises as plain strings.
function normalize(data) {
  const s = { ...emptyState(), ...data };
  s.plan = s.plan.map((p) => ({
    ...p,
    exercises: p.exercises.map((e) => (typeof e === 'string' ? parseExercise(e) : e))
  }));
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (err) {
    console.warn('Could not read saved data', err);
  }
  return emptyState();
}

// Plan lines look like "Bench Press, 3 x 8-10"; the sets part is optional.
function parseExercise(line) {
  const m = line.match(/^(.*),\s*(\d+)\s*[x×]\s*(.+)$/i);
  if (!m) return { name: line.trim(), sets: null, reps: '' };
  return { name: m[1].trim(), sets: Number(m[2]), reps: m[3].trim() };
}

function exerciseLine(e) {
  return e.sets ? `${e.name}, ${e.sets} x ${e.reps}` : e.name;
}

function setsReps(e) {
  return e.sets ? `${e.sets} × ${e.reps}` : '';
}

let state = load();

function save() {
  state.updatedAt = Date.now();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (err) {
    toast('Could not save. Storage may be full.');
  }
  window.dispatchEvent(new Event('formafit:saved')); // sync.js uploads on this
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
  if (tab !== 'workout') workoutOffset = 0;
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

/* ---------- Sheet ---------- */

// One pop-up sheet for every form, so screens only show summaries.
// `actions` is extra HTML placed in the header, left of the close button.
function openSheet(title, html, bind, actions = '') {
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <div class="row between">
      <h2 id="sheet-title" class="grow">${title}</h2>
      ${actions}
      <button class="icon" data-act="close-sheet" aria-label="Close">✕</button>
    </div>
    ${html}`;
  if (!sheet.open) sheet.showModal();
  if (bind) bind(sheet);
}

function closeSheet() {
  if ($('#sheet').open) $('#sheet').close();
}

/* ---------- Today ---------- */

function renderToday() {
  const t = calc();
  const d = day(viewDate);
  const kcal = d.foods.reduce((s, f) => s + (f.kcal || 0), 0);
  const protein = d.foods.reduce((s, f) => s + (f.protein || 0), 0);
  const isToday = viewDate === dateKey();
  const plan = state.plan[parseKey(viewDate).getDay()];
  const remaining = t.kcal - kcal;

  const goalRow = (label, value, target, unit, pct, note) => `
    <div class="goal">
      <div class="row between">
        <span>${label}</span>
        <span><strong>${value}</strong> <span class="muted">/ ${target} ${unit}</span></span>
      </div>
      <div class="bar"><span class="${pct > 1 ? 'over' : ''}" style="width:${Math.min(pct, 1) * 100}%"></span></div>
      ${note ? `<div class="muted small">${note}</div>` : ''}
    </div>`;

  let workout;
  if (plan.exercises.length) {
    const total = plan.exercises.reduce((s, e) => s + (e.sets || 1), 0);
    workout = `
      <div class="row between">
        <div>
          <h2>${esc(plan.focus || 'Workout')}${plan.focus && !/day$/i.test(plan.focus) ? ' day' : ''}</h2>
          <div class="muted small">${plan.exercises.length} exercises · ${total} sets</div>
        </div>
        ${d.workoutDone ? '<span class="pill ok">Done ✓</span>' : ''}
      </div>
      ${isToday ? `<a class="button" href="#workout">${d.workoutDone ? 'View workout' : 'Start workout'}</a>` : ''}`;
  } else if (plan.focus) {
    workout = '<h2>Rest day</h2><p class="muted small" style="margin:0">A light walk or stretching is enough today.</p>';
  } else {
    workout = '<h2>No workout yet</h2><a class="button" href="#workout">Choose a workout</a>';
  }

  $('#view').innerHTML = `
    <div class="daynav">
      <button class="icon" data-act="prev-day" aria-label="Previous day">◀</button>
      <strong>${isToday ? 'Today' : prettyDate(viewDate)}</strong>
      <button class="icon" data-act="next-day" aria-label="Next day" ${isToday ? 'disabled' : ''}>▶</button>
    </div>

    <section class="card">
      ${goalRow('Calories', kcal, t.kcal, 'kcal', kcal / t.kcal, remaining >= 0 ? `${remaining} kcal left` : `${-remaining} kcal over`)}
      ${goalRow('Protein', fmt(protein), t.protein, 'g', protein / t.protein)}
      ${goalRow('Water', (d.water / 1000).toFixed(2).replace(/0$/, ''), (t.water / 1000).toFixed(1), 'L', d.water / t.water)}
    </section>

    <div class="actions">
      <button class="big-btn" data-act="add-food"><span>＋</span>Add food</button>
      <button class="big-btn" data-act="water" data-ml="${state.profile.glassMl}"><span>＋</span>Glass of water</button>
    </div>

    ${mealPlanCard(viewDate)}

    <section class="card">${workout}</section>

    <section class="card">
      <div class="row between">
        <h2>Food</h2>
        ${d.water ? `<button class="icon small" data-act="water" data-ml="-${state.profile.glassMl}">Undo a glass</button>` : ''}
      </div>
      ${d.foods.length
        ? `<ul class="list">${d.foods.map((f) => `
            <li>
              <span class="grow">${esc(f.name)}</span>
              <span class="muted small">${f.kcal} kcal${f.protein ? ` · ${fmt(f.protein, 1)} g` : ''}</span>
              <button class="icon" data-act="del-food" data-id="${f.id}" aria-label="Remove ${esc(f.name)}">✕</button>
            </li>`).join('')}</ul>`
        : '<p class="empty">Nothing yet. Tap <strong>Add food</strong> after you eat.</p>'}
    </section>

    <section class="card">
      <div class="row between">
        <div>
          <h2>Sleep</h2>
          <div class="muted small">Last night${state.profile.sleepGoal ? ` · goal ${state.profile.sleepGoal} h` : ''}</div>
        </div>
        <div class="stepper">
          <button class="ghost" data-act="sleep" data-step="-0.5" aria-label="Less sleep">−</button>
          <strong>${d.sleep == null ? '–' : `${fmt(d.sleep, 1)} h`}</strong>
          <button class="ghost" data-act="sleep" data-step="0.5" aria-label="More sleep">＋</button>
        </div>
      </div>
    </section>
  `;
}

function openFoodSheet() {
  const recent = foodHistory().slice(0, 8);
  openSheet('Add food', `
    ${recent.length ? `
      <div>
        <div class="muted small" style="margin-bottom:6px">Tap to add again</div>
        <div class="chips">
          ${recent.map((f, i) => `<button type="button" class="chip" data-recent="${i}">${esc(f.name)} <span class="muted">${f.kcal}</span></button>`).join('')}
        </div>
      </div>` : ''}
    <form id="food-form" style="display:grid;gap:10px" autocomplete="off">
      <label>What did you eat?<input name="name" required placeholder="e.g. 2 chapati with dal"></label>
      <div class="grid-2">
        <label>Calories<input name="kcal" type="number" inputmode="numeric" min="0" step="1" required placeholder="kcal"></label>
        <label>Protein (optional)<input name="protein" type="number" inputmode="decimal" min="0" step="0.1" placeholder="grams"></label>
      </div>
      <button type="submit">Add</button>
    </form>`, (sheet) => {
    const addFood = (f) => {
      day(viewDate).foods.push({ id: uid(), name: f.name, meal: suggestMeal(), kcal: f.kcal, protein: f.protein });
      save();
      closeSheet();
      toast(`Added ${f.name}`);
      renderToday();
    };
    sheet.querySelectorAll('[data-recent]').forEach((b) => b.addEventListener('click', () => addFood(recent[b.dataset.recent])));
    const form = $('#food-form', sheet);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = formData(form);
      addFood({ name: f.name.trim(), kcal: Math.round(num(f.kcal) || 0), protein: num(f.protein) || 0 });
    });
  });
}

/* ---------- Meal plan ---------- */

const mealPlan = () => state.mealPlan || MEAL_TEMPLATE;
const mealById = (id) => mealPlan().find((m) => m.id === id);
const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

function clockTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function mealDone(key, meal) {
  const d = day(key);
  if (meal.workout) return d.workoutDone || !!d.mealsDone?.[meal.id];
  return !!d.mealsDone?.[meal.id] || d.foods.some((f) => f.planMeal === meal.id);
}

// The meal whose time slot we're in now, or else the next one not yet done.
function currentMealId(key) {
  if (key !== dateKey()) return null;
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  const meals = [...mealPlan()].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const open = meals.filter((m) => !mealDone(key, m));
  const inSlot = open.find((m) => {
    const i = meals.indexOf(m);
    const end = meals[i + 1] ? toMinutes(meals[i + 1].time) : 24 * 60;
    return toMinutes(m.time) <= now && now < end;
  });
  return (inSlot || open.find((m) => toMinutes(m.time) > now))?.id ?? null;
}

function mealPlanCard(key) {
  const current = currentMealId(key);
  const meals = [...mealPlan()].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  return `
    <section class="card">
      <div class="row between">
        <h2>Meal plan</h2>
        <button class="icon small" data-act="food-rules">Food rules</button>
      </div>
      <ul class="schedule">
        ${meals.map((m) => {
          const done = mealDone(key, m);
          return `
            <li>
              <button class="slot ${done ? 'done' : ''} ${m.id === current ? 'now' : ''}" data-act="meal" data-id="${esc(m.id)}">
                <span class="time">${clockTime(m.time)}</span>
                <span class="grow">${esc(m.name)}</span>
                <span class="state">${done ? '✓' : m.id === current ? 'Now' : '›'}</span>
              </button>
            </li>`;
        }).join('')}
      </ul>
      <button class="icon small" data-act="edit-meals" style="justify-self:start">Edit meal plan</button>
    </section>`;
}

function openMealSheet(id) {
  const meal = mealById(id);
  if (!meal) return;
  const optionLabel = (o) => (o.water ? `${o.water} ml water` : `about ${o.kcal} kcal${o.protein ? ` · ${o.protein} g protein` : ''}`);
  openSheet(`${clockTime(meal.time)} · ${esc(meal.name)}`, `
    ${meal.note ? `<p class="hint" style="margin:0">${esc(meal.note)}</p>` : ''}
    ${meal.workout ? '<a class="button" href="#workout" data-act="close-sheet">Go to my workout</a>' : ''}
    ${meal.options.length ? `
      <div class="muted small">${meal.workout ? 'Optional, before you start:' : 'Tap what you had. It is added to your food log.'}</div>
      <div class="options">
        ${meal.options.map((o, i) => `
          <button class="option" data-opt="${i}">
            <span>${esc(o.text)}</span>
            <small>${optionLabel(o)}</small>
          </button>`).join('')}
      </div>` : ''}
    ${mealDone(viewDate, meal) && !meal.workout ? '<button class="ghost" data-undo-meal>Not done yet</button>' : ''}`, (sheet) => {
    sheet.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
      const o = meal.options[b.dataset.opt];
      const d = day(viewDate);
      if (o.water) d.water += o.water;
      else d.foods.push({ id: uid(), name: o.text, meal: meal.name, planMeal: meal.id, kcal: o.kcal || 0, protein: o.protein || 0 });
      (d.mealsDone ||= {})[meal.id] = true;
      save();
      closeSheet();
      toast(o.water ? 'Water added' : `Added ${o.text}`);
      renderToday();
    }));
    const undo = sheet.querySelector('[data-undo-meal]');
    if (undo) undo.addEventListener('click', () => {
      const d = day(viewDate);
      if (d.mealsDone) delete d.mealsDone[meal.id];
      d.foods = d.foods.filter((f) => f.planMeal !== meal.id);
      save();
      closeSheet();
      renderToday();
    });
  });
}

function openRulesSheet() {
  openSheet('Food rules', `
    <ol class="steps">${FOOD_RULES.map(([title, text]) => `<li><strong>${title}.</strong> ${text}</li>`).join('')}</ol>`);
}

// Options are edited as lines: "text | kcal | protein" or "text | water 250".
function optionLine(o) {
  return o.water ? `${o.text} | water ${o.water}` : `${o.text} | ${o.kcal ?? 0} | ${o.protein ?? 0}`;
}

function parseOption(line) {
  const [text, a = '', b = ''] = line.split('|').map((x) => x.trim());
  const water = a.match(/^water\s*(\d+)/i);
  if (water) return { text, water: Number(water[1]) };
  return { text, kcal: num(a) || 0, protein: num(b) || 0 };
}

function openMealEditSheet() {
  const meals = [...mealPlan()].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  openSheet('Edit meal plan', `
    <p class="muted small" style="margin:0">One food per line, like <em>2 idli + sambar | 250 | 8</em> (calories, then protein). Clear the name to remove a meal.</p>
    ${meals.map((m) => `
      <details>
        <summary>${clockTime(m.time)} · ${esc(m.name)}</summary>
        <form class="meal-form" data-id="${esc(m.id)}" style="display:grid;gap:10px">
          <div class="grid-2">
            <label>Time<input name="time" type="time" value="${m.time}" required></label>
            <label>Name<input name="name" value="${esc(m.name)}"></label>
          </div>
          <label>Note<input name="note" value="${esc(m.note || '')}"></label>
          <label>Foods<textarea name="options" rows="${Math.max(3, m.options.length + 1)}">${esc(m.options.map(optionLine).join('\n'))}</textarea></label>
          <button type="submit" class="ghost">Save</button>
        </form>
      </details>`).join('')}
    <div class="row">
      <button class="ghost grow" data-add-meal>Add a meal</button>
      <button class="ghost grow" data-reset-meals>Reset plan</button>
    </div>`, (sheet) => {
    const commit = (list, msg) => {
      state.mealPlan = list;
      save();
      toast(msg);
      openMealEditSheet();
      renderToday();
    };
    sheet.querySelectorAll('.meal-form').forEach((form) => form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = formData(form);
      const list = mealPlan().map((m) => ({ ...m }));
      const i = list.findIndex((m) => m.id === form.dataset.id);
      if (!f.name.trim()) list.splice(i, 1);
      else list[i] = { ...list[i], time: f.time, name: f.name.trim(), note: f.note.trim(), options: f.options.split('\n').map((l) => l.trim()).filter(Boolean).map(parseOption) };
      commit(list, f.name.trim() ? 'Meal saved' : 'Meal removed');
    }));
    sheet.querySelector('[data-add-meal]').addEventListener('click', () => {
      commit([...mealPlan(), { id: uid(), time: '12:00', name: 'New meal', note: '', options: [] }], 'Meal added');
    });
    sheet.querySelector('[data-reset-meals]').addEventListener('click', () => {
      if (!confirm('Go back to the original meal plan?')) return;
      delete state.mealPlan;
      save();
      toast('Plan reset');
      openMealEditSheet();
      renderToday();
    });
  });
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

const hasPlan = () => state.plan.some((p) => p.focus || p.exercises.length);

// First number in a reps target like "8-10"; null for "Failure".
const targetReps = (reps) => parseInt(reps, 10) || null;

function setsToday(name) {
  return state.sets.filter((s) => s.date === dateKey() && s.exercise === name);
}

function lastWeight(name) {
  const done = state.sets.filter((s) => s.exercise === name && s.weight != null).sort((a, b) => b.ts - a.ts);
  return done.length ? done[0].weight : '';
}

// Short day name for the week strip: "Legs + Core" → "Legs", "Recovery" → "Recov".
const chipLabel = (focus) => (focus || 'Gym').split(/[\s+]/)[0].slice(0, 5);

// Days ahead of today shown in the Workout tab (0 = today).
let workoutOffset = 0;

function renderWorkout() {
  if (!hasPlan()) {
    $('#view').innerHTML = `
      <section class="card">
        <h2>Choose your workout</h2>
        <p class="muted small" style="margin:0">Tap a program. Your whole week is planned for you.</p>
        ${programFormHtml()}
      </section>`;
    bindProgramForm($('#view'));
    return;
  }

  const todayIdx = new Date().getDay();
  const isToday = workoutOffset === 0;
  const dayIdx = (todayIdx + workoutOffset) % 7;
  const plan = state.plan[dayIdx];
  const current = PROGRAMS.find((p) => p.id === state.programId);
  const phase = programPhase(current);
  const total = plan.exercises.reduce((s, e) => s + (e.sets || 1), 0);
  const done = isToday ? plan.exercises.reduce((s, e) => s + Math.min(setsToday(e.name).length, e.sets || 1), 0) : 0;
  const date = new Date();
  date.setDate(date.getDate() + workoutOffset);
  const dayName = isToday ? 'Today' : workoutOffset === 1 ? 'Tomorrow' : DAYS[dayIdx];
  const focusTitle = (p) => (p.exercises.length ? `${esc(p.focus || 'Workout')}${p.focus && !/day$/i.test(p.focus) ? ' day' : ''}` : 'Rest day');

  const strip = `
    <div class="week-strip" role="tablist" aria-label="This week">
      ${[0, 1, 2, 3, 4, 5, 6].map((off) => {
        const idx = (todayIdx + off) % 7;
        const d = new Date();
        d.setDate(d.getDate() + off);
        const p = state.plan[idx];
        return `
          <button role="tab" aria-selected="${off === workoutOffset}" class="day-chip ${off === workoutOffset ? 'on' : ''} ${p.exercises.length ? '' : 'rest'}" data-act="workout-day" data-off="${off}">
            <span class="small">${off === 0 ? 'Today' : DAYS[idx].slice(0, 3)}</span>
            <strong>${d.getDate()}</strong>
            <span class="small">${p.exercises.length ? esc(chipLabel(p.focus)) : 'Rest'}</span>
          </button>`;
      }).join('')}
    </div>`;

  let body;
  if (!plan.exercises.length) {
    const next = [1, 2, 3, 4, 5, 6].map((k) => (dayIdx + k) % 7).find((k) => state.plan[k].exercises.length);
    body = `
      <section class="card">
        <p class="muted small" style="margin:0">Your muscles grow while you rest. A light walk is enough.</p>
        ${next != null ? `<p class="small" style="margin:0">Next workout: <strong>${DAYS[next]} · ${esc(state.plan[next].focus)}</strong></p>` : ''}
      </section>`;
  } else if (!isToday) {
    body = `
      ${plan.exercises.map((e) => `
        <section class="card exercise">
          ${exerciseHeader(e)}
          ${videoPlayer(e.name)}
          ${muscleTags(e.name)}
        </section>`).join('')}
      <p class="muted small center">You can tick off sets on the day. Tap ⓘ for step-by-step help.</p>`;
  } else {
    body = `
      ${done >= total ? '<section class="card done-banner"><h2>Workout complete ✓</h2><p class="muted small" style="margin:0">Great job. Drink water and eat some protein.</p></section>' : ''}
      ${plan.exercises.map((e, i) => {
        const count = setsToday(e.name).length;
        const sets = e.sets || 1;
        return `
          <section class="card exercise ${count >= sets ? 'complete' : ''}">
            ${exerciseHeader(e)}
            ${videoPlayer(e.name)}
            ${muscleTags(e.name)}
            <div class="row">
              <label class="weight">
                <input type="number" inputmode="decimal" min="0" step="0.5" data-weight="${i}" value="${lastWeight(e.name)}" placeholder="0" aria-label="Weight for ${esc(e.name)} in kg">
                <span>kg</span>
              </label>
              <div class="bubbles" role="group" aria-label="Sets">
                ${Array.from({ length: sets }, (_, n) => `
                  <button class="bubble ${n < count ? 'on' : ''}" data-act="set" data-ex="${i}" data-n="${n}"
                    aria-label="Set ${n + 1} ${n < count ? 'done, tap to undo' : ''}">${n < count ? '✓' : n + 1}</button>`).join('')}
              </div>
            </div>
          </section>`;
      }).join('')}
      <p class="muted small center">Tap a number when you finish that set. Tap ⓘ for step-by-step help.</p>`;
  }

  $('#view').innerHTML = `
    ${strip}

    <section class="card">
      <div class="muted small">${dayName}${isToday ? ` · ${DAYS[dayIdx]}` : ` · ${prettyDate(dateKey(date), { day: 'numeric', month: 'short' })}`} · ${current ? current.name : 'My plan'}</div>
      <h2 class="title">${focusTitle(plan)}</h2>
      ${plan.exercises.length ? (isToday ? `
        <div class="bar"><span style="width:${(done / total) * 100}%"></span></div>
        <div class="muted small">${done} of ${total} sets done</div>` : `
        <div class="muted small">${plan.exercises.length} exercises · ${total} sets</div>`) : ''}
    </section>

    ${phase ? `
    <section class="card phase">
      <div class="row between"><strong>Week ${Math.min(phase.week, phase.total)} of ${phase.total}</strong>${phase.week > phase.total ? '<span class="pill ok">Done</span>' : ''}</div>
      <div class="bar"><span style="width:${Math.min(phase.week / phase.total, 1) * 100}%"></span></div>
      <div class="muted small">${phase.text}</div>
    </section>` : ''}

    ${body}

    <div class="actions">
      <button class="ghost" data-act="sheet-program">Change program</button>
      <button class="ghost" data-act="sheet-plan">Edit my week</button>
      <button class="ghost" data-act="sheet-history">History</button>
      <button class="ghost" data-act="sheet-tips">Tips</button>
    </div>
  `;
  watchGifs();
}

function toggleSet(i, n) {
  const e = state.plan[new Date().getDay()].exercises[i];
  const logged = setsToday(e.name);
  if (n < logged.length) {
    // Undo the most recent set of this exercise.
    const last = logged.sort((a, b) => b.ts - a.ts)[0];
    state.sets = state.sets.filter((s) => s.id !== last.id);
  } else {
    const weight = num($(`[data-weight="${i}"]`).value);
    state.sets.push({ id: uid(), ts: Date.now(), date: dateKey(), exercise: e.name, weight, reps: targetReps(e.reps) });
  }
  const plan = state.plan[new Date().getDay()];
  const finished = plan.exercises.every((x) => setsToday(x.name).length >= (x.sets || 1));
  const d = day(dateKey());
  if (finished && !d.workoutDone) toast('Workout complete! 💪');
  d.workoutDone = finished;
  save();
  renderWorkout();
}

function programFormHtml() {
  return `
    <form id="program-form" style="display:grid;gap:12px">
      ${programPicker(state.programId, state.scheduleId)}
      <button type="submit">${hasPlan() ? 'Switch to this program' : 'Start this program'}</button>
    </form>`;
}

function bindProgramForm(root) {
  const form = $('#program-form', root);
  bindProgramPicker(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = formData(form);
    if (hasPlan() && state.programId && !confirm('Switch program? Your past sets are kept.')) return;
    applyProgram(f.program, f.schedule);
    closeSheet();
    toast('Your week is ready');
    renderWorkout();
  });
}

function openPlanSheet() {
  const todayIdx = new Date().getDay();
  openSheet('Edit my week', `
    <p class="muted small" style="margin:0">One exercise per line, like <em>Bench Press, 3 x 8-10</em>. Leave a day empty to rest.</p>
    ${state.plan.map((p, i) => `
      <details ${i === todayIdx ? 'open' : ''}>
        <summary>${DAYS[i]} <span class="muted small" style="font-weight:400">${esc(p.focus || 'Rest')}</span></summary>
        <form class="plan-form" data-day="${i}" style="display:grid;gap:10px">
          <label>Name of the day<input name="focus" value="${esc(p.focus)}" placeholder="e.g. Push, Rest"></label>
          <label>Exercises<textarea name="exercises" rows="${Math.max(4, p.exercises.length + 1)}" placeholder="One per line">${esc(p.exercises.map(exerciseLine).join('\n'))}</textarea></label>
          <button type="submit" class="ghost">Save ${DAYS[i]}</button>
        </form>
      </details>`).join('')}`, (sheet) => {
    sheet.querySelectorAll('.plan-form').forEach((form) => form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = formData(form);
      state.plan[Number(form.dataset.day)] = {
        focus: f.focus.trim(),
        exercises: f.exercises.split('\n').map((s) => s.trim()).filter(Boolean).map(parseExercise)
      };
      save();
      toast(`${DAYS[form.dataset.day]} saved`);
      renderWorkout();
    }));
  });
}

function openHistorySheet() {
  const byDate = groupBy([...state.sets].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts), (s) => s.date);
  const prs = personalBests();
  openSheet('History', `
    ${prs.length ? `
      <h3>Best lifts</h3>
      <ul class="list">${prs.map((p) => `<li><span class="grow">${esc(p.exercise)}</span><span class="muted small">${fmt(p.weight, 1)} kg × ${p.reps ?? '–'}</span></li>`).join('')}</ul>` : ''}
    ${Object.keys(byDate).length ? Object.entries(byDate).slice(0, 14).map(([date, sets]) => `
      <h3>${prettyDate(date)}</h3>
      <ul class="list">${sets.map((s) => `
        <li>
          <span class="grow">${esc(s.exercise)}</span>
          <span class="muted small">${s.weight != null ? `${fmt(s.weight, 1)} kg` : ''}${s.reps ? ` × ${s.reps}` : ''}</span>
          <button class="icon" data-act="del-set" data-id="${s.id}" aria-label="Remove set">✕</button>
        </li>`).join('')}</ul>`).join('') : '<p class="empty">No workouts logged yet.</p>'}`);
}

function openTipsSheet() {
  const current = PROGRAMS.find((p) => p.id === state.programId);
  openSheet('Training tips', `
    ${current?.rules ? `
      <h3>${esc(current.name)}: coach's rules</h3>
      <ol class="steps">${current.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
      <h3>General tips</h3>` : ''}
    <ul class="list">${TRAINING_TIPS.map((t) => `<li>${t}</li>`).join('')}</ul>
    <h3>Best rep ranges</h3>
    <ul class="list">${REP_RANGES.map(([goal, reps]) => `<li><span class="grow">${goal}</span><span class="muted small">${reps}</span></li>`).join('')}</ul>`);
}

const PPL_LABELS = { push: 'Push', pull: 'Pull', legs: 'Legs' };
const dayLabels = (program) => program.labels || PPL_LABELS;

function applyProgram(programId, scheduleId) {
  const program = PROGRAMS.find((p) => p.id === programId);
  const labels = dayLabels(program);
  state.plan = (program.week || SCHEDULES[scheduleId].days).map((type) => ({
    focus: type ? labels[type] : 'Rest',
    exercises: type ? program[type].map(([name, sets, reps]) => ({ name, sets, reps })) : []
  }));
  if (state.programId !== programId) state.programStart = dateKey();
  state.programId = programId;
  state.scheduleId = program.week ? null : scheduleId;
  save();
}

// Which week of a phased program we're in, counted from the day it was started.
function programPhase(program) {
  if (!program?.phases || !state.programStart) return null;
  const days = Math.floor((parseKey(dateKey()) - parseKey(state.programStart)) / 86400000);
  const total = program.phases[program.phases.length - 1][1];
  const week = Math.floor(days / 7) + 1;
  const phase = program.phases.find(([from, to]) => week >= from && week <= to);
  return { week, total, text: phase ? phase[2] : 'Plan finished. Review progress with your coach and set the next goal.' };
}

function programPreview(programId) {
  const program = PROGRAMS.find((p) => p.id === programId);
  if (!program) return '';
  return `
    <details class="preview">
      <summary class="small">See the exercises in ${program.name}</summary>
      ${Object.entries(dayLabels(program)).map(([type, label]) => `
        <h3 style="margin:10px 0 6px">${program.week ? DAYS[program.week.indexOf(type)] + ' · ' : ''}${label}</h3>
        <ul class="list">${program[type].map(([name, sets, reps]) => `<li>${exerciseButton(name, `${sets} × ${reps}`)}<span class="muted small">${sets} × ${reps}</span></li>`).join('')}</ul>`).join('')}
    </details>`;
}

// Tap-to-select program cards plus a days-per-week toggle.
// With allowSkip, a "decide later" card is added at the end.
function programPicker(selectedId, scheduleId, allowSkip = false) {
  const selected = selectedId || PROGRAMS[0].id;
  const card = (value, title, about) => `
    <label class="choice">
      <input type="radio" name="program" value="${value}" ${selected === value ? 'checked' : ''}>
      <span><strong>${title}</strong><small>${about}</small></span>
    </label>`;
  return `
    <div class="choices">
      ${PROGRAMS.map((p) => card(p.id, p.name, p.about)).join('')}
      ${allowSkip ? card('none', 'Decide later', 'Skip for now. You can pick one in the Workout tab.') : ''}
    </div>
    <div class="schedule-pick">
      <h3>How many days a week?</h3>
      <div class="segmented">
        ${Object.entries(SCHEDULES).map(([k, s]) => `
          <label class="choice">
            <input type="radio" name="schedule" value="${k}" ${(scheduleId || 'six') === k ? 'checked' : ''}>
            <span><strong>${s.label}</strong><small>${s.detail}</small></span>
          </label>`).join('')}
      </div>
    </div>
    <div class="program-preview">${programPreview(selected)}</div>`;
}

function bindProgramPicker(form) {
  const sync = () => {
    const id = form.querySelector('input[name=program]:checked')?.value;
    form.querySelector('.program-preview').innerHTML = programPreview(id);
    // Programs with their own week don't need the days-per-week choice.
    form.querySelector('.schedule-pick').hidden = id === 'none' || !!PROGRAMS.find((p) => p.id === id)?.week;
  };
  form.querySelectorAll('input[name=program]').forEach((r) => r.addEventListener('change', sync));
  sync();
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

/* ---------- Exercise demos ---------- */

function demoFor(name) {
  if (DEMOS[name]) return DEMOS[name];
  const key = Object.keys(DEMOS).find((k) => k.toLowerCase() === name.trim().toLowerCase());
  return key ? DEMOS[key] : null;
}

function exerciseButton(name, detail = '') {
  return `<button type="button" class="ex-name grow" data-act="demo" data-name="${esc(name)}" data-detail="${esc(detail)}">
    <span class="play" aria-hidden="true">▶</span>${esc(name)}</button>`;
}

/* ---------- Muscle map ---------- */

// Simple female figure, front and back. Each muscle group maps to shapes on either view.
const BODY_BASE = (x, back) => `
  <circle cx="${x}" cy="14" r="8.5"/>
  <path class="hair" d="${back
    ? `M${x - 9} 15 Q${x - 9} 4 ${x} 4 Q${x + 9} 4 ${x + 9} 15 Q${x} 21 ${x - 9} 15 Z`
    : `M${x - 9} 16 Q${x - 10} 3 ${x} 3.5 Q${x + 10} 3 ${x + 9} 16 Q${x + 6} 8 ${x} 8 Q${x - 6} 8 ${x - 9} 16 Z`}"/>
  <rect x="${x - 4}" y="21" width="8" height="8" rx="2"/>
  ${back ? `<ellipse class="hair" cx="${x}" cy="27" rx="3.5" ry="8"/>` : ''}
  <path d="M${x - 17} 31 Q${x} 26 ${x + 17} 31 L${x + 12} 62 Q${x + 19} 78 ${x + 18} 92 Q${x} 99 ${x - 18} 92 Q${x - 19} 78 ${x - 12} 62 Z"/>
  <rect x="${x - 27}" y="32" width="8" height="32" rx="4"/><rect x="${x + 19}" y="32" width="8" height="32" rx="4"/>
  <rect x="${x - 29}" y="62" width="7" height="30" rx="3.5"/><rect x="${x + 22}" y="62" width="7" height="30" rx="3.5"/>
  <rect x="${x - 17}" y="86" width="16" height="58" rx="8"/><rect x="${x + 1}" y="86" width="16" height="58" rx="8"/>
  <rect x="${x - 14}" y="142" width="11" height="44" rx="5.5"/><rect x="${x + 3}" y="142" width="11" height="44" rx="5.5"/>`;

const FRONT = 45;
const BACK = 135;
const pair = (cx, cy, rx, ry, xs) => xs.map((x) => `<ellipse cx="${x - cx}" cy="${cy}" rx="${rx}" ry="${ry}"/><ellipse cx="${x + cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`).join('');
const MUSCLE_SHAPES = {
  chest: pair(7, 44, 7.5, 6, [FRONT]),
  shoulders: pair(20, 36, 5.5, 5.5, [FRONT, BACK]),
  biceps: pair(23, 50, 3.5, 8, [FRONT]),
  triceps: pair(23, 50, 3.5, 8, [BACK]),
  forearms: pair(25.5, 76, 3, 10, [FRONT, BACK]),
  abdominals: `<rect x="${FRONT - 6}" y="52" width="12" height="26" rx="5"/>`,
  quadriceps: pair(8.5, 112, 6, 19, [FRONT]),
  adductors: pair(2.5, 100, 2.2, 9, [FRONT]),
  abductors: pair(15.5, 94, 2.5, 7, [FRONT]),
  calves: pair(8.5, 160, 4.2, 13, [FRONT, BACK]),
  traps: `<path d="M${BACK - 13} 32 Q${BACK} 26 ${BACK + 13} 32 L${BACK + 5} 44 L${BACK - 5} 44 Z"/>`,
  lats: pair(10, 54, 5.5, 12, [BACK]),
  'middle back': `<rect x="${BACK - 4.5}" y="44" width="9" height="18" rx="3"/>`,
  'lower back': `<rect x="${BACK - 7}" y="66" width="14" height="13" rx="4"/>`,
  glutes: pair(8.5, 94, 9, 9.5, [BACK]),
  hamstrings: pair(8.5, 124, 6, 17, [BACK]),
  neck: `<rect x="${FRONT - 3.5}" y="22" width="7" height="6" rx="2"/>`
};

function bodyMap(primary = [], secondary = []) {
  const group = (cls, list) => list.filter((m) => MUSCLE_SHAPES[m]).map((m) => `<g class="${cls}">${MUSCLE_SHAPES[m]}</g>`).join('');
  return `
    <svg class="bodymap" viewBox="0 0 180 192" role="img" aria-label="Muscles worked: ${esc([...primary, ...secondary].join(', '))}">
      <g class="base">${BODY_BASE(FRONT, false)}${BODY_BASE(BACK, true)}</g>
      <g class="idle">${Object.values(MUSCLE_SHAPES).join('')}</g>
      ${group('secondary', secondary)}
      ${group('primary', primary)}
      <text x="${FRONT}" y="191">Front</text><text x="${BACK}" y="191">Back</text>
    </svg>`;
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// GIF-style demo: the thumbnail shows until the card is on screen, then the
// video plays muted on a loop with no controls (see watchGifs).
function videoPlayer(name) {
  const id = VIDEOS[name];
  if (!id) return '';
  return `
    <div class="video gif" data-video="${id}" role="img" aria-label="${esc(name)} demo">
      <img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="">
    </div>`;
}

let gifObserver = null;

// The thumbnail stays visible until YouTube says the video is playing
// (playerState 1), so a blocked autoplay never leaves a black box.
window.addEventListener('message', (e) => {
  if (!/youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname)) return;
  let data;
  try { data = JSON.parse(e.data); } catch { return; }
  if (data?.info?.playerState !== 1) return;
  const frame = $$('.video.gif iframe').find((f) => f.contentWindow === e.source);
  if (frame) frame.classList.add('playing');
});

// Only cards in view play, so a long workout doesn't run six videos at once.
function watchGifs() {
  if (gifObserver) gifObserver.disconnect();
  if (!('IntersectionObserver' in window)) return;
  gifObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    const box = entry.target;
    const frame = box.querySelector('iframe');
    if (entry.isIntersecting && !frame) {
      const id = box.dataset.video;
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&playsinline=1&rel=0&disablekb=1&iv_load_policy=3&enablejsapi=1`;
      f.title = box.getAttribute('aria-label');
      f.allow = 'autoplay; encrypted-media';
      f.tabIndex = -1;
      // Ask the player to report its state; it fades in once it is playing.
      f.addEventListener('load', () => f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id }), '*'));
      box.appendChild(f);
    } else if (!entry.isIntersecting && frame) {
      frame.remove();
    }
  }), { threshold: 0.5 });
  $$('.video.gif').forEach((el) => gifObserver.observe(el));
}

function muscleTags(name) {
  const demo = demoFor(name);
  if (!demo?.muscles.length) return '';
  return `
    <div class="muscles">
      ${demo.muscles.map((m) => `<span class="tag primary">${titleCase(m)}</span>`).join('')}
      ${demo.secondary.map((m) => `<span class="tag">${titleCase(m)}</span>`).join('')}
    </div>`;
}

// Body map of the muscles worked, with the muscle names below.
function exerciseMedia(name, withSteps = true) {
  const demo = demoFor(name);
  if (!demo?.muscles.length) return '';
  return `
    <div class="ex-media">${bodyMap(demo.muscles, demo.secondary)}</div>
    <div class="muscles">
      ${demo.muscles.map((m) => `<span class="tag primary">${titleCase(m)}</span>`).join('')}
      ${demo.secondary.map((m) => `<span class="tag">${titleCase(m)}</span>`).join('')}
    </div>
    ${withSteps && demo.steps.length ? `
      <details class="howto">
        <summary>How to do it</summary>
        <ol class="steps">${demo.steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>
      </details>` : ''}`;
}

// YouTube and Instagram searches for women demonstrating the exercise.
function videoLinks(name) {
  const youtube = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} women proper form`)}`;
  const reels = `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(`${name} women form`)}`;
  return `
    <a class="video-link" href="${youtube}" target="_blank" rel="noopener" aria-label="Watch ${esc(name)} on YouTube" title="YouTube">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="4"/><path class="glyph" d="M10 9l5 3-5 3z"/></svg>
    </a>
    <a class="video-link" href="${reels}" target="_blank" rel="noopener" aria-label="Watch ${esc(name)} reels on Instagram" title="Instagram">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" class="outline"/><circle cx="12" cy="12" r="4" class="outline"/><circle cx="17.3" cy="6.7" r="1.2" class="dot"/></svg>
    </a>`;
}

// Card header: the exercise name opens the step-by-step sheet.
function exerciseHeader(e) {
  return `
    <div class="row between">
      <div class="grow">
        <h3 class="ex-title">${esc(e.name)}</h3>
        <div class="muted small">${e.sets ? `${e.sets} sets × ${esc(e.reps)}` : ''}</div>
      </div>
      <button type="button" class="video-link info" data-act="demo" data-name="${esc(e.name)}" data-detail="${esc(setsReps(e))}" aria-label="How to do ${esc(e.name)}" title="How to do it">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" class="outline"/><path class="stroke" d="M12 11v6"/><circle cx="12" cy="7.5" r="1.3" class="dot"/></svg>
      </button>
      ${videoLinks(e.name)}
    </div>`;
}

function showDemo(name, detail) {
  const demo = demoFor(name);
  openSheet(esc(name), `
    ${detail ? `<span class="pill">${esc(detail)}</span>` : ''}
    ${exerciseMedia(name, false)}
    ${demo?.steps.length ? `<ol class="steps">${demo.steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>`
      : '<p class="empty">No written steps for this exercise yet. Watch a video instead.</p>'}
    `, null, videoLinks(name));
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
  // Only offer chart tabs for measurements that have been logged.
  const tabs = MEASURES.filter((m) => list.some((x) => x[m.key] != null));
  if (!tabs.some((m) => m.key === chartKey)) chartKey = 'weight';
  const series = [...list].reverse().filter((m) => m[chartKey] != null);
  const unit = MEASURES.find((m) => m.key === chartKey).unit;
  const weights = [...list].reverse().filter((m) => m.weight != null);
  const change = weights.length > 1 ? weights[weights.length - 1].weight - weights[0].weight : null;
  const workouts = Object.entries(state.days).filter(([k, d]) => d.workoutDone && k > shiftKey(dateKey(), -7)).length;
  const target = state.profile.targetWeight;

  const tile = (label, value, note) => `
    <div class="tile"><div class="muted small">${label}</div><div class="big">${value}</div><div class="muted small">${note}</div></div>`;

  $('#view').innerHTML = `
    <div class="tiles">
      ${tile('Weight', `${fmt(t.weight, 1)} kg`, target ? `Goal ${fmt(target, 1)} kg` : 'Latest')}
      ${tile('Change', change == null ? '–' : `${change > 0 ? '+' : ''}${fmt(change, 1)} kg`, 'Since you started')}
      ${tile('BMI', fmt(t.bmi, 1), t.bmiCat)}
      ${tile('Workouts', workouts, 'In the last 7 days')}
    </div>

    <button class="big-btn wide" data-act="add-measure"><span>＋</span>Log weight</button>

    <section class="card">
      <div class="row between">
        <h2>${MEASURES.find((m) => m.key === chartKey).label} trend</h2>
        ${series.length > 1 ? `<span class="pill">${fmt(series[series.length - 1][chartKey] - series[0][chartKey], 1)} ${unit}</span>` : ''}
      </div>
      ${tabs.length > 1 ? `<div class="chart-tabs">${tabs.map((m) => `<button class="${m.key === chartKey ? '' : 'ghost'}" data-act="chart" data-key="${m.key}">${m.label}</button>`).join('')}</div>` : ''}
      ${series.length > 1 ? lineChart(series.map((m) => ({ x: m.date, y: m[chartKey] }))) : '<p class="empty">Log your weight every week or two. Your trend shows up here.</p>'}
    </section>

    <section class="card">
      <details>
        <summary>All entries (${list.length})</summary>
        ${list.length ? `<ul class="list">${list.map((m) => `
          <li>
            <span class="grow">${prettyDate(m.date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span class="muted small">${MEASURES.filter((x) => m[x.key] != null).map((x) => `${x.label} ${fmt(m[x.key], 1)}`).join(' · ')}</span>
            <button class="icon" data-act="del-measure" data-id="${m.id}" aria-label="Remove entry">✕</button>
          </li>`).join('')}</ul>` : '<p class="empty">No entries yet.</p>'}
      </details>
    </section>

    <p class="muted small center">Tip: waist size and photos show fat loss better than the scale.</p>
  `;
}

function openMeasureSheet() {
  openSheet('Log weight', `
    <form id="measure-form" style="display:grid;gap:10px" autocomplete="off">
      <div class="grid-2">
        <label>Weight (kg)<input name="weight" type="number" inputmode="decimal" min="0" step="0.1" placeholder="${fmt(latestWeight(), 1)}"></label>
        <label>Waist (cm)<input name="waist" type="number" inputmode="decimal" min="0" step="0.1" placeholder="At belly button"></label>
      </div>
      <details>
        <summary class="muted small">More measurements (optional)</summary>
        <div class="grid-2">
          ${MEASURES.filter((m) => !['weight', 'waist'].includes(m.key)).map((m) => `<label>${m.label} (${m.unit})<input name="${m.key}" type="number" inputmode="decimal" min="0" step="0.1"></label>`).join('')}
          <label>Date<input name="date" type="date" value="${dateKey()}" max="${dateKey()}" required></label>
          <label>Note<input name="note" placeholder="Optional"></label>
        </div>
      </details>
      <button type="submit">Save</button>
    </form>`, (sheet) => {
    const form = $('#measure-form', sheet);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = formData(form);
      const entry = { id: uid(), date: f.date, note: f.note.trim() };
      MEASURES.forEach((m) => (entry[m.key] = num(f[m.key])));
      if (MEASURES.every((m) => entry[m.key] == null)) {
        toast('Enter your weight or a measurement');
        return;
      }
      state.measurements.push(entry);
      save();
      closeSheet();
      toast('Saved');
      renderProgress();
    });
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
      <p class="muted" style="margin:0">Two quick steps: a few numbers about you, then pick a workout. Your calorie, protein and water targets are worked out for you. You can change anything later.</p>
    </section>` : ''}

    <div id="account-slot" data-onboarding="${onboarding ? 1 : 0}">${accountHtml(onboarding)}</div>

    <form id="profile-form" style="display:grid;gap:14px" autocomplete="off">
      <section class="card">
        <h2>${onboarding ? '1. About you' : 'About you'}</h2>
        <div class="grid-2">
          <label style="grid-column:1/-1">Name (optional)<input name="name" value="${v('name')}"></label>
          <label>Age<input name="age" type="number" inputmode="numeric" min="13" max="100" required value="${v('age')}"></label>
          <label>Sex (for calorie formula)
            <select name="sex">${opt('sex', 'female', 'Female', 'female')}${opt('sex', 'male', 'Male', 'female')}</select>
          </label>
          <label>Height (cm)<input name="height" type="number" inputmode="decimal" min="100" max="250" step="0.1" required value="${v('height')}"></label>
          <label>${onboarding ? 'Weight' : 'Starting weight'} (kg)<input name="weight" type="number" inputmode="decimal" min="25" max="300" step="0.1" required value="${v('weight')}"></label>
        </div>
      </section>

      <section class="card">
        <h2>${onboarding ? 'Your goal' : 'Goal'}</h2>
        <div class="segmented three">
          ${[['lose', 'Lose fat'], ['maintain', 'Tone up'], ['gain', 'Build muscle']].map(([k, label]) => `
            <label class="choice">
              <input type="radio" name="goal" value="${k}" ${(p.goal ?? 'lose') === k ? 'checked' : ''}>
              <span><strong>${label}</strong></span>
            </label>`).join('')}
        </div>
        <label>How active are you?
          <select name="activity">${Object.entries(ACTIVITY).map(([k, a]) => opt('activity', k, a.label, 'moderate')).join('')}</select>
        </label>
        <details ${onboarding ? '' : 'open'}>
          <summary class="muted small">More options${onboarding ? ' (optional, defaults are fine)' : ''}</summary>
          <div class="grid-2">
            <label>Target weight (kg)<input name="targetWeight" type="number" inputmode="decimal" min="25" max="300" step="0.1" value="${v('targetWeight')}"></label>
            <label>Pace (kg/week)
              <select name="pace">${[0.25, 0.5, 0.75].map((n) => `<option value="${n}" ${(p.pace ?? 0.25) === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
            </label>
            <label>Protein (g per kg)<input name="proteinPerKg" type="number" inputmode="decimal" min="0.8" max="3" step="0.1" required value="${v('proteinPerKg', 1.6)}"></label>
            <label>Sleep goal (hours)<input name="sleepGoal" type="number" inputmode="decimal" min="4" max="12" step="0.5" value="${v('sleepGoal', 7)}"></label>
            <label>Glass size (ml)<input name="glassMl" type="number" inputmode="numeric" min="50" max="1000" step="50" required value="${v('glassMl', 250)}"></label>
            <label>BMI scale
              <select name="bmiScale">${Object.entries(BMI_SCALES).map(([k, s]) => opt('bmiScale', k, s.label, 'standard')).join('')}</select>
            </label>
          </div>
        </details>
      </section>

      ${onboarding ? `
      <section class="card" id="onboard-program">
        <h2>2. Pick your workout</h2>
        <p class="muted small" style="margin:0">Tap one. We'll fill in your whole week with sets and reps.</p>
        ${programPicker(null, null, true)}
      </section>` : ''}

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
    if (onboarding && f.program && f.program !== 'none') applyProgram(f.program, f.schedule);
    save();
    toast(onboarding ? 'Welcome!' : 'Profile saved');
    if (onboarding) location.hash = '#today';
    route();
  });

  const file = $('#import-file');
  if (file) file.addEventListener('change', importBackup);
  if (onboarding) bindProgramPicker($('#onboard-program'));
}

/* ---------- Account ---------- */

const GOOGLE_G = `<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>`;

function accountHtml(onboarding) {
  const c = window.cloud;
  const status = c?.status ?? 'loading';
  if (status === 'off') {
    return onboarding ? '' : `
      <section class="card">
        <h2>Account</h2>
        <p class="muted small" style="margin:0">Google sign-in is not switched on yet. Your data is saved on this device only.</p>
      </section>`;
  }
  if (status === 'signed-in' || status === 'syncing') {
    const u = c.user || {};
    const when = c.lastSync ? new Date(c.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    return `
      <section class="card">
        <div class="row">
          ${u.photo ? `<img class="avatar" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : ''}
          <div class="grow">
            <strong>${esc(u.name || 'Signed in')}</strong>
            <div class="muted small">${esc(u.email || '')}</div>
          </div>
          ${onboarding ? '' : '<button class="ghost" data-act="sign-out">Sign out</button>'}
        </div>
        <div class="muted small">${status === 'syncing' ? 'Syncing…' : `✓ Synced across your devices${when ? ` · ${when}` : ''}`}</div>
      </section>`;
  }
  const busy = status === 'loading';
  const offline = status === 'offline';
  return `
    <section class="card">
      <h2>${onboarding ? 'Used FormaFit before?' : 'Account'}</h2>
      <p class="muted small" style="margin:0">${onboarding
        ? 'Sign in to get your data from your other phone or laptop. New here? Sign in now so everything is backed up.'
        : 'Sign in to back up your data and use FormaFit on all your devices.'}</p>
      ${offline ? '<p class="muted small" style="margin:0">Can\'t reach the sync service right now. Your data is safe on this device.</p>' : ''}
      <button class="google-btn" data-act="sign-in" ${busy || offline ? 'disabled' : ''}>${GOOGLE_G}${busy ? 'Connecting…' : 'Sign in with Google'}</button>
    </section>`;
}

window.addEventListener('formafit:auth', () => {
  const slot = $('#account-slot');
  if (slot) slot.innerHTML = accountHtml(slot.dataset.onboarding === '1');
});

// Used by sync.js.
window.FormaFit = {
  getState: () => state,
  replaceState(data) {
    state = normalize(data);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (err) {
      toast('Could not save. Storage may be full.');
    }
    closeSheet();
    if (!location.hash || location.hash === '#') location.hash = '#today';
    route();
  },
  toast
};

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
    state = normalize(data);
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
    case 'demo':
      e.preventDefault();
      showDemo(el.dataset.name, el.dataset.detail);
      break;
    case 'close-sheet':
      closeSheet();
      break;
    case 'add-food':
      openFoodSheet();
      break;
    case 'meal':
      openMealSheet(el.dataset.id);
      break;
    case 'food-rules':
      openRulesSheet();
      break;
    case 'edit-meals':
      openMealEditSheet();
      break;
    case 'add-measure':
      openMeasureSheet();
      break;
    case 'sleep': {
      const d = day(viewDate);
      const start = d.sleep ?? state.profile.sleepGoal ?? 7;
      d.sleep = Math.min(14, Math.max(0, d.sleep == null ? start : start + Number(el.dataset.step)));
      save();
      renderToday();
      break;
    }
    case 'workout-day':
      workoutOffset = Number(el.dataset.off);
      renderWorkout();
      break;
    case 'set':
      toggleSet(Number(el.dataset.ex), Number(el.dataset.n));
      break;
    case 'sheet-program':
      openSheet('Change program', programFormHtml(), bindProgramForm);
      break;
    case 'sheet-plan':
      openPlanSheet();
      break;
    case 'sheet-history':
      openHistorySheet();
      break;
    case 'sheet-tips':
      openTipsSheet();
      break;
    case 'del-set':
      state.sets = state.sets.filter((s) => s.id !== id);
      save();
      openHistorySheet();
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
    case 'sign-in':
      window.cloud?.signIn();
      break;
    case 'sign-out':
      if (confirm('Sign out? Your data stays on this device.')) window.cloud?.signOut();
      break;
    case 'reset':
      if (!confirm(window.cloud?.status === 'signed-in'
        ? 'Delete all FormaFit data on this device and sign out? Your data stays in your Google account and comes back when you sign in again.'
        : 'Delete all FormaFit data on this device? Export a backup first if you want to keep it.')) return;
      localStorage.removeItem(STORE_KEY);
      state = emptyState();
      // Sign out too, or the live sync would bring the data straight back.
      if (window.cloud?.status === 'signed-in') window.cloud.signOut();
      viewDate = dateKey();
      location.hash = '';
      route();
      break;
  }
});

/* ---------- Boot ---------- */

// Tapping the dark area around the sheet closes it.
$('#sheet').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});

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
  // Reload once when a new version takes over, so nobody is stuck on old files.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
