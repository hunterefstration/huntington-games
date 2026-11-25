#!/usr/bin/env node
// Ways through an exported map (.hgm), read the way the game reads its collision map (20-world.js: a 0.25 m column is solid when its
// lower block tops out over 0.45 m, or something overhead starts under 1.85 m).
//   node tools/blender/check_ways.mjs Ashfall/assets/lab.hgm [--grow=0.5] [--png=out.png] [--min=1]
// Grows the solid cells by --grow metres (a cell is shut when its centre is within that distance of a solid cell's square) and flood
// fills from the middle of the bounds. Every open area must still be reached: a gap, door or lane narrower than about 2 x grow + 0.25 m
// shuts. Prints the areas (at least --min square metres) that the player (0.34 m) reaches but the grown fill does not ("NARROW": the way
// in is too tight), the areas nobody reaches ("closed": fine for a sealed room, wrong for one meant to be entered), and whether the
// middle and the ring of 12 spawn spots at 30 % of the smaller side are open. Coordinates are printed in Blender axes (x, y = -game z).
// Areas touching the edge of the grid (the pad outside the boundary wall) are left out.
// --png writes the grid as a picture: black solid, grey shut by growing, green reached, red NARROW, blue closed, yellow ring spots.
import fs from 'node:fs';
import zlib from 'node:zlib';
const file = process.argv[2], opt = (n, d) => { const a = process.argv.find(a => a.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const grow = +opt('grow', 0.5), minA = +opt('min', 1), png = opt('png', '');
const buf = fs.readFileSync(file); if (buf.toString('latin1', 0, 4) !== 'HGM1') throw new Error('not an .hgm');
const n = buf.readUInt32LE(4), J = JSON.parse(buf.toString('utf8', 8, 8 + n)), blob = buf.subarray(8 + n);
const G = J.grid, D = new Uint8Array(blob.buffer, blob.byteOffset + G.data.off, G.data.n), nx = G.nx, nz = G.nz, N = nx * nz, c = G.cell;
const blk = new Uint8Array(N);
for (let i = 0; i < N; i++) blk[i] = (D[i * 4 + 1] * G.q > 0.45 || (D[i * 4 + 3] > 0 && D[i * 4 + 2] * G.q < 1.85)) ? 1 : 0;
function dilate(R) {
    const k = Math.ceil(R / c + 0.5), offs = [];
    for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) { const ex = Math.max(Math.abs(dx) - 0.5, 0), ez = Math.max(Math.abs(dz) - 0.5, 0); if ((ex * ex + ez * ez) * c * c <= R * R + 1e-9) offs.push([dx, dz]); }
    const out = new Uint8Array(N);
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
        if (!blk[z * nx + x]) continue;
        for (const [dx, dz] of offs) { const X = x + dx, Z = z + dz; if (X >= 0 && Z >= 0 && X < nx && Z < nz) out[Z * nx + X] = 1; }
    }
    return out;
}
const B = J.bounds, mid = [(B.min[0] + B.max[0]) / 2, (B.min[2] + B.max[2]) / 2], size = Math.min(B.max[0] - B.min[0], B.max[2] - B.min[2]);
const cellOf = (x, z) => [Math.floor((x - G.x0) / c), Math.floor((z - G.z0) / c)];
function nearestFree(sh, x, z, r) { const [cx, cz] = cellOf(x, z), k = Math.round(r / c); let best = null, bd = 1e9;
    for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) { const X = cx + dx, Z = cz + dz; if (X < 0 || Z < 0 || X >= nx || Z >= nz || sh[Z * nx + X]) continue; const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = Z * nx + X; } }
    return best; }
function fill(sh, seed) { const seen = new Uint8Array(N); if (seed == null) return seen; const st = [seed];
    while (st.length) { const i = st.pop(); if (seen[i] || sh[i]) continue; seen[i] = 1; const x = i % nx, z = (i / nx) | 0;
        if (x > 0) st.push(i - 1); if (x < nx - 1) st.push(i + 1); if (z > 0) st.push(i - nx); if (z < nz - 1) st.push(i + nx); }
    return seen; }
const shP = dilate(0.34), shG = dilate(grow);
const seedG = nearestFree(shG, mid[0], mid[1], 6), seedP = nearestFree(shP, mid[0], mid[1], 6);
const rG = fill(shG, seedG), rP = fill(shP, seedP);
let free = 0, open = 0, got = 0; for (let i = 0; i < N; i++) { free += !blk[i]; open += !shG[i]; got += rG[i]; }
console.log(`${file}: ${nx} x ${nz} cells, ${(100 * free / N).toFixed(1)}% not solid (game rule); grown ${grow} m: ${got} of ${open} open cells reached from the middle (${mid[0].toFixed(1)}, ${(-mid[1]).toFixed(1)})`);
// unreached open cells, as connected areas
const lab = new Int32Array(N).fill(-1), areas = [];
for (let i = 0; i < N; i++) {
    if (shG[i] || rG[i] || lab[i] >= 0) continue;
    const id = areas.length, st = [i], A = { n: 0, sx: 0, sz: 0, narrow: 0, edge: 0 }; lab[i] = id;
    while (st.length) { const j = st.pop(), x = j % nx, z = (j / nx) | 0; A.n++; A.sx += x; A.sz += z; A.narrow += rP[j]; if (x < 3 || z < 3 || x > nx - 4 || z > nz - 4) A.edge = 1;
        for (const k of [x > 0 ? j - 1 : -1, x < nx - 1 ? j + 1 : -1, z > 0 ? j - nx : -1, z < nz - 1 ? j + nx : -1]) if (k >= 0 && !shG[k] && !rG[k] && lab[k] < 0) { lab[k] = id; st.push(k); } }
    areas.push(A);
}
const big = areas.map((A, id) => ({ ...A, id, m2: A.n * c * c, x: G.x0 + (A.sx / A.n + 0.5) * c, y: -(G.z0 + (A.sz / A.n + 0.5) * c) })).filter(A => A.m2 >= minA && !A.edge).sort((a, b) => b.m2 - a.m2);
const nar = big.filter(A => A.narrow > 0), clo = big.filter(A => !A.narrow);
console.log(`NARROW (player gets in, a ${grow} m grown fill does not): ${nar.length}` + nar.slice(0, 20).map(A => `\n  ${A.m2.toFixed(1)} m2 at (${A.x.toFixed(1)}, ${A.y.toFixed(1)})`).join(''));
console.log(`closed (nobody gets in): ${clo.length}` + clo.slice(0, 12).map(A => `\n  ${A.m2.toFixed(1)} m2 at (${A.x.toFixed(1)}, ${A.y.toFixed(1)})`).join(''));
const midOk = !shP[cellOf(mid[0], mid[1])[1] * nx + cellOf(mid[0], mid[1])[0]];
const ring = []; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, x = mid[0] + Math.cos(a) * size * 0.3, z = mid[1] + Math.sin(a) * size * 0.3, [cx, cz] = cellOf(x, z), i = cz * nx + cx;
    ring.push({ x, z, i, open: !shP[i], reached: !!rG[i] || (nearestFree(shG, x, z, 0.75) != null && !!rG[nearestFree(shG, x, z, 0.75)]) }); }
console.log(`middle open: ${midOk}; ring at ${(size * 0.3).toFixed(1)} m: ${ring.filter(r => r.open).length}/12 open, ${ring.filter(r => r.reached).length}/12 reached` +
    (ring.some(r => !r.reached) ? ' (not: ' + ring.filter(r => !r.reached).map(r => `(${r.x.toFixed(1)}, ${(-r.z).toFixed(1)})`).join(' ') + ')' : ''));
if (png) {
    const W = nx, H = nz, px = Buffer.alloc((W * 3 + 1) * H);
    for (let z = 0; z < H; z++) { px[z * (W * 3 + 1)] = 0;
        for (let x = 0; x < W; x++) { const i = z * nx + x; let col = blk[i] ? [0, 0, 0] : shG[i] ? [90, 90, 90] : rG[i] ? [40, 150, 60] : rP[i] ? [230, 30, 30] : [40, 60, 200];
            if (lab[i] >= 0 && !big.some(A => A.id === lab[i])) col = rP[i] ? [160, 90, 90] : [70, 80, 140];
            px.set(col, z * (W * 3 + 1) + 1 + x * 3); } }
    for (const r of ring) { const x = r.i % nx, z = (r.i / nx) | 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Z = z + dz; if (X >= 0 && Z >= 0 && X < W && Z < H) px.set([255, 230, 0], Z * (W * 3 + 1) + 1 + X * 3); } }
    const crcT = new Int32Array(256).map((_, k) => { let c = k; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
    const crc = b => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
    const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]), cc = Buffer.alloc(4); cc.writeUInt32BE(crc(td)); return Buffer.concat([l, td, cc]); };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
    fs.writeFileSync(png, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(px)), chunk('IEND', Buffer.alloc(0))]));
    console.log('wrote ' + png + ' (x right, Blender +y up)');
}
if (J.probes) {                                         // the baked light at 1 m: what the game's exposure has to cover
    const Pr = J.probes, d = new Float32Array(blob.buffer.slice(blob.byteOffset + Pr.data.off, blob.byteOffset + Pr.data.off + Pr.data.n * 4)), L = [];
    for (let i = 0; i < Pr.nx * Pr.nz; i++) L.push([0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2], i]);
    const s = L.map(v => v[0]).sort((a, b) => a - b), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))], top = L.reduce((a, b) => b[0] > a[0] ? b : a);
    const amb = J.ambient ? (0.2126 * J.ambient[0] + 0.7152 * J.ambient[1] + 0.0722 * J.ambient[2]) : 0;
    console.log(`light at 1 m (luminance): ambient ${amb.toFixed(3)}; probes 10% ${q(0.1).toFixed(3)}, median ${q(0.5).toFixed(3)}, 90% ${q(0.9).toFixed(3)}, 99% ${q(0.99).toFixed(3)}, brightest ${top[0].toFixed(3)} at (${(Pr.x0 + (top[1] % Pr.nx) * Pr.cell).toFixed(1)}, ${(-(Pr.z0 + Math.floor(top[1] / Pr.nx) * Pr.cell)).toFixed(1)})`);
}
