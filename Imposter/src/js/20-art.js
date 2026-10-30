// ==========================================
// ART: everything is drawn with canvas paths
// Setting: an old lighthouse run by lantern-keepers (round-headed lamp robots).
// ==========================================
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const INK = '#1c120b', BRASS = '#c9a050', BRASS_D = '#7a5a22';
function hx(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function mixc(a, b, t) { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => ('0' + Math.round(v + (B[i] - v) * t).toString(16)).slice(-2)).join(''); }
// a small chest mark per colour so colours stay readable even for colour-blind players
function emblem(c, i, col) {
  c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.7; c.lineCap = 'round'; c.beginPath();
  switch (i % 12) {
    case 0: c.arc(0, 0, 2.3, 0, TAU); c.fill(); break;
    case 1: c.moveTo(-3, 2.2); c.lineTo(3, 2.2); c.lineTo(0, -3); c.closePath(); c.fill(); break;
    case 2: c.rect(-2.4, -2.4, 4.8, 4.8); c.fill(); break;
    case 3: c.moveTo(0, -3.2); c.lineTo(3, 0); c.lineTo(0, 3.2); c.lineTo(-3, 0); c.closePath(); c.fill(); break;
    case 4: c.arc(0, 0, 2.6, 0, TAU); c.stroke(); break;
    case 5: c.moveTo(-3, 0); c.lineTo(3, 0); c.moveTo(0, -3); c.lineTo(0, 3); c.stroke(); break;
    case 6: c.moveTo(-2.6, -2.6); c.lineTo(2.6, 2.6); c.moveTo(2.6, -2.6); c.lineTo(-2.6, 2.6); c.stroke(); break;
    case 7: c.rect(-3.4, -1, 6.8, 2); c.fill(); break;
    case 8: c.rect(-1, -3.4, 2, 6.8); c.fill(); break;
    case 9: c.arc(-2.2, 0, 1.5, 0, TAU); c.moveTo(3.7, 0); c.arc(2.2, 0, 1.5, 0, TAU); c.fill(); break;
    case 10: c.moveTo(-3, 1.6); c.lineTo(0, -1.8); c.lineTo(3, 1.6); c.stroke(); break;
    default: c.moveTo(0, -3); c.lineTo(0, 3); c.moveTo(-2.6, -1.5); c.lineTo(2.6, 1.5); c.moveTo(2.6, -1.5); c.lineTo(-2.6, 1.5); c.stroke();
  }
}
// The lantern-keeper: round lamp head with a glowing face screen, bell-shaped coat, stubby feet, bulb antenna.
// Drawn upright at the origin (feet), facing right. o: {sw: leg swing -1..1, dead, id}
function keeperPose(c, k, idx, o) {
  const sw = o.sw || 0, dead = !!o.dead, now = Date.now() / 1000, glow = mixc(k.c, '#ffffff', .6);
  c.lineWidth = 2; c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
  // boots
  c.fillStyle = '#5a3d22';
  c.beginPath(); c.ellipse(-5 + sw * 4, -2.2 - Math.max(0, sw) * 3, 5, 3.1, 0, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(5 - sw * 4, -2.2 - Math.max(0, -sw) * 3, 5, 3.1, 0, 0, TAU); c.fill(); c.stroke();
  // coat
  const cg = c.createLinearGradient(-11, 0, 11, 0); cg.addColorStop(0, k.d); cg.addColorStop(.45, mixc(k.d, k.c, .35)); cg.addColorStop(1, k.d);
  c.fillStyle = cg; c.beginPath(); c.moveTo(-11.5, -5); c.quadraticCurveTo(-12.5, -17, -6.5, -24); c.lineTo(6.5, -24); c.quadraticCurveTo(12.5, -17, 11.5, -5); c.quadraticCurveTo(0, -2.5, -11.5, -5); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = BRASS; rr(c, -9.6, -16, 19.2, 3.2, 1.4); c.fill(); c.lineWidth = 1.2; c.stroke(); c.lineWidth = 2;
  c.fillStyle = '#ffe9a8'; c.fillRect(-1.4, -16.6, 2.8, 4.4);
  c.save(); c.translate(0, -9.5); emblem(c, idx, '#ffe9b0'); c.restore();
  // hands
  c.fillStyle = k.c; c.beginPath(); c.arc(-12.5, -13 + sw * 2.5, 3.3, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.arc(12.5, -13 - sw * 2.5, 3.3, 0, TAU); c.fill(); c.stroke();
  // ear bolt + collar
  c.fillStyle = BRASS; c.beginPath(); c.arc(-12.2, -31, 2.4, 0, TAU); c.fill(); c.lineWidth = 1.4; c.stroke(); c.lineWidth = 2;
  rr(c, -8, -26, 16, 4.4, 2); c.fill(); c.lineWidth = 1.4; c.stroke(); c.lineWidth = 2;
  // antenna with bulb
  c.strokeStyle = INK; c.lineWidth = 3.4; c.beginPath(); c.moveTo(-1, -42.5); c.quadraticCurveTo(-1, -47, -3, -48.5); c.stroke();
  c.strokeStyle = BRASS; c.lineWidth = 1.6; c.stroke(); c.lineWidth = 2; c.strokeStyle = INK;
  const pulse = dead ? .25 + (Math.sin(now * 25) > .6 ? .5 : 0) : .75 + Math.sin(now * 4 + idx) * .25;
  c.globalAlpha *= .35 * pulse; c.fillStyle = glow; c.beginPath(); c.arc(-3, -50, 6.5, 0, TAU); c.fill(); c.globalAlpha /= (.35 * pulse);
  c.fillStyle = dead ? '#6b6258' : glow; c.beginPath(); c.arc(-3, -50, 2.9, 0, TAU); c.fill(); c.lineWidth = 1.4; c.stroke(); c.lineWidth = 2;
  // head
  const hg = c.createRadialGradient(-5, -37, 2, 0, -31, 15); hg.addColorStop(0, mixc(k.c, '#ffffff', .35)); hg.addColorStop(.6, k.c); hg.addColorStop(1, k.d);
  c.fillStyle = hg; c.beginPath(); c.arc(0, -31, 12.6, 0, TAU); c.fill(); c.stroke();
  // face screen
  c.fillStyle = '#0c0e13'; c.beginPath(); c.ellipse(3.6, -31, 8.8, 7.4, 0, 0, TAU); c.fill(); c.strokeStyle = BRASS; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = INK; c.lineWidth = 2;
  if (dead) {
    c.strokeStyle = '#8b8378'; c.lineWidth = 1.7; c.beginPath();
    for (const ex of [.3, 7]) { c.moveTo(ex - 1.8, -33.4); c.lineTo(ex + 1.8, -29); c.moveTo(ex + 1.8, -33.4); c.lineTo(ex - 1.8, -29); } c.stroke();
  } else {
    const blink = ((now + idx * .77) % 3.6) < .12, eh = blink ? .5 : 2.7;
    c.fillStyle = glow; c.globalAlpha *= .3; c.beginPath(); c.ellipse(.6, -31, 3.6, 4.6, 0, 0, TAU); c.ellipse(7, -31, 3.6, 4.6, 0, 0, TAU); c.fill(); c.globalAlpha /= .3;
    c.beginPath(); c.ellipse(.6, -31, 1.8, eh, 0, 0, TAU); c.ellipse(7, -31, 1.8, eh, 0, 0, TAU); c.fill();
    c.strokeStyle = glow; c.lineWidth = 1.3; c.beginPath(); c.arc(3.8, -28.4, 2.2, .25, Math.PI - .25); c.stroke(); c.strokeStyle = INK; c.lineWidth = 2;
  }
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-6, -38, 3.6, 2.2, -.6, 0, TAU); c.fill();
}
// x,y = feet; face = +1 right / -1 left; ph = walk phase (radians); o: {walk, alpha, scale}
function drawBean(c, x, y, col, face, ph, o) {
  o = o || {}; const k = COLORS[col % COLORS.length], s = (o.scale || 1) * .85;
  c.save(); c.translate(x, y); c.scale(s, s); if (o.alpha != null) c.globalAlpha = o.alpha;
  c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(0, 1, 14, 5, 0, 0, TAU); c.fill();
  const sw = o.walk ? Math.sin(ph) : 0, bob = o.walk ? -Math.abs(Math.cos(ph)) * 2.2 : 0;
  c.translate(0, bob); c.rotate(o.walk ? Math.sin(ph) * .05 : 0); c.scale(face < 0 ? -1 : 1, 1);
  keeperPose(c, k, col, { sw }); c.restore();
}
// a fallen keeper: dimmed, tipped over, cracked, with sparks and a wisp of smoke
function drawBody(c, x, y, col) {
  const k = COLORS[col % COLORS.length], now = Date.now() / 1000, dk = { c: mixc(k.c, '#4a443c', .55), d: mixc(k.d, '#26211c', .5) };
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(4, 3, 26, 6, 0, 0, TAU); c.fill();
  c.fillStyle = 'rgba(20,10,0,.55)'; c.beginPath(); c.ellipse(16, 4, 12, 3.4, 0, 0, TAU); c.fill(); // oil puddle
  c.save(); c.translate(-12, -5); c.rotate(1.42); c.scale(.85, .85); keeperPose(c, dk, col, { dead: true, sw: .4 }); c.restore();
  // crack across the head
  c.strokeStyle = '#0c0a08'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(13, -19); c.lineTo(16, -13); c.lineTo(14, -9); c.lineTo(18, -4); c.stroke();
  // sparks
  c.lineCap = 'round'; for (let i = 0; i < 3; i++) {
    const f = (now * 3 + i * .37) % 1; if (f > .6) continue; const a = -1.2 + i * .9 + Math.floor(now * 3 + i) * .7, r = 4 + f * 15;
    c.strokeStyle = i & 1 ? '#fff1a8' : '#ffb347'; c.lineWidth = 1.6; c.globalAlpha = 1 - f / .6; c.beginPath(); c.moveTo(14 + Math.cos(a) * 3, -14 + Math.sin(a) * 3); c.lineTo(14 + Math.cos(a) * r, -14 + Math.sin(a) * r - f * 6); c.stroke();
  } c.globalAlpha = 1;
  // smoke
  for (let i = 0; i < 3; i++) { const f = (now * .6 + i / 3) % 1; c.fillStyle = 'rgba(150,145,140,' + (.32 * (1 - f)).toFixed(3) + ')'; c.beginPath(); c.arc(13 + Math.sin(now * 2 + i) * 3, -22 - f * 22, 3 + f * 5, 0, TAU); c.fill(); }
  c.restore();
}
// a lantern spirit: a flame wisp with hollow eyes and a trailing tail
function drawGhost(c, x, y, col, face, t, o) {
  o = o || {}; const k = COLORS[col % COLORS.length]; c.save(); c.translate(x, y - 6 + Math.sin(t * 2.4) * 3);
  c.scale(face < 0 ? -1 : 1, 1); const a = o.alpha == null ? .6 : o.alpha;
  const ag = c.createRadialGradient(0, -20, 2, 0, -20, 30); ag.addColorStop(0, mixc(k.c, '#ffffff', .3)); ag.addColorStop(1, 'rgba(0,0,0,0)');
  c.globalAlpha = a * .45; c.fillStyle = ag; c.beginPath(); c.arc(0, -20, 30, 0, TAU); c.fill();
  const sway = Math.sin(t * 3) * 2.5; c.globalAlpha = a;
  c.fillStyle = k.c; c.strokeStyle = 'rgba(255,245,220,.8)'; c.lineWidth = 1.8; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(1 + sway, -47); c.bezierCurveTo(5 + sway, -37, 14, -31, 12, -19); c.bezierCurveTo(11, -9, 5, -4, 0, -4);
  c.bezierCurveTo(-5, -4, -11, -9, -12, -19); c.bezierCurveTo(-13, -29, -4, -33, 1 + sway, -47); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = k.c; c.lineWidth = 4; c.beginPath(); c.moveTo(-1, -5); c.quadraticCurveTo(-7 + sway, 2, -3, 8); c.quadraticCurveTo(2, 12, 7 - sway, 10); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.moveTo(1, -35); c.bezierCurveTo(4, -29, 8, -26, 7, -19); c.bezierCurveTo(6, -13, 2, -11, 0, -11); c.bezierCurveTo(-3, -11, -6, -14, -6, -19); c.bezierCurveTo(-6, -25, -1, -28, 1, -35); c.fill();
  c.fillStyle = '#10141c'; c.beginPath(); c.ellipse(-1.5, -21, 2, 3.4, 0, 0, TAU); c.ellipse(6, -21, 2, 3.4, 0, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(2.5, -14.5, 1.8, 2.4, 0, 0, TAU); c.fill();
  c.fillStyle = '#fff1a8'; for (let i = 0; i < 3; i++) { const an = t * 1.6 + i * 2.1; c.globalAlpha = a * .8; c.beginPath(); c.arc(Math.cos(an) * 16, -22 + Math.sin(an) * 9 - i * 3, 1.5, 0, TAU); c.fill(); }
  c.restore();
}
// small keeper on a canvas element (lists, gathering cards)
function beanIcon(cv, col, ghost) {
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  if (ghost) { const g = cv.height / 56; c.save(); c.scale(g, g); drawGhost(c, cv.width / 2 / g, (cv.height - 2) / g, col, 1, 0, { alpha: .9 }); c.restore(); } else drawBean(c, cv.width / 2 + 2, cv.height - 3, col, 1, 0, { scale: cv.height / 50 });
}
function mkIcon(col, size, ghost) { const cv = document.createElement('canvas'); cv.width = size; cv.height = size; beanIcon(cv, col, ghost); return cv; }

// props (baked into the map picture)
function drawProp(c, x, y, w, h, kind) {
  c.save(); c.lineWidth = 2; c.strokeStyle = INK;
  const box = (fa, fb, rad) => { c.fillStyle = 'rgba(0,0,0,.34)'; rr(c, x + 3, y + 5, w, h, rad); c.fill(); const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, fa); g.addColorStop(1, fb); c.fillStyle = g; rr(c, x, y - 4, w, h, rad); c.fill(); c.stroke(); };
  const planks = (n) => { c.save(); c.strokeStyle = 'rgba(25,12,4,.45)'; c.lineWidth = 1.2; for (let i = 1; i < n; i++) { c.beginPath(); c.moveTo(x + 4, y - 4 + h * i / n); c.lineTo(x + w - 4, y - 4 + h * i / n); c.stroke(); } c.restore(); };
  const glow = (cx, cy, r, a) => { const g = c.createRadialGradient(cx, cy, 1, cx, cy, r); g.addColorStop(0, 'rgba(255,210,120,' + a + ')'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); };
  if (kind === 'table' || kind === 'table2') {
    box('#8a5e36', '#573819', Math.min(w, h) / 2.4); planks(kind === 'table' ? 4 : 2); c.fillStyle = 'rgba(255,225,170,.14)'; rr(c, x + 8, y, w - 16, 7, 3); c.fill();
    if (kind === 'table') { glow(x + w / 2, y + h / 2 - 8, 34, .5); c.fillStyle = BRASS; c.beginPath(); c.ellipse(x + w / 2, y + h / 2 - 3, 9, 4, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#ffd98a'; c.beginPath(); c.ellipse(x + w / 2, y + h / 2 - 12, 6, 8, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#fffbe0'; c.beginPath(); c.ellipse(x + w / 2, y + h / 2 - 12, 2.5, 4.5, 0, 0, TAU); c.fill(); }
    else { c.fillStyle = '#e8dcc0'; rr(c, x + 10, y + 2, 18, 12, 2); c.fill(); c.lineWidth = 1; c.stroke(); }
  } else if (kind === 'core') {
    box('#58493d', '#2e2620', 16); const cx = x + w / 2, cy = y + h / 2 - 4; glow(cx, cy, w * .8, .35);
    for (let i = 5; i >= 1; i--) { const g = c.createRadialGradient(cx, cy, 1, cx, cy, w / 2.5); g.addColorStop(0, '#fffbe0'); g.addColorStop(.5, '#ffc95a'); g.addColorStop(1, '#b8631a'); c.fillStyle = i % 2 ? g : BRASS; c.beginPath(); c.arc(cx, cy, w / 2.4 * i / 5, 0, TAU); c.fill(); c.lineWidth = 1.4; c.stroke(); }
  } else if (kind === 'crate') {
    box('#98703d', '#654721', 5); planks(3); c.strokeStyle = '#3a3a3c'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 5, y - 4); c.lineTo(x + 5, y + h - 4); c.moveTo(x + w - 5, y - 4); c.lineTo(x + w - 5, y + h - 4); c.stroke();
  } else if (kind === 'bed') {
    box('#6a4526', '#43291a', 6); c.fillStyle = '#e6dcc4'; rr(c, x + 4, y, w * .28, h - 8, 4); c.fill(); c.lineWidth = 1.4; c.strokeStyle = INK; c.stroke(); c.fillStyle = '#7a2e3c'; rr(c, x + w * .36, y - 1, w * .6, h - 6, 4); c.fill(); c.stroke();
  } else if (kind === 'console' || kind === 'panel') {
    box('#7a5a30', '#4a331a', 5); const n = Math.max(1, Math.floor((w - 6) / 24));
    for (let i = 0; i < n; i++) { const cx = x + w * (i + .5) / n, cy = y + h / 2 - 8, r = Math.min(10, h / 3); c.fillStyle = '#f0e4c4'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill(); c.strokeStyle = BRASS; c.lineWidth = 2.2; c.stroke(); c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(-2.2 + i) * r * .8, cy + Math.sin(-2.2 + i) * r * .8); c.stroke(); }
    c.fillStyle = '#ffb347'; c.fillRect(x + 8, y + h - 12, 6, 3);
  } else if (kind === 'gun') { // foghorn
    box('#4a4a4e', '#2c2c30', 8); c.fillStyle = BRASS; c.beginPath(); c.moveTo(x + 6, y + h / 2 - 12); c.lineTo(x + w - 8, y + 4); c.lineTo(x + w - 8, y + h - 14); c.lineTo(x + 6, y + h / 2 - 2); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#2a1c08'; c.beginPath(); c.ellipse(x + w - 8, y + h / 2 - 5, 4, h / 2 - 9, 0, 0, TAU); c.fill(); c.stroke();
  } else if (kind === 'engine') { // clockwork
    box('#5a4630', '#33261a', 10); const cx = x + w / 2, cy = y + h / 2 - 4, r = Math.min(w, h) / 3;
    c.strokeStyle = BRASS; c.lineWidth = 5; c.setLineDash([4.5, 4]); c.beginPath(); c.arc(cx, cy, r + 2, 0, TAU); c.stroke(); c.setLineDash([]); c.lineWidth = 4; c.beginPath(); c.arc(cx, cy, r - 3, 0, TAU); c.stroke();
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(cx - r + 3, cy); c.lineTo(cx + r - 3, cy); c.moveTo(cx, cy - r + 3); c.lineTo(cx, cy + r - 3); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(cx, cy, 3, 0, TAU); c.fill();
  } else if (kind === 'planter') {
    box('#5a3a1e', '#38230f', 5); c.fillStyle = '#4c8a46'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(x + 10 + (i * (w - 20)) / 6, y + 4 + (i % 2) * 6, 8, 0, TAU); c.fill(); } c.fillStyle = '#e8d070'; c.beginPath(); c.arc(x + w / 2, y + 2, 2.5, 0, TAU); c.fill();
  } else box('#6a5a4a', '#403529', 6);
  c.restore();
}
// task stations, trapdoors, bell, fix panels (drawn live)
const KCOL = { wires: '#ff7a59', swipe: '#f2c46b', align: '#7fd6c2', upload: '#9ad06a', fuel: '#ffa23a', rocks: '#c9a0ff', simon: '#ff8ac0' };
function drawStation(c, s, t, mine) {
  c.save(); c.translate(s.x, s.y - 4); c.lineWidth = 2; c.strokeStyle = INK;
  c.fillStyle = 'rgba(0,0,0,.32)'; rr(c, -13, 3, 28, 16, 4); c.fill();
  const g = c.createLinearGradient(0, -12, 0, 12); g.addColorStop(0, '#8a6236'); g.addColorStop(1, '#4a2f17'); c.fillStyle = g; rr(c, -14, -12, 28, 24, 4); c.fill(); c.stroke();
  c.strokeStyle = BRASS; c.lineWidth = 1.6; rr(c, -12, -10, 24, 20, 3); c.stroke();
  c.fillStyle = '#17110b'; c.strokeStyle = INK; c.lineWidth = 2; rr(c, -10, -9, 20, 12, 3); c.fill(); const col = KCOL[s.kind]; c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 2;
  if (s.kind === 'wires') { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-8, -7 + i * 4); c.lineTo(8, -7 + ((i + 1) % 3) * 4); c.stroke(); } }
  else if (s.kind === 'swipe') { c.fillRect(-8, -4, 16, 3); for (let i = 0; i < 4; i++) c.fillRect(-7 + i * 4.5, -8, 1.6, 4); } else if (s.kind === 'align') { c.beginPath(); c.moveTo(-8, -3); c.lineTo(8, -3); c.stroke(); c.beginPath(); c.ellipse(0, -4, 2.4, 4, 0, 0, TAU); c.fill(); }
  else if (s.kind === 'upload') { c.fillRect(-8, -7, 10, 8); c.fillStyle = '#17110b'; c.fillRect(-6, -5, 6, 1.4); c.fillRect(-6, -2.4, 6, 1.4); c.fillStyle = col; c.fillRect(4, -7, 4, 8); } else if (s.kind === 'fuel') { c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(7, -2, 0, 2); c.quadraticCurveTo(-7, -2, 0, -8); c.fill(); }
  else if (s.kind === 'rocks') { c.beginPath(); c.moveTo(-8, -6); c.quadraticCurveTo(-4, -9, 0, -4); c.quadraticCurveTo(4, -9, 8, -6); c.stroke(); } else { for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-6 + i * 6, -3, 2.2, 0, TAU); c.fill(); } }
  c.fillStyle = ((t * 2) | 0) & 1 ? '#ffd36b' : '#7a5a22'; c.beginPath(); c.arc(-9, 7, 1.8, 0, TAU); c.fill();
  c.restore();
  if (mine) { const bob = Math.sin(t * 5) * 3; c.save(); c.translate(s.x, s.y - 34 + bob); const gl = c.createRadialGradient(0, 0, 1, 0, 0, 16); gl.addColorStop(0, 'rgba(255,200,90,.55)'); gl.addColorStop(1, 'rgba(255,160,40,0)'); c.fillStyle = gl; c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.fill();
    c.fillStyle = '#ff9d2e'; c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, -11); c.bezierCurveTo(4, -5, 8, -2, 6, 3); c.bezierCurveTo(5, 7, 2, 8, 0, 8); c.bezierCurveTo(-2, 8, -5, 7, -6, 3); c.bezierCurveTo(-8, -2, -3, -5, 0, -11); c.fill(); c.stroke();
    c.fillStyle = '#fff3b0'; c.beginPath(); c.ellipse(0, 3, 2.6, 4, 0, 0, TAU); c.fill(); c.restore(); }
}
// trapdoor (the Shades' secret way between rooms)
function drawVent(c, v, open) {
  c.save(); c.translate(v.x, v.y); c.fillStyle = 'rgba(0,0,0,.4)'; rr(c, -17, -12, 34, 28, 3); c.fill();
  c.fillStyle = '#4a2f17'; c.strokeStyle = INK; c.lineWidth = 2; rr(c, -17, -15, 34, 28, 3); c.fill(); c.stroke();
  if (open) { c.fillStyle = '#050403'; rr(c, -13, -11, 26, 20, 2); c.fill(); c.strokeStyle = '#8a6236'; c.lineWidth = 2; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-9, -6 + i * 6); c.lineTo(9, -6 + i * 6); c.stroke(); } }
  else {
    c.fillStyle = '#7a5230'; rr(c, -13, -11, 26, 20, 2); c.fill(); c.stroke(); c.strokeStyle = 'rgba(25,12,4,.55)'; c.lineWidth = 1.2; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-12, -11 + i * 5); c.lineTo(12, -11 + i * 5); c.stroke(); }
    c.strokeStyle = BRASS; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-13, -7); c.lineTo(-7, -7); c.moveTo(-13, 5); c.lineTo(-7, 5); c.stroke();
    c.lineWidth = 2.4; c.beginPath(); c.arc(5, -1, 4, 0, TAU); c.stroke(); c.fillStyle = BRASS; c.beginPath(); c.arc(5, -5.5, 1.6, 0, TAU); c.fill();
  }
  c.restore();
}
// the gathering bell
function drawButtonProp(c, b, t) {
  c.save(); c.translate(b.x, b.y - 4); c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(2, 9, 20, 7, 0, 0, TAU); c.fill();
  c.fillStyle = '#4a2f17'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 6, 19, 8, 0, 0, TAU); c.fill(); c.stroke();
  const gl = c.createRadialGradient(0, -6, 2, 0, -6, 34); gl.addColorStop(0, 'rgba(255,200,90,' + (.28 + Math.sin(t * 3) * .1).toFixed(3) + ')'); gl.addColorStop(1, 'rgba(255,170,50,0)'); c.fillStyle = gl; c.beginPath(); c.arc(0, -6, 34, 0, TAU); c.fill();
  c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(-12, 2); c.lineTo(-12, -22); c.lineTo(12, -22); c.lineTo(12, 2); c.stroke(); c.strokeStyle = '#7a5230'; c.lineWidth = 2; c.stroke();
  c.save(); c.translate(0, -22); c.rotate(Math.sin(t * 2.2) * .07);
  const bg = c.createLinearGradient(-12, 0, 12, 0); bg.addColorStop(0, '#9a7428'); bg.addColorStop(.4, '#f0cf78'); bg.addColorStop(1, '#8a6420'); c.fillStyle = bg; c.strokeStyle = INK; c.lineWidth = 2;
  c.beginPath(); c.moveTo(-4, 0); c.bezierCurveTo(-5, 8, -11, 12, -13, 20); c.lineTo(13, 20); c.bezierCurveTo(11, 12, 5, 8, 4, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#6a4a14'; c.beginPath(); c.arc(0, 22, 3, 0, TAU); c.fill(); c.stroke(); c.restore();
  c.restore();
}
// valves: lamp supply (lights) and boiler (the two overload valves)
function drawFixPanel(c, p, t, kind, lit) {
  c.save(); c.translate(p.x, p.y - 4); c.fillStyle = 'rgba(0,0,0,.32)'; rr(c, -15, 3, 32, 16, 4); c.fill();
  c.fillStyle = '#5a3a1e'; c.strokeStyle = INK; c.lineWidth = 2; rr(c, -16, -14, 32, 28, 4); c.fill(); c.stroke(); c.strokeStyle = BRASS; c.lineWidth = 1.4; rr(c, -14, -12, 28, 24, 3); c.stroke();
  const on = lit && ((t * 4) | 0) & 1; c.fillStyle = on ? '#ff5a2a' : (kind === 'lights' ? '#ffd36b' : '#9ad0c8'); c.strokeStyle = INK; c.lineWidth = 2;
  if (kind === 'lights') { c.beginPath(); c.moveTo(-5, -8); c.lineTo(5, -8); c.lineTo(7, 4); c.quadraticCurveTo(0, 9, -7, 4); c.closePath(); c.fill(); c.stroke(); c.fillStyle = BRASS; c.fillRect(-5, -11, 10, 3); }
  else { c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.stroke(); c.lineWidth = 2.4; c.strokeStyle = on ? '#ff5a2a' : '#9ad0c8'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.moveTo(-8, 0); c.lineTo(8, 0); c.moveTo(0, -8); c.lineTo(0, 8); c.stroke(); c.fillStyle = BRASS; c.beginPath(); c.arc(0, 0, 2.6, 0, TAU); c.fill(); }
  c.restore();
}
function drawLogo() {
  const cv = $('logocv'); if (!cv) return; const c = cv.getContext('2d'); c.clearRect(0, 0, 260, 110); const now = Date.now() / 1000;
  // beams
  const bg = c.createLinearGradient(130, 30, 130 + 120, 30); bg.addColorStop(0, 'rgba(255,225,150,.55)'); bg.addColorStop(1, 'rgba(255,225,150,0)');
  c.fillStyle = bg; c.beginPath(); c.moveTo(130, 30); c.lineTo(255, 8); c.lineTo(255, 52); c.closePath(); c.fill();
  c.save(); c.scale(-1, 1); c.translate(-260, 0); c.fillStyle = bg; c.beginPath(); c.moveTo(130, 30); c.lineTo(255, 8); c.lineTo(255, 52); c.closePath(); c.fill(); c.restore();
  // tower
  c.strokeStyle = INK; c.lineWidth = 2; c.lineJoin = 'round';
  c.fillStyle = '#e9dcc0'; c.beginPath(); c.moveTo(114, 104); c.lineTo(120, 40); c.lineTo(140, 40); c.lineTo(146, 104); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#7a3b2a'; for (const [a, b] of [[48, 58], [72, 84]]) { const wl = y => 120 - (y - 40) * 6 / 64; c.beginPath(); c.moveTo(wl(a) - .1, a); c.lineTo(260 - wl(a), a); c.lineTo(260 - wl(b), b); c.lineTo(wl(b), b); c.closePath(); c.fill(); }
  c.beginPath(); c.moveTo(114, 104); c.lineTo(120, 40); c.lineTo(140, 40); c.lineTo(146, 104); c.closePath(); c.stroke();
  c.fillStyle = BRASS; c.fillRect(116, 36, 28, 5); c.strokeRect(116, 36, 28, 5);
  c.fillStyle = '#ffe9a0'; c.fillRect(122, 20, 16, 16); c.strokeRect(122, 20, 16, 16); c.fillStyle = '#fffbe0'; c.fillRect(126, 24, 8, 8);
  c.fillStyle = '#4a2f17'; c.beginPath(); c.moveTo(119, 20); c.lineTo(130, 9); c.lineTo(141, 20); c.closePath(); c.fill(); c.stroke();
  drawBean(c, 58, 104, 4, 1, 0, { scale: 1.9 }); drawBean(c, 202, 104, 8, -1, 0, { scale: 1.9 });
}
