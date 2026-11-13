// ============================================================
// BOT AI: steering per class. Attack the best enemy for my class, otherwise play the objective (points / flags) or patrol.
// Bots only run on the match host (or in solo). They produce the same control struct the player does.
// ============================================================
// ---- difficulty: reaction time before a bot opens fire on a new target, how wrong its aim starts (e0, radians) and how good it gets
// while it keeps tracking (e1, never zero; tau = seconds to get there), burst / pause lengths, firing range scale, how well it leads
// a moving target, and a damage scale. Normal is tuned so an average player beats a bot of the same vehicle more often than not.
const BOTD = {
    easy: { react: [1.1, 1.8], e0: .075, e1: .03, tau: 4, burst: [.6, 1], cd: [2.4, 3.6], rng: .6, lead: [.3, .6], dmg: .55, turn: .7 },
    normal: { react: [.6, 1.2], e0: .055, e1: .018, tau: 3.5, burst: [.7, 1.2], cd: [1.8, 2.8], rng: .72, lead: [.5, .8], dmg: .75, turn: .85 },
    hard: { react: [.35, .7], e0: .035, e1: .009, tau: 3, burst: [.9, 1.5], cd: [.9, 1.6], rng: .85, lead: [.7, .95], dmg: .95, turn: 1 }
};
const aiDiff = () => BOTD[M && M.cfg && M.cfg.diff] || BOTD.normal;
function aiAcquire(e, t) {      // a new target: wait a human-ish moment before shooting, start with a sloppy aim
    const a = e.ai, D = aiDiff(); a.tgt = t; a.react = t ? rnd(D.react[0], D.react[1]) : 0; a.track = 0; a.lead = rnd(D.lead[0], D.lead[1]); a.bOn = false; a.bT = 0; a.cdT = rnd(0, .5); a.lostT = 0;
}
function aiReset(e) { const a = e.ai; a.tgt = null; a.brk = 0; a.react = 0; a.track = 0; a.bOn = false; a.bT = 0; a.cdT = 0; a.rkCd = 0; a.bmCd = 0; a.flee = a.fcd = 0; a.rkN = a.bmN = 0; a.lostT = 0; a.tT = rnd(.1, .5); a.msCd = rnd(2, 5); a.role = Math.random(); }
function aiErr(e, dt) {         // aim error (radians): shrinks the longer the bot keeps tracking, never reaches zero; drifts, so it is not a fixed offset
    const a = e.ai, D = aiDiff(); a.track += dt;
    const k = (D.e1 + (D.e0 - D.e1) * Math.exp(-a.track / D.tau)) * (1.5 - a.skill) * (e.def.ln === 'g' ? 1.7 : e.def.ln === 'n' ? 1.4 : .55);
    a.eT -= dt; if (a.eT <= 0) { a.eT = rnd(.3, .7); a.gy = (Math.random() < .5 ? -1 : 1) * rnd(.4, 1) * k; a.gp = (Math.random() < .5 ? -1 : 1) * rnd(.4, 1) * k; }
    const f = Math.min(1, dt * 5); a.ey += ((a.gy || 0) - a.ey) * f; a.ep += ((a.gp || 0) - a.ep) * f; return k;
}
function aiTrigger(e, dt, rl, seen, ready) {     // burst fire: reaction time, then bursts with pauses in between (reloads are still enforced by weaponFire)
    const a = e.ai, D = aiDiff();
    if (!seen) return false;
    if (a.react > 0) { a.react -= dt; return false; }
    if (a.cdT > 0) { a.cdT -= dt; return false; }
    if (!ready) return false;
    if (!a.bOn) { a.bOn = true; a.bT = rnd(D.burst[0], D.burst[1]) * (rl < .2 ? 1.6 : 1); }
    a.bT -= dt; if (a.bT <= 0) { a.bOn = false; a.cdT = rnd(D.cd[0], D.cd[1]) * (rl > 1 ? .8 : rl < .2 ? .35 : 1); }
    return true;
}
function aiNew(e) {
    e.ai = { tgt: null, tT: Math.random() * .5, skill: rnd(.55, .9), ey: 0, ep: 0, eT: 0, side: Math.random() < .5 ? -1 : 1, rev: 0, lx: e.x, lz: e.z, sT: 1.5, wp: null, wpT: 0, brk: 0, brkT: 0, turnDir: 1, react: rnd(.6, 1.2), track: 0, lead: .7, bOn: false, bT: 0, cdT: 0, lostT: 0, rkCd: 0, bmCd: 0, rkN: 0, bmN: 0, flee: 0, fcd: 0, gy: 0, gp: 0, msCd: 3, role: Math.random(), pref: [rnd(0, 160), rnd(0, 160), rnd(0, 160)] };
    e.remote = false;
}
const d3 = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
function aiPickTarget(e) {
    const ln = e.def.ln, cls = e.def.cls, bomber = !!e.def.w3 && e.def.w3.k === 'bomb' && ln === 'a';
    let best = null, bs = 1e9; const mc = compOf(e.x, e.z);
    for (const o of EN.values()) {
        if (!o.alive || !foe(o, e) || o.prot > 0) continue;
        if (o.dive > .5 && !(e.def.radar && d3(e, o) < 250) && d3(e, o) > 120) continue;      // dived submarines are hidden
        const d = d3(e, o), ol = o.def.ln; let lim, pref = 1;
        if (cls === 'spaa') { if (ol === 'a') { lim = 520; pref = .4; } else { lim = 260; pref = 1.5; } }
        else if (cls === 'arty') { if (ol === 'a') continue; lim = ol === 'n' ? 800 : 1100; }
        else if (ln === 'g') { if (ol === 'a') { lim = 280; pref = 1.8; } else if (ol === 'n') lim = 380; else lim = compOf(o.x, o.z) === mc ? 1000 : 400; }
        else if (ln === 'n') { if (e.def.sub && ol !== 'n') continue; lim = ol === 'a' ? 260 : 650; if (ol === 'n') pref = .8; }
        else if (e.def.heli) { if (ol === 'a' && !o.def.heli) { lim = 300; pref = 1.6; } else lim = 600; }
        else if (ol === 'a') { lim = 800; pref = bomber ? 2 : .7; } else { lim = 800; pref = bomber ? .6 : 1.6; }
        if (M && M.mode === 'ctf' && o.carry >= 0 && o.carry !== undefined) pref *= .4;      // hunt the flag carrier
        const s = d * pref; if (d < lim && s < bs) { bs = s; best = o; }
    }
    return best;
}
function aiPassable(e, x, z) {
    const h = H(x, z), R = battleR();
    if (e.def.ln === 'n') return h < -4.5 && Math.abs(x) < R - 30 && Math.abs(z) < EXT - 30;
    if (h < 1.3 || h > 38 || Math.abs(x) > R - 20) return false;
    for (let i = 0; i < BLD.length; i++) { const b = BLD[i]; if (x > b.x0 - 5 && x < b.x1 + 5 && z > b.z0 - 5 && z < b.z1 + 5) return false; }
    return true;
}
function steerTo(e, c, gx, gz, spd) {
    const a = e.ai, sea = e.def.ln === 'n', L = sea ? 40 : 14, want = Math.atan2(gx - e.x, gz - e.z);
    if (a.rev > 0) { c.thr = -.8; c.steer = a.side; return; }
    let best = null; const s = a.side, offs = [0, .4 * s, -.4 * s, .85 * s, -.85 * s, 1.3 * s, -1.3 * s, 1.9 * s, -1.9 * s, 2.7 * s];
    for (const o of offs) {
        const ang = want + o, sx = Math.sin(ang), cz = Math.cos(ang);
        if (aiPassable(e, e.x + sx * L, e.z + cz * L) && aiPassable(e, e.x + sx * L * 2, e.z + cz * L * 2) && aiPassable(e, e.x + sx * L * .5, e.z + cz * L * .5)) { best = ang; break; }
    }
    if (best === null) { a.rev = 1.2; a.side = -a.side; c.thr = -.8; c.steer = a.side; return; }
    const err = angDiff(e.yaw, best);
    c.steer = clamp(-err * 2.2, -1, 1); c.thr = (Math.abs(err) > 1.2 ? .15 : 1) * spd;
}
function aiAim(e, c, t, dt, high) {          // turret aim at the target with imperfect lead and an aim error that shrinks while tracking
    const a = e.ai, w = e.def.w1;
    aiErr(e, dt);
    const m = e.mdl ? muzzleWorld(e, 0) : e, D = d3(e, t), v = w.v || 200, tt = D / v * a.lead * (high ? 2.2 : 1), py = t.y + (t.def.ln === 'a' ? 0 : 1.2);
    const b = ballistic(m.x, m.y, m.z, t.x + t.vx * tt, py + t.vy * tt, t.z + t.vz * tt, v, w.g, high);
    c.aimYaw = b.yaw + a.ey; c.aimPitch = b.pitch + a.ep * (high ? .4 : 1); a.solOk = b.ok; return D;
}
function hasLOS(e, t) {         // is there open air between me and the target (hills and houses block shells)?
    const x0 = e.x, y0 = e.y + 2.5, z0 = e.z, x1 = t.x, y1 = t.y + (t.def.ln === 'a' ? 0 : 1.5), z1 = t.z, n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 10);
    for (let i = 1; i < n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k; if (y0 + (y1 - y0) * k < GH(x, z) + .3) return false; }
    return true;
}
// where a ground bot goes when it is not fighting: capture points, flags, or a wander point on its side
function aiObjective(e) {
    const a = e.ai;
    if (M && M.mode === 'conq') { let bd = 1e9, tp = null; M.pts.forEach((p, i) => { if (p.own === e.team && Math.abs(p.prog) > .98) return; const dd = Math.hypot(PTS[i].x - e.x, PTS[i].z - e.z) + (a.pref ? a.pref[i] : 0); if (dd < bd) { bd = dd; tp = PTS[i]; } }); if (tp) return tp; }
    if (M && M.mode === 'ctf' && M.flags && e.team < 2) {
        const mine = M.flags[e.team], theirs = M.flags[1 - e.team];
        if (e.carry !== undefined && e.carry >= 0) return FLAG_HOME[e.team];
        if (mine.st === 'drop') return mine;
        if (a.role < .55 && theirs.st !== 'carry') return theirs;
        if (mine.st === 'carry') { const c = EN.get(mine.by); if (c) return c; }
    }
    if (!a.wp || (a.wpT -= 1 / 30) < 0 || Math.hypot(a.wp.x - e.x, a.wp.z - e.z) < 20) { a.wp = { x: rnd(-150, 150) + (M && M.mode === 'ffa' ? 0 : e.team ? 60 : -60), z: rnd(-120, 120) }; a.wpT = 25; }
    return a.wp;
}
function aiSurface(e, dt, c) {
    const a = e.ai, d = e.def, sea = d.ln === 'n', cls = d.cls, t = a.tgt && a.tgt.alive ? a.tgt : null, arty = cls === 'arty';
    c.aimYaw = e.tur; c.aimPitch = 0;
    const DD = aiDiff(), rng = (sea ? 430 : arty ? 1000 : cls === 'spaa' && t && t.def.ln === 'a' ? 480 : 310) * DD.rng; let los = false, D = 1e9;
    a.losT = (a.losT || 0) - dt; if (t && a.losT <= 0) { a.losT = .3; a.los = hasLOS(e, t); }
    if (t) {
        D = aiAim(e, c, t, dt, arty && !a.los);
        los = !!a.los || arty;
        const aligned = Math.abs(angDiff(e.tur, c.aimYaw)) < .05 + (1 - a.skill) * .04 + (arty ? .03 : 0) && Math.abs(e.gun - clamp(c.aimPitch, -.14, d.el || .5)) < .06 + (arty ? .04 : 0);
        if (!los) a.lostT += dt; else { if (a.lostT > 1) a.react = Math.max(a.react, rnd(.3, .6)); a.lostT = 0; }
        if (los && D < rng && (!arty || a.solOk) && aiTrigger(e, dt, d.w1.rl, true, aligned)) { c.f1 = true; if (D < 150 * DD.rng / .72 && d.w2) c.f2 = true; }
        // guided missiles / torpedoes (w3) and missile primaries
        a.msCd -= dt;
        const w3 = d.w3;
        if (w3 && e.a3 > 0 && a.msCd <= 0 && a.react <= 0) {
            if (w3.k === 'torp' && t.def.ln === 'n' && D < 420 && Math.abs(angDiff(e.tur, c.aimYaw)) < .1) { c.f3 = true; a.msCd = rnd(3, 6); c.aimYaw = Math.atan2(t.x + t.vx * D / w3.v - e.x, t.z + t.vz * D / w3.v - e.z); e.tur = c.aimYaw; }
            else if (w3.k === 'missile' && (w3.air ? t.def.ln === 'a' : w3.sea ? t.def.ln === 'n' : t.def.ln !== 'a' || t.def.heli) && D < 700 && los) { c.f3 = true; c.tgt = t.id; a.msCd = rnd(4, 8); }
        }
        if (d.w1.k === 'missile') c.tgt = t.id;
        // submarines dive while stalking, surface to use the deck gun when nothing is near
        if (d.sub) e.diveOn = D < 700 && (e.a3 > 0 || D < 250);
    } else if (d.sub) e.diveOn = false;
    if (d.flares && e.flareT <= 0) for (const p of PR) if (p.k === 'missile' && p.tg === e.id && Math.hypot(p.x - e.x, p.z - e.z) < 220) { dropFlares(e); break; }
    // where to go: engage a visible surface enemy, otherwise the objective
    const surf = t && t.def.ln !== 'a' && (sea || compatLand(e, t));
    let gx, gz, spd = 1, hold = false;
    if (arty) {      // artillery hangs back behind its own lines
        const R = battleR(), hx = (e.team === 0 ? -1 : 1) * Math.min(330, R - 80);
        if (!a.wp || a.wpT-- < 0) { a.wp = { x: hx + rnd(-40, 40), z: rnd(-80, 80) }; a.wpT = 900; }
        gx = a.wp.x; gz = a.wp.z; if (Math.hypot(gx - e.x, gz - e.z) < 25) { spd = 0; hold = true; }
    }
    else if (surf && los && D < (sea ? rng * .85 : Math.min(150 + a.skill * 60, rng * .85))) { hold = true; gx = t.x; gz = t.z; spd = D < (sea ? 150 : 70) ? -.4 : 0; }
    else if (surf && D < 520 && (!M || M.mode !== 'conq' || D < 200 || !los) && !(M && M.mode === 'ctf' && e.carry >= 0)) { gx = t.x; gz = t.z; spd = 1; }
    else if (sea) {
        if (!a.wp || Math.hypot(a.wp.x - e.x, a.wp.z - e.z) < 70 || (a.wpT -= dt) < 0) { const zs = e.z < 0 ? -1 : 1, R = battleR(); a.wp = { x: rnd(-Math.min(300, R - 100), Math.min(300, R - 100)), z: zs * rnd(470, 560) }; a.wpT = 40; }
        gx = a.wp.x; gz = a.wp.z;
    } else {
        const tp = aiObjective(e);
        gx = tp.x; gz = tp.z; if (Math.hypot(gx - e.x, gz - e.z) < 24 && tp.name) { spd = 0; hold = true; }
        if (!t) c.aimYaw = Math.atan2(gx - e.x, gz - e.z);
    }
    steerTo(e, c, gx, gz, spd);
    if (hold && spd <= 0.01) { c.thr = spd; c.steer = 0; if (spd === 0 && t && !sea && !arty) { a.stT = (a.stT || 0) - dt; if (a.stT <= 0) { a.stT = rnd(1.5, 3); a.strafe = Math.random() < .5 ? -.6 : .6; } c.thr = .3; c.steer = a.strafe || 0; } }
    else if (spd < 0 && !a.rev) { c.thr = spd; c.steer = 0; }
    a.sT -= dt; if (a.sT <= 0) { a.sT = 1.5; if (Math.hypot(e.x - a.lx, e.z - a.lz) < 1.5 && c.thr > .5) { a.rev = 1.3; a.side = -a.side; } a.lx = e.x; a.lz = e.z; }
    if (a.rev > 0) a.rev -= dt;
}
function compatLand(e, t) { return t.def.ln === 'a' || compOf(e.x, e.z) === compOf(t.x, t.z) || Math.hypot(e.x - t.x, e.z - t.z) < 350; }
function aiAir(e, dt, c) {
    const a = e.ai, d = e.def, t = a.tgt && a.tgt.alive ? a.tgt : null, w = d.w1, bomber = !!d.w3 && d.w3.k === 'bomb', R = battleR();
    c.thr = 1; c.aimYaw = e.yaw; c.aimPitch = 0;
    const fx = Math.sin(e.yaw) * Math.cos(e.pitch), fy = Math.sin(e.pitch), fz = Math.cos(e.yaw) * Math.cos(e.pitch);
    if (a.brk > 0) {
        a.brk -= dt; c.aimYaw = e.yaw + a.turnDir * .9; c.aimPitch = clamp((160 - e.y) * .012, -.2, .35);
    } else if (t) {
        const DD = aiDiff(), D = d3(e, t), tt = D / (w.v + e.speed * .6) * (1 - (1 - a.lead) * .35), grd = t.def.ln !== 'a';
        const tx = t.x + t.vx * tt, tz = t.z + t.vz * tt; let ty = t.y + (grd ? (bomber ? 65 : 2) : t.vy * tt);
        const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, hd = Math.hypot(dx, dz);
        aiErr(e, dt);
        c.aimYaw = Math.atan2(dx, dz) + a.ey; c.aimPitch = Math.atan2(dy, hd) + a.ep;
        const LV = Math.hypot(dx, dy, dz) + .01, dot = (fx * dx + fy * dy + fz * dz) / LV;      // cos of the angle between my nose and the aim point
        a.flee -= dt; a.fcd -= dt;      // an enemy jet on my tail: run straight-ish for a moment instead of circling with it forever
        if (!grd && D < 320 && dot < -.2 && a.flee <= 0 && a.fcd <= 0) { a.flee = rnd(1.3, 2.2); a.fcd = a.flee + rnd(2, 3.5); }
        const fleeing = a.flee > 0; if (fleeing) { c.aimYaw = e.yaw + Math.sin(simTime * 2.4 + e.id) * .3; c.aimPitch = clamp((160 - e.y) * .01, -.15, .2); }
        const rA = 330 * DD.rng, miss = LV * Math.sqrt(Math.max(0, 1 - dot * dot)), onAim = dot > .9 && miss < 6.5 + D * .012, gunReady = bomber ? (D < rA * .9 && dot > .985 && grd) : (D < rA && onAim);
        const go = !fleeing && aiTrigger(e, dt, w.rl, D < rA * 1.6, gunReady);
        if (go) c.f1 = true;
        a.rkCd -= dt; a.bmCd -= dt;
        if (d.w2 && d.w2.k === 'missile') { if (!grd && D > 150 && D < 900 && dot > .8 && e.a2 > 0 && a.rkCd <= 0 && a.react <= 0) { c.f2 = true; c.tgt = t.id; a.rkCd = rnd(4, 8); } }
        else if (d.w2 && go && D > 120 && D < rA * 1.2 && e.a2 > 0 && a.rkCd <= 0 && e.t2 <= 0) { c.f2 = true; if (++a.rkN >= 2) { a.rkN = 0; a.rkCd = rnd(4, 7); } }
        if (bomber && grd && e.a3 > 0 && hd < 110 && a.bmCd <= 0 && a.react <= 0) { const hh = Math.max(10, e.y - t.y), adv = e.speed * Math.sqrt(2 * hh / d.w3.g); if (Math.abs(hd - adv) < 28 && dot > .8 && e.t3 <= 0) { c.f3 = true; if (++a.bmN >= 2) { a.bmN = 0; a.bmCd = rnd(4, 6); } } }
        if ((grd && bomber && hd < 45) || (D < 55 && !grd) || (grd && !bomber && D < 90 && e.y - t.y < 40)) { a.brk = rnd(1.1, 2); a.turnDir = Math.random() < .5 ? -1 : 1; a.bmN = 0; }
    } else {
        const dx = (a.wp ? a.wp.x : 0) - e.x, dz = (a.wp ? a.wp.z : 0) - e.z;
        if (!a.wp || Math.hypot(dx, dz) < 100) a.wp = { x: rnd(-.6, .6) * R, z: rnd(-300, 300) };
        c.aimYaw = Math.atan2(a.wp.x - e.x, a.wp.z - e.z); c.aimPitch = (100 - e.y) * .004;
    }
    if (d.flares && e.flareT <= 0) for (const p of PR) if (p.k === 'missile' && p.tg === e.id && Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z) < 300) { dropFlares(e); break; }
    // stay off the ground and inside the map
    const look = e.speed * 1.5, px = e.x + fx * look, pz = e.z + fz * look, py = e.y + fy * look, fl = Math.max(GH(px, pz), GH(e.x, e.z), 0);
    if (py < fl + 32 || e.y < fl + 22) { c.aimPitch = Math.max(c.aimPitch, .65); c.f1 = c.f2 = c.f3 = false; if (a.brk <= 0 && e.y < fl + 22) { c.aimYaw = e.yaw; } }
    if (Math.abs(e.x) > R - 50 || Math.abs(e.z) > R - 50) { c.aimYaw = Math.atan2(-e.x, -e.z); }
    if (e.y > 280) c.aimPitch = Math.min(c.aimPitch, -.2);
}
// helicopters: keep 35-70 m above the ground, close to ~280 m, hover and shoot, sidestep now and then
function aiHeli(e, dt, c) {
    const a = e.ai, d = e.def, t = a.tgt && a.tgt.alive ? a.tgt : null, gy = Math.max(GH(e.x, e.z), 0), R = battleR();
    let want = 45 + a.skill * 25, gx, gz;
    if (t) {
        const D = d3(e, t), hd = Math.hypot(t.x - e.x, t.z - e.z);
        aiErr(e, dt);
        const w = d.w1, tt = D / w.v * a.lead, tx = t.x + t.vx * tt, ty = t.y + (t.def.ln === 'a' ? 0 : 1.2) + t.vy * tt, tz = t.z + t.vz * tt;
        c.bodyYaw = Math.atan2(t.x - e.x, t.z - e.z); c.aimYaw = Math.atan2(tx - e.x, tz - e.z) + a.ey; c.aimPitch = Math.atan2(ty - e.y, Math.hypot(tx - e.x, tz - e.z)) + a.ep;
        c.thr = hd > 320 ? 1 : hd < 180 ? -.4 : 0; c.side = Math.sin(simTime * .5 + e.id) * .6;
        if (t.def.ln === 'a' && !t.def.heli) want = 60;
        const los = (a.losT = (a.losT || 0) - dt) > 0 ? a.los : (a.losT = .3, a.los = hasLOS(e, t));
        const aimed = Math.abs(angDiff(e.tur, c.aimYaw)) < .06 && Math.abs(e.gun - clamp(c.aimPitch, -1.1, .3)) < .06;
        if (los && D < 420 && aiTrigger(e, dt, w.rl, true, aimed)) c.f1 = true;
        a.rkCd -= dt; a.msCd -= dt;
        const nose = Math.abs(angDiff(e.yaw, c.bodyYaw)) < .08;
        if (d.w2 && los && nose && D < 380 && D > 90 && e.a2 > 0 && a.rkCd <= 0 && a.react <= 0 && t.def.ln !== 'a') { c.f2 = true; if (++a.rkN >= 3) { a.rkN = 0; a.rkCd = rnd(3, 6); } }
        if (d.w3 && d.w3.k === 'missile' && los && D < 650 && e.a3 > 0 && a.msCd <= 0 && a.react <= 0 && t.def.ln !== 'a') { c.f3 = true; c.tgt = t.id; a.msCd = rnd(4, 7); }
    } else {
        if (!a.wp || Math.hypot(a.wp.x - e.x, a.wp.z - e.z) < 40) { const tp = M && M.mode === 'conq' ? PTS[Math.floor(Math.random() * 3)] : { x: rnd(-.5, .5) * R, z: rnd(-150, 150) }; a.wp = { x: tp.x + rnd(-60, 60), z: tp.z + rnd(-60, 60) }; }
        gx = a.wp.x; gz = a.wp.z; c.bodyYaw = Math.atan2(gx - e.x, gz - e.z); c.aimYaw = c.bodyYaw; c.aimPitch = -.2; c.thr = Math.abs(angDiff(e.yaw, c.bodyYaw)) < .5 ? 1 : .2; c.side = 0;
    }
    // terrain ahead
    const ahead = Math.max(GH(e.x + Math.sin(e.yaw) * 40, e.z + Math.cos(e.yaw) * 40), 0);
    c.up = clamp((Math.max(gy, ahead) + want - e.y) * .08, -1, 1);
    if (Math.abs(e.x) > R - 40 || Math.abs(e.z) > R - 40) { c.bodyYaw = Math.atan2(-e.x, -e.z); c.thr = 1; }
    if (d.flares && e.flareT <= 0) for (const p of PR) if (p.k === 'missile' && p.tg === e.id && d3(p, e) < 250) { dropFlares(e); break; }
}
function aiStep(e, dt) {
    if (!e.ai) aiNew(e);
    if (e.frozen) { applyAnim(e, dt); return; }       // test hook: a bot that stands still
    const a = e.ai; if (a.tgt && (!a.tgt.alive || a.tgt.prot > 0)) { aiAcquire(e, null); a.tT = 0; }
    a.tT -= dt; if (a.tT <= 0) {
        a.tT = .6 + Math.random() * .3; const n = aiPickTarget(e), cur = a.tgt;
        if (n !== cur && !(cur && n && d3(e, cur) < d3(e, n) * 1.4 && d3(e, cur) < 900)) aiAcquire(e, n);      // keep the current target unless a much closer one shows up
    }
    e.turnK = aiDiff().turn;      // easier bots also bank a little slower
    const c = e.ctl; c.thr = 0; c.steer = 0; c.side = 0; c.up = 0; c.aimYaw = e.tur; c.aimPitch = 0; c.f1 = c.f2 = c.f3 = false; c.tgt = -1; c.bodyYaw = undefined;
    if (e.def.heli) aiHeli(e, dt, c); else if (e.def.ln === 'a') aiAir(e, dt, c); else aiSurface(e, dt, c);
    if (a.mute) c.f1 = c.f2 = c.f3 = false;
    stepVehicle(e, c, dt);
}
