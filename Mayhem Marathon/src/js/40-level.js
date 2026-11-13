// ============================================================
// LEVEL BUILDER: helpers the round builders use. Everything a round builds goes into the physics
// world (W) and the level description L (spawns, bot path, checkpoints, finish, kill height...).
// ============================================================
let L = null;
const ROUNDS = {};            // id -> definition (build, hooks); names/kinds are in ROUND_INFO
function newLevel() {
    L = { spawns: [], path: [], cps: [], finZ: 1e9, finY: -99, finW: 99, killY: -14, center: [0, 50], extra: [], group: new THREE.Group(), hazards: [], tiles: [], intro: null, spawnYaw: 0 };
    return L;
}
const HAZ = 0xff4f6d, HAZ2 = 0xff8a2b, MOV = 0x7ee23a, BLU = 0x3fb8ff, YEL = 0xffd23f, PNK = 0xff5fa2, WHT = 0xf7f3ff;
function addC(c) { worldAdd(c); if (c.fx && c.fx.knock) L.hazards.push(c); return c; }
function box(x, y, z, w, h, d, o) { return addC(mkCol(K_BOX, x, y, z, w / 2, h / 2, d / 2, o)); }
function cyl(x, y, z, r, h, o) { return addC(mkCol(K_CYL, x, y, z, r, h / 2, 0, o)); }
function sph(x, y, z, r, o) { return addC(mkCol(K_SPH, x, y, z, r, r, r, o)); }
// a floor with alternating coloured strips, top surface at y
function floorStrip(x, z0, z1, w, y, cA, cB, o) {
    const n = Math.max(1, Math.round((z1 - z0) / 4)), len = (z1 - z0) / n;
    for (let i = 0; i < n; i++) box(x, y - 0.5, z0 + len * (i + 0.5), w, 1, len, Object.assign({ col: i % 2 ? cB : cA }, o || {}));
}
function ramp(x, z0, z1, y0, y1, w, col, o) {
    o = o || {}; if (z1 < z0) { [z0, z1] = [z1, z0]; [y0, y1] = [y1, y0]; } const dz = z1 - z0, dy = y1 - y0, len = Math.hypot(dz, dy), a = Math.atan2(dy, dz), th = o.th || 1;
    const ny = Math.cos(a), nz = -Math.sin(a);
    return box(x, (y0 + y1) / 2 - ny * th / 2, (z0 + z1) / 2 - nz * th / 2, w, th, len + 0.02, Object.assign({ col, rx: -a }, o));
}
function spawnGrid(cz, y) { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) L.spawns.push([-4.5 + c * 3 + (r % 2) * 0.6, (y || 0) + PR + 0.05, cz - r * 2]); }
function spawnRing(rad, y, cx, cz) { for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; L.spawns.push([(cx || 0) + Math.sin(a) * rad * (i % 2 ? 0.62 : 1), (y || 0) + PR + 0.05, (cz || 0) + Math.cos(a) * rad * (i % 2 ? 0.62 : 1)]); } }
function cp(z, y, x) { L.cps.push({ z, y, x: x || 0 }); }
function P(x, y, z, r, j) { L.path.push({ x, y, z, r: r == null ? 2 : r, j: !!j }); }
function deco(geo, hex, shade) { L.extra.push(colorGeo(geo, hex, shade)); }
function startPad(y) {
    floorStrip(0, -9, 4, 16, y || 0, 0xfff2b3, 0xffe27a);
    box(-8.4, (y || 0) + 0.5, -2.5, 0.8, 1, 13, { col: PNK }); box(8.4, (y || 0) + 0.5, -2.5, 0.8, 1, 13, { col: PNK }); box(0, (y || 0) + 0.5, -9.4, 17.6, 1, 0.8, { col: PNK });
    spawnGrid(0, y);
}
function finishArch(z, y, w) {
    w = w || 14;
    box(-w / 2 - 0.6, y + 2.6, z, 1.2, 5.2, 1.2, { col: WHT }); box(w / 2 + 0.6, y + 2.6, z, 1.2, 5.2, 1.2, { col: WHT });
    const n = Math.round(w / 1.2);
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) deco(placeGeo(new THREE.BoxGeometry(w / n, 0.6, 0.8), -w / 2 + (i + 0.5) * w / n, y + 4.6 + k * 0.6, z), (i + k) % 2 ? 0x222233 : 0xffffff, false);
    deco(placeGeo(new THREE.BoxGeometry(w + 2.4, 0.3, 1.2), 0, y + 5.35, z), YEL);
    L.finZ = z; L.finY = y; L.finW = w / 2 + 1.5;
}
// spinning bar on a post: low bars you jump
function spinner(x, z, y, len, speed, phase, col) {
    cyl(x, y + 0.75, z, 0.5, 1.5, { col: 0x8a8fb0 });
    return box(x, y + 0.6, z, len, 0.5, 0.55, { col: col || HAZ, fx: { knock: 7 }, mv: (t, c) => { setRot(c, 0, phase + t * speed, 0); c.p[0] = x; c.p[1] = y + 0.6; c.p[2] = z; } });
}
function hammer(x, z, y, phase, amp, rate) {
    const piv = y + 9;
    box(x - 8, piv / 2 + y / 2, z, 0.8, piv - y, 0.8, { col: 0x8a8fb0 }); box(x + 8, piv / 2 + y / 2, z, 0.8, piv - y, 0.8, { col: 0x8a8fb0 });
    box(x, piv + 0.4, z, 16.8, 0.8, 0.8, { col: 0x8a8fb0, solid: false });
    const ang = t => amp * Math.sin(t * rate + phase);
    box(x, 0, z, 0.3, 6.4, 0.3, { col: 0x6b6f8f, solid: false, mv: (t, c) => setPivot(c, x, piv, z, 0, -3.3, 0, 0, 0, ang(t)) });
    return box(x, 0, z, 2.6, 2.2, 2.0, { col: HAZ2, fx: { knock: 9 }, mv: (t, c) => setPivot(c, x, piv, z, 0, -7.2, 0, 0, 0, ang(t)) });
}
function pusher(xa, xb, z, y, rate, phase, w, d) {      // a block that slides between xa and xb
    return box(xa, y + 0.6, z, w || 2.2, 1.2, d || 1.6, { col: HAZ, fx: { knock: 6 }, mv: (t, c) => { c.p[0] = lerp(xa, xb, 0.5 + 0.5 * Math.sin(t * rate + phase)); c.p[1] = y + 0.6; c.p[2] = z; } });
}
function bouncePad(x, y, z, r, power) { return cyl(x, y + 0.1, z, r, 0.3, { col: 0x52f2c2, fx: { bounce: power || 15 } }); }
function walls(cx, cz, w, d, y, h, col) {
    box(cx, y + h / 2, cz - d / 2 - 0.5, w + 2, h, 1, { col }); box(cx, y + h / 2, cz + d / 2 + 0.5, w + 2, h, 1, { col });
    box(cx - w / 2 - 0.5, y + h / 2, cz, 1, h, d, { col }); box(cx + w / 2 + 0.5, y + h / 2, cz, 1, h, d, { col });
}
// shared host logic for floors whose tiles drop a moment after being stepped on
function tileStep(R, c, delay) {
    if (!c || c.tag !== 'tile' || c.ts || !c.on) return;
    c.ts = 1; c.dropAt = R.t + delay; c.shake = 1; setColColor(c, c.warn || 0xff4f6d);
    if (G.host) netEvent({ k: 'tile', i: c.id, at: +c.dropAt.toFixed(2) });
}
function tilesTick(R) {
    for (const c of L.tiles) if (c.ts === 1 && R.t >= c.dropAt && c.on) { c.on = false; c.shake = 0; if (R.t - c.dropAt < 0.5) sfx('crack', { x: c.p[0], y: c.p[1], z: c.p[2] }, 0.5); }
}
