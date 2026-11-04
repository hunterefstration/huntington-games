// ==========================================
// ELEMENT LAB - explosions, lightning, and free-flying particles that live off the grid:
//   kind 0 ember (visual), 1 debris (lands as its element), 2 neutron, 3 electric arc (visual), 4 light beam,
//   5..10 firework colours (visual)
// Neutrons: fast ones split fissile cells rarely; moderators (water, graphite, heavy water) slow them, and slow ones
// split fuel often. Each split heats the fuel and throws out 2-3 new fast neutrons. Absorbers (control rods,
// lead, concrete) soak them up; reflectors bounce them.
// ==========================================
const boomQ = [];                                  // {x, y, r, t (ticks to go), d (chain depth of whatever set it off)}
let lastBoomTick = -9999, curDepth = 0, chainMax = 0;
const NPART = 3200, MAXNEUT = 2400;
const PX = new Float32Array(NPART), PY = new Float32Array(NPART), PVX = new Float32Array(NPART), PVY = new Float32Array(NPART);
const PE = new Uint16Array(NPART), PL = new Int16Array(NPART), PT = new Int16Array(NPART), PK = new Uint8Array(NPART);
let nParts = 0, nNeut = 0, fissionsTick = 0;
const flashes = [];                                // {x, y, r, t, max} drawn by the renderer
const bolts = [];                                  // {pts:[[x,y]...], t, c}
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
function addPart(x, y, vx, vy, e, life0, temp, kind) {
    if (nParts >= NPART) return false;
    const n = nParts++;
    PX[n] = x; PY[n] = y; PVX[n] = vx; PVY[n] = vy; PE[n] = e; PL[n] = life0; PT[n] = temp;
    PK[n] = kind === undefined ? (e ? 1 : 0) : kind;
    return true;
}
function spark(x, y, power) {                      // purely visual ember
    const a = rnd() * 6.283, s = (0.3 + rnd()) * power;
    addPart(x, y, Math.cos(a) * s, Math.sin(a) * s - 0.5, 0, 12 + ((rnd() * 22) | 0), 0, 0);
}
function emitNeutron(x, y, slow) {
    if (nNeut >= MAXNEUT) return false;
    const a = rnd() * 6.283, s = slow ? 0.45 : 1.6;
    if (addPart(x, y, Math.cos(a) * s, Math.sin(a) * s, 0, 140 + ((rnd() * 40) | 0), 0, 2)) { nNeut++; return true; }
    return false;
}
function addLight(x, y, vx, vy, heat) {
    const L = Math.sqrt(vx * vx + vy * vy) || 1;
    return addPart(x, y, vx / L, vy / L, 0, 300, heat, 4);
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
function fission(i, gx, gy) {
    const t = tp[i] + 60; tp[i] = t > 6000 ? 6000 : t;
    STAT.fission++; fissionsTick++;
    const n = rnd() < 0.5 ? 3 : 2;
    for (let k = 0; k < n; k++) emitNeutron(gx + 0.5, gy + 0.5, false);
    const e = el[i];
    if ((e === ID.uranium || e === ID.plutonium) && rnd() < 0.0003) put(i, ID.spentfuel, 0, true), tp[i] = t;
    if (rnd() < 0.02) { const j = i + OFF[(rnd() * 4) | 0]; if (el[j] === 0) put(j, ID.radiation, 0, true); }
    wk(gx, gy);
}
// returns 0 keep going, 1 absorbed/dead, 2 bounced
function neutronHit(n, gx, gy, i, e) {
    const vx = PVX[n], vy = PVY[n], sp2 = vx * vx + vy * vy, slow = sp2 < 0.5;
    if (e === HUMAN || e === HEAD) { hurtHuman(i, 2, 'rad'); return rnd() < 0.3 ? 1 : 0; }
    const f = FIS[e];
    if (f !== 0) {
        let p = (slow ? 0.3 : 0.03) * f;
        const t = tp[i];
        if (t > 600) { const k = 1 - (t - 600) / 2500; p *= k < 0.3 ? 0.3 : k; }   // hot fuel splits less (keeps it stable)
        if (rnd() < p) { fission(i, gx, gy); return 1; }
    }
    if (MOD[e] !== 0 && !slow && rnd() < 0.4) {    // moderator: slow down and scatter
        const a = rnd() * 6.283; PVX[n] = Math.cos(a) * 0.45; PVY[n] = Math.sin(a) * 0.45;
    }
    if (REFL[e] !== 0) return 2;
    if (rnd() < ABSN[e]) {
        if (e === ID.nuke) detonate(gx, gy, i, e);
        else if (e === ID.controlrod) tp[i] += 1;
        return 1;
    }
    return 0;
}
function stepParticles() {
    let neut = 0;
    for (let n = nParts - 1; n >= 0; n--) {
        const k = PK[n];
        let x = PX[n], y = PY[n], dead = false;
        if (k === 2 || k === 4) {                  // neutrons and light: straight lines, a cell at a time
            const vx = PVX[n], vy = PVY[n], sp = Math.sqrt(vx * vx + vy * vy);
            const steps = k === 4 ? 2 : Math.ceil(sp / 0.9);
            const inv = k === 4 ? 1 : 1 / steps;
            let px = x | 0, py = y | 0;
            for (let s = 0; s < steps && !dead; s++) {
                x += PVX[n] * inv; y += PVY[n] * inv;
                const gx = Math.floor(x), gy = Math.floor(y);
                if (gx < 0 || gy < 0 || gx >= W || gy >= H) { dead = true; break; }
                if (gx === px && gy === py) continue;
                const i = ix(gx, gy), e = el[i];
                if (e === 0) { px = gx; py = gy; continue; }
                if (k === 2) {
                    const r = neutronHit(n, gx, gy, i, e);
                    if (r === 1) dead = true;
                    else if (r === 2) { if (gx !== px) PVX[n] = -PVX[n]; if (gy !== py) PVY[n] = -PVY[n]; x = px + 0.5; y = py + 0.5; }
                    else { px = gx; py = gy; }
                } else {                           // light
                    if (KIND[e] === K.GAS && e !== ID.smoke || CLEAR[e] || e === ID.water || e === ID.saltwater) { px = gx; py = gy; continue; }
                    if (REFL[e]) { if (gx !== px) PVX[n] = -PVX[n]; if (gy !== py) PVY[n] = -PVY[n]; x = px + 0.5; y = py + 0.5; break; }
                    const h = PT[n];
                    if (h > 0 && !UNB[e]) { const t = tp[i] + h; tp[i] = t > 6000 ? 6000 : t; wk(gx, gy); if (e === HUMAN || e === HEAD) hurtHuman(i, h > 20 ? 6 : 1, 'burn'); }
                    dead = true;
                }
            }
            if (--PL[n] <= 0) dead = true;
            if (k === 2 && !dead) neut++;
        } else {
            const e = PE[n];
            PVY[n] += k === 1 ? 0.14 : k === 3 ? 0 : k >= 5 ? 0.03 : 0.05; PVX[n] *= 0.995;
            let nx = x + PVX[n], ny = y + PVY[n];
            const gx = nx | 0, gy = ny | 0;
            if (k !== 1) {                         // visual only
                if (--PL[n] <= 0 || gx < 0 || gx >= W || gy >= H) dead = true;
                else if (gy >= 0 && el[ix(gx, gy)] !== 0 && KIND[el[ix(gx, gy)]] !== K.GAS) dead = true;
            } else {                               // a flying bit of material: lands on the first solid thing
                if (gx < 0 || gx >= W) { PVX[n] = -PVX[n]; nx = x; }
                else if (gy >= H) { deposit(x | 0, H - 1, e, PT[n]); dead = true; }
                else if (gy >= 0 && el[ix(gx, gy)] !== 0 && KIND[el[ix(gx, gy)]] !== K.GAS) { deposit(x | 0, y | 0, e, PT[n]); dead = true; }
                else if (--PL[n] <= 0) { deposit(gx, gy < 0 ? 0 : gy, e, PT[n]); dead = true; }
            }
            x = nx; y = ny;
        }
        if (dead) {
            const l = --nParts;
            PX[n] = PX[l]; PY[n] = PY[l]; PVX[n] = PVX[l]; PVY[n] = PVY[l]; PE[n] = PE[l]; PL[n] = PL[l]; PT[n] = PT[l]; PK[n] = PK[l];
        } else { PX[n] = x; PY[n] = y; }
    }
    nNeut = neut;
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
                if (e === HUMAN) hurtHuman(i, 30, 'burn');
                continue;
            }
            const dist = Math.sqrt(d2) / r;
            if (e === 0) {
                if (rnd() < 0.5 * (1 - dist)) put(i, ID.fire, 0, true);
                else if (dist > 0.6 && rnd() < 0.08) put(i, ID.smoke, 0, true);
                continue;
            }
            if (UNB[e]) continue;
            if (e === HUMAN) { killHuman(i, i - P, 'burn'); continue; }
            if (BOOM[e] !== 0) { clr(i); queueBoom(xx, yy, BOOM[e], 2 + ((dist * r * 0.7) | 0), depth); continue; }
            const hit = (1 - dist) * 1.6 - HARD[e];
            if (rnd() < hit) {                     // broken: thrown out as debris
                const k = KIND[e];
                let pe = 0;
                if (k === K.SOLID) pe = RUB[e];
                else if (k !== K.GAS && k !== K.CREATURE && e !== ID.fire && e !== ID.spark) pe = e;
                const t = tp[i];
                clr(i);
                if (pe && rnd() < 0.75) {
                    const L = Math.sqrt(d2) || 1, sp = (1 - dist) * 3.4 * (0.6 + rnd() * 0.8) + 0.4;
                    if (!addPart(xx, yy, dx / L * sp + (rnd() - 0.5) * 0.6, dy / L * sp - 0.7, pe, 90, t > 300 ? 300 : t, 1)) put(i, ID.fire, 0, true);
                } else if (rnd() < 0.5) put(i, ID.fire, 0, true);
            } else {
                const heat = (1 - dist) * 500;
                tp[i] = Math.min(6000, tp[i] + heat);
                if (IGN[e] !== 0 && tp[i] < IGN[e] + 40 && BOOM[e] === 0 && (1 - dist) > 0.35) tp[i] = IGN[e] + 40;
            }
        }
    }
    if (r >= 15) {                                 // a nuke: fallout and a burst of neutrons
        for (let q = 0; q < r * 12; q++) {
            const a = rnd() * 6.283, d = rnd() * r * 1.3, xx = Math.round(cx + Math.cos(a) * d), yy = Math.round(cy + Math.sin(a) * d);
            if (inb(xx, yy) && el[ix(xx, yy)] === 0) put(ix(xx, yy), q & 1 ? ID.radiation : ID.plasma, 0, true);
        }
        for (let q = 0; q < 200; q++) emitNeutron(cx + 0.5, cy + 0.5, false);
    }
    for (let yy = Math.max(0, cy - R); yy <= Math.min(H - 1, cy + R); yy += 8) for (let xx = Math.max(0, cx - R); xx <= Math.min(W - 1, cx + R); xx += 8) wk(xx, yy);
    wk(cx, cy); wk(Math.min(W - 1, cx + R), Math.min(H - 1, cy + R)); wk(Math.max(0, cx - R), Math.max(0, cy - R));
}

// lightning: a jagged bolt from (sx, sy) down to row gy near column gx; it stops at the first thing it hits
function lightningFrom(gx, sy, gy) {
    let x = clamp(gx + (sy === 0 ? ((rnd() * 25) | 0) - 12 : 0), 1, W - 2);
    const pts = [[x, sy]];
    let hitY = gy;
    for (let y = sy; y <= gy; y++) {
        x += rnd() < 0.5 ? 0 : rnd() < 0.5 ? -1 : 1;
        x += (gx - x) * 0.04 > 0.5 ? 1 : (gx - x) * 0.04 < -0.5 ? -1 : 0;
        x = clamp(x, 0, W - 1);
        const i = ix(x, y);
        pts.push([x, y]);
        const b = el[i];
        if (b !== 0 && b !== ID.spark && !(KIND[b] === K.GAS && b !== ID.hydrogen && b !== ID.methane)) { hitY = y; break; }
        if (b === 0) { put(i, ID.spark, 0, true); life[i] = 5; tp[i] = 1000; wk(x, y); }
        hitY = y;
    }
    const hx = pts[pts.length - 1][0];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = hx + dx, yy = hitY + dy;
        if (xx < 0 || xx >= W || yy < 0 || yy >= H || dx * dx + dy * dy > 5) continue;
        const i = ix(xx, yy), b = el[i];
        if (b === 0) { if (dx * dx + dy * dy <= 1) { put(i, ID.spark, 0, true); life[i] = 6; } wk(xx, yy); continue; }
        if (!UNB[b]) {
            tp[i] = clamp(tp[i] + 2600, -273, 6000);
            if (BOOM[b] !== 0) detonate(xx, yy, i, b);
            else if (b === HUMAN || b === HEAD) hurtHuman(i, 100, 'shock');
        }
        wk(xx, yy);
    }
    for (let q = 0; q < 10; q++) spark(hx, hitY, 1.4);
    bolts.push({ pts, t: 7, c: 0 });
    flashes.push({ x: hx, y: hitY, r: 5, t: 0, max: 6 });
    sfx('zap', 1);
}
function lightning(gx, gy) { lightningFrom(gx, 0, gy); }
