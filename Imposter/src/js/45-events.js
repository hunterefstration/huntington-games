// ==========================================
// EVENTS: what every client does when something happens; match lifecycle
// ==========================================
const FX = [];                     // little visual puffs
function addFx(kind, x, y) { FX.push({ kind, x, y, t: 0 }); if (FX.length > 30) FX.shift(); }

function startOffline() {
  netReset(); hostStart([{ net: 0, name: playerName() }], settings.hostSet); NET.every(); enterMatch();
}
function lobbyStart() { // host presses Start
  if (!NET.host || G) return;
  const humans = lobbyPlayers(); hostStart(humans, LB.set);
  for (const p of G.players) if (!p.bot && p.net > 0) NET.net.send(p.net, startMsg(p.id));
  NET.specs.clear(); enterMatch();
}
function enterMatch() {
  hideScreens(); FX.length = 0; resetInput();
  document.getElementById('hud').classList.add('hidden'); buildIntro(); buildTaskList(); updateRoleTag();
  sfx.click();
}
function leaveToMenu(msg) {
  const was = NET.net; netReset(); if (was) { try { was.close(); } catch (e) { } }
  G = null; hideMatchUI(); showScreen('s-title'); refreshTitle(); if (msg) toast(msg, 3500);
}
function backToLobby() { // host after a match
  if (!NET.host) return;
  G = null; hideMatchUI(); NET.specs.clear(); sendLobby(true); showLobbyScreen();
}
function recordEnd(w) {
  if (!G || G.spec) return;
  const p = G.players[G.me]; if (!p) return;
  stats.games++; if (p.imp) { stats.impGames++; if (w === 'imp') stats.impWins++; } else { stats.crewGames++; if (w === 'crew') stats.crewWins++; }
  saveStats();
}
function onEvent(m) {
  const guest = NET.guest;
  if (m.t === 'start') { buildFromStart(m); enterMatch(); return; }
  if (!G) return;
  const P = G.players;
  switch (m.t) {
    case 'kill': {
      const v = P[m.v], k = P[m.k]; if (!v) break;
      if (guest) { v.alive = false; v.ghost = true; v.walk = false; G.bodies.push({ id: m.v, x: m.x, y: m.y }); if (k) { k.x = m.x; k.y = m.y; } }
      const mp = P[G.me]; if (mp && dist(mp.x, mp.y, m.x, m.y) < 420 || m.v === G.me || G.spec) sfx.kill();
      addFx('poof', m.x, m.y);
      if (m.v === G.me) { stats.deaths++; saveStats(); toast((k ? k.name : 'Someone') + ' killed you. You are a ghost now: finish your tasks!', 4000); $('vign').classList.add('on'); setTimeout(() => $('vign').classList.remove('on'), 1600); buildTaskList(); updateRoleTag(); }
      if (m.k === G.me) { stats.kills++; saveStats(); }
      break;
    }
    case 'td': {
      if (guest) { G.taskDone = m.n; if (m.p === G.me) { const t = P[G.me].tasks.find(q => q.sid === m.s); if (t) t.done = true; } }
      if (m.p === G.me) { stats.tasks++; saveStats(); sfx.task(); buildTaskList(); }
      break;
    }
    case 'meet': {
      if (guest) { G.phase = 'meeting'; G.bodies = []; for (const p of P) p.vent = -1; G.sab.reactor = 0; G.meet = { st: m.d > 0 ? 'discuss' : 'vote', t: m.d > 0 ? m.d : m.v, caller: m.c, body: m.b, votes: {}, res: null, mt: 0 }; }
      G.meet.voted = new Set(); G.meet.log = []; closeMini(); closeOverlays(); sfx.meeting(); if (m.c === G.me) { stats.meetings++; saveStats(); }
      openMeeting(m); break;
    }
    case 'mp': {
      if (!G.meet) break;
      if (m.st === 'vote') { if (guest) { G.meet.st = 'vote'; G.meet.t = G.set.vote; } meetUpdate(); }
      else if (m.st === 'result') { if (guest) { G.meet.st = 'result'; G.meet.votes = m.votes; G.meet.res = { ej: m.ej, why: m.why }; G.meet.t = RESULT_T; } meetUpdate(); }
      break;
    }
    case 'voted': if (G.meet) { G.meet.voted.add(m.p); sfx.vote(); meetUpdate(); } break;
    case 'chat': if (G.meet) { chatLine(m); sfx.chat(); } break;
    case 'ej': {
      if (guest) { G.phase = 'eject'; G.t = EJECT_T; }
      G.ej = m; closeMeeting(); buildEject(m); break;
    }
    case 'res': {
      if (guest) { if (m.who >= 0 && P[m.who]) { P[m.who].alive = false; P[m.who].ghost = true; } G.meet = null; G.phase = 'play'; P.forEach((p, i) => { p.x = p.rx = m.pos[i][0]; p.y = p.ry = m.pos[i][1]; p.vent = -1; }); }
      G.ej = null; buildTaskList(); updateRoleTag(); break;
    }
    case 'sab': {
      if (guest) { if (m.k === 'lights') G.sab.lights = !!m.on; else G.sab.reactor = m.on ? REACTOR_T : 0; }
      if (m.on) { sfx.sab(); toast(m.k === 'lights' ? 'Lights are out! Fix them at the Electrical panel.' : 'REACTOR MELTDOWN! Two players must hold the panels.', 3500); }
      else { sfx.ok(); toast(m.k === 'lights' ? 'Lights are back on' : 'Reactor stable'); closeMini(); }
      break;
    }
    case 'vfx': { addFx('vent', m.x, m.y); const mp = P[G.me]; if (G.spec || (mp && dist(mp.x, mp.y, m.x, m.y) < 380)) sfx.vent(); break; }
    case 'over': {
      if (guest) { G.phase = 'over'; G.over = { w: m.w, why: m.why, imps: m.imps }; for (const i of m.imps) P[i].imp = true; }
      closeMini(); closeOverlays(); recordEnd(m.w); G.overAt = performance.now(); break;
    }
    case 'left': {
      const p = P[m.p]; if (!p) break;
      if (guest) { p.left = true; p.alive = false; p.ghost = true; G.taskTotal = m.tt; G.taskDone = m.td; }
      toast(p.name + ' left the game'); if (G.meet) meetUpdate(); break;
    }
  }
}
