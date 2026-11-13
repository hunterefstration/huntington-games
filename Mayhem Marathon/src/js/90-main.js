// ============================================================
// BOOT, INPUT LISTENERS, MAIN LOOP and the debug hook window.__mayhem (used by the tests).
// ============================================================
let lastT = now(), acc = 0, hudT = 0, lastFrameT = 0;
function draw(dt) {
    const t = performance.now() / 1000;
    if (G.R && G.scene === 'round') { updateCamera(dt); drawContestants(dt); updateLevelMeshes(dt); }
    else { updateLevelMeshes(dt); drawMenu(dt); }
    updateParticles(dt); animStadium(t); GFX.sky.material.uniforms.uTime.value = t;
    render();
    hudT += dt; if (hudT > 0.1) { hudT = 0; updateHud(); }
}
function loopStep() {
    const t = now(); let dt = Math.min(0.1, t - lastT); lastT = t; lastFrameT = t;
    if (!G.manual) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { tick(STEP); acc -= STEP; n++; } if (acc > STEP) acc = 0; }
    if (!G.noRender) draw(dt);
}
function frame() { requestAnimationFrame(frame); try { loopStep(); } catch (e) { console.error(e); } }
// background tabs stop animation frames: keep the host simulation (bots, the clock) going
setInterval(() => { if (now() - lastFrameT > 0.25 && G.R) { const keep = G.noRender; G.noRender = true; try { loopStep(); } finally { G.noRender = keep; } } }, 50);

function meActive() { const me = byId(G.me); return G.R && me && me.inRound && !me.hide; }
function wireInput() {
    const gameKeys = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
    addEventListener('keydown', e => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
        ac();
        if (e.code === 'Escape') { if (G.screen === 'pause') UI.resume(); else if (G.screen === 'game') UI.pause(); return; }
        if (G.screen === 'game' && gameKeys.has(e.code)) e.preventDefault();
        if (!e.repeat) INP.edge.add(e.code);
        INP.keys.add(e.code);
        if (e.code === 'Space' && G.R && !meActive()) G.spec = nextSpec(G.spec);
    });
    addEventListener('keyup', e => { INP.keys.delete(e.code); });
    addEventListener('blur', () => { INP.keys.clear(); INP.mouseGrab = false; });
    const cv = $('#gl'); let drag = null;
    cv.addEventListener('mousedown', e => {
        ac();
        if (G.screen === 'ward') { drag = { x: e.clientX }; return; }
        if (G.screen !== 'game' || !G.R) return;
        if (!meActive()) { G.spec = nextSpec(G.spec); return; }
        if (!document.pointerLockElement && !isTouch()) { try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {} return; }
        if (e.button === 0) INP.mouseGrab = true;
    });
    addEventListener('mouseup', () => { INP.mouseGrab = false; drag = null; });
    addEventListener('mousemove', e => {
        if (drag) { MENU.wardYaw += (e.clientX - drag.x) * 0.012; drag.x = e.clientX; }
        if (document.pointerLockElement === cv) { const s = save.settings.sens; G.camYaw -= e.movementX * 0.0025 * s; G.camPitch = clamp(G.camPitch + e.movementY * 0.0022 * s * (save.settings.invertY ? -1 : 1), -0.25, 1.2); }
    });
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) $('#h-lock').classList.add('hidden'); });
    // touch: left stick, right side drag looks, buttons
    const stick = $('#stick'), knob = stick.firstElementChild; let sid = null, look = null;
    stick.addEventListener('touchstart', e => { ac(); const t = e.changedTouches[0]; sid = t.identifier; e.preventDefault(); }, { passive: false });
    addEventListener('touchmove', e => {
        for (const t of e.changedTouches) {
            if (t.identifier === sid) { const r = stick.getBoundingClientRect(), dx = (t.clientX - r.left - r.width / 2) / (r.width / 2), dy = (t.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.max(1, Math.hypot(dx, dy)); INP.touch.mx = dx / l; INP.touch.mz = -dy / l; knob.style.transform = 'translate(' + (dx / l * 40) + 'px,' + (dy / l * 40) + 'px)'; }
            else if (look && t.identifier === look.id) { G.camYaw -= (t.clientX - look.x) * 0.006; G.camPitch = clamp(G.camPitch + (t.clientY - look.y) * 0.004, -0.25, 1.2); look.x = t.clientX; look.y = t.clientY; }
        }
    }, { passive: true });
    const endT = e => { for (const t of e.changedTouches) { if (t.identifier === sid) { sid = null; INP.touch.mx = INP.touch.mz = 0; knob.style.transform = ''; } if (look && t.identifier === look.id) look = null; } };
    addEventListener('touchend', endT); addEventListener('touchcancel', endT);
    cv.addEventListener('touchstart', e => { ac(); const t = e.changedTouches[0]; if (G.screen === 'game' && !meActive()) { G.spec = nextSpec(G.spec); return; } if (t.clientX > innerWidth * 0.4) look = { id: t.identifier, x: t.clientX, y: t.clientY }; }, { passive: true });
    const btn = (sel, on, off) => { const b = $(sel); b.addEventListener('touchstart', e => { e.preventDefault(); ac(); on(); }, { passive: false }); b.addEventListener('touchend', e => { e.preventDefault(); off && off(); }, { passive: false }); };
    btn('#t-jump', () => INP.touch.jump = true); btn('#t-dive', () => INP.touch.dive = true); btn('#t-grab', () => INP.touch.grab = true, () => INP.touch.grab = false);
}
function boot() {
    save = loadSave(); writeSave();
    initGfx(); wireUI(); wireInput();
    G.scene = 'menu'; UI.toTitle();
    $('#boot').classList.add('hidden');
    requestAnimationFrame(frame);
    if (!save.seenHow) { save.seenHow = true; writeSave(); setTimeout(() => toast('New here? Check "How to play" for the controls.'), 1200); }
    launcherBoot();
}
window.__mayhem = {
    get G() { return G; }, get R() { return G.R; }, get W() { return W; }, get L() { return L; }, get save() { return save; }, NET, ROUNDS, ROUND_INFO, ITEMS, GFX,
    state() {
        const R = G.R, S = G.show, me = byId(G.me);
        return { screen: G.screen, scene: G.scene, host: G.host, me: G.me,
            show: S && { idx: S.idx, len: S.len, pts: S.pts, over: !!S.over, winner: S.winner, n: S.cs.length, alive: S.cs.filter(c => !c.out && !c.spect).length, used: S.used.slice(), results: S.results.map(r => ({ rid: r.rid, q: r.q.length, n: r.order.length, meQ: r.q.includes(G.me) })) },
            round: R && { rid: R.rid, t: +R.t.toFixed(2), phase: R.phase, q: R.q, n: R.cs.length, finished: R.finished.length, outs: R.outs.length, live: R.cs.filter(c => !c.done && !c.hide).length, ended: R.ended, tails: [...R.tails], score: R.score, crownBy: R.crownBy, qual: R.results && R.results.q },
            mine: me && me.inRound ? { x: +me.vs.x.toFixed(2), y: +me.vs.y.toFixed(2), z: +me.vs.z.toFixed(2), st: me.vs.st, done: me.done, hide: me.hide, out: me.out } : null, spec: G.spec };
    },
    startRound(rid, o) { o = o || {}; startPractice(rid, o.bots, o.skill); },
    startShow(o) { o = o || {}; if (o.skill != null) save.opts.skill = o.skill; if (o.length) save.opts.length = o.length; startSolo(); },
    step(sec) { const n = Math.round(sec / STEP); for (let i = 0; i < n; i++) tick(STEP); return this.state(); },
    manual(on) { G.manual = !!on; }, noRender(on) { G.noRender = !!on; }, autopilot(on) { G.autopilot = !!on; },
    bots() { return G.R ? G.R.cs.filter(c => c.bot).map(c => ({ id: c.id, name: c.name, skill: c.skill, done: c.done, x: +c.vs.x.toFixed(1), y: +c.vs.y.toFixed(1), z: +c.vs.z.toFixed(1) })) : []; },
    contestants() { return G.R ? G.R.cs.map(c => ({ id: c.id, name: c.name, bot: c.bot, sim: c.sim, done: c.done, hide: c.hide, x: +c.vs.x.toFixed(2), y: +c.vs.y.toFixed(2), z: +c.vs.z.toFixed(2), st: c.vs.st, team: c.team })) : []; },
    key(code, down) { if (down) { INP.keys.add(code); INP.edge.add(code); } else INP.keys.delete(code); },
    renderInfo(sync) { draw(1 / 60); if (sync) { const gl = GFX.renderer.getContext(), px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } return Object.assign({}, GFX.info, { q: GFX.q, geometries: GFX.renderer.info.memory.geometries }); },
    quality(q) { save.settings.quality = q; applyQuality(); },
    migrate(obj) { return fixSave(mergeInto(defaultSave(), migrateSave(JSON.parse(JSON.stringify(obj))))); },
    reloadSave() { save = loadSave(); return save; },
    toTitle() { UI.toTitle(); }, ui: UI, host: () => netHost(), join: c => netJoin(c), start: () => netStartShow(), toLobby: () => netToLobby()
};
boot();
