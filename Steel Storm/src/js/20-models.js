// ============================================================
// MODELS + PROCEDURAL TEXTURES (2.0). Every vehicle gets its own model built from primitives in code, by class builders
// (tank / aircraft / helicopter / ship / submarine) driven by each vehicle's `m` parameters. Geometry is merged per part:
// body (+ team marks), turret, gun, tracks/wheels, props, decals: a handful of draw calls per vehicle.
// Vertex colour alpha selects textured (1) or flat-painted (0) surfaces, so marks, glass and dark metal need no extra material.
// Model forward is +Z, up +Y. All textures are drawn on canvases at start-up: no downloads.
// ============================================================
function vnoise(seed, P) {        // tileable value noise on a P x P lattice, sampled with u, v in tile units (0..1 wraps)
    const r = mulberry(seed), g = new Float32Array(P * P); for (let i = 0; i < P * P; i++) g[i] = r();
    return (u, v) => {
        const x = u * P, y = v * P, xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const x0 = ((xi % P) + P) % P, y0 = ((yi % P) + P) % P, x1 = (x0 + 1) % P, y1 = (y0 + 1) % P;
        const a = g[y0 * P + x0], b = g[y0 * P + x1], c = g[y1 * P + x0], d = g[y1 * P + x1];
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
}
function fbm(seed, base, oct) { const ns = []; for (let i = 0; i < oct; i++) ns.push(vnoise(seed + i * 101, base << i)); return (u, v) => { let s = 0, a = .5, t = 0; for (const n of ns) { s += n(u, v) * a; t += a; a *= .5; } return s / t; }; }
function cvTex(size, draw, color, h) {
    const cv = document.createElement('canvas'); cv.width = size; cv.height = h || size; const x = cv.getContext('2d'); draw(x, cv.width, cv.height);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; if (color !== false) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function pixels(x, S, H, fn) { const im = x.createImageData(S, H), d = im.data; for (let j = 0; j < H; j++) for (let i = 0; i < S; i++) { const o = (j * S + i) * 4, c = fn(i / S, j / H, i, j); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3] === undefined ? 255 : c[3]; } x.putImageData(im, 0, 0); }
// ---------- vehicle paint: camouflage per domain + team, panel lines, rivets, weathering ----------
const CAMO = {
    g0: { base: [104, 116, 70], cols: [[66, 80, 44], [122, 100, 66], [44, 46, 36]], th: [.55, .6, .66], sc: 3 },          // woodland
    g1: { base: [196, 176, 128], cols: [[160, 128, 86], [128, 114, 82], [214, 196, 150]], th: [.55, .62, .68], sc: 3 },   // desert
    a0: { base: [158, 168, 178], cols: [[124, 136, 150], [182, 188, 196]], th: [.56, .62], sc: 2, split: 1 },            // sky splinter
    a1: { base: [176, 158, 112], cols: [[112, 120, 82], [146, 126, 90]], th: [.54, .6], sc: 2, split: 1 },               // sand / olive splinter
    n0: { base: [136, 144, 154], cols: [[118, 126, 136], [152, 158, 166]], th: [.58, .62], sc: 2 },                      // haze grey
    n1: { base: [112, 118, 128], cols: [[76, 84, 94], [156, 162, 168]], th: [.6, .64], sc: 1, dazzle: 1 }                // dazzle
};
const PANELS = (() => {      // one panel layout shared by the paint and the bump map so lines and rivets line up
    const r = mulberry(77), L = [];
    for (let y = 0; y < 256; y += 32 + Math.floor(r() * 3) * 16) { L.push(['h', y]); for (let x = 0; x < 256;) { const w = 48 + Math.floor(r() * 4) * 16; L.push(['v', x, y]); x += w; } }
    return L;
})();
function drawPanels(x, line, rivet) {
    x.fillStyle = line;
    for (const p of PANELS) { if (p[0] === 'h') x.fillRect(0, p[1], 256, 1); else x.fillRect(p[1], p[2], 1, 34); }
    x.fillStyle = rivet;
    for (const p of PANELS) if (p[0] === 'h') for (let i = 4; i < 256; i += 8) x.fillRect(i, p[1] + 3, 1.5, 1.5);
}
function camoTex(key) {
    const C = CAMO[key], n = [fbm(11 + key.charCodeAt(0) * 7 + key.charCodeAt(1), 4 * C.sc, 3), fbm(31 + key.charCodeAt(1) * 13, 4 * C.sc, 3), fbm(53 + key.charCodeAt(0), 4 * C.sc, 3)];
    const grime = fbm(97, 8, 3), fine = vnoise(5, 64);
    return cvTex(256, (x, S) => {
        pixels(x, S, S, (u, v) => {
            let c = C.base;
            if (C.split) { const k = Math.floor((u * 3 + v * 1.7 + n[0](u, v) * .9) * 2) % 3; c = k === 1 ? C.cols[0] : k === 2 ? C.cols[1] : C.base; }
            else if (C.dazzle) { const k = Math.sin((u * 2 - v) * TAU * 1.5 + n[0](u, v) * 3) > .2; c = k ? C.cols[0] : n[1](u, v) > .62 ? C.cols[1] : C.base; }
            else for (let i = 0; i < C.cols.length; i++) if (n[i](u, v) > C.th[i]) c = C.cols[i];
            const g = grime(u, v), f = fine(u, v) * 14 - 7, dirt = clamp((g - .55) * 2.2, 0, .45);
            return [c[0] * (1 - dirt) + 92 * dirt + f, c[1] * (1 - dirt) + 78 * dirt + f, c[2] * (1 - dirt) + 58 * dirt + f];
        });
        // rain streaks + chipped edges
        const r = mulberry(key.length * 17 + 3);
        for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(40,34,26,' + (.04 + r() * .08) + ')'; x.fillRect(r() * S, r() * S, 1 + r() * 1.5, 8 + r() * 26); }
        for (let i = 0; i < 90; i++) { x.fillStyle = 'rgba(200,200,190,' + (.05 + r() * .1) + ')'; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
        drawPanels(x, 'rgba(20,22,18,.38)', 'rgba(230,230,220,.35)');
    });
}
const TEX = {};
function initTextures() {
    for (const k of Object.keys(CAMO)) TEX[k] = camoTex(k);
    const nz = vnoise(9, 32);
    TEX.bump = cvTex(256, (x, S) => { pixels(x, S, S, (u, v) => { const c = 128 + nz(u, v) * 18 - 9; return [c, c, c]; }); drawPanels(x, 'rgba(40,40,40,.9)', 'rgba(255,255,255,.9)'); }, false);
    TEX.track = cvTex(64, (x, S) => { x.fillStyle = '#2b2c2e'; x.fillRect(0, 0, S, S); for (let i = 0; i < S; i += 16) { x.fillStyle = '#55575b'; x.fillRect(i, 0, 5, S); x.fillStyle = '#18191b'; x.fillRect(i + 13, 0, 3, S); } x.fillStyle = '#6a6c70'; x.fillRect(0, 28, S, 8); });
}
// ---------- geometry helpers (lists: textured surfaces vs flat-painted ones) ----------
function paint(g, col, a) {
    const c = new THREE.Color(col), n = g.attributes.position.count, arr = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { arr[i * 4] = c.r; arr[i * 4 + 1] = c.g; arr[i * 4 + 2] = c.b; arr[i * 4 + 3] = a; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 4)); return g;
}
function place(g, x, y, z, rx, ry, rz) { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; }
const isFlat = L => L.flat === true;
function push(L, g, col) { paint(g, col, isFlat(L) ? 0 : 1); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); L.push(g); return g; }
function bx(L, w, h, d, x, y, z, col, rx, ry, rz) { return push(L, place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz), col); }
function cy(L, rt, rb, h, seg, x, y, z, col, rx, ry, rz) { return push(L, place(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz), col); }
function sph(L, r, x, y, z, col, sx, sy, sz, half) { const g = half ? new THREE.SphereGeometry(r, 10, 5, 0, TAU, 0, PI / 2) : new THREE.SphereGeometry(r, 10, 7); g.scale(sx || 1, sy || 1, sz || 1); return push(L, place(g, x, y, z), col); }
// tapered box: o.fs / o.rs pull the top front / rear edge back (slopes), o.bf / o.br the bottom ones, o.tx top width scale, o.fx front width scale
function tb(L, w, h, d, x, y, z, col, o, rx, ry, rz) {
    o = o || {}; const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        let X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
        if (Y > 0) { if (Z > 0) Z -= o.fs || 0; else Z += o.rs || 0; X *= o.tx || 1; } else { if (Z > 0) Z -= o.bf || 0; else Z += o.br || 0; X *= o.bx || 1; }
        if (Z > 0) X *= o.fx || 1;
        p.setXYZ(i, X, Y, Z);
    }
    g.computeVertexNormals(); return push(L, place(g, x, y, z, rx, ry, rz), col);
}
// a tapered, swept wing panel: root at x = 0 spanning to +x (or -x with side = -1), chord along z
function wing(L, root, tip, span, sweepZ, thick, x, y, z, col, side, dihedral, vertical) {
    const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const s = p.getX(i) + .5, ch = root + (tip - root) * s, zz = p.getZ(i) * ch - s * sweepZ, yy = p.getY(i) * thick * (1 - s * .5) + s * span * (dihedral || 0);
        p.setXYZ(i, s * span, yy, zz);
    }
    if (side < 0) { g.scale(-1, 1, 1); const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } }
    if (vertical) g.rotateZ(PI / 2 * (side < 0 ? -1 : 1));
    g.computeVertexNormals(); return push(L, place(g, x, y, z), col);
}
function lathe(L, prof, seg, x, y, z, col, sx) {      // profile [[r, z]...] spun around the Z axis
    const pts = prof.slice().sort((a, b) => a[1] - b[1]).map(p => new THREE.Vector2(Math.max(.001, p[0]), p[1])), g = new THREE.LatheGeometry(pts, seg); g.rotateX(PI / 2); if (sx) g.scale(sx, 1, 1);
    // LatheGeometry spins around Y with profile y; after rotateX the profile's y runs along +Z
    return push(L, place(g, x, y, z), col);
}
function boxUV(g, s) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), X = p.getX(i) / s, Y = p.getY(i) / s, Z = p.getZ(i) / s;
        if (ay >= ax && ay >= az) uv.setXY(i, X, Z); else if (ax >= az) uv.setXY(i, Z, Y); else uv.setXY(i, X, Y);
    }
}
function trackUV(g) { const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) * .55, Math.abs(n.getX(i)) > .5 ? p.getY(i) * .5 : p.getX(i) * .5); }
function merge2(L, F, s) {
    const all = [];
    if (L && L.length) { const m = mergeGeometries(L, false); boxUV(m, s); all.push(m); }
    if (F && F.length) all.push(mergeGeometries(F, false));
    return all.length ? (all.length > 1 ? mergeGeometries(all, false) : all[0]) : null;
}
const flatList = () => { const a = []; a.flat = true; return a; };
const merge = L => L.length ? mergeGeometries(L, false) : null;
const tint = (c, k) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), k === undefined ? .62 : k).getHex();
const flagSet = s => { const o = {}; String(s || '').split(/\s+/).forEach(k => { if (k) o[k] = true; }); return o; };
// ---------- materials ----------
function vehMat(map) {
    const m = new THREE.MeshPhongMaterial({ vertexColors: true, map, bumpMap: TEX.bump, bumpScale: 1.2, shininess: 26, specular: 0x2a2a2a });
    m.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n #ifdef USE_COLOR_ALPHA\n diffuseColor.rgb *= mix(vec3(1.0), sampledDiffuseColor.rgb, vColor.a);\n #else\n diffuseColor *= sampledDiffuseColor;\n #endif\n#endif')
            .replace('#include <color_fragment>', '#if defined( USE_COLOR_ALPHA ) || defined( USE_COLOR )\n diffuseColor.rgb *= vColor.rgb;\n#endif');
    };
    m.customProgramCacheKey = () => 'veh2';
    return m;
}
const MAT = {};
function initMaterials() {
    initTextures();
    // the digit atlas is 10 cells wide
    const dc = document.createElement('canvas'); dc.width = 320; dc.height = 32; const dx = dc.getContext('2d'); dx.font = 'bold 26px Arial Black,Arial,sans-serif'; dx.textAlign = 'center'; dx.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) { dx.lineWidth = 5; dx.strokeStyle = 'rgba(0,0,0,.75)'; dx.strokeText(String(i), i * 32 + 16, 17); dx.fillStyle = '#f4f2e8'; dx.fillText(String(i), i * 32 + 16, 17); }
    TEX.digits = new THREE.CanvasTexture(dc); TEX.digits.colorSpace = THREE.SRGBColorSpace;
    MAT.veh = {}; for (const k of Object.keys(CAMO)) MAT.veh[k] = vehMat(TEX[k]);
    MAT.track = new THREE.MeshPhongMaterial({ map: TEX.track, shininess: 40, specular: 0x333333 });
    MAT.decal = new THREE.MeshLambertMaterial({ map: TEX.digits, transparent: true, alphaTest: .4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    MAT.dead = new THREE.MeshLambertMaterial({ color: 0x222222 });
    MAT.base = new THREE.MeshLambertMaterial({ vertexColors: true });      // scenery (trees) with 3-component vertex colours
}
function setVehicleDetail(q) { const b = q === 'low' ? null : TEX.bump; for (const k in MAT.veh) { const m = MAT.veh[k]; if (m.bumpMap !== b) { m.bumpMap = b; m.needsUpdate = true; } } }
// ---------- per-class builders ----------
const DK = 0x2a2c30, MTL = 0x4a4d53, GLASS = 0x8fc8f0, LAMP = 0xe8e2c0, WHITE = 0xf0f0ea;
function buildTank(m, team) {
    const B = [], BF = flatList(), T = [], TF = flatList(), Gp = [], GF = flatList(), TR = flatList(), KB = [], KT = [], f = flagSet(m.f), tc = teamCol(team);
    const [hw, hh, hl] = m.hull, [tw, th, tl] = m.tur, wl = !!f.wl, c1 = tint(m.c[0]), c2 = tint(m.c[1], .5);
    const trw = wl ? .62 : Math.max(.55, hw * .2), sx = hw / 2 + trw * .5, y0 = wl ? 1.0 : .62, top = y0 + hh;
    // ---- running gear ----
    if (wl) {
        const n = m.wh || 4;
        for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
            const z = -hl * .36 + i * hl * .72 / (n - 1);
            push(TR, place(new THREE.CylinderGeometry(.62, .62, .5, 12), s * (hw / 2 + .2), .62, z, 0, 0, PI / 2), 0xffffff);
            cy(BF, .26, .26, .52, 8, s * (hw / 2 + .22), .62, z, MTL, 0, 0, PI / 2);
        }
        tb(B, hw, hh, hl, 0, y0 + hh / 2, 0, c1, { fs: hh * 1.1, rs: hh * .4, bf: hh * .6, br: hh * .4, bx: .78 });
        for (const s of [-1, 1]) bx(B, .12, .22, hl * .9, s * (hw / 2 + .02), y0 + hh * .2, 0, c2);      // wheel arches line
    } else {
        const n = m.wh || Math.round(hl / 1.1), wr = clamp(hh * .4, .36, .55);
        for (const s of [-1, 1]) {
            const x = s * sx, L = hl * 1.02;
            const top1 = new THREE.BoxGeometry(trw, .14, L * .86); place(top1, x, 1.06, -L * .02); top1.computeVertexNormals(); trackUV(top1); push(TR, top1, 0xffffff);
            const bot = new THREE.BoxGeometry(trw, .14, L * .74); place(bot, x, .07, 0); trackUV(bot); push(TR, bot, 0xffffff);
            for (const e of [1, -1]) { const sl = new THREE.BoxGeometry(trw, .14, 1.25); place(sl, x, .55, e * L * .43, -e * .78); trackUV(sl); push(TR, sl, 0xffffff); }
            for (let i = 0; i < n; i++) { const z = -L * .36 + i * L * .72 / Math.max(1, n - 1); cy(BF, wr, wr, trw * .86, 10, x, wr + .05, z, 0x3a3c3f, 0, 0, PI / 2); cy(BF, wr * .45, wr * .45, trw * .9, 8, x, wr + .05, z, MTL, 0, 0, PI / 2); }
            cy(BF, .4, .4, trw * .9, 10, x, .78, L * .47, 0x303236, 0, 0, PI / 2); cy(BF, .36, .36, trw * .9, 10, x, .74, -L * .47, 0x303236, 0, 0, PI / 2);
            if (f.ret) for (let i = 0; i < 3; i++) cy(BF, .13, .13, trw * .5, 6, x, .93, -L * .25 + i * L * .25, MTL, 0, 0, PI / 2);
            if (f.sk) bx(B, .08, .62, L * .82, s * (sx + trw * .5 + .04), .88, 0, c1);
            else bx(KB, .08, .62, L * .82, s * (sx + trw * .5 + .04), .88, 0, c1);
        }
        bx(B, hw, hh * .75, hl * .94, 0, y0 + hh * .32, 0, c2);      // lower hull between the tracks
        tb(B, hw + trw * 2, hh * .55, hl, 0, y0 + hh * .72, 0, c1, { fs: hh * .95, rs: hh * .35, bf: .2 });      // upper hull over the tracks, sloped glacis
        bx(B, hw * .96, hh * .1, hl * .3, 0, top - .02, -hl * .3, c2);      // engine deck
        for (let i = 0; i < 4; i++) bx(BF, hw * .6, .04, .14, 0, top + .05, -hl * .2 - i * .32, 0x26282b);      // grille slats
    }
    // ---- hull details ----
    for (const s of [-1, 1]) {
        cy(BF, .12, .12, .16, 8, s * hw * .38, top - hh * .25, hl / 2 - hh * .7, LAMP, PI / 2);      // headlights
        bx(BF, .18, .14, .3, s * hw * .3, y0 + hh * .15, hl / 2 + .05, MTL);      // tow hooks
        if (f.exh) cy(BF, .1, .12, .5, 6, s * hw * .3, top - hh * .2, -hl / 2 - .1, 0x1d1e20, PI / 2);
        bx(BF, .05, .26, hl * .38, s * (wl ? hw / 2 + .03 : hw / 2 + trw + .01), top - hh * .35, -hl * .05, tc);      // team stripe
    }
    if (f.era) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) bx(B, hw * .2, .1, .32, (i - 1.5) * hw * .24, top - hh * .25 - j * .28, hl / 2 - hh * .45 - j * .3, c2, -.9);
    if (f.spade) bx(B, hw * .9, .9, .14, 0, y0 + .2, -hl / 2 - .4, c2, -.5);
    bx(KB, hw * .9, .1, hh * .6, 0, top - hh * .3, hl / 2 - hh * .3, c2, -.8);      // armour kit: glacis applique
    // ---- casemate ----
    const ty = m.ty || 'box';
    if (ty === 'cas') { tb(B, hw + trw * 1.6, th, tl, 0, top + th / 2, m.tz, c1, { fs: th * .9, rs: th * .25, tx: .85 }); bx(BF, .5, .1, .5, tw * .25, top + th + .03, m.tz - tl * .25, MTL); }
    // ---- turret (origin = turret ring) ----
    const front = ty === 'cas' ? tl * .3 : tl * .5;
    if (ty === 'box') { tb(T, tw, th, tl, 0, th / 2, 0, c1, { fs: th * .45, rs: th * .15, tx: .86 }); tb(T, tw * .84, th * .72, tl * .38, 0, th * .55, -tl * .62, c1, { rs: th * .2 }); }
    else if (ty === 'cast') { sph(T, 1, 0, 0, tl * .05, c1, tw * .52, th * 1.15, tl * .58, true); tb(T, tw * .7, th * .6, tl * .3, 0, th * .38, -tl * .55, c1, { rs: th * .3, tx: .8 }); }
    else if (ty === 'wedge') {
        tb(T, tw, th, tl * .72, 0, th / 2, -tl * .1, c1, { tx: .88, rs: th * .1 });
        tb(T, tw, th * .92, tl * .42, 0, th * .46, tl * .45, c1, { fx: .35, tx: .88, fs: th * .25 });
        for (const s of [-1, 1]) bx(T, .2, th * .7, tl * .5, s * (tw / 2 + .08), th * .5, -tl * .25, c2);
    }
    else if (ty === 'aa') {
        cy(T, tw * .5, tw * .52, .3, 12, 0, .15, 0, c1);
        for (const s of [-1, 1]) bx(T, .1, th, tl, s * tw / 2, th / 2 + .2, 0, c1);
        bx(T, tw, th * .8, .1, 0, th * .4 + .2, -tl / 2, c1); bx(T, tw, th * .5, .1, 0, th * .25 + .2, tl / 2, c1, .3);
        if (f.rad) { cy(TF, .06, .06, 1.2, 5, 0, th + .6, -tl * .45, MTL); cy(T, .75, .75, .08, 14, 0, th + 1.25, -tl * .45, c2, PI / 2 - .3); }
    }
    else if (ty === 'arty') { tb(T, tw, th, tl, 0, th / 2, 0, c1, { fs: th * .3, rs: 0, tx: .92 }); bx(TF, tw * .9, .06, .3, 0, th * .7, -tl / 2 - .02, 0x1f2023); for (const s of [-1, 1]) bx(T, .12, th * .5, tl * .5, s * (tw / 2 + .06), th * .5, -tl * .1, c2); }
    else if (ty === 'ml') { cy(T, tw * .45, tw * .5, .4, 10, 0, .2, 0, c1); tb(T, tw * .8, th, tl * .7, 0, th / 2 + .2, -tl * .1, c1, { fs: th * .3, tx: .8 }); }
    else if (ty === 'cas') { bx(T, tw * .36, th * .5, .6, 0, th * .1, front - .2, c2); }
    if (ty !== 'cas' && ty !== 'aa') cy(TF, tw * .48, tw * .48, .12, 12, 0, .03, 0, 0x26282b);      // turret ring shadow line
    if (f.cup && ty !== 'aa') { cy(T, .34, .36, .32, 10, tw * .22, th + .14, -tl * .12, c1); cy(TF, .3, .3, .06, 10, tw * .22, th + .33, -tl * .12, MTL); }
    if (f.ant) cy(TF, .025, .03, 2.4, 4, -tw * .34, th + 1.2, -tl * .38, 0x1a1a1a);
    if (f.bins && ty !== 'aa') bx(T, tw * .8, th * .45, .35, 0, th * .45, -tl * (ty === 'cast' ? .72 : .84), c2);
    if (f.ml && ty !== 'ml') for (const s of [-1, 1]) { bx(T, .32, .32, 1.5, s * (tw / 2 + .22), th * .65, -tl * .05, c2); cy(TF, .1, .1, .04, 6, s * (tw / 2 + .22), th * .65, tl * .05 + .7, 0x111111, PI / 2); }
    if (ty !== 'aa' && ty !== 'arty') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) cy(TF, .08, .08, .36, 6, s * (tw * .45), th * .55 + i * .12, tl * .2, 0x202124, PI / 2 - .5, s * .4);      // smoke dischargers
    for (const s of [-1, 1]) bx(TF, .04, th * .35, tl * .3, s * (tw * (ty === 'cast' ? .5 : .46) + .02), th * .5, -tl * .05, tc);      // turret team band
    bx(KT, tw * .9, th * .6, .16, 0, th * .45, front + .02, c2, -.25);      // armour kit: turret cheek plates
    // ---- gun (origin = mantlet / trunnion) ----
    const [gl, gr, gn] = m.gun;
    if (ty === 'aa') {
        bx(Gp, tw * .45, th * .9, .9, 0, 0, 0, c2);
        for (let i = 0; i < gn; i++) { const ox = (i % 2 ? 1 : -1) * (tw * .28 + Math.floor(i / 2) * .22), oy = Math.floor(i / 2) * .22 - .1; cy(GF, gr, gr, gl, 6, ox, oy, gl / 2, 0x26282c, PI / 2); cy(GF, gr * 1.5, gr * 1.5, gl * .2, 6, ox, oy, gl * .92, 0x1a1b1d, PI / 2); }
    } else if (ty === 'ml') {
        for (const s of [-1, 1]) for (const k of [0, 1]) { bx(Gp, .42, .42, 1.8, s * .3, .25 + k * .44, .3, c2); cy(GF, .14, .14, .04, 8, s * .3, .25 + k * .44, 1.21, 0x111111, PI / 2); }
    } else {
        if (ty === 'cast') sph(Gp, 1, 0, 0, 0, c1, tw * .22, th * .38, .5); else tb(Gp, tw * .46, th * .56, .6, 0, 0, 0, c1, { fs: .15, tx: .8 });
        for (let i = 0; i < gn; i++) {
            const ox = gn === 1 ? 0 : (i - .5) * gr * 6;
            cy(Gp, gr, gr * 1.15, gl, 8, ox, 0, gl / 2 + .2, c2, PI / 2);
            if (f.fume) cy(Gp, gr * 1.55, gr * 1.55, gl * .14, 8, ox, 0, gl * .58, c2, PI / 2);
            if (f.mz) { bx(GF, gr * 3.4, gr * 2.2, gr * 4.4, ox, 0, gl + .1, 0x232427); } else cy(GF, gr * 1.25, gr * 1.25, .3, 8, ox, 0, gl + .1, 0x232427, PI / 2);
        }
    }
    const S = 3.2;
    return {
        body: merge2(B, BF, S), tur: merge2(T, TF, S), gun: merge2(Gp, GF, S), track: merge(TR), kitB: merge2(KB, null, S), kitT: merge2(KT, null, S), wheeled: wl,
        tpos: [0, top, m.tz], gpos: [0, ty === 'aa' ? th * .7 : ty === 'ml' ? th * .4 : th * .52, ty === 'aa' ? 0 : front], muz: [[0, 0, (ty === 'ml' ? 1.4 : gl) + .3]], len: hl,
        dec: ty === 'cas' ? [[(hw + trw * 1.6) * .5 * .93 + .04, top + th * .45, m.tz - tl * .1, .55]] : [], decT: ty === 'cas' ? [] : [[tw * (ty === 'cast' ? .53 : .45) + .04, th * .55, -tl * .2, .5]]
    };
}
function buildAir(m, team) {
    const B = [], BF = flatList(), L = m.len, S = m.span, k = m.k, f = flagSet(m.f), c1 = tint(m.c[0], .5), c2 = tint(m.c[1], .45), tc = teamCol(team), props = [];
    const prop = k === 'prop' || k === 'bomber', fr = L * (prop ? .085 : .07) * (f.big ? 1.15 : 1);
    const wy = f.high ? fr * .7 : f.low ? -fr * .6 : 0;
    const roundel = (x, y, z, r, rx, rz) => { cy(BF, r, r, .03, 14, x, y, z, tc, rx, 0, rz); cy(BF, r * .55, r * .55, .035, 12, x, y, z, WHITE, rx, 0, rz); cy(BF, r * .25, r * .25, .04, 10, x, y, z, tc, rx, 0, rz); };
    let dec = [];
    if (k === 'stealth') {
        tb(B, fr * 5.5, fr * 1.4, L * .82, 0, 0, 0, c1, { fx: .12, tx: .55, fs: L * .05, rs: 0 });
        tb(B, fr * 2, fr * 1.2, L * .3, 0, fr * .5, L * .2, c1, { fx: .3, tx: .5 });
        sph(BF, fr * .7, 0, fr * 1.15, L * .2, GLASS, .9, .7, 2.6);
        for (const s of [-1, 1]) {
            wing(B, L * .45, L * .1, S / 2 - fr * 2, L * .32, .25, s * fr * 2.2, 0, -L * .12, c1, s, 0);
            wing(B, L * .2, L * .1, fr * 3.4, L * .1, .14, s * fr * 1.6, fr * .6, -L * .36, c2, s, 0, true);
            bx(BF, fr * 1.2, fr * .9, L * .12, s * fr * 1.6, -fr * .2, L * .12, 0x1c1d20);      // intakes
            roundel(s * S * .32, .14, -L * .2, .6, 0, 0);
        }
        bx(BF, fr * 2.4, fr * .6, .3, 0, 0, -L * .41, 0x141414);
        dec = [[fr * 1.95, fr * 1.6, -L * .4, .45]];
        return { body: merge2(B, BF, 6), props, muz: [[-1, -.2, L * .35], [1, -.2, L * .35]], len: L, span: S, dec };
    }
    if (k === 'wing') {
        for (const s of [-1, 1]) { wing(B, L * .9, L * .18, S / 2, L * .55, .9, 0, 0, L * .2, c1, s, .02); for (let i = 0; i < 2; i++) tb(B, 1.2, .8, 3, s * (1.6 + i * 2), .5, L * .05 - i * .4, c2, { fs: .7, tx: .6 }); roundel(s * S * .3, .25, -L * .1, .9, 0, 0); }
        tb(B, 3.6, 1.6, L * .9, 0, .2, L * .05, c1, { fx: .25, tx: .5, fs: .8, rs: .4 });
        sph(BF, .55, 0, .9, L * .32, GLASS, 1.6, .5, 1.4);
        dec = [[1.85, .4, -L * .1, .5]];
        return { body: merge2(B, BF, 6), props, muz: [[-1, -.2, L * .4], [1, -.2, L * .4]], len: L, span: S, dec };
    }
    // ---- fuselage ----
    const nose = f.glassnose ? .55 : prop ? .75 : .05;
    if (prop) lathe(B, [[fr * nose, L * .5], [fr * .95, L * .44], [fr, L * .3], [fr * .95, L * .05], [fr * .7, -L * .2], [fr * .32, -L * .46], [fr * .12, -L * .5]], 10, 0, 0, 0, c1);
    else lathe(B, [[.05, L * .52], [fr * .45, L * .42], [fr * .85, L * .25], [fr, L * .05], [fr * .95, -L * .25], [fr * .75, -L * .44], [fr * .6, -L * .5]], 10, 0, 0, 0, c1);
    if (f.long) cy(B, fr * .8, fr * .9, L * .12, 10, 0, 0, L * .5, c1, PI / 2);
    if (f.glassnose) sph(BF, fr * .58, 0, 0, L * .5, GLASS, 1, 1, 1.4);
    if (!prop) cy(BF, fr * .58, fr * .5, L * .06, 10, 0, 0, -L * .51, 0x1b1b1d, PI / 2);      // exhaust nozzle
    // canopy
    if (f.bubble || !f.framed) sph(BF, fr * .62, 0, fr * .72, L * (prop ? .08 : .2), GLASS, .85, .75, 2.2);
    else { sph(BF, fr * .62, 0, fr * .72, L * .1, GLASS, .85, .7, 2.4); for (let i = 0; i < 3; i++) bx(BF, fr * 1.08, .05, .05, 0, fr * 1.05, L * .03 + i * L * .07, MTL); }
    // ---- wings ----
    const sw = m.sweep || 0, delta = k === 'delta', root = delta ? L * .55 : k === 'heavy' ? L * .24 : k === 'atk' ? L * .17 : L * .2, tip = delta ? L * .04 : root * (prop ? .55 : .4);
    const wz = delta ? -L * .12 : k === 'heavy' ? L * .02 : k === 'atk' ? -L * .02 : L * .02, half = S / 2;
    for (const s of [-1, 1]) {
        wing(B, root, tip, half - fr * .6, delta ? L * .45 : Math.tan(sw) * half, .2 * (prop ? 1.4 : 1), s * fr * .6, wy, wz, c1, s, prop || k === 'bomber' ? .04 : f.high ? -.03 : .02);
        roundel(s * half * .72, wy + .14 + half * .72 * (prop ? .04 : .02), wz - Math.tan(sw) * half * .72 * (delta ? 1.6 : 1), Math.min(.9, root * .25), 0, 0);
        roundel(s * (fr + .02), 0, -L * .2, fr * .45, 0, s * PI / 2);
        if (f.tip) cy(B, .32, .32, 2.2, 8, s * half, wy, wz - Math.tan(sw) * half, c2, PI / 2);
        if (f.canard) wing(B, L * .1, L * .03, fr * 2.2, L * .04, .1, s * fr * .7, fr * .2, L * .28, c1, s, 0);
        // tail
        if (k !== 'delta') wing(B, L * .13, L * .07, S * (k === 'heavy' ? .18 : .2), L * .04 + Math.tan(sw) * S * .1, .12, s * fr * .4, f.twin ? fr * .3 : .1, -L * .42, c2, s, 0);
        // ordnance under the wings
        if (k === 'atk' || f.big || k === 'heavy') for (let i = 0; i < 2; i++) cy(BF, .16, .16, 1.6, 6, s * (fr + 1.2 + i * 1.3), wy - .35, wz + .2, 0x3a3d40, PI / 2);
    }
    // vertical tails
    if (f.twin) for (const s of [-1, 1]) wing(B, L * .17, L * .08, fr * 2.1, L * .08, .14, s * fr * .9, fr * .6, -L * .38, c2, s, 0, true);
    else if (f.twintail) for (const s of [-1, 1]) { tb(B, .16, fr * 2.4, L * .13, s * S * .1, fr * .9, -L * .43, c2, { fs: L * .03, rs: 0 }); }
    else if (k === 'atk') for (const s of [-1, 1]) tb(B, .16, fr * 2.4, L * .12, s * S * .11, fr * .9, -L * .44, c2, { fs: L * .03 });
    else tb(B, .18, fr * 2.4, L * .18, 0, fr * 1.6, -L * .41, c2, { fs: L * .08, rs: -L * .02 });
    if (f.canted) for (const s of [-1, 1]) bx(BF, .05, fr * .4, L * .06, s * fr * 1.6, fr * 2.2, -L * .45, tc);
    else bx(BF, .2, fr * .5, L * .07, 0, fr * 2.2, -L * .46, tc);      // fin flash
    // ---- engines / intakes / props ----
    if (k === 'bomber' || k === 'heavy' || f.eng4) {
        const ne = f.eng4 ? 4 : 2;
        for (let i = 0; i < ne; i++) {
            const s = i % 2 ? 1 : -1, ex = s * S * (ne === 4 ? (i < 2 ? .17 : .32) : .22), ez = wz - Math.tan(sw) * Math.abs(ex) + (prop ? L * .06 : L * .04);
            if (prop) { lathe(B, [[fr * .3, L * .14], [fr * .48, L * .1], [fr * .5, -L * .05], [fr * .2, -L * .15]], 8, ex, wy - .2, ez, c2); props.push({ x: ex, y: wy - .2, z: ez + L * .145, r: fr * 1.6 + .6, ax: 'z' }); }
            else { cy(B, fr * .42, fr * .38, L * .22, 10, ex, wy - fr * .6, ez, c2, PI / 2); cy(BF, fr * .3, fr * .3, .05, 10, ex, wy - fr * .6, ez + L * .11, 0x111111, PI / 2); }
        }
    }
    if (f.twinpod) for (const s of [-1, 1]) { cy(B, fr * .5, fr * .45, L * .22, 10, s * fr * 1.25, fr * .9, -L * .22, c2, PI / 2); cy(BF, fr * .38, fr * .38, .05, 10, s * fr * 1.25, fr * .9, -L * .11, 0x111111, PI / 2); }
    if (k === 'atk') cy(BF, .12, .12, 1.6, 6, 0, -fr * .4, L * .55, 0x222222, PI / 2);      // the big nose gun
    if (k === 'prop') props.push({ x: 0, y: 0, z: L * .52 + (f.long ? L * .06 : 0), r: fr * 2.6 + .5, ax: 'z' });
    if (f.side || k === 'heavy' && !f.nose) for (const s of [-1, 1]) tb(BF, fr * .5, fr * .8, L * .22, s * fr * 1.02, -.05, L * .14, 0x1f2124, { fs: .4 });
    if (f.nose) cy(BF, fr * .45, fr * .45, .06, 10, 0, 0, L * .52, 0x111111, PI / 2);
    if (f.gear) for (const s of [-1, 1]) { bx(BF, .1, fr * 1.4, .1, s * fr * 1.6, -fr * 1.1, L * .06, MTL); cy(BF, .32, .32, .16, 10, s * fr * 1.6, -fr * 1.7, L * .06, 0x1d1d1d, 0, 0, PI / 2); }
    if (f.belly) bx(B, fr * 1.1, fr * .7, L * .3, 0, -fr * .85, 0, c2);
    dec = f.twin ? [[fr * .9 + .14, fr * 1.6, -L * .4, .5]] : f.twintail || k === 'atk' ? [[S * .1 + .1, fr * .9, -L * .43, .5]] : [[.12, fr * 1.5, -L * .39, .5]];
    return { body: merge2(B, BF, 6), props: props.map(p => ({ geo: propGeo(p.r, prop ? 3 : 2), pos: [p.x, p.y, p.z], ax: p.ax })), muz: [[-1.4, -.3, L * .35], [1.4, -.3, L * .35]], len: L, span: S, dec };
}
function propGeo(r, nb) { const g = flatList(); for (let i = 0; i < nb; i++) { const a = i * TAU / nb; bx(g, .14, r, .06, Math.sin(a) * r / 2, Math.cos(a) * r / 2, 0, 0x1e1e1e, 0, 0, -a); } cy(g, .22, .26, .5, 8, 0, 0, 0, MTL, PI / 2); return merge(g); }
function rotorGeo(r, nb) { const g = flatList(); for (let i = 0; i < nb; i++) { const a = i * TAU / nb; bx(g, .32, .06, r, Math.sin(a) * r / 2, 0, Math.cos(a) * r / 2, 0x1c1c1c, 0, a); } cy(g, .3, .3, .4, 8, 0, 0, 0, MTL); return merge(g); }
function buildHeli(m, team) {
    const B = [], BF = flatList(), L = m.len, R = m.span / 2, f = flagSet(m.f), c1 = tint(m.c[0], .5), c2 = tint(m.c[1], .45), tc = teamCol(team), props = [];
    const bw = f.tandem ? L * .1 : L * .14;
    if (f.tandem) {
        tb(B, bw * 2, bw * 2.4, L * .5, 0, 0, L * .08, c1, { fx: .45, tx: .7, fs: L * .1, rs: L * .06 });
        sph(BF, bw * .85, 0, bw * 1.3, L * .26, GLASS, .9, .8, 1.6); sph(BF, bw * .85, 0, bw * 1.6, L * .1, GLASS, .9, .8, 1.6);
        cy(BF, .1, .1, 1.3, 6, 0, -bw * 1.2, L * .3, 0x1d1d1d, PI / 2);      // chin gun
    } else { sph(B, bw * 1.25, 0, 0, L * .12, c1, 1, 1, 1.5); sph(BF, bw * 1.05, 0, bw * .3, L * .24, GLASS, 1, .9, 1.1); }
    cy(B, bw * .55, bw * .22, L * .55, 8, 0, bw * .3, -L * .26, c1, PI / 2);      // tail boom
    tb(B, .16, L * .16, L * .1, 0, bw * .3 + L * .07, -L * .52, c2, { fs: L * .05 });      // fin
    for (const s of [-1, 1]) wing(B, L * .06, L * .04, L * .1, 0, .1, s * .1, bw * .3, -L * .45, c2, s, 0);
    cy(B, bw * .6, bw * .8, bw * .8, 8, 0, bw * 1.25, L * .02, c2);      // engine hump / mast base
    for (const s of [-1, 1]) { cy(BF, bw * .32, bw * .32, .05, 8, s * bw * .62, bw * 1.3, -L * .06, 0x111111, 0, 0, PI / 2); bx(BF, .05, bw * .7, L * .1, s * (bw * (f.tandem ? 1 : 1.25) + .02), 0, -L * .02, tc); }
    if (f.stubs) for (const s of [-1, 1]) { wing(B, L * .1, L * .07, L * .14, 0, .14, s * bw * .9, -bw * .2, L * .02, c2, s, -.05); cy(BF, .28, .28, 1.4, 8, s * (bw * .9 + L * .12), -bw * .55, L * .02, 0x34373b, PI / 2); }
    if (f.scout || !f.tandem) for (const s of [-1, 1]) { bx(BF, .1, .1, L * .45, s * bw * 1.1, -bw * 1.45, L * .08, MTL); for (const z of [L * .2, -L * .05]) bx(BF, .08, bw * .6, .08, s * bw * 1.05, -bw * 1.15, z, MTL); }
    else for (const s of [-1, 1]) cy(BF, .28, .28, .2, 10, s * bw * .9, -bw * 1.35, L * .2, 0x1d1d1d, 0, 0, PI / 2);
    const mastY = bw * 1.7 + .25;
    cy(BF, .12, .12, .5, 6, 0, mastY - .2, L * .02, MTL);
    props.push({ geo: rotorGeo(R * 2, f.tandem ? 4 : 2), pos: [0, mastY, L * .02], ax: 'y' });
    if (f.coax) props.push({ geo: rotorGeo(R * 2, 4), pos: [0, mastY + .5, L * .02], ax: '-y' });
    else props.push({ geo: propGeo(L * .16, 2), pos: [.2, bw * .3 + L * .08, -L * .54], ax: 'x' });
    return { body: merge2(B, BF, 5), props, muz: [[0, -bw * 1.2, L * .4], [-bw - L * .12, -bw * .55, L * .1], [bw + L * .12, -bw * .55, L * .1]], len: L, span: m.span, heli: true, dec: [[.1, bw * .3 + L * .06, -L * .5, .45]] };
}
// ship hull: pointed bow, sheer line, waterline boot topping and an antifouling red bottom, a deck of its own colour
function hullGeo(L, w, h, dep, deck, c1, bowK, sternK) {
    const g = new THREE.BoxGeometry(w, h + dep, L, 1, 3, 12), p = g.attributes.position, n = p.count, cols = new Float32Array(n * 4);
    g.translate(0, (h - dep) / 2, 0);
    for (let i = 0; i < n; i++) {
        let X = p.getX(i), Y = p.getY(i), Z = p.getZ(i); const t = Z / (L / 2);
        let k = 1; if (t > 0) k = Math.max(0.02, 1 - Math.pow(t, bowK || 2.2)); else k = 1 - Math.pow(-t, 4) * (sternK || .3);
        if (Y < 0) k *= .78 + (1 + Y / dep) * .22;
        X *= k; if (Y > 0) Y += Math.max(0, t) * Math.max(0, t) * h * .6; if (Y < -dep * .5) X *= .8;
        p.setXYZ(i, X, Y, Z);
    }
    g.computeVertexNormals();
    const nn = g.attributes.normal, cd = new THREE.Color(deck), ch = new THREE.Color(c1), cr = new THREE.Color(0x7a2f26), cb = new THREE.Color(0x1d1f22);
    for (let i = 0; i < n; i++) {
        const y = p.getY(i), up = nn.getY(i) > .85 && y > h * .5;
        const c = up ? cd : y < -dep * .3 ? cr : y < .2 ? cb : ch;
        cols[i * 4] = c.r; cols[i * 4 + 1] = c.g; cols[i * 4 + 2] = c.b; cols[i * 4 + 3] = up || y < .2 ? 0 : 1;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 4));
    return g;
}
function shipTurret(s, nb, c1, c2) {
    const T = [], TF = flatList(), bl = s * 3.2 + 1.5;
    cy(T, s * .85, s * .95, s * .45, 10, 0, s * .22, 0, c2);
    tb(T, s * 1.5, s * .7, s * 1.9, 0, s * .8, -s * .1, c1, { fs: s * .35, rs: s * .05, tx: .85 });
    for (let i = 0; i < nb; i++) { const ox = nb === 1 ? 0 : (i - (nb - 1) / 2) * s * .5; cy(T, s * .12, s * .15, bl, 8, ox, s * .82, s * .85 + bl / 2, c2, PI / 2); cy(TF, s * .15, s * .15, .2, 8, ox, s * .82, s * .85 + bl, 0x1d1e20, PI / 2); }
    bx(TF, s * .9, .05, .4, 0, s * 1.16, -s * .5, 0x2a2c2f);
    return { geo: merge2(T, TF, 8), muz: [bl + s * .85 + .2, s * .82, nb, s] };
}
function buildShip(m, team) {
    const B = [], BF = flatList(), K = [], len = m.len, w = m.w, h = m.h || (m.k === 'mtb' ? 1.4 : 2), k = m.k, c1 = tint(m.c[0], .45), c2 = tint(m.c[1], .4), tc = teamCol(team);
    const deckY = h, deckC = k === 'mtb' || k === 'pb' ? 0x8a7a62 : 0x6d7178;
    if (k === 'sub') return buildSub(m, team);
    { const g = hullGeo(len, w, h, k === 'mon' ? 1.2 : 1.6, deckC, c1, k === 'mtb' ? 1.6 : 2.4, k === 'mon' ? .1 : .35); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); B.push(g); }      // hullGeo carries its own colours
    // team band near the bow + flag
    for (const s of [-1, 1]) bx(BF, .05, h * .45, len * .08, s * (w * .5 * (1 - Math.pow(.42, 2.4)) + .02), h * .5, len * .3, tc);
    const [bz, bs] = m.br || [0, 1.5];
    if (k === 'mtb') {
        tb(B, w * .55, bs * .9, len * .22, 0, deckY + bs * .45, bz + len * .05, c1, { fs: bs * .6, tx: .8 });
        bx(BF, w * .5, .2, .1, 0, deckY + bs * .7, bz + len * .05 + len * .11 - bs * .55, 0x1b2a38, -.6);
    } else if (k === 'mod') {
        tb(B, w * .7, bs * 1.6, len * .3, 0, deckY + bs * .8, bz - len * .05, c1, { tx: .75, fs: bs * .4, rs: bs * .3 });
        tb(B, w * .4, bs * 2.2, w * .5, 0, deckY + bs * 2.6, bz, c1, { tx: .5, fs: .8, rs: .8 });      // pyramid mast
        for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) bx(BF, w * .14, .06, w * .14, (j - .5) * w * .18, deckY + .05, len * .24 - i * w * .18, 0x2b2d31);      // VLS cells
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) bx(BF, w * .14, .06, w * .14, (j - .5) * w * .18, deckY + .05, -len * .3 - i * w * .18, 0x2b2d31);
        bx(BF, w * .5, .25, .1, 0, deckY + bs * 1.3, bz + len * .1 - .2, 0x1b2a38, -.3);
    } else {
        const sw = k === 'mon' ? w * .35 : w * .55;
        tb(B, sw, bs, w * .9 + (k === 'bb' || k === 'cl' ? len * .06 : 0), 0, deckY + bs / 2, bz, c1, { tx: .9 });
        tb(B, sw * .8, bs * .6, w * .6, 0, deckY + bs * 1.3, bz + w * .05, c2, { tx: .9, fs: .2 });
        bx(BF, sw * .82, .2, .06, 0, deckY + bs * 1.42, bz + w * .35 + .02, 0x1b2a38);      // bridge windows
        for (const s of [-1, 1]) bx(B, w * .18, .12, .8, s * (sw * .5 + w * .09), deckY + bs * 1.1, bz + w * .2, c2);      // bridge wings
        if (k === 'bb' || k === 'cl') tb(B, sw * .55, bs * 1.4, w * .45, 0, deckY + bs * 2.2, bz - w * .1, c1, { tx: .7, fs: .4 });      // tower
        // mast with yards
        cy(BF, .09, .12, bs * 2.6, 5, 0, deckY + bs * (k === 'bb' ? 3.6 : 2.6), bz - w * .2, MTL); bx(BF, w * .5, .07, .07, 0, deckY + bs * (k === 'bb' ? 4.3 : 3.3), bz - w * .2, MTL);
        bx(BF, .05, .55, .9, 0, deckY + bs * (k === 'bb' ? 4.9 : 3.9), bz - w * .2 - .45, tc);
        for (let i = 0; i < (m.fun || 0); i++) { const fz = bz - w * .75 - i * w * .78; cy(B, .62, .72, bs * 1.1, 10, 0, deckY + bs * .9, fz, c2); cy(BF, .64, .64, .25, 10, 0, deckY + bs * 1.5, fz, 0x18191b); }
        // secondary batteries and light AA along the sides of the bigger ships
        if (k === 'bb' || k === 'cl') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const z = bz - len * .06 + i * len * .07; bx(B, .9, .5, 1.1, s * w * .34, deckY + .3, z, c2); cy(BF, .06, .06, 1.4, 5, s * w * .34, deckY + .45, z + .9, 0x222326, PI / 2); }
        if (m.tp) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) cy(B, .16, .16, 2.4, 6, s * w * .22 + s * i * .02, deckY + .35 + i * .0, bz - w * 1.9 - i * .38, c2, PI / 2, s * .25);
    }
    if (k === 'mtb' && m.tp) for (const s of [-1, 1]) cy(B, .26, .26, len * .3, 8, s * w * .36, deckY + .3, -len * .08, c2, PI / 2);
    // radar kit (the Radar module shows it)
    cy(K, .05, .05, 1.4, 4, 0, deckY + bs * 2.4 + .7, bz - w * .35, MTL); bx(K, 1.8, .5, .12, 0, deckY + bs * 2.4 + 1.5, bz - w * .35, c2);
    const turs = m.tur.map(([z, s, nb]) => { const t = shipTurret(s, nb, c1, c2), sup = m.tur.some(o => Math.sign(o[0]) === Math.sign(z) && Math.abs(o[0]) > Math.abs(z)); return { geo: t.geo, pos: [0, deckY + .15 + (sup ? s * .75 : 0), z], muz: t.muz }; });
    return { body: merge2(B, BF, 10), turs, kitB: merge2(K, null, 10), len, w, dec: [[w * .5 * (1 - Math.pow(.6, k === 'mtb' ? 1.6 : 2.4)) + .06, h * .62, len * .3, Math.min(1.2, h * .45)]] };
}
function buildSub(m, team) {
    const B = [], BF = flatList(), K = [], len = m.len, w = m.w, c1 = tint(m.c[0], .3), c2 = tint(m.c[1], .3), tc = teamCol(team), r = w / 2;
    lathe(B, [[.05, len * .5], [r * .7, len * .44], [r, len * .3], [r, -len * .2], [r * .6, -len * .4], [r * .15, -len * .5]], 12, 0, 0, 0, c1);
    bx(BF, w * .8, .1, len * .55, 0, r * .96, len * .02, 0x2c3036);      // deck casing
    tb(B, w * .32, r * 2.4, len * .14, 0, r + r * 1.1, len * .12, c1, { fs: len * .03, tx: .8 });      // sail
    for (const s of [-1, 1]) { wing(B, len * .05, len * .035, w * .55, 0, .1, s * w * .14, r * 1.9, len * .13, c2, s, 0); wing(B, len * .06, len * .04, w * .7, len * .02, .1, s * r * .4, 0, -len * .44, c2, s, 0); bx(BF, .04, r * .7, len * .06, s * (w * .16 + .01), r * 2.1, len * .1, tc); }
    tb(B, .1, w * 1.3, len * .06, 0, 0, -len * .44, c2, { fs: len * .02 });
    cy(BF, .06, .06, r * 1.6, 4, 0, r * 3.6, len * .1, MTL); cy(BF, .05, .05, r * 1.2, 4, .2, r * 3.4, len * .14, MTL);
    cy(BF, r * .55, r * .55, .2, 3, 0, 0, -len * .52, 0x2a2a2a, PI / 2);      // screw
    cy(K, .05, .05, 1, 4, -.25, r * 3.7, len * .12, MTL); bx(K, .7, .25, .08, -.25, r * 4.2, len * .12, c2);
    const turs = m.tur.map(([z, s, nb]) => { const t = shipTurret(s, nb, c1, c2); return { geo: t.geo, pos: [0, r * 1.02, z + len * .12], muz: t.muz }; });
    return { body: merge2(B, BF, 8), turs, kitB: merge2(K, null, 8), len, w, sub: true, dec: [[w * .17, r * 2, len * .1, .6]] };
}
const PARTS = {};
function getParts(def, team) {
    const b = def.base || def, key = b.id + '|' + (team | 0);
    if (PARTS[key]) return PARTS[key];
    const P = b.ln === 'g' ? buildTank(b.m, team | 0) : b.ln === 'a' ? (b.heli ? buildHeli(b.m, team | 0) : buildAir(b.m, team | 0)) : buildShip(b.m, team | 0);
    return PARTS[key] = P;
}
// two-digit decal quads (hull / turret / tail numbers), one small geometry per vehicle
function decalGeo(list, num) {      // list entries [x, y, z, size] on the +X side; each is mirrored to -X
    const pos = [], uv = [], nrm = [], idx = []; let v = 0;
    const d = [Math.floor(num / 10) % 10, num % 10];
    for (const [x0, y, z, s] of list) for (const sd of [1, -1]) {
        const x = x0 * sd, nx = sd, rz = -sd;      // normal (+-1,0,0), reading direction along -+Z
        for (let j = 0; j < 2; j++) {
            const ox = (j - .5) * s * .82;
            for (const [qx, qy] of [[-.45, -.5], [.45, -.5], [.45, .5], [-.45, .5]]) {
                pos.push(x + nx * .02, y + qy * s, z + (qx * s + ox) * rz); nrm.push(nx, 0, 0);
                uv.push((d[j] + .5 + qx * .9) / 10, qy > 0 ? .97 : .03);
            }
            idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
        }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
}
// ---- build a live model for an entity ----
function makeModel(def, team, num) {
    const b = def.base || def, P = getParts(def, team), root = new THREE.Group(), o = { root, team, muzzles: [], turs: [], props: [], tur: null, gun: null, kit: [], disposables: [] };
    const mat = MAT.veh[b.ln + ((team | 0) & 1)];
    const add = (geo, m, parent, pos) => { const me = new THREE.Mesh(geo, m); if (pos) me.position.set(pos[0], pos[1], pos[2]); me.castShadow = true; me.receiveShadow = b.ln === 'n'; (parent || root).add(me); return me; };
    o.body = add(P.body, mat);
    const nm = num === undefined ? 10 + Math.floor(Math.random() * 89) : num;
    if (P.dec && P.dec.length) { const g = decalGeo(P.dec, nm); o.disposables.push(g); const d = add(g, MAT.decal); d.castShadow = false; }
    if (P.kitB) { const kb = add(P.kitB, mat); kb.visible = b.ln === 'n' ? !!def.radar : !!def.kit; o.kit.push(kb); }
    if (b.ln === 'g') {
        const tex = TEX.track.clone(); tex.needsUpdate = true; o.trMat = MAT.track.clone(); o.trMat.map = tex; o.disposables.push(tex, o.trMat);
        add(P.track, o.trMat);
        const tg = new THREE.Group(); tg.position.set(P.tpos[0], P.tpos[1], P.tpos[2]); root.add(tg); o.tur = tg;
        add(P.tur, mat, tg);
        if (P.kitT) { const kt = add(P.kitT, mat, tg); kt.visible = !!def.kit; o.kit.push(kt); }
        if (P.decT && P.decT.length) { const g = decalGeo(P.decT, nm); o.disposables.push(g); add(g, MAT.decal, tg).castShadow = false; }
        const gg = new THREE.Group(); gg.position.set(P.gpos[0], P.gpos[1], P.gpos[2]); tg.add(gg); o.gun = gg;
        add(P.gun, mat, gg);
        const mz = new THREE.Object3D(); mz.position.set(0, 0, P.muz[0][2]); gg.add(mz); o.muzzles.push(mz);
    } else if (b.ln === 'a') {
        for (const p of P.props) { const g = new THREE.Group(); g.position.set(p.pos[0], p.pos[1], p.pos[2]); g.userData.ax = p.ax; root.add(g); add(p.geo, mat, g).castShadow = false; o.props.push(g); }
        for (const p of P.muz) { const mz = new THREE.Object3D(); mz.position.set(p[0], p[1], p[2]); root.add(mz); o.muzzles.push(mz); }
        if (P.heli) { o.chin = new THREE.Object3D(); o.chin.position.set(P.muz[0][0], P.muz[0][1], P.muz[0][2]); root.add(o.chin); }
    } else {
        for (const t of P.turs) {
            const g = new THREE.Group(); g.position.set(t.pos[0], t.pos[1], t.pos[2]); if (t.pos[2] < -1) g.userData.aft = 1; root.add(g); add(t.geo, mat, g); o.turs.push(g);
            const mz = new THREE.Object3D(); mz.position.set(0, t.muz[1], t.muz[0]); g.add(mz); o.muzzles.push(mz);
        }
        if (!o.turs.length) { const mz = new THREE.Object3D(); mz.position.set(0, (P.w || 3) * .6, P.len * .4); root.add(mz); o.muzzles.push(mz); o.tur = null; }
        else o.tur = o.turs[0];
    }
    root.rotation.order = 'YXZ';
    return o;
}
function disposeModel(o) { if (o && o.disposables) for (const d of o.disposables) d.dispose(); }
initMaterials();
