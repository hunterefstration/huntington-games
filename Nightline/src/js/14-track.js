// ============================================================
// The circuit as numbers. TRACKDATA (13-trackdata.js, made by tools/race-track.mjs) is the centre line: a closed row of
// samples `step` metres apart, each [x, y, z, tx, tz, bank]. A place on the circuit is (u, d): u = how far round, counted
// in samples (it wraps at N), d = metres LEFT of the centre line (left of the driving direction (tx, tz) is (tz, -tx)).
// The road is `W` wide; the barriers stand at `half` = W / 2 + wall on both sides.
// ============================================================
const Track = { id: '', S: null, N: 0, step: 3, W: 14, half: 8.5, len: 0, line: null, kap: null };
Track.use = function (id) {
    const T = TRACKDATA[id] || TRACKDATA[Object.keys(TRACKDATA)[0]]; Track.id = T.id; Track.name = T.name; Track.S = T.s; Track.N = T.s.length; Track.step = T.step; Track.W = T.width; Track.half = T.width / 2 + T.wall; Track.len = T.length; Track.marks = T.marks || {};
    Track.fastLine(); return T;
};
// the centre line at u: o = { x, y, z, tx, tz, bank }
Track.at = function (u, o) {
    const N = Track.N, S = Track.S; u = ((u % N) + N) % N; const i = Math.floor(u), f = u - i, a = S[i], b = S[(i + 1) % N];
    o.x = a[0] + (b[0] - a[0]) * f; o.y = a[1] + (b[1] - a[1]) * f; o.z = a[2] + (b[2] - a[2]) * f; const tx = a[3] + (b[3] - a[3]) * f, tz = a[4] + (b[4] - a[4]) * f, l = Math.hypot(tx, tz) || 1; o.tx = tx / l; o.tz = tz / l; o.bank = a[5] + (b[5] - a[5]) * f; return o;
};
// a spot (u, d) in the world: o = { x, y, z, tx, tz, bank }
Track.spot = function (u, d, o) { Track.at(u, o); o.x += o.tz * d; o.z -= o.tx * d; o.y -= d * o.bank; return o; };
// where a point is on the circuit: o.u, o.d. `hint` (the u it was at a moment ago) makes it a short look; without one the whole line is searched.
Track.locate = function (x, z, hint, o) {
    const N = Track.N, S = Track.S; let best = 1e18, bi = 0;
    if (hint === undefined || hint === null) { for (let i = 0; i < N; i++) { const s = S[i], d = (s[0] - x) * (s[0] - x) + (s[2] - z) * (s[2] - z); if (d < best) { best = d; bi = i; } } }
    else { const h = Math.floor(hint); for (let k = -6; k <= 10; k++) { const i = ((h + k) % N + N) % N, s = S[i], d = (s[0] - x) * (s[0] - x) + (s[2] - z) * (s[2] - z); if (d < best) { best = d; bi = i; } } }
    const a = S[bi], along = (x - a[0]) * a[3] + (z - a[2]) * a[4];
    o.u = ((bi + clamp(along / Track.step, -1, 1)) % N + N) % N; o.d = (x - a[0]) * a[4] - (z - a[2]) * a[3]; return o;
};
// how far u2 is ahead of u1 along the lap, in samples (-N/2 .. N/2)
Track.ahead = (u1, u2) => { const N = Track.N; let d = (u2 - u1) % N; if (d > N / 2) d -= N; if (d < -N / 2) d += N; return d; };
// THE FAST LINE: where a quick driver puts the car (line[i] = metres left of centre) and how tight that line is there
// (kap[i], 1 / radius, signed: + is a left-hander). Found the old way: every point of an elastic band, held inside the
// road, moves toward the middle of its neighbours until the band is as straight as the road allows.
Track.fastLine = function () {
    const N = Track.N, S = Track.S, lim = Track.W / 2 - 1.7, o = new Float32Array(N), px = new Float32Array(N), pz = new Float32Array(N);
    const put = i => { px[i] = S[i][0] + S[i][4] * o[i]; pz[i] = S[i][2] - S[i][3] * o[i]; };
    for (let i = 0; i < N; i++) put(i);
    for (const stride of [12, 6, 3, 1]) for (let it = 0; it < 140; it++) for (let i = 0; i < N; i++) {
        const a = (i - stride + N) % N, b = (i + stride) % N, mx = (px[a] + px[b]) / 2, mz = (pz[a] + pz[b]) / 2;
        o[i] = clamp(o[i] + ((mx - px[i]) * S[i][4] - (mz - pz[i]) * S[i][3]) * 0.5, -lim, lim); put(i);
    }
    const k = new Float32Array(N), G = 4;
    for (let i = 0; i < N; i++) { const a = (i - G + N) % N, b = (i + G) % N, h1 = Math.atan2(px[i] - px[a], pz[i] - pz[a]), h2 = Math.atan2(px[b] - px[i], pz[b] - pz[i]), l = (Math.hypot(px[i] - px[a], pz[i] - pz[a]) + Math.hypot(px[b] - px[i], pz[b] - pz[i])) / 2; k[i] = angDiff(h2, h1) / l; }
    Track.line = o; Track.kap = k;
};
// the speed a car with `grip` (sideways m/s2), `brake` and `accel` (m/s2) and `top` (m/s) can carry at each sample of the fast line
Track.speeds = function (grip, brake, accel, top) {
    const N = Track.N, v = new Float32Array(N), ds = Track.step;
    for (let i = 0; i < N; i++) v[i] = Math.min(top, Math.sqrt(grip / Math.max(1e-4, Math.abs(Track.kap[i]))));
    for (let pass = 0; pass < 2; pass++) for (let i = N - 1; i >= 0; i--) { const n = v[(i + 1) % N]; v[i] = Math.min(v[i], Math.sqrt(n * n + 2 * brake * ds)); }
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { const p = v[(i - 1 + N) % N]; v[i] = Math.min(v[i], Math.sqrt(p * p + 2 * accel * ds)); }
    return v;
};
