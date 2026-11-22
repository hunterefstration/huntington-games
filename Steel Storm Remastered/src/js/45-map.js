// ============================================================
// THE MAP in the corner of a battle: the ground (higher is lighter, solid things dark) drawn once per terrain, and over
// it, a few times a second, the rings, both bases, your side, the enemy that your side can see, and you with the way the
// gun looks. North is up. An enemy is on it while it is within sight range of one of yours or has just fired.
// ============================================================
const Minimap = { c: null, g: null, bg: null, id: '', t: 0, N: 96, SEE: 230 };
Minimap.paint = function () {
    const N = Minimap.N, L = World.lim, bg = Minimap.bg = document.createElement('canvas'); bg.width = bg.height = N; const g = bg.getContext('2d'), im = g.createImageData(N, N), d = im.data;
    let lo = 1e9, hi = -1e9; const H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const h = World.height(L[0] + (i + 0.5) / N * (L[1] - L[0]), L[2] + (j + 0.5) / N * (L[3] - L[2])); H[j * N + i] = h; if (h < lo) lo = h; if (h > hi) hi = h; }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = L[0] + (i + 0.5) / N * (L[1] - L[0]), z = L[2] + (j + 0.5) / N * (L[3] - L[2]), k = (H[j * N + i] - lo) / Math.max(1, hi - lo), solid = World.solid(x, z), o = (j * N + i) * 4, v = solid ? 26 : 62 + k * 86;
        d[o] = v * 0.95; d[o + 1] = v; d[o + 2] = v * 0.86; d[o + 3] = 235; }
    g.putImageData(im, 0, 0); Minimap.id = World.id;
};
Minimap.draw = function (G, dt) {
    Minimap.t -= dt; if (Minimap.t > 0) return; Minimap.t = 0.2;
    const c = Minimap.c || (Minimap.c = $('map')), g = Minimap.g || (Minimap.g = c.getContext('2d')), S = c.width, L = World.lim, P = G.P; if (Minimap.id !== World.id || !Minimap.bg) Minimap.paint();
    const mx = x => (x - L[0]) / (L[1] - L[0]) * S, mz = z => (z - L[2]) / (L[3] - L[2]) * S;
    g.clearRect(0, 0, S, S); g.imageSmoothingEnabled = true; g.drawImage(Minimap.bg, 0, 0, S, S);
    if (G.base) for (let t = 0; t < 2; t++) { g.fillStyle = t ? 'rgba(255,110,90,.35)' : 'rgba(140,255,150,.35)'; g.fillRect(mx(G.base[t][0]) - 7, mz(G.base[t][1]) - 7, 14, 14); }
    g.font = '700 11px Roboto, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of G.points) { const x = mx(p.x), y = mz(p.z); g.beginPath(); g.arc(x, y, 9, 0, 6.3); g.fillStyle = p.own === 0 ? 'rgba(90,220,110,.9)' : p.own === 1 ? 'rgba(240,90,70,.9)' : 'rgba(230,230,230,.85)'; g.fill(); g.fillStyle = '#101214'; g.fillText(p.name, x, y + 0.5); }
    const mine = Units.list.filter(U => !U.dead && U.team === 0);
    for (const U of Units.list) { if (U.dead || U === P) continue; if (U.team !== 0 && !(U.recoil > 0.2) && !mine.some(O => Math.hypot(O.x - U.x, O.z - U.z) < Minimap.SEE)) continue; g.fillStyle = U.team === 0 ? '#7dc8ff' : '#ff5a48'; g.fillRect(mx(U.x) - 2.5, mz(U.z) - 2.5, 5, 5); }
    // you: an arrow along the hull, a line the way the gun looks
    const x = mx(P.x), y = mz(P.z), a = P.yaw, s = Math.sin(a), co = Math.cos(a); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(G.aimYaw) * 26, y + Math.cos(G.aimYaw) * 26); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + s * 7, y + co * 7); g.lineTo(x - s * 4 + co * 4.5, y - co * 4 - s * 4.5); g.lineTo(x - s * 4 - co * 4.5, y - co * 4 + s * 4.5); g.closePath(); g.fill();
};
