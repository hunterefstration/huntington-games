// ----- save / load -----
let lastSaveAt = 0, lastPrevAt = 0, saveDirty = false;
function writeSave(reason) {
  if (!state) return false;
  let ok = false;
  try {
    const json = JSON.stringify(buildSave());
    const now = Date.now();
    if (now - lastPrevAt > 120000) {            // roll the previous save into the backup slot every 2 minutes
      const old = store.get(SAVE_KEY);
      if (old) store.set(PREV_KEY, old);
      lastPrevAt = now;
    }
    ok = store.set(SAVE_KEY, json);
    lastSaveAt = now; saveDirty = false;
  } catch (e) { ok = false; }
  return ok;
}
function readSaveText(raw) { return normalizeState(JSON.parse(raw)); }
function loadFromStorage() {
  const tries = [SAVE_KEY, PREV_KEY];
  for (let i = 0; i < tries.length; i++) {
    const raw = store.get(tries[i]);
    if (!raw) continue;
    try { return { state: readSaveText(raw), from: tries[i], raw: raw }; } catch (e) { /* try the next slot */ }
  }
  return null;
}


// ======================================================================
// SIMULATION
// ======================================================================
const rt = { inc: new Array(12).fill(0), incIdx: 0, startTick: 0, rank: 0, dirtyUI: true, toastQ: [] };
let paused = false, speed = 1, acc = 0;

function U(id) { return (state && state.upgrades && state.upgrades[id]) || 0; }
function curLoc() { return state.locations[cur]; }
function cityOf(loc) { return CITY_BY_ID[loc.city] || CITIES[0]; }
function themeIdx(name) { for (let i = 0; i < THEMES.length; i++) if (THEMES[i].name === name) return i; return 0; }
// Active event modifier for a shop (events can hit every shop or a single one, e.g. a power outage).
function evm(k, loc, def) {
  const ev = state.event;
  if (!ev || !ev.m || ev.m[k] === undefined) return def;
  if (ev.shop >= 0 && loc && state.locations[ev.shop] !== loc) return def;
  if (ev.shop >= 0 && !loc) return def;
  return ev.m[k];
}
// ----- calendar: seasons and holidays (all derived from the game clock) -----
function dayIdx(t) { return Math.floor((t === undefined ? state.tick : t) / DAY_TICKS); }
function seasonIdx(t) { return Math.floor(dayIdx(t) / SEASON_DAYS) % 4; }
function seasonDay(t) { return dayIdx(t) % SEASON_DAYS; }
function yearNum(t) { return Math.floor(dayIdx(t) / YEAR_DAYS) + 1; }
function curSeason() { return SEASONS[seasonIdx()]; }
function holidayOn(d) { return HOL_BY_DAY[d % YEAR_DAYS] || null; }
function curHoliday() { return state ? holidayOn(dayIdx()) : null; }
function hourNow() { return (state.tick % DAY_TICKS) / DAY_TICKS * 24; }
// crowd size from the season (per city) and today's holiday
function seasonSpawn(loc) {
  const si = seasonIdx(), h = holidayOn(dayIdx());
  let m = SEASONS[si].spawn * (loc ? (cityOf(loc).sea || SEA_ONE)[si] : 1);
  if (h) {
    m *= h.spawn * (1 + 0.08 * U('seasonal'));
    if (h.night && hourNow() >= 19) m *= h.night;
  }
  return m;
}
function seasonTip() { const h = curHoliday(); return curSeason().tip + (h ? h.tip : 0); }
function seasonPrice() { const h = curHoliday(); return h && h.price ? h.price : 1; }
function craving() { const h = curHoliday(); return h && h.likes ? h : curSeason(); }   // {likes, crave}
function inSeason(r) { return r.season === undefined || r.season === seasonIdx(); }
function seasonBonus(r) { return r.season === undefined || r.season !== seasonIdx() ? 1 : 1.25 + 0.1 * U('seasonal'); }
function ambOf(v) { return TILE_AMB[v] + (TILE_SEASON[v] >= 0 && TILE_SEASON[v] === seasonIdx() ? SEASON_AMB : 0); }
function seasonalKnown() { let n = 0; RECIPES.forEach(r => { if (r.season !== undefined && state.recipes[r.id]) n++; }); return n; }
function classicKnown() { let n = 0; RECIPES.forEach(r => { if (r.season === undefined && !r.city && state.recipes[r.id]) n++; }); return n; }
function localKnown() { let n = 0; RECIPES.forEach(r => { if (r.city && state.recipes[r.id]) n++; }); return n; }
// sold here: in season, and (for a local special) in a shop in its own city
function sellsHere(r, loc) { return inSeason(r) && (!r.city || (loc || curLoc()).city === r.city); }
// ----- staff skills -----
function sk(s, b) { return (s && s.sk && s.sk[b]) || 0; }
function bestSkill(loc, role, b) {
  let m = 0;
  for (let i = 0; i < loc.staff.length; i++) { const s = loc.staff[i]; if (s.role === role && !s.train && s.sk[b] > m) m = s.sk[b]; }
  return m;
}
function roleOnDuty(loc, role) {
  for (let i = 0; i < loc.staff.length; i++) { const s = loc.staff[i]; if (s.role === role && !s.train) return s; }
  return null;
}
function xpNeed(lv) { return Math.round(25 * Math.pow(lv, 1.55)); }
function trainCost(s) { return Math.round(80 * Math.pow(s.lv, 1.6) * (1 - 0.08 * U('academy')) / 5) * 5; }
function trainTicks(loc, s) { return Math.round((100 + 20 * s.lv) * (bestSkill(loc, 'manager', 'spd') >= 5 ? 0.5 : 1)); }
function gainXP(loc, s, n) {
  if (s.lv >= STAFF_MAX_LV || s.train) return;
  s.xp += n * (1 + 0.1 * bestSkill(loc, 'manager', 'spd')) * (1 + 0.1 * U('academy'));
  while (s.lv < STAFF_MAX_LV && s.xp >= xpNeed(s.lv)) { s.xp -= xpNeed(s.lv); levelUp(loc, s); }
  if (s.lv >= STAFF_MAX_LV) s.xp = 0;
}
function levelUp(loc, s) {
  s.lv++; s.pts++;
  log(s.name + ' the ' + ROLES[s.role].name + ' reached level ' + s.lv + '! (+1 skill point)', 'good');
  if (loc === state.locations[cur]) { fxText(s.x * TS + 16, s.y * TS - 12, 'Level ' + s.lv + '!', '#fde047', 13); Snd.play('upgrade'); }
  rt.dirtyUI = true;
}
// ----- shop rating (1-5 stars): decorations, barista quality, stocked specials, happy customers -----
function computeRating(loc) {
  const cc = C(loc);
  let stocked = 0;
  for (let i = 0; i < loc.menu.length; i++) { const r = RECIPE_BY_ID[loc.menu[i]]; if (r && inSeason(r) && canMake(loc, r)) stocked++; }
  const p = loc._rp || (loc._rp = [0, 0, 0, 0]);
  p[0] = Math.min(1.5, cc.amb * 0.025 + cc.decoTypes * 0.06);
  p[1] = Math.min(1, bestSkill(loc, 'barista', 'qua') * 0.2);
  p[2] = Math.min(0.5, stocked * 0.125);
  p[3] = clamp(loc.hap, 0, 1) * 1.5;
  loc._rt = Math.round((0.5 + p[0] + p[1] + p[2] + p[3]) * 10) / 10;
  return loc._rt;
}
function rating(loc) { return loc._rt === undefined ? computeRating(loc) : loc._rt; }
function priceMult(loc) { return cityOf(loc).price * (0.9 + 0.05 * rating(loc)) * (1 + 0.04 * bestSkill(loc, 'barista', 'qua')) * evm('price', loc, 1) * seasonPrice(); }
function markDirty(loc) { loc._d = true; if (loc === state.locations[cur]) gfx.staticDirty = true; rt.dirtyUI = true; }
function walkable(g, x, y) {
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return false;
  const v = g[y][x];
  return v === TILE.FLOOR || v === TILE.DOOR || v === TILE.RUG;
}
function C(loc) { if (!loc._c || loc._d) { computeCache(loc); loc._d = false; } return loc._c; }
function computeCache(loc) {
  const g = loc.grid;
  const c = { doors: [], counters: [], brewers: [], lamps: [], lights: [], parking: 0, plants: 0, tables: 0, floors: 0, decor: 0, decoTypes: 0, reach: {}, stand: {}, reachCount: 0, amb: 0 };
  const seenT = new Uint8Array(TILE_MAX + 1);
  let amb = 0;
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    const v = g[y][x];
    if (TILE_AMB[v]) {
      amb += ambOf(v); c.decor++;
      if (!seenT[v]) { seenT[v] = 1; c.decoTypes++; }
      if (v === TILE.LAMP) c.lamps.push({ x: x, y: y });
    }
    if (v === TILE.DOOR) c.doors.push({ x: x, y: y, key: x + ',' + y });
    else if (v === TILE.COUNTER) c.counters.push({ x: x, y: y, key: x + ',' + y });
    else if (v === TILE.BREWER) c.brewers.push({ x: x, y: y, key: x + ',' + y });
    else if (v === TILE.PARKING) c.parking++;
    else if (v === TILE.PLANT) c.plants++;
    else if (v === TILE.TABLE) c.tables++;
    else if (v === TILE.FLOOR) c.floors++;
  }
  const seen = new Uint8Array(GRID_W * GRID_H), q = [];
  c.doors.forEach(d => { seen[d.y * GRID_W + d.x] = 1; q.push(d.y * GRID_W + d.x); });
  const dx = [0, 0, -1, 1], dy = [-1, 1, 0, 0];
  for (let qi = 0; qi < q.length; qi++) {
    const cx = q[qi] % GRID_W, cy = (q[qi] / GRID_W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx[d], ny = cy + dy[d];
      if (!walkable(g, nx, ny)) continue;
      const ni = ny * GRID_W + nx;
      if (seen[ni]) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  c.stands = {};
  c.counters.forEach(k => {
    const list = [];
    for (let d = 0; d < 4; d++) {
      const nx = k.x + dx[d], ny = k.y + dy[d];
      if (!walkable(g, nx, ny) || !seen[ny * GRID_W + nx]) continue;
      list.push({ x: nx, y: ny });
    }
    list.sort((a, b) => (g[b.y][b.x] === TILE.FLOOR ? 1 : 0) - (g[a.y][a.x] === TILE.FLOOR ? 1 : 0));
    if (list.length) { c.reach[k.key] = true; c.stand[k.key] = list[0]; c.stands[k.key] = list; c.reachCount++; }
  });
  c.amb = Math.min(AMB_CAP, amb);
  c.lights = c.lamps.concat(c.doors, c.counters).slice(0, 16);     // night lighting, precomputed so frames do not allocate
  loc._c = c;
  loc._rt = undefined;
}
function bfs(g, sx, sy, isGoal, canEnter) {
  const W = GRID_W, prev = new Int16Array(W * GRID_H).fill(-2), q = [sy * W + sx];
  prev[q[0]] = -1;
  const dx = [0, 0, -1, 1], dy = [-1, 1, 0, 0];
  for (let qi = 0; qi < q.length; qi++) {
    const cu = q[qi], cx = cu % W, cy = (cu / W) | 0;
    if (isGoal(cx, cy)) {
      const path = []; let n = cu;
      while (prev[n] !== -1) { path.push({ x: n % W, y: (n / W) | 0 }); n = prev[n]; }
      path.reverse(); return path;
    }
    for (let d = 0; d < 4; d++) {
      const nx = cx + dx[d], ny = cy + dy[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= GRID_H) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -2) continue;
      if (!canEnter(nx, ny)) continue;
      prev[ni] = cu; q.push(ni);
    }
  }
  return null;
}
// Moves an entity one tile along its path. 'every' = ticks per tile.
function stepEntity(e, every, canEnter) {
  if (e.cd > 0) { e.cd--; return 'wait'; }
  if (!e.path || e.path.length === 0) return 'done';
  const n = e.path[0];
  if (!canEnter(n.x, n.y)) return 'blocked';
  e.path.shift();
  e.ox = e.x; e.oy = e.y; e.x = n.x; e.y = n.y;
  e.mt = state.tick; e.md = every; e.cd = every - 1;
  return 'moved';
}

// ----- economy helpers -----
function supplyPrice(type, loc) {
  return Math.max(1, Math.round(SUPPLY[type].price * evm('supply', null, 1) * (loc ? cityOf(loc).supply : 1)));
}
function packSize(type) { return (type && SUPPLY[type] && SUPPLY[type].pantry) ? 10 + 2 * U('bulk') : 20 + 5 * U('bulk'); }
function brewTicks() { return Math.max(4, Math.round(BREW_TICKS * Math.pow(0.9, U('grinder')))); }
function rankIdx(earned) {
  if (earned === undefined) earned = state.stats.earned;
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (earned >= RANKS[i].at) r = i;
  return r;
}
function unlocked(what, loc) {
  const r = rankIdx(), S = SUPPLY[what];
  if (S && S.city && cityOf(loc || curLoc()).id !== S.city) return false;          // local ingredient: only sold in its city
  if (what === 'beans_luxury' || what === 'table') return r >= 1;
  if (S && S.rank && r < S.rank) return false;
  if (S && S.season !== undefined && S.season !== seasonIdx()) return false;     // seasonal ingredient: only sold in its season
  return true;
}
function lockWhy(what) {
  const S = SUPPLY[what];
  if (S && S.city && cityOf(curLoc()).id !== S.city) return S.name + ' is only sold in ' + CITY_BY_ID[S.city].name + '.';
  if (S && S.season !== undefined && S.season !== seasonIdx()) return S.name + ' is only sold in ' + SEASONS[S.season].name + '.';
  return (S ? S.name : 'That') + ' unlocks at rank: ' + RANKS[what === 'beans_luxury' ? 1 : ((S && S.rank) || 1)].n + '.';
}
function maxShopsAllowed() { return Math.min(MAX_SHOPS, rankIdx() + 2); }
function shopCost(n) { return Math.round(BASE_PRICES.newLocation * Math.pow(2, n - 1) / 50) * 50; }
function getStaffCost(loc, role) {
  const count = loc.staff.filter(s => s.role === role).length;
  return Math.floor(BASE_PRICES.staffBase[role] * Math.pow(1.5, count));
}
function upgradeCost(u) { return Math.round(u.base * Math.pow(u.mult, U(u.id)) / 5) * 5; }
function toolCost(loc, tool) {
  if (tool === 'erase' || tool === 'cursor') return 0;
  const allow = FREE_ALLOW[tool] || 0;
  if ((loc.free[tool] || 0) < allow) return 0;
  return BASE_PRICES[tool] || 0;
}
function earn(loc, amount) {
  state.globalMoney += amount;
  const st = state.stats;
  st.earned += amount; st.dayEarned += amount;
  if (loc) { loc.earned += amount; loc.earnAcc = (loc.earnAcc || 0) + amount; }
  rt.inc[rt.incIdx] += amount;
  const r = rankIdx();
  if (r > rt.rank) { rt.rank = r; onRankUp(r); }
}
function incomePerMin() {
  let sum = 0; for (let i = 0; i < 12; i++) sum += rt.inc[i];
  const elapsed = clamp((state.tick - rt.startTick) / 5, 5, 60);
  return sum * 60 / elapsed;
}
function stockTotal(loc) { return loc.inventory.brewed + loc.inventory.brewed_premium + loc.inventory.brewed_luxury; }
function brewingCount(loc) { let n = 0; for (const k in loc.activeBrews) n++; return n; }

// ----- brewing -----
function pickBean(loc) {
  const inv = loc.inventory;
  if (inv.milk < 1 || inv.cups < 1) return null;
  const pref = loc.brewPref || 'auto';
  if (pref !== 'auto') return inv[pref] > 0 ? pref : null;
  const want = [0, 0, 0], prog = [0, 0, 0];
  loc.customers.forEach(c => {
    if (c.state !== 'walking' && c.state !== 'waiting') return;
    if (c.want && RECIPE_BY_ID[c.want].base < 0 && canMake(loc, RECIPE_BY_ID[c.want])) return;     // a pastry/tea order needs no coffee
    want[c.tier]++;
  });
  for (const k in loc.activeBrews) prog[Math.max(0, BEANS.indexOf(loc.activeBrews[k].type))]++;
  let best = -1, bs = 0;
  for (let t = 2; t >= 0; t--) {
    const sc = want[t] - inv[COFFEE[t]] - prog[t];
    if (sc > bs && inv[BEANS[t]] > 0) { bs = sc; best = t; }
  }
  if (best >= 0) return BEANS[best];
  if (inv[loc.restockerTargetBean] > 0) return loc.restockerTargetBean;
  for (let t = 0; t < 3; t++) if (inv[BEANS[t]] > 0) return BEANS[t];
  return null;
}
function startBrew(loc, x, y, s) {
  const key = x + ',' + y;
  if (loc.grid[y][x] !== TILE.BREWER) return 'nobrewer';
  if (loc.activeBrews[key]) return 'busy';
  if (evm('power', loc, 1) <= 0) return 'nopower';
  const inv = loc.inventory;
  if (inv.milk < 1) return 'nomilk';
  if (inv.cups < 1) return 'nocups';
  const bean = pickBean(loc);
  if (!bean) return (loc.brewPref && loc.brewPref !== 'auto') ? 'nopref' : 'nobeans';
  inv[bean]--; inv.milk--; inv.cups--;
  let t = brewTicks() * evm('brew', loc, 1) * (1 - 0.07 * sk(s, 'spd'));
  t = Math.max(3, Math.round(t));
  const b = { ticks: t, type: bean, total: t };
  if (sk(s, 'spd') >= 5 && Math.random() < 0.2) b.x2 = 1;          // Double Shot perk
  if (sk(s, 'qua') >= 5 && Math.random() < 0.25) b.art = 1;         // Latte Art perk: some brews come with free latte art
  loc.activeBrews[key] = b;
  state.stats.brews++;
  return 'ok';
}
