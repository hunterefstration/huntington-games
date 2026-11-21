// ============================================================
// Governor: keeps the frame rate up by itself. It watches the real frame rate in one-second windows.
// Too slow -> it tries a smaller picture (render scale down a step). If two steps in a row do not make
// frames faster, the picture was never the problem (the processor is the limit, as on most Chromebooks):
// it puts the sharpness back and tells the game instead (onCpuBound), so the game can cut things that cost
// processor time. Plenty of headroom for a while -> it steps the scale back up. The game applies the scale
// itself (apply(scale) -> usually renderer.setPixelRatio(base * scale)), so its own quality rules stay in charge.
// ============================================================
function governor(o) {
    o = o || {};
    const G = { scale: 1, on: true, cpuBound: false, fps: 60, min: o.min || 0.6, target: o.target || 50, good: o.good || 57.5, _acc: 0, _n: 0, _last: 0, _slow: 0, _fast: 0, _probe: 0, _probeFps: 0, _hold: 0 };
    const set = s => { s = Math.max(G.min, Math.min(1, Math.round(s * 100) / 100)); if (s !== G.scale) { G.scale = s; if (o.apply) o.apply(s); } };
    const tick = ts => {
        if (!G.on) return;
        requestAnimationFrame(tick);
        if (typeof document !== 'undefined' && document.hidden) { G._last = 0; return; }
        if (G._last) { const dt = ts - G._last; if (dt < 250) { G._acc += dt; G._n++; } }
        G._last = ts;
        if (G._acc < 1000) return;
        const fps = G.fps = G._n * 1000 / G._acc; G._acc = 0; G._n = 0;
        if (o.paused && o.paused()) { G._slow = G._fast = 0; return; }
        if (G._hold > 0) { G._hold--; return; }
        if (fps < G.target) {
            G._fast = 0;
            if (++G._slow < 2) return; G._slow = 0;
            if (G.cpuBound || G.scale <= G.min) { if (!G.cpuBound && o.onSlow) o.onSlow(fps); return; }
            if (G._probe === 0) { G._probeFps = fps; G._probe = 1; set(G.scale - 0.1); }
            else if (fps > G._probeFps * 1.06) { G._probeFps = fps; G._probe = 1; set(G.scale - 0.1); }        // a smaller picture helped: keep going
            else if (++G._probe > 2) { G.cpuBound = true; G._probe = 0; set(Math.min(1, G.scale + 0.2)); if (o.onCpuBound) o.onCpuBound(fps); }
            else set(G.scale - 0.1);
            G._hold = 1;
        } else {
            G._slow = 0; G._probe = 0;
            if (fps >= G.good && G.scale < 1 && ++G._fast >= 6) { G._fast = 0; set(G.scale + 0.05); G._hold = 1; }
            else if (fps < G.good) G._fast = 0;
        }
    };
    G.stop = () => { G.on = false; };
    G.start = () => { if (!G.on) { G.on = true; G._last = 0; G._acc = 0; G._n = 0; requestAnimationFrame(tick); } };
    G.reset = () => { G.cpuBound = false; G._slow = G._fast = G._probe = G._hold = 0; set(1); };
    // '?gov=0' in the address switches it off (benchmarks compare renderers at the same resolution)
    let off = false; try { off = /[?&]gov=0\b/.test(location.search); } catch (e) { }
    if (off || typeof requestAnimationFrame === 'undefined') G.on = false; else requestAnimationFrame(tick);
    return G;
}
