// ==========================================
// RENDER: camera, parallax, cached terrain chunks, things, particles, then the light pass (darkness with holes cut by
// every light, at half resolution) and additive glows on top.
// ==========================================
const R = {
    cv: null, x: null, W: 0, H: 0, dpr: 1, z: 1, chunks: new Map(), chunkOrder: [], bg: null, bgFor: '', light: null, lx: null, q: 1,
    resize() {
        const q = this.q;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2) * q;
        this.W = Math.round(innerWidth * this.dpr); this.H = Math.round(innerHeight * this.dpr);
        this.cv.width = this.W; this.cv.height = this.H;
        // show about 26 tiles across (fewer on a tall narrow screen), at least 14 tall
        const z = Math.min(this.W / (26 * TS), this.H / (14 * TS)); this.z = Math.max(0.5, z);
        this.chunks.clear(); this.chunkOrder = []; this.bgFor = '';
        this.light = document.createElement('canvas'); this.light.width = Math.ceil(this.W / 2); this.light.height = Math.ceil(this.H / 2); this.lx = this.light.getContext('2d');
    }
};
const CH = 8;           // tiles per chunk side
function chunkCanvas(G, cx, cy) {
    const key = G.levelKey + ':' + cx + ':' + cy + ':' + R.z.toFixed(3);
    let c = R.chunks.get(key);
    if (c) return c;
    const L = G.L, T = WORLDS[G.world], px = Math.ceil(CH * TS * R.z);
    c = document.createElement('canvas'); c.width = c.height = px + 2;
    const x = c.getContext('2d'); x.scale(R.z, R.z); x.translate(-cx * CH * TS, -cy * CH * TS);
    const solid = solidForArt(L);
    for (let ty = cy * CH - 1; ty < cy * CH + CH + 1; ty++) for (let tx = cx * CH - 1; tx < cx * CH + CH + 1; tx++) {
        const t = tileAt(L, tx, ty);
        if (t === T_BACK) drawBackTile(x, T, tx, ty, tx * 31 + ty * 17);
    }
    for (let ty = cy * CH - 1; ty < cy * CH + CH + 1; ty++) for (let tx = cx * CH - 1; tx < cx * CH + CH + 1; tx++) {
        const t = (tx < 0 || tx >= L.w || ty < 0 || ty >= L.h) ? (tx < 0 || tx >= L.w ? T_SOLID : T_AIR) : L.tiles[ty * L.w + tx];
        if (t === T_SOLID) drawTile(x, T, tx, ty, solid, G.world, (tx * 73856093) ^ (ty * 19349663) ^ G.world);
        else if (t === T_ONEWAY) drawOneWay(x, T, tx, ty);
    }
    R.chunks.set(key, c); R.chunkOrder.push(key);
    while (R.chunkOrder.length > 40) R.chunks.delete(R.chunkOrder.shift());
    return c;
}

function render(G) {
    const x = R.x, W = R.W, H = R.H, z = R.z, cam = G.cam, T = WORLDS[G.world], t = G.t;
    const vw = W / z, vh = H / z;
    const sx = (G.shakeT > 0 ? (Math.random() - 0.5) * G.shakeA : 0), sy = (G.shakeT > 0 ? (Math.random() - 0.5) * G.shakeA : 0);
    const cx = cam.x - vw / 2 + sx, cy = cam.y - vh / 2 + sy;
    // background
    const bgKey = G.world + ':' + W + 'x' + H;
    if (R.bgFor !== bgKey) { R.bg = paintBackground(G.world, Math.round(W * 1.5), H); R.bgFor = bgKey; }
    x.setTransform(1, 0, 0, 1, 0, 0);
    for (const l of R.bg) {
        if (l.fixed) { x.drawImage(l.c, 0, 0); continue; }
        const bw = l.c.width, off = ((cx * z * l.k) % bw + bw) % bw, oy = clamp(-(cy - (G.L.h * TS - vh)) * z * l.k * 0.25, -H * 0.15, H * 0.25);
        x.drawImage(l.c, -off, oy); x.drawImage(l.c, bw - off, oy);
    }
    // god rays in the bright worlds
    if (G.world === 0 || G.world === 2) {
        x.save(); x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) { const rx = ((i * 0.31 + 0.1) * W - cx * z * 0.08) % (W * 1.3); x.globalAlpha = 0.05 + 0.03 * Math.sin(t * 0.4 + i);
            const g = x.createLinearGradient(rx, 0, rx - H * 0.4, H); g.addColorStop(0, G.world === 2 ? '#fffbe0' : '#ffc890'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g;
            x.beginPath(); x.moveTo(rx - 30, 0); x.lineTo(rx + 60, 0); x.lineTo(rx - H * 0.4 + 140, H); x.lineTo(rx - H * 0.4 - 80, H); x.fill(); }
        x.restore();
    }
    // world
    x.setTransform(z, 0, 0, z, -cx * z, -cy * z);
    const c0 = Math.floor(cx / (CH * TS)), c1 = Math.floor((cx + vw) / (CH * TS)), r0 = Math.floor(cy / (CH * TS)), r1 = Math.floor((cy + vh) / (CH * TS));
    // lava glows behind
    for (const l of G.L.lava) if (l.tx * TS > cx - TS && l.tx * TS < cx + vw + TS && l.ty * TS > cy - TS && l.ty * TS < cy + vh + TS) Sprites.lava(x, l, t);
    for (let cy2 = r0; cy2 <= r1; cy2++) for (let cx2 = c0; cx2 <= c1; cx2++) {
        if (cx2 < -1 || cy2 < -1 || cx2 * CH > G.L.w + 1 || cy2 * CH > G.L.h + 1) continue;
        x.drawImage(chunkCanvas(G, cx2, cy2), cx2 * CH * TS, cy2 * CH * TS, (CH * TS * z + 2) / z, (CH * TS * z + 2) / z);
    }
    const vis = (px, py, m = 64) => px > cx - m && px < cx + vw + m && py > cy - m && py < cy + vh + m;
    for (const s of G.L.spikes) if (vis(s.tx * TS, s.ty * TS)) Sprites.spikes(x, s, T);
    for (const c of G.L.crumbles) if (c.state !== 3 && vis(c.x, c.y)) Sprites.crumble(x, c, t, T);
    for (const d of G.L.doors) if (vis(d.x, d.y, 200)) { x.save(); x.translate(0, -d.slide * d.h * TS); x.beginPath(); x.rect(d.x, d.y + d.slide * d.h * TS, TS, d.h * TS); x.clip(); Sprites.door(x, d, t, T); x.restore(); }
    for (const m of G.L.movers) if (vis(m.x, m.y, 200)) Sprites.mover(x, m, t, T);
    for (const e of G.L.ents) {
        if (e.gone || !vis(e.x, e.y)) continue;
        const f = { spark: 'spark', moth: 'moth', lantern: 'lantern', gate: 'gate', spring: 'spring', key: 'key', shrine: 'shrine', slime: 'slime', bat: 'bat', turret: 'turret', thorn: 'thorn', npc: 'npc' }[e.kind];
        if (!f) continue;
        if (e.dying !== undefined) {          // stomped: flattened into the ground, then it pops
            const k = clamp(e.dying / 0.22, 0, 1), fy = e.y + 14;
            x.save(); x.translate(e.x, fy); x.scale(1 + (1 - k) * 0.7, 0.15 + k * 0.6); x.translate(-e.x, -fy); Sprites[f](x, e, t, T); x.restore();
        } else if (e.ghost) { x.save(); x.globalAlpha = 0.4; Sprites[f](x, e, t, T); x.restore(); } else Sprites[f](x, e, t, T);
    }
    if (G.boss) drawBoss(x, G, t);
    if (G.guard) drawGuard(x, G, t);
    for (const b of G.shots) b.shadow ? Sprites.shadowOrb(x, b, t) : b.style ? drawGShot(x, b, t) : Sprites.orb(x, b, t);
    // dash after-images
    for (const g of G.ghosts) { x.save(); x.globalAlpha = g.life / 0.22 * 0.45; x.globalCompositeOperation = 'lighter'; Sprites.lumi(x, { x: g.x, y: g.y, sx: g.sx, sy: g.sy, face: g.face, vx: 0, vy: 0, blinkSeed: 0, hurtT: 0 }, t); x.restore(); }
    mpDraw(x, t);
    const P = G.p;
    if (P.spawnT > 0) {      // arriving: a beam of light and you pop into being
        const a = clamp(P.spawnT / 0.75, 0, 1), g = x.createLinearGradient(0, P.y - 400, 0, P.y + 16); g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(1, `rgba(255,240,200,${a * 0.7})`);
        x.fillStyle = g; x.fillRect(P.x - 14 * a - 4, P.y - 400, (14 * a + 4) * 2, 416);
    }
    if (!P.dead && !(P.hurtT > 0 && Math.floor(t * 16) % 2 && P.hurtT < 1.1)) {
        let k = 1, rot = 0;
        if (P.spawnT > 0) { const u = 1 - clamp(P.spawnT / 0.75, 0, 1); k = u < 0.6 ? u / 0.6 * 1.25 : 1.25 - (u - 0.6) / 0.4 * 0.25; }
        if (G.outro) { k = Math.max(0, 1 - G.outro.t / 0.9); rot = G.outro.t * 9; }
        if (k > 0) { if (k !== 1 || rot) { x.save(); x.translate(P.x, P.y); x.rotate(rot); x.scale(k, k); x.translate(-P.x, -P.y); Sprites.lumi(x, P, t); x.restore(); } else Sprites.lumi(x, P, t); }
    }
    // particles
    for (const q of G.parts) {
        if (!vis(q.x, q.y, 20)) continue;
        const a = clamp(q.life / q.max, 0, 1);
        x.globalAlpha = a; x.fillStyle = q.color;
        if (q.add) { x.globalCompositeOperation = 'lighter'; }
        if (q.sq) x.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
        else if (q.star) star5(x, q.x, q.y, q.size);
        else { x.beginPath(); x.arc(q.x, q.y, q.size * (q.add ? a * 0.6 + 0.4 : 1), 0, 7); x.fill(); }
        x.globalCompositeOperation = 'source-over';
    }
    x.globalAlpha = 1;
    for (const r of G.rings) { x.strokeStyle = r.color; x.globalAlpha = r.life / 0.35; x.lineWidth = 3; x.beginPath(); x.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, 7); x.stroke(); }
    x.globalAlpha = 1;
    // ambient motes drifting in the air
    for (const m of G.motes) { const mx = ((m.x - cx * m.k) % vw + vw) % vw + cx, my = ((m.y + Math.sin(t * m.s + m.p) * 20 - cy * m.k) % vh + vh) % vh + cy;
        x.globalAlpha = 0.35 + 0.35 * Math.sin(t * m.s * 2 + m.p); x.fillStyle = T.mote; x.beginPath(); x.arc(mx, my, m.r, 0, 7); x.fill(); }
    x.globalAlpha = 1;
    // lights
    lightPass(G, cx, cy, vw, vh);
    // flashes, vignette
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (G.flash > 0) { x.fillStyle = `rgba(255,80,80,${G.flash * 0.5})`; x.fillRect(0, 0, W, H); }
    if (G.white > 0) { x.fillStyle = `rgba(255,250,230,${G.white})`; x.fillRect(0, 0, W, H); }
    if (!R.vig || R.vig.width !== W || R.vig.height !== H) {
        R.vig = document.createElement('canvas'); R.vig.width = W; R.vig.height = H; const v = R.vig.getContext('2d');
        const g = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,10,.55)');
        v.fillStyle = g; v.fillRect(0, 0, W, H);
    }
    x.drawImage(R.vig, 0, 0);
    // the iris: opens on you when a level starts, closes on the gate when you finish
    let ir = null;
    if (G.outro) ir = { x: G.outro.x, y: G.outro.y, k: 1 - clamp((G.outro.t - 0.45) / 0.85, 0, 1) };
    else if (G.iris < 1) ir = { x: P.x, y: P.y, k: 1 - Math.pow(1 - G.iris, 3) };
    if (ir && ir.k < 1) {
        const sx = (ir.x - cx) * z, sy = (ir.y - cy) * z, rr = Math.hypot(W, H) * ir.k;
        x.fillStyle = '#05030a'; x.beginPath(); x.rect(0, 0, W, H); x.arc(sx, sy, rr, 0, Math.PI * 2, true); x.fill();
        if (rr > 1) { x.strokeStyle = 'rgba(255,220,150,.55)'; x.lineWidth = 3 * R.dpr; x.beginPath(); x.arc(sx, sy, rr, 0, Math.PI * 2); x.stroke(); }
    }
}

function lightPass(G, cx, cy, vw, vh) {
    const T = WORLDS[G.world], z = R.z, lx = R.lx, LW = R.light.width, LH = R.light.height, k = LW / R.W, t = G.t;
    const amb = G.ambient ?? T.ambient;
    const lights = [], sparkL = [];
    const add = (x, y, r, a = 1, color) => { if (x > cx - r && x < cx + vw + r && y > cy - r && y < cy + vh + r) lights.push({ x, y, r, a, color }); };
    const p = G.p;
    if (!p.dead) add(p.x, p.y, (amb > 0.5 ? 210 : 150) * (1 + Math.sin(t * 7) * 0.03 + (p.dashT > 0 ? 0.25 : 0)), 1, '255,200,120');
    for (const e of G.L.ents) {
        if (e.gone) continue;
        if (e.kind === 'lantern') add(e.x + 12, e.y - 14, e.lit ? 240 + Math.sin(t * 9 + e.seed) * 8 : 40, e.lit ? 1 : 0.5, '255,190,100');
        else if (e.kind === 'gate') add(e.x, e.y - 14, 190, 1, '255,230,160');
        else if (e.kind === 'spark') { if (amb > 0.5) sparkL.push([e.x, e.y]); }
        else if (e.kind === 'moth') add(e.x, e.y, e.got !== undefined ? 200 : 90, 0.9, '255,230,150');
        else if (e.kind === 'npc') add(e.x, e.y - 8, 90, 0.7, '255,225,180');
        else if (e.kind === 'shrine' && !e.used) add(e.x, e.y - 30, 140, 1, '160,240,255');
        else if (e.kind === 'key') add(e.x, e.y, 60, 0.7, '255,210,120');
        else if (e.kind === 'turret') add(e.x, e.y - 16, 50 + (e.charge || 0) * 40, 0.6, '255,140,190');
    }
    // small lights: only the nearest dozen (each one costs a draw)
    const near = (a, b) => Math.abs(a[0] - p.x) + Math.abs(a[1] - p.y) - Math.abs(b[0] - p.x) - Math.abs(b[1] - p.y);
    sparkL.sort(near).slice(0, 12).forEach(([sx, sy]) => add(sx, sy, 46, 0.6, '255,210,120'));
    const lavaL = []; let lastTx = -9;
    for (const l of G.L.lava) if (l.top && l.tx * TS > cx - 80 && l.tx * TS < cx + vw + 80 && l.tx - lastTx >= 2) { lavaL.push([l.tx * TS + 16, l.ty * TS + 8]); lastTx = l.tx; }
    lavaL.sort(near).slice(0, 12).forEach(([lx2, ly2]) => add(lx2, ly2, 110, 0.9, '255,110,30'));
    for (const b of G.shots) add(b.x, b.y, b.shadow ? 40 : 60, 0.8, b.light || (b.shadow ? '170,110,255' : '255,210,120'));
    const B = G.guard; if (B && B.state !== 'gone') add(B.x, B.y, B.open || B.state === 'free' ? 240 : 150, 1, B.state === 'free' ? '255,240,200' : B.D.light);
    if (G.boss) add(G.boss.x, G.boss.y, G.boss.stun > 0 ? 260 : 140, 1, G.boss.stun > 0 ? '255,240,200' : '170,110,255');
    if (amb > 0.02) {
        lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, LW, LH);
        lx.fillStyle = T.dark + amb + ')'; lx.fillRect(0, 0, LW, LH);
        lx.globalCompositeOperation = 'destination-out';
        const hole = holeSprite();
        for (const L of lights) {
            const sx = (L.x - cx) * z * k, sy = (L.y - cy) * z * k, r = L.r * z * k;
            lx.globalAlpha = L.a; lx.drawImage(hole, sx - r, sy - r, r * 2, r * 2);
        }
        lx.globalAlpha = 1;
        R.x.setTransform(1, 0, 0, 1, 0, 0); R.x.drawImage(R.light, 0, 0, R.W, R.H);
    }
    // soft coloured glow on top (the "bloom")
    const x = R.x; x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'lighter';
    for (const L of lights) {
        if (L.r < 45) continue;
        const spr = glowSprite(`rgba(${L.color},0.5)`), s = L.r * z * 0.9 * (0.5 + amb * 0.6);
        x.globalAlpha = 0.28 + amb * 0.3; x.drawImage(spr, (L.x - cx) * z - s / 2, (L.y - cy) * z - s / 2, s, s);
    }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
}

// one soft disc, stamped for every light (much cheaper than a new gradient per light per frame)
let _hole = null;
function holeSprite() {
    if (_hole) return _hole;
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return (_hole = c);
}
