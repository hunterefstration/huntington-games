// ----- decorations -----
function drawRug(c, x, y) {
  const px = x * TS, py = y * TS;
  c.fillStyle = '#9f1239'; rrect(c, px + 2, py + 4, 28, 24, 3); c.fill();
  c.strokeStyle = '#fbbf24'; c.lineWidth = 1.5; rrect(c, px + 4.5, py + 6.5, 23, 19, 2); c.stroke();
  c.fillStyle = '#fde68a'; c.beginPath(); c.moveTo(px + 16, py + 9); c.lineTo(px + 23, py + 16); c.lineTo(px + 16, py + 23); c.lineTo(px + 9, py + 16); c.closePath(); c.fill();
  c.fillStyle = '#be123c'; c.beginPath(); c.moveTo(px + 16, py + 12); c.lineTo(px + 20, py + 16); c.lineTo(px + 16, py + 20); c.lineTo(px + 12, py + 16); c.closePath(); c.fill();
  c.fillStyle = 'rgba(253,230,138,0.7)'; for (let i = 0; i < 5; i++) { c.fillRect(px + 5 + i * 5, py + 2, 1.5, 2); c.fillRect(px + 5 + i * 5, py + 28, 1.5, 2); }
}
function drawDecor(c, x, y, v) {
  const px = x * TS, py = y * TS;
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(px + 16, py + 28, 11, 3.2, 0, 0, 6.3); c.fill();
  if (v === TILE.LAMP) {
    c.fillStyle = 'rgba(253,224,71,0.18)'; c.beginPath(); c.arc(px + 16, py + 12, 14, 0, 6.3); c.fill();
    c.fillStyle = '#44403c'; c.fillRect(px + 15, py + 12, 2.2, 15);
    c.fillStyle = '#292524'; c.beginPath(); c.ellipse(px + 16, py + 27, 6, 2.2, 0, 0, 6.3); c.fill();
    c.fillStyle = '#fde68a'; c.beginPath(); c.moveTo(px + 11, py + 3); c.lineTo(px + 21, py + 3); c.lineTo(px + 24, py + 13); c.lineTo(px + 8, py + 13); c.closePath(); c.fill();
    c.fillStyle = '#f59e0b'; c.fillRect(px + 8, py + 12, 16, 2);
  } else if (v === TILE.SHELF) {
    c.fillStyle = '#7c2d12'; rrect(c, px + 4, py + 2, 24, 26, 2); c.fill();
    c.fillStyle = '#431407'; c.fillRect(px + 6, py + 4, 20, 22);
    const cols = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#14b8a6'];
    for (let r = 0; r < 3; r++) {
      let bx = px + 6.5;
      for (let i = 0; i < 6; i++) { const w = 2 + ((x * 3 + y * 5 + r * 7 + i) % 3); if (bx + w > px + 25.5) break; c.fillStyle = cols[(x + y + r * 2 + i) % cols.length]; c.fillRect(bx, py + 5 + r * 7.3, w, 6); bx += w + 0.7; }
      c.fillStyle = '#9a3412'; c.fillRect(px + 6, py + 11 + r * 7.3, 20, 1.3);
    }
  } else if (v === TILE.SOFA) {
    c.fillStyle = '#115e59'; rrect(c, px + 2, py + 6, 28, 12, 4); c.fill();
    c.fillStyle = '#14b8a6'; rrect(c, px + 5, py + 13, 22, 11, 3); c.fill();
    c.fillStyle = '#0f766e'; rrect(c, px + 1, py + 11, 6, 15, 3); c.fill(); rrect(c, px + 25, py + 11, 6, 15, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(px + 15.5, py + 14, 1, 9);
    c.fillStyle = '#fbbf24'; rrect(c, px + 7, py + 9, 6, 6, 2); c.fill();
  } else if (v === TILE.ART) {
    c.strokeStyle = '#78350f'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 10, py + 28); c.lineTo(px + 14, py + 18); c.moveTo(px + 22, py + 28); c.lineTo(px + 18, py + 18); c.moveTo(px + 16, py + 28); c.lineTo(px + 16, py + 20); c.stroke();
    c.fillStyle = '#a16207'; rrect(c, px + 5, py + 2, 22, 18, 1.5); c.fill();
    c.fillStyle = '#f8fafc'; c.fillRect(px + 7, py + 4, 18, 14);
    c.fillStyle = '#38bdf8'; c.fillRect(px + 7, py + 4, 18, 6);
    c.fillStyle = '#fde047'; c.beginPath(); c.arc(px + 21, py + 8, 2.5, 0, 6.3); c.fill();
    c.fillStyle = '#16a34a'; c.beginPath(); c.moveTo(px + 7, py + 18); c.lineTo(px + 13, py + 9); c.lineTo(px + 19, py + 18); c.closePath(); c.fill();
    c.fillStyle = '#ec4899'; c.beginPath(); c.arc(px + 21, py + 15, 2.2, 0, 6.3); c.fill();
  } else if (v === TILE.FOUNTAIN) {
    c.fillStyle = '#64748b'; c.beginPath(); c.arc(px + 16, py + 17, 13, 0, 6.3); c.fill();
    c.fillStyle = '#cbd5e1'; c.beginPath(); c.arc(px + 16, py + 16, 12, 0, 6.3); c.fill();
    c.fillStyle = '#0ea5e9'; c.beginPath(); c.arc(px + 16, py + 16, 9.5, 0, 6.3); c.fill();
    c.fillStyle = '#7dd3fc'; c.beginPath(); c.arc(px + 13, py + 13, 4, 0, 6.3); c.fill();
    c.fillStyle = '#94a3b8'; c.beginPath(); c.arc(px + 16, py + 16, 3, 0, 6.3); c.fill();
    c.fillStyle = '#e0f2fe'; [[16, 7], [11, 10], [21, 10], [9, 16], [23, 16]].forEach(d => { c.beginPath(); c.arc(px + d[0], py + d[1], 1.2, 0, 6.3); c.fill(); });
  } else if (v === TILE.PIANO) {
    c.fillStyle = '#0f172a'; c.beginPath(); c.moveTo(px + 4, py + 4); c.lineTo(px + 22, py + 4); c.quadraticCurveTo(px + 30, py + 6, px + 28, py + 16); c.quadraticCurveTo(px + 26, py + 22, px + 28, py + 26); c.lineTo(px + 4, py + 26); c.closePath(); c.fill();
    c.fillStyle = '#334155'; c.fillRect(px + 7, py + 7, 13, 1.5);
    c.fillStyle = '#f8fafc'; c.fillRect(px + 4, py + 21, 24, 6);
    c.fillStyle = '#0f172a'; for (let i = 0; i < 7; i++) if (i !== 2 && i !== 6) c.fillRect(px + 6.5 + i * 3.3, py + 21, 1.8, 3.5);
    c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(px + 6, py + 5, 10, 1.2);
  } else if (v === TILE.AQUARIUM) {
    c.fillStyle = '#1e293b'; rrect(c, px + 2, py + 5, 28, 23, 3); c.fill();
    c.fillStyle = '#0891b2'; c.fillRect(px + 4, py + 7, 24, 19);
    c.fillStyle = '#22d3ee'; c.fillRect(px + 4, py + 7, 24, 5);
    c.fillStyle = '#fde68a'; c.fillRect(px + 4, py + 23, 24, 3);
    c.fillStyle = '#16a34a'; c.beginPath(); c.moveTo(px + 7, py + 23); c.quadraticCurveTo(px + 5, py + 17, px + 8, py + 13); c.quadraticCurveTo(px + 9, py + 18, px + 9, py + 23); c.fill();
    c.fillStyle = '#fb923c'; c.beginPath(); c.ellipse(px + 17, py + 15, 3.5, 2.2, 0, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(px + 20, py + 15); c.lineTo(px + 23, py + 13); c.lineTo(px + 23, py + 17); c.closePath(); c.fill();
    c.fillStyle = '#fde047'; c.beginPath(); c.ellipse(px + 12, py + 19, 2.5, 1.6, 0, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(px + 23, py + 9, 1.5, 1.5); c.fillRect(px + 21, py + 11, 1, 1);
  } else if (v === TILE.FLOWERS) {
    c.fillStyle = '#92400e'; rrect(c, px + 4, py + 15, 24, 10, 2); c.fill();
    c.fillStyle = '#78350f'; c.beginPath(); c.arc(px + 9, py + 26, 3, 0, 6.3); c.arc(px + 23, py + 26, 3, 0, 6.3); c.fill();
    c.fillStyle = '#15803d'; c.beginPath(); c.ellipse(px + 16, py + 14, 12, 5, 0, 0, 6.3); c.fill();
    [['#f472b6', 8, 11], ['#fde047', 13, 8], ['#f9fafb', 18, 11], ['#a78bfa', 23, 9], ['#fb7185', 16, 14], ['#f472b6', 25, 13]].forEach(f => { c.fillStyle = f[0]; c.beginPath(); c.arc(px + f[1], py + f[2], 2.6, 0, 6.3); c.fill(); });
  } else if (v === TILE.PARASOL) {
    c.fillStyle = '#f8fafc'; rrect(c, px + 14, py + 18, 15, 9, 2); c.fill();
    c.strokeStyle = '#0ea5e9'; c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(px + 15, py + 20 + i * 3); c.lineTo(px + 28, py + 20 + i * 3); c.stroke(); }
    c.strokeStyle = '#78350f'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(px + 11, py + 10); c.lineTo(px + 11, py + 28); c.stroke();
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#f8fafc' : '#ef4444'; c.beginPath(); c.moveTo(px + 11, py + 9); c.arc(px + 11, py + 9, 11, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6); c.closePath(); c.fill(); }
  } else if (v === TILE.PUMPKIN) {
    c.fillStyle = '#a16207'; c.beginPath(); c.ellipse(px + 16, py + 25, 13, 3.5, 0, 0, 6.3); c.fill();
    drawPumpkinSmall(c, px + 9, py + 21, false); drawPumpkinSmall(c, px + 24, py + 22, false);
    c.save(); c.translate(px + 16, py + 14); c.scale(1.5, 1.5); drawPumpkinSmall(c, 0, 0, true); c.restore();
  } else if (v === TILE.SNOWMAN) {
    c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(px + 16, py + 21, 7.5, 0, 6.3); c.fill(); c.beginPath(); c.arc(px + 16, py + 10, 5.5, 0, 6.3); c.fill();
    c.strokeStyle = '#cbd5e1'; c.lineWidth = 1; c.beginPath(); c.arc(px + 16, py + 21, 7.5, 0, 6.3); c.stroke();
    c.fillStyle = '#111827'; c.fillRect(px + 11, py + 3, 10, 1.6); c.fillRect(px + 12.5, py - 3, 7, 6.5);
    c.fillRect(px + 14, py + 9, 1.4, 1.4); c.fillRect(px + 17, py + 9, 1.4, 1.4); c.fillRect(px + 15.5, py + 18, 1.4, 1.4); c.fillRect(px + 15.5, py + 22, 1.4, 1.4);
    c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(px + 16, py + 11); c.lineTo(px + 21, py + 12); c.lineTo(px + 16, py + 12.6); c.closePath(); c.fill();
    c.fillStyle = '#dc2626'; c.fillRect(px + 11.5, py + 14, 9, 2.2);
    c.strokeStyle = '#78350f'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 9, py + 19); c.lineTo(px + 3, py + 14); c.moveTo(px + 23, py + 19); c.lineTo(px + 29, py + 14); c.stroke();
  } else if (v === TILE.TROPHY) {
    c.fillStyle = '#44403c'; rrect(c, px + 8, py + 22, 16, 6, 1.5); c.fill();
    c.fillStyle = '#ca8a04'; c.fillRect(px + 14, py + 15, 4, 7);
    const gr = c.createLinearGradient(px + 8, 0, px + 24, 0); gr.addColorStop(0, '#fde047'); gr.addColorStop(0.5, '#fef9c3'); gr.addColorStop(1, '#ca8a04');
    c.fillStyle = gr; c.beginPath(); c.moveTo(px + 8, py + 3); c.lineTo(px + 24, py + 3); c.quadraticCurveTo(px + 24, py + 15, px + 16, py + 16); c.quadraticCurveTo(px + 8, py + 15, px + 8, py + 3); c.fill();
    c.strokeStyle = '#eab308'; c.lineWidth = 1.6; c.beginPath(); c.arc(px + 7, py + 8, 3.5, 1.5, 4.8); c.stroke(); c.beginPath(); c.arc(px + 25, py + 8, 3.5, -1.6, 1.6); c.stroke();
    c.fillStyle = '#a16207'; c.font = 'bold 7px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('1', px + 16, py + 9);
  }
}
function drawStatic() {
  const c = gfx.sctx, loc = curLoc();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, gfx.stat.width, gfx.stat.height);
  c.setTransform(gfx.k, 0, 0, gfx.k, 0, 0);
  c.fillStyle = 'rgba(0,0,0,0.35)'; rrect(c, 2, 5, CANVAS_PX - 4, CANVAS_PX - 4, 14); c.fill();
  c.fillStyle = '#3d2a1b'; rrect(c, 0, 0, CANVAS_PX - 2, CANVAS_PX - 2, 14); c.fill();
  c.strokeStyle = '#5b4028'; c.lineWidth = 2; rrect(c, 1, 1, CANVAS_PX - 4, CANVAS_PX - 4, 13); c.stroke();
  c.save();
  c.translate(FRAME - 1, FRAME - 1);
  rrect(c, 0, 0, MAP_PX, MAP_PX, 6); c.clip();
  c.fillStyle = loc.theme.bg; c.fillRect(0, 0, MAP_PX, MAP_PX);
  const si = seasonIdx(), hol = curHoliday();
  c.fillStyle = SEASON_TINT[si]; c.fillRect(0, 0, MAP_PX, MAP_PX);
  const g = loc.grid;
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    const v = g[y][x];
    if (v === TILE.EMPTY) { drawGround(c, x, y, loc); seasonGround(c, x, y, loc, si, hol); }
    else if (v === TILE.FLOOR) drawFloor(c, x, y);
    else if (v === TILE.DOOR) drawDoor(c, x, y);
    else if (v === TILE.PARKING) drawParking(c, x, y, loc);
    else { drawFloor(c, x, y); if (v === TILE.RUG) drawRug(c, x, y); }
  }
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) {
    const v = g[y][x];
    if (v === TILE.COUNTER) drawCounter(c, x, y, loc);
    else if (v === TILE.BREWER) drawBrewer(c, x, y);
    else if (v === TILE.PLANT) drawPlant(c, x, y);
    else if (v === TILE.TABLE) drawTable(c, x, y);
    else if (v > TILE.RUG) drawDecor(c, x, y, v);
  }
  if (hol) drawHolidayDeco(c, loc, hol);
  c.restore();
  gfx.staticDirty = false;
  gfx.staticKey = dayIdx() + '|' + cur;
}
// ----- seasons on the map: tinted ground, petals / sunflowers / leaves / snow, holiday decorations -----
const SEASON_TINT = ['rgba(255,182,213,0.08)', 'rgba(255,236,140,0.08)', 'rgba(214,96,24,0.17)', 'rgba(241,247,255,0.42)'];
const LEAF_COLS = ['#ea580c', '#dc2626', '#f59e0b', '#b45309'], PETAL_COLS = ['#fbcfe8', '#f9a8d4', '#fdf2f8', '#f472b6'];
function seasonGround(c, x, y, loc, si, hol) {
  const px = x * TS, py = y * TS, r = hash2(x, y, loc.seed + 31);
  if (si === 0) {
    if (r < 0.3) for (let i = 0; i < 3; i++) { const a = hash2(x, y, i + 40), b = hash2(x, y, i + 50); c.fillStyle = PETAL_COLS[i % 3]; c.beginPath(); c.ellipse(px + 4 + a * 24, py + 4 + b * 24, 2.3, 1.4, a * 3, 0, 6.3); c.fill(); }
  } else if (si === 1) {
    if (r < 0.06) {
      const ox = px + 16, oy = py + 14;
      c.strokeStyle = '#166534'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ox, oy + 3); c.lineTo(ox, oy + 13); c.stroke();
      c.fillStyle = '#facc15'; for (let i = 0; i < 8; i++) { const a = i * 0.785; c.beginPath(); c.ellipse(ox + Math.cos(a) * 4, oy + Math.sin(a) * 4, 2.6, 1.4, a, 0, 6.3); c.fill(); }
      c.fillStyle = '#78350f'; c.beginPath(); c.arc(ox, oy, 2.6, 0, 6.3); c.fill();
    }
  } else if (si === 2) {
    if (r < 0.45) for (let i = 0; i < 2 + (r < 0.2 ? 1 : 0); i++) { const a = hash2(x, y, i + 60), b = hash2(x, y, i + 70); c.fillStyle = LEAF_COLS[Math.floor(hash2(x, y, i + 80) * 4)]; c.beginPath(); c.ellipse(px + 4 + a * 24, py + 4 + b * 24, 3.2, 1.7, a * 6, 0, 6.3); c.fill(); }
  } else {
    if (r < 0.6) { c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(px + 8 + r * 26, py + 10 + hash2(x, y, 90) * 14, 9, 4.5, 0, 0, 6.3); c.fill(); }
  }
  if (hol && hol.costumes && r > 0.955) drawPumpkinSmall(c, px + 16, py + 18, false);
}
function drawPumpkinSmall(c, x, y, lit) {
  c.fillStyle = '#ea580c'; c.beginPath(); c.ellipse(x - 2.5, y, 3.5, 4.2, 0, 0, 6.3); c.ellipse(x + 2.5, y, 3.5, 4.2, 0, 0, 6.3); c.fill();
  c.fillStyle = '#f97316'; c.beginPath(); c.ellipse(x, y, 3.2, 4.5, 0, 0, 6.3); c.fill();
  c.fillStyle = '#166534'; c.fillRect(x - 0.8, y - 6.5, 1.8, 3);
  if (lit) { c.fillStyle = '#fde047'; c.beginPath(); c.moveTo(x - 3.5, y - 1.5); c.lineTo(x - 1.5, y - 1.5); c.lineTo(x - 2.5, y - 3); c.closePath(); c.moveTo(x + 1.5, y - 1.5); c.lineTo(x + 3.5, y - 1.5); c.lineTo(x + 2.5, y - 3); c.closePath(); c.fill(); c.fillRect(x - 3, y + 1, 6, 1.4); }
}
function drawHolidayDeco(c, loc, h) {
  // bunting along the top of the lot
  c.strokeStyle = 'rgba(40,25,15,0.75)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 5);
  for (let x = 0; x < MAP_PX; x += 24) c.quadraticCurveTo(x + 12, 17, x + 24, 5);
  c.stroke();
  for (let i = 0; i * 12 + 2 < MAP_PX; i++) {
    const x = i * 12 + 2, t = (x % 24) / 24, y = 5 + 12 * t * (1 - t);
    c.fillStyle = h.flags[i % h.flags.length]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8, y + 1); c.lineTo(x + 3.5, y + 9); c.closePath(); c.fill();
  }
  const cc = C(loc);
  if (h.lights) cc.counters.forEach(k => { const px = k.x * TS, py = k.y * TS; for (let i = 0; i < 6; i++) { c.fillStyle = ['#ef4444', '#22c55e', '#facc15', '#3b82f6'][(i + k.x) % 4]; c.beginPath(); c.arc(px + 3 + i * 5.2, py + 3 + (i % 2), 1.7, 0, 6.3); c.fill(); } });
  if (h.costumes) cc.doors.forEach(d => drawPumpkinSmall(c, d.x * TS + 26, d.y * TS + 25, true));
}
const FALL = [];
for (let i = 0; i < 30; i++) FALL.push({ x: Math.random() * MAP_PX, y: Math.random() * MAP_PX, vy: 14 + Math.random() * 18, ph: Math.random() * 6.3, f: 1 + Math.random() * 1.5, s: 1 + Math.random() * 1.3, c: i % 4 });
function drawFall(c, dt, si) {
  if (si === 1) return;                    // summer: nothing falling
  const n = si === 3 ? 30 : 14, cols = si === 0 ? PETAL_COLS : LEAF_COLS;
  for (let i = 0; i < n; i++) {
    const p = FALL[i];
    p.y += p.vy * dt * (si === 3 ? 1 : 0.7);
    p.x += Math.sin(gfx.t * p.f + p.ph) * 14 * dt;
    if (p.y > MAP_PX + 4) { p.y = -4; p.x = Math.random() * MAP_PX; }
    if (p.x < -4) p.x += MAP_PX + 8; else if (p.x > MAP_PX + 4) p.x -= MAP_PX + 8;
    c.fillStyle = si === 3 ? 'rgba(255,255,255,0.85)' : cols[p.c]; c.beginPath();
    if (si === 3) c.arc(p.x, p.y, p.s, 0, 6.3); else c.ellipse(p.x, p.y, p.s * 2, p.s * 1.1, Math.sin(gfx.t * p.f + p.ph) * 1.3, 0, 6.3);
    c.fill();
  }
}
const FW = [], FW_COLS = ['#f87171', '#fde047', '#60a5fa', '#4ade80', '#f0abfc', '#ffffff'];
for (let i = 0; i < 90; i++) FW.push({ on: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, col: '#fff' });
function drawFireworks(c, dt) {
  gfx.fwT = (gfx.fwT || 0) - dt;
  if (gfx.fwT <= 0) {
    gfx.fwT = 0.7 + Math.random() * 1.3;
    const cx = 60 + Math.random() * (MAP_PX - 120), cy = 40 + Math.random() * 150, col = FW_COLS[Math.floor(Math.random() * FW_COLS.length)];
    for (let i = 0, k = 0; i < FW.length && k < 24; i++) {
      const p = FW[i]; if (p.on) continue;
      const a = k / 24 * 6.283, sp = (k % 2 ? 45 : 70) + Math.random() * 20;
      p.on = 1; p.x = cx; p.y = cy; p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.life = 1; p.col = col; k++;
    }
  }
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < FW.length; i++) {
    const p = FW[i]; if (!p.on) continue;
    p.life -= dt * 0.9; if (p.life <= 0) { p.on = 0; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; p.vx *= 0.985;
    c.globalAlpha = p.life; c.fillStyle = p.col; c.fillRect(p.x - 1.6, p.y - 1.6, 3.2, 3.2);
    c.globalAlpha = p.life * 0.35; c.fillRect(p.x - p.vx * 0.06 - 1, p.y - p.vy * 0.06 - 1, 2, 2);      // short trail
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

// ----- people -----
const SCARVES = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b'];
const SKINS = ['#f5cba7', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#f1c27d'];
const HAIRS = ['#2d1b0e', '#5a3825', '#111827', '#b45309', '#e5e7eb', '#7c2d12'];
function drawPerson(c, cx, cy, o) {
  const bob = o.moving ? -Math.abs(Math.sin(gfx.t * 14 + (o.ph || 0))) * 1.8 : Math.sin(gfx.t * 3 + (o.ph || 0)) * 0.4;
  cy += bob;
  c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(cx, cy + 11 - bob, 7, 3, 0, 0, 6.3); c.fill();
  // legs
  c.fillStyle = '#1f2937'; c.fillRect(cx - 4, cy + 5, 3, 5); c.fillRect(cx + 1, cy + 5, 3, 5);
  // body
  c.fillStyle = o.body; rrect(c, cx - 6, cy - 4, 12, 11, 4); c.fill();
  if (o.trim) { c.fillStyle = o.trim; }
  if (o.apron) { c.fillStyle = o.apron; rrect(c, cx - 4, cy - 1, 8, 8, 2); c.fill(); }
  if (o.tie) { c.fillStyle = o.tie; c.beginPath(); c.moveTo(cx, cy - 4); c.lineTo(cx + 2, cy); c.lineTo(cx, cy + 4); c.lineTo(cx - 2, cy); c.closePath(); c.fill(); }
  if (o.pack) { c.fillStyle = o.pack; rrect(c, cx + 5, cy - 3, 4, 8, 2); c.fill(); }
  if (o.scarf) { c.fillStyle = o.scarf; c.fillRect(cx - 5, cy - 5, 10, 2.6); c.fillRect(cx + 1.5, cy - 4, 2.6, 6); }
  // head
  c.fillStyle = o.skin; c.beginPath(); c.arc(cx, cy - 8, 5, 0, 6.3); c.fill();
  c.fillStyle = o.hair; c.beginPath(); c.arc(cx, cy - 9, 5, Math.PI, 0); c.fill();
  if (o.hat === 'cap') { c.fillStyle = o.hatCol; c.beginPath(); c.arc(cx, cy - 10, 5.2, Math.PI, 0); c.fill(); c.fillRect(cx - 6, cy - 10, 12, 2); }
  if (o.hat === 'straw') { c.fillStyle = '#fcd34d'; c.beginPath(); c.ellipse(cx, cy - 11, 8.5, 2.6, 0, 0, 6.3); c.fill(); c.fillStyle = '#f59e0b'; c.beginPath(); c.arc(cx, cy - 11.5, 4.5, Math.PI, 0); c.fill(); }
  if (o.hat === 'top') { c.fillStyle = '#111827'; c.fillRect(cx - 7, cy - 12.5, 14, 2); c.fillRect(cx - 4.5, cy - 19, 9, 7); c.fillStyle = '#eab308'; c.fillRect(cx - 4.5, cy - 14.5, 9, 1.5); }
  if (o.hat === 'witch') { c.fillStyle = '#4c1d95'; c.beginPath(); c.ellipse(cx, cy - 11, 8.5, 2.3, 0, 0, 6.3); c.fill(); c.beginPath(); c.moveTo(cx - 5, cy - 11.5); c.lineTo(cx + 2, cy - 24); c.lineTo(cx + 5, cy - 11.5); c.closePath(); c.fill(); c.fillStyle = '#f59e0b'; c.fillRect(cx - 4.6, cy - 13.4, 9.2, 1.6); }
  if (o.hat === 'cat') { c.fillStyle = '#111827'; c.beginPath(); c.moveTo(cx - 5.5, cy - 10); c.lineTo(cx - 4, cy - 17); c.lineTo(cx - 0.5, cy - 12); c.closePath(); c.moveTo(cx + 5.5, cy - 10); c.lineTo(cx + 4, cy - 17); c.lineTo(cx + 0.5, cy - 12); c.closePath(); c.fill(); c.fillStyle = '#f9a8d4'; c.beginPath(); c.moveTo(cx - 4.3, cy - 11.5); c.lineTo(cx - 3.9, cy - 15); c.lineTo(cx - 2.2, cy - 12.4); c.closePath(); c.moveTo(cx + 4.3, cy - 11.5); c.lineTo(cx + 3.9, cy - 15); c.lineTo(cx + 2.2, cy - 12.4); c.closePath(); c.fill(); }
  if (o.hat === 'beanie') { c.fillStyle = o.hatCol; c.beginPath(); c.arc(cx, cy - 9.5, 5.6, Math.PI, 0); c.fill(); c.fillStyle = '#f8fafc'; c.fillRect(cx - 5.8, cy - 10.2, 11.6, 2); c.beginPath(); c.arc(cx, cy - 15.6, 1.8, 0, 6.3); c.fill(); }
  // face
  if (o.shades) { c.fillStyle = '#0f172a'; c.fillRect(cx - 4.5, cy - 9.5, 9, 3); }
  else { c.fillStyle = '#111827'; c.fillRect(cx - 2.6, cy - 8.6, 1.4, 1.8); c.fillRect(cx + 1.4, cy - 8.6, 1.4, 1.8); }
  if (o.glasses) { c.strokeStyle = '#1f2937'; c.lineWidth = 0.9; c.beginPath(); c.arc(cx - 2, cy - 7.8, 1.9, 0, 6.3); c.moveTo(cx + 3.9, cy - 7.8); c.arc(cx + 2, cy - 7.8, 1.9, 0, 6.3); c.stroke(); }
  if (o.phone) { c.fillStyle = '#111827'; rrect(c, cx + 5, cy - 3, 4, 6.5, 1); c.fill(); c.fillStyle = '#7dd3fc'; c.fillRect(cx + 5.8, cy - 2.2, 2.4, 4); }
  if (o.mood === 'happy') { c.strokeStyle = '#7f1d1d'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy - 6.3, 2, 0.2, Math.PI - 0.2); c.stroke(); }
  else if (o.mood === 'angry') {
    c.strokeStyle = '#7f1d1d'; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy - 4.2, 2, Math.PI + 0.3, -0.3); c.stroke();
    c.strokeStyle = '#111827'; c.beginPath(); c.moveTo(cx - 4, cy - 11); c.lineTo(cx - 1, cy - 9.6); c.moveTo(cx + 4, cy - 11); c.lineTo(cx + 1, cy - 9.6); c.stroke();
    c.fillStyle = 'rgba(239,68,68,0.28)'; c.beginPath(); c.arc(cx, cy - 8, 5.5, 0, 6.3); c.fill();
  }
}
function entPos(e) {
  const frac = clamp(acc / TICK_MS, 0, 1);
  let p = ((state.tick - e.mt) + frac) / (e.md || 1);
  p = clamp(p, 0, 1);
  p = p * p * (3 - 2 * p) * 0.4 + p * 0.6;
  return { x: (e.ox + (e.x - e.ox) * p) * TS + 16, y: (e.oy + (e.y - e.oy) * p) * TS + 17, moving: p < 1 && (e.ox !== e.x || e.oy !== e.y) };
}
function drawCustomer(c, e) {
  const P = entPos(e), K = KINDS[e.kind];
  let x = P.x + (e._dx || 0), y = P.y;
  const left = e.state === 'waiting' ? 1 - e.wait / e.maxWait : 1;
  if (e.state === 'waiting' && left < 0.3 && !settings.lowfx) x += Math.sin(gfx.t * 40) * 0.8;
  const o = { body: K.body, skin: SKINS[e.look % 6], hair: HAIRS[(e.look * 5 + 1) % 6], moving: P.moving, ph: e.look, mood: e.state === 'leaving' ? e.mood : '' };
  if (K.tie) o.tie = K.tie;
  if (K.pack) o.pack = K.pack;
  if (K.hat) { o.hat = K.hat; o.hatCol = K.hatCol; }
  if (K.shades) o.shades = true;
  if (K.glasses) o.glasses = true;
  if (K.phone) o.phone = true;
  if (gfx.hol && gfx.hol.costumes && !K.hat) o.hat = e.look % 3 === 0 ? 'cat' : 'witch';      // Halloween costumes
  if (gfx.sea === 3) o.scarf = SCARVES[e.look % 4];
  drawPerson(c, x, y, o);
  if (e.kind === 'star') { c.fillStyle = '#fde047'; const s = 1.5 + Math.sin(gfx.t * 6) * 0.6; c.fillRect(x + 7, y - 16, s, s); c.fillRect(x - 9, y - 12, s, s); }
  if (e.kind === 'critic') { c.fillStyle = '#eab308'; c.beginPath(); c.arc(x, y + 1, 2.4, 0, 6.3); c.fill(); }
  if (e.state === 'walking' || e.state === 'waiting') {
    const by = y - (e.kind === 'critic' ? 36 : 28);
    c.fillStyle = 'rgba(255,255,255,0.94)'; rrect(c, x - 9, by, 18, 12, 4); c.fill();
    c.strokeStyle = e.kind === 'critic' ? '#eab308' : 'rgba(0,0,0,0.25)'; c.lineWidth = e.kind === 'critic' ? 1.6 : 1; rrect(c, x - 9, by, 18, 12, 4); c.stroke();
    const rec = e.want ? RECIPE_BY_ID[e.want] : null;
    if (rec && rec.food) {
      c.fillStyle = rec.col; c.beginPath(); c.arc(x, by + 6.3, 4, 0, 6.3); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.8; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(x - 2, by + 4.6, 1.4, 1.4); c.fillRect(x + 0.8, by + 6.8, 1.4, 1.4);
    } else if (rec) {
      c.fillStyle = rec.col; rrect(c, x - 4, by + 3, 7, 7, 1.5); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 0.8; rrect(c, x - 4, by + 3, 7, 7, 1.5); c.stroke();
      c.strokeStyle = rec.col; c.lineWidth = 1.3; c.beginPath(); c.arc(x + 4, by + 6.5, 2, -1.4, 1.4); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 0.5, by + 3.4, 1.7, Math.PI, 0); c.fill();
    } else {
      c.fillStyle = TIER_COLOR[e.tier]; rrect(c, x - 4, by + 3, 7, 7, 1.5); c.fill();
      c.strokeStyle = TIER_COLOR[e.tier]; c.lineWidth = 1.3; c.beginPath(); c.arc(x + 4, by + 6.5, 2, -1.4, 1.4); c.stroke();
      if (e.tier > 0) { c.fillStyle = '#fff'; c.fillRect(x - 3, by + 4, 5, 1.2); }
    }
    if (e.fav) {
      const hx = x + 9, hy = by + 1;
      c.fillStyle = '#f472b6'; c.beginPath(); c.arc(hx - 1.4, hy, 1.8, 0, 6.3); c.arc(hx + 1.4, hy, 1.8, 0, 6.3); c.moveTo(hx - 3.1, hy + 0.6); c.lineTo(hx, hy + 4); c.lineTo(hx + 3.1, hy + 0.6); c.fill();
    }
    if (e.state === 'waiting') {
      const bw = 20; c.fillStyle = 'rgba(0,0,0,0.55)'; rrect(c, x - bw / 2 - 1, by - 5, bw + 2, 5, 2); c.fill();
      c.fillStyle = left > 0.5 ? '#22c55e' : (left > 0.25 ? '#eab308' : '#ef4444');
      rrect(c, x - bw / 2, by - 4, Math.max(2, bw * left), 3, 1.5); c.fill();
    }
  }
}
function drawStaff(c, s) {
  const P = entPos(s), R = ROLES[s.role];
  const o = { body: R.col, skin: SKINS[(s.id.length * 3 + s.name.length) % 6], hair: HAIRS[(s.name.charCodeAt(0)) % 6], moving: P.moving, ph: s.name.length, mood: '' };
  if (s.role === 'barista') { o.apron = '#fff7ed'; o.hat = 'cap'; o.hatCol = '#7c2d12'; }
  if (s.role === 'cashier') { o.tie = '#fde68a'; o.apron = null; }
  if (s.role === 'restocker') { o.hat = 'cap'; o.hatCol = '#065f46'; o.pack = '#92400e'; }
  if (s.role === 'manager') { o.body = '#1e3a5f'; o.tie = '#fbbf24'; o.glasses = s.lv >= 5; }
  let y = P.y;
  if (s.role === 'cashier' && !P.moving) y -= 5;     // stands behind the counter
  drawPerson(c, P.x, y, o);
  if (s.act === 'work' && s.role === 'barista') {
    c.fillStyle = '#fbbf24'; c.font = 'bold 10px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('...', P.x, y - 20);
  }
  if (s.lv > 1) {   // level badge
    c.font = 'bold 8px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = s.pts > 0 ? 'rgba(21,128,61,0.92)' : 'rgba(30,20,10,0.8)'; rrect(c, P.x + 3, y + 3, 11, 9, 3); c.fill();
    c.fillStyle = s.pts > 0 ? '#dcfce7' : '#fde68a'; c.fillText(String(s.lv), P.x + 8.5, y + 7.8);
  }
}

