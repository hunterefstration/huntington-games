// ==========================================
// HUD: input, actions, buttons, task list, intro / ejection / end screens
// ==========================================
const keys = new Set(); const joy = { x: 0, y: 0, id: -1, cx: 0, cy: 0 };
function resetInput() { keys.clear(); joy.x = joy.y = 0; joy.id = -1; }
function moveVec() {
  let x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  x += joy.x; y += joy.y; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } return { x, y };
}
const uiBlocking = () => !!(MINI || !$('sabm').classList.contains('hidden') || !$('mapov').classList.contains('hidden') || !$('s-pause').classList.contains('hidden'));
function closeOverlays() { $('sabm').classList.add('hidden'); $('mapov').classList.add('hidden'); $('s-pause').classList.add('hidden'); }

// ---- what can I do right now? ----
function nearBody(p) { let best = null, bd = REPORT_RANGE; for (const b of G.bodies) { const d = dist(p.x, p.y, b.x, b.y); if (d < bd && los(p.x, p.y, b.x, b.y)) { bd = d; best = b; } } return best; }
function ventNear(p) { let best = null, bd = USE_RANGE + 18; for (const v of MAP.vents) { const d = dist(p.x, p.y, v.x, v.y); if (d < bd) { bd = d; best = v; } } return best; }
function usable() {
  const p = me(); if (!p || G.phase !== 'play' || G.me < 0) return null;
  if (p.vent >= 0) return { type: 'unvent' };
  let best = null, bd = 1e9; const cand = (type, x, y, r, extra) => { const d = dist(p.x, p.y, x, y); if (d <= r && d < bd) { bd = d; best = Object.assign({ type }, extra); } };
  for (const t of p.tasks) if (!t.done) { const s = MAP.stations[t.sid]; cand('task', s.x, s.y, USE_RANGE, { sid: t.sid }); }
  if (p.alive && !p.imp) {
    if (G.sab.lights) cand('lights', MAP.lights.x, MAP.lights.y, USE_RANGE + 10);
    if (G.sab.reactor > 0) MAP.reactor.forEach((r, i) => cand('reactor', r.x, r.y, USE_RANGE + 10, { st: i }));
  }
  if (p.alive && p.em < G.set.meet && G.sab.reactor <= 0) cand('button', MAP.btn.x, MAP.btn.y, BTN_RANGE);
  if (p.imp && p.alive && ventNear(p)) cand('vent', ventNear(p).x, ventNear(p).y, USE_RANGE + 18);
  return best;
}
function tryUse() {
  if (!G || G.phase !== 'play' || MINI || G.me < 0) return; const u = usable(); if (!u) return;
  const p = me();
  if (u.type === 'unvent') return act({ t: 'vent', a: 'out' });
  if (u.type === 'task') { if (p.imp) { fakeTask(u.sid); return; } return openMini('task', u.sid); }
  if (u.type === 'lights') return openMini('lights');
  if (u.type === 'reactor') return openMini('reactor', u.st);
  if (u.type === 'button') { act({ t: 'meet' }); return; }
  if (u.type === 'vent') return act({ t: 'vent', a: 'in' });
}
let fakeBusy = false;
function fakeTask(sid) {
  if (fakeBusy) return; fakeBusy = true; toast('Pretending to tend the lamp... (fake chore)', 1400); sfx.click();
  setTimeout(() => { fakeBusy = false; const t = me() && me().tasks.find(q => q.sid === sid); if (t) { t.done = true; buildTaskList(); } }, 1500);
}
function doKill() { const p = me(); if (G && G.phase === 'play' && p && p.imp && p.alive && !MINI) act({ t: 'kill' }); }
function doReport() { const p = me(); if (G && G.phase === 'play' && p && p.alive && !MINI && nearBody(p)) act({ t: 'rep' }); }
function doVent() { const p = me(); if (!G || G.phase !== 'play' || !p || !p.imp || !p.alive || MINI) return; if (p.vent >= 0) act({ t: 'vent', a: 'out' }); else if (ventNear(p)) act({ t: 'vent', a: 'in' }); }
function ventCycle(dir) {
  const p = me(); if (!p || p.vent < 0) return; const cur = MAP.vents[p.vent], grp = MAP.vents.filter(v => v.g === cur.g); const i = grp.indexOf(cur);
  act({ t: 'vent', a: 'go', v: grp[(i + dir + grp.length) % grp.length].id });
}
function openSab() { const p = me(); if (!G || G.phase !== 'play' || !p || !p.imp || !p.alive || MINI) return; updateSabMenu(); $('sabm').classList.remove('hidden'); }
function updateSabMenu() { const S = G.sab, off = S.cd > 0 || S.lights || S.reactor > 0; $('sb-lights').disabled = off; $('sb-reactor').disabled = off; }
function toggleMap() { const m = $('mapov'); if (m.classList.contains('hidden')) { if (!G || G.phase !== 'play' || MINI) return; m.classList.remove('hidden'); } else m.classList.add('hidden'); }
function localMove(dt) {
  const p = me(); if (!p) return;
  if (G.phase !== 'play' || MINI || p.vent >= 0 || uiBlocking() || p.auto) { p.walk = false; return; }
  const v = moveVec(); if (v.x || v.y) { const sp = BASE_SPEED * G.set.speed * dt; moveBy(p, v.x * sp, v.y * sp); if (Math.abs(v.x) > .1) p.face = v.x > 0 ? 1 : -1; p.walk = true; p.moving = true; } else p.walk = false;
}
let lastPos = 0, lastPosX = 0, lastPosY = 0;
function sendPos() {
  if (!NET.guest || !G || G.phase !== 'play' || G.me < 0) return; const p = me(), now = performance.now();
  const moved = Math.abs(p.x - lastPosX) + Math.abs(p.y - lastPosY) > .5;
  if (now - lastPos < (moved ? 60 : 300)) return; lastPos = now; lastPosX = p.x; lastPosY = p.y;
  act({ t: 'pos', x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, f: p.face, w: p.walk ? 1 : 0 });
}

// ---- task list / role tag ----
function buildTaskList() {
  const p = me(), el = $('tlist'); if (!p) { el.innerHTML = ''; return; }
  el.innerHTML = ''; for (const t of p.tasks) { const s = MAP.stations[t.sid], d = document.createElement('div'); d.className = (t.done ? 'done ' : '') + (p.imp ? 'fk' : ''); d.appendChild(document.createTextNode(s.room + ': ')); const b = document.createElement('b'); b.textContent = KINDS[s.kind].name; d.appendChild(b); el.appendChild(d); }
  if (p.imp) { const d = document.createElement('div'); d.textContent = '(fake chores, they do not count)'; d.style.opacity = .6; el.appendChild(d); }
}
function updateRoleTag() {
  const p = me(), el = $('role-tag'); if (!p) { el.className = ''; el.textContent = G && G.spec ? 'WATCHING' : ''; return; }
  el.className = p.imp ? 'imp' : 'crew'; el.textContent = (p.imp ? 'THE SHADE' : 'KEEPER') + (p.alive ? '' : ' (SPIRIT)');
  if (p.imp) { const mates = G.players.filter(q => q.imp && q.id !== p.id).map(q => q.name); if (mates.length) { const s = document.createElement('small'); s.textContent = 'With: ' + mates.join(', '); el.appendChild(s); } }
}
function buildIntro() {
  const p = me(), role = $('in-role'), sub = $('in-sub'), team = $('in-team'); team.innerHTML = '';
  const nImp = G.players.filter(q => q.imp).length;
  if (!p) { role.className = 'crew'; role.textContent = 'WATCHING'; sub.textContent = 'You joined during a match. You will play next round.'; }
  else if (p.imp) { role.className = 'imp'; role.textContent = nImp > 1 ? 'A SHADE' : 'THE SHADE'; sub.textContent = nImp > 1 ? 'Snuff out the Keepers with your fellow Shade' + (nImp > 2 ? 's' : '') + '. Do not get caught.' : 'Snuff out the Keepers, one lamp at a time. Do not get caught.'; }
  else { role.className = 'crew'; role.textContent = 'KEEPER'; sub.textContent = nImp + (nImp === 1 ? ' Shade hides' : ' Shades hide') + ' in the lighthouse. Tend the lamps and keep the light alive!'; }
  const show = p ? (p.imp ? G.players.filter(q => q.imp) : [p]) : [];
  for (const q of show) { const d = document.createElement('div'); d.className = 'tm'; d.appendChild(mkIcon(q.color, 64)); d.appendChild(document.createTextNode(q.name)); team.appendChild(d); }
}
function hideIntro() { $('intro').classList.add('hidden'); }
function hideMatchUI() {
  for (const id of ['hud', 'intro', 'meet', 'eject', 'end', 'sabm', 'mapov', 'mini', 's-pause']) $(id).classList.add('hidden'); $('vign').classList.remove('on'); EJ = null;
  MINI = null; netBar('');
}
// ---- ejection screen ----
let EJ = null;
function buildEject(m) {
  $('ej-t1').textContent = ''; $('ej-t2').textContent = ''; EJ = { t: 0, m, stars: Array.from({ length: 60 }, () => [Math.random(), Math.random(), rnd(.3, 1.4)]) };
  const cv = $('ejcv'); cv.width = innerWidth; cv.height = innerHeight;
}
function ejectLoop(dt) {
  if (!EJ) return; EJ.t += dt; const cv = $('ejcv'), c = cv.getContext('2d'), W = cv.width, H = cv.height, t = EJ.t, m = EJ.m, hz = H * .64, S = Math.min(W, H * 1.5) / 640;
  const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#070d12'); sky.addColorStop(.55, '#17262c'); sky.addColorStop(1, '#0a1114'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
  c.fillStyle = '#e8e4cc'; for (const s of EJ.stars) { c.globalAlpha = .35 + .35 * Math.sin(t * 2 + s[0] * 20); c.fillRect(s[0] * W, s[1] * hz * .8, s[2] * 1.6, s[2] * 1.6); } c.globalAlpha = 1;
  const mg = c.createRadialGradient(W * .2, H * .16, 4, W * .2, H * .16, 90 * S); mg.addColorStop(0, 'rgba(255,248,215,.9)'); mg.addColorStop(.25, 'rgba(255,240,190,.25)'); mg.addColorStop(1, 'rgba(255,240,190,0)'); c.fillStyle = mg; c.beginPath(); c.arc(W * .2, H * .16, 90 * S, 0, TAU); c.fill();
  // sea
  const sea = c.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#1d3036'); sea.addColorStop(1, '#070c0f'); c.fillStyle = sea; c.fillRect(0, hz, W, H - hz);
  c.strokeStyle = 'rgba(200,225,220,.13)'; c.lineWidth = 2; for (let r = 0; r < 7; r++) { c.beginPath(); for (let x = 0; x <= W; x += 24) { const y = hz + 14 + r * r * 4 + Math.sin(x * .02 + t * 1.2 + r) * 3; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
  // distant lighthouse + sweeping beam
  const lx = W * .84, ly = hz - 8, a = Math.sin(t * .8) * .35 - .12, bl = W * .9;
  const bg = c.createLinearGradient(lx, ly - 150 * S, lx - Math.cos(a) * bl, ly - 150 * S - Math.sin(a) * bl); bg.addColorStop(0, 'rgba(255,235,170,.4)'); bg.addColorStop(1, 'rgba(255,235,170,0)');
  c.fillStyle = bg; c.beginPath(); c.moveTo(lx, ly - 150 * S); c.lineTo(lx - Math.cos(a - .07) * bl, ly - 150 * S - Math.sin(a - .07) * bl); c.lineTo(lx - Math.cos(a + .07) * bl, ly - 150 * S - Math.sin(a + .07) * bl); c.closePath(); c.fill();
  c.fillStyle = '#0c0f10'; c.beginPath(); c.moveTo(lx - 22 * S, ly + 6); c.lineTo(lx - 12 * S, ly - 140 * S); c.lineTo(lx + 12 * S, ly - 140 * S); c.lineTo(lx + 22 * S, ly + 6); c.fill(); c.fillRect(lx - 16 * S, ly - 156 * S, 32 * S, 16 * S);
  c.fillStyle = '#ffe7a0'; c.fillRect(lx - 9 * S, ly - 152 * S, 18 * S, 9 * S);
  // jetty
  const jy = hz - 6, ex = W * .56; c.fillStyle = '#3b2814'; c.fillRect(0, jy, ex + 30 * S, 12 * S); c.fillStyle = '#5a3d22'; c.fillRect(0, jy, ex + 30 * S, 4 * S);
  c.fillStyle = '#241608'; for (let x = 20 * S; x < ex + 30 * S; x += 70 * S) c.fillRect(x, jy + 12 * S, 8 * S, 60 * S);
  c.fillStyle = BRASS; c.fillRect(ex + 26 * S, jy - 30 * S, 4 * S, 30 * S); c.fillStyle = '#ffd98a'; c.beginPath(); c.arc(ex + 28 * S, jy - 36 * S, 6 * S, 0, TAU); c.fill();
  if (m.who >= 0) {
    const p = G.players[m.who], wk = clamp(t / 2.6, 0, 1), fall = t - 2.7;
    if (fall < 0) { const px = lerp(W * .06, ex, wk); drawBean(c, px, jy + 2, p.color, 1, t * 13, { scale: 2.4 * S, walk: wk < 1 }); }
    else if (fall < 1.6) { const fy = jy + fall * fall * 260 * S, al = clamp(1 - Math.max(0, fall - .7) / .9, 0, 1); c.save(); c.translate(ex, fy); c.rotate(fall * 2.2); drawBean(c, 0, 20, p.color, 1, 0, { scale: 2.4 * S, alpha: al }); c.restore(); }
    if (fall > .7) { const sy = hz + 40 * S, k = (fall - .7); c.strokeStyle = 'rgba(220,240,235,' + clamp(.5 - k * .2, 0, .5) + ')'; c.lineWidth = 3; for (let r = 0; r < 3; r++) { c.beginPath(); c.ellipse(ex, sy, (k * 50 + r * 18) * S, (k * 14 + r * 5) * S, 0, 0, TAU); c.stroke(); } }
    if (fall > 1.4) { const k = fall - 1.4; c.save(); c.translate(ex, hz + 20 * S - k * 55 * S); c.scale(2 * S, 2 * S); drawGhost(c, 0, 0, p.color, 1, t, { alpha: clamp(.8 - k * .22, 0, .8) }); c.restore(); }
  }
  // drifting fog
  for (let i = 0; i < 4; i++) { const fy = hz - 30 * S + i * 36 * S, fx = ((t * (12 + i * 7) + i * 300) % (W + 600)) - 300; const fg = c.createRadialGradient(fx, fy, 10, fx, fy, 320 * S); fg.addColorStop(0, 'rgba(190,205,200,.16)'); fg.addColorStop(1, 'rgba(190,205,200,0)'); c.fillStyle = fg; c.fillRect(fx - 330 * S, fy - 120 * S, 660 * S, 240 * S); }
  const va = c.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .95); va.addColorStop(0, 'rgba(0,0,0,0)'); va.addColorStop(1, 'rgba(0,0,0,.65)'); c.fillStyle = va; c.fillRect(0, 0, W, H);
  const A = $('ej-t1'), B = $('ej-t2'); const s1 = m.t1.slice(0, Math.max(0, Math.floor((t - 1.2) * 28))), s2 = m.t2.slice(0, Math.max(0, Math.floor((t - 3.4) * 28)));
  if (A.textContent !== s1) A.textContent = s1; if (B.textContent !== s2) B.textContent = s2;
}
// ---- end screen ----
function buildEnd() {
  const o = G.over, p = me(), win = p ? (p.imp ? o.w === 'imp' : o.w === 'crew') : o.w === 'crew';
  const t = $('en-title'); t.className = p ? (win ? 'win' : 'lose') : 'win'; t.textContent = o.w === 'crew' ? 'THE LIGHT HOLDS' : 'LIGHTS OUT';
  $('en-why').textContent = (o.w === 'crew' ? 'The Keepers prevail: ' : 'The Shades prevail: ') + o.why;
  const r = $('en-roster'); r.innerHTML = ''; for (const q of G.players) { const d = document.createElement('div'); d.className = q.imp ? 'imp' : ''; d.appendChild(mkIcon(q.color, 52, !q.alive)); d.appendChild(document.createTextNode(q.name + (q.imp ? ' (Shade)' : ''))); r.appendChild(d); }
  const off = !NET.host && !NET.guest, again = $('en-again'); again.classList.toggle('hidden', NET.guest); again.textContent = off ? 'Play again' : 'Back to lobby'; $('en-menu').textContent = off ? 'Menu' : 'Leave';
  $('en-wait').textContent = NET.guest ? 'Waiting for the host to start another round...' : '';
  (win ? sfx.win : sfx.lose)();
}
// ---- per-frame HUD ----
let hudCache = {};
function setTxt(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function updateHud(dt) {
  const intro = $('intro'), ph = G ? G.phase : '';
  const show = (id, on) => { const e = $(id); if (e.classList.contains('hidden') === on) e.classList.toggle('hidden', !on); };
  if (!G) return;
  show('intro', ph === 'intro'); show('hud', ph === 'play' || ph === 'over'); show('meet', ph === 'meeting' && !!G.meet); show('eject', ph === 'eject' && !!G.ej);
  if (ph === 'over' && G.overAt && performance.now() - G.overAt > 1400 && !G.endBuilt) { G.endBuilt = true; buildEnd(); }
  show('end', ph === 'over' && !!G.endBuilt);
  if (ph === 'eject') ejectLoop(dt);
  if (ph === 'meeting') meetUpdate(true);
  if (ph !== 'play' && ph !== 'over') return;
  const p = me(), S = G.sab;
  $('tbar-f').style.width = (G.taskTotal ? Math.min(100, G.taskDone / G.taskTotal * 100) : 0) + '%'; setTxt('tbar-t', 'LAMPS TENDED ' + G.taskDone + ' / ' + G.taskTotal);
  // alert line
  let al = '', fl = false; if (S.reactor > 0) { al = 'BOILER OVERLOAD ' + Math.ceil(S.reactor) + 's - hold both valves!'; fl = true; } else if (S.lights) { al = 'LAMPS OUT - relight them in the ' + MAP.lights.room; fl = true; }
  setTxt('alert', al); $('alert').classList.toggle('flash', fl); $('vign').classList.toggle('on', S.reactor > 0);
  // action buttons
  const touch = isTouch(); $('joy').classList.toggle('hidden', !touch);
  const spec = G.me < 0, imp = !!(p && p.imp), alive = !!(p && p.alive), u = usable(), inVent = !!(p && p.vent >= 0);
  const showB = (id, on) => $(id).classList.toggle('hidden', !on);
  showB('a-kill', imp && !spec); showB('a-sab', imp && alive && !spec); showB('a-vent', imp && alive && !spec); showB('a-rep', !spec && alive); showB('a-use', !spec); showB('b-map', !spec);
  showB('vent-nav', inVent); showB('spec-bar', spec);
  if (spec) { const tp = camTarget(); setTxt('sp-name', 'Watching: ' + (tp ? tp.name : '-')); }
  if (p) {
    const canKill = imp && alive && p.kcd <= 0 && !inVent && ph === 'play' && nearestVictim(p);
    $('a-kill').classList.toggle('off', !canKill); $('a-kill').classList.toggle('ready', !!canKill); setTxt('a-kill-s', p.kcd > 0 ? Math.ceil(p.kcd) + 's' : 'Q');
    const canRep = alive && ph === 'play' && !!nearBody(p); $('a-rep').classList.toggle('off', !canRep); $('a-rep').classList.toggle('ready', canRep);
    $('a-use').classList.toggle('off', !u); $('a-use').classList.toggle('ready', !!u);
    $('a-sab').classList.toggle('off', S.cd > 0 || S.lights || S.reactor > 0); setTxt('a-sab-s', S.cd > 0 && !S.lights && S.reactor <= 0 ? Math.ceil(S.cd) + 's' : 'X');
    $('a-vent').classList.toggle('off', !inVent && !ventNear(p)); setTxt('a-vent-b', inVent ? 'EXIT' : 'TRAPDOOR');
  }
  if (!$('sabm').classList.contains('hidden')) updateSabMenu();
  if (!$('mapov').classList.contains('hidden')) drawMapOverlay();
}
function bindHud() {
  const b = (id, fn) => { $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); ac(); fn(); }); };
  b('a-use', tryUse); b('a-kill', doKill); b('a-rep', doReport); b('a-vent', doVent); b('a-sab', openSab);
  b('b-map', toggleMap); b('map-close', toggleMap); b('b-menu', () => { $('s-pause').classList.remove('hidden'); $('p-vol').value = settings.vol; });
  b('vn-prev', () => ventCycle(-1)); b('vn-next', () => ventCycle(1)); b('sp-prev', () => { G.specTarget--; }); b('sp-next', () => { G.specTarget++; });
  $('sb-lights').onclick = () => { act({ t: 'sab', k: 'lights' }); $('sabm').classList.add('hidden'); }; $('sb-reactor').onclick = () => { act({ t: 'sab', k: 'reactor' }); $('sabm').classList.add('hidden'); };
  $('sb-close').onclick = () => $('sabm').classList.add('hidden');
  // inject small labels for dynamic text
  for (const [id, tag] of [['a-kill', 's'], ['a-sab', 's']]) { const s = $(id).querySelector('small'); s.id = id + '-s'; }
  $('a-vent').querySelector('b').id = 'a-vent-b';
  $('p-resume').onclick = () => $('s-pause').classList.add('hidden'); $('p-leave').onclick = () => { $('s-pause').classList.add('hidden'); leaveToMenu(); };
  $('p-vol').oninput = e => { settings.vol = +e.target.value; saveSettings(); };
  $('en-again').onclick = () => { if (!NET.host && !NET.guest) { G = null; hideMatchUI(); startOffline(); } else backToLobby(); };
  $('en-menu').onclick = () => leaveToMenu();
  // virtual joystick (left half of the screen)
  const jy = $('joy'), knob = jy.querySelector('i');
  jy.addEventListener('pointerdown', e => { e.preventDefault(); joy.id = e.pointerId; try { jy.setPointerCapture(e.pointerId); } catch (x) { } joyMove(e); });
  jy.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e); });
  const jend = e => { if (e.pointerId === joy.id) { joy.id = -1; joy.x = joy.y = 0; knob.style.transform = ''; } };
  jy.addEventListener('pointerup', jend); jy.addEventListener('pointercancel', jend);
  function joyMove(e) { const r = jy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } joy.x = Math.abs(dx) < .15 ? 0 : dx; joy.y = Math.abs(dy) < .15 ? 0 : dy; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; }
}
