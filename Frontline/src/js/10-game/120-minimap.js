// ---------------- minimap ----------------
let mmBase = null, mmFog = null, mmFogC = null, mmS = 1, mmOx = 0, mmOy = 0, mmCtx = null, mmPings = [];
function mmBuild() {
  const cv = $('#mm'); const M = W.M; cv.width = cv.clientWidth * 1 || 172; cv.height = cv.clientHeight || 160; mmCtx = cv.getContext('2d');
  mmS = Math.min(cv.width / M.w, cv.height / M.d); mmOx = (cv.width - M.w * mmS) / 2; mmOy = (cv.height - M.d * mmS) / 2;
  mmBase = document.createElement('canvas'); mmBase.width = cv.width; mmBase.height = cv.height; const c = mmBase.getContext('2d'); c.fillStyle = '#05080c'; c.fillRect(0, 0, cv.width, cv.height);
  const iw = Math.max(1, Math.round(M.w * mmS)), ih = Math.max(1, Math.round(M.d * mmS)); const id = c.createImageData(iw, ih); const tmp = [0, 0, 0];
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const wx = (x / iw) * M.w - M.hw, wz = (y / ih) * M.d - M.hd, h = M.H(wx, wz); let r, g, b;
    if (h < M.wl - .05) { _col.set(M.biome.water); r = _col.r; g = _col.g; b = _col.b; r *= .8; g *= .85; } else { terrainColor(M, wx, wz, h, M.slope(wx, wz), tmp); r = tmp[0]; g = tmp[1]; b = tmp[2]; const sh = 1 + (h - 2) * .05; r *= sh; g *= sh; b *= sh; }
    if (M.nav.blk[M.nav.idx(wx, wz)] && h >= M.wl - .05) { r *= .75; g *= .75; b *= .75; }
    const i = (y * iw + x) * 4; id.data[i] = clamp(r * 255, 0, 255); id.data[i + 1] = clamp(g * 255, 0, 255); id.data[i + 2] = clamp(b * 255, 0, 255); id.data[i + 3] = 255;
  }
  const t = document.createElement('canvas'); t.width = iw; t.height = ih; t.getContext('2d').putImageData(id, 0, 0); c.drawImage(t, mmOx, mmOy);
  mmFog = document.createElement('canvas'); mmFog.width = W.vw; mmFog.height = W.vd; mmFogC = mmFog.getContext('2d');
}
function mm2w(px, py) { const M = W.M; return [(px - mmOx) / mmS - M.hw, (py - mmOy) / mmS - M.hd]; }
function mmDraw() {
  if (!mmCtx) return; const M = W.M, c = mmCtx, cv = c.canvas; c.drawImage(mmBase, 0, 0);
  if (W.o.fog) { const g = W.vis[MYTEAM]; const id = mmFogC.createImageData(W.vw, W.vd); for (let i = 0; i < g.length; i++) { id.data[i * 4 + 3] = g[i] === 2 ? 0 : g[i] === 1 ? 95 : 215; } mmFogC.putImageData(id, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(mmFog, mmOx, mmOy, M.w * mmS, M.d * mmS); }
  const X = x => mmOx + (x + M.hw) * mmS, Z = z => mmOy + (z + M.hd) * mmS;
  for (const pt of W.pts) { c.beginPath(); c.arc(X(pt.x), Z(pt.z), pt.hq >= 0 ? 5 : 3.5, 0, TAU); c.fillStyle = pt.owner >= 0 ? hex3(P(pt.owner).color) : '#b8bec6'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = pt.contested ? '#ff3b30' : '#000a'; c.stroke(); }
  for (const b of W.bld) { if (b.team !== MYTEAM && W.o.fog && !(b.sb >> MYTEAM & 1)) continue; if (b.type === 'wall') continue; c.fillStyle = hex3(P(b.owner).color); c.fillRect(X(b.x) - 1.5, Z(b.z) - 1.5, 3, 3); }
  for (const u of W.units) { if (!myVisible(u)) continue; c.fillStyle = hex3(P(u.owner).color); const s = u.T.cls >= 2 ? 3 : 2; c.fillRect(X(u.rx !== undefined ? u.rx : u.x) - s / 2, Z(u.rz !== undefined ? u.rz : u.z) - s / 2, s, s); }
  const now = performance.now() / 1000; for (let i = mmPings.length - 1; i >= 0; i--) { const p = mmPings[i]; const f = (now - p.t0) / 3; if (f > 1) { mmPings.splice(i, 1); continue; } c.strokeStyle = p.col; c.lineWidth = 2; c.beginPath(); c.arc(X(p.x), Z(p.z), 4 + f * 14, 0, TAU); c.globalAlpha = 1 - f; c.stroke(); c.globalAlpha = 1; }
  // camera frustum
  const pts = []; const tmp = { x: 0, z: 0 }; for (const [sx, sy] of [[0, vpH * .12], [vpW, vpH * .12], [vpW, vpH * .8], [0, vpH * .8]]) { screenToGround(sx, sy, tmp); pts.push([X(clamp(tmp.x, -M.hw, M.hw)), Z(clamp(tmp.z, -M.hd, M.hd))]); }
  c.strokeStyle = '#fff'; c.lineWidth = 1.2; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
}
// =====================================================================
//  AUDIO
// =====================================================================
let AC = null, master = null, noiseBuf = null; const sfxLast = {}; let sfxBudget = 0;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => { }); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = SET.vol / 100 * .55; const comp = AC.createDynamicsCompressor(); master.connect(comp); comp.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function setVol() { if (master) master.gain.value = SET.vol / 100 * .55; }
function tone(f, dur, type, vol, f2, delay) {
  if (!AC) return; const t = AC.currentTime + (delay || 0); const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
function noise(dur, vol, f1, f2, type, delay) {
  if (!AC) return; const t = AC.currentTime + (delay || 0); const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = AC.createBiquadFilter(); fl.type = type || 'lowpass'; fl.frequency.setValueAtTime(f1, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .02);
}

let mgain = null; const MUS = { next: 0, bar: 0, intensity: 0, shots: 0 };
function musicVol() { if (mgain) mgain.gain.value = SET.music / 100 * .22; }
const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]], BASS = [110, 87.3, 130.8, 98];
function musicTick(dt) {
  if (!AC || SET.music <= 0) return; if (!mgain) { mgain = AC.createGain(); mgain.connect(AC.destination); musicVol(); MUS.next = AC.currentTime + .2; }
  MUS.intensity += (clamp(MUS.shots / 14, 0, 1) - MUS.intensity) * Math.min(1, dt * .8); MUS.shots = 0;
  const now = AC.currentTime; if (MUS.next < now - 1) MUS.next = now + .2; if (now < MUS.next - .5) return; const t = MUS.next, c = CHORDS[MUS.bar % 4], len = 4.2 - MUS.intensity * 1.2; MUS.bar++;
  for (let i = 0; i < c.length; i++) { const o = AC.createOscillator(), g = AC.createGain(); o.type = i === 0 ? 'triangle' : 'sine'; o.frequency.value = c[i] * (i === 2 && MUS.intensity > .5 ? 2 : 1); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.16 - i * .03, t + len * .4); g.gain.linearRampToValueAtTime(.0001, t + len * 1.1); o.connect(g); g.connect(mgain); o.start(t); o.stop(t + len * 1.15); }
  const b = AC.createOscillator(), bg = AC.createGain(); b.type = 'sine'; b.frequency.value = BASS[(MUS.bar - 1) % 4]; bg.gain.setValueAtTime(.0001, t); bg.gain.linearRampToValueAtTime(.3, t + .3); bg.gain.linearRampToValueAtTime(.0001, t + len); b.connect(bg); bg.connect(mgain); b.start(t); b.stop(t + len + .1);
  if (MUS.intensity > .25) { const n = MUS.intensity > .6 ? 8 : 4; for (let i = 0; i < n; i++) { const tt = t + i * len / n; const o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(110, tt); o.frequency.exponentialRampToValueAtTime(42, tt + .16); g.gain.setValueAtTime(.4, tt); g.gain.exponentialRampToValueAtTime(.001, tt + .2); o.connect(g); g.connect(mgain); o.start(tt); o.stop(tt + .22); } }
  MUS.next = t + len;
}
function sfx(name, x, z) {
  if (!AC || SET.vol <= 0) return; if (x !== undefined && !inGame) return; const now = performance.now(); if (sfxBudget > 10) return;
  let v = 1; if (x !== undefined) { const d = Math.hypot(x - cam.x, z - cam.z); v = clamp(1 - d / (cam.dist * 2.2 + 40), 0, 1); v *= v; if (v < .02) return; }
  const minGap = { shot: 55, boom: 70, cannon: 90, rocket: 90, die: 80, flak: 60, snipe: 120, pulse: 55, plasma: 90 }[name] || 40; if (now - (sfxLast[name] || 0) < minGap) return; sfxLast[name] = now; sfxBudget++;
  switch (name) {
    case 'shot': noise(.06, .35 * v, 2400, 700, 'bandpass'); tone(220, .05, 'square', .06 * v, 90); break;
    case 'snipe': noise(.18, .6 * v, 3000, 400, 'bandpass'); tone(140, .15, 'sawtooth', .12 * v, 50); break;
    case 'cannon': noise(.22, .55 * v, 900, 120, 'lowpass'); tone(110, .2, 'sawtooth', .2 * v, 45); break;
    case 'rocket': noise(.35, .4 * v, 600, 2400, 'bandpass'); break;
    case 'flak': noise(.07, .3 * v, 1500, 400, 'bandpass'); tone(300, .06, 'square', .05 * v, 150); break;
    case 'pulse': tone(1300, .07, 'sawtooth', .05 * v, 380); noise(.04, .12 * v, 4000, 1500, 'bandpass'); break;   // 3.0 Legion energy weapons
    case 'plasma': tone(520, .22, 'sawtooth', .1 * v, 90); noise(.2, .3 * v, 1800, 300, 'bandpass'); break;
    case 'howl': tone(900, .5, 'sine', .08 * v, 300); noise(.15, .3 * v, 500, 100, 'lowpass'); break;
    case 'bombdrop': tone(1200, .8, 'sine', .06 * v, 220); break;
    case 'boom': noise(.5, .7 * v, 1400, 80, 'lowpass'); tone(80, .4, 'sine', .3 * v, 30); break;
    case 'boomL': noise(1.0, .9 * v, 1000, 50, 'lowpass'); tone(60, .8, 'sine', .45 * v, 22); break;
    case 'die': tone(260, .15, 'triangle', .05 * v, 120); break;
    case 'click': tone(660, .05, 'square', .06, 440); break;
    case 'deny': tone(180, .12, 'sawtooth', .08, 110); break;
    case 'order': tone(520, .05, 'triangle', .07, 700); break;
    case 'alert': tone(880, .12, 'square', .07); tone(660, .16, 'square', .07, 0, .14); break;
    case 'cap': tone(523, .15, 'triangle', .1); tone(659, .15, 'triangle', .1, 0, .12); tone(784, .3, 'triangle', .1, 0, .24); break;
    case 'lost': tone(300, .25, 'sawtooth', .09, 150); tone(220, .3, 'sawtooth', .09, 100, .2); break;
    case 'done': tone(700, .1, 'sine', .08); tone(1050, .18, 'sine', .08, 0, .09); break;
    case 'vet': tone(600, .1, 'triangle', .09); tone(900, .1, 'triangle', .09, 0, .09); tone(1200, .2, 'triangle', .09, 0, .18); break;
    case 'jet': noise(1.6, .4 * v, 300, 1800, 'bandpass'); break;
    case 'para': tone(600, 1.0, 'sine', .04 * v, 1100); break;
    case 'win': for (let i = 0; i < 4; i++) tone([523, 659, 784, 1047][i], .35, 'triangle', .12, 0, i * .16); break;
    case 'lose': for (let i = 0; i < 3; i++) tone([400, 330, 262][i], .45, 'sawtooth', .1, 0, i * .22); break;
    case 'thunder': noise(2.4, .55, 420, 60, 'lowpass'); noise(1.2, .35, 900, 120, 'lowpass', .08); tone(46, 1.6, 'sine', .25, 30); break;   // 3.0 storms
  }
}

// =====================================================================
//  UI STATE / INPUT
// =====================================================================
const UI = { mode: null, callId: null, form: 6, gspd: false, groups: {}, mx: 0, my: 0, overCanvas: false, keys: {}, lastClick: { t: 0, id: 0 }, touch: false, boxTouch: false, drag: null, ptrs: new Map(), pinch: null, selEnemy: null, did: {}, cardSig: '', selSig: '', specOpen: false, supOpen: false, more: false, lastAlert: null, chatOpen: false, mmDrag: false, camMoved: 0, hoverT: 0, inWin: false, tutorialTick: null };
const CAMD = { min: 30, max: 135 };
let CARD = [], inGame = false;
function selUnitsArr() { const r = []; for (const id of selIds) { const u = W.byId.get(id); if (u && !u.dead) r.push(u); } return r; }
function closePops() { UI.supOpen = false; UI.specOpen = false; UI.more = false; }
function afterSel() { UI.cardSig = ''; UI.selSig = ''; hudUpdate(true); }
function clearSel() { selIds.clear(); selBld = 0; setSelPadState(HIDEPADS, null); UI.selEnemy = null; closePops(); UI.mode = null; hideTgtRing(); }
function selectUnits(ids, add) {
  if (!add) { selIds.clear(); selBld = 0; setSelPadState(HIDEPADS, null); UI.selEnemy = null; }
  closePops(); for (const id of ids) selIds.add(id); afterSel();
}
function selectBuilding(b) { selIds.clear(); selBld = b.id; setSelPadState(HIDEPADS, null); UI.selEnemy = b.team !== MYTEAM ? b : null; closePops(); afterSel(); }
function selectPad(pt, slot) { selIds.clear(); selBld = 0; setSelPadState(HIDEPADS, { pt: pt.id, slot }); UI.selEnemy = null; closePops(); afterSel(); }
function selectPoint(pt) { selIds.clear(); selBld = 0; setSelPadState(HIDEPADS, { pt: pt.id, slot: -9 }); UI.selEnemy = null; closePops(); afterSel(); }
function issue(c) { if (!W) return false; if (W.mirror) { netSendCmd(c); return true; } return applyCmd(ME, c); }
function myUnitsOnScreen(type) { const r = []; const o = {}; for (const u of W.units) { if (u.owner !== ME || (type && u.type !== type)) continue; w2s(u.rx, u.ry, u.rz, o); if (o.z < 1 && o.x > 0 && o.x < vpW && o.y > 40 && o.y < vpH - hudDeckPx()) r.push(u); } return r; }
function selAllArmy() {
  let us = W.units.filter(u => u.owner === ME && !u.T.eng); if (!us.length) us = W.units.filter(u => u.owner === ME);
  if (!us.length) { toast('You have no troops yet. Train some at your HQ or Barracks!'); sfx('deny'); return; }
  selectUnits(us.map(u => u.id)); UI.did.army = 1; sfx('click');
}
function selIdle() {
  const us = W.units.filter(u => u.owner === ME && u.o === 0 && !u.moving);
  if (!us.length) { toast('No idle troops. They are all busy!'); sfx('deny'); return; }
  selectUnits(us.map(u => u.id)); UI.did.idle = 1; sfx('click');
}
function goHome(snap) { const h = P(ME).hqB; if (h) { camGoto(h.x, h.z, snap); UI.did.home = 1; } }

// ---- camera controls ----
function camGoto(x, z, snap) { const M = W.M; cam.tx = clamp(x, -M.hw + 4, M.hw - 4); cam.tz = clamp(z, -M.hd + 4, M.hd - 4); UI.camMoved += 1; if (snap) { cam.x = cam.tx; cam.z = cam.tz; } }
function camZoom(f) { cam.tdist = clamp(cam.tdist * f, CAMD.min, CAMD.max); UI.did.zoom = 1; }
const _pa1 = { x: 0, z: 0, ok: false }, _pa2 = { x: 0, z: 0, ok: false };
function camMoveScreen(dx, dy, snap) { // move the camera by a screen-space vector (pixels)
  screenToGround(vpW / 2, vpH / 2, _pa1); screenToGround(vpW / 2 + dx, vpH / 2 + dy, _pa2); if (!_pa1.ok || !_pa2.ok) return;
  const M = W.M, mx = clamp(_pa2.x - _pa1.x, -60, 60), mz = clamp(_pa2.z - _pa1.z, -60, 60);
  cam.tx = clamp(cam.tx + mx, -M.hw + 4, M.hw - 4); cam.tz = clamp(cam.tz + mz, -M.hd + 4, M.hd - 4);
  if (snap) { cam.x = clamp(cam.x + mx, -M.hw + 4, M.hw - 4); cam.z = clamp(cam.z + mz, -M.hd + 4, M.hd - 4); } UI.camMoved += .05;
}
function onWheel(e) {
  if (!inGame || SCREEN) return; if (e.target !== glc) return;       // wheel over a panel scrolls the panel (the browser does that), never the camera
  e.preventDefault();
  const ln = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vpH : 1; const dx = e.deltaX * ln, dy = e.deltaY * ln;
  if (e.ctrlKey) { camZoom(Math.exp(clamp(dy, -60, 60) * .011)); return; }         // pinch on a touchpad, or Ctrl + wheel
  if (SET.scroll === 'zoom' && !e.shiftKey) { camZoom(Math.abs(dy) >= 50 ? (dy > 0 ? 1.13 : 1 / 1.13) : Math.exp(clamp(dy, -80, 80) * .004)); return; }   // optional "wheel zooms" mode for mouse users
  camMoveScreen(dx * .9, dy * .9, true);                                              // wheel / two-finger scroll pans the map
}
// horizontal card rows: a normal mouse wheel (vertical) scrolls them sideways
function wheelCards(e) {
  const c = e.target.closest && e.target.closest('.cards'); if (!c || c.scrollWidth <= c.clientWidth + 1) return;
  const ln = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? c.clientWidth : 1; const dx = e.deltaX * ln, dy = e.deltaY * ln;
  c.scrollLeft += Math.abs(dx) > Math.abs(dy) ? dx : dy; e.preventDefault();
}

const _sp = { x: 0, y: 0, z: 0 }, _g = { x: 0, z: 0, ok: false };
function ppuAt(x, y, z) { const dx = camera.position.x - x, dy = camera.position.y - y, dz = camera.position.z - z; const d = Math.sqrt(dx * dx + dy * dy + dz * dz); return vpH / (2 * Math.tan(camera.fov * PI / 360) * d); }
function pickEntity(sx, sy, filter) {
  let best = null, bs = 1e9; const touchPad = UI.touch ? 10 : 3;
  for (const u of W.units) {
    if (!myVisible(u)) continue; if (filter && !filter(u)) continue; w2s(u.rx, u.ry + (u.T.walker ? 3.4 : u.T.cls === 0 ? 1.0 : 1.4), u.rz, _sp); if (_sp.z > 1) continue;
    const rpx = u.T.r * 1.35 * ppuAt(u.rx, u.ry, u.rz) + touchPad + 5; const d = Math.hypot(_sp.x - sx, _sp.y - sy); if (d < rpx && d / rpx < bs) { bs = d / rpx; best = u; }
  }
  if (best) return best;
  for (const b of W.bld) {
    if (b.type === 'wall') continue; if (b.team !== MYTEAM && W.o.fog && !(b.sb >> MYTEAM & 1) && !seen(MYTEAM, b.x, b.z)) continue; if (filter && !filter(b)) continue;
    w2s(b.x, b.y + b.T.sz * .4, b.z, _sp); if (_sp.z > 1) continue; const rpx = b.T.sz * (selIds.size && b.team === MYTEAM ? .42 : .7) * ppuAt(b.x, b.y, b.z) + touchPad + 3; const d = Math.hypot(_sp.x - sx, _sp.y - sy); if (d < rpx && d / rpx < bs) { bs = d / rpx; best = b; }
  }
  return best;
}
function pickPad(g, rad) { rad = rad || 3.4;
  for (const pt of W.pts) {
    if (pt.owner !== ME) continue;
    for (let k = 0; k < pt.slots.length; k++) { const s = pt.slots[k]; if (!s.b && Math.hypot(g.x - s.x, g.z - s.z) < rad) return { pt, slot: k }; }
  } return null;
}
function pickWall(g) { for (const pt of W.pts) { const wb = pt.wall; if (!wb || wb.dead || wb.team !== MYTEAM) continue; const R = pt.big ? 36 : pt.hq >= 0 ? 19.5 : 13.5; if (Math.abs(Math.hypot(g.x - pt.x, g.z - pt.z) - R) < (UI.touch ? 3.6 : 2.6)) return wb; } return null; }
function pickPoint(g) { let best = null, bd = 1e9; for (const pt of W.pts) { const d = Math.hypot(g.x - pt.x, g.z - pt.z); if (d < (pt.hq >= 0 ? 14 : pt.r + 1.5) && d < bd) { bd = d; best = pt; } } return best; }
function ping(x, z, col) { mmPings.push({ x, z, t0: performance.now() / 1000, col: col || '#ffd24a' }); }
function orderMarker(x, z, col) { markers.push({ x, z, t0: performance.now() / 1000, dur: .55, col: col || [.4, 1, .5] }); }
function nearEnemy(x, z, r) { for (const u of W.units) if (u.team !== MYTEAM && myVisible(u) && Math.hypot((u.rx !== undefined ? u.rx : u.x) - x, (u.rz !== undefined ? u.rz : u.z) - z) < r) return true; for (const b of W.bld) if (b.team !== MYTEAM && b.type !== 'wall' && myVisible(b) && Math.hypot(b.x - x, b.z - z) < r + 3) return true; return false; }
function setMode(m, id) { UI.mode = m; UI.callId = id || null; UI.cardSig = ''; if (m === 'call') showTgtRing(); else hideTgtRing(); hudUpdate(true); }

// ----- left click / tap: select, move or attack -----
function onClickWorld(sx, sy, shift) {
  if (UI.supOpen || UI.specOpen || UI.more) { closePops(); UI.cardSig = ''; }
  if (UI.mode === 'sbspawn') { screenToGround(sx, sy, _g); if (_g.ok && !issue({ k: 'dbg', what: 'unit', type: UI.sb.type, owner: UI.sb.side, x: _g.x, z: _g.z }) && UT[UI.sb.type] && UT[UI.sb.type].naval) toast('Ships need deep water: click on the river.'); return; }
  if (UI.mode === 'call') {
    screenToGround(sx, sy, _g); if (_g.ok) { const id = UI.callId; if (issue({ k: 'call', id, x: _g.x, z: _g.z })) { UI.did.call = 1; sfx('order'); orderMarker(_g.x, _g.z, [1, .7, .3]); } else { sfx('deny'); toast('You cannot use that there right now'); } }
    if (!shift) setMode(null); return;
  }
  if (UI.mode === 'amove' || UI.mode === 'nest' || UI.mode === 'rally' || UI.mode === 'guard') {
    screenToGround(sx, sy, _g); if (!_g.ok) return; const ids = selUnitsArr().map(u => u.id);
    if (UI.mode === 'guard' && ids.length) { const pt = pickPoint(_g); const gx = pt ? pt.x : _g.x, gz = pt ? pt.z : _g.z; if (issue({ k: 'guard', ids, x: gx, z: gz })) { orderMarker(gx, gz, [.4, .85, 1]); sfx('order'); toast(ids.length + ' troops guarding ' + (pt ? (pt.hq >= 0 ? 'the base' : pt.name) : 'that spot')); } if (!shift) setMode(null); return; }
    if (UI.mode === 'amove' && ids.length) { issue({ k: 'am', ids, x: _g.x, z: _g.z, f: UI.form, g: UI.gspd ? 1 : 0 }); UI.did.am = 1; orderMarker(_g.x, _g.z, [1, .5, .3]); sfx('order'); }
    else if (UI.mode === 'nest' && ids.length) { issue({ k: 'nest', ids, x: _g.x, z: _g.z }); orderMarker(_g.x, _g.z, [.9, .9, .4]); sfx('order'); }
    else if (UI.mode === 'rally' && selBld) { issue({ k: 'rally', b: selBld, x: _g.x, z: _g.z }); orderMarker(_g.x, _g.z, [.5, .8, 1]); sfx('order'); }
    if (!shift) setMode(null); return;
  }
  const e = pickEntity(sx, sy), have = selIds.size > 0;
  if (e && e.k === 'u') {
    if (e.owner === ME) {
      if (e.T.carry && !shift && selIds.size && !selIds.has(e.id)) { const ids = selUnitsArr().filter(u => u.T.cls === 0 && !u.T.air).map(u => u.id); if (ids.length) { issue({ k: 'board', ids, t: e.id }); orderMarker(e.rx, e.rz, [.4, .85, 1]); sfx('order'); toast(ids.length + ' soldier' + (ids.length > 1 ? 's' : '') + ' boarding the ' + e.T.n + '. Then select it and click a beach.'); return; } }   // 3.0
      const now = performance.now();
      if (!shift && selIds.size > 1 && selIds.has(e.id) && !(UI.lastClick.id === e.id && now - UI.lastClick.t < 420)) { UI.lastClick = { t: now, id: e.id }; screenToGround(sx, sy, _g); if (_g.ok) { issueMove(_g.x, _g.z, nearEnemy(_g.x, _g.z, 16)); return; } }
      if (UI.lastClick.id === e.id && now - UI.lastClick.t < 420) { selectUnits(myUnitsOnScreen(e.type).map(u => u.id), shift); camGoto(e.rx, e.rz); UI.lastClick.t = 0; return; }
      UI.lastClick = { t: now, id: e.id };
      if (shift) { if (selIds.has(e.id)) { selIds.delete(e.id); afterSel(); } else selectUnits([e.id], true); } else selectUnits([e.id]); sfx('click'); return;
    }
    if (e.team !== MYTEAM && have) { issue({ k: 'atk', ids: selUnitsArr().map(u => u.id), t: e.id }); UI.did.atk = 1; orderMarker(e.rx, e.rz, [1, .3, .3]); sfx('order'); return; }
    clearSel(); UI.selEnemy = e; afterSel(); return;
  }
  if (e && e.k === 'b') {
    if (e.team === MYTEAM) { selectBuilding(e); sfx('click'); return; }
    if (have) { issue({ k: 'atk', ids: selUnitsArr().map(u => u.id), t: e.id }); UI.did.atk = 1; orderMarker(e.x, e.z, [1, .3, .3]); sfx('order'); return; }
    clearSel(); selBld = e.id; UI.selEnemy = e; afterSel(); return;
  }
  screenToGround(sx, sy, _g); if (!_g.ok) return;
  if (have) { issueMove(_g.x, _g.z, nearEnemy(_g.x, _g.z, 16)); return; }
  const wl = pickWall(_g); if (wl) { selectBuilding(wl); sfx('click'); return; }
  const pad = pickPad(_g, UI.touch ? 4.2 : 3.4); if (pad) { selectPad(pad.pt, pad.slot); sfx('click'); return; }
  const pt = pickPoint(_g); if (pt) { selectPoint(pt); sfx('click'); return; }
  if (!shift) { clearSel(); afterSel(); }
}
function issueMove(x, z, am) {
  const us = selUnitsArr(), ids = us.map(u => u.id); if (!ids.length) return false;
  const M = W.M, crafts = us.filter(u => u.T.carry); if (crafts.length && M.H(x, z) > M.wl - .5 && (W.mirror || crafts.some(u => u.cargo && u.cargo.length))) {   // 3.0: clicking land with a Landing Craft lands its soldiers there
    issue({ k: 'unload', ids: crafts.map(u => u.id), x, z }); const rest = ids.filter(id => !crafts.some(u => u.id === id)); if (rest.length) issue({ k: am ? 'am' : 'mv', ids: rest, x, z, f: UI.form, g: UI.gspd ? 1 : 0 });
    orderMarker(x, z, [.4, .85, 1]); sfx('order'); return true;
  }
  issue({ k: am ? 'am' : 'mv', ids, x, z, f: UI.form, g: UI.gspd ? 1 : 0 }); UI.did.move = 1; orderMarker(x, z, am ? [1, .5, .3] : [.4, 1, .5]); sfx('order'); return true;
}
// ----- right click (optional shortcut: same as left click on the ground / enemies) -----
function onRightClick(sx, sy, alt) {
  if (UI.mode) { setMode(null); return; }
  const ids = selUnitsArr().map(u => u.id);
  if (!ids.length) {
    if (selBld) { const b = W.byId.get(selBld); if (b && b.owner === ME) { screenToGround(sx, sy, _g); if (_g.ok) { issue({ k: 'rally', b: b.id, x: _g.x, z: _g.z }); orderMarker(_g.x, _g.z, [.5, .8, 1]); sfx('order'); } } }
    return;
  }
  { const cr = pickEntity(sx, sy, x => x.owner === ME && x.k === 'u' && !!x.T.carry && !selIds.has(x.id)); const sol = selUnitsArr().filter(u => u.T.cls === 0 && !u.T.air).map(u => u.id); if (cr && sol.length) { issue({ k: 'board', ids: sol, t: cr.id }); orderMarker(cr.rx, cr.rz, [.4, .85, 1]); sfx('order'); return; } }   // 3.0 right-click a Landing Craft to board it
  const e = pickEntity(sx, sy, x => x.team !== MYTEAM);
  if (e) { issue({ k: 'atk', ids, t: e.id }); UI.did.atk = 1; orderMarker(e.rx !== undefined ? e.rx : e.x, e.rz !== undefined ? e.rz : e.z, [1, .3, .3]); sfx('order'); return; }
  screenToGround(sx, sy, _g); if (_g.ok) issueMove(_g.x, _g.z, alt || UI.keys['f']);
}

// ----- pointer events -----
function setupInput() {
  const cv = glc; cv.tabIndex = 0;
  window.addEventListener('contextmenu', e => { if (inGame) e.preventDefault(); });
  cv.addEventListener('pointerdown', e => {
    initAudio(); if (!inGame) return; try { cv.focus(); } catch (_) { } const touch = e.pointerType === 'touch';
    if (e.button === 0 && (techOpen || UI.supOpen || UI.specOpen)) { closeTech(); closePops(); UI.cardSig = ''; hudUpdate(true); updQuick(true); }   // 2.1: a click on the map closes Upgrades / Support and still counts if (touch) { UI.touch = true; showTouchBtns(true); }
    try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    UI.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), btn: e.button, touch, moved: false });
    UI.mx = e.clientX; UI.my = e.clientY;
    if (UI.ptrs.size === 2) { const a = [...UI.ptrs.values()]; UI.pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), cx: (a[0].x + a[1].x) / 2, cy: (a[0].y + a[1].y) / 2 }; UI.drag = null; hideBox(); return; }
    if (e.button === 0 || touch) { UI.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, box: false, shift: e.shiftKey, touch }; if (touch) { const p = UI.ptrs.get(e.pointerId); p.lp = setTimeout(() => { if (UI.ptrs.has(e.pointerId) && !p.moved && UI.ptrs.size === 1) { UI.drag.box = true; sfx('click'); } }, 380); } }
    if (e.button === 1) { UI.drag = { id: e.pointerId, pan: true, x0: e.clientX, y0: e.clientY }; e.preventDefault(); }
  });
  cv.addEventListener('pointermove', e => {
    UI.mx = e.clientX; UI.my = e.clientY; const p = UI.ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > (p.touch ? 14 : 12)) p.moved = true;   // 2.0: touchpad taps drift a few pixels; that is still a click
    if (UI.ptrs.size === 2 && UI.pinch) {
      const a = [...UI.ptrs.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2;
      camZoom(UI.pinch.d / Math.max(10, d)); camMoveScreen(-(cx - UI.pinch.cx), -(cy - UI.pinch.cy), true); UI.pinch.d = d; UI.pinch.cx = cx; UI.pinch.cy = cy; return;
    }
    const dr = UI.drag; if (!dr || dr.id !== e.pointerId) return;
    if (dr.pan) { camMoveScreen(-dx, -dy, true); return; }
    if (dr.touch) { if (p.moved && !dr.box && !UI.boxTouch) { clearTimeout(p.lp); camMoveScreen(-dx, -dy, true); } else if (p.moved && (dr.box || UI.boxTouch)) { dr.box = true; drawBox(dr.x0, dr.y0, e.clientX, e.clientY); } }
    else if (p.moved) { dr.box = true; drawBox(dr.x0, dr.y0, e.clientX, e.clientY); }
  });
  const up = e => {
    const p = UI.ptrs.get(e.pointerId); if (!p) return; clearTimeout(p.lp); UI.ptrs.delete(e.pointerId); try { cv.releasePointerCapture(e.pointerId); } catch (_) { }
    if (UI.pinch) { if (UI.ptrs.size < 2) UI.pinch = null; UI.drag = null; hideBox(); return; }
    const dr = UI.drag; hideBox();
    if (e.type === 'pointercancel') { UI.drag = null; return; }
    if (e.button === 2 && !p.touch) { if (!p.moved) onRightClick(e.clientX, e.clientY, e.altKey); return; }
    if (!dr || dr.id !== e.pointerId) return; UI.drag = null; if (dr.pan) return;
    const dd = Math.hypot(e.clientX - p.x0, e.clientY - p.y0), quick = performance.now() - p.t0 < 350;
    if (dr.box && p.moved && !(quick && dd < 26)) { boxSelect(dr.x0, dr.y0, e.clientX, e.clientY, e.shiftKey || dr.shift); return; }
    if (!p.moved || (quick && dd < 26)) onClickWorld(p.x0, p.y0, e.shiftKey);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', onWheel, { passive: false }); $('#panel').addEventListener('wheel', wheelCards, { passive: false });
  window.addEventListener('mousemove', e => { UI.mx = e.clientX; UI.my = e.clientY; UI.inWin = true; UI.overCanvas = e.target === glc; if (UI.mmDrag) mmPointer(e, false); const t = e.target && e.target.closest && e.target.closest('[data-tip]'); showTip(t, e); });
  window.addEventListener('mouseup', () => { UI.mmDrag = false; });
  window.addEventListener('pointerdown', e => { UI.ptrType = e.pointerType; }, true); window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') UI.ptrType = 'mouse'; }, true);
  document.addEventListener('mouseleave', () => { UI.overCanvas = false; UI.inWin = false; });
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', e => { const kk = e.key.toLowerCase(); UI.keys[kk] = false; if (kk === 'f') fRelease(); });
  window.addEventListener('blur', () => { UI.keys = {}; fRelease(true); });
  // minimap: click or drag to move the camera. Right-click (or two-finger click) orders units there.
  const mm = $('#mm');
  mm.addEventListener('pointerdown', e => { initAudio(); if (!inGame) return; e.preventDefault(); if (e.pointerType === 'touch') { UI.touch = true; showTouchBtns(true); } if (e.button === 2) { mmPointer(e, true); return; } UI.mmDrag = true; mmPointer(e, false); try { mm.setPointerCapture(e.pointerId); } catch (_) { } });
  mm.addEventListener('pointermove', e => { if (UI.mmDrag && e.pointerType === 'touch') mmPointer(e, false); });
  mm.addEventListener('contextmenu', e => e.preventDefault());
  $('#hud').addEventListener('contextmenu', e => e.preventDefault());
  $('#panel').addEventListener('contextmenu', e => { const c = e.target.closest('.card[data-key]'); if (!c || !selBld) return; const b = W && W.byId.get(selBld), k = c.dataset.key; if (b && b.owner === ME && UT[k] && b.ros && b.ros[k]) { issue({ k: 'ros', b: b.id, u: k, d: -1 }); sfx('click'); UI.cardSig = ''; hudUpdate(true); } });
  $('#btnMenu').onclick = () => openPause();
  $('#zIn').onclick = () => camZoom(1 / 1.2); $('#zOut').onclick = () => camZoom(1.2);
  $('#rL').onclick = () => { cam.tyaw -= PI / 4; }; $('#rR').onclick = () => { cam.tyaw += PI / 4; };
  $('#panel').addEventListener('click', e => {
    const pgb = e.target.closest('[data-pg]'); if (pgb) { if (!pgb.disabled) { UI.page = (UI.page || 0) + (+pgb.dataset.pg); sfx('click'); hudUpdate(true); } return; }
    const qx = e.target.closest('[data-qx]'); if (qx && selBld) { issue({ k: 'ros', b: selBld, u: qx.dataset.qx, d: -1 }); sfx('click'); UI.cardSig = ''; hudUpdate(true); return; }
    const g = e.target.closest('[data-grp]'); if (g) { const t = g.dataset.grp; selectUnits(selUnitsArr().filter(u => u.type === t).map(u => u.id)); return; }
    const hbb = e.target.closest('[data-hb]'); if (hbb) { const f = CARD.hb && CARD.hb[hbb.dataset.hb]; if (f) { initAudio(); f(); } return; }
    const c = e.target.closest('[data-i]'); if (c) { const f = CARD[+c.dataset.i]; if (f) { initAudio(); f(); } }
  });
  $('#squads').addEventListener('click', e => { if (!inGame) return; initAudio(); const a = e.target.closest('[data-sqadd]'); if (a) { e.stopPropagation(); const n = +a.dataset.sqadd, ids = selUnitsArr().map(u => u.id); if (!ids.length) { toast('Select some troops first, then press + to add them to squad ' + SQN[n - 1] + '.'); sfx('deny'); return; } squadAdd(n, ids); toast(ids.length + ' troops joined squad ' + SQN[n - 1]); sfx('click'); updSquads(true); return; } if (e.target.closest('[data-wmap]')) { toggleWarMap(); sfx('click'); return; } const q = e.target.closest('[data-sq]'); if (q) { squadSelect(+q.dataset.sq); updSquads(true); } });
  $('#squads').addEventListener('contextmenu', e => { e.preventDefault(); const q = e.target.closest('[data-sq]'); if (q) { UI.groups[+q.dataset.sq] = []; toast('Squad ' + SQN[+q.dataset.sq - 1] + ' cleared'); updSquads(true); } });
  $('#quick').addEventListener('click', e => { const b = e.target.closest('[data-q2]'); if (b) { initAudio(); const f = QUICKFN[b.dataset.q2]; if (f) f(); } });
  $('#sup').addEventListener('click', e => { const c = e.target.closest('[data-call]'); if (c) { initAudio(); startCall(c.dataset.call); } });
  $('#scoreRow').addEventListener('click', e => { const f = e.target.closest('[data-pt]'); if (f) { const pt = W.pts[+f.dataset.pt]; if (pt) { camGoto(pt.x, pt.z); sfx('click'); UI.did.flagjump = 1; } } });
  $('#alerts').addEventListener('click', e => { const a = e.target.closest('[data-x]'); if (a) camGoto(+a.dataset.x, +a.dataset.z); });
}
function mmPointer(e, cmd) {
  const mm = $('#mm'), r = mm.getBoundingClientRect(); const px = (e.clientX - r.left) * mm.width / r.width, py = (e.clientY - r.top) * mm.height / r.height; const w = mm2w(px, py);
  const M = W.M; const x = clamp(w[0], -M.hw, M.hw), z = clamp(w[1], -M.hd, M.hd);
  if (cmd) { const ids = selUnitsArr().map(u => u.id); if (ids.length) { issue({ k: e.altKey || UI.keys['f'] ? 'am' : 'mv', ids, x, z, f: UI.form, g: UI.gspd ? 1 : 0 }); sfx('order'); UI.did.move = 1; } else if (selBld) issue({ k: 'rally', b: selBld, x, z }); return; }
  if (UI.mode === 'call') { const ok = issue({ k: 'call', id: UI.callId, x, z }); if (ok) sfx('order'); setMode(null); return; }
  camGoto(x, z); UI.did.mm = 1;
}
function drawBox(x0, y0, x1, y1) { const b = $('#boxsel'); b.classList.remove('hidden'); b.style.left = Math.min(x0, x1) + 'px'; b.style.top = Math.min(y0, y1) + 'px'; b.style.width = Math.abs(x1 - x0) + 'px'; b.style.height = Math.abs(y1 - y0) + 'px'; }
function hideBox() { $('#boxsel').classList.add('hidden'); }
function boxSelect(x0, y0, x1, y1, add) {
  const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1); const ids = [];
  for (const u of W.units) { if (u.owner !== ME) continue; w2s(u.rx, u.ry + 1, u.rz, _sp); if (_sp.z < 1 && _sp.x >= l && _sp.x <= r && _sp.y >= t && _sp.y <= b) ids.push(u.id); }
  if (ids.length) { selectUnits(ids, add); UI.did.box = ids.length; sfx('click'); }
  else if (!add && Math.max(r - l, b - t) > 40) { clearSel(); afterSel(); }   // 2.0: a small empty box (a sloppy click) keeps the selection
}
const KEYCARD = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'];
function onKey(e) {
  if (!inGame) { if (e.key === 'Escape' && (SCREEN === 'general' || SCREEN === 'profile' || SCREEN === 'news') && !(e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName))) ACT.back2(); return; }
  const k = e.key.toLowerCase();
  if (SCREEN) { if (k === 'escape' && SCREEN === 'pause') ACT.resume(); else if (k === 'escape' && (SCREEN === 'howto' || SCREEN === 'tech') && inGame) ACT.howback(); return; }
  if (UI.chatOpen) { if (e.key === 'Escape') closeChat(); return; }
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab', 'backspace', 'pageup', 'pagedown'].includes(k)) e.preventDefault();
  if ((e.ctrlKey || e.metaKey || e.altKey) && k !== 'a' && !/^[1-9]$/.test(k)) return; // leave browser shortcuts (Ctrl+R, Ctrl+W...) alone
  UI.keys[k] = true; initAudio();
  if (k === 'escape' && UI.wmapOn) { closeWarMap(); return; }
  if (k === 'escape') { if (UI.mode) setMode(null); else if (UI.supOpen || UI.specOpen || UI.more) { closePops(); UI.cardSig = ''; hudUpdate(true); } else if (techOpen) closeTech(); else if (selIds.size || selBld || selPadState()) { clearSel(); afterSel(); } else openPause(); return; }
  if (k === 'enter') { openChat(); e.preventDefault(); return; }
  if (k === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) { if (!e.repeat) { UI.fUsed = false; clearTimeout(UI.fTimer); UI.fTimer = setTimeout(() => { if (UI.keys['f'] && !UI.fUsed && inGame && hqOk()) { UI.supOpen = true; UI.supByF = true; UI.specOpen = false; hudUpdate(true); } }, 260); } return; }   // Hold F + a number = Support power (tap F = Move + Fight)
  if (/^[1-9]$/.test(k) && !e.altKey) {
    const n = +k; if (UI.keys['f'] && !e.ctrlKey && !e.metaKey) { UI.fUsed = true; if (CALLORDER[n - 1]) { const id = CALLORDER[n - 1]; if (CALL[id].fogOnly && !W.o.fog) { sfx('deny'); toast(CALL[id].n + ' only works when Fog of war is on'); } else startCall(id); } return; }
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); UI.groups[n] = selUnitsArr().map(u => u.id); toast('Group ' + n + ' saved (' + UI.groups[n].length + ' units)'); sfx('click'); UI.did.group = 1; }
    else if (UI.groups[n]) { const ids = UI.groups[n].filter(id => { const u = W.byId.get(id); return u && !u.dead; }); UI.groups[n] = ids; if (ids.length) { selectUnits(ids, e.shiftKey); const now = performance.now(); if (UI.gLast === n && now - UI.gT < 450) { const u = W.byId.get(ids[0]); camGoto(u.x, u.z); } UI.gLast = n; UI.gT = now; } }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); selAllArmy(); return; }
  switch (k) {
    case 't': openTech(); return; case 'p': openPause(); return; case '?': ACT.help(); return;
    case 'home': case ' ': case 'backspace': goHome(); return;
    case 'tab': selIdle(); return;
    case '=': case '+': case 'pageup': camZoom(1 / 1.2); return; case '-': case '_': case 'pagedown': camZoom(1.2); return;
    case 'k': if (selBld) { const b = W.byId.get(selBld); if (b && b.owner === ME && b.type !== 'hq') issue({ k: 'sell', b: selBld }); } return;
    case 'h': { const ids = selUnitsArr().map(u => u.id); if (ids.length) issue({ k: 'stop', ids }); return; }
    case 'j': { const ids = selUnitsArr().map(u => u.id); if (ids.length) issue({ k: 'hold', ids }); return; }
    case 'y': { const j = FORMUI.indexOf(UI.form); UI.form = FORMUI[(j + 1) % FORMUI.length]; toast('Formation: ' + FORMN[UI.form]); UI.cardSig = ''; return; }
    case 'g': UI.gspd = !UI.gspd; toast('Stay together: ' + (UI.gspd ? 'on' : 'off')); UI.cardSig = ''; return;
    case 'r': retreatSel(); return;
    case 'u': { if (selBld) { issue({ k: 'upg', b: selBld }); UI.did.upg = 1; } return; }
    case 'delete': if (selBld) { const b = W.byId.get(selBld); if (b && b.owner === ME && b.type !== 'hq') issue({ k: 'sell', b: selBld }); return; } return;
  }
  if (k === 'n' && selUnitsArr().some(u => u.T.eng)) { setMode('nest'); return; }
  if (k === 'm') { toggleWarMap(); return; }
  if (k === 'v' && selUnitsArr().length) { setMode(UI.mode === 'guard' ? null : 'guard'); return; }
  if (k === 'x' && selUnitsArr().length) { cycleTarget(selUnitsArr()); return; }
  const ci = KEYCARD.indexOf(k); if (ci >= 0 && CARD[ci] && !e.ctrlKey && !e.altKey && !selUnitsArr().length && (selBld || selPad)) { CARD[ci](); return; }
}
function fRelease(blur) {
  clearTimeout(UI.fTimer); const used = UI.fUsed, byF = UI.supByF; UI.supByF = false;
  if (byF && UI.supOpen && !UI.mode) { UI.supOpen = false; hudUpdate(true); }
  if (!blur && !used && inGame && !SCREEN && !UI.chatOpen && !byF && selUnitsArr().length) setMode(UI.mode === 'amove' ? null : 'amove');   // a quick tap of F
  UI.fUsed = false;
}
function selPadState() { return selPad; }
function retreatSel() {
  const us = selUnitsArr(); if (!us.length) return; let c = [0, 0]; for (const u of us) { c[0] += u.x; c[1] += u.z; } c[0] /= us.length; c[1] /= us.length;
  let best = null, bd = 1e9; for (const pt of W.pts) if (pt.owner >= 0 && P(pt.owner).team === MYTEAM) { const d = Math.hypot(pt.x - c[0], pt.z - c[1]); if (d < bd) { bd = d; best = pt; } }
  if (best) { issue({ k: 'mv', ids: us.map(u => u.id), x: best.x, z: best.z, f: UI.form }); orderMarker(best.x, best.z, [.5, .7, 1]); sfx('order'); UI.did.retreat = 1; }
}
function startCall(id) {
  const p = P(ME), C = callText(id, p.fac); if (C.fogOnly && !W.o.fog) { sfx('deny'); toast(C.n + ' only works when Fog of war is on'); return; }
  if (!callAvail(p, id) && !W.o.sandbox) { sfx('deny'); toast(C.req[0] === 'hq' ? 'Upgrade your HQ to Level ' + C.req[1] + ' to unlock ' + C.n : 'Build a Radar Station and level it up to Level ' + C.req[1] + ' to unlock ' + C.n); return; }
  if ((p.cd[id] || 0) > 0) { sfx('deny'); toast(C.n + ' is recharging: ' + Math.ceil(p.cd[id]) + 's'); return; }
  if (p.sup < callCost(p, id) && !W.o.sandbox) { sfx('deny'); toast('Not enough money'); return; }
  UI.supOpen = false; setMode('call', id);
}
let tgtRing = null;
function showTgtRing() { if (!tgtRing) { const g = new THREE.RingGeometry(.94, 1, 40); g.rotateX(-PI / 2); tgtRing = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: .9, depthTest: false })); tgtRing.renderOrder = 9; scene.add(tgtRing); } tgtRing.visible = true; tgtRing.scale.setScalar(CALL[UI.callId].rad); tgtRing.material.color.set(CALL[UI.callId].col); }
function hideTgtRing() { if (tgtRing) tgtRing.visible = false; }
const QUICKCHAT = ['Good luck!', 'Attack now!', 'Need help!', 'Nice move!', 'Hold the line!', 'gg'];
function openChat(forceInput) {
  if (!(W && (W.o.mp || W.mirror))) return;
  if (UI.touch && !forceInput) { let q = $('#qchat'); if (q) { q.remove(); return; } q = document.createElement('div'); q.id = 'qchat'; q.style.cssText = 'position:absolute;left:8px;bottom:210px;display:flex;flex-direction:column;gap:4px;z-index:8;pointer-events:auto'; q.innerHTML = QUICKCHAT.map(m => '<button class="tbtn" data-m="' + m + '">' + m + '</button>').join('') + '<button class="tbtn" data-m="">Type...</button>'; $('#hud').appendChild(q); q.addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; q.remove(); if (b.dataset.m) sendChat(b.dataset.m); else openChat(true); }); return; }
  const i = document.createElement('input'); i.id = 'chatin'; i.maxLength = 80; i.placeholder = 'Message (Enter to send)'; $('#hud').appendChild(i); UI.chatOpen = true; i.focus(); i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const m = i.value.trim(); if (m) sendChat(m); closeChat(); } else if (e.key === 'Escape') closeChat(); }); }
function closeChat() { const i = $('#chatin'); if (i) i.remove(); UI.chatOpen = false; glc.focus && glc.focus(); }
function sendChat(m) { if (W.mirror) netSendCmd({ k: 'chat', m }); else applyCmd(ME, { k: 'chat', m }); }

