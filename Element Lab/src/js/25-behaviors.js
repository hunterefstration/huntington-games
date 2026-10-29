// ==========================================
// ELEMENT LAB - behaviours: fire, electricity, steam/cloud, special blocks
// Each UPD function(i, x, y, e) returns true when the cell is gone/handled and must not move any more.
// ==========================================
function ignite(x, y, j, e2) {
    if (BOOM[e2] !== 0) detonate(x, y, j, e2);
    else if (BLIFE[e2] !== 0 && life[j] === 0) { life[j] = BLIFE[e2]; wk(x, y); }
}
function detonate(x, y, i, e) {
    const r = BOOM[e], dl = BDELAY[e];
    clr(i); wk(x, y);
    queueBoom(x, y, r, dl, -1);
}

function updFire(i, x, y, e) {
    const l = life[i] - 1;
    if (l <= 0) { if (rnd() < 0.12) put(i, ID.smoke, 0, true); else clr(i); return true; }
    life[i] = l;
    tp[i] = 650 + ((rnd() * 350) | 0);
    for (let d = 0; d < 4; d++) {
        const j = i + OFF[d], e2 = el[j];
        if (e2 !== 0) { const f = FLAM[e2]; if (f > 0 && rnd() < f) ignite(x + DX[d], y + DY[d], j, e2); }
    }
    return false;
}

// what a live wire / spark does to the thing next to it
function zapCell(x, y, j, e2) {
    if (CONDUCT[e2] === 1) {
        if (life[j] === 0) { life[j] = 4; st[j] = stamp; wk(x, y); if (e2 === ID.lamp) STAT.lamp++; }
        return;
    }
    if (e2 === ID.water || e2 === ID.saltwater) { if (rnd() < 0.06) { put(j, rnd() < 0.67 ? ID.hydrogen : ID.oxygen); wk(x, y); } return; }
    if (BOOM[e2] !== 0) { detonate(x, y, j, e2); return; }
    if (FLAM[e2] > 0 && rnd() < 0.5) { ignite(x, y, j, e2); return; }
    if (KIND[e2] === K.CREATURE && rnd() < 0.2) { put(j, ID.ash); wk(x, y); }
}
function updSpark(i, x, y, e) {
    const l = life[i] - 1;
    if (l <= 0) { clr(i); return true; }
    life[i] = l;
    for (let d = 0; d < 4; d++) { const j = i + OFF[d], e2 = el[j]; if (e2 !== 0 && e2 !== ID.spark) zapCell(x + DX[d], y + DY[d], j, e2); }
    return false;
}
// metal / lamp: 0 idle, 4 just charged (passes it on), 3..1 resting
function updConduct(i, x, y, e) {
    const l = life[i];
    if (l === 0) return false;
    wk(x, y);
    if (l === 4) for (let d = 0; d < 4; d++) { const j = i + OFF[d], e2 = el[j]; if (e2 !== 0) zapCell(x + DX[d], y + DY[d], j, e2); }
    life[i] = l - 1;
    return false;
}
function updBattery(i, x, y, e) {
    if ((tickN & 7) === 0) for (let d = 0; d < 4; d++) { const j = i + OFF[d], e2 = el[j]; if (e2 !== 0 && e2 !== e) zapCell(x + DX[d], y + DY[d], j, e2); }
    return false;
}
function updHeater(i, x, y, e) { tp[i] = 900; return false; }
function updFreezer(i, x, y, e) { tp[i] = -80; return false; }
function updVoid(i, x, y, e) {
    for (let d = 0; d < 4; d++) { const j = i + OFF[d], e2 = el[j]; if (e2 !== 0 && e2 !== e && e2 !== WALL) { clr(j); wk(x + DX[d], y + DY[d]); } }
    return false;
}
function updClone(i, x, y, e) {
    let c = aux[i];
    if (c === 0) {
        for (let d = 0; d < 4; d++) {              // copy what it touches; loose things (liquids, powders) win over solid walls
            const e2 = el[i + OFF[d]];
            if (e2 !== 0 && e2 !== e && e2 !== ID.void && e2 !== WALL && (c === 0 || (KIND[c] === K.SOLID && KIND[e2] !== K.SOLID))) c = e2;
        }
        aux[i] = c;
        return false;
    }
    if (rnd() < 0.6) {
        const d = (rnd() * 4) | 0, j = i + OFF[d];
        if (el[j] === 0) { put(j, c, 0, true); wk(x + DX[d], y + DY[d]); }
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
function updSteam(i, x, y, e) {
    if (tp[i] < 98) {
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
        if (rnd() < 0.006) {
            const j = i + P;
            if (el[j] === 0) { put(j, tp[i] < 0 ? ID.snow : ID.water, 0, true); tp[j] = tp[i] < 0 ? -5 : 15; aux[i] = a - 1; STAT.rain++; wk(x, y + 1); }
        }
    } else if (rnd() < 0.01) { clr(i); return true; }
    return false;
}

UPD[ID.fire] = updFire;
UPD[ID.spark] = updSpark;
UPD[ID.metal] = updConduct;
UPD[ID.lamp] = updConduct;
UPD[ID.battery] = updBattery;
UPD[ID.heater] = updHeater;
UPD[ID.freezer] = updFreezer;
UPD[ID.void] = updVoid;
UPD[ID.clone] = updClone;
UPD[ID.nitro] = updNitro;
UPD[ID.smoke] = updSmoke;
UPD[ID.steam] = updSteam;
UPD[ID.cloud] = updCloud;
