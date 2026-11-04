// ==========================================
// ELEMENT LAB - challenges, share codes, screenshots, autosave
// ==========================================
const CHALLENGES = [
    { id: 'obsidian', name: 'Make obsidian', hint: 'Pour water onto lava.', test: () => MADE[ID.obsidian] },
    { id: 'glass', name: 'Make glass', hint: 'Melt sand with the heat gun or lava, then let it cool.', test: () => MADE[ID.glass] },
    { id: 'saltwater', name: 'Make salt water', hint: 'Drop salt into water.', test: () => MADE[ID.saltwater] },
    { id: 'rain', name: 'Make it rain', hint: 'Place a cloud, or boil water so steam rises and cools.', test: () => STAT.rain > 0 },
    { id: 'forest', name: 'Grow a forest', hint: 'Plant seeds in dirt and give them water.', test: () => STAT.grown >= 150 },
    { id: 'chain', name: 'Chain reaction', hint: 'Set off TNT or C4 so each blast sets off the next one, at least 5 in a row. A long line of TNT (20 blocks) works well.', test: () => chainMax >= 5 },
    { id: 'rust', name: 'Make rust', hint: 'Leave metal in salt water for a while.', test: () => MADE[ID.rust] },
    { id: 'ice', name: 'Freeze water', hint: 'Cool water with the Cooler, a Freezer block or liquid nitrogen.', test: () => MADE[ID.ice] },
    { id: 'lamp', name: 'Light a lamp', hint: 'Touch a battery to metal wire that reaches a lamp.', test: () => STAT.lamp > 0 },
    { id: 'molten', name: 'Melt metal', hint: 'The heat gun gets metal hot enough.', test: () => MADE[ID.moltenmetal] },
    { id: 'alkali', name: 'Sodium splash', hint: 'Drop sodium or potassium into water. Stand back.', test: () => STAT.alk > 0 },
    { id: 'virus', name: 'Spread a virus', hint: 'Put virus next to plants or ants.', test: () => STAT.infected >= 20 },
    { id: 'ants', name: 'Ant feast', hint: 'Ants eat plants. Give them some.', test: () => STAT.ate >= 10 },
    // 2.0
    { id: 'fission', name: 'Split the atom', hint: 'Put uranium in water and add a Neutron Source. Slow neutrons split uranium.', test: () => STAT.fission >= 200 },
    { id: 'turbine', name: 'Steam power', hint: 'Boil water under a Turbine so the steam spins it.', test: () => STAT.turbine >= 200 },
    { id: 'logic', name: 'Logic gate', hint: 'Power both inputs of an AND gate (left and right) so it switches on.', test: () => STAT.andOn > 0 },
    { id: 'meltdown', name: 'Meltdown', hint: 'Pull every control rod out of a reactor and wait. Stand well back.', test: () => MADE[ID.corium] },
    { id: 'alloy', name: 'Make an alloy', hint: 'Melt copper and tin together for bronze (or copper and zinc for brass).', test: () => MADE[ID.molten_bronze] || MADE[ID.molten_brass] || MADE[ID.molten_steel] || MADE[ID.molten_solder] },
    { id: 'crystal', name: 'Grow crystals', hint: 'Dissolve copper sulfate in water, then boil the water away.', test: () => STAT.crystal >= 15 },
    { id: 'town', name: 'Populate a town', hint: 'Have 15 people living in your lab at once.', test: () => CNT[ID.human] >= 15 },
    { id: 'bake', name: 'Bake bread', hint: 'Mix flour and water into dough, then heat it.', test: () => MADE[ID.bread] },
    { id: 'piston', name: 'Heavy lifting', hint: 'Power a piston so it pushes something.', test: () => STAT.pushed >= 3 }
];
const DONE = LS.get('elementlab_challenges', {}) || {};
let onChallenge = null;
function checkChallenges() {
    for (const c of CHALLENGES) {
        if (DONE[c.id]) continue;
        let ok = false; try { ok = !!c.test(); } catch (e) { }
        if (ok) { DONE[c.id] = Date.now(); LS.set('elementlab_challenges', DONE); sfx('ding', 1); if (onChallenge) onChallenge(c); }
    }
}
const challengeCount = () => CHALLENGES.filter(c => DONE[c.id]).length;

// ---------- share codes ----------
// EL2.<w>x<h>.<base64>: runs of (element u16, aux varint, temperature byte, facing byte, run length varint).
//   temperature byte 0 = the element's normal start temperature, else (t + 300) / 25.
// EL1 (Element Lab 1): runs of (element byte, run length varint). Still loads.
function pushVar(out, v) { while (v >= 128) { out.push((v & 127) | 128); v >>>= 7; } out.push(v); }
function encodeScene() {
    const out = [];
    let run = 0, pe = -1, pa = 0, pt = 0, pf = 0;
    const flush = () => { if (!run) return; out.push(pe & 255, pe >> 8); pushVar(out, pa); out.push(pt, pf); pushVar(out, run); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = ix(x, y), e = el[i];
        let a = 0, t = 0, f = 0;
        if (e !== 0) {
            a = e === ID.turbine || e === HEAD ? 0 : aux[i];
            const d = tp[i] - TINIT[e];
            if (d > 15 || d < -15) t = clamp(Math.round((tp[i] + 300) / 25), 1, 255);
            if (DIRL[e]) f = life[i] & 3;
        }
        if (e === pe && a === pa && t === pt && f === pf) run++;
        else { flush(); pe = e; pa = a; pt = t; pf = f; run = 1; }
    }
    flush();
    let s = '';
    for (let i = 0; i < out.length; i += 4096) s += String.fromCharCode.apply(null, out.slice(i, i + 4096));
    return 'EL2.' + W + 'x' + H + '.' + btoa(s).replace(/=+$/, '');
}
function decodeScene(code) {
    const m = /^EL([12])\.(\d+)x(\d+)\.([A-Za-z0-9+/]*)$/.exec(String(code).replace(/\s+/g, ''));
    if (!m) return false;
    const v2 = m[1] === '2', w = +m[2], h = +m[3];
    if (w < 8 || h < 8 || w > 1000 || h > 1000) return false;
    let bin; try { bin = atob(m[4]); } catch (e) { return false; }
    const n0 = w * h, cells = new Uint16Array(n0), ax = v2 ? new Uint16Array(n0) : null, tq = v2 ? new Uint8Array(n0) : null, fc = v2 ? new Uint8Array(n0) : null;
    let n = 0, p = 0;
    const rd = () => { let r = 0, sh = 0, b; do { if (p >= bin.length) throw 0; b = bin.charCodeAt(p++); r += (b & 127) * Math.pow(2, sh); sh += 7; } while (b & 128); return r; };
    try {
        while (p < bin.length && n < n0) {
            let e, a = 0, t = 0, f = 0;
            if (v2) { e = bin.charCodeAt(p) | (bin.charCodeAt(p + 1) << 8); p += 2; a = rd(); t = bin.charCodeAt(p++); f = bin.charCodeAt(p++); }
            else e = bin.charCodeAt(p++);
            const r = rd();
            if (e >= NE || p > bin.length) return false;
            for (let k = 0; k < r && n < n0; k++) { cells[n] = e; if (v2) { ax[n] = a; tq[n] = t; fc[n] = f; } n++; }
        }
    } catch (err) { return false; }
    if (n !== n0) return false;
    pushUndo(); clearGrid();
    for (let y = 0; y < H; y++) {
        const sy = Math.min(h - 1, Math.floor(y * h / H));
        for (let x = 0; x < W; x++) {
            const k = sy * w + Math.min(w - 1, Math.floor(x * w / W)), e = cells[k];
            if (!e) continue;
            const i = ix(x, y);
            if (e === HEAD) { el[i] = HEAD; tp[i] = 37; continue; }
            setUser(i, e);
            if (v2) { aux[i] = ax[k]; if (tq[k]) tp[i] = tq[k] * 25 - 300; if (DIRL[e]) life[i] = fc[k] & 3; }
        }
    }
    wakeAll();
    return true;
}

// ---------- save slots (elementlab_slots: six {name, code, t}) ----------
const NSLOTS = 6;
function loadSlots() { const s = LS.get('elementlab_slots', null); const a = Array.isArray(s) ? s.slice(0, NSLOTS) : []; while (a.length < NSLOTS) a.push(null); return a; }
function saveSlot(k, name) { const a = loadSlots(); a[k] = { name: String(name).slice(0, 40), code: encodeScene(), t: Date.now() }; return LS.set('elementlab_slots', a); }
function loadSlot(k) { const s = loadSlots()[k]; return !!(s && s.code && decodeScene(s.code)); }
function deleteSlot(k) { const a = loadSlots(); a[k] = null; LS.set('elementlab_slots', a); }

// ---------- screenshot: the scene, glow included, scaled up 4x, saved as a PNG ----------
function screenshot() {
    const s = 4, c = document.createElement('canvas');
    c.width = W * s; c.height = H * s;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, c.width, c.height);
    if (SETTINGS.glow) { g.imageSmoothingEnabled = true; g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.8; g.drawImage(gcv, 0, 0, c.width, c.height); if (SETTINGS.bloom) g.drawImage(bcv, 0, 0, c.width, c.height); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    g.imageSmoothingEnabled = false; g.drawImage(ocv, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = 'element-lab.png';
    document.body.appendChild(a); a.click(); a.remove();
    return url.length;
}

// ---------- autosave (the last scene, as a share code) ----------
let dirtySave = false;
function autosave() {
    if (!dirtySave || !W) return;
    dirtySave = false;
    LS.set('elementlab_autosave', { code: encodeScene(), t: Date.now() });
}
