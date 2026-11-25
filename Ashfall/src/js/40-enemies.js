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
    spitter: { name: 'Spitter', hp: 80, speed: [1.6, 2], dmg: 12, size: 0.98, tint: [0.7, 1.25, 0.65], cash: 45, xp: 15, from: 3, w: 3, spit: { range: 15, cool: 2.8, speed: 13 }, max: 4 },
    cinder:  { name: 'Cinder', hp: 70, speed: [2.7, 3.3], dmg: 40, size: 0.95, tint: [2.2, 0.8, 0.3], cash: 45, xp: 15, from: 5, w: 3, blast: 3.4, glow: 0.35, max: 5 },
    furnace: { name: 'THE FURNACE', fig: 'brute', hp: 3600, speed: [1.8, 1.9], dmg: 32, size: 2.15, tint: [1.5, 0.6, 0.35], cash: 700, xp: 200, boss: true, reach: 2.9, heavy: true, glow: 0.12, slam: { range: 6.5, cool: 6, dmg: 28 }, rain: { cool: 11, r: 3, dmg: 26 } },
    // charge: sees you, winds up, then runs straight at you (a wall stops and stuns it). leap: jumps the last metres.
    // shield: takes a fifth from the front unless it is the head. howl: makes the others near it faster for a while.
    // split: breaks into mites when it dies. pool: leaves a burning puddle. brood: a boss that keeps making mites.
    charger: { walkV: 1.33, name: 'Charger', fig: 'brute', hp: 300, speed: [1.6, 1.9], dmg: 30, size: 1.22, tint: [1.25, 0.6, 0.5], cash: 90, xp: 26, from: 6, w: 2, max: 3, reach: 1.8, heavy: true, charge: { range: 15, speed: 9, cool: 6 } },
    leaper:  { walkV: 2.91, name: 'Leaper', fig: 'runner', hp: 70, speed: [3.2, 3.8], dmg: 14, size: 0.92, tint: [1.4, 0.75, 1.3], cash: 40, xp: 14, from: 4, w: 3, max: 5, leap: { range: 9, cool: 4 } },
    bulwark: { walkV: 1.19, name: 'Bulwark', fig: 'walker', hp: 150, speed: [1.4, 1.8], dmg: 12, size: 1.1, tint: [0.55, 0.7, 1.1], cash: 55, xp: 18, from: 3, w: 2.5, shield: 0.2 },
    howler:  { walkV: 1.22, name: 'Howler', fig: 'spitter', hp: 90, speed: [1.5, 1.9], dmg: 8, size: 1.02, tint: [1.7, 0.5, 0.5], cash: 60, xp: 20, from: 7, w: 1.2, max: 2, howl: { cool: 9, range: 13 } },
    husk:    { walkV: 0.7, name: 'Husk', fig: 'walker', hp: 170, speed: [1.3, 1.7], dmg: 11, size: 1.14, tint: [0.85, 0.6, 1.25], cash: 45, xp: 16, from: 6, w: 2, split: 3 },
    mite:    { walkV: 3.12, name: 'Mite', fig: 'runner', hp: 26, speed: [4, 4.7], dmg: 4, size: 0.55, tint: [0.9, 0.7, 1.3], cash: 8, xp: 3, from: 999, w: 0 },
    bloater: { walkV: 0.44, name: 'Bloater', fig: 'brute', hp: 260, speed: [1.1, 1.3], dmg: 18, size: 1.2, tint: [0.6, 1.15, 0.5], cash: 80, xp: 24, from: 8, w: 1.5, max: 3, heavy: true, pool: { r: 3.2, secs: 7, dps: 13 } },
    foreman: { walkV: 1.36, name: 'THE FOREMAN', fig: 'brute', hp: 2700, speed: [1.7, 1.8], dmg: 30, size: 1.9, tint: [1.1, 0.85, 0.5], cash: 600, xp: 180, boss: true, reach: 2.7, heavy: true, charge: { range: 24, speed: 11, cool: 5 }, slam: { range: 5.5, cool: 7, dmg: 24 } },
    widow:   { walkV: 1.39, name: 'THE WIDOW', fig: 'spitter', hp: 3000, speed: [1.5, 1.6], dmg: 26, size: 1.9, tint: [0.6, 1.25, 0.75], cash: 650, xp: 190, boss: true, reach: 2.6, heavy: true, glow: 0, spit: { range: 32, cool: 1.5, speed: 16, volley: 3 }, brood: { cool: 9, n: 3 } }
};
const FOE_IDS = Object.keys(FOES), ONE3 = [1, 1, 1];
const Foes = { list: [], crowds: {}, base: null, shots: [], pools: [], nextId: 1, max: 30, loaded: false };
Foes.keep = function (c, A, own) { c.A = A; c.own = own; const cl = c.clips; c.dieLen = cl.die ? cl.die.count / cl.die.fps : 1; c.atkLen = cl.attack ? cl.attack.count / cl.attack.fps : 0.8; c.walkLen = cl.walk ? cl.walk.count / cl.walk.fps : 1; World.scene.add(c.node); for (const m of c.node.children) m.frustumCulled = false; return c; };
// once: every kind whose own figure file exists (they stay through map changes)
// a kind's own figure comes in the first time the kind is wanted (until it is there the kind borrows another's, see fig);
// a boss's goes again a little after it is dead
Foes.wanted = {}; Foes.dropQ = [];
Foes.want = function (id) { if (Foes.crowds[id] || !FOES[id] || HAVE['foe_' + id] !== true || !World.scene) return Promise.resolve(); if (Foes.wanted[id]) return Foes.wanted[id]; return Foes.wanted[id] = HG3D.load(AST('foe_' + id + '.hgm'), { anisotropy: 1 }).then(A => { if (A.skins.enemy) Foes.crowds[id] = Foes.keep(A.crowd('enemy', FOES[id].boss ? 4 : 36, { glow: true }), A, true); delete Foes.wanted[id]; }, () => { delete Foes.wanted[id]; }); };
Foes.drop = function (id) { const c = Foes.crowds[id]; if (!c || Foes.list.some(e => e.type === id)) return; World.scene.remove(c.node); R.release(c.node, c.A.textures.concat(Object.keys(c.A.skins).map(k => c.A.skins[k].tex))); delete Foes.crowds[id]; };
Foes.load = async function () {
    if (Foes.loading) return Foes.loading; Foes.loaded = true;          // a second caller waits for the same fetch (it used to return at once, and a run could begin with no figures in yet)
    return Foes.loading = Promise.all(['walker', 'runner', 'brute', 'spitter', 'cinder'].map(id => Foes.want(id)));
};
// a map that carries a figure of its own lends it to every kind that has none
Foes.enterMap = function () { const A = World.A; Foes.base = A.skins.enemy ? Foes.keep(A.crowd('enemy', 64, { glow: true }), A, false) : null; };
Foes.leaveMap = function () { if (Foes.base) { World.scene.remove(Foes.base.node); R.release(Foes.base.node); Foes.base = null; } Net.dropAvatars(); };
Foes.crowdOf = type => Foes.crowds[type] || Foes.crowds[FOES[type].fig] || Foes.base;
Foes.can = type => !GONE[type] && !!Foes.crowdOf(type);          // GONE: the kinds that are not zombies (45-kinds.js)
Foes.clear = function () { Foes.list.length = 0; Foes.shots.length = 0; Foes.pools.length = 0; };
// hpK, spK: this wave's health and speed multipliers
Foes.spawn = function (type, x, z, hpK, spK) {
    Foes.want(type);
    const T = FOES[type], e = { id: Foes.nextId++, type, T, x, z, yaw: Math.random() * 6.28, hp: T.hp * (hpK || 1), max: T.hp * (hpK || 1), state: 'walk', t: Math.random() * 2, flash: 0, speed: Math.min(T.boss ? 99 : 6.4, rand(T.speed[0], T.speed[1]) * (spK || 1) * (T.boss ? 1 : 1.45)), light: new Float32Array([1, 1, 1, 1]), did: false, size: T.size * rand(0.97, 1.05), tgt: 0, cool: rand(1, 3), slow: 0, rage: false, born: 0.8, y: 0, fast: 0, cool2: rand(4, 8) };
    World.dust(x, 0.2, z, 5, 0.42, 0.4, 0.38);
    Foes.list.push(e); return e;
};
Foes.alive = () => { let n = 0; for (const e of Foes.list) if (e.state !== 'die') n++; return n; };
// a bullet's path against every figure: the nearest one hit before `max`, and whether it was the head
const FH = { e: null, t: 0, head: false };
Foes.trace = function (ox, oy, oz, ux, uy, uz, max, skip) {
    const hl = ux * ux + uz * uz; FH.e = null; FH.t = max; FH.head = false; if (hl < 1e-6) return FH;
    for (const e of Foes.list) {
        if (e.state === 'die' || e.born > 0.4 || e.under || e.gone || (skip && skip.indexOf(e) >= 0)) continue; const t = ((e.x - ox) * ux + (e.z - oz) * uz) / hl; if (t < 0 || t > FH.t) continue;
        const px = ox + ux * t - e.x, pz = oz + uz * t - e.z, y = oy + uy * t - e.y, r = 0.36 * e.size; if (px * px + pz * pz < r * r && y > 0.05 && y < 1.92 * e.size) { FH.e = e; FH.t = t; FH.head = y > 1.5 * e.size; }
    }
    return FH;
};
// hurt one. Returns true when this killed it. G is told (cash, the feed, drops).
Foes.damage = function (e, dmg, head, G, by, splash) {
    if (e.state === 'die') return false; dmg = Kinds.hurt(e, dmg, head, G, by, splash); if (dmg <= 0) return false; let stopped = false;
    if (e.T.shield && !head && !splash && by >= 0 && G.players[by]) { const p = G.players[by]; let d = Math.atan2(p.x - e.x, p.z - e.z) - e.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; if (Math.abs(d) < 1.05) { dmg *= e.T.shield; stopped = true; World.spark(e.x + Math.sin(e.yaw) * 0.4, 1.2 * e.size, e.z + Math.cos(e.yaw) * 0.4, 0.5); } }
    if (e.marked > 0) dmg *= e.markK || 2;
    e.hp -= dmg; e.flash = 1; e.barT = 3; if (!e.T.heavy && !stopped) e.slow = Math.max(e.slow, 0.25);
    if (!stopped && by >= 0 && G.players[by] && !e.T.boss && e.hp > 0) { const p = G.players[by], dx = e.x - p.x, dz = e.z - p.z, l = Math.hypot(dx, dz) || 1, k = clamp(dmg / e.max, 0, 1), push = (e.T.heavy ? 0.3 : 1) * Math.min(0.55, 0.05 + k * 0.9) / Math.max(1, e.size), nx = e.x + dx / l * push, nz = e.z + dz / l * push;
        if (!World.blocked(nx, nz, 0.25)) { e.x = nx; e.z = nz; } if (k > 0.3 && !e.T.heavy && (e.state === 'walk' || e.state === 'attack')) { e.stag = 0.35 + k * 0.35; e.yaw += rand(-0.5, 0.5); if (e.state === 'attack' && !e.did) { e.state = 'walk'; e.t = 0; } } }
    if (!splash && !stopped) World.blood(e.x, (head ? 1.65 : 1.1) * e.size, e.z, head ? 6 : 3);
    if (e.T.boss && !e.rage && e.hp < e.max * 0.5) { e.rage = true; e.speed *= 1.35; G.bossRage(e); }
    if (e.hp <= 0) { if (Kinds.dies(e, head, splash, G)) return false; e.state = 'die'; e.t = 0; e.y = 0; Kinds.dead(e, G); if (e.T.blast) Foes.burst(e, G, 0.6);
        if (e.T.split) for (let i = 0; i < e.T.split; i++) { const m = Foes.spawn('mite', e.x + rand(-0.5, 0.5), e.z + rand(-0.5, 0.5), 1, 1); m.born = 0.2; }
        if (e.T.pool) Foes.pools.push({ x: e.x, z: e.z, r: e.T.pool.r, t: e.T.pool.secs, dps: e.T.pool.dps, tick: 0, warn: 0, c: [0.35, 0.8, 0.2] });
        G.killed(e, head, by); return true; }
    return false;
};
// a cinder going off (k = how much of its full force: less when shot than when it reaches someone)
Foes.burst = function (e, G, k) {
    World.boom(e.x, 0.8, e.z, true); Snd.boom(0.5); G.shake(0.5, e.x, e.z);
    G.blastPlayers(e.x, e.z, e.T.blast, e.T.dmg * k);
    for (const o of Foes.list) if (o !== e && o.state !== 'die') { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < e.T.blast) Foes.damage(o, 160 * (1 - d / e.T.blast), false, G, -1, true); }
};
Foes.update = function (dt, G) {
    const E = Foes.list, PL = G.players;
    for (let i = E.length - 1; i >= 0; i--) {
        const e = E[i], T = e.T, C = Foes.crowdOf(e.type) || { dieLen: 1, atkLen: 0.8 }, dieLen = C.dieLen, atkLen = C.atkLen; e.t += dt; e.flash = Math.max(0, e.flash - dt * 6); e.slow = Math.max(0, e.slow - dt); e.cool -= dt; e.fast = Math.max(0, e.fast - dt); e.cool2 -= dt; if (e.marked > 0) { e.marked -= dt; e.flash = Math.max(e.flash, 0.35); }
        if (e.state === 'die') { if (e.t > dieLen + 2.5) { E[i] = E[E.length - 1]; E.pop(); } continue; }
        if (e.born > 0) { e.born -= dt; if (Math.random() < dt * 20) World.dust(e.x + rand(-0.3, 0.3), 0.15, e.z + rand(-0.3, 0.3), 1, 0.42, 0.4, 0.38); continue; }          // still climbing out
        // who it is after: the nearest living player (looked at again now and then)
        if (!PL[e.tgt] || PL[e.tgt].dead || e.cool < -1000 || (e.id + G.frame) % 45 === 0) { let bd = 1e9, b = -1; for (let k = 0; k < PL.length; k++) { const p = PL[k]; if (p.dead || p.gone) continue; const d = Math.hypot(p.x - e.x, p.z - e.z); if (d < bd) { bd = d; b = k; } } if (b >= 0) e.tgt = b; }
        const P = PL[e.tgt]; if (!P || P.dead) { e.state = 'walk'; continue; }
        if (e.stag > 0) e.stag -= dt; if (e.barT > 0) e.barT -= dt; const px = P.x - e.x, pz = P.z - e.z, pd = Math.hypot(px, pz), reach = (T.reach || 1.35) + (P.y > 0.3 ? (pd < 4.5 && World.next(G.flows[e.tgt], World.cell(e.x, e.z)) === World.cell(e.x, e.z) ? 3.2 : 1.1) : 0);
        if (Kinds.step(e, T, P, px, pz, pd, dt, G, E)) continue;
        // a charge: a moment standing and glowing, then a straight run that only a wall or its target stops
        if (e.state === 'windup') { e.flash = Math.max(e.flash, 0.45); e.yaw = Math.atan2(px, pz); if (e.t > 0.75) { e.state = 'charge'; e.t = 0; const l = pd || 1; e.cx = px / l; e.cz = pz / l; } continue; }
        if (e.state === 'charge') { const sp = T.charge.speed * dt, nx = e.x + e.cx * sp, nz = e.z + e.cz * sp;
            if (World.blocked(nx, nz, 0.3)) { e.state = T.boss ? 'stun' : 'walk'; e.t = 0; e.slow = 1.8; if (T.boss) { HUD.callout('STUNNED: HIT HIM NOW'); Snd.boom(0.6); } World.dust(e.x, 0.6, e.z, 6, 0.5, 0.48, 0.45); G.shake(0.5, e.x, e.z); Snd.boom(0.35); }
            else { e.x = nx; e.z = nz; if (pd < 0.9 + 0.5 * e.size) { G.hurt(e.tgt, T.dmg * 1.3 * G.dmgK, e.x, e.z, e); G.shake(0.6); e.state = T.boss ? 'stun' : 'walk'; e.t = T.boss ? 2.2 : 0; e.slow = 0.9; } else if (e.t > 1.8) { e.state = T.boss ? 'stun' : 'walk'; e.t = T.boss ? 2.2 : 0; } }
            continue; }
        if (e.state === 'leap') { const k = Math.min(1, e.t / 0.55); e.x = lerp(e.lx, e.jx, k); e.z = lerp(e.lz, e.jz, k); e.y = Math.sin(k * Math.PI) * 1.5; if (k >= 1) { e.y = 0; e.state = 'walk'; e.t = 0; e.slow = 0.5; if (Math.hypot(P.x - e.x, P.z - e.z) < 1.5) G.hurt(e.tgt, T.dmg * G.dmgK, e.x, e.z, e); } continue; }
        if (T.howl && e.cool <= 0 && pd < 24 && e.state === 'walk') { e.cool = T.howl.cool; e.flash = 1; e.slow = Math.max(e.slow, 1); Snd.groan(1); Snd.tone(700, 0.25, 0.8, 'sawtooth', 220); for (const o of E) if (o !== e && o.state !== 'die' && Math.hypot(o.x - e.x, o.z - e.z) < T.howl.range) { o.fast = 6; o.flash = 0.7; } }
        if (T.brood && e.cool2 <= 0 && e.state === 'walk') { e.cool2 = T.brood.cool * (e.rage ? 0.6 : 1); if (Foes.alive() < Foes.max + 4) for (let n = 0; n < T.brood.n; n++) { const m = Foes.spawn('mite', e.x + rand(-1, 1), e.z + rand(-1, 1), 1, 1); m.born = 0.3; } Snd.noise(0.3, 700, 200, 0.4); }
        if (T.rain && e.cool2 <= 0 && e.state === 'walk') { e.cool2 = T.rain.cool * (e.rage ? 0.65 : 1); e.ventIn = 2.6; for (const p of PL) if (!p.dead && !p.gone) Foes.pools.push({ x: p.x + rand(-1.5, 1.5), z: p.z + rand(-1.5, 1.5), r: T.rain.r, t: 5, dps: 14, tick: 0, warn: 1.3, hit: T.rain.dmg, c: [1.6, 0.6, 0.15] }); Snd.tone(1500, 0.2, 1.2, 'sine', 300); }
        if (e.state === 'attack') {
            if (!e.did && !e.spitting && pd > 0.9 && !(e.stag > 0) && !T.boss) { const sp = e.speed * 0.8 * dt, r = 0.28 * Math.min(e.size, 1.3), sx = px / pd * sp, sz = pz / pd * sp; if (!World.blocked(e.x + sx, e.z, r)) e.x += sx; if (!World.blocked(e.x, e.z + sz, r)) e.z += sz; }
            if (!e.did && e.t > atkLen * 0.45) { e.did = true;
                if (e.spitting) { const sp = T.spit.speed, l = pd || 1, tm = l / sp, nv = T.spit.volley || 1; for (let v = 0; v < nv; v++) { const a = (v - (nv - 1) / 2) * 0.16, ca = Math.cos(a), sa = Math.sin(a); Foes.shots.push({ x: e.x, y: 1.5 * e.size, z: e.z, vx: (px * ca - pz * sa) / l * sp, vy: (1.2 - 1.5 * e.size) / tm + 4.9 * tm * 0.35, vz: (px * sa + pz * ca) / l * sp, t: 0, dmg: T.dmg, by: e.id }); } Snd.noise(0.12, 900, 300, 0.2, 200); }
                else if (pd < reach + 0.55) G.hurt(e.tgt, T.dmg * G.dmgK, e.x, e.z, e); }
            if (e.t > atkLen) { e.state = 'walk'; e.t = 0; e.spitting = false; }
        } else if (T.blast && pd < 1.5) { e.state = 'die'; e.t = 0; e.hp = 0; Foes.burst(e, G, 1); G.gone(e); continue; }
        else if (pd < reach && !(e.stag > 0)) { e.state = 'attack'; e.t = 0; e.did = false; e.spitting = false; }
        else if (T.spit && e.cool <= 0 && pd < T.spit.range && pd > 3.5 && World.sees(e.x, e.z, P.x, P.z, 1.4)) { e.state = 'attack'; e.t = 0; e.did = false; e.spitting = true; e.cool = T.spit.cool; }
        else if (T.slam && e.cool <= 0 && pd < T.slam.range && pd > reach) {        // the boss brings both fists down: everything near it is thrown back
            e.cool = T.slam.cool * (e.rage ? 0.6 : 1); e.state = 'attack'; e.t = 0; e.did = true; World.boom(e.x, 0.3, e.z, true); Snd.boom(0.9); G.shake(1, e.x, e.z); G.blastPlayers(e.x, e.z, T.slam.range + 1, T.slam.dmg * G.dmgK);
        }
        else if (T.charge && e.state === 'walk' && e.cool <= 0 && pd < T.charge.range && pd > 5 && World.sees(e.x, e.z, P.x, P.z, 1.2)) { e.state = 'windup'; e.t = 0; e.cool = T.charge.cool * (e.rage ? 0.6 : 1); Snd.groan(1); continue; }
        else if (T.leap && e.state === 'walk' && e.cool <= 0 && pd < T.leap.range && pd > 3.5 && !World.blocked(P.x - px / pd * 0.8, P.z - pz / pd * 0.8, 0.3) && World.sees(e.x, e.z, P.x, P.z, 1.2)) { e.state = 'leap'; e.t = 0; e.cool = T.leap.cool; e.lx = e.x; e.lz = e.z; e.jx = P.x - px / pd * 0.8; e.jz = P.z - pz / pd * 0.8; e.yaw = Math.atan2(px, pz); continue; }
        // walk: down the flow toward its target, straight at them when close
        let tx = px, tz = pz; e.seeT = (e.seeT || 0) - dt; if (e.seeT <= 0) { e.seeT = 0.25 + Math.random() * 0.12; e.sees = pd < 28 && World.sees(e.x, e.z, P.x, P.z, 1.2); } if (e.flowT > 0) e.flowT -= dt;
        if (pd > 2.2) { let direct = false;
            if (e.sees && pd > 3 && !T.heavy && !(e.flowT > 0)) { const off = (e.flank === undefined ? (e.flank = Math.random() * 2 - 1) : e.flank) * Math.min(5.5, pd * 0.42), fx = px - pz / pd * off, fz = pz + px / pd * off, l = Math.hypot(fx, fz) || 1; if (World.blocked(e.x + fx / l * 0.9, e.z + fz / l * 0.9, 0.3)) e.flowT = 1.2; else { tx = fx; tz = fz; direct = true; } }
            if (!direct) { const F = G.flows[e.tgt], c = World.cell(e.x, e.z), n = World.next(F, c); if (n !== c) { tx = World.cellX(n) - e.x; tz = World.cellZ(n) - e.z; } } }
        /* a rush: now and then, a few metres out and in sight, it closes at a run (it shows: a flash) */
        if (e.rushCd === undefined) e.rushCd = rand(1, 4); e.rushCd -= dt; if (e.rush > 0) e.rush -= dt; else if (e.rushCd <= 0 && e.sees && pd > 3.5 && pd < 9 && e.state === 'walk' && !T.heavy && !T.spit && !T.back && !T.boss) { e.rush = 0.8; e.rushCd = rand(3, 6); e.flash = Math.max(e.flash, 0.35); }
        const want = Math.atan2(tx, tz); let dy = want - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; e.yaw += dy * Math.min(1, dt * 7);
        const keep = (T.spit || T.back) && pd < 6 && World.sees(e.x, e.z, P.x, P.z, 1.4);       // a spitter keeps its distance
        if (keep && e.state === 'walk' && !(e.stag > 0)) { e.strafeT = (e.strafeT || 0) - dt; if (e.strafeT <= 0) { e.strafeT = rand(0.9, 2.1); e.strafe = Math.random() < 0.5 ? -1 : 1; } const sp = e.speed * 0.65 * (e.slow > 0 ? 0.45 : 1) * dt, sx = -pz / pd * sp * e.strafe, sz = px / pd * sp * e.strafe; if (!World.blocked(e.x + sx, e.z + sz, 0.3)) { e.x += sx; e.z += sz; } else e.strafe = -e.strafe; }
        if (e.state === 'walk' && pd > 1.0 && !keep && !(e.stag > 0)) { const sp = e.speed * (e.slow > 0 ? 0.45 : 1) * (e.fast > 0 ? 1.35 : 1) * (e.rush > 0 ? 1.6 : 1) * dt, sx = Math.sin(e.yaw) * sp, sz = Math.cos(e.yaw) * sp, r = 0.28 * Math.min(e.size, 1.3); if (!World.blocked(e.x + sx, e.z, r)) e.x += sx; if (!World.blocked(e.x, e.z + sz, r)) e.z += sz; }
    }
    // they push each other apart
    for (let i = 0; i < E.length; i++) { const a = E[i]; if (a.state === 'die') continue; for (let j = i + 1; j < E.length; j++) { const b = E[j]; if (b.state === 'die') continue; const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, rr = 0.35 * (a.size + b.size); if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) * 0.5 / d, ox = dx * k, oz = dz * k; if (!a.T.heavy && !World.blocked(a.x - ox, a.z - oz, 0.28)) { a.x -= ox; a.z -= oz; } if (!b.T.heavy && !World.blocked(b.x + ox, b.z + oz, 0.28)) { b.x += ox; b.z += oz; } } } }
    // what the spitters threw
    const S = Foes.shots;
    for (let i = S.length - 1; i >= 0; i--) { const s = S[i]; s.t += dt; s.vy -= 4.9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; let gone = s.t > 4 || s.y < 0.05 || (!(s.lob && s.y > 0.7) && World.blocked(s.x, s.z, 0.05));
        for (let k = 0; k < PL.length && !gone; k++) { const p = PL[k]; if (p.dead || p.gone) continue; if (Math.hypot(p.x - s.x, p.z - s.z) < 0.55 && s.y < 1.9) { G.hurt(k, s.dmg * G.dmgK, s.x - s.vx, s.z - s.vz, null); gone = true; } }
        if (gone) { if (s.lob) { Foes.pools.push({ x: s.x, z: s.z, r: s.lob, t: 5, dps: 12, tick: 0, warn: 0, c: [1.6, 0.6, 0.15] }); World.boom(s.x, 0.3, s.z, false); } World.dust(s.x, Math.max(0.1, s.y), s.z, 3, 0.35, 0.6, 0.25); S[i] = S[S.length - 1]; S.pop(); } }
    for (let i = Foes.pools.length - 1; i >= 0; i--) { const p = Foes.pools[i];
        if (p.warn > 0) { p.warn -= dt; for (let n = 0; n < 2; n++) { const a = Math.random() * 6.28; World.sparks.add(p.x + Math.cos(a) * p.r, 0.15, p.z + Math.sin(a) * p.r, 0, 0.5, 0, 0.3, 0, 0.25, 1.6, 0.4, 0.15, 1); } if (p.warn <= 0) { World.boom(p.x, 0.3, p.z, true); Snd.boom(0.6); G.shake(0.6, p.x, p.z); G.blastPlayers(p.x, p.z, p.r, p.hit * G.dmgK); } continue; }
        p.t -= dt; p.tick -= dt; if (p.t <= 0) { Foes.pools.splice(i, 1); continue; }
        if (Math.random() < dt * 9) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * p.r; World.smoke.add(p.x + Math.cos(a) * d, 0.15, p.z + Math.sin(a) * d, 0, 0.35, 0, 0.9, 0.5, 1.1, p.c[0], p.c[1], p.c[2], 0.5 * Math.min(1, p.t)); }
        if (p.tick <= 0) { p.tick = 0.5; for (let k = 0; k < PL.length; k++) { const q = PL[k]; if (!q.dead && !q.gone && !q.obj && Math.hypot(q.x - p.x, q.z - p.z) < p.r) G.hurt(k, p.dps * 0.5 * G.dmgK, p.x, p.z, null); } } }
    for (let i = Foes.dropQ.length - 1; i >= 0; i--) { const q = Foes.dropQ[i]; q[1] -= dt; if (q[1] <= 0 && !Foes.list.some(e => e.type === q[0])) { Foes.drop(q[0]); Foes.dropQ.splice(i, 1); } }
};
// draw them: one instance each, the detail level by distance, lit by the baked light where they stand. V = the viewer.
Foes.render = function (V, dt) {
    const A = World.A; for (const k in Foes.crowds) Foes.crowds[k].begin(); if (Foes.base) Foes.base.begin();
    for (const e of Foes.list) {
        const T = e.T, C = Foes.crowdOf(e.type); if (!C || Kinds.hidden(e)) continue; const cl = C.clips, any = cl.walk || cl.idle || cl[Object.keys(cl)[0]], dieLen = C.dieLen;
        const clip = Kinds.clip(e, cl) || (e.state === 'die' ? (cl.die || any) : e.state === 'attack' || e.state === 'windup' ? (cl.attack || any) : (cl.walk || any)), kt = Kinds.clipT(e, C, cl), L = e.light, FB = T.fig && !Foes.crowds[e.type] ? FOES[T.fig] : T;
        // a kind with its own figure is its own colour; the borrowed figure is tinted to tell the kinds apart
        A.probe(e.x, e.z, L); World.floorL(L); const sun = L[3], g = T.glow || 0, tn = C.own && FB === T ? ONE3 : T.tint; L[0] = L[0] * tn[0] + g; L[1] = L[1] * tn[1] + g * 0.4; L[2] = L[2] * tn[2] + g * 0.15;
        const up = e.born > 0 ? e.born / 0.8 : 0;
        const mid = FB === T && T.walkV && C.own ? T.walkV : (FB.speed[0] + FB.speed[1]) / 2, moving = e.state === 'walk' || e.state === 'charge' || e.state === 'leap', pace = e.state === 'charge' ? T.charge.speed * 0.6 : e.speed;       // an own figure is modelled at its real height and its walk fits its usual speed
        // FEET THAT PLANT: the walk is driven by the ground really covered, not by the clock, so a zombie that is slowed, shoved or held up
        // by the one in front does not walk on the spot or skate (clip time = ground covered / the clip's own pace)
        { const dd = Math.hypot(e.x - (e.px === undefined ? e.x : e.px), e.z - (e.pz === undefined ? e.z : e.pz)); e.px = e.x; e.pz = e.z; e.gd = (e.gd || 0) + (dd < 1.5 ? dd : 0); }
        C.add(e.x, e.y - 1.75 * e.size * up * up, e.z, e.yaw, C.own ? e.size / FB.size : e.size, A.frame(clip, kt !== undefined ? kt : moving ? (C.own ? (e.state === 'walk' ? e.gd / mid : e.t * pace / mid) : e.t * pace / (1.6 * e.size)) : e.state === 'windup' ? e.t * 0.5 : e.t), L, e.flash * 0.6, Math.hypot(e.x - V.x, e.z - V.z) / Math.max(1, e.size));
        World.shFigure(e.x, e.z, 1.75 * e.size * (e.state === 'die' ? Math.max(0.25, 1 - e.t / dieLen) : 1 - up), sun);
        if (T.glow && e.state !== 'die' && Math.random() < dt * 14) World.embers.add(e.x + rand(-0.2, 0.2), rand(0.6, 1.7) * e.size, e.z + rand(-0.2, 0.2), rand(-0.3, 0.3), rand(0.6, 1.5), rand(-0.3, 0.3), 0.07 * e.size, 0, rand(0.5, 1), 1, 0.55, 0.2, 1);
    }
    for (const k in Foes.crowds) Foes.crowds[k].end(); if (Foes.base) Foes.base.end();
    for (const s of Foes.shots) World.sparks.add(s.x, s.y, s.z, 0, 0, 0, 0.42, -1.5, 0.1, 0.45, 1, 0.3, 0.9);
};
