// ==========================================
// ART: world themes, backgrounds, auto-tiled terrain, sprites. Everything is drawn with canvas paths and gradients,
// at the screen's real resolution, so it stays crisp at any size. Terrain is cached in chunks; backgrounds in strips.
// ==========================================
const WORLDS = [
    { name: 'Glowwood', sub: 'A forest at dusk', sky: ['#0c1a3a', '#2a3f73', '#c8728a', '#ffc58a'], dark: 'rgba(8, 12, 40,', ambient: 0.32,
      body: ['#4a2f3a', '#2e1c2a'], top: '#4fd06a', top2: '#2e9a52', rim: '#1a0f18', detail: '#6b4452', accent: '#ffd36b', fog: 'rgba(255,190,150,', plat: '#8a5a3c',
      slime: ['#7be36b', '#3fa64a'], deco: 'forest', mote: '#ffe49a' },
    { name: 'Hollow Caves', sub: 'Crystal-lit darkness', sky: ['#04060f', '#0a1230', '#0f1e45', '#132a5a'], dark: 'rgba(2, 4, 14,', ambient: 0.86,
      body: ['#2c3550', '#161c30'], top: '#5e7aa8', top2: '#3c5280', rim: '#0a0e1c', detail: '#40507a', accent: '#7ff0ff', fog: 'rgba(80,140,255,', plat: '#5a6a8a',
      slime: ['#6fd6ff', '#2f86c7'], deco: 'cave', mote: '#8ff3ff' },
    { name: 'Sky Ruins', sub: 'Temples above the clouds', sky: ['#3d8be0', '#7cbcf2', '#cbe7ff', '#fff3dc'], dark: 'rgba(30, 40, 90,', ambient: 0.04,
      body: ['#efe7d6', '#c9bda4'], top: '#ffffff', top2: '#e6d6a8', rim: '#8f8064', detail: '#d8c9a8', accent: '#ffcf4a', fog: 'rgba(255,255,255,', plat: '#e8d8b0',
      slime: ['#ff9bd2', '#d65a9e'], deco: 'ruins', mote: '#ffffff' },
    { name: 'Ember Forge', sub: 'Where the fire sleeps', sky: ['#0d0507', '#2a0a0c', '#5a1a10', '#a03a12'], dark: 'rgba(20, 4, 4,', ambient: 0.62,
      body: ['#3a2a2a', '#1c1214'], top: '#ff7a2a', top2: '#7a2a14', rim: '#0c0606', detail: '#4a3434', accent: '#ff8a3a', fog: 'rgba(255,100,40,', plat: '#6a4a3a',
      slime: ['#ffb04a', '#d0561c'], deco: 'forge', mote: '#ffb35a' },
    { name: 'The Gloom', sub: 'The last lantern', sky: ['#050010', '#120428', '#2a0a4a', '#40125e'], dark: 'rgba(6, 0, 18,', ambient: 0.8,
      body: ['#2a1a40', '#140a24'], top: '#b98aff', top2: '#5a2a9a', rim: '#08040f', detail: '#3a2856', accent: '#c9a0ff', fog: 'rgba(170,110,255,', plat: '#4a3a6a',
      slime: ['#c9a0ff', '#7a3ad0'], deco: 'gloom', mote: '#d8b8ff' }
];

// ---------- background strips (one per parallax layer, tiled sideways) ----------
function paintBackground(w, W, H) {
    const T = WORLDS[w], layers = [], r = seeded(1000 + w);
    const mk = (h) => { const c = document.createElement('canvas'); c.width = W; c.height = h; return [c, c.getContext('2d')]; };
    // sky
    const [sky, s] = mk(H);
    const g = s.createLinearGradient(0, 0, 0, H); T.sky.forEach((c, i) => g.addColorStop(i / (T.sky.length - 1), c)); s.fillStyle = g; s.fillRect(0, 0, W, H);
    if (w === 0 || w === 4 || w === 1) for (let i = 0; i < (w === 1 ? 60 : 160); i++) { s.globalAlpha = rand(0.2, 0.9) * (w === 1 ? 0.35 : 1); s.fillStyle = '#fff'; s.beginPath(); s.arc(r() * W, r() * H * 0.6, r() * 1.4 + 0.3, 0, 7); s.fill(); }
    s.globalAlpha = 1;
    if (w === 0) { const m = s.createRadialGradient(W * 0.72, H * 0.62, 0, W * 0.72, H * 0.62, H * 0.5); m.addColorStop(0, 'rgba(255,220,170,.9)'); m.addColorStop(0.08, 'rgba(255,200,150,.6)'); m.addColorStop(1, 'rgba(255,160,120,0)'); s.fillStyle = m; s.fillRect(0, 0, W, H); }
    if (w === 2) { const m = s.createRadialGradient(W * 0.25, H * 0.2, 0, W * 0.25, H * 0.2, H * 0.7); m.addColorStop(0, 'rgba(255,255,230,.95)'); m.addColorStop(0.06, 'rgba(255,250,210,.7)'); m.addColorStop(1, 'rgba(255,240,200,0)'); s.fillStyle = m; s.fillRect(0, 0, W, H); }
    if (w === 4) { const m = s.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, H * 0.6); m.addColorStop(0, 'rgba(200,140,255,.35)'); m.addColorStop(1, 'rgba(120,60,200,0)'); s.fillStyle = m; s.fillRect(0, 0, W, H); }
    layers.push({ c: sky, k: 0, y: 0, fixed: true });
    // far, mid and near silhouettes
    const shapes = [
        { k: 0.12, base: 0.62, amp: 0.16, col: T.sky[1], fog: 0.55 },
        { k: 0.3, base: 0.72, amp: 0.14, col: T.sky[0], fog: 0.35 },
        { k: 0.55, base: 0.84, amp: 0.1, col: T.rim, fog: 0.15 }
    ];
    shapes.forEach((L, li) => {
        const [c, x] = mk(H);
        x.fillStyle = L.col;
        const hAt = (px) => { let v = 0; for (let o = 1; o <= 4; o++) v += Math.sin(px / W * Math.PI * 2 * (o * (li + 2)) + o * 1.7 + w) / o; return H * (L.base - L.amp * 0.5 * v); };
        if (T.deco === 'forest') {
            x.beginPath(); x.moveTo(0, H);
            for (let px = 0; px <= W; px += 6) x.lineTo(px, hAt(px)); x.lineTo(W, H); x.fill();
            const n = 24 + li * 14;                         // pine trees along the ridge
            for (let i = 0; i < n; i++) { const px = (i + r() * 0.8) * W / n, base = hAt(px) + 8, th = (40 + r() * 60) * (0.6 + li * 0.45), tw = th * 0.42;
                for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(px - tw * (1 - k * 0.22), base - th * k * 0.28); x.lineTo(px, base - th * (0.45 + k * 0.28)); x.lineTo(px + tw * (1 - k * 0.22), base - th * k * 0.28); x.fill(); } }
        } else if (T.deco === 'cave') {
            x.beginPath(); x.moveTo(0, H); for (let px = 0; px <= W; px += 6) x.lineTo(px, hAt(px)); x.lineTo(W, H); x.fill();
            x.beginPath(); x.moveTo(0, 0); for (let px = 0; px <= W; px += 6) x.lineTo(px, H - hAt(px) * 0.9); x.lineTo(W, 0); x.fill();
            for (let i = 0; i < 30 + li * 10; i++) { const px = r() * W, len = (30 + r() * 120) * (0.6 + li * 0.4), top = H - hAt(px) * 0.9 - 4; x.beginPath(); x.moveTo(px - len * 0.12, top); x.lineTo(px, top + len); x.lineTo(px + len * 0.12, top); x.fill(); }
            if (li < 2) for (let i = 0; i < 14; i++) { const px = r() * W, py = hAt(px) - 6; x.save(); x.globalAlpha = 0.5 - li * 0.15; x.fillStyle = T.accent; x.beginPath(); x.moveTo(px - 5, py); x.lineTo(px, py - 18 - r() * 20); x.lineTo(px + 5, py); x.fill(); x.restore(); }
        } else if (T.deco === 'ruins') {
            x.globalAlpha = 0.75 - li * 0.1;
            for (let i = 0; i < 6 + li * 2; i++) {          // floating islands with temples
                const cx = (i + 0.5 + (r() - 0.5) * 0.6) * W / (6 + li * 2), cy = H * (0.35 + li * 0.17 + (r() - 0.5) * 0.12), iw = (90 + r() * 120) * (0.6 + li * 0.35);
                x.fillStyle = L.col === T.rim ? '#b8c8e8' : (li === 0 ? '#cfe0f8' : '#a8bce0');
                x.beginPath(); x.moveTo(cx - iw / 2, cy); x.quadraticCurveTo(cx, cy + iw * 0.9, cx + iw / 2, cy); x.closePath(); x.fill();
                x.fillRect(cx - iw / 2, cy - 6, iw, 8);
                const cols = 3 + Math.floor(r() * 4), ch = iw * 0.5;
                for (let k = 0; k < cols; k++) x.fillRect(cx - iw * 0.35 + k * iw * 0.7 / (cols - 1) - 3, cy - ch, 6, ch);
                x.beginPath(); x.moveTo(cx - iw * 0.42, cy - ch); x.lineTo(cx, cy - ch - iw * 0.16); x.lineTo(cx + iw * 0.42, cy - ch); x.fill();
            }
            x.globalAlpha = 1;
            for (let i = 0; i < 9; i++) {                     // clouds
                const cx = r() * W, cy = H * (0.55 + li * 0.14 + r() * 0.1); x.fillStyle = `rgba(255,255,255,${0.55 + li * 0.15})`;
                for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(cx + (k - 3) * 26 + r() * 10, cy - Math.sin(k / 5 * Math.PI) * 18, 22 + r() * 18, 0, 7); x.fill(); }
            }
        } else if (T.deco === 'forge') {
            x.beginPath(); x.moveTo(0, H); for (let px = 0; px <= W; px += 6) x.lineTo(px, hAt(px)); x.lineTo(W, H); x.fill();
            for (let i = 0; i < 10 + li * 4; i++) { const px = r() * W, cw = 18 + r() * 26, chh = 60 + r() * 140 * (0.6 + li * 0.4), base = hAt(px) + 10;   // chimneys
                x.fillRect(px - cw / 2, base - chh, cw, chh); x.fillRect(px - cw * 0.7, base - chh, cw * 1.4, 8);
                if (li < 2) { x.save(); x.globalAlpha = 0.35; x.fillStyle = '#ff7a2a'; x.fillRect(px - cw * 0.3, base - chh * 0.6, cw * 0.6, 4); x.restore(); } }
            const lg = x.createLinearGradient(0, H * 0.8, 0, H); lg.addColorStop(0, 'rgba(255,90,20,0)'); lg.addColorStop(1, `rgba(255,90,20,${0.35 - li * 0.08})`); x.fillStyle = lg; x.fillRect(0, H * 0.8, W, H * 0.2);
        } else {
            x.beginPath(); x.moveTo(0, H); for (let px = 0; px <= W; px += 6) x.lineTo(px, hAt(px) + Math.sin(px * 0.05) * 6); x.lineTo(W, H); x.fill();
            for (let i = 0; i < 20; i++) { const px = r() * W, py = hAt(px); x.save(); x.globalAlpha = 0.4; x.strokeStyle = T.accent; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + 20, py - 60, px - 20, py - 120, px + 10, py - 170 - r() * 80); x.stroke(); x.restore(); }
        }
        // atmospheric haze over each layer, thicker far away
        const fg = x.createLinearGradient(0, 0, 0, H); fg.addColorStop(0, T.fog + '0)'); fg.addColorStop(1, T.fog + L.fog * 0.6 + ')');
        x.globalCompositeOperation = 'source-atop'; x.fillStyle = fg; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
        layers.push({ c, k: L.k, y: 0 });
    });
    return layers;
}

// ---------- terrain tiles ----------
// A solid tile is drawn by looking at its 8 neighbours: exposed edges get a cap (grass, moss, marble trim, glowing seams),
// a darker rim and a highlight; corners that stick out are rounded.
function drawTile(x, T, tx, ty, solid, w, seed) {
    const s = TS, up = !solid(tx, ty - 1), dn = !solid(tx, ty + 1), lf = !solid(tx - 1, ty), rt = !solid(tx + 1, ty);
    const r = seeded(seed), R = 9;
    const rTL = up && lf ? R : 0, rTR = up && rt ? R : 0, rBL = dn && lf ? R : 0, rBR = dn && rt ? R : 0;
    x.save(); x.translate(tx * s, ty * s);
    x.beginPath();
    x.moveTo(rTL, 0); x.lineTo(s - rTR, 0); if (rTR) x.quadraticCurveTo(s, 0, s, rTR); else x.lineTo(s, 0);
    x.lineTo(s, s - rBR); if (rBR) x.quadraticCurveTo(s, s, s - rBR, s); else x.lineTo(s, s);
    x.lineTo(rBL, s); if (rBL) x.quadraticCurveTo(0, s, 0, s - rBL); else x.lineTo(0, s);
    x.lineTo(0, rTL); if (rTL) x.quadraticCurveTo(0, 0, rTL, 0); else x.lineTo(0, 0);
    x.closePath();
    // shade by depth below the surface (not per tile), so deep ground darkens smoothly instead of in stripes
    let d = 0; while (d < 4 && solid(tx, ty - d - 1)) d++;
    const mix = (k) => { const a = parseInt(T.body[0].slice(1), 16), c = parseInt(T.body[1].slice(1), 16), m = (sh) => Math.round(((a >> sh) & 255) * (1 - k) + ((c >> sh) & 255) * k); return `rgb(${m(16)},${m(8)},${m(0)})`; };
    const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, mix(d / 4)); g.addColorStop(1, mix(Math.min(1, (d + 1) / 4)));
    x.fillStyle = g; x.fill();
    x.save(); x.clip();
    // texture
    if (T.deco === 'ruins') {
        x.strokeStyle = 'rgba(120,100,70,.35)'; x.lineWidth = 1.2;
        const off = (ty % 2) * 16; x.beginPath(); x.moveTo(0, 16); x.lineTo(s, 16); x.moveTo(off, 0); x.lineTo(off, 16); x.moveTo((off + 16) % 32, 16); x.lineTo((off + 16) % 32, 32); x.stroke();
        if (r() < 0.25) { x.strokeStyle = 'rgba(70,140,60,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(r() * s, 0); x.bezierCurveTo(r() * s, 10, r() * s, 20, r() * s, s); x.stroke(); }
    } else if (T.deco === 'forge') {
        x.fillStyle = T.detail; for (let i = 0; i < 3; i++) { x.globalAlpha = 0.6; x.fillRect(r() * s, r() * s, 6 + r() * 8, 3 + r() * 4); }
        if (r() < 0.35) { x.globalAlpha = 0.9; x.strokeStyle = '#ff6a1a'; x.lineWidth = 1.5; x.shadowColor = '#ff6a1a'; x.shadowBlur = 6; x.beginPath(); let px = r() * s, py = 0; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 14; py += 8; x.lineTo(px, py); } x.stroke(); x.shadowBlur = 0; }
        x.globalAlpha = 1;
    } else {
        for (let i = 0; i < 4; i++) { x.fillStyle = r() < 0.5 ? T.detail : T.rim; x.globalAlpha = 0.35 + r() * 0.3; x.beginPath(); x.ellipse(r() * s, r() * s, 1.5 + r() * 3.5, 1 + r() * 2.5, r() * 3, 0, 7); x.fill(); }
        x.globalAlpha = 1;
        if (T.deco === 'cave' && r() < 0.18) {                   // a crystal grows out of the rock
            const cx = 6 + r() * 20, cy = 8 + r() * 20; x.fillStyle = T.accent; x.shadowColor = T.accent; x.shadowBlur = 10;
            x.beginPath(); x.moveTo(cx - 4, cy + 5); x.lineTo(cx - 1, cy - 8); x.lineTo(cx + 4, cy + 5); x.closePath(); x.fill(); x.shadowBlur = 0;
        }
    }
    // depth: darker toward edges that meet air from below/sides
    const shade = (x0, y0, x1, y1, a) => { const sg = x.createLinearGradient(x0, y0, x1, y1); sg.addColorStop(0, `rgba(0,0,0,${a})`); sg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sg; x.fillRect(0, 0, s, s); };
    if (dn) shade(0, s, 0, s - 10, 0.45);
    if (lf) shade(0, 0, 8, 0, 0.3);
    if (rt) shade(s, 0, s - 8, 0, 0.3);
    x.restore();
    // caps on exposed tops
    if (up) {
        if (T.deco === 'forest') {
            x.fillStyle = T.top2; x.beginPath(); x.moveTo(rTL ? 2 : 0, 2); x.lineTo(s - (rTR ? 2 : 0), 2); x.lineTo(s - (rTR ? 3 : 0), 10);
            for (let k = 6; k >= 0; k--) x.lineTo(k * s / 6, 8 + r() * 6); x.closePath(); x.fill();
            x.fillStyle = T.top; x.beginPath(); x.moveTo(rTL ? 3 : 0, 0); x.lineTo(s - (rTR ? 3 : 0), 0); x.lineTo(s - (rTR ? 3 : 0), 5);
            for (let k = 6; k >= 0; k--) x.lineTo(k * s / 6, 4 + r() * 4); x.closePath(); x.fill();
            x.strokeStyle = T.top; x.lineWidth = 1.6; x.lineCap = 'round';
            for (let k = 0; k < 5; k++) { const bx = 3 + r() * 26; x.beginPath(); x.moveTo(bx, 1); x.lineTo(bx + (r() - 0.5) * 5, -3 - r() * 6); x.stroke(); }
            if (r() < 0.22) { const fx = 6 + r() * 20; x.strokeStyle = '#2e9a52'; x.beginPath(); x.moveTo(fx, 0); x.lineTo(fx, -9); x.stroke(); x.fillStyle = ['#ffd36b', '#ff8ac6', '#9fd8ff'][Math.floor(r() * 3)]; x.beginPath(); x.arc(fx, -10, 2.6, 0, 7); x.fill(); }
        } else if (T.deco === 'cave') {
            x.fillStyle = T.top2; x.fillRect(rTL ? 4 : 0, 0, s - (rTL ? 4 : 0) - (rTR ? 4 : 0), 5);
            x.fillStyle = T.top; x.fillRect(rTL ? 5 : 0, 0, s - (rTL ? 5 : 0) - (rTR ? 5 : 0), 2);
            if (r() < 0.2) { x.fillStyle = 'rgba(140,255,200,.6)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(4 + r() * 24, 0, 1.6, 0, 7); x.fill(); } }
        } else if (T.deco === 'ruins') {
            x.fillStyle = T.top2; x.fillRect(rTL ? 2 : 0, 0, s - (rTL ? 2 : 0) - (rTR ? 2 : 0), 6);
            x.fillStyle = '#fff'; x.fillRect(rTL ? 3 : 0, 0, s - (rTL ? 3 : 0) - (rTR ? 3 : 0), 2);
            x.fillStyle = 'rgba(200,160,60,.8)'; x.fillRect(0, 6, s, 1.5);
            if (r() < 0.25) { x.fillStyle = '#5cb85a'; for (let k = 0; k < 4; k++) { x.beginPath(); x.ellipse(4 + r() * 24, 1, 3, 1.6, r(), 0, 7); x.fill(); } }
        } else if (T.deco === 'forge') {
            x.fillStyle = '#2a1414'; x.fillRect(rTL ? 3 : 0, 0, s - (rTL ? 3 : 0) - (rTR ? 3 : 0), 5);
            x.fillStyle = T.top; x.shadowColor = T.top; x.shadowBlur = 8; x.fillRect(rTL ? 5 : 0, 0, s - (rTL ? 5 : 0) - (rTR ? 5 : 0), 1.6); x.shadowBlur = 0;
        } else {
            x.fillStyle = T.top2; x.fillRect(rTL ? 3 : 0, 0, s - (rTL ? 3 : 0) - (rTR ? 3 : 0), 4);
            x.fillStyle = T.top; x.shadowColor = T.top; x.shadowBlur = 6; x.fillRect(rTL ? 5 : 0, 0, s - (rTL ? 5 : 0) - (rTR ? 5 : 0), 1.5); x.shadowBlur = 0;
        }
    }
    if (dn && T.deco === 'cave' && r() < 0.35) { x.fillStyle = T.body[1]; const sx = 6 + r() * 20, sl = 6 + r() * 10; x.beginPath(); x.moveTo(sx - 4, s); x.lineTo(sx, s + sl); x.lineTo(sx + 4, s); x.fill(); }
    if (dn && T.deco === 'forest' && r() < 0.3) { x.strokeStyle = '#3a7a3a'; x.lineWidth = 1.4; const vx = 4 + r() * 24, vl = 8 + r() * 18; x.beginPath(); x.moveTo(vx, s); x.quadraticCurveTo(vx + 4, s + vl / 2, vx, s + vl); x.stroke(); }
    x.restore();
}
// background (decorative) wall tile: darker, no collision
function drawBackTile(x, T, tx, ty, seed) {
    const r = seeded(seed);
    x.save(); x.translate(tx * TS, ty * TS);
    x.fillStyle = T.body[1]; x.globalAlpha = 0.55; x.fillRect(0, 0, TS, TS);
    x.globalAlpha = 0.25; x.fillStyle = '#000'; if (r() < 0.5) x.fillRect(r() * 24, r() * 24, 8, 8);
    x.restore();
}
function drawOneWay(x, T, tx, ty) {
    x.save(); x.translate(tx * TS, ty * TS);
    const g = x.createLinearGradient(0, 0, 0, 10); g.addColorStop(0, T.plat); g.addColorStop(1, T.rim);
    x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(0, 0, TS, 9, 3) : x.rect(0, 0, TS, 9); x.fill();
    x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(2, 1, TS - 4, 2);
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(TS / 2, 2); x.lineTo(TS / 2, 8); x.stroke();
    x.restore();
}

// ---------- glow sprites (pre-rendered, drawn with 'lighter') ----------
const GLOW = {};
function glowSprite(color, size = 128) {
    const k = color + size; if (GLOW[k]) return GLOW[k];
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color); g.addColorStop(0.25, color.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.45) + ')')); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, size, size); return (GLOW[k] = c);
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

// ---------- sprites ----------
const Sprites = {
    lumi(x, p, t) {
        const sx = p.sx, sy = p.sy, f = p.face;
        x.save(); x.translate(p.x, p.y + 13 - 13 * sy + 1); x.scale(sx, sy);
        // flame tuft
        const fl = Math.sin(t * 14) * 2, fl2 = Math.cos(t * 11) * 2;
        x.fillStyle = '#ffb347';
        x.beginPath(); x.moveTo(-7, -6); x.quadraticCurveTo(-8 + fl, -20, -1 - f * 3 + fl2, -27 - Math.abs(p.vy) * 0.008); x.quadraticCurveTo(3 + fl, -16, 7, -6); x.closePath(); x.fill();
        x.fillStyle = '#ffe9a8'; x.beginPath(); x.moveTo(-4, -6); x.quadraticCurveTo(-4 + fl2, -15, -f * 2, -20); x.quadraticCurveTo(2 + fl, -12, 4, -6); x.closePath(); x.fill();
        // body
        const g = x.createRadialGradient(-3, -3, 1, 0, 0, 13); g.addColorStop(0, '#fffdf0'); g.addColorStop(0.55, '#ffe29a'); g.addColorStop(1, '#ffae42');
        x.fillStyle = g; x.beginPath(); x.ellipse(0, 0, 12, 12.5, 0, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,140,40,.35)'; x.beginPath(); x.ellipse(0, 6, 9, 5, 0, 0, Math.PI); x.fill();
        // eyes look where Lumi is going
        const blink = (Math.sin(t * 0.9 + p.blinkSeed) > 0.985) ? 0.15 : 1, lx = f * 3 + clamp(p.vx / 140, -1.5, 1.5), ly = clamp(p.vy / 500, -2, 2);
        x.fillStyle = '#2a1a3a';
        x.beginPath(); x.ellipse(-4.2 + lx, -1 + ly, 2.3, 3.4 * blink, 0, 0, 7); x.fill();
        x.beginPath(); x.ellipse(4.2 + lx, -1 + ly, 2.3, 3.4 * blink, 0, 0, 7); x.fill();
        if (blink > 0.5) { x.fillStyle = '#fff'; x.beginPath(); x.arc(-3.4 + lx, -2.4 + ly, 0.9, 0, 7); x.arc(5 + lx, -2.4 + ly, 0.9, 0, 7); x.fill(); }
        x.fillStyle = 'rgba(255,120,120,.45)'; x.beginPath(); x.ellipse(-7.5 + lx * 0.6, 3, 2.4, 1.3, 0, 0, 7); x.ellipse(7.5 + lx * 0.6, 3, 2.4, 1.3, 0, 0, 7); x.fill();
        if (p.hurtT > 0 && Math.floor(t * 20) % 2) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(-14, -30, 28, 44); }
        x.restore();
    },
    slime(x, e, t, T) {
        const wob = Math.sin(t * 8 + e.seed) * 1.5, squish = e.squash || 0;
        x.save(); x.translate(e.x, e.y + 10);
        const w = 15 + wob * 0.5 + squish * 6, h = 15 - wob * 0.5 - squish * 8;
        const g = x.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, T.slime[0]); g.addColorStop(1, T.slime[1]);
        x.fillStyle = g; x.beginPath(); x.moveTo(-w, 0); x.bezierCurveTo(-w, -h * 1.2, w, -h * 1.2, w, 0); x.closePath(); x.fill();
        x.fillStyle = 'rgba(255,255,255,.45)'; x.beginPath(); x.ellipse(-w * 0.4, -h * 0.6, 3, 2, -0.5, 0, 7); x.fill();
        x.fillStyle = '#1c1028'; const ex = e.dir * 3;
        x.beginPath(); x.ellipse(-4 + ex, -h * 0.45, 1.8, 2.6, 0, 0, 7); x.ellipse(4 + ex, -h * 0.45, 1.8, 2.6, 0, 0, 7); x.fill();
        x.restore();
    },
    bat(x, e, t) {
        const fl = Math.sin(t * 18 + e.seed);
        x.save(); x.translate(e.x, e.y);
        x.fillStyle = '#3a2452';
        for (const s of [-1, 1]) { x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(s * 10, -10 - fl * 8, s * 20, -4 - fl * 10); x.quadraticCurveTo(s * 14, 0, s * 18, 4 - fl * 4); x.quadraticCurveTo(s * 9, 2, 0, 4); x.fill(); }
        x.fillStyle = '#5a3a7a'; x.beginPath(); x.ellipse(0, 0, 8, 7, 0, 0, 7); x.fill();
        x.beginPath(); x.moveTo(-6, -4); x.lineTo(-5, -11); x.lineTo(-2, -5); x.moveTo(6, -4); x.lineTo(5, -11); x.lineTo(2, -5); x.fill();
        x.fillStyle = '#ff5a6a'; x.beginPath(); x.arc(-3, -1, 1.6, 0, 7); x.arc(3, -1, 1.6, 0, 7); x.fill();
        x.restore();
    },
    thorn(x, e, t, T) {
        x.save(); x.translate(e.x, e.y + 12);
        const step = Math.sin(t * 10 + e.seed) * 1.2;
        x.fillStyle = '#2a1a1a'; x.fillRect(-10, -3 + step, 4, 3); x.fillRect(6, -3 - step, 4, 3);
        x.fillStyle = T.deco === 'forge' ? '#b8481c' : '#6a5a8a';
        for (let i = -4; i <= 4; i++) { const a = -Math.PI / 2 + i * 0.32; x.beginPath(); x.moveTo(Math.cos(a - 0.12) * 11, -4 + Math.sin(a - 0.12) * 11); x.lineTo(Math.cos(a) * 20, -4 + Math.sin(a) * 20); x.lineTo(Math.cos(a + 0.12) * 11, -4 + Math.sin(a + 0.12) * 11); x.fill(); }
        const g = x.createRadialGradient(-3, -10, 1, 0, -4, 14); g.addColorStop(0, T.deco === 'forge' ? '#ff9a4a' : '#9a8ac0'); g.addColorStop(1, T.deco === 'forge' ? '#7a2a10' : '#3a2a5a');
        x.fillStyle = g; x.beginPath(); x.ellipse(0, -4, 13, 10, 0, Math.PI, 0); x.fill(); x.fillRect(-13, -5, 26, 3);
        x.fillStyle = '#fff2a0'; x.beginPath(); x.arc(e.dir * 8, -7, 2, 0, 7); x.fill();
        x.restore();
    },
    turret(x, e, t, T) {
        x.save(); x.translate(e.x, e.y + 16);
        const open = e.charge || 0;
        x.fillStyle = '#2e6a3a'; x.fillRect(-3, -14, 6, 14);
        x.fillStyle = '#3f8a4a'; x.beginPath(); x.ellipse(-8, -6, 7, 3, -0.4, 0, 7); x.ellipse(8, -6, 7, 3, 0.4, 0, 7); x.fill();
        x.translate(0, -18); x.rotate(e.aim || 0);
        const g = x.createRadialGradient(0, 0, 1, 0, 0, 11); g.addColorStop(0, '#ff9ad0'); g.addColorStop(1, '#a8306a'); x.fillStyle = g;
        x.beginPath(); x.ellipse(0, 0, 10, 9, 0, 0, 7); x.fill();
        x.fillStyle = '#2a0a1a'; x.beginPath(); x.ellipse(8, 0, 2 + open * 4, 2 + open * 4, 0, 0, 7); x.fill();
        if (open > 0.3) { x.fillStyle = `rgba(255,220,120,${open})`; x.beginPath(); x.arc(8, 0, open * 3, 0, 7); x.fill(); }
        x.restore();
    },
    orb(x, b, t) { x.save(); x.translate(b.x, b.y); x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(0, 0, 5, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(-1.5, -1.5, 2, 0, 7); x.fill(); x.restore(); },
    shadowOrb(x, b, t) { x.save(); x.translate(b.x, b.y); const g = x.createRadialGradient(0, 0, 1, 0, 0, 10); g.addColorStop(0, '#1a0a2a'); g.addColorStop(0.7, '#5a2a9a'); g.addColorStop(1, 'rgba(160,100,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 10, 0, 7); x.fill(); x.restore(); },
    lantern(x, e, t, T) {
        x.save(); x.translate(e.x, e.y + 16);
        x.fillStyle = '#2a1e2a'; x.fillRect(-2, -40, 4, 40); x.fillRect(-7, -2, 14, 3);
        x.strokeStyle = '#2a1e2a'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(0, -40); x.quadraticCurveTo(10, -44, 12, -36); x.stroke();
        x.translate(12, -30);
        const lit = e.lit, fl = lit ? 1 + Math.sin(t * 9 + e.seed) * 0.08 : 0;
        x.fillStyle = '#3a2a3a'; x.fillRect(-7, -9, 14, 3); x.fillRect(-6, 8, 12, 3);
        x.fillStyle = lit ? '#ffe9a8' : 'rgba(140,140,170,.35)'; x.fillRect(-5.5, -6, 11, 14);
        if (lit) { x.fillStyle = '#ff9f45'; x.beginPath(); x.ellipse(0, 3, 2.6 * fl, 5 * fl, 0, 0, 7); x.fill(); x.fillStyle = '#fffbe6'; x.beginPath(); x.ellipse(0, 4, 1.2, 2.4, 0, 0, 7); x.fill(); }
        x.strokeStyle = '#3a2a3a'; x.lineWidth = 1.5; x.strokeRect(-5.5, -6, 11, 14); x.beginPath(); x.moveTo(0, -6); x.lineTo(0, 8); x.stroke();
        x.restore();
    },
    gate(x, e, t, T) {
        x.save(); x.translate(e.x, e.y + 16);
        x.fillStyle = T.rim; x.beginPath(); x.moveTo(-26, 0); x.lineTo(-26, -46); x.arc(0, -46, 26, Math.PI, 0); x.lineTo(26, 0); x.lineTo(18, 0); x.lineTo(18, -46); x.arc(0, -46, 18, 0, Math.PI, true); x.lineTo(-18, 0); x.closePath(); x.fill();
        x.fillStyle = T.accent; x.globalAlpha = 0.9; for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6; x.beginPath(); x.arc(Math.cos(a) * 22, -46 + Math.sin(a) * 22, 2, 0, 7); x.fill(); } x.globalAlpha = 1;
        x.save(); x.beginPath(); x.moveTo(-18, 0); x.lineTo(-18, -46); x.arc(0, -46, 18, Math.PI, 0); x.lineTo(18, 0); x.closePath(); x.clip();
        const g = x.createRadialGradient(0, -30, 2, 0, -30, 40); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, rgba(T.accent, 0.9)); g.addColorStop(1, rgba(T.accent, 0.15)); x.fillStyle = g; x.fillRect(-20, -70, 40, 72);
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { x.beginPath(); for (let a = 0; a < 7; a += 0.2) { const rr = a * 2.6 + i * 3, px = Math.cos(a + t * 2 + i) * rr, py = -30 + Math.sin(a + t * 2 + i) * rr; a === 0 ? x.moveTo(px, py) : x.lineTo(px, py); } x.stroke(); }
        x.restore(); x.restore();
    },
    spark(x, e, t) {
        const b = Math.sin(t * 3 + e.seed) * 2.5, s = 1 + Math.sin(t * 6 + e.seed) * 0.1;
        x.save(); x.translate(e.x, e.y + b); x.rotate(t * 1.5 + e.seed); x.scale(s, s);
        x.fillStyle = '#ffd36b'; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 0); x.lineTo(0, 7); x.lineTo(-5, 0); x.closePath(); x.fill();
        x.fillStyle = '#fffbe6'; x.beginPath(); x.moveTo(0, -4); x.lineTo(2.5, 0); x.lineTo(0, 4); x.lineTo(-2.5, 0); x.closePath(); x.fill();
        x.restore();
    },
    moth(x, e, t) {
        const fl = Math.abs(Math.sin(t * 12 + e.seed)), by = Math.sin(t * 2 + e.seed) * 4;
        x.save(); x.translate(e.x, e.y + by);
        x.fillStyle = 'rgba(160,240,255,.85)';
        for (const s of [-1, 1]) { x.save(); x.scale(s * (0.3 + fl * 0.7), 1); x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(6, -14, 16, -10, 13, 0); x.bezierCurveTo(16, 8, 6, 10, 0, 2); x.fill(); x.restore(); }
        x.fillStyle = '#fff'; x.beginPath(); x.ellipse(0, 0, 2, 6, 0, 0, 7); x.fill();
        x.strokeStyle = '#d8fbff'; x.lineWidth = 1; x.beginPath(); x.moveTo(-1, -5); x.quadraticCurveTo(-4, -10, -6, -10); x.moveTo(1, -5); x.quadraticCurveTo(4, -10, 6, -10); x.stroke();
        x.restore();
    },
    spring(x, e, t, T) {
        const k = e.boing || 0;
        x.save(); x.translate(e.x, e.y + 16);
        x.fillStyle = '#e8d8c0'; x.fillRect(-4, -8 + k * 4, 8, 8 - k * 4);
        const g = x.createLinearGradient(0, -20, 0, -8); g.addColorStop(0, '#ff7ab8'); g.addColorStop(1, '#c03a7a');
        x.fillStyle = g; x.beginPath(); x.ellipse(0, -10 + k * 5, 14 + k * 3, 8 - k * 3, 0, Math.PI, 0); x.fill(); x.fillRect(-14 - k * 3, -11 + k * 5, 28 + k * 6, 2);
        x.fillStyle = '#ffe0f0'; for (const dx of [-7, 0, 7]) { x.beginPath(); x.arc(dx, -14 + k * 6, 1.8, 0, 7); x.fill(); }
        x.restore();
    },
    key(x, e, t) {
        x.save(); x.translate(e.x, e.y + Math.sin(t * 3) * 3); x.rotate(Math.sin(t * 2) * 0.2);
        x.strokeStyle = '#ffd36b'; x.lineWidth = 3; x.beginPath(); x.arc(-5, 0, 5, 0, 7); x.moveTo(0, 0); x.lineTo(11, 0); x.moveTo(8, 0); x.lineTo(8, 4); x.moveTo(11, 0); x.lineTo(11, 5); x.stroke();
        x.restore();
    },
    door(x, d, t, T) {
        x.save(); x.translate(d.x, d.y);
        const g = x.createLinearGradient(0, 0, TS, 0); g.addColorStop(0, '#6a4a2a'); g.addColorStop(0.5, '#8a6a3a'); g.addColorStop(1, '#5a3a1a');
        x.fillStyle = g; x.fillRect(2, 0, TS - 4, d.h * TS);
        x.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < d.h; i++) x.fillRect(2, i * TS + TS - 3, TS - 4, 3);
        x.fillStyle = '#ffd36b'; x.beginPath(); x.arc(TS / 2, d.h * TS / 2, 5, 0, 7); x.fill(); x.fillStyle = '#3a2a1a'; x.fillRect(TS / 2 - 1.2, d.h * TS / 2 - 1, 2.4, 6);
        x.restore();
    },
    shrine(x, e, t, T) {
        x.save(); x.translate(e.x, e.y + 16);
        x.fillStyle = T.rim; x.fillRect(-16, -10, 32, 10); x.fillRect(-11, -16, 22, 6);
        const glow = e.used ? 0.25 : 1, by = Math.sin(t * 2) * 4;
        x.globalAlpha = glow; x.fillStyle = '#bff7ff'; x.translate(0, -34 + by); x.rotate(t * 0.8);
        x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? 5 : 12; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill();
        x.restore();
    },
    crumble(x, c, t, T) {
        x.save(); x.translate(c.x + (c.shake ? (Math.random() - 0.5) * 3 : 0), c.y);
        const g = x.createLinearGradient(0, 0, 0, TS); g.addColorStop(0, T.plat); g.addColorStop(1, T.rim);
        x.globalAlpha = c.alpha; x.fillStyle = g; x.fillRect(1, 0, TS - 2, TS - 4);
        x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(6, 0); x.lineTo(12, 12); x.lineTo(8, 22); x.moveTo(22, 0); x.lineTo(18, 10); x.lineTo(26, 20); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(2, 1, TS - 4, 2);
        x.restore();
    },
    mover(x, m, t, T) {
        x.save(); x.translate(m.x, m.y);
        const g = x.createLinearGradient(0, 0, 0, 14); g.addColorStop(0, T.plat); g.addColorStop(1, T.rim);
        x.fillStyle = g; x.beginPath(); x.roundRect ? x.roundRect(0, 0, m.w, 14, 5) : x.rect(0, 0, m.w, 14); x.fill();
        x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(4, 2, m.w - 8, 2);
        x.fillStyle = T.accent; for (let i = 0; i < m.w / TS; i++) { x.globalAlpha = 0.6 + Math.sin(t * 4 + i) * 0.3; x.beginPath(); x.arc(TS / 2 + i * TS, 9, 2.2, 0, 7); x.fill(); }
        x.restore();
    },
    spikes(x, s, T) {
        x.save(); x.translate(s.tx * TS + TS / 2, s.ty * TS + TS / 2); x.rotate(s.rot);
        const g = x.createLinearGradient(0, 16, 0, 0); g.addColorStop(0, T.deco === 'ruins' ? '#9a8a6a' : '#5a5a7a'); g.addColorStop(1, T.deco === 'forge' ? '#ffb07a' : '#f0f0ff');
        x.fillStyle = g;
        for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-16 + i * 8, 16); x.lineTo(-12 + i * 8, 2); x.lineTo(-8 + i * 8, 16); x.fill(); }
        x.restore();
    },
    lava(x, l, t) {
        x.save(); x.translate(l.tx * TS, l.ty * TS);
        const g = x.createLinearGradient(0, 0, 0, TS); g.addColorStop(0, '#ffcf5a'); g.addColorStop(0.3, '#ff6a1a'); g.addColorStop(1, '#a01a0a');
        x.fillStyle = g;
        if (l.top) { x.beginPath(); x.moveTo(0, TS); x.lineTo(0, 6); for (let i = 0; i <= 8; i++) x.lineTo(i * 4, 5 + Math.sin(t * 3 + i * 0.9 + l.tx * 2) * 2.5); x.lineTo(TS, TS); x.fill(); }
        else x.fillRect(0, 0, TS, TS);
        x.restore();
    }
};
