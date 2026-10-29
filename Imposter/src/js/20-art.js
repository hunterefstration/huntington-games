// ==========================================
// ART: everything is drawn with canvas paths
// ==========================================
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

// the bean. x,y = feet; face = +1 right / -1 left; ph = walk phase (radians); o: {walk, alpha, scale}
function drawBean(c, x, y, col, face, ph, o) {
  o = o || {}; const k = COLORS[col % COLORS.length], s = o.scale || 1;
  c.save(); c.translate(x, y); c.scale(s, s); if (o.alpha != null) c.globalAlpha = o.alpha;
  c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(0, 1, 13, 5, 0, 0, TAU); c.fill();
  const sw = o.walk ? Math.sin(ph) : 0, bob = o.walk ? -Math.abs(Math.cos(ph)) * 2 : 0;
  c.translate(0, bob); c.scale(face < 0 ? -1 : 1, 1);
  c.lineWidth = 2; c.strokeStyle = '#0b0e1a'; c.lineJoin = 'round';
  c.fillStyle = k.d; // legs
  rr(c, -9 + sw * 4, -10, 8, 11 - Math.max(0, -sw) * 2, 3); c.fill(); c.stroke();
  rr(c, 1 - sw * 4, -10, 8, 11 - Math.max(0, sw) * 2, 3); c.fill(); c.stroke();
  rr(c, -17, -27, 9, 18, 4); c.fill(); c.stroke(); // backpack
  c.fillStyle = k.c; rr(c, -11, -36, 22, 29, 11); c.fill(); c.stroke(); // body
  c.fillStyle = 'rgba(255,255,255,.22)'; rr(c, -7, -33, 6, 8, 3); c.fill();
  c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(-3, -10, 8, 3, 0, 0, TAU); c.fill();
  const vg = c.createLinearGradient(0, -33, 0, -22); vg.addColorStop(0, '#d4f6ff'); vg.addColorStop(1, '#4aa5c9');
  c.fillStyle = vg; c.beginPath(); c.ellipse(4, -26, 8.5, 5.4, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(1, -28, 3, 1.6, -.2, 0, TAU); c.fill();
  c.restore();
}
function drawBody(c, x, y, col) {
  const k = COLORS[col % COLORS.length]; c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 2, 17, 6, 0, 0, TAU); c.fill();
  c.lineWidth = 2; c.strokeStyle = '#0b0e1a';
  c.fillStyle = k.d; rr(c, -17, -16, 8, 14, 4); c.fill(); c.stroke();
  c.fillStyle = k.c; c.beginPath(); c.moveTo(-10, -2); c.lineTo(-10, -14); c.arcTo(-10, -18, 0, -18, 8); c.lineTo(9, -18); c.lineTo(9, -2); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#e8d8d0'; c.beginPath(); c.ellipse(9, -10, 3, 8, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.fillRect(8, -16, 12, 3); c.beginPath(); c.arc(21, -17, 3, 0, TAU); c.arc(21, -12, 3, 0, TAU); c.fill();
  c.fillStyle = '#d2253a'; c.beginPath(); c.ellipse(9, -10, 1.8, 5, 0, 0, TAU); c.fill();
  c.fillStyle = k.d; rr(c, 4, -3, 9, 6, 3); c.fill(); c.stroke();
  c.restore();
}
function drawGhost(c, x, y, col, face, t, o) {
  o = o || {}; const k = COLORS[col % COLORS.length]; c.save(); c.translate(x, y - 8 + Math.sin(t * 2.4) * 3);
  c.globalAlpha = o.alpha == null ? .55 : o.alpha; c.scale(face < 0 ? -1 : 1, 1);
  c.fillStyle = k.c; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-11, -4); c.lineTo(-11, -26); c.arcTo(-11, -36, 0, -36, 11); c.arcTo(11, -36, 11, -26, 11); c.lineTo(11, -4);
  for (let i = 0; i < 4; i++) c.quadraticCurveTo(11 - i * 5.5 - 2.75, 4 + (i & 1) * -4, 11 - (i + 1) * 5.5, -3); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.beginPath(); c.ellipse(4, -26, 7, 5, 0, 0, TAU); c.fill(); c.fillStyle = '#123'; c.beginPath(); c.arc(6, -26, 2.2, 0, TAU); c.fill();
  c.restore();
}
// small bean on a canvas element (lists, meeting cards)
function beanIcon(cv, col, ghost) {
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  if (ghost) drawGhost(c, cv.width / 2 - 1, cv.height - 4, col, 1, 0, { alpha: .8 }); else drawBean(c, cv.width / 2 + 3, cv.height - 3, col, 1, 0, { scale: cv.height / 44 });
}
function mkIcon(col, size, ghost) { const cv = document.createElement('canvas'); cv.width = size; cv.height = size; beanIcon(cv, col, ghost); return cv; }

// props (baked into the map picture)
function drawProp(c, x, y, w, h, kind) {
  c.save(); c.lineWidth = 2; c.strokeStyle = '#0b0e1a';
  const box = (fa, fb, rad) => { c.fillStyle = 'rgba(0,0,0,.3)'; rr(c, x + 3, y + 5, w, h, rad); c.fill(); const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, fa); g.addColorStop(1, fb); c.fillStyle = g; rr(c, x, y - 4, w, h, rad); c.fill(); c.stroke(); };
  if (kind === 'table' || kind === 'table2') {
    box('#8a95b0', '#5b6684', Math.min(w, h) / 2.2); c.fillStyle = 'rgba(255,255,255,.18)'; rr(c, x + 8, y, w - 16, 8, 4); c.fill();
    if (kind === 'table') { c.fillStyle = '#d02e3a'; c.beginPath(); c.arc(x + w / 2, y + h / 2 - 8, 14, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#ff9aa4'; c.beginPath(); c.arc(x + w / 2 - 4, y + h / 2 - 12, 4, 0, TAU); c.fill(); }
  } else if (kind === 'core') {
    box('#6f7792', '#3b425a', 14); const cx = x + w / 2, cy = y + h / 2 - 4, g = c.createRadialGradient(cx, cy, 3, cx, cy, w / 2.4);
    g.addColorStop(0, '#fff7c0'); g.addColorStop(.4, '#ffb347'); g.addColorStop(1, '#a8301a'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, w / 2.6, 0, TAU); c.fill(); c.stroke();
  } else if (kind === 'crate') {
    box('#a9824a', '#6f522a', 4); c.strokeStyle = 'rgba(40,25,5,.7)'; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + w, y + h - 4); c.moveTo(x + w, y - 4); c.lineTo(x, y + h - 4); c.stroke();
  } else if (kind === 'bed') {
    box('#dfe8f5', '#9aa8c4', 8); c.fillStyle = '#4aa5c9'; rr(c, x + w * .35, y - 2, w * .62, h - 6, 5); c.fill();
  } else if (kind === 'console' || kind === 'panel') {
    box('#58648a', '#323a58', 5); c.fillStyle = '#0d2530'; rr(c, x + 5, y, w - 10, Math.max(8, h / 2.4), 3); c.fill();
    for (let i = 0; i < w / 14 - 1; i++) { c.fillStyle = ['#4dff9a', '#ffd36b', '#59e0ff'][i % 3]; c.fillRect(x + 8 + i * 14, y + h - 14, 7, 4); }
  } else if (kind === 'gun') {
    box('#7a7f90', '#464b5c', 8); c.fillStyle = '#2a2e3c'; c.beginPath(); c.arc(x + w / 2, y + h / 2 - 4, w / 3, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#d02e3a'; c.fillRect(x + w / 2 - 3, y + h / 2 - 22, 6, 18);
  } else if (kind === 'engine') {
    box('#6a7c8a', '#3a4856', 10); c.strokeStyle = '#59e0ff'; c.lineWidth = 3; c.beginPath(); c.arc(x + w / 2, y + h / 2 - 4, Math.min(w, h) / 3, 0, TAU); c.stroke();
  } else if (kind === 'planter') {
    box('#6b4a2a', '#4a3018', 5); c.fillStyle = '#3fbf5a'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(x + 10 + (i * (w - 20)) / 6, y + 4 + (i % 2) * 6, 8, 0, TAU); c.fill(); }
  } else box('#8a95b0', '#5b6684', 6);
  c.restore();
}
// task stations, vents, button, fix panels (drawn live)
const KCOL = { wires: '#ff5252', swipe: '#59e0ff', align: '#ffd36b', upload: '#4dff9a', fuel: '#ff9f45', rocks: '#c490ff', simon: '#ff6ac0' };
function drawStation(c, s, t, mine) {
  c.save(); c.translate(s.x, s.y - 4); c.lineWidth = 2; c.strokeStyle = '#0b0e1a';
  c.fillStyle = 'rgba(0,0,0,.3)'; rr(c, -13, 3, 28, 16, 4); c.fill();
  const g = c.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#59678f'); g.addColorStop(1, '#2d3552'); c.fillStyle = g; rr(c, -14, -12, 28, 24, 5); c.fill(); c.stroke();
  c.fillStyle = '#0b1424'; rr(c, -10, -9, 20, 12, 3); c.fill(); const col = KCOL[s.kind]; c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 2;
  if (s.kind === 'wires') { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-8, -7 + i * 4); c.lineTo(8, -7 + ((i + 1) % 3) * 4); c.stroke(); } }
  else if (s.kind === 'swipe') c.fillRect(-8, -4, 16, 3); else if (s.kind === 'align') { c.beginPath(); c.moveTo(-8, -3); c.lineTo(8, -3); c.stroke(); c.fillRect(-2, -8, 4, 10); }
  else if (s.kind === 'upload') { c.fillRect(-8, -4, 9, 4); c.beginPath(); c.moveTo(4, -2); c.lineTo(9, -2); c.lineTo(6.5, -7); c.fill(); } else if (s.kind === 'fuel') { c.fillRect(-6, -8, 8, 10); c.fillRect(3, -4, 4, 6); }
  else if (s.kind === 'rocks') { c.beginPath(); c.arc(0, -3, 5, 0, TAU); c.stroke(); } else { c.fillRect(-8, -7, 6, 5); c.fillRect(1, -7, 6, 5); c.fillRect(-8, -1, 6, 3); }
  c.fillStyle = ((t * 2) | 0) & 1 ? '#4dff9a' : '#1d6a40'; c.fillRect(-12, 6, 4, 3);
  c.restore();
  if (mine) { const bob = Math.sin(t * 5) * 3; c.save(); c.translate(s.x, s.y - 34 + bob); c.fillStyle = '#ffd36b'; c.strokeStyle = '#6b4a06'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#4a2c00'; c.font = '900 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 1); c.restore(); }
}
function drawVent(c, v, open) {
  c.save(); c.translate(v.x, v.y); c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, -17, -12, 34, 28, 5); c.fill();
  c.fillStyle = '#586079'; c.strokeStyle = '#0b0e1a'; c.lineWidth = 2; rr(c, -16, -14, 32, 26, 5); c.fill(); c.stroke();
  c.fillStyle = open ? '#000' : '#242a3c'; rr(c, -12, -10, 24, 18, 3); c.fill();
  if (!open) { c.strokeStyle = '#7a84a3'; c.lineWidth = 2; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-11, -8 + i * 5); c.lineTo(11, -8 + i * 5); c.stroke(); } }
  c.restore();
}
function drawButtonProp(c, b, t) {
  c.save(); c.translate(b.x, b.y - 4); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(2, 8, 20, 8, 0, 0, TAU); c.fill();
  c.fillStyle = '#4a5578'; c.strokeStyle = '#0b0e1a'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 3, 19, 10, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#b0172a'; c.beginPath(); c.ellipse(0, -1, 14, 8, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = `rgba(255,${120 + Math.sin(t * 4) * 60 | 0},130,.9)`; c.beginPath(); c.ellipse(0, -4, 12, 6, 0, 0, TAU); c.fill(); c.stroke(); c.restore();
}
function drawFixPanel(c, p, t, kind, lit) {
  c.save(); c.translate(p.x, p.y - 4); c.fillStyle = 'rgba(0,0,0,.3)'; rr(c, -15, 3, 32, 16, 4); c.fill();
  c.fillStyle = '#4f5a7d'; c.strokeStyle = '#0b0e1a'; c.lineWidth = 2; rr(c, -16, -14, 32, 28, 5); c.fill(); c.stroke();
  const on = lit && ((t * 4) | 0) & 1; c.fillStyle = on ? '#ff3344' : (kind === 'lights' ? '#ffd36b' : '#59e0ff'); c.beginPath(); c.arc(0, 0, kind === 'lights' ? 6 : 8, 0, TAU); c.fill(); c.stroke();
  if (kind === 'lights') { for (let i = -1; i <= 1; i += 2) { c.fillStyle = '#222'; c.fillRect(i * 9 - 2, -9, 4, 18); } }
  c.restore();
}
function drawLogo() {
  const cv = $('logocv'); if (!cv) return; const c = cv.getContext('2d'); c.clearRect(0, 0, 260, 110);
  drawBean(c, 80, 100, 0, 1, 0, { scale: 2.2 }); drawBean(c, 175, 100, 5, -1, 0, { scale: 1.9 });
  c.fillStyle = '#ff4455'; c.font = '900 40px sans-serif'; c.textAlign = 'center'; c.fillText('?', 128, 70);
}
