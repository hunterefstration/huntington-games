// ======================================================================
// STORAGE (localStorage can be blocked inside sandboxed iframes, so it is always wrapped)
// ======================================================================
const SAVE_KEY = 'beanBrewSaveV2';            // same key as older versions so progress carries over
const PREV_KEY = 'beanBrewSaveV2_prev';       // rolling backup of the previous save
const LEGACY_KEY = 'beanBrewSaveV2_legacy';   // untouched copy of a pre-polish save
const SET_KEY = 'beanBrewSettingsV3';
const store = {
  ok: true, failed: false, mem: {},
  probe() {
    try { const k = '__bb_probe'; window.localStorage.setItem(k, '1'); const v = window.localStorage.getItem(k); window.localStorage.removeItem(k); this.ok = (v === '1'); }
    catch (e) { this.ok = false; }
    return this.ok;
  },
  get(k) {
    if (this.ok) { try { const v = window.localStorage.getItem(k); if (v !== null) return v; } catch (e) { this.ok = false; } }
    return Object.prototype.hasOwnProperty.call(this.mem, k) ? this.mem[k] : null;
  },
  set(k, v) {
    if (this.ok) { try { window.localStorage.setItem(k, v); this.failed = false; return true; } catch (e) { this.failed = true; } }
    this.mem[k] = v; return false;
  },
  remove(k) {
    if (this.ok) { try { window.localStorage.removeItem(k); } catch (e) { this.ok = false; } }
    delete this.mem[k];
  }
};

// ======================================================================
// SETTINGS
// ======================================================================
const DEFAULT_SETTINGS = { sound: true, volume: 0.6, lowfx: false, confirm: true, numbers: true, daynight: true, seenVer: '' };
let settings = Object.assign({}, DEFAULT_SETTINGS);
function loadSettings() {
  try { if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) settings.lowfx = true; } catch (e) { /* ignore */ }
  try {
    const raw = store.get(SET_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      for (const k in DEFAULT_SETTINGS) {
        if (typeof o[k] === typeof DEFAULT_SETTINGS[k]) settings[k] = o[k];
      }
      settings.volume = clamp(settings.volume, 0, 1);
    }
  } catch (e) { /* ignore */ }
}
function saveSettings() { store.set(SET_KEY, JSON.stringify(settings)); }

// ======================================================================
// AUDIO (WebAudio, created on the first click; silently does nothing if unavailable)
// ======================================================================
const Snd = {
  ctx: null, master: null, last: {},
  init() {
    try {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.apply();
    } catch (e) { this.ctx = null; }
  },
  apply() { if (this.master) this.master.gain.value = settings.sound ? settings.volume * 0.7 : 0; },
  tone(f, d, type, v, slide, delay) {
    const c = this.ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v || 0.3, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + d + 0.03);
  },
  play(n) {
    if (!settings.sound || !this.ctx) return;
    const now = performance.now();
    if (this.last[n] && now - this.last[n] < 70) return;
    this.last[n] = now;
    try {
      switch (n) {
        case 'click': this.tone(560, 0.05, 'square', 0.08); break;
        case 'build': this.tone(200, 0.1, 'triangle', 0.3, 90); this.tone(420, 0.05, 'square', 0.07, 0, 0.02); break;
        case 'erase': this.tone(320, 0.14, 'sawtooth', 0.12, 80); break;
        case 'coin': this.tone(988, 0.07, 'square', 0.1); this.tone(1319, 0.16, 'square', 0.1, 0, 0.07); break;
        case 'brew': this.tone(200, 0.2, 'sine', 0.25, 460); break;
        case 'ready': this.tone(1568, 0.22, 'sine', 0.12); this.tone(2093, 0.18, 'sine', 0.08, 0, 0.08); break;
        case 'error': this.tone(170, 0.16, 'sawtooth', 0.14, 110); break;
        case 'hire': [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.2, 0, i * 0.08)); break;
        case 'goal': [659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.2, 0, i * 0.09)); break;
        case 'rank': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.22, 0, i * 0.1)); break;
        case 'event': this.tone(440, 0.15, 'square', 0.1); this.tone(660, 0.25, 'square', 0.1, 0, 0.15); break;
        case 'angry': this.tone(330, 0.3, 'sawtooth', 0.1, 110); break;
        case 'upgrade': [392, 523, 784].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.2, 0, i * 0.07)); break;
      }
    } catch (e) { /* audio must never break the game */ }
  }
};

// ======================================================================
// GAME STATE
// ======================================================================
let state = null;
let cur = 0;                 // index of the shop on screen

function newStats() {
  return {
    earned: 0, served: 0, angry: 0, streak: 0, bestStreak: 0, lux: 0, critics: 0, events: 0,
    brews: 0, tips: 0, spent: 0, days: 0, playTicks: 0, dayEarned: 0, dayServed: 0, dayAngry: 0,
    favs: 0, specials: 0, rentPaid: 0, frEarned: 0, choices: 0, trained: 0,
    holServed: 0, holidays: 0, art: 0, artPerfect: 0, artBest: 0, artTips: 0, champs: 0
  };
}
function newLocation(themeIdx, cityId) {
  const grid = [];
  for (let y = 0; y < GRID_H; y++) grid.push(new Array(GRID_W).fill(TILE.EMPTY));
  const th = THEMES[themeIdx % THEMES.length] || THEMES[0];
  const inv = { beans: 10, beans_premium: 0, beans_luxury: 0, milk: 10, cups: 10, brewed: 0, brewed_premium: 0, brewed_luxury: 0 };
  PANTRY.forEach(k => { inv[k] = 0; });
  return {
    grid: grid, theme: { name: th.name, bg: th.bg },
    name: '', seed: Math.floor(Math.random() * 100000), city: (cityId && CITY_BY_ID[cityId]) ? cityId : 'home',
    inventory: inv, menu: [], hap: 0.8, art: [],
    restockerTargetBean: 'beans', brewPref: 'auto',
    staff: [], customers: [], activeBrews: {}, tickCount: 0,
    free: { door: 0, floor: 0, counter: 0, brewer: 0, parking: 0, plant: 0, table: 0 },
    rate: 0, served: 0, earned: 0
  };
}
function defaultState() {
  return {
    ver: SAVE_VER, globalMoney: 20, reputation: 100, unlockedLocations: 1,
    freeBuildingsUsed: { door: 0, floor: 0, counter: 0, brewer: 0, parking: 0 },
    locations: [newLocation(0)], stats: newStats(), upgrades: {}, goals: {}, tutorial: 0,
    tick: Math.floor(DAY_TICKS * 0.29), nextEvent: 0, recent: [], savedAt: Date.now(), created: Date.now(),
    event: null, pendingEv: null, rescue: 0,
    cities: { home: true }, recipes: {}, rhint: {}, rsold: {}, franchises: [],
    mode: 'career', career: newCareer(), champs: {}
  };
}
function newCareer() { return { ch: 0, ready: false, seen: -1, got: [] }; }
function locName(loc, i) { return loc.name ? loc.name : (i === 0 ? 'Shop 1' : 'Shop ' + (i + 1)); }

// Turns ANY save (old v2 format from earlier versions, new v3, imported) into a safe state object.
function normalizeState(o) {
  if (!o || typeof o !== 'object') throw new Error('not a save');
  if (!Array.isArray(o.locations) || o.locations.length === 0) throw new Error('no shops in save');
  const legacy = !o.ver;
  const s = defaultState();
  s._legacy = legacy;
  s.ver = SAVE_VER;
  s.globalMoney = Math.round(num(o.globalMoney, 20, 0, 1e13));
  s.reputation = Math.round(num(o.reputation, 100, 0, 500));
  const fbu = o.freeBuildingsUsed || {};
  s.locations = o.locations.slice(0, 24).map((l, i) => normLoc(l, i, legacy, fbu));
  s.unlockedLocations = s.locations.length;
  syncFreeCompat(s);
  // stats
  const st = newStats(), os = (o.stats && typeof o.stats === 'object') ? o.stats : {};
  for (const k in st) st[k] = Math.round(num(os[k], 0, 0, 1e13));
  s.stats = st;
  if (legacy || os.earned === undefined) {
    // old saves never tracked lifetime earnings; estimate so rank and goals feel fair
    let built = 0, staff = 0;
    const hasCoreEarly = s.locations[0].grid.some(r => r.includes(TILE.DOOR)) && s.locations[0].grid.some(r => r.includes(TILE.COUNTER));
    s.locations.forEach(l => { l.grid.forEach(r => r.forEach(v => { if (v) built++; })); staff += l.staff.length; });
    st.earned = Math.round(s.globalMoney + 1500 * (s.locations.length - 1) + staff * 220 + built * 30);
    st.served = hasCoreEarly ? Math.round(st.earned / 8) : 0;
  }
  s.upgrades = {};
  UPGRADES.forEach(u => { s.upgrades[u.id] = Math.round(num(o.upgrades && o.upgrades[u.id], 0, 0, u.max)); });
  s.goals = {};
  if (o.goals && typeof o.goals === 'object') for (const k in o.goals) if (o.goals[k]) s.goals[k] = true;
  s.tick = Math.floor(num(o.tick, DAY_TICKS * 0.29, 0, 1e10));
  s.savedAt = num(o.savedAt, 0, 0, 4e12);
  s.created = num(o.created, Date.now(), 0, 4e12);
  s.recent = Array.isArray(o.recent) ? o.recent.slice(-40).map(v => v ? 1 : 0) : [];
  s.nextEvent = s.tick + 400 + Math.floor(Math.random() * 400);
  s.event = null; s.pendingEv = null; s.rescue = 0;
  // v4 data (missing in older saves: everything starts fresh, nothing is lost)
  s.cities = { home: true };
  if (o.cities && typeof o.cities === 'object') for (const k in o.cities) if (o.cities[k] && CITY_BY_ID[k]) s.cities[k] = true;
  s.locations.forEach(l => { s.cities[l.city] = true; });
  s.recipes = {}; s.rhint = {}; s.rsold = {};
  if (o.recipes && typeof o.recipes === 'object') for (const k in o.recipes) if (o.recipes[k] && RECIPE_BY_ID[k]) s.recipes[k] = true;
  if (o.rhint && typeof o.rhint === 'object') for (const k in o.rhint) if (RECIPE_BY_ID[k]) s.rhint[k] = Math.round(num(o.rhint[k], 0, 0, RECIPE_BY_ID[k].ing.length));
  if (o.rsold && typeof o.rsold === 'object') for (const k in o.rsold) if (RECIPE_BY_ID[k]) s.rsold[k] = Math.round(num(o.rsold[k], 0, 0, 1e12));
  s.locations.forEach(l => { l.menu = l.menu.filter(id => s.recipes[id]); });
  s.franchises = (Array.isArray(o.franchises) ? o.franchises : []).slice(0, FR_CAP).map(normFr).filter(f => f);
  // v5 data: story mode (older saves start the story at chapter 1 and can claim what they already achieved), championships
  s.mode = o.mode === 'free' ? 'free' : 'career';
  const oc = (o.career && typeof o.career === 'object') ? o.career : {};
  s.career = { ch: Math.round(num(oc.ch, 0, 0, CAREER.length)), ready: false, seen: Math.round(num(oc.seen, -1, -1, CAREER.length)), got: Array.isArray(oc.got) ? oc.got.slice(0, 3).map(v => !!v) : [] };
  if ((o.ver || 0) < 5) s._upgraded = true;
  s.champs = {};
  if (o.champs && typeof o.champs === 'object') CHAMPS.forEach(c => { const v = o.champs[c.id]; if (v && typeof v === 'object') s.champs[c.id] = { won: !!v.won, best: Math.round(num(v.best, 0, 0, 999)), tries: Math.round(num(v.tries, 0, 0, 1e6)), day: Math.round(num(v.day, -1, -1, 1e9)) }; });
  // tutorial: skip it for anyone who already has a working shop
  const l0 = s.locations[0];
  const hasCore = l0.grid.some(r => r.includes(TILE.DOOR)) && l0.grid.some(r => r.includes(TILE.COUNTER)) && l0.grid.some(r => r.includes(TILE.BREWER));
  if (o.tutorial === undefined) s.tutorial = hasCore ? -1 : 0;
  else s.tutorial = Math.round(num(o.tutorial, 0, -1, 99));
  return s;
}
function syncFreeCompat(s) { s.freeBuildingsUsed = { door: 0, floor: 0, counter: 0, brewer: 0, parking: 0 }; for (const k in s.freeBuildingsUsed) s.freeBuildingsUsed[k] = s.locations[0].free[k]; }
function normLoc(l, i, legacy, fbu) {
  l = (l && typeof l === 'object') ? l : {};
  const loc = newLocation(i);
  // grid
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    const v = Math.floor(Number(l.grid && l.grid[y] && l.grid[y][x]));
    loc.grid[y][x] = (v >= 0 && v <= TILE_MAX) ? v : 0;
  }
  // theme
  let th = null;
  if (l.theme && typeof l.theme === 'object') th = THEMES.find(t => t.name === l.theme.name) || THEMES.find(t => t.bg === l.theme.bg);
  if (!th) th = THEMES[i % THEMES.length];
  loc.theme = { name: th.name, bg: th.bg };
  loc.name = typeof l.name === 'string' ? l.name.slice(0, 20) : '';
  loc.seed = Math.floor(num(l.seed, loc.seed, 0, 1e9));
  loc.city = (typeof l.city === 'string' && CITY_BY_ID[l.city]) ? l.city : 'home';     // older saves: every shop is in the hometown
  loc.menu = Array.isArray(l.menu) ? l.menu.filter((id, j, a) => typeof id === 'string' && RECIPE_BY_ID[id] && a.indexOf(id) === j).slice(0, 8) : [];
  loc.hap = num(l.hap, 0.8, 0, 1);
  loc.art = (Array.isArray(l.art) ? l.art : []).slice(0, ART_CAP_MAX).filter(a => a && typeof a === 'object').map(a => ({ q: num(a.q, 0.5, 0, 1), m: num(a.m, 1, 1, 3) }));
  const inv = l.inventory || {};
  for (const k in loc.inventory) loc.inventory[k] = Math.floor(num(inv[k], 0, 0, 1e9));
  if (BEANS.indexOf(l.restockerTargetBean) >= 0) loc.restockerTargetBean = l.restockerTargetBean;
  if (l.brewPref === 'auto' || BEANS.indexOf(l.brewPref) >= 0) loc.brewPref = l.brewPref;
  loc.tickCount = Math.floor(num(l.tickCount, 0, 0, 1e12));
  loc.rate = num(l.rate, 0, 0, 1e9);
  loc.served = Math.floor(num(l.served, 0, 0, 1e12));
  loc.earned = Math.floor(num(l.earned, 0, 0, 1e13));
  // free-building allowance used up
  if (l.free && typeof l.free === 'object') { for (const k in loc.free) loc.free[k] = Math.floor(num(l.free[k], 0, 0, 999)); }
  else if (legacy) {
    if (i === 0) { for (const k in loc.free) loc.free[k] = Math.floor(num(fbu[k], 0, 0, 999)); }
    else {
      // old extra shops never had a free starter kit; an untouched empty one gets it now, a built one does not
      const empty = loc.grid.every(r => r.every(v => v === 0));
      for (const k in loc.free) loc.free[k] = empty ? 0 : 999;
    }
  }
  // brews that were in progress
  const ab = (l.activeBrews && typeof l.activeBrews === 'object') ? l.activeBrews : (l.brewerCooldowns || {});
  for (const key in ab) {
    const m = /^(\d+),(\d+)$/.exec(key);
    if (!m) continue;
    const bx = +m[1], by = +m[2];
    if (bx >= GRID_W || by >= GRID_H || loc.grid[by][bx] !== TILE.BREWER) continue;
    let b = ab[key], ticks, type = 'beans', total = BREW_TICKS;
    if (typeof b === 'number') ticks = b;
    else if (b && typeof b === 'object') { ticks = b.ticks; if (BEANS.indexOf(b.type) >= 0) type = b.type; total = num(b.total, BREW_TICKS, 1, 999); }
    ticks = num(ticks, 0, 0, 999);
    if (ticks > 0) loc.activeBrews[key] = { ticks: Math.ceil(ticks), type: type, total: Math.max(total, Math.ceil(ticks)) };
  }
  // staff (keep identity + position, reset behaviour so nobody is stuck mid-action)
  const used = {};
  loc.staff = (Array.isArray(l.staff) ? l.staff : []).filter(a => a && ROLES[a.role]).slice(0, 40).map(a => {
    let id = (typeof a.id === 'string' && a.id) ? a.id : uid(a.role);
    while (used[id]) id = uid(a.role);
    used[id] = true;
    const st = newStaffObj(id, a.role, num(a.x, 7, 0, GRID_W - 1) | 0, num(a.y, 7, 0, GRID_H - 1) | 0, typeof a.name === 'string' ? a.name.slice(0, 14) : null);
    st.lv = Math.round(num(a.lv, 1, 1, STAFF_MAX_LV));
    st.xp = num(a.xp, 0, 0, 1e7);
    let spent = 0;
    for (const b in SKILLS) { st.sk[b] = Math.round(num(a.sk && a.sk[b], 0, 0, 5)); spent += st.sk[b]; }
    st.pts = Math.max(0, Math.min(Math.round(num(a.pts, 0, 0, 99)), st.lv - 1 - spent));
    st.train = Math.round(num(a.train, 0, 0, 9999));
    return st;
  }).filter(st => { const R = ROLES[st.role], n = used['#' + st.role] = (used['#' + st.role] || 0) + 1; return n <= R.max; });
  loc.customers = [];
  loc._d = true;
  return loc;
}
function newStaffObj(id, role, x, y, name) {
  return { id: id, role: role, name: name || pick(STAFF_NAMES), x: x, y: y, ox: x, oy: y, mt: 0, md: 1, cd: 0, path: [], act: 'idle', timer: 0, job: null, counter: null, status: '', idleCd: 0,
    lv: 1, xp: 0, pts: 0, sk: { spd: 0, qua: 0, cha: 0 }, train: 0 };
}
function normFr(f) {
  if (!f || typeof f !== 'object' || !CITY_BY_ID[f.city]) return null;
  return {
    id: (typeof f.id === 'string' && f.id) ? f.id.slice(0, 20) : uid('f'), city: f.city,
    name: typeof f.name === 'string' ? f.name.slice(0, 24) : CITY_BY_ID[f.city].short + ' Express',
    lv: Math.round(num(f.lv, 1, 1, FR_MAX_LV)), mgr: Math.round(num(f.mgr, 1, 1, FR_MGR_MAX)),
    mname: typeof f.mname === 'string' ? f.mname.slice(0, 14) : pick(STAFF_NAMES),
    paid: Math.round(num(f.paid, 0, 0, 1e12)), earned: Math.round(num(f.earned, 0, 0, 1e13)), acc: 0
  };
}
function buildSave() {
  const s = state;
  syncFreeCompat(s);
  return {
    ver: SAVE_VER, savedAt: Date.now(), created: s.created,
    globalMoney: Math.round(s.globalMoney), reputation: Math.round(s.reputation),
    unlockedLocations: s.locations.length, freeBuildingsUsed: s.freeBuildingsUsed,
    tick: s.tick, stats: s.stats, upgrades: s.upgrades, goals: s.goals, tutorial: s.tutorial, recent: s.recent,
    cities: s.cities, recipes: s.recipes, rhint: s.rhint, rsold: s.rsold,
    mode: s.mode, career: { ch: s.career.ch, seen: s.career.seen, got: s.career.got }, champs: s.champs,
    franchises: s.franchises.map(f => ({ id: f.id, city: f.city, name: f.name, lv: f.lv, mgr: f.mgr, mname: f.mname, paid: f.paid, earned: Math.floor(f.earned) })),
    locations: s.locations.map(l => ({
      grid: l.grid, theme: l.theme, name: l.name, seed: l.seed, inventory: l.inventory, city: l.city, menu: l.menu, hap: Math.round(l.hap * 1000) / 1000, art: l.art,
      restockerTargetBean: l.restockerTargetBean, brewPref: l.brewPref,
      staff: l.staff.map(a => ({ id: a.id, role: a.role, name: a.name, x: a.x, y: a.y, state: 'idle', path: [], lv: a.lv, xp: Math.floor(a.xp), pts: a.pts, sk: a.sk, train: a.train })),
      customers: [], activeBrews: l.activeBrews, tickCount: l.tickCount, free: l.free,
      rate: Math.round(l.rate * 10) / 10, served: l.served, earned: l.earned
    }))
  };
}

