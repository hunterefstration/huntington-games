// ==========================================
// ELEMENT LAB - life: plants, trees, flowers, ants, fireflies, fish, birds, worms, bees, viruses
// ==========================================
const isSoil = b => b === ID.dirt || b === ID.mud || b === ID.grass || b === ID.compost || b === ID.peat || b === ID.fertilizer || b === ID.wetsand;

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
    else if (e2 === ID.fertilizer) { wk(x, y); if (rnd() < 0.05) { clr(j); a = aux[i] = a + 15 > 60 ? 60 : a + 15; } }
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
// grass: falls like a powder; once it rests on soil it grows a little and spreads along the ground
function updGrass(i, x, y, e) {
    const b = el[i + P];
    if (!isSoil(b) && b !== ID.grass) return false;
    if (rnd() < 0.01) {
        const s = rnd() < 0.5 ? -1 : 1, j = i + s, jb = j + P;     // spread sideways onto bare soil
        if (el[j] === 0 && isSoil(el[jb]) && el[jb] !== ID.grass) { put(j, ID.grass, 0, true); STAT.grown++; wk(x + s, y); }
        else if (el[j] === 0 && el[jb] === 0 && isSoil(el[jb + P])) { put(jb, ID.grass, 0, true); STAT.grown++; wk(x + s, y + 1); }
        else if (el[i - P] === 0 && isSoil(b) && rnd() < 0.3) { put(i - P, ID.grass, 0, true); wk(x, y - 1); }   // one blade tall
    }
    return true;
}
// tree seed -> trunk that grows up (aux = height left), then a crown of leaves
function updSapling(i, x, y, e) {
    const b = el[i + P];
    if (!isSoil(b)) return false;
    if (rnd() < 0.02) { put(i, ID.tree, 0, true); aux[i] = 10 + ((rnd() * 14) | 0); STAT.grown++; wk(x, y); return true; }
    return true;
}
function updTree(i, x, y, e) {
    const a = aux[i];
    if (a === 0) return false;
    if (rnd() > 0.06) return false;
    wk(x, y);
    const up = i - P;
    if (a > 1 && el[up] === 0 && y > 2) {
        put(up, ID.tree, 0, true); aux[up] = a - 1; aux[i] = 0; STAT.grown++;
        if (a > 4 && rnd() < 0.15) { const s = rnd() < 0.5 ? -1 : 1; if (el[i + s - P] === 0) { put(i + s - P, ID.tree, 0, true); aux[i + s - P] = 1; } }
        return false;
    }
    aux[i] = 0;                                    // the top: a crown of leaves
    const r = 3 + ((rnd() * 3) | 0);
    for (let dy = -r; dy <= 1; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy * 1.6 > r * r + 1 || rnd() < 0.15) continue;
        const xx = x + dx, yy = y + dy;
        if (!inb(xx, yy)) continue;
        const k = ix(xx, yy);
        if (el[k] === 0) { put(k, ID.leaves, 0, true); STAT.grown++; }
    }
    return false;
}
function updVine(i, x, y, e) {
    const a = aux[i];
    if (a === 0 || rnd() > 0.04) return false;
    wk(x, y);
    const order = rnd() < 0.7 ? [2, 0, 1, 3] : [0, 1, 2, 3];
    for (const d of order) {
        const j = i + OFF[d];
        if (el[j] !== 0) continue;
        let touch = 0;                             // vines cling: the new piece must touch something solid other than vine
        for (let q = 0; q < 4; q++) { const b = el[j + OFF[q]]; if (b !== 0 && b !== ID.vine && KIND[b] === K.SOLID) touch = 1; }
        if (!touch && d !== 2) continue;
        put(j, ID.vine, 0, true); aux[j] = a - 1; aux[i] = 0; STAT.grown++; wk(x + DX[d], y + DY[d]);
        return false;
    }
    return false;
}
function updFlowerSeed(i, x, y, e) {
    if (!isSoil(el[i + P])) return false;
    if (rnd() < 0.03) { put(i, ID.stem, 0, true); aux[i] = 3 + ((rnd() * 4) | 0); vr[i] = (rnd() * 16) | 0; wk(x, y); return true; }
    return true;
}
function updStem(i, x, y, e) {
    const a = aux[i];
    if (a === 0 || rnd() > 0.05) return false;
    const up = i - P;
    aux[i] = 0;
    if (a > 1 && el[up] === 0) { put(up, ID.stem, 0, true); aux[up] = a - 1; vr[up] = vr[i]; wk(x, y - 1); return false; }
    const col = vr[i];                             // the flower: petals in a little cross, one colour per flower
    [[0, -1], [-1, 0], [1, 0], [0, -2], [-1, -1], [1, -1]].forEach(([dx, dy]) => { const k = i + dx + dy * P; if (el[k] === 0 && inb(x + dx, y + dy)) { put(k, ID.petal, 0, true); vr[k] = col; } });
    STAT.grown += 4;
    return false;
}
function updCactus(i, x, y, e) {
    const a = aux[i];
    if (a === 0 || rnd() > 0.01) return false;
    const b = el[i + P];
    if (b !== ID.sand && b !== ID.cactus && b !== ID.redsand) { aux[i] = 0; return false; }
    if (el[i - P] === 0) { put(i - P, ID.cactus, 0, true); aux[i - P] = a - 1; aux[i] = 0; wk(x, y - 1); }
    return false;
}
function updBamboo(i, x, y, e) {
    const a = aux[i];
    if (a === 0 || rnd() > 0.03) return false;
    if (el[i - P] === 0 && y > 1) { put(i - P, ID.bamboo, 0, true); aux[i - P] = a - 1; vr[i - P] = (a & 3) === 0 ? 0 : 10; aux[i] = 0; STAT.grown++; wk(x, y - 1); }
    return false;
}
function updSpore(i, x, y, e) {
    const b = el[i + P];
    if (b === ID.wood || b === ID.dirt || b === ID.compost || b === ID.rottenmeat || b === ID.deadplant) {
        if (rnd() < 0.01) { put(i, ID.mushroom, 0, true); if (el[i - P] === 0) { put(i - P, ID.mushroom, 0, true); vr[i - P] = 15; } wk(x, y); return true; }
        return true;
    }
    return false;
}
function updAlgae(i, x, y, e) {
    let w = 0;
    for (let d = 0; d < 4; d++) { const q = el[i + OFF[d]]; if (q === ID.water || q === ID.saltwater) w++; }
    if (w === 0) { if (rnd() < 0.002) { put(i, ID.deadplant, 0, true); return true; } return false; }
    if (rnd() < 0.004 && CNT[ID.algae] < 800) { const j = i + OFF[(rnd() * 4) | 0]; if (el[j] === ID.water) { put(j, ID.algae, 0, true); STAT.grown++; } }
    if (rnd() < 0.5) return true;                  // drifts slowly
    return false;
}
function updMoss(i, x, y, e) {
    if (rnd() > 0.003) return false;
    const j = i + OFF[(rnd() * 4) | 0];
    if (el[j] !== 0) return false;
    let stone = 0, wet = 0;
    for (let d = 0; d < 4; d++) { const q = el[j + OFF[d]]; if (q === ID.stone || q === ID.brick || q === ID.concrete || q === ID.wood) stone = 1; if (q === ID.water) wet = 1; }
    if (stone && (wet || rnd() < 0.3)) { put(j, ID.moss, 0, true); STAT.grown++; wkI(j); }
    return false;
}

// ---------- creatures ----------
function updAnt(i, x, y, e) {
    wk(x, y);
    const below = i + P, eb = el[below];
    if (eb === 0) { swap(i, below); return true; }
    if (KIND[eb] === K.LIQUID && eb !== ID.mud) { if (rnd() < 0.003) { put(i, ID.ash); return true; } if (rnd() < 0.3 && DENS[eb] < 1500) swap(i, below); return true; }
    if (rnd() < 0.03) aux[i] ^= 1;
    if (rnd() < 0.5) return true;
    const dir = aux[i] ? 1 : -1, f = i + dir, ef = el[f];
    if (ef === 0) { swap(i, f); }
    else if (ef === ID.plant || ef === ID.leaves || ef === ID.sugar || ef === ID.honey) {
        clr(f); wk(x + dir, y); STAT.ate++;
        if (rnd() < 0.3 && CNT[ID.ant] < 150) { const b2 = i - dir; if (el[b2] === 0) put(b2, ID.ant, 0, true); }
    } else if (KIND[ef] === K.LIQUID || KIND[ef] === K.GAS || DANGER[ef]) aux[i] ^= 1;
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
    for (let d = 0; d < 4; d++) { const q = el[i + OFF[d]]; if (q === ID.water || q === ID.saltwater || q === ID.algae) w++; }
    if (w === 0) {                                 // out of water: fall, then slowly give up
        if (el[i + P] === 0) { swap(i, i + P); return true; }
        if (++life[i] > 200) put(i, ID.body);
        return true;
    }
    life[i] = 0;
    if (rnd() < 0.5) return true;
    if (rnd() < 0.03) aux[i] ^= 1;
    const dir = aux[i] ? 1 : -1, dy = rnd() < 0.25 ? (rnd() < 0.5 ? -1 : 1) : 0;
    const j = i + dir + dy * P, q = el[j];
    if (q === ID.algae && rnd() < 0.2) { put(j, ID.water, 0, true); STAT.ate++; }
    else if (q === ID.water || q === ID.saltwater) { swap(i, j); wk(x + dir, y + dy); } else aux[i] ^= 1;
    return true;
}
// birds fly about, glide down to land now and then, and flee heat
function updBird(i, x, y, e) {
    wk(x, y);
    if (rnd() < 0.3) return true;
    let a = aux[i];
    if (rnd() < 0.02) a ^= 1;
    const dir = a & 1 ? 1 : -1;
    const landed = el[i + P] !== 0 && KIND[el[i + P]] !== K.GAS;
    if (landed && rnd() < 0.97) {                  // resting: hop now and then
        if (rnd() < 0.05 && el[i + dir] === 0) swap(i, i + dir);
        aux[i] = a; return true;
    }
    let dy = rnd() < 0.45 ? -1 : rnd() < 0.5 ? 1 : 0;
    if (y < 4) dy = 1;
    const j = i + dir + dy * P, b = el[j];
    if (b === 0 || (KIND[b] === K.GAS && !DANGER[b])) { swap(i, j); wk(x + dir, y + dy); }
    else if (b === ID.seed || b === ID.flowerseed || b === ID.worm || b === ID.ant) { clr(j); STAT.ate++; }
    else a ^= 1;
    aux[i] = a;
    return true;
}
// worms tunnel through soil, swapping places with it
function updWorm(i, x, y, e) {
    wk(x, y);
    const b = el[i + P];
    if (b === 0 || KIND[b] === K.GAS) { swap(i, i + P); return true; }
    if (rnd() < 0.7) return true;
    const d = (rnd() * 4) | 0, j = i + OFF[d], q = el[j];
    if (isSoil(q) || q === ID.sand) {
        swap(i, j); wk(x + DX[d], y + DY[d]);
        if (q === ID.dirt && rnd() < 0.01) { el[i] = ID.compost; }
    } else if (q === 0 && d === 3) { /* do not leave the ground upwards */ }
    else if (q === ID.water && rnd() < 0.01) put(i, ID.body);
    return true;
}
// bees fly near flowers and make honey
function updBee(i, x, y, e) {
    wk(x, y);
    if (rnd() < 0.3) return true;
    const dx = ((rnd() * 3) | 0) - 1, dy = ((rnd() * 3) | 0) - 1;
    const j = i + dx + dy * P, b = el[j];
    if (b === 0) { swap(i, j); wk(x + dx, y + dy); }
    else if (b === ID.petal && rnd() < 0.05) { aux[i] = aux[i] + 1; if (aux[i] > 3) { aux[i] = 0; const k = i - dx - dy * P; if (el[k] === 0) { put(k, ID.honey, 0, true); wkI(k); } } }
    else if ((b === ID.human || b === ID.head) && rnd() < 0.05) hurtHuman(j, 2, 'sting');
    return true;
}
function updVirus(i, x, y, e) {
    if (rnd() < 0.0008) { clr(i); return true; }
    return false;
}
UPD[ID.plant] = updPlant;
UPD[ID.seed] = updSeed;
UPD[ID.grass] = updGrass;
UPD[ID.sapling] = updSapling;
UPD[ID.tree] = updTree;
UPD[ID.vine] = updVine;
UPD[ID.flowerseed] = updFlowerSeed;
UPD[ID.stem] = updStem;
UPD[ID.cactus] = updCactus;
UPD[ID.bamboo] = updBamboo;
UPD[ID.spore] = updSpore;
UPD[ID.algae] = updAlgae;
UPD[ID.moss] = updMoss;
UPD[ID.ant] = updAnt;
UPD[ID.firefly] = updFirefly;
UPD[ID.fish] = updFish;
UPD[ID.bird] = updBird;
UPD[ID.worm] = updWorm;
UPD[ID.bee] = updBee;
UPD[ID.virus] = updVirus;
