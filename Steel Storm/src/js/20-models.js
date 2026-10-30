// ============================================================
// LOW-POLY MODELS: every vehicle is 2-5 merged meshes (hull, turret, gun, team marks). Geometry is built once per vehicle and shared.
// Model forward is +Z, up +Y. Vertex colors, one Lambert material.
// ============================================================
function paint(g, col) {
    const c = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g;
}
function place(g, x, y, z, rx, ry, rz) { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; }
function bx(L, w, h, d, x, y, z, col, rx, ry, rz) { const g = new THREE.BoxGeometry(w, h, d); place(g, x, y, z, rx, ry, rz); paint(g, col); L.push(g); }
function cy(L, rt, rb, h, seg, x, y, z, col, rx, ry, rz) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); place(g, x, y, z, rx, ry, rz); paint(g, col); L.push(g); }
function sph(L, r, x, y, z, col, sx, sy, sz) { const g = new THREE.SphereGeometry(r, 7, 5); g.scale(sx || 1, sy || 1, sz || 1); place(g, x, y, z); paint(g, col); L.push(g); }
function bow(L, w, h, l, x, y, z, col, taper) {      // box that narrows toward +Z
    const g = new THREE.BoxGeometry(w, h, l); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getZ(i) > 0) p.setX(i, p.getX(i) * (taper || 0.12));
    place(g, x, y, z); paint(g, col); L.push(g);
}
const merge = L => L.length ? mergeGeometries(L, false) : null;
const MAT = {
    base: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    team: [0, 1].map(t => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: TEAM_COL[t], emissive: TEAM_COL[t], emissiveIntensity: 0.25 })),
    dead: new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true })
};
const PARTS = {};
function getParts(def) {
    if (PARTS[def.id]) return PARTS[def.id];
    const P = def.ln === 'g' ? buildTank(def.m) : def.ln === 'a' ? buildAir(def.m) : buildShip(def.m);
    return PARTS[def.id] = P;
}
function buildTank(m) {
    const B = [], T = [], G = [], K = [], [hw, hh, hl] = m.hull, [tw, th, tl] = m.tur, tr = Math.max(0.6, hw * 0.2), dk = 0x24262a, y0 = 0.62;
    for (const s of [-1, 1]) {
        bx(B, tr, 1.15, hl * 1.06, s * (hw / 2 + tr * 0.15), 0.6, 0, dk);
        const nw = Math.round(hl / 1.3);
        for (let i = 0; i < nw; i++) cy(B, 0.5, 0.5, tr * 1.08, 6, s * (hw / 2 + tr * 0.15), 0.52, -hl / 2 + 0.5 + i * (hl - 1) / (nw - 1), 0x15171a, 0, 0, PI / 2);
        if (m.sk) bx(B, 0.12, 0.85, hl * 0.82, s * (hw / 2 + tr * 0.85), 0.95, 0, m.c[0]);
        bx(K, 0.14, 0.2, hl * 0.7, s * (hw / 2 + .02), y0 + hh * .85, -0.1, 0xffffff);
    }
    bx(B, hw, hh, hl, 0, y0 + hh / 2, 0, m.c[0]);
    bx(B, hw * .96, hh * .7, hl * .28, 0, y0 + hh * .6, hl * .5, m.c[0], -0.55);          // sloped glacis
    bx(B, hw * .7, .2, hl * .22, 0, y0 + hh + .08, -hl * .38, COL.DK2);                    // engine deck
    bx(K, hw * .5, .12, .3, 0, y0 + hh + .08, -hl * .5, 0xffffff);
    if (m.cas) { bx(B, hw * .98, hh * .6, tl * 0.9, 0, y0 + hh + hh * .3, tz(m), m.c[1]); }
    // turret (group pivot at (0, y0+hh, tz))
    const tz0 = m.tz;
    if (m.cas) { bx(T, tw * .55, th * .9, tl * .5, 0, th / 2, -tl * .1, m.c[1]); }
    else { bx(T, tw, th, tl, 0, th / 2, 0, m.c[1]); bx(T, tw * .9, th * .5, tl * .35, 0, th * .45, -tl * .6, m.c[1]); }
    bx(T, .6, .22, .6, tw * .2, th + .08, -tl * .1, m.c[0]); cy(T, .12, .12, .8, 5, -tw * .25, th + .4, -tl * .2, 0x333333);
    // gun (pivot at (0, th*.55, tl/2))
    const [gl, gr, gn] = m.gun;
    bx(G, tw * .55, th * .55, .5, 0, 0, 0, COL.DK2);
    for (let i = 0; i < gn; i++) { const ox = gn === 1 ? 0 : (i - .5) * gr * 5; cy(G, gr, gr * 1.1, gl, 6, ox, 0, gl / 2, 0x2b2e33, PI / 2); cy(G, gr * 1.5, gr * 1.5, .5, 6, ox, 0, gl, 0x1a1c1f, PI / 2); }
    return { body: merge(B), mark: merge(K), tur: merge(T), gun: merge(G), tpos: [0, y0 + hh, m.cas ? tz(m) + 0.2 : tz0], gpos: [0, th * .55, m.cas ? tl * .25 : tl / 2], muz: [[0, 0, gl + .3]], len: hl };
}
function tz(m) { return m.tz; }
function buildAir(m) {
    const B = [], K = [], Pp = [], L = m.len, S = m.span, [c1, c2] = m.c, k = m.k, glass = 0x8fd8ff;
    const prop = k === 'prop' || k === 'bomber';
    const fr = L * (prop ? 0.09 : 0.075);
    cy(B, fr * .85, fr * .55, L * .72, 8, 0, 0, L * .02, c1, PI / 2);                    // fuselage (top of cylinder = front)
    cy(B, 0.01, fr * .85, L * .24, 8, 0, 0, L * .5, k === 'delta' ? c2 : c1, PI / 2);    // nose cone
    if (!prop) { cy(B, fr * .5, fr * .6, L * .1, 8, 0, 0, -L * .36, 0x222222, PI / 2); }
    sph(B, fr * .8, 0, fr * .65, L * .12, glass, .9, .8, 2.1);                           // canopy
    const sw = m.sweep || 0, chord = k === 'delta' ? L * .5 : k === 'heavy' ? L * .26 : k === 'bomber' ? L * .2 : L * .2, wz = k === 'delta' ? -L * .12 : L * .0;
    const wy = k === 'heavy' || k === 'bomber' ? 0.2 : -0.1;
    for (const s of [-1, 1]) {
        const b = S / 2, cs = Math.cos(sw), sn = Math.sin(sw);
        bx(B, b, .16, chord, s * b / 2 * cs + s * fr * .4, wy, wz - b / 2 * sn, c1, 0, s * sw, 0);
        bx(K, .3, .22, chord * .7, s * (b * cs + fr * .3), wy, wz - b * sn, 0xffffff, 0, s * sw, 0);
        // tail plane
        bx(B, S * .2, .12, L * .12, s * S * .1, .1, -L * .42, c2);
    }
    if (k === 'jet' || k === 'heavy') { if (m.twin) for (const s of [-1, 1]) bx(B, .2, fr * 1.5, L * .2, s * fr * 1.6, fr * 1.3, -L * .38, c2, 0, 0, -s * .25); else bx(B, .2, fr * 1.5, L * .2, 0, fr * 1.3, -L * .38, c2); }
    if (k === 'prop' || k === 'bomber' || k === 'delta') bx(B, .2, fr * 1.8, L * .18, 0, fr * 1.2, -L * .4, c2);
    bx(K, .22, fr * .6, L * .1, 0, fr * 1.6, -L * .42, 0xffffff);
    if (k === 'bomber' || k === 'heavy') for (const s of [-1, 1]) {      // engines on the wings
        cy(B, fr * .45, fr * .5, L * .3, 7, s * S * .22, wy - .1, L * .02, c2, PI / 2);
        if (k === 'bomber') Pp.push({ x: s * S * .22, y: wy - .1, z: L * .18 });
    }
    if (m.belly) bx(B, fr * 1.1, fr * .8, L * .35, 0, -fr * .8, 0, COL.DK);
    if (k === 'prop') Pp.push({ x: 0, y: 0, z: L * .5 });
    if (k === 'jet' || k === 'heavy') for (const s of [-1, 1]) bx(B, fr * .5, fr * .7, L * .3, s * fr * 1.1, -.05, L * .18, COL.DK);   // intakes
    const props = Pp.map(p => { const g = []; bx(g, .12, fr * 2.6 + 1, .1, 0, 0, 0, 0x222222); bx(g, fr * 2.6 + 1, .12, .1, 0, 0, 0, 0x222222); cy(g, .25, .25, .4, 6, 0, 0, 0, c2, PI / 2); return { geo: merge(g), pos: [p.x, p.y, p.z + .2] }; });
    return { body: merge(B), mark: merge(K), props, muz: [[-1.4, -.3, L * .35], [1.4, -.3, L * .35]], len: L, span: S };
}
function buildShip(m) {
    const B = [], K = [], len = m.len, w = m.w, h = m.h || 2, [c1, c2] = m.c;
    bow(B, w, h, len * .3, 0, h * .1, len * .35, c1, .08);          // bow
    bx(B, w, h, len * .7, 0, h * .1, -len * .15, c1);                // hull
    bx(B, w * .92, .25, len * .98, 0, h * .1 + h / 2 + .1, -len * .02, c2);   // deck
    bx(K, w * 1.02, .22, len * .75, 0, h * .35, -len * .1, 0xffffff);          // team stripe
    const [bz, bs] = m.br;
    bx(B, w * .5, bs, w * .7, 0, h + bs / 2 + .2, bz, c1); bx(B, w * .4, bs * .5, w * .5, 0, h + bs * 1.3 + .2, bz, c2);
    cy(B, .1, .1, bs * 2, 4, 0, h + bs * 2.4, bz, 0x333333);
    bx(K, .1, .8, 1.1, 0, h + bs * 3.6, bz - .5, 0xffffff);
    for (let i = 0; i < (m.fun || 0); i++) cy(B, .55, .7, bs * .9, 7, 0, h + bs + .4, bz - (i + 1) * w * .75, 0x2a2d31);
    const turs = m.tur.map(([z, s, nb]) => {
        const T = [];
        cy(T, s * .9, s * 1, .5, 8, 0, .25, 0, c2); bx(T, s * 1.5, s * .7, s * 1.8, 0, .85 * s, 0, c1);
        const bl = s * 3.2 + 1.5;
        for (let i = 0; i < nb; i++) { const ox = nb === 1 ? 0 : (i - (nb - 1) / 2) * s * .5; cy(T, s * .13, s * .15, bl, 6, ox, .9 * s, s * .9 + bl / 2, 0x25282c, PI / 2); }
        return { geo: merge(T), pos: [0, h * .1 + h / 2 + .3, z], muz: [bl + s * .9 + .2, 0.9 * s, nb, s] };
    });
    return { body: merge(B), mark: merge(K), turs, len, w };
}
// ---- build a live model for an entity ----
function makeModel(def, team) {
    const P = getParts(def), root = new THREE.Group(), o = { root, team, muzzles: [], turs: [], props: [], tur: null, gun: null };
    const add = (geo, mat, parent, pos) => { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(pos[0], pos[1], pos[2]); m.castShadow = true; (parent || root).add(m); return m; };
    o.body = add(P.body, MAT.base);
    if (P.mark) add(P.mark, MAT.team[team]);
    if (def.ln === 'g') {
        const tg = new THREE.Group(); tg.position.set(P.tpos[0], P.tpos[1], P.tpos[2]); root.add(tg); o.tur = tg;
        add(P.tur, MAT.base, tg);
        const gg = new THREE.Group(); gg.position.set(P.gpos[0], P.gpos[1], P.gpos[2]); tg.add(gg); o.gun = gg;
        add(P.gun, MAT.base, gg);
        const mz = new THREE.Object3D(); mz.position.set(0, 0, P.muz[0][2]); gg.add(mz); o.muzzles.push(mz);
    } else if (def.ln === 'a') {
        for (const p of P.props) { const g = new THREE.Group(); g.position.set(p.pos[0], p.pos[1], p.pos[2]); root.add(g); add(p.geo, MAT.base, g); o.props.push(g); }
        for (const p of P.muz) { const mz = new THREE.Object3D(); mz.position.set(p[0], p[1], p[2]); root.add(mz); o.muzzles.push(mz); }
    } else {
        for (const t of P.turs) {
            const g = new THREE.Group(); g.position.set(t.pos[0], t.pos[1], t.pos[2]); root.add(g); add(t.geo, MAT.base, g); o.turs.push(g);
            const mz = new THREE.Object3D(); mz.position.set(0, t.muz[1], t.muz[0]); g.add(mz); o.muzzles.push(mz);
        }
        o.tur = o.turs[0];
    }
    root.rotation.order = 'YXZ'; root.matrixAutoUpdate = true;
    return o;
}
