
'use strict';
// =====================================================================
//  CANVAS + VIEW (the 960 x 600 board scaled to fit any window)
// =====================================================================
const canvas = $('game-canvas'), ctx = canvas.getContext('2d');
const view = { scale: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
let bg = null, bgDirty = true;
function markBgDirty() { bgDirty = true; }
function resize() {
  const st = $('stage'); const r = st.getBoundingClientRect();
  view.cw = Math.max(50, r.width); view.ch = Math.max(50, r.height);
  view.dpr = Math.min(2, (window.devicePixelRatio || 1)) * S.res;
  canvas.width = Math.round(view.cw * view.dpr); canvas.height = Math.round(view.ch * view.dpr);
  view.scale = Math.min(view.cw / W, view.ch / H);
  view.ox = (view.cw - W * view.scale) / 2; view.oy = (view.ch - H * view.scale) / 2;
  markBgDirty();
}
function toWorld(cx, cy) { return { x: (cx - view.ox) / view.scale, y: (cy - view.oy) / view.scale }; }
function toScreen(x, y) { return { x: x * view.scale + view.ox, y: y * view.scale + view.oy }; }
function worldTransform(c) { const k = view.dpr * view.scale; c.setTransform(k, 0, 0, k, view.dpr * view.ox, view.dpr * view.oy); }

// =====================================================================
//  STATIC BACKGROUND (drawn once per map / resize, then copied)
// =====================================================================
function renderBackground() {
  const k = view.dpr * view.scale;
  if (!bg) bg = document.createElement('canvas');
  bg.width = Math.max(1, Math.round(W * k)); bg.height = Math.max(1, Math.round(H * k));
  const b = bg.getContext('2d'); b.setTransform(k, 0, 0, k, 0, 0);
  paintBoard(b, G);
  bgDirty = false;
}
// the ground, terrain, roads, bridges, scenery, warp gates and the base of a board (the game, or the Map Editor's preview)
function paintBoard(b, G) {
  const th = G.theme;
  b.fillStyle = th.ground; b.fillRect(0, 0, W, H);
  for (const bl of G.blotches) { b.globalAlpha = bl.a; b.fillStyle = th.ground2; b.beginPath(); b.arc(bl.x, bl.y, bl.r, 0, 6.283); b.fill(); }
  b.globalAlpha = 1;
  b.lineJoin = 'round'; b.lineCap = 'round';
  drawTerrain(b, G.water, th, 1);
  // paths: dark edge, then the road, then a subtle center line
  for (const p of G.paths) { strokePath(b, p, 46, th.edge); }
  for (const p of G.paths) { strokePath(b, p, 38, th.path); }
  b.setLineDash([10, 14]); for (const p of G.paths) strokePath(b, p, 2, 'rgba(255,255,255,0.12)'); b.setLineDash([]);
  // bridges where a road crosses water or lava: planks and two rails
  for (const r of G.bridges) {
    const nx = -r.dy, ny = r.dx, ex = r.dx * 8, ey = r.dy * 8, x1 = r.x1 - ex, y1 = r.y1 - ey, x2 = r.x2 + ex, y2 = r.y2 + ey, len = Math.hypot(x2 - x1, y2 - y1);
    b.lineCap = 'butt'; b.strokeStyle = 'rgba(0,0,0,0.22)'; b.lineWidth = 1.5;
    for (let k = 0; k <= len; k += 7) { const px = x1 + r.dx * k, py = y1 + r.dy * k; b.beginPath(); b.moveTo(px + nx * 18, py + ny * 18); b.lineTo(px - nx * 18, py - ny * 18); b.stroke(); }
    b.strokeStyle = '#4e342e'; b.lineWidth = 4;
    for (const sd of [-21, 21]) { b.beginPath(); b.moveTo(x1 + nx * sd, y1 + ny * sd); b.lineTo(x2 + nx * sd, y2 + ny * sd); b.stroke(); }
    b.fillStyle = '#3e2723'; for (const sd of [-21, 21]) for (let k = 0; k <= len; k += 22) { b.beginPath(); b.arc(x1 + r.dx * k + nx * sd, y1 + r.dy * k + ny * sd, 3, 0, 6.283); b.fill(); }
    b.lineCap = 'round';
  }
  for (const o of G.obstacles) if (S.scenery || o.fixed) drawDeco(b, o);       // scenery placed in the Map Editor is part of the map: always shown
  // enemy warp gates (where the waves arrive)
  for (const p of G.paths) { const s0 = p.pts[0]; const a1 = p.pts[1]; const ang = Math.atan2(a1.y - s0.y, a1.x - s0.x); const px = clamp(s0.x + Math.cos(ang) * 30, 14, W - 14), py = clamp(s0.y + Math.sin(ang) * 30, 14, H - 14);
    b.fillStyle = 'rgba(155,89,182,0.35)'; b.beginPath(); b.arc(px, py, 24, 0, 6.283); b.fill(); b.strokeStyle = '#9b59b6'; b.lineWidth = 3; b.beginPath(); b.arc(px, py, 18, 0, 6.283); b.stroke();
    b.strokeStyle = 'rgba(224,170,255,0.8)'; b.lineWidth = 1.5; b.beginPath(); b.arc(px, py, 11, 0.4, 2.4); b.stroke(); b.beginPath(); b.arc(px, py, 11, 3.5, 5.5); b.stroke();
    b.save(); b.translate(px, py); b.rotate(ang); b.strokeStyle = '#ead7f5'; b.lineWidth = 2.5; b.lineCap = 'butt'; for (const o of [-4, 4]) { b.beginPath(); b.moveTo(o - 3, -6); b.lineTo(o + 3, 0); b.lineTo(o - 3, 6); b.stroke(); } b.restore(); }
  // your base: a sandbagged command bunker
  if (!G.base) return;
  const bx = G.base.x, by = G.base.y;
  b.fillStyle = '#7d6f4a'; for (let i = 0; i < 14; i++) { const a2 = i / 14 * 6.283; b.beginPath(); b.ellipse(bx + Math.cos(a2) * 29, by + Math.sin(a2) * 29, 7, 4.5, a2 + 1.57, 0, 6.283); b.fill(); }
  b.fillStyle = '#4d5a4a'; roundRect(b, bx - 24, by - 24, 48, 48, 6); b.fill();
  b.fillStyle = '#66745f'; roundRect(b, bx - 19, by - 19, 38, 38, 4); b.fill();
  b.fillStyle = '#22272b'; b.fillRect(bx - 14, by - 3, 28, 6);
  b.fillStyle = '#3e4a3b'; b.fillRect(bx - 19, by + 8, 38, 3); b.fillRect(bx - 19, by - 11, 38, 3);
  b.fillStyle = '#3e3a2c'; b.fillRect(bx + 10, by - 24, 2, 17); b.fillStyle = '#2e86c1'; b.beginPath(); b.moveTo(bx + 12, by - 24); b.lineTo(bx + 22, by - 20); b.lineTo(bx + 12, by - 16); b.fill();
}
// rivers, lakes, lava, ice, mud and craters (background and map previews). k = scale (1 on the board)
function drawTerrain(c, list, th, k) {
  if (!list || !list.length) return;
  const shape = (f, grow) => {
    c.beginPath();
    if (f.kind === 'lake') c.ellipse(f.x * k, f.y * k, Math.max(1, (f.rx + grow) * k), Math.max(1, (f.ry + grow) * k), 0, 0, 6.283);
    else { f.pts.forEach((q, i) => i ? c.lineTo(q.x * k, q.y * k) : c.moveTo(q.x * k, q.y * k)); if (f.kind === 'poly') c.closePath(); }
  };
  const paint = (f, color, grow) => { shape(f, grow); if (f.kind === 'river') { c.strokeStyle = color; c.lineWidth = Math.max(1, (f.w + grow * 2) * k); c.stroke(); } else { if (grow && f.kind === 'poly') { c.strokeStyle = color; c.lineWidth = grow * 2 * k; c.stroke(); } c.fillStyle = color; c.fill(); } };
  for (const f of list) {
    const T = TERRAIN[f.t], fill = f.t === 'water' && th.water ? th.water : T.fill;
    if (f.kind === 'grid') { drawGridTerrain(c, f, T, fill, k); continue; }
    if (f.t === 'crater') { paint(f, T.shore, 4); paint(f, T.fill, 0); c.globalAlpha = 0.35; c.fillStyle = '#000'; if (f.kind === 'lake') { c.beginPath(); c.ellipse((f.x + f.rx * 0.15) * k, (f.y + f.ry * 0.18) * k, f.rx * 0.75 * k, f.ry * 0.7 * k, 0, 0, 6.283); c.fill(); } c.globalAlpha = 1; continue; }
    paint(f, f.t === 'lava' ? '#2a120c' : f.t === 'ice' ? '#a9cbd9' : f.t === 'mud' ? T.shore : shade(fill, 0.75), 5);
    paint(f, fill, 0);
    // a lighter core: rippling water, glowing lava, shiny ice, wet mud
    c.globalAlpha = f.t === 'lava' ? 0.8 : 0.25;
    if (f.kind === 'river') { shape(f, 0); c.strokeStyle = f.t === 'lava' ? '#ffca28' : '#ffffff'; c.lineWidth = Math.max(1, f.w * 0.3 * k); c.stroke(); }
    else if (f.kind === 'lake') { c.fillStyle = f.t === 'lava' ? '#ffca28' : f.t === 'mud' ? '#7a6644' : '#ffffff'; c.beginPath(); c.ellipse((f.x - f.rx * 0.15) * k, (f.y - f.ry * 0.15) * k, f.rx * 0.5 * k, f.ry * 0.45 * k, 0, 0, 6.283); c.fill(); }
    c.globalAlpha = 1;
    if (k === 1 && f.t === 'ice' && f.kind === 'lake') { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3; c.beginPath(); c.moveTo(f.x + Math.cos(a) * f.rx * 0.15, f.y + Math.sin(a) * f.ry * 0.15); c.lineTo(f.x + Math.cos(a + 0.3) * f.rx * 0.55, f.y + Math.sin(a + 0.3) * f.ry * 0.55); c.lineTo(f.x + Math.cos(a) * f.rx * 0.85, f.y + Math.sin(a) * f.ry * 0.85); c.stroke(); } }
    if (k === 1 && f.t === 'water' && f.kind !== 'river') {
      let cx = f.x, cy = f.y, hx = f.rx * 0.6, hy = f.ry * 0.5;
      if (f.kind === 'poly') { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of f.pts) { x0 = Math.min(x0, clamp(q.x, 0, W)); x1 = Math.max(x1, clamp(q.x, 0, W)); y0 = Math.min(y0, clamp(q.y, 0, H)); y1 = Math.max(y1, clamp(q.y, 0, H)); } cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; hx = (x1 - x0) * 0.4; hy = (y1 - y0) * 0.3; }
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 1.5;
      for (let i = 0; i < (f.kind === 'poly' ? 14 : 7); i++) { c.beginPath(); c.arc(cx + Math.cos(i * 2.4) * hx, cy + Math.sin(i * 1.7) * hy, 9, 3.6, 5.8); c.stroke(); }
    }
    if (k === 1 && f.t === 'mud') { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(f.x + Math.cos(i * 2.2) * f.rx * 0.6, f.y + Math.sin(i * 1.3) * f.ry * 0.55, 3 + (i % 3) * 2, 0, 6.283); c.fill(); } }
  }
}
// 3.0: tiles painted in the Map Editor. Neighbouring tiles merge into one shape with rounded outside corners.
function drawGridTerrain(c, f, T, fill, k) {
  const cells = f.cells, s = GRID * k, N = GW * GH;
  const has = (col, row) => col >= 0 && row >= 0 && col < GW && row < GH && cells[row * GW + col] === 1;
  const tile = (i, grow, rad) => {
    const col = i % GW, row = (i / GW) | 0, x0 = col * s - grow, y0 = row * s - grow, x1 = x0 + s + grow * 2, y1 = y0 + s + grow * 2;
    const up = has(col, row - 1), dn = has(col, row + 1), lf = has(col - 1, row), rt = has(col + 1, row);
    const tl = !up && !lf ? rad : 0, tr = !up && !rt ? rad : 0, br = !dn && !rt ? rad : 0, bl = !dn && !lf ? rad : 0;
    c.moveTo(x0 + tl, y0); c.lineTo(x1 - tr, y0); if (tr) c.arcTo(x1, y0, x1, y0 + tr, tr);
    c.lineTo(x1, y1 - br); if (br) c.arcTo(x1, y1, x1 - br, y1, br);
    c.lineTo(x0 + bl, y1); if (bl) c.arcTo(x0, y1, x0, y1 - bl, bl);
    c.lineTo(x0, y0 + tl); if (tl) c.arcTo(x0, y0, x0 + tl, y0, tl); c.closePath();
  };
  const layer = (color, grow, rad) => { c.fillStyle = color; c.beginPath(); for (let i = 0; i < N; i++) if (cells[i]) tile(i, grow, rad); c.fill(); };
  const t = f.t;
  layer(t === 'lava' ? '#2a120c' : t === 'ice' ? '#a9cbd9' : t === 'mud' || t === 'crater' ? T.shore : shade(fill, 0.75), 5 * k, 14 * k);
  layer(fill, 0.6 * k, 11 * k);
  // a lighter core (glowing lava, wet mud, a deep crater) and a little texture on every tile
  if (t === 'lava' || t === 'mud' || t === 'crater') {
  c.globalAlpha = t === 'lava' ? 0.75 : t === 'crater' ? 0.35 : 0.25;
  c.fillStyle = t === 'lava' ? '#ffca28' : t === 'mud' ? '#7a6644' : t === 'crater' ? '#000' : '#ffffff';
  c.beginPath();
  for (let i = 0; i < N; i++) if (cells[i]) { const x = (i % GW + 0.5) * s + (i % 3) * k, y = (((i / GW) | 0) + 0.5) * s + ((i >> 2) % 3) * k, r = s * (t === 'crater' ? 0.32 : 0.22); c.moveTo(x + r, y); c.ellipse(x, y, r, r * 0.75, 0, 0, 6.283); }
  c.fill(); c.globalAlpha = 1;
  }
  if (k < 0.6) return;
  c.lineWidth = 1.2 * k;
  for (let i = 0; i < N; i++) if (cells[i]) {
    const x = (i % GW) * s, y = ((i / GW) | 0) * s, h = (i * 2654435761) >>> 0;
    if (t === 'water' && h % 3 === 0) { c.strokeStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(x + s * (0.3 + (h % 5) * 0.1), y + s * 0.55, 7 * k, 3.6, 5.8); c.stroke(); }
    else if (t === 'ice') { c.strokeStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.moveTo(x + s * 0.2, y + s * (0.3 + (h % 4) * 0.1)); c.lineTo(x + s * 0.5, y + s * 0.45); c.lineTo(x + s * 0.8, y + s * (0.25 + (h % 3) * 0.15)); c.stroke(); }
    else if (t === 'mud') { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(x + s * (0.25 + (h % 5) * 0.1), y + s * (0.3 + (h % 4) * 0.12), (3 + h % 3) * k, 0, 6.283); c.fill(); }
    else if (t === 'lava' && h % 2 === 0) { c.fillStyle = '#fff3c4'; c.globalAlpha = 0.6; c.beginPath(); c.arc(x + s * (0.3 + (h % 4) * 0.12), y + s * (0.35 + (h % 3) * 0.12), 2.2 * k, 0, 6.283); c.fill(); c.globalAlpha = 1; }
  }
}
function strokePath(c, p, w, color) { c.strokeStyle = color; c.lineWidth = w; c.beginPath(); c.moveTo(p.pts[0].x, p.pts[0].y); for (let i = 1; i < p.pts.length; i++) c.lineTo(p.pts[i].x, p.pts[i].y); c.stroke(); }
function drawDeco(c, o) {
  const x = o.x, y = o.y, r = o.r;
  c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(x + 3, y + r * 0.6, r, r * 0.45, 0, 0, 6.283); c.fill();
  if (o.kind === 'tree' || o.kind === 'bush') { c.fillStyle = o.kind === 'bush' ? '#2e8b3e' : '#1e6b2c'; c.beginPath(); c.arc(x, y, r, 0, 6.283); c.fill(); c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 6.283); c.fill(); }
  else if (o.kind === 'pine') { c.fillStyle = '#1b5e20'; c.beginPath(); c.moveTo(x, y - r * 1.3); c.lineTo(x + r, y + r * 0.6); c.lineTo(x - r, y + r * 0.6); c.fill(); c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.moveTo(x, y - r * 1.3); c.lineTo(x + r * 0.4, y - r * 0.4); c.lineTo(x - r * 0.4, y - r * 0.4); c.fill(); }
  else if (o.kind === 'cactus') { c.fillStyle = '#4caf50'; c.fillRect(x - 3, y - r, 6, r * 1.8); c.fillRect(x - r * 0.7, y - r * 0.4, r * 0.7, 4); c.fillRect(x - r * 0.7, y - r * 0.9, 4, r * 0.55); c.fillRect(x, y - r * 0.2, r * 0.7, 4); c.fillRect(x + r * 0.7 - 4, y - r * 0.6, 4, r * 0.45); }
  else if (o.kind === 'crystal') { c.fillStyle = '#8e7cc3'; c.beginPath(); c.moveTo(x, y - r * 1.2); c.lineTo(x + r * 0.6, y); c.lineTo(x, y + r * 0.6); c.lineTo(x - r * 0.6, y); c.fill(); c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(x, y - r * 1.2); c.lineTo(x + r * 0.2, y); c.lineTo(x, y + r * 0.6); c.fill(); }
  else if (o.kind === 'wreck') { c.fillStyle = '#3b3f3a'; c.fillRect(x - r, y - r * 0.55, r * 2, r * 1.1); c.fillStyle = '#2a2d2a'; c.fillRect(x - r * 0.2, y - r * 0.8, r * 1.0, r * 0.7); c.fillStyle = '#6d4c41'; c.fillRect(x - r * 0.9, y + r * 0.2, r * 0.8, r * 0.25); c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.arc(x + r * 0.3, y - r * 0.2, r * 0.3, 0, 6.283); c.fill(); }
  else if (o.kind === 'ruin') {              // a shelled building: broken walls, empty windows
    c.fillStyle = '#76797d'; c.beginPath(); c.moveTo(x - r, y + r * 0.8); c.lineTo(x - r, y - r * 0.6); c.lineTo(x - r * 0.5, y - r * 0.9); c.lineTo(x - r * 0.1, y - r * 0.4); c.lineTo(x + r * 0.4, y - r * 1.0); c.lineTo(x + r, y - r * 0.5); c.lineTo(x + r, y + r * 0.8); c.fill();
    c.fillStyle = '#4b4e52'; c.fillRect(x - r, y + r * 0.35, r * 2, r * 0.45); c.fillStyle = '#1e2124'; for (const [a, b] of [[-0.7, -0.3], [0.1, -0.2], [-0.35, 0.05], [0.5, 0.0]]) c.fillRect(x + a * r, y + b * r, r * 0.28, r * 0.3);
    c.fillStyle = '#9a9da1'; c.beginPath(); c.arc(x + r * 0.9, y + r * 0.85, r * 0.25, 0, 6.283); c.arc(x - r * 0.75, y + r * 0.9, r * 0.2, 0, 6.283); c.fill(); }
  else if (o.kind === 'rubble') { for (let i = 0; i < 5; i++) { const a = i * 1.3 + o.s * 6, d = r * (0.25 + (i % 3) * 0.25); c.fillStyle = i % 2 ? '#8a8c8f' : '#6a6d70'; c.beginPath(); c.moveTo(x + Math.cos(a) * d - r * 0.3, y + Math.sin(a) * d); c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d - r * 0.35); c.lineTo(x + Math.cos(a) * d + r * 0.3, y + Math.sin(a) * d + r * 0.1); c.fill(); } }
  else if (o.kind === 'crate') { c.fillStyle = '#8d6e63'; c.fillRect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); c.strokeStyle = '#5d4037'; c.lineWidth = 2; c.strokeRect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6); c.beginPath(); c.moveTo(x - r * 0.8, y - r * 0.8); c.lineTo(x + r * 0.8, y + r * 0.8); c.moveTo(x + r * 0.8, y - r * 0.8); c.lineTo(x - r * 0.8, y + r * 0.8); c.stroke(); }
  else if (o.kind === 'car') { c.save(); c.translate(x, y); c.rotate(o.s * 6.283); c.fillStyle = '#3b3b3b'; roundRect(c, -r, -r * 0.5, r * 2, r, r * 0.25); c.fill(); c.fillStyle = '#6d4c41'; c.fillRect(-r * 0.9, -r * 0.45, r * 0.5, r * 0.9); c.fillStyle = '#151515'; c.fillRect(-r * 0.15, -r * 0.38, r * 0.6, r * 0.76); c.restore(); }
  else if (o.kind === 'reed') { c.strokeStyle = '#7f8f3a'; c.lineWidth = 1.6; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * r * 0.25, y + r * 0.6); c.lineTo(x + i * r * 0.4, y - r * (0.8 + (i & 1) * 0.3)); c.stroke(); } c.fillStyle = '#5d4037'; for (const i of [-1, 1]) { c.beginPath(); c.ellipse(x + i * r * 0.4, y - r * 0.75, 1.8, 4, 0, 0, 6.283); c.fill(); } }
  else if (o.kind === 'deadtree') { c.strokeStyle = '#5a4f45'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + r * 0.6); c.lineTo(x, y - r * 0.6); c.moveTo(x, y - r * 0.1); c.lineTo(x - r * 0.7, y - r * 0.8); c.moveTo(x, y - r * 0.3); c.lineTo(x + r * 0.6, y - r); c.moveTo(x, y + r * 0.1); c.lineTo(x + r * 0.7, y - r * 0.2); c.stroke(); }
  else if (o.kind === 'vent') { c.fillStyle = '#211a18'; c.beginPath(); c.ellipse(x, y, r, r * 0.75, 0, 0, 6.283); c.fill(); c.fillStyle = '#ff7043'; c.beginPath(); c.ellipse(x, y, r * 0.45, r * 0.3, 0.4, 0, 6.283); c.fill(); c.fillStyle = '#ffca28'; c.beginPath(); c.ellipse(x, y, r * 0.2, r * 0.13, 0.4, 0, 6.283); c.fill(); }
  else if (o.kind === 'spire') { c.fillStyle = '#17141a'; c.beginPath(); c.moveTo(x - r * 0.55, y + r * 0.6); c.lineTo(x - r * 0.1, y - r * 1.3); c.lineTo(x + r * 0.55, y + r * 0.6); c.fill(); c.fillStyle = 'rgba(149,117,205,0.45)'; c.beginPath(); c.moveTo(x - r * 0.1, y - r * 1.3); c.lineTo(x + r * 0.1, y + r * 0.5); c.lineTo(x - r * 0.3, y + r * 0.5); c.fill(); }
  else if (o.kind === 'crater') { c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.ellipse(x, y, r * 1.1, r * 0.8, 0, 0, 6.283); c.fill(); c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + r * 0.1, y + r * 0.08, r * 0.8, r * 0.55, 0, 0, 6.283); c.fill(); }
  else if (o.kind === 'dish') { c.strokeStyle = '#90a4ae'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + r * 0.6); c.lineTo(x, y - r * 0.1); c.stroke(); c.fillStyle = '#cfd8dc'; c.beginPath(); c.ellipse(x, y - r * 0.3, r * 0.8, r * 0.45, -0.5, 0, 6.283); c.fill(); c.fillStyle = '#ff5252'; c.beginPath(); c.arc(x + r * 0.15, y - r * 0.45, 2, 0, 6.283); c.fill(); }
  else if (o.kind === 'mesa') { c.fillStyle = '#8f4a28'; c.beginPath(); c.moveTo(x - r * 1.1, y + r * 0.6); c.lineTo(x - r * 0.7, y - r * 0.6); c.lineTo(x + r * 0.7, y - r * 0.6); c.lineTo(x + r * 1.1, y + r * 0.6); c.fill(); c.fillStyle = '#c97c4b'; c.beginPath(); c.ellipse(x, y - r * 0.6, r * 0.7, r * 0.22, 0, 0, 6.283); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - r * 0.85, y); c.lineTo(x + r * 0.85, y); c.stroke(); }
  else if (o.kind === 'hedgehog') { c.strokeStyle = '#3d4246'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - r * 0.8, y - r * 0.6); c.lineTo(x + r * 0.8, y + r * 0.6); c.moveTo(x + r * 0.8, y - r * 0.6); c.lineTo(x - r * 0.8, y + r * 0.6); c.moveTo(x, y - r * 0.9); c.lineTo(x, y + r * 0.7); c.stroke(); }
  else if (o.kind === 'palm') { c.strokeStyle = '#8d6e3f'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - r * 0.2, y + r * 0.6); c.quadraticCurveTo(x + r * 0.3, y, x, y - r * 0.4); c.stroke(); c.fillStyle = '#2e7d32'; for (let i = 0; i < 5; i++) { const a = i * 1.257 + o.s; c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.55, y - r * 0.4 + Math.sin(a) * r * 0.45, r * 0.6, r * 0.18, a, 0, 6.283); c.fill(); } }
  else if (o.kind === 'fern') { c.fillStyle = '#2f8f45'; for (let i = 0; i < 7; i++) { const a = i * 0.9 + o.s * 3; c.beginPath(); c.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.55, r * 0.16, a, 0, 6.283); c.fill(); } c.fillStyle = '#1b5e20'; c.beginPath(); c.arc(x, y, r * 0.25, 0, 6.283); c.fill(); }
  else if (o.kind === 'bunker') { c.fillStyle = '#8a8a80'; c.beginPath(); c.arc(x, y + r * 0.3, r, Math.PI, 0); c.fill(); c.fillStyle = '#1c1c1c'; c.fillRect(x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.2); }
  else if (o.kind === 'barrel') { for (const [a, b, col] of [[-0.4, 0.1, '#c0392b'], [0.4, 0.2, '#2e86c1'], [0, -0.45, '#7f8c8d']]) { c.fillStyle = col; c.beginPath(); c.arc(x + a * r, y + b * r, r * 0.45, 0, 6.283); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.beginPath(); c.arc(x + a * r, y + b * r, r * 0.3, 0, 6.283); c.stroke(); } }
  else if (o.kind === 'pipe') { c.save(); c.translate(x, y); c.rotate(o.s * 3.14); c.fillStyle = '#7d8a8f'; c.fillRect(-r, -r * 0.3, r * 2, r * 0.6); c.fillStyle = '#5b666b'; c.fillRect(-r * 0.25, -r * 0.42, r * 0.5, r * 0.84); c.fillRect(-r, -r * 0.38, r * 0.18, r * 0.76); c.restore(); }
  else if (o.kind === 'chimney') { c.fillStyle = '#7b3f2a'; c.fillRect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4); c.fillStyle = '#5a2c1d'; for (let i = -1; i <= 1; i++) c.fillRect(x - r * 0.7, y + i * r * 0.4, r * 1.4, 1.5); c.fillStyle = '#141414'; c.beginPath(); c.arc(x, y, r * 0.4, 0, 6.283); c.fill(); }
  else { c.fillStyle = '#7b7d7d'; c.beginPath(); c.moveTo(x - r, y + r * 0.3); c.lineTo(x - r * 0.5, y - r * 0.7); c.lineTo(x + r * 0.4, y - r * 0.8); c.lineTo(x + r, y); c.lineTo(x + r * 0.5, y + r * 0.6); c.fill(); c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.moveTo(x - r * 0.5, y - r * 0.7); c.lineTo(x + r * 0.4, y - r * 0.8); c.lineTo(x, y - r * 0.2); c.fill(); }
}

// =====================================================================
//  TOWER + ENEMY ART (also used for the shop and codex icons)
// =====================================================================
function shade(hex, k) {
  if (hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  r = clamp(Math.round(r * k), 0, 255); g = clamp(Math.round(g * k), 0, 255); b = clamp(Math.round(b * k), 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function drawTowerArt(c, def, x, y, s, angle, recoil, level, spec, t) {
  const col = def.color, dark = shade(col, 0.55), k = def.kind;
  c.save(); c.translate(x, y); c.scale(s, s);
  if (k === 'fence') {
    if (def.id === 'sandbag') { c.fillStyle = '#8a7648'; for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-13.5 + i * 9 + (row % 2) * 4.5, -8 + row * 7, 5.4, 3.6, 0, 0, 6.283); c.fill(); } c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(-13.5 + i * 9 + (row % 2) * 4.5, -8 + row * 7, 5.4, 3.6, 0, 0, 6.283); c.stroke(); } }
    else if (def.id === 'concrete') { c.fillStyle = '#7f8c8d'; c.fillRect(-18, -8, 36, 16); c.fillStyle = '#a4b0b3'; c.fillRect(-18, -8, 36, 4); c.strokeStyle = '#59656b'; c.lineWidth = 1.2; for (let i = -9; i <= 9; i += 9) { c.beginPath(); c.moveTo(i, -8); c.lineTo(i, 8); c.stroke(); } c.strokeRect(-18, -8, 36, 16); }
    else { c.fillStyle = '#263238'; c.fillRect(-20, -11, 40, 22); c.fillStyle = '#455a64'; c.fillRect(-17, -8, 34, 16); c.rotate(angle); c.fillStyle = '#90a4ae'; c.fillRect(0, -3, 16, 6); c.fillStyle = '#37474f'; c.beginPath(); c.arc(0, 0, 6, 0, 6.283); c.fill(); c.rotate(-angle); }
    if (spec) fenceSpecMark(c, def.id, spec, t);
    c.restore(); return;
  }
  if (k === 'trap') { drawTrap(c, def, spec, t); c.restore(); return; }
  if (k === 'mine' && def.warp) {        // warp mine: a small portal disc
    c.fillStyle = '#1a0f33'; c.beginPath(); c.arc(0, 0, 9, 0, 6.283); c.fill();
    c.strokeStyle = '#b388ff'; c.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const a = (t || 0) / 14 + i * 2.094; c.beginPath(); c.arc(0, 0, 8, a, a + 1.2); c.stroke(); }
    glowDot(c, 0, 0, 2.6 + Math.sin((t || 0) / 8) * 0.6, '#ea80fc');
    if (spec === 2) { c.strokeStyle = '#ffd54f'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 11.5, 0, 6.283); c.stroke(); }
    c.restore(); return; }
  if (k === 'mine') { c.fillStyle = '#455a64'; c.beginPath(); c.arc(0, 0, 8, 0, 6.283); c.fill(); c.fillStyle = (t || 0) % 40 < 20 ? '#ff5252' : '#7f0000'; c.beginPath(); c.arc(0, 0, 3, 0, 6.283); c.fill();
    if (spec === 1) { c.fillStyle = '#f39c12'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(Math.cos(i * 1.57) * 10, Math.sin(i * 1.57) * 10, 2.2, 0, 6.283); c.fill(); } }
    else if (spec === 2) { c.strokeStyle = '#a5d8ff'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 11, 0, 6.283); c.stroke(); }
    else if (spec === 3) { c.strokeStyle = '#2ecc71'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 11, -1.2, 3.4); c.stroke(); }
    c.restore(); return; }
  if (k === 'tank') { c.rotate(angle || 0); drawTankBody(c, 0); c.restore(); return; }
  if (def.era === 'alien') { alienTowerArt(c, def, angle, recoil, spec, t || 0); c.restore(); return; }
  // base plate
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(2, 13, 15, 5, 0, 0, 6.283); c.fill();
  c.fillStyle = '#2d3436'; roundRect(c, -15, -15, 30, 30, 6); c.fill();
  c.strokeStyle = def.super ? '#f1c40f' : dark; c.lineWidth = 2; roundRect(c, -15, -15, 30, 30, 6); c.stroke();
  if (k === 'income') {
    if (def.id === 'farm') { c.fillStyle = '#8bc34a'; c.fillRect(-11, -11, 22, 22); c.fillStyle = '#558b2f'; for (let i = -9; i < 11; i += 5) c.fillRect(i, -11, 2, 22); c.fillStyle = '#ffeb3b'; c.beginPath(); c.arc(0, 0, 4, 0, 6.283); c.fill(); }
    else { c.fillStyle = '#607d8b'; c.fillRect(-11, -4, 22, 15); c.fillStyle = '#37474f'; c.fillRect(4, -13, 6, 12); c.fillStyle = col; c.fillRect(-9, 0, 5, 5); c.fillRect(-2, 0, 5, 5); c.fillStyle = 'rgba(200,200,200,0.5)'; c.beginPath(); c.arc(7, -15, 3 + Math.sin((t || 0) / 10), 0, 6.283); c.fill(); }
  } else if (k === 'aura') {
    c.fillStyle = col;
    if (def.aura === 'command') { c.fillStyle = '#5d4037'; c.fillRect(-1, -12, 2, 22); c.fillStyle = col; c.beginPath(); c.moveTo(1, -12); c.lineTo(12, -8); c.lineTo(1, -4); c.fill(); c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(-5, 6, 4, 0, 6.283); c.fill(); }
    else if (def.aura === 'eco') { c.beginPath(); c.moveTo(3, -12); c.lineTo(-6, 2); c.lineTo(0, 2); c.lineTo(-3, 12); c.lineTo(7, -2); c.lineTo(1, -2); c.closePath(); c.fill(); }
    else if (def.aura === 'cryo') { c.strokeStyle = col; c.lineWidth = 2.5; for (let i = 0; i < 3; i++) { c.save(); c.rotate(i * Math.PI / 3 + (t || 0) / 120); c.beginPath(); c.moveTo(-11, 0); c.lineTo(11, 0); c.stroke(); c.restore(); } c.fillStyle = '#e0f7fa'; c.beginPath(); c.arc(0, 0, 3, 0, 6.283); c.fill(); }
    else if (def.aura === 'cpost') { c.fillStyle = '#6b7355'; c.beginPath(); c.moveTo(-11, 10); c.lineTo(0, -4); c.lineTo(11, 10); c.closePath(); c.fill(); c.fillStyle = '#22272b'; c.fillRect(-2.5, 3, 5, 7); c.fillStyle = '#3e3a2c'; c.fillRect(-1, -14, 2, 11); c.fillStyle = col; c.beginPath(); c.moveTo(1, -14); c.lineTo(11, -11 + Math.sin((t || 0) / 8) * 1.4); c.lineTo(1, -8); c.fill();
      if (spec) { c.fillStyle = '#ffd54f'; star(c, -7, 6, spec === 1 ? 4 : spec === 2 ? 3.2 : 2.4); } }
    else if (def.aura === 'radar') { c.save(); c.rotate((t || 0) / 25); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 11, 5, 0, 0, 6.283); c.fill(); c.fillStyle = '#2d3436'; c.fillRect(-1, -10, 2, 10); c.restore(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 2.5, 0, 6.283); c.fill(); }
  } else if (k === 'heal') { c.fillStyle = '#fff'; c.fillRect(-10, -3.5, 20, 7); c.fillRect(-3.5, -10, 7, 20); c.fillStyle = col; c.fillRect(-8, -2, 16, 4); c.fillRect(-2, -8, 4, 16); }
  else if (k === 'barracks') { c.fillStyle = '#8d6e63'; c.fillRect(-11, -4, 22, 14); c.fillStyle = col; c.beginPath(); c.moveTo(-13, -4); c.lineTo(0, -13); c.lineTo(13, -4); c.fill(); c.fillStyle = '#3e2723'; c.fillRect(-3, 3, 6, 7); barracksGlyph(c, def.id, spec); }
  else if (k === 'hq') { c.fillStyle = '#5b6150'; c.fillRect(-12, -3, 24, 14); c.fillStyle = col; c.fillRect(-14, -6, 28, 4); c.fillStyle = '#22272b'; c.fillRect(-9, 1, 8, 5); c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(6, 5, 3.2, 0, 6.283); c.fill(); c.strokeStyle = '#cfd8dc'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(8, -6); c.lineTo(8, -14); c.moveTo(5, -11); c.lineTo(11, -11); c.stroke(); if (spec) { c.fillStyle = '#fff'; star(c, 9, 7, 3); } }
  else {
    // turret, rotated to face its target
    c.rotate(angle); c.translate(-(recoil || 0), 0);
    c.fillStyle = dark;
    if (k === 'bullet') {
      if (def.id === 'minigun') { for (const o of [-4, 0, 4]) c.fillRect(4, o - 1.5, 15, 3); }
      else if (def.id === 'ciws') { c.fillStyle = '#eceff1'; c.beginPath(); c.arc(-3, 0, 9, 0, 6.283); c.fill(); c.fillStyle = '#546e7a'; for (const o of [-3, 0, 3]) c.fillRect(5, o - 1, 14, 2); }
      else if (def.id === 'rapid') { c.fillRect(4, -5, 13, 3); c.fillRect(4, 2, 13, 3); }
      else if (spec === 1 && def.id === 'basic') { c.fillRect(4, -5, 13, 4); c.fillRect(4, 1, 13, 4); }
      else c.fillRect(4, -2.5, def.id === 'standard' ? 17 : 13, 5);
    } else if (k === 'snipe') { if (def.id === 'atgun') { c.fillRect(4, -2.6, 19, 5.2); c.fillRect(21, -3.8, 4.5, 7.6); c.fillStyle = shade(col, 0.8); c.fillRect(-3, -11, 4, 22); c.fillStyle = dark; } else c.fillRect(4, -1.8, 24, 3.6); }
    else if (k === 'shell') { if (def.id === 'flak') { c.fillRect(3, -6, 12, 4); c.fillRect(3, 2, 12, 4); } else c.fillRect(3, -4.5, 13, 9); }
    else if (k === 'missile' && def.id === 'sam') { c.fillRect(-8, -3, 12, 6); c.fillStyle = '#eceff1'; c.fillRect(-6, -8.5, 21, 4.5); c.fillRect(-6, 4, 21, 4.5); c.fillStyle = '#e74c3c'; c.fillRect(13, -8.5, 3.5, 4.5); c.fillRect(13, 4, 3.5, 4.5); }
    else if (k === 'missile') { c.fillRect(-7, -9, 16, 18); c.fillStyle = '#c0392b'; for (const [a, b] of [[-5, -7], [1, -7], [-5, 1], [1, 1]]) { c.beginPath(); c.arc(a + 2.5, b + 3, 2.3, 0, 6.283); c.fill(); } }
    else if (k === 'lob' && def.id === 'trenchmortar') { c.fillRect(0, -5, 11, 10); c.strokeStyle = dark; c.lineWidth = 1.5; c.beginPath(); c.moveTo(4, -5); c.lineTo(9, -11); c.moveTo(4, 5); c.lineTo(9, 11); c.stroke(); }
    else if (k === 'lob') { c.fillRect(2, -4, def.id === 'howitzer' ? 18 : 14, 8); }
    else if (k === 'zap' && def.id === 'ion') { c.fillRect(4, -3.5, 14, 7); c.fillStyle = '#e1f5fe'; c.fillRect(15, -2, 3, 4); }
    else if (k === 'poison') c.fillRect(4, -2, 15, 4);
    else if (k === 'beam') { c.fillRect(4, -3, 12, 6); c.fillStyle = col; c.beginPath(); c.arc(16, 0, 3, 0, 6.283); c.fill(); }
    else if (k === 'frost') c.fillRect(2, -3.5, 14, 7);
    else if (k === 'rail') { c.fillRect(2, -5, 22, 3); c.fillRect(2, 2, 22, 3); c.fillStyle = col; c.fillRect(6, -2, 14, 4); }
    c.fillStyle = col; c.beginPath();
    if (k === 'frost') { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); } c.closePath(); c.fill(); c.fillStyle = '#e3f2fd'; c.beginPath(); c.arc(0, 0, 4, 0, 6.283); c.fill(); }
    else if (k === 'zap') { c.arc(0, 0, 9, 0, 6.283); c.fill(); c.strokeStyle = '#fffde7'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 5.5, 0, 6.283); c.stroke(); c.beginPath(); c.arc(0, 0, 2.5, 0, 6.283); c.stroke(); }
    else if (k === 'nuke') { c.arc(0, 0, 10, 0, 6.283); c.fill(); c.fillStyle = '#f1c40f'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 8, i * 2.094, i * 2.094 + 0.8); c.fill(); } }
    else if (k === 'lob') { c.arc(0, 0, def.id === 'howitzer' ? 10 : def.id === 'trenchmortar' ? 7 : 8.5, 0, 6.283); c.fill(); }
    else { c.arc(0, 0, k === 'snipe' ? 7 : 8, 0, 6.283); c.fill(); }
  }
  c.restore();
}
// ---- alien tech: hexagonal plates and organic / crystal shapes ----
function hexPath(c, r) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }
function alienTowerArt(c, def, angle, recoil, spec, t) {
  const col = def.color, id = def.id, dk = shade(col, 0.5), pulse = 0.5 + 0.5 * Math.sin(t / 10);
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(2, 13, 15, 5, 0, 0, 6.283); c.fill();
  c.fillStyle = '#1f1633'; hexPath(c, 16); c.fill();
  c.strokeStyle = def.super ? '#f1c40f' : col; c.lineWidth = 2; hexPath(c, 16); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; hexPath(c, 11); c.stroke();
  if (id === 'graviton') {
    for (let k = 0; k < 3; k++) { c.save(); c.rotate(t / 30 * (k % 2 ? -1 : 1) + k); c.strokeStyle = 'rgba(179,136,255,0.85)'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, 0, 12 - k * 2.5, 4.5 + k, 0, 0, 6.283); c.stroke(); c.restore(); }
    glowDot(c, 0, 0, 3.6 + pulse, col);
  } else if (id === 'swarmhive') {
    c.fillStyle = dk; for (let i = 0; i < 6; i++) { const a = i * 1.047; c.beginPath(); c.arc(Math.cos(a) * 7, Math.sin(a) * 7, 5, 0, 6.283); c.fill(); }
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 8.5, 0, 6.283); c.fill();
    c.fillStyle = '#1b2a0e'; for (const [a, b] of [[-3, -3], [3, -2], [0, 3.5]]) { c.beginPath(); c.arc(a, b, 1.9, 0, 6.283); c.fill(); }
    for (let i = 0; i < 3; i++) { const a = t / 18 + i * 2.094; c.fillStyle = '#dcedc8'; c.beginPath(); c.arc(Math.cos(a) * 13, Math.sin(a) * 13, 1.5, 0, 6.283); c.fill(); }
  } else if (id === 'mindspire') {
    c.strokeStyle = 'rgba(224,64,251,' + (0.25 + 0.5 * pulse).toFixed(2) + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 13, 0, 6.283); c.stroke();
    c.fillStyle = dk; c.beginPath(); c.moveTo(0, -15); c.lineTo(7, 0); c.lineTo(0, 9); c.lineTo(-7, 0); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(0, -15); c.lineTo(7, 0); c.lineTo(0, 2); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(0, -1, 3.6, 2.2, 0, 0, 6.283); c.fill(); c.fillStyle = '#4a148c'; c.beginPath(); c.arc(0, -1, 1.4, 0, 6.283); c.fill();
  } else if (id === 'singularity') {
    c.save(); c.rotate(t / 15); c.strokeStyle = col; c.lineWidth = 2.4; c.beginPath(); c.ellipse(0, 0, 14, 5, 0, 0, 6.283); c.stroke();
    c.strokeStyle = 'rgba(234,128,252,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, 11, 3.5, 0.6, 0, 6.283); c.stroke(); c.restore();
    c.fillStyle = '#05000c'; c.beginPath(); c.arc(0, 0, 7.5, 0, 6.283); c.fill();
    c.strokeStyle = 'rgba(179,136,255,' + (0.5 + 0.5 * pulse).toFixed(2) + ')'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 8.2, 0, 6.283); c.stroke();
  } else if (id === 'pylon') {
    c.fillStyle = '#263238'; c.beginPath(); c.moveTo(0, -15); c.lineTo(5.5, -4); c.lineTo(4.5, 10); c.lineTo(-4.5, 10); c.lineTo(-5.5, -4); c.closePath(); c.fill();
    c.fillStyle = col; c.fillRect(-1.2, -11, 2.4, 18);
    c.strokeStyle = 'rgba(24,255,255,' + (0.35 + 0.5 * pulse).toFixed(2) + ')'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, -5 + Math.sin(t / 12) * 1.5, 11, 4, 0, 0, 6.283); c.stroke();
    if (spec) { c.fillStyle = '#ffd54f'; star(c, 9, -10, 3); }
  } else if (id === 'harvester') {
    c.strokeStyle = shade(col, 0.6); c.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * 1.571 + 0.785; c.beginPath(); c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); c.quadraticCurveTo(Math.cos(a + 0.4) * 13, Math.sin(a + 0.4) * 13, Math.cos(a + 0.2) * 15, Math.sin(a + 0.2) * 15); c.stroke(); }
    c.fillStyle = '#263238'; c.beginPath(); c.arc(0, 0, 10, 0, 6.283); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 7.5, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 3; i++) { const yy = 5 - ((t / 4 + i * 5) % 12); c.beginPath(); c.arc(-3 + i * 3, yy, 1.1, 0, 6.283); c.fill(); }
    if (spec) { c.fillStyle = '#ffd54f'; star(c, 10, -10, 3); }
  } else if (id === 'hatchery') {
    for (const [x, y, rr] of [[-6, 3, 5.5], [5, 4, 5], [0, -5, 6]]) { c.fillStyle = shade(col, 0.75); c.beginPath(); c.ellipse(x, y, rr * 0.85, rr, 0, 0, 6.283); c.fill(); c.fillStyle = 'rgba(204,255,144,' + (0.3 + 0.4 * pulse).toFixed(2) + ')'; c.beginPath(); c.ellipse(x - 1, y - 1, rr * 0.35, rr * 0.45, 0, 0, 6.283); c.fill(); }
    if (spec) { c.fillStyle = '#ffd54f'; star(c, 10, -10, 3); }
  } else {
    // turrets that face their target
    c.rotate(angle || 0); c.translate(-(recoil || 0), 0);
    if (id === 'xblaster') {
      c.fillStyle = dk; if (spec === 1) { c.fillRect(3, -5.5, 13, 3.5); c.fillRect(3, 2, 13, 3.5); } else { roundRect(c, 3, -2.8, 14, 5.6, 2); c.fill(); }
      c.fillStyle = col; c.beginPath(); c.ellipse(-1, 0, 9, 7, 0, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(-4, -2, 2, 0, 6.283); c.arc(-3, 3, 1.5, 0, 6.283); c.fill();
      glowDot(c, 16, spec === 1 ? -3.8 : 0, 2.3, '#ccff90'); if (spec === 1) glowDot(c, 16, 3.8, 2.3, '#ccff90');
    } else if (id === 'disintegrator') {
      c.fillStyle = dk; c.fillRect(2, -6.5, 15, 3); c.fillRect(2, 3.5, 15, 3);
      c.fillStyle = col; c.beginPath(); c.arc(0, 0, 8, 0, 6.283); c.fill();
      glowDot(c, 14, 0, 2.6 + pulse, '#f8bbd0'); glowDot(c, 0, 0, 2.5, '#fce4ec');
    } else if (id === 'acidspitter') {
      c.fillStyle = shade(col, 0.45); c.fillRect(5, -3, 11, 6);
      c.fillStyle = col; c.beginPath(); c.ellipse(-1, 0, 10, 8, 0, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(51,105,30,0.6)'; c.beginPath(); c.ellipse(-3, -2, 4, 3, 0.3, 0, 6.283); c.fill();
      glowDot(c, 16, 0, 2, '#eeff41');
    } else if (id === 'resonator') {
      c.fillStyle = shade(col, 0.6); for (const a of [2.3, -2.3, 3.14]) { c.save(); c.rotate(a); c.beginPath(); c.moveTo(11, 0); c.lineTo(3, -3); c.lineTo(3, 3); c.closePath(); c.fill(); c.restore(); }
      c.fillStyle = col; c.beginPath(); c.moveTo(17, 0); c.lineTo(2, -4.5); c.lineTo(-4, 0); c.lineTo(2, 4.5); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.moveTo(17, 0); c.lineTo(2, -4.5); c.lineTo(4, 0); c.closePath(); c.fill();
    }
  }
}
// small emblem on each barracks so you can tell them apart at a glance
function barracksGlyph(c, id, spec) {
  c.save(); c.translate(0, 1.5); c.lineWidth = 1.6; c.strokeStyle = '#fff'; c.fillStyle = '#fff';
  if (id === 'barracks') { c.beginPath(); c.moveTo(-3, 4); c.lineTo(3, -4); c.stroke(); c.beginPath(); c.moveTo(-3, -4); c.lineTo(3, 4); c.stroke(); }       // crossed rifles
  else if (id === 'marksman') { c.beginPath(); c.arc(0, 0, 4, 0, 6.283); c.stroke(); c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.moveTo(0, -6); c.lineTo(0, 6); c.stroke(); }  // crosshair
  else if (id === 'heavy') { c.beginPath(); c.moveTo(-4, -4); c.lineTo(4, -4); c.lineTo(4, 1); c.lineTo(0, 5); c.lineTo(-4, 1); c.closePath(); c.fill(); }   // shield
  else if (id === 'k9') { for (const [a, b] of [[-3.5, -2.5], [0, -4], [3.5, -2.5]]) { c.beginPath(); c.arc(a, b, 1.2, 0, 6.283); c.fill(); } c.beginPath(); c.ellipse(0, 1.6, 3.2, 2.6, 0, 0, 6.283); c.fill(); }   // paw
  else if (id === 'demo') { c.beginPath(); c.arc(0, 1.5, 3.6, 0, 6.283); c.fill(); c.beginPath(); c.moveTo(0, -2); c.lineTo(2.5, -5); c.stroke(); c.fillStyle = '#ff7043'; c.beginPath(); c.arc(3, -5, 1.3, 0, 6.283); c.fill(); }  // grenade
  else if (id === 'workshop') { c.beginPath(); c.arc(0, 0, 3.5, 0, 6.283); c.stroke(); for (let i = 0; i < 6; i++) { const a = i * 1.047; c.beginPath(); c.moveTo(Math.cos(a) * 3.5, Math.sin(a) * 3.5); c.lineTo(Math.cos(a) * 5.6, Math.sin(a) * 5.6); c.stroke(); } }
  else if (id === 'battery') { c.beginPath(); c.moveTo(-5, 4); c.lineTo(4, -4); c.stroke(); c.beginPath(); c.arc(-3, 4.5, 2.2, 0, 6.283); c.fill(); }   // field gun
  else if (id === 'hospital') { c.fillRect(-1, -5, 2, 10); c.fillRect(-4, -2, 8, 2); c.fillStyle = '#e74c3c'; c.fillRect(-1.2, -4.5, 2.4, 9); c.fillRect(-4.5, -1.2, 9, 2.4); }
  if (spec) { c.fillStyle = '#ffd54f'; star(c, 9, -9, 3); }
  c.restore();
}
function fenceSpecMark(c, id, spec, t) {
  c.save();
  if (id === 'sandbag') {
    if (spec === 1) { c.strokeStyle = '#cfd8dc'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-18, -13); for (let i = -16; i <= 18; i += 4) c.lineTo(i, ((i / 4) % 2 ? -17 : -11)); c.stroke(); }
    else if (spec === 2) { c.fillStyle = '#5d4e2c'; c.fillRect(-18, -2, 36, 3); c.fillStyle = '#ffd54f'; c.fillRect(-18, -2, 36, 1); }
    else { c.fillStyle = '#c0392b'; c.fillRect(-4, -4, 8, 8); c.fillStyle = '#ffd54f'; c.fillRect(-4, -1, 8, 1.6); }
  } else if (id === 'concrete') {
    if (spec === 1) { c.fillStyle = '#ecf0f1'; for (let i = -14; i <= 14; i += 7) { c.beginPath(); c.arc(i, 0, 1.4, 0, 6.283); c.fill(); } }
    else if (spec === 2) { c.fillStyle = '#5d4037'; c.beginPath(); c.moveTo(-7, 7); c.lineTo(-7, -2); c.arc(0, -2, 7, Math.PI, 0); c.lineTo(7, 7); c.closePath(); c.fill(); c.fillStyle = '#ffd54f'; c.fillRect(-1, 0, 2, 7); }
    else if (spec === 3) { c.strokeStyle = (t || 0) % 16 < 8 ? '#fff59d' : '#4fc3f7'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-16, 0); for (let i = -12; i <= 16; i += 4) c.lineTo(i, ((i / 4) % 2 ? -4 : 4)); c.stroke(); }
    else { c.fillStyle = 'rgba(100,210,255,' + (0.12 + 0.06 * Math.sin((t || 0) / 8)).toFixed(2) + ')'; c.strokeStyle = 'rgba(120,220,255,0.9)'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(0, 0, 23, 14, 0, 0, 6.283); c.fill(); c.stroke(); c.fillStyle = '#4fc3f7'; for (const sx of [-19, 19]) { c.beginPath(); c.arc(sx, 0, 2.2, 0, 6.283); c.fill(); } }
  } else if (id === 'mgnest') {
    c.fillStyle = '#ffd54f';
    if (spec === 1) { for (const o of [-6, 0, 6]) c.fillRect(-18, o - 1, 6, 2); }
    else if (spec === 2) { c.strokeStyle = '#ecf0f1'; c.lineWidth = 2; c.strokeRect(-19, -10, 38, 20); }
    else { c.fillStyle = (t || 0) % 20 < 10 ? '#ff7043' : '#ffca28'; c.beginPath(); c.arc(-14, 0, 4, 0, 6.283); c.fill(); }
  }
  c.restore();
}
function drawTrap(c, def, spec, t) {
  if (def.trap === 'spikes') {          // steel hedgehogs (tank traps)
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(1, 3, 17, 9, 0, 0, 6.283); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-17, -6, 34, 14);
    for (const [cx, cy, rot] of [[-10, -1, 0.5], [2, 4, -0.3], [11, -2, 0.9]]) { c.save(); c.translate(cx, cy); c.rotate(rot); c.fillStyle = spec === 2 ? '#6fcf97' : '#6e7f8a'; c.fillRect(-8, -1.8, 16, 3.6); c.save(); c.rotate(1.05); c.fillRect(-8, -1.8, 16, 3.6); c.restore(); c.save(); c.rotate(-1.05); c.fillRect(-8, -1.8, 16, 3.6); c.restore(); c.fillStyle = '#cfd8dc'; c.beginPath(); c.arc(0, 0, 1.6, 0, 6.283); c.fill(); c.restore(); }
    c.lineCap = 'butt';
    if (spec === 1) { c.strokeStyle = '#e74c3c'; c.lineWidth = 1.5; c.strokeRect(-18, -10, 36, 20); }
    else if (spec === 3) { c.strokeStyle = '#c0392b'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-16, 0); for (let i = -14; i <= 16; i += 3) c.lineTo(i, ((i / 3) % 2 ? -3 : 3)); c.stroke(); }
  } else if (def.trap === 'stasis') {    // stasis field: an alien pad that pulses
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(1, 3, 19, 10, 0, 0, 6.283); c.fill();
    c.fillStyle = '#0d2b33'; hexPath(c, 17); c.fill(); c.strokeStyle = '#84ffff'; c.lineWidth = 1.5; hexPath(c, 17); c.stroke();
    const ph = ((t || 0) % 60) / 60;
    c.strokeStyle = 'rgba(132,255,255,' + (0.8 - ph * 0.7).toFixed(2) + ')'; c.beginPath(); c.arc(0, 0, 4 + ph * 11, 0, 6.283); c.stroke();
    for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57; glowDot(c, Math.cos(a) * 12, Math.sin(a) * 12, 1.8, spec === 3 ? '#ea80fc' : spec === 2 ? '#ffd54f' : '#18ffff'); }
  } else {                               // oil slick
    c.fillStyle = spec === 1 ? '#3e2723' : '#15191c'; c.beginPath(); c.ellipse(0, 0, 22, 15, 0, 0, 6.283); c.fill();
    c.fillStyle = spec === 1 ? '#ff7043' : spec === 3 ? '#8bc34a' : spec === 2 ? '#8d6e4a' : '#3c4a56';
    const tt = (t || 0) / 14; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(Math.cos(i * 1.7 + tt) * 10, Math.sin(i * 2.3 + tt) * 5, 2 + (i % 2), 0, 6.283); c.fill(); }
  }
}
// every troop and mercenary is drawn from its "look" (top-down soldiers, vehicles and dogs)
const HELMETS = { h_ashford: '#6f6340', h_kane: '#1c1c1c', h_reyes: '#4b5320', h_nova: '#37526f', plasmarifle: '#006064', gauss: '#004d56', powerarmor: '#37526f', cryogren: '#4dd0e1', nanomed: '#ecf0f1', soldier: '#4b5320', marksman: '#6b5d36', heavy: '#37474f', assault: '#37474f', mgteam: '#4b5320', vet: '#4b5320', medheavy: '#455a64', riot: '#263238', grenadier: '#4a3a5a', flame: '#6d4c41', smokeman: '#546e7a', emp: '#455a64', engineer: '#f1c40f', medic: '#ecf0f1', triage: '#ecf0f1', combatmed: '#ecf0f1', evac: '#ecf0f1', contractor: '#1c1c1c', shock: '#7b1f1f', officer: '#3e4a2f', special: '#101010' };
function wheelPair(c, x, y, rr) { c.fillStyle = '#1c1f22'; c.beginPath(); c.arc(x, y, rr, 0, 6.283); c.fill(); }
function drawTroopFigure(c, look, x, y, r, ang, col, flash, anim) {
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(1, r * 0.75, r * 0.95, r * 0.4, 0, 0, 6.283); c.fill();
  const body = flash ? '#ffffff' : col;
  if (look === 'dog' || look === 'wardog') {
    c.rotate(ang); const L = r * 1.55, Wd = r * 0.78;
    c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, L, Wd, 0, 0, 6.283); c.fill();
    c.beginPath(); c.arc(L * 0.85, 0, r * 0.55, 0, 6.283); c.fill();
    c.fillStyle = shade(col[0] === '#' ? col : '#777777', 0.6);
    c.beginPath(); c.arc(L * 0.7, -r * 0.45, r * 0.22, 0, 6.283); c.arc(L * 0.7, r * 0.45, r * 0.22, 0, 6.283); c.fill();
    c.fillStyle = '#c0392b'; c.fillRect(L * 0.3, -Wd * 0.9, r * 0.35, Wd * 1.8);                       // working-dog harness
    c.strokeStyle = body; c.lineWidth = Math.max(1.5, r * 0.28); c.beginPath(); c.moveTo(-L, 0); c.lineTo(-L - r * 0.8, Math.sin((anim || 0) / 4) * 2); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(L * 1.15, -r * 0.2, 1, 0, 6.283); c.arc(L * 1.15, r * 0.2, 1, 0, 6.283); c.fill();
    c.restore(); return;
  }
  if (look === 'motorbike') {
    c.rotate(ang);
    wheelPair(c, r * 1.1, 0, r * 0.38); wheelPair(c, -r * 1.1, 0, r * 0.38);
    c.fillStyle = body; c.fillRect(-r * 1.0, -r * 0.22, r * 2.0, r * 0.44);
    c.fillStyle = '#cfd8dc'; c.fillRect(r * 0.55, -r * 0.6, r * 0.2, r * 1.2);                           // handlebars
    c.fillStyle = flash ? '#fff' : '#556b2f'; c.beginPath(); c.arc(-r * 0.1, 0, r * 0.55, 0, 6.283); c.fill();
    c.fillStyle = '#263238'; c.beginPath(); c.arc(-r * 0.05, 0, r * 0.38, 0, 6.283); c.fill();
    c.restore(); return;
  }
  if (look === 'car' || look === 'motor') {
    c.rotate(ang); const k = look === 'car' ? 1 : 0.8;
    c.fillStyle = '#1c1f22'; for (const sx of [-0.8, 0.8]) for (const sy of [-1, 1]) c.fillRect(r * sx * k - r * 0.3, r * sy * 0.78 * k - r * 0.16, r * 0.6, r * 0.32);
    c.fillStyle = body; roundRect(c, -r * 1.25 * k, -r * 0.78 * k, r * 2.5 * k, r * 1.56 * k, r * 0.25); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(r * 0.2 * k, -r * 0.55 * k, r * 0.5 * k, r * 1.1 * k);
    c.fillStyle = '#37474f'; c.beginPath(); c.arc(-r * 0.15 * k, 0, r * 0.42 * k, 0, 6.283); c.fill();
    c.strokeStyle = '#263238'; c.lineWidth = Math.max(1.6, r * 0.18); c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 1.3 * k, 0); c.stroke();
    c.restore(); return;
  }
  if (look === 'tank') {
    c.rotate(ang);
    c.fillStyle = '#1c1f22'; c.fillRect(-r * 1.1, -r * 0.95, r * 2.2, r * 0.45); c.fillRect(-r * 1.1, r * 0.5, r * 2.2, r * 0.45);
    c.fillStyle = body; c.fillRect(-r * 1.0, -r * 0.62, r * 2.0, r * 1.24);
    c.fillStyle = shade(col[0] === '#' ? col : '#6d7a52', 0.8); c.beginPath(); c.arc(-r * 0.1, 0, r * 0.5, 0, 6.283); c.fill();
    c.fillStyle = '#263238'; c.fillRect(0, -r * 0.1, r * 1.4, r * 0.2);
    if (flash) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-r * 1.1, -r * 0.95, r * 2.2, r * 1.9); }
    c.restore(); return;
  }
  if (look === 'gun' || look === 'atgun' || look === 'mortar') {
    c.rotate(ang);
    c.fillStyle = '#3e3a2c'; c.fillRect(-r * 1.2, -r * 0.12, r * 0.9, r * 0.24);                         // trail legs
    wheelPair(c, -r * 0.1, -r * 0.95, r * 0.42); wheelPair(c, -r * 0.1, r * 0.95, r * 0.42);
    if (look === 'mortar') { c.fillStyle = '#4a4f55'; c.beginPath(); c.arc(0, 0, r * 0.75, 0, 6.283); c.fill(); c.fillStyle = '#222'; c.fillRect(-r * 0.1, -r * 0.3, r * 1.2, r * 0.6); c.fillStyle = '#111'; c.fillRect(r * 1.0, -r * 0.4, r * 0.25, r * 0.8); }
    else {
      c.fillStyle = look === 'atgun' ? '#2b3a2b' : '#4a4f55'; c.fillRect(-r * 0.3, -r * 0.7, r * 0.5, r * 1.4);          // gun shield
      c.fillStyle = '#263238'; c.fillRect(0, -r * 0.18, look === 'atgun' ? r * 2.0 : r * 1.5, r * 0.36);
      c.fillStyle = '#111'; c.fillRect(look === 'atgun' ? r * 1.9 : r * 1.4, -r * 0.28, r * 0.25, r * 0.56);
    }
    if (flash) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-r * 1.2, -r * 1.0, r * 2.4, r * 2.0); }
    c.restore(); return;
  }
  if (look === 'sentry') {
    c.fillStyle = '#6f6246'; c.beginPath(); c.arc(0, 0, r * 1.1, 0, 6.283); c.fill();                    // sandbag ring
    c.fillStyle = '#455a64'; c.beginPath(); c.arc(0, 0, r * 0.6, 0, 6.283); c.fill();
    c.rotate(ang); c.fillStyle = '#90a4ae'; c.fillRect(0, -1.6, r * 1.9, 3.2); c.fillStyle = '#ffca28'; c.beginPath(); c.arc(0, 0, r * 0.35, 0, 6.283); c.fill();
    c.restore(); return;
  }
  if (look === 'drone') {            // combat drone: a hovering quad-rotor
    const hov = Math.sin((anim || 0) / 5) * 0.8;
    c.translate(0, hov); c.strokeStyle = '#78909c'; c.lineWidth = 1.5;
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(sx * r * 0.95, sy * r * 0.95); c.stroke(); c.fillStyle = 'rgba(210,225,235,0.55)'; c.beginPath(); c.arc(sx * r * 0.95, sy * r * 0.95, r * 0.5, 0, 6.283); c.fill(); }
    c.rotate(ang); c.fillStyle = body; c.beginPath(); c.arc(0, 0, r * 0.58, 0, 6.283); c.fill();
    c.strokeStyle = '#263238'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(r * 0.3, 0); c.lineTo(r * 1.1, 0); c.stroke();
    glowDot(c, r * 0.3, 0, r * 0.2, '#00e5ff');
    c.restore(); return;
  }
  if (look === 'mech') {             // piloted combat mech
    c.rotate(ang); mechArt(c, r, body, shade(col[0] === '#' ? col : '#7f8fa6', 0.62), false, anim || 0, flash);
    c.restore(); return;
  }
  if (look === 'h_tank') {           // Sgt. Kowalski's Sherman: a tank with a white star and an open hatch
    c.rotate(ang);
    c.fillStyle = '#1c1f22'; c.fillRect(-r * 1.1, -r * 0.95, r * 2.2, r * 0.42); c.fillRect(-r * 1.1, r * 0.53, r * 2.2, r * 0.42);
    c.fillStyle = body; roundRect(c, -r * 1.0, -r * 0.62, r * 2.0, r * 1.24, r * 0.15); c.fill();
    c.fillStyle = shade(col[0] === '#' ? col : '#5b6b3a', 0.8); c.beginPath(); c.arc(-r * 0.1, 0, r * 0.52, 0, 6.283); c.fill();
    c.fillStyle = '#263238'; c.fillRect(r * 0.2, -r * 0.1, r * 1.3, r * 0.2);
    c.fillStyle = '#fff'; star(c, -r * 0.1, 0, r * 0.32);
    c.fillStyle = '#ffd54f'; c.beginPath(); c.arc(-r * 0.45, -r * 0.3, r * 0.13, 0, 6.283); c.fill();
    if (flash) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-r * 1.1, -r * 0.95, r * 2.2, r * 1.9); }
    c.restore(); return;
  }
  if (look === 'xeno' || look === 'xenopsi' || look === 'xenobrute') {   // captured alien warriors (Xeno Hatchery)
    c.rotate(ang); const big = look === 'xenobrute';
    c.strokeStyle = shade(col[0] === '#' ? col : '#6ab04c', 0.6); c.lineWidth = Math.max(1.2, r * 0.18); c.beginPath(); c.moveTo(-r * 0.7, 0); c.quadraticCurveTo(-r * 1.3, Math.sin((anim || 0) / 5) * r * 0.5, -r * 1.7, 0); c.stroke();   // tail
    c.fillStyle = body; c.beginPath(); c.ellipse(-r * 0.05, 0, r * 0.85, r * (big ? 0.8 : 0.6), 0, 0, 6.283); c.fill();
    if (big) { c.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = -1; i <= 1; i++) c.fillRect(-r * 0.5, i * r * 0.35 - r * 0.07, r * 0.8, r * 0.14); }
    c.strokeStyle = '#1b2a0e'; c.lineWidth = Math.max(1.2, r * 0.14); for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(r * 0.4, sd * r * 0.4); c.quadraticCurveTo(r * 1.0, sd * r * 0.75, r * 1.25, sd * r * 0.25); c.stroke(); }   // claws
    c.fillStyle = look === 'xenopsi' ? '#b388ff' : shade(col[0] === '#' ? col : '#6ab04c', 0.75); c.beginPath(); c.ellipse(r * 0.75, 0, r * 0.45, r * 0.32, 0, 0, 6.283); c.fill();
    glowDot(c, r * 0.95, 0, r * 0.12, look === 'xenopsi' ? '#ea80fc' : '#eeff41');
    if (look === 'xenopsi') { c.strokeStyle = 'rgba(234,128,252,0.55)'; c.lineWidth = 1; c.beginPath(); c.arc(r * 0.75, 0, r * 0.65 + Math.sin((anim || 0) / 4), 0, 6.283); c.stroke(); }
    c.restore(); return;
  }
  if (look === 'grey' || look === 'h_zyx') {          // grey aliens (contractors) and Zyx'ara the alien hero
    c.rotate(ang); const zy = look === 'h_zyx';
    if (zy) { c.fillStyle = flash ? '#fff' : '#4527a0'; c.beginPath(); c.moveTo(-r * 0.2, -r * 0.9); c.lineTo(-r * 1.4, -r * 0.6 + Math.sin((anim || 0) / 6) * 1.5); c.lineTo(-r * 1.4, r * 0.6 - Math.sin((anim || 0) / 6) * 1.5); c.lineTo(-r * 0.2, r * 0.9); c.closePath(); c.fill(); }   // cape
    c.fillStyle = flash ? '#fff' : zy ? '#5e35b1' : '#78909c'; c.beginPath(); c.ellipse(-r * 0.15, 0, r * 0.5, r * 0.7, 0, 0, 6.283); c.fill();
    c.strokeStyle = '#263238'; c.lineWidth = Math.max(1.4, r * 0.2); c.beginPath(); c.moveTo(r * 0.2, r * 0.5); c.lineTo(r * 1.4, r * 0.5); c.stroke(); glowDot(c, r * 1.45, r * 0.5, r * 0.16, zy ? '#e040fb' : '#76ff03');
    c.fillStyle = zy ? '#b39ddb' : col; c.beginPath(); c.ellipse(r * 0.2, 0, r * 0.58, r * 0.66, 0, 0, 6.283); c.fill();
    c.fillStyle = '#0b0b0b'; c.beginPath(); c.ellipse(r * 0.5, -r * 0.24, r * 0.18, r * 0.1, 0.6, 0, 6.283); c.ellipse(r * 0.5, r * 0.24, r * 0.18, r * 0.1, -0.6, 0, 6.283); c.fill();
    if (zy) { c.strokeStyle = 'rgba(224,64,251,0.7)'; c.lineWidth = 1.2; c.beginPath(); c.arc(r * 0.2, 0, r * 0.95 + Math.sin((anim || 0) / 5) * 1.2, 0, 6.283); c.stroke(); }
    c.restore(); return;
  }
  if (look === 'railcannon') {       // rail cannon: twin electromagnetic rails on a tracked mount
    c.rotate(ang);
    c.fillStyle = '#1c1f22'; c.fillRect(-r * 1.1, -r * 0.95, r * 1.6, r * 0.4); c.fillRect(-r * 1.1, r * 0.55, r * 1.6, r * 0.4);
    c.fillStyle = '#4a5560'; roundRect(c, -r * 0.95, -r * 0.62, r * 1.5, r * 1.24, r * 0.2); c.fill();
    c.fillStyle = '#263238'; c.fillRect(0, -r * 0.34, r * 2.3, r * 0.2); c.fillRect(0, r * 0.14, r * 2.3, r * 0.2);
    c.fillStyle = '#18ffff'; c.fillRect(r * 0.2, -r * 0.16, r * 2.0, r * 0.32);
    glowDot(c, -r * 0.4, 0, r * 0.22, '#18ffff');
    if (flash) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(-r * 1.1, -r * 0.95, r * 3.4, r * 1.9); }
    c.restore(); return;
  }
  // ---- infantry: uniform, head, helmet, then the weapon (drawn pointing along +x) ----
  const heavy = look === 'heavy' || look === 'assault' || look === 'medheavy' || look === 'riot' || look === 'powerarmor' || look === 'h_nova';
  if (look === 'h_nova') { glowDot(c, -r * 0.95 * Math.cos(ang) + r * 0.35 * Math.sin(ang), -r * 0.95 * Math.sin(ang) - r * 0.35 * Math.cos(ang), r * 0.22, '#80d8ff'); glowDot(c, -r * 0.95 * Math.cos(ang) - r * 0.35 * Math.sin(ang), -r * 0.95 * Math.sin(ang) + r * 0.35 * Math.cos(ang), r * 0.22, '#80d8ff'); }   // jet pack
  const bw = heavy ? 1.05 : 0.85;
  c.save(); c.rotate(ang);
  c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, r * 0.7, r * bw, 0, 0, 6.283); c.fill();                // shoulders
  if (heavy) { c.fillStyle = flash ? '#fff' : 'rgba(30,40,50,0.55)'; c.fillRect(-r * 0.35, -r * 0.75, r * 0.7, r * 1.5); }   // armor plate
  if (look === 'flame') { c.fillStyle = '#b0b7bd'; c.beginPath(); c.arc(-r * 0.7, -r * 0.3, r * 0.3, 0, 6.283); c.arc(-r * 0.7, r * 0.3, r * 0.3, 0, 6.283); c.fill(); }
  if (look === 'vet') { c.fillStyle = '#ffd54f'; c.beginPath(); c.moveTo(-r * 0.2, -r * 0.8); c.lineTo(r * 0.2, -r * 0.55); c.lineTo(-r * 0.2, -r * 0.3); c.fill(); }
  const medic = look === 'medic' || look === 'triage' || look === 'combatmed' || look === 'evac' || look === 'medheavy' || look === 'nanomed';
  const crossCol = look === 'nanomed' ? '#1de9b6' : '#e74c3c';
  if (medic) { c.fillStyle = crossCol; c.fillRect(-r * 0.45, -r * 0.12, r * 0.5, r * 0.24); c.fillRect(-r * 0.32, -r * 0.3, r * 0.24, r * 0.6); }
  c.fillStyle = look === 'special' ? '#2a2a2a' : '#f0c8a0'; c.beginPath(); c.arc(r * 0.05, 0, r * 0.45, 0, 6.283); c.fill();       // head
  const hc = HELMETS[look] || '#4b5320';
  c.fillStyle = flash ? '#fff' : hc; c.beginPath(); c.arc(0, 0, r * 0.5, 0, 6.283); c.fill();                  // helmet
  if (look === 'officer') { c.fillStyle = '#d4af37'; c.fillRect(r * 0.15, -r * 0.5, r * 0.18, r * 1.0); }
  if (look === 'shock') { c.fillStyle = '#e74c3c'; c.fillRect(-r * 0.5, -r * 0.1, r * 1.0, r * 0.2); }
  if (look === 'special') { c.fillStyle = '#76ff03'; c.beginPath(); c.arc(r * 0.35, -r * 0.17, r * 0.1, 0, 6.283); c.arc(r * 0.35, r * 0.17, r * 0.1, 0, 6.283); c.fill(); }
  if (look === 'contractor') { c.fillStyle = '#90a4ae'; c.fillRect(r * 0.25, -r * 0.3, r * 0.15, r * 0.6); }
  if (look === 'h_ashford') { c.strokeStyle = '#4e4428'; c.lineWidth = Math.max(1.2, r * 0.14); c.beginPath(); c.arc(0, 0, r * 0.68, 0, 6.283); c.stroke(); }     // Brodie helmet brim
  if (look === 'h_kane') { c.fillStyle = '#000'; c.fillRect(r * 0.3, -r * 0.32, r * 0.18, r * 0.64); }                                                                   // dark glasses
  if (look === 'h_reyes') { c.fillStyle = '#76ff03'; c.beginPath(); c.arc(-r * 0.05, -r * 0.42, r * 0.1, 0, 6.283); c.fill(); }                                         // headset light
  if (look === 'plasmarifle' || look === 'gauss' || look === 'powerarmor' || look === 'cryogren' || look === 'h_nova') { c.fillStyle = look === 'cryogren' ? '#e0f7fa' : look === 'powerarmor' ? '#ffab40' : '#18ffff'; c.fillRect(r * 0.2, -r * 0.3, r * 0.3, r * 0.6); }
  if (look === 'nanomed') { c.strokeStyle = 'rgba(29,233,182,0.55)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, r * 1.05 + Math.sin((anim || 0) / 5) * 1.2, 0, 6.283); c.stroke(); }
  if (medic) { c.fillStyle = crossCol; c.fillRect(-r * 0.04, -r * 0.3, r * 0.14, r * 0.6); c.fillRect(-r * 0.22, -r * 0.08, r * 0.5, r * 0.16); }
  if (look === 'evac') { c.strokeStyle = 'rgba(236,240,241,0.8)'; c.lineWidth = 1.2; const a = (anim || 0) / 3; c.beginPath(); c.moveTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); c.lineTo(-Math.cos(a) * r * 1.2, -Math.sin(a) * r * 1.2); c.stroke(); }
  c.lineWidth = Math.max(1.4, r * 0.24); c.lineCap = 'butt';
  const wy = r * 0.45;
  if (look === 'marksman' || look === 'h_kane') { c.strokeStyle = look === 'h_kane' ? '#111' : '#3e3a2c'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 2.3, wy); c.stroke(); c.fillStyle = '#111'; c.fillRect(r * 0.9, wy - r * 0.38, r * 0.5, r * 0.22); if (look === 'h_kane') c.fillRect(r * 2.1, wy - r * 0.16, r * 0.45, r * 0.32); }
  else if (look === 'heavy' || look === 'riot' || look === 'medheavy') {
    c.strokeStyle = '#263238'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 1.2, wy); c.stroke();
    c.fillStyle = look === 'riot' ? 'rgba(144,202,249,0.75)' : 'rgba(144,164,174,0.8)'; c.fillRect(r * 0.95, -r * 1.05, r * 0.28, r * 2.1);       // riot shield
  }
  else if (look === 'assault' || look === 'shock') { c.strokeStyle = '#263238'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 1.35, wy); c.stroke(); c.fillStyle = '#263238'; c.fillRect(r * 0.5, wy, r * 0.25, r * 0.5); }
  else if (look === 'mgteam') { c.strokeStyle = '#1c1f22'; c.lineWidth = Math.max(2.4, r * 0.34); c.beginPath(); c.moveTo(r * 0.1, wy); c.lineTo(r * 1.9, wy); c.stroke(); c.lineWidth = 1; c.beginPath(); c.moveTo(r * 1.5, wy); c.lineTo(r * 1.9, wy - r * 0.5); c.moveTo(r * 1.5, wy); c.lineTo(r * 1.9, wy + r * 0.5); c.stroke(); }
  else if (look === 'grenadier' || look === 'smokeman') { c.strokeStyle = '#2b2b2b'; c.lineWidth = Math.max(2.6, r * 0.4); c.beginPath(); c.moveTo(r * 0.1, wy); c.lineTo(r * 1.5, wy); c.stroke(); if (look === 'smokeman') { c.fillStyle = 'rgba(200,205,210,0.8)'; c.beginPath(); c.arc(r * 1.7, wy, r * 0.4, 0, 6.283); c.fill(); } }
  else if (look === 'flame') { c.strokeStyle = '#555'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 1.5, wy); c.stroke(); c.fillStyle = (anim || 0) % 8 < 4 ? '#ff7043' : '#ffca28'; c.beginPath(); c.moveTo(r * 1.5, wy - r * 0.3); c.lineTo(r * 2.2, wy); c.lineTo(r * 1.5, wy + r * 0.3); c.fill(); }
  else if (look === 'emp') { c.strokeStyle = '#78909c'; c.beginPath(); c.moveTo(r * 0.1, wy); c.lineTo(r * 1.3, wy); c.stroke(); c.strokeStyle = '#fff176'; c.lineWidth = 1.2; c.beginPath(); c.arc(r * 1.4, wy, r * 0.5, -1, 1); c.stroke(); c.beginPath(); c.arc(r * 1.4, wy, r * 0.85, -0.8, 0.8); c.stroke(); }
  else if (look === 'engineer') { c.strokeStyle = '#b0bec5'; c.beginPath(); c.moveTo(0, wy); c.lineTo(r * 1.4, wy); c.stroke(); c.fillStyle = '#b0bec5'; c.fillRect(r * 1.3, wy - 2, 3, 4); }
  else if (medic) { c.strokeStyle = '#37474f'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * (look === 'combatmed' ? 1.6 : 1.0), wy); c.stroke(); }
  else if (look === 'plasmarifle') { c.strokeStyle = '#263238'; c.lineWidth = Math.max(2.2, r * 0.32); c.beginPath(); c.moveTo(r * 0.1, wy); c.lineTo(r * 1.6, wy); c.stroke(); glowDot(c, r * 1.7, wy, r * 0.25 + Math.sin((anim || 0) / 3) * 0.4, '#18ffff'); }
  else if (look === 'gauss') { c.strokeStyle = '#263238'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 2.5, wy); c.stroke(); c.fillStyle = '#18ffff'; for (let i = 0; i < 4; i++) c.fillRect(r * (0.9 + i * 0.4), wy - r * 0.2, r * 0.12, r * 0.4); }
  else if (look === 'powerarmor' || look === 'h_nova') { c.strokeStyle = '#263238'; c.lineWidth = Math.max(3, r * 0.42); c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 1.5, wy); c.stroke(); glowDot(c, r * 1.55, wy, r * 0.22, '#ffab40'); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(-r * 0.2, -r * 0.8, r * 0.3, r * 1.6); }
  else if (look === 'cryogren') { c.strokeStyle = '#2b2b2b'; c.lineWidth = Math.max(2.6, r * 0.4); c.beginPath(); c.moveTo(r * 0.1, wy); c.lineTo(r * 1.5, wy); c.stroke(); c.fillStyle = '#b3e5fc'; c.beginPath(); c.moveTo(r * 1.5, wy - r * 0.35); c.lineTo(r * 2.1, wy); c.lineTo(r * 1.5, wy + r * 0.35); c.fill(); }
  else if (look === 'officer') { c.strokeStyle = '#37474f'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 0.9, wy); c.stroke(); }
  else if (look === 'special') { c.strokeStyle = '#111'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 1.9, wy); c.stroke(); c.lineWidth = Math.max(2.2, r * 0.34); c.beginPath(); c.moveTo(r * 1.5, wy); c.lineTo(r * 1.9, wy); c.stroke(); }
  else { c.strokeStyle = '#263238'; c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 1.7, wy); c.stroke(); c.strokeStyle = '#6d4c41'; c.lineWidth = Math.max(1.6, r * 0.3); c.beginPath(); c.moveTo(r * 0.2, wy); c.lineTo(r * 0.7, wy); c.stroke(); }
  c.restore();
  if (look === 'officer') { c.strokeStyle = '#fff59d'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, r + 2, 0, 6.283); c.stroke(); }
  c.restore();
}

function drawTankBody(c, turret) {
  c.fillStyle = '#1b4f72'; c.fillRect(-15, -12, 30, 24); c.fillStyle = '#212f3d'; c.fillRect(-16, -13, 32, 5); c.fillRect(-16, 8, 32, 5);
  c.save(); c.rotate(turret || 0); c.fillStyle = '#2e86c1'; c.beginPath(); c.arc(0, 0, 8, 0, 6.283); c.fill(); c.fillStyle = '#1b4f72'; c.fillRect(4, -2.5, 16, 5); c.restore();
}
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
