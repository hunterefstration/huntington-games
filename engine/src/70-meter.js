// ============================================================
// Speed meter and speed test: for checking the engine on a real Chromebook, from inside the game (no
// developer tools, no address-bar switches). A test times each animation frame for a while, including
// the wait for the graphics chip, so two renderers can be compared even when both are capped at 60 FPS.
// Results are kept per game in localStorage ('hgdev_bench_<game>', this device only) and shown side by side.
// ============================================================
const METER = { el: null, on: false, label: '', last: 0, acc: 0, n: 0 };
function meterTick(ts) {
    if (!METER.on) return;
    requestAnimationFrame(meterTick);
    if (METER.last) { METER.acc += ts - METER.last; METER.n++; if (METER.acc >= 500) { METER.el.textContent = METER.label + ' ' + Math.round(METER.n * 1000 / METER.acc) + ' FPS'; METER.acc = 0; METER.n = 0; } }
    METER.last = ts;
}
// a small always-on frame-rate readout in the top-left corner: meter(true, 'HG3D') / meter(false)
function meter(on, label) {
    if (typeof document === 'undefined') return;
    if (on && !METER.el) { const e = METER.el = document.createElement('div'); e.style.cssText = 'position:fixed;left:6px;top:6px;z-index:2147483000;font:bold 12px/1 monospace;color:#fff;background:rgba(0,0,0,.55);padding:4px 6px;border-radius:4px;pointer-events:none'; document.body.appendChild(e); }
    if (METER.el) METER.el.style.display = on ? '' : 'none';
    METER.label = label || ''; const was = METER.on; METER.on = !!on; METER.last = 0; METER.acc = 0; METER.n = 0;
    if (on && !was) requestAnimationFrame(meterTick);
}
function benchResults(game) { try { return JSON.parse(localStorage.getItem('hgdev_bench_' + game) || '{}') || {}; } catch (e) { return {}; } }
// speedTest({ game, renderer: 'hg' | 'three', gl, seconds, onDone(result, all) }): returns a stop() function
function speedTest(o) {
    const secs = o.seconds || 20, cost = [], gap = [], px = new Uint8Array(4), gl = o.gl || null, native = window.requestAnimationFrame;
    let curTs = -1, cur = 0, lastTs = 0, t0 = 0, done = false;
    const note = document.createElement('div'); note.style.cssText = 'position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483001;font:bold 14px/1.3 system-ui,sans-serif;color:#fff;background:rgba(10,14,30,.85);padding:8px 14px;border-radius:8px;pointer-events:none';
    document.body.appendChild(note);
    const finish = () => {
        if (done) return; done = true; window.requestAnimationFrame = native; note.remove();
        const s = a => a.slice().sort((x, y) => x - y), c = s(cost), g = s(gap), q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
        const avgGap = gap.length ? gap.reduce((x, y) => x + y, 0) / gap.length : 0;
        const r = { fps: avgGap ? +(1000 / avgGap).toFixed(1) : 0, low: q(g, 0.99) ? +(1000 / q(g, 0.99)).toFixed(1) : 0, ms: +q(c, 0.5).toFixed(2), ms95: +q(c, 0.95).toFixed(2), frames: gap.length, at: Date.now() };
        const all = benchResults(o.game); all[o.renderer] = r; try { localStorage.setItem('hgdev_bench_' + o.game, JSON.stringify(all)); } catch (e) { }
        if (o.onDone) o.onDone(r, all);
    };
    // time every animation-frame callback of the page; one "frame" is everything that ran for the same timestamp
    window.requestAnimationFrame = cb => native.call(window, ts => {
        if (done) return cb(ts);
        if (ts !== curTs) {
            if (curTs >= 0 && t0 && ts - t0 > 1500) { cost.push(cur); if (lastTs) gap.push(curTs - lastTs); }       // the first 1.5 s are warm-up
            lastTs = curTs >= 0 ? curTs : 0; curTs = ts; cur = 0; if (!t0) t0 = ts;
            const left = secs - (ts - t0) / 1000; note.textContent = 'Speed test (' + (o.renderer === 'hg' ? 'HG3D' : 'three.js') + '): ' + Math.max(0, Math.ceil(left)) + ' s';
            if (left <= 0) { finish(); return cb(ts); }
        }
        const a = performance.now(); cb(ts);
        if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);     // wait for the graphics chip: its time belongs to this frame
        cur += performance.now() - a;
    });
    return finish;
}
// a plain-words card for the results of one game: both renderers when both were tested
function benchCard(game, title) {
    const all = benchResults(game), a = all.three, b = all.hg, row = (n, r) => r ? '<tr><td style="padding:3px 10px 3px 0">' + n + '</td><td style="padding:3px 10px;text-align:right">' + r.fps + ' FPS</td><td style="padding:3px 10px;text-align:right">' + r.low + ' FPS</td><td style="padding:3px 0 3px 10px;text-align:right">' + r.ms + ' ms</td></tr>' : '';
    let verdict = 'Run the test once with each graphics engine to compare them.';
    if (a && b && a.ms > 0) { const g = Math.round((1 - b.ms / a.ms) * 100); verdict = g >= 0 ? 'HG3D needs ' + g + '% less time per frame than three.js here.' : 'HG3D needs ' + (-g) + '% MORE time per frame than three.js here.'; }
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483002;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font:15px/1.4 system-ui,sans-serif';
    d.innerHTML = '<div style="background:#12162e;color:#fff;border-radius:12px;padding:18px 22px;max-width:520px"><div style="font-weight:800;font-size:18px;margin-bottom:8px">' + (title || 'Speed test') + '</div>'
        + '<table style="border-collapse:collapse;margin-bottom:10px"><tr style="opacity:.7"><td></td><td style="padding:0 10px;text-align:right">average</td><td style="padding:0 10px;text-align:right">slowest 1%</td><td style="padding:0 0 0 10px;text-align:right">work per frame</td></tr>' + row('three.js', a) + row('HG3D', b) + '</table>'
        + '<div style="margin-bottom:12px">' + verdict + '</div><button style="font:inherit;font-weight:700;padding:6px 16px;border-radius:8px;border:0;cursor:pointer">OK</button></div>';
    d.querySelector('button').onclick = () => d.remove(); document.body.appendChild(d);
    return d;
}
