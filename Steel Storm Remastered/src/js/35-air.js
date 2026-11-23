// ============================================================
// AIRCRAFT (the air line of the tree: fighters, attackers, bombers, helicopters). An aircraft is a unit like a tank
// (Units.make) with U.air set: it has a height, a pitch and a roll, and it never stops. You fly it by looking: the nose
// follows the way the camera looks (or A D and the arrow keys), at the aircraft's own rate of turn; W and S are the throttle.
// A helicopter is flown as in the old Steel Storm: W S forward and back, A D sideways, E Q up and down, the nose turns to
// where you look, and its gun and rockets go where you look (within reach of the nose), not only straight ahead. It can
// stand still in the air and be set down.
//   weapons   AC  the nose gun (hold the trigger)     RKT  rockets, straight ahead     BOMB  dropped, they keep your speed
// It is hit like anything else (no armour: every hit counts), and it is lost if it touches the ground.
// ============================================================
SHELLS.rk = { name: 'RKT', full: 'ROCKETS', dmg: 250, splash: 6 }; SHELLS.bm = { name: 'BOMB', full: 'BOMBS', dmg: 640, splash: 16 };
const Air = { CD: { ac: 0.085, rk: 0.7, bm: 1.5 }, ALT: 120, HELI_ALT: 34, TOP: 400 };
// a new aircraft's own state (Units.make calls this for a vehicle with air set)
Air.init = function (U) {
    const D = U.def, M = Units.models[U.pre]; U.air = true; U.heli = !!D.heli; U.pitch = 0; U.roll = 0; U.thr = U.heli ? 0 : 0.8; U.v = U.k.fly * U.thr; U.side = 0; U.vyH = 0; U.aimDir = null; U.cd = { ac: 0, rk: 0, bm: 0 }; U.down = false; U.crashed = false; U.vy = 0;
    U.y = World.height(U.x, U.z) + (U.heli ? Air.HELI_ALT : Air.ALT); U.half = [M.half[0] * 0.5, M.half[1]]; U.yLo = M.yLo === undefined ? -1.5 : M.yLo; U.hullTop = M.hullTop; U.turTop = M.hullTop; U.muzzle = U.barrel ? M.muzzle : [0, -0.4, M.half[1]];
};
// one frame of flying toward a heading (wantYaw) and a climb (wantPitch). A plane: thr -1..1 moves the throttle.
// A helicopter: thr is forward (1) or back (-1), c = { side, up } slides it sideways (1 = to its right) and lifts or lowers it.
// (Here a growing yaw is a turn to the LEFT, and a positive roll lifts the left side: a turn banks into itself.)
Air.fly = function (U, wantYaw, wantPitch, thr, dt, G, c) {
    const K = U.k, L = World.lim; if (U.dead) return;
    if (U.x < L[0] - 180 || U.x > L[1] + 180 || U.z < L[2] - 180 || U.z > L[3] + 180) { wantYaw = Math.atan2(World.mid[0] - U.x, World.mid[1] - U.z); wantPitch = Math.min(wantPitch, 0.1); }      // off the edge of the map: it comes round
    if (U.y > Air.TOP) wantPitch = Math.min(wantPitch, -0.1);
    if (U.heli) {
        const sp = K.fly, fwdT = thr * sp * (thr < 0 ? 0.5 : 1), sideT = (c ? c.side || 0 : 0) * sp * 0.45, yr = clamp(wrapA(wantYaw - U.yaw) * 2.2, -K.turn, K.turn);
        U.v += (fwdT - U.v) * Math.min(1, dt * (fwdT === 0 ? 2.8 : 1.5)); U.side += (sideT - U.side) * Math.min(1, dt * (sideT === 0 ? 3 : 1.8)); U.yaw += yr * dt;
        const sy = Math.sin(U.yaw), cy = Math.cos(U.yaw), gnd0 = World.top(U.x, U.z) + 1.8, near = U.y - gnd0;
        let vyT = clamp(c ? c.up || 0 : 0, -1, 1) * 14; if (vyT < 0 && near < 7) vyT = Math.max(vyT, -1.5 - near * 0.9);          /* the ground cushions the last metres: it can always be set down */
        U.vyH += (vyT - U.vyH) * Math.min(1, dt * 2); if (near < 7) U.vyH = Math.max(U.vyH, -1.5 - Math.max(0, near) * 1.4);
        U.x += (sy * U.v - cy * U.side) * dt; U.z += (cy * U.v + sy * U.side) * dt; U.y += U.vyH * dt;
        const floor = World.top(U.x, U.z) + 1.8;
        if (U.y < floor) { if (Math.hypot(U.v, U.side) > sp * 0.8 && floor - U.y > 1.2) { U.y = floor; U.down = true; U.crashed = true; Units.damage(U, 1e6, null, G, 'CRASHED'); return; } U.y = floor; U.vyH = Math.max(0, U.vyH); }          /* flown fast into a hillside or a wall: lost. Anything gentler: it sits */
        if (U.y > World.height(U.x, U.z) + 240) { U.y = World.height(U.x, U.z) + 240; U.vyH = Math.min(0, U.vyH); }
        U.pitch += (clamp(-U.v / sp * 0.28, -0.3, 0.3) - U.pitch) * Math.min(1, dt * 3); U.roll += (clamp(U.side / sp * 0.9 - yr * 0.15, -0.4, 0.4) - U.roll) * Math.min(1, dt * 3);
    } else {
        U.thr = clamp(U.thr + thr * dt * 0.6, 0.5, 1);
        const my = K.turn * clamp(1.25 - U.v / K.fly * 0.4, 0.7, 1.1), yr = clamp(wrapA(wantYaw - U.yaw) * 2.6, -my, my), pr = clamp((clamp(wantPitch, -1.2, 1.2) - U.pitch) * 2.6, -my * 0.85, my * 0.85);
        U.yaw += yr * dt; U.pitch = clamp(U.pitch + pr * dt, -1.3, 1.3); U.roll += (clamp(-yr / my, -1, 1) * 1.05 - U.roll) * Math.min(1, dt * 4);
        U.v += (K.fly * U.thr * (1 - Math.sin(U.pitch) * 0.3) - U.v) * Math.min(1, dt * 0.9); const cp = Math.cos(U.pitch);
        U.x += Math.sin(U.yaw) * cp * U.v * dt; U.y += Math.sin(U.pitch) * U.v * dt; U.z += Math.cos(U.yaw) * cp * U.v * dt;
        if (U.y < World.top(U.x, U.z) + 1.6) { U.y = World.top(U.x, U.z) + 1.6; U.down = true; U.crashed = true; Units.damage(U, 1e6, null, G, 'CRASHED'); }
    }
    for (const k in U.cd) U.cd[k] = Math.max(0, U.cd[k] - dt);
};
// the matrices from where it is and how it lies in the air
Air.place = function (U) {
    const TM = U.TM, cy = Math.cos(U.yaw), sy = Math.sin(U.yaw), cp = Math.cos(U.pitch), sp = Math.sin(U.pitch), cr = Math.cos(U.roll), sr = Math.sin(U.roll);
    const zx = sy * cp, zy = sp, zz = cy * cp, x0 = cy, z0 = -sy, yx = zy * z0 - zz * 0, yy = zz * x0 - zx * z0, yz = zx * 0 - zy * x0;         // forward; level right; up = forward x right
    TM[0] = x0 * cr + yx * sr; TM[1] = yy * sr; TM[2] = z0 * cr + yz * sr; TM[3] = 0; TM[4] = -x0 * sr + yx * cr; TM[5] = yy * cr; TM[6] = -z0 * sr + yz * cr; TM[7] = 0; TM[8] = zx; TM[9] = zy; TM[10] = zz; TM[11] = 0; TM[12] = U.x; TM[13] = U.y; TM[14] = U.z; TM[15] = 1;
    if (U.heli && U.turret) M4.mul(U.turret.local, U.turret.rest, rotY(TL, U.dead ? U.deadT * 3 : App.time * 26));          // the rotor
    HG3D.place(U.root, TM);
};
// fire one of its weapons (false: still loading)
Air.shoot = function (U, G, type) {
    if (U.cd[type] > 0 || U.dead) return false; U.cd[type] = Air.CD[type] * (U.ai ? 1.5 : 1) * (type === 'ac' ? 1 : U.k.reload); const T = U.TM, m = U.muzzle, cp = Math.cos(U.pitch), vx = Math.sin(U.yaw) * cp * U.v, vy = U.heli ? 0 : Math.sin(U.pitch) * U.v, vz = Math.cos(U.yaw) * cp * U.v;
    let x = T[0] * m[0] + T[4] * m[1] + T[8] * m[2] + T[12], y = T[1] * m[0] + T[5] * m[1] + T[9] * m[2] + T[13], z = T[2] * m[0] + T[6] * m[1] + T[10] * m[2] + T[14];
    if (type === 'bm') { Units.shells.push({ x: U.x, y: U.y - 1.6, z: U.z, vx, vy: Math.min(vy, 0), vz, t: 0, by: U, type, k: U.k.dmg }); Net.fired(U, Units.shells[Units.shells.length - 1]); G.heard(U.x, U.z, 0.2, 300, 0.2); return true; }
    const sv = type === 'ac' ? 430 : 230, j = (type === 'ac' ? 0.005 : 0.012) + (U.ai ? (1 - (U.ai.skill || 0.5)) * 0.035 : 0), D3 = U.heli && U.aimDir ? U.aimDir : [T[8], T[9], T[10]], side = type === 'rk' ? ((U.rkSide = -(U.rkSide || 1)) * U.half[0] * 0.8) : 0; x += T[0] * side; z += T[2] * side;
    Units.shells.push({ x, y, z, vx: (D3[0] + rand(-j, j)) * sv + vx, vy: (D3[1] + rand(-j, j)) * sv + vy, vz: (D3[2] + rand(-j, j)) * sv + vz, t: 0, by: U, type, k: U.k.dmg }); Net.fired(U, Units.shells[Units.shells.length - 1]);
    if (type === 'ac') { World.fire.add(x, y, z, 0, 0.5, 0, 0.9, 3, 0.07, 1, 0.9, 0.6, 1); G.heard(x, z, 0.28, 430, 0.1); } else { World.smoke.add(x, y, z, 0, 0.4, 0, 1.2, 3, 0.9, 0.8, 0.8, 0.8, 0.5); G.heard(x, z, 0.5, 260, 0.5); }
    return true;
};
// you, flying. A plane: the nose follows the way you look (the mouse, or A D and the arrow keys); W S throttle.
// A helicopter: W S forward and back, A D sideways, E Q up and down; the nose turns to where you look.
Air.player = function (P, G, dt) {
    const fw = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), lr = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); let wy = G.aimYaw, wp = G.aimPitch; G.lead = null;
    if (P.heli) {
        Air.fly(P, wy, wp, fw, dt, G, { side: lr, up: (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0) }); if (P.dead) return;
        /* its weapons go to what the cross is on, as far as the nose lets them (not behind it, not far above it) */
        const m = Units.muzzleOf(P, UM), far = G.aimHit ? 1 : 0, tx = far ? G.ax : TV.e[0] + TV.d[0] * 600, ty = far ? G.ay : TV.e[1] + TV.d[1] * 600, tz = far ? G.az : TV.e[2] + TV.d[2] * 600; let dx = tx - m[0], dy = ty - m[1], dz = tz - m[2]; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
        const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw), ahead = dx * fx + dz * fz; if (ahead < 0.15 || l < 6) { dx = fx; dy = -0.05; dz = fz; } dy = clamp(dy, -0.9, 0.3); const l2 = Math.hypot(dx, dy, dz) || 1; P.aimDir = [dx / l2, dy / l2, dz / l2];
    } else {
        G.aimYaw -= lr * dt * 1.5; G.aimPitch = clamp(G.aimPitch + ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * dt * 0.9, -1.1, 1.1); wy = G.aimYaw; wp = G.aimPitch;
        /* a little help: something hostile close to the cross pulls the nose onto where it will be, so the guns can hit it */
        const e = TV.e, d = TV.d; let best = 0.07;
        for (const O of Units.list) { if (O.dead || O.team === P.team) continue; const vx = O.x - e[0], vy = O.y + 1 - e[1], vz = O.z - e[2], L = Math.hypot(vx, vy, vz); if (L < 40 || L > 800) continue; const ang = Math.acos(clamp((vx * d[0] + vy * d[1] + vz * d[2]) / L, -1, 1)); if (ang >= best) continue; best = ang;
            const tof = Math.hypot(O.x - P.x, O.y - P.y, O.z - P.z) / 430, ov = O.v || 0, cp = O.air ? Math.cos(O.pitch || 0) : 1; G.lead = [O.x + Math.sin(O.yaw) * cp * ov * tof, O.y + 1 + (O.air ? Math.sin(O.pitch || 0) * ov * tof : 0), O.z + Math.cos(O.yaw) * cp * ov * tof]; }
        if (G.lead) { const lx = G.lead[0] - P.x, ly = G.lead[1] - P.y, lz = G.lead[2] - P.z; wy = Math.atan2(lx, lz); wp = Math.atan2(ly, Math.hypot(lx, lz)); }
        /* about to fly into the ground while not looking steeply down: it pulls up by itself */
        const agl = P.y - World.top(P.x, P.z), sink = -Math.sin(P.pitch) * P.v; G.pullUp = sink > 0 && agl < 70 && agl / sink < 1.4 && G.aimPitch > -0.7; if (G.pullUp) wp = Math.max(wp, 0.55);
        Air.fly(P, wy, wp, fw, dt, G); if (P.dead) return;
    }
    for (let i = 0; i < P.shells.length; i++) if (hit['Digit' + (i + 1)]) { P.shellType = P.shells[i]; Snd.ui('click'); }
    if (hit.KeyR && G.kits > 0 && P.hp < P.max) { G.kits--; P.hp = Math.min(P.max, P.hp + 250); HUD.callout('REPAIRED'); Snd.ui('buy'); }
    const t = P.shellType, want = App.locked && !G.over && (t === 'ac' ? mouse.down || !!keys.Space : mouse.fired || !!hit.Space);
    if (want && Air.shoot(P, G, t)) { G.shots += t === 'ac' ? 0.25 : 1; G.shakeK = Math.max(G.shakeK, t === 'ac' ? 0.1 : 0.35); }
    P.reload = P.cd[t]; Air.place(P);
    // where the selected weapon goes: far along the nose, or (a bomb) where it would land
    if (t === 'bm') { const h = Math.max(0, P.y - World.top(P.x, P.z)), tt = Math.sqrt(2 * h / 9.8), cp = Math.cos(P.pitch); GF[0] = P.x + Math.sin(P.yaw) * cp * P.v * tt; GF[2] = P.z + Math.cos(P.yaw) * cp * P.v * tt; GF[1] = World.top(GF[0], GF[2]); }
    else if (P.heli && P.aimDir) { const m = Units.muzzleOf(P, UM), r = G.aimHit ? Math.min(600, Math.hypot(G.ax - m[0], G.ay - m[1], G.az - m[2])) : 450; GF[0] = m[0] + P.aimDir[0] * r; GF[1] = m[1] + P.aimDir[1] * r; GF[2] = m[2] + P.aimDir[2] * r; }
    else { const T = P.TM; GF[0] = P.x + T[8] * 450; GF[1] = P.y + T[9] * 450; GF[2] = P.z + T[10] * 450; }
    P.laid = P.cd[t] <= 0; P.stop = false;
};
// the eye when you fly: behind and a little above, looking where you look
Air.eye = function (G, P) {
    const cp = Math.cos(G.aimPitch), d = TV.d, e = TV.e, s = G.sight, back = (P.heli ? 19 : 25) * (1 - s * 0.6); d[0] = Math.sin(G.aimYaw) * cp; d[1] = Math.sin(G.aimPitch); d[2] = Math.cos(G.aimYaw) * cp;
    e[0] = P.x - d[0] * back; e[1] = P.y - d[1] * back + 4.5 * (1 - s * 0.5); e[2] = P.z - d[2] * back; e[1] = Math.max(e[1], World.top(e[0], e[2]) + 1.5);
};
// the computer's pilots: pick something worth attacking, run in on it, fire what bears, break away, come round again
Air.ai = function (U, dt, G) {
    const A = U.ai, D = U.def; if (U.dead) return; A.t = (A.t || 0) - dt;
    if (!A.tgt || A.tgt.dead || A.tgtT < G.time) { let best = null, bs = 1e12; const wantsAir = D.br === 'ftr';
        for (const O of Units.list) { if (O.dead || O.team === U.team) continue; let d = Math.hypot(O.x - U.x, O.z - U.z); d *= (!!O.air === wantsAir) ? 0.35 : 1; if (D.br === 'bmb' && O.air) d *= 4; if (d < bs) { bs = d; best = O; } }
        A.tgt = best; A.tgtT = G.time + rand(3, 6); }
    const T = A.tgt, agl = U.y - World.top(U.x, U.z); let wy = U.yaw + 0.5 * dt, wp = 0, thr = U.heli ? 0 : 0.3, side = 0; A.bt = (A.bt || rand(0, 2)) + dt; const burst = A.bt % 2.4 < 0.9;
    if (!T) { wy = Math.atan2(World.mid[0] - U.x, World.mid[1] - U.z) + 1.3; wp = agl < 90 ? 0.2 : 0; }
    else {
        const tof = Math.hypot(T.x - U.x, T.z - U.z) / 430, tv = T.v || 0, tx = T.x + Math.sin(T.yaw) * tv * tof * (T.air ? Math.cos(T.pitch || 0) : 1), tz = T.z + Math.cos(T.yaw) * tv * tof * (T.air ? Math.cos(T.pitch || 0) : 1), ty = T.y + (T.air ? Math.sin(T.pitch || 0) * tv * tof : 1.2);
        const dx = tx - U.x, dz = tz - U.z, dh = Math.hypot(dx, dz), bear = Math.atan2(dx, dz), climb = Math.atan2(ty - U.y, dh), errY = Math.abs(wrapA(bear - U.yaw)), errP = Math.abs(climb - U.pitch);
        if (U.heli) {          // come to a stand-off and shoot from the hover
            wy = bear; thr = dh > 230 ? 1 : dh < 150 ? -1 : 0; side = dh < 300 ? Math.sin(G.time * 0.6 + (A.ph || (A.ph = rand(0, 6)))) * 0.8 : 0; const l3 = Math.hypot(dx, ty - U.y, dz) || 1; U.aimDir = [dx / l3, clamp((ty - U.y) / l3, -0.9, 0.3), dz / l3];
            if (errY < 0.5 && dh < 420 && burst) { Air.shoot(U, G, 'ac'); if (!T.air && dh < 330 && errY < 0.2) Air.shoot(U, G, 'rk'); }
        } else if (A.away > 0) { A.away -= dt; wy = A.awayYaw; wp = agl < 110 ? 0.3 : 0.05; thr = 1; }
        else {
            const level = D.br === 'bmb' && !T.air; wy = bear; wp = level ? (agl < 100 ? 0.2 : agl > 150 ? -0.1 : 0) : climb; thr = 0.4;
            if (!level && errY < 0.05 && errP < 0.06 && dh < 520) { if (U.shells.indexOf('ac') >= 0 && burst) Air.shoot(U, G, 'ac'); if (!T.air && dh < 420 && U.shells.indexOf('rk') >= 0 && errY < 0.035) Air.shoot(U, G, 'rk'); }
            if (!T.air && U.shells.indexOf('bm') >= 0 && errY < 0.25) { const fall = Math.sqrt(2 * Math.max(0, U.y - T.y) / 9.8) * U.v * Math.cos(U.pitch); if (Math.abs(dh - fall) < 14 + (1 - A.skill) * 30) Air.shoot(U, G, 'bm'); }
            if (dh < (T.air ? 70 : level ? 25 : 130) || (!T.air && !level && agl < 45)) { A.away = rand(3.5, 6); A.awayYaw = U.yaw + rand(-0.5, 0.5); }
        }
    }
    if (agl < (U.heli ? 0 : 38)) wp = Math.max(wp, 0.45);          // the ground is close: up, whatever else
    Air.fly(U, wy, wp, thr, dt, G, U.heli ? { side, up: clamp((Math.max(World.top(U.x, U.z), World.top(U.x + Math.sin(U.yaw) * 45, U.z + Math.cos(U.yaw) * 45)) + Air.HELI_ALT - U.y) / 8, -1, 1) } : null);
};
// after it is shot down: it falls, and what is left burns where it lands
Air.step = function (dt, G) {
    for (const U of Units.list) { if (!U.air || !U.dead || U.down) continue; U.vy -= 9.8 * dt; const cp = Math.cos(U.pitch); U.x += Math.sin(U.yaw) * cp * U.v * dt; U.z += Math.cos(U.yaw) * cp * U.v * dt; U.y += (Math.sin(U.pitch) * U.v + U.vy) * dt; U.pitch = Math.max(-1.2, U.pitch - dt * 0.5); U.roll += dt * 2.2; U.v *= 1 - dt * 0.25;
        const gy = World.top(U.x, U.z); if (U.y <= gy + 1.2) { U.y = gy + 1.2; U.down = true; U.roll = 0.3; World.boom(U.x, U.y, U.z, true); World.boom(U.x, U.y + 1, U.z, true); G.heard(U.x, U.z, 1, 70, 1.2); } }
};
