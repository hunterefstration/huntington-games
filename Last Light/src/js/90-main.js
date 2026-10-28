// ==========================================
// BOOT + MAIN LOOP
// ==========================================
R.cv = $('view'); R.x = R.cv.getContext('2d', { alpha: false });
applyQuality();
addEventListener('resize', () => R.resize());

// buttons
const on = (id, fn) => { const el = $(id); if (el) el.onclick = () => { Sound.init(); Sound.play('click'); fn(); }; };
on('t-play', () => fadeTo(() => UI.map()));
on('t-settings', () => UI.settings('title'));
on('t-how', () => UI.show('how'));
on('t-stats-btn', () => UI.stats());
on('t-lore-btn', () => UI.people());
on('lo-done', () => UI.show('title'));
$('#talk').addEventListener('pointerdown', e => { e.preventDefault(); UI.talkNext(); });
on('st-done', () => UI.show('title'));
on('dd-retry', () => UI.retry());
on('dd-restart', () => fadeTo(() => G.start(G.idx)));
on('dd-map', () => fadeTo(() => UI.map()));
on('how-done', () => UI.show(G.state === 'paused' ? 'pause' : 'title'));
on('m-back', () => { G.state = 'title'; UI.show('title'); titleStats(); });
on('b-pause', () => UI.pause());
on('p-resume', () => UI.resume());
on('p-restart', () => fadeTo(() => G.start(G.idx)));
on('p-settings', () => UI.settings('pause'));
on('p-map', () => fadeTo(() => UI.map()));
on('d-retry', () => fadeTo(() => G.start(G.idx)));
on('d-next', () => fadeTo(() => G.start(G.idx + 1)));
on('d-map', () => fadeTo(() => UI.map()));
on('set-done', () => UI.show(UI._back === 'pause' ? 'pause' : 'title'));
addEventListener('pointerdown', () => Sound.init(), { once: true });
addEventListener('keydown', () => Sound.init(), { once: true });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') UI.pause(); });

// touch buttons
for (const b of document.querySelectorAll('#touch button')) {
    const k = b.dataset.k, set = v => { Input.touchSet(k, v); b.classList.toggle('on', v); };
    b.addEventListener('touchstart', e => { e.preventDefault(); Sound.init(); set(true); }, { passive: false });
    b.addEventListener('touchend', e => { e.preventDefault(); set(false); }, { passive: false });
    b.addEventListener('touchcancel', () => set(false));
}

function titleStats() {
    const done = Object.keys(SAVE.d.levels).length, moths = Object.values(SAVE.d.levels).reduce((n, r) => n + (r.moths || []).filter(Boolean).length, 0);
    $('#t-stats').textContent = done ? `${done} of ${LEVELS.length} levels · ${moths} stars · ${SAVE.d.sparks} sparks` : 'The last light in a dark world';
    $('#t-play').textContent = done ? 'Continue' : 'Play';
}
titleStats();

// fixed-step loop: physics at 120 Hz, drawing once per screen refresh
let last = performance.now(), acc = 0, titleT = 0, fpsT = 0, fpsN = 0, slowFrames = 0;
const STEP = 1 / 120;
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    Input.poll();
    if (Input.hit('pause')) { if (G.state === 'play') UI.pause(); else if (G.state === 'paused') UI.resume(); }
    if (G.state === 'dead' && (Input.hit('jump') || Input.hit('ok') || Input.hit('retry'))) UI.retry();
    if (G.state === 'talk' && (Input.hit('jump') || Input.hit('ok') || Input.hit('dash'))) UI.talkNext();
    if (G.state === 'play') {
        acc += dt;
        let n = 0; while (acc >= STEP && n < 12) { G.update(STEP); acc -= STEP; n++; Input.endFrame(); }
        if (G.state === 'play' && settings.timer !== false) $('#h-time').textContent = fmtTime(G.time);
        render(G);
    } else if (G.state === 'paused' || G.state === 'done' || G.state === 'dead' || G.state === 'talk') {
        if (G.state === 'talk') UI.talkTick(dt);
        render(G); Input.endFrame();
    } else {
        titleT += dt; renderTitle(titleT); Input.endFrame();
    }
    touchControls();
    // Auto graphics: if frames keep coming slowly, draw fewer pixels
    if (settings.quality === 'auto' && G.state === 'play') {
        fpsT += dt; fpsN++;
        if (fpsT > 2) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (fps < 45 && R.q > 0.6) { slowFrames++; if (slowFrames >= 2) { R.q = Math.max(0.6, R.q - 0.15); R.resize(); slowFrames = 0; } } else slowFrames = 0; }
    }
}
requestAnimationFrame(frame);
// the opening splash stays at least 2 seconds from when the page started, however fast everything loaded
setTimeout(() => { const s = $('#splash'); if (!s) return; s.classList.add('out'); setTimeout(() => s.remove(), 600); }, Math.max(0, 2000 - performance.now()));

// test hook (used by the launcher's automated tests)
window.__lumi = {
    get G() { return G; }, LEVELS, SAVE, R,
    start: i => G.start(typeof i === 'string' ? LEVELS.findIndex(l => l.id === i) : i),
    step(sec, keys = {}) { const n = Math.round(sec * 120); for (let i = 0; i < n; i++) { for (const k in keys) Input.touchSet(k, !!keys[k]); G.update(STEP); Input.endFrame(); } for (const k in keys) Input.touchSet(k, false); },
    key(k, on = true) { Input.touchSet(k, on); },                           // hold / release, for scripted play
    tick(sec, watch) { const n = Math.round(sec * 120); for (let i = 0; i < n; i++) { G.update(STEP); Input.endFrame(); if (watch) watch(G); } },
    tp(x, y) { G.p.x = x * TS + TS / 2; G.p.y = y * TS + TS / 2; G.p.vx = G.p.vy = 0; },
    hitGuard() { if (G.guard) guardHit(G, G.guard); },
    ability(k, v = true) { SAVE.d.abilities[k] = v; },
    render: () => render(G)
};
