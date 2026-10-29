// ==========================================
// ELEMENT LAB - the simulation: grid, chunk sleeping, movement, heat
// The grid has a one cell wall border (stride P = W + 2) so neighbours never need bounds checks.
// ==========================================
let W = 0, H = 0, P = 0, NP = 0, CW = 0, CH = 0;
let el, tp, life, aux, vr, st, act, run;
const OFF = new Int32Array(4), DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
let tickN = 0, stamp = 1;
const CNT = new Int32Array(256);                  // cells per element (recount())
const MADE = new Uint8Array(256);                 // elements the simulation itself has made (challenges)
const STAT = { grown: 0, rain: 0, lamp: 0, infected: 0, ate: 0, alk: 0, boomN: 0, chain: 0 };
const ix = (x, y) => (y + 1) * P + x + 1;
const CHUNK = 16;

function allocGrid(w, h) {
    W = w; H = h; P = w + 2; NP = P * (h + 2); CW = (w + CHUNK - 1) >> 4; CH = (h + CHUNK - 1) >> 4;
    el = new Uint8Array(NP); tp = new Int16Array(NP).fill(AMB); life = new Uint8Array(NP); aux = new Uint8Array(NP);
    vr = new Uint8Array(NP); st = new Uint8Array(NP);
    act = new Uint8Array(CW * CH).fill(3); run = new Uint8Array(CW * CH);
    OFF[0] = 1; OFF[1] = -1; OFF[2] = P; OFF[3] = -P;
    for (let x = -1; x <= w; x++) { el[ix(x, -1)] = WALL; el[ix(x, h)] = WALL; }
    for (let y = -1; y <= h; y++) { el[ix(-1, y)] = WALL; el[ix(w, y)] = WALL; }
}

// wake the chunk holding (x, y) and any neighbour chunk it touches
function wk(x, y) {
    const cx = x >> 4, cy = y >> 4, lx = x & 15, ly = y & 15;
    const x0 = lx === 0 && cx > 0 ? cx - 1 : cx, x1 = lx === 15 && cx < CW - 1 ? cx + 1 : cx;
    const y0 = ly === 0 && cy > 0 ? cy - 1 : cy, y1 = ly === 15 && cy < CH - 1 ? cy + 1 : cy;
    for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) act[b * CW + a] = 3;
}
function wakeAll() { act.fill(3); }

function swap(i, j) {
    let t = el[i]; el[i] = el[j]; el[j] = t;
    t = tp[i]; tp[i] = tp[j]; tp[j] = t;
    t = life[i]; life[i] = life[j]; life[j] = t;
    t = aux[i]; aux[i] = aux[j]; aux[j] = t;
    t = vr[i]; vr[i] = vr[j]; vr[j] = t;
    st[i] = st[j] = stamp;
}
function clr(i) { el[i] = 0; tp[i] = AMB; life[i] = 0; aux[i] = 0; }

// a cell the simulation makes (reactions, burning, phase changes). `silent` skips the challenge bookkeeping.
function put(i, e, heat, silent) {
    el[i] = e; tp[i] = TINIT[e] + (heat || 0); vr[i] = (rnd() * 16) | 0;
    const a = L0[e]; life[i] = a ? a + ((rnd() * (L1[e] - a + 1)) | 0) : 0;
    aux[i] = AUX0[e]; st[i] = stamp;
    if (!silent) MADE[e] = 1;
}

// ---------- movement ----------
function movePowder(x, y, i, e) {
    const dn = DENS[e];
    let j = i + P, b = el[j];
    if (b === 0 || (FLUID[b] && DENS[b] < dn && rnd() < 0.55)) { swap(i, j); wk(x, y); wk(x, y + 1); return; }
    if (rnd() < SLIDE[e]) {
        const s = rnd() < 0.5 ? -1 : 1;
        j = i + P + s; b = el[j];
        if (b === 0 || (FLUID[b] && DENS[b] < dn && rnd() < 0.4)) { swap(i, j); wk(x, y); wk(x + s, y + 1); return; }
        j = i + P - s; b = el[j];
        if (b === 0 || (FLUID[b] && DENS[b] < dn && rnd() < 0.4)) { swap(i, j); wk(x, y); wk(x - s, y + 1); return; }
    }
}
function moveLiquid(x, y, i, e) {
    const mv = MOVEP[e];
    if (mv < 1 && rnd() > mv) {                    // thick liquids only act now and then; stay awake while they could move
        if (el[i + P] === 0 || el[i + P - 1] === 0 || el[i + P + 1] === 0 || el[i + 1] === 0 || el[i - 1] === 0) wk(x, y);
        return;
    }
    const dn = DENS[e];
    let j = i + P, b = el[j];
    if (b === 0 || (FLUID[b] && DENS[b] < dn && rnd() < 0.8)) { swap(i, j); wk(x, y); wk(x, y + 1); return; }
    const s = rnd() < 0.5 ? -1 : 1;
    if (el[i + P + s] === 0) { swap(i, i + P + s); wk(x, y); wk(x + s, y + 1); return; }
    if (el[i + P - s] === 0) { swap(i, i + P - s); wk(x, y); wk(x - s, y + 1); return; }
    const dsp = DISP[e];
    let last = 0, kk = 0;
    for (let k = 1; k <= dsp; k++) { if (el[i + s * k] === 0) { last = i + s * k; kk = k; } else break; }
    if (last) { swap(i, last); wk(x, y); wk(x + s * kk, y); }
}
function moveGas(x, y, i, e) {
    const mv = MOVEP[e];
    wk(x, y);
    if (mv < 1 && rnd() > mv) return;
    const dn = DENS[e];
    if (y === 0 && LEAK[e] && rnd() < 0.08) { clr(i); return; }
    let dx = ((rnd() * 3) | 0) - 1, dy = 0;
    if (rnd() < 0.6) dy = dn < 100 ? -1 : dn > 100 ? 1 : (rnd() < 0.5 ? -1 : 1);
    if (dx === 0 && dy === 0) dx = rnd() < 0.5 ? -1 : 1;
    const j = i + dx + dy * P, b = el[j];
    if (b === 0) { swap(i, j); wk(x + dx, y + dy); }
    else if (FLUID[b]) {
        const db = DENS[b];
        if (KIND[b] === K.GAS) { if (dy < 0 ? db > dn : dy > 0 ? db < dn : true) { swap(i, j); wk(x + dx, y + dy); } }
        else if (dy < 0 && db > dn && rnd() < 0.5) { swap(i, j); wk(x + dx, y + dy); }   // a bubble rising through liquid
    }
}

// ---------- phase changes ----------
function phase(i, e, to, alt, altP, thr, x, y) {
    if (alt && rnd() < altP) to = alt;
    el[i] = to; vr[i] = (rnd() * 16) | 0;
    const a = L0[to]; life[i] = a ? a + ((rnd() * (L1[to] - a + 1)) | 0) : 0;
    aux[i] = AUX0[to]; MADE[to] = 1; st[i] = stamp;
    tp[i] = thr;                                   // the excess heat is spent on the change (cheap latent heat)
    if (to === ID.steam && rnd() < 0.03) sfx('sizzle', 0.5);
    wk(x, y);
}

// ---------- burning ----------
function flame(x, y, i) {
    const d = (rnd() * 5) | 0;                     // up, up-left, up-right, left, right
    const dx = d === 1 ? -1 : d === 2 ? 1 : d === 3 ? -1 : d === 4 ? 1 : 0, dy = d < 3 ? -1 : 0;
    const j = i + dx + dy * P;
    if (el[j] === 0) { put(j, ID.fire, 0, true); wk(x + dx, y + dy); }
}
function burnStep(x, y, i, e) {
    const l = life[i] - 1;
    if (tp[i] < BTEMP[e]) tp[i] = BTEMP[e];
    wk(x, y);
    if (l <= 0) {
        const p = BPROD[e], t = tp[i];
        if (p === 0) clr(i); else { put(i, p, 0, true); tp[i] = t < 200 ? t : 200; }
        return true;
    }
    life[i] = l;
    if (rnd() < 0.3) flame(x, y, i);
    return false;
}

// ---------- one cell ----------
const UPD = new Array(NE).fill(null);
function cell(x, y, i, e) {
    let t = tp[i];
    if (t > HI[e]) { phase(i, e, HIE[e], HIA[e], HIAP[e], HI[e], x, y); return; }
    if (t < LO[e]) { phase(i, e, LOE[e], LOA[e], LOAP[e], LO[e], x, y); return; }
    const ig = IGN[e];
    if (ig !== 0 && t >= ig) {
        if (BOOM[e] !== 0) { detonate(x, y, i, e); return; }
        if (life[i] === 0 && rnd() < BIGN[e]) life[i] = BLIFE[e];
    }
    if (BLIFE[e] !== 0 && life[i] !== 0 && burnStep(x, y, i, e)) return;

    // heat and reactions with one random neighbour
    const d = (rnd() * 4) | 0, j = i + OFF[d], e2 = el[j];
    if (e2 !== 0) {
        const ri = RXI[e * NE + e2];
        if (ri >= 0) {
            wk(x, y);
            if (react(i, j, x, y, d, RXL[ri])) { e = el[i]; if (e === 0) return; t = tp[i]; }
        }
        if (DOUSE[e2] && BLIFE[e] !== 0 && life[i] !== 0) { life[i] = 0; tp[i] = 90; wk(x, y); }
        const dt = tp[j] - t;
        if (dt > 1 || dt < -1) {
            const dd = dt * (COND[e] + COND[e2]) * 0.5, a = dd < 0 ? -dd : dd;
            let n = a | 0; if (rnd() < a - n) n++;
            if (n !== 0) { if (dd < 0) n = -n; tp[i] = t + n; tp[j] -= n; wk(x, y); }
        }
    } else {
        const dt = AMB - t;
        if (dt > 1 || dt < -1) {
            const dd = dt * COOL[e], a = dd < 0 ? -dd : dd;
            let n = a | 0; if (rnd() < a - n) n++;
            if (n !== 0) { tp[i] = dd < 0 ? t - n : t + n; wk(x, y); }
        }
    }

    if (AWAKE[e] !== 0) wk(x, y);
    const u = UPD[e];
    if (u !== null && u(i, x, y, e)) return;
    const k = KIND[e];
    if (k === K.POWDER) movePowder(x, y, i, e);
    else if (k === K.LIQUID) moveLiquid(x, y, i, e);
    else if (k === K.GAS) moveGas(x, y, i, e);
}

function step() {
    tickN++; stamp = (stamp % 255) + 1;
    const flip = tickN & 1;
    for (let c = 0; c < act.length; c++) { if (act[c] > 0) { run[c] = 1; act[c]--; } else run[c] = 0; }
    if (boomQ.length) runBooms();
    if (nParts) stepParticles();
    for (let y = H - 1; y >= 0; y--) {
        const rowc = (y >> 4) * CW, base = (y + 1) * P + 1;
        for (let k = 0; k < CW; k++) {
            const cx = flip ? CW - 1 - k : k;
            if (run[rowc + cx] === 0) continue;
            const x0 = cx << 4, x1 = Math.min(W, x0 + CHUNK);
            if (flip) {
                for (let x = x1 - 1; x >= x0; x--) { const i = base + x, e = el[i]; if (e !== 0 && st[i] !== stamp) cell(x, y, i, e); }
            } else {
                for (let x = x0; x < x1; x++) { const i = base + x, e = el[i]; if (e !== 0 && st[i] !== stamp) cell(x, y, i, e); }
            }
        }
    }
}

function recount() {
    CNT.fill(0);
    for (let y = 0; y < H; y++) { let i = (y + 1) * P + 1; for (let x = 0; x < W; x++, i++) CNT[el[i]]++; }
    return CNT;
}
function activeChunks() { let n = 0; for (let c = 0; c < act.length; c++) if (act[c] > 0) n++; return n; }
