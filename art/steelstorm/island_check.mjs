#!/usr/bin/env node
// Check the island the way Steel Storm reads it:   node art/steelstorm/island_check.mjs "Steel Storm Rebuilt/assets/island.hgm" [maxSlopeDeg=25]
// A 2 m cell is drivable when ground > 0.9 m (under that the game says sea), tops - ground <= 0.8 m (nothing solid) and the ground slope <= maxSlope.
// Prints the drivable share, the 10 m clearance at each base and objective, and whether the west base reaches the east base along each of three
// corridors (north: y > 120, centre: |y| < 70, south: y < -80; all plus a disc round both bases), plus whether every place is reached.
// Coordinates printed are GAME x, z (z = -blender y).
import fs from 'node:fs';
const file = process.argv[2], maxSlope = Math.tan((+process.argv[3] || 25) * Math.PI / 180);
const buf = fs.readFileSync(file), n = buf.readUInt32LE(4), J = JSON.parse(buf.toString('utf8', 8, 8 + n)), blob = buf.subarray(8 + n);
const view = d => new Float32Array(blob.buffer.slice(blob.byteOffset + d.off, blob.byteOffset + d.off + d.n * 4));
const H = J.heights, g = view(H.data), t = view(H.tops), nx = H.nx, nz = H.nz, c = H.cell;
const X = i => H.x0 + i * c, Zg = j => H.z0 + j * c;                 // game x, game z of a cell
const ok = new Uint8Array(nx * nz); let free = 0, tall = 0, steep = 0, sea = 0;
for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const k = j * nx + i, gr = g[k];
    if (gr <= 0.9) { sea++; continue; }
    if (t[k] - gr > 0.8) { tall++; continue; }
    const sx = (g[k + 1] - g[k - 1]) / (2 * c), sz = (g[k + nx] - g[k - nx]) / (2 * c);
    if (Math.hypot(sx, sz) > maxSlope) { steep++; continue; }
    ok[k] = 1; free++;
}
const land = free + tall + steep;
console.log(`grid ${nx} x ${nz} at ${c} m, x ${X(0)}..${X(nx - 1)}, z ${Zg(0)}..${Zg(nz - 1)}; ground ${g.reduce((a, b) => Math.min(a, b)).toFixed(1)}..${g.reduce((a, b) => Math.max(a, b)).toFixed(1)} m`);
console.log(`land ${(land * c * c / 1e4).toFixed(1)} ha: drivable ${(100 * free / land).toFixed(1)}%, blocked by things ${(100 * tall / land).toFixed(1)}%, too steep ${(100 * steep / land).toFixed(1)}%`);
const P = { WB: [-330, 0], EB: [330, 0], A: [-200, 40], B: [0, 0], C: [200, -40], airW: [-160, 276], airE: [140, 276], flagW: [-286, -46], flagE: [286, 46] };   // game x, z
const cell = (x, z) => [Math.round((x - H.x0) / c), Math.round((z - H.z0) / c)];
for (const [name, [x, z]] of Object.entries(P)) {
    const [ci, cj] = cell(x, z); let bad = 0, cnt = 0, maxZ = -1e9, minZ = 1e9;
    for (let j = cj - 5; j <= cj + 5; j++) for (let i = ci - 5; i <= ci + 5; i++) { if (Math.hypot(i - ci, j - cj) > 5) continue; cnt++; if (!ok[j * nx + i]) bad++; maxZ = Math.max(maxZ, g[j * nx + i]); minZ = Math.min(minZ, g[j * nx + i]); }
    console.log(`  ${name.padEnd(6)} (${x}, ${z}) ground ${g[cj * nx + ci].toFixed(1)} m, 10 m disc: ${bad ? bad + ' of ' + cnt + ' cells not drivable' : 'all drivable'}, height spread ${(maxZ - minZ).toFixed(2)} m`);
}
function flood(allow, seed) {
    const seen = new Uint8Array(nx * nz), st = [seed]; let got = 0;
    while (st.length) { const k = st.pop(); if (seen[k] || !ok[k] || !allow[k]) continue; seen[k] = 1; got++; const i = k % nx, j = (k / nx) | 0; if (i > 0) st.push(k - 1); if (i < nx - 1) st.push(k + 1); if (j > 0) st.push(k - nx); if (j < nz - 1) st.push(k + nx); }
    return seen;
}
const ix = (x, z) => { const [i, j] = cell(x, z); return j * nx + i; };
const corridors = { north: (x, y) => y > 120, centre: (x, y) => Math.abs(y) < 70, south: (x, y) => y < -80 };
for (const [name, f] of Object.entries(corridors)) {
    const allow = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = X(i), y = -Zg(j); if (f(x, y) || Math.hypot(x + 330, y) < 130 || Math.hypot(x - 330, y) < 130) allow[j * nx + i] = 1; }
    const s = flood(allow, ix(...P.WB)); const reach = k => s[ix(...P[k])] ? 'yes' : 'NO';
    console.log(`corridor ${name.padEnd(6)}: west base -> east base ${reach('EB')}   (also reaches A ${reach('A')}, B ${reach('B')}, C ${reach('C')})`);
}
const all = flood(new Uint8Array(nx * nz).fill(1), ix(...P.WB)); console.log('anywhere: ' + Object.keys(P).map(k => k + ' ' + (all[ix(...P[k])] ? 'yes' : 'NO')).join(', '));
let lost = 0; for (let k = 0; k < nx * nz; k++) if (ok[k] && !all[k]) lost++; console.log(`drivable cells not reachable from the west base: ${lost} of ${free} (${(100 * lost / free).toFixed(1)}%)`);

// cover along the roads: distance from points every 6 m along each main route to the nearest solid thing taller than 1.1 m (rocks, walls, ruins, trunks...)
const rp = new URL('./island_routes.json', import.meta.url);
if (fs.existsSync(rp)) {
    const R = JSON.parse(fs.readFileSync(rp, 'utf8')), cover = new Uint8Array(nx * nz);
    for (let k = 0; k < nx * nz; k++) if (g[k] > 1.0 && t[k] - g[k] > 1.1) cover[k] = 1;
    const nearest = (x, z, rad) => { const [ci, cj] = cell(x, z), r = Math.ceil(rad / c); let best = 1e9; for (let j = Math.max(cj - r, 0); j <= Math.min(cj + r, nz - 1); j++) for (let i = Math.max(ci - r, 0); i <= Math.min(ci + r, nx - 1); i++) if (cover[j * nx + i]) best = Math.min(best, Math.hypot(i - ci, j - cj) * c); return best; };
    for (const [name, poly] of Object.entries(R.routes)) {
        let run = 0, worst = 0, within = 0, total = 0, L = 0;
        for (let i = 0; i + 1 < poly.length; i++) {
            const seg = Math.hypot(poly[i + 1][0] - poly[i][0], poly[i + 1][1] - poly[i][1]); L += seg;
            const d = nearest(poly[i][0], poly[i][1], 40); total++; if (d <= 30) { within++; run = 0; } else { run += seg; worst = Math.max(worst, run); }
        }
        console.log(`cover along ${name.padEnd(6)} (${L.toFixed(0)} m): ${(100 * within / total).toFixed(0)}% of the road has cover within 30 m; longest bare stretch ${worst.toFixed(0)} m`);
    }
}
