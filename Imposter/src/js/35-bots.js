// ==========================================
// BOTS: wander to tasks, kill when alone, report, vote on suspicion
// ==========================================
const isBot = p => !!p.ai;
function botInit(p) {
  if (!p.bot && !p.auto) { p.ai = null; return; }
  p.ai = { clock: rnd(0, 5), mode: 'idle', t: rnd(.5, 4), goal: null, field: null, fkey: -1, work: 0, wsid: -1, sus: {}, seen: {}, vis: [], per: rnd(0, .3), known: new Set(),
    dil: rnd(.7, 1.1), firstKill: rnd(28, 50) * (1 + .5 * (G.set.imps - 1)), coolWait: 0, iq: rnd(.45, 1), nz: {}, stuck: 0, lx: 0, ly: 0, ready: 0, target: null, tLost: 0, resp: null, respT: 0, sabT: rnd(35, 80), ventPlan: null, selfRep: 0, evalT: 0, refield: 0,
    mt: 0, voteAt: 0, chat: [], said: 0, defended: false, sawKill: -1, sawVent: -1, myKills: new Set(), lastRoom: '', quiet: Math.random() < .35 };
}
function setAuto(p, on) { p.auto = !!on; if (on && !p.ai) botInit(p); else if (!on && !p.bot) p.ai = null; }
const speedMult = p => p.ghost ? 1.1 : p.imp ? 1 : .86;

function goalPoint(p, a, g) { return g.b ? [g.b.x, g.b.y] : [g.x, g.y]; }
function setGoal(p, g) {
  const a = p.ai; a.goal = g; a.mode = 'goto'; a.stuck = 0; a.refield = 0;
  const pt = goalPoint(p, a, g); a.field = fieldTo(Math.floor(pt[0] / TS), Math.floor(pt[1] / TS));
}
function botMove(p, a, tx, ty, dt, mult) {
  const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy); if (d < 1) return;
  const sp = BASE_SPEED * G.set.speed * mult * dt, k = Math.min(1, sp / d), ox = p.x, oy = p.y;
  moveBy(p, dx * k, dy * k);
  if (Math.abs(p.x - ox) > .2) p.face = p.x > ox ? 1 : -1;
  p.walk = true;
}
function walkGoal(p, a, dt, mult) { // returns true on arrival
  const g = a.goal, pt = goalPoint(p, a, g), d = dist(p.x, p.y, pt[0], pt[1]);
  if (d <= (g.r || 30)) return true;
  const nx = stepFrom(a.field, p.x, p.y);
  if (nx && d > TS * 1.2) botMove(p, a, nx[0], nx[1], dt, mult); else botMove(p, a, pt[0], pt[1], dt, mult);
  a.stuck += dt; if (a.stuck > .8) { // moved?
    if (dist(p.x, p.y, a.lx, a.ly) < 8) { a.refield++; p.x += rnd(-3, 3); p.y += rnd(-3, 3); if (a.refield > 3) { a.mode = 'idle'; a.t = .3; a.goal = null; } else a.field = fieldTo(Math.floor(pt[0] / TS), Math.floor(pt[1] / TS)); }
    a.lx = p.x; a.ly = p.y; a.stuck = 0;
  }
  return false;
}
function visRange(p) { return (p.imp ? VIS_IMP : (G.sab.lights ? VIS_DARK : VIS_CREW)) * .95; }
function perceive(p, a) {
  const R = visRange(p); a.vis = [];
  for (const q of G.players) {
    if (q.id === p.id || !q.alive || q.vent >= 0 || q.left) continue;
    if (dist(p.x, p.y, q.x, q.y) <= R && los(p.x, p.y, q.x, q.y)) { a.vis.push(q); a.seen[q.id] = { x: q.x, y: q.y, t: G.time }; }
  }
  a.lastRoom = roomAt(p.x, p.y);
  for (const b of G.bodies) if (!a.known.has(b.id) && dist(p.x, p.y, b.x, b.y) <= R && los(p.x, p.y, b.x, b.y)) botSawBody(p, a, b);
}
function botSawBody(p, a, b) {
  a.known.add(b.id);
  for (const id in a.seen) { const s = a.seen[id]; if (+id === b.id || +id === p.id) continue; if (G.time - s.t < 12 && dist(s.x, s.y, b.x, b.y) < 300) a.sus[id] = (a.sus[id] || 0) + (G.time - s.t < 3 ? 40 : 18); }
  for (const q of a.vis) if (dist(q.x, q.y, b.x, b.y) < 160) a.sus[q.id] = (a.sus[q.id] || 0) + 20;
  if (a.myKills.has(b.id)) return;
  if (!p.alive) return;
  if (!p.imp || Math.random() < .4) if (Math.random() < .93) { a.resp = null; setGoal(p, { kind: 'body', b, r: 62 }); }
}
function aiSawKill(w, killer) { const a = w.ai; a.sus[killer.id] = 1000; a.sawKill = killer.id; }
function aiSawVent(w, p) { const a = w.ai; if (p.imp && isBot(w) && w.imp) return; a.sus[p.id] = (a.sus[p.id] || 0) + 700; a.sawVent = p.id; if (!w.imp && G.phase === 'play' && Math.random() < .5) setGoal(w, { kind: 'button', x: MAP.btn.x, y: MAP.btn.y + 30, r: 70 }); }
function aiSawTask(w, p) { const a = w.ai; if ((a.sus[p.id] || 0) < 500) a.sus[p.id] = -300; }
function aiSabotaged(k) {
  const crew = G.players.filter(p => p.ai && p.alive && !p.imp && !p.left && p.vent < 0);
  const pts = k === 'lights' ? [MAP.lights] : MAP.reactor, used = new Set();
  pts.forEach((pt, i) => {
    let best = null, bd = 1e9; for (const p of crew) { if (used.has(p.id)) continue; const d = dist(p.x, p.y, pt.x, pt.y); if (d < bd) { bd = d; best = p; } }
    if (best) { used.add(best.id); best.ai.resp = { k, st: i, pt }; best.ai.respT = rnd(.8, 3); best.ai.mode = 'idle'; best.ai.goal = null; }
  });
}
function aiHear(b, from, text) {
  const a = b.ai, low = text.toLowerCase(), key = /(sus|vent|saw|kill|imposter|impostor|it was|voted|did it|fake)/.test(low), safe = /(safe|cleared|not me|innocent)/.test(low);
  if (!key && !safe) return;
  for (const q of G.players) {
    if (q.id === b.id || q.id === from.id || !q.alive || q.left) continue;
    if (low.includes(q.name.toLowerCase())) { if (key) a.sus[q.id] = (a.sus[q.id] || 0) + (from.imp && from.bot ? 18 : 30); if (safe) a.sus[q.id] = (a.sus[q.id] || 0) - 15; }
  }
  if (low.includes(b.name.toLowerCase()) && key && !a.defended && Math.random() < .6) { a.defended = true; a.chat.push({ at: a.mt + rnd(1, 2.5), m: pick(['Not me!', 'It was not me, I swear', 'Why me?? I was doing tasks', 'That is not true!']) }); }
}

// ---- per-tick brain ----
function botTick(p, dt) {
  const a = p.ai; if (!a || G.phase !== 'play') return;
  a.clock += dt; p.walk = false;
  if (p.alive && p.vent < 0) { a.per -= dt; if (a.per <= 0) { a.per = .22; perceive(p, a); } }
  if (p.vent >= 0) { a.t -= dt; if (a.t <= 0) ventStep(p, a); return; }
  if (p.imp && p.alive) impTick(p, a, dt);
  if (a.resp) { if (respTick(p, a, dt)) return; }
  if (a.mode === 'idle') {
    a.t -= dt; if (a.t <= 0) chooseGoal(p, a);
  } else if (a.mode === 'goto') {
    const g = a.goal; if (!g) { a.mode = 'idle'; return; }
    if (g.kind === 'hunt') { a.evalT -= dt; if (a.evalT <= 0) { a.evalT = .3; const t = a.target; if (!t || !t.alive) { a.mode = 'idle'; a.t = .5; return; } g.x = t.x; g.y = t.y; a.field = fieldTo(Math.floor(t.x / TS), Math.floor(t.y / TS)); } }
    if (walkGoal(p, a, dt, g.kind === 'hunt' || g.kind === 'flee' ? 1.05 : speedMult(p))) arrive(p, a, g);
  } else if (a.mode === 'work') {
    a.work -= dt; if (a.work <= 0) finishWork(p, a);
  } else if (a.mode === 'wait') { a.t -= dt; if (a.t <= 0) { if (a.selfRep && a.goal) { a.selfRep = 0; setGoal(p, a.goal); } else { a.mode = 'idle'; a.t = .2; } } }
}
function chooseGoal(p, a) {
  const rem = p.tasks.filter(t => !t.done);
  if (p.imp && p.alive) { // fake tasks, but head toward where crew work when the knife is ready
    if (p.kcd < 6 && Math.random() < .6) {
      const crew = shuffle(G.players.filter(q => !q.imp && q.alive && !q.left)); const q = crew[0];
      if (q) { const t = q.tasks.filter(x => !x.done); if (t.length) { const st = MAP.stations[pick(t).sid]; return setGoal(p, { kind: 'task', sid: st.id, x: st.x, y: st.y, r: 34, fake: 1 }); } }
    }
    const st = pick(MAP.stations); return setGoal(p, { kind: 'task', sid: st.id, x: st.x, y: st.y, r: 34, fake: 1 });
  }
  if (rem.length && (Math.random() < .94 || !p.alive)) {
    const sorted = rem.slice().sort((x, y) => pathDist(fieldTo(MAP.stations[x.sid].tx, MAP.stations[x.sid].ty), p.x, p.y) - pathDist(fieldTo(MAP.stations[y.sid].tx, MAP.stations[y.sid].ty), p.x, p.y));
    const t = Math.random() < .3 ? pick(rem) : sorted[0], st = MAP.stations[t.sid];
    return setGoal(p, { kind: 'task', sid: st.id, x: st.x, y: st.y, r: 34 });
  }
  const st = pick(MAP.stations); setGoal(p, { kind: 'wander', x: st.x + rnd(-40, 40), y: st.y + 40, r: 50 });
}
function arrive(p, a, g) {
  if (g.kind === 'task') { const k = KINDS[MAP.stations[g.sid].kind]; a.mode = 'work'; a.work = k.dur * rnd(2.2, 3.6) / a.dil * (g.fake ? .7 : 1); a.wsid = g.sid; p.face = rnd(0, 1) < .5 ? 1 : -1; }
  else if (g.kind === 'body') {
    if (G.phase === 'play' && p.alive && los(p.x, p.y, g.b.x, g.b.y)) { if (hostReport(p)) return; }
    a.mode = 'idle'; a.t = 1;
  } else if (g.kind === 'button') { if (hostEmergency(p)) return; a.mode = 'idle'; a.t = 1; }
  else if (g.kind === 'hunt') { a.mode = 'idle'; a.t = .1; }
  else if (g.kind === 'vent') { if (hostVent(p, { a: 'in' })) { a.t = rnd(1.2, 3); a.ventPlan = { hops: rint(0, 2) }; } else { a.mode = 'idle'; a.t = 1; } }
  else { a.mode = 'wait'; a.t = rnd(2, 6); }
}
function finishWork(p, a) {
  const t = p.tasks.find(q => q.sid === a.wsid && !q.done);
  if (t) { if (p.imp) t.done = true; else hostTaskDone(p, a.wsid, true); }
  a.mode = 'wait'; a.t = rnd(3, 13) / a.dil;
}
function ventStep(p, a) {
  const plan = a.ventPlan || { hops: 0 };
  if (plan.hops > 0) { const cur = MAP.vents[p.vent], opts = MAP.vents.filter(v => v.g === cur.g && v.id !== cur.id); plan.hops--; hostVent(p, { a: 'go', v: pick(opts).id }); a.t = rnd(.8, 2); return; }
  hostVent(p, { a: 'out' }); a.mode = 'idle'; a.t = .5; a.ventPlan = null;
}
function respTick(p, a, dt) { // sabotage responders
  const r = a.resp, S = G.sab;
  if (r.k === 'lights' ? !S.lights : S.reactor <= 0) { if (r.k === 'reactor') hostHold(p, r.st, false); a.resp = null; a.mode = 'idle'; a.t = .5; return false; }
  if (a.respT > 0) { a.respT -= dt; return true; }
  const d = dist(p.x, p.y, r.pt.x, r.pt.y);
  if (d > 40) { if (!a.field || a.fkey !== r.k + r.st) { a.fkey = r.k + r.st; a.field = fieldTo(Math.floor(r.pt.x / TS), Math.floor(r.pt.y / TS)); } const nx = stepFrom(a.field, p.x, p.y); botMove(p, a, nx ? nx[0] : r.pt.x, nx ? nx[1] : r.pt.y, dt, 1.05); return true; }
  a.fkey = -1;
  if (r.k === 'lights') { r.w = (r.w || 0) + dt; if (r.w > 2.2) hostFixLights(p); } else hostHold(p, r.st, true);
  return true;
}
// ---- imposter brain ----
function witnessCount(p, q, R) {
  let n = 0; for (const o of G.players) { if (o.imp || !o.alive || o.left || o.id === q.id || o.vent >= 0) continue; if ((dist(o.x, o.y, q.x, q.y) <= R && los(o.x, o.y, q.x, q.y)) || (dist(o.x, o.y, p.x, p.y) <= R && los(o.x, o.y, p.x, p.y))) n++; }
  return n;
}
function impTick(p, a, dt) {
  if (p.kcd <= 0) { a.ready += dt; a.coolWait -= dt; } else a.ready = 0;
  a.sabT -= dt;
  if (a.sabT <= 0 && !p.left) {
    a.sabT = rnd(40, 90); const S = G.sab;
    if (S.cd <= 0 && !S.lights && S.reactor <= 0 && G.players.filter(q => !q.imp && q.alive).length >= 3) hostSabotage(p, Math.random() < .62 ? 'lights' : 'reactor');
  }
  if (a.mode === 'work' || a.mode === 'wait' || a.mode === 'idle' || (a.mode === 'goto' && a.goal && a.goal.kind !== 'hunt' && a.goal.kind !== 'vent' && a.goal.kind !== 'body')) {
    a.evalT2 = (a.evalT2 || 0) - dt;
    if (p.kcd <= 0 && a.coolWait <= 0 && G.time >= a.firstKill && a.evalT2 <= 0) {
      a.evalT2 = .3; const R = G.sab.lights ? 120 : 270, allow = Math.min(2, Math.floor(a.ready / 45)); let best = null, bs = 1e9;
      for (const q of a.vis) { if (q.imp || !q.alive) continue; const w = witnessCount(p, q, R); if (w > allow) continue; const s = dist(p.x, p.y, q.x, q.y) + w * 400; if (s < bs) { bs = s; best = q; } }
      if (best) { a.target = best; a.tLost = 0; setGoal(p, { kind: 'hunt', x: best.x, y: best.y, r: KILL_RANGE - 14 }); a.evalT = 0; }
    }
  }
  if (a.mode === 'goto' && a.goal && a.goal.kind === 'hunt') {
    const t = a.target;
    if (!t || !t.alive || p.kcd > 0) { a.mode = 'idle'; a.t = .4; a.target = null; return; }
    if (dist(p.x, p.y, t.x, t.y) <= KILL_RANGE - 10) {
      const R = G.sab.lights ? 120 : 270, allow = Math.min(2, Math.floor(a.ready / 45));
      if (witnessCount(p, t, R) <= allow && hostKill(p)) { a.myKills.add(t.id); a.target = null; a.coolWait = rnd(4, 16) * (1 + .6 * (G.set.imps - 1)); afterKill(p, a); }
      else if (witnessCount(p, t, R) > allow) { a.mode = 'idle'; a.t = 1; a.target = null; }
    } else if (!a.vis.includes(t)) { a.tLost += dt; if (a.tLost > 4) { a.mode = 'idle'; a.t = .5; a.target = null; } } else a.tLost = 0;
  }
}
function afterKill(p, a) {
  const others = a.vis.filter(q => !q.imp && q.alive).length, r = Math.random();
  if (others === 0 && r < .22) { const b = G.bodies[G.bodies.length - 1]; a.mode = 'wait'; a.t = rnd(1, 2.6); a.selfRep = 1; a.goal = { kind: 'body', b, r: 62 }; return; }
  let vent = null, bd = 230; for (const v of MAP.vents) { const d = dist(p.x, p.y, v.x, v.y); if (d < bd) { bd = d; vent = v; } }
  if (others === 0 && vent && r < .6) return setGoal(p, { kind: 'vent', x: vent.x, y: vent.y, r: 30 });
  const far = MAP.stations.filter(s => dist(s.x, s.y, p.x, p.y) > 500); const st = far.length ? pick(far) : pick(MAP.stations);
  setGoal(p, { kind: 'flee', x: st.x, y: st.y + 30, r: 50 });
}
// ---- meetings ----
function botMeetInit(p, caller, bodyId) {
  const a = p.ai; if (!a) return; a.mt = 0; a.chat = []; a.said = 0; a.defended = false; a.voted = false; a.sawAcc = null;
  const m = G.meet, disc = G.set.disc, voteLen = G.set.vote; a.voteAt = disc + rnd(2, Math.max(3, voteLen * .6));
  if (!p.alive) return;
  const roomOf = m.bpos ? roomAt(m.bpos.x, m.bpos.y) : '', nm = id => G.players[id].name;
  const others = G.players.filter(q => q.id !== p.id && q.alive && !q.left);
  if (caller.id === p.id) a.chat.push({ at: 1 + rnd(0, 1.5), m: bodyId >= 0 ? pick(['Body in ' + roomOf + '!', 'Found a body in ' + roomOf, 'Dead body at ' + roomOf + ', who was near?']) : pick(['Emergency! We need to talk', 'I called this meeting, something is off', 'Meeting time. Who is acting weird?']) });
  const top = Object.keys(a.sus).map(k => [+k, a.sus[k]]).filter(e => G.players[e[0]] && G.players[e[0]].alive && e[0] !== p.id).sort((x, y) => y[1] - x[1])[0];
  if (!p.imp) {
    if (a.sawKill >= 0) a.chat.push({ at: 2 + rnd(0, 2), m: pick(['I SAW ' + nm(a.sawKill) + ' kill someone!', nm(a.sawKill) + ' is the Imposter, I saw the kill', 'Vote ' + nm(a.sawKill) + '! I watched them do it']) });
    else if (a.sawVent >= 0) a.chat.push({ at: 2 + rnd(0, 2), m: pick([nm(a.sawVent) + ' vented, I saw it', nm(a.sawVent) + ' jumped into a vent!', 'Vent! It was ' + nm(a.sawVent)]) });
    else if (top && top[1] >= 30) a.chat.push({ at: 3 + rnd(0, 4), m: pick([nm(top[0]) + ' was near the body, kinda sus', 'I saw ' + nm(top[0]) + ' close to there', 'I think ' + nm(top[0]) + ' is sus']) });
    else a.chat.push({ at: 3 + rnd(0, 5), m: pick(['I was in ' + (a.lastRoom || 'a room') + ', saw nothing', 'No idea who did it, I was doing tasks', 'I was in ' + (a.lastRoom || 'the halls') + ' the whole time', 'Where was everyone?']) });
  } else {
    const crew = others.filter(q => !q.imp);
    if (crew.length && Math.random() < .6) { const t = pick(crew); a.chat.push({ at: 3 + rnd(0, 4), m: pick([nm(t.id) + ' is sus', 'I think it was ' + nm(t.id), 'Anyone see ' + nm(t.id) + '? acting weird']) }); a.accuse = t.id; }
    else a.chat.push({ at: 3 + rnd(0, 4), m: pick(['I was in ' + (a.lastRoom || 'a room') + ' doing tasks', 'I saw nothing, was busy with my tasks']) });
  }
}
function botMeetTick(p, dt) {
  const a = p.ai, m = G.meet; a.mt = m.mt;
  while (a.chat.length && a.chat[0].at <= a.mt) { const c = a.chat.shift(); if (m.st !== 'result') postChat(p, c.m); }
  a.chat.sort((x, y) => x.at - y.at);
  if (m.st === 'vote' && !(p.id in m.votes) && a.mt >= a.voteAt) botVote(p, a);
}
function botVote(p, a) {
  const cand = G.players.filter(q => q.id !== p.id && q.alive && !q.left && !(p.imp && q.imp));
  let best = null, bs = -1e9;
  for (const q of cand) { if (a.nz[q.id] == null) a.nz[q.id] = rnd(-12, 22); const s = (a.sus[q.id] || 0) + (p.imp && a.accuse === q.id ? 60 : 0) + a.nz[q.id]; if (s > bs) { bs = s; best = q; } }
  let v = -1;
  if (cand.length && Math.random() < (1 - a.iq) * .5) v = pick(cand).id;
  else if (best && bs >= 45) v = best.id;
  else if (cand.length && Math.random() < (p.imp ? .55 : .15)) v = pick(cand).id;
  hostVote(p, v);
}
function botResume(p) {
  const a = p.ai; a.mode = 'idle'; a.t = rnd(.5, 3); a.goal = null; a.known.clear(); a.seen = {}; a.target = null; a.resp = null; a.sawKill = a.sawKill; a.ventPlan = null;
  for (const k in a.sus) a.sus[k] *= .8;
}
