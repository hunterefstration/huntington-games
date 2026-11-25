// ============================================================
// THE HILL TRACKS, MADE EASY TO SEE (the owner, 2026-11-25: "make easily visible, winding paths up the mountains"; the bare hillsides
// beside them are too steep for a tank: SLOPE_BARE in 29-tiles.js). The island's own picture has the tracks only as a thin line of
// dust, so the game lays over each one (GROUNDS.island.paths, 28-islandpaths.js):
//   a dirt bed 6 m wide with two wheel ruts and soft edges, shaded by the slope it lies on, draped on the ground every 2 m
//   white marker posts with red tops every 16 m on alternate sides, as on a mountain road
//   a tall pole with an orange pennant on each top, seen from across the island
//   and on the corner map, each track as an orange line with a dot at its top.
// ============================================================
const HT = { W: 3.2, POST: 16 };
// the track's line, rounded off (two passes of corner cutting) and then cut into pieces about `step` long
function htLine(pts, step) {
    let q = pts.map(p => [p[0], p[1]]);
    for (let k = 0; k < 2; k++) { const o = [q[0]]; for (let i = 0; i < q.length - 1; i++) { const a = q[i], b = q[i + 1]; o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); } o.push(q[q.length - 1]); q = o; }
    const out = [q[0]]; let carry = 0;
    for (let i = 1; i < q.length; i++) { const a = q[i - 1], b = q[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); let f = step - carry; while (f <= L) { out.push([a[0] + (b[0] - a[0]) * f / L, a[1] + (b[1] - a[1]) * f / L]); f += step; } carry = L - (f - step); }
    out.push(q[q.length - 1]); return out;
}
function hillTracks() {
    const P = GROUNDS[GROUND] && GROUNDS[GROUND].paths; if (!P || !TILE.on) return;
    const sd = TILE.sunDir || [.3, .9, .3], sl = Math.hypot(sd[0], sd[1], sd[2]) || 1;
    // across the bed: offset from the middle, colour (0 dirt, 1 rut), cover
    const X = [[-HT.W, 0, 0], [-2.3, 0, 1], [-1.35, 1, 1], [-.75, 0, 1], [.75, 0, 1], [1.35, 1, 1], [2.3, 0, 1], [HT.W, 0, 0]], NX = X.length;
    const DIRT = [.82, .67, .45], RUT = [.55, .43, .29];
    const pos = [], col = [], idx = [], posts = [], tops = [];
    for (const path of P) {
        const L = htLine(path.pts, 2), base = pos.length / 3; let run = 0;
        for (let i = 0; i < L.length; i++) {
            const a = L[Math.max(0, i - 1)], b = L[Math.min(L.length - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
            const sx = -tz, sz = tx, x = L[i][0], z = L[i][1];
            if (i) run += Math.hypot(x - L[i - 1][0], z - L[i - 1][1]);
            const gx = (GH(x + 1, z) - GH(x - 1, z)) / 2, gz = (GH(x, z + 1) - GH(x, z - 1)) / 2, nl = Math.hypot(gx, 1, gz), ndl = Math.max(0, (-gx * sd[0] + sd[1] - gz * sd[2]) / (nl * sl));
            const shade = .62 + .45 * ndl, grain = .92 + .16 * Math.sin(run * 1.7 + i * .3) * Math.sin(run * .37);
            for (const [o, rut, a] of X) {
                const vx = x + sx * o, vz = z + sz * o; pos.push(vx, GH(vx, vz) + .1, vz);
                const c = rut ? RUT : DIRT; col.push(c[0] * shade * grain, c[1] * shade * grain, c[2] * shade * grain, a * .92);
            }
            if (i) { const r0 = base + (i - 1) * NX, r1 = base + i * NX; for (let k = 0; k < NX - 1; k++) idx.push(r0 + k, r1 + k, r0 + k + 1, r0 + k + 1, r1 + k, r1 + k + 1); }
            if (i && Math.floor(run / HT.POST) !== Math.floor((run - 2) / HT.POST)) { const side = Math.floor(run / HT.POST) % 2 ? 1 : -1, px = x + sx * side * (HT.W + .6), pz = z + sz * side * (HT.W + .6); posts.push([px, GH(px, pz), pz]); }
        }
        const t = path.top; if (t) tops.push([t[0], GH(t[0], t[2]), t[2]]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
    const bed = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    bed.renderOrder = -2; bed.frustumCulled = false; scene.add(bed);
    const o = new THREE.Object3D();
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(.08, .1, 1.25, 6), new THREE.MeshLambertMaterial({ color: 0xf2f0ea }), posts.length + tops.length);
    const cap = new THREE.InstancedMesh(new THREE.BoxGeometry(.2, .26, .2), new THREE.MeshLambertMaterial({ color: 0xd42a1e, emissive: 0x3a0806 }), posts.length);
    posts.forEach((p, i) => { o.position.set(p[0], p[1] + .6, p[2]); o.scale.set(1, 1, 1); o.updateMatrix(); pole.setMatrixAt(i, o.matrix); o.position.y = p[1] + 1.15; o.updateMatrix(); cap.setMatrixAt(i, o.matrix); });
    tops.forEach((p, i) => { o.position.set(p[0], p[1] + 4, p[2]); o.scale.set(1.3, 6.4, 1.3); o.updateMatrix(); pole.setMatrixAt(posts.length + i, o.matrix); });
    const flag = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 1.3, .06), new THREE.MeshLambertMaterial({ color: 0xff8a1c, emissive: 0x4a2004 }), tops.length);
    tops.forEach((p, i) => { o.position.set(p[0] + 1.25, p[1] + 7.3, p[2]); o.scale.set(1, 1, 1); o.updateMatrix(); flag.setMatrixAt(i, o.matrix); });
    for (const m of [pole, cap, flag]) { m.instanceMatrix.needsUpdate = true; m.castShadow = true; scene.add(m); }
    HT.n = { posts: posts.length, tops: tops.length, verts: pos.length / 3 };
}
// on the corner map: orange lines up each hill, a dot at the top (same scale as drawMini, 80-ui.js)
function hillTracksMini(mx, S, half) {
    const P = GROUNDS[GROUND] && GROUNDS[GROUND].paths; if (!P) return; const k = S / (half * 2);
    mx.save(); mx.lineCap = mx.lineJoin = 'round';
    for (const path of P) {
        const L = htLine(path.pts, 4);
        for (const [w, c] of [[3.2, 'rgba(0,0,0,.55)'], [1.6, '#ffa040']]) { mx.strokeStyle = c; mx.lineWidth = w; mx.beginPath(); L.forEach((p, i) => { const x = (p[0] + half) * k, y = (p[1] + half) * k; if (i) mx.lineTo(x, y); else mx.moveTo(x, y); }); mx.stroke(); }
        const t = path.top; if (t) { mx.fillStyle = '#ffa040'; mx.strokeStyle = '#000'; mx.lineWidth = 1; mx.beginPath(); mx.arc((t[0] + half) * k, (t[2] + half) * k, 2.6, 0, TAU); mx.fill(); mx.stroke(); }
    }
    mx.restore();
}
