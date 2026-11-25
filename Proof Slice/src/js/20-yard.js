// ============================================================
// The Yard: one small map (lightmapped), one gun (first person), one enemy (GPU-skinned, many copies in one draw call).
// Collision, bullets and enemy paths all read the exporter's collision map (per column: what heights are solid).
// ============================================================
const Yard = App.modes.yard = { title: 'the Yard', loaded: false, enemies: [], wave: 0, kills: 0 };
const YD = { eye: 1.65, radius: 0.34, walk: 3.6, run: 5.6, fireGap: 0.1, mag: 30, reload: 1.7, seat: 1.0, seatAt: 0.66, sightDrop: 0.0204, hip: [0.17, -0.175, -0.29], adsZ: -0.13, fov: 72, adsFov: 50, gunFov: 50, adsGunFov: 36, maxAlive: 28, demoEnemies: 24 };

Yard.load = async function () {
    const A = Yard.A = await HG3D.load(Q.get('yard') || BASE + 'assets/yard.hgm', { anisotropy: +Q.get('aniso') || 4 }), J = A.json;
    const scene = Yard.scene = HG3D.node(); scene.add(A.scene);
    Yard.exposure = atmosphere(A, scene, 35, 220);
    Yard.rig = lightRig(scene); if (J.sun) Yard.rig.set(J.sun.dir, J.sun.color);
    Yard.camera = HG3D.camera(72, innerWidth / innerHeight, 0.08, 600);
    // ---- the gun: its own tiny scene drawn over the world, so it never pokes through a wall
    const gs = Yard.gunScene = HG3D.node(); gs.fog = scene.fog; Yard.gunRig = lightRig(gs); Yard.gunCam = HG3D.camera(50, innerWidth / innerHeight, 0.03, 10);
    Yard.gunCam.lookFrom(0, 0, 0, 0, 0, -1);
    // arms, hands and gun are one animated model ("viewmodel": pieces vm_arms + vm_gun, clips vm_idle/fire/reload/draw/run);
    // an asset file without it still shows the bare gun parts
    const vm = Yard.vm = A.skins.viewmodel ? A.crowd('viewmodel', 1) : null;
    if (vm) { for (const m of vm.node.children) m.frustumCulled = false; const c = vm.clips.vm_reload; if (c) { YD.reload = c.count / c.fps; YD.seat = YD.reload * YD.seatAt; } }
    const gun = Yard.gun = vm ? vm.node : A.objects.gun || null; Yard.mag = vm ? null : A.objects.gun_mag || null; Yard.gunMats = []; Yard.muzzle = [0, 0.05, -0.5]; Yard.sight = [0, 0.09];
    if (gun) {
        gs.add(gun); let zMin = 1e9; const gm = vm ? gun.children.filter(m => m.name === 'vm_gun') : gun.children.filter(m => m.isMesh); const each = (n, f) => { if (n.isMesh) f(n); for (const c of n.children) each(c, f); };
        each(gun, m => { if (m.material.probe && Yard.gunMats.indexOf(m.material) < 0) Yard.gunMats.push(m.material); });
        for (const m of gm) { const p = m.geometry.attributes.position.array; for (let i = 2; i < p.length; i += 3) if (p[i] < zMin) zMin = p[i]; }
        let sx = 0, sy = 0, n = 0; for (const m of gm) { const p = m.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) if (p[i + 2] < zMin + 0.02) { sx += p[i]; sy += p[i + 1]; n++; } }
        if (n) Yard.muzzle = [sx / n, sy / n, zMin - 0.03];
        // the optic is the highest thing on the gun: aiming down the sight puts its middle on the middle of the screen
        let yMax = -1e9, ox = 0, on = 0; for (const m of gm) { const p = m.geometry.attributes.position.array; for (let i = 1; i < p.length; i += 3) if (p[i] > yMax) yMax = p[i]; }
        for (const m of gm) { const p = m.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) if (p[i + 1] > yMax - 0.03) { ox += p[i]; on++; } }
        if (on) Yard.sight = [ox / on, yMax - YD.sightDrop];
    }
    const quad = quadGeo();
    const glow = blobTexture(64, [[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,190,90,.8)'], [0.6, 'rgba(255,120,30,.25)'], [1, 'rgba(255,90,0,0)']], true);
    const addMat = () => HG3D.material({ lit: false, map: glow, transparent: true, blending: 2, depthWrite: false, fog: false, side: 2 });
    Yard.flash = HG3D.mesh(quad, addMat()); Yard.flash.visible = false; Yard.flash.frustumCulled = false; gs.add(Yard.flash);
    // spent casings: thrown out to the right on every shot, they fall, bounce and lie there for a while (one draw call)
    Yard.brass = HG3D.instanced(HG3D.geo.box(0.011, 0.011, 0.042), HG3D.material({ color: 0x8a6a2a }), 24); Yard.brass.frustumCulled = false; Yard.brass.count = 0; Yard.brass.list = []; scene.add(Yard.brass);
    Yard.sparks = []; for (let i = 0; i < 8; i++) { const s = HG3D.mesh(quad, addMat()); s.visible = false; s.frustumCulled = false; s.t = 0; scene.add(s); Yard.sparks.push(s); }
    // ---- the enemies and the soft shadows under them
    Yard.crowd = A.skins.enemy ? A.crowd('enemy', 48) : null; if (Yard.crowd) scene.add(Yard.crowd.node);
    // each figure darkens the ground twice: a small patch at its feet, and a long one away from the sun (only where the
    // baked light says the sun reaches it). One instanced mesh, multiplied onto the picture; aFade = how dark.
    const shTex = blobTexture(64, [[0, '#303030'], [0.5, '#4c4c4c'], [0.8, '#b4b4b4'], [1, '#ffffff']], true), shGeo = HG3D.geo.plane(1, 1); shGeo.attributes.aFade = HG3D.attr(new Float32Array(96), 1, true);
    const shHook = { key: 'proof-shade', vDecl: 'in float aFade; out float vFade;', vMain: ' vFade = aFade;', fDecl: 'in float vFade;', fAlbedo: ' alb = mix(vec3(1.0), alb, vFade);' };
    const sh = Yard.shadows = HG3D.instanced(shGeo, HG3D.material({ lit: false, map: shTex, transparent: true, blending: 4, depthWrite: false, fog: false, toneMapped: false, hg: shHook }), 96); scene.add(sh);
    const sd = J.sun ? J.sun.dir : [0, 1, 0], sl = Math.hypot(sd[0], sd[2]) || 1; Yard.shDir = [-sd[0] / sl, -sd[2] / sl, Math.min(2.6, sd[1] > 0.05 ? sl / sd[1] : 2.6)];        // which way shadows fall, and how long per metre of height
    // ---- what is solid: the collision map, and a coarser grid the enemies find their way on
    const G = Yard.G = J.grid, d = Yard.cols = A.view(G.data), nx = G.nx, nz = G.nz, blk = Yard.blk = new Uint8Array(nx * nz);
    for (let i = 0; i < nx * nz; i++) blk[i] = (d[i * 4 + 1] * G.q > 0.45 || (d[i * 4 + 3] > 0 && d[i * 4 + 2] * G.q < 1.85)) ? 1 : 0;
    const NX = Yard.NX = nx >> 1, NZ = Yard.NZ = nz >> 1, nav = Yard.nav = new Uint8Array(NX * NZ);
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) nav[z * NX + x] = (blk[z * 2 * nx + x * 2] | blk[z * 2 * nx + x * 2 + 1] | blk[(z * 2 + 1) * nx + x * 2] | blk[(z * 2 + 1) * nx + x * 2 + 1]) || x < 2 || z < 2 || x > NX - 3 || z > NZ - 3 ? 1 : 0;
    Yard.dist = new Int16Array(NX * NZ); Yard.queue = new Int32Array(NX * NZ);
    // a free spot near the middle to start from, and a round trip for the speed test
    const B = J.bounds, cx = (B.min[0] + B.max[0]) / 2, cz = (B.min[2] + B.max[2]) / 2, r = Math.min(B.max[0] - B.min[0], B.max[2] - B.min[2]) * 0.3;
    Yard.home = yardFree(cx, cz); Yard.tour = [];
    let prev = null; const stops = []; for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI * 2; stops.push(yardFree(cx + Math.cos(a) * r, cz + Math.sin(a) * r)); }
    for (const s of stops) { if (prev) { yardFlow(s[0], s[1]); let c = yardCell(prev[0], prev[1]), guard = 0; while (Yard.dist[c] > 0 && guard++ < 4000) { c = yardNext(c); Yard.tour.push([G.x0 + (c % NX + 0.5) * G.cell * 2, G.z0 + ((c / NX | 0) + 0.5) * G.cell * 2]); } } prev = s; }
    Yard.resize(innerWidth / innerHeight);
};
Yard.resize = a => { if (!Yard.camera) return; Yard.camera.aspect = a; Yard.camera.updateProjection(); Yard.gunCam.aspect = a; Yard.gunCam.updateProjection(); };

// ---- the collision map
function yardBlocked(x, z, r) {
    const G = Yard.G, c = G.cell, nx = G.nx, x0 = Math.floor((x - r - G.x0) / c), x1 = Math.floor((x + r - G.x0) / c), z0 = Math.floor((z - r - G.z0) / c), z1 = Math.floor((z + r - G.z0) / c);
    if (x0 < 0 || z0 < 0 || x1 >= nx || z1 >= G.nz) return true;
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) if (Yard.blk[iz * nx + ix]) {
        const qx = clamp(x, G.x0 + ix * c, G.x0 + (ix + 1) * c) - x, qz = clamp(z, G.z0 + iz * c, G.z0 + (iz + 1) * c) - z; if (qx * qx + qz * qz < r * r) return true;
    }
    return false;
}
// how far a ray goes before it meets something solid (the direction is one unit long)
function yardRay(ox, oy, oz, dx, dy, dz, max) {
    const G = Yard.G, d = Yard.cols, q = G.q, step = G.cell * 0.5, nx = G.nx, nz = G.nz;
    for (let t = 0.15; t < max; t += step) {
        const y = oy + dy * t; if (y <= 0) return t;
        const ix = Math.floor((ox + dx * t - G.x0) / G.cell), iz = Math.floor((oz + dz * t - G.z0) / G.cell); if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
        const i = (iz * nx + ix) * 4;
        if (d[i + 1] > 0 && y >= d[i] * q && y <= d[i + 1] * q) return t;
        if (d[i + 3] > 0 && y >= d[i + 2] * q && y <= d[i + 3] * q) return t;
    }
    return max;
}
function yardCell(x, z) { const G = Yard.G; return clamp(Math.floor((z - G.z0) / (G.cell * 2)), 0, Yard.NZ - 1) * Yard.NX + clamp(Math.floor((x - G.x0) / (G.cell * 2)), 0, Yard.NX - 1); }
// the nearest free spot to a point (centre of a free path cell)
function yardFree(x, z) {
    const G = Yard.G, NX = Yard.NX, NZ = Yard.NZ, c0 = yardCell(x, z), x0 = c0 % NX, z0 = c0 / NX | 0;
    for (let r = 0; r < 40; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const cx = x0 + dx, cz = z0 + dz; if (cx < 0 || cz < 0 || cx >= NX || cz >= NZ || Yard.nav[cz * NX + cx]) continue;
        return [G.x0 + (cx + 0.5) * G.cell * 2, G.z0 + (cz + 0.5) * G.cell * 2];
    }
    return [x, z];
}
// steps to a goal from every free cell (breadth first); enemies walk downhill on it
function yardFlow(gx, gz) {
    const NX = Yard.NX, NZ = Yard.NZ, nav = Yard.nav, dist = Yard.dist, q = Yard.queue; dist.fill(-1);
    const g = yardFree(gx, gz), c0 = yardCell(g[0], g[1]); let h = 0, t = 0; dist[c0] = 0; q[t++] = c0;
    while (h < t) {
        const c = q[h++], x = c % NX, z = c / NX | 0, n = dist[c] + 1;
        if (x > 0 && !nav[c - 1] && dist[c - 1] < 0) { dist[c - 1] = n; q[t++] = c - 1; }
        if (x < NX - 1 && !nav[c + 1] && dist[c + 1] < 0) { dist[c + 1] = n; q[t++] = c + 1; }
        if (z > 0 && !nav[c - NX] && dist[c - NX] < 0) { dist[c - NX] = n; q[t++] = c - NX; }
        if (z < NZ - 1 && !nav[c + NX] && dist[c + NX] < 0) { dist[c + NX] = n; q[t++] = c + NX; }
    }
    Yard.reach = t;
}
// the neighbour (8 ways, no cutting corners) that is closest to the goal
function yardNext(c) {
    const NX = Yard.NX, dist = Yard.dist, nav = Yard.nav, x = c % NX; let best = c, bd = dist[c] < 0 ? 32767 : dist[c] * 2;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const n = c + dz * NX + dx; if (x + dx < 0 || x + dx >= NX || n < 0 || n >= dist.length || dist[n] < 0) continue;
        if (dx && dz && (nav[c + dx] || nav[c + dz * NX])) continue;
        const v = dist[n] * 2 + (dx && dz ? 1 : 0); if (v < bd) { bd = v; best = n; }
    }
    return best;
}

// ---- play
Yard.start = function (demo) {
    const P = Yard.P = { x: Yard.home[0], z: Yard.home[1], yaw: 0, pitch: 0, hp: 100, ammo: YD.mag, reload: 0, cool: 0, kick: 0, bob: 0, hurt: 0, hitT: 0, dead: false, lastHurt: 0, flowT: 0, tourI: 0, light: new Float32Array(4), swayX: 0, swayY: 0, flashT: 0, ads: 0, bloom: 0, moving: 0, running: false, seated: false,
        vm: { cur: Yard.vm && Yard.vm.clips.vm_draw ? 'vm_draw' : 'vm_idle', t: 0, prev: '', pt: 0, fade: 0, fadeT: 0 } };
    Yard.enemies.length = 0; Yard.wave = 0; Yard.kills = 0; Yard.waveT = 1.5; Yard.time = 0; Yard.shots = 0; if (Yard.brass) { Yard.brass.list.length = 0; Yard.brass.count = 0; }
    if (demo && Yard.tour.length) { P.x = Yard.tour[0][0]; P.z = Yard.tour[0][1]; }
    yardFlow(P.x, P.z); Yard.hud(true); Yard.hint();
};
Yard.YD = YD;
Yard.stop = function () { $('msg').textContent = ''; $('hurt').style.opacity = 0; $('dot').style.opacity = 0; $('cross').style.opacity = ''; };
Yard.hint = function () { if (App.mode === Yard) $('msg').textContent = Yard.P.dead ? 'Overrun. Click to go again.' : (!App.locked && !App.demo ? 'Click to play' : ''); };
Yard.hud = function (all) {
    const P = Yard.P;
    if (all || P.hp !== Yard._hp) { Yard._hp = P.hp; $('hp').firstElementChild.style.width = Math.max(0, P.hp) + '%'; $('hp-n').textContent = Math.max(0, Math.ceil(P.hp)); }
    if (all || P.ammo !== Yard._ammo || (P.reload > 0) !== Yard._rl) { Yard._ammo = P.ammo; Yard._rl = P.reload > 0; $('ammo').textContent = P.reload > 0 ? '--' : P.ammo; }
    const top = 'WAVE ' + Yard.wave + '    KILLS ' + Yard.kills; if (top !== Yard._top) { Yard._top = top; $('hud-top').textContent = top; }
};
Yard.statLine = () => Yard.enemies.length + ' enemies';
function yardSpawn(n) {
    const NX = Yard.NX, G = Yard.G, dist = Yard.dist, far = [];
    for (let c = 0; c < dist.length; c++) if (dist[c] >= 26) far.push(c);
    if (!far.length) for (let c = 0; c < dist.length; c++) if (dist[c] >= 8) far.push(c);
    for (let i = 0; i < n && far.length && Yard.enemies.length < YD.maxAlive; i++) {
        const c = far[Math.random() * far.length | 0];
        Yard.enemies.push({ x: G.x0 + (c % NX + 0.5) * G.cell * 2, z: G.z0 + ((c / NX | 0) + 0.5) * G.cell * 2, yaw: Math.random() * 6.28, hp: 100, state: 'walk', t: Math.random() * 2, flash: 0, speed: 1.5 + Math.random() * 1.1 + Math.min(Yard.wave, 6) * 0.12, light: new Float32Array([1, 1, 1, 1]), hit: false, size: 0.96 + Math.random() * 0.1 });
    }
}
function yardFire(P, dx, dy, dz) {
    { const again = P.vm.cur === 'vm_fire'; vmPlay(P.vm, 'vm_fire', 0); if (again && Yard.vm) P.vm.t = 1 / Yard.vm.clips.vm_fire.fps; } P.ammo--; P.cool = YD.fireGap; P.kick = 1; P.flashT = 0.05; Yard.shots++; Snd.shot(0.5, 500, 0.16);
    Yard.flash.visible = true; Yard.flashRot = Math.random() * 6.28; P.bloom = Math.min(0.035, P.bloom + 0.006); yardBrass(P);
    const sp = lerp(0.02, 0.003, P.ads) + P.bloom * lerp(1, 0.35, P.ads) + P.moving * 0.02 * (1 - P.ads), ex = dx + (Math.random() - 0.5) * sp, ey = dy + (Math.random() - 0.5) * sp, ez = dz + (Math.random() - 0.5) * sp, l = Math.hypot(ex, ey, ez), ux = ex / l, uy = ey / l, uz = ez / l;
    let bt = yardRay(P.x, YD.eye, P.z, ux, uy, uz, 90), hit = null, head = false; const hl = ux * ux + uz * uz;
    if (hl > 1e-6) for (const e of Yard.enemies) {
        if (e.state === 'die') continue; const t = ((e.x - P.x) * ux + (e.z - P.z) * uz) / hl; if (t < 0 || t > bt) continue;
        const px = P.x + ux * t - e.x, pz = P.z + uz * t - e.z, y = YD.eye + uy * t; if (px * px + pz * pz < 0.36 * 0.36 && y > 0.05 && y < 1.92 * e.size) { bt = t - 0.3; hit = e; head = y > 1.5 * e.size; }
    }
    if (hit) { hit.hp -= head ? 100 : 34; hit.flash = 1; P.hitT = 0.12; Snd.tone(head ? 900 : 520, 0.12, 0.07, 'square'); if (hit.hp <= 0) { hit.state = 'die'; hit.t = 0; Yard.kills++; Snd.tone(110, 0.25, 0.35, 'sawtooth'); } }
    if (bt < 90) { const s = Yard.sparks[Yard.shots % Yard.sparks.length]; s.visible = true; s.t = 0.09; s.px = P.x + ux * bt; s.py = YD.eye + uy * bt; s.pz = P.z + uz * bt; s.size = hit ? 0.35 : 0.5; }
}
// ---- the arms and gun: which clip is playing, with a short fade when one clip gives way to another
function vmPlay(V, name, fade) { if (!Yard.vm || !Yard.vm.clips[name]) return; V.prev = V.cur; V.pt = V.t; V.cur = name; V.t = 0; V.fadeT = V.fade = fade || 0; }
const VF = [0, 0, 0];
function vmPose(V, out) {       // out = [a frame, a second frame, how much of the second]
    const C = Yard.vm.clips, A = Yard.A, c = C[V.cur] || C.vm_idle;
    if (V.fade > 0 && C[V.prev]) { const k = 1 - V.fade / V.fadeT; out[0] = A.frame(C[V.prev], V.pt); out[1] = A.frame(c, V.t); out[2] = k * k * (3 - 2 * k); }
    else A.frame2(c, V.t, out);
    return out;
}
function yardBrass(P) {         // one spent casing, out of the right side of the gun
    const B = Yard.brass, c = Yard.camera.matrixWorld.elements, L = B.list; if (L.length >= 24) L.shift();
    const r = 1.3 + Math.random() * 0.9, u = 1.2 + Math.random() * 0.8, k = Math.random() * 0.6 - 0.1, side = lerp(0.2, 0.09, P.ads), low = lerp(0.2, 0.1, P.ads);
    L.push({ x: c[12] + c[0] * side - c[4] * low - c[8] * 0.42, y: c[13] + c[1] * side - c[5] * low - c[9] * 0.42, z: c[14] + c[2] * side - c[6] * low - c[10] * 0.42,
        vx: c[0] * r + c[4] * u + c[8] * k, vy: c[1] * r + c[5] * u + c[9] * k, vz: c[2] * r + c[6] * u + c[10] * k, a: Math.random() * 6.28, b: Math.random() * 6.28, spin: 14 + Math.random() * 12, t: 0, rest: false });
}
function yardBrassStep(dt) {
    const B = Yard.brass, L = B.list, e = B.instanceMatrix.array; let n = 0;
    for (let i = L.length - 1; i >= 0; i--) { const c = L[i]; c.t += dt; if (c.t > 6) { L.splice(i, 1); continue; }
        if (!c.rest) { c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.a += c.spin * dt; c.b += c.spin * 0.7 * dt;
            if (yardBlocked(c.x, c.z, 0.03)) { c.x -= c.vx * dt; c.z -= c.vz * dt; c.vx *= -0.3; c.vz *= -0.3; }
            if (c.y < 0.012) { c.y = 0.012; if (Math.abs(c.vy) > 1) { c.vy *= -0.35; c.vx *= 0.5; c.vz *= 0.5; c.spin *= 0.5; Snd.tone(2600 + Math.random() * 900, 0.03, 0.015, 'triangle'); } else { c.rest = true; c.b = 0; } } }
    }
    for (const c of L) { const o = n++ * 16, ca = Math.cos(c.a), sa = Math.sin(c.a), cb = Math.cos(c.b), sb = Math.sin(c.b), k = c.t > 5 ? 6 - c.t : 1;       // turn about the up axis, tumble, shrink away at the end
        e[o] = ca * k; e[o + 1] = 0; e[o + 2] = -sa * k; e[o + 3] = 0; e[o + 4] = sa * sb * k; e[o + 5] = cb * k; e[o + 6] = ca * sb * k; e[o + 7] = 0; e[o + 8] = sa * cb * k; e[o + 9] = -sb * k; e[o + 10] = ca * cb * k; e[o + 11] = 0; e[o + 12] = c.x; e[o + 13] = c.y; e[o + 14] = c.z; e[o + 15] = 1; }
    B.count = n; B.instanceMatrix.needsUpdate = true;
}
function yardReload(P) { P.reload = YD.reload; P.seated = false; Snd.tone(300, 0.1, 0.08, 'square'); vmPlay(P.vm, 'vm_reload', 0.1); }
Yard.update = function (dt) {
    const P = Yard.P, A = Yard.A; Yard.time += dt;
    // ---- the player (or the speed test's stand-in walking the round trip)
    let mx = 0, mz = 0, fire = false, run = false;
    if (App.demo) {
        const T = Yard.tour; if (T.length) {
            let tgt = T[P.tourI % T.length]; if (Math.hypot(tgt[0] - P.x, tgt[1] - P.z) < 0.6) { P.tourI++; tgt = T[P.tourI % T.length]; }
            const a = Math.atan2(tgt[0] - P.x, tgt[1] - P.z); let look = a, near = null, nd = 22;
            for (const e of Yard.enemies) { if (e.state === 'die') continue; const dd = Math.hypot(e.x - P.x, e.z - P.z); if (dd < nd) { nd = dd; near = e; } }
            if (near) { look = Math.atan2(near.x - P.x, near.z - P.z); fire = true; }
            let dy = look - P.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; P.yaw += dy * Math.min(1, dt * 5); if (Math.abs(dy) > 0.12) fire = false;
            P.pitch = lerp(P.pitch, near ? Math.atan2(1.1 - YD.eye, Math.max(1, nd)) : -0.04, Math.min(1, dt * 5));
            const sp = YD.walk * dt, nxp = P.x + Math.sin(a) * sp, nzp = P.z + Math.cos(a) * sp; P.x = nxp; P.z = nzp; P.bob += sp;
            P.hp = 100;
        }
    } else if (!P.dead) {
        const sens = 0.0023 * lerp(1, YD.adsFov / YD.fov, P.ads); P.yaw -= mouse.dx * sens; P.pitch = clamp(P.pitch - mouse.dy * sens, -1.45, 1.45);
        P.ads = lerp(P.ads, mouse.right && P.reload <= 0 && !(keys.ShiftLeft || keys.ShiftRight) ? 1 : 0, Math.min(1, dt * 13)); if (P.ads < 0.002) P.ads = 0;
        P.swayX = lerp(P.swayX, clamp(mouse.dx * 0.0006, -0.03, 0.03), Math.min(1, dt * 10)); P.swayY = lerp(P.swayY, clamp(mouse.dy * 0.0006, -0.03, 0.03), Math.min(1, dt * 10));
        const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        run = !!(keys.ShiftLeft || keys.ShiftRight) && f > 0;
        if (f || s) { const l = Math.hypot(f, s), sp = (run ? YD.run : YD.walk) * dt / l, sn = Math.sin(P.yaw), cs = Math.cos(P.yaw); mx = (-sn * f + cs * s) * sp; mz = (-cs * f - sn * s) * sp; }
        if (mx && !yardBlocked(P.x + mx, P.z, YD.radius)) P.x += mx; if (mz && !yardBlocked(P.x, P.z + mz, YD.radius)) P.z += mz;
        if (mx || mz) P.bob += Math.hypot(mx, mz); P.running = !!(run && (mx || mz)); P.moving = lerp(P.moving, mx || mz ? (run ? 1.6 : 1) : 0, Math.min(1, dt * 8));
        fire = mouse.down && App.locked && !run;
        if (keys.KeyR && P.reload <= 0 && P.ammo < YD.mag) { yardReload(P); }
    } else if (mouse.fired) { Yard.start(false); return; }
    // ---- the gun
    P.cool -= dt; P.kick = Math.max(0, P.kick - dt * 9); P.bloom = Math.max(0, P.bloom - dt * 0.07); yardBrassStep(dt); P.flashT -= dt; if (P.flashT <= 0) Yard.flash.visible = false;
    if (P.reload > 0) { P.reload -= dt; if (!P.seated && YD.reload - P.reload >= YD.seat) { P.seated = true; Snd.tone(170, 0.05, 0.12, 'square'); } if (P.reload <= 0) { P.ammo = YD.mag; Snd.tone(420, 0.1, 0.06, 'square'); } }
    else if (P.ammo <= 0 && !P.dead) { yardReload(P); }
    if (Yard.vm) { const V = P.vm, c = Yard.vm.clips[V.cur]; V.t += dt; V.fade = Math.max(0, V.fade - dt);
        if (V.cur === 'vm_fire' && mouse.down && P.ammo > 0 && !P.dead) V.t = Math.min(V.t, 2 / c.fps);
        const busy = c && !c.loop && V.t < c.count / c.fps, want = P.running && !P.dead ? 'vm_run' : 'vm_idle';
        if (!busy && V.cur !== want) vmPlay(V, want, V.cur === 'vm_fire' ? 0.1 : 0.2); }
    const cp = Math.cos(P.pitch), dirx = App.demo ? Math.sin(P.yaw) * cp : -Math.sin(P.yaw) * cp, diry = Math.sin(P.pitch), dirz = App.demo ? Math.cos(P.yaw) * cp : -Math.cos(P.yaw) * cp;
    Yard.dir = [dirx, diry, dirz];
    if (fire && P.cool <= 0 && P.reload <= 0 && P.ammo > 0 && !P.dead) { yardFire(P, dirx, diry, dirz); if (!App.demo) { P.pitch = Math.min(1.45, P.pitch + lerp(0.008, 0.005, P.ads)); P.yaw += (Math.random() - 0.5) * lerp(0.007, 0.003, P.ads); } }
    // ---- enemies
    P.flowT -= dt; if (P.flowT <= 0) { P.flowT = 0.35; yardFlow(P.x, P.z); }
    const E = Yard.enemies, G = Yard.G, NX = Yard.NX, cl = Yard.crowd ? Yard.crowd.clips : {}, dieLen = cl.die ? cl.die.count / cl.die.fps : 1, atkLen = cl.attack ? cl.attack.count / cl.attack.fps : 0.8;
    if (App.demo) { if (E.length < YD.demoEnemies) yardSpawn(YD.demoEnemies - E.length); }
    else if (!E.length) { Yard.waveT -= dt; if (Yard.waveT <= 0) { Yard.wave++; yardSpawn(5 + Yard.wave * 3); Yard.waveT = 3; } }
    for (let i = E.length - 1; i >= 0; i--) {
        const e = E[i]; e.t += dt; e.flash = Math.max(0, e.flash - dt * 6);
        if (e.state === 'die') { if (e.t > dieLen + 3) { E[i] = E[E.length - 1]; E.pop(); } continue; }
        const px = P.x - e.x, pz = P.z - e.z, pd = Math.hypot(px, pz);
        if (e.state === 'attack') {
            if (!e.hit && e.t > atkLen * 0.45) { e.hit = true; if (pd < 1.9 && !P.dead && !App.demo) { P.hp -= 8; P.hurt = 1; P.lastHurt = Yard.time; Snd.shot(0.4, 160, 0.2); if (P.hp <= 0) { P.dead = true; Yard.hint(); } } }
            if (e.t > atkLen) { e.state = 'walk'; e.t = 0; }
        } else if (pd < 1.35 && !P.dead) { e.state = 'attack'; e.t = 0; e.hit = false; }
        let tx = px, tz = pz;
        if (pd > 2.2) { const c = yardCell(e.x, e.z), n = yardNext(c); if (n !== c) { tx = G.x0 + (n % NX + 0.5) * G.cell * 2 - e.x; tz = G.z0 + ((n / NX | 0) + 0.5) * G.cell * 2 - e.z; } }
        const want = Math.atan2(tx, tz); let dy = want - e.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; e.yaw += dy * Math.min(1, dt * 7);
        if (e.state === 'walk' && pd > 1.0) { const sp = e.speed * dt, sx = Math.sin(e.yaw) * sp, sz = Math.cos(e.yaw) * sp; if (!yardBlocked(e.x + sx, e.z, 0.28)) e.x += sx; if (!yardBlocked(e.x, e.z + sz, 0.28)) e.z += sz; }
    }
    for (let i = 0; i < E.length; i++) { const a = E[i]; if (a.state === 'die') continue; for (let j = i + 1; j < E.length; j++) { const b = E[j]; if (b.state === 'die') continue; const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz; if (d2 < 0.49 && d2 > 1e-6) { const d = Math.sqrt(d2), k = (0.7 - d) * 0.5 / d, ox = dx * k, oz = dz * k; if (!yardBlocked(a.x - ox, a.z - oz, 0.28)) { a.x -= ox; a.z -= oz; } if (!yardBlocked(b.x + ox, b.z + oz, 0.28)) { b.x += ox; b.z += oz; } } } }
    // ---- feedback
    if (!P.dead && Yard.time - P.lastHurt > 5 && P.hp < 100) P.hp = Math.min(100, P.hp + dt * 6);
    P.hurt = Math.max(0, P.hurt - dt * 1.5); P.hitT = Math.max(0, P.hitT - dt);
    $('hurt').style.opacity = P.dead ? 0.8 : P.hurt * 0.8; $('hit').style.opacity = P.hitT > 0 ? 1 : 0;
    Yard.hud(false);
};
const YQ = new Float32Array(4);
function quatEuler(x, y, z) { const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2); YQ[0] = s1 * c2 * c3 + c1 * s2 * s3; YQ[1] = c1 * s2 * c3 - s1 * c2 * s3; YQ[2] = c1 * c2 * s3 + s1 * s2 * c3; YQ[3] = c1 * c2 * c3 - s1 * s2 * s3; return YQ; }
const YM = new Float32Array(16);
Yard.render = function () {
    const P = Yard.P, A = Yard.A, cam = Yard.camera, d = Yard.dir, bobY = Math.sin(P.bob * 3.4) * 0.025;
    cam.lookFrom(P.x, YD.eye + bobY, P.z, P.x + d[0], YD.eye + bobY + d[1], P.z + d[2]);
    const cw = cam.matrixWorld.elements; skyFollow(Yard.scene, cw);
    // enemies: one instance each, nearest detail level by distance, lit by the baked light where they stand
    const C = Yard.crowd, sh = Yard.shadows, sm = sh.instanceMatrix.array, sf = sh.geometry.attributes.aFade.array, sdir = Yard.shDir, dieLen = C && C.clips.die ? C.clips.die.count / C.clips.die.fps : 1; let ns = 0;
    const blob = (x, z, ax, az, w, len, fade) => { const o = ns * 16; sm[o] = az * w; sm[o + 1] = 0; sm[o + 2] = -ax * w; sm[o + 3] = 0; sm[o + 4] = 0; sm[o + 5] = 1; sm[o + 6] = 0; sm[o + 7] = 0; sm[o + 8] = ax * len; sm[o + 9] = 0; sm[o + 10] = az * len; sm[o + 11] = 0; sm[o + 12] = x; sm[o + 13] = 0.03; sm[o + 14] = z; sm[o + 15] = 1; sf[ns++] = fade; };
    if (C) {
        C.begin(); const cl = C.clips, any = cl.walk || cl.idle || cl[Object.keys(cl)[0]];
        for (const e of Yard.enemies) {
            const clip = e.state === 'die' ? (cl.die || any) : e.state === 'attack' ? (cl.attack || any) : (cl.walk || any);
            A.probe(e.x, e.z, e.light);
            C.add(e.x, 0, e.z, e.yaw, e.size, A.frame(clip, e.state === 'walk' ? e.t * e.speed / 1.6 : e.t), e.light, e.flash * 0.6, Math.hypot(e.x - P.x, e.z - P.z));
            if (ns < 94) { const up = e.state === 'die' ? Math.max(0.25, 1 - e.t / dieLen) : 1, len = 1.75 * e.size * up * sdir[2] + 0.5;
                blob(e.x, e.z, 1, 0, 1.0, 1.0, 0.6);
                if (e.light[3] > 0.08) blob(e.x + sdir[0] * (len * 0.5 - 0.25), e.z + sdir[1] * (len * 0.5 - 0.25), sdir[0], sdir[1], 0.85, len, e.light[3] * 0.95); }
        }
        C.end();
    }
    sh.count = ns; if (ns) { sh.instanceMatrix.needsUpdate = true; sh.geometry.attributes.aFade.needsUpdate = true; }
    for (const s of Yard.sparks) { if (!s.visible) continue; s.t -= 1 / 60; if (s.t <= 0) { s.visible = false; continue; } const e = s.matrixWorld.elements, k = s.size * (0.6 + s.t * 6); e[0] = cw[0] * k; e[1] = cw[1] * k; e[2] = cw[2] * k; e[4] = cw[4] * k; e[5] = cw[5] * k; e[6] = cw[6] * k; e[8] = cw[8]; e[9] = cw[9]; e[10] = cw[10]; e[12] = s.px; e[13] = s.py; e[14] = s.pz; }
    draw(Yard.scene, cam, true);
    // the gun, in the camera's own space: lights turned into that space, brightness from the baked light at the player's feet
    if (Yard.gun) {
        const v = cam.matrixWorldInverse.elements, J = A.json, sd = J.sun ? J.sun.dir : [0, 1, 0];
        Yard.gunRig.set([v[0] * sd[0] + v[4] * sd[1] + v[8] * sd[2], v[1] * sd[0] + v[5] * sd[1] + v[9] * sd[2], v[2] * sd[0] + v[6] * sd[1] + v[10] * sd[2]], J.sun ? J.sun.color : null);
        Yard.gunRig.up(v[4], v[5], v[6]);
        A.probe(P.x, P.z, P.light); for (const m of Yard.gunMats) m.probe.set(P.light);
        const rl = Yard.vm ? 0 : P.reload > 0 ? Math.sin(Math.min(1, (YD.reload - P.reload) / YD.reload) * Math.PI) : 0, bob = Math.sin(P.bob * 3.4), bob2 = Math.cos(P.bob * 1.7);
        const ad = P.ads * P.ads * (3 - 2 * P.ads), loose = 1 - ad * 0.8, S = Yard.sight;        // aiming: the sight comes to the eye and everything steadies
        const q = quatEuler(P.kick * 0.05 * (1 - ad * 0.6) - P.swayY * loose - rl * 0.5, 0.035 * (1 - ad) + P.swayX * loose + rl * 0.25, rl * -0.35);
        M4.compose(YM, lerp(YD.hip[0], -S[0] * 0.9, ad) + (bob2 * 0.006 + P.swayX * 0.5) * loose, lerp(YD.hip[1], -S[1] * 0.9, ad) + (bob * 0.006 + P.swayY * 0.5) * loose - rl * 0.1, lerp(YD.hip[2], YD.adsZ, ad) + P.kick * 0.045 * (1 - ad * 0.5), q[0], q[1], q[2], q[3], 0.9, 0.9, 0.9);
        const f1 = lerp(YD.fov, YD.adsFov, ad), f2 = lerp(YD.gunFov, YD.adsGunFov, ad); if (cam.fov !== f1) { cam.fov = f1; cam.updateProjection(); Yard.gunCam.fov = f2; Yard.gunCam.updateProjection(); $('cross').style.opacity = ad > 0.5 ? 0 : ''; $('dot').style.opacity = ad > 0.9 ? 1 : 0; }
        if (Yard.mag) { M4.copy(Yard.mag.local, Yard.mag.rest); Yard.mag.local[13] -= rl > 0.55 ? (rl - 0.55) * 0.6 : 0; }
        if (Yard.vm) { const fr = vmPose(P.vm, VF); Yard.vm.begin(); Yard.vm.add(0, 0, 0, 0, 1, fr[0], P.light, 0, 0, fr[1], fr[2]); Yard.vm.end(); }
        HG3D.place(Yard.gun, YM);
        if (Yard.flash.visible) { const m = Yard.muzzle, e = Yard.flash.matrixWorld.elements, s = 0.22 + Math.random() * 0.1, c = Math.cos(Yard.flashRot) * s, sn = Math.sin(Yard.flashRot) * s, g = Yard.gun.matrixWorld.elements;
            e[0] = c; e[1] = sn; e[2] = 0; e[4] = -sn; e[5] = c; e[6] = 0; e[8] = 0; e[9] = 0; e[10] = 1; e[12] = g[0] * m[0] + g[4] * m[1] + g[8] * m[2] + g[12]; e[13] = g[1] * m[0] + g[5] * m[1] + g[9] * m[2] + g[13]; e[14] = g[2] * m[0] + g[6] * m[1] + g[10] * m[2] + g[14]; }
        R.clearDepth(); draw(Yard.gunScene, Yard.gunCam, false);
    }
};
window.__proof.yard = { blocked: yardBlocked, ray: yardRay, fire: yardFire, flow: yardFlow };
