// ============================================================
// SIMULATION: entities, vehicle physics (surface, submarine, aircraft, helicopter), weapons, projectiles, particles,
// snapshot interpolation for remote vehicles and the host's position history for lag-compensated hits.
// The player and the bots share the same code: both just produce a control struct `c`:
//   {thr, steer, side, up, aimYaw, aimPitch, f1, f2, f3, tgt}
// ============================================================
const SPAWN_PROT = 3;             // seconds nobody can hurt a vehicle that just spawned
const EN = new Map();            // id -> entity
let ME = null;                   // my entity
let M = null;                    // the running match (60-match.js)
let simTime = 0, shakeAmt = 0;
const V3 = new THREE.Vector3(), V3b = new THREE.Vector3(), QT = new THREE.Quaternion(), MT = new THREE.Matrix4(), ZAX = new THREE.Vector3(0, 0, 1), SC = new THREE.Vector3(), CL = new THREE.Color();
const ffOn = () => !!(M && M.cfg && M.cfg.ff && M.mode !== 'ffa');
const foe = (a, b) => a.team !== b.team;

// ---------- particles: one instanced mesh, ring buffer ----------
const NP = 900;
const PA = { x: new Float32Array(NP), y: new Float32Array(NP), z: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP), vz: new Float32Array(NP), life: new Float32Array(NP), max: new Float32Array(NP), size: new Float32Array(NP), g: new Float32Array(NP), drag: new Float32Array(NP) };
let partMesh, pIdx = 0, partDirty = false, projMesh;
const NPR = 360;
function initFx() {
    partMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NP);
    partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); partMesh.frustumCulled = false; partMesh.setColorAt(0, CL.setHex(0xffffff));
    for (let i = 0; i < NP; i++) { partMesh.setColorAt(i, CL); partMesh.setMatrixAt(i, MT.makeScale(0, 0, 0)); }
    scene.add(partMesh);
    projMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NPR);
    projMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); projMesh.frustumCulled = false; projMesh.setColorAt(0, CL);
    scene.add(projMesh);
}
function part(x, y, z, vx, vy, vz, size, life, hex, g, drag) {
    const i = pIdx; pIdx = (pIdx + 1) % NP;
    PA.x[i] = x; PA.y[i] = y; PA.z[i] = z; PA.vx[i] = vx; PA.vy[i] = vy; PA.vz[i] = vz; PA.size[i] = size; PA.life[i] = PA.max[i] = life; PA.g[i] = g || 0; PA.drag[i] = drag === undefined ? 1 : drag;
    partMesh.setColorAt(i, CL.setHex(hex)); partDirty = true;
}
function updateParticles(dt) {
    const a = partMesh.instanceMatrix.array;
    for (let i = 0; i < NP; i++) {
        const o = i * 16;
        if (PA.life[i] > 0) {
            PA.life[i] -= dt; PA.x[i] += PA.vx[i] * dt; PA.y[i] += PA.vy[i] * dt; PA.z[i] += PA.vz[i] * dt; PA.vy[i] -= PA.g[i] * dt;
            const dr = Math.pow(PA.drag[i], dt * 3); PA.vx[i] *= dr; PA.vy[i] *= dr; PA.vz[i] *= dr;
            const s = PA.life[i] > 0 ? PA.size[i] * Math.min(1, PA.life[i] / PA.max[i] * 1.6) : 0;
            a[o] = s; a[o + 5] = s; a[o + 10] = s; a[o + 12] = PA.x[i]; a[o + 13] = PA.y[i]; a[o + 14] = PA.z[i]; a[o + 15] = 1;
        } else if (a[o] !== 0) { a[o] = 0; a[o + 5] = 0; a[o + 10] = 0; }
    }
    partMesh.instanceMatrix.needsUpdate = true; if (partDirty) { partMesh.instanceColor.needsUpdate = true; partDirty = false; }
}
const fxN = n => Math.max(1, Math.round(n * Q.parts));
function fxExplosion(x, y, z, size, noise) {
    const n = fxN(10 + size * 1.2);
    for (let i = 0; i < n; i++) { const a = rnd(0, TAU), e = rnd(-.2, 1), sp = rnd(.3, 1) * size * 2.2; part(x, y, z, Math.cos(a) * sp, e * sp * .8 + size * .6, Math.sin(a) * sp, rnd(.3, .7) * size, rnd(.35, .8), i % 3 ? 0xff9a2a : 0xffe27a, 0, .5); }
    for (let i = 0; i < fxN(6 + size * .6); i++) part(x + rnd(-1, 1) * size * .3, y, z + rnd(-1, 1) * size * .3, rnd(-1, 1) * size * .5, rnd(1, 2.5) * size * .5, rnd(-1, 1) * size * .5, rnd(.5, 1) * size * .7, rnd(1, 2), 0x444444, -2, .6);
    flash(x, y, z, 0xff9a40, 120 + size * size * 30, .18 + size * .03);
    if (!noise) { sfx(size > 6 ? 'boom' : 'small', x, y, z, size > 6 ? 1 : .8); const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.sqrt(dx * dx + dz * dz); shakeAmt = Math.max(shakeAmt, clamp(size * 1.6 / (1 + d * .03), 0, 6)); }
}
function fxSplash(x, z, size) {
    for (let i = 0; i < fxN(8 + size); i++) { const a = rnd(0, TAU), sp = rnd(.3, 1) * size * 1.3; part(x, .2, z, Math.cos(a) * sp, rnd(.8, 1.6) * size * 1.2, Math.sin(a) * sp, rnd(.3, .6) * Math.max(1, size * .3), rnd(.5, .9), i % 2 ? 0xffffff : 0xbfe6ff, 22, .7); }
    sfx('splash', x, 0, z, .7);
}
function fxDust(x, y, z, size) { for (let i = 0; i < fxN(5); i++) part(x, y, z, rnd(-1, 1) * size, rnd(.5, 1.5) * size, rnd(-1, 1) * size, rnd(.25, .6) * Math.max(1, size * .3), rnd(.4, .8), 0x8a7a5a, 8, .6); }
function fxSpark(x, y, z) { for (let i = 0; i < fxN(4); i++) part(x, y, z, rnd(-8, 8), rnd(0, 8), rnd(-8, 8), .35, rnd(.15, .3), 0xffe08a, 10, .8); }
function fxSmoke(x, y, z, s, hex) { part(x + rnd(-.4, .4), y, z + rnd(-.4, .4), rnd(-1, 1), rnd(1.5, 3), rnd(-1, 1), s || 1.1, rnd(.8, 1.4), hex || 0x555555, -1, .7); }

// ---------- projectiles ----------
const PR = [];
const PVIS = { bullet: [0.12, 0.12, 3.2, 0xffee88], shell: [0.45, 0.45, 1.8, 0xffc050], rocket: [0.5, 0.5, 2.6, 0xffffff], bomb: [1, 1, 2.4, 0x333333], missile: [0.45, 0.45, 2.8, 0xf0f0f0], torp: [0.6, 0.5, 4, 0x1e2a33] };
function addProj(o) { if (PR.length > 600) PR.shift(); PR.push(o); return o; }
function segSphere(ax, ay, az, bx, by, bz, cx, cy, cz, r) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
    let t = l2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
    const px = ax + dx * t - cx, py = ay + dy * t - cy, pz = az + dz * t - cz; return px * px + py * py + pz * pz <= r * r;
}
const HP3 = { x: 0, y: 0, z: 0 };
function canHit(p, e) {
    if (!e.alive || e.id === p.own) return false;
    if (e.team === p.team && !ffOn()) return false;
    if (p.k === 'torp') return e.def.ln === 'n';
    if (e.dive > .5) return p.k === 'bomb';      // a dived submarine is only touched by torpedoes and depth bombs
    return true;
}
function steerMissile(p, dt) {
    const t = p.tg >= 0 ? EN.get(p.tg) : null;
    if (t && t.alive) {
        if (t.flareT > 0 && p.fid !== t.flareId) { p.fid = t.flareId; if (Math.random() < .7) { p.tg = -1; return; } }
        const sp = Math.hypot(p.vx, p.vy, p.vz) || 1, D = Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z), tt = D / sp;
        let tx = t.x + t.vx * tt - p.x, ty = t.y + (t.def.ln === 'a' ? 0 : 1.2) + t.vy * tt - p.y, tz = t.z + t.vz * tt - p.z; const L = Math.hypot(tx, ty, tz) || 1;
        const k = Math.min(1, p.turn * dt);
        let nx = p.vx / sp + (tx / L - p.vx / sp) * k, ny = p.vy / sp + (ty / L - p.vy / sp) * k, nz = p.vz / sp + (tz / L - p.vz / sp) * k; const nl = Math.hypot(nx, ny, nz) || 1;
        if (p.sea && p.y > 3) ny = Math.min(ny, -.02);
        p.vx = nx / nl * sp; p.vy = ny / nl * sp; p.vz = nz / nl * sp;
    }
}
function updateProjectiles(dt) {
    let vi = 0; const tnow = simTime * 1000;
    for (let i = PR.length - 1; i >= 0; i--) {
        const p = PR[i], ox = p.x, oy = p.y, oz = p.z;
        if (p.k === 'missile') steerMissile(p, dt);
        p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
        if (p.k === 'torp') { p.y = -.45; p.tt = (p.tt || 0) - dt; if (p.tt <= 0) { p.tt = .07; part(p.x, .1, p.z, rnd(-.5, .5), rnd(.3, .8), rnd(-.5, .5), .5, .7, 0xe8f4ff, 1, .8); } }
        else if (p.k === 'rocket' || p.k === 'bomb' || p.k === 'missile') { p.tt = (p.tt || 0) - dt; if (p.tt <= 0) { p.tt = .03; fxSmoke(p.x, p.y, p.z, p.k === 'bomb' ? .6 : .9, p.k === 'bomb' ? 0x555555 : 0xbbbbbb); } }
        let hit = null;
        for (const e of EN.values()) {
            if (!canHit(p, e)) continue;
            let ex = e.x, ey = e.y, ez = e.z;
            if (p.lag && e.hn) { posAt(e, tnow - p.lag, HP3); ex = HP3.x; ey = HP3.y; ez = HP3.z; }
            const air = e.def.ln === 'a';
            let r = e.def.r + (p.k === 'bullet' ? 0.6 : 0.3) + (p.big ? (p.k === 'bullet' ? 1.2 : 1.6) : 0);
            if (p.prox && air) r += p.prox;
            if (p.k === 'torp') r += 1.5;
            if (segSphere(ox, oy, oz, p.x, p.y, p.z, ex, ey + (air ? 0 : e.def.ln === 'n' ? 1 : 1.5), ez, r)) { hit = e; break; }
        }
        const gh = p.k === 'torp' ? (H(p.x, p.z) > -1 ? 99 : -9) : GHS(p.x, p.z);
        if (hit || p.y < gh || p.life <= 0) {
            const hx = p.x, hy = hit ? p.y : Math.max(p.y, Math.min(gh, 60)), hz = p.z;
            if (hit) { if (p.rep) reportHit(p, hit, p.dmg); else if (p.claim) reportHit(p, hit, p.dmg); else if (p.mine) predictHit(); }
            if (p.k === 'bullet') { if (hit) fxSpark(hx, hy, hz); else if (p.life > 0) { if (H(hx, hz) < 0) { fxSplash(hx, hz, 0.8); } else fxDust(hx, hy, hz, 1.2); } }
            else detonate(p, hx, hy, hz, hit);
            PR.splice(i, 1); continue;
        }
    }
    // draw
    for (let i = 0; i < PR.length && vi < NPR; i++) {
        const p = PR[i], vis = PVIS[p.k]; V3.set(p.vx, p.vy, p.vz); const sp = V3.length() || 1; V3.multiplyScalar(1 / sp);
        QT.setFromUnitVectors(ZAX, V3); SC.set(vis[0], vis[1], vis[2]); MT.compose(V3b.set(p.x, p.y, p.z), QT, SC); projMesh.setMatrixAt(vi, MT); projMesh.setColorAt(vi, CL.setHex(vis[3])); vi++;
    }
    projMesh.count = vi; projMesh.instanceMatrix.needsUpdate = true; if (projMesh.instanceColor) projMesh.instanceColor.needsUpdate = true;
}
function detonate(p, x, y, z, direct) {
    const water = H(x, z) < 0 && y <= 0.5;
    const sp = p.sp || 3;
    if (p.k === 'torp') { fxSplash(x, z, 9); fxExplosion(x, 1, z, 6, true); sfx('boom', x, 0, z, 1); }
    else if (water) fxSplash(x, z, Math.min(10, sp * .8)); else fxExplosion(x, y, z, Math.min(14, sp * 1.1 + (p.k === 'shell' ? 1 : 0)));
    if (!p.rep) return;
    for (const e of EN.values()) {
        if (e === direct || !canHit(p, e)) continue;
        const dx = e.x - x, dy = (e.y + 1) - y, dz = e.z - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) - e.def.r * .5;
        if (d < sp) reportHit(p, e, p.dmg * (1 - clamp(d, 0, sp) / sp) * (direct ? .5 : .8));
    }
}

// ---------- entities ----------
function newEnt(id, def, team, name, num) {
    const e = { id, def, team, name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0, vx: 0, vy: 0, vz: 0, tur: 0, gun: 0, hp: def.hp, alive: true, t1: 0, t2: 0, t3: 0, thr: 0,
        a2: def.w2 && def.w2.cnt || 0, a3: def.w3 ? def.w3.cnt : 0, rel2: 0, rel3: 0, kills: 0, deaths: 0, score: 0, dmg: 0, caps: 0, flags: 0, remote: false, ai: null, fl: 0, flT: 0, respT: 0, mdl: null, budget: 0, muz: 0,
        num: num || (10 + (id * 37 + 11) % 89), dive: 0, diveOn: false, flareT: 0, flareId: 0, nFl: 6, flRel: 0, trk: 0, sb: [], ctl: { thr: 0, steer: 0, side: 0, up: 0, aimYaw: 0, aimPitch: 0, f1: false, f2: false, f3: false, tgt: -1 } };
    attachModel(e); EN.set(id, e); return e;
}
function attachModel(e) {
    if (e.mdl) { scene.remove(e.mdl.root); disposeModel(e.mdl); }
    e.mdl = makeModel(e.def, e.team, e.num); e.mdl.root.visible = e.alive; scene.add(e.mdl.root);
}
function setDef(e, def) {
    e.def = def; e.hp = def.hp; e.a2 = def.w2 && def.w2.cnt || 0; e.a3 = def.w3 ? def.w3.cnt : 0; e.t1 = e.t2 = e.t3 = 0; e.speed = 0; e.thr = 0; e.gun = 0; e.dive = 0; e.diveOn = false; attachModel(e);
}
function removeEnt(e) { if (e.mdl) { scene.remove(e.mdl.root); disposeModel(e.mdl); } EN.delete(e.id); }
// spawn positions: tanks on the west / east shores, ships in the northern and southern seas, aircraft over the ends; FFA anywhere
function battleR() { return M && M.R || EXT; }
function pickSpawn(team, ln, ffa) {
    const R = battleR(), sgn = team === 0 ? -1 : 1, k = R / EXT;
    for (let i = 0; i < 60; i++) {
        if (ffa) {
            if (ln === 'g') { const x = rnd(-R + 60, R - 60) * .8, z = rnd(-150, 150); if (H(x, z) > 3 && H(x, z) < 22 && GH(x, z) === H(x, z) && farFromAll(x, z, 70)) return { x, z, y: H(x, z), yaw: rnd(-PI, PI) }; }
            else if (ln === 'n') { const x = rnd(-R + 80, R - 80), z = (Math.random() < .5 ? -1 : 1) * rnd(480, Math.min(R - 40, 620)); if (H(x, z) < -6 && farFromAll(x, z, 90)) return { x, z, y: 0, yaw: rnd(-PI, PI) }; }
            else { const a = rnd(0, TAU), r = rnd(.5, .85) * R; return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: rnd(90, 150), yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) }; }
            continue;
        }
        if (ln === 'g') {
            const x = sgn * Math.min(340 + rnd(0, 70), R - 60), z = rnd(-110, 110);
            if (H(x, z) > 3 && H(x, z) < 22 && GH(x, z) === H(x, z)) return { x, z, y: H(x, z), yaw: team === 0 ? PI / 2 : -PI / 2 };
        } else if (ln === 'n') {
            const x = sgn * (240 + rnd(0, 200)) * Math.max(.6, k), z = (Math.random() < .5 ? -1 : 1) * Math.min(500 + rnd(0, 90), R - 30);
            if (H(x, z) < -6) return { x, z, y: 0, yaw: team === 0 ? PI / 2 : -PI / 2 };
        } else return { x: sgn * (R - 100 + rnd(0, 40)), z: rnd(-200, 200), y: rnd(90, 140), yaw: team === 0 ? PI / 2 : -PI / 2 };
    }
    return ln === 'g' ? { x: sgn * 450, z: 0, y: H(sgn * 450, 0), yaw: 0 } : ln === 'n' ? { x: sgn * 300, z: 560, y: 0, yaw: 0 } : { x: sgn * 600, z: 0, y: 110, yaw: 0 };
}
function farFromAll(x, z, d) { for (const e of EN.values()) if (e.alive && Math.hypot(e.x - x, e.z - z) < d) return false; return true; }
function spawnEnt(e, sp) {
    const heli = e.def.heli;
    sp = sp || pickSpawn(e.team, e.def.ln, M && M.mode === 'ffa');
    e.x = sp.x; e.y = heli ? Math.min(sp.y, Math.max(GH(sp.x, sp.z), 0) + 40) : sp.y; e.z = sp.z; e.yaw = sp.yaw; e.tur = sp.yaw; e.pitch = 0; e.roll = 0; e.gun = 0; e.hp = e.def.hp; e.alive = true;
    e.speed = e.def.ln === 'a' && !heli ? e.def.minSp * 1.6 : 0; e.thr = e.def.ln === 'a' && !heli ? .6 : 0;
    e.a2 = e.def.w2 && e.def.w2.cnt || 0; e.a3 = e.def.w3 ? e.def.w3.cnt : 0; e.t1 = e.t2 = e.t3 = 1; e.vx = e.vy = e.vz = 0; e.budget = e.def.maxDps * 3; e.prot = SPAWN_PROT; e.dive = 0; e.diveOn = false; e.nFl = 6; e.flareT = 0;
    if (e.ai) aiReset(e);
    e.sb.length = 0; e.hn = 0; e.crashed = false;
    if (e.mdl) e.mdl.root.visible = true; e.dieT = 0;
    applyAnim(e, 0);
}
function applyAnim(e, dt) {
    const m = e.mdl, r = m.root, d = e.def;
    r.position.set(e.x, e.y - (d.sub ? e.dive * 4.2 : 0), e.z); r.rotation.set(-e.pitch, e.yaw, e.roll);
    if (d.ln === 'g') {
        m.tur.rotation.y = e.tur - e.yaw; m.gun.rotation.x = -e.gun;
        e.trk += e.speed * dt; if (m.trMat) m.trMat.map.offset.x = (P_WHEELED(e) ? -e.trk * .26 : -e.trk * .55);
    } else if (d.ln === 'n') { for (const t of m.turs) t.rotation.y = e.tur - e.yaw; }
    else for (const p of m.props) { const ax = p.userData.ax, s = dt * (d.heli ? 26 : 30 + e.speed * .3); if (ax === 'y') p.rotation.y += s; else if (ax === '-y') p.rotation.y -= s; else if (ax === 'x') p.rotation.x += s * 1.6; else p.rotation.z += s; }
}
const P_WHEELED = e => { const P = PARTS[(e.def.base || e.def).id + '|' + (e.team | 0)]; return P && P.wheeled; };
function muzzleWorld(e, i) {
    e.mdl.root.updateMatrixWorld(true); const m = e.mdl.muzzles[i % e.mdl.muzzles.length]; m.getWorldPosition(V3); return V3;
}
function killVisual(e) {
    if (!e.alive && e.dieT) return;
    e.alive = false; e.dieT = simTime; if (e.mdl) e.mdl.root.visible = false;
    const big = e.def.ln === 'n' ? 14 : e.def.ln === 'g' ? 8 : 6;
    fxExplosion(e.x, e.y + 1.5, e.z, big);
    if (e.def.ln === 'n' && H(e.x, e.z) < 0) fxSplash(e.x, e.z, 8);
    for (let i = 0; i < fxN(8); i++) part(e.x, e.y + 2, e.z, rnd(-1, 1) * 14, rnd(6, 18), rnd(-1, 1) * 14, rnd(.4, 1), rnd(.8, 1.6), 0x2a2a2a, 14, .8);
}

// ---------- physics ----------
function stepSurface(e, c, dt) {
    const d = e.def, sea = d.ln === 'n', R = battleR();
    if (d.sub) { e.dive = clamp(e.dive + (e.diveOn ? dt : -dt) * .35, 0, 1); }
    const target = c.thr * d.sp * (c.thr < 0 ? .45 : 1) * (d.sub && e.dive > .5 ? .75 : 1);
    const acc = sea ? .45 : (Math.abs(target) < Math.abs(e.speed) ? 3 : 1.5);
    e.speed += (target - e.speed) * Math.min(1, acc * dt);
    const sf = clamp(Math.abs(e.speed) / (d.sp * .35), sea ? .15 : .5, 1);
    e.yaw -= c.steer * d.tn * sf * dt * (e.speed < -.5 ? -1 : 1);
    const sy = Math.sin(e.yaw), cyw = Math.cos(e.yaw), step = e.speed * dt;
    let nx = e.x + sy * step, nz = e.z + cyw * step;
    nx = clamp(nx, -R + 15, R - 15); nz = clamp(nz, -EXT + 15, EXT - 15);
    const h = H(nx, nz);
    let ok;
    if (sea) ok = h < -3.5 && H(nx + sy * 10, nz + cyw * 10) < -2;
    else { ok = h > .9 && (h - e.y) < Math.abs(step) * .9 + .15; }
    if (ok) { e.x = nx; e.z = nz; } else { e.speed *= -.2; }
    if (!sea) { pushOutOfBuildings(e, d.r * .8); }
    if (sea) {
        e.y = Math.sin(simTime * 1.1 + e.id) * .18 * (1 - e.dive) + .1;
        e.pitch += (Math.sin(simTime * .9 + e.id * 2) * .02 * (1 - e.dive) + clamp(-e.speed * .002, -.03, 0) - e.pitch) * Math.min(1, dt * 2);
        e.roll += (clamp(c.steer * e.speed * .012, -.12, .12) + Math.sin(simTime * 1.3 + e.id) * .015 - e.roll) * Math.min(1, dt * 2);
        if (Math.abs(e.speed) > 3 && e.dive < .3 && Math.random() < dt * 8) part(e.x + sy * d.r * 1.4, .2, e.z + cyw * d.r * 1.4, rnd(-1, 1) * 2, rnd(.5, 1.5), rnd(-1, 1) * 2, .6, .6, 0xffffff, 3, .7);
    } else {
        const gy = GH(e.x, e.z); e.y += (gy - e.y) * Math.min(1, dt * 14);
        const L = d.m.hull[2] * .5, Wd = d.m.hull[0] * .5, s2 = Math.sin(e.yaw), c2 = Math.cos(e.yaw);
        const hf = H(e.x + s2 * L, e.z + c2 * L), hb = H(e.x - s2 * L, e.z - c2 * L), hl = H(e.x + c2 * Wd, e.z - s2 * Wd), hr = H(e.x - c2 * Wd, e.z + s2 * Wd);
        e.pitch += (Math.atan2(hf - hb, L * 2) - e.pitch) * Math.min(1, dt * 6); e.roll += (Math.atan2(hl - hr, Wd * 2) - e.roll) * Math.min(1, dt * 6);
        if (Math.abs(e.speed) > 4 && Math.random() < dt * 6 * Q.parts) part(e.x - s2 * L, e.y + .3, e.z - c2 * L, rnd(-1, 1), rnd(.5, 1.5), rnd(-1, 1), .7, .7, 0x9a8a6a, 1, .7);
    }
    // turret + gun follow the aim (stabiliser: a little extra speed)
    e.tur += clamp(angDiff(e.tur, c.aimYaw), -d.tt * dt, d.tt * dt);
    e.gun += clamp(clamp(c.aimPitch, -.14, d.el || .5) - e.gun, -1.1 * dt, 1.1 * dt);
}
function stepAir(e, c, dt) {
    const d = e.def, R = battleR(); e.thr = c.thr;
    let ay = c.aimYaw, ap = c.aimPitch;
    if (Math.abs(e.x) > R + 30 || Math.abs(e.z) > R + 30) { ay = Math.atan2(-e.x, -e.z); ap = .1; e.warn = true; } else e.warn = false;
    if (e.y > 330) ap = Math.min(ap, -.2);
    const tgt = lerp(d.minSp, d.sp, e.thr) - Math.sin(e.pitch) * d.sp * .3;
    e.speed += (tgt - e.speed) * Math.min(1, dt * .9); e.speed = clamp(e.speed, d.minSp * .85, d.sp * 1.12);
    const tk = e.turnK || 1, my = d.turn * tk, mp = d.turn * .75 * tk, yr = clamp(angDiff(e.yaw, ay) * 2.6, -my, my), pr = clamp((ap - e.pitch) * 2.6, -mp, mp);
    e.yaw += yr * dt; e.pitch = clamp(e.pitch + pr * dt, -1.3, 1.3);
    e.roll += (clamp(-yr / my, -1, 1) * .95 - e.roll) * Math.min(1, dt * 4);
    const cp = Math.cos(e.pitch);
    e.x += Math.sin(e.yaw) * cp * e.speed * dt; e.y += Math.sin(e.pitch) * e.speed * dt; e.z += Math.cos(e.yaw) * cp * e.speed * dt;
    e.tur = e.yaw; e.gun = e.pitch;
    if (e.y < Math.max(GH(e.x, e.z), 0) + 1.2) { if (!e.noCrash) { e.crashed = true; } else e.y = Math.max(GH(e.x, e.z), 0) + 1.5; }
}
// helicopters hover: thr = forward / back, side = strafe, up = climb, the nose turns to aimYaw; the chin gun aims on its own
function stepHeli(e, c, dt) {
    const d = e.def, R = battleR(), fwdT = c.thr * d.sp * (c.thr < 0 ? .5 : 1), sideT = (c.side || 0) * d.sp * .45;
    let ay = c.bodyYaw !== undefined ? c.bodyYaw : c.aimYaw;
    if (Math.abs(e.x) > R + 20 || Math.abs(e.z) > R + 20) { ay = Math.atan2(-e.x, -e.z); e.warn = true; } else e.warn = false;
    e.speed += (fwdT - e.speed) * Math.min(1, dt * 1.1); e.side = (e.side || 0) + (sideT - (e.side || 0)) * Math.min(1, dt * 1.4);
    const yr = clamp(angDiff(e.yaw, ay) * 2.2, -d.turn, d.turn); e.yaw += yr * dt;
    const vyT = clamp(c.up || 0, -1, 1) * 14; e.vyH = (e.vyH || 0) + (vyT - (e.vyH || 0)) * Math.min(1, dt * 2);
    const sy = Math.sin(e.yaw), cyw = Math.cos(e.yaw);
    e.x += (sy * e.speed + cyw * e.side) * dt; e.z += (cyw * e.speed - sy * e.side) * dt; e.y += e.vyH * dt;
    const floor = Math.max(GH(e.x, e.z), 0) + 1.6;
    if (e.y < floor) { if (e.vyH < -12 || Math.abs(e.speed) > d.sp * .8 && GH(e.x, e.z) > e.y - .5) e.crashed = !e.noCrash; e.y = floor; e.vyH = Math.max(0, e.vyH); }
    if (e.y > 260) e.y = 260;
    e.pitch += (clamp(-e.speed / d.sp * .28, -.3, .3) - e.pitch) * Math.min(1, dt * 3);
    e.roll += (clamp(-e.side / d.sp * .5 - yr * .15, -.4, .4) - e.roll) * Math.min(1, dt * 3);
    // chin gun: free aim within a cone under the nose
    e.tur += clamp(angDiff(e.tur, c.aimYaw), -2.5 * dt, 2.5 * dt); if (Math.abs(angDiff(e.yaw, e.tur)) > 1.6) e.tur = e.yaw + Math.sign(angDiff(e.yaw, e.tur)) * 1.6;
    e.gun += clamp(clamp(c.aimPitch, -1.1, .3) - e.gun, -2 * dt, 2 * dt);
}
function stepVehicle(e, c, dt) {
    const px = e.x, py = e.y, pz = e.z, d = e.def;
    if (d.heli) stepHeli(e, c, dt); else if (d.ln === 'a') stepAir(e, c, dt); else stepSurface(e, c, dt);
    if (dt > 0) { e.vx = (e.x - px) / dt; e.vy = (e.y - py) / dt; e.vz = (e.z - pz) / dt; }
    // timers + ammo restock
    e.t1 -= dt; e.t2 -= dt; e.t3 -= dt; e.flareT -= dt;
    const w2 = d.w2, w3 = d.w3;
    if (w2 && w2.cnt && e.a2 < w2.cnt) { e.rel2 -= dt; if (e.rel2 <= 0) { e.a2++; e.rel2 = w2.rel / w2.cnt; } }
    if (w3 && w3.cnt && e.a3 < w3.cnt) { e.rel3 -= dt; if (e.rel3 <= 0) { e.a3++; e.rel3 = w3.rel / w3.cnt; } }
    if (d.flares && e.nFl < 6) { e.flRel -= dt; if (e.flRel <= 0) { e.nFl++; e.flRel = 8; } }
    e.flT -= dt; if (e.flT <= 0) e.fl = 0;
    const subUnder = d.sub && e.dive > .4;
    if (c.f1 && !subUnder) weaponFire(e, 'w1', c);
    if (c.f2 && !subUnder) weaponFire(e, 'w2', c);
    if (c.f3) weaponFire(e, 'w3', c);
    applyAnim(e, dt);
}
function dropFlares(e) {
    if (!e.def.flares || e.nFl <= 0 || e.flareT > 0) return false;
    e.nFl--; e.flRel = 8; e.flareT = 2.5; e.flareId++;
    for (let i = 0; i < 6; i++) part(e.x, e.y - 1, e.z, rnd(-14, 14), rnd(-6, 4), rnd(-14, 14), .9, 2.2, 0xffe6a0, 4, .9);
    flash(e.x, e.y, e.z, 0xffd080, 500, 1.2); sfx('flare', e.x, e.y, e.z, .7);
    if (e === ME && netOn()) PARTY.net.send('all', { t: 'flr', id: e.id });
    return true;
}
// push overlapping ground/sea vehicles apart (no allocations: reuses one array)
const SEP = [];
function separate() {
    SEP.length = 0; for (const e of EN.values()) if (e.alive && e.def.ln !== 'a') SEP.push(e);
    for (let i = 0; i < SEP.length; i++) for (let j = i + 1; j < SEP.length; j++) {
        const a = SEP[i], b = SEP[j]; if (a.def.ln !== b.def.ln) continue;
        const dx = b.x - a.x, dz = b.z - a.z, rr = (a.def.r + b.def.r) * .7, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > .0001) { const d = Math.sqrt(d2), k = (rr - d) * .5 / d; if (!a.remote) { a.x -= dx * k; a.z -= dz * k; } if (!b.remote) { b.x += dx * k; b.z += dz * k; } }
    }
}

// ---------- weapons ----------
const BAL = { yaw: 0, pitch: 0, ok: true };
function ballistic(ox, oy, oz, px, py, pz, v, g, high) {      // yaw + launch pitch to hit p from o (high = the lobbed arc)
    const dx = px - ox, dz = pz - oz, dy = py - oy, d = Math.sqrt(dx * dx + dz * dz), yaw = Math.atan2(dx, dz);
    BAL.yaw = yaw; BAL.ok = true;
    if (d < 1 || g <= 0) { BAL.pitch = Math.atan2(dy, Math.max(1, d)); return BAL; }
    const v2 = v * v, disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
    if (disc < 0) { BAL.pitch = .75; BAL.ok = false; return BAL; }
    BAL.pitch = Math.atan2(v2 + (high ? 1 : -1) * Math.sqrt(disc), g * d);
    return BAL;
}
function weaponFire(e, slot, c) {
    const d = e.def, w = d[slot]; if (!w) return false;
    const T = slot === 'w1' ? 't1' : slot === 'w2' ? 't2' : 't3';
    if (e[T] > 0) return false;
    if (slot !== 'w1' && w.cnt) { const A = slot === 'w2' ? 'a2' : 'a3', R = slot === 'w2' ? 'rel2' : 'rel3'; if (e[A] <= 0) return false; e[A]--; if (e[R] <= 0) e[R] = w.rel / w.cnt; }
    e[T] = w.rl;
    const out = [], rep = !e.remote && (!M || M.host), n = w.nn || 1, heli = d.heli, tg = c && c.tgt >= 0 ? c.tgt : -1;
    const dirAt = (spr) => {
        const yaw = e.tur + rnd(-1, 1) * spr, pit = e.gun + rnd(-1, 1) * spr, cp = Math.cos(pit);
        return [Math.sin(yaw) * cp, Math.sin(pit), Math.cos(yaw) * cp];
    };
    for (let j = 0; j < n; j++) {
        e.muz++;
        let mi = d.ln === 'n' && w.k === 'shell' ? j : e.muz;
        if (heli) mi = slot === 'w1' ? 0 : 1 + (e.muz & 1);
        const m = muzzleWorld(e, mi); let x = m.x, y = m.y, z = m.z, dir, vx0 = 0, vy0 = 0, vz0 = 0;
        if (d.ln === 'a' && !(heli && slot === 'w1')) {
            const cp = Math.cos(e.pitch), fx = Math.sin(e.yaw) * cp, fy = Math.sin(e.pitch), fz = Math.cos(e.yaw) * cp, spr = w.sprd || 0;
            // wing guns / rocket rails converge on the nose line (at the locked target's range if the player has one)
            const Dc = e === ME && Cam.lead ? clamp(Cam.lead.D, 120, 700) : 350, cx = e.x + fx * Dc - x, cy2 = e.y + fy * Dc - y, cz = e.z + fz * Dc - z, cl = Math.hypot(cx, cy2, cz) || 1;
            dir = [cx / cl + rnd(-1, 1) * spr, cy2 / cl + rnd(-1, 1) * spr, cz / cl + rnd(-1, 1) * spr];
            if (e === ME && Cam.lead && w.k !== 'bomb') {       // soft lock: a target within ~7 degrees of the nose gets the shots sent at its lead point
                const lx = Cam.lead.x - x, ly = Cam.lead.y - y, lz = Cam.lead.z - z, ll = Math.hypot(lx, ly, lz) || 1;
                if ((lx * fx + ly * fy + lz * fz) / ll > .993) dir = [lx / ll + rnd(-1, 1) * spr * .5, ly / ll + rnd(-1, 1) * spr * .5, lz / ll + rnd(-1, 1) * spr * .5];
            }
            if (!heli) { vx0 = fx * e.speed; vy0 = fy * e.speed; vz0 = fz * e.speed; } else { vx0 = e.vx; vy0 = e.vy; vz0 = e.vz; }
            if (w.k === 'bomb') { y -= 1.2; dir = [0, 0, 0]; }
            if (w.k === 'rocket' || w.k === 'missile') y -= .5;
        } else if (w.k === 'torp') { const a = e.tur + rnd(-1, 1) * .01; dir = [Math.sin(a), 0, Math.cos(a)]; y = -.45; }
        else if (w.k === 'missile') { dir = dirAt(0); if (d.ln === 'n' && w.sea) dir = [dir[0] * .9, .35, dir[2] * .9]; else if (w.air) dir[1] = Math.max(dir[1], .25); }
        else dir = dirAt(w.k === 'shell' ? (w.spread || 0.004) : (w.sprd || 0.02));
        const v = w.v || 0, vx = dir[0] * v + vx0, vy = dir[1] * v + vy0, vz = dir[2] * v + vz0;
        const p = addProj({ x, y, z, vx, vy, vz, g: w.g, life: w.life, own: e.id, team: e.team, dmg: w.dmg, sp: w.sp || 0, pk: w.pierce || 0, k: w.k, slot, rep, prox: w.prox || 0, big: !e.ai, tg, turn: w.turn || 0, sea: !!w.sea });
        if (!rep) { p.dmg = 0; p.mine = e === ME; p.claim = e === ME && w.k === 'bullet'; if (p.claim) p.dmg = w.dmg; }
        e.nShots = (e.nShots || 0) + 1;
        out.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1), +vx.toFixed(1), +vy.toFixed(1), +vz.toFixed(1)]);
    }
    // sound + flash
    const mm = muzzleWorld(e, heli ? (slot === 'w1' ? 0 : 1) : e.muz);
    if (w.k === 'bullet') { sfx(d.ln === 'a' ? 'gun' : 'mg', mm.x, mm.y, mm.z, .7); e.fl |= slot === 'w1' ? 1 : 2; e.flT = .18; if (Math.random() < .25) flash(mm.x, mm.y - 1, mm.z, 0xffc070, 60, .06); }
    else if (w.k === 'shell') { sfx(w.snd || 'cannon', mm.x, mm.y, mm.z); fxExplosion(mm.x, mm.y, mm.z, d.ln === 'n' ? 2.2 : 1.4, true); for (let i = 0; i < 4; i++) part(mm.x, mm.y, mm.z, rnd(-1, 1) * 3, rnd(0, 2), rnd(-1, 1) * 3, 1, .8, 0x777777, -1, .7); if (e === ME) shakeAmt = Math.max(shakeAmt, d.ln === 'n' ? 2.4 : w.arty ? 2 : 1.4); }
    else if (w.k === 'rocket') sfx('rocket', mm.x, mm.y, mm.z, .8); else if (w.k === 'missile') sfx('missile', mm.x, mm.y, mm.z, .8); else if (w.k === 'torp') sfx('torp', mm.x, 0, mm.z, .8); else sfx('bomb', mm.x, mm.y, mm.z, .6);
    if (w.k !== 'bullet' && !e.remote) netFire(e, slot, out, tg);
    return true;
}
// a shot somebody else fired (reliable event): the same projectile, moved forward by the time the message took.
// On the host it is authoritative and checks hits against where targets were when the shooter saw them (lag = ms).
function remoteShot(e, slot, ps, tg, ff, lag) {
    const w = e.def[slot]; if (!w) return;
    const auth = !!(M && M.host);
    for (const s of ps) {
        let [x, y, z, vx, vy, vz] = s; const t = clamp(ff || 0, 0, .3);
        if (t > 0 && w.k !== 'missile') { x += vx * t; z += vz * t; if (w.k !== 'torp') { y += vy * t - .5 * w.g * t * t; vy -= w.g * t; } }
        addProj({ x, y, z, vx, vy, vz, g: w.g, life: w.life - t, own: e.id, team: e.team, dmg: auth ? w.dmg : 0, sp: w.sp || 0, pk: w.pierce || 0, k: w.k, slot, rep: auth, lag: auth ? lag || 0 : 0, prox: w.prox || 0, big: !e.isBot, tg: tg === undefined ? -1 : tg, turn: w.turn || 0, sea: !!w.sea });
    }
    const s = ps[0]; if (!s) return;
    if (w.k === 'shell') { sfx(w.snd || 'cannon', s[0], s[1], s[2]); fxExplosion(s[0], s[1], s[2], e.def.ln === 'n' ? 2.2 : 1.4, true); e.t1 = Math.max(e.t1, .2); }
    else if (w.k === 'rocket') sfx('rocket', s[0], s[1], s[2], .8); else if (w.k === 'missile') sfx('missile', s[0], s[1], s[2], .8); else if (w.k === 'torp') sfx('torp', s[0], 0, s[2], .8); else sfx('bomb', s[0], s[1], s[2], .6);
}
// tracer fire of remote vehicles (their bullet weapons are shown from the "firing" flag in their state)
function remoteBullets(e, dt) {
    if (!e.fl || !e.alive) return;
    for (const slot of ['w1', 'w2']) {
        const bit = slot === 'w1' ? 1 : 2, w = e.def[slot]; if (!(e.fl & bit) || !w || w.k !== 'bullet') continue;
        e.rtA = (e.rtA || 0) - dt;
        if (e.rtA <= 0) {
            const air = e.def.ln === 'a' && !(e.def.heli && slot === 'w1');
            e.rtA = Math.max(.07, w.rl); e.muz++; const m = muzzleWorld(e, e.def.heli ? 0 : e.muz), pit = air ? e.pitch : e.gun, yy = air ? e.yaw : e.tur, cp = Math.cos(pit);
            const dx = Math.sin(yy) * cp, dy = Math.sin(pit), dz = Math.cos(yy) * cp, v = w.v;
            addProj({ x: m.x, y: m.y, z: m.z, vx: dx * v + e.vx, vy: dy * v + e.vy, vz: dz * v + e.vz, g: w.g, life: w.life, own: e.id, team: e.team, dmg: 0, sp: 0, pk: 0, k: 'bullet', slot, rep: false });
            sfx(e.def.ln === 'a' ? 'gun' : 'mg', m.x, m.y, m.z, .6);
        }
    }
}
// ---------- snapshot interpolation: per-sender clock offset + adaptive, jitter-aware delay (55-260 ms) ----------
const CLK = {};
function clockSample(sid, ts) {
    const now = performance.now(), o = now - ts; let c = CLK[sid];
    if (!c) c = CLK[sid] = { off: o, jit: 15, jv: 8, iv: 70, lastTs: ts, delay: 110, last: now, n: 0, gaps: 0 };
    if (o < c.off) c.off = o; else c.off += (o - c.off) * .002;
    const j = o - c.off; c.jv += (Math.abs(j - c.jit) - c.jv) * .08; c.jit += (j - c.jit) * .08;
    const dts = ts - c.lastTs; if (dts > 0 && dts < 1000) c.iv += (dts - c.iv) * .1; if (dts > c.iv * 2.5) c.gaps++;
    c.lastTs = Math.max(c.lastTs, ts); c.last = now; c.n++;
    const target = clamp(c.iv * 1.2 + c.jit + c.jv * 2.5 + 10, 55, 260);
    c.delay += (target - c.delay) * (target > c.delay ? .25 : .03);      // grow fast when the link gets worse, shrink slowly
    return c;
}
function pushSnap(e, sid, ts, s) {
    clockSample(sid, ts); e.sid = sid; e.lastSnap = performance.now(); e.stale = false;
    const b = e.sb, last = b[b.length - 1];
    if (last && ts <= last.t) return;
    if (last && ts - last.t > 1000) b.length = 0;      // back from a long pause: start afresh, no sliding across the gap
    s.t = ts; b.push(s); if (b.length > 32) b.shift();
}
function stepRemote(e, dt) {
    const b = e.sb, c = CLK[e.sid];
    if (b.length && c) {
        const rt = performance.now() - c.off - c.delay; let a = b[0], z = b[b.length - 1];
        if (rt <= a.t) setFromSnap(e, a, a, 0);
        else if (rt >= z.t) {
            const p = b.length > 1 ? b[b.length - 2] : z, span = z.t - p.t, ex = Math.min(rt - z.t, 250);
            if (span > 0 && span < 600 && ex > 0) setFromSnap(e, p, z, 1 + ex / span); else setFromSnap(e, z, z, 0);
            if (rt - z.t > 3000) e.stale = true;
        } else {
            let i = b.length - 2; while (i > 0 && b[i].t > rt) i--;
            const p = b[i], q = b[i + 1]; setFromSnap(e, p, q, (rt - p.t) / Math.max(1, q.t - p.t));
            while (b.length > 3 && b[1].t < rt - 600) b.shift();
        }
        if (b.length > 1) { const p = b[b.length - 2], q = b[b.length - 1], s = Math.max(.03, (q.t - p.t) / 1000); e.vx = (q.x - p.x) / s; e.vy = (q.y - p.y) / s; e.vz = (q.z - p.z) / s; e.speed = e.def.ln === 'a' ? Math.hypot(e.vx, e.vy, e.vz) : Math.hypot(e.vx, e.vz) * (q.sp < 0 ? -1 : 1); }
    }
    e.t1 -= dt; e.t2 -= dt; e.flareT -= dt;
    remoteBullets(e, dt);
    applyAnim(e, dt);
}
function setFromSnap(e, p, q, k) {
    e.x = p.x + (q.x - p.x) * k; e.y = p.y + (q.y - p.y) * k; e.z = p.z + (q.z - p.z) * k;
    e.yaw = p.a + angDiff(p.a, q.a) * k; e.pitch = p.p + (q.p - p.p) * Math.min(k, 1); e.roll = p.r + (q.r - p.r) * Math.min(k, 1);
    e.tur = p.u + angDiff(p.u, q.u) * Math.min(k, 1); e.gun = p.g + (q.g - p.g) * Math.min(k, 1); e.fl = q.fl; e.dive = q.dv || 0;
}
// ---------- the host's position history (lag compensation) ----------
const HN = 48;
function recordHistory() {
    const t = simTime * 1000;
    for (const e of EN.values()) {
        if (!e.hx) { e.hx = new Float32Array(HN); e.hy = new Float32Array(HN); e.hz = new Float32Array(HN); e.ht = new Float64Array(HN); e.hi = 0; e.hn = 0; }
        e.hi = (e.hi + 1) % HN; e.hx[e.hi] = e.x; e.hy[e.hi] = e.y; e.hz[e.hi] = e.z; e.ht[e.hi] = t; if (e.hn < HN) e.hn++;
    }
}
function posAt(e, t, out) {
    let j = e.hi; out.x = e.x; out.y = e.y; out.z = e.z;
    for (let n = 0; n < e.hn - 1; n++) {
        const k = (j - 1 + HN) % HN;
        if (e.ht[k] <= t) { const span = e.ht[j] - e.ht[k], f = span > 0 ? (t - e.ht[k]) / span : 0; out.x = e.hx[k] + (e.hx[j] - e.hx[k]) * f; out.y = e.hy[k] + (e.hy[j] - e.hy[k]) * f; out.z = e.hz[k] + (e.hz[j] - e.hz[k]) * f; return out; }
        j = k;
    }
    if (e.hn) { out.x = e.hx[j]; out.y = e.hy[j]; out.z = e.hz[j]; }
    return out;
}
function smokeDamaged(e, dt) {
    const k = e.hp / e.def.hp; if (k > .4 || !e.alive) return;
    e.smk = (e.smk || 0) - dt; if (e.smk <= 0) { e.smk = k < .2 ? .05 : .12; fxSmoke(e.x, e.y + (e.def.ln === 'a' ? 0 : 2), e.z, 1.4, k < .2 ? 0x222222 : 0x666666); if (k < .2) part(e.x, e.y + 1, e.z, rnd(-1, 1), rnd(1, 3), rnd(-1, 1), .8, .4, 0xff8a1a, 0, .7); }
}
