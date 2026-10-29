// ==========================================
// ELEMENT LAB - start up, main loop, debug hook (window.__elementlab)
// ==========================================
let lastT = 0, acc = 0, simMs = 0, drawMs = 0, frameCount = 0, slowFrames = 0, hintShown = false;
const frameLog = [];

function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(100, t - lastT || 16); lastT = t;
    const f0 = performance.now();
    const title = !$('title').classList.contains('hidden');
    if (!paused) {
        acc += dt * speed * 0.06;
        let n = Math.floor(acc); acc -= n;
        if (n > 3) n = 3;
        if (simMs > 12 && n > 1) n = 1;            // a slow machine: slow the simulation down instead of freezing the page
        const s0 = performance.now();
        for (let k = 0; k < n; k++) step();
        simMs = simMs * 0.8 + (performance.now() - s0) * 0.2;
    }
    if (!title) applyHold();
    const r0 = performance.now();
    render();
    drawMs = drawMs * 0.8 + (performance.now() - r0) * 0.2;
    if (!title) updateHover();
    frameCount++;
    if (frameCount % 20 === 0) { recount(); checkChallenges(); }
    if (frameCount % 600 === 0) autosave();
    frameLog.push(dt); if (frameLog.length > 120) frameLog.shift();
    if (!title && !hintShown && frameLog.length >= 100 && SETTINGS.quality > 0) {
        const avg = frameLog.reduce((a, b) => a + b, 0) / frameLog.length;
        if (avg > 30) { hintShown = true; toast('Running slowly? Try Low quality in Settings.'); }
    }
}

function init() {
    allocGrid(QUAL[SETTINGS.quality].w, QUAL[SETTINGS.quality].h);
    initRender(); buildTop(); buildPalette(); initInput(); initTitle();
    curEl = ID.sand;
    SCENES.lab.build();                            // something to watch behind the title screen
    wakeAll(); refreshUi();
    onChallenge = c => toast('Challenge complete: ' + c.name);
    window.addEventListener('resize', layoutStage);
    window.addEventListener('pagehide', () => { dirtySave = true; autosave(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { dirtySave = true; autosave(); } });
    requestAnimationFrame(frame);
}

window.__elementlab = {
    ID, DEFS, STAT, MADE, SETTINGS,
    get W() { return W; }, get H() { return H; }, get tick() { return tickN; },
    get el() { return el; }, get tp() { return tp; }, get life() { return life; }, get aux() { return aux; },
    get chainMax() { return chainMax; }, get particles() { return nParts; },
    start() { startPlay(); },
    seed(n) { seedRnd(n); },
    clear() { clearGrid(); },
    idx: (x, y) => ix(x, y),
    place(x, y, name, temp) { if (!inb(x, y)) return false; const i = ix(x, y); if (name === 'empty') clr(i); else setUser(i, ID[name]); if (temp !== undefined) tp[i] = temp; wk(x, y); return true; },
    fill(x0, y0, x1, y1, name, temp) { fillRect(x0, y0, x1, y1, ID[name], true); if (temp !== undefined) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (el[ix(x, y)]) tp[ix(x, y)] = temp; },
    paint(name, x, y, r) { paintCircle(x, y, r === undefined ? brushR : r, ID[name], 1); },
    get(x, y) { const i = ix(x, y); return { el: DEFS[el[i]].name, t: tp[i], life: life[i], aux: aux[i] }; },
    heat(x, y, r, d) { const o = brushR; brushR = r; heatAt(x, y, d); brushR = o; },
    step(n) { const t0 = performance.now(); for (let k = 0; k < (n || 1); k++) step(); return performance.now() - t0; },
    render() { const t0 = performance.now(); render(); return performance.now() - t0; },
    count(name) { recount(); if (name) return CNT[ID[name]]; const o = {}; for (let e = 1; e < NE; e++) if (CNT[e]) o[DEFS[e].name] = CNT[e]; return o; },
    total() { recount(); let n = 0; for (let e = 1; e < NE; e++) n += CNT[e]; return n; },
    scene(name) { return loadScene(name); },
    scenes: () => Object.keys(SCENES),
    setQuality(q) { changeQuality(q); },
    explode(x, y, r) { queueBoom(x, y, r, 1, 0); },
    lightning(x, y) { lightning(x, y); },
    shareCode: () => encodeScene(), loadCode: c => decodeScene(c),
    challenges: () => CHALLENGES.map(c => ({ id: c.id, done: !!DONE[c.id] })),
    checkChallenges, undo: () => undo(), pushUndo, activeChunks,
    setTool, setBrush, selectElement: n => selectElement(ID[n]),
    pause(v) { paused = v === undefined ? !paused : v; refreshUi(); },
    perf: () => ({ simMs, drawMs, frames: frameLog.slice(), active: activeChunks(), chunks: act.length })
};

init();
