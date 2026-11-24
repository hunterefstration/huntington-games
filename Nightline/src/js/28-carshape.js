// ============================================================
// The shape of a car, made here from a few curves (no file): a body is 46 slices from tail to nose, each slice an outline
// of 16 points (floor, sill, side, shoulder, the base of the glass, the edge of the roof, the top), and the skin is what
// joins one slice to the next. What changes from car to car is only the curves in SHAPES: how high the deck runs from tail
// to nose (deck), how wide the car is seen from above (plan), where the glasshouse sits and how its two ends slope (cab).
// The wheel arches are the sill lifted over each wheel. The skin comes out as three meshes with crisp edges between
// them: paint, glass, dark trim; lamps, a wing and wheels are added as small parts.
// A model file (assets/car_<id>.hgm) takes this shape's place when there is one (30-car.js, carModel).
// ============================================================
const SHAPES = {
    kite:   { hw: 0.87, clear: 0.17, R: 0.31, deck: [[-2.0, 0.84], [-1.6, 0.92], [0.5, 0.92], [0.95, 0.84], [2.0, 0.68]], plan: [[-2.0, 0.93], [-1.2, 1], [1.0, 1], [2.0, 0.9]], cab: [-1.97, 0.98, 0.42, 0.95], roof: 0.50, wc: 0.76, wing: 0, lip: 0.05 },
    vandal: { hw: 0.95, clear: 0.18, R: 0.35, deck: [[-2.375, 0.80], [-1.5, 0.88], [0.2, 0.90], [2.375, 0.78]], plan: [[-2.375, 0.94], [-1.4, 1], [1.4, 1], [2.375, 0.92]], cab: [-1.95, 0.5, 1.3, 0.72], roof: 0.40, wc: 0.72, wing: 0, lip: 0.08 },
    aria:   { hw: 0.925, clear: 0.14, R: 0.33, deck: [[-2.175, 0.80], [-1.3, 0.85], [0.3, 0.80], [2.175, 0.58]], plan: [[-2.175, 0.94], [-1.3, 1], [1.2, 1], [2.175, 0.86]], cab: [-1.55, 0.78, 0.95, 0.9], roof: 0.38, wc: 0.70, wing: 0.13, lip: 0 },
    halo:   { hw: 0.99, clear: 0.11, R: 0.34, deck: [[-2.3, 0.82], [-1.0, 0.86], [0.2, 0.70], [2.3, 0.48]], plan: [[-2.3, 0.97], [-1.2, 1], [0.9, 0.97], [2.3, 0.8]], cab: [-0.8, 1.15, 0.72, 1.02], roof: 0.31, wc: 0.66, wing: 0.24, lip: 0 }
};
const CARGEO = {};
function carGeo(id) {
    if (CARGEO[id]) return CARGEO[id];
    const d = CARS[id], B = SHAPES[id] || SHAPES.kite, L = d.len, NS = 46, RING = 16, zw = d.L / 2, sm = t => t * t * (3 - 2 * t);
    const key = (pts, z) => { if (z <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) if (z <= pts[i][0]) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * sm((z - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])); return pts[pts.length - 1][1]; };
    const cabAt = z => { const c = B.cab; if (z <= c[0] || z >= c[1]) return 0; return Math.min(sm(Math.min(1, (z - c[0]) / c[2])), sm(Math.min(1, (c[1] - z) / c[3]))); };
    const P = new Float32Array(NS * RING * 3), cabs = new Float32Array(NS), tops = new Float32Array(NS), wids = new Float32Array(NS), zs = new Float32Array(NS);
    for (let i = 0; i < NS; i++) {
        const z = -L / 2 + L * i / (NS - 1), end = Math.max(0, (Math.abs(z) - (L / 2 - 0.42)) / 0.42), er = 1 - 0.36 * (1 - Math.sqrt(Math.max(0, 1 - end * end)));      // the corners are rounded, seen from above
        const w = B.hw * key(B.plan, z) * er, y0 = B.clear + end * end * 0.09, hb = key(B.deck, z) - end * end * 0.05, cab = cabAt(z), hr = hb + B.roof * cab;
        const dz = Math.abs(Math.abs(z) - zw), ar = B.R + 0.075, arch = dz < ar ? Math.sqrt(ar * ar - dz * dz) + B.R - B.clear : 0;      // the sill, lifted over a wheel
        const y1 = y0 + Math.max(0, arch), y3 = Math.max(y0 + (hb - y0) * 0.5, y1 + 0.17), y4 = Math.max(hb - 0.07, y3 + 0.03), yh = Math.max(hb, y4 + 0.03);
        const half = [[0, y0], [w * 0.8, y1], [w * 0.975, y1 + 0.1], [w, y3], [w * 0.985, y4], [w * 0.93, yh], [w * lerp(0.62, 0.88, cab), yh + lerp(0.015, 0.03, cab)], [lerp(w * 0.32, w * B.wc, cab), lerp(yh + 0.03, hr - 0.035, cab)], [0, lerp(yh + 0.04, hr, cab)]];
        for (let k = 0; k < RING; k++) { const h = k <= 8 ? half[k] : half[16 - k], o = (i * RING + k) * 3; P[o] = k <= 8 ? h[0] : -h[0]; P[o + 1] = h[1]; P[o + 2] = z; }
        cabs[i] = cab; tops[i] = yh; wids[i] = w; zs[i] = z;
    }
    // the skin, sorted into paint / glass / dark by where each patch is
    const tri = { paint: [], glass: [], dark: [] };
    for (let i = 0; i < NS - 1; i++) for (let k = 0; k < RING; k++) {
        const k2 = (k + 1) % RING, a = i * RING + k, b = i * RING + k2, c = (i + 1) * RING + k, e = (i + 1) * RING + k2, strip = k < 8 ? k : 15 - k, cab = (cabs[i] + cabs[i + 1]) / 2;
        const what = strip <= 1 ? 'dark' : strip === 6 && cab > 0.1 ? 'glass' : strip === 7 && cab > 0.1 && cab < 0.94 ? 'glass' : 'paint';
        tri[what].push(a, c, b, b, c, e);
    }
    // the two ends, closed
    const cap = (i, flip) => { const base = P.length / 3; let cy = 0; for (let k = 0; k < RING; k++) cy += P[(i * RING + k) * 3 + 1]; return { i, flip, cy: cy / RING }; }, caps = [cap(0, false), cap(NS - 1, true)];
    const build = (list, capsFor) => {
        const map = new Map(), pos = [], idx = []; const v = g => { let l = map.get(g); if (l === undefined) { l = pos.length / 3; map.set(g, l); pos.push(P[g * 3], P[g * 3 + 1], P[g * 3 + 2]); } return l; };
        for (const g of list) idx.push(v(g));
        for (const c of capsFor || []) { const ci = pos.length / 3; pos.push(0, c.cy, zs[c.i]); for (let k = 0; k < RING; k++) { const a = pos.length / 3; pos.push(P[(c.i * RING + k) * 3], P[(c.i * RING + k) * 3 + 1], P[(c.i * RING + k) * 3 + 2]); const b2 = pos.length / 3; const kk = (k + 1) % RING; pos.push(P[(c.i * RING + kk) * 3], P[(c.i * RING + kk) * 3 + 1], P[(c.i * RING + kk) * 3 + 2]); if (c.flip) idx.push(ci, b2, a); else idx.push(ci, a, b2); } }
        const p = new Float32Array(pos), n = new Float32Array(p.length);
        for (let t = 0; t < idx.length; t += 3) { const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3, ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, b, c]) { n[q] += nx; n[q + 1] += ny; n[q + 2] += nz; } }
        for (let q = 0; q < n.length; q += 3) { const l = Math.hypot(n[q], n[q + 1], n[q + 2]) || 1; n[q] /= l; n[q + 1] /= l; n[q + 2] /= l; }
        return HG3D.geometry({ position: p, normal: n, uv: new Float32Array(p.length / 3 * 2) }, new Uint16Array(idx));
    };
    // the outward side of the skin: check one patch and turn every triangle round if it faces in
    { const a = tri.paint, p0 = a[0] * 3, p1 = a[1] * 3, p2 = a[2] * 3, ux = P[p1] - P[p0], uy = P[p1 + 1] - P[p0 + 1], uz = P[p1 + 2] - P[p0 + 2], vx = P[p2] - P[p0], vy = P[p2 + 1] - P[p0 + 1], vz = P[p2 + 2] - P[p0 + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, cx = (P[p0] + P[p1] + P[p2]) / 3, cy = (P[p0 + 1] + P[p1 + 1] + P[p2 + 1]) / 3 - 0.55;
      if (nx * cx + ny * cy < 0) { for (const k in tri) { const t = tri[k]; for (let i = 0; i < t.length; i += 3) { const s = t[i + 1]; t[i + 1] = t[i + 2]; t[i + 2] = s; } } caps[0].flip = !caps[0].flip; caps[1].flip = !caps[1].flip; } }
    const box = (w, h, l, x, y, z) => { const g = HG3D.geo.box(w, h, l), p = g.attributes.position.array; for (let i = 0; i < p.length; i += 3) { p[i] += x; p[i + 1] += y; p[i + 2] += z; } return g; };
    const wr = wids[1], wf = wids[NS - 2], hr = tops[1], hf = tops[NS - 2], G = { R: B.R, wheelX: B.hw * key(B.plan, zw) - 0.135, wheelZ: zw };
    const darkParts = [build(tri.dark), box(wf * 1.5, 0.15, 0.06, 0, B.clear + 0.16, L / 2 - 0.05), box(wr * 1.6, 0.13, 0.08, 0, B.clear + 0.1, -L / 2 + 0.05)], paintParts = [build(tri.paint, caps)];
    for (const s of [1, -1]) paintParts.push(box(0.09, 0.07, 0.16, s * (B.hw + 0.05), key(B.deck, B.cab[1] - 0.3) + 0.1, B.cab[1] - 0.32));      // mirrors
    if (B.wing) { paintParts.push(box(B.hw * 1.78, 0.035, 0.27, 0, hr + B.wing, -L / 2 + 0.3)); for (const s of [1, -1]) darkParts.push(box(0.04, B.wing, 0.16, s * B.hw * 0.55, hr + B.wing / 2 - 0.02, -L / 2 + 0.3)); }
    if (B.lip) paintParts.push(box(wr * 1.86, B.lip, 0.1, 0, hr + B.lip / 2 - 0.01, -L / 2 + 0.2));
    G.paint = joinGeo(paintParts); G.glass = build(tri.glass); G.dark = joinGeo(darkParts);
    G.tailGeo = joinGeo([box(wr * 1.72, 0.06, 0.05, 0, hr - 0.11, -L / 2 + 0.015)].concat([1, -1].map(s => box(0.2, 0.1, 0.05, s * wr * 0.76, hr - 0.11, -L / 2 + 0.02))));
    G.headGeo = joinGeo([1, -1].map(s => box(0.34, 0.075, 0.06, s * wf * 0.66, hf - 0.09, L / 2 - 0.03)).concat([box(wf * 0.9, 0.022, 0.05, 0, hf - 0.16, L / 2 - 0.02)]));
    G.tail = [[wr * 0.76, hr - 0.11, -L / 2], [-wr * 0.76, hr - 0.11, -L / 2]]; G.head = [[wf * 0.66, hf - 0.09, L / 2], [-wf * 0.66, hf - 0.09, L / 2]];
    // a wheel: the tyre and the rim, each turned so its axle is the car's left-right line
    const turn = g => { const p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i += 3) { const x = p[i], y = p[i + 1]; p[i] = y; p[i + 1] = -x; const a = n[i], b = n[i + 1]; n[i] = b; n[i + 1] = -a; } return g; };
    G.wheel = HG3D.geo.merge([{ geo: turn(HG3D.geo.cylinder(B.R, B.R, 0.25, 18)), color: 0x0d0e12 }, { geo: turn(HG3D.geo.cylinder(B.R * 0.66, B.R * 0.66, 0.262, 10)), color: 0xc4cad6 }, { geo: turn(HG3D.geo.cylinder(B.R * 0.2, B.R * 0.2, 0.3, 6)), color: 0x30343c }]);      // tyre, rim and hub in one piece (their colours ride on its corners)
    return CARGEO[id] = G;
}
