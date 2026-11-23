#!/usr/bin/env node
// Check an exported map (.hgm) the way the game reads it:
//   node tools/blender/check_map.mjs Ashfall/assets/street.hgm [x z ...]   (start / probe points in GAME axes, default 0 -15)
// Prints the bounds, the share of 0.25 m columns that are walkable (first solid span tops out at <= 0.45 m), a flood fill on the
// 0.5 m path grid from the start point (cells reached / walkable), and the probe (ambient rgb + sun visibility) at the start points.
import fs from 'node:fs';
const file = process.argv[2], pts = process.argv.slice(3).map(Number);
const buf = fs.readFileSync(file); if (buf.toString('latin1', 0, 4) !== 'HGM1') throw new Error('not an .hgm');
const n = buf.readUInt32LE(4), J = JSON.parse(buf.toString('utf8', 8, 8 + n)), blob = buf.subarray(8 + n);
const view = (d, T) => new T(blob.buffer, blob.byteOffset + d.off, d.n);
console.log('bounds', JSON.stringify(J.bounds), 'ambient', JSON.stringify(J.ambient));
const G = J.grid, D = view(G.data, Uint8Array), lim = Math.floor(0.45 / G.q + 1e-6);
const walk = (ix, iz) => ix >= 0 && iz >= 0 && ix < G.nx && iz < G.nz && D[(iz * G.nx + ix) * 4 + 1] <= lim;
let free = 0; for (let iz = 0; iz < G.nz; iz++) for (let ix = 0; ix < G.nx; ix++) free += walk(ix, iz);
console.log(`columns ${G.nx} x ${G.nz}: ${(100 * free / (G.nx * G.nz)).toFixed(1)}% walkable`);
const P = 2, PX = Math.floor(G.nx / P), PZ = Math.floor(G.nz / P);
const pw = (i, j) => walk(i * P, j * P) && walk(i * P + 1, j * P) && walk(i * P, j * P + 1) && walk(i * P + 1, j * P + 1);
const start = pts.length >= 2 ? pts.slice(0, 2) : [0, -15];
let total = 0; for (let j = 0; j < PZ; j++) for (let i = 0; i < PX; i++) total += pw(i, j);
const seen = new Uint8Array(PX * PZ), st = [[Math.floor((start[0] - G.x0) / (G.cell * P)), Math.floor((start[1] - G.z0) / (G.cell * P))]]; let got = 0;
while (st.length) { const [i, j] = st.pop(); if (i < 0 || j < 0 || i >= PX || j >= PZ || seen[j * PX + i] || !pw(i, j)) continue; seen[j * PX + i] = 1; got++; st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); }
console.log(`path grid 0.5 m: ${got} of ${total} walkable cells reached from (${start})`);
if (J.probes) {
    const Pr = J.probes, d = view(Pr.data, Float32Array);
    for (let k = 0; k + 1 < Math.max(pts.length, 2); k += 2) {
        const x = pts.length ? pts[k] : 0, z = pts.length ? pts[k + 1] : -15;
        const ix = Math.round((x - Pr.x0) / Pr.cell), iz = Math.round((z - Pr.z0) / Pr.cell), o = (iz * Pr.nx + ix) * 4;
        console.log(`probe at (${x}, ${z}):`, Array.from(d.subarray(o, o + 4)).map(v => v.toFixed(3)).join(' '));
    }
}
