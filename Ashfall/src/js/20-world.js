// ============================================================
// A map: one .hgm file (models, baked light, the collision map, light probes, the sky) and what the game asks of it:
// is this spot solid, how far does a bullet fly, which way do the ashen walk. Also the small moving things that are
// not characters: sparks and smoke, tracers, spent casings, soft shadows, and the ash in the air.
// ============================================================
const MAPS = {
    yard: { name: 'THE YARD', file: 'yard', blurb: 'A walled depot on the edge of the burn. One way in, no way out.', fog: [35, 220], bright: 0.9 },
    depot: { name: 'THE DEPOT', file: 'depot', indoors: true, blurb: 'A freight shed with the doors rolled shut. Lanes of shelving, nowhere to see far, and the lamps are failing.', fog: [22, 110], bright: 0.95 },
    subway: { name: 'THE UNDERGROUND', file: 'subway', indoors: true, blurb: 'A station under the town. A stalled train, two platforms, and a service corridor that comes round behind you.', fog: [20, 100], bright: 1 },
    outpost: { name: 'CHECKPOINT 9', file: 'outpost', blurb: 'An army roadblock, left in a hurry. Pools of floodlight with the dark between them.', fog: [30, 190], bright: 1.3 },
    mall: { name: 'THE ARCADE', file: 'mall', indoors: true, blurb: 'A dead shopping mall. A long concourse, shops you can cut through, and a shaft of dusk through the broken skylight.', fog: [22, 120], bright: 1.05 },
    carnival: { name: 'THE FAIRGROUND', file: 'carnival', blurb: 'A funfair nobody packed away. Stalls, a carousel, a ghost train, and a few bulbs still burning.', fog: [30, 190], bright: 1.3 },
    lab: { name: 'SUBLEVEL 3', file: 'lab', indoors: true, blurb: 'Where it started. Broken glass cells round a containment hall, cold light, red alarms.', fog: [20, 100], bright: 1.25 },
    street: { name: 'MAIN STREET', file: 'street', blurb: 'What is left of the town, under a hand of ash. Long sight lines down the road, tight rooms off it.', fog: [28, 170], bright: 0.95 }
};
// hold: true = the map file may exist but is still being made: not on the menu (remove the mark when it has been played)
const World = { loaded: false, id: '', A: null, eye: 1.65 };

// soft puffs (smoke, dust, flashes, blood): all of one kind in one draw call, each facing the camera, each with its own fade
function makePuffs(scene, max, tex, additive, flat) {          // flat: lying on the ground (a ring, a scorch) instead of facing the camera
    const g = HG3D.geo.plane(1, 1); g.attributes.aFade = HG3D.attr(new Float32Array(max), 1, true);
    const hook = { key: 'ash-puff', vDecl: 'in float aFade; out float vFade;', vMain: ' vFade = aFade;', fDecl: 'in float vFade;', fAlbedo: ' alpha *= vFade;' };
    const m = HG3D.instanced(g, HG3D.material({ lit: false, map: tex, transparent: true, blending: additive ? 2 : 1, depthWrite: false, side: 2, fog: !additive, hg: hook }), max, { colors: true });
    m.renderOrder = additive ? 3 : 2; m.frustumCulled = false; m.count = 0; scene.add(m);
    const P = { mesh: m, list: [], max };
    // where, which way it drifts, how big, how fast it grows, how long it lasts, colour, strength, how hard it falls
    P.add = (x, y, z, vx, vy, vz, size, grow, life, r, g2, b, a, fall) => { if (P.list.length >= max) P.list.shift(); P.list.push({ x, y, z, vx, vy, vz, size, grow, life, t: 0, r, g: g2, b, a: a === undefined ? 1 : a, fall: fall || 0 }); };
    P.update = (dt, cw) => {
        const L = P.list, e = m.instanceMatrix.array, c = m.instanceColor.array, f = g.attributes.aFade.array; let n = 0;
        for (let i = 0; i < L.length; i++) {
            const p = L[i]; p.t += dt; if (p.t >= p.life) continue; L[n] = p;
            p.vy -= p.fall * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5; if (p.y < 0.02 && p.fall) { p.y = 0.02; p.vy = 0; }
            const s = p.size + p.grow * p.t, o = n * 16, k = p.t / p.life;
            // the plane lies flat (x, z): its x goes along the camera's right, its z along the camera's up
            e[o] = cw[0] * s; e[o + 1] = cw[1] * s; e[o + 2] = cw[2] * s; e[o + 3] = 0; e[o + 4] = cw[8]; e[o + 5] = cw[9]; e[o + 6] = cw[10]; e[o + 7] = 0; e[o + 8] = -cw[4] * s; e[o + 9] = -cw[5] * s; e[o + 10] = -cw[6] * s; e[o + 11] = 0; e[o + 12] = p.x; e[o + 13] = p.y; e[o + 14] = p.z; e[o + 15] = 1;
            if (flat) { e[o] = s; e[o + 1] = 0; e[o + 2] = 0; e[o + 4] = 0; e[o + 5] = 1; e[o + 6] = 0; e[o + 8] = 0; e[o + 9] = 0; e[o + 10] = s; }
            c[n * 3] = p.r; c[n * 3 + 1] = p.g; c[n * 3 + 2] = p.b; f[n] = p.hold ? p.a * (0.82 + 0.18 * Math.sin(p.t * p.hold)) : p.a * (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88); n++;
        }
        L.length = n; m.count = n; if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; g.attributes.aFade.needsUpdate = true; }
    };
    P.clear = () => { P.list.length = 0; m.count = 0; };
    return P;
}

// once: the scene, the cameras, the lights, and every small moving thing (they outlive any one map)
World.setup = function () {
    const scene = World.scene = HG3D.node(); World.rig = lightRig(scene);
    World.camera = HG3D.camera(72, innerWidth / innerHeight, 0.08, 600);
    // the gun has its own tiny scene, drawn over the world, so it never pokes through a wall
    const gs = World.gunScene = HG3D.node(); World.gunRig = lightRig(gs); World.gunCam = HG3D.camera(50, innerWidth / innerHeight, 0.03, 10); World.gunCam.lookFrom(0, 0, 0, 0, 0, -1);
    const glow = World.glowTex = blobTexture(64, [[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,190,90,.8)'], [0.6, 'rgba(255,120,30,.25)'], [1, 'rgba(255,90,0,0)']], true);
    const soft = blobTexture(64, [[0, 'rgba(255,255,255,.9)'], [0.5, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']], true);
    World.sparks = makePuffs(scene, 40, glow, true); World.smoke = makePuffs(scene, 90, soft, false); World.lite = App.lite; World.halos = makePuffs(scene, 72, glow, true); World.halos.mesh.visible = !World.lite; World.glows = [];
    World.rings = makePuffs(scene, 12, blobTexture(128, [[0, 'rgba(255,255,255,0)'], [0.6, 'rgba(255,255,255,0)'], [0.82, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']], true), true, true);
    World.scorch = makePuffs(scene, 26, blobTexture(64, [[0, 'rgba(0,0,0,0.9)'], [0.55, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']], true), false, true); World.scorch.mesh.renderOrder = 1;
    World.flash = HG3D.mesh(quadGeo(), HG3D.material({ lit: false, map: glow, transparent: true, blending: 2, depthWrite: false, fog: false, side: 2 })); World.flash.visible = false; World.flash.frustumCulled = false; gs.add(World.flash);
    // tracers: a thin bright streak along each bullet for a moment (one draw call)
    { const g = HG3D.geo.plane(1, 1); g.attributes.aFade = HG3D.attr(new Float32Array(24), 1, true);
        const hook = { key: 'ash-puff', vDecl: 'in float aFade; out float vFade;', vMain: ' vFade = aFade;', fDecl: 'in float vFade;', fAlbedo: ' alpha *= vFade;' };
        const tt = (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 8, 0); gr.addColorStop(0, 'rgba(255,220,150,0)'); gr.addColorStop(0.5, 'rgba(255,240,200,1)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); x.fillStyle = gr; x.fillRect(0, 0, 8, 64); return HG3D.texture(c, { srgb: true }); })();
        const m = World.tracers = HG3D.instanced(g, HG3D.material({ lit: false, map: tt, transparent: true, blending: 2, depthWrite: false, side: 2, fog: false, hg: hook }), 24); m.frustumCulled = false; m.count = 0; m.list = []; m.renderOrder = 3; scene.add(m); }
    // spent casings: they fly out, fall, bounce and lie there for a while (one draw call)
    World.brass = HG3D.instanced(HG3D.geo.box(0.011, 0.011, 0.042), HG3D.material({ color: 0x8a6a2a }), 32); World.brass.frustumCulled = false; World.brass.count = 0; World.brass.list = []; scene.add(World.brass);
    // thrown things (grenades) and things lying about (ammo, medkits): plain lit boxes and balls, one draw call each kind
    World.balls = HG3D.instanced(HG3D.geo.sphere(0.06, 8, 6), HG3D.material({ color: 0x2c3326 }), 12); World.balls.frustumCulled = false; World.balls.count = 0; scene.add(World.balls);
    World.crates = HG3D.instanced(HG3D.geo.box(0.34, 0.2, 0.22), HG3D.material({ color: 0xffffff }), 24, { colors: true }); World.crates.frustumCulled = false; World.crates.count = 0; scene.add(World.crates);
    // soft shadows: each figure darkens the ground twice, a small patch at its feet and a long one away from the sun (only
    // where the baked light says the sun reaches). One instanced mesh, multiplied onto the picture; aFade = how dark.
    const shTex = blobTexture(64, [[0, '#303030'], [0.5, '#4c4c4c'], [0.8, '#b4b4b4'], [1, '#ffffff']], true), shGeo = HG3D.geo.plane(1, 1); shGeo.attributes.aFade = HG3D.attr(new Float32Array(128), 1, true);
    const shHook = { key: 'ash-shade', vDecl: 'in float aFade; out float vFade;', vMain: ' vFade = aFade;', fDecl: 'in float vFade;', fAlbedo: ' alb = mix(vec3(1.0), alb, vFade);' };
    const sh = World.shadows = HG3D.instanced(shGeo, HG3D.material({ lit: false, map: shTex, transparent: true, blending: 4, depthWrite: false, fog: false, toneMapped: false, hg: shHook }), 128); sh.frustumCulled = false; sh.count = 0; scene.add(sh);
    // the ash: flakes drifting down round the camera, and a few embers going up
    World.ash = makePuffs(scene, 260, soft, false); World.embers = makePuffs(scene, 110, glow, true); World.ashT = 0;
};
// leave the map that is loaded: its pictures and models go back to the graphics card
World.floorL = function (L) { const bl = World.map && World.map.bloom, f = bl ? 0.055 : 0.02;
    /* beside a heart of the growth the light is one strong colour and very bright: the gun and the ashen take half of that colour and no more than a sane brightness, or they turn into flat green (or violet) shapes */
    if (bl) { const l = 0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2], m = Math.max(L[0], L[1], L[2]), k = m > 0.6 ? 0.6 / m : 1; for (let i = 0; i < 3; i++) L[i] = (l + (L[i] - l) * 0.5) * k; } if (L[0] < f) L[0] = f; if (L[1] < f * 1.1) L[1] = f * 1.1; if (L[2] < f * 1.35) L[2] = f * 1.35; };
World.setLite = function (n) { World.lite = n; if (World.halos) World.halos.mesh.visible = n < 1; };
World.unload = function () {
    if (World.halos) { World.halos.clear(); World.rings.clear(); World.scorch.clear(); } World.glows = [];
    if (!World.loaded) return; World.loaded = false; World.clearFx(); World.ash.clear(); World.embers.clear(); Foes.clear(); Foes.leaveMap();
    World.scene.remove(World.mapNode); R.release(World.mapNode, World.A.textures.concat(Object.keys(World.A.skins).map(k => World.A.skins[k].tex)));
    World.A = null; World.mapNode = null; World.dome = null; World.sunGlow = null; World.id = '';
};
// loads wait their turn: the menu loads a map behind itself, and DEPLOY pressed before that is done must not start a second one
World.load = function (id, prog) { const run = () => World.load1(id, prog); return World.busy = (World.busy || Promise.resolve()).then(run, run); };
World.load1 = async function (id, prog) {
    const M = MAPS[id]; if (!M) throw new Error('no such map: ' + id);
    if (World.loaded && World.id === id) return;
    if (!World.scene) World.setup();
    if (World.loaded) World.unload();
    if (prog) prog(0.1); await Packs.ready;
    const A = World.A = await HG3D.load(Q.get('map') || AST(M.file + '.hgm'), { anisotropy: +Q.get('aniso') || 4, shrink: f => /_(light|sky)[._]/.test(f) ? 0 : 512 }), J = A.json;
    if (prog) prog(0.8);
    const scene = World.scene, mapNode = World.mapNode = HG3D.node(); mapNode.add(A.scene); scene.add(mapNode); World.id = id; World.map = M;
    World.exposure = World.atmosphere(M.fog[0], M.fog[1], M.bright); World.gunScene.fog = scene.fog;
    World.halos.clear(); World.glows = (J.glows || []).slice(0, 96).map(g => ({ x: g[0], y: g[1], z: g[2], r: g[3], g: g[4], b: g[5], s: g[6] || 2 }));
    for (const g of World.glows) { World.halos.add(g.x, g.y, g.z, 0, 0, 0, clamp(g.s * 0.55, 0.6, 3.4), 0, 1e9, g.r, g.g, g.b, 0.4); World.halos.list[World.halos.list.length - 1].hold = 0.6 + Math.random() * 0.9; }
    World.rig.set(J.sun ? J.sun.dir : [0.3, 0.9, 0.3], J.sun ? J.sun.color : [1, 1, 1]);
    const sd = J.sun ? J.sun.dir : [0, 1, 0], sl = Math.hypot(sd[0], sd[2]) || 1; World.shDir = [-sd[0] / sl, -sd[2] / sl, Math.min(2.6, sd[1] > 0.05 ? sl / sd[1] : 2.6)];       // which way shadows fall, how long per metre of height
    // ---- what is solid: the collision map, and a coarser grid the ashen find their way on
    const G = World.G = J.grid, d = World.cols = A.view(G.data), nx = G.nx, nz = G.nz, blk = World.blk = new Uint8Array(nx * nz);
    /* a column holds up to three blocks: [0,1] the one on the ground, [2,3] the first thing above it (a table top, a truck bed, a beam), and in cols2 [0,1] all that is above that (a roof). Older maps have no cols2: their second block runs up to the roof. */
    const e2 = World.cols2 = G.data2 ? A.view(G.data2) : null;
    for (let i = 0; i < nx * nz; i++) blk[i] = (d[i * 4 + 1] * G.q > 0.45 || (d[i * 4 + 3] > 0 && d[i * 4 + 2] * G.q < 1.85)) ? 1 : 0;
    /* low things a jump can put you on (a crate, a barrier, a bonnet): how high their tops are. 0 = not that kind (the floor, a wall, something with no headroom over it) */
    const hop = World.hop = new Float32Array(nx * nz); for (let i = 0; i < nx * nz; i++) { const q = G.q, lt = d[i * 4 + 1] * q, mid = d[i * 4 + 3] > 0, ml = mid ? d[i * 4 + 2] * q : 99, mh = mid ? d[i * 4 + 3] * q : 0, hl = e2 && e2[i * 2 + 1] > 0 ? e2[i * 2] * q : 99;
        const stack = mid && ml < lt + 1.85, T = stack ? mh : lt, above = stack ? hl : Math.min(ml, hl); if (T > 0.45 && T <= 2 && above >= T + 1.75) hop[i] = T; }          /* nobody walks under a second block that close: its top is what can be stood on */
    const NX = World.NX = nx >> 1, NZ = World.NZ = nz >> 1, nav = World.nav = new Uint8Array(NX * NZ);
    for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) nav[z * NX + x] = (blk[z * 2 * nx + x * 2] | blk[z * 2 * nx + x * 2 + 1] | blk[(z * 2 + 1) * nx + x * 2] | blk[(z * 2 + 1) * nx + x * 2 + 1]) || x < 2 || z < 2 || x > NX - 3 || z > NZ - 3 ? 1 : 0;
    World.queue = new Int32Array(NX * NZ);
    const B = World.bounds = J.bounds; World.mid = [(B.min[0] + B.max[0]) / 2, (B.min[2] + B.max[2]) / 2]; World.size = Math.min(B.max[0] - B.min[0], B.max[2] - B.min[2]);
    // every free spot that can be walked to from the middle, and a ring of them to start players and round trips from
    /* the start: the spot nearest the middle with room round it, in the biggest walkable part of the map (not a pocket between shelves) */
    const F = World.mainFlow = World.newFlow(); let bestR = -1, bestH = null, open = 0; for (let i = 0; i < NX * NZ; i++) if (!nav[i]) open++;
    for (let k = 0; k < 9 && bestR < open * 0.5; k++) { const a = k * 2.4, d = k ? 2 + k * 1.5 : 0, h = World.free(World.mid[0] + Math.cos(a) * d, World.mid[1] + Math.sin(a) * d, 0.6); World.flow(F, h[0], h[1]); if (F.reach > bestR) { bestR = F.reach; bestH = h; } }
    World.home = bestH; World.flow(F, bestH[0], bestH[1]); World.reach = F.reach;
    if (F.reach < 300) console.warn('[Ashfall] map ' + id + ': only ' + F.reach + ' path cells can be reached from the middle (its collision map is wrong)');
    World.spots = []; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, p = World.free(World.mid[0] + Math.cos(a) * World.size * 0.3, World.mid[1] + Math.sin(a) * World.size * 0.3, 0.5); if (F.dist[World.cell(p[0], p[1])] >= 0) World.spots.push(p); }
    World.resize(innerWidth / innerHeight); R.toneMappingExposure = World.exposure; World.relight(); R.compile(scene, World.camera);
    World.loaded = true; World.flyA = Math.random() * 6.28; Foes.enterMap(); if (prog) prog(1);
};
World.resize = a => { if (!World.camera) return; World.camera.aspect = a; World.camera.updateProjection(); World.gunCam.aspect = a; World.gunCam.updateProjection(); };

// THE LOOK. The owner, 2026-11-24: "I was completely wrong about Ashfall... Completely switch it back... like the OG Ashfall lighting
// except with the blocky shooter Cinematic mode effects, mostly involving the sun, but I also want all the other lighting modes from
// Blocky Shooter too... no crystals at all". So: every map is shown exactly as its bake was tuned in the first builds (ashen dusk; the
// map files are built with `plain`: no growth, no crystals, no blue), and the PICTURE setting (App.pic(), 10-core.js) only ADDS:
// HIGH the glow round lights and the sun's glare, CINEMATIC a stronger glow, the sun's rays, film grain, a lens vignette and a warm grade.
const LOOK = { glow: { strength: 0.45, threshold: 0.86, knee: 0.2, wide: 0.7 }, cine: { strength: 0.6, threshold: 0.86, knee: 0.2, wide: 0.85 } };      // the threshold keeps the pale ash sky out of the glow: only lamps, fire and muzzle flashes spread
World.relight = function () {
    const P = App.pic(), k = +Q.get('dark') || 1, cine = P.film > 0;
    R.gradeLo = cine ? [0.95, 1.0, 1.05] : [1, 1, 1]; R.gradeHi = cine ? [1.06, 1.0, 0.93] : [1, 1, 1]; R.gradeSaturation = World.sat0 = cine ? 0.24 : 0.16; R.gradeContrast = cine ? 0.07 : P.glow ? 0.05 : 0.04;
    R.toneMappingExposure = World.exposure * k; World.glow = P.glow > 1 ? LOOK.cine : LOOK.glow;
    if (World.scene && World.scene.fog && World.fogRGB) { const f = World.fogRGB; World.scene.fog.color = { r: f[0] * k, g: f[1] * k, b: f[2] * k }; }
    if (World.dome && World.domeK) World.dome.material.color = { r: World.domeK * k, g: World.domeK * k, b: World.domeK * k };
    document.body.classList.toggle('film', cine); if (typeof Sun !== 'undefined') Sun.setup();
};
// sky + fog + exposure from what the exporter measured in the Blender scene
World.atmosphere = function (fogNear, fogFar, bright) {
    const A = World.A, scene = World.scene, J = A.json, sunC = J.sun ? J.sun.color : [0, 0, 0], amb = J.ambient || [1, 1, 1], up = J.sun ? Math.max(J.sun.dir[1], 0.35) : 0;      // a low sun still lights the walls that face it fully
    const exposure = (+Q.get('exp') || 1) * Math.min((World.map && World.map.cap) || 6, (bright || 0.9) / Math.max(0.05, lum(amb) + lum(sunC) * up));          // as the first builds had it; the cap only stops a nearly black bake being blown out
    if (J.sky) {
        const dome = HG3D.skyDome(A.textures[J.sky.map], 450), k = J.sky.range; dome.material.color = { r: k, g: k, b: k }; World.mapNode.add(dome); World.dome = dome; World.domeK = k;
        const f = aces(J.sky.horizon, exposure), fog = HG3D.fog(0, fogNear, fogFar); fog.color = { r: f[0], g: f[1], b: f[2] }; scene.fog = fog; World.fogRGB = f;
    }
    if (J.sun && J.sun.dir[1] > 0 && !(World.map && World.map.bloom)) {       // the sun itself: a glow in the sky where the baked shadows say it is (walls hide it)
        const d = J.sun.dir, c = J.sun.lampColor || [1, 0.9, 0.8], hex = v => Math.round(clamp(v, 0, 1) * 255), col = a => 'rgba(' + hex(0.6 + c[0] * 0.4) + ',' + hex(0.6 + c[1] * 0.4) + ',' + hex(0.6 + c[2] * 0.4) + ',' + a + ')';
        const g = HG3D.mesh(quadGeo(), HG3D.material({ lit: false, map: blobTexture(128, [[0, 'rgba(255,255,250,1)'], [0.03, col(0.8)], [0.08, col(0.14)], [0.2, col(0.03)], [1, col(0)]], true), transparent: true, blending: 2, depthWrite: false, fog: false, side: 2 }));
        g.frustumCulled = false; g.renderOrder = -1; World.mapNode.add(g); World.sunGlow = g;
        let rx = d[2], rz = -d[0], l = Math.hypot(rx, rz) || 1; rx /= l; rz /= l; const ux = d[1] * rz, uy = d[2] * rx - d[0] * rz, uz = -d[1] * rx, s = 170, e = g.matrixWorld.elements;
        e[0] = rx * s; e[1] = 0; e[2] = rz * s; e[4] = ux * s; e[5] = uy * s; e[6] = uz * s; e[8] = d[0]; e[9] = d[1]; e[10] = d[2];
    }
    return exposure;
};

// ---- the collision map
World.blocked = function (x, z, r) {
    const G = World.G, c = G.cell, nx = G.nx, x0 = Math.floor((x - r - G.x0) / c), x1 = Math.floor((x + r - G.x0) / c), z0 = Math.floor((z - r - G.z0) / c), z1 = Math.floor((z + r - G.z0) / c);
    if (x0 < 0 || z0 < 0 || x1 >= nx || z1 >= G.nz) return true;
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) if (World.blk[iz * nx + ix]) {
        const qx = clamp(x, G.x0 + ix * c, G.x0 + (ix + 1) * c) - x, qz = clamp(z, G.z0 + iz * c, G.z0 + (iz + 1) * c) - z; if (qx * qx + qz * qz < r * r) return true;
    }
    return false;
};
// the same for someone whose feet are y off the floor: low things they are above no longer stop them, a low roof does
World.blockedAt = function (x, z, r, y) {
    if (!(y > 0)) return World.blocked(x, z, r);
    const G = World.G, c = G.cell, nx = G.nx, d = World.cols, x0 = Math.floor((x - r - G.x0) / c), x1 = Math.floor((x + r - G.x0) / c), z0 = Math.floor((z - r - G.z0) / c), z1 = Math.floor((z + r - G.z0) / c);
    if (x0 < 0 || z0 < 0 || x1 >= nx || z1 >= G.nz) return true;
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) { const i = iz * nx + ix, h = World.hop[i];
        if (!(World.blk[i] && !(h && y >= h - 0.1)) && !(World.over(i, y) < y + 1.7)) continue;
        const qx = clamp(x, G.x0 + ix * c, G.x0 + (ix + 1) * c) - x, qz = clamp(z, G.z0 + iz * c, G.z0 + (iz + 1) * c) - z; if (qx * qx + qz * qz < r * r) return true;
    }
    return false;
};
// the underside of the lowest thing over someone whose feet are y up in a column (99: open sky). What their feet are on, or above, does not count.
World.over = function (i, y) { const d = World.cols, e = World.cols2, q = World.G.q; let r = 99; if (d[i * 4 + 3] > 0 && d[i * 4 + 3] * q > y + 0.15) r = Math.max(d[i * 4 + 2] * q, 0); if (e && e[i * 2 + 1] > 0 && e[i * 2 + 1] * q > y + 0.15 && e[i * 2] * q < r) r = e[i * 2] * q; return r; };
// the top of the low thing(s) that stop someone at a place (feet y up), or 0 if a wall or a roof is in it too, or nothing is
World.ledge = function (x, z, r, y) {
    const G = World.G, c = G.cell, nx = G.nx, x0 = Math.floor((x - r - G.x0) / c), x1 = Math.floor((x + r - G.x0) / c), z0 = Math.floor((z - r - G.z0) / c), z1 = Math.floor((z + r - G.z0) / c); if (x0 < 0 || z0 < 0 || x1 >= nx || z1 >= G.nz) return 0; let top = 0;
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) { const i = iz * nx + ix, h = World.hop[i], wall = World.blk[i] && !h, roof = World.over(i, Math.max(y, h || 0)) < Math.max(y, h || 0) + 1.7; if (!wall && !roof && !(h > y + 0.1)) continue;
        const qx = clamp(x, G.x0 + ix * c, G.x0 + (ix + 1) * c) - x, qz = clamp(z, G.z0 + iz * c, G.z0 + (iz + 1) * c) - z; if (qx * qx + qz * qz >= r * r) continue; if (wall || roof) return 0; if (h > top) top = h; }
    return top;
};
// what is under someone's feet there (the floor is 0, the top of a low thing they are over is more); World.roof = the lowest thing over their head
World.under = function (x, z, r, y) {
    const G = World.G, c = G.cell, nx = G.nx, d = World.cols, x0 = Math.max(0, Math.floor((x - r - G.x0) / c)), x1 = Math.min(nx - 1, Math.floor((x + r - G.x0) / c)), z0 = Math.max(0, Math.floor((z - r - G.z0) / c)), z1 = Math.min(G.nz - 1, Math.floor((z + r - G.z0) / c));
    let top = 0, roof = 99;
    for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) { const i = iz * nx + ix, h = World.hop[i], ob = World.over(i, y); if (!(h > top && h <= y + 0.1) && !(ob < roof)) continue;
        const qx = clamp(x, G.x0 + ix * c, G.x0 + (ix + 1) * c) - x, qz = clamp(z, G.z0 + iz * c, G.z0 + (iz + 1) * c) - z; if (qx * qx + qz * qz >= r * r) continue; if (h > top && h <= y + 0.1) top = h; if (ob < roof) roof = ob;
    }
    World.roof = roof; return top;
};
// how far a ray goes before it meets something solid (the direction is one unit long)
World.ray = function (ox, oy, oz, dx, dy, dz, max) {
    const G = World.G, d = World.cols, e2 = World.cols2, q = G.q, step = G.cell * 0.5, nx = G.nx, nz = G.nz;
    for (let t = 0.15; t < max; t += step) {
        const y = oy + dy * t; if (y <= 0) return t;
        const ix = Math.floor((ox + dx * t - G.x0) / G.cell), iz = Math.floor((oz + dz * t - G.z0) / G.cell); if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
        const i = (iz * nx + ix) * 4;
        if (d[i + 1] > 0 && y >= d[i] * q && y <= d[i + 1] * q) return t;
        if (d[i + 3] > 0 && y >= d[i + 2] * q && y <= d[i + 3] * q) return t;
        if (e2 && e2[(i >> 1) + 1] > 0 && y >= e2[i >> 1] * q && y <= e2[(i >> 1) + 1] * q) return t;
    }
    return max;
};
// can one point see another (eye height to eye height)
World.sees = function (ax, az, bx, bz, h) { const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz); if (l < 0.3) return true; return World.ray(ax, h || 1.5, az, dx / l, 0, dz / l, l) >= l - 0.2; };
World.cell = function (x, z) { const G = World.G; return clamp(Math.floor((z - G.z0) / (G.cell * 2)), 0, World.NZ - 1) * World.NX + clamp(Math.floor((x - G.x0) / (G.cell * 2)), 0, World.NX - 1); };
World.cellX = c => World.G.x0 + (c % World.NX + 0.5) * World.G.cell * 2;
World.cellZ = c => World.G.z0 + ((c / World.NX | 0) + 0.5) * World.G.cell * 2;
// the nearest free spot to a point (centre of a free path cell)
World.free = function (x, z, room) {
    const NX = World.NX, NZ = World.NZ, c0 = World.cell(x, z), x0 = c0 % NX, z0 = c0 / NX | 0;
    for (let r = 0; r < 40; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const cx = x0 + dx, cz = z0 + dz; if (cx < 0 || cz < 0 || cx >= NX || cz >= NZ || World.nav[cz * NX + cx]) continue;
        if (room && World.blocked(World.cellX(cz * NX + cx), World.cellZ(cz * NX + cx), room)) continue;      /* room to stand and to step off */
        return [World.cellX(cz * NX + cx), World.cellZ(cz * NX + cx)];
    }
    return [x, z];
};
// a flow: steps to a goal from every free cell (breadth first); walkers go downhill on it. One per thing being hunted.
World.newFlow = () => ({ dist: new Int16Array(World.NX * World.NZ), reach: 0, x: 0, z: 0 });
World.flow = function (F, gx, gz) {
    const NX = World.NX, NZ = World.NZ, nav = World.nav, dist = F.dist, q = World.queue; dist.fill(-1);
    const g = World.free(gx, gz), c0 = World.cell(g[0], g[1]); let h = 0, t = 0; dist[c0] = 0; q[t++] = c0; F.x = gx; F.z = gz;
    while (h < t) {
        const c = q[h++], x = c % NX, z = c / NX | 0, n = dist[c] + 1;
        if (x > 0 && !nav[c - 1] && dist[c - 1] < 0) { dist[c - 1] = n; q[t++] = c - 1; }
        if (x < NX - 1 && !nav[c + 1] && dist[c + 1] < 0) { dist[c + 1] = n; q[t++] = c + 1; }
        if (z > 0 && !nav[c - NX] && dist[c - NX] < 0) { dist[c - NX] = n; q[t++] = c - NX; }
        if (z < NZ - 1 && !nav[c + NX] && dist[c + NX] < 0) { dist[c + NX] = n; q[t++] = c + NX; }
    }
    F.reach = t; return F;
};
// the neighbour (8 ways, no cutting corners) that is closest to the goal
World.next = function (F, c) {
    const NX = World.NX, dist = F.dist, nav = World.nav, x = c % NX; let best = c, bd = dist[c] < 0 ? 32767 : dist[c] * 2;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const n = c + dz * NX + dx; if (x + dx < 0 || x + dx >= NX || n < 0 || n >= dist.length || dist[n] < 0) continue;
        if (dx && dz && (nav[c + dx] || nav[c + dz * NX])) continue;
        const v = dist[n] * 2 + (dx && dz ? 1 : 0); if (v < bd) { bd = v; best = n; }
    }
    return best;
};
// a free spot at least `min` steps of the flow away from its goal (where the ashen climb in)
World.farSpot = function (F, min) {
    const dist = F.dist; let tries = 60, near = 90; const max = min + 60;          // on a big map: not at the far end of it (a long empty wait), somewhere 12 to 40 m off
    while (near--) { const c = Math.random() * dist.length | 0; if (dist[c] >= min && dist[c] <= max) return [World.cellX(c), World.cellZ(c)]; }
    while (tries--) { const c = Math.random() * dist.length | 0; if (dist[c] >= min) return [World.cellX(c), World.cellZ(c)]; }
    for (let c = 0; c < dist.length; c++) if (dist[c] >= Math.min(min, 8)) return [World.cellX(c), World.cellZ(c)];
    return World.home;
};

// ---- the small moving things
World.tracer = function (ax, ay, az, bx, by, bz) { const L = World.tracers.list; if (L.length >= 24) L.shift(); L.push({ ax, ay, az, bx, by, bz, t: 0 }); };
World.casing = function (x, y, z, vx, vy, vz) { const L = World.brass.list; if (L.length >= 32) L.shift(); L.push({ x, y, z, vx, vy, vz, a: Math.random() * 6.28, b: Math.random() * 6.28, spin: 14 + Math.random() * 12, t: 0, rest: false }); };
World.dust = function (x, y, z, n, r, g, b) { for (let i = 0; i < (n || 3); i++) World.smoke.add(x, y, z, rand(-0.6, 0.6), rand(0.2, 1), rand(-0.6, 0.6), 0.12, 0.9, rand(0.4, 0.8), r === undefined ? 0.55 : r, g === undefined ? 0.52 : g, b === undefined ? 0.48 : b, 0.6); };
World.blood = function (x, y, z, n) { for (let i = 0; i < (n || 4); i++) World.smoke.add(x, y, z, rand(-1.4, 1.4), rand(0.3, 2), rand(-1.4, 1.4), 0.08, 0.5, rand(0.25, 0.5), 0.16, 0.02, 0.02, 0.9, 6); };
World.spark = function (x, y, z, size) { World.sparks.add(x, y, z, 0, 0, 0, size || 0.4, -2, 0.09, 1, 1, 1, 1); };
World.boom = function (x, y, z, big) {
    const k = big ? 1 : 0.5; World.sparks.add(x, y + 0.4 * k, z, 0, 1, 0, 3 * k, 9 * k, 0.22, 1, 1, 1, 1);
    for (let i = 0; i < (big ? 4 : 2); i++) World.sparks.add(x + rand(-0.6, 0.6) * k, y + 0.5 * k + rand(0, 0.8) * k, z + rand(-0.6, 0.6) * k, rand(-1, 1), rand(1.5, 3.5), rand(-1, 1), 1.6 * k, 5 * k, rand(0.35, 0.6), 1, rand(0.45, 0.65), 0.12, 0.95);          /* the fireball */
    if (y < 1.6) { World.rings.add(x, 0.06, z, 0, 0, 0, 1.2 * k, 34 * k, 0.42, 1, 0.82, 0.55, 0.8); World.rings.add(x, 0.05, z, 0, 0, 0, 0.8 * k, 14 * k, 0.9, 0.6, 0.55, 0.5, 0.35); World.scorch.add(x, 0.03, z, 0, 0, 0, (big ? 4.6 : 2.2) + Math.random(), 0, big ? 26 : 14, 0, 0, 0, 0.8); const SL = World.scorch.list, sc = SL[SL.length - 1]; sc.t = sc.life * 0.12; }
    for (let i = 0; i < (big ? 10 : 4); i++) World.smoke.add(x, y + 0.3, z, rand(-5, 5) * k, rand(3, 9) * k, rand(-5, 5) * k, rand(0.07, 0.16), 0, rand(0.8, 1.5), 0.13, 0.12, 0.11, 1, 16);          /* what it throws up */
    for (let i = 0; i < (big ? 9 : 4); i++) { const a = Math.random() * 6.28, r = Math.random() * 1.2 * k; World.smoke.add(x + Math.cos(a) * r, y + 0.4 + Math.random() * k, z + Math.sin(a) * r, Math.cos(a) * 2 * k, 1 + Math.random() * 2, Math.sin(a) * 2 * k, 1.2 * k, 2 * k, 1.4 + Math.random(), 0.3, 0.28, 0.26, 0.75); }
    for (let i = 0; i < (big ? 8 : 3); i++) World.sparks.add(x, y + 0.3, z, rand(-6, 6), rand(2, 8), rand(-6, 6), 0.12, -0.1, rand(0.4, 0.9), 1, 0.8, 0.5, 1, 14);
};
World.shBegin = () => { World.shN = 0; };
World.shBlob = function (x, z, ax, az, w, len, fade) { const n = World.shN; if (n >= 128) return; const sm = World.shadows.instanceMatrix.array, o = n * 16; sm[o] = az * w; sm[o + 1] = 0; sm[o + 2] = -ax * w; sm[o + 3] = 0; sm[o + 4] = 0; sm[o + 5] = 1; sm[o + 6] = 0; sm[o + 7] = 0; sm[o + 8] = ax * len; sm[o + 9] = 0; sm[o + 10] = az * len; sm[o + 11] = 0; sm[o + 12] = x; sm[o + 13] = 0.03; sm[o + 14] = z; sm[o + 15] = 1; World.shadows.geometry.attributes.aFade.array[n] = fade; World.shN = n + 1; };
// a standing figure's two shadows: h = how tall it stands, sun = how much sun reaches it (the probe's fourth number)
World.shFigure = function (x, z, h, sun) { const d = World.shDir, len = h * d[2] + 0.5; World.shBlob(x, z, 1, 0, 1.0, 1.0, 0.6); if (sun > 0.08) World.shBlob(x + d[0] * (len * 0.5 - 0.25), z + d[1] * (len * 0.5 - 0.25), d[0], d[1], 0.85, len, sun * 0.95); };
World.shEnd = () => { const sh = World.shadows; sh.count = World.shN; if (World.shN) { sh.instanceMatrix.needsUpdate = true; sh.geometry.attributes.aFade.needsUpdate = true; } };
// once a frame: move every small thing. cw = the camera's world matrix
World.step = function (dt, cw) {
    World.sparks.update(dt, cw); World.smoke.update(dt, cw); World.halos.update(dt, cw); World.rings.update(dt, cw); World.scorch.update(dt, cw);
    if (World.glows.length && !World.lite && Math.random() < dt * 5) { const g = World.glows[(Math.random() * World.glows.length) | 0]; World.sparks.add(g.x + rand(-0.8, 0.8), g.y + rand(-0.2, 0.5), g.z + rand(-0.8, 0.8), rand(-0.12, 0.12), rand(0.12, 0.3), rand(-0.12, 0.12), 0.07, 0, rand(2.5, 4.5), g.r, g.g, g.b, 0.9); }
    // tracers: a strip from a to b, turned to face the camera
    { const m = World.tracers, L = m.list, e = m.instanceMatrix.array, f = m.geometry.attributes.aFade.array; let n = 0;
        for (let i = 0; i < L.length; i++) { const t = L[i]; t.t += dt; if (t.t > 0.07) continue; L[n] = t;
            let dx = t.bx - t.ax, dy = t.by - t.ay, dz = t.bz - t.az; const len = Math.hypot(dx, dy, dz) || 1; dx /= len; dy /= len; dz /= len;
            const mx = (t.ax + t.bx) / 2, my = (t.ay + t.by) / 2, mz = (t.az + t.bz) / 2, vx = cw[12] - mx, vy = cw[13] - my, vz = cw[14] - mz;
            let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx; const sl = Math.hypot(sx, sy, sz) || 1, w = 0.035; sx = sx / sl * w; sy = sy / sl * w; sz = sz / sl * w;
            const o = n * 16; e[o] = sx; e[o + 1] = sy; e[o + 2] = sz; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = 1; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = dx * len; e[o + 9] = dy * len; e[o + 10] = dz * len; e[o + 11] = 0; e[o + 12] = mx; e[o + 13] = my; e[o + 14] = mz; e[o + 15] = 1; f[n] = 1 - t.t / 0.07; n++; }
        L.length = n; m.count = n; if (n) { m.instanceMatrix.needsUpdate = true; m.geometry.attributes.aFade.needsUpdate = true; } }
    // casings
    { const B = World.brass, L = B.list, e = B.instanceMatrix.array; let n = 0;
        for (let i = L.length - 1; i >= 0; i--) { const c = L[i]; c.t += dt; if (c.t > 6) { L.splice(i, 1); continue; }
            if (!c.rest) { c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.a += c.spin * dt; c.b += c.spin * 0.7 * dt;
                if (World.blocked(c.x, c.z, 0.03)) { c.x -= c.vx * dt; c.z -= c.vz * dt; c.vx *= -0.3; c.vz *= -0.3; }
                if (c.y < 0.012) { c.y = 0.012; if (Math.abs(c.vy) > 1) { c.vy *= -0.35; c.vx *= 0.5; c.vz *= 0.5; c.spin *= 0.5; Snd.tone(2600 + Math.random() * 900, 0.025, 0.015, 'triangle'); } else { c.rest = true; c.b = 0; } } } }
        for (const c of L) { const o = n++ * 16, ca = Math.cos(c.a), sa = Math.sin(c.a), cb = Math.cos(c.b), sb = Math.sin(c.b), k = c.t > 5 ? 6 - c.t : 1;
            e[o] = ca * k; e[o + 1] = 0; e[o + 2] = -sa * k; e[o + 3] = 0; e[o + 4] = sa * sb * k; e[o + 5] = cb * k; e[o + 6] = ca * sb * k; e[o + 7] = 0; e[o + 8] = sa * cb * k; e[o + 9] = -sb * k; e[o + 10] = ca * cb * k; e[o + 11] = 0; e[o + 12] = c.x; e[o + 13] = c.y; e[o + 14] = c.z; e[o + 15] = 1; }
        B.count = n; if (n) B.instanceMatrix.needsUpdate = true; }
    // the ash keeps falling round the camera; an ember now and then
    World.ashT -= dt; if (World.map && World.map.indoors && !World.map.bloom) World.ashT = 1;          /* no ash falls indoors; the spores of the growth do drift there */
    while (World.ashT <= 0) { const bloom = World.map && World.map.bloom; World.ashT += (bloom ? 0.05 : 0.022) * (1 + (World.lite || 0) * 2); if (World.lite > 1) continue; const a = Math.random() * 6.28, r = 1.5 + Math.random() * 13, g = 0.5 + Math.random() * 0.3;
        if (bloom) { const gl = World.glows.length ? World.glows[(Math.random() * World.glows.length) | 0] : null, v = Math.random() < 0.45, sr = gl ? gl.r : v ? 0.7 : 0.3, sg = gl ? gl.g : v ? 0.45 : 1, sb = gl ? gl.b : v ? 1 : 0.9, sm = Math.max(sr, sg, sb, 0.001); World.embers.add(cw[12] + Math.cos(a) * r, cw[13] + rand(-1.4, 3), cw[14] + Math.sin(a) * r, rand(-0.12, 0.12), rand(0.05, 0.3), rand(-0.12, 0.12), rand(0.035, 0.07), 0, rand(3, 5.5), sr / sm, sg / sm, sb / sm, 0.75); continue; }
        World.ash.add(cw[12] + Math.cos(a) * r, cw[13] + rand(0.5, 6), cw[14] + Math.sin(a) * r, rand(-0.25, 0.25) + 0.3, rand(-0.9, -0.45), rand(-0.25, 0.25), rand(0.025, 0.06), 0, rand(3.5, 6), g, g * 0.97, g * 0.93, 0.85);
        if (Math.random() < 0.06) World.embers.add(cw[12] + Math.cos(a) * r, rand(0, 1.5), cw[14] + Math.sin(a) * r, rand(-0.3, 0.3) + 0.3, rand(0.5, 1.4), rand(-0.3, 0.3), 0.05, 0, rand(2, 4), 1, 0.6, 0.25, 1); }
    World.ash.update(dt, cw); World.embers.update(dt, cw);
    if (World.dome) { const e = World.dome.matrixWorld.elements; e[12] = cw[12]; e[13] = cw[13]; e[14] = cw[14]; }
    if (World.sunGlow) { const e = World.sunGlow.matrixWorld.elements; e[12] = cw[12] + e[8] * 380; e[13] = cw[13] + e[9] * 380; e[14] = cw[14] + e[10] * 380; }
    Sun.frame(dt, cw);
};
World.clearFx = function () { if (!World.scene) return; for (const k of ['sparks', 'smoke']) World[k].clear(); if (World.flames) World.flames.clear(); World.tracers.list.length = 0; World.tracers.count = 0; World.brass.list.length = 0; World.brass.count = 0; World.balls.count = 0; World.crates.count = 0; World.shadows.count = 0; };
// behind the main menu: a slow turn round the map
World.flyBy = function (dt) {
    World.flyA += dt * 0.045; const r = World.size * 0.36, cam = World.camera, a = World.flyA; if (cam.fov !== 55) { cam.fov = 55; cam.updateProjection(); }
    let x = World.mid[0] + Math.cos(a) * r, z = World.mid[1] + Math.sin(a) * r; const y = 9 + Math.sin(a * 1.7) * 1.5;
    cam.lookFrom(x, y, z, World.mid[0] - Math.cos(a) * r * 0.2, 1.2, World.mid[1] - Math.sin(a) * r * 0.2);
    World.step(dt, cam.matrixWorld.elements); draw(World.scene, cam, true);
};
