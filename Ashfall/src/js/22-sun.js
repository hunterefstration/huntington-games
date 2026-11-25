// ============================================================
// THE SUN ON THE LENS (picture HIGH and CINEMATIC; Blocky Shooter's Cinematic mode was mostly its sun).
// The map's sun is baked: its light, its shadows and its place in the sky never move. What a camera adds when it looks towards a
// sun is drawn here, over the finished picture, with four page elements blended as light (mix-blend-mode: screen):
//   glare   a warm wash round where the sun is, stronger the more squarely you face it
//   rays    (CINEMATIC) shafts fanning out from the sun, turning slowly
//   ghosts  (CINEMATIC) the string of pale discs a lens throws across the picture, on the line through the middle
// All of it goes when a wall or a roof is between your eye and the sun: five rays are cast at it through the collision map
// (World.ray), so walking out from behind a wagon the sun comes round the edge instead of switching on. No sun indoors.
// ============================================================
const Sun = { on: 0, vis: 0, el: null, d: null, t: 0 };
Sun.setup = function () {
    const P = App.pic(), J = World.A && World.A.json, ok = !!(J && J.sun && J.sun.dir[1] > 0.02 && World.map && !World.map.indoors);
    Sun.on = ok ? P.sun : 0; Sun.d = ok ? J.sun.dir : null; Sun.el = Sun.el || $('sunfx'); Sun.vis = 0;
    if (!Sun.el) return; Sun.el.className = Sun.on >= 2 ? (Sun.on >= 3 ? 'on rays' : 'on') : ''; Sun.el.style.opacity = 0;
    if (ok) { const c = J.sun.lampColor || [1, 0.86, 0.7], h = v => Math.round(clamp(0.45 + v * 0.55, 0, 1) * 255); Sun.el.style.setProperty('--sun', h(c[0]) + ',' + h(c[1]) + ',' + h(c[2])); }
};
Sun.frame = function (dt, cw) {
    if (Sun.on < 2 || !Sun.d || !Sun.el) return; const d = Sun.d, cam = World.camera;
    const x = d[0] * cw[0] + d[1] * cw[1] + d[2] * cw[2], y = d[0] * cw[4] + d[1] * cw[5] + d[2] * cw[6], z = -(d[0] * cw[8] + d[1] * cw[9] + d[2] * cw[10]);      // the sun in the camera's own axes (z: in front)
    let want = 0;
    if (z > 0.12) {
        // how much of it is in the clear: the middle and four points just off it
        let n = 0; const o = 0.012, ex = cw[12], ey = cw[13], ez = cw[14];
        for (let i = 0; i < 5; i++) { const ax = i === 1 ? o : i === 2 ? -o : 0, ay = i === 3 ? o : i === 4 ? -o : 0, dx = d[0] + cw[0] * ax + cw[4] * ay, dy = d[1] + cw[1] * ax + cw[5] * ay, dz = d[2] + cw[2] * ax + cw[6] * ay; if (World.ray(ex, ey, ez, dx, dy, dz, 90) >= 90) n++; }
        want = n / 5;
    }
    Sun.vis += (want - Sun.vis) * Math.min(1, dt * (want > Sun.vis ? 7 : 12)); Sun.t += dt;
    const face = z > 0 ? Math.pow(clamp(z, 0, 1), 5) : 0, a = Sun.vis * (0.2 + 0.8 * face) * (Sun.on >= 3 ? 0.9 : 0.65), st = Sun.el.style;
    if (a < 0.01) { if (Sun.shown) { st.opacity = 0; Sun.shown = false; } return; } Sun.shown = true;
    const t = Math.tan((cam.fov || 72) * Math.PI / 360), sx = clamp(x / (Math.max(z, 0.05) * t * cam.aspect), -1.6, 1.6), sy = clamp(y / (Math.max(z, 0.05) * t), -1.6, 1.6);
    st.opacity = a.toFixed(3); st.setProperty('--sx', ((sx * 0.5 + 0.5) * 100).toFixed(1) + '%'); st.setProperty('--sy', ((0.5 - sy * 0.5) * 100).toFixed(1) + '%');
    if (Sun.on >= 3) { st.setProperty('--turn', (Sun.t * 2.2 % 360).toFixed(1) + 'deg'); const g = Sun.el.children; for (let i = 2; i < g.length; i++) { const k = [-0.35, -0.9, -1.45][i - 2] || -1; g[i].style.transform = 'translate(' + ((0.5 + sx * 0.5 * k) * innerWidth).toFixed(0) + 'px,' + ((0.5 - sy * 0.5 * k) * innerHeight).toFixed(0) + 'px)'; } }
};
