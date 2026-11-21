// Frame-time benchmark for the 3D games, built to compare the three.js renderer with the HG3D engine.
//
//   node tools/bench/bench3d.mjs <game|all> [options]
//     games:      mayhem steel frontline blocky sovereign
//     --mode      cpu | fill | both      cpu  = hardware GL + main thread slowed 6x (a CPU-bound Chromebook)
//                                        fill = software GL (SwiftShader): pixel cost dominates
//     --r         three | hg | ab | base three/hg = one renderer, ab = both interleaved + gate verdict,
//                                        base = the game as it is (no ?r=), with its render share
//     --frames N  measured frames per run (default 300)      --runs N  runs per variant (default 1; ab uses 3)
//     --scn name  only this scenario                           --throttle N  CPU slowdown in cpu mode (default 6)
//     --json f    also write the rows as JSON                  --headed  show the browser window
//     --arg x     passed to the scenario's setup (mayhem 'round': a round id)
//     --shot f.png  no timing: one picture of the scene, three.js left and HG3D right (uses --scn)
//
// What a row means (milliseconds per frame, median over the run unless marked p95):
//   total = work + gpu      work = JavaScript in the animation frame (game logic + render submit)
//   sub   = JavaScript spent inside renderer.render      gpu = wait for the GPU to finish the frame (GL sync)
//   share = (sub + gpu) / total: the part of the frame a renderer can change at all
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startServer } from './serve.mjs';

const argv = process.argv.slice(2), flag = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const which = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'all';
const MODE = flag('mode', 'both'), RSEL = flag('r', 'base'), FRAMES = +flag('frames', 300), THROTTLE = +flag('throttle', 6);
const RUNS = +flag('runs', RSEL === 'ab' ? 3 : 1), ONLY = flag('scn', null), HEADED = !!flag('headed', false), JSON_OUT = flag('json', null);
const VIEW = { width: 1366, height: 768 }, ARG = flag('arg', null);

// ---- runs inside the page, before the game's own scripts ----
function pageInit(seed) {
    // the same "random" for both renderers, and a device that reports itself as a 4 GB two-core Chromebook
    let s = seed >>> 0; Math.random = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    try { Object.defineProperty(navigator, 'deviceMemory', { get: () => 4 }); Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }); } catch (e) { }
    const B = window.__bench = { on: false, ts: -1, cur: 0, sub: 0, gpu: 0, frames: [], want: 0, skip: 0, done: null, rendered: false, noRender: false, r: null, px: new Uint8Array(4), errs: [] };
    addEventListener('error', e => B.errs.push(String(e.message)));
    B.reseed = v => { s = v >>> 0; };
    B.flush = () => {
        if (B.ts < 0) return;
        if (B.skip > 0) B.skip--; else B.frames.push([B.cur, B.sub, B.gpu]);
        B.cur = B.sub = B.gpu = 0;
        if (B.on && B.frames.length >= B.want) { B.on = false; B.ts = -1; const d = B.done; B.done = null; d && d(B.frames); }
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(ts => {
        if (!B.on) return cb(ts);
        if (ts !== B.ts) { B.flush(); if (!B.on) return cb(ts); B.ts = ts; }
        const t0 = performance.now(); cb(ts); const t1 = performance.now(); B.cur += t1 - t0;
        if (B.rendered) {       // wait for the GPU so its time is counted in this frame
            B.rendered = false; const gl = B.r && B.r.getContext && B.r.getContext();
            if (gl) { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, B.px); B.gpu += performance.now() - t1; }
        }
    });
    B.wrap = r => {         // time renderer.render (three's WebGLRenderer or the HG3D facade: same call)
        if (!r || r.__benchWrapped) return; r.__benchWrapped = true; B.r = r; const orig = r.render;
        r.render = function () { const t = performance.now(); let out; if (!B.noRender) out = orig.apply(this, arguments); B.sub += performance.now() - t; B.rendered = true; return out; };
    };
    B.run = (frames, skip) => new Promise(res => { B.frames = []; B.want = frames; B.skip = skip; B.cur = B.sub = B.gpu = 0; B.ts = -1; B.done = res; B.on = true; });
}

// ---- the games: how to reach the renderer and how to start a busy, repeatable scene ----
const wait = ms => new Promise(r => setTimeout(r, ms));
const GAMES = {
    mayhem: {
        dir: 'Mayhem Marathon', ready: () => !!window.__mayhem, renderer: () => window.__mayhem.GFX.renderer,
        dbg: () => { const s = window.__mayhem.state(); return (window.__mayhem.GFX.hg ? 'HG3D ' : 'three ') + (s.round ? s.round.rid + ' ' + s.round.phase + ' n=' + s.round.n + ' q=' + window.__mayhem.GFX.q : s.screen); },
        info: () => { const i = window.__mayhem.GFX.info; return { calls: i.calls, tris: i.tris }; },
        scenarios: {
            'race-med': { desc: 'Spin Cycle race, 23 bots, Medium (the default)', setup: async () => { const H = window.__mayhem; H.quality('med'); H.startRound('spin', { bots: 23 }); H.autopilot(true); H.step(5); } },
            'round': { desc: 'any round: --arg <round id>[,quality]', setup: async a => { const H = window.__mayhem, p = String(a || 'spin').split(','); H.quality(p[1] || 'med'); H.startRound(p[0], { bots: 23 }); H.autopilot(true); H.step(5); } },
            'race-low': { desc: 'Spin Cycle race, 23 bots, Low', setup: async () => { const H = window.__mayhem; H.quality('low'); H.startRound('spin', { bots: 23 }); H.autopilot(true); H.step(5); } }
        }, settle: 2500,
        freeze: async () => { const H = window.__mayhem; H.manual(true); H.step(7); },
        redraw: () => { window.__mayhem.renderInfo(); return window.__mayhem.GFX.renderer.getContext(); },
        view: () => ({ scene: window.__mayhem.GFX.scene, camera: window.__mayhem.GFX.cam, renderer: window.__mayhem.GFX.renderer })
    },
    steel: {
        dir: 'Steel Storm', ready: () => !!window.__steelstorm, renderer: () => window.__steelstorm.renderer,
        dbg: () => window.__steelstorm.state + ' ents=' + window.__steelstorm.ents().length + ' q=' + window.__steelstorm.save.settings.quality,
        info: () => { const i = window.__steelstorm.renderer.info.render; return { calls: i.calls, tris: i.triangles }; },
        scenarios: {
            'tdm-low': { desc: 'Team battle with bots, Low (where auto quality ends up)', setup: async () => { const H = window.__steelstorm; H.autoQ(false); H.setQuality('low'); H.startMatch({ mode: 'tdm', wx: Object.keys(H.WX)[0] }); H.autoQ(false); } },
            'tdm-med': { desc: 'Team battle with bots, Medium (the default)', setup: async () => { const H = window.__steelstorm; H.autoQ(false); H.setQuality('med'); H.startMatch({ mode: 'tdm', wx: Object.keys(H.WX)[0] }); H.autoQ(false); } }
        }, settle: 4000
    },
    frontline: {
        dir: 'Frontline', query: 'debug', ready: () => !!window.__fl, renderer: () => window.__fl.renderer,
        dbg: () => { const H = window.__fl; return H.W ? 'units=' + H.W.units.length + ' gfx=' + H.SET.gfx + ' lvl=' + H.SET.level + ' weak=' + H.GPU.weak + ' sh=' + H.SET.shadows : 'no world'; },
        info: () => { const r = window.__fl.renderer, i = r.info && r.info.render; return i ? { calls: i.calls, tris: i.triangles, units: window.__fl.W ? window.__fl.W.units.length : 0 } : {}; },
        scenarios: {
            'battle': { desc: 'Skirmish with 120 extra units fighting, Auto graphics', setup: async () => {
                const H = window.__fl; H.startGame(H.skToCfg ? H.skToCfg(H.defaultSK()) : null, {}); const t0 = Date.now(); while (!(H.W && H.W.units && H.W.M) && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 200));
                const W = H.W, types = Object.keys(H.UT).slice(0, 6); for (let i = 0; i < 120; i++) { try { H.spawn(types[i % types.length], i % 2, W.M.w * (0.42 + 0.16 * Math.random()), W.M.d * (0.42 + 0.16 * Math.random())); } catch (e) { } }
            } }
        }, settle: 4000
    },
    blocky: {
        dir: 'Blocky Shooter V2', ready: () => !!(window.__blocky && window.__blocky.state), renderer: () => window.__blocky.renderer,
        dbg: () => { const S = window.__blocky.state; return S.currentGameState + ' enemies=' + S.enemies.length + ' tier=' + S.Q.tier + ' lite=' + S.Q.lite + ' env=' + S.Q.env + ' scale=' + (+S.dynScale).toFixed(2) + ' wave=' + S.waveActive; },
        info: () => window.__blocky.info,
        scenarios: {
            'fight-t1': { desc: 'Wave fight, Auto tier 1 (first low-end tier: PBR + env map)', store: { hgdev_blocky_autotier: '1' }, setup: async () => { const B = window.__blocky; B.debug(true); B.god(true); B.start(); } },
            'fight-t3': { desc: 'Wave fight, Auto tier 3 (fastest tier)', store: { hgdev_blocky_autotier: '3' }, setup: async () => { const B = window.__blocky; B.debug(true); B.god(true); B.start(); } }
        }, settle: 9000
    },
    sovereign: {
        dir: 'Sovereign', ready: () => !!(window.__sov && window.__sov.ready), renderer: () => window.__sov.Globe.renderer,
        dbg: () => { const i = window.__sov.info(); return i.screen + ' lod=' + i.lod + ' alt=' + (+i.alt).toFixed(2) + ' level=' + i.level; },
        info: () => { const i = window.__sov.Globe.renderer.info.render; return { calls: i.calls, tris: i.triangles }; },
        scenarios: {
            'spin': { desc: 'Globe turning (a draw every frame)', setup: async () => { const S = window.__sov, tick = () => { S.Cam.lon = ((S.Cam.lon || 0) + 0.25) % 360; S.Globe.dirty = true; requestAnimationFrame(tick); }; requestAnimationFrame(tick); } }
        }, settle: 3000
    }
};

const LAUNCH = {
    cpu: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
    fill: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
};
const COMMON = ['--enable-precise-memory-info', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required', '--mute-audio'];
const UA = 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const cdn = new Map();

const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);

async function measure(browser, base, key, scnName, mode, r) {
    const G = GAMES[key], scn = G.scenarios[scnName];
    const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, userAgent: UA });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => route.abort());
    await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@/, async route => {       // three.js: fetched once, then from memory
        const u = route.request().url();
        try { if (!cdn.has(u)) { const resp = await route.fetch(); cdn.set(u, { status: resp.status(), body: await resp.body(), contentType: 'text/javascript' }); } await route.fulfill(cdn.get(u)); } catch (e) { await route.abort(); }
    });
    await page.addInitScript(pageInit, 12345);
    if (scn.store) await page.addInitScript(o => { for (const k in o) localStorage.setItem(k, o[k]); }, scn.store);
    const q = [G.query, r && r !== 'base' ? 'r=' + r : ''].filter(Boolean).join('&');
    const t0 = Date.now();
    await page.goto(base + encodeURIComponent(G.dir) + '/index.html' + (q ? '?' + q : ''));
    await page.waitForFunction(G.ready, null, { timeout: 90000 });
    const loadMs = Date.now() - t0;
    const cdp = await ctx.newCDPSession(page);
    const glName = await page.evaluate(() => { try { const c = document.createElement('canvas'), gl = c.getContext('webgl2'), e = gl.getExtension('WEBGL_debug_renderer_info'); const n = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; const l = gl.getExtension('WEBGL_lose_context'); l && l.loseContext(); return n; } catch (e) { return 'none'; } });
    await page.evaluate(scn.setup, ARG);
    await wait(G.settle);
    await page.evaluate(src => { window.__bench.wrap((0, eval)('(' + src + ')')()); }, G.renderer.toString());
    if (mode === 'cpu' && THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    const frames = await page.evaluate(([n, skip]) => window.__bench.run(n, skip), [FRAMES, 60]);
    let off = null;
    if (r === 'base' || !r) {       // the same scene with drawing switched off: what is left is game logic
        await page.evaluate(() => { window.__bench.noRender = true; });
        off = await page.evaluate(([n, skip]) => window.__bench.run(n, skip), [Math.min(FRAMES, 150), 20]);
        await page.evaluate(() => { window.__bench.noRender = false; });
    }
    if (mode === 'cpu' && THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    // GL calls per frame: a hardware-independent measure of the work handed to the browser's GPU process
    const glCalls = await page.evaluate(async () => {
        const P = WebGL2RenderingContext.prototype, saved = {}; let n = 0, frames = 0;
        for (const k of Object.getOwnPropertyNames(P)) { const d = Object.getOwnPropertyDescriptor(P, k); if (d && typeof d.value === 'function') { saved[k] = d.value; P[k] = function () { n++; return saved[k].apply(this, arguments); }; } }
        await new Promise(res => { const tick = () => { if (++frames > 30) return res(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
        for (const k in saved) P[k] = saved[k];
        return Math.round(n / 30);
    }).catch(() => null);
    await wait(120);
    const info = await page.evaluate(G.info).catch(() => ({}));
    const dbg = G.dbg ? await page.evaluate(G.dbg).catch(e => 'dbg failed: ' + String(e.message).slice(0, 80)) : '';
    const heap = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0);
    const berrs = await page.evaluate(() => window.__bench.errs.slice(0, 3));
    await ctx.close();
    const total = frames.map(f => f[0] + f[2]), work = frames.map(f => f[0]), sub = frames.map(f => f[1]), gpu = frames.map(f => f[2]);
    const row = { game: key, scn: scnName, mode, r: r || 'base', total: med(total), p95: pct(total, 0.95), work: med(work), sub: med(sub), gpu: med(gpu), share: 0, logic: off ? med(off.map(f => f[0])) : null, glCalls, dbg, calls: info.calls, tris: info.tris, heap, loadMs, gl: glName, errs: errs.concat(berrs).slice(0, 3) };
    row.share = row.total ? (row.sub + row.gpu) / row.total : 0;
    return row;
}

// one picture, three.js on the left and HG3D on the right, same scene: for the "does it look as good" check
async function sideBySide(browser, base, key, scnName, out) {
    const G = GAMES[key], scn = G.scenarios[scnName];
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 450 }, deviceScaleFactor: 1, userAgent: UA });
    const page = await ctx.newPage(), errs = [];
    page.on('pageerror', e => errs.push(e.message.slice(0, 200))); page.on('console', m => { if (m.type() === 'warning' && /HG3D/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => route.abort());
    await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@/, async route => { const u = route.request().url(); try { if (!cdn.has(u)) { const resp = await route.fetch(); cdn.set(u, { status: resp.status(), body: await resp.body(), contentType: 'text/javascript' }); } await route.fulfill(cdn.get(u)); } catch (e) { await route.abort(); } });
    await page.addInitScript(pageInit, 12345);
    if (scn.store) await page.addInitScript(o => { for (const k in o) localStorage.setItem(k, o[k]); }, scn.store);
    const url = r => base + encodeURIComponent(G.dir) + '/index.html?' + [G.query, 'r=' + r].filter(Boolean).join('&');
    await page.goto(base + 'tools/bench/pair.html');
    await page.evaluate(([a, b]) => { document.body.innerHTML = '<iframe src="' + a + '" style="position:absolute;left:0;top:0;width:800px;height:450px;border:0"></iframe><iframe src="' + b + '" style="position:absolute;left:800px;top:0;width:800px;height:450px;border:0"></iframe>'; }, [url('three'), url('hg')]);
    await wait(500);
    const frames = page.frames().filter(f => /[?&]r=(three|hg)/.test(f.url()));
    // freeze right after the start (same simulation steps in both, nothing in real time), then let the camera settle
    for (const f of frames) await f.waitForFunction(G.ready, null, { timeout: 90000 });
    for (const f of frames) await f.evaluate(async ([a, b, c]) => { window.__bench.reseed(777); await (0, eval)('(' + a + ')')(c); if (b) await (0, eval)('(' + b + ')')(c); }, [scn.setup.toString(), G.freeze ? G.freeze.toString() : null, ARG]);
    await wait(G.settle + 1500);
    await page.screenshot({ path: out });
    const dbg = []; for (const f of frames) dbg.push(/r=hg/.test(f.url()) ? 'hg' : 'three', G.dbg ? await f.evaluate(G.dbg).catch(() => '?') : '');
    console.log('saved ' + out + '  [' + dbg.join(' ') + ']' + (errs.length ? '  MESSAGES: ' + [...new Set(errs)].slice(0, 6).join(' || ') : ''));
    // numbers instead of eyeballing: both canvases reduced to a 160x90 grid of average colours and compared
    if (G.redraw) {
        const grid = [];
        for (const f of frames) grid.push(await f.evaluate(src => {
            const gl = (0, eval)('(' + src + ')')(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
            const GW = 160, GH = 90, out = new Array(GW * GH * 3).fill(0), cnt = new Array(GW * GH).fill(0);
            for (let y = 0; y < h; y++) { const gy = Math.min(GH - 1, Math.floor(y * GH / h)); for (let x = 0; x < w; x++) { const g = gy * GW + Math.min(GW - 1, Math.floor(x * GW / w)), i = (y * w + x) * 4; out[g * 3] += px[i]; out[g * 3 + 1] += px[i + 1]; out[g * 3 + 2] += px[i + 2]; cnt[g]++; } }
            for (let g = 0; g < GW * GH; g++) { const c = cnt[g] || 1; out[g * 3] /= c; out[g * 3 + 1] /= c; out[g * 3 + 2] /= c; }
            return out;
        }, G.redraw.toString()));
        const a = grid[0], b = grid[1]; let sum = 0, big = 0; const ma = [0, 0, 0], mb = [0, 0, 0];
        for (let g = 0; g < a.length; g += 3) { const d = (Math.abs(a[g] - b[g]) + Math.abs(a[g + 1] - b[g + 1]) + Math.abs(a[g + 2] - b[g + 2])) / 3; sum += d; if (d > 20) big++; for (let k = 0; k < 3; k++) { ma[k] += a[g + k]; mb[k] += b[g + k]; } }
        const n = a.length / 3;
        console.log('look: mean colour difference ' + (sum / n).toFixed(1) + ' of 255, ' + (big / n * 100).toFixed(1) + '% of the picture differs clearly; average colour three ' + ma.map(v => Math.round(v / n)).join(',') + ' vs hg ' + mb.map(v => Math.round(v / n)).join(','));
    }
    await ctx.close();
}

// The strict look check: ONE page running HG3D, paused; the very same scene object is then also drawn by a
// three.js WebGLRenderer on a second canvas, and the two pictures are compared. Nothing but the renderer differs.
async function sameState(browser, base, key, scnName, arg, out) {
    const G = GAMES[key], scn = G.scenarios[scnName];
    const ctx = await browser.newContext({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1, userAgent: UA });
    const page = await ctx.newPage(), msgs = [];
    page.on('pageerror', e => msgs.push(e.message.slice(0, 200))); page.on('console', m => { if (/HG3D/.test(m.text())) msgs.push(m.text().slice(0, 300)); });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, route => route.abort());
    await page.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\/three@/, async route => { const u = route.request().url(); try { if (!cdn.has(u)) { const resp = await route.fetch(); cdn.set(u, { status: resp.status(), body: await resp.body(), contentType: 'text/javascript' }); } await route.fulfill(cdn.get(u)); } catch (e) { await route.abort(); } });
    await page.addInitScript(pageInit, 12345);
    if (scn.store) await page.addInitScript(o => { for (const k in o) localStorage.setItem(k, o[k]); }, scn.store);
    await page.goto(base + encodeURIComponent(G.dir) + '/index.html?' + [G.query, 'r=hg'].filter(Boolean).join('&'));
    await page.waitForFunction(G.ready, null, { timeout: 90000 });
    await page.evaluate(async ([a, b, c]) => { window.__bench.reseed(777); await (0, eval)('(' + a + ')')(c); if (b) await (0, eval)('(' + b + ')')(c); }, [scn.setup.toString(), G.freeze ? G.freeze.toString() : null, arg]);
    await wait(G.settle + 800);
    const res = await page.evaluate(async ([viewSrc, redrawSrc, show]) => {
        if (redrawSrc) (0, eval)('(' + redrawSrc + ')')();
        const v = (0, eval)('(' + viewSrc + ')')(), T = await import('three'), R = v.renderer, gl = R.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        if (!R.isHG3D) return { err: 'this page is not running HG3D' };
        R.render(v.scene, v.camera); const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
        const c2 = document.createElement('canvas'), r2 = new T.WebGLRenderer({ canvas: c2, antialias: false, preserveDrawingBuffer: true });
        r2.setPixelRatio(1); r2.setSize(w, h, false); r2.outputColorSpace = R.outputColorSpace; r2.toneMapping = R.toneMapping; r2.toneMappingExposure = R.toneMappingExposure;
        r2.shadowMap.enabled = R.shadowMap.enabled; r2.shadowMap.type = R.shadowMap.type; if (v.clear !== undefined) r2.setClearColor(v.clear);
        r2.render(v.scene, v.camera); r2.render(v.scene, v.camera);
        const g2 = r2.getContext(), b = new Uint8Array(w * h * 4); g2.readPixels(0, 0, w, h, g2.RGBA, g2.UNSIGNED_BYTE, b);
        let sum = 0, big = 0, n = w * h; const ma = [0, 0, 0], mb = [0, 0, 0];
        for (let i = 0; i < n * 4; i += 4) { const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3; sum += d; if (d > 24) big++; for (let k = 0; k < 3; k++) { ma[k] += a[i + k]; mb[k] += b[i + k]; } }
        if (show) {      // put both pictures (and where they differ) on screen for a screenshot: three | HG3D | difference x4
            const mk = (px, x, diff) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.style.cssText = 'position:fixed;top:0;left:' + x + 'px;width:' + Math.round(w / 2) + 'px;height:' + Math.round(h / 2) + 'px;z-index:99999'; const g = c.getContext('2d'), im = g.createImageData(w, h);
                for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const s = ((h - 1 - y) * w + xx) * 4, d = (y * w + xx) * 4; if (diff) { for (let k = 0; k < 3; k++) im.data[d + k] = Math.min(255, Math.abs(a[s + k] - b[s + k]) * 4); } else { im.data[d] = px[s]; im.data[d + 1] = px[s + 1]; im.data[d + 2] = px[s + 2]; } im.data[d + 3] = 255; }
                g.putImageData(im, 0, 0); document.body.appendChild(c); };
            const bg = document.createElement('div'); bg.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99998'; document.body.appendChild(bg);
            mk(b, 0, false); mk(a, Math.round(w / 2), false); mk(a, 0, true); document.body.lastChild.style.top = Math.round(h / 2) + 'px';
        }
        r2.dispose();
        return { mean: sum / n, big: big / n * 100, three: mb.map(x => Math.round(x / n)), hg: ma.map(x => Math.round(x / n)), failed: R.failed };
    }, [G.view.toString(), G.redraw ? G.redraw.toString() : null, !!out]);
    if (out) await page.screenshot({ path: out });
    const dbg = G.dbg ? await page.evaluate(G.dbg).catch(() => '?') : '';
    console.log((arg || scnName).toString().padEnd(12) + (res.err ? res.err : 'difference ' + res.mean.toFixed(2) + ' of 255, ' + res.big.toFixed(2) + '% of pixels clearly off; average colour three ' + res.three.join(',') + ' / HG3D ' + res.hg.join(',')) + '  [' + dbg + ']' + (res.failed ? '  FAILED: ' + res.failed : '') + (msgs.length ? '  MESSAGES: ' + [...new Set(msgs)].slice(0, 5).join(' || ') : ''));
    await ctx.close();
    return res;
}

function show(row) {
    console.log([row.game.padEnd(9), row.scn.padEnd(10), row.mode.padEnd(4), String(row.r).padEnd(5),
        'total ' + f1(row.total).padStart(6), 'p95 ' + f1(row.p95).padStart(6), 'work ' + f1(row.work).padStart(6), 'sub ' + f1(row.sub).padStart(5), 'gpu ' + f1(row.gpu).padStart(5),
        'share ' + String(Math.round(row.share * 100)).padStart(3) + '%', row.logic != null ? 'logic ' + f1(row.logic).padStart(5) : '', 'gl ' + (row.glCalls ?? '-'), 'calls ' + (row.calls ?? '-'), 'tris ' + (row.tris ?? '-'), 'heap ' + f1(row.heap) + 'MB'].join('  ')
        + (row.dbg ? '  [' + row.dbg + ']' : '') + (row.errs.length ? '  ERR ' + row.errs.join(' | ') : ''));
}

const { server, base } = await startServer(0);
const SHOT = flag('shot', null);
if (SHOT) {
    const browser = await chromium.launch({ headless: !HEADED, args: LAUNCH[MODE === 'fill' ? 'fill' : 'cpu'].concat(COMMON) });
    const key = which.split(',')[0], scnName = ONLY || Object.keys(GAMES[key].scenarios)[0];
    try { await sideBySide(browser, base, key, scnName, SHOT); } catch (e) { console.log('shot failed: ' + String(e.message).split('\n')[0].slice(0, 300)); }
    await browser.close(); server.close(); process.exit(0);
}
if (flag('same', false)) {          // --same [f.png]  [--arg a+b+c]: the strict look check, one line per arg
    const browser = await chromium.launch({ headless: !HEADED, args: LAUNCH[MODE === 'fill' ? 'fill' : 'cpu'].concat(COMMON) });
    const key = which.split(',')[0], scnName = ONLY || Object.keys(GAMES[key].scenarios)[0], out = flag('same') === true ? null : flag('same');
    for (const a of (ARG ? String(ARG).split('+') : [null])) { try { await sameState(browser, base, key, scnName, a, out); } catch (e) { console.log((a || scnName) + ' failed: ' + String(e.message).split('\n')[0].slice(0, 300)); } }
    await browser.close(); server.close(); process.exit(0);
}
const rows = [], keys = which === 'all' ? Object.keys(GAMES) : which.split(',');
const modes = MODE === 'both' ? ['cpu', 'fill'] : [MODE];
let failed = false;
for (const mode of modes) {
    const browser = await chromium.launch({ headless: !HEADED, args: LAUNCH[mode].concat(COMMON) });
    for (const key of keys) {
        const G = GAMES[key]; if (!G) { console.log('unknown game ' + key); continue; }
        for (const scnName of Object.keys(G.scenarios)) {
            if (ONLY && ONLY !== scnName) continue;
            try {
                if (RSEL === 'ab') {
                    const acc = { three: [], hg: [] };
                    for (let i = 0; i < RUNS; i++) for (const r of (i % 2 ? ['hg', 'three'] : ['three', 'hg'])) { const row = await measure(browser, base, key, scnName, mode, r); acc[r].push(row); rows.push(row); show(row); }
                    const m = (r, k) => med(acc[r].map(x => x[k])), dT = 1 - m('hg', 'total') / m('three', 'total'), dP = 1 - m('hg', 'p95') / m('three', 'p95'), dH = m('hg', 'heap') - m('three', 'heap');
                    const verdict = { game: key, scn: scnName, mode, verdict: true, three: m('three', 'total'), hg: m('hg', 'total'), three95: m('three', 'p95'), hg95: m('hg', 'p95'), gain: dT, gain95: dP, heapDelta: dH };
                    rows.push(verdict);
                    console.log(`  => ${key} ${scnName} ${mode}: median ${f1(verdict.three)} -> ${f1(verdict.hg)} ms (${Math.round(dT * 100)}% faster), p95 ${f1(verdict.three95)} -> ${f1(verdict.hg95)} ms (${Math.round(dP * 100)}% faster), heap ${dH >= 0 ? '+' : ''}${f1(dH)} MB`);
                } else for (let i = 0; i < RUNS; i++) { const row = await measure(browser, base, key, scnName, mode, RSEL); rows.push(row); show(row); }
            } catch (e) { failed = true; console.log(`${key} ${scnName} ${mode}: FAILED ${String(e.message).split('\n')[0].slice(0, 200)}`); }
        }
    }
    await browser.close();
}
server.close();
if (rows.length) console.log('GL: ' + [...new Set(rows.filter(r => r.gl).map(r => r.mode + ' = ' + r.gl))].join('  |  '));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
