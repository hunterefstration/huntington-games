// ============================================================
// The Range: one tank (hull > turret > barrel, two detail levels) on one terrain tile whose colour and light were baked
// in Blender. The tank sits on the exporter's height map (ground), is stopped by what stands on it (tops - ground),
// and takes its brightness from the baked light where it stands.
// ============================================================
const Tank = App.modes.tank = { title: 'the Range', loaded: false, fired: 0, hits: 0 };
// slew, lift: how fast the turret turns and the gun rises (radians a second); elevMin..elevMax: how far the gun can dip and rise
const TD = { max: 13, rev: 6, accel: 5.5, turn: 0.95, slew: 0.8, lift: 0.45, elevMin: -0.14, elevMax: 0.42, reload: 2.4, shell: 190, camDist: 11, lodFar: 45, fov: 58, sightFov: 15 };

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
    // steel targets to shoot at, near and far, low and up the slopes (the gun has to be lifted or dipped for those)
    const tc = document.createElement('canvas'); tc.width = tc.height = 128; const tg = tc.getContext('2d'); tg.fillStyle = '#d9d4c4'; tg.fillRect(0, 0, 128, 128);
    for (const [r, col] of [[56, '#b3301f'], [40, '#d9d4c4'], [24, '#b3301f'], [9, '#d9d4c4']]) { tg.fillStyle = col; tg.beginPath(); tg.arc(64, 64, r, 0, 6.3); tg.fill(); }
    const tm = HG3D.material({ map: HG3D.texture(tc, { srgb: true }) }), tgeo = HG3D.geo.box(3.2, 3.2, 0.2);
    Tank.targets = []; for (let i = 0; i < 5; i++) { const mesh = HG3D.mesh(tgeo, tm); mesh.frustumCulled = false; scene.add(mesh); Tank.targets.push({ mesh, x: 0, y: 0, z: 0, yaw: 0, fall: 0, down: 0 }); }
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
    const s = Tank.size, K = Tank.K = { x: Tank.mid[0], z: Tank.mid[1], y: 0, yaw: 0, v: 0, up: [0, 1, 0], tyaw: 0, elev: 0.03, aimYaw: 0, aimPitch: -0.04, camPitch: 0.24, sight: 0, aimHit: false, ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0, range: 0, laid: false, stop: false, reload: 0, recoil: 0, rock: 0, light: new Float32Array(4), dustT: 0, t: 0, shake: 0 };
    // a clear place to start: spiral out from the middle
    for (let r = 0; r < s * 0.4; r += 4) { let done = false; for (let a = 0; a < 6.28; a += 0.5) { const x = Tank.mid[0] + Math.cos(a) * r, z = Tank.mid[1] + Math.sin(a) * r; if (!tankSolid(x, z) && !tankSolid(x + 3, z) && !tankSolid(x - 3, z) && !tankSolid(x, z + 3) && !tankSolid(x, z - 3)) { K.x = x; K.z = z; done = true; break; } } if (done) break; }
    K.y = Tank.height(K.x, K.z); Tank.shells = []; Tank.fired = 0; Tank.hits = 0; Tank.landed = 0; Tank.lastLand = null; Tank.smoke.list.length = 0; Tank.fire.list.length = 0;
    tankSeed = 7; Tank.targets.forEach((T, i) => { tankTarget(T, i); tankTargetPlace(T); });
    Tank.place(); tankEye(K); tankAim(K); tankFall(K);
    $('hud').dataset.mode = 'tank'; Tank.hud(); Tank.hint();
};
Tank.stop = function () { $('msg').textContent = ''; delete $('hud').dataset.mode; delete $('hud').dataset.sight; };
Tank.hint = function () { if (App.mode === Tank) $('msg').textContent = !App.locked && !App.demo ? 'Click to play' : ''; };
Tank.hud = function () {
    const K = Tank.K, top = 'SHELLS ' + Tank.fired + '    HITS ' + Tank.hits + (K.reload > 0 ? '    LOADING' : '    READY') + '    RANGE ' + (K.aimHit ? Math.round(K.range) + ' m' : '---') + '    GUN ' + (K.elev >= 0 ? '+' : '') + (K.elev * 57.3).toFixed(1) + '\u00b0';
    if (top !== Tank._top) { Tank._top = top; $('hud-top').textContent = top; }
};
const TM = new Float32Array(16), TL = new Float32Array(16);
function rotY(o, a) { const c = Math.cos(a), s = Math.sin(a); M4.ident(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; }
function rotX(o, a) { const c = Math.cos(a), s = Math.sin(a); M4.ident(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; }
function tankBoom(x, y, z, big) {
    const d = Tank.dust, k = big ? 1 : 0.45;
    Tank.fire.add(x, y + 0.5 * k, z, 0, 2, 0, 5 * k, 14 * k, 0.18, 1, 1, 1, 1);
    for (let i = 0; i < (big ? 7 : 3); i++) { const a = Math.random() * 6.28, r = Math.random() * 1.5 * k; Tank.smoke.add(x + Math.cos(a) * r, y + 0.6 + Math.random() * k, z + Math.sin(a) * r, Math.cos(a) * 2.5 * k, 1.5 + Math.random() * 2.5, Math.sin(a) * 2.5 * k, 2 * k, 2.6 * k, 1.8 + Math.random() * 1.4, d[0] * 0.5, d[1] * 0.48, d[2] * 0.45, 0.75); }
    Snd.shot(big ? 0.7 : 0.6, big ? 90 : 220, big ? 0.9 : 0.5);
}
// ---- aiming. The mouse turns a line of sight, left/right and up/down. Where that line meets the ground (or a target
// on it) is the aim point; the turret and the gun then turn, at their own speed, to the angle that drops a shell on it,
// so a far or a high target needs more barrel. A second mark shows where the gun as it points now would land its shell.
const TV = Tank.eye = { e: [0, 0, 0], d: [0, 0, 1] };
function tankEye(K) {           // the eye and the way it looks: behind and above the tank, or (sight) the gunner's sight over the gun
    const cp = Math.cos(K.aimPitch), d = TV.d, e = TV.e, s = K.sight; d[0] = Math.sin(K.aimYaw) * cp; d[1] = Math.sin(K.aimPitch); d[2] = Math.cos(K.aimYaw) * cp;
    const back = TD.camDist * (1 - s) - 1.6 * s;
    e[0] = K.x - d[0] * back; e[2] = K.z - d[2] * back; e[1] = K.y + 4.2 * (1 - s) + 3.1 * s - d[1] * back * (1 - s);
    e[1] = Math.max(e[1], Tank.top(e[0], e[2]) + 1.2);
}
function tankAim(K) {           // the first ground, or thing standing on it, along the line of sight (none: the sky)
    const e = TV.e, d = TV.d, under = t => e[1] + d[1] * t < Tank.top(e[0] + d[0] * t, e[2] + d[2] * t); let t = TD.camDist * (1 - K.sight) + 4, pt = t;
    // a target board is thinner than the height map can show: test the boards themselves first
    let best = 1e9; for (const T of Tank.targets) { if (T.down > 0) continue; const m = T.mesh.matrixWorld.elements, rx = m[12] - e[0], ry = m[13] - e[1], rz = m[14] - e[2], along = rx * d[0] + ry * d[1] + rz * d[2];
        if (along > t && along < best && rx * rx + ry * ry + rz * rz - along * along < 2.6) best = along; }
    for (; t < 900 && t < best; pt = t, t += 1.5 + t * 0.03) if (under(t)) break;
    if (t >= best) t = best; else if (t >= 900) { K.aimHit = false; K.ax = e[0] + d[0] * 900; K.ay = e[1] + d[1] * 900; K.az = e[2] + d[2] * 900; return; }
    else for (let i = 0; i < 6; i++) { const m = (pt + t) / 2; if (under(m)) t = m; else pt = m; }
    K.aimHit = true; K.ax = e[0] + d[0] * t; K.ay = e[1] + d[1] * t; K.az = e[2] + d[2] * t;
}
function tankLay(K, dt) {       // turn the turret and lift the gun toward the angle that lands a shell on the aim point
    const dx = K.ax - K.x, dz = K.az - K.z, dist = Math.hypot(dx, dz) || 1, h = K.ay - (K.y + 2.3), v2 = TD.shell * TD.shell, g = 9.8;
    let th = Math.atan2(h, dist);
    if (K.aimHit && dist > 8) { const disc = v2 * v2 - g * (g * dist * dist + 2 * h * v2); th = disc > 0 ? Math.atan2(v2 - Math.sqrt(disc), g * dist) : 0.6; }
    K.range = Math.hypot(dist, h);
    const c = Math.cos(th), wx = dx / dist * c, wy = Math.sin(th), wz = dz / dist * c;
    // into the hull's own space, which leans with the ground: the gun stays on its mark while the tank rocks and climbs
    const lx = wx * TM[0] + wy * TM[1] + wz * TM[2], ly = wx * TM[4] + wy * TM[5] + wz * TM[6], lz = wx * TM[8] + wy * TM[9] + wz * TM[10];
    let turn = Math.atan2(lx, lz) - K.tyaw; while (turn > Math.PI) turn -= Math.PI * 2; while (turn < -Math.PI) turn += Math.PI * 2;
    const wantEl = Math.atan2(ly, Math.hypot(lx, lz)), rise = clamp(wantEl, TD.elevMin, TD.elevMax) - K.elev;
    K.tyaw += clamp(turn, -TD.slew * dt, TD.slew * dt); K.elev += clamp(rise, -TD.lift * dt, TD.lift * dt);
    K.stop = wantEl < TD.elevMin - 0.004 || wantEl > TD.elevMax + 0.004;         // the gun cannot dip or rise that far
    K.laid = !K.stop && Math.abs(turn) < 0.01 && Math.abs(rise) < 0.01;
}
function tankMuzzle(o) {        // the mouth of the gun and the way it points
    const b = Tank.barrel ? Tank.barrel.matrixWorld.elements : Tank.hull ? Tank.hull.matrixWorld.elements : TM, m = Tank.muzzle, l = Math.hypot(b[8], b[9], b[10]) || 1;
    o[0] = b[0] * m[0] + b[4] * m[1] + b[8] * m[2] + b[12]; o[1] = b[1] * m[0] + b[5] * m[1] + b[9] * m[2] + b[13]; o[2] = b[2] * m[0] + b[6] * m[1] + b[10] * m[2] + b[14]; o[3] = b[8] / l; o[4] = b[9] / l; o[5] = b[10] / l; return o;
}
const TMZ = new Float32Array(6);
function tankFall(K) {          // where a shell fired this instant would come down
    const m = tankMuzzle(TMZ), h = 0.03; let x = m[0], y = m[1], z = m[2], vx = m[3] * TD.shell, vy = m[4] * TD.shell, vz = m[5] * TD.shell;
    for (let i = 0; i < 260; i++) { vy -= 9.8 * h; x += vx * h; y += vy * h; z += vz * h; if (y <= Tank.top(x, z)) break; }
    K.gx = x; K.gy = y; K.gz = z;
}
let tankSeed = 7; const tankRand = () => (tankSeed = tankSeed * 16807 % 2147483647) / 2147483647;
function tankTarget(T, i) {     // stand a target somewhere clear, each in its own ring of distance from the middle, facing the middle
    for (let n = 0; n < 60; n++) { const a = tankRand() * 6.283, r = 40 + (i + tankRand()) * (Tank.size * 0.44 - 40) / Tank.targets.length, x = Tank.mid[0] + Math.sin(a) * r, z = Tank.mid[1] + Math.cos(a) * r;
        if (x < Tank.lim[0] || x > Tank.lim[1] || z < Tank.lim[2] || z > Tank.lim[3] || tankSolid(x, z) || (Tank.K && Math.hypot(x - Tank.K.x, z - Tank.K.z) < 25)) continue;
        T.x = x; T.z = z; T.y = Tank.height(x, z); T.yaw = a + Math.PI; break; }
    T.fall = 0; T.down = 0;
}
function tankTargetPlace(T) {   // upright on its foot, or knocked flat on its back
    const e = T.mesh.matrixWorld.elements, f = -T.fall * 1.5, cy = Math.cos(T.yaw), sy = Math.sin(T.yaw), cf = Math.cos(f), sf = Math.sin(f);
    e[0] = cy; e[1] = 0; e[2] = -sy; e[3] = 0; e[4] = sy * sf; e[5] = cf; e[6] = cy * sf; e[7] = 0; e[8] = sy * cf; e[9] = -sf; e[10] = cy * cf; e[11] = 0;
    e[12] = T.x + e[4] * 1.9; e[13] = T.y + e[5] * 1.9; e[14] = T.z + e[6] * 1.9; e[15] = 1;
}
Tank.update = function (dt) {
    const K = Tank.K; K.t += dt;
    let thr = 0, steer = 0, fire = false;
    if (App.demo) {         // drive a wide circle, sweep the turret, fire now and then, pull the camera in and out
        const ang = Math.atan2(K.x - Tank.mid[0], K.z - Tank.mid[1]), rad = Math.hypot(K.x - Tank.mid[0], K.z - Tank.mid[1]), want = ang + Math.PI / 2 + clamp((rad - Tank.size * 0.24) * 0.05, -0.8, 0.8);
        let dy = want - K.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; steer = clamp(dy * 2, -1, 1); thr = 1;
        K.aimYaw += dt * 0.35; K.camPitch = 0.22 + Math.sin(K.t * 0.3) * 0.08; K.aimPitch = -0.03 + Math.sin(K.t * 0.8) * 0.05; fire = K.reload <= 0;
    } else {
        // the gunner's sight (right button or Shift): a narrow, steady view along the gun for far shots
        K.sight = lerp(K.sight, mouse.right || keys.ShiftLeft || keys.ShiftRight ? 1 : 0, Math.min(1, dt * 9)); if (K.sight < 0.002) K.sight = 0;
        const sens = 0.0022 * lerp(1, TD.sightFov / TD.fov, K.sight);
        K.aimYaw -= mouse.dx * sens; K.aimPitch = clamp(K.aimPitch - mouse.dy * sens, -0.5, 0.55);
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
    // ---- the line of sight picks the aim point, the turret and gun follow it
    tankEye(K); tankAim(K); tankLay(K, dt);
    K.reload = Math.max(0, K.reload - dt); K.recoil = Math.max(0, K.recoil - dt * 2.2); K.rock = lerp(K.rock, 0, Math.min(1, dt * 3)); K.shake = Math.max(0, K.shake - dt * 2.5);
    Tank.place(); tankFall(K);
    if (fire && K.reload <= 0) {
        K.reload = TD.reload; K.recoil = 1; K.rock = 1; K.shake = 0.5; Tank.fired++;
        const m = tankMuzzle(TMZ), px = m[0], py = m[1], pz = m[2];
        Tank.shells.push({ x: px, y: py, z: pz, vx: m[3] * TD.shell, vy: m[4] * TD.shell, vz: m[5] * TD.shell, t: 0 });
        tankBoom(px, py - 0.5, pz, false);
    }
    // ---- shells: fall, land, burst
    const S = Tank.shells;
    for (let i = S.length - 1; i >= 0; i--) {
        const s = S[i]; let gone = false;
        for (let step = 0; step < 6 && !gone; step++) { const h = dt / 6; s.vy -= 9.8 * h; s.x += s.vx * h; s.y += s.vy * h; s.z += s.vz * h; s.t += h;
            for (const T of Tank.targets) { if (T.down > 0) continue; const m = T.mesh.matrixWorld.elements; if (Math.hypot(s.x - m[12], s.y - m[13], s.z - m[14]) < 2.1) { T.down = 3; Tank.hits++; tankBoom(s.x, s.y, s.z, false); Snd.tone(900, 0.25, 0.12, 'triangle'); gone = true; break; } }
            if (gone) break;
            if (s.y <= Tank.top(s.x, s.z)) { tankBoom(s.x, Math.max(s.y, Tank.height(s.x, s.z)), s.z, true); Tank.landed++; Tank.lastLand = [s.x, s.y, s.z]; gone = true; if (Math.hypot(s.x - K.x, s.z - K.z) < 40) K.shake = Math.max(K.shake, 0.6); } else if (s.t > 8) gone = true; }
        if (gone) { S[i] = S[S.length - 1]; S.pop(); }
    }
    Tank.targets.forEach((T, i) => { if (T.down > 0) { T.down -= dt; T.fall = Math.min(1, T.fall + dt * 5); if (T.down <= 0) tankTarget(T, i); tankTargetPlace(T); } });
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
    const sh = K.shake * K.shake * 0.25 * (1 - K.sight * 0.7), jx = (Math.random() - 0.5) * sh, jy = (Math.random() - 0.5) * sh; let dist = TD.camDist * (1 - K.sight);
    const fov = lerp(TD.fov, TD.sightFov, K.sight); if (cam.fov !== fov) { cam.fov = fov; cam.updateProjection(); }
    if (App.demo) {             // the speed test: circle the tank and pull far out and back, looking at it
        dist = TD.camDist + (Math.sin(K.t * 0.25 - 1.2) * 0.5 + 0.5) * 60; const cp = Math.cos(K.camPitch), cy0 = K.aimYaw + Math.PI;
        const cx = K.x + Math.sin(cy0) * cp * dist, cz = K.z + Math.cos(cy0) * cp * dist, cy = Math.max(K.y + 2.6 + Math.sin(K.camPitch) * dist, Tank.top(cx, cz) + 1.2);
        cam.lookFrom(cx + jx, cy + jy, cz, K.x, K.y + 2.6, K.z);
    } else { tankEye(K); const e = TV.e, d = TV.d; cam.lookFrom(e[0] + jx, e[1] + jy, e[2], e[0] + d[0] * 50, e[1] + d[1] * 50, e[2] + d[2] * 50); }
    // the gun mark: where the shell would land, on the screen
    const gm = $('gunmark'), w = cam.matrixWorld.elements, rx = K.gx - w[12], ry = K.gy - w[13], rz = K.gz - w[14], vz = -(rx * w[8] + ry * w[9] + rz * w[10]), tf = Math.tan(fov * Math.PI / 360);
    if (App.demo || vz < 1) gm.style.opacity = 0; else {
        const sx = (0.5 + (rx * w[0] + ry * w[1] + rz * w[2]) / (vz * tf * cam.aspect) / 2) * innerWidth, sy = (0.5 - (rx * w[4] + ry * w[5] + rz * w[6]) / (vz * tf) / 2) * innerHeight;
        gm.style.opacity = ''; gm.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)'; const cls = K.stop ? 'stop' : K.laid ? 'on' : ''; if (gm.className !== cls) gm.className = cls;
    }
    const sg = K.sight > 0.5 ? '1' : ''; if (($('hud').dataset.sight || '') !== sg) { if (sg) $('hud').dataset.sight = sg; else delete $('hud').dataset.sight; }
    const cw = cam.matrixWorld.elements; skyFollow(Tank.scene, cw);
    const far = dist > TD.lodFar; Tank.far = far;
    for (const p of Tank.parts) { if (!p.lod) continue; for (const m of p.full) m.visible = !far; p.lod.visible = far; }
    A.probe(K.x, K.z, K.light); for (const m of Tank.mats) m.probe.set(K.light);
    draw(Tank.scene, cam, true);
};
