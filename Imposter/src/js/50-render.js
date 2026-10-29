// ==========================================
// RENDER: camera, world, bodies, players, fog of war
// ==========================================
const R = { cv: null, c: null, W: 800, H: 600, zoom: 1, cx: 0, cy: 0, fog: null, fc: null, fs: .5, vr: VIS_CREW, t: 0 };
function resizeView() {
  R.W = innerWidth; R.H = innerHeight; R.cv.width = R.W; R.cv.height = R.H;
  R.zoom = clamp(Math.min(R.W / 940, R.H / 560), .55, 1.6);
  R.fog.width = Math.ceil(R.W * R.fs); R.fog.height = Math.ceil(R.H * R.fs);
}
function initRender() {
  R.cv = $('view'); R.c = R.cv.getContext('2d'); R.fog = document.createElement('canvas'); R.fc = R.fog.getContext('2d');
  resizeView(); addEventListener('resize', resizeView);
}
// who the camera follows
function camTarget() {
  if (!G) return null;
  if (G.me >= 0) return G.players[G.me];
  const live = G.players.filter(p => p.alive && !p.left); if (!live.length) return G.players[0];
  return live[((G.specTarget % live.length) + live.length) % live.length];
}
function viewRadius(p) { if (!p || !p.alive) return 1e5; return p.imp ? VIS_IMP : (G.sab.lights ? VIS_DARK : VIS_CREW); }
function canSee(me, q) {
  if (q.id === G.me) return true;
  if (G.me < 0 || !me.alive) return q.alive || true;
  if (!q.alive || q.vent >= 0 || q.left) return false;
  return dist(me.rx, me.ry, q.rx, q.ry) <= R.vr + 6 && los(me.rx, me.ry, q.rx, q.ry);
}
function updateSmooth(dt) {
  for (const p of G.players) {
    if (p.id === G.me) { p.rx = p.x; p.ry = p.y; }
    else { const k = Math.min(1, dt * 14); if (dist(p.rx, p.ry, p.x, p.y) > 160) { p.rx = p.x; p.ry = p.y; } else { p.rx += (p.x - p.rx) * k; p.ry += (p.y - p.ry) * k; } }
    const mv = Math.hypot(p.rx - (p.prx == null ? p.rx : p.prx), p.ry - (p.pry == null ? p.ry : p.pry)); p.prx = p.rx; p.pry = p.ry;
    p.moving = mv > .25; if (p.moving) p.ph += dt * 13;
  }
}
function render(dt) {
  const c = R.c; R.t += dt;
  if (!G || !MAP || !MAP.img || G.phase === 'meeting' || G.phase === 'eject') { if (G && (G.phase === 'meeting' || G.phase === 'eject')) return; c.fillStyle = '#05070f'; c.fillRect(0, 0, R.W, R.H); return; }
  updateSmooth(dt);
  const tp = camTarget(), mep = G.me >= 0 ? G.players[G.me] : null, z = R.zoom, W = R.W, H = R.H;
  const want = viewRadius(mep || tp); R.vr += (Math.min(want, 700) - R.vr) * Math.min(1, dt * 3); if (!mep || !mep.alive) R.vr = 700;
  let tx = tp ? tp.rx : MAP.pw / 2, ty = tp ? tp.ry : MAP.ph / 2;
  R.cx += (tx - R.cx) * Math.min(1, dt * 12); if (Math.abs(R.cx - tx) > 500) R.cx = tx; R.cy += (ty - R.cy) * Math.min(1, dt * 12); if (Math.abs(R.cy - ty) > 500) R.cy = ty;
  const hw = W / 2 / z, hh = H / 2 / z; R.cx = clamp(R.cx, Math.min(hw, MAP.pw / 2), Math.max(MAP.pw - hw, MAP.pw / 2)); R.cy = clamp(R.cy, Math.min(hh, MAP.ph / 2), Math.max(MAP.ph - hh, MAP.ph / 2));
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#04060d'; c.fillRect(0, 0, W, H);
  const ox = W / 2 - R.cx * z, oy = H / 2 - R.cy * z; c.setTransform(z, 0, 0, z, ox, oy);
  const vx0 = Math.max(0, R.cx - hw), vy0 = Math.max(0, R.cy - hh), vx1 = Math.min(MAP.pw, R.cx + hw), vy1 = Math.min(MAP.ph, R.cy + hh);
  c.drawImage(MAP.img, vx0, vy0, vx1 - vx0, vy1 - vy0, vx0, vy0, vx1 - vx0, vy1 - vy0);
  const inV = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m, t = R.t, sab = G.sab;
  // stations, vents, button, panels
  const myPending = new Set(); if (mep) for (const k of mep.tasks) if (!k.done) myPending.add(k.sid);
  for (const s of MAP.stations) if (inV(s.x, s.y, 40)) drawStation(c, s, t, myPending.has(s.id) && mep && mep.alive !== undefined);
  for (const v of MAP.vents) if (inV(v.x, v.y, 40)) drawVent(c, v, mep && mep.vent === v.id);
  if (inV(MAP.btn.x, MAP.btn.y, 60)) drawButtonProp(c, MAP.btn, t);
  if (inV(MAP.lights.x, MAP.lights.y, 40)) drawFixPanel(c, MAP.lights, t, 'lights', sab.lights);
  for (const rp of MAP.reactor) if (inV(rp.x, rp.y, 40)) drawFixPanel(c, rp, t, 'reactor', sab.reactor > 0);
  // bodies + players, back to front
  const list = [];
  for (const b of G.bodies) { if (!inV(b.x, b.y, 40)) continue; const vis = !mep || !mep.alive || (dist(mep.rx, mep.ry, b.x, b.y) <= R.vr + 6 && los(mep.rx, mep.ry, b.x, b.y)); if (vis) list.push({ y: b.y, body: b }); }
  for (const p of G.players) {
    if (p.left || !inV(p.rx, p.ry, 60)) continue;
    if (!p.alive && !(mep && !mep.alive) && !(G.spec)) continue; // ghosts only seen by ghosts
    if (p.vent >= 0 && p.id !== G.me && !(mep && !mep.alive)) continue;
    if (!canSee(mep, p) && !(!mep || !mep.alive)) continue;
    list.push({ y: p.ry, p });
  }
  list.sort((a, b) => a.y - b.y);
  for (const e of list) {
    if (e.body) { drawBody(c, e.body.x, e.body.y, G.players[e.body.id].color); continue; }
    const p = e.p, viewerGhost = !mep || !mep.alive;
    if (p.vent >= 0) { c.save(); c.globalAlpha = .45; drawBean(c, p.rx, p.ry, p.color, p.face, p.ph, { walk: false }); c.restore(); }
    else if (!p.alive) drawGhost(c, p.rx, p.ry, p.color, p.face, t + p.id);
    else drawBean(c, p.rx, p.ry, p.color, p.face, p.ph, { walk: p.moving, alpha: viewerGhost && p.id !== G.me ? 1 : 1 });
    // name tag
    const red = p.imp && (G.me < 0 || (mep && mep.imp) || (G.over)); c.font = '800 12px "Trebuchet MS",sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.8)'; c.fillStyle = red ? '#ff5566' : '#fff';
    c.strokeText(p.name, p.rx, p.ry - 46); c.fillText(p.name, p.rx, p.ry - 46);
  }
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.t += dt; if (f.t > .7) { FX.splice(i, 1); continue; }
    const k = f.t / .7; c.save(); c.globalAlpha = 1 - k; c.fillStyle = f.kind === 'vent' ? '#9ab' : '#e33';
    for (let j = 0; j < 7; j++) { const a = j / 7 * TAU + f.x, r = 8 + k * 30; c.beginPath(); c.arc(f.x + Math.cos(a) * r, f.y - 14 + Math.sin(a) * r * .7, 6 * (1 - k) + 2, 0, TAU); c.fill(); } c.restore();
  }
  // fog of war
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (mep && mep.alive) drawFog(mep, ox, oy, z);
  else { c.fillStyle = 'rgba(20,30,80,.14)'; c.fillRect(0, 0, W, H); }
  if (G.sab.reactor > 0) { c.fillStyle = `rgba(255,0,30,${.06 + .05 * Math.sin(t * 6)})`; c.fillRect(0, 0, W, H); }
}
function drawFog(mep, ox, oy, z) {
  const fc = R.fc, fs = R.fs, rad = R.vr, px = mep.rx, py = mep.ry - 12;
  fc.globalCompositeOperation = 'source-over'; fc.setTransform(1, 0, 0, 1, 0, 0); fc.fillStyle = 'rgba(2,3,8,.965)'; fc.fillRect(0, 0, R.fog.width, R.fog.height);
  fc.globalCompositeOperation = 'destination-out'; fc.setTransform(z * fs, 0, 0, z * fs, ox * fs, oy * fs);
  const N = 110, g = fc.createRadialGradient(px, py, rad * .12, px, py, rad); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.72, 'rgba(0,0,0,.96)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  fc.fillStyle = g; fc.beginPath();
  for (let i = 0; i <= N; i++) { const a = i / N * TAU, l = rayLen(px, py, a, rad); const x = px + Math.cos(a) * l, y = py + Math.sin(a) * l; if (i) fc.lineTo(x, y); else fc.moveTo(x, y); }
  fc.closePath(); fc.fill();
  R.c.drawImage(R.fog, 0, 0, R.W, R.H);
}
// ---- the full map overlay ----
function drawMapOverlay() {
  const cv = $('mapcv'), c = cv.getContext('2d'); if (!MAP || !MAP.img) return;
  const sc = Math.min(cv.width / MAP.pw, cv.height / MAP.ph), w = MAP.pw * sc, h = MAP.ph * sc, ox = (cv.width - w) / 2, oy = (cv.height - h) / 2;
  c.fillStyle = '#05070f'; c.fillRect(0, 0, cv.width, cv.height); c.globalAlpha = .9; c.drawImage(MAP.img, ox, oy, w, h); c.globalAlpha = 1;
  const mep = G && G.me >= 0 ? G.players[G.me] : null, t = performance.now() / 1000;
  if (mep) {
    for (const k of mep.tasks) if (!k.done) { const s = MAP.stations[k.sid]; c.fillStyle = '#ffd36b'; c.strokeStyle = '#000'; c.beginPath(); c.arc(ox + s.x * sc, oy + s.y * sc, 6, 0, TAU); c.fill(); c.stroke(); }
    if (mep.imp) for (const v of MAP.vents) { c.fillStyle = '#b48cff'; c.fillRect(ox + v.x * sc - 4, oy + v.y * sc - 4, 8, 8); }
    if (mep.imp) for (const q of G.players) if (q.imp && q.id !== mep.id && q.alive) { c.fillStyle = '#ff4455'; c.beginPath(); c.arc(ox + q.x * sc, oy + q.y * sc, 5, 0, TAU); c.fill(); }
    c.fillStyle = COLORS[mep.color].c; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(ox + mep.x * sc, oy + mep.y * sc, 7, 0, TAU); c.fill(); c.stroke();
  }
  if (G && G.sab.lights) { c.fillStyle = (t * 3 | 0) & 1 ? '#ff3344' : '#ffd36b'; c.beginPath(); c.arc(ox + MAP.lights.x * sc, oy + MAP.lights.y * sc, 8, 0, TAU); c.fill(); }
  if (G && G.sab.reactor > 0) for (const r of MAP.reactor) { c.fillStyle = (t * 3 | 0) & 1 ? '#ff3344' : '#ffd36b'; c.beginPath(); c.arc(ox + r.x * sc, oy + r.y * sc, 8, 0, TAU); c.fill(); }
  c.fillStyle = '#fff'; c.font = '700 11px sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#000';
  for (const r of MAP.d.rooms) { const x = ox + (r[1] + r[3] / 2) * sc * TS, y = oy + (r[2] + r[4] / 2) * sc * TS; c.strokeText(r[0], x, y); c.fillText(r[0], x, y); }
}
