// ---------------- terrain colours (shared by mesh & minimap) ----------------
const _tc = [0, 0, 0];
function hexRGB(h, o) { o[0] = ((h >> 16) & 255) / 255; o[1] = ((h >> 8) & 255) / 255; o[2] = (h & 255) / 255; return o; }
const _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0];
function terrainColor(M, x, z, h, sl, out) {
  const B = M.biome; hexRGB(B.low, _a); hexRGB(B.mid, _b);
  const t1 = sstep(M.wl - .3, M.wl + 1.5, h); let r = lerp(_a[0], _b[0], t1), g = lerp(_a[1], _b[1], t1), bl = lerp(_a[2], _b[2], t1);
  hexRGB(B.high, _c); const t2 = sstep(1.6, 5.2, h) * .6; r = lerp(r, _c[0], t2); g = lerp(g, _c[1], t2); bl = lerp(bl, _c[2], t2);
  hexRGB(B.cliff, _c); const t3 = sstep(.5, 1.05, sl) * .45; r = lerp(r, _c[0], t3); g = lerp(g, _c[1], t3); bl = lerp(bl, _c[2], t3);
  if (h < M.wl + .15) { const dk = sstep(M.wl + .15, M.wl - 2.2, h) * .35; r *= 1 - dk; g *= 1 - dk * .8; bl *= 1 - dk * .5; }
  const tv = (vnoise(x / 50, z / 50, 11) - .5) * .06; r += tv; g += tv; bl += tv;
  for (const p of M.paints) {
    let a = 0;
    if (p.t === 'c') { const dx = x - p.x, dz = z - p.z, d = Math.sqrt(dx * dx + dz * dz); if (d < p.r) a = p.a * .45 * sstep(p.r, p.r * .55, d); }
    else { const d = segDist(x, z, p.x1, p.z1, p.x2, p.z2); if (d < p.w * 1.15) a = p.a * sstep(p.w * 1.15, p.w * .65, d); }
    if (a > 0 && h > M.wl - .3) { hexRGB(p.col, _c); r = lerp(r, _c[0], a); g = lerp(g, _c[1], a); bl = lerp(bl, _c[2], a); }
  }
  out[0] = clamp(r, 0, 1); out[1] = clamp(g, 0, 1); out[2] = clamp(bl, 0, 1); return out;
}
// ---------------- pathfinding ----------------
const NB = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
function navRefresh(M, nv) {
  const n = nv || M.nav; if (n.penVer === n.ver) return; n.penVer = n.ver; const { nx, nz, blk, dyn, pen } = n;
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
    const i = z * nx + x; let p = 0;
    if (!(blk[i] | dyn[i])) { for (let k = 0; k < 8; k += 2) { const a = x + NB[k][0], b = z + NB[k][1]; if (a < 0 || b < 0 || a >= nx || b >= nz || (blk[b * nx + a] | dyn[b * nx + a])) { p = .7; break; } } }
    pen[i] = p;
  }
}
let _di = new Int32Array(0), _ec = _di, _en = _di; const _bh = new Int32Array(32);
const DXs = [1, 1, 0, -1, -1, -1, 0, 1], DZs = [0, 1, 1, 1, 0, -1, -1, -1];
let FIELD_BUDGET = 3, FIELD_BANK = 3; const FIELD_MS = 1.5;   // 4.3: route building gets 1.5 ms per tick (saved up to 4 ms), so slow computers (Chromebooks) build routes more slowly instead of stalling
// 4.3: coarse = a shared route for units still far from their spot (a big army in formation used to ask for one
// full-map route per soldier, which froze the game for a minute). New routes are limited per tick; until a unit's
// route is ready it walks straight at its goal. Old routes are recycled instead of thrown away.
function getField(M, tx, tz, coarse, nv) {
  const n = nv || M.nav; navRefresh(M, n); const nx = n.nx, nz = n.nz, blk = n.blk, dyn = n.dyn, pen = n.pen, G = coarse ? 12 : 3;
  let key = n.idx(tx, tz); { const cx = key % nx, cz = (key / nx) | 0; key = Math.min(nz - 2, ((cz / G) | 0) * G + (G >> 1)) * nx + Math.min(nx - 2, ((cx / G) | 0) * G + (G >> 1)); }
  let f = n.cache.get(key);
  if (f && (f.ver === n.ver || FIELD_BUDGET <= 0)) { f.used = ++n.tick || (n.tick = 1); return f; }
  if (FIELD_BUDGET <= 0 || FIELD_BANK <= 0) { if (f) { f.used = ++n.tick || (n.tick = 1); } return f || null; }
  FIELD_BUDGET--; const ft0 = performance.now();
  const N = nx * nz; if (!f || f.dist.length !== N) { f = n.spare && n.spare.length ? n.spare.pop() : null; if (!f || f.dist.length !== N) f = { ver: n.ver, dist: new Float32Array(N), dir: new Int8Array(N), used: 0, goal: key }; f.goal = key; } f.ver = n.ver;
  const dist = f.dist, dir = f.dir; dist.fill(1e9); dir.fill(-1);
  let s = key;
  if (blk[s] | dyn[s]) { // nearest free cell
    let found = -1; const sx = s % nx, sz = (s / nx) | 0;
    for (let r = 1; r < 14 && found < 0; r++) { let best = 1e9; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const cx = sx + a, cz = sz + b; if (cx < 0 || cz < 0 || cx >= nx || cz >= nz) continue; const i = cz * nx + cx; if (blk[i] | dyn[i]) continue; const d = a * a + b * b; if (d < best) { best = d; found = i; } } }
    if (found < 0) { n.cache.set(key, f); return f; } s = found;
  }
  const off = [1, nx + 1, nx, nx - 1, -1, -nx - 1, -nx, -nx + 1];
  // 4.3: Dial's algorithm. Step costs are whole numbers (10 straight, 14 diagonal, +7 next to a wall), so a ring of
  // 32 buckets replaces the heap: same routes, several times faster (big armies on slow computers)
  if (_di.length < N) { _di = new Int32Array(N); _ec = new Int32Array(N * 8 + 16); _en = new Int32Array(N * 8 + 16); }
  const di = _di, ec = _ec, en = _en, bh = _bh, INF = 0x7fffffff; di.fill(INF, 0, N); bh.fill(-1);
  let ne = 0, left = 1, cur = 0; di[s] = 0; ec[0] = s; en[0] = -1; bh[0] = 0; ne = 1;
  while (left > 0) {
    const bk = cur & 31, e = bh[bk]; if (e < 0) { cur++; continue; }
    bh[bk] = en[e]; left--; const i = ec[e]; if (di[i] !== cur) continue;
    for (let k = 0; k < 8; k++) {
      const j = i + off[k]; if (blk[j] | dyn[j]) continue;
      if (k & 1) { if (blk[i + off[(k + 7) & 7]] | dyn[i + off[(k + 7) & 7]] | blk[i + off[(k + 1) & 7]] | dyn[i + off[(k + 1) & 7]]) continue; }
      const nd = cur + ((k & 1) ? 14 : 10) + (pen[j] > 0 ? 7 : 0);
      if (nd < di[j]) { di[j] = nd; dir[j] = (k + 4) & 7; const b2 = nd & 31; ec[ne] = j; en[ne] = bh[b2]; bh[b2] = ne++; left++; }
    }
  }
  for (let i = 0; i < N; i++) dist[i] = di[i] === INF ? 1e9 : di[i] * .1;
  FIELD_BANK -= performance.now() - ft0;
  n.cache.set(key, f);
  if (n.cache.size > 128) { let ok = null, ou = 1e18; for (const [k, v] of n.cache) if (v.used < ou && k !== key) { ou = v.used; ok = k; } if (ok !== null) { (n.spare = n.spare || []).push(n.cache.get(ok)); n.cache.delete(ok); } }
  f.used = ++n.tick || (n.tick = 1);
  return f;
}
function navBlockedAt(M, x, z) { const n = M.nav; const i = n.idx(x, z); return (n.blk[i] | n.dyn[i]) !== 0; }
// 2.2: a unit in 'pass-through' mode (just spawned, or stuck) ignores buildings and only stops at cliffs, water and rocks
// 3.0: Iron Legion Jump Troopers jet over walls and buildings the same way (only terrain stops them)
function blockedFor(u, M, x, z) { if (u.T.naval) { const n = M.navW; return n.blk[n.idx(x, z)] !== 0; } if (u.ghost > 0 || u.T.jump) { const n = M.nav; return n.blk[n.idx(x, z)] !== 0; } return navBlockedAt(M, x, z); }
function losClear(M, x0, z0, x1, z1, terrainOnly) {
  const n = M.nav, dx = x1 - x0, dz = z1 - z0, L = Math.sqrt(dx * dx + dz * dz); if (L < 1) return true; const st = Math.ceil(L / 1.2);
  for (let i = 1; i < st; i++) { const t = i / st; if (terrainOnly ? n.blk[n.idx(x0 + dx * t, z0 + dz * t)] !== 0 : navBlockedAt(M, x0 + dx * t, z0 + dz * t)) return false; } return true;
}
function snapFree(M, x, z, maxR) {
  if (!navBlockedAt(M, x, z) && M.inb(x, z)) return [x, z];
  for (let r = 1; r <= (maxR || 8); r++) { for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + r, px = x + Math.cos(a) * r * 1.5, pz = z + Math.sin(a) * r * 1.5; if (M.inb(px, pz) && !navBlockedAt(M, px, pz)) return [px, pz]; } }
  return [x, z];
}
function markNav(M, x, z, r, delta) { // dynamic obstacles (buildings)
  const n = M.nav, cs = n.cs; const c0 = Math.floor((x - r + M.hw) / cs), c1 = Math.floor((x + r + M.hw) / cs), r0 = Math.floor((z - r + M.hd) / cs), r1 = Math.floor((z + r + M.hd) / cs);
  for (let a = r0; a <= r1; a++) for (let b = c0; b <= c1; b++) { if (a < 0 || b < 0 || a >= n.nz || b >= n.nx) continue; const px = -M.hw + (b + .5) * cs - x, pz = -M.hd + (a + .5) * cs - z; if (px * px + pz * pz <= (r + 1) * (r + 1)) n.dyn[a * n.nx + b] = clamp(n.dyn[a * n.nx + b] + delta, 0, 250); }
  n.ver++;
}
// 4.2: defense pads, just outside each flag's walls (towers and guns only)
function defPads(pt) {
  const out = [];
  if (pt.big) { for (let k = 0; k < 8; k++) for (const o of [-.16, .16]) { const a = PI / 8 + k * PI / 4 + o; out.push([pt.x + Math.cos(a) * 42, pt.z + Math.sin(a) * 42]); } }
  else if (pt.hq >= 0) { for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3; out.push([pt.x + Math.cos(a) * 24.5, pt.z + Math.sin(a) * 24.5]); } }
  else { for (let k = 0; k < 4; k++) { const a = PI / 4 + k * PI / 2; out.push([pt.x + Math.cos(a) * 17.5, pt.z + Math.sin(a) * 17.5]); } }
  return out;
}
function slotPos(pt, k) {
  if (pt.big) { if (k < 8) { const a = PI / 8 + k * PI / 4; return [pt.x + Math.cos(a) * 15, pt.z + Math.sin(a) * 15]; } const a = (k - 8) * TAU / 16; return [pt.x + Math.cos(a) * 27.5, pt.z + Math.sin(a) * 27.5]; }   // 3.1: the Bastion, 24 build spots in two rings
  if (pt.hq >= 0) { const a = PI / 6 + k * PI / 3; return [pt.x + Math.cos(a) * 12.5, pt.z + Math.sin(a) * 12.5]; } const a = PI / 4 + k * PI / 2; return [pt.x + Math.cos(a) * 7.2, pt.z + Math.sin(a) * 7.2]; }
function wallArcs(pt) { // list of [cx,cz,angle0,angle1,radius]
  const out = []; if (pt.big) { for (let k = 0; k < 8; k++) { const a = PI / 8 + k * PI / 4; out.push([a - .3, a + .3, 36]); } } else if (pt.hq >= 0) { for (let k = 0; k < 6; k++) { const a = PI / 6 + k * PI / 3; out.push([a - .36, a + .36, 19.5]); } } else { for (let k = 0; k < 4; k++) { const a = PI / 4 + k * PI / 2; out.push([a - .5, a + .5, 13.5]); } } return out;
}
// =====================================================================
//  SIMULATION (host-authoritative; runs in single player and on the host)
// =====================================================================
let W = null, ME = 0;
const UTK = Object.keys(UT), BTK = Object.keys(BT);
const MODKEYS = ['dmgBul', 'dmgAT', 'dmgShell', 'spl', 'hpInf', 'hpVeh', 'hpHvy', 'hpBld', 'inc', 'cost', 'pop', 'spdInf', 'spdVeh', 'spdAir', 'prod', 'vis', 'rng', 'acc', 'bldDmg', 'xp', 'heal', 'callCd', 'callCost', 'shCap', 'shRegen'];
const FORMS = ['box', 'line', 'wedge', 'spread', 'column', 'ring', 'free'], FORMN = ['Box', 'Line', 'Wedge', 'Spread', 'Column', 'Ring', 'Free'], FORMUI = [6, 0, 1, 2, 3, 4, 5];   // 2.2: 'free' keeps the group's shape
const tmpA = [];

function ev(a) { W.ev.push(a); }
const r1 = v => Math.round(v * 10) / 10;

function createWorld(o) {
  const def = MAPS.find(m => m.id === o.map) || (o.map === 'bastion' ? WARMAP : MAPS[0]);
  const M = genMap(def);
  const np = o.players.length;
  W = { M, o, t: 0, tick: 0, nid: 1, units: [], bld: [], byId: new Map(), players: [], pts: [], proj: [], ev: [], sched: [], over: false, winner: -1, reason: '', mirror: !!o.mirror, reveals: [], teams: [], alertT: {}, stats: { calls: 0 }, fx: true, paused: false, speed: o.speed || 1, popMax: o.maxPop || 120 };
  W.wx = wxOf(o); W.wxVer = 0; o.fogBase = !!o.fog; if (W.wx.fog && !o.demo && !o.tutorial) o.fog = true;   // 3.0: night and fog battles always use fog of war
  W.hash = { cs: 12, nx: Math.ceil(M.w / 12) + 1, nz: Math.ceil(M.d / 12) + 1, cells: [] };
  for (let i = 0; i < W.hash.nx * W.hash.nz; i++) W.hash.cells.push([]);
  W.vw = Math.ceil(M.w / 4); W.vd = Math.ceil(M.d / 4); W.vis = [];
  for (let t = 0; t < 4; t++) W.vis.push(new Uint8Array(W.vw * W.vd));
  let spawnFor;
  if (M.spawns.length === 2) spawnFor = [0, 1]; else spawnFor = np <= 2 ? [0, 2] : np === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  if (o.spawnFor) spawnFor = o.spawnFor;
  for (let i = 0; i < np; i++) {
    const s = o.players[i];
    const p = { id: i, name: s.name, team: s.team, color: s.color, kind: s.kind, fac: s.fac === 1 ? 1 : 0, spawn: spawnFor[i], sup: o.supplies, inc: 0, pop: 0, popCap: 40, alive: true, techs: {}, res: null, cd: {}, mod: {}, stats: { kills: 0, lost: 0, built: 0, captured: 0, air: 0, specs: 0, calls: 0, sup: 0, hero: 0, peakPts: 0 }, ai: null, hqB: null, ptsN: 0, rtt: 0, nestT: 0, lastAtk: -99 };
    for (const k of MODKEYS) p.mod[k] = 0;
    W.players.push(p);
    if (!W.teams[p.team]) W.teams[p.team] = { id: p.team, tickets: o.tickets, alive: true, players: [] };
    W.teams[p.team].players.push(i);
  }
  W.teamList = W.teams.filter(Boolean);
  // points (3.0: each dock belongs to the nearest flag)
  for (const dk of M.docks) { let bd = 1e9; for (const mp of M.points) { const d = Math.hypot(mp.x - dk.x, mp.z - dk.z); if (d < bd) { bd = d; dk.pt = mp.id; } } }
  for (const mp of M.points) {
    const pt = { id: mp.id, x: mp.x, z: mp.z, y: mp.y, r: 10, name: mp.name, val: mp.val || 1, hq: mp.hq, home: mp.home, owner: -1, capP: -1, ctrl: 0, slots: [], wall: null, cnt: [0, 0, 0, 0], contested: false, flash: 0 };
    if (mp.big) pt.big = 1; const n = pt.big ? 24 : pt.hq >= 0 ? 6 : 4;
    for (let k = 0; k < n; k++) { const sp = slotPos(pt, k); pt.slots.push({ x: sp[0], z: sp[1], b: null, y: M.H(sp[0], sp[1]) }); }
    for (const dk of M.docks) if (dk.pt === mp.id) pt.slots.push({ x: dk.x, z: dk.z, b: null, y: Math.max(M.H(dk.x, dk.z), M.wl), sea: 1, wx: dk.wx, wz: dk.wz });   // 3.0 coastal build spot (Shipyards only)
    if (M.naval) { pt.coast = snapWater(M, pt.x, pt.z, 46); pt.comp = M.compAt(pt.x, pt.z); }   // where ships can reach this flag from, and which land mass it is on
    for (const sp of defPads(pt)) if (M.inb(sp[0], sp[1]) && Math.abs(sp[0]) < M.hw - 6 && Math.abs(sp[1]) < M.hd - 6 && M.H(sp[0], sp[1]) > M.wl + .3 && !M.blocks.some(bk => Math.hypot(bk.x - sp[0], bk.z - sp[1]) < Math.max(bk.w, bk.d) / 2 + 3.5)) pt.slots.push({ x: sp[0], z: sp[1], b: null, y: M.H(sp[0], sp[1]), d: 1 });
    W.pts.push(pt);
  }
  if (!W.mirror) for (const p of W.players) {
    const pt = W.pts[M.spawnPts[p.spawn]];
    pt.owner = p.id; pt.ctrl = 1; pt.capP = p.id;
    const hq = placeBuilding('hq', p.id, pt, -1, true); p.hqB = hq;
    const home = W.pts.find(q => q.home === p.spawn);
    if (home) { home.owner = p.id; home.ctrl = 1; home.capP = p.id; }
    // starting army
    const ang = Math.atan2(-pt.z, -pt.x);
    const st = ['rifleman', 'rifleman', 'rifleman', 'rifleman', 'rocket', 'rocket', 'engineer', 'jeep'];
    if (o.bigStart) st.push('rifleman', 'rifleman', 'apc', 'heavy');
    st.forEach((t, i) => { const a = ang + (i - st.length / 2) * .35, d = 16 + (i % 2) * 3; const q = snapFree(M, pt.x + Math.cos(a) * d, pt.z + Math.sin(a) * d); spawnUnit(fu(p, t), p.id, q[0], q[1], { rot: ang }); });
  }
  // unused HQ pads become ordinary points
  if (!W.mirror && !o.war) for (const pt of W.pts) if (pt.hq >= 0 && pt.owner < 0) { pt.hq = -1; pt.name = 'Empty Base'; pt.val = 1.5; }
  for (const p of W.players) recalcMods(p);
  W.activeTeams = W.teamList.map(t => t.id);
  battleSetup();
  if (!W.mirror) for (const p of W.players) if (p.kind === 'ai') p.ai = makeAI(p, s_ai(o, p.id));
  if (o.war && !W.mirror) warInit();
  updateVision(); updateVision();
  return W;
}
function s_ai(o, i) { return o.players[i].ai || { pers: 'hale', diff: 'normal' }; }

// ---------------- helpers ----------------
function P(id) { return W.players[id]; }
function hashBuild() {
  const H = W.hash, M = W.M; for (let i = 0; i < H.cells.length; i++) H.cells[i].length = 0;
  const us = W.units; for (let i = 0; i < us.length; i++) { const u = us[i]; const cx = clamp(((u.x + M.hw) / 12) | 0, 0, H.nx - 1), cz = clamp(((u.z + M.hd) / 12) | 0, 0, H.nz - 1); H.cells[cz * H.nx + cx].push(u); }
}
function hashQ(x, z, r, out) {
  out.length = 0; const H = W.hash, M = W.M; const c0 = clamp(((x - r + M.hw) / 12) | 0, 0, H.nx - 1), c1 = clamp(((x + r + M.hw) / 12) | 0, 0, H.nx - 1), r0 = clamp(((z - r + M.hd) / 12) | 0, 0, H.nz - 1), r1 = clamp(((z + r + M.hd) / 12) | 0, 0, H.nz - 1), rr2 = r * r;
  for (let a = r0; a <= r1; a++) for (let b = c0; b <= c1; b++) { const c = H.cells[a * H.nx + b]; for (let i = 0; i < c.length; i++) { const e = c[i]; const dx = e.x - x, dz = e.z - z; if (dx * dx + dz * dz <= rr2) out.push(e); } }
  return out;
}
const vidx = (x, z) => clamp(((z + W.M.hd) / 4) | 0, 0, W.vd - 1) * W.vw + clamp(((x + W.M.hw) / 4) | 0, 0, W.vw - 1);
function seen(team, x, z) { return !W.o.fog || W.vis[team][vidx(x, z)] === 2; }
function explored(team, x, z) { return !W.o.fog || W.vis[team][vidx(x, z)] > 0; }
function markVis(g, x, z, r) {
  const vw = W.vw, M = W.M, c0 = Math.max(0, ((x - r + M.hw) / 4) | 0), c1 = Math.min(vw - 1, ((x + r + M.hw) / 4) | 0), r0 = Math.max(0, ((z - r + M.hd) / 4) | 0), r1 = Math.min(W.vd - 1, ((z + r + M.hd) / 4) | 0), rr2 = r * r;
  for (let a = r0; a <= r1; a++) { const pz = -M.hd + (a + .5) * 4 - z; for (let b = c0; b <= c1; b++) { const px = -M.hw + (b + .5) * 4 - x; if (px * px + pz * pz <= rr2) g[a * vw + b] = 2; } }
}
function bVis(b) { if (b.prog < 1) return 14; if (b.type === 'radar') return BT.radar.vis[b.lvl - 1] * (b.spec === 'scan' ? 1.6 : 1); if (b.type === 'hq') return 46; if (b.type === 'turret' || b.type === 'arty') return 34; return 26; }
function updateVision() {
  if (!W.o.fog) return;
  const us = W.units, bs = W.bld, wx = W.wx, nt = wx.night;
  for (const t of W.activeTeams) {
    const g = W.vis[t]; for (let i = 0; i < g.length; i++) if (g[i] === 2) g[i] = 1;
    for (let i = 0; i < us.length; i++) { const u = us[i]; if (u.team === t) markVis(g, u.x, u.z, u.T.vis * (1 + P(u.owner).mod.vis) * wx.vis); else if (nt && u.firing > 0) markVis(g, u.x, u.z, 3.5); }   // 3.0 night: a muzzle flash shows the shooter to everyone
    for (let i = 0; i < bs.length; i++) { const b = bs[i]; if (b.team === t) { markVis(g, b.x, b.z, bVis(b) * (b.type === 'radar' ? 1 : wx.bvis)); if (nt && SLT[b.type] && b.prog >= 1) { const a = slAng(b), d = slDist(b); markVis(g, b.x + Math.sin(a) * d, b.z + Math.cos(a) * d, 9); } } else if (nt && b.fire > 0) markVis(g, b.x, b.z, 4); }
    for (const rv of W.reveals) if (rv.team === t) markVis(g, rv.x, rv.z, rv.r);
  }
  for (const b of bs) { for (const t of W.activeTeams) if (t !== b.team && W.vis[t][vidx(b.x, b.z)] === 2) b.sb |= 1 << t; }
}
function teamVisible(team, e) { return e.team === team || seen(team, e.x, e.z); }

// ---------------- mods / stats ----------------
function recalcMods(p) {
  const m = p.mod; for (const k of MODKEYS) m[k] = 0;
  for (const id in p.techs) { const t = TECHBY[id]; if (t) for (const k in t.mod) m[k] += t.mod[k]; }
  if (p.perkMod) for (const k in p.perkMod) if (k in m) m[k] += p.perkMod[k];
  const hq = p.hqB; if (hq && hq.spec === 'logi') { m.inc += .25; m.cost -= .08; } if (hq && hq.spec === 'warroom') { m.callCd -= .25; m.xp += .25; }
  m.cost = Math.max(-.5, m.cost);
  for (const u of W.units) if (u.owner === p.id) refreshUnit(u);
  for (const b of W.bld) if (b.owner === p.id) refreshB(b);
}
function uMaxHp(u) { const m = P(u.owner).mod, c = u.T.cls; const f = c === 0 ? m.hpInf : c === 1 ? m.hpVeh : m.hpHvy; return u.T.hp * (1 + f) * VETHP[u.vet] * u.hpB; }
function refreshUnit(u) {
  const nm = uMaxHp(u); if (u.maxHp) u.hp = u.hp / u.maxHp * nm; else u.hp = nm; u.maxHp = nm;
  if (u.T.shp) { const sm = u.T.shp * (1 + P(u.owner).mod.shCap) * VETHP[u.vet] * u.hpB; u.shp = u.shpMax ? u.shp / u.shpMax * sm : sm; u.shpMax = sm; }   // 3.0 Legion energy shield
}
function bMaxHp(b) { let h = BT[b.type].hp[b.lvl - 1]; if (b.type === 'hq' && b.spec === 'fortress') h *= 1.5; if (b.type === 'wall' && b.spec === 'bulwark') h *= 1.8; return h * (1 + P(b.owner).mod.hpBld); }
function refreshB(b) { const nm = bMaxHp(b); if (b.maxHp) b.hp = b.hp / b.maxHp * nm; else b.hp = nm; b.maxHp = nm; b.w = bWeapon(b); }
function unitCost(p, type, b) {
  const T = UT[type]; let c = T.cost * (1 + p.mod.cost);
  if (b) { if (b.spec === 'conscript' && T.cls === 0) c *= .85; if (b.spec === 'rapid' && (T.cls === 1 || T.cls === 2)) c *= .85; if (b.spec === 'convoy') c *= .85; if (b.spec === 'swarm' && DRONES[type]) c *= .6; }
  return Math.round(c);
}
function prodSpeed(b, type) {
  const p = P(b.owner); let s = 1 + p.mod.prod; if (b.spec === 'conscript' || b.spec === 'convoy') s *= 1.4; if (b.spec === 'rapid') s *= 1.5; if (b.spec === 'swarm' && DRONES[type]) s *= 2;
  if (p.ai) s *= p.ai.dif.trainMul || 1;
  const pt = b.pt >= 0 ? W.pts[b.pt] : null; if (pt) for (const sl of pt.slots) if (sl.b && sl.b.type === 'depot' && sl.b.spec === 'logistics' && sl.b.prog >= 1) { s *= 1.25; break; }
  return s;
}
// 2.4 roster system: each production building keeps a roster you pick (how many of each troop). It trains them one at a time,
// paying as each one starts, and replaces any that die. How many troops it can hold grows with its level.
const DRONES = { drone: 1, strike: 1, swarm: 1, seeker: 1 };
function unitCdBase(T) { return clamp(2.5 + T.cost / 55, 3, 12); }
function unitCd(b, type) { return Math.max(1.5, unitCdBase(UT[type]) / prodSpeed(b, type)); }
function rosBase(b) { const r = BT[b.type].ros; return r ? r[b.lvl - 1] + (b.spec === 'conscript' ? 10 : b.spec === 'rapid' ? 4 : b.spec === 'convoy' ? 3 : 0) : 0; }
function rosCap(b) { return rosBase(b) + (b.spec === 'swarm' ? 4 : 0); }         // Drone Factory: 4 extra slots, drones only
function rosTotal(b, noDrones) { let n = 0; if (b.ros) for (const k in b.ros) if (!noDrones || !DRONES[k]) n += b.ros[k]; return n; }
function rosHave(b, type) { return b.have && b.have[type] || 0; }
function rosFits(b, type) { if (rosTotal(b) + 1 > rosCap(b)) return false; if (b.spec === 'swarm' && !DRONES[type] && rosTotal(b, true) + 1 > rosBase(b)) return false; return true; }
function isProd(b) { return !!BT[b.type].ros; }
function refundTraining(b) { b.tr = null; }
// 3.1: a roster slot is bought once (2.5x the unit's price). The building then trains that troop and respawns it for free whenever it dies.
const SLOT_MUL = 2.5;
function slotCost(p, type, b) { return Math.round(unitCost(p, type, b) * SLOT_MUL); }
function popLimit(p) { return Math.min(p.popCap, p.popLim || 1e9); }
function bCount(p, type) { let n = 0; for (const b of W.bld) if (b.owner === p.id && b.type === type && !b.dead) n++; return n; }
// count each building's living troops (run every tick before buildings update)
function countHomes() {
  for (const b of W.bld) if (b.have) for (const k in b.have) b.have[k] = 0;
  for (const u of W.units) { if (u.home && !u.dead) { const b = W.byId.get(u.home); if (b && b.k === 'b' && b.have && b.owner === u.owner) b.have[u.type] = (b.have[u.type] || 0) + 1; } if (u.cargo) for (const c of u.cargo) if (c.home) { const b = W.byId.get(c.home); if (b && b.k === 'b' && b.have && b.owner === c.owner) b.have[c.type] = (b.have[c.type] || 0) + 1; } }   // 3.0: soldiers aboard a Landing Craft still count
}
// b.wait: 0 = fine, 2 = army full, 3 = paused
function rosterTick(b, dt) {
  const p = P(b.owner), sb = W.o.sandbox;
  if (b.tr) {
    const t = b.tr.u;
    if (!b.ros[t] || rosHave(b, t) >= b.ros[t]) { refundTraining(b); return; }
    b.tr.t = Math.min(b.tr.dur, b.tr.t + dt); if (b.tr.t < b.tr.dur) { b.wait = 0; return; }
    if (!sb && p.pop + UT[t].pop > popLimit(p)) { b.wait = 2; return; }      // finished, but no room in the army yet
    b.tr = null; b.wait = 0; deployUnit(b, p, t); b.have[t] = (b.have[t] || 0) + 1; b.made[t] = (b.made[t] || 0) + 1; return;
  }
  if (b.hold) { b.wait = 3; return; }
  let pick = null, best = 0;
  for (const k in b.ros) { const want = b.ros[k], have = rosHave(b, k); if (have >= want || !canTrainAt(b, k)) continue; const sc = (want - have) / want; if (sc > best) { best = sc; pick = k; } }
  if (!pick) { b.wait = 0; return; }
  if (!sb && p.pop + UT[pick].pop > popLimit(p)) { b.wait = 2; return; }
  const re = (b.made[pick] || 0) >= b.ros[pick];      // replacing a fallen troop takes twice as long as the first training
  b.tr = { u: pick, t: 0, dur: unitCd(b, pick) * (re ? 2 : 1), re: re ? 1 : 0, c: 0 }; b.wait = 0;
}
// 2.3 auto-rally: the biggest cluster of the player's combat units (ignoring units parked at an enemy HQ unless that is all there is)
function playerHQLvl(p) { return p.hqB && !p.hqB.dead ? p.hqB.lvl : 0; }
function bestLvl(p, type) { let l = 0; for (const b of W.bld) if (b.owner === p.id && b.type === type && b.prog >= 1 && b.lvl > l) l = b.lvl; return l; }
function bWeapon(b) {
  const L = b.lvl - 1, s = b.spec;
  if (b.type === 'turret') {
    if (s === 'twin') return Wp('bullet', 19, .1, 38);
    if (s === 'at') return Wp('cannon', 250, 1.7, 48, { ps: 80 });
    if (s === 'flak') return Wp('flak', 26, .17, 50, { spl: 3.5 });
    return Wp('bullet', [8, 13, 20][L], [.32, .25, .18][L], [28, 32, 36][L]);
  }
  if (b.type === 'arty') {
    const d = [85, 105, 125][L], rg = [85, 95, 105][L];
    if (s === 'howitzer') return Wp('shell', d * 1.8, 8, rg + 25, { minr: 25, spl: 9, ps: 32, arc: 1 });
    if (s === 'salvo') return Wp('shell', d * .36, 5.5, rg, { minr: 25, spl: 5, ps: 34, arc: 1, shots: 4, scat: 5 });
    if (s === 'shock') return Wp('shell', d * .65, 6, rg, { minr: 25, spl: 8, ps: 32, arc: 1, shock: 1 });
    return Wp('shell', d, 6, rg, { minr: 25, spl: 7, ps: 32, arc: 1 });
  }
  if (b.type === 'cannon') return Wp('cannon', [90, 140, 210][L] * (s === 'hgun' ? 1.4 : s === 'autol' ? .7 : 1), s === 'hgun' ? 3 : s === 'autol' ? 1.1 : 2.2, [40, 44, 48][L] * (s === 'lbarrel' ? 1.25 : 1), { ps: 90 });
  if (b.type === 'flakt') return Wp('flak', [16, 24, 34][L] * (s === 'fheavy' ? 1.2 : 1), [.18, .16, .14][L] / (s === 'fburst' ? 1.5 : 1), [44, 48, 54][L] * (s === 'fradar' ? 1.25 : 1), { spl: s === 'fheavy' ? 5.6 : 3.5, g: 'a' });
  if (b.type === 'mortarpit') return Wp('shell', [45, 65, 90][L], s === 'mrapid' ? 2.2 : 3.4, [50, 55, 60][L], { minr: 10, spl: s === 'mhe' ? 7.5 : 5, ps: 26, arc: 1, shock: s === 'mincend' ? 1 : 0 });
  if (b.type === 'tesla') return Wp('tesla', [32, 48, 70][L] * (s === 'tover' ? 1.4 : 1), [1.5, 1.3, 1.1][L], [22, 25, 28][L], { chain: [3, 4, 5][L] + (s === 'tarc' ? 2 : 0), shock: s === 'tstun' ? 1 : 0 });
  if (b.type === 'hq' && s === 'fortress') return Wp('bullet', 11, .2, 34);
  if (b.type === 'nest') return Wp('bullet', 6, .28, 22);
  return null;
}

