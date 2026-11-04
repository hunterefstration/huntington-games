// ==========================================
// ELEMENT LAB - drawing: ImageData per frame, glow layer, particles, overlay effects
// ==========================================
const pack = (r, g, b) => (255 << 24) | (b << 16) | (g << 8) | r;
const BG_RGB = [9, 12, 22], BGC = pack(9, 12, 22);
const PAL = new Uint32Array(NE * 16);
const DYN = new Uint8Array(NE);
const hsv = (h, s, v) => { const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return pack((f(5) * 255) | 0, (f(3) * 255) | 0, (f(1) * 255) | 0); };
const HUES = new Uint32Array(64);
for (let k = 0; k < 64; k++) HUES[k] = hsv(k / 64, 0.85, 1);
const SHIRTS = [pack(60, 110, 200), pack(200, 60, 60), pack(60, 160, 90), pack(230, 190, 60), pack(150, 80, 190), pack(240, 240, 240), pack(40, 40, 50), pack(230, 120, 40)];
const FLOWERS = [pack(240, 90, 160), pack(250, 220, 60), pack(240, 60, 60), pack(170, 110, 255), pack(255, 255, 255), pack(255, 150, 60), pack(90, 150, 255), pack(255, 130, 200)];
const FWC = [pack(255, 70, 70), pack(255, 200, 60), pack(80, 255, 120), pack(90, 160, 255), pack(220, 90, 255), pack(255, 255, 255)];
(function buildPalette() {
    for (let e = 1; e < NE; e++) {
        const c = DEFS[e].col, a = ALPHA[e];
        for (let s = 0; s < 16; s++) {
            const f = 1 + (s - 7.5) / 7.5 * VARY[e];
            const ch = k => { const v = Math.max(0, Math.min(255, c[k] * f)); return Math.round(BG_RGB[k] + (v - BG_RGB[k]) * a); };
            PAL[e * 16 + s] = pack(ch(0), ch(1), ch(2));
        }
    }
    const D = (n, code) => { DYN[ID[n]] = code; };
    D('fire', 1); D('spark', 2); D('lamp', 4); D('lava', 5); D('moltenmetal', 5); D('moltenglass', 5); D('corium', 5); D('moltensalt', 5);
    (GROUPS.molten || []).forEach(e => { DYN[e] = 5; });
    D('firefly', 6); D('battery', 7); D('led_r', 8); D('led_g', 8); D('led_b', 8); D('rainbow', 9); D('glitter', 10); D('confetti', 11);
    D('petal', 12); D('human', 13); D('neon', 14); D('argon', 14); D('pipe', 15); D('valve', 15); D('turbine', 16);
    D('and_gate', 17); D('or_gate', 17); D('not_gate', 17); D('xor_gate', 17); D('heatsensor', 17); D('pressuresensor', 17); D('sensor', 17);
    D('switch', 19); D('water', 21); D('saltwater', 21); D('heavywater', 21); D('bluefire', 22); D('plasma', 22); D('coldfire', 22);
    D('radiation', 24); D('uranium', 25); D('plutonium', 25); D('ember', 22); D('sun', 22); D('bubble', 26);
    for (let e = 1; e < NE; e++) { if (DIRL[e] && !DYN[e]) DYN[e] = 20; if (CONDUCT[e] && !DYN[e]) DYN[e] = 3; }
})();
const HEATLUT = new Uint32Array(256);
(function () {
    const stops = [[-100, 70, 60, 255], [-20, 40, 140, 255], [20, 20, 40, 70], [100, 220, 200, 40], [400, 255, 110, 20], [900, 255, 40, 40], [1600, 255, 255, 230]];
    for (let k = 0; k < 256; k++) {
        const t = -100 + k * 1700 / 255;
        let a = stops[0], b = stops[1];
        for (let s = 1; s < stops.length; s++) { if (t <= stops[s][0]) { a = stops[s - 1]; b = stops[s]; break; } a = stops[s - 1]; b = stops[s]; }
        const f = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
        HEATLUT[k] = pack((a[1] + (b[1] - a[1]) * f) | 0, (a[2] + (b[2] - a[2]) * f) | 0, (a[3] + (b[3] - a[3]) * f) | 0);
    }
})();
const heatColor = t => HEATLUT[clamp(((t + 100) * 255 / 1700) | 0, 0, 255)];
const PRLUT = new Uint32Array(256);
for (let k = 0; k < 256; k++) { const f = k / 255; PRLUT[k] = pack((40 + 215 * Math.min(1, f * 1.6)) | 0, (60 + 160 * Math.max(0, 1 - Math.abs(f - 0.5) * 2)) | 0, (200 * (1 - f)) | 0); }
const dimC = (c, f) => pack(((c & 255) * f) | 0, (((c >> 8) & 255) * f) | 0, (((c >> 16) & 255) * f) | 0);

let cv, ctx, img, buf, gcv, gctx, gimg, gbuf, GWID = 0, GHEI = 0, gacc, ocv, octx, fr = 0;
let BWID = 0, BHEI = 0, bacc;
let preview = null;                                // {type: 'line' | 'rect', x0, y0, x1, y1} drawn while dragging

function initRender() {
    cv = $('view'); cv.width = W; cv.height = H;
    ctx = cv.getContext('2d', { alpha: false });
    img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer);
    GWID = Math.max(2, W >> 2); GHEI = Math.max(2, H >> 2);
    gcv = $('glow'); gcv.width = GWID; gcv.height = GHEI; gctx = gcv.getContext('2d');
    gimg = gctx.createImageData(GWID, GHEI); gbuf = new Uint32Array(gimg.data.buffer); gacc = new Int32Array(GWID * GHEI * 3);
    BWID = Math.max(2, W >> 3); BHEI = Math.max(2, H >> 3);
    bacc = new Int32Array(BWID * BHEI * 3);
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
const mix = (c, r2, g2, b2, f) => { const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; return pack((r + (r2 - r) * f) | 0, (g + (g2 - g) * f) | 0, (b + (b2 - b) * f) | 0); };
function dynColor(code, e, i, c, x, y) {
    switch (code) {
        case 1: { const l = life[i]; return pack(255, Math.min(255, 70 + l * 4 + ((rnd() * 60) | 0)), l > 18 ? 90 + ((rnd() * 60) | 0) : 20 + ((rnd() * 30) | 0)); }
        case 2: return pack(255, 255, 150 + ((rnd() * 105) | 0));
        case 3: return pw[i] ? mix(c, 150, 235, 255, 0.55 + 0.25 * (((fr >> 1) + x + y) & 1)) : c;
        case 4: return pw[i] ? pack(255, 246, 180) : c;
        case 5: return PAL[(e << 4) | ((vr[i] + (fr >> 3)) & 15)];
        case 6: return ((fr + vr[i] * 7) >> 4) & 1 ? pack(235, 255, 110) : c;
        case 7: return ((x + y) & 1) ? c : pack(40, 150, 80);
        case 8: if (!pw[i]) return c; return e === ID.led_r ? pack(255, 90, 90) : e === ID.led_g ? pack(110, 255, 140) : pack(120, 170, 255);
        case 9: return HUES[((x + y) * 2 + (fr >> 2)) & 63];
        case 10: return ((vr[i] * 13 + (fr >> 2)) % 23) === 0 ? pack(255, 255, 255) : HUES[(vr[i] * 4) & 63];
        case 11: return HUES[(vr[i] * 4 + 2) & 63];
        case 12: return FLOWERS[vr[i] & 7];
        case 13: return el[i - P] === ID.head && ((aux[i] >> 1) & 127) > 0 && (fr & 4) ? mix(SHIRTS[vr[i] & 7], 255, 80, 80, 0.4) : SHIRTS[vr[i] & 7];
        case 14: return life[i] > 0 ? (e === ID.neon ? pack(255, 90, 170) : pack(190, 130, 255)) : c;
        case 15: { const q = aux[i] & 1023; return q ? mix(c, DEFS[q].col[0], DEFS[q].col[1], DEFS[q].col[2], 0.55) : c; }
        case 16: return aux[i] > 20 && ((x + (fr >> 1)) & 3) === 0 ? pack(240, 250, 255) : c;
        case 17: return life[i] ? mix(c, 255, 255, 255, 0.45) : dimC(c, 0.75);
        case 19: return aux[i] & 1 ? pack(90, 220, 110) : pack(120, 60, 60);
        case 20: { const d = life[i] & 3; const edge = d === 0 ? (x & 1) : d === 1 ? !(x & 1) : d === 2 ? (y & 1) : !(y & 1); return pw[i] ? mix(c, 255, 255, 255, edge ? 0.35 : 0.15) : (edge ? dimC(c, 0.8) : c); }
        case 21: return SETTINGS.noise ? PAL[(e << 4) | ((vr[i] + (fr >> 4) + (x >> 2)) & 15)] : c;
        case 22: return PAL[(e << 4) | ((vr[i] + fr) & 15)];
        case 24: return (rnd() < 0.5) ? c : pack(200, 255, 170);
        case 25: return ((fr + vr[i] * 5) & 63) < 2 ? pack(170, 255, 140) : c;
        case 26: return ((x + y + (fr >> 3)) & 7) === 0 ? pack(255, 255, 255) : c;
    }
    return c;
}

function render() {
    fr++;
    const view = SETTINGS.view, glow = SETTINGS.glow, bloom = SETTINGS.bloom && glow, noise = SETTINGS.noise;
    const vHeat = view === 'heat', vPr = view === 'pressure', vCh = view === 'charge';
    if (glow) gacc.fill(0);
    if (bloom) bacc.fill(0);
    for (let y = 0; y < H; y++) {
        let i = (y + 1) * P + 1, o = y * W;
        const grow = (y >> 2) * GWID, brow = (y >> 3) * BWID;
        for (let x = 0; x < W; x++, i++, o++) {
            const e = el[i];
            if (e === 0) { buf[o] = vPr || vCh ? pack(6, 8, 14) : BGC; continue; }
            const t = tp[i];
            let c = PAL[(e << 4) | (vr[i] & 15)];
            const dc = DYN[e];
            if (dc !== 0) c = dynColor(dc, e, i, c, x, y);
            if (vHeat) c = heatColor(t);
            else if (vPr) c = KIND[e] === K.GAS ? PRLUT[pr[i]] : dimC(c, 0.22);
            else if (vCh) c = ELC[e] !== 0 ? (pw[i] || life[i] && ELC[e] >= E_GATE ? pack(120, 240, 255) : pack(30, 70, 90)) : dimC(c, 0.2);
            else {
                if (SELF[e] === 0) { if (t > 420) c = heatTint(c, t); else if (t < -20) c = coldTint(c, t); }
                if (noise && dc === 0 && KIND[e] !== K.SOLID && ((x * 7 + y * 13 + vr[i] + (fr >> 3)) & 31) === 0) c = mix(c, 255, 255, 255, 0.08);
            }
            buf[o] = c;
            if (glow) {
                let s = GLS[e], gr = GLR[e], gg = GLG[e], gb = GLB[e];
                if (ELC[e] !== 0) {
                    if (pw[i] || (ELC[e] >= E_GATE && life[i])) {
                        if (e === ID.lamp) { s = 6; gr = 255; gg = 236; gb = 160; }
                        else if (dc === 8) s = 5;
                        else if (e === ID.eheater || e === ID.furnace) { s = e === ID.furnace ? 3 : 2; gr = 255; gg = 110; gb = 40; }
                        else if (s === 0) { s = 1; gr = 90; gg = 200; gb = 255; }
                    } else if (dc === 8 || e === ID.lamp) s = 0;
                } else if (dc === 14) s = life[i] > 0 ? 4 : 0;
                else if (e === ID.phosphorus || e === ID.magnesium) s = life[i] > 0 ? 5 : 0;
                if (s === 0 && t > 700) { s = t > 1400 ? 3 : 2; gr = 255; gg = 110; gb = 30; }
                if (s !== 0) {
                    const gi = (grow + (x >> 2)) * 3; gacc[gi] += gr * s; gacc[gi + 1] += gg * s; gacc[gi + 2] += gb * s;
                    if (bloom && s >= 3) { const bi = (brow + (x >> 3)) * 3; bacc[bi] += gr * s; bacc[bi + 1] += gg * s; bacc[bi + 2] += gb * s; }
                }
            }
        }
    }
    for (let n = 0; n < nParts; n++) {             // particles: debris, embers, neutrons, arcs, light
        const x = PX[n] | 0, y = PY[n] | 0;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const k = PK[n];
        let c;
        if (k === 1) c = PAL[(PE[n] << 4) | 8];
        else if (k === 2) { const sl = PVX[n] * PVX[n] + PVY[n] * PVY[n] < 0.5; c = sl ? pack(120, 170, 255) : pack(200, 245, 255); if (glow) { const gi = ((y >> 2) * GWID + (x >> 2)) * 3; gacc[gi] += 100; gacc[gi + 1] += 200; gacc[gi + 2] += 255; } }
        else if (k === 3) c = pack(190, 230, 255);
        else if (k === 4) { c = PT[n] > 20 ? pack(255, 90, 90) : pack(255, 255, 210); if (glow) { const gi = ((y >> 2) * GWID + (x >> 2)) * 3; gacc[gi] += 600; gacc[gi + 1] += PT[n] > 20 ? 150 : 600; gacc[gi + 2] += PT[n] > 20 ? 150 : 400; } }
        else if (k >= 5) c = FWC[(k - 5) % 6];
        else c = PL[n] > 8 ? pack(255, 225, 130) : pack(255, 120, 40);
        buf[y * W + x] = c;
    }
    ctx.putImageData(img, 0, 0);
    if (bloom) {                                   // a cheap blur on the tiny bloom buffer (two box passes), added into the glow layer
        for (let pass = 0; pass < 2; pass++) for (let y = 0; y < BHEI; y++) for (let x = 0; x < BWID; x++) {
            const k = (y * BWID + x) * 3, l = x > 0 ? k - 3 : k, r = x < BWID - 1 ? k + 3 : k, u = y > 0 ? k - BWID * 3 : k, d = y < BHEI - 1 ? k + BWID * 3 : k;
            for (let c = 0; c < 3; c++) bacc[k + c] = (bacc[k + c] * 4 + bacc[l + c] + bacc[r + c] + bacc[u + c] + bacc[d + c]) >> 3;
        }
        for (let y = 0; y < GHEI; y++) {
            const by = Math.min(BHEI - 1, y >> 1) * BWID;
            for (let x = 0; x < GWID; x++) { const k = (y * GWID + x) * 3, q = (by + Math.min(BWID - 1, x >> 1)) * 3; gacc[k] += bacc[q] >> 1; gacc[k + 1] += bacc[q + 1] >> 1; gacc[k + 2] += bacc[q + 2] >> 1; }
        }
    }
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
        g.strokeStyle = (b.c ? 'rgba(200,170,255,' : 'rgba(230,240,255,') + (b.t / 7).toFixed(2) + ')'; g.lineWidth = b.c ? 0.8 : 1.4;
        g.beginPath(); b.pts.forEach((p, k) => k ? g.lineTo(p[0] + 0.5, p[1] + 0.5) : g.moveTo(p[0] + 0.5, p[1] + 0.5)); g.stroke();
    }
    const stg = $('wrap');
    if (shakeT > 0 && SETTINGS.fx) { shakeT--; stg.style.transform = 'translate(' + ((rnd() - 0.5) * shakeT * 0.8).toFixed(1) + 'px,' + ((rnd() - 0.5) * shakeT * 0.8).toFixed(1) + 'px)'; }
    else if (stg.style.transform) stg.style.transform = '';
}
