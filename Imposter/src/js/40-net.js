// ==========================================
// NET: HGNet glue. Host simulates, guests send inputs and draw snapshots.
// ==========================================
const NET = { net: null, host: false, guest: false, code: '', specs: new Set(), stop: null, snapAcc: 0, lobby: null, name: '', busy: false, lastPosSend: 0 };
const LB = { set: Object.assign({}, DEFAULT_SET), players: [], hostName: '' };
let hgLoading = null;
function loadHG() {
  const have = getHG(); if (have) return Promise.resolve(have);
  if (hgLoading) return hgLoading;
  hgLoading = new Promise(res => {
    const s = document.createElement('script'); s.src = '../gv/vendor/hgnet.js';
    s.onload = () => res(getHG()); s.onerror = () => res(null); document.head.appendChild(s);
    setTimeout(() => res(getHG()), 6000);
  }).then(h => { if (!h) hgLoading = null; return h; });
  return hgLoading;
}
function netReset() {
  if (NET.stop) { try { NET.stop(); } catch (e) { } NET.stop = null; }
  if (NET.net) { try { NET.net.close(); } catch (e) { } }
  NET.net = null; NET.host = false; NET.guest = false; NET.code = ''; NET.specs = new Set(); NET.busy = false;
}
function lobbyPlayers() { // host view: me first, then connected guests
  const out = [{ net: 0, name: NET.name }];
  if (NET.net) for (const p of NET.net.peers()) if (!p.isHost && p.id !== 0 && p.state !== 'left') out.push({ net: p.id, name: cleanText(p.name, 12) || 'Player', lag: p.state !== 'connected' });
  return out;
}
function sendLobby(back) {
  if (!NET.host || !NET.net) return;
  LB.players = lobbyPlayers();
  NET.net.send('all', { t: 'lobby', set: LB.set, pl: LB.players.map(p => p.name), host: NET.name, back: back ? 1 : 0 });
  if (!G) renderLobby();
}
function hostRoom(onDone) {
  if (NET.busy) return; NET.busy = true; netReset(); NET.busy = true;
  loadHG().then(HG => {
    if (!HG) { NET.busy = false; return onDone(null, 'Multiplayer needs the launcher'); }
    const net = HG.create({ game: 'imposter' }); NET.net = net; NET.name = playerName();
    wireNet(net, true);
    net.host({ name: NET.name, maxPlayers: MAXP, accept: () => true }).then(r => { NET.host = true; NET.code = r.code; NET.busy = false; NET.every(); onDone(r.code); },
      err => { NET.busy = false; netReset(); onDone(null, err.message || 'Could not open a room'); });
  });
}
function joinRoom(code, onDone) {
  if (NET.busy) return; NET.busy = true; netReset(); NET.busy = true;
  loadHG().then(HG => {
    if (!HG) { NET.busy = false; return onDone(null, 'Multiplayer needs the launcher'); }
    const net = HG.create({ game: 'imposter' }); NET.net = net; NET.name = playerName();
    wireNet(net, false);
    net.join(code, { name: NET.name }).then(r => { NET.guest = true; NET.code = r.code || code; NET.busy = false; onDone(NET.code); },
      err => { NET.busy = false; netReset(); onDone(null, err.message || 'Could not join'); });
  });
}
NET.every = function () {
  if (NET.stop) NET.stop();
  NET.stop = every(50, dt => { if (G && !NET.guest) { const d = Math.min(.1, dt / 1000); hostTick(d); if (NET.host) netPump(d); } });
};
function wireNet(net, isHost) {
  net.on('status', t => { const e = $('l-status'); if (e) e.textContent = t; });
  net.on('join', peer => {
    if (!isHost || peer.isHost) return;
    if (G && G.phase !== 'over') { NET.specs.add(peer.id); if (peer.rejoin) { const p = G.players.find(q => q.net === peer.id); if (p) { NET.specs.delete(peer.id); NET.net.send(peer.id, startMsg(p.id)); return; } } NET.net.send(peer.id, startMsg(-1)); return; }
    sendLobby();
  });
  net.on('leave', (peer, why) => {
    if (!isHost) { if (G && peer.isHost) return; return; }
    NET.specs.delete(peer.id);
    if (G) { const p = G.players.find(q => q.net === peer.id && !q.bot); if (p) hostLeave(p.id); } else sendLobby();
  });
  net.on('message', (peer, m) => { if (!m || typeof m !== 'object') return; if (isHost) hostMsg(peer, m); else guestMsg(m); });
  net.on('reconnecting', peer => { if (!peer) netBar('Connection lost, reconnecting...'); });
  net.on('reconnected', peer => { if (!peer) netBar(''); if (isHost && peer && G) { const p = G.players.find(q => q.net === peer.id); if (p) net.send(peer.id, startMsg(p.id)); } });
  net.on('closed', (reason, text) => { netReset(); netBar(''); leaveToMenu(text || (reason === 'host-left' ? 'The host left the game.' : 'Disconnected.')); });
}
function netBar(t) { const b = $('netbar'); b.textContent = t; b.classList.toggle('hidden', !t); }
// ---- host: messages from guests ----
function hostMsg(peer, m) {
  if (!G) return;
  const p = G.players.find(q => q.net === peer.id && !q.bot && !q.left); if (!p) return;
  hostAct(p.id, m);
}
// ---- guest: messages from the host ----
function guestMsg(m) {
  if (m.t === 'lobby') {
    LB.set = m.set; LB.players = m.pl.map(n => ({ name: n })); LB.hostName = m.host;
    if (G && !m.back) return;
    if (G) { G = null; hideMatchUI(); } renderLobby(); showLobbyScreen(); return;
  }
  if (m.t === 's') return applySnap(m);
  onEvent(m);
}
function startMsg(slot) {
  const p = slot >= 0 ? G.players[slot] : null, imps = G.players.filter(q => q.imp).map(q => q.id);
  return { t: 'start', set: G.set, me: slot, pl: G.players.map(q => [q.name, q.color, q.bot ? 1 : 0, q.left ? 1 : 0]), imps: !p || p.imp ? imps : [], tasks: p ? p.tasks.map(t => t.sid) : [], tt: G.taskTotal,
    pos: G.players.map(q => [Math.round(q.x), Math.round(q.y)]) };
}
function buildFromStart(m) {
  buildMap(m.set.map); if (!MAP.img) bakeMap();
  G = { set: m.set, players: m.pl.map((e, i) => { const p = mkPlayer(i, e[0], e[1], !!e[2], -1); p.x = p.rx = m.pos[i][0]; p.y = p.ry = m.pos[i][1]; if (e[3]) { p.left = true; p.alive = false; p.ghost = true; } return p; }), me: m.me, bodies: [], phase: 'intro', t: INTRO_T, time: 0,
    taskDone: 0, taskTotal: m.tt, tick: 0, sab: { lights: false, reactor: 0, hold: [-1, -1], holdT: 0, cd: 0 }, meet: null, ej: null, over: null, spec: m.me < 0, specTarget: 0, snapped: false, mt: 0, kc: 0 };
  for (const i of m.imps) G.players[i].imp = true;
  if (m.me >= 0) G.players[m.me].tasks = m.tasks.map(sid => ({ sid, done: false }));
}
// ---- snapshots ----
function netPump(dt) {
  NET.snapAcc += dt; if (NET.snapAcc < 1 / 12) return; NET.snapAcc = 0;
  const net = NET.net; if (!net || !G) return;
  const rate = NET.host ? 1 : 0; if (!rate) return;
  net.send('all', makeSnap(), { fast: true });
  for (const p of G.players) p.corr = false;
}
function makeSnap() {
  const S = G.sab, m = G.meet;
  return { t: 's', ph: PHN.indexOf(G.phase), mt: r1(G.phase === 'meeting' && m ? m.t : G.t), ms: m ? (m.st === 'discuss' ? 0 : m.st === 'vote' ? 1 : 2) : -1,
    P: G.players.map(p => [Math.round(p.x), Math.round(p.y), (p.alive ? 1 : 0) | (p.vent >= 0 ? 2 : 0) | (p.walk ? 4 : 0) | (p.corr ? 8 : 0) | (p.face < 0 ? 16 : 0) | (p.left ? 32 : 0), p.vent]),
    B: G.bodies.map(b => [b.id, Math.round(b.x), Math.round(b.y)]), tb: [G.taskDone, G.taskTotal], sb: [S.lights ? 1 : 0, r1(S.reactor), S.hold[0] >= 0 ? 1 : 0, S.hold[1] >= 0 ? 1 : 0],
    kc: G.players.map(p => p.imp ? r1(p.kcd) : 0), em: G.players.map(p => p.em), sc: r1(S.cd) };
}
function applySnap(m) {
  if (!G || !m.P || m.P.length !== G.players.length) return;
  if (!G.snapped) { G.snapped = true; if (G.spec || G.phase === 'intro') { G.phase = PHN[m.ph] || G.phase; } }
  if (G.phase === 'intro' && m.ph === 1) { G.phase = 'play'; hideIntro(); }
  if (G.phase === 'over' || (m.ph === 4 && !G.over)) { /* the 'over' event ends the match */ }
  G.t = m.mt; if (G.meet) G.meet.t = m.mt;
  if (G.spec && G.phase !== PHN[m.ph] && m.ph !== 4) { G.phase = PHN[m.ph]; }
  m.P.forEach((e, i) => {
    const p = G.players[i], f = e[2]; p.alive = !!(f & 1); p.ghost = !p.alive; p.vent = f & 2 ? e[3] : -1; p.left = !!(f & 32);
    if (i === G.me && G.phase === 'play' && !(f & 8) && p.vent < 0 && dist(p.x, p.y, e[0], e[1]) < 140) { return; }
    p.x = e[0]; p.y = e[1]; p.walk = !!(f & 4); p.face = f & 16 ? -1 : 1;
    if (i === G.me && (f & 8 || p.vent >= 0 || G.phase !== 'play')) { p.rx = p.x; p.ry = p.y; }
  });
  const bodies = m.B.map(b => ({ id: b[0], x: b[1], y: b[2] })); if (G.phase === 'play' || G.phase === 'intro') G.bodies = bodies;
  G.taskDone = m.tb[0]; G.taskTotal = m.tb[1];
  const S = G.sab; S.lights = !!m.sb[0]; S.reactor = m.sb[1]; S.hold = [m.sb[2] ? 1 : -1, m.sb[3] ? 1 : -1]; S.cd = m.sc;
  G.players.forEach((p, i) => { p.kcd = m.kc[i]; p.em = m.em[i]; });
}
function netSendHost(m, fast) { if (NET.net && NET.guest) NET.net.send('host', m, fast ? { fast: true } : undefined); }
// every action the local player takes goes through here
function act(m) {
  if (!G || G.me < 0) return;
  if (NET.guest) netSendHost(m, m.t === 'pos'); else hostAct(G.me, m);
}
