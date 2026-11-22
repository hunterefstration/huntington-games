// ============================================================
// The terrain: one tile whose colour and light were baked in Blender (assets/range.hgm), two height maps from the exporter
// (the ground, and the tops of everything standing on it), and the soft things in the air: smoke, dust, fire, shadows.
// ============================================================
const World = { loaded: false };
// soft puffs (smoke, dust, flashes): all of one kind in one draw call, each facing the camera, each with its own fade
function makePuffs(scene, max, tex, additive) {
    const g = HG3D.geo.plane(1, 1); g.attributes.aFade = HG3D.attr(new Float32Array(max), 1, true);
    const hook = { key: 'ss-puff', vDecl: 'in float aFade; out float vFade;', vMain: ' vFade = aFade;', fDecl: 'in float vFade;', fAlbedo: ' alpha *= vFade;' };
    const m = HG3D.instanced(g, HG3D.material({ lit: false, map: tex, transparent: true, blending: additive ? 2 : 1, depthWrite: false, side: 2, fog: !additive, hg: hook }), max, { colors: true });
    m.renderOrder = additive ? 3 : 2; m.frustumCulled = false; m.count = 0; scene.add(m);
    const P = { mesh: m, list: [], max };
    P.add = (x, y, z, vx, vy, vz, size, grow, life, r, g2, b, a) => { if (P.list.length >= max) P.list.shift(); P.list.push({ x, y, z, vx, vy, vz, size, grow, life, t: 0, r, g: g2, b, a: a === undefined ? 1 : a }); };
    P.update = (dt, cw) => {
        const L = P.list, e = m.instanceMatrix.array, c = m.instanceColor.array, f = g.attributes.aFade.array; let n = 0;
        for (let i = 0; i < L.length; i++) {
            const p = L[i]; p.t += dt; if (p.t >= p.life) continue; L[n] = p;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
            const s = p.size + p.grow * p.t, o = n * 16, k = p.t / p.life;
            e[o] = cw[0] * s; e[o + 1] = cw[1] * s; e[o + 2] = cw[2] * s; e[o + 3] = 0; e[o + 4] = cw[8]; e[o + 5] = cw[9]; e[o + 6] = cw[10]; e[o + 7] = 0; e[o + 8] = -cw[4] * s; e[o + 9] = -cw[5] * s; e[o + 10] = -cw[6] * s; e[o + 11] = 0; e[o + 12] = p.x; e[o + 13] = p.y; e[o + 14] = p.z; e[o + 15] = 1;
            c[n * 3] = p.r; c[n * 3 + 1] = p.g; c[n * 3 + 2] = p.b; f[n] = p.a * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85); n++;
        }
        L.length = n; m.count = n; if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; g.attributes.aFade.needsUpdate = true; }
    };
    P.clear = () => { P.list.length = 0; m.count = 0; };
    return P;
}
const MAPS = {
    range:  { name: 'PROVING GROUND', file: 'range', blurb: 'Two hundred metres of open ground, a few rocks, nowhere to hide for long.', fog: [140, 800] },
    valley: { name: 'IRON VALLEY', file: 'valley', blurb: 'A dry river between two ridges, a ruined village in the middle. Use the ground.', fog: [260, 1300], sky: { file: 'range_sky.webp', range: 2.6, horizon: [0.62, 0.6, 0.48] } }
};
const HAVE = { range: true };
// which terrain files are really there (asked for by name once)
World.check = async function () { if (World.checked) return; World.checked = true; await Promise.all(Object.keys(MAPS).map(id => id === 'range' ? 0 : fetch(BASE + 'assets/' + MAPS[id].file + '.hgm', { method: 'HEAD' }).then(r => { HAVE[id] = r.ok; }, () => { HAVE[id] = false; }))); };
World.maps = () => Object.keys(MAPS).filter(id => HAVE[id] === true);
// once: the scene, the camera, the lights, smoke and fire and the shadow planes (they outlive any one terrain)
World.setup = function () {
    const scene = World.scene = HG3D.node(); World.rig = lightRig(scene); World.camera = HG3D.camera(58, innerWidth / innerHeight, 0.3, 1600);
    World.smoke = makePuffs(scene, 110, blobTexture(64, [[0, 'rgba(255,255,255,.85)'], [0.5, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']], true), false);
    World.fire = makePuffs(scene, 40, blobTexture(64, [[0, 'rgba(255,245,210,1)'], [0.3, 'rgba(255,180,80,.8)'], [0.7, 'rgba(255,90,20,.2)'], [1, 'rgba(255,60,0,0)']], true), true);
    // soft shadows under the tanks: one instanced plane, multiplied onto the ground, leaning away from the sun
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.filter = 'blur(6px)'; g.fillStyle = '#505050'; g.fillRect(13, 10, 38, 44);
    const sm = HG3D.material({ lit: false, map: HG3D.texture(c, { srgb: true }), transparent: true, blending: 4, depthWrite: false, fog: false, toneMapped: false }); sm.polygonOffset = true; sm.polygonOffsetFactor = -2; sm.polygonOffsetUnits = -4;
    World.shadows = HG3D.instanced(HG3D.geo.plane(1, 1), sm, 12); World.shadows.frustumCulled = false; World.shadows.count = 0; scene.add(World.shadows);
};
World.unload = function () { if (!World.loaded) return; World.loaded = false; Units.forget(); World.smoke.clear(); World.fire.clear(); World.shadows.count = 0; World.scene.remove(World.mapNode); R.release(World.mapNode, World.A.textures); World.A = null; World.dome = null; World.id = ''; };
// loads wait their turn (the menu loads a terrain behind itself; ROLL OUT pressed before that is done must not start a second)
World.load = function (prog, id) { const run = () => World.load1(prog, id); return World.busy = (World.busy || Promise.resolve()).then(run, run); };
World.load1 = async function (prog, id) {
    id = MAPS[id] ? id : (World.id || 'range'); if (World.loaded && World.id === id) return; if (!World.scene) World.setup(); if (World.loaded) World.unload(); if (prog) prog(0.1);
    const M = MAPS[id], A = World.A = await HG3D.load(Q.get('map') || BASE + 'assets/' + M.file + '.hgm', { anisotropy: +Q.get('aniso') || 4 }), J = A.json; if (prog) prog(0.8);
    const scene = World.scene, mapNode = World.mapNode = HG3D.node(); mapNode.add(A.scene); scene.add(mapNode); World.id = id;
    // sky + fog + exposure from what the exporter measured in the Blender scene
    const sunC = J.sun ? J.sun.color : [0, 0, 0], amb = J.ambient || [1, 1, 1], up = J.sun ? Math.max(J.sun.dir[1], 0.05) : 0;
    World.exposure = (+Q.get('exp') || 1) * 0.85 / Math.max(0.05, lum(amb) + lum(sunC) * up);
    // the sky: the file's own, or (a terrain baked under a plain grey one) another terrain's picture of a clear afternoon
    if (J.sky) { const SK = M.sky || null, dome = World.dome = HG3D.skyDome(SK ? HG3D.loadTexture(BASE + 'assets/' + SK.file, { srgb: true }) : A.textures[J.sky.map], 450), k = SK ? SK.range : J.sky.range; dome.material.color = { r: k, g: k, b: k }; mapNode.add(dome); const f = aces(SK ? SK.horizon : J.sky.horizon, World.exposure), fog = HG3D.fog(0, M.fog[0], M.fog[1]); fog.color = { r: f[0], g: f[1], b: f[2] }; scene.fog = fog; }
    World.rig.set(J.sun ? J.sun.dir : [0.3, 0.9, 0.3], J.sun ? J.sun.color : [1, 1, 1]);
    const H = World.H = J.heights; World.hd = A.view(H.data); World.td = A.view(H.tops);
    const sd = J.sun ? J.sun.dir : [0, 1, 0]; World.shOff = [-sd[0] / Math.max(0.3, sd[1]) * 1.1, -sd[2] / Math.max(0.3, sd[1]) * 1.1];
    const B = J.bounds; World.mid = [(B.min[0] + B.max[0]) / 2, (B.min[2] + B.max[2]) / 2]; World.size = Math.min(B.max[0] - B.min[0], B.max[2] - B.min[2]);
    World.lim = [B.min[0] + 8, B.max[0] - 8, B.min[2] + 8, B.max[2] - 8]; World.dustC = J.ambient ? [J.ambient[0], J.ambient[1], J.ambient[2]] : [1, 1, 1];
    Units.setup(A);
    World.resize(innerWidth / innerHeight); R.toneMappingExposure = World.exposure; R.compile(scene, World.camera); World.loaded = true; World.flyA = Math.random() * 6.28; if (prog) prog(1);
};
World.resize = a => { if (!World.camera) return; World.camera.aspect = a; World.camera.updateProjection(); };
// height of a layer at a spot (bilinear)
function sampleH(d, x, z) {
    const H = World.H; let fx = (x - H.x0) / H.cell, fz = (z - H.z0) / H.cell; fx = clamp(fx, 0, H.nx - 1.001); fz = clamp(fz, 0, H.nz - 1.001);
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, a = iz * H.nx + ix;
    return (d[a] * (1 - tx) + d[a + 1] * tx) * (1 - tz) + (d[a + H.nx] * (1 - tx) + d[a + H.nx + 1] * tx) * tz;
}
World.height = (x, z) => sampleH(World.hd, x, z);
World.top = (x, z) => sampleH(World.td, x, z);
World.solid = (x, z) => World.top(x, z) - World.height(x, z) > 0.8;
World.inside = (x, z) => x > World.lim[0] && x < World.lim[1] && z > World.lim[2] && z < World.lim[3];
// can a shell fly straight from a to b without meeting the ground or something on it
World.los = function (ax, ay, az, bx, by, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 3); for (let i = 1; i < n; i++) { const t = i / n; if (ay + (by - ay) * t < World.top(ax + (bx - ax) * t, az + (bz - az) * t) - 0.2) return false; } return true; };
World.boom = function (x, y, z, big) {
    const d = World.dustC, k = big ? 1 : 0.45; World.fire.add(x, y + 0.5 * k, z, 0, 2, 0, 5 * k, 14 * k, 0.18, 1, 1, 1, 1);
    for (let i = 0; i < (big ? 7 : 3); i++) { const a = Math.random() * 6.28, r = Math.random() * 1.5 * k; World.smoke.add(x + Math.cos(a) * r, y + 0.6 + Math.random() * k, z + Math.sin(a) * r, Math.cos(a) * 2.5 * k, 1.5 + Math.random() * 2.5, Math.sin(a) * 2.5 * k, 2 * k, 1.7 * k, 1.5 + Math.random() * 1.2, d[0] * 0.5, d[1] * 0.48, d[2] * 0.45, 0.6); }
};
World.step = function (dt, cw) { World.smoke.update(dt, cw); World.fire.update(dt, cw); if (World.dome) { const e = World.dome.matrixWorld.elements; e[12] = cw[12]; e[13] = cw[13]; e[14] = cw[14]; } };
// behind the menu: a slow turn round the tile, low over the ground
World.flyBy = function (dt) {
    World.flyA += dt * 0.04; const r = World.size * 0.3, cam = World.camera, a = World.flyA; if (cam.fov !== 50) { cam.fov = 50; cam.updateProjection(); }
    const x = World.mid[0] + Math.cos(a) * r, z = World.mid[1] + Math.sin(a) * r, y = World.top(x, z) + 7;
    cam.lookFrom(x, y, z, World.mid[0], World.height(World.mid[0], World.mid[1]) + 2, World.mid[1]);
    Units.showcase(dt); World.step(dt, cam.matrixWorld.elements); draw(World.scene, cam, true);
};
