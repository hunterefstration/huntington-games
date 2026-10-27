// ==========================================
// 2a. EFFECTS POOLS (instanced = one draw call each)
// ==========================================
const PMAX = 800, TMAX = 160, DMAX = 90, BMAX = 64, HMAX = 80, SMAX = 56, SCMAX = 20;     // (4.0: more tracers for the tesla's lightning)
let fxGlow, fxSolid, tracerMesh, boltMesh, decalMesh, blobMesh, hpBg, hpFg, smokeMesh, scorchMesh;
const glowParts = [], solidParts = [], tracerList = [];
let decalIdx = 0, decalCount = 0;
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3(), _col = new THREE.Color();
const _Z = new V3(0, 0, 1);


function makeInstanced(geo, mat, max) {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false; m.count = 0;
    scene.add(m); INST.push(m);
    return m;
}
// Upload only the instances in use: the buffers are sized for the busiest moment, and sending all of them
// every frame (even when empty) was a big share of the per-frame GPU traffic on slow machines.
const INST = [];
function instUpload(m, n, from = 0) {
    if (n <= 0) return;
    const a = m.instanceMatrix; a.addUpdateRange(from * 16, n * 16); a.needsUpdate = true;
    const c = m.instanceColor; if (c) { c.addUpdateRange(from * 3, n * 3); c.needsUpdate = true; }
}
// right before rendering: an empty effect mesh is skipped instead of costing a draw call (blob shadows only on Low)
function instFlush() {
    for (let i = 0; i < INST.length; i++) { const m = INST[i]; m.visible = m.count > 0 && (m !== blobMesh || !Q.shadows); }
}
function initFx() {
    fxGlow = makeInstanced(sharedBox, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), PMAX);
    fxSolid = makeInstanced(sharedBox, new THREE.MeshLambertMaterial({ color: 0xffffff }), PMAX);
    fxSolid.castShadow = false;
    tracerMesh = makeInstanced(sharedBox, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), TMAX * 2);
    // 4.0: lightning is drawn on top of everything so the tesla's chain shows across the zombies it links
    boltMesh = makeInstanced(sharedBox, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }), TMAX);
    boltMesh.renderOrder = 4;
    const dg = new THREE.PlaneGeometry(1, 1);
    decalMesh = makeInstanced(dg, new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), DMAX);
    decalMesh.renderOrder = 3;
    const bg = new THREE.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2);
    blobMesh = makeInstanced(bg, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), BMAX);
    blobMesh.renderOrder = 1;
    // enemy health bars: two instanced quads that always face the camera
    hpBg = makeInstanced(_hpGeo, new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, toneMapped: false }), HMAX);
    hpFg = makeInstanced(_hpGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, toneMapped: false }), HMAX);
    hpBg.renderOrder = 10; hpFg.renderOrder = 11;
    // scorch marks left by blasts (lie flat on the ground)
    const sg = new THREE.PlaneGeometry(1, 1);
    scorchMesh = makeInstanced(sg, new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }), SCMAX);
    scorchMesh.renderOrder = 2;
    // smoke: soft billboards, one draw call. instanceColor.r = opacity, .g = shade (small shader patch, no extra textures)
    const sm = new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, depthWrite: false, toneMapped: false, fog: true });
    sm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', 'diffuseColor.a *= vColor.r; diffuseColor.rgb *= vColor.g;'); };
    smokeMesh = makeInstanced(new THREE.PlaneGeometry(1, 1), sm, SMAX);
    smokeMesh.renderOrder = 5;
}
const _hpGeo = new THREE.PlaneGeometry(1, 1);
function updateHpBars() {
    let n = 0;
    for (const e of enemies) {
        const u = e.userData;
        if (!u.barShow || u.dead || !e.visible || n >= HMAX) continue;
        const r = Math.max(0, Math.min(1, u.hp / u.maxHp));
        _p.set(e.position.x, e.position.y + u.barY, e.position.z);
        _m4.compose(_p, camera.quaternion, _s.set(u.barW + 0.08, 0.2, 1)); hpBg.setMatrixAt(n, _m4); hpBg.instanceColor.setXYZ(n, 1, 1, 1);
        _m4.compose(_p, camera.quaternion, _s.set(Math.max(0.001, u.barW * r), 0.13, 1)); hpFg.setMatrixAt(n, _m4);
        _col.setHex(r > 0.5 ? 0x4ade80 : (r > 0.25 ? 0xfacc15 : 0xef4444)); hpFg.instanceColor.setXYZ(n, _col.r, _col.g, _col.b);
        n++;
    }
    hpBg.count = hpFg.count = n;
    instUpload(hpBg, n); instUpload(hpFg, n);
}


// lit=false: glowing spark; lit=true: solid chunk (debris, dust) that takes scene lighting
function spawnParticles(pos, color, count, speed, life, size, lit = false, opts = {}) {
    const list = lit ? solidParts : glowParts;
    const cap = Math.min(PMAX, Q.particles);
    if (list.length + count > cap) count = Math.max(0, Math.min(count, 2, cap - list.length));
    _col.setHex(color);
    for (let i = 0; i < count; i++) {
        const vx = Math.random() - 0.5, vy = Math.random() * 0.9 + 0.1, vz = Math.random() - 0.5;
        const inv = speed * (0.4 + Math.random() * 0.6) / (Math.hypot(vx, vy, vz) || 1);
        list.push({
            x: pos.x + (opts.jitter ? (Math.random() - 0.5) * opts.jitter : 0), y: pos.y + (opts.jitterY ? Math.random() * opts.jitterY : 0), z: pos.z + (opts.jitter ? (Math.random() - 0.5) * opts.jitter : 0),
            vx: vx * inv, vy: vy * inv * (opts.up || 1), vz: vz * inv,
            life: life * (0.7 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8),
            grav: opts.grav ?? 18, bounce: !!opts.bounce, spin: opts.spin ? (Math.random() - 0.5) * opts.spin : 0,
            rx: Math.random() * 3, ry: Math.random() * 3, rz: Math.random() * 3, r: _col.r, g: _col.g, b: _col.b, drag: opts.drag || 0
        });
    }
}
function stepParticleList(list, mesh, dt) {
    let n = 0;
    for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
        p.vy -= p.grav * dt;
        if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < p.size / 2) {
            p.y = p.size / 2;
            if (p.bounce) { p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; } else { p.vx = p.vy = p.vz = 0; }
        }
        if (p.spin) { p.rx += p.spin * dt; p.rz += p.spin * dt * 0.7; }
    }
    for (let i = 0; i < list.length && n < PMAX; i++) {
        const p = list[i];
        const k = Math.min(1, p.life / (p.max * 0.5));
        const sc = Math.max(0.001, p.size * k);
        _q.setFromEuler(_e.set(p.rx, p.ry, p.rz));
        _m4.compose(_p.set(p.x, p.y, p.z), _q, _s.set(sc, sc, sc));
        mesh.setMatrixAt(n, _m4);
        mesh.instanceColor.setXYZ(n, p.r, p.g, p.b);
        n++;
    }
    mesh.count = n;
    instUpload(mesh, n);
}
function updateParticles(dt) { stepParticleList(glowParts, fxGlow, dt); stepParticleList(solidParts, fxSolid, dt); updateSmoke(dt); }


const tracerPool = [];        // 4.0: finished tracers are reused instead of allocating new ones every shot
function spawnTracer(from, to, color, width, life = 0.09, top = false) {
    const len = from.distanceTo(to); if (len < (top ? 0.2 : 0.5)) return;
    if (tracerList.length >= TMAX) tracerPool.push(tracerList.shift());
    _col.setHex(color);
    const t = tracerPool.pop() || { from: new V3(), to: new V3() };
    t.from.copy(from); t.to.copy(to); t.len = len; t.w = width; t.life = t.max = life; t.r = _col.r; t.g = _col.g; t.b = _col.b; t.top = top;
    tracerList.push(t);
}
const _dirT = new V3();
function updateTracers(dt) {
    let n = 0;
    for (let i = tracerList.length - 1; i >= 0; i--) { const t = tracerList[i]; t.life -= dt; if (t.life <= 0) { tracerList[i] = tracerList[tracerList.length - 1]; tracerList.pop(); tracerPool.push(t); } }
    let nb = 0;
    for (const t of tracerList) {
        const k = t.life / t.max;
        _dirT.subVectors(t.to, t.from).normalize();
        _q.setFromUnitVectors(_Z, _dirT);
        if (t.top) {
            _p.copy(t.from).lerp(t.to, 0.5);
            _m4.compose(_p, _q, _s.set(t.w * (0.5 + 0.5 * k), t.w * (0.5 + 0.5 * k), t.len));
            boltMesh.setMatrixAt(nb, _m4); boltMesh.instanceColor.setXYZ(nb, t.r * k, t.g * k, t.b * k); nb++;
            continue;
        }
        // a bright streak that flies from the muzzle to the impact, with a hot white core inside a coloured glow
        let a = 0, bEnd = t.len;
        if (t.len > 9) { bEnd = t.len * Math.min(1, (1 - k) * 1.7 + 0.18); a = Math.max(0, bEnd - Math.max(7, t.len * 0.3)); }
        const L = Math.max(0.05, bEnd - a), w = t.w * (0.55 + 0.45 * k), f = Math.min(1, k * 2.2);
        _p.copy(t.from).addScaledVector(_dirT, a + L * 0.5);
        _m4.compose(_p, _q, _s.set(w, w, L)); tracerMesh.setMatrixAt(n, _m4); tracerMesh.instanceColor.setXYZ(n, t.r * f, t.g * f, t.b * f); n++;
        _m4.compose(_p, _q, _s.set(w * 0.38, w * 0.38, L * 0.96)); tracerMesh.setMatrixAt(n, _m4); tracerMesh.instanceColor.setXYZ(n, f, f, f * 0.95); n++;
    }
    tracerMesh.count = n; boltMesh.count = nb;
    instUpload(tracerMesh, n); instUpload(boltMesh, nb);
}


const _dq = new THREE.Quaternion();
const DECAL_TINT = { m: [1.5, 1.45, 1.4], w: [1.1, 0.85, 0.6], d: [0.9, 0.85, 0.75], c: [1.3, 1.3, 1.4], g: [1.2, 1.5, 1.6], l: [0.7, 0.9, 0.6], s: [1, 1, 1] };
function addDecal(point, normal, cls = 's') {
    _q.setFromUnitVectors(_Z, normal);
    _q.multiply(_dq.setFromAxisAngle(_Z, Math.random() * 6.28));
    const s = (cls === 'w' ? 0.15 : 0.12) + Math.random() * 0.07;
    _m4.compose(_p.copy(point).addScaledVector(normal, 0.012), _q, _s.set(s, s, s));
    decalMesh.setMatrixAt(decalIdx, _m4);
    const t = DECAL_TINT[cls] || DECAL_TINT.s;
    decalMesh.instanceColor.setXYZ(decalIdx, t[0], t[1], t[2]);
    decalIdx = (decalIdx + 1) % DMAX;
    decalCount = Math.min(DMAX, decalCount + 1);
    decalMesh.count = decalCount;
    instUpload(decalMesh, 1, (decalIdx + DMAX - 1) % DMAX);
}
let scorchIdx = 0, scorchCount = 0;
const _up3 = new V3(0, 1, 0);
function addScorch(point, normal, size) {
    _q.setFromUnitVectors(_Z, normal);
    _q.multiply(_dq.setFromAxisAngle(_Z, Math.random() * 6.28));
    _m4.compose(_p.copy(point).addScaledVector(normal, 0.02), _q, _s.set(size, size, size));
    scorchMesh.setMatrixAt(scorchIdx, _m4);
    const g = 0.75 + Math.random() * 0.25; scorchMesh.instanceColor.setXYZ(scorchIdx, g, g, g);
    scorchIdx = (scorchIdx + 1) % SCMAX; scorchCount = Math.min(SCMAX, scorchCount + 1);
    scorchMesh.count = scorchCount;
    instUpload(scorchMesh, 1, (scorchIdx + SCMAX - 1) % SCMAX);
}
function clearDecals() { decalIdx = 0; decalCount = 0; scorchIdx = 0; scorchCount = 0; if (decalMesh) decalMesh.count = 0; if (scorchMesh) scorchMesh.count = 0; }


// Blob shadows under enemies, only used when real shadows are off (Low quality)
function updateBlobs() {
    if (Q.shadows) return;
    let n = 0;
    for (const e of enemies) {
        if (n >= BMAX) break;
        const u = e.userData;
        const gy = groundAt(e.position.x, e.position.z, 0, e.position.y + 0.1);
        const fade = clamp(1 - (e.position.y - gy) / 8, 0.2, 1);
        const s = u.radius * 3.2 * fade;
        _q.identity();
        _m4.compose(_p.set(e.position.x, gy + 0.03, e.position.z), _q, _s.set(s, 1, s));
        blobMesh.setMatrixAt(n, _m4); blobMesh.instanceColor.setXYZ(n, 1, 1, 1);
        n++;
    }
    blobMesh.count = n;
    instUpload(blobMesh, n);
}


// Tiers without real point lights (Low / Auto-low) still get a muzzle + explosion glow: the world shaders add a
// distance falloff from two uniform positions, so it costs a few ALU ops and no extra lights or shader variants.
let fakeMz = 0, fakeBm = 0;
const _fmz = new THREE.Vector3();
function fakeMuzzle() { if (Q.pointLights === 0) fakeMz = 1; }
function fakeBoom(pos) { if (Q.pointLights === 0) { fakeBm = 1; LIGHT_U.uBm.value.set(pos.x, pos.y + 1, pos.z, 0); } }
function updateFakeLights(dt) {
    if (Q.pointLights > 0) { if (fakeMz + fakeBm > 0) { fakeMz = fakeBm = 0; LIGHT_U.uMz.value.w = LIGHT_U.uBm.value.w = 0; } return; }
    if (fakeMz > 0) {
        fakeMz = Math.max(0, fakeMz - dt * 9);
        camera.getWorldDirection(_fmz); _fmz.multiplyScalar(1.3).add(camera.position);
        LIGHT_U.uMz.value.set(_fmz.x, _fmz.y, _fmz.z, 2.2 * fakeMz);
    } else LIGHT_U.uMz.value.w = 0;
    if (fakeBm > 0) { fakeBm = Math.max(0, fakeBm - dt * 2.2); LIGHT_U.uBm.value.w = 5 * (1 - 0.8 * (theme.bright || 0)) * fakeBm; } else LIGHT_U.uBm.value.w = 0;
}


// Smoke puffs: soft billboards that rise, swell and fade (one draw call, capped; fewer on Low)
const smokeParts = [];
function spawnSmoke(pos, count, size, shade = 0.35, rise = 1.6, spread = 1.5, life = 1.1, alpha = 0.55) {
    const cap = Q.lite ? 22 : SMAX;
    for (let i = 0; i < count && smokeParts.length < cap; i++) {
        smokeParts.push({ x: pos.x + (Math.random() - 0.5) * spread * 0.4, y: pos.y, z: pos.z + (Math.random() - 0.5) * spread * 0.4,
            vx: (Math.random() - 0.5) * spread, vy: rise * (0.6 + Math.random() * 0.6), vz: (Math.random() - 0.5) * spread,
            life: life * (0.7 + Math.random() * 0.5), max: life, size: size * (0.7 + Math.random() * 0.6), shade: shade * (0.8 + Math.random() * 0.4), a: alpha, spin: (Math.random() - 0.5) * 1.5, rot: Math.random() * 6.28 });
    }
}
const _smQ = new THREE.Quaternion(), _smR = new THREE.Quaternion();
function updateSmoke(dt) {
    let n = 0;
    for (let i = smokeParts.length - 1; i >= 0; i--) {
        const p = smokeParts[i];
        p.life -= dt;
        if (p.life <= 0) { smokeParts[i] = smokeParts[smokeParts.length - 1]; smokeParts.pop(); continue; }
        const k = Math.exp(-dt * 1.6); p.vx *= k; p.vz *= k; p.vy *= Math.exp(-dt * 0.8);
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.rot += p.spin * dt;
    }
    for (let i = 0; i < smokeParts.length && n < SMAX; i++) {
        const p = smokeParts[i], u = 1 - p.life / p.max;
        const sc = p.size * (0.5 + u * 1.5), al = p.a * Math.min(1, u * 8) * (1 - u) * (1 - u * 0.4);
        _smR.setFromAxisAngle(_Z, p.rot); _smQ.copy(camera.quaternion).multiply(_smR);
        _m4.compose(_p.set(p.x, p.y, p.z), _smQ, _s.set(sc, sc, sc));
        smokeMesh.setMatrixAt(n, _m4); smokeMesh.instanceColor.setXYZ(n, al, p.shade, 0);
        n++;
    }
    smokeMesh.count = n;
    instUpload(smokeMesh, n);
}


// Muzzle burst: a few hot sparks thrown forward out of the barrel, plus an occasional wisp of gun smoke
let muzzleN = 0;
function muzzleBurst(pos, dir, power) {
    const cap = Math.min(PMAX, Q.particles);
    if (glowParts.length + 3 < cap) {
        _col.setHex(0xffd88a);
        for (let i = 0; i < 3; i++) {
            const sp = (7 + Math.random() * 9) * power;
            glowParts.push({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * sp + (Math.random() - 0.5) * 3, vy: dir.y * sp + (Math.random() - 0.3) * 3, vz: dir.z * sp + (Math.random() - 0.5) * 3,
                life: 0.12 + Math.random() * 0.1, max: 0.2, size: 0.035, grav: 10, bounce: false, spin: 0, rx: 0, ry: 0, rz: 0, r: _col.r, g: _col.g, b: _col.b, drag: 3 });
        }
    }
    if ((++muzzleN & 3) === 0) spawnSmoke(pos, 1, 0.22, 0.6, 0.5, 0.3, 0.6, 0.25);
}
// What a bullet hit is made of: metal, wood, stone/concrete, dirt/sand, leaves, glass or cloud. Looked up from the block that holds the hit point.
const SURF = { steel: 'm', post: 'm', rust: 'm', fence: 'm', escF: 'm', escB: 'm', accR: 'm', accB: 'm', accG: 'm', accY: 'm', olive: 'm', rubber: 'r',
               wood: 'w', woodDark: 'w', rope: 'w', leaf: 'l', leafDark: 'l', glass: 'g', sand: 'd', khaki: 'd', floor: 'd', cloud: 'c', cloudShade: 'c' };
function surfaceAt(p, n) {
    if (n.y > 0.5 && p.y < 0.08) return 'floor';
    for (let i = worldBlocks.length - 1; i >= 0; i--) {
        const b = worldBlocks[i];
        if (!b.solid) continue;
        if (Math.abs(p.x - b.x) <= b.w / 2 + 0.06 && Math.abs(p.y - b.y) <= b.h / 2 + 0.06 && Math.abs(p.z - b.z) <= b.d / 2 + 0.06) return b.key;
    }
    return 'floor';
}
const _imp = new V3();
// per-surface impact: sparks + ricochet on metal, splinters on wood, chips and dust on stone, dust on dirt, leaves, glass glints
function impactFx(point, normal, key) {
    const c = SURF[key] || 's';
    _imp.copy(point).addScaledVector(normal, 0.05);
    if (c === 'm') {
        spawnParticles(_imp, 0xfff1b0, 5, 9, 0.22, 0.045, false, { grav: 14, up: 0.8 });
        spawnParticles(_imp, 0xff9a3a, 3, 5, 0.3, 0.05, false, { grav: 16 });
    } else if (c === 'w') {
        spawnParticles(_imp, 0xc89560, 4, 5, 0.5, 0.07, true, { grav: 16, bounce: true, spin: 10 });
        spawnParticles(_imp, 0x8a5a30, 2, 3, 0.5, 0.09, true, { grav: 14, spin: 8 });
    } else if (c === 'l') {
        spawnParticles(_imp, 0x4ea04a, 4, 4, 0.7, 0.08, true, { grav: 5, drag: 1.5, spin: 12 });
    } else if (c === 'g') {
        spawnParticles(_imp, 0xbdf0ff, 6, 6, 0.4, 0.05, false, { grav: 10 });
    } else if (c === 'c') {
        spawnSmoke(_imp, 1, 0.5, 1.0, 0.4, 0.5, 0.5, 0.4);
    } else if (c === 'd' || c === 'r') {
        spawnParticles(_imp, 0xb8a47a, 3, 3, 0.5, 0.08, true, { grav: 8, drag: 2 });
        spawnSmoke(_imp, 1, 0.5, c === 'r' ? 0.2 : 0.55, 0.9, 0.7, 0.8, 0.4);
    } else {
        spawnParticles(_imp, 0xffd27a, 2, 6, 0.2, 0.04, false);
        spawnParticles(_imp, 0x9aa0aa, 3, 4, 0.6, 0.06, true, { grav: 14, bounce: true });
        spawnSmoke(_imp, 1, 0.45, 0.62, 0.9, 0.6, 0.7, 0.4);
    }
    if (c !== 'c' && c !== 'g') addDecal(point, normal, c);
}


// Explosions: small pool of fireball + shock ring meshes that get reused
const explosionPool = [], explosions = [];
const _ballGeo = new THREE.SphereGeometry(1, 16, 12), _ringGeo = new THREE.RingGeometry(0.8, 1, 40);
function getExplosionFx() {
    let fx = explosionPool.find(f => !f.active);
    if (!fx) {
        const ball = new THREE.Mesh(_ballGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        const ring = new THREE.Mesh(_ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, forceSinglePass: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2;
        // a second, slower dust ring on the ground and a bright core flash that pops and dies fast
        const dust = new THREE.Mesh(_ringGeo, new THREE.MeshBasicMaterial({ color: 0x9a8f80, transparent: true, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false, toneMapped: false }));
        dust.rotation.x = -Math.PI / 2;
        const core = new THREE.Mesh(_ballGeo, new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        fx = { ball, ring, dust, core, active: false };
        explosionPool.push(fx);
    }
    return fx;
}
const _scp = new V3();
function spawnBlastFx(pos, radius, color, ringOnly = false, dur = 0.45) {
    const fx = getExplosionFx();
    fx.active = true; fx.t = 0; fx.dur = dur; fx.radius = radius; fx.ringOnly = ringOnly;
    fx.ball.material.color.setHex(color); fx.ring.material.color.setHex(ringOnly ? color : 0xffffff);
    // additive fire on a bright daytime sky washes out to white, so in daylight it's drawn as solid fire
    const bright = theme.bright || 0;
    fx.ball.material.blending = bright > 0.5 ? THREE.NormalBlending : THREE.AdditiveBlending;
    if (bright > 0.5) fx.ball.material.color.multiplyScalar(0.85);
    fx.peak = 0.9 * (1 - 0.35 * bright); fx.ball.material.needsUpdate = true;
    fx.ball.position.copy(pos); fx.ball.visible = !ringOnly;
    const big = !ringOnly && dur > 0.3;
    fx.dust.visible = big; fx.core.visible = big;
    if (big) {
        fx.core.position.copy(pos);
        const gy = groundAt(pos.x, pos.z, 0, pos.y);
        fx.dust.position.set(pos.x, Math.max(0.1, gy + 0.12), pos.z);
        // smoke column, ground scorch, flying debris
        spawnSmoke(pos, Math.min(7, 2 + (radius / 2 | 0)), 1.2 + radius * 0.18, 0.28 + 0.3 * bright, 2.2, 3 + radius * 0.3, 1.5 + radius * 0.08, 0.6);
        if (pos.y - gy < radius * 0.7 && radius >= 3) addScorch(_scp.set(pos.x, gy, pos.z), _up3, radius * 1.5);
        spawnParticles(pos, bright > 0.5 ? 0x6b6358 : 0x5a5248, 8, 11, 0.9, 0.16, true, { grav: 16, bounce: true, spin: 12 });
    }
    fx.ring.position.set(pos.x, Math.max(0.1, groundAt(pos.x, pos.z, 0, pos.y) + 0.08), pos.z);
    scene.add(fx.ball, fx.ring, fx.dust, fx.core);
    explosions.push(fx);
}
function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i]; ex.t += dt;
        const k = ex.t / ex.dur;
        if (k >= 1) { scene.remove(ex.ball, ex.ring, ex.dust, ex.core); ex.active = false; explosions.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - k, 3);
        ex.ball.scale.setScalar(0.5 + e * ex.radius * 0.55); ex.ball.material.opacity = (ex.peak || 0.9) * (1 - k);
        ex.ring.scale.setScalar(0.5 + e * ex.radius); ex.ring.material.opacity = (ex.ringOnly ? 0.9 : 0.7) * (1 - k);
        if (ex.dust.visible) {
            const kd = Math.min(1, ex.t / (ex.dur * 1.6)), ed = 1 - Math.pow(1 - kd, 2.4);
            ex.dust.scale.setScalar(0.6 + ed * ex.radius * 1.35); ex.dust.material.opacity = 0.32 * (1 - kd);
            const kc = Math.min(1, ex.t / (ex.dur * 0.35));
            ex.core.scale.setScalar((0.4 + kc * ex.radius * 0.3) ); ex.core.material.opacity = 0.95 * (1 - kc) * (1 - kc);
            ex.core.visible = kc < 1;
        }
    }
    for (const bl of boomLights) { if (bl.t > 0) { bl.t -= dt * 2.2; bl.light.intensity = (bl.peak || 900) * Math.max(0, bl.t); } }
}


const _proj = new V3();
// Damage numbers are a small pool of reused elements (no DOM churn during firefights)
const dmgPool = [];
const DMG_ANIM = [{ opacity: 1, transform: 'translate(-50%, -50%) scale(0.5)', offset: 0 }, { opacity: 1, transform: 'translate(-50%, calc(-50% - 12px)) scale(1.35)', offset: 0.14 },
                  { opacity: 1, transform: 'translate(-50%, calc(-50% - 26px)) scale(1)', offset: 0.5 }, { opacity: 0, transform: 'translate(-50%, calc(-50% - 62px)) scale(0.85)', offset: 1 }];
function spawnDamageNumber(worldPos, text, cls) {
    _proj.copy(worldPos).project(camera);
    if (_proj.z > 1 || _proj.z < -1) return;
    let el = dmgPool.find(e => !e._busy);
    if (!el) { if (dmgPool.length >= 32) return; el = document.createElement('div'); ui.dmgLayer.appendChild(el); dmgPool.push(el); }
    el._busy = true;
    el.className = 'dmg-num ' + (cls || '');
    el.textContent = text;
    const v = parseFloat(text);       // bigger hits, bigger numbers
    el.style.fontSize = (v === v && (!cls || cls === 'head' || cls === 'boom')) ? Math.round(Math.min(34, (cls === 'head' ? 21 : 15) + Math.sqrt(v) * 0.85)) + 'px' : '';
    el.style.left = ((_proj.x * 0.5 + 0.5) * window.innerWidth + (Math.random() * 30 - 15)) + 'px';
    el.style.top = ((-_proj.y * 0.5 + 0.5) * window.innerHeight + (Math.random() * 16 - 8)) + 'px';
    el.style.display = 'block';
    el.animate(DMG_ANIM, { duration: 750, easing: 'ease-out', fill: 'forwards' });
    clearTimeout(el._t); el._t = setTimeout(() => { el._busy = false; el.style.display = 'none'; }, 760);
}


// ---------- WEATHER (Storm lighting) ----------
// Rain is one draw call: streaks fall in the vertex shader, the CPU never touches them.
let rainMesh = null, rainAudio = null;
function initRain() {
    const N = 1600, pos = new Float32Array(N * 6), tip = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
        const x = (Math.random() - 0.5) * 70, y = Math.random() * 40, z = (Math.random() - 0.5) * 70;
        pos.set([x, y, z, x, y, z], i * 6); tip[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(tip, 1));
    const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `uniform float uTime; attribute float tip; varying float vA;
            void main() { vec3 p = position; p.y = mod(p.y - uTime * 30.0, 40.0) - 10.0; p.x -= tip * 0.22; p.y += tip * 1.2; vA = 0.15 + tip * 0.3;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
        fragmentShader: `varying float vA; void main() { gl_FragColor = vec4(0.72, 0.8, 0.95, vA); }`,
        transparent: true, depthWrite: false, fog: false
    });
    rainMesh = new THREE.LineSegments(g, m);
    rainMesh.frustumCulled = false; rainMesh.visible = false;
    scene.add(rainMesh);
}
function setRainAudio(on) {
    if (!actx) return;
    if (on && !rainAudio) {
        const src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
        const g = actx.createGain(); g.gain.value = 0.05;
        src.connect(f); f.connect(g); g.connect(master); src.start();
        rainAudio = src;
    } else if (!on && rainAudio) { try { rainAudio.stop(); } catch (e) {} rainAudio = null; }
}
function updateWeather(dt) {
    if (!rainMesh) return;
    const storm = !!theme.rain;
    setRainAudio(storm && currentGameState === 'playing');
    if (storm) {
        rainMesh.geometry.setDrawRange(0, Math.floor(1600 * Q.rain) * 2);
        rainMesh.material.uniforms.uTime.value += dt;
        rainMesh.position.set(camera.position.x, camera.position.y - 8, camera.position.z);
    }
    if (lightningFlash > 0) {
        lightningFlash = Math.max(0, lightningFlash - dt);
        const k = lightningFlash > 0.18 || (lightningFlash > 0.06 && lightningFlash < 0.1) ? 1 : 0;
        hemi.intensity = theme.hemiInt * (Q.env ? 1 : 2.1) * (1 + 3 * k);
        if (lightningFlash <= 0) hemi.intensity = theme.hemiInt * (Q.env ? 1 : 2.1);
    }
    if (theme.lightning && currentGameState !== 'paused' && currentGameState !== 'shop') {
        lightningT -= dt;
        if (lightningT <= 0) { lightningT = 7 + Math.random() * 10; lightningFlash = 0.28; sfx('thunder'); }
    }
}
