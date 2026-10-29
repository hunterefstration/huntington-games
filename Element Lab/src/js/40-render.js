// ==========================================
// ELEMENT LAB - drawing: ImageData per frame, glow layer, particles, overlay effects
// ==========================================
const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
const BG_RGB = [14, 18, 30], BGC = pack(14, 18, 30);
const PAL = new Uint32Array(NE * 16);
const DYN = new Uint8Array(NE);
(function buildPalette() {
    for (let e = 1; e < NE; e++) {
        const c = DEFS[e].col, a = ALPHA[e];
        for (let s = 0; s < 16; s++) {
            const f = 1 + (s - 7.5) / 7.5 * VARY[e];
            const ch = k => { const v = Math.max(0, Math.min(255, c[k] * f)); return Math.round(BG_RGB[k] + (v - BG_RGB[k]) * a); };
            PAL[e * 16 + s] = pack(ch(0), ch(1), ch(2));
        }
    }
    DYN[ID.fire] = 1; DYN[ID.spark] = 2; DYN[ID.metal] = 3; DYN[ID.lamp] = 4; DYN[ID.lava] = 5; DYN[ID.firefly] = 6;
    DYN[ID.battery] = 7; DYN[ID.moltenmetal] = 5; DYN[ID.moltenglass] = 5;
})();
const HEATLUT = new Uint32Array(256);
(function () {
    const stops = [[-100, 50, 90, 255], [20, 25, 60, 70], [100, 220, 200, 40], [400, 255, 110, 20], [900, 255, 50, 50], [1500, 255, 255, 230]];
    for (let k = 0; k < 256; k++) {
        const t = -100 + k * 1600 / 255;
        let a = stops[0], b = stops[1];
        for (let s = 1; s < stops.length; s++) { if (t <= stops[s][0]) { a = stops[s - 1]; b = stops[s]; break; } a = stops[s - 1]; b = stops[s]; }
        const f = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
        HEATLUT[k] = pack((a[1] + (b[1] - a[1]) * f) | 0, (a[2] + (b[2] - a[2]) * f) | 0, (a[3] + (b[3] - a[3]) * f) | 0);
    }
})();
const heatColor = t => HEATLUT[clamp(((t + 100) * 255 / 1600) | 0, 0, 255)];

let cv, ctx, img, buf, gcv, gctx, gimg, gbuf, GWID = 0, GHEI = 0, gacc, ocv, octx, fr = 0;
let preview = null;                                // {type: 'line' | 'rect', x0, y0, x1, y1} drawn while dragging

function initRender() {
    cv = $('view'); cv.width = W; cv.height = H;
    ctx = cv.getContext('2d', { alpha: false });
    img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer);
    GWID = Math.max(2, W >> 2); GHEI = Math.max(2, H >> 2);
    gcv = $('glow'); gcv.width = GWID; gcv.height = GHEI; gctx = gcv.getContext('2d');
    gimg = gctx.createImageData(GWID, GHEI); gbuf = new Uint32Array(gimg.data.buffer); gacc = new Int32Array(GWID * GHEI * 3);
    ocv = $('ov'); ocv.width = W; ocv.height = H; octx = ocv.getContext('2d');
    layoutStage();
}
function layoutStage() {
    const st_ = $('stage'), wrap = $('wrap');
    if (!st_ || !W) return;
    const aw = st_.clientWidth - 8, ah = st_.clientHeight - 8;
    let s = Math.min(aw / W, ah / H);
    if (s >= 2) s = Math.floor(s * 2) / 2;
    wrap.style.width = Math.max(40, Math.floor(W * s)) + 'px'; wrap.style.height = Math.max(40, Math.floor(H * s)) + 'px';
}

function heatTint(c, t) {
    const f = Math.min(1, (t - 420) / 800);
    let r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
    r += (255 - r) * f; g += (110 + 100 * f * f - g) * f * 0.8; b *= 1 - f * 0.75;
    if (t > 1400) { const w = Math.min(0.6, (t - 1400) / 2400); r += (255 - r) * w; g += (255 - g) * w; b += (255 - b) * w; }
    return pack(r | 0, g | 0, b | 0);
}
function coldTint(c, t) {
    const f = Math.min(0.4, (-20 - t) / 250);
    const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
    return pack((r + (150 - r) * f) | 0, (g + (210 - g) * f) | 0, (b + (255 - b) * f) | 0);
}
function dynColor(code, e, i, c, x, y) {
    switch (code) {
        case 1: { const l = life[i]; return pack(255, Math.min(255, 70 + l * 4 + ((rnd() * 60) | 0)), l > 18 ? 90 + ((rnd() * 60) | 0) : 20 + ((rnd() * 30) | 0)); }
        case 2: return pack(255, 255, 150 + ((rnd() * 105) | 0));
        case 3: { const l = life[i]; if (l === 0) return c; const f = l / 4; const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; return pack((r + (130 - r) * f) | 0, (g + (225 - g) * f) | 0, (b + (255 - b) * f) | 0); }
        case 4: return life[i] > 0 ? pack(255, 246, 170) : c;
        case 5: return PAL[(e << 4) | ((vr[i] + (fr >> 3)) & 15)];
        case 6: return ((fr + vr[i] * 7) >> 4) & 1 ? pack(235, 255, 110) : c;
        case 7: return ((x + y) & 1) ? c : pack(40, 150, 80);
    }
    return c;
}

function render() {
    fr++;
    const ovl = SETTINGS.overlay, glow = SETTINGS.glow;
    if (glow) gacc.fill(0);
    for (let y = 0; y < H; y++) {
        let i = (y + 1) * P + 1, o = y * W;
        const grow = (y >> 2) * GWID;
        for (let x = 0; x < W; x++, i++, o++) {
            const e = el[i];
            if (e === 0) { buf[o] = BGC; continue; }
            const t = tp[i];
            let c = PAL[(e << 4) | (vr[i] & 15)];
            const dc = DYN[e];
            if (dc !== 0) c = dynColor(dc, e, i, c, x, y);
            if (ovl) c = heatColor(t);
            else if (SELF[e] === 0) { if (t > 420) c = heatTint(c, t); else if (t < -20) c = coldTint(c, t); }
            buf[o] = c;
            if (glow) {
                let s = GLS[e], gr = GLR[e], gg = GLG[e], gb = GLB[e];
                if (e === ID.lamp) { if (life[i] > 0) { s = 4; gr = 255; gg = 240; gb = 160; } }
                else if (s === 0 && t > 800) { s = t > 1400 ? 3 : 2; gr = 255; gg = 110; gb = 30; }
                if (s !== 0) { const gi = (grow + (x >> 2)) * 3; gacc[gi] += gr * s; gacc[gi + 1] += gg * s; gacc[gi + 2] += gb * s; }
            }
        }
    }
    for (let n = 0; n < nParts; n++) {             // flying debris and embers
        const x = PX[n] | 0, y = PY[n] | 0;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        buf[y * W + x] = PE[n] ? PAL[(PE[n] << 4) | 8] : (PL[n] > 8 ? pack(255, 225, 130) : pack(255, 120, 40));
    }
    ctx.putImageData(img, 0, 0);
    if (glow) {
        for (let k = 0, n = GWID * GHEI; k < n; k++) {
            const r = Math.min(255, gacc[k * 3] >> 4), g = Math.min(255, gacc[k * 3 + 1] >> 4), b = Math.min(255, gacc[k * 3 + 2] >> 4);
            gbuf[k] = pack(r, g, b);
        }
        gctx.putImageData(gimg, 0, 0);
    }
    gcv.style.display = glow ? '' : 'none';
    drawOverlay();
}

function drawOverlay() {
    const g = octx;
    g.clearRect(0, 0, W, H);
    if (preview) {
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1;
        if (preview.type === 'line') lineCells(preview.x0, preview.y0, preview.x1, preview.y1, (x, y) => g.fillRect(x, y, 1, 1));
        else {
            const a = Math.min(preview.x0, preview.x1), b = Math.min(preview.y0, preview.y1);
            g.strokeRect(a + 0.5, b + 0.5, Math.abs(preview.x1 - preview.x0), Math.abs(preview.y1 - preview.y0));
        }
    }
    if (SETTINGS.fx) for (let q = flashes.length - 1; q >= 0; q--) {
        const f = flashes[q], p = f.t / f.max;
        if (p >= 1) { flashes.splice(q, 1); continue; }
        const rad = f.r * (0.6 + p * 1.1);
        const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
        gr.addColorStop(0, 'rgba(255,240,200,' + (0.85 * (1 - p)).toFixed(2) + ')');
        gr.addColorStop(0.5, 'rgba(255,170,60,' + (0.45 * (1 - p)).toFixed(2) + ')');
        gr.addColorStop(1, 'rgba(255,100,20,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, rad, 0, 6.283); g.fill();
        f.t++;
    } else flashes.length = 0;
    for (let q = bolts.length - 1; q >= 0; q--) {
        const b = bolts[q];
        if (--b.t <= 0) { bolts.splice(q, 1); continue; }
        g.strokeStyle = 'rgba(230,240,255,' + (b.t / 7).toFixed(2) + ')'; g.lineWidth = 1.4;
        g.beginPath(); b.pts.forEach((p, k) => k ? g.lineTo(p[0] + 0.5, p[1] + 0.5) : g.moveTo(p[0] + 0.5, p[1] + 0.5)); g.stroke();
    }
    const stg = $('wrap');
    if (shakeT > 0 && SETTINGS.fx) { shakeT--; stg.style.transform = 'translate(' + ((rnd() - 0.5) * shakeT * 0.8).toFixed(1) + 'px,' + ((rnd() - 0.5) * shakeT * 0.8).toFixed(1) + 'px)'; }
    else if (stg.style.transform) stg.style.transform = '';
}
