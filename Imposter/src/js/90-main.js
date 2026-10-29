// ==========================================
// BOOT, INPUT, MAIN LOOP, DEBUG HOOK
// ==========================================
initRender(); bindMini(); bindHud(); bindMeeting(); bindMenus();
showScreen('s-title'); refreshTitle();
// a tiny animated background for the title is not needed; keep the canvas clear
R.c.fillStyle = '#05070f'; R.c.fillRect(0, 0, R.W, R.H);

addEventListener('keydown', e => {
  const tg = e.target; if (tg && /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') {
    if (MINI) closeMini(true); else if (!$('sabm').classList.contains('hidden') || !$('mapov').classList.contains('hidden')) { $('sabm').classList.add('hidden'); $('mapov').classList.add('hidden'); }
    else if (G && (G.phase === 'play' || G.phase === 'over')) { const p = $('s-pause'); p.classList.toggle('hidden'); $('p-vol').value = settings.vol; }
    else if (!G) { const cur = SCREENS.find(s => !$('s-title').classList.contains('hidden') ? false : !$(s).classList.contains('hidden')); if (cur && cur !== 's-lobby') showScreen('s-title'); }
    return;
  }
  if (!G) return;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat) { keys.add(k); return; }
  keys.add(k); const p = me();
  if (p && p.vent >= 0 && G.phase === 'play') { if (k === 'a' || k === 'arrowleft') return ventCycle(-1); if (k === 'd' || k === 'arrowright') return ventCycle(1); }
  if (k === 'e' || k === ' ') tryUse(); else if (k === 'q') doKill(); else if (k === 'r') doReport(); else if (k === 'v') doVent(); else if (k === 'x') openSab(); else if (k === 'm' || k === 'tab') { if (k === 'tab') e.preventDefault(); toggleMap(); }
  else if (G.me < 0 && (k === 'arrowright' || k === 'd')) G.specTarget++; else if (G.me < 0 && (k === 'arrowleft' || k === 'a')) G.specTarget--;
});
addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); });
addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', () => ac(), { once: true });
addEventListener('beforeunload', () => { if (NET.net) try { NET.net.close(); } catch (e) { } });

let lastT = performance.now(), blank = false;
function frame(now) {
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  if (G) {
    try { localMove(dt); sendPos(); miniLoop(dt); render(dt); updateHud(dt); } catch (err) { console.error(err); }
    blank = false;
  } else if (!blank) { blank = true; R.c.setTransform(1, 0, 0, 1, 0, 0); R.c.fillStyle = '#05070f'; R.c.fillRect(0, 0, R.W, R.H); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- debug hook for tests ----
function summary() {
  if (!G) return null;
  const P = G.players, alive = P.filter(p => p.alive && !p.left);
  return { phase: G.phase, time: Math.round(G.time), tasks: [G.taskDone, G.taskTotal], crew: alive.filter(p => !p.imp).length, imps: alive.filter(p => p.imp).length, bodies: G.bodies.length, over: G.over, me: G.me, sab: [G.sab.lights, Math.round(G.sab.reactor)] };
}
function simSteps(sec, dt) { dt = dt || .05; const n = Math.round(sec / dt); for (let i = 0; i < n && G && G.phase !== 'over'; i++) hostTick(dt); return summary(); }
window.__imposter = {
  get G() { return G; }, get MAP() { return MAP; }, get MINI() { return MINI; }, get R() { return R; }, COLORS, get MU() { return MU; }, NET, LB, stats, settings, MG, KINDS, MAPS,
  startOffline(set, auto) { if (set) Object.assign(settings.hostSet, set); startOffline(); if (auto !== false) setAuto(me(), true); return summary(); },
  summary, step: simSteps,
  runToEnd(maxSec) { // fast-forward to the end (the local player is autopiloted)
    const t0 = performance.now(); const stat = { meetings: 0, kills: 0 }; let lastPh = G.phase, n = 0, max = Math.round((maxSec || 3000) / .05);
    for (let i = 0; i < max && G && G.phase !== 'over'; i++) { hostTick(.05); if (G.phase === 'meeting' && lastPh !== 'meeting') stat.meetings++; lastPh = G.phase; n++; }
    return Object.assign(summary(), { steps: n, ms: Math.round(performance.now() - t0), meetings: stat.meetings, deaths: G.players.filter(p => !p.alive && !p.left).length });
  },
  auto(on) { setAuto(me(), on !== false); },
  act, hostAct, tryUse, usable, openMini, closeMini, miniLoop,
  tp(id, x, y) { const p = G.players[id]; p.x = p.rx = x; p.y = p.ry = y; },
  forceMeeting(caller, body) { startMeeting(G.players[caller || 0], body == null ? -1 : body); return summary(); },
  forceKill(killer, victim) { const k = G.players[killer], v = G.players[victim]; k.kcd = 0; k.x = v.x + 20; k.y = v.y; return hostKill(k); },
  forceVote(target) { // everybody alive votes for target (-1 = skip)
    for (const p of G.players) if (p.alive && !p.left && !(p.id in G.meet.votes)) hostVote(p, p.id === target ? -1 : target); return G.meet && G.meet.st;
  },
  toVote() { if (G.meet && G.meet.st === 'discuss') { G.meet.t = 0.01; } },
  endGame(w) { endGame(w, 'test'); },
  hostTick, bakeMap, buildMap, los, blocked, fieldTo, openMeeting, getHG,
  validateMap(key) {
    const M = buildMap(key), W = M.W, errs = [], f = fieldTo(Math.floor(M.d.spawn[0]), Math.floor(M.d.spawn[1]));
    const chk = (n, x, y) => { const tx = Math.floor(x / TS), ty = Math.floor(y / TS); if (!walkAt(tx, ty)) errs.push(n + ' not walkable ' + tx + ',' + ty); else if (f[ty * W + tx] < 0) errs.push(n + ' unreachable ' + tx + ',' + ty); };
    M.stations.forEach(s => chk('station' + s.id, s.x, s.y)); M.vents.forEach(v => chk('vent' + v.id, v.x, v.y)); M.spawns.forEach((s, i) => chk('spawn' + i, s[0], s[1]));
    chk('lights', M.lights.x, M.lights.y); M.reactor.forEach((r, i) => chk('reactor' + i, r.x, r.y));
    const bt = Math.floor((M.btn.y + 60) / TS); if (!walkAt(Math.floor(M.btn.x / TS), bt)) errs.push('button approach blocked');
    let open = 0, reach = 0; for (let i = 0; i < M.walk.length; i++) if (M.walk[i]) { open++; if (f[i] >= 0) reach++; } if (open !== reach) errs.push('unreachable floor tiles: ' + (open - reach));
    return { errs, open, reach };
  }
};
