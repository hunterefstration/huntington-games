// ============================================================
// THE SHOW: contestants, rounds, the fixed-step simulation, host decisions (qualify / eliminate /
// grabs / pushes / round end), the local player's input and camera, and drawing the contestants.
// Solo play is the same code with the local machine as host and no network.
// ============================================================
const G = { screen: 'title', host: true, show: null, R: null, me: 0, paused: false, manual: false, noRender: false, autopilot: false,
    spec: null, camYaw: 0, camPitch: 0.32, camDist: 7.5, camPos: new THREE.Vector3(0, 6, -8), camLook: new THREE.Vector3(), frame: 0, rtBias: 0 };
const isMe = C => C && C.id === G.me;
const byId = id => G.show ? G.show.cs.find(c => c.id === id) : null;
function mkContestant(o) {
    return { id: o.id, name: o.name, look: sanitizeLook(o.look), bot: !!o.bot, skill: o.skill | 0, out: false, spect: !!o.spect, points: 0, b: null, sim: false,
        vs: { x: 0, y: 0, z: 0, yaw: 0, st: 0, stT: 0, ground: true, spd: 0, grab: false, rx: 0, rz: 0, sq: 0, anim: 0, t: 0 }, vv: { x: 0, y: 0, z: 0 }, buf: [],
        hide: false, done: null, team: null, cpi: -1, holding: -1, heldBy: -1, grabHeld: false, gt: -1, ai: null };
}
// ---------- show setup (host) ----------
function makeShowConfig(humans, opts) {
    const rnd = mulberry(Math.floor(Math.random() * 1e9)), used = new Set(humans.map(h => h.name)), cs = humans.map(h => ({ id: h.id, name: h.name, look: h.look, bot: false }));
    const names = shuffle(BOT_NAMES.slice(), rnd);
    for (let i = 0; i < opts.bots && cs.length < 16; i++) { let n = names[i % names.length]; if (used.has(n)) n += ' ' + (i + 2); used.add(n); cs.push({ id: 1000 + i, name: n, look: randomLook(rnd), bot: true, skill: opts.skill === 3 ? i % 3 : opts.skill }); }
    const nh = humans.length, pts = opts.scoring === 'points' || (opts.scoring === 'auto' && (nh >= 2 && nh <= 4 || cs.length <= 4));
    return { t: 'show', seed: Math.floor(Math.random() * 1e9), len: opts.length, pts, cs, practice: opts.practice || null };
}
function beginShow(cfg) {
    G.show = { seed: cfg.seed, len: cfg.len, pts: cfg.pts, cs: cfg.cs.map(mkContestant), used: [], idx: -1, N0: cfg.cs.length, practice: cfg.practice, results: [], over: false };
    G.R = null; G.paused = false;
    if (G.show.cs.some(isMe)) { save.stats.shows++; writeSave(); }
    UI.enterGame();
}
function pickRound(S) {
    const alive = S.cs.filter(c => !c.out && !c.spect).length, finalNow = S.idx >= S.len - 1 || (!S.pts && alive <= 2 && S.idx > 0);
    if (S.practice) return S.practice;
    const pool = Object.keys(ROUND_INFO).filter(id => {
        const ri = ROUND_INFO[id]; if ((ri.kind === 'final') !== finalNow) return false; if (S.used.includes(id)) return false;
        if (ri.kind === 'team') return S.pts ? alive >= 2 : alive >= ri.min && alive >= 6;
        return true;
    });
    return pool[Math.floor(Math.random() * pool.length)] || (finalNow ? 'crown' : 'spin');
}
function qualifyTarget(S, alive) {
    if (S.pts) return alive;
    const F = clamp(Math.round(S.N0 * 0.3), 2, 6), left = Math.max(1, S.len - 1 - S.idx);
    if (alive <= F) return Math.max(1, alive - 1);
    return clamp(Math.round(alive * Math.pow(F / alive, 1 / left)), F, alive - 1);
}
function hostStartRound() {
    const S = G.show; if (!S) return;
    S.idx++;
    const rid = pickRound(S); S.used.push(rid);
    const alive = S.cs.filter(c => !c.out && !c.spect), info = ROUND_INFO[rid], rnd = mulberry(Math.floor(Math.random() * 1e9));
    const msg = { t: 'round', rid, seed: Math.floor(Math.random() * 1e9), idx: S.idx, ids: alive.map(c => c.id), q: qualifyTarget(S, alive.length), ex: {} };
    if (info.kind === 'race' || info.kind === 'survive') msg.q = Math.min(msg.q, alive.length);
    if (ROUNDS[rid].teams || rid === 'hoops' || rid === 'hoard') {
        const n = alive.length, nt = n >= 12 ? 4 : n >= 8 ? 3 : 2; msg.nTeams = nt;
        const order = shuffle(alive.map(c => c.id), rnd); msg.teams = {}; order.forEach((id, i) => msg.teams[id] = i % nt);
    }
    if (rid === 'tail') { const k = S.pts ? Math.max(1, Math.floor(alive.length / 2)) : msg.q; msg.ex.tails = shuffle(alive.map(c => c.id), rnd).slice(0, k); }
    S.lastRound = msg; netSendAll(msg);
    beginRound(msg);
    if (ROUNDS[rid].setup) { ROUNDS[rid].setup(G.R, rnd); netSendAll({ t: 'ev', e: { k: 'hoops', h: G.R.hoops, sc: G.R.score } }); }
}
// ---------- a round, on every machine ----------
function beginRound(msg) {
    const S = G.show, def = ROUNDS[msg.rid], info = ROUND_INFO[msg.rid];
    worldReset(); newLevel();
    const R = G.R = { rid: msg.rid, def, info, seed: msg.seed, idx: msg.idx, t: -8, phase: 'intro', q: msg.q, cs: [], finished: [], outs: [], nTeams: msg.nTeams || 0,
        tails: new Set((msg.ex && msg.ex.tails) || []), imm: {}, hoops: [], score: [], crownBy: null, overT: 0, netT: 0, focusZ: 0, ended: false, lastHumanDone: 0, results: null };
    const rnd = mulberry(msg.seed);
    def.build(rnd, R);
    buildLevelMeshes(L.extra); LV.group.add(L.group);
    GFX.stadium.position.set(L.center[0], 0, L.center[1]);
    const order = shuffle(msg.ids.slice(), mulberry(msg.seed + 1));
    for (const C of S.cs) { C.inRound = false; C.hide = true; }
    order.forEach((id, i) => {
        const C = byId(id); if (!C) return;
        const sp = L.spawns[i % L.spawns.length];
        C.inRound = true; C.hide = false; C.done = null; C.cpi = -1; C.holding = C.heldBy = -1; C.grabHeld = false; C.spawnI = i % L.spawns.length; C.buf = []; C.ai = null; C.sentFin = C.sentFell = false;
        C.team = msg.teams ? msg.teams[id] : null;
        C.sim = G.host ? (C.bot || isMe(C)) : isMe(C);
        const yaw = L.spawns.length && L.center[1] === 0 && info.kind !== 'race' && msg.rid !== 'crown' ? Math.atan2(-sp[0], -sp[2]) : 0;
        C.b = mkBody(sp[0], sp[1], sp[2], yaw);
        Object.assign(C.vs, { x: sp[0], y: sp[1], z: sp[2], yaw, st: 0, ground: true, spd: 0, rx: 0, rz: 0, sq: 0 });
        if (C.bot && G.host) botNew(C, rnd);
        R.cs.push(C);
    });
    const me = byId(G.me);
    G.spec = me && me.inRound ? null : (R.cs[0] && R.cs[0].id);
    if (me && me.inRound) G.camYaw = me.b.yaw; else G.camYaw = 0;
    G.camPitch = 0.32; PFX.confP.length = 0; clearTags();
    playMusic(info.kind === 'race' ? 'race' : info.kind === 'final' ? 'final' : 'survive');
    UI.roundIntro(R);
}
function phaseOf(R) { return R.phase === 'over' ? 'over' : R.t < -3 ? 'intro' : R.t < 0 ? 'count' : 'play'; }
const killYOf = R => R.def.killY ? R.def.killY(R.t) : L.killY;
const survivalLike = R => R.info.kind === 'survive' || R.rid === 'hex' || R.def.gooOut;
// ---------- the fixed-step simulation ----------
const INP = { keys: new Set(), edge: new Set(), mdx: 0, mdy: 0, mouseGrab: false, touch: { mx: 0, mz: 0, jump: false, dive: false, grab: false } };
function tick(dt) {
    const R = G.R; if (!R || G.paused) return;
    R.t += dt;
    if (!G.host && G.rtBias) { const k = clamp(G.rtBias * 0.08, -0.004, 0.004); R.t += k; G.rtBias -= k; }
    const prevPh = R.phase; R.phase = phaseOf(R);
    if (R.phase !== prevPh) onPhase(R, prevPh);
    if (R.phase === 'count') { const s = Math.ceil(-R.t); if (s !== R.lastCount) { R.lastCount = s; if (s <= 3 && s >= 1) { UI.countdown(s); sfx('tick'); } } }
    worldUpdate(R.t, dt);
    if (R.def.tick) R.def.tick(R, dt);
    if (R.phase === 'over') R.overT += dt;
    const frozen = R.phase !== 'play', wind = R.def.wind ? R.def.wind(R.t) : null, killY = killYOf(R);
    for (const C of R.cs) {
        if (C.hide) continue;
        if (!C.sim) { interpRemote(C, R); continue; }
        const b = C.b;
        const inp = isMe(C) && !G.autopilot ? readInput(R) : (G.host || isMe(C)) ? botTick(C.ai ? C : (botNew(C), C), R, dt) : null;
        if (!inp) continue;
        b.slow = C.heldBy >= 0 ? 0.4 : C.holding >= 0 ? 0.62 : 1;
        let hold = null; if (C.heldBy >= 0) { const H = byId(C.heldBy); if (H) hold = { x: H.vs.x + Math.sin(H.vs.yaw) * 0.95, y: H.vs.y, z: H.vs.z + Math.cos(H.vs.yaw) * 0.95 }; }
        stepBody(b, inp, dt, { frozen, wind, hold });
        C.grabHeld = !!inp.grab && b.st === ST_RUN;
        separateBody(C, R);
        if (inp.respawn && !survivalLike(R) && R.phase === 'play') respawnBody(C);
        // checkpoints, falls, finish
        for (let i = C.cpi + 1; i < L.cps.length; i++) if (b.p.z > L.cps[i].z && b.p.y > L.cps[i].y - 2 && b.ground) C.cpi = i;
        if (R.phase === 'play' && !C.done) {
            const feet = b.p.y - PR;
            if (R.def.gooOut ? feet < killY : b.p.y < killY) {
                if (survivalLike(R)) { if (G.host) hostOut(C); else if (!C.sentFell) { C.sentFell = true; netSendHost({ t: 'fell' }); } }
                else respawnBody(C);
            } else if (b.p.z > L.finZ && b.p.y > L.finY - 1.5 && Math.abs(b.p.x) < L.finW) {
                if (G.host) hostQualify(C); else if (!C.sentFin) { C.sentFin = true; netSendHost({ t: 'fin' }); }
            } else if (R.crownPos && !R.crownBy) {
                const cp = R.crownPos, cy = cp.y + Math.sin(R.t * 2) * 0.2, dy = clamp(cy, b.p.y, b.p.y + PH) - cy;
                if (Math.hypot(b.p.x - cp.x, dy, b.p.z - cp.z) < 1.0) { if (G.host) hostCrown(C); else if (!C.sentFin) { C.sentFin = true; netSendHost({ t: 'crown' }); } }
            }
        }
        const v = C.vs; v.x = b.p.x; v.y = b.p.y; v.z = b.p.z; v.yaw = b.yaw; if (v.st !== b.st) v.stT = 0; v.st = b.st; v.stT += dt; v.ground = b.ground; v.spd = Math.hypot(b.v.x - b.gv.x, b.v.z - b.gv.z);
        v.grab = C.grabHeld || C.holding >= 0; v.rx = b.rx; v.rz = b.rz; v.sq = b.sq; v.anim = b.anim; C.vv.x = b.v.x; C.vv.y = b.v.y; C.vv.z = b.v.z;
    }
    if (G.host) hostTick(R, dt); else clientTick(R, dt);
}
function onPhase(R, prev) {
    if (R.phase === 'count') UI.hideIntro();
    if (R.phase === 'play') { UI.countdown(0); sfx('go'); announce('GO!', 'go'); }
}
function separateBody(C, R) {
    const p = C.b.p;
    for (const O of R.cs) {
        if (O === C || O.hide) continue;
        const o = O.vs, dx = p.x - o.x, dz = p.z - o.z, dy = p.y - o.y; if (Math.abs(dy) > 1.1) continue;
        const d2 = dx * dx + dz * dz; if (d2 > 0.81 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (0.9 - d) * (O.sim ? 0.5 : 1); p.x += dx / d * push; p.z += dz / d * push;
    }
}
function respawnBody(C) {
    const R = G.R, b = C.b, cp = C.cpi >= 0 ? L.cps[C.cpi] : null;
    if (R.def.gooOut && cp && cp.y < gooY(R.t) + 0.5) { if (G.host) hostOut(C); else if (!C.sentFell) { C.sentFell = true; netSendHost({ t: 'fell' }); } return; }
    const sp = cp ? [cp.x + (Math.random() - 0.5) * 3, cp.y + PR + 0.4, cp.z] : L.spawns[C.spawnI];
    b.p.x = sp[0]; b.p.y = sp[1]; b.p.z = sp[2]; b.v.x = b.v.y = b.v.z = 0; b.st = ST_RUN; b.t = 0; b.yaw = 0; b.rx = b.rz = 0;
    if (C.ai) { C.ai.wi = Math.max(0, L.path.findIndex(q => q.z > b.p.z - 0.5)); C.ai.wait = 0; C.ai.dodge = null; }
    if (isMe(C)) { G.camYaw = 0; sfx('pop'); }
    puff(b.p.x, b.p.y, b.p.z, 0xffffff, 8, 3, 1, 0.5, 1.4);
}
// remote contestants: play their samples back ~150 ms late through a jitter buffer
function interpRemote(C, R) {
    const buf = C.buf; if (!buf.length) return;
    const rt = R.t - 0.15;
    while (buf.length > 2 && buf[1].t <= rt) buf.shift();
    const a = buf[0], b = buf[1], v = C.vs;
    let x, y, z, yaw;
    if (b && rt >= a.t) { const f = clamp((rt - a.t) / Math.max(0.001, b.t - a.t), 0, 1.3); x = lerp(a.x, b.x, f); y = lerp(a.y, b.y, f); z = lerp(a.z, b.z, f); yaw = a.yaw + angDiff(a.yaw, b.yaw) * Math.min(1, f); }
    else { x = a.x; y = a.y; z = a.z; yaw = a.yaw; }
    const s = b || a, dt = STEP;
    const nvx = (x - v.x) / dt, nvz = (z - v.z) / dt;
    if (Math.abs(x - v.x) > 6 || Math.abs(z - v.z) > 6) { v.x = x; v.y = y; v.z = z; }
    C.vv.x = lerp(C.vv.x, clamp(nvx, -30, 30), 0.2); C.vv.z = lerp(C.vv.z, clamp(nvz, -30, 30), 0.2);
    v.spd = Math.hypot(C.vv.x, C.vv.z) * (s.f & 8 ? 1 : 0.3); v.x = x; v.y = y; v.z = z; v.yaw = yaw;
    const st = s.f & 7; if (st !== v.st) v.stT = 0; v.st = st; v.stT += dt; v.ground = !!(s.f & 8); v.grab = !!(s.f & 16);
    v.anim += v.spd * dt * 1.6;
    if (st === ST_TUMBLE) { v.rx += 8 * dt; v.rz += 3 * dt; } else { v.rx *= 0.8; v.rz *= 0.8; }
    C.gt = s.gt == null ? -1 : s.gt; C.grabHeld = v.grab;
}
// ---------- host decisions ----------
function hostTick(R, dt) {
    if (R.phase === 'play') {
        hostGrabs(R);
        if (R.def.tileDelay) for (const C of R.cs) { if (C.hide || C.done) continue; const c = C.sim ? (C.b.ground ? C.b.gc : null) : (C.gt >= 0 ? W.cs[C.gt] : null); tileStep(R, c, R.def.tileDelay); }
        if (R.def.hostTick) R.def.hostTick(R, dt);
        for (const C of R.cs) if (!C.sim && !C.hide && !C.done && survivalLike(R) && C.vs.y < killYOf(R) - 3) hostOut(C);
        if (!R.ended && roundShouldEnd(R)) hostEndRound();
    }
    if (R.phase === 'over' && R.overT > 2.6 && !R.resultsShown) { R.resultsShown = true; UI.showResults(R); }
    if (R.phase === 'over' && R.overT > 8.5 && !R.advanced) { R.advanced = true; hostAdvance(); }
    R.netT += dt;
    if (R.netT >= 1 / 15) { R.netT = 0; hostSnapshot(R); }
}
function hostGrabs(R) {
    for (const A of R.cs) {
        if (A.hide || A.done) continue;
        if (A.vs.st !== ST_DIVE) A.diveHit = false;
        if (A.holding >= 0) {
            const B = byId(A.holding), d = B ? Math.hypot(B.vs.x - A.vs.x, B.vs.z - A.vs.z) : 99;
            if (!B || B.hide || !A.grabHeld || d > 2.4 || R.t - A.grabT > 2.5 || A.vs.st === ST_TUMBLE) { const e = { k: 'ungrab', a: A.id, b: A.holding }; applyEvent(e); netEvent(e); A.grabCd = R.t + 0.8; }
            continue;
        }
        const fx = Math.sin(A.vs.yaw), fz = Math.cos(A.vs.yaw);
        if (A.vs.st === ST_DIVE && !A.diveHit) {
            for (const B of R.cs) { if (B === A || B.hide || B.done) continue; const dx = B.vs.x - A.vs.x, dz = B.vs.z - A.vs.z; if (Math.hypot(dx, dz) < 1.15 && Math.abs(B.vs.y - A.vs.y) < 1.1 && B.vs.st !== ST_TUMBLE) { A.diveHit = true; const e = { k: 'hit', id: B.id, v: [+(fx * 6.5).toFixed(2), 5.5, +(fz * 6.5).toFixed(2)] }; applyEvent(e); netEvent(e); break; } }
        }
        if (!A.grabHeld || A.vs.st !== ST_RUN || R.t < (A.grabCd || 0)) continue;
        let best = null, bd = 1.45;
        for (const B of R.cs) {
            if (B === A || B.hide || B.done || B.heldBy >= 0) continue;
            const dx = B.vs.x - A.vs.x, dz = B.vs.z - A.vs.z, d = Math.hypot(dx, dz);
            if (d < bd && Math.abs(B.vs.y - A.vs.y) < 1.1 && (dx * fx + dz * fz) / (d || 1) > 0.15) { bd = d; best = B; }
        }
        if (!best) continue;
        if (R.def.onGrab && R.def.onGrab(R, A, best)) { A.grabCd = R.t + 0.7; continue; }
        if (R.rid === 'tail') { A.grabCd = R.t + 0.4; continue; }
        A.grabT = R.t; const e = { k: 'grab', a: A.id, b: best.id }; applyEvent(e); netEvent(e);
    }
}
function hostQualify(C) {
    const R = G.R; if (C.done || R.ended) return;
    if (!G.show.pts && R.finished.length >= R.q && R.info.kind === 'race') return;
    R.finished.push(C.id); const e = { k: 'q', id: C.id, n: R.finished.length }; applyEvent(e); netEvent(e);
}
function hostOut(C) { const R = G.R; if (C.done || R.ended) return; R.outs.push(C.id); const e = { k: 'out', id: C.id }; applyEvent(e); netEvent(e); }
function hostCrown(C) { const R = G.R; if (R.crownBy != null || R.ended) return; const e = { k: 'crown', id: C.id }; applyEvent(e); netEvent(e); }
function roundShouldEnd(R) {
    const S = G.show, kind = R.info.kind, live = R.cs.filter(c => !c.done && !c.hide), timeUp = R.t >= R.info.time;
    if (timeUp) return true;
    if (R.rid === 'crown') return R.crownBy != null || !live.length;
    if (R.rid === 'hex') return live.length <= (R.cs.length > 1 ? 1 : 0);
    if (kind === 'race') {
        if (!live.length) return true;
        if (!S.pts) return R.finished.length >= R.q;
        const humansLive = live.some(c => !c.bot);
        if (!humansLive && R.finished.length >= Math.ceil(R.cs.length / 2)) { if (!R.lastHumanDone) R.lastHumanDone = R.t; if (R.t - R.lastHumanDone > 6) return true; }
        return false;
    }
    if (kind === 'survive') return S.pts ? live.length <= (R.cs.length > 1 ? 1 : 0) : live.length <= R.q;
    return false;
}
const progOf = C => (C.vs.z || 0) + (C.vs.y || 0) * 0.5;
function hostEndRound() {
    const R = G.R, S = G.show; R.ended = true;
    const all = R.cs.map(c => c.id), kind = R.info.kind;
    let order = [], qual = [];
    const live = R.cs.filter(c => !c.done);
    if (kind === 'race' || R.rid === 'crown') {
        const rest = live.slice().sort((a, b) => progOf(b) - progOf(a)).map(c => c.id);
        order = (R.crownBy != null ? [R.crownBy] : []).concat(R.finished, rest.filter(id => id !== R.crownBy), R.outs.slice().reverse());
        if (R.rid === 'crown') qual = [order[0]];
        else { qual = R.finished.slice(); if (!qual.length && rest.length) qual = rest.slice(0, Math.max(1, Math.min(R.q, Math.ceil(rest.length / 3)))); }
    } else if (kind === 'survive' || R.rid === 'hex') {
        const surv = live.slice().sort((a, b) => b.vs.y - a.vs.y).map(c => c.id);
        order = surv.concat(R.outs.slice().reverse());
        qual = surv.length ? surv : R.outs.slice(-1);
        if (R.rid === 'hex') qual = [order[0]];
    } else if (R.rid === 'tail') {
        const has = all.filter(id => R.tails.has(id)); order = has.concat(all.filter(id => !R.tails.has(id))); qual = has;
    } else {
        const sc = R.score.length ? R.score : Array(R.nTeams).fill(0), ranks = sc.map((s, k) => k).sort((a, b) => sc[b] - sc[a] || (Math.random() - 0.5));
        order = []; for (const k of ranks) for (const C of R.cs) if (C.team === k) order.push(C.id);
        const worst = ranks[ranks.length - 1]; qual = R.cs.filter(c => c.team !== worst).map(c => c.id);
        R.teamRanks = ranks;
    }
    order = order.filter((id, i) => order.indexOf(id) === i && all.includes(id)); all.forEach(id => { if (!order.includes(id)) order.push(id); });
    if (S.pts) qual = all.slice();
    const pts = {}; const N = order.length, mul = kind === 'final' ? 2 : 1;
    order.forEach((id, i) => pts[id] = S.pts ? Math.max(1, N - i) * mul : 0);
    if (kind === 'team' && R.rid !== 'tail' && S.pts) for (const C of R.cs) pts[C.id] = (R.teamRanks.length - R.teamRanks.indexOf(C.team)) * 3 * mul;
    const msg = { t: 'rend', q: qual, order, pts, winner: kind === 'final' ? order[0] : null, score: R.score };
    netSendAll(msg); applyRoundEnd(msg);
}
function applyRoundEnd(msg) {
    const R = G.R, S = G.show; if (!R) return;
    R.ended = true; R.phase = 'over'; R.overT = 0; R.results = msg;
    const qs = new Set(msg.q);
    for (const C of R.cs) { C.points += msg.pts[C.id] || 0; if (!S.pts && !qs.has(C.id)) C.out = true; }
    S.results.push({ rid: R.rid, q: msg.q, order: msg.order });
    const me = byId(G.me);
    if (me && me.inRound) {
        const ok = qs.has(me.id), place = msg.order.indexOf(me.id);
        let k = 10 + (ok ? 15 : 0) + (S.pts ? Math.max(0, 8 - place) * 2 : 0), f = 20 + (ok ? 30 : 0);
        save.stats.rounds++; if (ok && R.info.kind !== 'final') save.stats.qualified++; if (!ok && !S.pts) save.stats.eliminations++;
        if (R.info.kind === 'final') save.stats.finals++;
        R.reward = grantRewards(k, f);
        if (!S.pts && !ok && !me.done) { announce('ELIMINATED', 'bad'); sfx('out'); }
    }
    announce(R.info.kind === 'final' ? 'FINISH!' : 'ROUND OVER!', 'go');
    if (!G.host) { R.resultsShown = false; }
}
function grantRewards(kudos, fame) {
    const before = fameLevel(save.fame); save.kudos += kudos; save.stats.kudosEarned += kudos; save.fame += fame;
    const after = fameLevel(save.fame); let lvlUp = 0; if (after > before) { lvlUp = after; save.kudos += 40 * (after - before); }
    writeSave(); return { kudos, fame, lvlUp };
}
function hostAdvance() {
    const S = G.show; if (!S) return;
    const alive = S.cs.filter(c => !c.out && !c.spect), R = G.R, wasFinal = R && R.info.kind === 'final';
    if (S.practice) { const msg = { t: 'win', id: R.results.order[0], practice: true, standings: standings(S) }; netSendAll(msg); applyWin(msg); return; }
    if (wasFinal || (!S.pts && alive.length <= 1)) {
        let win = wasFinal ? R.results.winner : alive[0] && alive[0].id;
        if (S.pts) { const st = standings(S); win = st[0].id; }
        const msg = { t: 'win', id: win, standings: standings(S) }; netSendAll(msg); applyWin(msg); return;
    }
    hostStartRound();
}
function standings(S) { return S.cs.filter(c => !c.spect).slice().sort((a, b) => S.pts ? b.points - a.points : (a.out - b.out) || b.points - a.points).map(c => ({ id: c.id, name: c.name, pts: c.points, out: c.out })); }
function applyWin(msg) {
    const S = G.show; if (!S) return;
    S.over = true; S.winner = msg.id;
    const W0 = byId(msg.id);
    if (!msg.practice && W0 && isMe(W0)) { save.stats.crowns++; grantRewards(150, 200); }
    UI.ceremony(msg, W0);
}
// ---------- events (host -> everyone) ----------
function applyEvent(e) {
    const R = G.R; if (!R) return;
    const C = e.id != null ? byId(e.id) : null;
    switch (e.k) {
        case 'tile': { const c = W.cs[e.i]; if (c && c.tag === 'tile' && !c.ts) { c.ts = 1; c.dropAt = e.at; c.shake = 1; setColColor(c, 0xff4f6d); } break; }
        case 'q': if (C && !C.done) markDone(C, 'q', e.n); if (C && !R.finished.includes(C.id)) R.finished.push(C.id); break;
        case 'out': if (C && !C.done) markDone(C, 'out'); if (C && !R.outs.includes(C.id)) R.outs.push(C.id); break;
        case 'crown': R.crownBy = e.id; if (C) { confetti(C.vs.x, C.vs.y + 2, C.vs.z, 120, 3); sfx('crown'); announce(esc(C.name) + ' GRABS THE CROWN!', 'go'); } break;
        case 'hit': if (C && C.sim && C.b) { knock(C.b, e.v[0], e.v[1], e.v[2], 1.0); if (isMe(C)) shake(0.4); } break;
        case 'grab': { const A = byId(e.a), B = byId(e.b); if (A && B) { A.holding = B.id; B.heldBy = A.id; if (isMe(A) || isMe(B)) sfx('grab'); } break; }
        case 'ungrab': { const A = byId(e.a), B = byId(e.b); if (A) A.holding = -1; if (B && B.heldBy === e.a) B.heldBy = -1; break; }
        case 'tail': if (!G.host) { R.tails.delete(e.from); R.tails.add(e.to); onTailEvent(e.from, e.to); } break;
        case 'hoops': if (!G.host || e.by == null) { R.hoops = e.h; R.score = e.sc; if (e.by != null) onHoopEvent(e.by, e.sc); } break;
    }
}
function markDone(C, how, n) {
    const R = G.R; C.done = how;
    const v = C.vs;
    if (how === 'q') { confetti(v.x, v.y + 1, v.z, 40, 1.5); sfx('qual', v, 0.6); }
    else { puff(v.x, v.y, v.z, 0xffffff, 10, 4, 2, 0.8, 1.5); sfx('splash', v, 0.6); }
    if (how === 'out' || R.info.kind === 'race') C.hide = true;
    if (isMe(C)) {
        if (how === 'q') { announce(R.info.kind === 'final' ? 'YOU WIN!' : 'QUALIFIED!', 'good'); sfx('qual'); }
        else { announce('ELIMINATED', 'bad'); sfx('out'); }
        if (C.hide) G.spec = nextSpec(null);
    }
    if (G.spec === C.id && C.hide) G.spec = nextSpec(C.id);
}
function onTailEvent(from, to) { const A = byId(to); if (A) { sfx('steal', A.vs, 0.8); puff(A.vs.x, A.vs.y + 0.5, A.vs.z, 0xffd23f, 8, 3, 1, 0.5); if (isMe(A)) announce('GOT A TAIL!', 'good'); if (from === G.me) announce('TAIL STOLEN!', 'bad'); } }
function onHoopEvent(by, sc) { const C = byId(by); if (C) { sfx('score', C.vs, 0.8); confetti(C.vs.x, C.vs.y + 1, C.vs.z, 20, 1); if (isMe(C)) announce('SCORE!', 'good'); } }
function nextSpec(cur) {
    const R = G.R; if (!R) return null;
    const list = R.cs.filter(c => !c.hide && !isMe(c)); if (!list.length) return null;
    const i = list.findIndex(c => c.id === cur); return list[(i + 1) % list.length].id;
}
// ---------- input ----------
function readInput(R) {
    const k = INP.keys, e = INP.edge, t = INP.touch;
    let f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0) + t.mz, s = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + t.mx;
    const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
    const cy = G.camYaw, fx = Math.sin(cy), fz = Math.cos(cy);
    const inp = { mx: fx * f - fz * s, mz: fz * f + fx * s, jump: e.has('Space') || t.jump, dive: e.has('ShiftLeft') || e.has('ShiftRight') || e.has('KeyC') || t.dive,
        grab: k.has('KeyF') || INP.mouseGrab || t.grab, respawn: e.has('KeyR') };
    e.clear(); t.jump = false; t.dive = false;
    return inp;
}
// ---------- camera ----------
let shakeAmt = 0; const shake = a => { shakeAmt = Math.max(shakeAmt, a); };
function updateCamera(dt) {
    const R = G.R, cam = GFX.cam, k = INP.keys;
    const turn = ((k.has('ArrowLeft') || k.has('KeyQ')) ? 1 : 0) - ((k.has('ArrowRight') || k.has('KeyE')) ? 1 : 0);
    G.camYaw += turn * 2.4 * dt;
    const pt = (k.has('ArrowUp') ? 1 : 0) - (k.has('ArrowDown') ? 1 : 0); G.camPitch = clamp(G.camPitch - pt * 1.4 * dt, -0.25, 1.2);
    if (!R) return;
    let target;
    if (R.phase === 'intro') {
        const u = clamp((R.t + 8) / 5, 0, 1), c = L.center, race = R.info.kind === 'race' || R.rid === 'crown';
        const a = u * 1.2 + 0.4, r = race ? 70 - u * 30 : 30 - u * 6;
        G.camPos.set(c[0] + Math.sin(a) * r, (race ? 40 : 20) - u * 10, (race ? lerp(c[1] + 50, -6, u) : c[1]) + Math.cos(a) * r * (race ? 0.3 : 1));
        G.camLook.set(c[0], 0, race ? lerp(c[1] + 30, 10, u) : c[1]); cam.position.copy(G.camPos); cam.lookAt(G.camLook); R.focusZ = G.camLook.z; return;
    }
    const me = byId(G.me), fol = me && me.inRound && !me.hide ? me : byId(G.spec);
    if (!fol) return;
    const v = fol.vs; target = V3.set(v.x, v.y + 0.9, v.z);
    if (fol !== me) { const wy = Math.atan2(fol.vv.x, fol.vv.z), sp = Math.hypot(fol.vv.x, fol.vv.z); if (sp > 2 && !INP.lockedMoved) G.camYaw += angDiff(G.camYaw, wy) * Math.min(1, dt * 1.2); }
    const d = G.camDist, cp = Math.cos(G.camPitch), want = new THREE.Vector3(target.x - Math.sin(G.camYaw) * d * cp, target.y + Math.sin(G.camPitch) * d + 0.8, target.z - Math.cos(G.camYaw) * d * cp);
    G.camPos.lerp(want, Math.min(1, dt * 10)); G.camLook.lerp(target, Math.min(1, dt * 14));
    cam.position.copy(G.camPos); if (shakeAmt > 0) { cam.position.x += (Math.random() - 0.5) * shakeAmt; cam.position.y += (Math.random() - 0.5) * shakeAmt; shakeAmt = Math.max(0, shakeAmt - dt * 1.5); }
    cam.lookAt(G.camLook); R.focusZ = v.z;
    GFX.sun.position.set(v.x + 30, v.y + 60, v.z + 20); GFX.sun.target.position.set(v.x, v.y, v.z);
    listenerPos = cam.position;
}
// ---------- drawing the contestants ----------
function drawContestants(dt) {
    const R = G.R; tumBegin(); const t = performance.now() / 1000, names = save.settings.names;
    for (const C of R.cs) {
        if (C.hide) { placeTag(C.id, '', 0, 0, 0, '', false); continue; }
        const v = C.vs; v.t = t + C.id * 0.37;
        drawTumbler(v, C.look, { team: C.team, tail: R.tails.has(C.id), crown: R.crownBy === C.id, seed: C.id, blobY: v.ground ? v.y - PR : null });
        placeTag(C.id, C.name, v.x, v.y + 1.75, v.z, isMe(C) ? 'me' : C.bot ? 'bot' : 'pl', names && (!isMe(C) || R.phase !== 'play'));
        const tr = ITEM[C.look.trail];
        if (tr.hex && v.ground && v.spd > 3 && Math.random() < dt * 14) puff(v.x - Math.sin(v.yaw) * 0.4, v.y - 0.3, v.z - Math.cos(v.yaw) * 0.4, tr.hex, 1, 0.6, 0.6, 0.7, C.look.trail === 't5' ? 1.3 : 0.8);
        if (v.st === ST_SLIDE && Math.random() < 0.4) puff(v.x, v.y - 0.4, v.z, 0xffffff, 1, 1, 0.3, 0.4);
    }
    tumEnd();
}
function bodyEv(b, name) {
    if (G.manual || !G.R) return;
    const C = G.R.cs.find(c => c.b === b); if (!C || C.hide) return;
    const me = isMe(C), p = b.p, vol = me ? 1 : 0.5;
    if (name === 'jump') sfx('jump', me ? null : p, vol);
    else if (name === 'land') { sfx('land', me ? null : p, vol); puff(p.x, p.y - 0.4, p.z, 0xffffff, 4, 2, 0.3, 0.4); }
    else if (name === 'dive') sfx('dive', me ? null : p, vol);
    else if (name === 'bonk') { sfx('bonk', me ? null : p, vol); puff(p.x, p.y + 0.5, p.z, 0xffe066, 6, 4, 1, 0.4, 0.7); if (me) { shake(0.5); announce(['BONK!', 'WHOOPS!', 'OOF!', 'KAPOW!'][Math.floor(Math.random() * 4)], 'small'); } }
    else if (name === 'boing') sfx('boing', me ? null : p, vol);
}
