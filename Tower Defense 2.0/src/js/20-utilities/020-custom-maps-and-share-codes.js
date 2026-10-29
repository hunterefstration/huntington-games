// =====================================================================
//  CUSTOM MAPS AND SHARE CODES (3.0)
//  A map from the Map Editor travels as one short line of text:
//    TD-<base64url>  holding, bit by bit:
//    version 3 | theme 4 | random scenery 2 | money/25 10 | base health 10 | base tile 9
//    roads 3 | per road: tiles 6, then each tile 9 (the first is the entrance)
//    terrain as runs over the 360 tiles, row by row (type 3, length-1 in 3-bit groups;
//      type 7 = "same as the tile above", so rivers and lakes cost almost nothing)
//    scenery items 7 | per item: gap from the last one (3-bit groups), then 1 bit
//      "same kind as the last one" or 0 + kind 5 | name length 5 | letters 6 each
//    and a 12-bit checksum, so a typo or a cut-off code is caught.
//  Decoding never trusts the text: any problem throws an Error whose message
//  is shown to the player, and nothing is changed.
//  Editor data d = { name, theme, scenery, money, lives, base (tile or -1),
//    roads: [[tile, ...], ...], terr: Uint8Array(360) (CM_TERRAIN index), deco: Uint8Array(360) (CM_DECO index + 1) }
// =====================================================================
const CODE_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CODE_NAME = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-';
const CODE_VER = 1, CODE_PREFIX = 'TD-', CODE_MAXLEN = 1600;
const CODE_DAMAGED = 'That code is damaged or incomplete. Copy the whole code (it starts with TD-) and try again.';
const cleanMapName = (s) => String(s == null ? '' : s).replace(/[^ A-Za-z0-9-]/g, '').replace(/\s+/g, ' ').trim().slice(0, CM_LIMITS.name).trim();
const tileXY = (c) => [(c % GW) * GRID + GRID / 2, ((c / GW) | 0) * GRID + GRID / 2];
function codeSum(bits, n) { let h = 2166136261; for (let i = 0; i < n; i++) { h ^= bits[i] + 1; h = Math.imul(h, 16777619); } return (h ^ (h >>> 12) ^ (h >>> 24)) & 4095; }
function blankMapData() { return { name: 'My Map', theme: 'grass', scenery: 1, money: 0, lives: 0, base: -1, roads: [[]], terr: new Uint8Array(GW * GH), deco: new Uint8Array(GW * GH) }; }
function encodeMap(d) {
  const bits = [], N = GW * GH;
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  const grp = (v) => { do { put(v & 7, 3); v >>>= 3; put(v ? 1 : 0, 1); } while (v); };
  put(CODE_VER, 3); put(Math.max(0, CM_THEMES.indexOf(d.theme)), 4); put(clamp(d.scenery | 0, 0, 2), 2);
  put(clamp(Math.round((d.money || 0) / 25), 0, CM_LIMITS.money / 25), 10); put(clamp(d.lives | 0, 0, CM_LIMITS.lives), 10);
  put(d.base >= 0 && d.base < N ? d.base : 511, 9);
  const roads = d.roads.filter(r => r.length).slice(0, CM_LIMITS.roads);
  put(roads.length, 3);
  for (const r of roads) { const pts = r.slice(0, CM_LIMITS.corners); put(pts.length, 6); for (const c of pts) put(c, 9); }
  const sym = new Uint8Array(N); for (let i = 0; i < N; i++) sym[i] = i >= GW && d.terr[i] === d.terr[i - GW] ? 7 : d.terr[i];
  for (let i = 0; i < N;) { const t = sym[i]; let j = i + 1; while (j < N && sym[j] === t) j++; put(t, 3); grp(j - i - 1); i = j; }
  const deco = []; for (let i = 0; i < N && deco.length < CM_LIMITS.deco; i++) if (d.deco[i]) deco.push(i);
  put(deco.length, 7);
  let last = -1, lastK = -1;
  for (const i of deco) { grp(i - last - 1); last = i; const k = d.deco[i] - 1; if (k === lastK) put(1, 1); else { put(0, 1); put(k, 5); lastK = k; } }
  const name = cleanMapName(d.name); put(name.length, 5); for (const ch of name) put(CODE_NAME.indexOf(ch), 6);
  put(codeSum(bits, bits.length), 12);
  while (bits.length % 6) bits.push(0);
  let out = CODE_PREFIX;
  for (let i = 0; i < bits.length; i += 6) out += CODE_B64[(bits[i] << 5) | (bits[i + 1] << 4) | (bits[i + 2] << 3) | (bits[i + 3] << 2) | (bits[i + 4] << 1) | bits[i + 5]];
  return out;
}
// lenient = true reads unfinished maps too (the editor's own draft); share codes must be playable.
// Text around the code (a chat message, quotes) is ignored; a code broken over several lines still reads.
// Every "TD-" in the text is tried (chat text can say "TD-" before the real code), and for each one the code
// is read as one unbroken run, then joined with the next pieces after line breaks / spaces one at a time, so
// words after a wrapped code are not glued onto it. The 12-bit checksum tells the right join.
function decodeMap(text, lenient) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Paste a map code first.');
  if (text.length > CODE_MAXLEN * 4) throw new Error('That is far too long to be a map code.');
  let at = text.indexOf(CODE_PREFIX);
  if (at < 0) {
    const raw = text.replace(/\s+/g, '');
    if (/^[A-Za-z0-9_-]{8,}$/.test(raw)) { try { return decodeBits(raw, lenient, false); } catch (e) {} }       // pasted without the TD- in front
    throw new Error('That is not a Tower Defense map code. Map codes start with ' + CODE_PREFIX);
  }
  let err = null, errLen = -1;                  // the error to show: the one from the longest unbroken run (the likeliest real code)
  for (; at >= 0; at = text.indexOf(CODE_PREFIX, at + 1)) {
    const pieces = text.slice(at + CODE_PREFIX.length).split(/\s+/);
    let acc = '';
    for (let i = 0; i < pieces.length && i < 64; i++) {
      const run = pieces[i].match(/^[A-Za-z0-9_-]*/)[0];
      acc += run;
      if (acc.length > CODE_MAXLEN) break;
      if (run || i === 0) {
        try { return decodeBits(acc, lenient, true); }
        catch (e) { if (e.checked || (i === 0 && acc.length > errLen)) { err = e; errLen = e.checked ? Infinity : acc.length; } }   // checked: the checksum passed, so the message is about the real map
      }
      if (run.length !== pieces[i].length) break;   // punctuation ends the code
    }
  }
  throw err || new Error(CODE_DAMAGED);
}
function decodeBits(s, lenient, prefixed) {
  const bad = (msg) => { throw new Error(msg || (prefixed ? CODE_DAMAGED : 'That is not a Tower Defense map code.')); }, N = GW * GH;
  if (s.length < 8) bad();
  if (s.length > CODE_MAXLEN) bad('That code is too long to be a map code.');
  const bits = [];
  for (let k = 0; k < s.length; k++) { const v = CODE_B64.indexOf(s[k]); for (let i = 5; i >= 0; i--) bits.push((v >> i) & 1); }
  let pos = 0;
  const get = (n) => { if (pos + n > bits.length) bad(); let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | bits[pos++]; return v; };
  const grp = () => { let v = 0; for (let k = 0; k < 4; k++) { v |= get(3) << (3 * k); if (!get(1)) return v; } return bad(); };
  const ver = get(3);
  if (ver > CODE_VER && prefixed) bad('This map was made with a newer version of Tower Defense. Update the game to load it.');
  if (ver !== CODE_VER) bad();
  const ti = get(4), scenery = get(2), money = get(10) * 25, lives = get(10), base = get(9), nr = get(3);
  if (ti >= CM_THEMES.length || scenery > 2 || money > CM_LIMITS.money || lives > CM_LIMITS.lives || (base >= N && base !== 511) || nr > CM_LIMITS.roads) bad();
  const roads = [];
  for (let r = 0; r < nr; r++) {
    const n = get(6); if (n < 1 || n > CM_LIMITS.corners) bad();
    const pts = []; for (let i = 0; i < n; i++) { const c = get(9); if (c >= N) bad(); pts.push(c); }
    roads.push(pts);
  }
  const terr = new Uint8Array(N), deco = new Uint8Array(N);
  for (let i = 0; i < N;) {
    const t = get(3), n = grp() + 1; if ((t >= CM_TERRAIN.length && t !== 7) || i + n > N || (t === 7 && i < GW)) bad();
    for (const e = i + n; i < e; i++) terr[i] = t === 7 ? terr[i - GW] : t;
  }
  const nd = get(7); if (nd > CM_LIMITS.deco) bad();
  for (let i = 0, c = -1, k = -1; i < nd; i++) { c += grp() + 1; if (get(1)) { if (k < 0) bad(); } else k = get(5); if (c >= N || k >= CM_DECO.length) bad(); deco[c] = k + 1; }
  const nl = get(5); if (nl > CM_LIMITS.name) bad();
  let name = ''; for (let i = 0; i < nl; i++) name += CODE_NAME[get(6)];
  const end = pos;
  if (get(12) !== codeSum(bits, end)) bad();
  if (bits.length - pos >= 6) bad();
  for (let i = pos; i < bits.length; i++) if (bits[i]) bad();
  const d = { name: cleanMapName(name) || 'Custom Map', theme: CM_THEMES[ti], scenery, money, lives, base: base === 511 ? -1 : base, roads, terr, deco };
  if (!lenient) { const pr = mapProblems(d); if (pr.length) { const e = new Error('That map is not finished yet: ' + pr[0]); e.checked = true; throw e; } }
  return d;
}
// length of a road in px, from the middle of its entrance tile through its corners to the base
function roadLen(d, r) {
  let len = 0, [px, py] = tileXY(r[0]);
  const pts = d.base >= 0 ? r.concat([d.base]) : r;
  for (let i = 1; i < pts.length; i++) { const [x, y] = tileXY(pts[i]); len += Math.hypot(x - px, y - py); px = x; py = y; }
  return len;
}
// what still stops a map from being played (empty list = ready)
function mapProblems(d) {
  const out = [];
  if (!(d.base >= 0 && d.base < GW * GH)) out.push('Place your base (Base tool).');
  if (!d.roads.some(r => r.length)) out.push('Draw a road (Road tool): click where enemies come in, then each corner on the way to your base.');
  if (out.length) return out;
  d.roads.forEach((r, i) => { if (!r.length) return; if (r[0] === d.base) out.push('Road ' + (i + 1) + ' starts on your base. Start it somewhere else.'); else if (roadLen(d, r) < CM_LIMITS.minRoad) out.push('Road ' + (i + 1) + ' is too short: make it at least 5 tiles long.'); });
  return out;
}
// an entrance on the edge of the board: the road comes in from off the map, from the side that fits its first stretch best
function edgeEntry(c, dx, dy) {
  const col = c % GW, row = (c / GW) | 0, [x, y] = tileXY(c), l = Math.hypot(dx, dy) || 1;
  let best = null, bs = -9;
  const tryE = (ok, px, py, ux, uy) => { if (!ok) return; const sc = (ux * dx + uy * dy) / l; if (sc > bs) { bs = sc; best = [px, py]; } };
  tryE(col === 0, -48, y, 1, 0); tryE(col === GW - 1, W + 48, y, -1, 0); tryE(row === 0, x, -48, 0, 1); tryE(row === GH - 1, x, H + 48, 0, -1);
  return best;
}
// editor data -> a map object like the ones in MAPS (points in 0..1). preview = also unfinished maps (for the editor)
function compileMap(d, code, preview) {
  const hasBase = d.base >= 0 && d.base < GW * GH, [bx, by] = hasBase ? tileXY(d.base) : [0, 0], paths = [], starts = new Set();
  let shortest = 1e9;
  if (!hasBase && !preview) return null;
  for (const r of d.roads) {
    if (!r.length) continue;
    const pts = [], [ex, ey] = tileXY(r[0]), nx = r.length > 1 ? tileXY(r[1]) : hasBase ? [bx, by] : [ex + 1, ey];
    const off = edgeEntry(r[0], nx[0] - ex, nx[1] - ey); if (off) pts.push(off);
    for (const c of r) { const p = tileXY(c), l = pts[pts.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) pts.push(p); }
    const l = pts[pts.length - 1]; if (hasBase && (l[0] !== bx || l[1] !== by)) pts.push([bx, by]);
    if (pts.length < 2) continue;
    paths.push(pts.map(([x, y]) => [x / W, y / H])); starts.add(r[0]); shortest = Math.min(shortest, roadLen(d, r));
  }
  if (!paths.length && !preview) return null;
  const water = [];
  for (let t = 1; t < CM_TERRAIN.length; t++) { const grid = []; for (let i = 0; i < GW * GH; i++) if (d.terr[i] === t) grid.push(i); if (grid.length) water.push({ grid, t: CM_TERRAIN[t] }); }
  const deco = [];
  for (let i = 0; i < GW * GH; i++) if (d.deco[i]) { const [x, y] = tileXY(i); deco.push({ x: x / W, y: y / H, k: CM_DECO[d.deco[i] - 1] || 'rock', s: ((i * 37) % 100) / 100 }); }
  const rank = starts.size >= 3 || shortest < 900 ? 3 : starts.size === 2 || shortest < 1600 ? 2 : 1;
  return { name: d.name || 'Custom Map', theme: own(THEMES, d.theme) ? d.theme : 'grass', rank, custom: true, code: code || null, paths, water, deco, scenery: d.scenery, money: d.money, lives: d.lives,
    note: 'Custom map' + (d.money ? ' \u00b7 starts with ' + money$(d.money) : '') + (d.lives ? ' \u00b7 ' + d.lives + ' base health' : '') };
}
// a share code -> a playable map object (or null). Cached: saves, map cards and the game all ask for the same few codes.
const customCache = new Map();
function customMap(code) {
  if (typeof code !== 'string' || code.length > CODE_MAXLEN + CODE_PREFIX.length) return null;
  if (customCache.has(code)) return customCache.get(code);
  let m = null;
  try { m = compileMap(decodeMap(code, false), code); } catch (e) { m = null; }
  if (customCache.size > 80) customCache.clear();
  customCache.set(code, m);
  return m;
}
// the map a game is played on: a built-in one (opts.map) or a custom one (opts.custom = its share code)
function mapOf(opts) { return opts && typeof opts.custom === 'string' ? customMap(opts.custom) : MAPS[opts.map]; }
const isCustomGame = () => !!(G && typeof G.opts.custom === 'string');
// ---- the list of saved custom maps (td2_custom): [{ id, code, ts, best, won }] ----
function getCustomMaps() {
  const a = store.get(KEYS.custom, []), out = [], seen = new Set();
  if (Array.isArray(a)) for (const e of a) {
    if (out.length >= CM_LIMITS.maps) break;
    if (!isPlainObj(e) || typeof e.code !== 'string' || typeof e.id !== 'string' || !/^[a-z0-9]{1,16}$/.test(e.id) || seen.has(e.id)) continue;
    const m = customMap(e.code); if (!m) { warnTD('a saved custom map could not be read: skipped'); continue; }
    seen.add(e.id);
    out.push({ id: e.id, code: e.code, ts: numOr(e.ts, 0, 0, 1e15), best: Math.floor(numOr(e.best, 0, 0, 1e6)), won: e.won === true, m });
  }
  return out;
}
// true when it was written (storage can be full or blocked)
function setCustomMaps(list) {
  const raw = JSON.stringify(list.slice(0, CM_LIMITS.maps).map(e => ({ id: e.id, code: e.code, ts: e.ts, best: e.best, won: e.won })));
  return rawSet(KEYS.custom, raw) && rawGet(KEYS.custom) === raw;
}
const newMapId = () => (Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36)).slice(-16);
// a custom map's best wave cleared (and whether it was won) shows on its card
function noteCustomBest(code, wave, won) {
  const list = getCustomMaps(); let ch = false;
  for (const e of list) if (e.code === code) { if (wave > e.best) { e.best = wave; ch = true; } if (won && !e.won) { e.won = true; ch = true; } }
  if (ch) setCustomMaps(list);
}

// =====================================================================
//  TOWER STATS
// =====================================================================
const MAX_LEVEL = 5;
function upgradeCost(def, level) { return Math.floor(def.cost * 0.8 * level); }
const specCost = (def) => def.cost * 3;
const statCache = new Map();
// The numbers one unit of a tower has at a level (and specialization 0 / 1 / 2 / 3)
function levelStats(def, level, spec) {
  const key = def.id + '|' + level + '|' + spec; let s = statCache.get(key); if (s) return s;
  const L = Math.min(level, MAX_LEVEL) - 1, k = def.kind;
  s = { damage: 0, range: def.range || 0, rate: def.rate || 60, aoe: def.aoe || 0, shots: def.shots || 1, mods: def.fx ? Object.assign({}, def.fx) : {} };
  if (k === 'income') { s.income = def.income + Math.floor(def.income * 0.5) * (level - 1); }
  else if (k === 'aura') { s.range = def.range + 20 * L; s.power = level; }
  else if (k === 'heal') { s.range = def.range + 10 * L; s.damage = def.damage + 25 * L; s.rate = 60; }
  else if (k === 'barracks') {
    const b = def.b;
    s.range = def.range + 10 * L; s.soldiers = b.n[L]; s.troopHp = Math.round(b.hp * (1 + 0.35 * L)); s.troopDmg = Math.round(b.dmg * (1 + 0.3 * L)); s.respawn = Math.max(200, b.respawn - 60 * L);
  } else if (k === 'hq') { s.power = level; }
  else if (k === 'fence' || k === 'trap') {
    s.hp = Math.round(def.hp * (1 + 0.6 * L)); s.guard = 1 - 0.04 * L;
    if (def.damage) s.damage = Math.round(def.damage * Math.pow(k === 'trap' ? 1.3 : 1.35, L));
    if (def.range) s.range = Math.round(def.range * (def.shoots ? Math.pow(1.05, L) : 1 + 0.03 * L));
  } else if (k === 'mine') { s.damage = Math.round(def.damage * (1 + 0.45 * L)); s.aoe = Math.round(def.aoe * (1 + 0.08 * L)); }
  else if (k === 'tank') { s.damage = def.damage || 0; }
  else {
    s.damage = Math.round(def.damage * Math.pow(1.5, L)); s.range = Math.round(def.range * Math.pow(1.08, L)); s.rate = Math.max(1, Math.round(def.rate * Math.pow(0.88, L))); s.aoe = Math.round(def.aoe * Math.pow(1.08, L));
  }
  if (spec && specOf(def, spec)) {
    const m = specOf(def, spec).mods; s.mods = Object.assign(s.mods, m);
    if (m.dmg) s.damage = Math.round(s.damage * m.dmg);
    if (m.range) s.range = Math.round(s.range * m.range);
    if (m.rate) s.rate = Math.max(1, Math.round(s.rate * m.rate));
    if (m.aoe) s.aoe = Math.round(s.aoe * m.aoe);
    if (m.shots) s.shots = m.shots;
    if (m.hp && s.hp) s.hp = Math.round(s.hp * m.hp);
    if (m.guard && s.guard != null) s.guard *= m.guard;
    if (m.income && s.income) s.income = Math.round(s.income * m.income);
    if (k === 'barracks') {
      const tx = m.tx || {};
      if (tx.hp) s.troopHp = Math.round(s.troopHp * tx.hp);
      if (tx.dmg) s.troopDmg = Math.round(s.troopDmg * tx.dmg);
      if (m.nAdj) s.soldiers = Math.max(1, s.soldiers + m.nAdj);
    }
  }
  s.minRange = def.minRange ? Math.round(def.minRange * ((spec && s.mods.minRange) || 1)) : 0;
  s.air = (s.mods.air) || def.air;
  s.dps = s.damage * s.shots * (60 / s.rate) * (def.kind === 'chain' ? 1 + (s.mods.chain || def.chain || 0) * 0.5 : 1);
  statCache.set(key, s);
  return s;
}

// =====================================================================
//  ENTITIES
// =====================================================================
const _p = { x: 0, y: 0, dx: 0, dy: 0 };
let enemyUid = 1;
function waveMult(wave) { return 1 + wave * 0.55 + Math.pow(Math.max(0, wave - 100), 1.6) * 0.05; }
function makeEnemy(id, wave, opts = {}) {
  if (!own(ENEMY, id)) { warnTD('unknown enemy ' + id); id = 'basic'; }
  const def = ENEMY[id], mult = waveMult(wave), heavy = !!def.boss || id === 'heavytank';
  const vary = S.enemyVariety && !opts.noVary;
  const jit = vary ? rand(0.92, 1.08) : 1, sjit = vary ? rand(0.94, 1.06) : 1;
  const e = {
    uid: enemyUid++, def, id, alive: true,
    hp: def.hp * Math.pow(mult, heavy ? 1.3 : 1) * G.diff.hp * jit, shield: 0, maxShield: 0,
    armor: (def.armor || 0) * (1 + wave / 60), r: def.r * (vary ? rand(0.95, 1.05) : 1),
    speed: def.speed * (heavy ? 1 : Math.min(1.8, 1 + mult * 0.02)) * sjit,
    reward: def.reward * (G.map.bonus || 1), dmg: def.dmg, air: !!def.air,
    path: opts.path != null ? opts.path : (Math.random() * G.paths.length) | 0, d: opts.d || 0, x: 0, y: 0, angle: 0,
    slowT: 0, slowP: 0, stunT: 0, poison: null, burn: null, brittleT: 0, brittle: 0, markT: 0, mark: 0, revealedT: 0, radarMark: 0,
    blocker: null, burrowT: rand(120, 300), burrowed: false, summonT: 120, blinkT: 150, affix: null, flash: 0, wave,
    barrier: 0, maxBarrier: 0, barrierDownT: 0, tempBarrier: false, warpT: rand(180, 260), abductT: rand(150, 240), projT: rand(60, 140), charmT: 0, gen: 0, harvest: 0, pushT: 0, bountyT: 0,
    bossT: def.steam ? 300 : def.jammer ? 360 : def.factory ? 200 : def.warlord ? 480 : 0, bossPh: 0, bossK: 0, bossLock: 0, rallyT: 0, hitT: 0
  };
  if (opts.hpMul) e.hp *= opts.hpMul;
  const M = G.mods;          // Daily Challenge modifiers
  if (M.fast) e.speed *= 1.3;
  if (M.tough) e.hp *= 1.4;
  if (M.armor) e.armor += 3 * (1 + wave / 60);
  if (def.shield) e.shield = e.maxShield = def.shield * mult * G.diff.hp;
  if (def.barrier) e.barrier = e.maxBarrier = def.barrier * (heavy ? Math.pow(mult, 1.3) : mult) * G.diff.hp;
  const affixId = opts.affix;
  if (affixId) {
    const a = AFFIXES.find(x => x.id === affixId) || AFFIXES[0]; e.affix = a;
    if (a.hp) e.hp *= a.hp; if (a.speed) e.speed *= a.speed; if (a.size) e.r *= a.size; if (a.reward) e.reward *= a.reward;
    if (a.armor) e.armor += a.armor * (1 + wave / 60); if (a.shield) { e.shield += e.hp * a.shield; e.maxShield = e.shield; } if (a.regen) e.affixRegen = a.regen;
  }
  if (G.gm === 'troop' && def.boss) { e.hp *= TM.boss; e.shield *= TM.boss; e.barrier *= TM.boss; e.maxBarrier = e.barrier; }
  if (M.shields) { e.shield += e.hp * 0.3; e.maxShield = e.shield; }
  if (def.aegis) e.shield = e.maxShield = e.hp * def.aegis;          // Aegis Walker: its regenerating shield
  e.maxHp = e.hp;
  const p = G.paths[e.path];
  if (e.air) { e.x = p.air.ax; e.y = p.air.ay; } else { pathPos(p, e.d, _p); e.x = _p.x; e.y = _p.y; }
  return e;
}
// fraction of the way to the base (for First / Last targeting) - works for air and every path
const progress = (e) => { const p = G.paths[e.path]; return e.air ? e.d / (p.air.len || 1) : e.d / (p.len || 1); };

class Unit {             // one tower in a stack
  constructor(def) { this.def = def; this.level = 1; this.spec = 0; this.invested = def.cost; this.dealt = 0; this.kills = 0; this.cd = 0; this.spin = 0; this.ramp = 0; this.rampTarget = null; this.stock = def.manual ? 1 : 0; this.pulseT = 0; this._lv = -1; this._sp = -1; this._st = null; }
  get stats() { if (this._lv !== this.level || this._sp !== this.spec) { this._st = levelStats(this.def, this.level, this.spec); this._lv = this.level; this._sp = this.spec; } return this._st; }
  get nextCost() { if (G && G.mods.cap3 && this.level >= 3) return 0; return this.level < MAX_LEVEL || this.def.endless ? upgradeCost(this.def, this.level) : 0; }
  get canSpec() { return !!(this.def.specs && this.level >= MAX_LEVEL && !this.spec); }
  get maxed() { if (G && G.mods.cap3 && this.level >= 3) return true; return !this.def.endless && this.level >= MAX_LEVEL && (!this.def.specs || !!this.spec); }
}
class TowerGroup {
  constructor(def, x, y) {
    this.def = def; this.x = x; this.y = y; this.units = [new Unit(def)];
    this.targeting = def.air === 'only' ? 'air' : 'first'; this.sticky = false; this.target = null;
    this.angle = -Math.PI / 2; this.recoil = 0; this.redeploy = 0; this.buff = { range: 1, dmg: 1, eco: 1, rate: 1, detect: false, resp: 1 };
    this.hp = this.maxHp = def.hp || 0; this.aimed = null; this.id = TowerGroup.next++;
    this.dealt = 0; this.kills = 0; this.guard = 1; this.bgm = 1; this.regen = 0; this.thorns = 0; this.boom = 0; this.boomR = 0; this.shock = 0; this.garrison = 0;
  }
  get level() { let m = 0; for (const u of this.units) if (u.level > m) m = u.level; return m; }
  get invested() { let s = 0; for (const u of this.units) s += u.invested; return s; }
  get sellValue() { return Math.floor(this.invested * (this.builtWave === G.wave && !G.waveActive ? 1 : 0.75)); }
  range(u) { return (u || this.units[0]).stats.range * this.buff.range; }
}
TowerGroup.next = 1;

