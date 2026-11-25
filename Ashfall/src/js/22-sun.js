// ============================================================
// THE LIGHT IN THE SKY ON THE LENS: the sun by day and at sunset, the moon at night.
// The map's light is baked: its shadows never move. What the air and a camera add when you look towards the light is drawn here:
//   shafts  (every picture mode but LOW) real shafts of light: HG3D's rays() pass spreads the bright sky round the sun away from it
//           across the finished picture, and whatever stands in front of the sky (a roof, a wagon, a tree) cuts them, so they come
//           through gaps and round edges. (The owner, 2026-11-25: "change the godrays to be more realistic, and put them on normal
//           mode as well". The first version was a turning fan of stripes drawn by the page: it is gone.)
//   glare   (HIGH, CINEMATIC) a wash of the light's colour round where it is, stronger the more squarely you face it
//   ghosts  (CINEMATIC) the string of pale discs a lens throws across the picture, on the line through the middle
// The glare and ghosts go when a wall or a roof is between your eye and the light: five rays are cast at it through the collision
// map (World.ray). No light in the sky indoors. Sun.ray is what App.raysDraw (10-core.js) hands to HG3D each frame.
// ============================================================
const Sun = { on: 0, vis: 0, el: null, d: null, t: 0, ray: { x: 0.5, y: 0.5, strength: 0, color: [1, 1, 1], size: 0.5, density: 0.85, decay: 0.93, reach: 0.45 }, rays: 0 };
Sun.setup = function () {
    const P = App.pic(), T = World.time(), d = World.lightDir, ok = !!(d && World.map && !World.map.indoors);
    Sun.on = ok ? P.sun : 0; Sun.rays = ok && !App.lite ? (P.rays || 0) * T.rayK : 0; Sun.d = ok ? d : null; Sun.el = Sun.el || $('sunfx'); Sun.vis = 0; Sun.ray.strength = 0; Sun.ray.color = T.ray; Sun.k = T.moon ? 0.6 : 1;
    if (!Sun.el) return; Sun.el.className = Sun.on >= 2 ? 'on' : ''; Sun.el.style.opacity = 0;
    if (ok) { const c = T.ray, h = v => Math.round(clamp(0.45 + v * 0.55, 0, 1) * 255); Sun.el.style.setProperty('--sun', h(c[0]) + ',' + h(c[1]) + ',' + h(c[2])); }
};
Sun.frame = function (dt, cw) {
    Sun.ray.strength = 0; if (!Sun.d || (Sun.on < 2 && !Sun.rays)) return; const d = Sun.d, cam = World.camera;
    const x = d[0] * cw[0] + d[1] * cw[1] + d[2] * cw[2], y = d[0] * cw[4] + d[1] * cw[5] + d[2] * cw[6], z = -(d[0] * cw[8] + d[1] * cw[9] + d[2] * cw[10]);      // the light in the camera's own axes (z: in front)
    const t = Math.tan((cam.fov || 72) * Math.PI / 360), px = x / (Math.max(z, 0.05) * t * cam.aspect), py = y / (Math.max(z, 0.05) * t);
    // the shafts: strongest with the light in the picture, fading as it leaves it (it may sit a little outside and still reach in)
    // A high sun above the top of the picture still sends them down through whatever stands against the sky: the halo grows with how
    // far out it is, so the sky along the top edge is the light (the owner saw none in build 71: the midday sun is 60 degrees up).
    if (Sun.rays && z > 0.05) { const off = Math.max(Math.abs(px), Math.abs(py)), k = clamp(z * 3, 0, 1) * clamp((3.4 - off) / 1.4, 0, 1); if (k > 0.01) { const r = Sun.ray; r.x = px * 0.5 + 0.5; r.y = py * 0.5 + 0.5; r.size = 0.5 + Math.max(0, off - 0.9) * 0.5; r.reach = 0.45; r.strength = Sun.rays * k; } }
    if (Sun.on < 2 || !Sun.el) return;
    let want = 0;
    if (z > 0.12) {
        // how much of it is in the clear: the middle and four points just off it
        let n = 0; const o = 0.012, ex = cw[12], ey = cw[13], ez = cw[14];
        for (let i = 0; i < 5; i++) { const ax = i === 1 ? o : i === 2 ? -o : 0, ay = i === 3 ? o : i === 4 ? -o : 0, dx = d[0] + cw[0] * ax + cw[4] * ay, dy = d[1] + cw[1] * ax + cw[5] * ay, dz = d[2] + cw[2] * ax + cw[6] * ay; if (World.ray(ex, ey, ez, dx, dy, dz, 90) >= 90) n++; }
        want = n / 5;
    }
    Sun.vis += (want - Sun.vis) * Math.min(1, dt * (want > Sun.vis ? 7 : 12)); Sun.t += dt;
    const face = z > 0 ? Math.pow(clamp(z, 0, 1), 5) : 0, a = Sun.vis * (0.2 + 0.8 * face) * (Sun.on >= 3 ? 0.9 : 0.65) * Sun.k, st = Sun.el.style;
    if (a < 0.01) { if (Sun.shown) { st.opacity = 0; Sun.shown = false; } return; } Sun.shown = true;
    const sx = clamp(px, -1.6, 1.6), sy = clamp(py, -1.6, 1.6);
    st.opacity = a.toFixed(3); st.setProperty('--sx', ((sx * 0.5 + 0.5) * 100).toFixed(1) + '%'); st.setProperty('--sy', ((0.5 - sy * 0.5) * 100).toFixed(1) + '%');
    if (Sun.on >= 3) { const g = Sun.el.children; for (let i = 2; i < g.length; i++) { const k = [-0.35, -0.9, -1.45][i - 2] || -1; g[i].style.transform = 'translate(' + ((0.5 + sx * 0.5 * k) * innerWidth).toFixed(0) + 'px,' + ((0.5 - sy * 0.5 * k) * innerHeight).toFixed(0) + 'px)'; } }
};
