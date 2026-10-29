
'use strict';
// =====================================================================
//  UTILITIES
// =====================================================================
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function dateKey(d) { d = d || new Date(); const m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function fmt(n) { n = Math.floor(n); if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k'; return String(n); }
function money$(n) { return '$' + Math.floor(n).toLocaleString(); }
const escHTML = (v) => String(v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
// Storage can throw inside sandboxed pages (jsbin, iframes): never let it crash the game
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const KEYS = { settings: 'td2_settings', save: 'td2_save', saveBackup: 'td2_save_backup', stars: 'td2_stars', ach: 'td2_ach', records: 'td2_records', menu: 'td2_menu', slotActive: 'td2_slot_active', slotsMigrated: 'td2_slots_migrated',
  mapBest: 'td2_mapbest', bosses: 'td2_bosses', daily: 'td2_daily', dailyRun: 'td2_daily_run',
  custom: 'td2_custom', editor: 'td2_editor' };       // 3.0: saved custom maps (share codes) and the Map Editor's unsaved draft
// 2.5: three save slots, stored as td2_slot1..3 (backup copy of each: td2_slot1_bak..3_bak). td2_save / td2_save_backup are the pre-2.5 single save: read once for migration and never deleted.
const SLOT_COUNT = 3;
const slotKey = (n) => 'td2_slot' + n;
const slotBakKey = (n) => 'td2_slot' + n + '_bak';
let activeSlot = 0;       // the slot the running game autosaves to (0 = none)
let migrationNote = '';
// ---- defensive helpers: nothing read from storage is trusted ----
const own = (o, k) => o != null && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const isNum = (v) => typeof v === 'number' && isFinite(v);
const numOr = (v, d, lo, hi) => { if (typeof v === 'string' && v.trim() !== '') v = +v; return isNum(v) ? clamp(v, lo, hi) : d; };
const isPlainObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const specOf = (def, n) => (def && def.specs && n > 0 && def.specs[n - 1]) || null;
function warnTD(msg) { try { console.warn('[TD] ' + msg); } catch (e) {} }
function getStars() { const o = store.get(KEYS.stars, {}), out = {}; if (isPlainObj(o)) for (const k of Object.keys(o)) { const v = o[k]; if (/^\d+$/.test(k) && isNum(v) && v >= 1 && v <= 3) out[k] = Math.round(v); } return out; }
function getAch() { const o = store.get(KEYS.ach, {}), out = {}; if (isPlainObj(o)) for (const k of Object.keys(o)) { if (ACHIEVEMENTS.some(a => a.id === k) && isNum(o[k])) out[k] = o[k]; } return out; }
// best wave reached on each map (any mode but Sandbox and the Daily Challenge), and how often each boss was defeated
function getNumMap(key, maxKey) { const o = store.get(key, {}), out = {}; if (isPlainObj(o)) for (const k of Object.keys(o)) { if ((maxKey ? maxKey(k) : true) && isNum(o[k]) && o[k] > 0) out[k] = Math.floor(Math.min(o[k], 1e9)); } return out; }
const getMapBest = () => getNumMap(KEYS.mapBest, (k) => /^\d+$/.test(k));
const getBossKills = () => getNumMap(KEYS.bosses, (k) => own(ENEMY, k) && !!ENEMY[k].boss);
function recordBoss(id) {
  if (!G || G.opts.mode === 'sandbox' || isCustomGame()) return;
  const o = getBossKills(); o[id] = (o[id] || 0) + 1; store.set(KEYS.bosses, o);
  if (BOSS_ROTATION.every(b => o[b] > 0)) unlock('bosshunter');
}
function getRecords() { const o = store.get(KEYS.records, {}), out = { best: 0, bestEndless: 0, games: 0, kills: 0, bestTower: 0, bestTroop: 0, bestEndlessTower: 0, bestEndlessTroop: 0 }; if (isPlainObj(o)) for (const k of Object.keys(out)) out[k] = numOr(o[k], 0, 0, 1e12); return out; }

// =====================================================================
//  SETTINGS
// =====================================================================
const QUALITY = {
  low:    { particles: 0, maxParticles: 120, glow: false, trails: false, scenery: true, shake: false, pathAnim: false, res: 0.75 },
  medium: { particles: 1, maxParticles: 350, glow: false, trails: true, scenery: true, shake: true, pathAnim: true, res: 1 },
  high:   { particles: 2, maxParticles: 900, glow: true, trails: true, scenery: true, shake: true, pathAnim: true, res: 1 }
};
const DEFAULT_SETTINGS = {
  quality: 'auto',            // auto | low | medium | high | custom
  particles: 1,               // 0 off, 1 low, 2 normal, 3 high
  damageNumbers: true, glow: false, trails: true, shake: true, pathAnim: true, scenery: true,
  healthBars: 'damaged',      // always | damaged | off
  res: 1, fpsCap: 0, showFps: false, reducedMotion: false,
  volume: 0.5, sfx: true,
  variance: true,             // tower damage rolls +-10%
  enemyVariety: true,         // random enemy stat jitter + affixes
  confirmSell: true, autoPauseHidden: true, showTips: true, autoWaveDefault: false,
  hoverRange: true
};
function cleanSettings(raw) {
  const out = Object.assign({}, DEFAULT_SETTINGS);
  if (!isPlainObj(raw)) return out;
  for (const k of Object.keys(DEFAULT_SETTINGS)) {
    if (!own(raw, k)) continue;
    const d = DEFAULT_SETTINGS[k], v = raw[k];
    if (typeof d === 'boolean') { if (typeof v === 'boolean') out[k] = v; }
    else if (typeof d === 'number') { if (isNum(v)) out[k] = v; }
    else if (typeof d === 'string') { if (typeof v === 'string') out[k] = v; }
  }
  if (!['auto', 'low', 'medium', 'high', 'custom'].includes(out.quality)) out.quality = 'auto';
  out.particles = clamp(Math.round(out.particles), 0, 3);
  if (![0.5, 0.75, 1].includes(out.res)) out.res = 1;
  if (![0, 30, 60].includes(out.fpsCap)) out.fpsCap = 0;
  if (!['always', 'damaged', 'off'].includes(out.healthBars)) out.healthBars = 'damaged';
  out.volume = clamp(out.volume, 0, 1);
  return out;
}
let S = cleanSettings(store.get(KEYS.settings, {}));
function saveSettings() { store.set(KEYS.settings, S); }
function applyQualityPreset(q) {
  S.quality = q;
  if (q === 'low' || q === 'medium' || q === 'high') {
    const p = QUALITY[q];
    S.particles = q === 'low' ? 0 : q === 'medium' ? 1 : 2; S.glow = p.glow; S.trails = p.trails; S.shake = p.shake; S.pathAnim = p.pathAnim; S.res = p.res;
  }
  if (q === 'auto') { S.particles = 1; S.glow = false; S.trails = true; S.shake = true; S.pathAnim = true; S.res = 1; autoQ.level = 1; }
  saveSettings(); resize(); markBgDirty();
}
const particleCap = () => [0, 150, 450, 1100][S.particles] || 0;
// AUTO quality: drops particles / glow / resolution if the frame rate sags, raises them back slowly
const autoQ = { level: 1, low: 0, good: 0 };
function autoQualityTick(fps) {
  if (S.quality !== 'auto') return;
  if (fps < 45) { autoQ.good = 0; if (++autoQ.low >= 2 && autoQ.level > 0) { autoQ.level--; autoQ.low = 0; applyAutoLevel(); } }
  else if (fps > 57) { autoQ.low = 0; if (++autoQ.good >= 10 && autoQ.level < 2) { autoQ.level++; autoQ.good = 0; applyAutoLevel(); } }
  else { autoQ.low = 0; autoQ.good = 0; }
}
function applyAutoLevel() {
  const l = autoQ.level;
  S.particles = l; S.trails = l >= 1; S.pathAnim = l >= 1; S.res = l === 0 ? 0.75 : 1; S.glow = l >= 2;
  resize();
}

// =====================================================================
//  AUDIO (tiny synth, rate limited so big fights don't distort)
// =====================================================================
let actx = null; const sndLast = {};
function initAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } } if (actx && actx.state === 'suspended') actx.resume(); }
const SOUNDS = {
  shoot: [0.035, 'square', 420, 120, 0.07], zap: [0.04, 'sawtooth', 900, 300, 0.05], snipe: [0.07, 'square', 900, 80, 0.12],
  boom: [0.12, 'triangle', 110, 25, 0.35], hit: [0.03, 'sawtooth', 220, 60, 0.05], income: [0.1, 'sine', 620, 880, 0.25],
  build: [0.08, 'triangle', 300, 600, 0.12], sell: [0.08, 'sine', 700, 350, 0.15], upgrade: [0.1, 'sine', 400, 900, 0.2],
  leak: [0.12, 'sawtooth', 200, 60, 0.4], deny: [0.06, 'square', 160, 120, 0.12], wave: [0.1, 'triangle', 300, 700, 0.4],
  rail: [0.14, 'sawtooth', 1400, 60, 0.5], nuke: [0.2, 'triangle', 80, 15, 1.2], click: [0.04, 'sine', 600, 600, 0.04]
};
function sfx(name) {
  if (!actx || !S.sfx || S.volume <= 0) return;
  const now = actx.currentTime;
  if (sndLast[name] && now - sndLast[name] < 0.045) return; sndLast[name] = now;
  const s = SOUNDS[name]; if (!s) return;
  try {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = s[1]; o.frequency.setValueAtTime(s[2], now); o.frequency.exponentialRampToValueAtTime(Math.max(1, s[3]), now + s[4]);
    g.gain.setValueAtTime(s[0] * S.volume, now); g.gain.exponentialRampToValueAtTime(0.0001, now + s[4]);
    o.connect(g); g.connect(actx.destination); o.start(now); o.stop(now + s[4] + 0.02);
  } catch (e) {}
}

// =====================================================================
//  GAME STATE
// =====================================================================
let G = null;            // current game (null on the menu)
let paused = false;
function newGameState(opts) {
  const d = DIFFICULTIES[opts.diff];
  const gm = own(GAME_MODES, opts.gm) ? opts.gm : 'legacy';
  const daily = opts.mode === 'daily' && opts.daily ? opts.daily : null, mods = {};
  if (daily) for (const id of daily.mods) mods[id] = true;
  const cm = typeof opts.custom === 'string' ? mapOf(opts) : null;       // 3.0: a custom map can set its own starting money and base health
  const lives = Math.round((cm && cm.lives ? cm.lives : d.lives) * (mods.lives2 ? 1.5 : 1) * (mods.glass ? 0.5 : 1));
  return {
    opts, gm, rewardMul: (gm === 'troop' ? TM.reward : 1) * (mods.cash2 ? 2 : 1), diff: d, map: null, paths: [], obstacles: [], water: [], bridges: [],
    mods, bossShift: daily ? daily.shift : opts.mode === 'campaign' ? (cm ? hashStr(opts.custom) : opts.map) % BOSS_ROTATION.length : 0,
    money: opts.mode === 'sandbox' ? 1e9 : (cm && cm.money ? cm.money : d.money) + (gm === 'troop' ? TM.start : 0) + (mods.rich ? 1000 : 0), lives, maxLives: lives,
    wave: 1, waveActive: false, waveLabel: 'READY', spawnQ: [], spawnT: 0, nextWave: null,
    enemies: [], towers: [], troops: [], walls: [], projectiles: [], beams: [], lines: [], patches: [], strikes: [], texts: [], mercCd: {}, squads: [], placeMerc: null, hinted: {},
    holes: [], hero: null, heroId: null, heroAura: 0, placeHero: null,
    speed: 1, auto: S.autoWaveDefault, countdown: 0, tick: 0,
    abilities: Object.fromEntries(ABILITIES.map(a => [a.id, 0])), armed: null,
    sel: { towers: new Set(), troops: new Set() }, place: null, moveMode: null, aim: null,
    showRanges: false, shake: 0, stats: { kills: 0, damage: 0, leaked: 0, built: 0, spent: 0, earned: 0, lost: 0, bosses: 0 },
    over: false, won: false, endlessContinued: false, seed: daily ? daily.seed : opts.seed || ((Math.random() * 1e9) | 0)
  };
}

// =====================================================================
//  MAP
// =====================================================================
function buildPath(pts) {
  const p = pts.map(([x, y]) => ({ x, y }));
  const segs = []; let total = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1], len = dist(a.x, a.y, b.x, b.y);
    segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len, dx: (b.x - a.x) / (len || 1), dy: (b.y - a.y) / (len || 1), start: total });
    total += len;
  }
  return { pts: p, segs, len: total, air: { ax: p[0].x, ay: p[0].y, len: dist(p[0].x, p[0].y, p[p.length - 1].x, p[p.length - 1].y) } };
}
function pathPos(path, d, out) {
  const segs = path.segs; d = clamp(d, 0, path.len);
  let lo = 0, hi = segs.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (segs[mid].start <= d) lo = mid; else hi = mid - 1; }
  const s = segs[lo], t = d - s.start;
  out.x = s.ax + s.dx * t; out.y = s.ay + s.dy * t; out.dx = s.dx; out.dy = s.dy;
  return out;
}
// m (optional): a map object to use instead of the one in G.opts (the Map Editor preview passes its own board object as G)
function setupMap(G, m) {
  m = m || mapOf(G.opts) || MAPS[0];
  let v = G.opts.variant;
  const rng = mulberry32(G.seed);
  if (v === 'random') v = ['normal', 'mirror', 'flip', 'both'][(rng() * 4) | 0];
  G.variantUsed = v;
  const tx = (x) => (v === 'mirror' || v === 'both') ? 1 - x : x, ty = (y) => (v === 'flip' || v === 'both') ? 1 - y : y;
  G.map = m; G.theme = THEMES[m.theme];
  G.paths = m.paths.map(pts => buildPath(pts.map(([x, y]) => [tx(x) * W, ty(y) * H])));
  G.base = { x: G.paths[0].pts[G.paths[0].pts.length - 1].x, y: G.paths[0].pts[G.paths[0].pts.length - 1].y };
  // terrain (2.6): rivers, lakes, lava, ice, mud and craters, flipped with the map
  G.water = terrainList(m, tx, ty);
  terrainZones(G);
  // scenery: decorative rocks / trees that block building (different every seed)
  G.obstacles = [];
  // 3.0: scenery placed by hand in the Map Editor (never on a road or the base)
  if (m.deco) for (const o of m.deco) { const x = tx(o.x) * W, y = ty(o.y) * H; if (distToPaths(G, x, y) < 26 || dist(x, y, G.base.x, G.base.y) < 40) continue; G.obstacles.push({ x, y, r: 15, kind: o.k, s: o.s, fixed: true }); }
  const n = m.custom ? [0, 8 + ((rng() * 6) | 0), 26 + ((rng() * 14) | 0)][m.scenery] || 0 : 26 + ((rng() * 14) | 0);
  for (let i = 0, tries = 0; i < n && tries < 600; tries++) {
    const x = 20 + rng() * (W - 40), y = 20 + rng() * (H - 40), r = 9 + rng() * 9;
    if (distToPaths(G, x, y) < 40 + r || dist(x, y, G.base.x, G.base.y) < 70 || waterAt(G, x, y, r + 6)) continue;
    if (G.obstacles.some(o => dist(o.x, o.y, x, y) < o.r + r + 26)) continue;
    G.obstacles.push({ x, y, r, kind: G.theme.deco[(rng() * G.theme.deco.length) | 0], s: rng() });
    i++;
  }
  // ground texture blotches (purely visual)
  G.blotches = [];
  for (let i = 0; i < 70; i++) G.blotches.push({ x: rng() * W, y: rng() * H, r: 18 + rng() * 60, a: 0.05 + rng() * 0.08 });
  markBgDirty();
}
// ---- terrain features ----
// a map's terrain (MAPS[].water) in board coordinates, flipped with the map (tx / ty map 0..1 to 0..1)
function terrainList(m, tx, ty) {
  return (m.water || []).map(f => {
    const t = own(TERRAIN, f.t) ? f.t : 'water';
    if (f.grid) {            // 3.0: painted tiles from the Map Editor
      const cells = new Uint8Array(GW * GH), fx = tx(0) !== 0, fy = ty(0) !== 0;
      for (const c of f.grid) { const col = c % GW, row = (c / GW) | 0; cells[(fy ? GH - 1 - row : row) * GW + (fx ? GW - 1 - col : col)] = 1; }
      return { t, kind: 'grid', cells };
    }
    if (f.river) return { t, kind: 'river', w: f.w || 40, pts: f.river.map(([x, y]) => ({ x: tx(x) * W, y: ty(y) * H })) };
    if (f.poly) return { t, kind: 'poly', pts: f.poly.map(([x, y]) => ({ x: tx(x) * W, y: ty(y) * H })) };
    return { t, kind: 'lake', x: tx(f.lake[0]) * W, y: ty(f.lake[1]) * H, rx: f.lake[2], ry: f.lake[3] };
  });
}
function segDistXY(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - ax - dx * t, py - ay - dy * t); }
function inTerrain(f, x, y, pad) {
  if (f.kind === 'grid') {         // any painted tile within pad of the point
    const c0 = clamp(Math.floor((x - pad) / GRID), 0, GW - 1), c1 = clamp(Math.floor((x + pad) / GRID), 0, GW - 1), r0 = clamp(Math.floor((y - pad) / GRID), 0, GH - 1), r1 = clamp(Math.floor((y + pad) / GRID), 0, GH - 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (f.cells[r * GW + c]) {
      const dx = Math.max(c * GRID - x, 0, x - (c + 1) * GRID), dy = Math.max(r * GRID - y, 0, y - (r + 1) * GRID);
      if (dx * dx + dy * dy <= pad * pad) return true;
    }
    return false;
  }
  if (f.kind === 'lake') { const a = (x - f.x) / (f.rx + pad), b = (y - f.y) / (f.ry + pad); return a * a + b * b <= 1; }
  if (f.kind === 'river') { for (let i = 0; i < f.pts.length - 1; i++) if (segDistXY(x, y, f.pts[i].x, f.pts[i].y, f.pts[i + 1].x, f.pts[i + 1].y) < f.w / 2 + pad) return true; return false; }
  let inside = false; const P = f.pts;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i].y > y) !== (P[j].y > y) && x < (P[j].x - P[i].x) * (y - P[i].y) / (P[j].y - P[i].y) + P[i].x) inside = !inside;
  if (inside || pad <= 0) return inside;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (segDistXY(x, y, P[j].x, P[j].y, P[i].x, P[i].y) < pad) return true;
  return false;
}
function waterAt(G, x, y, pad) { if (G.water) for (const f of G.water) if (inTerrain(f, x, y, pad || 0)) return f; return null; }
// walks every road once: ice / mud stretches become speed zones, water / lava crossings become bridges
function terrainZones(G) {
  G.bridges = [];
  for (const p of G.paths) {
    p.zones = null; if (!G.water.length) continue;
    let cur = null, br = null; const zones = [];
    for (let d = 0; d <= p.len; d += 6) {
      pathPos(p, d, _p); const f = waterAt(G, _p.x, _p.y, 0), T = f ? TERRAIN[f.t] : null;
      const mul = T && T.mul ? T.mul : 0;
      if (mul && (!cur || cur.mul !== mul)) { cur = { a: d, b: d + 6, mul }; zones.push(cur); } else if (mul) cur.b = d + 6; else cur = null;
      const bridge = f && (f.t === 'water' || f.t === 'lava');
      if (bridge) { if (!br) { br = { x1: _p.x, y1: _p.y, x2: _p.x, y2: _p.y, dx: _p.dx, dy: _p.dy }; G.bridges.push(br); } else if (br.dx === _p.dx && br.dy === _p.dy) { br.x2 = _p.x; br.y2 = _p.y; } else { br = { x1: _p.x, y1: _p.y, x2: _p.x, y2: _p.y, dx: _p.dx, dy: _p.dy }; G.bridges.push(br); } }
      else br = null;
    }
    if (zones.length) p.zones = zones;
  }
}
const terrainMul = (e) => { const zs = G.paths[e.path].zones; if (zs) for (let i = 0; i < zs.length; i++) { const z = zs[i]; if (e.d >= z.a && e.d < z.b) return z.mul; } return 1; };
function distToSeg(px, py, s) {
  const t = clamp((px - s.ax) * s.dx + (py - s.ay) * s.dy, 0, s.len);
  return dist(px, py, s.ax + s.dx * t, s.ay + s.dy * t);
}
function distToPaths(G, x, y) { let m = 1e9; for (const p of G.paths) for (const s of p.segs) { const d = distToSeg(x, y, s); if (d < m) m = d; } return m; }
// how far along a path a point is (for fences / mines: closest point on any path)
function nearestPathPoint(G, x, y) {
  let best = null;
  for (let pi = 0; pi < G.paths.length; pi++) for (const s of G.paths[pi].segs) {
    const t = clamp((x - s.ax) * s.dx + (y - s.ay) * s.dy, 0, s.len), px = s.ax + s.dx * t, py = s.ay + s.dy * t, d = dist(x, y, px, py);
    if (!best || d < best.d) best = { d, x: px, y: py, along: s.start + t, path: pi };
  }
  return best;
}
const TOWER_R = 15;
function placementError(G, def, x, y, ignore) {
  if (x < 12 || y < 12 || x > W - 12 || y > H - 12) return 'Outside the map';
  if (def.onPath) {
    const np = nearestPathPoint(G, x, y);
    if (!np || np.d > 14) return 'Must be placed ON the path';
    if (np.along < 50) return 'Too close to the spawn';
    if (dist(x, y, G.base.x, G.base.y) < 46) return 'Too close to the base';
    for (const t of G.towers) if (t !== ignore && t.def.onPath && dist(t.x, t.y, x, y) < 26) return 'Too close to another one';
    return null;
  }
  if (distToPaths(G, x, y) < 33) return 'Too close to the path';
  if (dist(x, y, G.base.x, G.base.y) < 44) return 'Too close to the base';
  const wf = waterAt(G, x, y, TOWER_R - 4); if (wf) return wf.t === 'mud' ? 'Too boggy to build here' : wf.t === 'crater' ? 'Something is in the way' : TERRAIN[wf.t].name + ' is in the way';
  for (const o of G.obstacles) if (dist(o.x, o.y, x, y) < o.r + TOWER_R - 2) return 'Something is in the way';
  for (const t of G.towers) if (t !== ignore && !t.def.onPath && dist(t.x, t.y, x, y) < 30) return 'Too close to another tower';
  return null;
}

