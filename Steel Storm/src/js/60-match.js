// ============================================================
// THE MATCH: Team Battle + Conquest, bots, scoring, rewards. The match host (the party leader, or you in solo) runs the
// bots, capture points, tickets and the end. Everyone simulates their own vehicle and reports hits they make.
// ============================================================
const BOT_NAMES = ['Ace', 'Viper', 'Rook', 'Bolt', 'Echo', 'Fang', 'Hawk', 'Ivy', 'Jinx', 'Kilo', 'Luna', 'Mako', 'Nova', 'Onyx', 'Pike', 'Quill', 'Raze', 'Sage', 'Tank', 'Volt'];
const MODES = { tdm: { name: 'Team Battle', kills: 15, time: 600 }, conq: { name: 'Conquest', tickets: 100, time: 720 } };
let HQ = {}, hqT = 0, sendT = 0, bsT = 0, msT = 0;

function pickBotDef(maxTier) {
    const r = Math.random(), ln = r < .5 ? 'g' : r < .75 ? 'a' : 'n', tier = clamp(maxTier - (Math.random() < .45 ? 1 : 0), 1, 4);
    const L = VEHS.filter(v => v.ln === ln && v.t === tier); return L[Math.floor(Math.random() * L.length)];
}
// Build the match description (host / solo). players = [{id,name,veh}], returns cfg that every client uses.
function makeConfig(players, opts) {
    const mode = opts.mode || save.mode, size = opts.size || save.size, split = opts.split !== undefined ? opts.split : save.split;
    const teams = [[], []], cfg = { mode, size, players: [], bots: [], seed: Date.now() & 0xffffff, limit: {} };
    players.forEach((p, i) => { const team = split ? i % 2 : 0; cfg.players.push({ id: p.id, name: p.name, veh: p.veh, team }); teams[team].push(p); });
    let maxTier = 1; players.forEach(p => { if (VBY[p.veh]) maxTier = Math.max(maxTier, VBY[p.veh].t); });
    let bi = 0, names = BOT_NAMES.slice().sort(() => Math.random() - .5);
    for (let t = 0; t < 2; t++) for (let n = teams[t].length; n < size; n++) { const d = pickBotDef(maxTier); cfg.bots.push({ id: 100 + bi, name: 'Bot ' + names[bi % names.length], veh: d.id, team: t }); bi++; }
    const mm = MODES[mode]; cfg.limit = { kills: opts.killLimit || mm.kills || 0, tickets: opts.tickets || mm.tickets || 0, time: opts.time || mm.time };
    return cfg;
}
function beginMatch(cfg, meId, isHost) {
    clearMatch();
    M = { mode: cfg.mode, cfg, t: 0, state: 'play', limit: cfg.limit, kills: [0, 0], tickets: [cfg.limit.tickets || 0, cfg.limit.tickets || 0], pts: PTS.map(() => ({ own: -1, prog: 0 })),
        host: isHost, my: { kills: 0, deaths: 0, caps: 0, dmg: 0, tier: 1 }, over: false, winner: -2, feed: [], log: [], shown: 0, meId, size: cfg.size };
    const mk = (p, bot) => {
        const def = VBY[p.veh] || VBY.g1a, e = newEnt(p.id, def, p.team, p.name);
        e.isBot = !!bot; if (bot) { if (isHost) aiNew(e); else e.remote = true; } else e.remote = p.id !== meId;
        spawnEnt(e); if (e.remote) { e.vx = e.vy = e.vz = 0; } return e;
    };
    cfg.players.forEach(p => mk(p, false)); cfg.bots.forEach(b => mk(b, true));
    ME = EN.get(meId); M.my.tier = ME ? ME.def.t : 1;
    ME.budget = 0; setPointsVisible(cfg.mode === 'conq'); updatePointViz(M.pts);
    UI.enterMatch();
}
function clearMatch() {
    for (const e of Array.from(EN.values())) removeEnt(e);
    PR.length = 0; HQ = {}; ME = null; M = null; setPointsVisible(false);
}
function netOn() { return typeof PARTY !== 'undefined' && PARTY.net; }
function toHost(m, fast) {      // message for the match host
    if (!M) return;
    if (M.host) handleMatchMsg(M.meId, m); else if (netOn()) PARTY.net.send('host', m, { fast: !!fast });
}
function bcast(m, fast) {       // message for everyone (including me)
    if (M && M.host) handleMatchMsg(M.meId, m, true);
    if (netOn()) PARTY.net.send('all', m, { fast: !!fast });
}
function netFire(e, slot, ps) { if (netOn()) PARTY.net.send('all', { t: 'fire', id: e.id, w: slot, ps }); }

// ---------- damage ----------
function reportHit(p, tg, dmg) {
    if (!M || dmg <= 0.05) return;
    const own = EN.get(p.own); if (!own) return;
    own.nHits = (own.nHits || 0) + 1;
    if (own === ME) { UI.hitMarker(false); sfx('hit'); }
    if (M.host) hostDamage(p.own, tg.id, dmg, p.pk || 0, p.slot, true);
    else { const key = tg.id + '|' + p.slot + '|' + (p.pk || 0); HQ[key] = (HQ[key] || 0) + dmg; if (p.k !== 'bullet') flushHits(); }
}
function flushHits() {
    for (const k of Object.keys(HQ)) { const [tg, w, pk] = k.split('|'); toHost({ t: 'hit', tg: +tg, d: Math.round(HQ[k] * 10) / 10, p: +pk, w }); }
    HQ = {};
}
function hostDamage(by, tgId, dmg, pk, slot, trusted) {
    if (!M || M.over || M.state !== 'play') return;
    const a = EN.get(by), v = EN.get(tgId); if (!a || !v || !v.alive || a.team === v.team) return;
    if (!a.alive && simTime - (a.dieT || 0) > 3) return;
    if (v.prot > 0) return;
    if (!trusted) {
        const w = a.def; let mx = 0; for (const k of ['w1', 'w2', 'w3']) if (w[k]) mx = Math.max(mx, w[k].dmg * (w[k].nn || 1)); 
        if (!(dmg > 0) || dmg > mx * 22 + 50 || dmg > a.budget + 5) return;
        a.budget -= dmg;
    }
    let eff = dmg / (1 + Math.max(0, v.def.ar * (1 - pk)) / 100);
    if (a.ai) eff *= aiDiff().dmg;
    eff = Math.min(eff, v.def.hp * (a.def.ln !== v.def.ln ? .3 : .5));      // no single hit takes more than 30% (50% in the same branch) of a full health bar
    v.hp -= eff;
    const dead = v.hp <= 0;
    bcast({ t: 'dmg', tg: tgId, e: Math.round(eff * 10) / 10, by, hp: Math.max(0, Math.round(v.hp)) });
    if (dead) { if (v === ME) meDied(by, slot); else if (v.ai) hostKill(tgId, by, slot); }
}
function hostKill(vid, kid, w) {
    if (!M || M.over) return;
    const v = EN.get(vid); if (!v || v.kdone) return; v.kdone = true;
    const k = EN.get(kid); v.deaths++; if (k && k !== v) { k.kills++; k.score += 100; }
    if (k && k.team !== v.team) M.kills[k.team]++;
    if (M.mode === 'conq') M.tickets[v.team] = Math.max(0, M.tickets[v.team] - 1);
    if (v.ai) v.respT = 6;
    bcast({ t: 'kill', k: kid, v: vid, w: w || '', kl: M.kills, tk: M.tickets.map(x => Math.round(x * 10) / 10) });
    hostCheckEnd();
}
function onDmg(m) {
    if (!M) return;
    const v = EN.get(m.tg); if (!v) return;
    if (v === ME) { if (!M.host) ME.hp -= m.e; ME.lastBy = m.by; if (m.e > 0) UI.hurt(); }
    else v.hp = m.hp;
    if (v.alive) { fxSpark(v.x, v.y + 1.5, v.z); sfx('hit', v.x, v.y, v.z, .5); }
    if (m.by === (ME && ME.id)) { M.my.dmg += m.e; ME.dmg += m.e; if (!M.host) { UI.hitMarker(false); sfx('hit'); } }
}
function onKill(m) {
    if (!M) return;
    const v = EN.get(m.v), k = EN.get(m.k);
    if (M.log.length < 300) M.log.push([Math.round(M.t), m.k, m.v, m.w]);
    if (!M.host) { M.kills = m.kl; if (M.mode === 'conq') M.tickets = m.tk; }
    if (v) { if (v.alive) killVisual(v); v.hp = 0; v.kdone = true; if (!M.host) { v.deaths++; if (k && k !== v) k.kills++; } if (v === ME) { UI.died(k, m.w); } }
    if (k && k === ME && v && v.team !== k.team) { M.my.kills++; UI.hitMarker(true); sfx('kill'); UI.msg('Destroyed ' + v.name); }
    UI.feed(k, v, m.w);
}
function onCap(m) {
    if (!M) return;
    const p = M.pts[m.pt]; if (p) { p.own = m.team; p.prog = m.team ? 1 : -1; updatePointViz(M.pts); }
    UI.msg('Point ' + PTS[m.pt].name + ' ' + (ME && m.team === ME.team ? 'captured!' : 'lost!'), m.team);
    if (ME && m.ids && m.ids.indexOf(ME.id) >= 0) { M.my.caps++; sfx('cap'); } else if (ME && m.team === ME.team) sfx('cap');
}
// ---------- the host's match logic ----------
function hostStep(dt) {
    if (!M || M.over) return;
    M.t += dt;
    for (const e of EN.values()) { e.budget = Math.min(e.def.maxDps * 6, e.budget + e.def.maxDps * 2 * dt); if (e.crashed && e.alive && e.ai) { e.crashed = false; e.hp = 0; hostKill(e.id, -1, 'crash'); } if (e.ai && !e.alive) { e.respT -= dt; if (e.respT <= 0) { botRespawn(e); } } }
    if (M.mode === 'conq') {
        let n = [0, 0];
        M.pts.forEach((p, i) => {
            const c = [0, 0], ids = [[], []];
            for (const e of EN.values()) if (e.alive && e.team !== undefined && Math.hypot(e.x - PTS[i].x, e.z - PTS[i].z) < CAP_R && e.y < PTS[i].y + 70) { c[e.team]++; ids[e.team].push(e.id); }
            const diff = c[1] - c[0];
            if (diff !== 0) p.prog = clamp(p.prog + Math.sign(diff) * Math.min(3, Math.abs(diff)) * .07 * dt, -1, 1);
            if (p.prog >= 1 && p.own !== 1) { p.own = 1; bcast({ t: 'cap', pt: i, team: 1, ids: ids[1] }); }
            else if (p.prog <= -1 && p.own !== 0) { p.own = 0; bcast({ t: 'cap', pt: i, team: 0, ids: ids[0] }); }
            else if (p.own === 1 && p.prog < .5 || p.own === 0 && p.prog > -.5) { p.own = -1; updatePointViz(M.pts); }
            if (p.own >= 0) n[p.own]++;
        });
        const lead = n[0] - n[1];
        if (lead > 0) M.tickets[1] = Math.max(0, M.tickets[1] - lead * .25 * dt); else if (lead < 0) M.tickets[0] = Math.max(0, M.tickets[0] + lead * .25 * dt);
    }
    msT -= dt; if (msT <= 0) { msT = .25; bcast({ t: 'm', tk: M.tickets.map(x => Math.round(x * 10) / 10), kl: M.kills, pts: M.pts.map(p => [p.own, Math.round(p.prog * 100) / 100]), tm: Math.round(M.t) }, true); }
    hostCheckEnd();
}
function hostCheckEnd() {
    if (!M || M.over || !M.host) return;
    let w = -2;
    if (M.mode === 'tdm') { if (M.kills[0] >= M.limit.kills) w = 0; else if (M.kills[1] >= M.limit.kills) w = 1; }
    else { if (M.tickets[0] <= 0) w = 1; else if (M.tickets[1] <= 0) w = 0; }
    if (w === -2 && M.t >= M.limit.time) { const a = M.mode === 'tdm' ? M.kills : M.tickets; w = a[0] > a[1] ? 0 : a[1] > a[0] ? 1 : -1; }
    if (w !== -2) endMatch(w);
}
function endMatch(win) {
    if (!M || M.over) return;
    const stats = Array.from(EN.values()).map(e => [e.id, e.kills, e.deaths, Math.round(e.score + e.dmg * .1)]);
    bcast({ t: 'end', win, stats, kl: M.kills, tk: M.tickets.map(x => Math.round(x)) });
}
function botRespawn(e) {
    const maxTier = Math.max(1, ...Array.from(EN.values()).filter(o => !o.isBot).map(o => o.def.t));
    if (Math.random() < .5) { const d = pickBotDef(maxTier); if (d !== e.def) setDef(e, d); }
    e.kdone = false; spawnEnt(e); if (e.ai) { e.ai.tgt = null; e.ai.brk = 0; }
}
function sendBots() {
    const rows = []; for (const e of EN.values()) if (e.ai) rows.push([e.id, e.def.i, r1(e.x), r1(e.y), r1(e.z), r2(e.yaw), r2(e.pitch), r2(e.roll), r2(e.tur), r2(e.gun), Math.round(e.hp), e.alive ? 1 : 0, e.fl]);
    if (netOn() && rows.length) PARTY.net.send('all', { t: 'b', r: rows }, { fast: true });
}
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
function sendState() {
    if (!ME || !netOn()) return;
    const e = ME; PARTY.net.send('all', { t: 's', i: e.def.i, x: r1(e.x), y: r1(e.y), z: r1(e.z), a: r2(e.yaw), p: r2(e.pitch), r: r2(e.roll), u: r2(e.tur), g: r2(e.gun), h: Math.round(e.hp), l: e.alive ? 1 : 0, f: e.fl }, { fast: true });
}
// remote vehicle state (a player's own state or a bot row)
function applyRemote(e, i, x, y, z, yaw, pitch, roll, tur, gun, hp, alive, fl) {
    if (!e || e === ME || e.ai) return;
    if (VEHS[i] && VEHS[i] !== e.def) setDef(e, VEHS[i]);
    if (alive && !e.alive) { e.alive = true; e.kdone = false; e.mdl.root.visible = true; e.snap = true; e.dieT = 0; e.prot = SPAWN_PROT; e.hp = e.def.hp; e.tg = { x, y, z, yaw, pitch, roll, tur, gun }; }
    if (!e.alive) return;
    const now = performance.now(), dt = e.lastMsg ? clamp((now - e.lastMsg) / 1000, .03, .5) : 0; e.lastMsg = now;
    if (e.tg && dt) { const k = .5; e.vx = lerp(e.vx, (x - e.tg.x) / dt, k); e.vy = lerp(e.vy, (y - e.tg.y) / dt, k); e.vz = lerp(e.vz, (z - e.tg.z) / dt, k); }
    if (Math.hypot(x - e.x, z - e.z) > 120) e.snap = true;
    e.tg = { x, y, z, yaw, pitch, roll, tur, gun }; e.hp = hp; e.fl = fl; e.netFl = true; e.speed = Math.hypot(e.vx, e.vz);
}
function handleMatchMsg(from, m, local) {
    switch (m.t) {
        case 's': if (M && from !== M.meId) applyRemote(EN.get(from), m.i, m.x, m.y, m.z, m.a, m.p, m.r, m.u, m.g, m.h, m.l, m.f); break;
        case 'b': if (M && !M.host) for (const r of m.r) applyRemote(EN.get(r[0]), r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], r[12]); break;
        case 'm': if (M && !M.host) { M.tickets = m.tk; M.kills = m.kl; M.t = m.tm; m.pts.forEach((p, i) => { if (M.pts[i]) { M.pts[i].own = p[0]; M.pts[i].prog = p[1]; } }); updatePointViz(M.pts); } break;
        case 'fire': if (M && !local) { const e = EN.get(m.id); if (e && e !== ME && !e.ai) remoteShot(e, m.w, m.ps); } break;
        case 'hit': if (M && M.host && !local) hostDamage(from, m.tg, m.d, m.p, m.w, false); break;
        case 'dmg': onDmg(m); break;
        case 'died': if (M && M.host && !local) { const v = EN.get(from); if (v && v.alive) { v.hp = 0; hostKill(from, m.by, m.w); } } break;
        case 'kill': onKill(m); break;
        case 'cap': onCap(m); break;
        case 'end': finishMatch(m); break;
    }
}
// ---------- me ----------
function meDied(by, w) {
    const e = ME; if (!e || !e.alive) return;
    killVisual(e); e.hp = 0;
    e.respT = 5; e.budget = 0;
    if (M.host) hostKill(e.id, by, w); else { toHost({ t: 'died', by, w }); UI.died(EN.get(by), w); }
}
function respawnMe(vid) {
    const d = VBY[vid]; if (!d || !ME || ME.alive || !M || M.over) return false;
    if (d !== ME.def) setDef(ME, d); ME.kdone = false; spawnEnt(ME); M.my.tier = Math.max(M.my.tier, d.t); UI.deployed(); return true;
}
// ---------- the end: rewards and results ----------
function finishMatch(m) {
    if (!M || M.over) return;
    M.over = true; M.state = 'end'; M.winner = m.win; if (!M.host) { M.kills = m.kl; if (M.mode === 'conq') M.tickets = m.tk; }
    for (const r of m.stats) { const e = EN.get(r[0]); if (e) { e.kills = r[1]; e.deaths = r[2]; e.score = r[3]; } }
    const my = M.my, win = ME && m.win === ME.team, draw = m.win === -1, tk = 1 + .25 * (my.tier - 1), part = clamp(M.t / 90, .15, 1);
    my.deaths = ME ? ME.deaths : 0;
    const cr = Math.round((my.kills * 110 * tk + my.caps * 180 + my.dmg * .25 + (win ? 450 : draw ? 150 : 120)) * part);
    const rp = Math.round((my.kills * 28 + my.caps * 45 + my.dmg / 18 + (win ? 120 : 35)) * part);
    save.credits += cr; addRp(rp);
    const s = save.stats; s.matches++; if (win) s.wins++; s.kills += my.kills; s.deaths += my.deaths; s.caps += my.caps; writeSave();
    M.reward = { cr, rp, win, draw };
    sfx(win ? 'win' : 'lose'); engineStop();
    UI.showResult();
}
