// ==========================================
// ELEMENT LAB - tools: painting, heat gun, wind, undo, resizing the grid
// ==========================================
const TOOLS = { brush: 'Brush', line: 'Line', rect: 'Box', erase: 'Erase', heat: 'Heat', cool: 'Chill', wind: 'Wind', zap: 'Zap', use: 'Hand', pick: 'Pick' };
const TOOL_KEYS = { brush: 'B', line: 'L', rect: 'R', erase: 'E', heat: 'H', cool: 'C', wind: 'W', zap: 'Z', use: 'U', pick: 'I' };
let tool = 'brush', curEl = 1, brushR = 4;
const PAINT_DENS = [1, 1, 0.55, 0.7, 0.14, 0.05];   // by element kind (empty, solid, powder, liquid, gas, creature)

function setUser(i, e) {                           // an element placed by the player (not "made" by the simulation)
    el[i] = e; tp[i] = TINIT[e]; vr[i] = (rnd() * 16) | 0;
    const a = L0[e]; life[i] = a ? a + ((rnd() * (L1[e] - a + 1)) | 0) : 0;
    aux[i] = AUX0[e]; st[i] = 0; pr[i] = 0;
    if (DIRL[e]) life[i] = SETTINGS.dir & 3;
    if (e === ID.human) { tp[i] = 37; if (el[i - P] === 0 && i - P > P) { el[i - P] = ID.head; tp[i - P] = 37; vr[i - P] = vr[i]; life[i - P] = 0; aux[i - P] = 0; } aux[i] = rnd() < 0.5 ? 1 : 0; }
}
function circleCells(cx, cy, r, fn) {
    const sq = SETTINGS.shape === 'square', r2 = r * r + r * 0.6 + 0.3;
    for (let dy = -r; dy <= r; dy++) {
        const y = cy + dy; if (y < 0 || y >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
            const x = cx + dx; if (x < 0 || x >= W || (!sq && dx * dx + dy * dy > r2)) continue;
            fn(x, y, ix(x, y));
        }
    }
}
function paintCircle(cx, cy, r, e, dens) {
    if (e === ID.fire && dens < 0.3) dens = 0.3;
    if (r <= 1 && dens < 0.6 && KIND[e] !== K.GAS && KIND[e] !== K.CREATURE) dens = 0.6;
    if (SETTINGS.shape === 'spray' && e !== 0) dens *= 0.12;
    if (e === ID.human) dens = r <= 1 ? 1 : 0.02;
    const rep = SETTINGS.replace;
    circleCells(cx, cy, r, (x, y, i) => {
        if (e === 0) { if (el[i] !== 0) { clr(i); wk(x, y); } return; }
        if (el[i] !== 0 && !rep) return;
        if (dens < 1 && rnd() > dens) return;
        setUser(i, e); wk(x, y);
    });
}
// the Hand: flip switches, turn machines, nudge things
function useAt(x, y) {
    if (!inb(x, y)) return '';
    const i = ix(x, y), e = el[i];
    if (e === ID.switch) { aux[i] ^= 1; const on = aux[i] & 1; floodSame(x, y, e, k => { aux[k] = (aux[k] & ~1) | on; }); sfx('pop', 0.5); return on ? 'Switch on' : 'Switch off'; }
    if (DIRL[e]) { const d = [3, 2, 0, 1][life[i] & 3]; floodSame(x, y, e, k => { life[k] = d; }); sfx('pop', 0.4); return DEFS[e].label + ' faces ' + DIRN[d]; }
    if (e === ID.clone || e === ID.spout) { aux[i] = 0; return DEFS[e].label + ' forgets what it copied'; }
    return '';
}
const DIRN = ['right', 'left', 'down', 'up'];
function floodSame(x, y, e, fn) {                  // a switch or machine painted as a blob acts as one
    const seen = new Set(), stack = [ix(x, y)];
    while (stack.length && seen.size < 4000) {
        const k = stack.pop();
        if (seen.has(k) || el[k] !== e) continue;
        seen.add(k); fn(k); wkI(k);
        for (let d = 0; d < 4; d++) stack.push(k + OFF[d]);
    }
}
function paintAt(cx, cy) {
    const e = tool === 'erase' ? 0 : curEl;
    paintCircle(cx, cy, brushR, e, e === 0 ? 1 : PAINT_DENS[KIND[e]]);
}
function lineCells(x0, y0, x1, y1, fn) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (let n = 0; n < 2000; n++) {
        fn(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}
function strokeTo(x0, y0, x1, y1) {                // freehand: paint along the segment, no gaps
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    const every = Math.max(1, brushR >> 1);
    let n = 0;
    lineCells(x0, y0, x1, y1, (x, y) => { if ((n++ % every) === 0 || (x === x1 && y === y1)) paintAt(x, y); });
}
function drawLine(x0, y0, x1, y1) {
    const e = tool === 'erase' ? 0 : curEl;
    lineCells(x0, y0, x1, y1, (x, y) => paintCircle(x, y, brushR, e, 1));
}
function fillRect(x0, y0, x1, y1, e, force) {
    const a = Math.max(0, Math.min(x0, x1)), b = Math.min(W - 1, Math.max(x0, x1));
    const c = Math.max(0, Math.min(y0, y1)), d = Math.min(H - 1, Math.max(y0, y1));
    const rep = SETTINGS.replace || force;
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) {
        const i = ix(x, y);
        if (e === 0) { if (el[i]) clr(i); continue; }
        if (el[i] !== 0 && !rep) continue;
        setUser(i, e);
    }
    for (let y = c; y <= d; y += 8) for (let x = a; x <= b; x += 8) wk(x, y);
    wk(b, d);
}
function heatAt(cx, cy, delta) {
    circleCells(cx, cy, brushR, (x, y, i) => {
        if (el[i] === 0) return;
        const t = tp[i] + delta;
        tp[i] = t > 4000 ? 4000 : t < -273 ? -273 : t;
        wk(x, y);
    });
}
function windAt(cx, cy, vx, vy) {
    const sx = vx > 0.3 ? 1 : vx < -0.3 ? -1 : 0, sy = vy > 0.3 ? 1 : vy < -0.3 ? -1 : 0;
    if (!sx && !sy) return;
    const pr = Math.min(1, (Math.abs(vx) + Math.abs(vy)) / 2);
    circleCells(cx, cy, brushR + 1, (x, y, i) => {
        const e = el[i], k = KIND[e];
        if (e === 0 || k < K.POWDER || k > K.GAS || rnd() > pr) return;
        const j = i + sx + sy * P;
        if (el[j] === 0) { swap(i, j); wk(x, y); wk(x + sx, y + sy); }
    });
}
function zapAt(cx, cy) { lightning(cx, cy); }

// ---------- undo (a few steps) ----------
const undoStack = [];
function snapshot() { return { w: W, h: H, el: el.slice(), tp: tp.slice(), life: life.slice(), aux: aux.slice(), vr: vr.slice() }; }
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 6) undoStack.shift(); }
function undo() {
    const s = undoStack.pop();
    if (!s || s.w !== W || s.h !== H) return false;
    el.set(s.el); tp.set(s.tp); life.set(s.life); aux.set(s.aux); vr.set(s.vr); st.fill(0); pr.fill(0);
    boomQ.length = 0; nParts = 0; wakeAll();
    return true;
}
function clearGrid() {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) clr(ix(x, y));
    boomQ.length = 0; nParts = 0; wakeAll();
}

// ---------- resize (quality change): keep the scene, nearest-cell resampled ----------
function resizeGrid(w, h) {
    if (w === W && h === H) return;
    const old = { w: W, h: H, P, el, tp, life, aux, vr };
    allocGrid(w, h);
    if (old.w) for (let y = 0; y < h; y++) {
        const oy = Math.min(old.h - 1, Math.floor(y * old.h / h));
        for (let x = 0; x < w; x++) {
            const ox = Math.min(old.w - 1, Math.floor(x * old.w / w)), o = (oy + 1) * old.P + ox + 1, i = ix(x, y);
            el[i] = old.el[o]; tp[i] = old.tp[o]; life[i] = old.life[o]; aux[i] = old.aux[o]; vr[i] = old.vr[o];
        }
    }
    undoStack.length = 0; boomQ.length = 0; nParts = 0;
}
