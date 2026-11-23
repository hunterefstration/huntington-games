#!/usr/bin/env node
// Check a tank map (.hgm with `heights`) the way Steel Storm reads it:
//   node tools/blender/check_heights.mjs "Steel Storm Remastered/assets/valley.hgm" [maxSlopeDeg=22]
// A 1 m cell is drivable when tops - ground <= 0.8 m and the ground slope there is at most maxSlopeDeg. Prints the drivable share
// and a flood fill (4-neighbour) from the middle over drivable cells; lists a few cut-off drivable spots.
import fs from 'node:fs';
const file = process.argv[2], maxSlope = Math.tan((+process.argv[3] || 22) * Math.PI / 180);
const buf = fs.readFileSync(file), n = buf.readUInt32LE(4), J = JSON.parse(buf.toString('utf8', 8, 8 + n)), blob = buf.subarray(8 + n);
const view = d => new Float32Array(blob.buffer, blob.byteOffset + d.off, d.n);
const H = J.heights, g = view(H.data), t = view(H.tops), nx = H.nx, nz = H.nz, c = H.cell;
const at = (a, i, j) => a[j * nx + i];
const ok = new Uint8Array(nx * nz); let free = 0, blockedTall = 0, steep = 0;
for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const tall = at(t, i, j) - at(g, i, j) > 0.8;
    const sx = (at(g, i + 1, j) - at(g, i - 1, j)) / (2 * c), sz = (at(g, i, j + 1) - at(g, i, j - 1)) / (2 * c), s = Math.hypot(sx, sz) > maxSlope;
    if (tall) blockedTall++; else if (s) steep++; else { ok[j * nx + i] = 1; free++; }
}
const tot = (nx - 2) * (nz - 2);
console.log(`cells ${nx} x ${nz} at ${c} m: drivable ${(100 * free / tot).toFixed(1)}%, blocked by things ${(100 * blockedTall / tot).toFixed(1)}%, too steep ${(100 * steep / tot).toFixed(2)}%`);
const seen = new Uint8Array(nx * nz); const st = [[nx >> 1, nz >> 1]]; let got = 0;
while (st.length) { const [i, j] = st.pop(); if (i < 0 || j < 0 || i >= nx || j >= nz) continue; const k = j * nx + i; if (seen[k] || !ok[k]) continue; seen[k] = 1; got++; st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]); }
const lost = []; for (let k = 0; k < nx * nz; k++) if (ok[k] && !seen[k]) lost.push(k);
console.log(`flood fill from the middle: ${got} of ${free} drivable cells reached; cut off ${lost.length}`, lost.slice(0, 6).map(k => `(${(H.x0 + (k % nx) * c).toFixed(0)}, ${(H.z0 + Math.floor(k / nx) * c).toFixed(0)})`).join(' '));
