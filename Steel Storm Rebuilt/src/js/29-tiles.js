// ============================================================
// THE FIRST REMASTER'S BATTLEFIELDS UNDER THE OLD GAME (the owner, 2026-11-24: "one game with the ui and maps of new steel
// storm, mechanics of old"). Each is one Blender-made, light-baked file (assets/<id>.hgm, 420 m square, made by
// tools/blender/make_<id>.py): HG3D draws it as its own scene BEFORE the old game's scene (vehicles, shells, smoke), in the
// same frame and through the same camera. The old game only ever asks the ground five things (H, GH, compOf,
// pushOutOfBuildings, where to spawn), and here those are answered from the file's two height layers (`heights.data` the
// ground, `heights.tops` the top of whatever stands on it: more than 0.8 m apart = solid).
// The old game counts everything under 0.9 m as sea, so a tile is lifted until its lowest ground is at 4 m (TILE.y0).
// three.js (the fallback renderer) cannot draw these files: there the old game's own four battlefields are used (TILES_OK).
// ============================================================
let TILES_OK = true;
const TILE = { want: '', on: false, id: '', A: null, scene: null, dome: null, skirt: null, G: null, hd: null, td: null, y0: 0, out: 3.6, lim: 200, lm: [], exp: 1, expNow: 1, busy: null, bad: {}, sunDir: [.4, .8, .4], blobs: null, skyK: 1, hor: [.5, .5, .5] };
const tileDef = (name, file, blurb, mini) => ({ name, tile: file, blurb, mini, look: 'green', seed: 1, isl: [], hills: [], towns: [], roads: [], strips: [],
    pts: [{ x: -125, z: 0, name: 'A' }, { x: 0, z: 0, name: 'B' }, { x: 125, z: 0, name: 'C' }], flags: [{ x: -178, z: 0 }, { x: 178, z: 0 }] });
const TILE_GROUNDS = {
    valley: tileDef('IRON VALLEY', 'valley', 'A dry river between two ridges, a ruined village in the middle. Use the ground.', [112, 122, 78]),
    dunes: tileDef('RED DUNES', 'dunes', 'Open desert: long dunes to hide a hull behind, a dry river bed, an oil depot, a ruined fort on a rise.', [186, 150, 104]),
    pass: tileDef('WHITE PASS', 'pass', 'Snow. A mountain road between two shoulders, pine woods on the slopes, a frozen lake in the middle.', [206, 214, 222]),
    works: tileDef('STEELWORKS', 'works', 'Streets between the sheds of a steel plant, slag heaps for hills, rail embankments, a canal with two bridges.', [118, 112, 106]),
    harbor: tileDef('IRON HARBOUR', 'harbor', 'A port: quays and warehouses, lanes between container stacks, cranes, a dry dock, rail sidings.', [124, 128, 132]),
    farmland: tileDef('GREEN LINE', 'farmland', 'Hedgerow country: small fields boxed in by thick hedges and sunken lanes, two farms, a church on a rise.', [104, 132, 72]),
    city: tileDef('BROKEN CITY', 'city', 'A bombed city centre: a grid of streets between ruined blocks, a wide boulevard, a park, a railway cutting.', [128, 124, 118])
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
function tileClear(x, z, room) { const L = TILE.lim - room; if (x < -L || x > L || z < -L || z > L) return false; for (let dx = -room; dx <= room; dx += 2) for (let dz = -room; dz <= room; dz += 2) if (tileSolid(x + dx, z + dz)) return false; return true; }
// the nearest spot with `room` metres clear all round (the same answer on every device: parties must agree)
function tileNear(x, z, room) { for (let r = 0; r < 120; r += 4) { const n = r ? Math.ceil(6.283 * r / 6) : 1; for (let i = 0; i < n; i++) { const a = i / n * 6.283, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (tileClear(px, pz, room)) return [Math.round(px), Math.round(pz)]; } } return [x, z]; }
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
function tileSpawn(team, ffa, force) {
    const L = TILE.lim, sgn = team === 0 ? -1 : 1;
    for (let i = 0; i < (force ? 400 : 1); i++) {
        const x = ffa ? rnd(-L + 10, L - 10) : sgn * rnd(L - 58, L - 8), z = ffa ? rnd(-L + 10, L - 10) : rnd(-L * .72, L * .72);
        if (tileClear(x, z, 8) && (!ffa || force || farFromAll(x, z, 50))) return { x, z, y: tileGround(x, z), yaw: ffa ? rnd(-PI, PI) : team === 0 ? PI / 2 : -PI / 2 };
    }
    return force ? { x: sgn * (L - 20), z: 0, y: tileGround(sgn * (L - 20), 0), yaw: team === 0 ? PI / 2 : -PI / 2 } : null;
}
// the three points and the two flags: where the layout wants them, moved to the nearest clear ground
function tileSettle() {
    for (const p of PTS) { const s = tileNear(p.x, p.z, 9); p.x = s[0]; p.z = s[1]; }
    for (const f of FLAG_HOME) { const s = tileNear(f.x, f.z, 8); f.x = s[0]; f.z = s[1]; }
}

// ---- loading one (the one before it is given back first: only one tile's pictures are ever in memory) ----
function tileFree() {
    if (!TILE.A) return; if (HGR) HGR.release(TILE.scene, TILE.A.textures);
    TILE.A = TILE.scene = TILE.dome = TILE.skirt = TILE.G = TILE.hd = TILE.td = NAV.ok = null; TILE.id = ''; TILE.on = false; TILE.lm.length = 0;
}
TILE.load = function (id) { const run = () => tileLoad1(id); return TILE.busy = (TILE.busy || Promise.resolve()).then(run, run); };
async function tileLoad1(id) {
    if (TILE.id === id) return true; if (!TILES_OK || !TILE_GROUNDS[id] || TILE.bad[id]) throw new Error('no such battlefield here');
    try {
        await Packs.ready;
        const A = await HG3D.load(AST(id + '.hgm'), { anisotropy: 4, shrink: f => /_light|_sky|ground/.test(f) ? (/props_light/.test(f) ? 1024 : 0) : 512 }), J = A.json, B = J.bounds, G = J.heights;
        tileFree();
        const root = HG3D.node(), m = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        TILE.y0 = 4 - Math.min(B.min[1], 0); TILE.out = TILE.y0 + B.min[1] - .4; m[13] = TILE.y0; HG3D.place(A.scene, m);
        for (const k in A.objects) if (k !== 'world') A.objects[k].visible = false;      // the first remaster's own tank models ride in every file: not used here
        root.add(A.scene);
        const lm = []; (function walk(o) { const u = o.material && o.material.userData && o.material.userData.hg && o.material.userData.hg.uniforms; if (u && u.uLmRange && !lm.some(x => x.u === u.uLmRange)) lm.push({ u: u.uLmRange, v: u.uLmRange.value }); if (o.children) for (const c of o.children) walk(c); })(A.scene);
        if (J.sky) { const dome = HG3D.skyDome(A.textures[J.sky.map], 1000); root.add(dome); TILE.dome = dome; TILE.skyK = J.sky.range; TILE.hor = J.sky.horizon; }
        const skirt = HG3D.mesh(HG3D.geo.plane(1, 1), HG3D.material({ lit: false, color: 0xffffff, fog: true, side: 2 })); skirt.frustumCulled = false;
        { const e = skirt.matrixWorld.elements; e[0] = 9000; e[5] = 1; e[10] = 9000; e[15] = 1; e[12] = (B.min[0] + B.max[0]) / 2; e[13] = TILE.out; e[14] = (B.min[2] + B.max[2]) / 2; } root.add(skirt);
        root.fog = scene.fog;
        const sunC = J.sun ? J.sun.color : [0, 0, 0], amb = J.ambient || [1, 1, 1], up = J.sun ? Math.max(J.sun.dir[1], 0.05) : 0;
        TILE.exp = 0.85 / Math.max(0.05, tLum(amb) + tLum(sunC) * up); TILE.sunDir = J.sun ? J.sun.dir.slice() : [.3, .9, .3];
        TILE.A = A; TILE.scene = root; TILE.skirt = skirt; TILE.lm = lm; TILE.G = G; TILE.hd = A.view(G.data); TILE.td = A.view(G.tops);
        TILE.lim = Math.min(-B.min[0], B.max[0], -B.min[2], B.max[2]) - 8; TILE.id = id; navBuild();
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
    TILE.skirt.material.color = { r: Math.min(1, f[0] * 1.5), g: Math.min(1, f[1] * 1.4), b: Math.min(1, f[2] * 1.2) };
}
// ---- each frame: the sky stays round the camera; a soft shadow lies under every vehicle (baked ground takes no real one) ----
function tileFrame() {
    if (TILE.dome) { const e = TILE.dome.matrixWorld.elements, s = camera.far * .9 / 1000; e[0] = e[5] = e[10] = s; e[12] = camera.position.x; e[13] = camera.position.y; e[14] = camera.position.z; }
    const B = TILE.blobs; if (!B) return; let n = 0; const o = tileFrame.o || (tileFrame.o = new THREE.Object3D());
    if (typeof EN !== 'undefined') for (const e of EN.values()) {
        if (!e.alive || n >= B.instanceMatrix.count) continue; const d = e.def, air = d.ln === 'a', gy = tileGround(e.x, e.z), alt = Math.max(0, e.y - gy), k = air ? clamp(1 - alt / 260, .25, 1) : 1;
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
    const im = mx.createImageData(S, S), c = GROUNDS[GROUND].mini || [120, 120, 110];
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
        const x = (px / S - .5) * half * 2, z = (py / S - .5) * half * 2, o = (py * S + px) * 4; let r = 38, g = 44, b = 50;
        if (TILE.on && Math.abs(x) < TILE.lim + 8 && Math.abs(z) < TILE.lim + 8) { if (tileSolid(x, z)) { r = c[0] * .42; g = c[1] * .42; b = c[2] * .42; } else { const k = .78 + clamp((tileGround(x, z) - TILE.y0) / 40, -.1, .5); r = c[0] * k; g = c[1] * k; b = c[2] * k; } }
        im.data[o] = r; im.data[o + 1] = g; im.data[o + 2] = b; im.data[o + 3] = 255;
    }
    mx.putImageData(im, 0, 0);
}

// ---- the computer's crews find their way round what stands on a tile (the old game's own ground had nothing to go round:
// its crews drive straight at where they want to be). A 6 m grid of where a tank fits, the shortest way over it (A*), and
// the crew is steered at the farthest of the next few steps it can drive straight to. ----
const NAV = { C: 6, n: 0, ok: null, h: null, g: null, from: null, stamp: null, tick: 0 };
function navBuild() {
    const C = NAV.C, L = TILE.lim, n = NAV.n = Math.floor(L * 2 / C), ok = NAV.ok = new Uint8Array(n * n), h = NAV.h = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = (i + .5) * C - L, z = (j + .5) * C - L; h[j * n + i] = tileGround(x, z); let free = 1;
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
    while (hc.length && guard++ < 6000) {
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
function tileLine(ax, az, bx, bz) { const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 2.5); if (d > 150) return false; for (let i = 1; i <= n; i++) { const t = i / n; if (!NAV.ok[navCell(ax + (bx - ax) * t, az + (bz - az) * t)]) return false; } return true; }
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
