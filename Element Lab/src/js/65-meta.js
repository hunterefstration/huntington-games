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
    { id: 'ants', name: 'Ant feast', hint: 'Ants eat plants. Give them some.', test: () => STAT.ate >= 10 }
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

// ---------- share code: run-length encoded element ids, base64. "EL1.<w>x<h>.<data>" ----------
function encodeScene() {
    const out = [];
    let run = 0, prev = -1;
    const flush = () => { if (run) { out.push(prev); let r = run; while (r >= 128) { out.push((r & 127) | 128); r >>= 7; } out.push(r); } };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const e = el[ix(x, y)];
        if (e === prev) run++; else { flush(); prev = e; run = 1; }
    }
    flush();
    let s = ''; for (let i = 0; i < out.length; i++) s += String.fromCharCode(out[i]);
    return 'EL1.' + W + 'x' + H + '.' + btoa(s).replace(/=+$/, '');
}
function decodeScene(code) {
    const m = /^EL1\.(\d+)x(\d+)\.([A-Za-z0-9+/]*)$/.exec(String(code).replace(/\s+/g, ''));
    if (!m) return false;
    const w = +m[1], h = +m[2];
    if (w < 8 || h < 8 || w > 1000 || h > 1000) return false;
    let bin; try { bin = atob(m[3]); } catch (e) { return false; }
    const cells = new Uint8Array(w * h);
    let n = 0, p = 0;
    while (p < bin.length && n < cells.length) {
        const e = bin.charCodeAt(p++);
        let r = 0, sh = 0, b;
        do { if (p >= bin.length) return false; b = bin.charCodeAt(p++); r |= (b & 127) << sh; sh += 7; } while (b & 128);
        if (e >= NE) return false;
        for (let k = 0; k < r && n < cells.length; k++) cells[n++] = e;
    }
    if (n !== cells.length) return false;
    pushUndo(); clearGrid();
    for (let y = 0; y < H; y++) {
        const sy = Math.min(h - 1, Math.floor(y * h / H));
        for (let x = 0; x < W; x++) {
            const e = cells[sy * w + Math.min(w - 1, Math.floor(x * w / W))];
            if (e) setUser(ix(x, y), e);
        }
    }
    wakeAll();
    return true;
}

// ---------- screenshot: the scene, glow included, scaled up 4x, saved as a PNG ----------
function screenshot() {
    const s = 4, c = document.createElement('canvas');
    c.width = W * s; c.height = H * s;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false; g.drawImage(cv, 0, 0, c.width, c.height);
    if (SETTINGS.glow) { g.imageSmoothingEnabled = true; g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.8; g.drawImage(gcv, 0, 0, c.width, c.height); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
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
