// ==========================================
// ELEMENT LAB - humans: two cells tall (a body with a head on top). The body does the thinking.
//   life[body] = health (0..100). aux[body]: bit 0 facing right, bits 1..7 panic timer, bits 8..15 carried element (+1).
//   They walk, climb one-cell steps, avoid fire/lava/acid, run from danger, carry small things, and die into a body,
//   blood and bones (burned, poisoned, frozen, electrocuted, crushed or irradiated).
// ==========================================
const HUMAN = ID.human, HEAD = ID.head;
const passable = b => b === 0 || (KIND[b] === K.GAS && !DANGER[b]);
const scary = (k) => { const b = el[k]; return DANGER[b] !== 0 || tp[k] > 75 || (BLIFE[b] !== 0 && life[k] !== 0 && KIND[b] !== K.CREATURE); };
const CARRY = new Uint8Array(NE);
['sand', 'dirt', 'salt', 'coal', 'gravel', 'seed', 'apple', 'bread', 'egg', 'potato', 'meat', 'charcoal', 'sawdust', 'ash', 'snow', 'flour', 'sugar', 'kernel', 'rust'].forEach(n => { CARRY[ID[n]] = 1; });

function hurtHuman(j, dmg, cause) {               // j may be the head or the body
    const b = el[j] === HEAD && el[j + P] === HUMAN ? j + P : j;
    if (el[b] !== HUMAN) { if (el[b] === HEAD) killHuman(b, b, cause); return; }
    const h = life[b] - dmg;
    if (h <= 0) killHuman(b, b - P, cause); else { life[b] = h; aux[b] |= 120 << 1; }
}
function killHuman(i, hd, cause) {
    STAT.deaths++;
    const x = i % P - 1, y = ((i / P) | 0) - 1;
    const burnt = cause === 'burn' || cause === 'lava';
    const carried = aux[i] >> 8;
    if (cause === 'freeze') put(i, ID.ice, 0, true);
    else if (cause === 'lava') put(i, ID.bone, 0, true);
    else put(i, ID.body, 0, true);
    if (el[hd] === HEAD) put(hd, burnt ? ID.bone : rnd() < 0.5 ? ID.blood : ID.bone, 0, true);
    if (!burnt && cause !== 'freeze') for (let d = 0; d < 4; d++) { const k = i + OFF[d]; if (el[k] === 0 && rnd() < 0.6) put(k, ID.blood, 0, true); }
    if (cause === 'shock') { tp[i] = 200; for (let q = 0; q < 6; q++) addPart(x, y, (rnd() - 0.5) * 2, -rnd() * 2, 0, 10, 0, 3); }
    if (carried > 1 && carried - 1 < NE) { const k = i - P - P; if (inb(x, y - 2) && el[k] === 0) put(k, carried - 1, 0, true); }
    wk(x, y);
}
// move the body i -> nb and the head i-P -> nb-P (the cells there must be passable or a swappable liquid)
function moveHuman(i, nb) {
    const hd = i - P, hasHead = el[hd] === HEAD;
    swap(i, nb);
    if (hasHead) swap(hd, nb - P);
    return nb;
}
function hpass(k) { const b = el[k]; return passable(b) || (KIND[b] === K.LIQUID && !DANGER[b]); }

function updHuman(i, x, y, e) {
    wk(x, y);
    const hd = i - P;
    let hasHead = el[hd] === HEAD;
    if (!hasHead && el[hd] === 0 && y > 0) { put(hd, HEAD, 0, true); hasHead = true; }
    let a = aux[i], panic = (a >> 1) & 127, dir = a & 1 ? 1 : -1;
    // ---- damage from what they touch
    let hp = life[i], cause = '';
    for (let q = 0; q < 8; q++) {
        const k = q < 4 ? i + OFF[q] : hd + OFF[q - 4], b = el[k];
        if (b === 0 || b === HUMAN || b === HEAD) continue;
        const t = tp[k];
        if (b === ID.lava || b === ID.corium || (DANGER[b] && KIND[b] === K.LIQUID && t > 400)) { hp -= 40; cause = 'lava'; }
        else if (b === ID.fire || b === ID.bluefire || b === ID.plasma || b === ID.ember) { hp -= 7; cause = 'burn'; }
        else if (b === ID.acid || b === ID.acidgas || b === ID.lye) { hp -= 4; cause = 'acid'; }
        else if (b === ID.poison || b === ID.poisongas || b === ID.chlorine || b === ID.fluorine || b === ID.so2 || b === ID.mercuryvapor) { hp -= 2; cause = 'poison'; }
        else if (b === ID.radiation) { hp -= 1; cause = 'rad'; }
        if (t > 70 && b !== ID.water) { hp -= ((t - 70) / 40) | 0; if (!cause) cause = 'burn'; }
        else if (t < -15) { hp -= 1; if (!cause) cause = 'freeze'; }
    }
    if (tp[i] > 60) { hp -= 2; cause = cause || 'burn'; } else if (tp[i] < -20) { hp -= 1; cause = cause || 'freeze'; }
    if (tp[i] !== 37 && rnd() < 0.2) tp[i] += tp[i] < 37 ? 1 : -1;   // body heat
    if (hasHead && KIND[el[hd - P]] === K.LIQUID && KIND[el[hd + 1]] === K.LIQUID && KIND[el[hd - 1]] === K.LIQUID && (tickN & 7) === 0) { hp -= 1; cause = cause || 'drown'; }
    if (hp <= 0) { killHuman(i, hd, cause); return true; }
    if (hp < 100 && !cause && (tickN & 31) === 0) hp++;
    life[i] = hp;
    // ---- falling (or sinking slowly in a liquid)
    const below = el[i + P];
    if (passable(below)) { moveHuman(i, i + P); return true; }
    if (KIND[below] === K.LIQUID && !DANGER[below] && rnd() < 0.25) { moveHuman(i, i + P); return true; }
    // ---- look around for danger every few ticks
    if (((tickN + vr[i]) & 3) === 0) {
        let dl = 99, dr = 99;
        for (let dy = -4; dy <= 3; dy++) {
            const yy = y + dy; if (yy < 0 || yy >= H) continue;
            const row = (yy + 1) * P + 1;
            for (let dx = 1; dx <= 9; dx++) {
                if (x - dx >= 0 && dx < dl && scary(row + x - dx)) dl = dx;
                if (x + dx < W && dx < dr && scary(row + x + dx)) dr = dx;
            }
        }
        if (dl < 99 || dr < 99) { panic = 90; dir = dl < dr ? 1 : dl > dr ? -1 : dir; }
    }
    if (panic > 0) panic--;
    // ---- walking
    let cur = i;
    const speed = panic > 0 ? 0.75 : 0.12;
    if (rnd() < speed) {
        if (panic === 0 && rnd() < 0.01) dir = -dir;
        const f = i + dir, fb = el[f];
        if (CARRY[fb] && (a >> 8) === 0 && panic === 0 && rnd() < 0.05) { a = (a & 255) | ((fb + 1) << 8); clr(f); }   // pick it up
        else if (hpass(f) && hpass(f - P)) {
            if (scary(f) || scary(f - P) || scary(f + P) || (passable(el[f + P]) && passable(el[f + 2 * P]) && (scary(f + 2 * P) || scary(f + 3 * P)))) dir = -dir;
            else cur = moveHuman(i, f);
        } else if (hpass(f - P) && hpass(f - 2 * P) && hpass(hd - P) && !scary(f - P) && !scary(f - 2 * P)) {
            cur = moveHuman(i, f - P);             // climb a one-cell step
        } else {
            dir = -dir;
            const c = a >> 8;                      // blocked: drop whatever we carry
            if (c && rnd() < 0.3 && el[i - dir] === 0) { put(i - dir, c - 1, 0, true); a &= 255; }
        }
    }
    aux[cur] = (a & 0xff00) | (panic << 1) | (dir > 0 ? 1 : 0);
    return true;
}
function updHead(i, x, y, e) {
    if (el[i + P] === HUMAN) return true;          // the body moves the head
    if (KIND[el[i + P]] === K.CREATURE || el[i + P] === 0) { if (el[i + P] === 0) swap(i, i + P); return true; }
    put(i, rnd() < 0.5 ? ID.bone : ID.blood, 0, true);   // a head on its own (the body was blown away)
    return true;
}
UPD[HUMAN] = updHuman;
UPD[HEAD] = updHead;
