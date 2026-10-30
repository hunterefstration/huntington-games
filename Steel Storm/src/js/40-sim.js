// ============================================================
// SIMULATION: entities, vehicle physics (one function per branch), weapons, projectiles, particles.
// The player and the bots share the same code: both just produce a control struct `c`:
//   {thr, steer, aimYaw, aimPitch, f1, f2, f3}
// ============================================================
const EN = new Map();            // id -> entity
let ME = null;                   // my entity
let M = null;                    // the running match (60-match.js)
let simTime = 0, shakeAmt = 0;
const V3 = new THREE.Vector3(), V3b = new THREE.Vector3(), QT = new THREE.Quaternion(), MT = new THREE.Matrix4(), ZAX = new THREE.Vector3(0, 0, 1), SC = new THREE.Vector3(), CL = new THREE.Color();

// ---------- particles: one instanced mesh, ring buffer ----------
const NP = 700;
const PA = { x: new Float32Array(NP), y: new Float32Array(NP), z: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP), vz: new Float32Array(NP), life: new Float32Array(NP), max: new Float32Array(NP), size: new Float32Array(NP), g: new Float32Array(NP), drag: new Float32Array(NP) };
let partMesh, pIdx = 0, partDirty = false, projMesh;
const NPR = 320;
function initFx() {
    partMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), NP);
    partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); partMesh.frustumCulled = false; partMesh.setColorAt(0, CL.setHex(0xffffff));
    for (let i = 0; i < NP; i++) { partMesh.setColorAt(i, CL); partMesh.setMatrixAt(i, MT.makeScale(0, 0, 0)); }
    scene.add(partMesh);
    projMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), NPR);
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
const PVIS = { bullet: [0.12, 0.12, 3.2, 0xffee88], shell: [0.45, 0.45, 1.8, 0xffc050], rocket: [0.5, 0.5, 2.6, 0xffffff], bomb: [1, 1, 2.4, 0x333333] };
function addProj(o) { if (PR.length > 600) PR.shift(); PR.push(o); return o; }
function segSphere(ax, ay, az, bx, by, bz, cx, cy, cz, r) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, l2 = dx * dx + dy * dy + dz * dz;
    let t = l2 > 0 ? ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
    const px = ax + dx * t - cx, py = ay + dy * t - cy, pz = az + dz * t - cz; return px * px + py * py + pz * pz <= r * r;
}
function updateProjectiles(dt) {
    let vi = 0;
    for (let i = PR.length - 1; i >= 0; i--) {
        const p = PR[i], ox = p.x, oy = p.y, oz = p.z;
        p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life -= dt;
        if (p.k === 'rocket' || p.k === 'bomb') { p.tt = (p.tt || 0) - dt; if (p.tt <= 0) { p.tt = .03; fxSmoke(p.x, p.y, p.z, p.k === 'rocket' ? .9 : .6, p.k === 'rocket' ? 0xbbbbbb : 0x555555); } }
        let hit = null;
        for (const e of EN.values()) {
            if (!e.alive || e.team === p.team || e.id === p.own) continue;
            if (segSphere(ox, oy, oz, p.x, p.y, p.z, e.x, e.y + (e.def.ln === 'a' ? 0 : 1.5), e.z, e.def.r + (p.k === 'bullet' ? 0.6 : 0.3))) { hit = e; break; }
        }
        const gh = GHS(p.x, p.z);
        if (hit || p.y < gh || p.life <= 0) {
            const hx = p.x, hy = hit ? p.y : Math.max(p.y, gh), hz = p.z;
            if (hit && p.rep) reportHit(p, hit, p.dmg);
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
    if (water) fxSplash(x, z, Math.min(10, sp * .8)); else fxExplosion(x, y, z, Math.min(14, sp * 1.1 + (p.k === 'shell' ? 1 : 0)));
    if (!p.rep) return;
    for (const e of EN.values()) {
        if (!e.alive || e.team === p.team || e === direct) continue;
        const dx = e.x - x, dy = (e.y + 1) - y, dz = e.z - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) - e.def.r * .5;
        if (d < sp) reportHit(p, e, p.dmg * (1 - clamp(d, 0, sp) / sp) * (direct ? .5 : .8));
    }
}

// ---------- entities ----------
function newEnt(id, def, team, name) {
    const e = { id, def, team, name, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, speed: 0, vx: 0, vy: 0, vz: 0, tur: 0, gun: 0, hp: def.hp, alive: true, t1: 0, t2: 0, t3: 0, thr: 0,
        a2: def.w2 && def.w2.cnt || 0, a3: def.w3 ? def.w3.cnt : 0, rel2: 0, rel3: 0, kills: 0, deaths: 0, score: 0, dmg: 0, remote: false, ai: null, fl: 0, flT: 0, respT: 0, mdl: null, tg: null, fire2: 0, budget: 0, y0: 0, muz: 0, dirty: 0 };
    attachModel(e); EN.set(id, e); return e;
}
function attachModel(e) {
    if (e.mdl) scene.remove(e.mdl.root);
    e.mdl = makeModel(e.def, e.team); e.mdl.root.visible = e.alive; scene.add(e.mdl.root);
}
function setDef(e, def) {
    e.def = def; e.hp = def.hp; e.a2 = def.w2 && def.w2.cnt || 0; e.a3 = def.w3 ? def.w3.cnt : 0; e.t1 = e.t2 = e.t3 = 0; e.speed = 0; e.thr = 0; e.gun = 0; attachModel(e);
}
function removeEnt(e) { if (e.mdl) scene.remove(e.mdl.root); EN.delete(e.id); }
// where each team starts (tanks on the west / east shores, ships in the northern and southern seas, jets over the ends)
function pickSpawn(team, ln) {
    const sgn = team === 0 ? -1 : 1;
    for (let k = 0; k < 40; k++) {
        if (ln === 'g') {
            const x = sgn * (340 + rnd(0, 70)), z = rnd(-110, 110);
            if (H(x, z) > 3 && H(x, z) < 22 && GH(x, z) === H(x, z)) return { x, z, y: H(x, z), yaw: team === 0 ? PI / 2 : -PI / 2 };
        } else if (ln === 'n') {
            const x = sgn * (240 + rnd(0, 200)), z = (Math.random() < .5 ? -1 : 1) * (500 + rnd(0, 90));
            if (H(x, z) < -6) return { x, z, y: 0, yaw: team === 0 ? PI / 2 : -PI / 2 };
        } else return { x: sgn * (600 + rnd(0, 40)), z: rnd(-200, 200), y: rnd(90, 140), yaw: team === 0 ? PI / 2 : -PI / 2 };
    }
    return ln === 'g' ? { x: sgn * 450, z: 0, y: H(sgn * 450, 0), yaw: 0 } : ln === 'n' ? { x: sgn * 300, z: 560, y: 0, yaw: 0 } : { x: sgn * 600, z: 0, y: 110, yaw: 0 };
}
function spawnEnt(e, sp) {
    sp = sp || pickSpawn(e.team, e.def.ln);
    e.x = sp.x; e.y = sp.y; e.z = sp.z; e.yaw = sp.yaw; e.tur = sp.yaw; e.pitch = 0; e.roll = 0; e.gun = 0; e.hp = e.def.hp; e.alive = true; e.speed = e.def.ln === 'a' ? e.def.minSp * 1.6 : 0; e.thr = e.def.ln === 'a' ? .6 : 0;
    e.a2 = e.def.w2 && e.def.w2.cnt || 0; e.a3 = e.def.w3 ? e.def.w3.cnt : 0; e.t1 = e.t2 = e.t3 = 1; e.vx = e.vy = e.vz = 0; e.budget = e.def.maxDps * 3;
    e.tg = { x: e.x, y: e.y, z: e.z, yaw: e.yaw, pitch: 0, roll: 0, tur: e.tur, gun: 0 }; e.snap = true;
    if (e.mdl) e.mdl.root.visible = true; e.dieT = 0;
    applyAnim(e, 0);
}
function applyAnim(e, dt) {
    const r = e.mdl.root, m = e.mdl; r.position.set(e.x, e.y, e.z); r.rotation.set(-e.pitch, e.yaw, e.roll);
    if (e.def.ln === 'g') { m.tur.rotation.y = e.tur - e.yaw; m.gun.rotation.x = -e.gun; }
    else if (e.def.ln === 'n') for (const t of m.turs) t.rotation.y = e.tur - e.yaw;
    else for (const p of m.props) p.rotation.z += dt * (30 + e.speed * .3);
}
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
    const d = e.def, sea = d.ln === 'n';
    const target = c.thr * d.sp * (c.thr < 0 ? .45 : 1);
    const acc = sea ? .45 : (Math.abs(target) < Math.abs(e.speed) ? 3 : 1.5);
    e.speed += (target - e.speed) * Math.min(1, acc * dt);
    const sf = clamp(Math.abs(e.speed) / (d.sp * .35), sea ? .15 : .5, 1);
    e.yaw -= c.steer * d.tn * sf * dt * (e.speed < -.5 ? -1 : 1);
    const sy = Math.sin(e.yaw), cyw = Math.cos(e.yaw), step = e.speed * dt;
    let nx = e.x + sy * step, nz = e.z + cyw * step;
    nx = clamp(nx, -EXT + 15, EXT - 15); nz = clamp(nz, -EXT + 15, EXT - 15);
    const h = H(nx, nz);
    let ok;
    if (sea) ok = h < -3.5 && H(nx + sy * 10, nz + cyw * 10) < -2;
    else { ok = h > .9 && (h - e.y) < Math.abs(step) * .9 + .15; }
    if (ok) { e.x = nx; e.z = nz; } else { e.speed *= -.2; }
    if (!sea) { pushOutOfBuildings(e, d.r * .8); }
    if (sea) {
        e.y = Math.sin(simTime * 1.1 + e.id) * .18 + .1;
        e.pitch += (Math.sin(simTime * .9 + e.id * 2) * .02 + clamp(-e.speed * .002, -.03, 0) - e.pitch) * Math.min(1, dt * 2);
        e.roll += (clamp(c.steer * e.speed * .012, -.12, .12) + Math.sin(simTime * 1.3 + e.id) * .015 - e.roll) * Math.min(1, dt * 2);
    } else {
        const gy = GH(e.x, e.z); e.y += (gy - e.y) * Math.min(1, dt * 14);
        const L = d.m.hull[2] * .5, W = d.m.hull[0] * .5, s2 = Math.sin(e.yaw), c2 = Math.cos(e.yaw);
        const hf = H(e.x + s2 * L, e.z + c2 * L), hb = H(e.x - s2 * L, e.z - c2 * L), hl = H(e.x + c2 * W, e.z - s2 * W), hr = H(e.x - c2 * W, e.z + s2 * W);
        e.pitch += (Math.atan2(hf - hb, L * 2) - e.pitch) * Math.min(1, dt * 6); e.roll += (Math.atan2(hl - hr, W * 2) - e.roll) * Math.min(1, dt * 6);
    }
    // turret + gun follow the aim
    e.tur += clamp(angDiff(e.tur, c.aimYaw), -d.tt * dt, d.tt * dt);
    e.gun += clamp(clamp(c.aimPitch, -.14, sea ? .75 : .5) - e.gun, -1.1 * dt, 1.1 * dt);
}
function stepAir(e, c, dt) {
    const d = e.def; e.thr = c.thr;
    let ay = c.aimYaw, ap = c.aimPitch;
    if (Math.abs(e.x) > EXT + 30 || Math.abs(e.z) > EXT + 30) { ay = Math.atan2(-e.x, -e.z); ap = .1; e.warn = true; } else e.warn = false;
    if (e.y > 330) ap = Math.min(ap, -.2);
    const tgt = lerp(d.minSp, d.sp, e.thr) - Math.sin(e.pitch) * d.sp * .3;
    e.speed += (tgt - e.speed) * Math.min(1, dt * .9); e.speed = clamp(e.speed, d.minSp * .85, d.sp * 1.12);
    const my = d.turn, mp = d.turn * .75, yr = clamp(angDiff(e.yaw, ay) * 2.6, -my, my), pr = clamp((ap - e.pitch) * 2.6, -mp, mp);
    e.yaw += yr * dt; e.pitch = clamp(e.pitch + pr * dt, -1.3, 1.3);
    e.roll += (clamp(-yr / my, -1, 1) * .95 - e.roll) * Math.min(1, dt * 4);
    const cp = Math.cos(e.pitch);
    e.x += Math.sin(e.yaw) * cp * e.speed * dt; e.y += Math.sin(e.pitch) * e.speed * dt; e.z += Math.cos(e.yaw) * cp * e.speed * dt;
    e.tur = e.yaw; e.gun = e.pitch;
    if (e.y < Math.max(GH(e.x, e.z), 0) + 1.2) { if (!e.noCrash) { e.crashed = true; } else e.y = Math.max(GH(e.x, e.z), 0) + 1.5; }
}
function stepVehicle(e, c, dt) {
    const px = e.x, py = e.y, pz = e.z;
    if (e.def.ln === 'a') stepAir(e, c, dt); else stepSurface(e, c, dt);
    if (dt > 0) { e.vx = (e.x - px) / dt; e.vy = (e.y - py) / dt; e.vz = (e.z - pz) / dt; }
    // timers + ammo restock
    e.t1 -= dt; e.t2 -= dt; e.t3 -= dt;
    const w2 = e.def.w2, w3 = e.def.w3;
    if (w2 && w2.cnt && e.a2 < w2.cnt) { e.rel2 -= dt; if (e.rel2 <= 0) { e.a2++; e.rel2 = w2.rel / w2.cnt; } }
    if (w3 && e.a3 < w3.cnt) { e.rel3 -= dt; if (e.rel3 <= 0) { e.a3++; e.rel3 = w3.rel / w3.cnt; } }
    e.flT -= dt; if (e.flT <= 0) e.fl = 0;
    if (c.f1) weaponFire(e, 'w1', c);
    if (c.f2) weaponFire(e, 'w2', c);
    if (c.f3) weaponFire(e, 'w3', c);
    applyAnim(e, dt);
}
// push overlapping ground/sea vehicles apart
function separate() {
    const L = Array.from(EN.values()).filter(e => e.alive && e.def.ln !== 'a');
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j]; if (a.def.ln !== b.def.ln) continue;
        const dx = b.x - a.x, dz = b.z - a.z, rr = (a.def.r + b.def.r) * .7, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > .0001) { const d = Math.sqrt(d2), k = (rr - d) * .5 / d; if (!a.remote) { a.x -= dx * k; a.z -= dz * k; } if (!b.remote) { b.x += dx * k; b.z += dz * k; } }
    }
}

// ---------- weapons ----------
function ballistic(ox, oy, oz, px, py, pz, v, g) {      // yaw + launch pitch to hit p from o
    const dx = px - ox, dz = pz - oz, dy = py - oy, d = Math.sqrt(dx * dx + dz * dz), yaw = Math.atan2(dx, dz);
    if (d < 1) return { yaw, pitch: Math.atan2(dy, 1) };
    const v2 = v * v, disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
    const pitch = disc < 0 ? .75 : Math.atan2(v2 - Math.sqrt(disc), g * d);
    return { yaw, pitch };
}
function weaponFire(e, slot, c) {
    const d = e.def, w = d[slot]; if (!w) return false;
    const T = slot === 'w1' ? 't1' : slot === 'w2' ? 't2' : 't3';
    if (e[T] > 0) return false;
    if (slot === 'w2' && w.cnt) { if (e.a2 <= 0) return false; e.a2--; if (e.rel2 <= 0) e.rel2 = w.rel / w.cnt; }
    if (slot === 'w3') { if (e.a3 <= 0) return false; e.a3--; if (e.rel3 <= 0) e.rel3 = w.rel / w.cnt; }
    e[T] = w.rl;
    const out = [], rep = !e.remote, n = w.nn || 1;
    const dirAt = (spr) => {
        const yaw = e.tur + rnd(-1, 1) * spr, pit = e.gun + rnd(-1, 1) * spr, cp = Math.cos(pit);
        return [Math.sin(yaw) * cp, Math.sin(pit), Math.cos(yaw) * cp];
    };
    for (let j = 0; j < n; j++) {
        e.muz++;
        const m = muzzleWorld(e, d.ln === 'n' && w.k === 'shell' ? j : e.muz); let x = m.x, y = m.y, z = m.z, dir, vx0 = 0, vy0 = 0, vz0 = 0;
        if (d.ln === 'a') {
            const cp = Math.cos(e.pitch), fx = Math.sin(e.yaw) * cp, fy = Math.sin(e.pitch), fz = Math.cos(e.yaw) * cp, spr = w.sprd || 0;
            dir = [fx + rnd(-1, 1) * spr, fy + rnd(-1, 1) * spr, fz + rnd(-1, 1) * spr]; vx0 = fx * e.speed; vy0 = fy * e.speed; vz0 = fz * e.speed;
            if (w.k === 'bomb') { y -= 1.2; dir = [0, 0, 0]; }
            if (w.k === 'rocket') y -= .5;
        } else dir = dirAt(w.k === 'shell' ? (w.spread || 0.004) : (w.sprd || 0.02));
        const v = w.v || 0, vx = dir[0] * v + vx0, vy = dir[1] * v + vy0, vz = dir[2] * v + vz0;
        const p = addProj({ x, y, z, vx, vy, vz, g: w.g, life: w.life, own: e.id, team: e.team, dmg: w.dmg, sp: w.sp || 0, pk: w.pierce || 0, k: w.k, slot, rep });
        if (!rep) p.dmg = 0;
        out.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1), +vx.toFixed(1), +vy.toFixed(1), +vz.toFixed(1)]);
    }
    // sound + flash
    const mm = muzzleWorld(e, e.muz);
    if (w.k === 'bullet') { sfx(d.ln === 'a' ? 'gun' : 'mg', mm.x, mm.y, mm.z, .7); e.fl |= slot === 'w1' ? 1 : 2; e.flT = .18; }
    else if (w.k === 'shell') { sfx(w.snd || 'cannon', mm.x, mm.y, mm.z); fxExplosion(mm.x, mm.y, mm.z, d.ln === 'n' ? 2.2 : 1.4, true); for (let i = 0; i < 4; i++) part(mm.x, mm.y, mm.z, rnd(-1, 1) * 3, rnd(0, 2), rnd(-1, 1) * 3, 1, .8, 0x777777, -1, .7); if (e === ME) shakeAmt = Math.max(shakeAmt, d.ln === 'n' ? 2.4 : 1.4); }
    else if (w.k === 'rocket') sfx('rocket', mm.x, mm.y, mm.z, .8); else sfx('bomb', mm.x, mm.y, mm.z, .6);
    if (w.k !== 'bullet' && rep) netFire(e, slot, out);
    return true;
}
// a shot somebody else fired (reliable event): same projectile, no damage here
function remoteShot(e, slot, ps) {
    const w = e.def[slot]; if (!w) return;
    for (const s of ps) addProj({ x: s[0], y: s[1], z: s[2], vx: s[3], vy: s[4], vz: s[5], g: w.g, life: w.life, own: e.id, team: e.team, dmg: 0, sp: w.sp || 0, pk: 0, k: w.k, slot, rep: false });
    const s = ps[0]; if (!s) return;
    if (w.k === 'shell') { sfx(w.snd || 'cannon', s[0], s[1], s[2]); fxExplosion(s[0], s[1], s[2], e.def.ln === 'n' ? 2.2 : 1.4, true); e.t1 = Math.max(e.t1, .2); }
    else if (w.k === 'rocket') sfx('rocket', s[0], s[1], s[2], .8); else sfx('bomb', s[0], s[1], s[2], .6);
}
// tracer fire of remote vehicles (their bullet weapons are shown from the "firing" flag in their state)
function remoteBullets(e, dt) {
    if (!e.fl || !e.alive) return;
    for (const slot of ['w1', 'w2']) {
        const bit = slot === 'w1' ? 1 : 2, w = e.def[slot]; if (!(e.fl & bit) || !w || w.k !== 'bullet') continue;
        e['t' + (slot === 'w1' ? 1 : 2)] -= 0; e.rtA = (e.rtA || 0) - dt;
        if (e.rtA <= 0) {
            e.rtA = Math.max(.07, w.rl); e.muz++; const m = muzzleWorld(e, e.muz), cp = Math.cos(e.def.ln === 'a' ? e.pitch : e.gun), yy = e.def.ln === 'a' ? e.yaw : e.tur, py = e.def.ln === 'a' ? e.pitch : e.gun;
            const dx = Math.sin(yy) * cp, dy = Math.sin(py), dz = Math.cos(yy) * cp, v = w.v;
            addProj({ x: m.x, y: m.y, z: m.z, vx: dx * v + e.vx, vy: dy * v + e.vy, vz: dz * v + e.vz, g: w.g, life: w.life, own: e.id, team: e.team, dmg: 0, sp: 0, pk: 0, k: 'bullet', slot, rep: false });
            sfx(e.def.ln === 'a' ? 'gun' : 'mg', m.x, m.y, m.z, .6);
        }
    }
}
// smooth other people's vehicles toward the last state we heard
function stepRemote(e, dt) {
    const t = e.tg; if (!t) return;
    if (e.snap) { e.x = t.x; e.y = t.y; e.z = t.z; e.yaw = t.yaw; e.pitch = t.pitch; e.roll = t.roll; e.tur = t.tur; e.gun = t.gun; e.snap = false; }
    else {
        t.x += e.vx * dt; t.y += e.vy * dt; t.z += e.vz * dt;      // dead-reckon the target forward
        const k = Math.min(1, dt * 10);
        e.x += (t.x - e.x) * k; e.y += (t.y - e.y) * k; e.z += (t.z - e.z) * k;
        e.yaw += angDiff(e.yaw, t.yaw) * k; e.pitch += (t.pitch - e.pitch) * k; e.roll += (t.roll - e.roll) * k; e.tur += angDiff(e.tur, t.tur) * k; e.gun += (t.gun - e.gun) * k;
    }
    e.t1 -= dt; e.t2 -= dt; e.flT -= dt; if (e.flT <= 0 && e.fl && !e.netFl) e.fl = 0;
    remoteBullets(e, dt);
    applyAnim(e, dt);
}
function smokeDamaged(e, dt) {
    const k = e.hp / e.def.hp; if (k > .4 || !e.alive) return;
    e.smk = (e.smk || 0) - dt; if (e.smk <= 0) { e.smk = k < .2 ? .05 : .12; fxSmoke(e.x, e.y + (e.def.ln === 'a' ? 0 : 2), e.z, 1.4, k < .2 ? 0x222222 : 0x666666); if (k < .2) part(e.x, e.y + 1, e.z, rnd(-1, 1), rnd(1, 3), rnd(-1, 1), .8, .4, 0xff8a1a, 0, .7); }
}
