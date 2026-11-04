// ==========================================
// ELEMENT LAB - behaviours: fire, steam/clouds, cloners, pipes, turbines, special blocks
// Each UPD function(i, x, y, e) returns true when the cell is gone/handled and must not move any more.
// Directional machines keep their facing (0 right, 1 left, 2 down, 3 up: the OFF order) in life[].
// ==========================================
function ignite(x, y, j, e2) {
    if (BOOM[e2] !== 0) detonate(x, y, j, e2);
    else if (BLIFE[e2] !== 0 && life[j] === 0) { life[j] = BLIFE[e2]; wk(x, y); }
    else if (e2 === ID.firework && aux[j] === 0) { aux[j] = 1; wk(x, y); }
}
function detonate(x, y, i, e) {
    const r = BOOM[e], dl = BDELAY[e];
    clr(i); wk(x, y);
    queueBoom(x, y, r, dl, -1);
}

// fire, blue fire, plasma and cold fire share one behaviour
function updFire(i, x, y, e) {
    const l = life[i] - 1;
    if (l <= 0) { if (e === ID.fire && rnd() < 0.12) put(i, ID.smoke, 0, true); else clr(i); return true; }
    life[i] = l;
    const cold = e === ID.coldfire;
    tp[i] = cold ? -180 - ((rnd() * 40) | 0) : e === ID.plasma ? 3500 + ((rnd() * 800) | 0) : e === ID.bluefire ? 1200 + ((rnd() * 400) | 0) : 650 + ((rnd() * 350) | 0);
    if (cold) return false;
    for (let d = 0; d < 4; d++) {
        const j = i + OFF[d], e2 = el[j];
        if (e2 !== 0) { const f = FLAM[e2]; if (f > 0 && rnd() < f) ignite(x + DX[d], y + DY[d], j, e2); }
    }
    return false;
}

// what a spark (or a tesla coil bolt) does to the thing next to it
function zapCell(x, y, j, e2) {
    if (e2 === ID.water || e2 === ID.saltwater) { if (rnd() < 0.06) { put(j, rnd() < 0.67 ? ID.hydrogen : ID.oxygen); wk(x, y); } return; }
    if (BOOM[e2] !== 0) { detonate(x, y, j, e2); return; }
    if (FLAM[e2] > 0 && rnd() < 0.5) { ignite(x, y, j, e2); return; }
    if (e2 === ID.human || e2 === ID.head) { hurtHuman(j, 40, 'shock'); return; }
    if (KIND[e2] === K.CREATURE && rnd() < 0.2) { put(j, ID.ash); wk(x, y); }
}
function updSpark(i, x, y, e) {
    const l = life[i] - 1;
    if (l <= 0) { clr(i); return true; }
    life[i] = l;
    for (let d = 0; d < 4; d++) { const j = i + OFF[d], e2 = el[j]; if (e2 !== 0 && e2 !== ID.spark && CONDUCT[e2] === 0) zapCell(x + DX[d], y + DY[d], j, e2); }
    return false;
}
function updHeater(i, x, y, e) { tp[i] = 900; return false; }
function updFreezer(i, x, y, e) { tp[i] = -80; return false; }
function updVoid(i, x, y, e) {
    for (let d = 0; d < 4; d++) { const j = i + OFF[d], e2 = el[j]; if (e2 !== 0 && e2 !== e && e2 !== WALL) { clr(j); wk(x + DX[d], y + DY[d]); } }
    return false;
}
function updDrain(i, x, y, e) {
    for (let d = 0; d < 4; d++) { const j = i + OFF[d], e2 = el[j]; if (FLUID[e2] && e2 !== 0) { clr(j); wk(x + DX[d], y + DY[d]); } }
    return false;
}
function learnClone(i, e) {                        // copy what it touches; loose things (liquids, powders) win over solid walls
    let c = 0;
    for (let d = 0; d < 4; d++) {
        const e2 = el[i + OFF[d]];
        if (e2 !== 0 && e2 !== e && e2 !== ID.void && e2 !== WALL && e2 !== ID.clone && e2 !== ID.spout && ELC[e2] === 0 && e2 !== PIPE && (c === 0 || (KIND[c] === K.SOLID && KIND[e2] !== K.SOLID))) c = e2;
    }
    return c;
}
function updClone(i, x, y, e) {
    const c = aux[i];
    if (c === 0) { aux[i] = learnClone(i, e); return false; }
    if (rnd() < 0.6) {
        const d = (rnd() * 4) | 0, j = i + OFF[d];
        if (el[j] === 0) { put(j, c, 0, true); wk(x + DX[d], y + DY[d]); }
    }
    return false;
}
// a spout pours in one direction, and also pushes gas out of the way (so it can refill a steam-filled boiler)
function updSpout(i, x, y, e) {
    const c = aux[i];
    if (c === 0) { aux[i] = learnClone(i, e); return false; }
    if (rnd() < 0.5) {
        const d = life[i] & 3, j = i + OFF[d], b = el[j];
        if (b === 0 || (KIND[b] === K.GAS && KIND[c] !== K.GAS)) { put(j, c, 0, true); wk(x + DX[d], y + DY[d]); }
    }
    return false;
}
function updNitro(i, x, y, e) {
    const b = el[i + P];
    if (b === 0 || (FLUID[b] && DENS[b] < DENS[e])) { if (aux[i] < 30) aux[i]++; }
    else { if (aux[i] > 3) { detonate(x, y, i, e); return true; } aux[i] = 0; }
    return false;
}
function updSmoke(i, x, y, e) {
    if (--life[i] <= 0) { clr(i); return true; }
    return false;
}
// steam carries latent heat (life): it stays at 100 C while that lasts, then condenses gradually below 97 C
function updSteam(i, x, y, e) {
    let t = tp[i];
    if (t < 100 && life[i] > 0) { const d = 100 - t, l = life[i]; if (l > d) { life[i] = l - d; tp[i] = t = 100; } else { life[i] = 0; tp[i] = t = t + l; } }
    if (t < 97 && rnd() < (97 - t) * 0.006) {
        if (y < H * 0.3 && rnd() < 0.4) put(i, ID.cloud, 0, false), aux[i] = 25;
        else put(i, ID.water);
        tp[i] = 90;
        return true;
    }
    return false;
}
function updCloud(i, x, y, e) {
    const a = aux[i];
    if (a > 0) {
        if (rnd() < (e === ID.stormcloud ? 0.012 : 0.006)) {
            const j = i + P;
            if (el[j] === 0) {
                const cold = tp[i] < 0 || e === ID.snowcloud;
                put(j, e === ID.acidcloud ? ID.acid : cold ? ID.snow : ID.water, 0, true); tp[j] = cold ? -5 : 15;
                aux[i] = a - 1; STAT.rain++; wk(x, y + 1);
            }
        }
        if (e === ID.stormcloud && rnd() < 0.0004) { let gy = y + 1; while (gy < H - 1 && el[ix(x, gy)] === 0) gy++; lightningFrom(x, y + 1, gy); }
    } else if (rnd() < 0.01) { clr(i); return true; }
    return false;
}
function updTorch(i, x, y, e) {
    tp[i] = 400;
    if (rnd() < 0.3 && el[i - P] === 0) { put(i - P, ID.fire, 0, true); wk(x, y - 1); }
    return false;
}
function updCandle(i, x, y, e) {
    if (rnd() < 0.12 && el[i - P] === 0 && el[i + P] !== 0) { put(i - P, ID.fire, 0, true); life[i - P] = 4; wk(x, y - 1); }
    return false;
}
function updEmber(i, x, y, e) {
    if (--life[i] <= 0) { put(i, ID.ash, 0, true); tp[i] = 200; return true; }
    tp[i] = 700;
    const d = (rnd() * 4) | 0, j = i + OFF[d], e2 = el[j];
    if (e2 !== 0 && FLAM[e2] > 0 && rnd() < FLAM[e2] * 0.5) ignite(x + DX[d], y + DY[d], j, e2);
    return false;
}
function updSun(i, x, y, e) {
    tp[i] = 3000;
    if (rnd() < 0.02) { const a = rnd() * 6.283; addLight(x + 0.5, y + 0.5, Math.cos(a), Math.sin(a), 6); }
    return false;
}
function updNeutronEl(i, x, y, e) { clr(i); emitNeutron(x + 0.5, y + 0.5, false); return true; }
function updLightEl(i, x, y, e) { clr(i); const a = rnd() * 6.283; addLight(x + 0.5, y + 0.5, Math.cos(a), Math.sin(a), 4); return true; }
function updRadiation(i, x, y, e) {
    if (--life[i] <= 0) { clr(i); return true; }
    const j = i + OFF[(rnd() * 4) | 0], b = el[j];
    if (b !== 0 && LIVING[b] && rnd() < 0.02) {
        if (b === ID.human || b === ID.head) hurtHuman(j, 8, 'rad');
        else if (KIND[b] === K.CREATURE) put(j, ID.body);
        else put(j, ID.deadplant);
    }
    return false;
}
function updBubble(i, x, y, e) {
    if (--life[i] <= 0) { clr(i); return true; }
    return false;
}
function updAntimatter(i, x, y, e) {
    for (let d = 0; d < 4; d++) {
        const j = i + OFF[d], b = el[j];
        if (b !== 0 && b !== e && !UNB[b]) {
            const jx = x + DX[d], jy = y + DY[d];
            clr(j); put(i, ID.plasma, 0, true); tp[i] = 5000;
            flashes.push({ x: jx, y: jy, r: 3, t: 0, max: 6 });
            if (rnd() < 0.08) queueBoom(jx, jy, 2, 1, -1);
            wk(jx, jy); sfx('zap', 0.4);
            return true;
        }
    }
    return false;
}
function updBlackhole(i, x, y, e) {
    for (let k = 0; k < 6; k++) {                  // pull a few random cells one step closer
        const dx = ((rnd() * 29) | 0) - 14, dy = ((rnd() * 29) | 0) - 14;
        if (dx === 0 && dy === 0) continue;
        const sx = x + dx, sy = y + dy;
        if (!inb(sx, sy)) continue;
        const s = ix(sx, sy), b = el[s];
        if (b === 0 || UNB[b]) continue;
        const mx = dx > 0 ? -1 : dx < 0 ? 1 : 0, my = dy > 0 ? -1 : dy < 0 ? 1 : 0;
        const t = s + mx + my * P;
        if (t === i) { clr(s); wk(sx, sy); continue; }
        if (el[t] === 0) { swap(s, t); wk(sx, sy); wk(sx + mx, sy + my); }
    }
    for (let d = 0; d < 4; d++) { const j = i + OFF[d], b = el[j]; if (b !== 0 && !UNB[b]) clr(j); }
    return false;
}
function updFirework(i, x, y, e) {
    let a = aux[i];
    if (a === 0) { if (tp[i] >= 200) a = aux[i] = 1; else return false; }
    wk(x, y);
    if (a > 25 + (vr[i] & 15)) {                   // burst
        clr(i);
        const hue = (rnd() * 6) | 0;
        for (let q = 0; q < 26; q++) { const ang = rnd() * 6.283, sp = 0.6 + rnd() * 1.4; addPart(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, 0, 20 + ((rnd() * 20) | 0), 0, 5 + ((hue + (q & 1)) % 6)); }
        flashes.push({ x, y, r: 5, t: 0, max: 8 }); sfx('pop', 1);
        return true;
    }
    aux[i] = a + 1;
    if (y > 1) {                                   // fly up two cells a tick, leaving sparks
        for (let k = 0; k < 2; k++) {
            const up = i - P, b = el[up];
            if (b === 0 || KIND[b] === K.GAS) { if (b) clr(up); swap(i, up); if (el[i] === 0 && rnd() < 0.5) put(i, ID.fire, 0, true); i = up; y--; wk(x, y); }
            else { aux[i] = 99; break; }
        }
    }
    return true;
}
function updLandmine(i, x, y, e) {
    for (let d = 0; d < 4; d++) { const b = el[i + OFF[d]]; if (KIND[b] === K.CREATURE) { detonate(x, y, i, e); return true; } }
    const ul = el[i - P - 1], ur = el[i - P + 1];
    if (KIND[ul] === K.CREATURE || KIND[ur] === K.CREATURE) { detonate(x, y, i, e); return true; }
    return false;
}

// ---------- pipes: aux = contents (low 10 bits) | (side it came from + 1) << 10 ----------
const isPipe = b => b === PIPE || b === VALVE;
function updPipe(i, x, y, e) {
    const a = aux[i], c = a & 1023;
    if (e === VALVE && pw[i] === 0) return true;
    const s = (rnd() * 4) | 0;
    if (c === 0) {                                 // empty: an open end sucks in a liquid or gas
        let np = 0;
        for (let d = 0; d < 4; d++) if (isPipe(el[i + OFF[d]])) np++;
        if (np <= 1) for (let k = 0; k < 4; k++) {
            const d = (s + k) & 3, j = i + OFF[d], b = el[j];
            if (b !== 0 && !isPipe(b) && st[j] !== stamp && ((KIND[b] === K.LIQUID && el[j + P] !== 0) || (KIND[b] === K.GAS && pr[j] > 40))) {   // pooled liquid, crowded gas
                aux[i] = b | ((d + 1) << 10); tp[i] = (tp[i] + tp[j]) >> 1; clr(j); wk(x + DX[d], y + DY[d]); wk(x, y);
                break;
            }
        }
        return true;
    }
    wk(x, y);
    const from = (a >> 10) - 1;
    let np = 0;
    for (let k = 0; k < 4; k++) {                  // pass it along to an empty pipe (never straight back)
        const d = (s + k) & 3;
        if (d === from) continue;
        const j = i + OFF[d], b = el[j];
        if (!isPipe(b)) continue;
        np++;
        if ((aux[j] & 1023) === 0 && st[j] !== stamp && (b !== VALVE || pw[j] !== 0)) {
            aux[j] = c | (((d ^ 1) + 1) << 10); tp[j] = (tp[i] * 3 + tp[j]) >> 2; aux[i] = 0; st[j] = stamp;
            wk(x + DX[d], y + DY[d]);
            return true;
        }
    }
    if (np === 0) for (let k = 0; k < 4; k++) {    // the far end: let it out (downwards first for liquids)
        const d = k === 0 ? 2 : k === 3 ? 3 : (s & 1) ? k - 1 : 2 - k;
        if (d === from) continue;
        const j = i + OFF[d];
        if (el[j] === 0) { put(j, c, 0, true); tp[j] = tp[i]; aux[i] = 0; wk(x + DX[d], y + DY[d]); return true; }
    }
    return true;
}

// ---------- turbine: hot gas pushed through it spins it (aux = spin); spinning turbines are power sources ----------
function updTurbine(i, x, y, e) {
    let s = aux[i];
    const j = i + P, b = el[j];                    // steam from below goes out the top
    if (KIND[b] === K.GAS && tp[j] > 90) {
        const o = i - P;
        const q = el[o];
        if (q === 0 || (FLUID[q] && !(KIND[q] === K.GAS && tp[o] > 90))) { swap(j, o); tp[o] -= 8; s += 12; wk(x, y - 1); wk(x, y + 1); }   // condensate above drops through
        else s += pr[j] > 90 ? 3 : 1;
    } else {
        const d = rnd() < 0.5 ? 0 : 1, js = i + OFF[d], bs = el[js];   // or from one side to the other
        if (KIND[bs] === K.GAS && tp[js] > 90) { const o = i - OFF[d]; if (el[o] === 0) { swap(js, o); tp[o] -= 10; s += 8; wk(x - DX[d], y); } }
    }
    const l = el[i - 1] === e ? aux[i - 1] : 0, r = el[i + 1] === e ? aux[i + 1] : 0, m = (l > r ? l : r) - 2;
    if (m > s) s = m;                              // a row of turbines is one rotor
    s = s > 255 ? 255 : s > 0 && (tickN & 1) ? s - 1 : s;
    aux[i] = s;
    if (s > 20) STAT.turbine++;
    return false;
}

UPD[ID.fire] = updFire; UPD[ID.bluefire] = updFire; UPD[ID.plasma] = updFire; UPD[ID.coldfire] = updFire;
UPD[ID.spark] = updSpark;
UPD[ID.heater] = updHeater;
UPD[ID.freezer] = updFreezer;
UPD[ID.void] = updVoid;
UPD[ID.drain] = updDrain;
UPD[ID.clone] = updClone;
UPD[ID.spout] = updSpout;
UPD[ID.nitro] = updNitro;
UPD[ID.smoke] = updSmoke;
UPD[ID.steam] = updSteam;
UPD[ID.cloud] = updCloud; UPD[ID.stormcloud] = updCloud; UPD[ID.snowcloud] = updCloud; UPD[ID.acidcloud] = updCloud;
UPD[ID.torch] = updTorch;
UPD[ID.candle] = updCandle;
UPD[ID.ember] = updEmber;
UPD[ID.sun] = updSun;
UPD[ID.neutron] = updNeutronEl;
UPD[ID.light] = updLightEl;
UPD[ID.radiation] = updRadiation;
UPD[ID.bubble] = updBubble;
UPD[ID.antimatter] = updAntimatter;
UPD[ID.blackhole] = updBlackhole;
UPD[ID.firework] = updFirework;
UPD[ID.landmine] = updLandmine;
UPD[ID.pipe] = updPipe; UPD[ID.valve] = updPipe;
UPD[ID.turbine] = updTurbine;
function updNoble(i, x, y, e) { if (life[i] > 0) life[i]--; return false; }
UPD[ID.neon] = updNoble; UPD[ID.argon] = updNoble;
// fuel keeps heating itself after splitting (decay heat in aux). Water carries it away; a dry core melts.
function updFuel(i, x, y, e) {
    const a = aux[i];
    if (a !== 0) { tp[i] += (a >> 8) + (rnd() < (a & 255) / 256 ? 1 : 0); aux[i] = a - (a >> 9) - 1; }
    return false;
}
UPD[ID.uranium] = updFuel; UPD[ID.plutonium] = updFuel; UPD[ID.thorium] = updFuel; UPD[ID.spentfuel] = updFuel;
