// ==========================================
// ELEMENT LAB - explosions, flying debris/sparks (particles), lightning
// ==========================================
const boomQ = [];                                  // {x, y, r, t (ticks to go), d (chain depth of whatever set it off)}
let lastBoomTick = -9999, curDepth = 0, chainMax = 0;
const NPART = 700;
const PX = new Float32Array(NPART), PY = new Float32Array(NPART), PVX = new Float32Array(NPART), PVY = new Float32Array(NPART);
const PE = new Uint8Array(NPART), PL = new Int16Array(NPART), PT = new Int16Array(NPART);
let nParts = 0;
const flashes = [];                                // {x, y, r, t, max} drawn by the renderer
const bolts = [];                                  // {pts:[[x,y]...], t}
let shakeT = 0;

// d = -1: work it out (a blast soon after another one counts as part of its chain)
function queueBoom(x, y, r, delay, d) {
    if (d < 0) d = (tickN - lastBoomTick < 90) ? curDepth : 0;
    boomQ.push({ x, y, r, t: delay < 1 ? 1 : delay, d });
}
function runBooms() {
    for (let q = boomQ.length - 1; q >= 0; q--) {
        const b = boomQ[q];
        if (--b.t > 0) continue;
        boomQ.splice(q, 1);
        explode(b.x, b.y, b.r, b.d + (b.r >= 4 ? 1 : 0));
    }
}
function addPart(x, y, vx, vy, e, life0, temp) {
    if (nParts >= NPART) return false;
    const n = nParts++;
    PX[n] = x; PY[n] = y; PVX[n] = vx; PVY[n] = vy; PE[n] = e; PL[n] = life0; PT[n] = temp;
    return true;
}
function spark(x, y, power) {                      // purely visual ember
    const a = rnd() * 6.283, s = (0.3 + rnd()) * power;
    addPart(x, y, Math.cos(a) * s, Math.sin(a) * s - 0.5, 0, 12 + ((rnd() * 22) | 0), 0);
}
function deposit(x, y, e, temp) {                  // a flying bit lands: put it in the nearest free cell above/around
    for (let k = 0; k < 8; k++) {
        const yy = y - k;
        if (yy < 0 || yy >= H || x < 0 || x >= W) continue;
        for (let s = 0; s < 3; s++) {
            const xx = x + (s === 0 ? 0 : s === 1 ? -1 : 1);
            if (xx < 0 || xx >= W) continue;
            const i = ix(xx, yy);
            if (el[i] === 0) { put(i, e, 0, true); tp[i] = temp; wk(xx, yy); return true; }
        }
    }
    return false;
}
function stepParticles() {
    for (let n = nParts - 1; n >= 0; n--) {
        const e = PE[n], x = PX[n], y = PY[n];
        PVY[n] += e ? 0.14 : 0.05; PVX[n] *= 0.995;
        let nx = x + PVX[n], ny = y + PVY[n], dead = false;
        const gx = nx | 0, gy = ny | 0;
        if (e === 0) {                             // visual ember
            if (--PL[n] <= 0 || gx < 0 || gx >= W || gy >= H) dead = true;
            else if (gy >= 0 && el[ix(gx, gy)] !== 0 && KIND[el[ix(gx, gy)]] !== K.GAS) dead = true;
        } else {                                   // a flying bit of material: lands on the first solid thing
            if (gx < 0 || gx >= W) { PVX[n] = -PVX[n]; nx = x; }
            else if (gy >= H) { deposit(x | 0, H - 1, e, PT[n]); dead = true; }
            else if (gy >= 0 && el[ix(gx, gy)] !== 0 && KIND[el[ix(gx, gy)]] !== K.GAS) { deposit(x | 0, y | 0, e, PT[n]); dead = true; }
            else if (--PL[n] <= 0) { deposit(gx, gy < 0 ? 0 : gy, e, PT[n]); dead = true; }
        }
        if (dead) { const l = --nParts; PX[n] = PX[l]; PY[n] = PY[l]; PVX[n] = PVX[l]; PVY[n] = PVY[l]; PE[n] = PE[l]; PL[n] = PL[l]; PT[n] = PT[l]; }
        else { PX[n] = nx; PY[n] = ny; }
    }
}

function explode(cx, cy, r, depth) {
    lastBoomTick = tickN; curDepth = depth; if (depth > chainMax) chainMax = depth;
    STAT.boomN++; STAT.chain = chainMax;
    flashes.push({ x: cx, y: cy, r, t: 0, max: 8 + r });
    shakeT = Math.min(14, 4 + r);
    sfx('boom', Math.min(1, 0.3 + r / 12));
    for (let q = 0; q < 6 + r * 2; q++) spark(cx, cy, 1.2 + r * 0.22);
    const r2 = r * r, R = Math.ceil(r * 1.4), R2 = R * R;
    for (let dy = -R; dy <= R; dy++) {
        const yy = cy + dy; if (yy < 0 || yy >= H) continue;
        for (let dx = -R; dx <= R; dx++) {
            const xx = cx + dx; if (xx < 0 || xx >= W) continue;
            const d2 = dx * dx + dy * dy; if (d2 > R2) continue;
            const i = ix(xx, yy), e = el[i];
            if (d2 > r2) {                         // the heat wave outside the blast lights flammable things
                if (e !== 0 && IGN[e] !== 0 && !UNB[e] && tp[i] < IGN[e] + 40) tp[i] = IGN[e] + 40;
                continue;
            }
            const dist = Math.sqrt(d2) / r;
            if (e === 0) {
                if (rnd() < 0.5 * (1 - dist)) put(i, ID.fire, 0, true);
                else if (dist > 0.6 && rnd() < 0.08) put(i, ID.smoke, 0, true);
                continue;
            }
            if (UNB[e]) continue;
            if (BOOM[e] !== 0) { clr(i); queueBoom(xx, yy, BOOM[e], 2 + ((dist * r * 0.7) | 0), depth); continue; }
            const hit = (1 - dist) * 1.6 - HARD[e];
            if (rnd() < hit) {                     // broken: thrown out as debris
                const k = KIND[e];
                let pe = 0;
                if (k === K.SOLID) pe = RUB[e];
                else if (k !== K.GAS && e !== ID.fire && e !== ID.spark) pe = e;
                const t = tp[i];
                clr(i);
                if (pe && rnd() < 0.75) {
                    const L = Math.sqrt(d2) || 1, sp = (1 - dist) * 3.4 * (0.6 + rnd() * 0.8) + 0.4;
                    if (!addPart(xx, yy, dx / L * sp + (rnd() - 0.5) * 0.6, dy / L * sp - 0.7, pe, 90, t > 300 ? 300 : t)) put(i, ID.fire, 0, true);
                } else if (rnd() < 0.5) put(i, ID.fire, 0, true);
            } else {
                const heat = (1 - dist) * 500;
                tp[i] = Math.min(4000, tp[i] + heat);
                if (IGN[e] !== 0 && tp[i] < IGN[e] + 40 && BOOM[e] === 0 && (1 - dist) > 0.35) tp[i] = IGN[e] + 40;
            }
        }
    }
    for (let yy = Math.max(0, cy - R); yy <= Math.min(H - 1, cy + R); yy += 8) for (let xx = Math.max(0, cx - R); xx <= Math.min(W - 1, cx + R); xx += 8) wk(xx, yy);
    wk(cx, cy); wk(Math.min(W - 1, cx + R), Math.min(H - 1, cy + R)); wk(Math.max(0, cx - R), Math.max(0, cy - R));
}

// lightning: a jagged bolt from the sky to (gx, gy); it stops at the first thing it hits
function lightning(gx, gy) {
    let x = clamp(gx + ((rnd() * 25) | 0) - 12, 1, W - 2);
    const pts = [[x, 0]];
    let hitY = gy;
    for (let y = 0; y <= gy; y++) {
        x += rnd() < 0.5 ? 0 : rnd() < 0.5 ? -1 : 1;
        x += (gx - x) * 0.04 > 0.5 ? 1 : (gx - x) * 0.04 < -0.5 ? -1 : 0;
        x = clamp(x, 0, W - 1);
        const i = ix(x, y);
        pts.push([x, y]);
        if (el[i] !== 0 && !(el[i] === ID.spark)) { hitY = y; break; }
        put(i, ID.spark, 0, true); life[i] = 5; tp[i] = 1000; wk(x, y);
        hitY = y;
    }
    const hx = pts[pts.length - 1][0];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = hx + dx, yy = hitY + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H || dx * dx + dy * dy > 5) continue;
        const i = ix(xx, yy);
        if (el[i] !== 0 && !UNB[el[i]]) {
            tp[i] = clamp(tp[i] + 2600, -273, 4000);
            if (CONDUCT[el[i]] === 1 && life[i] === 0) life[i] = 4;
            if (BOOM[el[i]] !== 0) detonate(xx, yy, i, el[i]);
        }
        wk(xx, yy);
    }
    for (let q = 0; q < 10; q++) spark(hx, hitY, 1.4);
    bolts.push({ pts, t: 7 });
    flashes.push({ x: hx, y: hitY, r: 5, t: 0, max: 6 });
    sfx('zap', 1);
}
