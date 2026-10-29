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
  if (fakeBusy) return; fakeBusy = true; toast('Pretending to work... (fake task)', 1400); sfx.click();
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
  if (p.imp) { const d = document.createElement('div'); d.textContent = '(fake tasks, they do not count)'; d.style.opacity = .6; el.appendChild(d); }
}
function updateRoleTag() {
  const p = me(), el = $('role-tag'); if (!p) { el.className = ''; el.textContent = G && G.spec ? 'SPECTATING' : ''; return; }
  el.className = p.imp ? 'imp' : 'crew'; el.textContent = (p.imp ? 'IMPOSTER' : 'CREWMATE') + (p.alive ? '' : ' (GHOST)');
  if (p.imp) { const mates = G.players.filter(q => q.imp && q.id !== p.id).map(q => q.name); if (mates.length) { const s = document.createElement('small'); s.textContent = 'With: ' + mates.join(', '); el.appendChild(s); } }
}
function buildIntro() {
  const p = me(), role = $('in-role'), sub = $('in-sub'), team = $('in-team'); team.innerHTML = '';
  const nImp = G.players.filter(q => q.imp).length;
  if (!p) { role.className = 'crew'; role.textContent = 'SPECTATING'; sub.textContent = 'You joined during a match. You will play next round.'; }
  else if (p.imp) { role.className = 'imp'; role.textContent = 'IMPOSTER'; sub.textContent = nImp > 1 ? 'Kill the crew with your partner' + (nImp > 2 ? 's' : '') + '. Do not get caught.' : 'Kill the crew. Do not get caught.'; }
  else { role.className = 'crew'; role.textContent = 'CREWMATE'; sub.textContent = nImp + (nImp === 1 ? ' Imposter is' : ' Imposters are') + ' among us. Finish your tasks!'; }
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
  if (!EJ) return; EJ.t += dt; const cv = $('ejcv'), c = cv.getContext('2d'), W = cv.width, H = cv.height, t = EJ.t, m = EJ.m;
  c.fillStyle = '#02030a'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff';
  for (const s of EJ.stars) c.fillRect(((s[0] * W - t * 60 * s[2]) % W + W) % W, s[1] * H, s[2] * 2, s[2] * 2);
  if (m.who >= 0) { const p = G.players[m.who], k = clamp(t / 4.6, 0, 1), x = lerp(-80, W + 80, k), y = H * .55 + Math.sin(k * 6) * 30; c.save(); c.translate(x, y); c.rotate(t * 3); drawBean(c, 0, 30, p.color, 1, 0, { scale: 2.4 }); c.restore(); }
  const a = $('ej-t1'), b = $('ej-t2'); const s1 = m.t1.slice(0, Math.max(0, Math.floor((t - 1.2) * 28))), s2 = m.t2.slice(0, Math.max(0, Math.floor((t - 3.4) * 28)));
  if (a.textContent !== s1) a.textContent = s1; if (b.textContent !== s2) b.textContent = s2;
}
// ---- end screen ----
function buildEnd() {
  const o = G.over, p = me(), win = p ? (p.imp ? o.w === 'imp' : o.w === 'crew') : o.w === 'crew';
  const t = $('en-title'); t.className = p ? (win ? 'win' : 'lose') : 'win'; t.textContent = p ? (win ? 'VICTORY' : 'DEFEAT') : (o.w === 'crew' ? 'CREW WINS' : 'IMPOSTERS WIN');
  $('en-why').textContent = (o.w === 'crew' ? 'Crewmates win: ' : 'Imposters win: ') + o.why;
  const r = $('en-roster'); r.innerHTML = ''; for (const q of G.players) { const d = document.createElement('div'); d.className = q.imp ? 'imp' : ''; d.appendChild(mkIcon(q.color, 52, !q.alive)); d.appendChild(document.createTextNode(q.name + (q.imp ? ' (Imp)' : ''))); r.appendChild(d); }
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
  $('tbar-f').style.width = (G.taskTotal ? Math.min(100, G.taskDone / G.taskTotal * 100) : 0) + '%'; setTxt('tbar-t', 'TASKS ' + G.taskDone + ' / ' + G.taskTotal);
  // alert line
  let al = '', fl = false; if (S.reactor > 0) { al = 'REACTOR MELTDOWN ' + Math.ceil(S.reactor) + 's - hold both panels!'; fl = true; } else if (S.lights) { al = 'LIGHTS OUT - fix the panel in ' + MAP.lights.room; fl = true; }
  setTxt('alert', al); $('alert').classList.toggle('flash', fl); $('vign').classList.toggle('on', S.reactor > 0);
  // action buttons
  const touch = isTouch(); $('joy').classList.toggle('hidden', !touch);
  const spec = G.me < 0, imp = !!(p && p.imp), alive = !!(p && p.alive), u = usable(), inVent = !!(p && p.vent >= 0);
  const showB = (id, on) => $(id).classList.toggle('hidden', !on);
  showB('a-kill', imp && !spec); showB('a-sab', imp && alive && !spec); showB('a-vent', imp && alive && !spec); showB('a-rep', !spec && alive); showB('a-use', !spec); showB('b-map', !spec);
  showB('vent-nav', inVent); showB('spec-bar', spec);
  if (spec) { const tp = camTarget(); setTxt('sp-name', 'Spectating: ' + (tp ? tp.name : '-')); }
  if (p) {
    const canKill = imp && alive && p.kcd <= 0 && !inVent && ph === 'play' && nearestVictim(p);
    $('a-kill').classList.toggle('off', !canKill); $('a-kill').classList.toggle('ready', !!canKill); setTxt('a-kill-s', p.kcd > 0 ? Math.ceil(p.kcd) + 's' : 'Q');
    const canRep = alive && ph === 'play' && !!nearBody(p); $('a-rep').classList.toggle('off', !canRep); $('a-rep').classList.toggle('ready', canRep);
    $('a-use').classList.toggle('off', !u); $('a-use').classList.toggle('ready', !!u);
    $('a-sab').classList.toggle('off', S.cd > 0 || S.lights || S.reactor > 0); setTxt('a-sab-s', S.cd > 0 && !S.lights && S.reactor <= 0 ? Math.ceil(S.cd) + 's' : 'X');
    $('a-vent').classList.toggle('off', !inVent && !ventNear(p)); setTxt('a-vent-b', inVent ? 'EXIT' : 'VENT');
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
