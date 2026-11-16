// Greener Space Planner: turns a few answers about a site into three greenhouse options.
// All prices, yields and harvest records are sample data for the prototype.

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WINTER = [10, 11, 0, 1];
const PRICE_DATE = 'Oct 28, 2026';

// lb per m² of bed per harvest month, and colour for the layout
const CROPS = {
  lettuce: { name: 'Lettuce', color: '#7fae37', yield: 2.0, water: 3.0 },
  kale: { name: 'Kale', color: '#3c7470', yield: 1.6, water: 3.5 },
  tomatoes: { name: 'Tomatoes', color: '#c6462e', yield: 6.0, water: 6.0 }
};
const CROP_ORDER = ['tomatoes', 'kale', 'lettuce']; // tallest crop goes on the north bed

const PLANS = {
  seasonal: {
    name: 'Seasonal', desc: 'Unheated hoop house. Cheapest. Grows spring to fall.',
    power: 0, heat: [0, 0], fans: 80, maint: [1.5, 2.5],
    cal: { lettuce: [4, 5, 8, 9], kale: [5, 6, 7, 8, 9], tomatoes: [6, 7, 8] }
  },
  extended: {
    name: 'Extended season', desc: 'Double-layer hoop house with backup heat. Longer season.',
    power: 1, heat: [35, 70], fans: 300, maint: [2.5, 4],
    cal: { lettuce: [3, 4, 5, 8, 9, 10], kale: [3, 4, 5, 6, 7, 8, 9, 10], tomatoes: [6, 7, 8, 9] }
  },
  winter: {
    name: 'Winter-ready', desc: 'Insulated greenhouse with heat and grow lights. Greens all year.',
    power: 2, heat: [260, 400], fans: 500, maint: [3, 5],
    cal: { lettuce: [0, 1, 2, 3, 4, 5, 8, 9, 10, 11], kale: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], tomatoes: [5, 6, 7, 8, 9] }
  }
};
const KEYS = ['seasonal', 'extended', 'winter'];
const SUN = { full: 1, partial: 0.8, heavy: 0.6 };
const ALL = KEYS;

// Shopping list items: which plans use them, quantity rule, low and high unit price (CAD)
const CATALOG = [
  { name: 'Hoop-house frame kit', unit: 'm²', plans: ['seasonal'], qty: s => s.area, lo: 42, hi: 65 },
  { name: 'Plastic cover, 1 layer', unit: 'm²', plans: ['seasonal'], qty: s => Math.ceil(s.area * 1.8), lo: 2.2, hi: 3.6 },
  { name: 'Hoop-house frame kit, heavy duty', unit: 'm²', plans: ['extended'], qty: s => s.area, lo: 75, hi: 110 },
  { name: 'Plastic cover, 2 layers', unit: 'm²', plans: ['extended'], qty: s => Math.ceil(s.area * 3.6), lo: 2.4, hi: 3.9 },
  { name: 'Roll-up sides', unit: 'sides', plans: ['extended'], qty: () => 2, lo: 300, hi: 450 },
  { name: 'Insulated polycarbonate greenhouse', unit: 'm²', plans: ['winter'], qty: s => s.area, lo: 300, hi: 450 },
  { name: 'End walls and door', unit: 'set', plans: ['seasonal', 'extended'], qty: () => 1, lo: 900, hi: 1600 },
  { name: 'Raised beds', unit: 'm² bed', plans: ALL, qty: s => Math.round(s.bedArea), lo: 45, hi: 70 },
  { name: 'Soil and compost', unit: 'm³', plans: ALL, qty: s => Math.ceil(s.bedArea * 0.3), lo: 70, hi: 110 },
  { name: 'Drip watering kit with timer', unit: 'kit', plans: ALL, qty: s => Math.max(1, Math.ceil(s.bedArea / 50)), lo: 450, hi: 750 },
  { name: 'Water hookup with backflow valve', unit: 'set', plans: ALL, when: s => s.water === 'tap', qty: () => 1, lo: 180, hi: 350 },
  { name: 'Rainwater tank, 1,000 L, with pump', unit: 'each', plans: ALL, when: s => s.water === 'rain', qty: s => Math.max(1, Math.ceil(s.peakWeekL / 1000)), lo: 550, hi: 950 },
  { name: 'Backup heater and fans', unit: 'set', plans: ['extended'], qty: () => 1, lo: 1000, hi: 1700 },
  { name: 'Heater, fans and climate controller', unit: 'set', plans: ['winter'], qty: () => 1, lo: 4500, hi: 7500 },
  { name: 'LED grow lights', unit: 'each', plans: ['winter'], qty: s => s.lights, lo: 280, hi: 450 },
  { name: 'Outdoor outlet (electrician)', unit: 'job', plans: ['extended'], when: s => s.power < 1, qty: () => 1, lo: 600, hi: 1400 },
  { name: 'New electrical circuit (electrician)', unit: 'job', plans: ['winter'], when: s => s.power < 2, qty: () => 1, lo: 2200, hi: 4800 },
  { name: 'Tomato trellis', unit: 'set', plans: ALL, when: s => s.crops.includes('tomatoes'), qty: () => 1, lo: 200, hi: 380 },
  { name: 'Tools and harvest bins', unit: 'set', plans: ALL, qty: () => 1, lo: 400, hi: 700 }
];

const PARTNERS = ['Partner pantry (sample)', 'Partner meal program (sample)'];

const state = {
  view: 'site',
  site: { org: 'Sample Community Food Hub', area: 90, sun: 'partial', water: 'tap', power: 1, budget: 30000, goal: 'extended', crops: ['lettuce', 'kale', 'tomatoes'] },
  chosen: 'extended',
  approved: false,
  errors: {},
  records: [],
  nextId: 1
};

// ---------- helpers ----------
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const k = n => n >= 1000 ? '$' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : '$' + Math.round(n / 10) * 10;
const range = (a, b) => k(a) + ' to ' + k(b).replace('$', '');
const lbs = n => Math.round(n).toLocaleString('en-CA') + ' lb';
const round1 = n => Math.round(n * 10) / 10;
const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shortDate = s => { const [, m, d] = s.split('-').map(Number); return MONTH_NAMES[m - 1] + ' ' + d; };

// ---------- planning rules ----------
function layout(site) {
  const area = Math.max(15, +site.area || 0);
  const length = Math.sqrt(area * 2), width = area / length; // 2:1 footprint
  const path = 1.2, edge = 0.3, door = 1.2;                  // 1.2 m paths for wheelchair access
  const beds = width >= 4.5 ? 3 : width >= 2.6 ? 2 : 1;
  const bedW = (width - 2 * edge - (beds - 1) * path) / beds;
  const bedL = Math.max(1, length - door - 2 * edge);
  const crops = CROP_ORDER.filter(c => site.crops.includes(c));
  const n = crops.length || 1;
  const bedCrops = [];
  for (let i = 0; i < beds; i++) {
    if (n <= beds) bedCrops.push([crops[Math.floor(i * n / beds)]]);
    else if (beds === 2) bedCrops.push(i === 0 ? [crops[0]] : crops.slice(1));
    else bedCrops.push(crops.slice());
  }
  const cropArea = {};
  crops.forEach(c => cropArea[c] = 0);
  bedCrops.forEach(list => list.forEach(c => { if (c) cropArea[c] += bedW * bedL / list.length; }));
  return { area, length, width, path, edge, beds, bedW, bedL, bedArea: beds * bedW * bedL, bedCrops, cropArea, crops };
}

function planFor(key, site = state.site) {
  const P = PLANS[key], L = layout(site), sun = SUN[site.sun], power = +site.power;

  const monthly = {};
  let yearly = 0;
  L.crops.forEach(c => {
    const m = Array(12).fill(0);
    P.cal[c].forEach(i => { m[i] = CROPS[c].yield * L.cropArea[c] * sun * (WINTER.includes(i) ? 0.55 : 1); });
    monthly[c] = m;
    yearly += m.reduce((a, b) => a + b, 0);
  });
  const monthTotal = MONTHS.map((_, i) => L.crops.reduce((a, c) => a + monthly[c][i], 0));

  let peakDay = 0;
  for (let i = 0; i < 12; i++) {
    let d = 0;
    L.crops.forEach(c => { if (P.cal[c].includes(i)) d += CROPS[c].water * L.cropArea[c]; });
    peakDay = Math.max(peakDay, d);
  }

  const lights = key === 'winter' ? Math.ceil(L.bedArea / 3) : 0;
  const ctx = { area: L.area, bedArea: L.bedArea, crops: L.crops, water: site.water, power, lights, peakWeekL: peakDay * 7 };
  const items = CATALOG
    .filter(i => i.plans.includes(key) && (!i.when || i.when(ctx)))
    .map(i => { const q = i.qty(ctx); return { ...i, q, low: q * i.lo, high: q * i.hi }; });
  const setupLo = items.reduce((a, b) => a + b.low, 0);
  const setupHi = items.reduce((a, b) => a + b.high, 0);

  const kwhLo = P.heat[0] * L.area + lights * 504 + P.fans;
  const kwhHi = P.heat[1] * L.area + lights * 504 + P.fans;
  const runLo = kwhLo * 0.12 + L.bedArea * 9 + L.area * P.maint[0];
  const runHi = kwhHi * 0.12 + L.bedArea * 15 + L.area * P.maint[1];

  const budget = +site.budget || 0;
  const checks = {
    budget: setupHi <= budget ? ['ok', 'Fits your budget'] : setupLo <= budget ? ['warn', 'Tight on budget'] : ['bad', 'Over budget'],
    power: power >= P.power ? ['ok', 'Enough power on site'] : ['warn', 'Needs an electrician (included in cost)'],
    water: site.water === 'none' ? ['bad', 'Needs a water source first'] : ['ok', 'Water is covered']
  };
  const points = { ok: 2, warn: 1, bad: 0 };
  const score = Object.values(checks).reduce((a, c) => a + points[c[0]], 0) + (site.goal === key ? 3 : 0);

  return { key, P, L, monthly, monthTotal, yearly, items, setupLo, setupHi, runLo, runHi, checks, score,
    months: monthTotal.filter(v => v > 0).length };
}

function allPlans(site = state.site) {
  const p = {};
  KEYS.forEach(x => p[x] = planFor(x, site));
  const goal = x => site.goal === x ? 1 : 0;
  let best = KEYS[0];
  KEYS.forEach(x => {
    const d = p[x].score - p[best].score;
    if (d > 0 || (d === 0 && (goal(x) > goal(best) || (goal(x) === goal(best) && p[x].setupLo < p[best].setupLo)))) best = x;
  });
  return { p, best };
}

// ---------- sample harvest season (Sep to Oct) ----------
(function sampleSeason() {
  const plan = planFor('extended');
  const f = [0.86, 0.93, 1.04, 0.97, 0.9, 0.85, 0.74, 0.66];
  const start = new Date(2026, 8, 8);
  for (let w = 0; w < 8; w++) {
    const d = new Date(start); d.setDate(d.getDate() + 7 * w);
    let total = 0;
    plan.L.crops.forEach((c, ci) => {
      const lb = round1(plan.monthly[c][d.getMonth()] / 4.33 * f[(w + ci) % 8]);
      if (lb > 0) { state.records.push({ id: state.nextId++, date: isoDate(d), type: 'Harvest', crop: c, lb, to: '' }); total += lb; }
    });
    const d2 = new Date(d); d2.setDate(d2.getDate() + 2);
    state.records.push({ id: state.nextId++, date: isoDate(d2), type: 'Delivery', crop: 'mixed', lb: Math.round(total * 0.58), to: PARTNERS[0] });
    state.records.push({ id: state.nextId++, date: isoDate(d2), type: 'Delivery', crop: 'mixed', lb: Math.round(total * 0.34), to: PARTNERS[1] });
  }
})();

// ---------- drawing ----------
function layoutSVG(plan) {
  const L = plan.L, s = Math.min(440 / L.length, 180 / L.width), ox = 70, oy = 30, w = L.length * s, h = L.width * s;
  let o = `<svg viewBox="0 0 600 260" role="img" aria-label="Greenhouse layout">`;
  o += `<rect x="${ox}" y="${oy}" width="${w}" height="${h}" fill="#eef4ef" stroke="#2f6f4e" stroke-width="2"/>`;
  for (let b = 0; b < L.beds; b++) {
    const y = oy + (L.edge + b * (L.bedW + L.path)) * s, bh = L.bedW * s, x = ox + L.edge * s, bw = L.bedL * s;
    const list = L.bedCrops[b], seg = bw / list.length;
    list.forEach((c, i) => {
      if (!c) return;
      o += `<rect x="${x + i * seg + (i ? 2 : 0)}" y="${y}" width="${seg - (list.length > 1 ? 2 : 0)}" height="${bh}" fill="${CROPS[c].color}"/>`;
      o += `<text x="${x + i * seg + seg / 2}" y="${y + bh / 2 + 4}" text-anchor="middle" fill="#fff" font-size="13" font-weight="600">${CROPS[c].name}</text>`;
    });
  }
  o += `<text x="${ox + w + 8}" y="${oy + h / 2 + 4}" font-size="12" fill="#444">Door</text>`;
  o += `<text x="${ox + w / 2}" y="${oy + h + 20}" text-anchor="middle" font-size="12" fill="#666">${L.length.toFixed(1)} m</text>`;
  o += `<text x="${ox - 8}" y="${oy + h / 2 + 4}" text-anchor="end" font-size="12" fill="#666">${L.width.toFixed(1)} m</text>`;
  o += `<text x="20" y="22" font-size="12" font-weight="700" fill="#444">N ↑</text>`;
  return o + '</svg>';
}

function calendarHTML(key) {
  const P = PLANS[key], crops = CROP_ORDER.filter(c => state.site.crops.includes(c));
  let h = `<div class="scroll"><table class="cal"><tr><th></th>${MONTHS.map(m => `<th>${m}</th>`).join('')}</tr>`;
  crops.forEach(c => {
    h += `<tr><td>${CROPS[c].name}</td>` + MONTHS.map((_, i) => P.cal[c].includes(i)
      ? `<td class="c" style="background:${CROPS[c].color};opacity:${WINTER.includes(i) ? 0.5 : 1}" title="${MONTH_NAMES[i]}"></td>`
      : '<td class="c"></td>').join('') + '</tr>';
  });
  return h + '</table></div>';
}

function weeklyChart() {
  const start = new Date(2026, 8, 7), weeks = [];
  for (let w = 0; w < 9; w++) {
    const a = new Date(start); a.setDate(a.getDate() + 7 * w);
    const b = new Date(a); b.setDate(b.getDate() + 7);
    const v = state.records.filter(r => r.type === 'Harvest' && new Date(r.date + 'T12:00') >= a && new Date(r.date + 'T12:00') < b).reduce((x, r) => x + r.lb, 0);
    weeks.push({ label: MONTH_NAMES[a.getMonth()] + ' ' + a.getDate(), v });
  }
  const W = 600, H = 200, l = 34, t = 10, bottom = 26, max = Math.max(...weeks.map(w => w.v)) * 1.15 || 10;
  const bw = (W - l) / weeks.length, y = v => t + (H - t - bottom) * (1 - v / max);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pounds harvested per week">`;
  [0, max / 2, max].forEach(v => {
    s += `<line x1="${l}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#eee"/><text x="${l - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#888">${Math.round(v)}</text>`;
  });
  weeks.forEach((w, i) => {
    const x = l + i * bw;
    s += `<rect x="${x + bw * 0.2}" y="${y(w.v)}" width="${bw * 0.6}" height="${y(0) - y(w.v)}" fill="#2f6f4e"><title>${round1(w.v)} lb</title></rect>`;
    s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="#888">${w.label}</text>`;
  });
  return s + '</svg>';
}

// ---------- screens ----------
const STEPS = [['site', '1. Your site'], ['compare', '2. Compare'], ['plan', '3. Your plan'], ['harvest', '4. Harvest']];
const views = {};

views.site = () => {
  const s = state.site, e = state.errors;
  const radios = (name, opts) => `<div class="choices">${opts.map(([v, t]) =>
    `<label><input type="radio" name="${name}" data-f="${name}" value="${v}" ${String(s[name]) === String(v) ? 'checked' : ''}> ${t}</label>`).join('')}</div>`;
  const err = f => e[f] ? `<div class="err">${e[f]}</div>` : '';
  return `
  <h1>Your site</h1>
  <p class="sub">Answer a few questions. The options on the right update as you go.</p>
  <div class="cols">
    <div class="box">
      <label for="org">Organization</label><input type="text" id="org" data-f="org" value="${esc(s.org)}">${err('org')}
      <label for="area">Space available (m²)</label><input type="number" id="area" data-f="area" min="15" max="1000" step="5" value="${s.area}">${err('area')}
      <label for="budget">Setup budget (CAD)</label><input type="number" id="budget" data-f="budget" min="0" step="1000" value="${s.budget}">${err('budget')}
      <label>Sunlight</label>${radios('sun', [['full', 'Full sun'], ['partial', 'Some shade'], ['heavy', 'Mostly shade']])}
      <label>Water</label>${radios('water', [['tap', 'Tap'], ['rain', 'Rainwater'], ['none', 'None yet']])}
      <label>Electricity</label>${radios('power', [[0, 'None'], [1, 'Outdoor outlet'], [2, 'Full circuit']])}
      <label>When do you want to grow?</label>${radios('goal', [['seasonal', 'Spring to fall'], ['extended', 'Longer season'], ['winter', 'All year']])}
      <label>Crops</label><div class="choices">${Object.keys(CROPS).map(c =>
        `<label><input type="checkbox" data-f="crops" value="${c}" ${s.crops.includes(c) ? 'checked' : ''}> ${CROPS[c].name}</label>`).join('')}</div>${err('crops')}
    </div>
    <div class="box" id="preview">${previewHTML()}</div>
  </div>
  <div class="row"><span></span><button class="btn main" data-go="compare">See my options</button></div>`;
};

function previewHTML() {
  const { p, best } = allPlans();
  return `<h2>Your 3 options</h2>` + KEYS.map(x => `
    <div class="opt">
      <strong>${PLANS[x].name}</strong> ${x === best ? '<span class="best">(best fit)</span>' : ''}<br>
      <span class="muted">${range(p[x].setupLo, p[x].setupHi)} to set up · ${lbs(p[x].yearly)} a year</span>
    </div>`).join('');
}

views.compare = () => {
  const { p, best } = allPlans();
  return `
  <h1>Compare options</h1>
  <p class="sub">Costs use sample prices from ${PRICE_DATE}. They are estimates, not quotes.</p>
  <div class="three">${KEYS.map(x => {
    const o = p[x];
    return `<div class="box plan ${x === best ? 'pick' : ''}">
      <h2>${PLANS[x].name}</h2>
      ${x === best ? '<div class="best">Best fit for your site</div>' : ''}
      <div class="muted">${PLANS[x].desc}</div>
      <dl>
        <dt>Setup cost</dt><dd>${range(o.setupLo, o.setupHi)}</dd>
        <dt>Yearly running cost</dt><dd>${range(o.runLo, o.runHi)}</dd>
        <dt>Food per year</dt><dd>${lbs(o.yearly)}</dd>
        <dt>Harvest months</dt><dd>${o.months} of 12</dd>
      </dl>
      <ul class="checks">${Object.values(o.checks).map(c => `<li class="${c[0]}">${c[0] === 'ok' ? '✓' : '!'} ${c[1]}</li>`).join('')}</ul>
      <button class="btn ${x === best ? 'main' : ''}" data-pick="${x}">Choose this</button>
    </div>`;
  }).join('')}</div>
  <div class="row"><button class="btn" data-go="site">Back</button></div>`;
};

views.plan = () => {
  const o = planFor(state.chosen);
  return `
  <h1>${PLANS[state.chosen].name}</h1>
  <p class="sub">${esc(state.site.org)} · ${o.L.area} m² · ${o.L.beds} beds</p>
  <div class="cols">
    <div class="box">
      <h2>Layout</h2>${layoutSVG(o)}
      <p class="muted">Tomatoes go on the north side so they don't shade the greens. Paths are 1.2 m wide.</p>
      <h2 style="margin-top:16px">Harvest calendar</h2>${calendarHTML(state.chosen)}
    </div>
    <div class="box plan">
      <h2>Summary</h2>
      <dl>
        <dt>Setup cost</dt><dd>${range(o.setupLo, o.setupHi)}</dd>
        <dt>Yearly running cost</dt><dd>${range(o.runLo, o.runHi)}</dd>
        <dt>Food per year</dt><dd>${lbs(o.yearly)}</dd>
        <dt>Harvest months</dt><dd>${o.months} of 12</dd>
      </dl>
      <h2>Expert check</h2>
      <p class="muted">A greenhouse expert reviews structure, water, electrical and food safety before anything is built.</p>
      ${state.approved ? '<p class="ok">✓ Approved</p>' : '<button class="btn" data-act="approve">Approve (demo)</button>'}
    </div>
  </div>
  <div class="box" style="margin-top:16px">
    <h2>Shopping list</h2>
    <div class="scroll"><table>
      <tr><th>Item</th><th class="n">Qty</th><th class="n">Est. cost</th></tr>
      ${o.items.map(i => `<tr><td>${i.name}</td><td class="n">${i.q.toLocaleString()} ${i.unit}</td><td class="n">${range(i.low, i.high)}</td></tr>`).join('')}
      <tr><th>Total</th><th></th><th class="n">${range(o.setupLo, o.setupHi)}</th></tr>
    </table></div>
  </div>
  <div class="row"><button class="btn" data-go="compare">Back</button><button class="btn main" data-go="harvest">Next</button></div>`;
};

views.harvest = () => {
  let harvested = 0, delivered = 0, nH = 0, nD = 0;
  const partners = new Set();
  state.records.forEach(r => {
    if (r.type === 'Harvest') { harvested += r.lb; nH++; } else { delivered += r.lb; nD++; partners.add(r.to); }
  });
  const latest = state.records.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 8);
  return `
  <h1>Harvest</h1>
  <p class="sub">The site team logs each harvest and delivery. Totals are added up from these records. (Sample season.)</p>
  <div class="three">
    <div class="box"><div class="muted">Harvested</div><div class="stat">${lbs(harvested)}</div><div class="muted">${nH} records</div></div>
    <div class="box"><div class="muted">Delivered</div><div class="stat">${lbs(delivered)}</div><div class="muted">${nD} records</div></div>
    <div class="box"><div class="muted">Partners</div><div class="stat">${partners.size}</div><div class="muted">receiving produce</div></div>
  </div>
  <div class="cols" style="margin-top:16px">
    <div class="box"><h2>Weekly harvest</h2>${weeklyChart()}</div>
    <div class="box">
      <h2>Add a record</h2>
      <form id="log">
        <label for="type">Type</label>
        <select id="type"><option>Harvest</option><option>Delivery</option></select>
        <label for="crop">Crop</label>
        <select id="crop">${state.site.crops.map(c => `<option value="${c}">${CROPS[c].name}</option>`).join('')}<option value="mixed">Mixed</option></select>
        <label for="lb">Pounds</label>
        <input type="number" id="lb" min="0.1" step="0.1" value="15">
        <div id="to-wrap" hidden><label for="to">Delivered to</label><select id="to">${PARTNERS.map(p => `<option>${p}</option>`).join('')}</select></div>
        <div class="row"><button class="btn main" type="submit">Save</button></div>
        <div class="err" id="log-err"></div>
      </form>
    </div>
  </div>
  <div class="box" style="margin-top:16px">
    <h2>Latest records</h2>
    <div class="scroll"><table>
      <tr><th>Date</th><th>Type</th><th>Crop</th><th class="n">lb</th><th>Delivered to</th></tr>
      ${latest.map(r => `<tr class="${r.isNew ? 'new' : ''}"><td>${shortDate(r.date)}</td><td>${r.type}</td><td>${r.crop === 'mixed' ? 'Mixed' : CROPS[r.crop].name}</td><td class="n">${r.lb}</td><td>${esc(r.to)}</td></tr>`).join('')}
    </table></div>
  </div>
  <div class="row"><button class="btn" data-go="plan">Back</button><button class="btn" data-go="site">Start over</button></div>`;
};

// ---------- render and events ----------
function render() {
  $('#steps').innerHTML = STEPS.map(([id, label]) => `<button class="${state.view === id ? 'on' : ''}" data-go="${id}">${label}</button>`).join('');
  $('#main').innerHTML = views[state.view]();
  const type = $('#type');
  if (type) {
    const sync = () => { $('#to-wrap').hidden = type.value !== 'Delivery'; };
    type.addEventListener('change', sync);
    sync();
  }
}

function go(view) {
  if (state.view === 'site' && view !== 'site' && !validSite()) { render(); return; }
  state.errors = {};
  state.view = view;
  render();
  window.scrollTo(0, 0);
}

function validSite() {
  const s = state.site, e = {};
  if (!String(s.org).trim()) e.org = 'Enter your organization name.';
  if (!(+s.area >= 15 && +s.area <= 1000)) e.area = 'Enter between 15 and 1,000 m².';
  if (!(+s.budget > 0)) e.budget = 'Enter a budget above $0.';
  if (!s.crops.length) e.crops = 'Pick at least one crop.';
  state.errors = e;
  return !Object.keys(e).length;
}

document.addEventListener('input', e => {
  const f = e.target.dataset.f;
  if (!f) return;
  const s = state.site;
  if (f === 'crops') s.crops = [...document.querySelectorAll('input[data-f="crops"]:checked')].map(x => x.value);
  else if (['area', 'budget', 'power'].includes(f)) s[f] = e.target.value === '' ? '' : +e.target.value;
  else s[f] = e.target.value;
  state.approved = false;
  if (+s.area >= 15 && s.crops.length) $('#preview').innerHTML = previewHTML();
});

document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.go) go(b.dataset.go);
  if (b.dataset.pick) { state.chosen = b.dataset.pick; state.approved = false; go('plan'); }
  if (b.dataset.act === 'approve') { state.approved = true; render(); }
});

document.addEventListener('submit', e => {
  if (e.target.id !== 'log') return;
  e.preventDefault();
  const lb = +$('#lb').value, type = $('#type').value;
  if (!(lb > 0)) { $('#log-err').textContent = 'Enter pounds above 0.'; return; }
  state.records.forEach(r => r.isNew = false);
  state.records.push({ id: state.nextId++, date: isoDate(new Date(2026, 10, 3)), type, crop: $('#crop').value, lb: round1(lb), to: type === 'Delivery' ? $('#to').value : '', isNew: true });
  render();
});

render();
