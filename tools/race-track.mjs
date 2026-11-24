// NIGHTLINE: a circuit's centre line, from a few control points to the samples both the game and Blender use.
//   node tools/race-track.mjs            every circuit in art/nightline/tracks.json
// Writes  art/nightline/<id>.track.json   (for tools/blender/make_nl_<id>.py: the road is built through these samples)
//   and   Nightline/src/js/13-trackdata.js (the same samples for the game: never edit it by hand)
// A circuit: { name, width, wall, pts: [[x, y, z], ...] } in GAME axes (x right, y up, z forward; metres), closed, driven in
// the order given. Samples are 3 m apart along the line: [x, y, z, tx, tz, bank] (t = unit direction on the ground, bank in
// radians, positive leans the road DOWN toward the driver's LEFT: height at d metres left of centre = y - d * bank). Left of the driver is (tz, -tx) in (x, z).
import fs from 'node:fs';
const SRC = 'art/nightline/tracks.json', T = JSON.parse(fs.readFileSync(SRC, 'utf8')), STEP = 3, out = {};
const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
for (const [id, C] of Object.entries(T)) {
    const P = C.pts, n = P.length, fine = [];
    for (let i = 0; i < n; i++) { const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n]; for (let k = 0; k < 64; k++) { const t = k / 64; fine.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)]); } }
    // walk it at even steps
    const seg = (a, b) => Math.hypot(b[0] - a[0], b[2] - a[2]); let total = 0; for (let i = 0; i < fine.length; i++) total += seg(fine[i], fine[(i + 1) % fine.length]);
    const N = Math.round(total / STEP), step = total / N, S = []; let i = 0, acc = 0;
    for (let k = 0; k < N; k++) { const want = k * step; while (true) { const a = fine[i % fine.length], b = fine[(i + 1) % fine.length], l = seg(a, b); if (acc + l >= want) { const t = (want - acc) / l; S.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); break; } acc += l; i++; } }
    // heights: smoothed so a crest never throws the car; direction; curvature; bank from curvature
    for (let pass = 0; pass < 30; pass++) { const y = S.map(s => s[1]); for (let k = 0; k < N; k++) S[k][1] = (y[(k + N - 1) % N] + 2 * y[k] + y[(k + 1) % N]) / 4; }
    const R = []; let minR = 1e9, minAt = 0;
    for (let k = 0; k < N; k++) {
        const a = S[(k + N - 1) % N], b = S[k], c = S[(k + 1) % N]; let tx = c[0] - a[0], tz = c[2] - a[2]; const l = Math.hypot(tx, tz); tx /= l; tz /= l;
        const h1 = Math.atan2(b[0] - a[0], b[2] - a[2]), h2 = Math.atan2(c[0] - b[0], c[2] - b[2]); let dh = h2 - h1; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        const curv = dh / step; R.push({ tx, tz, curv }); if (Math.abs(curv) > 1e-6 && 1 / Math.abs(curv) < minR) { minR = 1 / Math.abs(curv); minAt = k; }
    }
    const bankMax = C.bank === undefined ? 0.07 : C.bank, sm = R.map(r => r.curv); for (let pass = 0; pass < 12; pass++) { const c = sm.slice(); for (let k = 0; k < N; k++) sm[k] = (c[(k + N - 1) % N] + 2 * c[k] + c[(k + 1) % N]) / 4; }
    const rows = S.map((s, k) => [+s[0].toFixed(2), +s[1].toFixed(2), +s[2].toFixed(2), +R[k].tx.toFixed(4), +R[k].tz.toFixed(4), +Math.max(-bankMax, Math.min(bankMax, sm[k] * 2.2)).toFixed(4)]);
    // does it cross or crowd itself? (two stretches more than 60 m apart along the line must stay a corridor apart on the ground, unless one is well above the other)
    const need = C.width + 2 * C.wall + 6; let close = 1e9, closeAt = '';
    for (let a = 0; a < N; a += 2) for (let b = a + 20; b < N; b += 2) { if (N - b + a < 20) continue; const d = Math.hypot(S[a][0] - S[b][0], S[a][2] - S[b][2]); if (Math.abs(S[a][1] - S[b][1]) > 6.5) continue; if (d < close) { close = d; closeAt = a + '/' + b + ' at ' + S[a][0].toFixed(0) + ',' + S[a][2].toFixed(0); } }
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9, grade = 0; for (let k = 0; k < N; k++) { const s = S[k]; x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); z0 = Math.min(z0, s[2]); z1 = Math.max(z1, s[2]); y0 = Math.min(y0, s[1]); y1 = Math.max(y1, s[1]); grade = Math.max(grade, Math.abs(S[(k + 1) % N][1] - s[1]) / step); }
    console.log(id + ': ' + (total / 1000).toFixed(2) + ' km, ' + N + ' samples, tightest radius ' + minR.toFixed(1) + ' m at ' + S[minAt][0].toFixed(0) + ',' + S[minAt][2].toFixed(0) + ', closest pass ' + close.toFixed(1) + ' m (needs ' + need + ') ' + closeAt + ', x ' + x0.toFixed(0) + '..' + x1.toFixed(0) + ' z ' + z0.toFixed(0) + '..' + z1.toFixed(0) + ' y ' + y0.toFixed(1) + '..' + y1.toFixed(1) + ', steepest ' + (grade * 100).toFixed(1) + ' %');
    if (close < need) { console.log('  TOO CLOSE TO ITSELF'); process.exitCode = 1; }
    if (minR < C.width * 0.9) { console.log('  A CORNER IS TIGHTER THAN THE ROAD IS WIDE'); process.exitCode = 1; }
    const T1 = { id, name: C.name, width: C.width, wall: C.wall, step: +step.toFixed(4), length: +total.toFixed(1), grid: C.grid || 0, marks: C.marks || {}, s: rows };
    fs.writeFileSync('art/nightline/' + id + '.track.json', JSON.stringify(T1)); out[id] = T1;
}
if (fs.existsSync('Nightline/src/js')) fs.writeFileSync('Nightline/src/js/13-trackdata.js', '// MADE BY tools/race-track.mjs FROM art/nightline/tracks.json: never edit by hand.\n// Each sample: [x, y, z, tx, tz, bank], `step` metres apart along the centre line (see 14-track.js).\nconst TRACKDATA = ' + JSON.stringify(out) + ';\n');
