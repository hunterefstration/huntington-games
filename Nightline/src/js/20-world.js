// ============================================================
// The city. One file per circuit (assets/<id>.hgm: the road, the buildings, the lamps, their light baked in, the sky), drawn
// as it is. On top of it, each frame: the LIGHTS ON THE WET ROAD (every lamp and sign near the road, and every car's lamps,
// gets a streak of its own colour lying on the asphalt between it and the eye: what a wet street does at night), soft halos
// round the lamps, tyre smoke, sparks, and HG3D's glow over the finished picture.
// If the file is not there the circuit is still driveable: a plain stand-in is built from the centre line (World.standIn).
// ============================================================
const World = { loaded: false, scene: null, camera: null, A: null, node: null, glows: [], exposure: 1, id: '', standin: false, lampK: 1 };
// THE LOOK of every circuit: how bright the baked night is shown, the tint of the finished picture, the glow.
const LOOK = { key: 0.42, ambK: 0.3, bright: +Q.get('bright') || 0.42, lo: [0.90, 0.96, 1.12], hi: [1.04, 1.0, 0.97], sat: 0.22, con: 0.08, glow: { strength: 0.62, threshold: 0.66, knee: 0.3, wide: 0.8 } };

// soft puffs (smoke, sparks, halos): all of one kind in one draw call, each facing the camera, each with its own colour and fade
function makePuffs(scene, max, tex, additive) {
    const g = HG3D.geo.plane(1, 1); g.attributes.aFade = HG3D.attr(new Float32Array(max), 1, true);
    const hook = { key: 'nl-puff', vDecl: 'in float aFade; out float vFade;', vMain: ' vFade = aFade;', fDecl: 'in float vFade;', fAlbedo: ' alpha *= vFade;' };
    const m = HG3D.instanced(g, HG3D.material({ lit: false, map: tex, transparent: true, blending: additive ? 2 : 1, depthWrite: false, side: 2, fog: !additive, hg: hook }), max, { colors: true });
    m.renderOrder = additive ? 4 : 3; m.count = 0; scene.add(m);
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
// flat things laid on the road, rebuilt every frame: the streaks of light on the wet asphalt, the pools under headlamps,
// the shadows under the cars. begin(), put(...) for each, end().
function makeDecals(scene, max, tex, additive, order) {
    const g = HG3D.geo.plane(1, 1); g.attributes.aFade = HG3D.attr(new Float32Array(max), 1, true);
    const hook = { key: 'nl-puff', vDecl: 'in float aFade; out float vFade;', vMain: ' vFade = aFade;', fDecl: 'in float vFade;', fAlbedo: ' alpha *= vFade;' };
    const m = HG3D.instanced(g, HG3D.material({ lit: false, map: tex, transparent: true, blending: additive ? 2 : 1, depthWrite: false, side: 2, fog: false, hg: hook }), max, { colors: true });
    m.renderOrder = order; m.count = 0; scene.add(m); let n = 0;
    return { mesh: m, begin() { n = 0; },
        // centre x,y,z; (ax, az) the unit direction of its long side; length, width; slope of the road along that direction; colour; strength
        put(x, y, z, ax, az, len, wid, r, g2, b, a, rise) {
            if (n >= max) return; const e = m.instanceMatrix.array, o = n * 16, c = m.instanceColor.array;
            e[o] = az * wid; e[o + 1] = 0; e[o + 2] = -ax * wid; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = 1; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = ax * len; e[o + 9] = (rise || 0) * len; e[o + 10] = az * len; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1;
            c[n * 3] = r; c[n * 3 + 1] = g2; c[n * 3 + 2] = b; g.attributes.aFade.array[n] = a; n++;
        },
        end() { m.count = n; if (n) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; g.attributes.aFade.needsUpdate = true; } } };
}
World.setup = function () {
    const scene = World.scene = HG3D.node(); World.camera = HG3D.camera(64, innerWidth / innerHeight, 0.25, 1500);
    const hemi = HG3D.light.hemi(0xffffff, 0xffffff, Math.PI), sun = HG3D.light.sun(0xffffff, Math.PI, [0, 1, 0]); hemi.color = { r: 1, g: 1, b: 1 }; hemi.groundColor = { r: 0.5, g: 0.5, b: 0.55 }; scene.add(hemi, sun); World.hemi = hemi; World.sun = sun;
    const glow = blobTexture(64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.5)'], [0.6, 'rgba(255,255,255,.1)'], [1, 'rgba(255,255,255,0)']], true), soft = blobTexture(64, [[0, 'rgba(255,255,255,.55)'], [0.5, 'rgba(255,255,255,.22)'], [1, 'rgba(255,255,255,0)']], true);
    // a streak: bright along its middle, dying toward both ends and both sides
    const sc = document.createElement('canvas'); sc.width = 32; sc.height = 128; { const c = sc.getContext('2d'), im = c.createImageData(32, 128); for (let y = 0; y < 128; y++) for (let x = 0; x < 32; x++) { const u = Math.abs(x / 31 - 0.5) * 2, v = y / 127, a = Math.pow(1 - u, 2.2) * Math.pow(Math.sin(v * Math.PI), 1.4) * (0.75 + 0.25 * Math.sin(y * 1.9) * Math.sin(y * 0.37 + x)); const o = (y * 32 + x) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; im.data[o + 3] = clamp(a, 0, 1) * 255; } c.putImageData(im, 0, 0); }
    World.wet = makeDecals(scene, 640, HG3D.texture(sc, { srgb: true }), true, 2);
    World.pools = makeDecals(scene, 40, glow, true, 2);
    World.shade = makeDecals(scene, 16, blobTexture(64, [[0, 'rgba(0,0,0,.8)'], [0.6, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']], true), false, 1);
    World.skids = makeDecals(scene, 400, blobTexture(32, [[0, 'rgba(0,0,0,.6)'], [0.7, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']], true), false, 1); World.skidList = [];
    World.halos = makePuffs(scene, 320, glow, true); World.smoke = makePuffs(scene, 120, soft, false); World.sparks = makePuffs(scene, 90, glow, true);
    World.glowTex = glow;
};
World.unload = function () {
    if (!World.loaded) return; World.loaded = false; World.scene.remove(World.node); if (World.A) R.release(World.node, World.A.textures); else R.release(World.node);
    World.A = null; World.node = null; World.glows = []; World.halos.clear(); World.smoke.clear(); World.sparks.clear(); World.skidList.length = 0; World.scene.fog = null; World.dome = null;
};
World.load = async function (id, prog) {
    if (!World.scene) World.setup(); if (World.loaded && World.id === id) return; World.unload(); if (prog) prog(0.05);
    Track.use(id); World.id = Track.id; const node = World.node = HG3D.node(); World.scene.add(node); let A = null;
    if (Q.get('standin') !== '1') try { await Packs.ready; A = await HG3D.load(Q.get('map') || AST(Track.id + '.hgm'), { anisotropy: +Q.get('aniso') || 4, shrink: f => /props_light|_light_/.test(f) ? 0 : /_sky|ground|road|asphalt/.test(f) ? 0 : (App.lite ? 512 : 0) }); } catch (e) { A = null; World.why = String(e && e.message || e); }
    if (prog) prog(0.8);
    World.A = A; World.standin = !A; World.bright = LOOK.bright;
    if (A) {
        const J = A.json; node.add(A.scene);
        const sunC = J.sun ? J.sun.color : [0, 0, 0], amb = J.ambient || [0.1, 0.1, 0.14], up = J.sun ? Math.max(J.sun.dir[1], 0.05) : 0;
        World.exposure = (+Q.get('exp') || 1) * 0.9 / Math.max(0.05, lum(amb) + lum(sunC) * up);
        if (J.sky) { const dome = World.dome = HG3D.skyDome(A.textures[J.sky.map], 1200), k = J.sky.range * 1.5; dome.material.color = { r: k, g: k, b: k }; node.add(dome); World.domeK = k; const f = aces(J.sky.horizon, World.exposure * LOOK.bright), fog = HG3D.fog(0, 220, 1500); fog.color = { r: f[0], g: f[1], b: f[2] }; World.scene.fog = fog; }
        World.glows = (J.glows || []).map(glowOf);
    } else World.standIn(node);
    // which lamps can lie on the road: those near it. Each remembers where on the circuit it is, so a frame only looks at the ones near the car.
    const o = {}; for (const g of World.glows) { Track.locate(g.x, g.z, null, o); g.u = o.u; g.d = o.d; Track.at(o.u, o); g.h = g.y - o.y; g.near = g.shine ? Math.abs(g.d) < Track.half + 60 && g.h > 0.3 && g.h < 80 : Math.abs(g.d) < Track.half + 22 && g.h > 0.3 && g.h < 40; const m = Math.max(g.r, g.g, g.b, 0.001); g.cr = g.r / m; g.cg = g.g / m; g.cb = g.b / m; }
    World.glows.sort((a, b) => a.u - b.u);
    // the light a car stands in on each stretch of the circuit: a little of the night all round, plus every lamp near it by
    // its colour and its distance (the city file has the light baked into its own walls and road; this is the same lamps, for the cars)
    { const N = Track.N, Lt = World.light = new Float32Array(N * 3), G = World.glows; for (let i = 0; i < N; i++) { const s = Track.S[i]; let r = 0.05, g2 = 0.06, b = 0.1; for (const q of G) { const dx = q.x - s[0], dy = q.y - s[1] - 0.6, dz = q.z - s[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 > 2500) continue; const w = q.shine ? Math.min(1, 26 / (d2 + 6)) * 0.3 : Math.min(1, 26 / (d2 + 6)) * clamp(q.s / 2.4, 0.4, 1.4); r += q.cr * w; g2 += q.cg * w; b += q.cb * w; } const m = Math.max(1, Math.max(r, g2, b) / 0.95); Lt[i * 3] = r / m; Lt[i * 3 + 1] = g2 / m; Lt[i * 3 + 2] = b / m; } }
    World.halos.clear(); let hn = 0; for (const g of World.glows.filter(g => !g.shine).sort((a, b) => Math.abs(a.d) - Math.abs(b.d))) { if (hn++ >= 300) break; /* the lamps nearest the road first */ World.halos.add(g.x, g.y, g.z, 0, 0, 0, clamp(g.s * 0.6, 0.7, 4), 0, 1, g.cr, g.cg, g.cb, 0.38); World.halos.list[World.halos.list.length - 1].t = 0.15; }
    World.relight(); resize(); R.compile(World.scene, World.camera); World.loaded = true; if (prog) prog(1);
};
World.relight = function () {
    // the cars: lit all round by the baked light where they stand (their materials' probe), and given their shape by one
    // light from above and a little to one side, the same on every circuit (a car under street lamps)
    { const e = World.sun.matrixWorld.elements; e[12] = 0.35; e[13] = 0.85; e[14] = 0.25; const k = LOOK.key / (World.exposure * World.bright); World.sun.color = { r: 1.0 * k, g: 0.94 * k, b: 0.86 * k }; World.hemi.color = { r: 1, g: 1, b: 1 }; World.hemi.groundColor = { r: 0.55, g: 0.5, b: 0.6 }; }
    R.toneMappingExposure = World.exposure * World.bright; R.gradeLo = LOOK.lo; R.gradeHi = LOOK.hi; R.gradeSaturation = LOOK.sat; R.gradeContrast = LOOK.con;
};
// the light round a car at u on the circuit (see World.light above), as the numbers its materials are lit by
World.lightAt = function (u, out) { const N = Track.N, L = World.light, i = Math.floor(((u % N) + N) % N), j = (i + 1) % N, f = u - Math.floor(u), k = LOOK.ambK / (World.exposure * World.bright); out[0] = (L[i * 3] + (L[j * 3] - L[i * 3]) * f) * k; out[1] = (L[i * 3 + 1] + (L[j * 3 + 1] - L[i * 3 + 1]) * f) * k; out[2] = (L[i * 3 + 2] + (L[j * 3 + 2] - L[i * 3 + 2]) * f) * k; out[3] = 1; return out; };
World.glowDraw = () => { if (App.glow && R.bloom && !App.lite && Save.data.settings.quality !== 'low') R.bloom(LOOK.glow); };

// ---- each frame ----
// A glow point of the file: [x, y, z, r, g, b, size]. size > 0: a lamp (a halo round it, and its light on the wet road).
// size < 0: a lit THING (a sign, a shop front, a strip of light, a lit building front): no halo, only its light on the road; |size| is how wide it is.
function glowOf(g) { const s = g[6] || 2; return { x: g[0], y: g[1], z: g[2], r: g[3], g: g[4], b: g[5], s: Math.abs(s), shine: s < 0 }; }
const WO = {}, CW = new Float32Array(16);
World.frame = function (dt) {
    const cam = World.camera, cw = cam.matrixWorld.elements, cx = cw[12], cy = cw[13], cz = cw[14];
    if (World.dome) { const e = World.dome.matrixWorld.elements; e[12] = cx; e[13] = cy; e[14] = cz; }
    World.halos.update(0, cw); World.smoke.update(dt, cw); World.sparks.update(dt, cw);
    // skid marks: a ring of short dark strokes that fade
    { const S = World.skids, L = World.skidList; S.begin(); let n = 0; for (let i = 0; i < L.length; i++) { const k = L[i]; k.t += dt; if (k.t > 14) continue; L[n++] = k; S.put(k.x, k.y, k.z, k.ax, k.az, k.len, 0.26, 1, 1, 1, k.a * (1 - k.t / 14), k.rise); } L.length = n; S.end(); }
    // the lights on the wet road
    const W = World.wet; W.begin();
    if (Race.cam) {
        const cu = Race.cam.u, fx = -cw[8], fz = -cw[10], N = Track.N, G = World.glows;
        for (let i = 0; i < G.length; i++) {
            const g = G[i]; if (!g.near) continue; const du = Track.ahead(cu, g.u); if (du < -6 || du > 60) continue;
            if (g.shine) World.streak(g.x, g.y, g.z, g.cr, g.cg, g.cb, clamp(g.s * 0.42, 0.7, 6), cx, cy, cz, fx, fz, cu + du, cu, 0.6);
            else World.streak(g.x, g.y, g.z, g.cr, g.cg, g.cb, clamp(g.s * 0.5, 0.6, 2.2), cx, cy, cz, fx, fz, cu + du, cu, 1);
        }
    }
    Race.lamps(W, cx, cy, cz);
    W.end();
};
// one light's streak on the road, as the eye at (cx, cy, cz) sees it: the mirror point lies where the road is, between the
// eye and the light, nearer the eye the higher the light. Long and thin along the line of sight (wet asphalt is rough).
World.streak = function (lx, ly, lz, r, g, b, size, cx, cy, cz, fx, fz, uHint, uEye, amp) {
    const o = WO; Track.locate(lx, lz, uHint, o); Track.spot(o.u, clamp(o.d, -Track.half, Track.half), o); const hl = ly - o.y; if (hl < 0.15) return;
    const hc = Math.max(0.4, cy - o.y), k = hc / (hc + hl), px = cx + (lx - cx) * k, pz = cz + (lz - cz) * k, dx = px - cx, dz = pz - cz, D = Math.hypot(dx, dz); if (D < 1.5 || D > 150) return;
    if ((dx * fx + dz * fz) / D < 0.25) return;                                    // behind or far to the side
    Track.locate(px, pz, uEye === undefined ? uHint : uEye + Track.ahead(uEye, uHint) * k, o); if (Math.abs(o.d) > Track.half - 0.3) return;  // the mirror point is not on the road
    const u = o.u, d = o.d; Track.spot(u, d, o); const y = o.y + 0.035, ax = dx / D, az = dz / D;
    // the slope of the road along the streak, so it lies on a climb or a banked bend
    const rise = (o.tx * ax + o.tz * az) * ((Track.S[(Math.floor(u) + 1) % Track.N][1] - Track.S[Math.floor(u) % Track.N][1]) / Track.step) - (o.tz * ax - o.tx * az) * o.bank;
    const len = clamp(1.6 + D * 0.32 + hl * 0.25, 2.2, 26), a = clamp(1.25 - D / 130, 0, 1) * clamp(D / 6, 0.2, 1) * World.lampK;
    World.wet.put(px, y, pz, ax, az, len, size * (0.55 + D * 0.012), r, g, b, 0.42 * a * (amp === undefined ? 1 : amp), rise);
};
World.skid = function (x, y, z, ax, az, len, a, rise) { const L = World.skidList; if (L.length >= 400) L.shift(); L.push({ x, y: y + 0.02, z, ax, az, len, a, rise: rise || 0, t: 0 }); };

// ---- the stand-in city: the circuit with nothing baked (the real one is a file made in Blender) ----
// several small shapes as one (places, normals and picture coordinates kept)
function joinGeo(list) {
    let nv = 0, ni = 0; for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; } const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), U = new Float32Array(nv * 2), I = new Uint32Array(ni); let vo = 0, io = 0;
    for (const g of list) { P.set(g.attributes.position.array, vo * 3); Nn.set(g.attributes.normal.array, vo * 3); U.set(g.attributes.uv.array, vo * 2); const ix = g.index.array; for (let k = 0; k < ix.length; k++) I[io + k] = ix[k] + vo; vo += g.attributes.position.count; io += ix.length; }
    return HG3D.geometry({ position: P, normal: Nn, uv: U }, I);
}
World.standIn = function (node) {
    World.bright = 1;
    const N = Track.N, S = Track.S, half = Track.W / 2, wallAt = Track.half, o = {};
    const strip = (d0, y0, d1, y1, vRep) => { const P = new Float32Array((N + 1) * 6), Nn = new Float32Array((N + 1) * 6), U = new Float32Array((N + 1) * 4), I = new Uint32Array(N * 6);
        for (let i = 0; i <= N; i++) { Track.spot(i, d0, o); P[i * 6] = o.x; P[i * 6 + 1] = o.y + y0; P[i * 6 + 2] = o.z; Track.spot(i, d1, o); P[i * 6 + 3] = o.x; P[i * 6 + 4] = o.y + y1; P[i * 6 + 5] = o.z; Nn[i * 6 + 1] = Nn[i * 6 + 4] = 1; U[i * 4] = 0; U[i * 4 + 1] = i * Track.step / vRep; U[i * 4 + 2] = 1; U[i * 4 + 3] = i * Track.step / vRep; }
        for (let i = 0; i < N; i++) { const a = i * 2; I.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], i * 6); }
        return HG3D.geometry({ position: P, normal: Nn, uv: U }, I); };
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 512; { const c = cv.getContext('2d'); c.fillStyle = '#1b1d22'; c.fillRect(0, 0, 256, 512); for (let i = 0; i < 5000; i++) { const v = 18 + Math.random() * 26; c.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',.5)'; c.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); } c.fillStyle = 'rgba(235,235,225,.85)'; c.fillRect(6, 0, 4, 512); c.fillRect(246, 0, 4, 512); c.fillRect(126, 0, 4, 200); }
    const road = HG3D.mesh(strip(half, 0, -half, 0, 12), HG3D.material({ lit: false, map: HG3D.texture(cv, { repeat: true, srgb: true }), side: 2 })); road.frustumCulled = false; node.add(road);
    const dark = HG3D.material({ lit: false, color: 0x15171c, side: 2 });
    for (const sgn of [1, -1]) { const w = HG3D.mesh(strip(sgn * wallAt, 0, sgn * wallAt, 1.0, 4), dark); w.frustumCulled = false; node.add(w); const t = HG3D.mesh(strip(sgn * wallAt, 1.0, sgn * wallAt, 1.12, 4), HG3D.material({ lit: false, color: 0xffffff, side: 2 })); t.material.color = sgn > 0 ? { r: 0.1, g: 2.4, b: 3.2 } : { r: 3.2, g: 0.2, b: 2.2 }; t.frustumCulled = false; node.add(t); const v = HG3D.mesh(strip(sgn * wallAt, 0, sgn * (wallAt + 60), 0, 40), HG3D.material({ lit: false, color: 0x0b0c10, side: 2 })); v.frustumCulled = false; node.add(v); }
    // lamps: a post and a head every 30 m, alternating sides; towers behind them with lit windows
    const posts = [], heads = [], towers = [], W = document.createElement('canvas'); W.width = W.height = 128; { const c = W.getContext('2d'); c.fillStyle = '#07080c'; c.fillRect(0, 0, 128, 128); for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) if (Math.random() < 0.42) { c.fillStyle = ['#ffd9a0', '#bfe6ff', '#ff9ad8', '#fff2c8'][(Math.random() * 4) | 0]; c.globalAlpha = 0.5 + Math.random() * 0.5; c.fillRect(x * 16 + 4, y * 8 + 2, 9, 4); } }
    World.glows = [];
    for (let i = 0; i < N; i += 10) { const sgn = (i / 10) % 2 ? 1 : -1; Track.spot(i, sgn * (wallAt + 1.2), o); const b = HG3D.geo.box(0.22, 8, 0.22), p = b.attributes.position.array; for (let k = 0; k < p.length; k += 3) { p[k] += o.x; p[k + 1] += o.y + 4; p[k + 2] += o.z; } posts.push(b);
        Track.spot(i, sgn * (wallAt - 1.6), o); const h = HG3D.geo.box(1.4, 0.18, 0.5), q = h.attributes.position.array; for (let k = 0; k < q.length; k += 3) { q[k] += o.x; q[k + 1] += o.y + 8; q[k + 2] += o.z; } heads.push(h); World.glows.push([o.x, o.y + 7.9, o.z, 1, 0.72, 0.38, 2.4]); }
    for (let i = 0; i < N; i += 7) for (const sgn of [1, -1]) { if (Math.random() < 0.25) continue; const w = rand(14, 30), hgt = rand(14, 70), dp = rand(14, 26); Track.spot(i, sgn * (wallAt + 12 + dp / 2 + rand(0, 30)), o); const b = HG3D.geo.box(w, hgt, dp), p = b.attributes.position.array, uv = b.attributes.uv.array; for (let k = 0; k < p.length; k += 3) { p[k] += o.x; p[k + 1] += o.y + hgt / 2 - 1; p[k + 2] += o.z; } for (let k = 0; k < uv.length; k += 2) { uv[k] *= w / 16; uv[k + 1] *= hgt / 16; } towers.push(b);
        if (Math.random() < 0.5) World.glows.push([o.x - o.tz * sgn * (dp / 2 + 0.5), o.y + rand(5, 14), o.z + o.tx * sgn * (dp / 2 + 0.5), ...[[1, 0.15, 0.7], [0.1, 0.85, 1], [1, 0.6, 0.1], [0.3, 1, 0.5]][(Math.random() * 4) | 0], 3]); }
    node.add(HG3D.mesh(joinGeo(posts), dark)); const hm = HG3D.mesh(joinGeo(heads), HG3D.material({ lit: false, color: 0xffffff })); hm.material.color = { r: 4, g: 2.6, b: 1.2 }; node.add(hm);
    node.add(HG3D.mesh(joinGeo(towers), HG3D.material({ lit: false, map: HG3D.texture(W, { repeat: true, srgb: true }) })));
    for (const c of node.children) c.frustumCulled = false;
    World.exposure = 1; const fog = HG3D.fog(0, 120, 900); fog.color = { r: 0.012, g: 0.016, b: 0.035 }; World.scene.fog = fog; R.setClearColor(0x05060c);
    World.glows = World.glows.map(glowOf);
    World.standK = 1;
};
