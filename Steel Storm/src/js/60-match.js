// ============================================================
// THE MATCH: Team Deathmatch, Conquest, Capture the Flag, Free-for-all; bots, scoring, rewards.
// The match host (the party leader, or you in solo) is authoritative: it runs the bots, simulates every shell, rocket,
// bomb, torpedo and missile from fire events (lag-compensated), validates bullet hits, applies all damage and decides
// kills, captures and the end. Everyone simulates their own vehicle (client-side prediction) and interpolates the others.
// ============================================================
const BOT_NAMES = ['Ace', 'Viper', 'Rook', 'Bolt', 'Echo', 'Fang', 'Hawk', 'Ivy', 'Jinx', 'Kilo', 'Luna', 'Mako', 'Nova', 'Onyx', 'Pike', 'Quill', 'Raze', 'Sage', 'Tank', 'Volt', 'Wren', 'Yuri', 'Zed', 'Bram'];
const MODES = {
    tdm: { name: 'Team Deathmatch', short: 'TDM', desc: 'First team to the kill limit' },
    conq: { name: 'Conquest', short: 'CONQ', desc: 'Hold 3 points, drain their tickets' },
    ctf: { name: 'Capture the Flag', short: 'CTF', desc: 'Steal their flag, bring it home (tanks + helis carry)' },
    ffa: { name: 'Free-for-all', short: 'FFA', desc: 'Everyone for themselves' }
};
const MAPR = { small: 470, normal: 610, large: 720 };
let HQ = {}, hqT = 0, sendT = 0, bsT = 0, msT = 0, hpT = 0, pgT = 0;

// Bots: "match" = fight what the humans fly/drive (a random human's domain, battle rating within -1.0 / +0.3 of theirs, often the
// same class), "mixed" = any domain at a similar battle rating. Battle rating keeps new players away from top-tier vehicles.
function pickBotDef(refs, mode, k) {
    const ref = refs.length ? refs[k === undefined ? Math.floor(Math.random() * refs.length) : k % refs.length] : VBY.g1a, br = brOf(ref);
    let ln = ref.ln; if (mode === 'mixed') { const r = Math.random(); ln = r < .5 ? 'g' : r < .75 ? 'a' : 'n'; }
    let L = VEHS.filter(v => v.ln === ln && v.br <= br + .3 && v.br >= br - 1.0);
    if (mode !== 'mixed' && Math.random() < .5) { const same = L.filter(v => v.cls === (ref.base || ref).cls); if (same.length) L = same; }
    if (!L.length) L = VEHS.filter(v => v.ln === ln && v.t <= Math.max(1, ref.t));
    const b = L[Math.floor(Math.random() * L.length)];
    let mask = 0; for (let i = 0; i < 5; i++) if (Math.random() < (b.t - 1) * .18) mask |= 1 << i;
    return vdef(b.id, mask);
}
// Build the match description (host / solo). players = [{id,name,veh,mm,team?}], returns the cfg every client uses.
function makeConfig(players, opts) {
    opts = opts || {};
    const so = save.opts, mode = MODES[opts.mode || save.mode] ? opts.mode || save.mode : 'tdm', size = opts.size || save.size, split = opts.split !== undefined ? opts.split : save.split, ffa = mode === 'ffa';
    const cfg = { mode, size, players: [], bots: [], seed: Date.now() & 0xffffff, limit: {}, ff: opts.ff !== undefined ? +opts.ff : so.ff, map: opts.map || so.map, wx: opts.wx || so.wx, len: opts.len || so.len };
    if (cfg.wx === 'random' || !WX[cfg.wx]) cfg.wx = Object.keys(WX)[Math.floor(Math.random() * 4)];
    const teams = [[], []];
    players.forEach((p, i) => { const team = ffa ? i : (p.team === 0 || p.team === 1) ? p.team : split ? i % 2 : 0; cfg.players.push({ id: p.id, name: p.name, veh: p.veh, mm: p.mm | 0, team }); if (!ffa) teams[team].push(p); });
    const bm = opts.bots || save.bots || 'match', refs = players.map(p => vdef(p.veh, p.mm)).filter(Boolean);
    const off = Math.floor(Math.random() * Math.max(1, refs.length)); cfg.bm = bm; cfg.diff = opts.diff || save.diff || 'normal';
    let bi = 0; const names = BOT_NAMES.slice().sort(() => Math.random() - .5);
    const addBot = team => { const d = pickBotDef(refs, bm === 'off' ? 'match' : bm, bi + off); cfg.bots.push({ id: 100 + bi, name: 'Bot ' + names[bi % names.length], veh: d.id, mm: d.mask | 0, team }); bi++; };
    if (bm !== 'off') { if (ffa) for (let n = players.length; n < Math.min(12, size * 2); n++) addBot(n); else for (let t = 0; t < 2; t++) for (let n = teams[t].length; n < size; n++) addBot(t); }
    const L = cfg.len * 60;
    cfg.limit = { kills: opts.killLimit || (ffa ? [10, 15, 20][[3, 5, 8].indexOf(size)] : [12, 20, 30][[3, 5, 8].indexOf(size)]) || 20, tickets: opts.tickets || (size === 3 ? 80 : size === 8 ? 160 : 120), caps: opts.caps || 3, time: opts.time || L };
    return cfg;
}
function beginMatch(cfg, meId, isHost) {
    clearMatch();
    const ffa = cfg.mode === 'ffa', nt = ffa ? 0 : 2;
    M = { mode: cfg.mode, cfg, t: 0, state: 'play', limit: cfg.limit, kills: [0, 0], tickets: [cfg.limit.tickets || 0, cfg.limit.tickets || 0], caps: [0, 0], pts: PTS.map(() => ({ own: -1, prog: 0 })),
        flags: [0, 1].map(t => ({ t, st: 'home', x: FLAG_HOME[t].x, z: FLAG_HOME[t].z, by: -1, dt: 0 })), R: MAPR[cfg.map] || MAPR.normal,
        host: isHost, my: { kills: 0, deaths: 0, caps: 0, flags: 0, dmg: 0, tier: 1 }, over: false, winner: -2, log: [], meId, size: cfg.size, nt };
    applyWeather(cfg.wx); applyFog();
    const mk = (p, bot) => {
        const def = vdef(p.veh, p.mm), e = newEnt(p.id, def, p.team, p.name);
        e.isBot = !!bot; if (bot) { if (isHost) aiNew(e); else e.remote = true; } else e.remote = p.id !== meId;
        e.carry = -1; spawnEnt(e); if (e.remote) { e.vx = e.vy = e.vz = 0; } if (p.dead) { e.alive = false; e.mdl.root.visible = false; e.respT = 2; }
        return e;
    };
    cfg.players.forEach(p => mk(p, false)); cfg.bots.forEach(b => mk(b, true));
    ME = EN.get(meId); M.my.tier = ME ? ME.def.t : 1;
    if (ME) ME.budget = 0;
    setPointsVisible(cfg.mode === 'conq'); updatePointViz(M.pts); setFlagsVisible(cfg.mode === 'ctf');
    UI.enterMatch();
    if (ME && !ME.alive) UI.died(null, 'late');
}
function clearMatch() {
    for (const e of Array.from(EN.values())) removeEnt(e);
    PR.length = 0; HQ = {}; ME = null; M = null; setPointsVisible(false); setFlagsVisible(false);
    for (const k of Object.keys(CLK)) delete CLK[k];
}
function netOn() { return typeof PARTY !== 'undefined' && !!PARTY.net && !PARTY.solo; }
function toHost(m, fast) {      // message for the match host
    if (!M) return;
    if (M.host) handleMatchMsg(M.meId, m); else if (netOn()) PARTY.net.send('host', m, { fast: !!fast });
}
function bcast(m, fast) {       // message for everyone (including me)
    if (M && M.host) handleMatchMsg(M.meId, m, true);
    if (netOn()) PARTY.net.send('all', m, { fast: !!fast });
}
function netFire(e, slot, ps, tg) { if (netOn()) PARTY.net.send('all', { t: 'fire', id: e.id, w: slot, ps, tg }); }
const owlOf = e => clamp(((e && e.q) || 80) / 2, 0, 300);      // one-way latency estimate (ms) of a guest

// ---------- damage ----------
function predictHit() { if (M && !M.host) { UI.hitMarker(false, true); } }
function reportHit(p, tg, dmg) {
    if (!M || dmg <= 0.05) return;
    const own = EN.get(p.own); if (!own || tg.prot > 0) return;
    own.nHits = (own.nHits || 0) + 1;
    if (M.host) { if (own === ME) { UI.hitMarker(false); sfx('hit'); } hostDamage(p.own, tg.id, dmg, p.pk || 0, p.slot, true); }
    else if (p.claim) { UI.hitMarker(false, true); const key = tg.id + '|' + p.slot + '|' + (p.pk || 0); HQ[key] = (HQ[key] || 0) + dmg; }
}
function flushHits() {
    for (const k of Object.keys(HQ)) { const [tg, w, pk] = k.split('|'); toHost({ t: 'hit', tg: +tg, d: Math.round(HQ[k] * 10) / 10, p: +pk, w }); }
    HQ = {};
}
function hostDamage(by, tgId, dmg, pk, slot, trusted) {
    if (!M || M.over || M.state !== 'play') return;
    const a = EN.get(by), v = EN.get(tgId); if (!a || !v || !v.alive || a === v) return;
    const team = a.team === v.team; if (team && !ffOn()) return;
    if (!a.alive && simTime - (a.dieT || 0) > 3) return;
    if (v.prot > 0) return;
    if (!trusted) {      // a guest's bullet claim: plausible damage, budget, range and aim against where the target was when they saw it
        const w = a.def[slot] || a.def.w1;
        if (!(dmg > 0) || dmg > w.dmg * 40 + 50 || dmg > a.budget + 5) return;
        const p = v.hn ? posAt(v, simTime * 1000 - owlOf(a) - (a.d || 100), HP3) : v, D = Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
        if (D > (w.v || 500) * (w.life || 1) * 1.3 + v.def.r + 40) return;
        a.budget -= dmg;
    }
    let eff = dmg / (1 + Math.max(0, v.def.ar * (1 - pk)) / 100);
    if (a.ai) eff *= aiDiff().dmg * (a.def.ln === 'a' ? 1.4 : 1);      // jet guns do tiny damage per bullet and miss a lot; bots get a little help there
    if (team) eff *= .5;      // friendly fire is on: half damage
    eff = Math.min(eff, v.def.hp * (a.def.ln !== v.def.ln ? .3 : .5));      // no single hit takes more than 30% (50% in the same domain) of a full health bar
    v.hp -= eff; if (!team) { a.dmg += eff; a.score += eff * .1; }
    const dead = v.hp <= 0;
    bcast({ t: 'dmg', tg: tgId, e: Math.round(eff * 10) / 10, by, hp: Math.max(0, Math.round(v.hp)) });
    if (dead) hostKill(tgId, by, slot);
}
function hostKill(vid, kid, w) {
    if (!M || M.over) return;
    const v = EN.get(vid); if (!v || v.kdone) return; v.kdone = true; v.hp = 0;
    const k = EN.get(kid); v.deaths++;
    if (k && k !== v && foe(k, v)) { k.kills++; k.score += 100; if (M.nt) M.kills[k.team]++; }
    else if (k && k !== v) k.score -= 50;      // team kill
    if (M.mode === 'conq') M.tickets[v.team] = Math.max(0, M.tickets[v.team] - 1);
    if (v.carry >= 0) hostDropFlag(v);
    v.respT = v.ai ? 6 : 5;
    bcast({ t: 'kill', k: kid, v: vid, w: w || '', kl: M.kills, tk: M.tickets.map(x => Math.round(x * 10) / 10) });
    hostCheckEnd();
}
function onDmg(m) {
    if (!M) return;
    const v = EN.get(m.tg); if (!v) return;
    v.hp = m.hp;
    if (v === ME) { ME.lastBy = m.by; if (m.e > 0) UI.hurt(); }
    if (v.alive) { fxSpark(v.x, v.y + 1.5, v.z); sfx('hit', v.x, v.y, v.z, .5); }
    if (ME && m.by === ME.id) { M.my.dmg += m.e; if (!M.host) ME.dmg += m.e; if (!M.host) { UI.hitMarker(false); sfx('hit'); } }
}
function onKill(m) {
    if (!M) return;
    const v = EN.get(m.v), k = EN.get(m.k);
    if (M.log.length < 300) M.log.push([Math.round(M.t), m.k, m.v, m.w]);
    if (!M.host) { M.kills = m.kl; if (M.mode === 'conq') M.tickets = m.tk; }
    if (v) {
        if (v.alive) killVisual(v); v.hp = 0; v.kdone = true; v.carry = -1;
        if (!M.host) { v.deaths++; if (k && k !== v && foe(k, v)) k.kills++; }
        if (v === ME) { ME.respT = 5; ME.budget = 0; M.my.deaths = ME.deaths; UI.died(k, m.w); }
    }
    if (k && k === ME && v && v !== k && foe(k, v)) { M.my.kills++; UI.hitMarker(true); sfx('kill'); UI.msg('Destroyed ' + v.name); }
    UI.feed(k, v, m.w);
}
function onCap(m) {
    if (!M) return;
    const p = M.pts[m.pt]; if (p) { p.own = m.team; p.prog = m.team ? 1 : -1; updatePointViz(M.pts); }
    UI.msg('Point ' + PTS[m.pt].name + ' ' + (ME && m.team === ME.team ? 'captured!' : 'lost!'), m.team);
    if (ME && m.ids && m.ids.indexOf(ME.id) >= 0) { M.my.caps++; sfx('cap'); } else if (ME && m.team === ME.team) sfx('cap');
    if (M.host) for (const id of m.ids || []) { const e = EN.get(id); if (e) { e.caps++; e.score += 150; } }
}
function onFlag(m) {      // a: take | drop | ret | cap
    if (!M) return;
    const e = EN.get(m.id), f = M.flags[m.f], mine = ME && m.f === ME.team, nm = e ? e.name : 'Someone';
    if (m.a === 'take') { if (e) e.carry = m.f; UI.msg(mine ? nm + ' has YOUR flag!' : nm + ' took the enemy flag!', mine ? 1 - ME.team : ME && ME.team); sfx(mine ? 'warn' : 'flag'); }
    else if (m.a === 'drop') { if (e) e.carry = -1; UI.msg((mine ? 'Your' : 'Enemy') + ' flag dropped', -1); }
    else if (m.a === 'ret') UI.msg((mine ? 'Your' : 'Enemy') + ' flag returned', -1);
    else if (m.a === 'cap') { if (e) { e.carry = -1; if (!M.host) e.flags++; } if (e === ME) M.my.flags++; if (!M.host) M.caps = m.c; UI.msg(nm + ' captured the ' + (mine ? 'YOUR' : 'enemy') + ' flag!', e ? e.team : -1); sfx(e && ME && e.team === ME.team ? 'cap' : 'lose'); }
    if (f && m.st) { f.st = m.st; f.x = m.x; f.z = m.z; f.by = m.by; }
    UI.feedText(m.a === 'cap' ? (nm + ' captured a flag') : m.a === 'take' ? (nm + ' took a flag') : '', e ? e.team : -1);
}
// ---------- the host's match logic ----------
function hostDropFlag(e) {
    const f = M.flags[e.carry]; if (!f) return; e.carry = -1;
    f.st = 'drop'; f.x = e.x; f.z = e.z; f.by = -1; f.dt = 30;
    bcast({ t: 'flag', a: 'drop', f: f.t, id: e.id, st: f.st, x: r1(f.x), z: r1(f.z), by: -1 });
}
function hostCtf(dt) {
    for (const f of M.flags) {
        if (f.st === 'carry') { const c = EN.get(f.by); if (!c || !c.alive) { if (c) { c.carry = f.t; hostDropFlag(c); } else { f.st = 'home'; f.x = FLAG_HOME[f.t].x; f.z = FLAG_HOME[f.t].z; } continue; } f.x = c.x; f.z = c.z; }
        if (f.st === 'drop') { f.dt -= dt; if (f.dt <= 0) { f.st = 'home'; f.x = FLAG_HOME[f.t].x; f.z = FLAG_HOME[f.t].z; bcast({ t: 'flag', a: 'ret', f: f.t, id: -1, st: 'home', x: f.x, z: f.z, by: -1 }); } }
        for (const e of EN.values()) {
            if (!e.alive || (e.def.ln !== 'g' && !e.def.heli) || f.st === 'carry') continue;
            if (Math.hypot(e.x - f.x, e.z - f.z) > 13 || e.y - GH(f.x, f.z) > 25) continue;
            if (e.team !== f.t && e.carry < 0) { f.st = 'carry'; f.by = e.id; e.carry = f.t; bcast({ t: 'flag', a: 'take', f: f.t, id: e.id, st: 'carry', x: r1(f.x), z: r1(f.z), by: e.id }); break; }
            if (e.team === f.t && f.st === 'drop') { f.st = 'home'; f.x = FLAG_HOME[f.t].x; f.z = FLAG_HOME[f.t].z; e.score += 50; bcast({ t: 'flag', a: 'ret', f: f.t, id: e.id, st: 'home', x: f.x, z: f.z, by: -1 }); break; }
        }
    }
    for (const e of EN.values()) {      // bring the enemy flag home while your own flag is home
        if (!e.alive || e.carry < 0 || e.team > 1) continue;
        const home = FLAG_HOME[e.team], own = M.flags[e.team];
        if (own.st === 'home' && Math.hypot(e.x - home.x, e.z - home.z) < 15) {
            const f = M.flags[e.carry]; e.carry = -1; f.st = 'home'; f.x = FLAG_HOME[f.t].x; f.z = FLAG_HOME[f.t].z; f.by = -1;
            M.caps[e.team]++; e.flags++; e.score += 300;
            bcast({ t: 'flag', a: 'cap', f: f.t, id: e.id, st: 'home', x: f.x, z: f.z, by: -1, c: M.caps });
            hostCheckEnd();
        }
    }
}
function hostStep(dt) {
    if (!M || M.over) return;
    M.t += dt;
    for (const e of EN.values()) {
        e.budget = Math.min(e.def.maxDps * 6, e.budget + e.def.maxDps * 2 * dt);
        if (e.crashed && e.alive && e.ai) { e.crashed = false; e.hp = 0; hostKill(e.id, -1, 'crash'); }
        if (e.ai && !e.alive) { e.respT -= dt; if (e.respT <= 0) botRespawn(e); }
    }
    if (M.mode === 'conq') {
        const n = [0, 0];
        M.pts.forEach((p, i) => {
            const c = [0, 0], ids = [[], []];
            for (const e of EN.values()) if (e.alive && e.team < 2 && Math.hypot(e.x - PTS[i].x, e.z - PTS[i].z) < CAP_R && e.y < PTS[i].y + 70 && e.dive < .5) { c[e.team]++; ids[e.team].push(e.id); }
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
    if (M.mode === 'ctf') hostCtf(dt);
    msT -= dt; if (msT <= 0) {
        msT = .25; hpT -= .25;
        const m = { t: 'm', tk: M.tickets.map(x => Math.round(x * 10) / 10), kl: M.kills, cp: M.caps, pts: M.pts.map(p => [p.own, Math.round(p.prog * 100) / 100]), tm: Math.round(M.t * 10) / 10, fl: M.mode === 'ctf' ? M.flags.map(f => [f.st, r1(f.x), r1(f.z), f.by]) : 0 };
        if (hpT <= 0) { hpT = 1; m.hp = []; m.pg = []; m.sc = []; for (const e of EN.values()) { m.hp.push([e.id, Math.max(0, Math.round(e.hp)), e.alive ? 1 : 0]); if (!e.isBot) m.pg.push([e.id, e === ME ? 0 : Math.round(e.q || 0), e.stale || e.recon ? 1 : 0]); m.sc.push([e.id, e.kills, e.deaths, Math.round(e.score), e.caps, e.flags]); } }
        bcast(m, true);
    }
    hostCheckEnd();
}
function hostCheckEnd() {
    if (!M || M.over || !M.host) return;
    let w = -2; const L = M.limit;
    if (M.mode === 'tdm') { if (M.kills[0] >= L.kills) w = 0; else if (M.kills[1] >= L.kills) w = 1; }
    else if (M.mode === 'conq') { if (M.tickets[0] <= 0) w = 1; else if (M.tickets[1] <= 0) w = 0; }
    else if (M.mode === 'ctf') { if (M.caps[0] >= L.caps) w = 0; else if (M.caps[1] >= L.caps) w = 1; }
    else if (M.mode === 'ffa') { for (const e of EN.values()) if (e.kills >= L.kills) { w = e.team; break; } }
    if (w === -2 && M.t >= L.time) {
        if (M.mode === 'ffa') { const top = Array.from(EN.values()).sort((a, b) => b.kills - a.kills || b.score - a.score); w = top[0] ? top[0].team : -1; }
        else { const a = M.mode === 'tdm' ? M.kills : M.mode === 'ctf' ? M.caps : M.tickets; w = a[0] > a[1] ? 0 : a[1] > a[0] ? 1 : -1; }
    }
    if (w !== -2) endMatch(w);
}
function endMatch(win) {
    if (!M || M.over) return;
    const stats = Array.from(EN.values()).map(e => [e.id, e.kills, e.deaths, Math.round(e.score + 0), Math.round(e.dmg), e.caps, e.flags]);
    const best = stats.slice().sort((a, b) => b[3] - a[3] || b[1] - a[1])[0];
    bcast({ t: 'end', win, stats, kl: M.kills, tk: M.tickets.map(x => Math.round(x)), cp: M.caps, mvp: best ? best[0] : -1 });
}
function botRespawn(e) {
    const refs = Array.from(EN.values()).filter(o => !o.isBot && !o.ai).map(o => o.def), bm = M && M.cfg && M.cfg.bm || 'match';
    if (refs.length && (bm === 'match' || Math.random() < .5)) { const d = pickBotDef(refs, bm === 'off' ? 'match' : bm); if (d !== e.def) setDef(e, d); }      // follow the humans into whatever domain they are in now
    e.kdone = false; spawnEnt(e); if (e.ai) aiReset(e);
}
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
function sendBots() {
    const rows = []; for (const e of EN.values()) if (e.ai && e.alive) rows.push([e.id, e.def.i, e.def.mask | 0, r1(e.x), r1(e.y), r1(e.z), r2(e.yaw), r2(e.pitch), r2(e.roll), r2(e.tur), r2(e.gun), Math.round(e.hp), 1, e.fl, r2(e.dive), r1(e.speed)]);
    if (netOn() && rows.length) PARTY.net.send('all', { t: 'b', ts: Math.round(performance.now()), r: rows }, { fast: true });
}
function myDelay() { let s = 0, n = 0; for (const k in CLK) { s += CLK[k].delay; n++; } return n ? Math.round(s / n) : 100; }
function sendState() {
    if (!ME || !netOn()) return;
    const e = ME; PARTY.net.send('all', { t: 's', ts: Math.round(performance.now()), i: e.def.i, mm: e.def.mask | 0, x: r1(e.x), y: r1(e.y), z: r1(e.z), a: r2(e.yaw), p: r2(e.pitch), r: r2(e.roll), u: r2(e.tur), g: r2(e.gun), l: e.alive ? 1 : 0, f: e.fl, dv: r2(e.dive), sp: r1(e.speed), d: myDelay(), q: Math.round(PARTY.rtt || 0) }, { fast: true });
}
// remote vehicle state (a player's own state or a bot row): goes into that vehicle's snapshot buffer
function applyRemote(e, sid, ts, s) {
    if (!e || e === ME || e.ai) return;
    const b = VEHS[s.i]; if (b && ((e.def.base || e.def) !== b || (e.def.mask | 0) !== (s.mm | 0))) setDef(e, vdef(s.i, s.mm));
    if (s.q !== undefined) { e.q = s.q; e.d = s.d; }
    if (s.l && !e.alive && (!M.host || e.kdone || !e.dieT || simTime - e.dieT > 2)) { e.alive = true; e.kdone = false; e.mdl.root.visible = true; e.dieT = 0; e.prot = SPAWN_PROT; e.hp = e.def.hp; e.sb.length = 0; e.carry = -1; e.budget = e.def.maxDps * 3; }
    if (!e.alive) return;
    if (s.h !== undefined && !M.host) e.hp = s.h;
    pushSnap(e, sid, ts, { x: s.x, y: s.y, z: s.z, a: s.a, p: s.p, r: s.r, u: s.u, g: s.g, fl: s.f, dv: s.dv, sp: s.sp });
}
// full state for a player who joins late, comes back after a reload, or asks after a long drop
function syncState() {
    return { t: 'sync', tm: M.t, kl: M.kills, tk: M.tickets, cp: M.caps, pts: M.pts.map(p => [p.own, p.prog]), fl: M.flags.map(f => [f.st, r1(f.x), r1(f.z), f.by]),
        e: Array.from(EN.values()).map(e => [e.id, e.def.i, e.def.mask | 0, e.team, e.alive ? 1 : 0, Math.round(e.hp), e.kills, e.deaths, Math.round(e.score), Math.round(e.dmg), e.caps, e.flags, r1(e.x), r1(e.y), r1(e.z), r2(e.yaw), r1(Math.max(0, e.respT || 0)), e.isBot ? 1 : 0, e.name, e.carry]) };
}
function currentCfg() {
    const c = Object.assign({}, M.cfg); c.players = []; c.bots = [];
    for (const e of EN.values()) (e.isBot ? c.bots : c.players).push({ id: e.id, name: e.name, veh: (e.def.base || e.def).id, mm: e.def.mask | 0, team: e.team, dead: !e.alive });
    return c;
}
function applySync(m) {
    if (!M) return;
    M.t = m.tm; M.kills = m.kl; M.tickets = m.tk; M.caps = m.cp || [0, 0];
    m.pts.forEach((p, i) => { if (M.pts[i]) { M.pts[i].own = p[0]; M.pts[i].prog = p[1]; } }); updatePointViz(M.pts);
    if (m.fl) m.fl.forEach((f, i) => { const F = M.flags[i]; if (F) { F.st = f[0]; F.x = f[1]; F.z = f[2]; F.by = f[3]; } });
    const seen = new Set();
    for (const r of m.e) {
        const [id, di, mm, team, alive, hp, kills, deaths, score, dmg, caps, flags, x, y, z, yaw, respT, bot, name, carry] = r; seen.add(id);
        let e = EN.get(id);
        if (!e) { e = newEnt(id, vdef(di, mm), team, name); e.isBot = !!bot; e.remote = id !== M.meId; }
        else if ((e.def.base || e.def).i !== di || (e.def.mask | 0) !== mm) setDef(e, vdef(di, mm));
        if (e.team !== team) { e.team = team; attachModel(e); }
        Object.assign(e, { kills, deaths, score, dmg, caps, flags, hp, carry: carry === undefined ? -1 : carry, name });
        if (e === ME) {
            Object.assign(M.my, { kills, deaths, caps, flags, dmg });
            if (!alive) { ME.alive = false; ME.mdl.root.visible = false; ME.respT = Math.max(respT, 1); UI.died(null, 'sync'); }
            else if (!ME.alive) { ME.alive = true; ME.mdl.root.visible = true; ME.x = x; ME.y = y; ME.z = z; ME.yaw = yaw; ME.tur = yaw; UI.deployed(); }
        } else {
            e.isBot = !!bot; e.remote = true; e.ai = null;
            e.alive = !!alive; e.mdl.root.visible = !!alive; e.sb.length = 0; e.x = x; e.y = y; e.z = z; e.yaw = yaw; e.tur = yaw; if (alive) applyAnim(e, 0);
        }
    }
    for (const e of Array.from(EN.values())) if (!seen.has(e.id) && e !== ME) removeEnt(e);
}
// ---------- late join / rejoin on the host ----------
function hostAddPlayer(peer) {
    if (!M || !M.host || M.over) return;
    const info = peer.info || {}, veh = VBY[info.veh] ? info.veh : 'g1a', mm = info.mm | 0;
    let e = EN.get(peer.id);
    if (e) {      // rejoin: the vehicle (driven by a bot meanwhile) goes back to its owner, score kept
        e.ai = null; e.isBot = false; e.remote = true; e.name = String(peer.name || e.name).replace(/ \(bot\)$/, '').slice(0, 16); e.sb.length = 0; e.recon = false;
        bcast({ t: 'addp', p: { id: e.id, name: e.name, veh: (e.def.base || e.def).id, mm: e.def.mask | 0, team: e.team }, back: 1 });
    } else {
        let team;
        if (M.mode === 'ffa') { team = 2; for (const o of EN.values()) team = Math.max(team, o.team + 1); }
        else { const h = [0, 0], all = [0, 0]; for (const o of EN.values()) { all[o.team]++; if (!o.isBot) h[o.team]++; } team = h[0] < h[1] ? 0 : h[1] < h[0] ? 1 : all[0] <= all[1] ? 0 : 1; }
        const bot = Array.from(EN.values()).find(o => o.isBot && o.team === team) || (M.mode === 'ffa' ? Array.from(EN.values()).find(o => o.isBot) : null);
        let rm = -1; if (bot) { rm = bot.id; if (M.mode === 'ffa') team = bot.team; removeEnt(bot); }
        e = newEnt(peer.id, vdef(veh, mm), team, String(peer.name || 'Player').slice(0, 16)); e.remote = true; e.carry = -1;
        spawnEnt(e); e.alive = false; e.mdl.root.visible = false; e.respT = 2; e.kdone = true; e.dieT = simTime;
        bcast({ t: 'addp', p: { id: e.id, name: e.name, veh, mm, team, dead: 1 }, rm });
    }
    PARTY.net.send(peer.id, { t: 'start', late: 1, cfg: currentCfg(), sync: syncState() });
}
function hostPlayerGone(id) {      // a guest left or timed out mid-match: a bot drives their vehicle until they come back
    const e = M && EN.get(id); if (!e || M.over || e.isBot) return;
    e.remote = false; e.isBot = true; aiNew(e); if (!/ \(bot\)$/.test(e.name)) e.name += ' (bot)';
    bcast({ t: 'remp', id, name: e.name });
}
function handleMatchMsg(from, m, local) {
    switch (m.t) {
        case 's': if (M && from !== M.meId) applyRemote(EN.get(from), from, m.ts, m); break;
        case 'b': if (M && !M.host) for (const r of m.r) applyRemote(EN.get(r[0]), 'h', m.ts, { i: r[1], mm: r[2], x: r[3], y: r[4], z: r[5], a: r[6], p: r[7], r: r[8], u: r[9], g: r[10], h: r[11], l: r[12], f: r[13], dv: r[14], sp: r[15] }); break;
        case 'm': if (M && !M.host) {
            M.tickets = m.tk; M.kills = m.kl; M.caps = m.cp || M.caps; M.t = m.tm; M.lastM = performance.now();
            m.pts.forEach((p, i) => { if (M.pts[i]) { M.pts[i].own = p[0]; M.pts[i].prog = p[1]; } }); updatePointViz(M.pts);
            if (m.fl) m.fl.forEach((f, i) => { const F = M.flags[i]; F.st = f[0]; F.x = f[1]; F.z = f[2]; F.by = f[3]; });
            if (m.hp) for (const [id, hp] of m.hp) { const e = EN.get(id); if (e && e.alive) e.hp = hp; }
            if (m.pg) for (const [id, q, st] of m.pg) { const e = EN.get(id); if (e) { e.q = q; e.recon = !!st; } }
            if (m.sc) for (const [id, k, d, s, c, f] of m.sc) { const e = EN.get(id); if (e) { e.kills = k; e.deaths = d; e.score = s; e.caps = c; e.flags = f; } }
        } break;
        case 'fire': if (M && !local) {
            const e = EN.get(m.id); if (!e || e === ME) break;
            if (M.host && !e.ai) { const o = owlOf(e); remoteShot(e, m.w, m.ps, m.tg, o / 1000, o + (e.d || 100)); }
            else if (!M.host) remoteShot(e, m.w, m.ps, m.tg, clamp((PARTY.rtt || 80) / 2000, 0, .2));
        } break;
        case 'flr': if (M && !local) { const e = EN.get(m.id); if (e && e !== ME) { e.flareT = 2.5; e.flareId++; for (let i = 0; i < 6; i++) part(e.x, e.y - 1, e.z, rnd(-14, 14), rnd(-6, 4), rnd(-14, 14), .9, 2.2, 0xffe6a0, 4, .9); } } break;
        case 'hit': if (M && M.host && !local) hostDamage(from, m.tg, m.d, m.p, m.w, false); break;
        case 'dmg': onDmg(m); break;
        case 'died': if (M && M.host && !local) { const v = EN.get(from); if (v && v.alive && m.w === 'crash') { v.hp = 0; hostKill(from, -1, 'crash'); } } break;
        case 'kill': onKill(m); break;
        case 'cap': onCap(m); break;
        case 'flag': onFlag(m); break;
        case 'addp': if (M && !local) {
            if (m.rm >= 0) { const b = EN.get(m.rm); if (b) removeEnt(b); }
            const p = m.p; let e = EN.get(p.id);
            if (!e && p.id !== M.meId) { e = newEnt(p.id, vdef(p.veh, p.mm), p.team, p.name); e.remote = true; e.carry = -1; spawnEnt(e); if (p.dead) { e.alive = false; e.mdl.root.visible = false; } }
            if (e) { e.isBot = false; e.name = p.name; }
            UI.feedText(p.name + (m.back ? ' is back' : ' joined the battle'), p.team);
        } break;
        case 'remp': if (M && !local) { const e = EN.get(m.id); if (e) { e.isBot = true; e.name = m.name; } UI.feedText(m.name.replace(/ \(bot\)$/, '') + ' lost connection (a bot takes over)', -1); } break;
        case 'sync': if (M && !M.host) applySync(m); break;
        case 'sync?': if (M && M.host && !local && netOn()) PARTY.net.send(from, syncState()); break;
        case 'pg': if (M && M.host && !local && netOn()) PARTY.net.send(from, { t: 'po', c: m.c }, { fast: true }); break;
        case 'po': { const r = performance.now() - m.c; if (r >= 0 && r < 20000) PARTY.rtt = PARTY.rtt ? PARTY.rtt * .7 + r * .3 : r; } break;
        case 'quit': if (M && M.host && !local) hostPlayerGone(from); break;
        case 'end': finishMatch(m); break;
    }
}
// ---------- me ----------
function meDied(by, w) {      // only crashes are decided locally; everything else comes from the host
    const e = ME; if (!e || !e.alive) return;
    if (M.host) { e.hp = 0; hostKill(e.id, by, w); }
    else { killVisual(e); e.hp = 0; e.respT = 5; toHost({ t: 'died', by, w }); UI.died(EN.get(by), w); }
}
function respawnMe(vid) {
    const d = VBY[vid] ? vdef(vid, modMask(vid)) : null; if (!d || !ME || ME.alive || !M || M.over) return false;
    if (d !== ME.def) setDef(ME, d); ME.kdone = false; ME.carry = -1; spawnEnt(ME); M.my.tier = Math.max(M.my.tier, d.t); UI.deployed(); return true;
}
// ---------- the end: rewards and results ----------
function finishMatch(m) {
    if (!M || M.over) return;
    M.over = true; M.state = 'end'; M.winner = m.win; M.mvp = m.mvp; if (!M.host) { M.kills = m.kl; if (M.mode === 'conq') M.tickets = m.tk; if (m.cp) M.caps = m.cp; }
    for (const r of m.stats) { const e = EN.get(r[0]); if (e) { e.kills = r[1]; e.deaths = r[2]; e.score = r[3]; e.dmg = r[4] || e.dmg; e.caps = r[5] || 0; e.flags = r[6] || 0; } }
    const my = M.my;
    if (ME) { my.kills = ME.kills; my.deaths = ME.deaths; my.caps = ME.caps; my.flags = ME.flags; my.dmg = Math.max(my.dmg, ME.dmg); }
    const win = ME && m.win === ME.team, draw = m.win === -1, mvp = ME && m.mvp === ME.id, tk = 1 + .25 * (my.tier - 1), part = clamp(M.t / 90, .15, 1), rk = 1 + .15 * (my.tier - 1);
    const cr = Math.round((my.kills * 110 * tk + my.caps * 180 + my.flags * 350 + my.dmg * .25 + (win ? 450 : draw ? 150 : 120)) * part * (mvp ? 1.25 : 1));
    const rp = Math.round((my.kills * 28 + my.caps * 45 + my.flags * 90 + my.dmg / 18 + (win ? 120 : 35)) * part * rk * (mvp ? 1.25 : 1));
    save.credits += cr; addRp(rp);
    const s = save.stats; s.matches++; if (win) s.wins++; s.kills += my.kills; s.deaths += my.deaths; s.caps += my.caps; s.flags = (s.flags || 0) + my.flags; if (mvp) s.mvp = (s.mvp || 0) + 1; writeSave();
    M.reward = { cr, rp, win, draw, mvp };
    sfx(win ? 'win' : 'lose'); engineStop();
    UI.showResult();
}
