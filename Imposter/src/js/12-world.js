// ==========================================
// WORLD: grid, collision, line of sight, path fields, baked map image
// ==========================================
let MAP = null;
function buildMap(key) {
  if (MAP && MAP.key === key) return MAP;
  const d = MAPS[key] || MAPS.ship, W = d.w, H = d.h, walk = new Uint8Array(W * H), prop = new Uint8Array(W * H), room = new Int8Array(W * H).fill(-1);
  const fill = (x, y, w, h, fn) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < W && j < H) fn(j * W + i); };
  for (const h of d.halls) fill(h[0], h[1], h[2], h[3], k => { walk[k] = 1; });
  d.rooms.forEach((r, ri) => fill(r[1], r[2], r[3], r[4], k => { walk[k] = 1; room[k] = ri; }));
  for (const p of d.props) fill(p[0], p[1], p[2], p[3], k => { walk[k] = 0; prop[k] = 1; });
  const c = t => (t + .5) * TS;
  const stations = d.tasks.map((t, i) => ({ id: i, kind: t[0], tx: t[1], ty: t[2], x: c(t[1]), y: c(t[2]), room: roomNameAt(d, room, W, t[1], t[2]) }));
  const vents = d.vents.map((v, i) => ({ id: i, tx: v[0], ty: v[1], x: c(v[0]), y: c(v[1]), g: v[2], room: roomNameAt(d, room, W, v[0], v[1]) }));
  MAP = {
    key, d, W, H, walk, prop, room, stations, vents, pw: W * TS, ph: H * TS, name: d.name,
    btn: { x: d.btn[0] * TS, y: d.btn[1] * TS }, lights: { x: d.lights[0] * TS, y: d.lights[1] * TS, room: roomNameAt(d, room, W, d.lights[0] | 0, d.lights[1] | 0) },
    reactor: d.reactor.map(p => ({ x: p[0] * TS, y: p[1] * TS, room: roomNameAt(d, room, W, p[0] | 0, p[1] | 0) })),
    fields: new Map(), img: null
  };
  MAP.spawns = [];
  for (let i = 0; i < MAXP; i++) { const a = i / MAXP * TAU + .3; MAP.spawns.push([(d.spawn[0] + Math.cos(a) * d.spawn[2]) * TS, (d.spawn[1] + Math.sin(a) * d.spawn[3]) * TS]); }
  return MAP;
}
function roomNameAt(d, room, W, tx, ty) { const r = room[ty * W + tx]; return r >= 0 ? d.rooms[r][0] : 'the hallway'; }
function roomAt(x, y) { const tx = x / TS | 0, ty = y / TS | 0; if (tx < 0 || ty < 0 || tx >= MAP.W || ty >= MAP.H) return 'outside'; return roomNameAt(MAP.d, MAP.room, MAP.W, tx, ty); }
const walkAt = (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP.W && ty < MAP.H && MAP.walk[ty * MAP.W + tx] === 1;
const opaqueAt = (tx, ty) => tx < 0 || ty < 0 || tx >= MAP.W || ty >= MAP.H || (MAP.walk[ty * MAP.W + tx] === 0 && MAP.prop[ty * MAP.W + tx] === 0);

function blocked(x, y, r) {
  const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (walkAt(tx, ty)) continue;
    const cx = clamp(x, tx * TS, tx * TS + TS), cy = clamp(y, ty * TS, ty * TS + TS);
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}
// move with wall sliding; returns true if it moved
function moveBy(p, dx, dy) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6)); dx /= n; dy /= n; let moved = false;
  for (let i = 0; i < n; i++) {
    if (p.ghost || !blocked(p.x + dx, p.y, PR)) { p.x += dx; moved = true; }
    if (p.ghost || !blocked(p.x, p.y + dy, PR)) { p.y += dy; moved = true; }
    if (p.ghost) { p.x = clamp(p.x, 8, MAP.pw - 8); p.y = clamp(p.y, 8, MAP.ph - 8); }
  }
  return moved;
}
// is the straight line clear of walls? (props do not block sight)
function los(x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 8);
  for (let i = 1; i < n; i++) { const t = i / n; if (opaqueAt(Math.floor((x1 + (x2 - x1) * t) / TS), Math.floor((y1 + (y2 - y1) * t) / TS))) return false; }
  return true;
}
// distance a ray travels from (x,y) at angle a before hitting a wall, up to max (used for the fog polygon)
function rayLen(x, y, a, max) {
  const dx = Math.cos(a), dy = Math.sin(a); let lo = 0, hi = max, hit = false;
  for (let t = 6; t <= max; t += 6) { if (opaqueAt(Math.floor((x + dx * t) / TS), Math.floor((y + dy * t) / TS))) { hi = t; hit = true; break; } lo = t; }
  if (!hit) return max;
  for (let i = 0; i < 4; i++) { const m = (lo + hi) / 2; if (opaqueAt(Math.floor((x + dx * m) / TS), Math.floor((y + dy * m) / TS))) hi = m; else lo = m; }
  return hi + 1;
}

// ---- path fields: BFS distance (in steps) from a target tile, 8 neighbours, no corner cutting ----
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function fieldTo(tx, ty) {
  tx = clamp(tx, 0, MAP.W - 1); ty = clamp(ty, 0, MAP.H - 1);
  const key = ty * MAP.W + tx; let f = MAP.fields.get(key); if (f) return f;
  if (MAP.fields.size > 80) MAP.fields.clear();
  const W = MAP.W; f = new Int16Array(W * MAP.H).fill(-1); const q = new Int32Array(W * MAP.H); let h = 0, t = 0;
  if (!walkAt(tx, ty)) { // nearest walkable tile
    outer: for (let r = 1; r < 6; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (walkAt(tx + i, ty + j)) { tx += i; ty += j; break outer; }
  }
  f[ty * W + tx] = 0; q[t++] = ty * W + tx;
  while (h < t) {
    const k = q[h++], x = k % W, y = (k / W) | 0, dv = f[k];
    for (let n = 0; n < 8; n++) {
      const nx = x + NB[n][0], ny = y + NB[n][1]; if (!walkAt(nx, ny) || f[ny * W + nx] >= 0) continue;
      if (n >= 4 && (!walkAt(x + NB[n][0], y) || !walkAt(x, y + NB[n][1]))) continue;
      f[ny * W + nx] = dv + 1; q[t++] = ny * W + nx;
    }
  }
  MAP.fields.set(key, f); return f;
}
// world point to walk to next, descending the field from (x,y); null when there
function stepFrom(f, x, y) {
  const W = MAP.W, tx = Math.floor(x / TS), ty = Math.floor(y / TS), cur = f[ty * W + tx];
  if (cur === 0) return null;
  let best = cur < 0 ? 1e9 : cur, bx = -1, by = -1;
  if (cur < 0) { // stuck in a wall tile: head to the nearest tile that has a value
    for (let n = 0; n < 8; n++) { const nx = tx + NB[n][0], ny = ty + NB[n][1]; if (walkAt(nx, ny) && f[ny * W + nx] >= 0 && f[ny * W + nx] < best) { best = f[ny * W + nx]; bx = nx; by = ny; } }
  } else for (let n = 0; n < 8; n++) {
    const nx = tx + NB[n][0], ny = ty + NB[n][1]; if (!walkAt(nx, ny)) continue; const v = f[ny * W + nx]; if (v < 0 || v >= best) continue;
    if (n >= 4 && (!walkAt(tx + NB[n][0], ty) || !walkAt(tx, ty + NB[n][1]))) continue;
    best = v; bx = nx; by = ny;
  }
  if (bx < 0) return null;
  // look a little further ahead when the straight way is clear, so paths look smooth
  let px = (bx + .5) * TS, py = (by + .5) * TS;
  for (let s = 0; s < 3; s++) {
    let nb = null, nv = best; const ax = Math.floor(px / TS), ay = Math.floor(py / TS);
    for (let n = 0; n < 8; n++) { const nx = ax + NB[n][0], ny = ay + NB[n][1]; if (!walkAt(nx, ny)) continue; const v = f[ny * W + nx]; if (v < 0 || v >= nv) continue; if (n >= 4 && (!walkAt(ax + NB[n][0], ay) || !walkAt(ax, ay + NB[n][1]))) continue; nv = v; nb = [nx, ny]; }
    if (!nb) break; const qx = (nb[0] + .5) * TS, qy = (nb[1] + .5) * TS;
    if (!walkClear(x, y, qx, qy)) break; px = qx; py = qy; best = nv;
  }
  return [px, py];
}
function walkClear(x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 10);
  for (let i = 1; i <= n; i++) { const t = i / n; if (blocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, PR + 2)) return false; }
  return true;
}
const pathDist = (f, x, y) => { const v = f[Math.floor(y / TS) * MAP.W + Math.floor(x / TS)]; return v < 0 ? 9999 : v; };

// ---- baked picture of the whole map (plank floors, stone walls, foggy windows, lamplight, props, labels) ----
function bakeMap() {
  const M = MAP, cv = document.createElement('canvas'); cv.width = M.pw; cv.height = M.ph; const c = cv.getContext('2d'), W = M.W, H = M.H;
  c.fillStyle = '#070504'; c.fillRect(0, 0, cv.width, cv.height);
  const wk = (x, y) => walkAt(x, y), solidWall = (x, y) => opaqueAt(x, y), hs = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x, px = x * TS, py = y * TS;
    if (M.walk[k] || M.prop[k]) {
      const ri = M.room[k], r = ri >= 0 ? M.d.rooms[ri] : null, h = hs(x, y);
      if (r) { // dark wood planks, laid in rows, joints staggered per row
        c.fillStyle = (y & 1) ? r[5] : r[6]; c.fillRect(px, py, TS, TS);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(px, py, TS, 1.5); c.fillRect(px, py + 16, TS, 1.5);
        const j = ((x * 11 + y * 7) % 3) * 8 + 6; c.fillRect(px + j, py, 1.5, 16); c.fillRect(px + ((j + 14) % 32), py + 16, 1.5, 16);
        c.fillStyle = 'rgba(255,225,170,.05)'; c.fillRect(px, py + 2, TS, 4); c.fillRect(px, py + 18, TS, 4);
        if (h % 5 === 0) { c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(px + 3 + (h >> 4) % 18, py + 8, 7, 1.5); }
      } else { // stone flagstones in the passages
        c.fillStyle = (x + y) & 1 ? '#34302b' : '#2f2b27'; c.fillRect(px, py, TS, TS); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(px, py, TS, 1.5); c.fillRect(px, py, 1.5, TS);
        c.fillStyle = 'rgba(255,255,255,.04)'; c.fillRect(px + 2, py + 2, TS - 4, 3);
        if (h % 7 === 0) { c.fillStyle = 'rgba(120,150,110,.12)'; c.fillRect(px + 4, py + TS - 8, 12, 4); }
      }
      if (solidWall(x, y - 1)) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(px, py, TS, 9); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(px, py + 9, TS, 7); }
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!solidWall(x, y)) continue; const px = x * TS, py = y * TS;
    let near = false; for (let n = 0; n < 8 && !near; n++) near = wk(x + NB[n][0], y + NB[n][1]) || (M.prop[(y + NB[n][1]) * W + x + NB[n][0]] === 1 && x + NB[n][0] >= 0 && x + NB[n][0] < W);
    if (!near) continue;
    if (wk(x, y + 1)) { // wall face: stone blocks, now and then a foggy window
      const g = c.createLinearGradient(0, py, 0, py + TS); g.addColorStop(0, '#6b5f52'); g.addColorStop(.12, '#554b40'); g.addColorStop(1, '#2f2822');
      c.fillStyle = g; c.fillRect(px, py, TS, TS); c.fillStyle = 'rgba(255,230,180,.16)'; c.fillRect(px, py, TS, 3);
      c.fillStyle = 'rgba(0,0,0,.3)'; const o = (x & 1) * 8; c.fillRect(px, py + 11, TS, 1.5); c.fillRect(px, py + 22, TS, 1.5); c.fillRect(px + 8 + o, py + 3, 1.5, 8); c.fillRect(px + 22 - o, py + 12, 1.5, 10); c.fillRect(px + 12 + o, py + 23, 1.5, 9);
      if (hs(x, y) % 6 === 0 && wk(x, y + 1) && wk(x + 1, y + 1) !== undefined) {
        const wg = c.createLinearGradient(0, py + 4, 0, py + 26); wg.addColorStop(0, '#9fb3b4'); wg.addColorStop(1, '#5d7274');
        c.fillStyle = '#20170f'; rr(c, px + 5, py + 3, TS - 10, 23, 8); c.fill(); c.fillStyle = wg; rr(c, px + 7, py + 5, TS - 14, 19, 6); c.fill();
        c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(px + 13, py + 12, 5, 3, -.3, 0, TAU); c.fill(); c.fillRect(px + 7, py + 14, TS - 14, 6);
        c.fillStyle = '#20170f'; c.fillRect(px + TS / 2 - 1, py + 5, 2, 19); c.fillRect(px + 7, py + 13, TS - 14, 2);
      }
    } else { c.fillStyle = '#16100c'; c.fillRect(px, py, TS, TS); c.fillStyle = '#1f1711'; c.fillRect(px + 2, py + 2, TS - 4, TS - 4); }
    c.fillStyle = BRASS_D;
    if (wk(x - 1, y)) c.fillRect(px + TS - 3, py, 3, TS);
    if (wk(x + 1, y)) c.fillRect(px, py, 3, TS);
    if (wk(x, y - 1)) c.fillRect(px, py + TS - 3, TS, 3);
  }
  for (const r of M.d.rooms) { // lamplight pooled in the middle of each room
    const cx = (r[1] + r[3] / 2) * TS, cy = (r[2] + r[4] / 2) * TS, rad = Math.max(r[3], r[4]) * TS * .62, g = c.createRadialGradient(cx, cy, 10, cx, cy, rad);
    g.addColorStop(0, 'rgba(255,196,100,.16)'); g.addColorStop(1, 'rgba(255,160,60,0)'); c.fillStyle = g; c.fillRect(r[1] * TS, r[2] * TS, r[3] * TS, r[4] * TS);
  }
  for (const p of M.d.props) drawProp(c, p[0] * TS, p[1] * TS, p[2] * TS, p[3] * TS, p[4]);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = 'italic 700 25px Georgia,"Palatino Linotype",serif';
  for (const r of M.d.rooms) { c.fillStyle = 'rgba(255,225,160,.13)'; c.fillText(r[0], (r[1] + r[3] / 2) * TS, (r[2] + r[4] - 1.2) * TS); }
  M.img = cv;
}
