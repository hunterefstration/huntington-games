// ============================================================
// The ashen. One rigged figure (assets: skin "enemy" in the map file), drawn many times in one draw call per detail
// level; the kinds differ in size, colour (through the light they are given), speed, health and what they do.
// Foes.update moves them (on the host in multiplayer); Foes.render only needs x, z, yaw, state, t per figure.
// ============================================================
// speed in m/s [from, to]; tint multiplies the light on the figure; from = the first wave it shows up in
const FOES = {
    walker:  { name: 'Ashen', hp: 100, speed: [1.5, 2.3], dmg: 9, size: 1, tint: [1, 1, 1], cash: 25, xp: 10, from: 1, w: 10 },
    runner:  { name: 'Runner', hp: 55, speed: [3.7, 4.5], dmg: 6, size: 0.88, tint: [1.2, 1.1, 0.95], cash: 30, xp: 12, from: 2, w: 5 },
    brute:   { name: 'Brute', hp: 480, speed: [1.25, 1.5], dmg: 24, size: 1.4, tint: [0.7, 0.55, 0.5], cash: 110, xp: 30, from: 4, w: 2, reach: 2.0, heavy: true },
    spitter: { name: 'Spitter', hp: 80, speed: [1.6, 2], dmg: 12, size: 0.98, tint: [0.7, 1.25, 0.65], cash: 45, xp: 15, from: 5, w: 3, spit: { range: 15, cool: 2.8, speed: 13 }, max: 4 },
    cinder:  { name: 'Cinder', hp: 70, speed: [2.7, 3.3], dmg: 40, size: 0.95, tint: [2.2, 0.8, 0.3], cash: 45, xp: 15, from: 6, w: 3, blast: 3.4, glow: 0.35, max: 5 },
    furnace: { name: 'THE FURNACE', hp: 3600, speed: [1.8, 1.9], dmg: 32, size: 2.15, tint: [1.5, 0.6, 0.35], cash: 700, xp: 200, boss: true, reach: 2.9, heavy: true, glow: 0.12, slam: { range: 6.5, cool: 6, dmg: 28 } }
};
const FOE_IDS = Object.keys(FOES);
const Foes = { list: [], crowd: null, shots: [], nextId: 1, max: 30 };
Foes.init = function () { const A = World.A; Foes.crowd = A.skins.enemy ? A.crowd('enemy', 64) : null; if (Foes.crowd) { World.scene.add(Foes.crowd.node); for (const m of Foes.crowd.node.children) m.frustumCulled = false; } };
Foes.clear = function () { Foes.list.length = 0; Foes.shots.length = 0; };
// hpK, spK: this wave's health and speed multipliers
Foes.spawn = function (type, x, z, hpK, spK) {
    const T = FOES[type], e = { id: Foes.nextId++, type, T, x, z, yaw: Math.random() * 6.28, hp: T.hp * (hpK || 1), max: T.hp * (hpK || 1), state: 'walk', t: Math.random() * 2, flash: 0, speed: rand(T.speed[0], T.speed[1]) * (spK || 1), light: new Float32Array([1, 1, 1, 1]), did: false, size: T.size * rand(0.97, 1.05), tgt: 0, cool: rand(1, 3), slow: 0, rage: false };
    Foes.list.push(e); return e;
};
Foes.alive = () => { let n = 0; for (const e of Foes.list) if (e.state !== 'die') n++; return n; };
// a bullet's path against every figure: the nearest one hit before `max`, and whether it was the head
const FH = { e: null, t: 0, head: false };
Foes.trace = function (ox, oy, oz, ux, uy, uz, max, skip) {
    const hl = ux * ux + uz * uz; FH.e = null; FH.t = max; FH.head = false; if (hl < 1e-6) return FH;
    for (const e of Foes.list) {
        if (e.state === 'die' || (skip && skip.indexOf(e) >= 0)) continue; const t = ((e.x - ox) * ux + (e.z - oz) * uz) / hl; if (t < 0 || t > FH.t) continue;
        const px = ox + ux * t - e.x, pz = oz + uz * t - e.z, y = oy + uy * t, r = 0.36 * e.size; if (px * px + pz * pz < r * r && y > 0.05 && y < 1.92 * e.size) { FH.e = e; FH.t = t; FH.head = y > 1.5 * e.size; }
    }
    return FH;
};
// hurt one. Returns true when this killed it. G is told (cash, the feed, drops).
Foes.damage = function (e, dmg, head, G, by, splash) {
    if (e.state === 'die') return false; e.hp -= dmg; e.flash = 1; if (!e.T.heavy) e.slow = 0.25;
    if (!splash) World.blood(e.x, (head ? 1.65 : 1.1) * e.size, e.z, head ? 6 : 3);
    if (e.T.boss && !e.rage && e.hp < e.max * 0.5) { e.rage = true; e.speed *= 1.35; G.bossRage(e); }
    if (e.hp <= 0) { e.state = 'die'; e.t = 0; if (e.T.blast) Foes.burst(e, G, 0.6); G.killed(e, head, by); return true; }
    return false;
};
// a cinder going off (k = how much of its full force: less when shot than when it reaches someone)
Foes.burst = function (e, G, k) {
    World.boom(e.x, 0.8, e.z, true); Snd.boom(0.5); G.shake(0.5, e.x, e.z);
    G.blastPlayers(e.x, e.z, e.T.blast, e.T.dmg * k);
    for (const o of Foes.list) if (o !== e && o.state !== 'die') { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < e.T.blast) Foes.damage(o, 160 * (1 - d / e.T.blast), false, G, -1, true); }
};
Foes.update = function (dt, G) {
    const E = Foes.list, C = Foes.crowd, cl = C ? C.clips : {}, dieLen = cl.die ? cl.die.count / cl.die.fps : 1, atkLen = cl.attack ? cl.attack.count / cl.attack.fps : 0.8, PL = G.players;
    for (let i = E.length - 1; i >= 0; i--) {
        const e = E[i], T = e.T; e.t += dt; e.flash = Math.max(0, e.flash - dt * 6); e.slow = Math.max(0, e.slow - dt); e.cool -= dt;
        if (e.state === 'die') { if (e.t > dieLen + 2.5) { E[i] = E[E.length - 1]; E.pop(); } continue; }
        // who it is after: the nearest living player (looked at again now and then)
        if (!PL[e.tgt] || PL[e.tgt].dead || e.cool < -1000 || (e.id + G.frame) % 45 === 0) { let bd = 1e9, b = -1; for (let k = 0; k < PL.length; k++) { const p = PL[k]; if (p.dead || p.gone) continue; const d = Math.hypot(p.x - e.x, p.z - e.z); if (d < bd) { bd = d; b = k; } } if (b >= 0) e.tgt = b; }
        const P = PL[e.tgt]; if (!P || P.dead) { e.state = 'walk'; continue; }
        const px = P.x - e.x, pz = P.z - e.z, pd = Math.hypot(px, pz), reach = T.reach || 1.35;
        if (e.state === 'attack') {
            if (!e.did && e.t > atkLen * 0.45) { e.did = true;
                if (e.spitting) { const sp = T.spit.speed, l = pd || 1, tm = l / sp; Foes.shots.push({ x: e.x, y: 1.5 * e.size, z: e.z, vx: px / l * sp, vy: (1.2 - 1.5 * e.size) / tm + 4.9 * tm * 0.35, vz: pz / l * sp, t: 0, dmg: T.dmg, by: e.id }); Snd.noise(0.12, 900, 300, 0.2, 200); }
                else if (pd < reach + 0.55) G.hurt(e.tgt, T.dmg * G.dmgK, e.x, e.z, e); }
            if (e.t > atkLen) { e.state = 'walk'; e.t = 0; e.spitting = false; }
        } else if (T.blast && pd < 1.5) { e.state = 'die'; e.t = 0; e.hp = 0; Foes.burst(e, G, 1); G.gone(e); continue; }
        else if (pd < reach) { e.state = 'attack'; e.t = 0; e.did = false; e.spitting = false; }
        else if (T.spit && e.cool <= 0 && pd < T.spit.range && pd > 3.5 && World.sees(e.x, e.z, P.x, P.z, 1.4)) { e.state = 'attack'; e.t = 0; e.did = false; e.spitting = true; e.cool = T.spit.cool; }
        else if (T.slam && e.cool <= 0 && pd < T.slam.range && pd > reach) {        // the boss brings both fists down: everything near it is thrown back
            e.cool = T.slam.cool * (e.rage ? 0.6 : 1); e.state = 'attack'; e.t = 0; e.did = true; World.boom(e.x, 0.3, e.z, true); Snd.boom(0.9); G.shake(1, e.x, e.z); G.blastPlayers(e.x, e.z, T.slam.range + 1, T.slam.dmg * G.dmgK);
        }
        // walk: down the flow toward its target, straight at them when close
        let tx = px, tz = pz;
        if (pd > 2.2) { const F = G.flows[e.tgt], c = World.cell(e.x, e.z), n = World.next(F, c); if (n !== c) { tx = World.cellX(n) - e.x; tz = World.cellZ(n) - e.z; } }
        const want = Math.atan2(tx, tz); let dy = want - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; e.yaw += dy * Math.min(1, dt * 7);
        const keep = T.spit && pd < 6 && World.sees(e.x, e.z, P.x, P.z, 1.4);       // a spitter keeps its distance
        if (e.state === 'walk' && pd > 1.0 && !keep) { const sp = e.speed * (e.slow > 0 ? 0.45 : 1) * dt, sx = Math.sin(e.yaw) * sp, sz = Math.cos(e.yaw) * sp, r = 0.28 * Math.min(e.size, 1.3); if (!World.blocked(e.x + sx, e.z, r)) e.x += sx; if (!World.blocked(e.x, e.z + sz, r)) e.z += sz; }
    }
    // they push each other apart
    for (let i = 0; i < E.length; i++) { const a = E[i]; if (a.state === 'die') continue; for (let j = i + 1; j < E.length; j++) { const b = E[j]; if (b.state === 'die') continue; const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, rr = 0.35 * (a.size + b.size); if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) * 0.5 / d, ox = dx * k, oz = dz * k; if (!a.T.heavy && !World.blocked(a.x - ox, a.z - oz, 0.28)) { a.x -= ox; a.z -= oz; } if (!b.T.heavy && !World.blocked(b.x + ox, b.z + oz, 0.28)) { b.x += ox; b.z += oz; } } } }
    // what the spitters threw
    const S = Foes.shots;
    for (let i = S.length - 1; i >= 0; i--) { const s = S[i]; s.t += dt; s.vy -= 4.9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; let gone = s.t > 4 || s.y < 0.05 || World.blocked(s.x, s.z, 0.05);
        for (let k = 0; k < PL.length && !gone; k++) { const p = PL[k]; if (p.dead || p.gone) continue; if (Math.hypot(p.x - s.x, p.z - s.z) < 0.55 && s.y < 1.9) { G.hurt(k, s.dmg * G.dmgK, s.x - s.vx, s.z - s.vz, null); gone = true; } }
        if (gone) { World.dust(s.x, Math.max(0.1, s.y), s.z, 3, 0.35, 0.6, 0.25); S[i] = S[S.length - 1]; S.pop(); } }
};
// draw them: one instance each, the detail level by distance, lit by the baked light where they stand. V = the viewer.
Foes.render = function (V, dt) {
    const C = Foes.crowd, A = World.A; if (!C) return; C.begin(); const cl = C.clips, any = cl.walk || cl.idle || cl[Object.keys(cl)[0]], dieLen = cl.die ? cl.die.count / cl.die.fps : 1;
    for (const e of Foes.list) {
        const T = e.T, clip = e.state === 'die' ? (cl.die || any) : e.state === 'attack' ? (cl.attack || any) : (cl.walk || any), L = e.light;
        A.probe(e.x, e.z, L); const sun = L[3], g = T.glow || 0; L[0] = L[0] * T.tint[0] + g; L[1] = L[1] * T.tint[1] + g * 0.4; L[2] = L[2] * T.tint[2] + g * 0.15;
        C.add(e.x, 0, e.z, e.yaw, e.size, A.frame(clip, e.state === 'walk' ? e.t * e.speed / (1.6 * e.size) : e.t), L, e.flash * 0.6, Math.hypot(e.x - V.x, e.z - V.z) / Math.max(1, e.size));
        World.shFigure(e.x, e.z, 1.75 * e.size * (e.state === 'die' ? Math.max(0.25, 1 - e.t / dieLen) : 1), sun);
        if (T.glow && e.state !== 'die' && Math.random() < dt * 14) World.embers.add(e.x + rand(-0.2, 0.2), rand(0.6, 1.7) * e.size, e.z + rand(-0.2, 0.2), rand(-0.3, 0.3), rand(0.6, 1.5), rand(-0.3, 0.3), 0.07 * e.size, 0, rand(0.5, 1), 1, 0.55, 0.2, 1);
    }
    C.end();
    for (const s of Foes.shots) World.sparks.add(s.x, s.y, s.z, 0, 0, 0, 0.42, -1.5, 0.1, 0.45, 1, 0.3, 0.9);
};
