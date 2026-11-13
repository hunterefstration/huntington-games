// ============================================================
// BOTS (run on the host). Races: follow the course path, jump at marked gaps, look ahead at the
// hazards (their motion is a pure function of time, so a bot can ask where a bar will be in 0.5 s),
// wait or jump or sidestep. Other rounds give their own brain in ROUNDS[id].bot.
// Skill 0/1/2: speed, reaction, how often they notice hazards, and mistakes.
// ============================================================
const BOT_SPEED = [0.8, 0.9, 1.0], BOT_AWARE = [0.35, 0.75, 0.95];
function botSteer(C, inp, tx, tz, stop) {
    const p = C.b.p, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d <= (stop || 0)) { inp.mx = inp.mz = 0; return d; }
    const k = BOT_SPEED[C.skill] * (d < 1 ? Math.max(0.35, d) : 1); inp.mx = dx / d * k; inp.mz = dz / d * k; return d;
}
function botNew(C, rnd) { C.ai = { wi: 0, off: (Math.random() - 0.5) * 1.2, think: Math.random() * 0.1, wait: 0, dodge: null, lastZ: -99, stuckT: 0, stuckN: 0, jerr: 0 }; }
function botTick(C, R, dt) {
    const inp = { mx: 0, mz: 0, jump: false, dive: false, grab: false }, b = C.b, ai = C.ai;
    if (!ai || R.phase !== 'play' || b.st === ST_TUMBLE || b.st === ST_SLIDE) return inp;
    ai.think -= dt;
    if (R.def.bot && R.def.bot(C, R, ai, inp)) { botWobble(C, ai, inp, dt); return inp; }
    if (!L.path.length) return inp;
    const p = b.p, path = L.path;
    // advance along the path
    let n = path[ai.wi];
    for (let guard = 0; guard < 4 && n && ai.wi < path.length - 1; guard++) {
        if (p.z > n.z - 0.6 && Math.abs(p.y - PR - n.y) < 2.5) {
            if (n.j) { if (b.ground) { inp.jump = true; ai.wi++; } else if (b.v.y > 0) ai.wi++; else break; }
            else ai.wi++;
            n = path[ai.wi];
        } else break;
    }
    if (n && p.z < n.z - 14 && ai.wi > 0) { ai.wi = Math.max(0, path.findIndex(q => q.z > p.z - 0.5)); n = path[ai.wi]; }
    if (!n) return inp;
    const tx = n.x + ai.off * Math.min(n.r, 3), tz = n.z;
    botSteer(C, inp, tx, tz, 0);
    if (ai.wait > 0) { ai.wait -= dt; inp.mx *= 0.0; inp.mz *= 0.0; }
    if (ai.dodge) { if (R.t > ai.dodge.until) ai.dodge = null; else { inp.mx = ai.dodge.dir * BOT_SPEED[C.skill]; inp.mz *= 0.3; } }
    // decisions a few times a second
    if (ai.think <= 0) {
        ai.think = [0.22, 0.14, 0.09][C.skill];
        const hs = Math.hypot(inp.mx, inp.mz), dx = hs ? inp.mx / hs : 0, dz = hs ? inp.mz / hs : 1, sp = RUN * BOT_SPEED[C.skill];
        if (b.ground && hs > 0.2 && !n.j && !groundBelow(p.x + dx * 1.3, p.y, p.z + dz * 1.3, 2.7) && Math.random() < [0.5, 0.9, 1][C.skill]) inp.jump = true;
        if (Math.random() < BOT_AWARE[C.skill]) for (const c of L.hazards) {
            const ddx = c.p[0] - p.x, ddz = c.p[2] - p.z; if (ddx * ddx + ddz * ddz > 100 || Math.abs(c.p[1] - p.y) > 6) continue;
            let hit = 0;
            for (const tau of [0.2, 0.4, 0.6, 0.85]) {
                const pc = predictCol(c, R.t + tau), mv = ai.wait > 0 ? 0 : sp * tau;
                if (sphCol(pc, p.x + dx * mv, p.y + 0.27, p.z + dz * mv, 0.85)) { hit = tau; break; }
            }
            if (!hit) continue;
            if (c.k === K_SPH) { ai.dodge = { dir: (p.x > c.p[0] ? 1 : -1) * (Math.abs(p.x) > 8 ? -1 : 1), until: R.t + 0.6 }; break; }
            const low = c.p[1] + (c.hy || 0.3) < p.y + 0.55 && c.hx > 2.5;
            if (low && hit <= 0.4 && b.ground) { inp.jump = true; break; }
            const here = sphCol(predictCol(c, R.t + hit), p.x, p.y + 0.27, p.z, 0.8);
            if (!here) { ai.wait = 0.25; inp.mx = inp.mz = 0; } else if (low && b.ground) inp.jump = true;
            break;
        }
        // stuck? jump, change lane, and after a long time go back to the checkpoint
        ai.stuckT += [0.22, 0.14, 0.09][C.skill];
        if (ai.stuckT > 1.5) {
            if (p.z - ai.lastZ < 0.5 && ai.wait <= 0) { ai.stuckN++; inp.jump = true; ai.off = (Math.random() - 0.5) * 1.6; if (ai.stuckN > 4) { respawnBody(C); ai.stuckN = 0; } }
            else ai.stuckN = 0;
            ai.stuckT = 0; ai.lastZ = p.z;
        }
        if (C.skill > 0 && L.finZ - p.z < 3.5 && L.finZ - p.z > 1 && b.ground && Math.random() < 0.3) inp.dive = true;
    }
    botWobble(C, ai, inp, dt);
    return inp;
}
function botWobble(C, ai, inp, dt) {         // easy bots dither a bit
    if (C.skill === 0 && Math.random() < 0.004) inp.jump = true;
    if (C.skill === 0) { const a = Math.sin(performance.now() * 0.001 + C.id) * 0.25; const c = Math.cos(a), s = Math.sin(a), x = inp.mx, z = inp.mz; inp.mx = x * c - z * s; inp.mz = x * s + z * c; }
}
