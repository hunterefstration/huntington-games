// ==========================================
// ELEMENT LAB - electricity. Every second tick:
//   1. one scan of the grid lists sources, gates, sensors and devices (a typed-array walk, a fraction of a ms)
//   2. gates and sensors decide their output from last pass's power (so gate chains settle one stage a pass)
//   3. a flood fill from every live source marks pw[] = 1 on each connected conductor (wire, metals, devices,
//      switches that are on). Anything that is not a conductor insulates.
//   4. powered devices act (bulbs, heaters, fans, pumps, pistons, conveyors, lasers...), unpowered ones rest.
// Gates: inputs are the cells left, right and above the gate (a blob of the same gate counts as one gate);
// the output is every conductor below it.
// ==========================================
let EQ = null, LS_SRC = null, LS_GATE = null, LS_DEV = null, LS_SEN = null, GMARK = null, GSTK = null;
let nSrc = 0, nGate = 0, nDev = 0, nSen = 0, poweredN = 0, elecAny = false;
function allocElectric() {
    EQ = new Int32Array(NP); LS_SRC = new Int32Array(NP); LS_GATE = new Int32Array(NP); LS_DEV = new Int32Array(NP); LS_SEN = new Int32Array(NP);
    GMARK = new Uint8Array(NP); GSTK = new Int32Array(NP);
}
const isCond = j => { const c = ELC[el[j]]; return c === E_C || c === E_DEV || c === E_SRC || (c === E_SWITCH && (aux[j] & 1) !== 0); };
const isInput = b => { const c = ELC[b]; return c === E_C || c === E_DEV || c === E_SRC || c === E_SWITCH || c === E_SENSOR; };

function solarLit(x, y) {
    for (let yy = y - 1; yy >= 0; yy--) { const b = el[ix(x, yy)]; if (b !== 0 && KIND[b] !== K.GAS && !CLEAR[b]) return false; }
    return true;
}

function electric() {
    nSrc = nGate = nDev = nSen = 0;
    for (let y = 0; y < H; y++) {                  // 1. list the electric cells
        let i = (y + 1) * P + 1;
        for (let x = 0; x < W; x++, i++) {
            const e = el[i];
            if (e === 0) continue;
            const c = ELC[e];
            if (c === 0 || c === E_C || c === E_SWITCH) continue;
            if (c === E_SRC) {
                if (e === ID.solar ? solarLit(x, y) : e === ID.turbine ? aux[i] > 20 : true) LS_SRC[nSrc++] = i;
            } else if (c === E_DEV) LS_DEV[nDev++] = i;
            else if (c === E_GATE) LS_GATE[nGate++] = i;
            else if (c === E_SENSOR) LS_SEN[nSen++] = i;
        }
    }
    if (!elecAny && nSrc + nGate + nDev + nSen === 0) return;
    elecAny = nSrc + nGate + nDev + nSen > 0;
    // 2a. sensors
    let qt = 0;
    for (let k = 0; k < nSen; k++) {
        const i = LS_SEN[k], e = el[i];
        let on = 0;
        for (let d = 0; d < 4 && !on; d++) {
            const j = i + OFF[d], b = el[j];
            if (e === ID.heatsensor) { if (b !== 0 && b !== e && tp[j] >= 100) on = 1; }
            else if (e === ID.pressuresensor) { if (KIND[b] === K.GAS && pr[j] >= 100) on = 1; }
            else if (b !== 0 && ELC[b] === 0 && b !== WALL && !isPipe(b)) on = 1;
        }
        if (e === ID.heatsensor && tp[i] >= 100) on = 1;
        life[i] = on;
    }
    // 2b. gates (from last pass's power), output seeds collected in GSTK's top half
    let nSeed = 0;
    const seeds = LS_SEN;                          // reuse: sensors are done, keep their on/off in life[]
    const sensN = nSen, sensList = LS_SEN.slice(0, sensN);
    for (let k = 0; k < nGate; k++) {
        const g = LS_GATE[k];
        if (GMARK[g]) continue;
        const type = el[g];
        let sp = 0, cn = 0;
        GSTK[sp++] = g; GMARK[g] = 1;
        let cL = 0, oL = 0, cR = 0, oR = 0, cT = 0, oT = 0;
        const comp = [];
        while (sp > 0) {
            const c = GSTK[--sp]; comp.push(c); cn++;
            for (let d = 0; d < 4; d++) { const j = c + OFF[d]; if (el[j] === type && !GMARK[j]) { GMARK[j] = 1; GSTK[sp++] = j; } }
            const l = el[c - 1], r = el[c + 1], t = el[c - P];
            if (l !== type && isInput(l)) { cL = 1; if (pw[c - 1] || (ELC[l] === E_SENSOR && life[c - 1])) oL = 1; }
            if (r !== type && isInput(r)) { cR = 1; if (pw[c + 1] || (ELC[r] === E_SENSOR && life[c + 1])) oR = 1; }
            if (t !== type) {
                if (isInput(t)) { cT = 1; if (pw[c - P] || (ELC[t] === E_SENSOR && life[c - P])) oT = 1; }
                else if (ELC[t] === E_GATE) { cT = 1; if (life[c - P]) oT = 1; }
            }
        }
        const conn = cL + cR + cT, on = oL + oR + oT;
        let out = 0;
        if (type === ID.and_gate) { out = conn > 0 && on === conn ? 1 : 0; if (out && conn >= 2) STAT.andOn++; }
        else if (type === ID.or_gate) out = on > 0 ? 1 : 0;
        else if (type === ID.not_gate) { out = on === 0 ? 1 : 0; if (conn > 0 && out) STAT.notOn++; }
        else if (type === ID.xor_gate) out = on === 1 ? 1 : 0;
        for (const c of comp) {
            life[c] = out;
            if (out) { const b = c + P; if (el[b] !== type && isCond(b)) seeds[nSeed++] = b; }
        }
    }
    for (let k = 0; k < nGate; k++) GMARK[LS_GATE[k]] = 0;
    // 3. flood fill power from the live sources
    pw.fill(0);
    for (let k = 0; k < nSrc; k++) { const i = LS_SRC[k]; pw[i] = 1; EQ[qt++] = i; }
    for (let k = 0; k < sensN; k++) { const i = sensList[k]; if (life[i]) { pw[i] = 1; EQ[qt++] = i; } }
    for (let k = 0; k < nSeed; k++) { const i = seeds[k]; if (!pw[i]) { pw[i] = 1; EQ[qt++] = i; } }
    let qh = 0;
    while (qh < qt) {
        const i = EQ[qh++];
        for (let d = 0; d < 4; d++) { const j = i + OFF[d]; if (pw[j] === 0 && isCond(j)) { pw[j] = 1; EQ[qt++] = j; } }
    }
    poweredN = qt;
    // 4. what live wires do to their surroundings, and powered devices
    const fx = SETTINGS.fx;
    for (let k = 0; k < qt; k++) {
        const i = EQ[k], e = el[i];
        if (ELC[e] === E_DEV) device(i, e, true);
        else if (e === ID.saltwater && rnd() < 0.002) put(i, rnd() < 0.5 ? ID.hydrogen : ID.chlorine);   // electrolysis
        const j = i + OFF[(rnd() * 4) | 0], b = el[j];
        if (b === 0) { if (fx && rnd() < 0.0015) { const y = ((i / P) | 0) - 1, x = i - (y + 1) * P - 1; addPart(x + 0.5, y + 0.5, (rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.5, 0, 6, 0, 3); } continue; }
        if (ELC[b] !== 0) continue;
        if (b === ID.neon || b === ID.argon) { life[j] = 8; wkI(j); }
        else if (b === HUMAN || b === HEAD) { if (rnd() < 0.3) hurtHuman(j, 34, 'shock'); }
        else if (BOOM[b] !== 0) { if (rnd() < 0.3) { const y = ((j / P) | 0) - 1; detonate(j - (y + 1) * P - 1, y, j, b); } }
        else if (KIND[b] === K.GAS && FLAM[b] > 0.5 && rnd() < 0.05) { life[j] = BLIFE[b]; tp[j] = IGN[b] + 50; wkI(j); }
        else if (b === ID.water && rnd() < 0.0005) put(j, rnd() < 0.67 ? ID.hydrogen : ID.oxygen);
        else if (b === ID.oxygen && rnd() < 0.002) put(j, ID.ozone);
    }
    for (let k = 0; k < nDev; k++) { const i = LS_DEV[k]; if (pw[i] === 0) device(i, el[i], false); }
}

// ---------- devices ----------
function cellXY(i) { const y = ((i / P) | 0) - 1; return [i - (y + 1) * P - 1, y]; }
function device(i, e, on) {
    if (e === ID.lamp) { if (on) { STAT.lamp++; if (tp[i] < 60) tp[i]++; } return; }
    if (e === ID.eheater) { if (on) { tp[i] += ((450 - tp[i]) * 0.25) | 0; wkI(i); } return; }
    if (e === ID.ecooler) { if (on) { tp[i] += ((-60 - tp[i]) * 0.25) | 0; wkI(i); } return; }
    if (e === ID.piston) { piston(i, on); return; }
    if (!on) return;
    const d = life[i] & 3, o = OFF[d];
    if (e === ID.fan) fan(i, o);
    else if (e === ID.pump) pump(i, d);
    else if (e === ID.conveyor) conveyor(i, d);
    else if (e === ID.drill) { const j = i + o, b = el[j]; if (b !== 0 && !UNB[b] && b !== ID.pistonhead && rnd() < 0.08) { if (RUB[b] && KIND[b] === K.SOLID) put(j, RUB[b], 0, true); else clr(j); wkI(j); } }
    else if (e === ID.laser) { if (rnd() < 0.6) { const [x, y] = cellXY(i); addLight(x + 0.5 + DX[d] * 0.8, y + 0.5 + DY[d] * 0.8, DX[d], DY[d], 40); } }
    else if (e === ID.sparkplug) {
        for (let q = 0; q < 4; q++) { const j = i + OFF[q], b = el[j]; if (b !== 0 && ELC[b] === 0 && (FLAM[b] > 0 || BOOM[b] !== 0)) { const [x, y] = cellXY(j); ignite(x, y, j, b); if (KIND[b] === K.GAS) { life[j] = BLIFE[b]; tp[j] = IGN[b] + 50; } } }
        if (SETTINGS.fx && rnd() < 0.1) { const [x, y] = cellXY(i); addPart(x + 0.5, y - 0.2, (rnd() - 0.5), -rnd(), 0, 6, 0, 3); }
    } else if (e === ID.teslacoil) {
        if (rnd() < 0.25) {
            const [x, y] = cellXY(i), ang = rnd() * 6.283, r = 3 + rnd() * 6;
            const tx = Math.round(x + Math.cos(ang) * r), ty = Math.round(y + Math.sin(ang) * r);
            if (!inb(tx, ty)) return;
            const j = ix(tx, ty), b = el[j];
            if (b === 0) { put(j, ID.spark, 0, true); life[j] = 3; wk(tx, ty); } else if (ELC[b] === 0) zapCell(tx, ty, j, b);
            bolts.push({ pts: [[x, y], [(x + tx) / 2 + (rnd() - 0.5) * 3, (y + ty) / 2 + (rnd() - 0.5) * 3], [tx, ty]], t: 4, c: 1 });
            sfx('zap', 0.25);
        }
    }
}
function fan(i, o) {
    let lim = 0;
    for (let k = 1; k <= 12; k++) { const b = el[i + o * k]; if (b !== 0 && KIND[b] === K.SOLID) break; lim = k; }
    for (let k = lim; k >= 1; k--) {
        const c = i + o * k, b = el[c];
        if (b === 0 || b === HEAD || rnd() > 0.8) continue;
        const t = c + o;
        if (b === HUMAN) { if (passable(el[t]) && passable(el[t - P])) moveHuman(c, t); continue; }
        if (el[t] === 0 && st[c] !== stamp) { swap(c, t); wkI(c); wkI(t); }
    }
}
function pump(i, d) {
    const o = OFF[d], src = i - o, dst = i + o, b = el[src];
    if (b === 0) return;
    let c, ct = tp[src], fromPipe = false;
    if (isPipe(b)) { c = aux[src] & 1023; if (c === 0) return; fromPipe = true; }
    else if (KIND[b] === K.SOLID || KIND[b] === K.CREATURE) return;
    else c = b;
    const db = el[dst];
    if (isPipe(db)) {
        if ((aux[dst] & 1023) !== 0) return;
        aux[dst] = c | (((d ^ 1) + 1) << 10); tp[dst] = ct;
    } else if (db === 0) {
        if (fromPipe) { put(dst, c, 0, true); tp[dst] = ct; } else { swap(src, dst); }
    } else return;
    if (fromPipe) aux[src] = 0; else if (el[src] === c) clr(src);
    STAT.pumped++;
    wkI(src); wkI(dst);
}
function conveyor(i, d) {
    const dx = d === 1 ? -1 : 1, top = i - P, b = el[top];
    if (b === 0 || KIND[b] === K.SOLID || b === HEAD || st[top] === stamp) return;
    const t = top + dx;
    if (b === HUMAN) { if (passable(el[t]) && passable(el[t - P])) moveHuman(top, t); return; }
    if (el[t] === 0) { swap(top, t); wkI(top); wkI(t); }
}
function piston(i, on) {
    const d = life[i] & 3, o = OFF[d], head = i + o;
    if (on) {
        if (aux[i] & 1) { if (el[head] !== ID.pistonhead) aux[i] &= ~1; return; }
        let n = 0;
        while (n < 16) { const b = el[i + o * (n + 1)]; if (b === 0) break; if (UNB[b] || b === ID.pistonhead || b === ID.piston) return; n++; }
        if (n >= 16) return;
        for (let k = n; k >= 1; k--) swap(i + o * k, i + o * (k + 1));
        put(head, ID.pistonhead, 0, true);
        aux[i] |= 1; STAT.pushed++;
        for (let k = 0; k <= n + 1; k++) wkI(i + o * k);
        sfx('pop', 0.3);
    } else if (aux[i] & 1) {
        if (el[head] === ID.pistonhead) { clr(head); wkI(head); }
        aux[i] &= ~1;
    }
}
