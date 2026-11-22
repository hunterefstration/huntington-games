// ============================================================
// The Range: one tank (hull > turret > barrel, two detail levels) on one terrain tile whose colour and light were baked
// in Blender. The tank sits on the exporter's height map (ground), is stopped by what stands on it (tops - ground),
// and takes its brightness from the baked light where it stands.
// ============================================================
const Tank = App.modes.tank = { title: 'the Range', loaded: false, fired: 0, hits: 0 };
const TD = { max: 13, rev: 6, accel: 5.5, turn: 0.95, slew: 0.9, reload: 2.4, shell: 150, camDist: 11, lodFar: 45 };

// soft puffs (smoke, dust, flashes): all of one kind in one draw call, each facing the camera, each with its own fade
function puffs(scene, max, tex, additive) {
    const g = HG3D.geo.plane(1, 1); g.attributes.aFade = HG3D.attr(new Float32Array(max), 1, true);
    const hook = { key: 'proof-puff', vDecl: 'in float aFade; out float vFade;', vMain: ' vFade = aFade;', fDecl: 'in float vFade;', fAlbedo: ' alpha *= vFade;' };
    const m = HG3D.instanced(g, HG3D.material({ lit: false, map: tex, transparent: true, blending: additive ? 2 : 1, depthWrite: false, side: 2, fog: !additive, hg: hook }), max, { colors: true });
    m.renderOrder = additive ? 2 : 1; scene.add(m);
    const P = { mesh: m, list: [], max };
    P.add = (x, y, z, vx, vy, vz, size, grow, life, r, g2, b, a) => { if (P.list.length >= max) P.list.shift(); P.list.push({ x, y, z, vx, vy, vz, size, grow, life, t: 0, r, g: g2, b, a: a === undefined ? 1 : a }); };
    P.update = (dt, cw) => {
        const L = P.list, e = m.instanceMatrix.array, c = m.instanceColor.array, f = g.attributes.aFade.array; let n = 0;
        for (let i = 0; i < L.length; i++) {
            const p = L[i]; p.t += dt; if (p.t >= p.life) continue; L[n] = p;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
            const s = p.size + p.grow * p.t, o = n * 16, k = p.t / p.life;
            // the plane lies flat (x, z): its x goes along the camera's right, its z along the camera's up
            e[o] = cw[0] * s; e[o + 1] = cw[1] * s; e[o + 2] = cw[2] * s; e[o + 3] = 0; e[o + 4] = cw[8]; e[o + 5] = cw[9]; e[o + 6] = cw[10]; e[o + 7] = 0; e[o + 8] = -cw[4] * s; e[o + 9] = -cw[5] * s; e[o + 10] = -cw[6] * s; e[o + 11] = 0; e[o + 12] = p.x; e[o + 13] = p.y; e[o + 14] = p.z; e[o + 15] = 1;
            c[n * 3] = p.r; c[n * 3 + 1] = p.g; c[n * 3 + 2] = p.b; f[n] = p.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85); n++;
        }
        L.length = n; m.count = n; if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; g.attributes.aFade.needsUpdate = true; }
    };
    return P;
}

Tank.load = async function () {
    const A = Tank.A = await HG3D.load(Q.get('tank') || BASE + 'assets/range.hgm', { anisotropy: +Q.get('aniso') || 4 }), J = A.json;
    const scene = Tank.scene = HG3D.node(); scene.add(A.scene);
    Tank.exposure = atmosphere(A, scene, 140, 800, 0.85);
    Tank.rig = lightRig(scene); if (J.sun) Tank.rig.set(J.sun.dir, J.sun.color);
    Tank.camera = HG3D.camera(58, innerWidth / innerHeight, 0.3, 1200);
    const H = Tank.H = J.heights; Tank.hd = A.view(H.data); Tank.td = A.view(H.tops);
    // the tank's parts; each may carry a lighter twin (name + '_lod1') as its child
    const part = name => { const n = A.objects[name]; if (!n) return null; return { node: n, full: n.children.filter(c => c.isMesh), lod: A.objects[name + '_lod1'] || null }; };
    Tank.parts = [part('tank_hull'), part('tank_turret'), part('tank_barrel')].filter(Boolean);
    Tank.hull = A.objects.tank_hull || null; Tank.turret = A.objects.tank_turret || null; Tank.barrel = A.objects.tank_barrel || null; Tank.mats = [];
    Tank.muzzle = [0, 0, 3];
    if (Tank.hull) {
        scene.add(Tank.hull);
        const each = (n, f) => { if (n.isMesh) f(n); for (const c of n.children) each(c, f); };
        each(Tank.hull, m => { if (m.material.probe && Tank.mats.indexOf(m.material) < 0) Tank.mats.push(m.material); });
        // the far end of the barrel (it points along +z)
        if (Tank.barrel) { let zMax = -1e9, sx = 0, sy = 0, n = 0; const ms = Tank.barrel.children.filter(c => c.isMesh);
            for (const m of ms) { const p = m.geometry.attributes.position.array; for (let i = 2; i < p.length; i += 3) if (p[i] > zMax) zMax = p[i]; }
            for (const m of ms) { const p = m.geometry.attributes.position.array; for (let i = 0; i < p.length; i += 3) if (p[i + 2] > zMax - 0.05) { sx += p[i]; sy += p[i + 1]; n++; } }
            if (n) Tank.muzzle = [sx / n, sy / n, zMax]; }
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of Tank.hull.info.prims) { x0 = Math.min(x0, p.min[0]); x1 = Math.max(x1, p.max[0]); z0 = Math.min(z0, p.min[2]); z1 = Math.max(z1, p.max[2]); }
        Tank.half = [(x1 - x0) / 2 || 1.7, (z1 - z0) / 2 || 3.3];
    } else Tank.half = [1.7, 3.3];
    // its soft shadow on the ground
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.filter = 'blur(6px)'; g.fillStyle = '#505050'; g.fillRect(13, 10, 38, 44);
    const sm = HG3D.material({ lit: false, map: HG3D.texture(c, { srgb: true }), transparent: true, blending: 4, depthWrite: false, fog: false, toneMapped: false }); sm.polygonOffset = true; sm.polygonOffsetFactor = -2; sm.polygonOffsetUnits = -4;
    Tank.shadow = HG3D.mesh(HG3D.geo.plane(1, 1), sm); Tank.shadow.frustumCulled = false; scene.add(Tank.shadow);
    Tank.smoke = puffs(scene, 48, blobTexture(64, [[0, 'rgba(255,255,255,.85)'], [0.5, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']], true), false);
    Tank.fire = puffs(scene, 12, blobTexture(64, [[0, 'rgba(255,245,210,1)'], [0.3, 'rgba(255,180,80,.8)'], [0.7, 'rgba(255,90,20,.2)'], [1, 'rgba(255,60,0,0)']], true), true);
    const sd = J.sun ? J.sun.dir : [0, 1, 0]; Tank.shOff = [-sd[0] / Math.max(0.3, sd[1]) * 1.1, -sd[2] / Math.max(0.3, sd[1]) * 1.1];       // the shadow leans away from the sun
    const B = J.bounds; Tank.mid = [(B.min[0] + B.max[0]) / 2, (B.min[2] + B.max[2]) / 2]; Tank.size = Math.min(B.max[0] - B.min[0], B.max[2] - B.min[2]);
    Tank.lim = [B.min[0] + 8, B.max[0] - 8, B.min[2] + 8, B.max[2] - 8];
    Tank.dust = J.ambient ? [J.ambient[0], J.ambient[1], J.ambient[2]] : [1, 1, 1];
    Tank.resize(innerWidth / innerHeight);
};
Tank.resize = a => { if (!Tank.camera) return; Tank.camera.aspect = a; Tank.camera.updateProjection(); };
// height of a layer at a spot (bilinear)
function tankSample(d, x, z) {
    const H = Tank.H; let fx = (x - H.x0) / H.cell, fz = (z - H.z0) / H.cell; fx = clamp(fx, 0, H.nx - 1.001); fz = clamp(fz, 0, H.nz - 1.001);
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, a = iz * H.nx + ix;
    return (d[a] * (1 - tx) + d[a + 1] * tx) * (1 - tz) + (d[a + H.nx] * (1 - tx) + d[a + H.nx + 1] * tx) * tz;
}
Tank.height = (x, z) => tankSample(Tank.hd, x, z);
Tank.top = (x, z) => tankSample(Tank.td, x, z);
const tankSolid = (x, z) => Tank.top(x, z) - Tank.height(x, z) > 0.8;

Tank.start = function (demo) {
    const s = Tank.size, K = Tank.K = { x: Tank.mid[0], z: Tank.mid[1], y: 0, yaw: 0, v: 0, up: [0, 1, 0], tyaw: 0, elev: 0.03, camYaw: Math.PI, camPitch: 0.24, reload: 0, recoil: 0, rock: 0, light: new Float32Array(4), dustT: 0, t: 0, shake: 0 };
    // a clear place to start: spiral out from the middle
    for (let r = 0; r < s * 0.4; r += 4) { let done = false; for (let a = 0; a < 6.28; a += 0.5) { const x = Tank.mid[0] + Math.cos(a) * r, z = Tank.mid[1] + Math.sin(a) * r; if (!tankSolid(x, z) && !tankSolid(x + 3, z) && !tankSolid(x - 3, z) && !tankSolid(x, z + 3) && !tankSolid(x, z - 3)) { K.x = x; K.z = z; done = true; break; } } if (done) break; }
    K.y = Tank.height(K.x, K.z); Tank.shells = []; Tank.fired = 0; Tank.hits = 0; Tank.smoke.list.length = 0; Tank.fire.list.length = 0;
    $('hud').dataset.mode = 'tank'; Tank.hud(); Tank.hint();
};
Tank.stop = function () { $('msg').textContent = ''; delete $('hud').dataset.mode; };
Tank.hint = function () { if (App.mode === Tank) $('msg').textContent = !App.locked && !App.demo ? 'Click to play' : ''; };
Tank.hud = function () { const top = 'SHELLS ' + Tank.fired + '    LANDED ' + Tank.hits + (Tank.K.reload > 0 ? '    LOADING' : '    READY'); if (top !== Tank._top) { Tank._top = top; $('hud-top').textContent = top; } };
const TM = new Float32Array(16), TL = new Float32Array(16);
function rotY(o, a) { const c = Math.cos(a), s = Math.sin(a); M4.ident(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; }
function rotX(o, a) { const c = Math.cos(a), s = Math.sin(a); M4.ident(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; }
function tankBoom(x, y, z, big) {
    const d = Tank.dust, k = big ? 1 : 0.45;
    Tank.fire.add(x, y + 0.5 * k, z, 0, 2, 0, 5 * k, 14 * k, 0.18, 1, 1, 1, 1);
    for (let i = 0; i < (big ? 7 : 3); i++) { const a = Math.random() * 6.28, r = Math.random() * 1.5 * k; Tank.smoke.add(x + Math.cos(a) * r, y + 0.6 + Math.random() * k, z + Math.sin(a) * r, Math.cos(a) * 2.5 * k, 1.5 + Math.random() * 2.5, Math.sin(a) * 2.5 * k, 2 * k, 2.6 * k, 1.8 + Math.random() * 1.4, d[0] * 0.5, d[1] * 0.48, d[2] * 0.45, 0.75); }
    Snd.shot(big ? 0.7 : 0.6, big ? 90 : 220, big ? 0.9 : 0.5);
}
Tank.update = function (dt) {
    const K = Tank.K; K.t += dt;
    let thr = 0, steer = 0, fire = false;
    if (App.demo) {         // drive a wide circle, sweep the turret, fire now and then, pull the camera in and out
        const ang = Math.atan2(K.x - Tank.mid[0], K.z - Tank.mid[1]), rad = Math.hypot(K.x - Tank.mid[0], K.z - Tank.mid[1]), want = ang + Math.PI / 2 + clamp((rad - Tank.size * 0.24) * 0.05, -0.8, 0.8);
        let dy = want - K.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; steer = clamp(dy * 2, -1, 1); thr = 1;
        K.camYaw += dt * 0.35; K.camPitch = 0.22 + Math.sin(K.t * 0.3) * 0.08; fire = K.reload <= 0;
    } else {
        K.camYaw -= mouse.dx * 0.0022; K.camPitch = clamp(K.camPitch + mouse.dy * 0.0022, -0.12, 0.9);
        thr = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0); steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
        fire = mouse.fired && App.locked;
    }
    // ---- driving
    const fx = Math.sin(K.yaw), fz = Math.cos(K.yaw), hx = Tank.half[0], hz = Tank.half[1];
    const slope = (Tank.height(K.x + fx * hz, K.z + fz * hz) - Tank.height(K.x - fx * hz, K.z - fz * hz)) / (2 * hz);
    if (thr) K.v += thr * TD.accel * dt; else K.v -= Math.sign(K.v) * Math.min(Math.abs(K.v), 4 * dt);
    K.v -= slope * 6 * dt; K.v = clamp(K.v, -TD.rev, TD.max * clamp(1 - slope * 0.9, 0.35, 1.15));
    K.yaw += steer * TD.turn * dt * (0.55 + 0.45 * (1 - Math.abs(K.v) / TD.max)) * (K.v < -0.5 ? -1 : 1);
    const nx = K.x + fx * K.v * dt, nz = K.z + fz * K.v * dt, lead = (K.v >= 0 ? 1 : -1) * (hz + 0.4);
    if (tankSolid(nx + fx * lead, nz + fz * lead) || tankSolid(nx + fx * lead + fz * hx, nz + fz * lead - fx * hx) || tankSolid(nx + fx * lead - fz * hx, nz + fz * lead + fx * hx) || nx < Tank.lim[0] || nx > Tank.lim[1] || nz < Tank.lim[2] || nz > Tank.lim[3]) K.v *= -0.15;
    else { K.x = nx; K.z = nz; }
    // ---- sitting on the ground: height under four points gives the lean
    const hf = Tank.height(K.x + fx * hz, K.z + fz * hz), hb = Tank.height(K.x - fx * hz, K.z - fz * hz), hl = Tank.height(K.x + fz * hx, K.z - fx * hx), hr = Tank.height(K.x - fz * hx, K.z + fx * hx);
    const ty = (hf + hb + hl + hr) / 4, k = Math.min(1, dt * 8); K.y = lerp(K.y, ty, Math.min(1, dt * 12));
    let ux = -(hl - hr) / (2 * hx) * fz - (hf - hb) / (2 * hz) * fx, uz = (hl - hr) / (2 * hx) * fx - (hf - hb) / (2 * hz) * fz, uy = 1; const ul = Math.hypot(ux, uy, uz);
    K.up[0] = lerp(K.up[0], ux / ul, k); K.up[1] = lerp(K.up[1], uy / ul, k); K.up[2] = lerp(K.up[2], uz / ul, k);
    // ---- turret follows the camera, barrel follows its pitch
    let want = K.camYaw + Math.PI - K.yaw - K.tyaw; while (want > Math.PI) want -= Math.PI * 2; while (want < -Math.PI) want += Math.PI * 2;
    K.tyaw += clamp(want, -TD.slew * dt, TD.slew * dt);
    K.elev = lerp(K.elev, clamp(0.16 - K.camPitch * 0.75, -0.1, 0.38), Math.min(1, dt * 4));
    K.reload = Math.max(0, K.reload - dt); K.recoil = Math.max(0, K.recoil - dt * 2.2); K.rock = lerp(K.rock, 0, Math.min(1, dt * 3)); K.shake = Math.max(0, K.shake - dt * 2.5);
    Tank.place();
    if (fire && K.reload <= 0) {
        K.reload = TD.reload; K.recoil = 1; K.rock = 1; K.shake = 0.5; Tank.fired++;
        const b = Tank.barrel ? Tank.barrel.matrixWorld.elements : Tank.hull ? Tank.hull.matrixWorld.elements : TM, m = Tank.muzzle;
        const px = b[0] * m[0] + b[4] * m[1] + b[8] * m[2] + b[12], py = b[1] * m[0] + b[5] * m[1] + b[9] * m[2] + b[13], pz = b[2] * m[0] + b[6] * m[1] + b[10] * m[2] + b[14], l = Math.hypot(b[8], b[9], b[10]) || 1;
        Tank.shells.push({ x: px, y: py, z: pz, vx: b[8] / l * TD.shell, vy: b[9] / l * TD.shell, vz: b[10] / l * TD.shell, t: 0 });
        tankBoom(px, py - 0.5, pz, false);
    }
    // ---- shells: fall, land, burst
    const S = Tank.shells;
    for (let i = S.length - 1; i >= 0; i--) {
        const s = S[i]; let gone = false;
        for (let step = 0; step < 4 && !gone; step++) { const h = dt / 4; s.vy -= 9.8 * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.t += h;
            if (s.y <= Tank.top(s.x, s.z)) { tankBoom(s.x, Math.max(s.y, Tank.height(s.x, s.z)), s.z, true); Tank.hits++; gone = true; if (Math.hypot(s.x - K.x, s.z - K.z) < 40) K.shake = Math.max(K.shake, 0.6); } else if (s.t > 8) gone = true; }
        if (gone) { S[i] = S[S.length - 1]; S.pop(); }
    }
    // ---- dust behind the tracks
    K.dustT -= dt * Math.abs(K.v);
    if (K.dustT <= 0 && Math.abs(K.v) > 1.5) { K.dustT = 0.9; const d = Tank.dust, sgn = K.v > 0 ? -1 : 1; for (const sd of [-1, 1]) Tank.smoke.add(K.x + fx * sgn * hz + fz * sd * hx * 0.8, K.y + 0.4, K.z + fz * sgn * hz - fx * sd * hx * 0.8, 0, 0.7, 0, 1.4, 1.8, 1.6, d[0] * 0.75, d[1] * 0.68, d[2] * 0.58, 0.4); }
    const cw = Tank.camera.matrixWorld.elements; Tank.smoke.update(dt, cw); Tank.fire.update(dt, cw);
    Tank.hud();
};
// the tank's matrices from where it is and how the ground leans
Tank.place = function () {
    const K = Tank.K, u = K.up, fx0 = Math.sin(K.yaw), fz0 = Math.cos(K.yaw);
    // forward along the ground: take the up vector out of the heading
    let d = fx0 * u[0] + fz0 * u[2], zx = fx0 - u[0] * d, zy = -u[1] * d, zz = fz0 - u[2] * d, l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    const rk = K.rock * 0.03; zy += rk; l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let yx = u[0] - zx * (u[0] * zx + u[1] * zy + u[2] * zz), yy = u[1] - zy * (u[0] * zx + u[1] * zy + u[2] * zz), yz = u[2] - zz * (u[0] * zx + u[1] * zy + u[2] * zz); l = Math.hypot(yx, yy, yz) || 1; yx /= l; yy /= l; yz /= l;
    const xx = yy * zz - yz * zy, xy = yz * zx - yx * zz, xz = yx * zy - yy * zx;
    TM[0] = xx; TM[1] = xy; TM[2] = xz; TM[3] = 0; TM[4] = yx; TM[5] = yy; TM[6] = yz; TM[7] = 0; TM[8] = zx; TM[9] = zy; TM[10] = zz; TM[11] = 0; TM[12] = K.x; TM[13] = K.y; TM[14] = K.z; TM[15] = 1;
    if (Tank.turret) M4.mul(Tank.turret.local, Tank.turret.rest, rotY(TL, K.tyaw));
    if (Tank.barrel) { M4.mul(Tank.barrel.local, Tank.barrel.rest, rotX(TL, -K.elev)); const b = Tank.barrel.local, r = K.recoil * K.recoil * 0.45; b[12] -= b[8] * r; b[13] -= b[9] * r; b[14] -= b[10] * r; }
    if (Tank.hull) HG3D.place(Tank.hull, TM);
    const s = Tank.shadow.matrixWorld.elements, w = Tank.half[0] * 2 * 1.75 + Math.abs(Tank.shOff[0] * zz - Tank.shOff[1] * zx), len = Tank.half[1] * 2 * 1.55 + Math.abs(Tank.shOff[0] * zx + Tank.shOff[1] * zz);
    s[0] = xx * w; s[1] = xy * w; s[2] = xz * w; s[3] = 0; s[4] = yx; s[5] = yy; s[6] = yz; s[7] = 0; s[8] = zx * len; s[9] = zy * len; s[10] = zz * len; s[11] = 0; const ox = Tank.shOff[0], oz = Tank.shOff[1], oy = -(yx * ox + yz * oz) / (yy || 1);       // slid along the ground the tank stands on
    s[12] = K.x + ox + yx * 0.08; s[13] = K.y + oy + yy * 0.08; s[14] = K.z + oz + yz * 0.08; s[15] = 1;
};
Tank.statLine = () => Tank.K ? Math.abs(Tank.K.v * 3.6).toFixed(0) + ' km/h' + (Tank.far ? '   far model' : '') : '';
Tank.render = function () {
    const K = Tank.K, A = Tank.A, cam = Tank.camera;
    const dist = App.demo ? TD.camDist + (Math.sin(K.t * 0.25 - 1.2) * 0.5 + 0.5) * 60 : TD.camDist, cp = Math.cos(K.camPitch);
    let cx = K.x + Math.sin(K.camYaw) * cp * dist, cz = K.z + Math.cos(K.camYaw) * cp * dist, cy = K.y + 2.6 + Math.sin(K.camPitch) * dist;
    cy = Math.max(cy, Tank.top(cx, cz) + 1.2);
    const sh = K.shake * K.shake * 0.25; cam.lookFrom(cx + (Math.random() - 0.5) * sh, cy + (Math.random() - 0.5) * sh, cz, K.x, K.y + 2.6, K.z);
    const cw = cam.matrixWorld.elements; skyFollow(Tank.scene, cw);
    const far = dist > TD.lodFar; Tank.far = far;
    for (const p of Tank.parts) { if (!p.lod) continue; for (const m of p.full) m.visible = !far; p.lod.visible = far; }
    A.probe(K.x, K.z, K.light); for (const m of Tank.mats) m.probe.set(K.light);
    draw(Tank.scene, cam, true);
};
