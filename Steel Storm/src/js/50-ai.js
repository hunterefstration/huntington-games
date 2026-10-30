// ============================================================
// BOT AI: simple steering per branch. Attack the nearest enemy, otherwise capture points / patrol.
// Bots only run on the match host (or in solo). They produce the same control struct the player does.
// ============================================================
function aiNew(e) {
    e.ai = { tgt: null, tT: Math.random() * .5, skill: rnd(.55, .9), ey: 0, ep: 0, eT: 0, side: Math.random() < .5 ? -1 : 1, rev: 0, lx: e.x, lz: e.z, sT: 1.5, wp: null, wpT: 0, brk: 0, brkT: 0, turnDir: 1, react: rnd(.2, .6), pref: [rnd(0, 160), rnd(0, 160), rnd(0, 160)] };
    e.remote = false;
}
const d3 = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
function aiPickTarget(e) {
    const ln = e.def.ln, bomber = !!e.def.w3 && ln === 'a';
    let best = null, bs = 1e9; const mc = compOf(e.x, e.z);
    for (const o of EN.values()) {
        if (!o.alive || o.team === e.team) continue;
        const d = d3(e, o), ol = o.def.ln; let lim, pref = 1;
        if (ln === 'g') { if (ol === 'a') { lim = 280; pref = 1.8; } else if (ol === 'n') lim = 380; else lim = compOf(o.x, o.z) === mc ? 1000 : 400; }
        else if (ln === 'n') { lim = ol === 'a' ? 260 : 650; if (ol === 'n') pref = .8; }
        else if (ol === 'a') { lim = 800; pref = bomber ? 2 : .7; } else { lim = 800; pref = bomber ? .6 : 1.6; }
        const s = d * pref; if (d < lim && s < bs) { bs = s; best = o; }
    }
    return best;
}
function aiPassable(e, x, z) {
    const h = H(x, z);
    if (e.def.ln === 'n') return h < -4.5 && Math.abs(x) < EXT - 30 && Math.abs(z) < EXT - 30;
    if (h < 1.3 || h > 38) return false;
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
function aiAim(e, c, t) {          // turret aim at the target with lead and a bit of human error
    const a = e.ai, w = e.def.w1, sea = e.def.ln === 'n';
    a.eT -= .016; if (a.eT <= 0) { a.eT = .7; const k = (1 - a.skill) * .05 + .004; a.ey = rnd(-k, k); a.ep = rnd(-k, k); }
    const m = e.mdl ? muzzleWorld(e, 0) : e, D = d3(e, t), tt = D / w.v, py = t.y + (t.def.ln === 'a' ? 0 : 1.2);
    const b = ballistic(m.x, m.y, m.z, t.x + t.vx * tt, py + t.vy * tt, t.z + t.vz * tt, w.v, w.g);
    c.aimYaw = b.yaw + a.ey; c.aimPitch = b.pitch + a.ep; return D;
}
function hasLOS(e, t) {         // is there open air between me and the target (hills and houses block shells)?
    const x0 = e.x, y0 = e.y + 2.5, z0 = e.z, x1 = t.x, y1 = t.y + (t.def.ln === 'a' ? 0 : 1.5), z1 = t.z, n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 10);
    for (let i = 1; i < n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k; if (y0 + (y1 - y0) * k < GH(x, z) + .3) return false; }
    return true;
}
function aiSurface(e, dt, c) {
    const a = e.ai, d = e.def, sea = d.ln === 'n', t = a.tgt && a.tgt.alive ? a.tgt : null;
    c.aimYaw = e.tur; c.aimPitch = 0;
    const rng = sea ? 430 : 310; let los = false, D = 1e9;
    a.losT = (a.losT || 0) - dt; if (t && a.losT <= 0) { a.losT = .3; a.los = hasLOS(e, t); }
    if (t) {
        D = aiAim(e, c, t); los = !!a.los; a.react -= dt;
        const aligned = Math.abs(angDiff(e.tur, c.aimYaw)) < .05 + (1 - a.skill) * .04 && Math.abs(e.gun - clamp(c.aimPitch, -.14, sea ? .75 : .5)) < .06;
        if (los && D < rng && aligned && a.react <= 0) { c.f1 = true; if (Math.random() < .3) a.react = rnd(0, .5); }
        if (los && D < 230 && aligned) c.f2 = true;
    }
    // where to go: engage a visible surface enemy, otherwise the objective
    const surf = t && t.def.ln !== 'a' && (sea || compatLand(e, t));
    let gx, gz, spd = 1, hold = false;
    if (surf && los && D < (sea ? 320 : 150 + a.skill * 60)) { hold = true; gx = t.x; gz = t.z; spd = D < (sea ? 150 : 70) ? -.4 : 0; }
    else if (surf && D < 520 && (!M || M.mode !== 'conq' || D < 200 || !los)) { gx = t.x; gz = t.z; spd = 1; }
    else if (sea) {
        if (!a.wp || Math.hypot(a.wp.x - e.x, a.wp.z - e.z) < 70 || (a.wpT -= dt) < 0) { const zs = e.z < 0 ? -1 : 1; a.wp = { x: rnd(-300, 300), z: zs * rnd(470, 560) }; a.wpT = 40; }
        gx = a.wp.x; gz = a.wp.z;
    } else {
        let tp = null;
        if (M && M.mode === 'conq') { let bd = 1e9; M.pts.forEach((p, i) => { if (p.own === e.team && Math.abs(p.prog) > .98) return; const dd = Math.hypot(PTS[i].x - e.x, PTS[i].z - e.z) + (a.pref ? a.pref[i] : 0); if (dd < bd) { bd = dd; tp = PTS[i]; } }); }
        if (!tp) { if (!a.wp || (a.wpT -= dt) < 0 || Math.hypot(a.wp.x - e.x, a.wp.z - e.z) < 20) { a.wp = { x: rnd(-150, 150) + (e.team ? 60 : -60), z: rnd(-120, 120) }; a.wpT = 25; } tp = a.wp; }
        gx = tp.x; gz = tp.z; if (Math.hypot(gx - e.x, gz - e.z) < 24 && tp.name) { spd = 0; hold = true; }
        if (!t) c.aimYaw = Math.atan2(gx - e.x, gz - e.z);
    }
    steerTo(e, c, gx, gz, spd);
    if (hold && spd <= 0.01) { c.thr = spd; c.steer = 0; if (spd === 0 && t && !sea) { a.stT = (a.stT || 0) - dt; if (a.stT <= 0) { a.stT = rnd(1.5, 3); a.strafe = Math.random() < .5 ? -.6 : .6; } c.thr = .3; c.steer = a.strafe || 0; } }
    else if (spd < 0 && !a.rev) { c.thr = spd; c.steer = 0; }
    a.sT -= dt; if (a.sT <= 0) { a.sT = 1.5; if (Math.hypot(e.x - a.lx, e.z - a.lz) < 1.5 && c.thr > .5) { a.rev = 1.3; a.side = -a.side; } a.lx = e.x; a.lz = e.z; }
    if (a.rev > 0) a.rev -= dt;
}
function compatLand(e, t) { return t.def.ln === 'a' || compOf(e.x, e.z) === compOf(t.x, t.z) || Math.hypot(e.x - t.x, e.z - t.z) < 350; }
function aiAir(e, dt, c) {
    const a = e.ai, d = e.def, t = a.tgt && a.tgt.alive ? a.tgt : null, w = d.w1, bomber = !!d.w3;
    c.thr = 1; c.aimYaw = e.yaw; c.aimPitch = 0;
    const fx = Math.sin(e.yaw) * Math.cos(e.pitch), fy = Math.sin(e.pitch), fz = Math.cos(e.yaw) * Math.cos(e.pitch);
    if (a.brk > 0) {
        a.brk -= dt; c.aimYaw = e.yaw + a.turnDir * .9; c.aimPitch = .3 + a.skill * .1;
    } else if (t) {
        const D = d3(e, t), tt = D / (w.v + e.speed * .6), grd = t.def.ln !== 'a';
        const tx = t.x + t.vx * tt, tz = t.z + t.vz * tt; let ty = t.y + (grd ? (bomber ? 65 : 2) : t.vy * tt);
        const dx = tx - e.x, dy = ty - e.y, dz = tz - e.z, hd = Math.hypot(dx, dz);
        a.eT -= dt; if (a.eT <= 0) { a.eT = .6; const k = (1 - a.skill) * .06; a.ey = rnd(-k, k); a.ep = rnd(-k, k); }
        c.aimYaw = Math.atan2(dx, dz) + a.ey; c.aimPitch = Math.atan2(dy, hd) + a.ep;
        const dot = (fx * dx + fy * dy + fz * dz) / (D + .01);
        if (D < 330 && dot > .985 && !bomber) c.f1 = true;
        else if (bomber && D < 300 && dot > .98 && grd) c.f1 = true;
        if (d.w2 && dot > .985 && D > 120 && D < 520 && e.a2 > 0) c.f2 = true;
        if (d.w3 && grd && e.a3 > 0 && hd < 110) { const hh = Math.max(10, e.y - t.y), adv = e.speed * Math.sqrt(2 * hh / d.w3.g); if (Math.abs(hd - adv) < 28 && dot > .8) c.f3 = true; }
        if ((grd && bomber && hd < 45) || (D < 55 && !grd) || (grd && !bomber && D < 90 && e.y - t.y < 40)) { a.brk = rnd(1.8, 3.2); a.turnDir = Math.random() < .5 ? -1 : 1; }
    } else {
        const dx = (a.wp ? a.wp.x : 0) - e.x, dz = (a.wp ? a.wp.z : 0) - e.z;
        if (!a.wp || Math.hypot(dx, dz) < 100) a.wp = { x: rnd(-400, 400), z: rnd(-300, 300) };
        c.aimYaw = Math.atan2(a.wp.x - e.x, a.wp.z - e.z); c.aimPitch = (100 - e.y) * .004;
    }
    // stay off the ground and inside the map
    const look = e.speed * 1.5, px = e.x + fx * look, pz = e.z + fz * look, py = e.y + fy * look, fl = Math.max(GH(px, pz), GH(e.x, e.z), 0);
    if (py < fl + 32 || e.y < fl + 22) { c.aimPitch = Math.max(c.aimPitch, .65); c.f1 = c.f2 = c.f3 = false; if (a.brk <= 0 && e.y < fl + 22) { c.aimYaw = e.yaw; } }
    if (Math.abs(e.x) > EXT - 50 || Math.abs(e.z) > EXT - 50) { c.aimYaw = Math.atan2(-e.x, -e.z); }
    if (e.y > 280) c.aimPitch = Math.min(c.aimPitch, -.2);
}
function aiStep(e, dt) {
    if (!e.ai) aiNew(e);
    if (e.frozen) { applyAnim(e, dt); return; }       // test hook: a bot that stands still
    const a = e.ai; a.tT -= dt; if (a.tT <= 0) { a.tT = .6 + Math.random() * .3; a.tgt = aiPickTarget(e); }
    const c = { thr: 0, steer: 0, aimYaw: e.tur, aimPitch: 0, f1: false, f2: false, f3: false };
    if (e.def.ln === 'a') aiAir(e, dt, c); else aiSurface(e, dt, c);
    stepVehicle(e, c, dt);
}
