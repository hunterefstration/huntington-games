#!/usr/bin/env node
// Can a player actually get everywhere? (Ashfall maps)
//   node tools/blender/check_reach.mjs Ashfall/assets/subway.hgm [x z] [--grow=0.5] [--min=1]
// Reads the exported collision grid (0.25 m columns, solid when the first span tops out above 0.45 m), grows every solid cell by
// --grow metres (default 0.5: then any doorway, gate or gap narrower than about 1.5 m closes), flood-fills from the start point
// (GAME axes, default 0 0, moved to the nearest open cell) and compares with a plain flood fill. Every place the plain fill reaches
// that is more than --grow from the grown fill is a room, platform or pocket you can only get into through a gap under 1.5 m:
// (the game also counts a column solid when something overhead is lower than 1.85 m.) They are listed as regions (cells, area, bounding box in game x/z) bigger than --min square metres. Exit code 1 if any.
import fs from 'node:fs';
const args = process.argv.slice(2).filter(a => !a.startsWith('--')), opt = (n, d) => { const a = process.argv.find(a => a.startsWith('--' + n + '=')); return a ? +a.slice(n.length + 3) : d; };
const file = args[0], grow = opt('grow', 0.5), minA = opt('min', 1);
const buf = fs.readFileSync(file); if (buf.toString('latin1', 0, 4) !== 'HGM1') throw new Error('not an .hgm');
const n = buf.readUInt32LE(4), J = JSON.parse(buf.toString('utf8', 8, 8 + n)), blob = buf.subarray(8 + n);
const G = J.grid, D = new Uint8Array(blob.buffer, blob.byteOffset + G.data.off, G.data.n), lim = Math.floor(0.45 / G.q + 1e-6), nx = G.nx, nz = G.nz;
const walk = new Uint8Array(nx * nz); for (let k = 0; k < nx * nz; k++) walk[k] = (D[k * 4 + 1] * G.q > 0.45 || (D[k * 4 + 3] > 0 && D[k * 4 + 2] * G.q < 1.85)) ? 0 : 1;      // as the game reads it (20-world.js)
const R = Math.round(grow / G.cell), off = []; for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) if (i * i + j * j <= R * R + 0.5) off.push([i, j]);
const open = new Uint8Array(nx * nz);                                   // cells whose whole grown disc is walkable (and inside the grid)
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    let ok = walk[j * nx + i] === 1;
    for (const [di, dj] of off) { if (!ok) break; const ii = i + di, jj = j + dj; ok = ii >= 0 && jj >= 0 && ii < nx && jj < nz && walk[jj * nx + ii] === 1; }
    open[j * nx + i] = ok ? 1 : 0;
}
const sx = args.length >= 3 ? +args[1] : 0, sz = args.length >= 3 ? +args[2] : 0;
let s0 = -1, best = 1e9;
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (open[j * nx + i]) { const d = (G.x0 + (i + 0.5) * G.cell - sx) ** 2 + (G.z0 + (j + 0.5) * G.cell - sz) ** 2; if (d < best) { best = d; s0 = j * nx + i; } }
if (s0 < 0) { console.log('no open cell at all'); process.exit(1); }
const fill = (mask, start) => { const seen = new Uint8Array(nx * nz), st = [start]; while (st.length) { const k = st.pop(); if (seen[k] || !mask[k]) continue; seen[k] = 1; const i = k % nx, j = (k / nx) | 0; if (i > 0) st.push(k - 1); if (i < nx - 1) st.push(k + 1); if (j > 0) st.push(k - nx); if (j < nz - 1) st.push(k + nx); } return seen; };
const R1 = fill(open, s0), R0 = fill(walk, s0);
const cover = new Uint8Array(nx * nz);                                  // what the grown fill's cells reach with their disc
for (let k = 0; k < nx * nz; k++) if (R1[k]) { const i = k % nx, j = (k / nx) | 0; for (const [di, dj] of off) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) cover[jj * nx + ii] = 1; } }
const lost = new Uint8Array(nx * nz); let nl = 0, n0 = 0; for (let k = 0; k < nx * nz; k++) { if (R0[k]) n0++; if (R0[k] && !cover[k]) { lost[k] = 1; nl++; } }
const regs = [], lab = new Uint8Array(nx * nz);
for (let k0 = 0; k0 < nx * nz; k0++) {
    if (!lost[k0] || lab[k0]) continue; let c = 0, i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1; const st = [k0]; lab[k0] = 1;
    while (st.length) { const k = st.pop(); c++; const i = k % nx, j = (k / nx) | 0; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
        for (const kk of [i > 0 ? k - 1 : -1, i < nx - 1 ? k + 1 : -1, j > 0 ? k - nx : -1, j < nz - 1 ? k + nx : -1]) if (kk >= 0 && lost[kk] && !lab[kk]) { lab[kk] = 1; st.push(kk); } }
    const a = c * G.cell * G.cell; if (a >= minA) regs.push([a, G.x0 + i0 * G.cell, G.x0 + (i1 + 1) * G.cell, G.z0 + j0 * G.cell, G.z0 + (j1 + 1) * G.cell]);
}
regs.sort((a, b) => b[0] - a[0]);
console.log(`${file.split(/[\\/]/).pop()}: grown by ${grow} m; plain fill ${n0} cells, ${(100 * (n0 - nl) / Math.max(1, n0)).toFixed(1)}% of it reachable through gaps of 1.5 m+; ${regs.length} region(s) over ${minA} m2 only through narrower gaps`);
for (const [a, x0, x1, z0, z1] of regs.slice(0, 20)) console.log(`  ${a.toFixed(1)} m2  x ${x0.toFixed(1)}..${x1.toFixed(1)}  z ${z0.toFixed(1)}..${z1.toFixed(1)}  (blender y ${(-z1).toFixed(1)}..${(-z0).toFixed(1)})`);
// the game's start ring: 12 spots at 0.3 x the smaller side round the middle (20-world.js); each must have open, reachable room near it
const B = J.bounds, mid = [(B.min[0] + B.max[0]) / 2, (B.min[2] + B.max[2]) / 2], size = Math.min(B.max[0] - B.min[0], B.max[2] - B.min[2]); let bad = 0;
for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, px = mid[0] + Math.cos(a) * size * 0.3, pz = mid[1] + Math.sin(a) * size * 0.3; let d = 1e9;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (R1[j * nx + i]) d = Math.min(d, Math.hypot(G.x0 + (i + 0.5) * G.cell - px, G.z0 + (j + 0.5) * G.cell - pz));
  if (d > 2.5) { bad++; console.log('  ring spot ' + k + ' (' + px.toFixed(1) + ', ' + pz.toFixed(1) + '): nearest reachable open cell ' + d.toFixed(1) + ' m away'); } }
console.log('ring of 12 start spots at ' + (size * 0.3).toFixed(1) + ' m: ' + (12 - bad) + ' have reachable open room within 2.5 m');
process.exit(regs.length || bad ? 1 : 0);
