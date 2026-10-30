// ==========================================
// SIM: the authoritative match (runs on the host / offline). Guests only mirror it.
// ==========================================
let G = null;                       // current match, null in menus
const PHN = ['intro', 'play', 'meeting', 'eject', 'over'];
const INTRO_T = 4.2, EJECT_T = 6, RESULT_T = 5, REACTOR_T = 42;
const me = () => G && G.players[G.me];
const humansAlive = () => G.players.filter(p => !p.bot && !p.left).length;

function mkPlayer(i, name, color, bot, net) {
  return { id: i, name, color, bot, net, x: 0, y: 0, rx: 0, ry: 0, face: 1, ph: 0, walk: false, alive: true, ghost: false, imp: false, vent: -1, left: false,
    kcd: 0, em: 0, tasks: [], busy: 0, corr: false, budget: 60, lastMove: 0, ts: null, ai: null, chatT: 0, auto: false, lag: false };
}
// humans: [{net, name}] (host first). Fills up to MAXP with bots.
function hostStart(humans, set, opts) {
  opts = opts || {};
  const s = Object.assign({}, DEFAULT_SET, set);
  s.imps = clamp(s.imps | 0, 1, 3); s.kcd = clamp(+s.kcd || 25, 10, 60); s.speed = clamp(+s.speed || 1, .6, 1.6); s.tasks = clamp(s.tasks | 0, 1, 8);
  s.disc = clamp(s.disc | 0, 0, 60); s.vote = clamp(s.vote | 0, 10, 120); if (!MAPS[s.map]) s.map = 'ship';
  buildMap(s.map); if (!MAP.img) bakeMap();
  const cols = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]), used = new Set(), names = shuffle(BOT_NAMES.slice()), players = [];
  const uname = n => { n = cleanText(n, 12) || 'Player'; let b = n, i = 2; while (used.has(n.toLowerCase())) n = b.slice(0, 10) + i++; used.add(n.toLowerCase()); return n; };
  humans.slice(0, MAXP).forEach(h => players.push(mkPlayer(players.length, uname(h.name), cols[players.length], false, h.net)));
  humans.slice(0, MAXP).forEach(h => used.add(String(h.name).toLowerCase()));
  while (players.length < MAXP) { let n = names.pop() || 'Bot' + players.length; while (used.has(n.toLowerCase())) n += 'x'; used.add(n.toLowerCase()); players.push(mkPlayer(players.length, n, cols[players.length], true, -1)); }
  const impIds = shuffle(players.map(p => p.id)).slice(0, Math.min(s.imps, 3));
  impIds.forEach(i => { players[i].imp = true; });
  const stIds = MAP.stations.map(t => t.id);
  let total = 0;
  for (const p of players) {
    p.tasks = shuffle(stIds.slice()).slice(0, s.tasks).map(sid => ({ sid, done: false }));
    if (!p.imp) total += p.tasks.length;
  }
  G = { set: s, players, me: 0, bodies: [], phase: 'intro', t: INTRO_T, time: 0, taskDone: 0, taskTotal: total, tick: 0,
    sab: { lights: false, reactor: 0, hold: [-1, -1], holdT: 0, cd: 25 }, meet: null, ej: null, over: null, spec: false, specTarget: 0, sent: 0 };
  placeAtSpawns();
  for (const p of players) botInit(p);
  if (opts.onlyLocal) G.me = 0;
  return G;
}
function placeAtSpawns() {
  const sp = shuffle(MAP.spawns.slice());
  G.players.forEach((p, i) => { p.x = p.rx = sp[i % sp.length][0]; p.y = p.ry = sp[i % sp.length][1]; p.vent = -1; p.busy = 0; p.walk = false; p.corr = true; });
}
// ---- messages to everybody (and to myself, when I host) ----
// filter(player|null): who may see it. Spectators count as ghosts.
function emit(m, filter) {
  if (NET.host && NET.net) {
    const ids = [];
    for (const p of G.players) if (!p.bot && !p.left && p.net > 0 && (!filter || filter(p))) ids.push(p.net);
    for (const id of NET.specs) if (!filter || filter(null)) ids.push(id);
    if (ids.length) NET.net.send(ids, m);
  }
  const lp = G && G.players[G.me];
  if (!filter || filter(lp || null)) onEvent(m);
}
function emitTo(slot, m) {
  const p = G.players[slot]; if (!p || p.bot) return;
  if (slot === G.me) onEvent(m); else if (NET.net && p.net > 0) NET.net.send(p.net, m);
}
const ghostsOnly = p => !p || !p.alive;

// ---- entry point for every player action (guests send these over the net) ----
function hostAct(slot, m) {
  if (!G || G.over && m.t !== 'chat') return;
  const p = G.players[slot]; if (!p || p.left) return;
  switch (m.t) {
    case 'pos': hostMove(p, m); break;
    case 'kill': hostKill(p); break;
    case 'rep': hostReport(p); break;
    case 'meet': hostEmergency(p); break;
    case 'ts': p.ts = { sid: m.sid | 0, at: performance.now() }; break;
    case 'td': hostTaskDone(p, m.sid | 0, false); break;
    case 'vent': hostVent(p, m); break;
    case 'sab': hostSabotage(p, m.k); break;
    case 'hold': hostHold(p, m.st | 0, !!m.on); break;
    case 'fixl': hostFixLights(p); break;
    case 'chat': hostChat(p, m.m); break;
    case 'vote': hostVote(p, m.v | 0); break;
  }
}
function hostMove(p, m) {
  if (G.phase !== 'play' || p.vent >= 0 || p.bot || p.auto) return;
  const now = performance.now(), dt = p.lastMove ? clamp((now - p.lastMove) / 1000, 0, 0.6) : 0.05; p.lastMove = now;
  const sp = BASE_SPEED * G.set.speed;
  p.budget = Math.min(130, p.budget + sp * dt * 1.2);
  let x = +m.x, y = +m.y; if (!isFinite(x) || !isFinite(y)) return;
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
  if (d > p.budget + 8) { const k = Math.max(0, p.budget) / d; x = p.x + dx * k; y = p.y + dy * k; p.corr = true; p.budget = 0; }
  else p.budget = Math.max(0, p.budget - d);
  x = clamp(x, 8, MAP.pw - 8); y = clamp(y, 8, MAP.ph - 8);
  if (!p.ghost && blocked(x, y, PR - 1)) { p.corr = true; return; }
  p.x = x; p.y = y; p.face = m.f < 0 ? -1 : 1; p.walk = !!m.w;
}
// ---- kills / bodies / reports ----
function nearestVictim(k) {
  let best = null, bd = KILL_RANGE + 12;
  for (const t of G.players) { if (t.imp || !t.alive || t.left || t.vent >= 0) continue; const d = dist(k.x, k.y, t.x, t.y); if (d < bd) { bd = d; best = t; } }
  return best;
}
function hostKill(k) {
  if (G.phase !== 'play' || !k.imp || !k.alive || k.vent >= 0 || k.kcd > 0) return false;
  const t = nearestVictim(k); if (!t) return false;
  t.alive = false; t.ghost = true; t.walk = false; t.vent = -1;
  G.bodies.push({ id: t.id, x: t.x, y: t.y });
  k.x = t.x; k.y = t.y; k.corr = true; k.kcd = G.set.kcd;
  const vr = G.sab.lights ? VIS_DARK : VIS_CREW;
  for (const w of G.players) if (w.ai && w.alive && !w.imp && w.id !== t.id && dist(w.x, w.y, t.x, t.y) <= vr + 40 && los(w.x, w.y, t.x, t.y)) aiSawKill(w, k, t);
  emit({ t: 'kill', k: k.id, v: t.id, x: Math.round(t.x), y: Math.round(t.y) });
  checkWin(); return true;
}
function hostReport(p) {
  if (G.phase !== 'play' || !p.alive || p.vent >= 0) return false;
  let b = null, bd = REPORT_RANGE;
  for (const o of G.bodies) { const d = dist(p.x, p.y, o.x, o.y); if (d < bd && los(p.x, p.y, o.x, o.y)) { bd = d; b = o; } }
  if (!b) return false;
  startMeeting(p, b.id); return true;
}
function hostEmergency(p) {
  if (G.phase !== 'play' || !p.alive || p.vent >= 0 || p.em >= G.set.meet || G.sab.reactor > 0) return false;
  if (dist(p.x, p.y, MAP.btn.x, MAP.btn.y) > BTN_RANGE + 14) return false;
  p.em++; startMeeting(p, -1); return true;
}
// ---- tasks ----
function hostTaskDone(p, sid, force) {
  const t = p.tasks.find(q => q.sid === sid && !q.done); if (!t) return false;
  if (!force) {
    const st = MAP.stations[sid]; if (!st || dist(p.x, p.y, st.x, st.y) > 140) return false;
    if (!p.ts || p.ts.sid !== sid || performance.now() - p.ts.at < 700) return false;
  }
  p.ts = null; t.done = true;
  if (p.imp) return true;
  G.taskDone++;
  emit({ t: 'td', p: p.id, s: sid, n: G.taskDone });
  for (const w of G.players) if (w.ai && w.alive && w.id !== p.id && dist(w.x, w.y, p.x, p.y) < VIS_CREW && los(w.x, w.y, p.x, p.y)) aiSawTask(w, p);
  checkWin(); return true;
}
// ---- vents ----
function hostVent(p, m) {
  if (G.phase !== 'play' || !p.imp || !p.alive) return false;
  const V = MAP.vents;
  if (m.a === 'in' && p.vent < 0) {
    let best = null, bd = USE_RANGE + 18; for (const v of V) { const d = dist(p.x, p.y, v.x, v.y); if (d < bd) { bd = d; best = v; } }
    if (!best) return false;
    ventFx(p, best, false); p.vent = best.id; p.x = best.x; p.y = best.y; p.corr = true; p.walk = false; return true;
  }
  if (m.a === 'out' && p.vent >= 0) { const v = V[p.vent]; p.vent = -1; p.corr = true; ventFx(p, v, true); return true; }
  if (m.a === 'go' && p.vent >= 0) {
    const cur = V[p.vent], nx = V[m.v | 0]; if (!nx || nx.g !== cur.g || nx.id === cur.id) return false;
    p.vent = nx.id; p.x = nx.x; p.y = nx.y; p.corr = true; return true;
  }
  return false;
}
function ventFx(p, v, out) {
  for (const w of G.players) if (w.ai && w.alive && !w.imp && dist(w.x, w.y, v.x, v.y) <= VIS_CREW && los(w.x, w.y, v.x, v.y)) aiSawVent(w, p);
  emit({ t: 'vfx', p: p.id, x: v.x, y: v.y, o: out ? 1 : 0 });
}
// ---- sabotage ----
function hostSabotage(p, k) {
  const S = G.sab; if (G.phase !== 'play' || !p.imp || !p.alive || S.cd > 0 || S.lights || S.reactor > 0) return false;
  if (k === 'lights') S.lights = true; else if (k === 'reactor') { S.reactor = REACTOR_T; S.hold = [-1, -1]; S.holdT = 0; } else return false;
  S.cd = 30; emit({ t: 'sab', k, on: 1 }); aiSabotaged(k); return true;
}
function hostFixLights(p) {
  if (!G.sab.lights || !p.alive || p.imp || dist(p.x, p.y, MAP.lights.x, MAP.lights.y) > 120) return false;
  G.sab.lights = false; G.sab.cd = Math.max(G.sab.cd, 25); emit({ t: 'sab', k: 'lights', on: 0 }); return true;
}
function hostHold(p, st, on) {
  const S = G.sab; if (S.reactor <= 0 || st < 0 || st > 1) return false;
  if (on) { if (!p.alive || p.imp || dist(p.x, p.y, MAP.reactor[st].x, MAP.reactor[st].y) > 120) return false; if (S.hold[st] < 0 || S.hold[st] === p.id) S.hold[st] = p.id; }
  else if (S.hold[st] === p.id) S.hold[st] = -1;
  return true;
}
function sabTick(dt) {
  const S = G.sab; if (S.cd > 0 && !S.lights && S.reactor <= 0) S.cd -= dt;
  if (S.reactor > 0) {
    for (let i = 0; i < 2; i++) { const h = S.hold[i] >= 0 && G.players[S.hold[i]]; if (h && (!h.alive || h.left || dist(h.x, h.y, MAP.reactor[i].x, MAP.reactor[i].y) > 130)) S.hold[i] = -1; }
    if (S.hold[0] >= 0 && S.hold[1] >= 0) { S.holdT += dt; if (S.holdT >= .7) { S.reactor = 0; S.hold = [-1, -1]; S.holdT = 0; S.cd = Math.max(S.cd, 25); emit({ t: 'sab', k: 'reactor', on: 0 }); return; } } else S.holdT = 0;
    S.reactor -= dt; if (S.reactor <= 0) { S.reactor = 0; endGame('imp', 'The boiler burst and the lamp went dark'); }
  }
}
// ---- the tick ----
function hostTick(dt) {
  if (!G || G.phase === 'over') return;
  G.tick++;
  if (G.phase === 'intro') { G.t -= dt; if (G.t <= 0) { G.phase = 'play'; for (const p of G.players) if (p.imp) p.kcd = 10; } }
  else if (G.phase === 'play') {
    G.time += dt;
    for (const p of G.players) { if (p.kcd > 0) p.kcd = Math.max(0, p.kcd - dt); if (p.busy > 0) p.busy -= dt; }
    for (const p of G.players) if (!p.left && (p.bot || p.auto)) botTick(p, dt);
    sabTick(dt);
  } else if (G.phase === 'meeting') meetTick(dt);
  else if (G.phase === 'eject') { G.t -= dt; if (G.t <= 0) endEject(); }
}
// ---- meetings ----
function startMeeting(caller, bodyId) {
  const bp = G.bodies.find(b => b.id === bodyId);
  G.phase = 'meeting'; G.bodies = [];
  for (const p of G.players) { if (p.vent >= 0) { const v = MAP.vents[p.vent]; p.x = v.x; p.y = v.y; p.vent = -1; } p.busy = 0; p.walk = false; p.ts = null; }
  const S = G.sab; S.reactor = 0; S.hold = [-1, -1]; S.holdT = 0; S.cd = Math.max(S.cd, 20);
  G.meet = { st: G.set.disc > 0 ? 'discuss' : 'vote', t: G.set.disc > 0 ? G.set.disc : G.set.vote, caller: caller.id, body: bodyId, bpos: bp ? { x: bp.x, y: bp.y } : null, votes: {}, res: null, mt: 0 };
  for (const p of G.players) if (p.ai) botMeetInit(p, caller, bodyId);
  emit({ t: 'meet', c: caller.id, b: bodyId, d: G.set.disc, v: G.set.vote });
}
function meetTick(dt) {
  const m = G.meet; m.t -= dt;
  m.mt += dt; for (const p of G.players) if (p.ai && !p.left && p.alive) botMeetTick(p, dt);
  if (m.st === 'discuss') { if (m.t <= 0) { m.st = 'vote'; m.t = G.set.vote; emit({ t: 'mp', st: 'vote' }); } }
  else if (m.st === 'vote') {
    const voters = G.players.filter(p => p.alive && !p.left);
    if (m.t <= 0 || voters.every(p => p.id in m.votes)) tally();
  } else if (m.st === 'result') { if (m.t <= 0) startEject(); }
}
function hostVote(p, v) {
  const m = G.meet; if (G.phase !== 'meeting' || m.st !== 'vote' || !p.alive || p.id in m.votes) return false;
  if (v >= 0) { const t = G.players[v]; if (!t || !t.alive || t.left || v === p.id) v = -1; } else v = -1;
  m.votes[p.id] = v; emit({ t: 'voted', p: p.id }); return true;
}
function tally() {
  const m = G.meet, counts = {}; let skip = 0;
  for (const k in m.votes) { const v = m.votes[k]; if (v < 0) skip++; else counts[v] = (counts[v] || 0) + 1; }
  let top = 0, who = [], ej = -1, why = 'skip';
  for (const k in counts) { if (counts[k] > top) { top = counts[k]; who = [+k]; } else if (counts[k] === top) who.push(+k); }
  if (top === 0 || skip > top) why = 'skip'; else if (who.length > 1 || skip === top) why = 'tie'; else { ej = who[0]; why = 'ej'; }
  m.res = { ej, why }; m.st = 'result'; m.t = RESULT_T;
  emit({ t: 'mp', st: 'result', votes: m.votes, ej, why });
}
function startEject() {
  const m = G.meet, { ej, why } = m.res; let t1, t2 = '', imp = false;
  const impsLeft = G.players.filter(p => p.imp && p.alive && !p.left).length;
  if (ej >= 0) {
    const p = G.players[ej]; imp = p.imp;
    if (G.set.confirm) { t1 = p.name + (p.imp ? ' was a Shade.' : ' was a Keeper, not a Shade.'); const left = impsLeft - (p.imp ? 1 : 0); t2 = left + (left === 1 ? ' Shade still lurks.' : ' Shades still lurk.'); }
    else t1 = p.name + ' was cast into the fog.';
  } else t1 = why === 'tie' ? 'No one was cast out. (Tie)' : 'No one was cast out. (Skipped)';
  G.phase = 'eject'; G.t = EJECT_T;
  emit({ t: 'ej', who: ej, t1, t2, imp: imp ? 1 : 0 });
}
function endEject() {
  const ej = G.meet.res.ej; if (ej >= 0) { const p = G.players[ej]; p.alive = false; p.ghost = true; }
  G.meet = null;
  if (checkWin()) return;
  G.phase = 'play'; placeAtSpawns();
  for (const p of G.players) { if (p.imp) p.kcd = Math.max(10, G.set.kcd); if (p.ai) botResume(p); }
  emit({ t: 'res', pos: G.players.map(p => [Math.round(p.x), Math.round(p.y)]), who: ej });
}
function hostChat(p, text) {
  if (G.phase !== 'meeting' || !G.meet || G.meet.st === 'result') return;
  const now = performance.now(); if (now - p.chatT < 700) return; p.chatT = now;
  text = cleanText(text, 80); if (!text) return;
  postChat(p, text);
}
function postChat(p, text) {
  const g = !p.alive;
  emit({ t: 'chat', p: p.id, m: text, g: g ? 1 : 0 }, g ? ghostsOnly : null);
  if (!g) for (const b of G.players) if (b.ai && b.alive && b.id !== p.id) aiHear(b, p, text);
}
// ---- win / leave ----
function checkWin() {
  if (!G || G.over) return !!G && !!G.over;
  const P = G.players.filter(p => p.alive && !p.left), I = P.filter(p => p.imp).length, C = P.length - I;
  if (I === 0) { endGame('crew', 'Every Shade was cast out of the lighthouse'); return true; }
  if (I >= C) { endGame('imp', 'The Shades outnumber the Keepers'); return true; }
  if (G.taskTotal > 0 && G.taskDone >= G.taskTotal) { endGame('crew', 'Every chore was done and the lamp burns bright'); return true; }
  return false;
}
function endGame(w, why) {
  if (!G || G.over) return;
  G.phase = 'over'; G.over = { w, why, imps: G.players.filter(p => p.imp).map(p => p.id) };
  G.sab.lights = false; G.sab.reactor = 0;
  emit({ t: 'over', w, why, imps: G.over.imps });
}
function hostLeave(slot) {
  const p = G && G.players[slot]; if (!p || p.left) return;
  p.left = true; const was = p.alive; p.alive = false; p.ghost = true; p.vent = -1;
  if (!p.imp) { G.taskTotal -= p.tasks.length; G.taskDone -= p.tasks.filter(t => t.done).length; }
  emit({ t: 'left', p: slot, tt: G.taskTotal, td: G.taskDone });
  if (G.meet && G.phase === 'meeting') { delete G.meet.votes[slot]; }
  checkWin();
}
