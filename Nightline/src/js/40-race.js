// ============================================================
// A race: eight cars on the grid, lights, laps, places, the computer's drivers, the camera, and what the cars leave in the
// picture (their lamps on the wet road, the pools of their headlamps, smoke, sparks, marks).
// Race.start({ circuit, car, paint, laps, level, mode })   mode: 'race' | 'trial' (alone against the clock) | 'show' (the menu's car, driven for you) | 'park' (the garage: it stands on the road, the camera walks round it)
// The race runs in fixed steps (Race.step); Race.frame draws what a step left.
// ============================================================
const LEVELS = [{ name: 'ROOKIE', skill: [0.84, 0.91] }, { name: 'PRO', skill: [0.915, 0.965] }, { name: 'ELITE', skill: [0.975, 1.02] }];
const BOT_NAMES = ['VEGA', 'ONYX', 'RIOT', 'ECHO', 'NOVA', 'JINX', 'DUSK', 'KANE', 'LUX', 'ZERO', 'MIRA', 'ASH'];
const Race = { on: false, cars: [], me: null, state: 'idle', t: 0, go: 0, laps: 3, mode: 'race', level: 0, cam: null, order: [], msg: null, camMode: 0, fov: 64, camYaw: 0, shake: 0, spin: 2.45, hold: false, seat0: 0 };

Race.clear = function () { for (const c of Race.cars) if (c.mdl) c.mdl.remove(); Race.cars = []; Race.me = null; Race.on = false; Race.state = 'idle'; if (World.smoke) { World.smoke.clear(); World.sparks.clear(); World.skidList.length = 0; } Snd.engineOff(); };
Race.start = async function (o, prog) {
    Race.clear(); Race.busy = true; const mode = o.mode || 'race', S = Save.data, idle = mode === 'show' || mode === 'park';
    await World.load(o.circuit || 'quay', prog);
    const myId = CARS[o.car] ? o.car : 'kite', level = clamp(o.level | 0, 0, 2), n = mode === 'race' ? 8 : 1;
    // the field: your car last on the grid, the others in every model there is, each with your car's numbers trimmed to its driver's skill
    const ci = CARS[myId].ci, pool = CAR_IDS.filter(id => id !== myId).sort((a, b) => Math.abs(CARS[a].ci - ci) - Math.abs(CARS[b].ci - ci) || CAR_IDS.indexOf(a) - CAR_IDS.indexOf(b)), others = pool.slice(0, n - 1);      // your own class first, then the classes next to it
    await Cars.load([myId].concat(others));
    const mine = CARS[myId], names = BOT_NAMES.slice().sort(() => Math.random() - 0.5), usedPaint = [o.paint | 0];
    for (let k = 0; k < n; k++) {
        const isMe = k === n - 1, id = isMe ? myId : others[k]; let paint = o.paint | 0; if (!isMe) { paint = (usedPaint[0] % PAINTS_FREE + 1 + k) % PAINTS_FREE; }
        const c = newCar(id, paint); c.me = isMe && !idle; c.name = isMe ? 'YOU' : names[k]; c.slot = k;
        if (!isMe || mode === 'show') {
            const L = LEVELS[level].skill, sk = mode === 'show' ? 0.9 : lerp(L[1], L[0], n > 2 ? k / (n - 2) : 0) + rand(-0.008, 0.008);
            c.def = Object.assign({}, CARS[id], { top: mine.top, pw: mine.pw, acc: mine.acc, grip: mine.grip, brake: mine.brake, rear: 1.0 });
            c.bot = { skill: sk, off: rand(-1.1, 1.1), v: Track.speeds(mine.grip * 0.86 * sk * sk, mine.brake * 0.8, mine.acc * 0.8, mine.top * (0.94 + 0.06 * sk)), side: 0, sideT: 0 };
        }
        // two columns, staggered, nine metres apart, behind the line
        const back = mode === 'race' ? (k + 1) * 9 + 3 : 12; Car.place(c, -back / Track.step, mode === 'race' ? (k % 2 ? -2.7 : 2.7) : 0); c.prog = -back / Track.step;
        c.mdl = carModel(c, World.scene); Car.frame(c, 0.016); Race.cars.push(c); if (isMe) Race.me = c;
    }
    Race.mode = mode; Race.level = level; Race.laps = mode === 'race' ? clamp(o.laps | 0 || 3, 1, 9) : 0; Race.t = 0; Race.go = idle ? 0 : 3.6; Race.state = idle ? 'race' : 'grid'; Race.order = Race.cars.slice(); Race.finish = [];
    Race.cam = { u: Race.me.tu, x: 0, y: 0, z: 0 }; Race.camYaw = Race.me.yaw; Race.camMode = idle ? 3 : S.settings.cam | 0; Race.seat0 = S.seat[myId] | 0; Race.best = Save.best(Track.id, myId).lap || 0; Race.lights = 0; Race.msg = null;
    Race.on = true; Race.busy = false; simAcc = 0; if (!idle) { Snd.init(); Snd.engineOn(); }
    return true;
};
Race.say = (text, sub, t) => { Race.msg = { text, sub: sub || '', t: t || 2.2 }; };

// ---- one step of the race ----
Race.step = function (dt) {
    const cars = Race.cars, me = Race.me;
    if (Race.state === 'grid') { Race.go -= dt; const n = Race.go > 2.6 ? 0 : Race.go > 1.8 ? 1 : Race.go > 1.0 ? 2 : Race.go > 0 ? 3 : 4; if (n !== Race.lights) { Race.lights = n; if (n > 0 && n < 4) Snd.tone(440, 0.25, 0.18, 'square'); if (n === 4) { Snd.tone(880, 0.3, 0.5, 'square'); Race.state = 'race'; Race.t = 0; for (const c of cars) c.lapT0 = 0; } } }
    const live = Race.state !== 'grid'; if (live) Race.t += dt;
    for (const c of cars) {
        const k = c.ctl;
        if (c.bot) Race.drive(c, dt, live);
        else if (Race.mode === 'park') { k.gas = k.brake = k.steer = 0; k.hand = false; }
        else if (c.done) { k.gas = 0; k.brake = c.u > 14 ? 0.5 : 0; k.steer = 0; k.hand = false; Race.drive(c, dt, true, true); }
        else {
            const L = keys.KeyA || keys.ArrowLeft, Rr = keys.KeyD || keys.ArrowRight; k.steer = Pad.on && Pad.steer ? -Pad.steer : (L ? 1 : 0) - (Rr ? 1 : 0);
            k.gas = Math.max(keys.KeyW || keys.ArrowUp ? 1 : 0, Pad.gas); k.brake = Math.max(keys.KeyS || keys.ArrowDown ? 1 : 0, Pad.brake); k.hand = !!keys.Space || Pad.hand;
            if (!live) { k.gas = 0; k.brake = 1; k.hand = true; }
        }
        Car.step(c, dt);
    }
    // cars against cars: two round bumpers each (front and back), pushed apart and their closing speed shared
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i], b = cars[j]; if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7) continue;
        for (const sa of [1, -1]) for (const sb of [1, -1]) {
            const ra = a.def.wid / 2, rb = b.def.wid / 2, oa = sa * (a.def.len / 2 - ra), ob = sb * (b.def.len / 2 - rb), ax = a.x + Math.sin(a.yaw) * oa, az = a.z + Math.cos(a.yaw) * oa, bx = b.x + Math.sin(b.yaw) * ob, bz = b.z + Math.cos(b.yaw) * ob;
            let dx = bx - ax, dz = bz - az; const D = Math.hypot(dx, dz), need = ra + rb; if (D >= need || D < 1e-4) continue; dx /= D; dz /= D; const push = (need - D) / 2;
            a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
            const wv = c => { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); return [s * c.u + co * c.v, co * c.u - s * c.v]; }, va = wv(a), vb = wv(b), rel = (va[0] - vb[0]) * dx + (va[1] - vb[1]) * dz;
            if (rel > 0) { const imp = rel * 0.6; va[0] -= dx * imp; va[1] -= dz * imp; vb[0] += dx * imp; vb[1] += dz * imp; for (const [c, v, o2, sg] of [[a, va, oa, -1], [b, vb, ob, 1]]) { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); c.u = s * v[0] + co * v[1]; c.v = co * v[0] - s * v[1]; c.w += sg * (dx * co - dz * s) * o2 * imp * 0.04; }
                if (rel > 2 && (a === me || b === me)) { Snd.thud(Math.min(0.5, rel * 0.05)); Race.shake = Math.min(1, Race.shake + rel * 0.05); } }
        }
    }
    // laps, places, the finish
    if (live) for (const c of cars) {
        const lap = Math.floor(c.prog / Track.N);
        if (lap > c.lap) {
            c.lap = lap; if (lap >= 1) { const t = Race.t - c.lapT0; c.laps.push(t); c.lapT0 = Race.t; if (c === me && Race.mode !== 'show' && Race.mode !== 'park') Race.lapDone(t); }
            if (Race.mode === 'race' && lap >= Race.laps && !c.done) { c.done = Race.t; Race.finish.push(c); if (c === me) Race.end(); }
        }
        // a car that has stopped against something for a while is put back on the road (the driver's own key is R)
        if (c.bot && !c.done) { if (Math.abs(c.u) < 1.2) c.stuck += dt; else c.stuck = 0; if (c.stuck > 2.5) { Car.place(c, c.tu, clamp(c.td, -3, 3)); c.u = 6; c.stuck = 0; } }
    }
    if (me && !me.bot && !me.done && live) {
        if (hit.KeyR) { Car.place(me, me.tu, 0); me.u = 4; Race.say('BACK ON THE ROAD'); }
        // the wrong way: nose against the circuit for more than a moment
        const o = me.o; Track.at(me.tu, o); const facing = Math.sin(me.yaw) * o.tx + Math.cos(me.yaw) * o.tz; me.wrong = facing < -0.3 && me.u > 3 ? me.wrong + dt : 0;
    }
    Race.order = cars.slice().sort((a, b) => (a.done && b.done ? a.done - b.done : a.done ? -1 : b.done ? 1 : b.prog - a.prog));
    if (Race.state === 'over') { Race.overT -= dt; }
};
Race.place = c => Race.order.indexOf(c) + 1;
Race.lapDone = function (t) {
    const S = Save.data, me = Race.me, first = !Race.best, better = Save.setBest(Track.id, me.id, 'lap', t);
    if (better) { Race.best = t; Race.say(first ? 'LAP ' + fmtTime(t) : 'BEST LAP ' + fmtTime(t), first ? '' : 'a new record in the ' + me.def.name, 3); Snd.tone(660, 0.2, 0.25, 'triangle', 990); Save.store(); }
    else Race.say('LAP ' + fmtTime(t), '+' + (t - Race.best).toFixed(3), 2.4);
    if (Race.mode === 'race' && me.lap === Race.laps - 1) setTimeout(() => { if (Race.on && !me.done) Race.say('FINAL LAP'); }, 2500);
    S.km += Track.len / 1000; SEAT.add(me.id, Track.len / 100); if (!better) Save.store();
};
Race.end = function () {
    const me = Race.me, S = Save.data, place = Race.finish.indexOf(me) + 1, got = [];
    S.races++; if (place <= 3) S.podiums++; if (place === 1) S.wins++;
    Save.setBest(Track.id, me.id, 'race', me.done);
    const m = S.medals[Track.id] | 0, mine = place === 1 ? Race.level + 1 : 0; if (mine > m) S.medals[Track.id] = mine;
    // what a result opens
    const open = id => { if (!S.cars[id]) { S.cars[id] = 1; got.push(id); } };
    for (const id of CAR_IDS) if (CLASSES[CARS[id].ci].test(place, Race.level)) open(id);      // a result opens a whole class
    const s1 = SEAT.add(me.id, (place >= 1 && place <= 3 ? [60, 40, 30][place - 1] : 15) * (1 + Race.level * 0.5)), from = SEAT.level(Race.seat0), to = SEAT.level(s1);
    Save.store(); Race.state = 'over'; Race.overT = 3.2; Race.result = { place, time: me.done, best: Math.min.apply(null, me.laps), got, level: Race.level, seat: { gain: s1 - Race.seat0, from, to, paints: PAINTS.filter(p => p[3] > from && p[3] <= to).map(p => p[0]) } };
    Snd.tone(place === 1 ? 784 : 523, 0.25, 0.6, 'triangle', place === 1 ? 1175 : 392);
};

// ---- the computer's driver: aims the car at a point ahead on the fast line, at the speed the line allows there ----
Race.drive = function (c, dt, live, coast) {
    const k = c.ctl, b = c.bot || { off: 0, v: null, skill: 0.9, side: 0, sideT: 0 }, d = c.def, sp = Math.abs(c.u), N = Track.N, o = c.o;
    if (!live) { k.gas = 0; k.brake = 1; k.steer = 0; k.hand = true; return; } k.hand = false;
    // room: a car just ahead in the same part of the road is gone round on the side with more space
    let side = 0, lift = 0;
    for (const x of Race.cars) { if (x === c) continue; const gap = Track.ahead(c.tu, x.tu) * Track.step; if (gap < 1.5 || gap > 16 + sp * 0.4) continue; if (Math.abs(x.td - c.td) > 2.3 || c.u < x.u - 1) continue; side = x.td > 0 ? -1 : 1; if (gap < 6.5 && c.u > x.u + 1.5) lift = 1; }
    if (side) { b.side = side; b.sideT = 1.2; } else if ((b.sideT -= dt) < 0) b.side = 0;
    const la = (7 + sp * 0.42) / Track.step, iu = c.tu + la, i = Math.floor(iu) % N, lim = Track.W / 2 - d.wid / 2 - 0.5, off = clamp(Track.line[i] * 0.94 + b.off + b.side * 2.6, -lim, lim);
    Track.spot(iu, off, o); const want = Math.atan2(o.x - c.x, o.z - c.z), err = angDiff(want, c.yaw), dist = Math.hypot(o.x - c.x, o.z - c.z);
    const delta = Math.atan(2 * d.L * Math.sin(err) / Math.max(dist, 3)), dmax = Math.min(0.56, 1.7 * d.grip * d.L / Math.max(sp * sp, 1) + 0.03);
    k.steer = clamp(delta / dmax, -1, 1);
    if (coast) return;
    let vt = b.v ? Math.min(b.v[Math.floor(c.tu) % N], b.v[Math.floor(c.tu + sp * 0.3 / Track.step) % N] + 0.5) : 30; const me = Race.me;      // the speed for where it is, and for where it will be in a third of a second
    // the field stays a race: a driver far ahead of you eases a touch, one far behind tries a touch harder
    if (me && !me.bot && Race.mode === 'race') { const gap = (c.prog - me.prog) * Track.step; vt *= gap > 90 ? 0.972 : gap < -90 ? 1.02 : 1; }
    if (lift) vt = Math.min(vt, c.u - 1);
    // off the fast line (going round someone, or pushed wide) the bend is tighter than the line's: slower, and slower still drifting toward a barrier
    const wide = Math.abs(c.td - Track.line[Math.floor(c.tu) % N] * 0.94 - b.off); if (wide > 1.2 || b.side) vt *= clamp(1 - (wide - 1.2) * 0.03, 0.86, 1) * (b.side ? 0.97 : 1);
    const edge = Math.abs(c.td) - (Track.half - d.wid / 2 - 1.3); if (edge > 0) { vt *= 0.9; k.steer = clamp(k.steer - (c.td > 0 ? 1 : -1) * edge * 0.5, -1, 1); }
    const dv = vt - c.u; k.gas = dv > 0 ? clamp(dv * 0.6 + 0.25, 0, 1) : 0; k.brake = dv < -0.6 && c.u > 4 ? clamp(-dv * 0.5, 0, 1) : 0;
    if (c.u < 2 && Math.abs(err) > 1.2) { k.gas = 0; k.brake = c.u > -3 ? 1 : 0; k.steer = -k.steer; }      // nose to the barrier: back out, the wheel the other way
    if (Math.abs(c.slipR) > 0.3) k.gas *= 0.4;      // the back is stepping out: ease off
};

// ---- what a frame shows ----
const RO = {};
Race.frame = function (dt) {
    if (!Race.on) return; const me = Race.me, cam = World.camera;
    for (const c of Race.cars) {
        Car.frame(c, dt);
        const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw), d = c.def, sp = Math.abs(c.u);
        // tyres letting go: smoke from the rear, a mark on the road
        if (c.slip > 0.2 && sp > 7 && !App.paused) {
            const a = clamp((c.slip - 0.2) * 3, 0, 1);
            for (const s of [1, -1]) { const wx = c.x - sy * d.L / 2 + cy * s * (d.wid / 2 - 0.15), wz = c.z - cy * d.L / 2 - sy * s * (d.wid / 2 - 0.15);
                if (Math.random() < dt * 40 * a) World.smoke.add(wx, c.y + 0.2, wz, rand(-1, 1) + sy * c.u * 0.15, rand(0.4, 1.3), rand(-1, 1) + cy * c.u * 0.15, rand(0.7, 1.1), rand(1.6, 2.6), rand(0.7, 1.3), 0.55, 0.58, 0.66, 0.34 * a);
                if (c.skT === undefined || (c.skT -= dt) <= 0) { const vx = sy * c.u + cy * c.v, vz = cy * c.u - sy * c.v, vl = Math.hypot(vx, vz) || 1; World.skid(wx, c.y, wz, vx / vl, vz / vl, Math.max(0.5, vl * 0.045), 0.5 * a, 0); } }
            if (c.skT === undefined || c.skT <= 0) c.skT = 0.03;
        }
        // against the barrier: sparks, a thump
        if (c.hit) { const s = c.hitSide, n = Math.min(14, 3 + c.hit * 2); Track.at(c.tu, RO); const px = c.x + RO.tz * s * d.wid / 2, pz = c.z - RO.tx * s * d.wid / 2; for (let i = 0; i < n; i++) World.sparks.add(px, c.y + rand(0.2, 0.7), pz, sy * c.u * 0.4 + rand(-3, 3) - RO.tz * s * 3, rand(1, 5), cy * c.u * 0.4 + rand(-3, 3) + RO.tx * s * 3, rand(0.06, 0.14), 0, rand(0.25, 0.6), 1, 0.72, 0.3, 1);
            if (c === me) { Snd.thud(Math.min(0.6, 0.1 + c.hit * 0.06)); Race.shake = Math.min(1, Race.shake + c.hit * 0.07); } c.hit = 0; }
    }
    // the camera
    const c = me, d = c.def, sp = Math.abs(c.u), vx = Math.sin(c.yaw) * c.u + Math.cos(c.yaw) * c.v, vz = Math.cos(c.yaw) * c.u - Math.sin(c.yaw) * c.v;
    const heading = sp > 9 && c.u > 0 ? Math.atan2(vx, vz) : c.yaw; Race.camYaw += angDiff(c.yaw + angDiff(heading, c.yaw) * 0.55, Race.camYaw) * Math.min(1, dt * 6.5);
    Race.shake = Math.max(0, Race.shake - dt * 2.2); const sh = Save.data.settings.shake ? Race.shake * 0.25 + Math.max(0, sp / d.top - 0.82) * 0.03 : 0, jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh;
    const m = Race.camMode, cyw = Race.camYaw, fx = Math.sin(cyw), fz = Math.cos(cyw); let ex, ey, ez, tx, ty, tz;
    if (m === 2) { const s = Math.sin(c.yaw), co = Math.cos(c.yaw); ex = c.x + s * 0.35; ey = c.y + d.h * 0.78 + 0.25; ez = c.z + co * 0.35; tx = c.x + s * 20; ty = c.y + 1 + Math.tan(c.pitch) * 20; tz = c.z + co * 20; }
    else if (m === 3) { const P = Race.mode === 'park', a = App.t * 0.16, O = Race.orbit; if (P && !Race.hold) Race.spin += dt * 0.22;      // the garage: a slow walk round the car (dragging turns it: UI)
        const r = O ? O[1] : P ? 4.6 + d.len * 0.36 : 7.2, an = c.yaw + (O ? O[0] : P ? Race.spin : 2.5 + Math.sin(a) * 0.9); ex = c.x + Math.sin(an) * r; ey = c.y + (O ? O[2] : P ? 1.3 : 1.25 + Math.sin(a * 0.7) * 0.35); ez = c.z + Math.cos(an) * r; tx = c.x; ty = c.y + 0.75; tz = c.z; }      // round the car (the menu); Race.orbit = [angle, distance, height] holds it still for a picture
    else { const back = (m === 1 ? 8.8 : 6.3) + sp * 0.012, up = m === 1 ? 3.3 : 2.25; ex = c.x - fx * back; ey = c.y + up; ez = c.z - fz * back; tx = c.x + fx * 4; ty = c.y + 1.0; tz = c.z + fz * 4;
        // the camera stays inside the barriers too
        Track.locate(ex, ez, c.tu, RO); const lim = Track.half - 0.6; if (Math.abs(RO.d) > lim) { const over = Math.abs(RO.d) - lim, s = RO.d > 0 ? 1 : -1; Track.at(RO.u, RO); ex -= RO.tz * s * over; ez += RO.tx * s * over; } Track.locate(ex, ez, c.tu, RO); Track.spot(RO.u, RO.d, RO); ey = Math.max(ey, RO.y + 1.1); }
    const cm = Race.cam; cm.x = ex + jx; cm.y = ey + jy; cm.z = ez; cm.u = c.tu;
    const fov = (m === 2 ? 72 : Race.mode === 'park' ? 50 : 60) + clamp(sp / d.top, 0, 1.1) * 15; Race.fov = lerp(Race.fov, fov, Math.min(1, dt * 4)); if (Math.abs(cam.fov - Race.fov) > 0.05) { cam.fov = Race.fov; cam.updateProjection(); }
    cam.lookFrom(cm.x, cm.y, cm.z, tx, ty, tz);
    if (Race.msg && (Race.msg.t -= dt) <= 0) Race.msg = null;
    if (!me.bot && !App.paused && Race.mode !== 'park') Snd.engine(me.rpm, me.ctl.gas, clamp((me.slip - 0.16) * 3, 0, 1) * (sp > 5 ? 1 : 0), sp);
    if (Race.state === 'over' && Race.overT <= 0 && !Race.shown) { Race.shown = true; UI.results(); }
};
// every car's lamps on the wet road, the pool its headlamps throw ahead, the dark under it, the colour under it
Race.lamps = function (W, cx, cy, cz) {
    const P = World.pools, S = World.shade, cw = World.camera.matrixWorld.elements, fx = -cw[8], fz = -cw[10]; P.begin(); S.begin();
    for (const c of Race.cars) {
        const m = c.mdl; if (!m) continue; const sy = Math.sin(c.yaw), cyw = Math.cos(c.yaw), d = c.def, rise = Math.tan(c.pitch || 0), g = m.glow, br = 0.55 + (c.brakeL || 0) * 0.9;
        S.put(c.x, c.y + 0.03, c.z, sy, cyw, d.len * 1.12, d.wid * 1.3, 1, 1, 1, 0.8, rise);
        P.put(c.x, c.y + 0.04, c.z, sy, cyw, d.len * 1.5, d.wid * 2.3, g[0], g[1], g[2], 0.34, rise);                                         // the colour under the car
        P.put(c.x + sy * (d.len / 2 + 7.5), c.y + 0.05 + rise * 7.5, c.z + cyw * (d.len / 2 + 7.5), sy, cyw, 17, 7.5, 1, 0.95, 0.82, 0.2, rise);      // headlamps on the road
        P.put(c.x - sy * (d.len / 2 + 1.2), c.y + 0.05, c.z - cyw * (d.len / 2 + 1.2), sy, cyw, 3.4, 3.4, 1, 0.08, 0.05, 0.16 * br, rise);          // the red behind it
        for (const t of m.tail) World.streak(c.x + cyw * t[0] + sy * t[2], c.y + t[1], c.z - sy * t[0] + cyw * t[2], 1, 0.1, 0.07, 0.75 * br, cx, cy, cz, fx, fz, c.tu, Race.cam.u);
        if (c !== Race.me || Race.camMode === 3) for (const t of m.head) World.streak(c.x + cyw * t[0] + sy * t[2], c.y + t[1], c.z - sy * t[0] + cyw * t[2], 1, 0.96, 0.85, 0.8, cx, cy, cz, fx, fz, c.tu, Race.cam.u);
    }
    P.end(); S.end();
};
