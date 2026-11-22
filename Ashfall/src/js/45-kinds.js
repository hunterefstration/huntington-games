// ============================================================
// What the later kinds of ashen do, and the five bosses' own rules. 40-enemies.js calls in here at four places: before
// damage lands (Kinds.hurt), when something would die (Kinds.dies / Kinds.dead), once a frame for each (Kinds.step:
// true = it has done everything for this one this frame), and when it is drawn (Kinds.clip / Kinds.clipT).
//   stalker   cannot be seen until it is close or hurt: watch for the dust it kicks up
//   shocker   throws a bolt that JAMS your gun for two seconds
//   mender    keeps healing the worst hurt near it: kill it first
//   gunner    takes aim (you see the line) and shoots unless you break its line of sight in time
//   lobber    throws burning lumps over cover; where they land burns
//   burrower  goes under the ground, where nothing can hurt it, and comes up beside you
//   lasher    whips you off your feet and drags you to it
//   risen     gets up again once, unless it was the head or a blast that put it down
//   chiller   everything near it moves slowly, you included
// Bosses (BOSS_ORDER: the order boss waves bring them):
//   foreman   ARMOURED from the front; make him charge into a wall and he is stunned and soft
//   widow     SHIELDED while three of her brood are alive
//   warden    cannot be hurt while his pylons stand (they come back once, at half health)
//   furnace   too hot to hurt much, except while it vents after raining fire
//   hollow    the Hollow King: at two points he becomes four, and only one is real; he steps behind you
// ============================================================
const BOSS_ORDER = ['foreman', 'widow', 'warden', 'furnace', 'hollow'];
Object.assign(FOES, {
    risen:    { walkV: 0.92, name: 'Risen', fig: 'walker', hp: 80, speed: [1.6, 2.1], dmg: 11, size: 1, tint: [0.45, 0.4, 0.4], cash: 35, xp: 14, from: 3, w: 3, rise: 1 },
    gunner:   { walkV: 1.25, name: 'Gunner', fig: 'walker', hp: 90, speed: [1.5, 1.9], dmg: 24, size: 1.02, tint: [0.7, 0.85, 0.6], cash: 55, xp: 18, from: 4, w: 2.2, max: 3, back: true, shoot: { range: 34, cool: 4.5, aim: 1.25 } },
    stalker:  { walkV: 3.75, name: 'Stalker', fig: 'runner', hp: 75, speed: [3, 3.6], dmg: 16, size: 0.98, tint: [0.5, 0.6, 0.85], cash: 55, xp: 18, from: 5, w: 2, max: 3, cloak: { near: 6, show: 1.3 } },
    burrower: { walkV: 1.84, name: 'Burrower', fig: 'runner', hp: 85, speed: [2.6, 3], dmg: 18, size: 0.9, tint: [0.95, 0.75, 0.5], cash: 50, xp: 17, from: 5, w: 2, max: 3, burrow: { cool: 7, far: 8 } },
    shocker:  { walkV: 1.12, name: 'Shocker', fig: 'spitter', hp: 95, speed: [1.6, 2], dmg: 8, size: 1.05, tint: [0.6, 0.9, 1.7], cash: 55, xp: 18, from: 6, w: 2, max: 3, back: true, cast: { kind: 'zap', range: 13, cool: 5, jam: 2.2 } },
    mender:   { walkV: 0.68, name: 'Mender', fig: 'spitter', hp: 110, speed: [1.4, 1.7], dmg: 7, size: 1, tint: [1.2, 1.5, 0.7], cash: 60, xp: 20, from: 6, w: 1.5, max: 2, back: true, mend: { range: 9, hps: 30 }, glow: 0.05 },
    lobber:   { walkV: 1.14, name: 'Lobber', fig: 'brute', hp: 200, speed: [1.2, 1.5], dmg: 14, size: 1.15, tint: [1.25, 0.9, 0.4], cash: 70, xp: 22, from: 7, w: 1.6, max: 2, heavy: true, cast: { kind: 'lob', range: 26, cool: 5, r: 2.8 } },
    lasher:   { walkV: 1.16, name: 'Lasher', fig: 'spitter', hp: 120, speed: [1.5, 1.8], dmg: 10, size: 1, tint: [1.5, 0.6, 0.9], cash: 60, xp: 20, from: 8, w: 1.5, max: 2, cast: { kind: 'lash', range: 11, cool: 6.5, pull: 7 } },
    chiller:  { walkV: 0.57, name: 'Chiller', fig: 'brute', hp: 240, speed: [1.2, 1.4], dmg: 16, size: 1.08, tint: [0.7, 1.1, 1.8], cash: 75, xp: 22, from: 9, w: 1.3, max: 2, heavy: true, chill: { range: 7 } },
    pylon:    { name: 'Pylon', fig: 'walker', hp: 240, speed: [0, 0], dmg: 0, size: 1.44, tint: [0.6, 1.2, 1.8], cash: 20, xp: 5, from: 999, w: 0, heavy: true, still: true, glow: 0.08 },
    warden:   { walkV: 1.31, name: 'THE WARDEN', fig: 'brute', hp: 3200, speed: [1.6, 1.7], dmg: 30, size: 1.9, tint: [0.6, 0.75, 1.2], cash: 650, xp: 190, boss: true, reach: 2.8, heavy: true, pylons: 3, slam: { range: 6, cool: 7, dmg: 26 } },
    hollow:   { walkV: 1.29, name: 'THE HOLLOW KING', fig: 'walker', hp: 3400, speed: [2, 2.2], dmg: 28, size: 1.85, tint: [0.5, 0.45, 0.6], cash: 800, xp: 240, boss: true, reach: 2.7, heavy: true, splits: [0.7, 0.35], step: { cool: 11 } }
});
FOE_IDS.length = 0; FOE_IDS.push(...Object.keys(FOES));          // the list other files hold (and send over the wire by position)
const Kinds = {};
Kinds.count = type => { let n = 0; for (const e of Foes.list) if (e.type === type && e.state !== 'die' && !e.decoy) n++; return n; };
// is player p in front of e?
Kinds.front = function (e, p) { if (!p) return false; let d = Math.atan2(p.x - e.x, p.z - e.z) - e.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d) < 1.05; };
// damage about to land on e: what really lands (0: none)
Kinds.hurt = function (e, dmg, head, G, by, splash) {
    const T = e.T; if (e.under || e.gone) return 0; if (T.cloak) e.shown = T.cloak.show;
    if (!T.boss || e.decoy) return dmg;
    if (e.type === 'furnace') dmg *= e.state === 'vent' ? 2.2 : 0.6;
    else if (e.type === 'foreman') { if (e.state === 'stun') dmg *= 2; else if (!head && !splash && Kinds.front(e, G.players[by])) { dmg *= 0.3; if (Math.random() < 0.4) World.spark(e.x + Math.sin(e.yaw) * 0.6, 1.5 * e.size * 0.6, e.z + Math.cos(e.yaw) * 0.6, 0.5); } }
    else if (e.type === 'widow') { if (Kinds.count('mite') >= 3) dmg *= 0.15; }
    else if (e.type === 'warden') { if (Kinds.count('pylon') > 0) dmg *= 0.04; }
    else if (e.type === 'hollow' && e.split) { e.split = false; for (const o of Foes.list) if (o.decoy) Kinds.pop(o); HUD.callout('THAT ONE IS REAL'); Snd.tone(900, 0.2, 0.3, 'triangle', 300); }
    return dmg;
};
// a decoy goes: a puff, no body, nothing paid
Kinds.pop = function (o) { if (o.gone) return; o.gone = true; o.state = 'die'; o.t = 1e3; o.hp = 0; World.dust(o.x, 1.4, o.z, 8, 0.4, 0.38, 0.5); };
// e's health has run out. true = it is not dead after all.
Kinds.dies = function (e, head, splash, G) {
    if (e.decoy) { Kinds.pop(e); return true; }
    if (e.T.rise && !e.risen && !head && !splash) { e.risen = true; e.state = 'down'; e.t = 0; e.hp = 1; return true; }
    return false;
};
Kinds.dead = function (e, G) {
    if (e.T.boss) Foes.dropQ.push([e.type, 9]);
    if (e.type === 'hollow') for (const o of Foes.list) if (o.decoy) Kinds.pop(o);
    if (e.type === 'warden') for (const o of Foes.list) if (o.type === 'pylon' && o.state !== 'die') { o.state = 'die'; o.t = 0; o.hp = 0; World.spark(o.x, 2, o.z, 1); }
};
// the line under a boss's health: what its rule is asking of you right now
Kinds.bossLine = function (e) {
    const t = e.type;
    return t === 'furnace' ? (e.state === 'vent' ? 'VENTING: HIT IT NOW' : 'TOO HOT TO HURT: WAIT FOR IT TO VENT') : t === 'foreman' ? (e.state === 'stun' ? 'STUNNED: HIT HIM NOW' : 'ARMOURED IN FRONT: MAKE HIM CHARGE INTO A WALL') : t === 'widow' ? (Kinds.count('mite') >= 3 ? 'SHIELDED BY HER BROOD: KILL THE MITES' : 'EXPOSED') : t === 'warden' ? (Kinds.count('pylon') ? 'PYLONS STANDING: ' + Kinds.count('pylon') + '. DESTROY THEM' : 'UNSHIELDED') : t === 'hollow' ? (e.split ? 'ONLY ONE OF THEM IS REAL' : 'HE STEPS BEHIND YOU') : '';
};
// once a frame for each ashen that is up. P = who it is after, (px, pz, pd) = the way and distance to them.
Kinds.step = function (e, T, P, px, pz, pd, dt, G, E) {
    if (e.dummy) { e.state = 'idle'; return true; }          // a training target: it stands there
    if (T.still) { e.state = 'idle'; e.flash = Math.max(e.flash, 0.12 + 0.1 * Math.sin(e.t * 5)); return true; }
    if (e.decoy) { if (pd < 1.8) { Kinds.pop(e); return true; } return false; }
    if (e.state === 'down') { if (e.t > 2.4) { e.state = 'rise'; e.t = 0; } return true; }
    if (e.state === 'rise') { if (e.t > 1.4) { e.state = 'walk'; e.t = 0; e.hp = e.max * 0.6; e.flash = 0.6; } return true; }
    if (e.state === 'stun') { if (e.t > 4) { e.state = 'walk'; e.t = 0; } return true; }
    if (e.state === 'vent') { e.flash = Math.max(e.flash, 0.35 + 0.25 * Math.sin(e.t * 9)); if (Math.random() < dt * 20) World.smoke.add(e.x + rand(-0.6, 0.6), rand(1, 3), e.z + rand(-0.6, 0.6), 0, 2.5, 0, 0.6, 1.4, 0.9, 0.9, 0.9, 0.9, 0.5); if (e.t > 5) { e.state = 'walk'; e.t = 0; } return true; }
    if (e.ventIn > 0) { e.ventIn -= dt; if (e.ventIn <= 0) { e.state = 'vent'; e.t = 0; HUD.callout('IT IS VENTING: HIT IT NOW'); Snd.noise(0.5, 4000, 600, 1.2); return true; } }
    if (T.cloak) { e.shown = Math.max(0, (e.shown || 0) - dt); e.vis = lerp(e.vis === undefined ? 0 : e.vis, pd < T.cloak.near || e.shown > 0 || e.state === 'attack' ? 1 : 0, Math.min(1, dt * 6)); if (e.vis < 0.5 && Math.random() < dt * 4) World.dust(e.x, 0.1, e.z, 1, 0.5, 0.5, 0.5); }
    if (T.chill) { for (let k = 0; k < G.players.length; k++) { const p = G.players[k]; if (!p.dead && !p.obj && Math.hypot(p.x - e.x, p.z - e.z) < T.chill.range) p.chill = 0.3; } for (const o of E) if (o !== e && o.state !== 'die' && Math.hypot(o.x - e.x, o.z - e.z) < T.chill.range) o.slow = Math.max(o.slow, 0.1); if (Math.random() < dt * 9) { const a = Math.random() * 6.28, d = Math.random() * T.chill.range; World.smoke.add(e.x + Math.cos(a) * d, 0.2, e.z + Math.sin(a) * d, 0, 0.3, 0, 0.7, 0.6, 1.3, 0.8, 0.95, 1.2, 0.3); } }
    if (T.mend) { let worst = null, wk = 1; for (const o of E) { if (o === e || o.state === 'die' || o.T.still || o.decoy) continue; const k = o.hp / o.max; if (k < wk && Math.hypot(o.x - e.x, o.z - e.z) < T.mend.range) { wk = k; worst = o; } } if (worst) { worst.hp = Math.min(worst.max, worst.hp + T.mend.hps * dt); e.mendT = (e.mendT || 0) - dt; if (e.mendT <= 0) { e.mendT = 0.2; World.sparks.add(lerp(e.x, worst.x, Math.random()), 1.2, lerp(e.z, worst.z, Math.random()), 0, 0.4, 0, 0.3, -0.6, 0.35, 0.5, 1.6, 0.5, 1); } } }
    if (T.burrow) {
        if (e.state === 'dig') { if (e.t > 0.6) { e.state = 'under'; e.under = true; e.t = 0; } return true; }
        if (e.state === 'under') {
            const F = G.flows[e.tgt], sp = 6.5 * dt, c = World.cell(e.x, e.z), n = F ? World.next(F, c) : c; let tx = px, tz = pz; if (n !== c && pd > 3) { tx = World.cellX(n) - e.x; tz = World.cellZ(n) - e.z; } const l = Math.hypot(tx, tz) || 1; e.x += tx / l * sp; e.z += tz / l * sp; if (Math.random() < dt * 14) World.dust(e.x, 0.1, e.z, 1, 0.45, 0.4, 0.35);
            if (pd < 2.2 || e.t > 6) { e.state = 'erupt'; e.t = 0; e.under = false; e.did = false; const f = World.free(e.x, e.z, 0.3); e.x = f[0]; e.z = f[1]; e.yaw = Math.atan2(px, pz); World.dust(e.x, 0.2, e.z, 8, 0.45, 0.4, 0.35); Snd.noise(0.4, 500, 120, 0.3); }
            return true; }
        if (e.state === 'erupt') { if (!e.did && e.t > 0.25) { e.did = true; if (Math.hypot(P.x - e.x, P.z - e.z) < 2) G.hurt(e.tgt, T.dmg * G.dmgK, e.x, e.z, e); G.shake(0.4, e.x, e.z); } if (e.t > 0.7) { e.state = 'walk'; e.t = 0; e.cool = T.burrow.cool; } return true; }
        if (e.state === 'walk' && e.cool <= 0 && pd > T.burrow.far) { e.state = 'dig'; e.t = 0; World.dust(e.x, 0.2, e.z, 5, 0.45, 0.4, 0.35); return true; }
    }
    if (T.shoot) {
        if (e.state === 'aim') { e.yaw = Math.atan2(px, pz); const sees = World.sees(e.x, e.z, P.x, P.z, 1.4); if (!sees && e.t > 0.3) { e.state = 'walk'; e.t = 0; e.cool = 1.5; return true; }
            e.lineT = (e.lineT || 0) - dt; if (e.lineT <= 0) { e.lineT = 0.1; World.tracer(e.x + px / pd * 0.5, 1.45 * e.size, e.z + pz / pd * 0.5, P.x, 1.3, P.z); }
            if (e.t > T.shoot.aim) { if (sees) { G.hurt(e.tgt, T.dmg * G.dmgK, e.x, e.z, e); World.sparks.add(e.x + px / pd * 0.7, 1.45 * e.size, e.z + pz / pd * 0.7, 0, 0, 0, 0.5, -2, 0.07, 1, 1, 1, 1); } Snd.gun(WEAPONS.dmr.snd, clamp(1.1 - pd / 45, 0.15, 0.8)); e.state = 'walk'; e.t = 0; e.cool = T.shoot.cool; }
            return true; }
        if (e.state === 'walk' && e.cool <= 0 && pd < T.shoot.range && pd > 5 && World.sees(e.x, e.z, P.x, P.z, 1.4)) { e.state = 'aim'; e.t = 0; Snd.tone(1400, 0.1, 0.15, 'square', 1400); return true; }
    }
    if (T.cast) {
        const C = T.cast;
        if (e.state === 'cast') { e.yaw = Math.atan2(px, pz); if (!e.did && e.t > 0.4) { e.did = true; Kinds.cast(e, C, P, px, pz, pd, G); } if (e.t > 0.9) { e.state = 'walk'; e.t = 0; } return true; }
        if (e.state === 'walk' && e.cool <= 0 && pd < C.range && pd > (C.kind === 'lob' ? 6 : 3) && (C.kind === 'lob' || World.sees(e.x, e.z, P.x, P.z, 1.4))) { e.state = 'cast'; e.t = 0; e.did = false; e.cool = C.cool; return true; }
    }
    if (T.pylons) {
        if (!e.pyl || (e.pyl === 1 && e.hp < e.max * 0.5)) { e.pyl = (e.pyl || 0) + 1; const a0 = Math.random() * 6.28; for (let i = 0; i < T.pylons; i++) { const a = a0 + i * 6.28 / T.pylons, f = World.free(e.x + Math.cos(a) * 13, e.z + Math.sin(a) * 13, 0.5), m = Foes.spawn('pylon', f[0], f[1], 1, 0); m.born = 0.3; } HUD.banner('PYLONS UP', 'the Warden cannot be hurt while they stand'); Snd.tone(180, 0.3, 1, 'sawtooth', 360); }
        const n = Kinds.count('pylon'); if (n) { e.hp = Math.min(e.max, e.hp + 10 * n * dt); e.flash = Math.max(e.flash, 0.15); }
    }
    if (T.splits) {
        const next = T.splits[e.phase || 0]; if (next && e.hp < e.max * next) { e.phase = (e.phase || 0) + 1; Kinds.split(e, P, G); return true; }
        if (e.cool2 <= 0 && e.state === 'walk' && pd > 5) { e.cool2 = T.step.cool * (e.rage ? 0.6 : 1); const f = World.free(P.x + Math.sin(P.yaw) * 7, P.z + Math.cos(P.yaw) * 7, 0.5); if (Math.hypot(f[0] - P.x, f[1] - P.z) > 3) { World.dust(e.x, 1.5, e.z, 8, 0.4, 0.38, 0.5); e.x = f[0]; e.z = f[1]; e.born = 0.35; World.dust(e.x, 1.5, e.z, 8, 0.4, 0.38, 0.5); Snd.tone(220, 0.25, 0.5, 'sine', 60); } }
    }
    return false;
};
// the moment of a shocker's bolt, a lasher's whip, a lobber's throw
Kinds.cast = function (e, C, P, px, pz, pd, G) {
    const l = pd || 1, sees = World.sees(e.x, e.z, P.x, P.z, 1.4), mine = G.players[0] === P;
    if (C.kind === 'zap') { for (let i = 1; i < 9; i++) World.sparks.add(e.x + px * i / 9 + rand(-0.15, 0.15), 1.3 + rand(-0.15, 0.15), e.z + pz * i / 9 + rand(-0.15, 0.15), 0, 0, 0, 0.35, -1.5, 0.12, 0.5, 0.8, 1.8, 1); Snd.tone(1900, 0.25, 0.25, 'sawtooth', 200); if (sees && pd < C.range + 2) { G.hurt(e.tgt, e.T.dmg * G.dmgK, e.x, e.z, e); if (mine && !P.dead) { P.jam = C.jam; HUD.callout('GUN JAMMED'); } } }
    else if (C.kind === 'lash') { World.tracer(e.x, 1.4, e.z, P.x, 1.2, P.z); Snd.noise(0.4, 3000, 400, 0.15); if (sees && pd < C.range + 2) { G.hurt(e.tgt, e.T.dmg * G.dmgK, e.x, e.z, e); if (mine && !P.dead && pd > 2) { P.pull = { x: -px / l, z: -pz / l, d: Math.min(C.pull, pd - 1.6) }; HUD.callout('DRAGGED'); } } }
    else if (C.kind === 'lob') { const tm = clamp(pd / 14, 0.9, 1.9), y0 = 1.7 * e.size; Foes.shots.push({ x: e.x, y: y0, z: e.z, vx: px / tm, vy: -y0 / tm + 0.5 * 4.9 * tm, vz: pz / tm, t: 0, dmg: e.T.dmg, by: e.id, lob: C.r }); Snd.noise(0.2, 700, 200, 0.25, 200); }
};
// the Hollow King becomes four: he goes somewhere else, three that are not him appear, the first hit on the real one ends it
Kinds.split = function (e, P, G) {
    const F = G.flows[e.tgt] || World.mainFlow, spots = []; for (let i = 0; i < 4; i++) { const a = Math.random() * 6.28 + i * 1.57, f = World.free(P.x + Math.cos(a) * 11, P.z + Math.sin(a) * 11, 0.5); spots.push(f); }
    World.dust(e.x, 1.5, e.z, 10, 0.4, 0.38, 0.5); e.x = spots[0][0]; e.z = spots[0][1]; e.born = 0.4; e.split = true; e.state = 'walk'; e.t = 0;
    for (let i = 1; i < 4; i++) { const d = Foes.spawn('hollow', spots[i][0], spots[i][1], 1, 1); d.decoy = true; d.hp = d.max = 1; d.size = e.size; d.speed = e.speed; d.born = 0.4; }
    HUD.banner('WHICH ONE?', 'only one of them is real'); Snd.tone(110, 0.3, 1.2, 'sine', 55); Snd.boom(0.5);
};
// drawing: which clip (null: the usual) and how far into it (undefined: the usual)
Kinds.clip = function (e, cl) { const s = e.state; return s === 'down' ? cl.die : s === 'rise' ? (cl.rise || cl.die) : s === 'dig' ? (cl.dig || cl.attack) : s === 'cast' ? (e.type === 'hollow' && cl.cast ? cl.cast : cl.attack) : s === 'aim' || s === 'erupt' ? cl.attack : s === 'idle' || s === 'vent' || s === 'stun' ? (cl.idle || cl.walk) : null; };
Kinds.clipT = function (e, C, cl) { const s = e.state, dieLen = C.dieLen; return s === 'down' ? dieLen - 0.02 : s === 'rise' ? (cl.rise ? e.t : Math.max(0, dieLen * (1 - e.t / 1.4))) : s === 'aim' ? Math.min(e.t, C.atkLen * 0.75) : undefined; };
Kinds.hidden = e => e.under || e.gone || (e.vis !== undefined && e.vis < 0.5);
// what the armory's page on the ashen says about each kind, once you have put one down
const KIND_INFO = {
    walker: 'The plain ashen. Slow, many, and never alone.', runner: 'Fast and frail. It reaches you first.', brute: 'Shrugs off small rounds. Aim for the head, or bring something heavy.',
    spitter: 'Throws from a distance and keeps that distance. Close in, or out-range it.', cinder: 'It glows, and it bursts when it reaches you. Shoot it while it is among its friends.',
    charger: 'Winds up, then runs straight at you. Step aside: a wall stuns it.', leaper: 'Jumps the last few metres. Keep moving.', bulwark: 'A shield in front. Go for the head or the back, or use a blast.',
    howler: 'Its howl makes everything near it faster. Kill it first.', husk: 'Bursts into mites when it dies.', mite: 'Small, quick and weak. They come in threes.',
    bloater: 'Leaves a burning puddle where it falls. Do not drop it at your own feet.', risen: 'Gets up again, once, unless it was the head or a blast that put it down.',
    gunner: 'Takes aim (you can see the line), then fires. Break its line of sight in time.', stalker: 'Cannot be seen until it is close or hurt. Watch for the dust it kicks up.',
    burrower: 'Goes under the ground, where nothing can hurt it, and comes up beside you.', shocker: 'Its bolt jams your gun for two seconds.', mender: 'Keeps healing the worst hurt near it. Kill it first.',
    lobber: 'Throws burning lumps over cover. Where they land burns.', lasher: 'Whips you off your feet and drags you to it.', chiller: 'Everything near it moves slowly, you included.',
    foreman: 'BOSS. Armoured in front. Make him charge into a wall: stunned, he is soft.', widow: 'BOSS. Shielded while three of her brood are alive. Kill the mites.', warden: 'BOSS. Cannot be hurt while his pylons stand. They come twice.',
    furnace: 'BOSS. Too hot to hurt much, until it vents after raining fire.', hollow: 'BOSS. Becomes four, twice; only one is real. He steps behind you.'
};
