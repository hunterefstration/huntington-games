// ==========================================
// 2a. EFFECTS POOLS (instanced = one draw call each)
// ==========================================
const PMAX = 800, TMAX = 160, DMAX = 90, BMAX = 64, HMAX = 80;     // (4.0: more tracers for the tesla's lightning)
let fxGlow, fxSolid, tracerMesh, boltMesh, decalMesh, blobMesh, hpBg, hpFg;
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
    scene.add(m);
    return m;
}
function initFx() {
    fxGlow = makeInstanced(sharedBox, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), PMAX);
    fxSolid = makeInstanced(sharedBox, new THREE.MeshLambertMaterial({ color: 0xffffff }), PMAX);
    fxSolid.castShadow = false;
    tracerMesh = makeInstanced(sharedBox, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), TMAX);
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
    if (n) { hpBg.instanceMatrix.needsUpdate = hpFg.instanceMatrix.needsUpdate = true; hpBg.instanceColor.needsUpdate = hpFg.instanceColor.needsUpdate = true; }
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
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
}
function updateParticles(dt) { stepParticleList(glowParts, fxGlow, dt); stepParticleList(solidParts, fxSolid, dt); }


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
        _p.copy(t.from).lerp(t.to, 0.5);
        _m4.compose(_p, _q, _s.set(t.w * (0.5 + 0.5 * k), t.w * (0.5 + 0.5 * k), t.len));
        const mesh = t.top ? boltMesh : tracerMesh, j = t.top ? nb++ : n++;
        mesh.setMatrixAt(j, _m4);
        mesh.instanceColor.setXYZ(j, t.r * k, t.g * k, t.b * k);
    }
    tracerMesh.count = n; boltMesh.count = nb;
    tracerMesh.instanceMatrix.needsUpdate = true; tracerMesh.instanceColor.needsUpdate = true;
    if (nb || boltMesh._had) { boltMesh.instanceMatrix.needsUpdate = true; boltMesh.instanceColor.needsUpdate = true; }
    boltMesh._had = nb > 0;
}


function addDecal(point, normal) {
    _q.setFromUnitVectors(_Z, normal);
    _q.multiply(new THREE.Quaternion().setFromAxisAngle(_Z, Math.random() * 6.28));
    const s = 0.13 + Math.random() * 0.06;
    _m4.compose(_p.copy(point).addScaledVector(normal, 0.012), _q, _s.set(s, s, s));
    decalMesh.setMatrixAt(decalIdx, _m4);
    decalMesh.instanceColor.setXYZ(decalIdx, 1, 1, 1);
    decalIdx = (decalIdx + 1) % DMAX;
    decalCount = Math.min(DMAX, decalCount + 1);
    decalMesh.count = decalCount;
    decalMesh.instanceMatrix.needsUpdate = true; decalMesh.instanceColor.needsUpdate = true;
}
function clearDecals() { decalIdx = 0; decalCount = 0; if (decalMesh) decalMesh.count = 0; }


// Blob shadows under enemies, only used when real shadows are off (Low quality)
function updateBlobs() {
    if (!blobMesh.visible) return;
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
    blobMesh.instanceMatrix.needsUpdate = true; blobMesh.instanceColor.needsUpdate = true;
}


// Explosions: small pool of fireball + shock ring meshes that get reused
const explosionPool = [], explosions = [];
const _ballGeo = new THREE.SphereGeometry(1, 16, 12), _ringGeo = new THREE.RingGeometry(0.8, 1, 40);
function getExplosionFx() {
    let fx = explosionPool.find(f => !f.active);
    if (!fx) {
        const ball = new THREE.Mesh(_ballGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        const ring = new THREE.Mesh(_ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2;
        fx = { ball, ring, active: false };
        explosionPool.push(fx);
    }
    return fx;
}
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
    fx.ring.position.set(pos.x, Math.max(0.1, groundAt(pos.x, pos.z, 0, pos.y) + 0.08), pos.z);
    scene.add(fx.ball, fx.ring);
    explosions.push(fx);
}
function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
        const ex = explosions[i]; ex.t += dt;
        const k = ex.t / ex.dur;
        if (k >= 1) { scene.remove(ex.ball, ex.ring); ex.active = false; explosions.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - k, 3);
        ex.ball.scale.setScalar(0.5 + e * ex.radius * 0.55); ex.ball.material.opacity = (ex.peak || 0.9) * (1 - k);
        ex.ring.scale.setScalar(0.5 + e * ex.radius); ex.ring.material.opacity = (ex.ringOnly ? 0.9 : 0.7) * (1 - k);
    }
    for (const bl of boomLights) { if (bl.t > 0) { bl.t -= dt * 2.2; bl.light.intensity = (bl.peak || 900) * Math.max(0, bl.t); } }
}


const _proj = new V3();
// Damage numbers are a small pool of reused elements (no DOM churn during firefights)
const dmgPool = [];
const DMG_ANIM = [{ opacity: 1, transform: 'translate(-50%, -50%)' }, { opacity: 0, transform: 'translate(-50%, calc(-50% - 60px))' }];
function spawnDamageNumber(worldPos, text, cls) {
    _proj.copy(worldPos).project(camera);
    if (_proj.z > 1 || _proj.z < -1) return;
    let el = dmgPool.find(e => !e._busy);
    if (!el) { if (dmgPool.length >= 32) return; el = document.createElement('div'); ui.dmgLayer.appendChild(el); dmgPool.push(el); }
    el._busy = true;
    el.className = 'dmg-num ' + (cls || '');
    el.textContent = text;
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
