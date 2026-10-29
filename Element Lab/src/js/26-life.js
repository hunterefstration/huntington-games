// ==========================================
// ELEMENT LAB - life: plants, seeds, ants, fireflies, fish, viruses
// ==========================================

function plantAround(j) {                          // plant cells touching cell j (4 neighbours)
    return (el[j + 1] === ID.plant) + (el[j - 1] === ID.plant) + (el[j + P] === ID.plant) + (el[j - P] === ID.plant);
}
function growTo(x, y, i, a, dx, dy) {              // try to put a new plant cell at (dx, dy) from here
    const j = i + dx + dy * P;
    if (el[j] !== 0 || plantAround(j) > 2) return false;
    put(j, ID.plant, 0, true); aux[j] = a; vr[j] = 10 + ((rnd() * 6) | 0);
    MADE[ID.plant] = 1; STAT.grown++; wk(x + dx, y + dy);
    return true;
}
function updPlant(i, x, y, e) {
    let a = aux[i];
    const d = (rnd() * 4) | 0, j = i + OFF[d], e2 = el[j];
    if (e2 === ID.water) { wk(x, y); if (rnd() < 0.12) { clr(j); a = aux[i] = a + 7 > 40 ? 40 : a + 7; } }
    else if (e2 === ID.mud) { wk(x, y); if (rnd() < 0.05) { put(j, ID.dirt, 0, true); a = aux[i] = a + 5 > 40 ? 40 : a + 5; } }
    if (a > 0 && rnd() < 0.09) {
        const r = rnd(), na = a - 1;
        let ok;
        if (r < 0.62) ok = growTo(x, y, i, na, 0, -1);
        else if (r < 0.81) ok = growTo(x, y, i, na, -1, -1);
        else if (r < 0.96) ok = growTo(x, y, i, na, 1, -1);
        else ok = growTo(x, y, i, na, rnd() < 0.5 ? -1 : 1, 0);
        if (ok) {
            aux[i] = 0; vr[i] = (rnd() * 8) | 0;
            if (na > 6 && rnd() < 0.12) growTo(x, y, i, na >> 1, rnd() < 0.5 ? -1 : 1, -1);   // a branch
        } else if (rnd() < 0.2) aux[i] = a - 1;
    }
    return false;
}
function updSeed(i, x, y, e) {
    const b = el[i + P];
    if (b === 0 || KIND[b] === K.LIQUID || KIND[b] === K.GAS) return false;
    const d = (rnd() * 4) | 0, j = i + OFF[d], e2 = el[j];
    if (e2 === ID.water || (b === ID.mud && rnd() < 0.05)) {
        if (e2 === ID.water) clr(j);
        put(i, ID.plant, 0, true); aux[i] = 14 + ((rnd() * 16) | 0); MADE[ID.plant] = 1; wk(x, y);
        return true;
    }
    return false;
}
function updAnt(i, x, y, e) {
    wk(x, y);
    const below = i + P, eb = el[below];
    if (eb === 0) { swap(i, below); return true; }
    if (KIND[eb] === K.LIQUID && eb !== ID.mud) { if (rnd() < 0.003) { put(i, ID.ash); return true; } if (rnd() < 0.3 && DENS[eb] < 1500) swap(i, below); return true; }
    if (rnd() < 0.03) aux[i] ^= 1;
    if (rnd() < 0.5) return true;
    const dir = aux[i] ? 1 : -1, f = i + dir, ef = el[f];
    if (ef === 0) { swap(i, f); }
    else if (ef === ID.plant) {
        clr(f); wk(x + dir, y); STAT.ate++;
        if (rnd() < 0.3 && CNT[ID.ant] < 150) { const b2 = i - dir; if (el[b2] === 0) put(b2, ID.ant, 0, true); }
    } else if (KIND[ef] === K.LIQUID || KIND[ef] === K.GAS) aux[i] ^= 1;
    else if (el[i - P] === 0 && el[i - P + dir] === 0) swap(i, i - P + dir);
    else if (el[i - P] === 0 && rnd() < 0.3) swap(i, i - P);
    else aux[i] ^= 1;
    return true;
}
function updFirefly(i, x, y, e) {
    wk(x, y);
    if (rnd() < 0.4) return true;
    const dx = ((rnd() * 3) | 0) - 1, dy = ((rnd() * 3) | 0) - 1 - (rnd() < 0.1 ? 1 : 0);
    const j = i + dx + dy * P;
    if (el[j] === 0) { swap(i, j); wk(x + dx, y + dy); }
    return true;
}
function updFish(i, x, y, e) {
    wk(x, y);
    let w = 0;
    for (let d = 0; d < 4; d++) { const q = el[i + OFF[d]]; if (q === ID.water || q === ID.saltwater) w++; }
    if (w === 0) {                                 // out of water: fall, then slowly give up
        if (el[i + P] === 0) { swap(i, i + P); return true; }
        if (++life[i] > 200) put(i, ID.ash);
        return true;
    }
    life[i] = 0;
    if (rnd() < 0.5) return true;
    if (rnd() < 0.03) aux[i] ^= 1;
    const dir = aux[i] ? 1 : -1, dy = rnd() < 0.25 ? (rnd() < 0.5 ? -1 : 1) : 0;
    const j = i + dir + dy * P, q = el[j];
    if (q === ID.water || q === ID.saltwater) { swap(i, j); wk(x + dir, y + dy); } else aux[i] ^= 1;
    return true;
}
function updVirus(i, x, y, e) {
    if (rnd() < 0.0008) { clr(i); return true; }
    return false;
}
UPD[ID.plant] = updPlant;
UPD[ID.seed] = updSeed;
UPD[ID.ant] = updAnt;
UPD[ID.firefly] = updFirefly;
UPD[ID.fish] = updFish;
UPD[ID.virus] = updVirus;
