// ============================================================
// THE BATTLEFIELD UNDER THE OLD GAME: ONE BIG ISLAND IN AN OPEN SEA (the owner, 2026-11-24: "the maps suck. prioritize a complete
// revamp. it should be a big island surrounded by decently realistic water. the water continues as far as can see but theres a
// border stopping you from continuing"). The seven 420 m tiles of the first remaster are gone from the game (their makers are
// still tools/blender/make_<id>.py; a tile without `sea` still loads the old way).
// The island is one Blender-made, light-baked file (assets/island.hgm, 1280 m square, tools/blender/make_ss_island.py): HG3D draws
// it as its own scene BEFORE the old game's scene (vehicles, shells, smoke), in the same frame and through the same camera. The
// old game only ever asks the ground five things (H, GH, compOf, pushOutOfBuildings, where to spawn), and here those are answered
// from the file's two height layers (`heights.data` the ground, `heights.tops` the top of whatever stands on it: more than
// 0.8 m apart = solid). Height 0 is sea level; the file's ground goes on under the water as sea bed. The old game counts
// everything under 0.9 m as sea, which is exactly what stops a tank at the waterline.
// THE SEA is not in the file: one plane that follows the camera to the horizon (seaMake: waves, the sky in it, the sun's glitter,
// clear over the shallows, foam where it meets the land). THE BORDER is where the old game already turns aircraft back
// (M.R, here the ground's `border`): a wall of red light that only shows when you are near it (borderMake).
// three.js (the fallback renderer) cannot draw these files: there the old game's own four battlefields are used (TILES_OK).
// ============================================================
let TILES_OK = true;
const TILE = { want: '', on: false, id: '', sea: false, seaM: null, wall: null, A: null, scene: null, dome: null, skirt: null, G: null, hd: null, td: null, y0: 0, out: 3.6, lim: 200, lm: [], exp: 1, expNow: 1, busy: null, bad: {}, sunDir: [.4, .8, .4], blobs: null, skyK: 1, hor: [.5, .5, .5] };
const tileDef = (name, file, blurb, mini) => ({ name, tile: file, blurb, mini, look: 'green', seed: 1, isl: [], hills: [], towns: [], roads: [], strips: [],
    pts: [{ x: -125, z: 0, name: 'A' }, { x: 0, z: 0, name: 'B' }, { x: 125, z: 0, name: 'C' }], flags: [{ x: -178, z: 0 }, { x: 178, z: 0 }] });
const TILE_GROUNDS = {
    // sea: height 0 is sea level and the game draws the sea; half: what the corner map shows; border: where aircraft are turned back;
    // bases: where each side's ground vehicles start (x, z, how far round it)
    island: Object.assign(tileDef('STORM ISLAND', 'island', 'One big island in an open sea. A base at each end, a fishing village, a ruined town in the pass, a depot on the rise, an airstrip. Three ways across for a tank; all the sky and sea you want for an aircraft, as far as the red line.', [98, 126, 70]), {
        sea: true, half: 700, border: 900, bases: [[-330, 0, 46], [330, 0, 46]], paths: ISLAND_PATHS,
        pts: [{ x: -200, z: 40, name: 'A' }, { x: 0, z: 0, name: 'B' }, { x: 200, z: -40, name: 'C' }], flags: [{ x: -286, z: -46 }, { x: 286, z: 46 }] })
};
const TILE_IDS = Object.keys(TILE_GROUNDS);
// how each lighting choice shows a baked tile: k = how bright its baked light and sky are shown, sky = the sky's tint
const TILE_WX = { noon: { k: 1, sky: [1, 1, 1], veh: 1 }, evening: { k: .74, sky: [1.25, .8, .62], veh: .9 }, overcast: { k: .6, sky: [.7, .72, .76], veh: .85 }, night: { k: .17, sky: [.5, .62, 1.1], veh: .45 } };      // veh: the old game's own lights on the vehicles, against a tile shown this dark
const tLum = c => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
function tAces(c, exposure) {
    const k = exposure / 0.6, r = c[0] * k, g = c[1] * k, b = c[2] * k;
    const a = [0.59719 * r + 0.35458 * g + 0.04823 * b, 0.07600 * r + 0.90834 * g + 0.01566 * b, 0.02840 * r + 0.13383 * g + 0.83777 * b];
    for (let i = 0; i < 3; i++) { const v = a[i]; a[i] = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); }
    return [clamp(1.60475 * a[0] - 0.53108 * a[1] - 0.07367 * a[2], 0, 1), clamp(-0.10208 * a[0] + 1.10813 * a[1] - 0.00605 * a[2], 0, 1), clamp(-0.00327 * a[0] - 0.07276 * a[1] + 1.07602 * a[2], 0, 1)];
}
// which battlefield an id really means on this device (tiles where HG3D draws, the old four where three.js does)
function groundOr(id) { const G = GROUNDS[id], t = G && G.tile; if (TILES_OK) return t && !TILE.bad[id] ? id : TILE_IDS.find(k => !TILE.bad[k]) || 'ridge'; return G && !t ? id : 'ridge'; }

// ---- the two height layers ----
function tileS(d, x, z) {
    const T = TILE.G; let fx = (x - T.x0) / T.cell, fz = (z - T.z0) / T.cell; if (fx < 0 || fz < 0 || fx > T.nx - 1 || fz > T.nz - 1) return TILE.out;
    if (fx > T.nx - 1.001) fx = T.nx - 1.001; if (fz > T.nz - 1.001) fz = T.nz - 1.001;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, a = iz * T.nx + ix;
    return (d[a] * (1 - tx) + d[a + 1] * tx) * (1 - tz) + (d[a + T.nx] * (1 - tx) + d[a + T.nx + 1] * tx) * tz + TILE.y0;
}
const tileGround = (x, z) => tileS(TILE.hd, x, z);
function tileTop(x, z) { const g = tileS(TILE.hd, x, z), t = tileS(TILE.td, x, z); return t - g > 0.8 ? t : g; }
const tileSolid = (x, z) => tileS(TILE.td, x, z) - tileS(TILE.hd, x, z) > 0.8;
function tileClear(x, z, room) { const L = TILE.lim - room; if (x < -L || x > L || z < -L || z > L) return false; if (TILE.sea && tileGround(x, z) < 1.6) return false; for (let dx = -room; dx <= room; dx += 2) for (let dz = -room; dz <= room; dz += 2) if (tileSolid(x + dx, z + dz)) return false; return true; }
// the nearest spot with `room` metres clear all round (the same answer on every device: parties must agree)
function tileNear(x, z, room) { for (let r = 0; r < (TILE.sea ? 240 : 120); r += 4) { const n = r ? Math.ceil(6.283 * r / 6) : 1; for (let i = 0; i < n; i++) { const a = i / n * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (tileClear(px, pz, room)) return [Math.round(px), Math.round(pz)]; } } return [x, z]; }
function tileNearOpen(x, z) { for (let r = 0; r < 260; r += 5) { const n = r ? Math.ceil(6.283 * r / 7) : 1; for (let i = 0; i < n; i++) { const a = i / n * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (tileOpen(px, pz)) return [px, pz]; } } return tileNear(x, z, 6); }
// a vehicle against whatever stands on the ground: pushed out of the nearest solid spot, twice
function tilePush(e, r) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
        const n = Math.ceil(r), bx = Math.round(e.x), bz = Math.round(e.z); let best = r, sx = 0, sz = 0;
        for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) { const x = bx + dx, z = bz + dz, d = Math.hypot(e.x - x, e.z - z); if (d < best && tileSolid(x, z)) { best = d; sx = x; sz = z; } }
        if (best >= r) break; hit = true;
        if (best < .05) { e.x -= Math.sin(e.yaw) * r * .5; e.z -= Math.cos(e.yaw) * r * .5; } else { const k = (r - best) / best; e.x += (e.x - sx) * k; e.z += (e.z - sz) * k; }
    }
    if (hit) e.speed *= .9;
}
// a place to put a vehicle down: nothing solid within 8 m (looked at every metre: a tree trunk or a post slips between two-metre
// samples), ground that is level enough to stand on, and no other vehicle within 11 m (team spawns never looked: two tanks came up in
// one another)
function tileOpen(x, z) {
    if (!tileClear(x, z, 8)) return false;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) if (tileSolid(x + dx, z + dz)) return false;
    const g = tileGround(x, z); for (let i = 0; i < 8; i++) { const a = i * 0.7854; if (Math.abs(tileGround(x + Math.cos(a) * 4.5, z + Math.sin(a) * 4.5) - g) > 1.7) return false; }
    return farFromAll(x, z, 11);
}
function tileSpawn(team, ffa, force) {
    const L = TILE.lim, sgn = team === 0 ? -1 : 1, bases = GROUNDS[TILE.id] && GROUNDS[TILE.id].bases, b = bases && bases[team === 0 ? 0 : 1], land = TILE.land || [-L, L, -L, L];
    for (let i = 0; i < (force ? 400 : 1); i++) {
        let x, z;
        if (ffa) { x = rnd(land[0] + 10, land[1] - 10); z = rnd(land[2] + 10, land[3] - 10); }
        else if (b) { const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * (b[2] + (i > 200 ? 40 : 0)); x = b[0] + Math.cos(a) * r; z = b[1] + Math.sin(a) * r; }      // round the base
        else { x = sgn * rnd(L - 58, L - 8); z = rnd(-L * .72, L * .72); }
        if (tileOpen(x, z) && (!ffa || force || farFromAll(x, z, 50))) return { x, z, y: tileGround(x, z), yaw: ffa ? rnd(-PI, PI) : team === 0 ? PI / 2 : -PI / 2 };
    }
    const fx = b ? b[0] : sgn * (L - 20), fz = b ? b[1] : 0, n = force ? tileNearOpen(fx, fz) : null;
    return force ? { x: n[0], z: n[1], y: tileGround(n[0], n[1]), yaw: team === 0 ? PI / 2 : -PI / 2 } : null;
}
// the three points and the two flags: where the layout wants them, moved to the nearest clear ground
function tileSettle() {
    for (const p of PTS) { const s = tileNear(p.x, p.z, 9); p.x = s[0]; p.z = s[1]; }
    for (const f of FLAG_HOME) { const s = tileNear(f.x, f.z, 8); f.x = s[0]; f.z = s[1]; }
}

// ---- loading one (the one before it is given back first: only one tile's pictures are ever in memory) ----
function tileFree() {
    if (!TILE.A) return; if (HGR) HGR.release(TILE.scene, TILE.A.textures);
    TILE.A = TILE.scene = TILE.dome = TILE.skirt = TILE.seaM = TILE.wall = TILE.G = TILE.hd = TILE.td = NAV.ok = null; TILE.id = ''; TILE.on = false; TILE.sea = false; TILE.lm.length = 0;
}
TILE.load = function (id) { const run = () => tileLoad1(id); return TILE.busy = (TILE.busy || Promise.resolve()).then(run, run); };
async function tileLoad1(id) {
    if (TILE.id === id) return true; if (!TILES_OK || !TILE_GROUNDS[id] || TILE.bad[id]) throw new Error('no such battlefield here');
    try {
        await Packs.ready;
        const A = await HG3D.load(AST(id + '.hgm'), { anisotropy: 4, shrink: f => /_light|_sky|ground/.test(f) ? (/props_light/.test(f) ? 1024 : 0) : 512 }), J = A.json, B = J.bounds, G = J.heights;
        tileFree();
        const root = HG3D.node(), m = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        const D = TILE_GROUNDS[id], sea = !!D.sea;
        TILE.y0 = sea ? 0 : 4 - Math.min(B.min[1], 0); TILE.out = sea ? Math.min(B.min[1], -8) : TILE.y0 + B.min[1] - .4; m[13] = TILE.y0; HG3D.place(A.scene, m);
        for (const k in A.objects) if (k !== 'world') A.objects[k].visible = false;      // the first remaster's own tank models ride in every file: not used here
        root.add(A.scene);
        const lm = []; (function walk(o) { const u = o.material && o.material.userData && o.material.userData.hg && o.material.userData.hg.uniforms; if (u && u.uLmRange && !lm.some(x => x.u === u.uLmRange)) lm.push({ u: u.uLmRange, v: u.uLmRange.value }); if (o.children) for (const c of o.children) walk(c); })(A.scene);
        if (J.sky) { const dome = HG3D.skyDome(A.textures[J.sky.map], 1000); root.add(dome); TILE.dome = dome; TILE.skyK = J.sky.range; TILE.hor = J.sky.horizon; }
        let skirt = null;
        if (!sea) { skirt = HG3D.mesh(HG3D.geo.plane(1, 1), HG3D.material({ lit: false, color: 0xffffff, fog: true, side: 2 })); skirt.frustumCulled = false;
            const e = skirt.matrixWorld.elements; e[0] = 9000; e[5] = 1; e[10] = 9000; e[15] = 1; e[12] = (B.min[0] + B.max[0]) / 2; e[13] = TILE.out; e[14] = (B.min[2] + B.max[2]) / 2; root.add(skirt); }
        root.fog = scene.fog;
        const sunC = J.sun ? J.sun.color : [0, 0, 0], amb = J.ambient || [1, 1, 1], up = J.sun ? Math.max(J.sun.dir[1], 0.05) : 0;
        TILE.exp = 0.85 / Math.max(0.05, tLum(amb) + tLum(sunC) * up); TILE.sunDir = J.sun ? J.sun.dir.slice() : [.3, .9, .3];
        TILE.A = A; TILE.scene = root; TILE.skirt = skirt; TILE.lm = lm; TILE.G = G; TILE.hd = A.view(G.data); TILE.td = A.view(G.tops);
        TILE.lim = Math.min(-B.min[0], B.max[0], -B.min[2], B.max[2]) - 8; TILE.id = id; TILE.sea = sea; TILE.land = null;
        if (sea) { seaMake(root, G, D); borderMake(root, D.border + 30); }
        navBuild();
        return true;
    } catch (e) { TILE.bad[id] = String(e && e.message || e); throw e; }
}
// run `fn` once the battlefield `id` can be stood on (at once when it is the one already loaded)
function withGround(id, fn) {
    const g = groundOr(id), G = GROUNDS[g]; if (!G.tile || TILE.id === G.tile) return fn();
    const b = $('#boot'), s = $('#boot-s'); if (b) { s.textContent = 'Loading ' + G.name + '...'; clearTimeout(doorsOpen.t); b.classList.remove('open'); b.classList.remove('hidden'); }
    const done = () => { fn(); doorsOpen(); }; TILE.load(G.tile).then(done, done);
}

// ---- light: the baked light and the sky are shown brighter or darker, and the old game's sun stands where the bake's did ----
function tileLight() {
    if (!TILE.on) return; const X = TILE_WX[WXK] || TILE_WX.noon, k = X.k;
    W0 = Object.assign({}, WX[WXK], { dir: TILE.sunDir }); skyU.sunDir.value.set(TILE.sunDir[0], TILE.sunDir[1], TILE.sunDir[2]).normalize();
    TILE.expNow = TILE.exp * k; sun.intensity = W0.sunI * X.veh; hemi.intensity = W0.hI * X.veh;
    if (TILE.dome) TILE.dome.material.color = { r: TILE.skyK * X.sky[0], g: TILE.skyK * X.sky[1], b: TILE.skyK * X.sky[2] };
    const f = tAces([TILE.hor[0] * X.sky[0], TILE.hor[1] * X.sky[1], TILE.hor[2] * X.sky[2]], TILE.expNow);
    scene.fog.color.setRGB(f[0], f[1], f[2]); scene.background.setRGB(f[0], f[1], f[2]); renderer.setClearColor(scene.fog.color);
    if (TILE.skirt) TILE.skirt.material.color = { r: Math.min(1, f[0] * 1.5), g: Math.min(1, f[1] * 1.4), b: Math.min(1, f[2] * 1.2) };
    if (TILE.seaM) seaLight(X);
}
// ---- each frame: the sky stays round the camera; a soft shadow lies under every vehicle (baked ground takes no real one) ----
function tileFrame() {
    if (TILE.seaM) seaFrame();
    if (TILE.dome) { const e = TILE.dome.matrixWorld.elements, s = camera.far * .9 / 1000; e[0] = e[5] = e[10] = s; e[12] = camera.position.x; e[13] = camera.position.y; e[14] = camera.position.z; }
    const B = TILE.blobs; if (!B) return; let n = 0; const o = tileFrame.o || (tileFrame.o = new THREE.Object3D());
    if (typeof EN !== 'undefined') for (const e of EN.values()) {
        if (!e.alive || n >= B.instanceMatrix.count) continue; const d = e.def, air = d.ln === 'a', gy = Math.max(tileGround(e.x, e.z), TILE.sea ? 0 : -99), alt = Math.max(0, e.y - gy), k = air ? clamp(1 - alt / 260, .25, 1) : 1;
        o.position.set(e.x, gy + .14, e.z); if (air || !e.mdl) o.rotation.set(0, e.yaw, 0); else o.quaternion.copy(e.mdl.root.quaternion); o.scale.set(d.r * 2.5 * k, 1, d.r * (air ? 2.5 : 3.3) * k); o.updateMatrix(); B.setMatrixAt(n++, o.matrix);
    }
    B.count = n; B.instanceMatrix.needsUpdate = true;
}
function tileBlobs() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 4, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(.55, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 48);
    m.frustumCulled = false; m.count = 0; m.renderOrder = -1; scene.add(m); TILE.blobs = m;
}
// ---- the frame itself ----
function drawWorld() {
    if (TILE.on && TILE.scene && HGR) {
        const e = renderer.toneMappingExposure, ac = renderer.autoClear, bg = scene.background; renderer.info.autoReset = false; renderer.info.reset();
        renderer.autoClear = false; renderer.clear(); renderer.toneMappingExposure = TILE.expNow; renderer.render(TILE.scene, camera);
        renderer.toneMappingExposure = e; scene.background = null; renderer.render(scene, camera); scene.background = bg; renderer.autoClear = ac; renderer.info.autoReset = true;
    } else renderer.render(scene, camera);
    glowNow();
}
// the map in the corner: the ground by height, what stands on it dark
function tileMini(mx, S, half) {
    const im = mx.createImageData(S, S), c = GROUNDS[GROUND].mini || [120, 120, 110], sea = TILE.sea;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const x = (px / S - .5) * half * 2, z = (py / S - .5) * half * 2, o = (py * S + px) * 4; let r = 38, g = 44, b = 50;
        if (sea) { r = 30; g = 62; b = 92; }
        if (TILE.on && Math.abs(x) < TILE.lim + 8 && Math.abs(z) < TILE.lim + 8) {
            const h = tileGround(x, z) - TILE.y0;
            if (sea && h < .9) { const k = clamp(1 + h / 9, 0, 1); r = 30 + 42 * k; g = 62 + 62 * k; b = 92 + 44 * k; }      // the sea, paler over the shallows
            else if (tileSolid(x, z)) { r = c[0] * .42; g = c[1] * .42; b = c[2] * .42; }
            else if (sea && h < 2.6) { r = 196; g = 182; b = 138; }                                                            // the beach
            else { const k = .78 + clamp(h / (sea ? 90 : 40), -.1, .5), sl = sea ? clamp((Math.abs(tileGround(x + 3, z) - tileGround(x - 3, z)) + Math.abs(tileGround(x, z + 3) - tileGround(x, z - 3))) / 6 - .35, 0, .5) : 0; r = lerp(c[0] * k, 128, sl); g = lerp(c[1] * k, 122, sl); b = lerp(c[2] * k, 112, sl); }      // rock where it is steep
        }
        im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; im.data[o + 3] = 255;
    }
    mx.putImageData(im, 0, 0);
}

// ---- THE SEA: one plane at height 0 that stays under the camera and reaches as far as the camera sees. Everything is worked out
// per pixel from where the pixel is in the world, so the plane sliding along under the camera moves nothing:
//   waves     six trains of sines; only their SLOPE is used (the surface stays flat: nothing in the old game has to float on it);
//             the short ones fade with distance so the far sea does not sparkle
//   the sky   in the water by Fresnel: almost none looking straight down, all of it at the horizon
//   the sun   a hard glitter and a soft sheen along its mirror direction
//   the water turquoise and clear over the shallows (the file's sea bed shows through), deep blue further out: from a small picture of
//             the depth made from the file's heights (uSeaDepth); outside the file it is all deep
//   foam      a band that washes in and out where the depth runs to nothing
// THE SEA'S WAVES are one picture (256 px, it repeats without a seam): 56 wave trains of whole-number wave counts, mostly running with the
// wind, small ones weaker (red, green = the slope of the surface, blue = its height). The sea reads it five times, each at another size,
// turned another way and drifting another way, on ground that is bent by a slow wander: no two stretches of sea look the same, and from
// the air there are no rows (the owner, 2026-11-25: "it is very easy to tell a pattern in the water from the air"; before this the sea
// was eight sine trains, each a set of straight parallel rows). Far away the small copies of the picture (its mipmaps) average the
// waves out, as distance does.
function seaWaves() {
    const N = 256, n = 56, H = new Float32Array(N * N), SX = new Float32Array(N * N), SZ = new Float32Array(N * N), C = new Float32Array(N), S = new Float32Array(N);
    for (let i = 0; i < N; i++) { C[i] = Math.cos(i / N * 6.283185307); S[i] = Math.sin(i / N * 6.283185307); }
    let seed = 20261125; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let w = 0; w < n; w++) {
        const k = 3 + 25 * Math.pow(R(), 1.6), th = 0.5 + (R() + R() + R() - 1.5) * 1.1, kx = Math.round(k * Math.cos(th)), kz = Math.round(k * Math.sin(th)); if (!kx && !kz) continue;
        const a = Math.pow(Math.hypot(kx, kz), -1.5) * (0.6 + 0.4 * R()), ph = R() * 6.2832, cp = Math.cos(ph), sp = Math.sin(ph);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const m = (((kx * i + kz * j) % N) + N) % N, c = C[m] * cp - S[m] * sp, sn = S[m] * cp + C[m] * sp, o = j * N + i; H[o] += a * c; SX[o] -= a * kx * sn; SZ[o] -= a * kz * sn; }
    }
    let h2 = 0, s2 = 0; for (let o = 0; o < N * N; o++) { h2 += H[o] * H[o]; s2 += SX[o] * SX[o] + SZ[o] * SZ[o]; } const hk = 1 / (3 * Math.sqrt(h2 / (N * N))), sk = 1 / (3 * Math.sqrt(s2 / (2 * N * N)));
    const px = new Uint8Array(N * N * 4), q = v => Math.round(clamp(.5 + .5 * v, 0, 1) * 255);
    for (let o = 0; o < N * N; o++) { px[o * 4] = q(SX[o] * sk); px[o * 4 + 1] = q(SZ[o] * sk); px[o * 4 + 2] = q(H[o] * hk); px[o * 4 + 3] = 255; }
    const t = HG3D.texture({ data: px, width: N, height: N }, { srgb: false }); t.wrapS = t.wrapT = 1000; return t;
}
function seaMake(root, G, D) {
    const N = 256, x0 = G.x0, z0 = G.z0, sx = (G.nx - 1) * G.cell, sz = (G.nz - 1) * G.cell, px = new Uint8Array(N * N * 4); let l0 = 1e9, l1 = -1e9, l2 = 1e9, l3 = -1e9;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + (i + .5) / N * sx, z = z0 + (j + .5) / N * sz, h = tileGround(x, z), o = (j * N + i) * 4; px[o] = px[o + 1] = px[o + 2] = Math.round(clamp(-h / 12, 0, 1) * 255); px[o + 3] = 255; if (h > 1.6) { l0 = Math.min(l0, x); l1 = Math.max(l1, x); l2 = Math.min(l2, z); l3 = Math.max(l3, z); } }
    TILE.land = l1 > l0 ? [l0, l1, l2, l3] : null;
    const U = { uSea: { value: new Float32Array([0, 1, 0, 0]) }, uSeaBox: { value: new Float32Array([x0, z0, 1 / sx, 1 / sz]) }, uSeaDepth: { value: HG3D.texture({ data: px, width: N, height: N }, { srgb: false }) }, uSeaWave: { value: seaWaves() },
        uSeaHor: { value: new Float32Array(3) }, uSeaZen: { value: new Float32Array(3) }, uSeaSun: { value: new Float32Array(TILE.sunDir) }, uSeaSunC: { value: new Float32Array(3) }, uSeaDeep: { value: new Float32Array(3) }, uSeaShal: { value: new Float32Array(3) } };
    // one reading of the wave picture: `len` metres across, turned by `rot` degrees, drifting `sp` m/s towards `dir` degrees; `w` = how steep, `hw` = how much of its height counts for whitecaps
    const nl = String.fromCharCode(10), f = v => v.toFixed(4), W = (len, rot, w, sp, dir, hw) => { const c = Math.cos(rot * Math.PI / 180), sn = Math.sin(rot * Math.PI / 180), d = dir * Math.PI / 180;
        return ' { vec3 s3 = texture(uSeaWave, mat2(' + f(c) + ', ' + f(sn) + ', ' + f(-sn) + ', ' + f(c) + ') * p * ' + (1 / len).toFixed(5) + ' + vec2(' + f(Math.cos(d) * sp / len) + ', ' + f(Math.sin(d) * sp / len) + ') * t).rgb; g += mat2(' + f(c) + ', ' + f(-sn) + ', ' + f(sn) + ', ' + f(c) + ') * (s3.rg * 2.0 - 1.0) * ' + f(w) + ';' + (hw ? ' hh += (s3.b - 0.5) * ' + f(hw) + ';' : '') + ' }'; };
    const mat = HG3D.material({ lit: false, color: 0xffffff, fog: true, transparent: true, side: 2, hg: { key: 'ss-sea', uniforms: U,
        vDecl: 'out vec3 wSea;', vMain: 'wSea = wp;',
        fDecl: 'in vec3 wSea; uniform vec4 uSea; uniform vec4 uSeaBox; uniform sampler2D uSeaDepth; uniform sampler2D uSeaWave; uniform vec3 uSeaHor; uniform vec3 uSeaZen; uniform vec3 uSeaSun; uniform vec3 uSeaSunC; uniform vec3 uSeaDeep; uniform vec3 uSeaShal;',
        fFinal: ['{ vec3 toC = uCamPos.xyz - wSea; float dist = length(toC); vec3 V = toC / dist; vec2 p = wSea.xz; float t = uSea.x;',
            ' vec2 uvd = (p - uSeaBox.xy) * uSeaBox.zw; float dm = texture(uSeaDepth, uvd).r; if (uvd.x < 0.0 || uvd.y < 0.0 || uvd.x > 1.0 || uvd.y > 1.0) dm = 1.0; float depth = dm * 12.0;',
            // the ground the waves are read on wanders: slowly and far (so the picture never lines up with itself), quickly and a little
            ' p += vec2(sin(p.y * 0.0071 + t * 0.05) + 0.6 * sin(p.y * 0.0163 - t * 0.07 + p.x * 0.004), sin(p.x * 0.0083 - t * 0.04) + 0.6 * sin(p.x * 0.0149 + t * 0.06 - p.y * 0.005)) * 16.0;',
            ' p += vec2(sin(p.y * 0.037 + t * 0.21) + 0.3 * sin(p.x * 0.19 + t * 0.6), sin(p.x * 0.031 - t * 0.19) + 0.3 * sin(p.y * 0.23 - t * 0.5)) * 2.4;',
            // gusts: wide patches where the wind lies harder on the water (rougher, brighter in the sun) or lighter (smooth, dark)
            ' float gust = 0.5 + texture(uSeaWave, p * 0.00047 + vec2(0.0017, 0.0009) * t).b; gust *= 0.6 + 0.8 * texture(uSeaWave, p.yx * 0.00173 - vec2(0.0031, 0.0012) * t).b;',
            ' vec2 g = vec2(0.0); float hh = 0.0;', W(970, 17, .06, 5, 20, 0), W(233, 0, .16, 6.5, 35, 0), W(87, 37, .19, 4.4, 10, 1), W(31, -64, .19, 2.7, 55, 1), W(9.7, 118, .17, 1.5, 25, 1), ' g *= gust;',
            ' g *= (0.5 + 0.5 * smoothstep(0.2, 4.0, depth)) * uSea.y;',
            ' vec3 N = normalize(vec3(-g.x, 1.0, -g.y)); float nv = max(dot(N, V), 0.0), F = 0.02 + 0.98 * pow(1.0 - nv, 5.0);',
            ' vec3 R = reflect(-V, N); R.y = abs(R.y); vec3 sky = mix(uSeaHor, uSeaZen, pow(R.y, 0.5));',
            ' float sd = max(dot(R, uSeaSun), 0.0); float far = smoothstep(60.0, 1500.0, dist); vec3 sun = uSeaSunC * (pow(sd, mix(700.0, 110.0, far)) * mix(26.0, 2.6, far) + pow(sd, 48.0) * 0.55 * gust);',
            ' vec3 body = mix(uSeaShal, uSeaDeep, 1.0 - exp(-depth * 0.3)) * (0.62 + 0.38 * max(dot(N, uSeaSun), 0.0));',
            ' float wash = depth + 0.3 * sin(t * 0.9 + p.x * 0.21 + p.y * 0.17) + 0.18 * sin(p.x * 1.3 - p.y * 1.1 + t * 1.7), foam = smoothstep(0.85, 0.05, wash) * smoothstep(-0.2, 0.25, depth + 0.02);',
            ' float cap = smoothstep(0.6, 0.82, hh * gust) * smoothstep(1.5, 4.0, depth) * min(uSea.y, 1.3); foam = max(foam, cap * 0.8);' + nl + ' c = mix(body, sky, F) + sun; c = mix(c, (uSeaHor + uSeaSunC * 0.5) * 0.9, foam * 0.7);',
            ' alpha = clamp(max(F * 1.6, 1.0 - exp(-depth * 0.8)) + foam + min(dist / 900.0, 1.0), 0.0, 1.0); }'].join(nl) } });
    const m = HG3D.mesh(HG3D.geo.plane(1, 1), mat); m.frustumCulled = false; m.renderOrder = 5; root.add(m); TILE.seaM = m; TILE.seaU = U;
}
function seaLight(X) {
    const U = TILE.seaU, J = TILE.A.json, sc = J.sun ? J.sun.color : [1, 1, 1], amb = J.ambient || [1, 1, 1], up = Math.max(TILE.sunDir[1], .05), E = tLum(amb) + tLum(sc) * up, h = TILE.hor, t = X.sky;
    U.uSeaHor.value.set([h[0] * t[0], h[1] * t[1], h[2] * t[2]]); U.uSeaZen.value.set([h[0] * t[0] * .3, h[1] * t[1] * .46, h[2] * t[2] * .8]);
    U.uSeaSunC.value.set([sc[0] * t[0], sc[1] * t[1], sc[2] * t[2]]); U.uSeaSun.value.set(TILE.sunDir); { const v = U.uSeaSun.value, l = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; }
    U.uSeaDeep.value.set([.010 * E * t[0], .040 * E * t[1], .075 * E * t[2]]); U.uSeaShal.value.set([.035 * E * t[0], .23 * E * t[1], .22 * E * t[2]]);
    U.uSea.value[1] = WXK === 'overcast' ? 1.5 : 1;      // rain: a rougher sea
}
function seaFrame() {
    const e = TILE.seaM.matrixWorld.elements, s = camera.far * 2.4; e[0] = s; e[5] = 1; e[10] = s; e[12] = camera.position.x; e[13] = 0; e[14] = camera.position.z; e[15] = 1;
    TILE.seaU.uSea.value[0] = (performance.now() / 1000) % 3600;
}
// ---- THE BORDER: the old game turns an aircraft back once it is 30 m past the battle area. Here that line can be SEEN: four walls of
// red light standing on the sea, which only show when you are within a few hundred metres of them (and never from the island).
function borderMake(root, R) {
    const nl = String.fromCharCode(10), Hh = 700, mat = HG3D.material({ lit: false, color: 0xffffff, fog: false, transparent: true, depthWrite: false, side: 2, hg: { key: 'ss-border',
        vDecl: 'out vec3 wBd;', vMain: 'wBd = wp;', fDecl: 'in vec3 wBd;',
        fFinal: ['{ float d = length(uCamPos.xyz - wBd), near = clamp(1.0 - d / 520.0, 0.0, 1.0); float a = (wBd.x + wBd.z) / 50.0, b = wBd.y / 50.0;',
            ' float line = max(smoothstep(0.46, 0.5, abs(fract(a) - 0.5)), smoothstep(0.46, 0.5, abs(fract(b) - 0.5)));',
            ' float chev = smoothstep(0.42, 0.5, abs(fract(a * 0.5 + b * 0.5) - 0.5)) * 0.35;',
            ' c = vec3(1.0, 0.13, 0.08); alpha = near * near * (0.06 + 0.8 * max(line, chev)) * clamp(1.0 - wBd.y / ' + Hh.toFixed(1) + ', 0.0, 1.0); }'].join(nl) } });
    mat.toneMapped = false; const wall = HG3D.node(), put = (ax, az, x, z) => { const m = HG3D.mesh(HG3D.geo.plane(1, 1), mat), e = m.matrixWorld.elements; m.frustumCulled = false; m.renderOrder = 6;
        e[0] = ax * R * 2; e[1] = 0; e[2] = az * R * 2; e[4] = az; e[5] = 0; e[6] = -ax; e[8] = 0; e[9] = Hh; e[10] = 0; e[12] = x; e[13] = Hh / 2; e[14] = z; e[15] = 1; wall.add(m); };
    put(1, 0, 0, -R); put(1, 0, 0, R); put(0, 1, -R, 0); put(0, 1, R, 0); root.add(wall); TILE.wall = wall;
}

// ---- the computer's crews find their way round what stands on a tile (the old game's own ground had nothing to go round:
// its crews drive straight at where they want to be). A 6 m grid of where a tank fits, the shortest way over it (A*), and
// the crew is steered at the farthest of the next few steps it can drive straight to. ----
const NAV = { C: 6, n: 0, ok: null, h: null, g: null, from: null, stamp: null, tick: 0 };
function navBuild() {
    const C = NAV.C = TILE.sea ? 10 : 6, L = TILE.lim, n = NAV.n = Math.floor(L * 2 / C), ok = NAV.ok = new Uint8Array(n * n), h = NAV.h = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = (i + .5) * C - L, z = (j + .5) * C - L; h[j * n + i] = tileGround(x, z); let free = TILE.sea && h[j * n + i] < 1.3 ? 0 : 1;
        for (let dz = -3; dz <= 3 && free; dz += 1.5) for (let dx = -3; dx <= 3; dx += 1.5) if (tileSolid(x + dx, z + dz)) { free = 0; break; }
        ok[j * n + i] = free;
    }
    NAV.g = new Float32Array(n * n); NAV.from = new Int32Array(n * n); NAV.stamp = new Uint32Array(n * n);
}
const navCell = (x, z) => { const n = NAV.n, i = clamp(Math.floor((x + TILE.lim) / NAV.C), 0, n - 1), j = clamp(Math.floor((z + TILE.lim) / NAV.C), 0, n - 1); return j * n + i; };
function navOpen(c) {
    if (NAV.ok[c]) return c; const n = NAV.n, ci = c % n, cj = (c - ci) / n;
    for (let r = 1; r < 9; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= n || j >= n) continue; if (NAV.ok[j * n + i]) return j * n + i; }
    return -1;
}
function navPath(sx, sz, gx, gz) {
    const n = NAV.n, ok = NAV.ok, Hh = NAV.h, C = NAV.C, s = navOpen(navCell(sx, sz)), t = navOpen(navCell(gx, gz)); if (s < 0 || t < 0) return null; if (s === t) return [[gx, gz]];
    const st = ++NAV.tick, G = NAV.g, F = NAV.from, S = NAV.stamp, hc = [], hf = [], ti = t % n, tj = (t - ti) / n;
    const push = (c, f) => { let i = hc.length; hc.push(c); hf.push(f); while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; hc[i] = hc[p]; hf[i] = hf[p]; i = p; } hc[i] = c; hf[i] = f; };
    const pop = () => { const c = hc[0], lc = hc.pop(), lf = hf.pop(), m = hc.length; if (m) { let i = 0; for (;;) { let k = i * 2 + 1; if (k >= m) break; if (k + 1 < m && hf[k + 1] < hf[k]) k++; if (hf[k] >= lf) break; hc[i] = hc[k]; hf[i] = hf[k]; i = k; } hc[i] = lc; hf[i] = lf; } return c; };
    G[s] = 0; S[s] = st; F[s] = -1; push(s, 0); let found = false, guard = 0;
    while (hc.length && guard++ < (TILE.sea ? 24000 : 6000)) {
        const c = pop(); if (c === t) { found = true; break; } const ci = c % n, cj = (c - ci) / n, g0 = G[c];
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            if (!di && !dj) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= n || j >= n) continue; const k = j * n + i; if (!ok[k]) continue;
            if (di && dj && (!ok[cj * n + i] || !ok[j * n + ci])) continue;      // no cutting a corner
            const d = di && dj ? 1.414 : 1; if (Math.abs(Hh[k] - Hh[c]) / (d * C) > .75) continue;      // a cliff
            const g = g0 + d; if (S[k] === st && G[k] <= g) continue; G[k] = g; S[k] = st; F[k] = c; push(k, g + Math.hypot(i - ti, j - tj));
        }
    }
    if (!found) return null; const out = []; for (let c = t; c !== s && c >= 0; c = F[c]) { const i = c % n; out.push([(i + .5) * C - TILE.lim, ((c - i) / n + .5) * C - TILE.lim]); } out.reverse(); out.push([gx, gz]); return out;
}
function tileLine(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 2.5); if (d > 150) return false; if (TILE.sea && Math.abs(tileGround(bx, bz) - tileGround(ax, az)) > d * .5) return false; for (let i = 1; i <= n; i++) { const t = i / n; if (!NAV.ok[navCell(ax + (bx - ax) * t, az + (bz - az) * t)]) return false; } return true; }
function tileRoute(e, gx, gz) {
    const a = e.ai; if (!NAV.ok || !a) return null; let r = a.nav;
    if (!r || simTime > r.t || Math.hypot(gx - r.gx, gz - r.gz) > 30) r = a.nav = { t: simTime + 2.5 + Math.random(), gx, gz, p: tileLine(e.x, e.z, gx, gz) ? null : navPath(e.x, e.z, gx, gz), i: 0 };
    if (!r.p) return null;
    while (r.i < r.p.length - 1 && Math.hypot(r.p[r.i][0] - e.x, r.p[r.i][1] - e.z) < 7) r.i++;
    let k = r.i; for (let j = Math.min(r.p.length - 1, r.i + 5); j > r.i; j--) if (tileLine(e.x, e.z, r.p[j][0], r.p[j][1])) { k = j; break; }
    return r.p[k];
}
// the loading page is a pair of hangar doors: they part, then the page is put away
function doorsOpen() { const b = $('#boot'); if (!b || b.classList.contains('hidden')) return; b.classList.add('open'); clearTimeout(doorsOpen.t); doorsOpen.t = setTimeout(() => { b.classList.add('hidden'); b.classList.remove('open'); }, 1200); }
// The camera on a tile: the old game hangs it 30 to 40 m behind the vehicle, which on its own open ground met nothing. Among
// buildings it would sit inside one. So the arm is shortened to just short of the first thing that stands in its way
// (quickly), and let out again when the way is clear (slowly).
function tileBoom(cx, cy, cz, p, dt, near) {      // near: never closer than this (the vehicle's own length)
    const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz, D = Math.hypot(dx, dy, dz), n = Math.ceil(D / 1.5), kMin = clamp((near || 9) / D, 0.16, 1); let k = 1;
    for (let i = 2; i <= n; i++) { const t = i / n; if (tileTop(cx + dx * t, cz + dz * t) > cy + dy * t - 0.7) { k = Math.max(kMin, (i - 1.5) / n); break; } }
    dt = dt > 0 ? dt : 0.016; const was = tileBoom.k > 0 ? tileBoom.k : 1; tileBoom.k = k < was ? lerp(was, k, Math.min(1, dt * 14)) : lerp(was, k, Math.min(1, dt * 1.6)); k = tileBoom.k;
    p.x = cx + dx * k; p.y = cy + dy * k + (1 - k) * 6; p.z = cz + dz * k;      // the shorter the arm, the more from above
}
