// ============================================================
// Proof Slice: the realistic look, tested small, before anything is built at scale (.claude/HANDOFF.md, "Next big thing").
// Everything is drawn by HG3D alone (no three.js). The light is baked in Blender; art/proof/*.blend -> assets/*.hgm with
// tools/blender/hg_export.py. Two slices: the Yard (20-yard.js: a map, a gun, an enemy) and the Range (30-tank.js: a tank
// on a terrain tile). The menu's speed tests are how it is judged on a real Chromebook: 30 FPS at the slowest.
// ============================================================
const $ = id => document.getElementById(id);
const canvas = $('view'), Q = new URLSearchParams(location.search), M4 = HG3D.M4;
// the paste-in loader (loader.html) runs this page inside jsfiddle, so it says where the asset files are and which test build this is
const BASE = window.HG_BASE || '', BUILD = window.HG_PROOF || 0;
const R = HG3D.createRenderer({ canvas });
const App = { mode: null, name: '', modes: {}, paused: true, demo: false, locked: false, basePR: 1, scale: 1, fps: 0, ms: 0, showStats: Q.get('stats') !== '0', testing: false, errors: [] };
if (R) { R.toneMapping = 4; R.outputColorSpace = 'srgb'; }
else $('load').textContent = 'This device cannot run WebGL2, so the slice cannot start here.';
addEventListener('error', e => { App.errors.push(String(e.message)); });
addEventListener('unhandledrejection', e => { App.errors.push(String(e.reason && e.reason.message || e.reason)); });

// ---- picture size: no more pixels than a Chromebook screen has; the governor makes it smaller when frames are slow
function resize() {
    if (!R) return;
    const w = innerWidth, h = innerHeight; App.basePR = +Q.get('pr') || Math.min(devicePixelRatio || 1, 1600 / w);       // ?pr=4: a huge picture, for measuring pixel cost
    R.setPixelRatio(App.basePR * App.scale); R.setSize(w, h, false);
    for (const k in App.modes) if (App.modes[k].resize) App.modes[k].resize(w / h);
}
addEventListener('resize', resize);
const gov = HG3D.governor({ min: 0.6, apply: s => { App.scale = s; if (R) R.setPixelRatio(App.basePR * s); }, paused: () => App.paused });

// ---- input
const keys = {}, mouse = { dx: 0, dy: 0, down: false, fired: false, right: false };
addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'F3') { App.showStats = !App.showStats; $('stats').classList.toggle('hidden', !App.showStats || !App.mode); e.preventDefault(); }
    if (e.code === 'Escape' && App.mode && !document.pointerLockElement) toMenu();
    if (App.mode && !App.paused && /^(Space|Arrow|Tab)/.test(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = mouse.right = false; });
addEventListener('mousemove', e => { if (App.locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; } });
canvas.addEventListener('mousedown', e => { if (!App.mode || App.demo) return; if (!App.locked) lock(); else if (e.button === 0) { mouse.down = true; mouse.fired = true; } else if (e.button === 2) mouse.right = true; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; else if (e.button === 2) mouse.right = false; });
function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
document.addEventListener('pointerlockchange', () => {
    const was = App.locked; App.locked = document.pointerLockElement === canvas;
    if (was && !App.locked && App.mode && !App.demo) toMenu();           // Esc lets the mouse go: back to the menu
    if (App.mode && App.mode.hint) App.mode.hint();
});

// ---- small shared things
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
// what the engine's tone mapping does to a colour (the fog colour has to be given already mapped)
function aces(c, exposure) {
    const k = exposure / 0.6, r = c[0] * k, g = c[1] * k, b = c[2] * k;
    const a = [0.59719 * r + 0.35458 * g + 0.04823 * b, 0.07600 * r + 0.90834 * g + 0.01566 * b, 0.02840 * r + 0.13383 * g + 0.83777 * b];
    for (let i = 0; i < 3; i++) { const v = a[i]; a[i] = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); }
    return [clamp(1.60475 * a[0] - 0.53108 * a[1] - 0.07367 * a[2], 0, 1), clamp(-0.10208 * a[0] + 1.10813 * a[1] - 0.00605 * a[2], 0, 1), clamp(-0.00327 * a[0] - 0.07276 * a[1] + 1.07602 * a[2], 0, 1)];
}
const lum = c => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
// the lights that give moving things their shape; how MUCH light comes from the baked probes (asset.probe)
function lightRig(scene) {
    const hemi = HG3D.light.hemi(0xffffff, 0xffffff, Math.PI), sun = HG3D.light.sun(0xffffff, Math.PI, [0, 1, 0]);
    hemi.color = { r: 1, g: 1, b: 1 }; hemi.groundColor = { r: 0.45, g: 0.45, b: 0.45 }; scene.add(hemi, sun);
    return { hemi, sun, set(dir, col) { const e = sun.matrixWorld.elements; e[12] = dir[0]; e[13] = dir[1]; e[14] = dir[2]; if (col) sun.color = { r: col[0], g: col[1], b: col[2] }; }, up(x, y, z) { const e = hemi.matrixWorld.elements; e[12] = x; e[13] = y; e[14] = z; } };
}
// a soft round picture drawn once (shadows under things, sparks, smoke)
function blobTexture(size, stops, srgb) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const s of stops) gr.addColorStop(s[0], s[1]); g.fillStyle = gr; g.fillRect(0, 0, size, size);
    return HG3D.texture(c, { srgb: !!srgb });
}
// one upright square, shared by everything that is a flat picture facing the camera
let QUAD = null;
function quadGeo() { return QUAD || (QUAD = HG3D.geometry({ position: new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) }, new Uint16Array([0, 1, 2, 0, 2, 3]))); }
// sky + fog + exposure from what the exporter measured in the Blender scene
function atmosphere(A, scene, fogNear, fogFar, bright) {
    const J = A.json, sunC = J.sun ? J.sun.color : [0, 0, 0], amb = J.ambient || [1, 1, 1], up = J.sun ? Math.max(J.sun.dir[1], 0.05) : 0;
    const exposure = (+Q.get('exp') || 1) * (bright || 0.9) / Math.max(0.05, lum(amb) + lum(sunC) * up);
    if (J.sky) {
        const dome = HG3D.skyDome(A.textures[J.sky.map], 450), k = J.sky.range; dome.material.color = { r: k, g: k, b: k }; scene.add(dome); scene.skyDome = dome;
        const f = aces(J.sky.horizon, exposure), fog = HG3D.fog(0, fogNear, fogFar); fog.color = { r: f[0], g: f[1], b: f[2] }; scene.fog = fog;
    }
    if (J.sun && J.sun.dir[1] > 0) {       // the sun itself: a glow in the sky where the baked shadows say it is (walls hide it)
        const d = J.sun.dir, c = J.sun.lampColor || [1, 0.9, 0.8], hex = v => Math.round(clamp(v, 0, 1) * 255), col = a => 'rgba(' + hex(0.6 + c[0] * 0.4) + ',' + hex(0.6 + c[1] * 0.4) + ',' + hex(0.6 + c[2] * 0.4) + ',' + a + ')';
        const g = HG3D.mesh(quadGeo(), HG3D.material({ lit: false, map: blobTexture(128, [[0, 'rgba(255,255,250,1)'], [0.03, col(0.8)], [0.08, col(0.14)], [0.2, col(0.03)], [1, col(0)]], true), transparent: true, blending: 2, depthWrite: false, fog: false, side: 2 }));
        g.frustumCulled = false; g.renderOrder = -1; scene.add(g); scene.sunGlow = g;
        let rx = d[2], rz = -d[0], l = Math.hypot(rx, rz) || 1; rx /= l; rz /= l; const ux = d[1] * rz, uy = d[2] * rx - d[0] * rz, uz = -d[1] * rx, s = 170, e = g.matrixWorld.elements;
        e[0] = rx * s; e[1] = 0; e[2] = rz * s; e[4] = ux * s; e[5] = uy * s; e[6] = uz * s; e[8] = d[0]; e[9] = d[1]; e[10] = d[2];
    }
    return exposure;
}
// the sky and the sun stay round the camera
function skyFollow(scene, cw) {
    const dome = scene.skyDome, glow = scene.sunGlow;
    if (dome) { const e = dome.matrixWorld.elements; e[12] = cw[12]; e[13] = cw[13]; e[14] = cw[14]; }
    if (glow) { const e = glow.matrixWorld.elements; e[12] = cw[12] + e[8] * 380; e[13] = cw[13] + e[9] * 380; e[14] = cw[14] + e[10] * 380; }
}
// tiny synthesised sounds (no files)
const Snd = { ctx: null, noise: null,
    init() { if (this.ctx) return; try { const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C(); const b = this.ctx.createBuffer(1, 22050, 44100), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b; } catch (e) { this.ctx = null; } },
    shot(vol, low, dur) { const c = this.ctx; if (!c) return; const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(low * 6, t); f.frequency.exponentialRampToValueAtTime(low, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur); },
    tone(freq, vol, dur, type) { const c = this.ctx; if (!c) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur); } };

// ---- menu, modes, the loop
function toMenu() {
    if (App.mode && App.mode.stop) App.mode.stop();
    App.mode = null; App.paused = true; App.demo = false;
    if (document.pointerLockElement) document.exitPointerLock();
    $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('vig').classList.add('hidden'); $('stats').classList.add('hidden'); showResults();
}
async function start(name, demo) {
    const m = App.modes[name]; if (!m || !R) return false;
    for (const b of document.querySelectorAll('#menu button')) b.disabled = true;
    try {
        if (!m.loaded) { $('load').textContent = 'Loading ' + m.title + '...'; await m.load(); m.loaded = true; }
        $('load').textContent = '';
    } catch (e) { $('load').textContent = 'Could not load ' + m.title + ': ' + e.message; App.errors.push(String(e.message)); return false; }
    finally { for (const b of document.querySelectorAll('#menu button')) b.disabled = false; }
    App.mode = m; App.name = name; App.demo = !!demo; App.paused = false; resize();
    $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); $('vig').classList.remove('hidden'); $('stats').classList.toggle('hidden', !App.showStats);
    R.toneMappingExposure = m.exposure || 1;          // each slice was lit in its own Blender scene
    m.start(!!demo); R.compile(m.scene, m.camera);
    return true;
}
let lastTs = 0, accMs = 0, accN = 0, accT = 0;
function tick(dt) {
    const m = App.mode, a = performance.now();
    m.update(dt); m.render();
    mouse.dx = mouse.dy = 0; mouse.fired = false;
    accMs += performance.now() - a; accN++;
}
function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016); lastTs = ts;
    if (!App.mode || App.paused) return;
    tick(dt); accT += dt;
    if (accT >= 0.5) {
        App.fps = accN / accT; App.ms = accMs / accN; accMs = accN = accT = 0;
        if (App.showStats) { const i = R.info; $('stats').textContent = App.fps.toFixed(0) + ' FPS   ' + App.ms.toFixed(1) + ' ms\n' + App.calls + ' draws   ' + (App.tris / 1000).toFixed(1) + 'k tris\n' + (i.memory.textureBytes / 1048576).toFixed(0) + ' MB pictures   size ' + Math.round(App.scale * 100) + '%' + (App.mode.statLine ? '\n' + App.mode.statLine() : ''); }
    }
}
// a mode draws more than one scene per frame (the world, then the gun): add the numbers up
function draw(scene, camera, first) { if (first) { App.calls = 0; App.tris = 0; R.autoClear = true; } else R.autoClear = false; R.render(scene, camera); App.calls += R.info.render.calls; App.tris += R.info.render.triangles; }

// ---- the speed test: the slice plays itself for 20 seconds while every frame is timed
function runTest(name) {
    start(name, true).then(ok => {
        if (!ok) return; App.testing = true; let maxCalls = 0, maxTris = 0; const peek = setInterval(() => { maxCalls = Math.max(maxCalls, App.calls || 0); maxTris = Math.max(maxTris, App.tris || 0); }, 250);
        HG3D.speedTest({ game: 'proof-' + name, renderer: 'hg', gl: R.getContext(), seconds: +Q.get('secs') || 20, onDone: r => {
            clearInterval(peek); App.testing = false;
            const all = JSON.parse(localStorage.getItem('hgdev_proof') || '{}'); all[name] = Object.assign({ calls: maxCalls, tris: maxTris, mb: Math.round(R.info.memory.textureBytes / 1048576), scale: App.scale, w: canvas.width, h: canvas.height }, r);
            try { localStorage.setItem('hgdev_proof', JSON.stringify(all)); } catch (e) { }
            App.lastTest = all[name]; toMenu();
        } });
    });
}
function showResults() {
    let all = {}; try { all = JSON.parse(localStorage.getItem('hgdev_proof') || '{}'); } catch (e) { }
    const rows = Object.keys(all).map(k => { const r = all[k], ok = r.low >= 30; return '<tr><td>' + (App.modes[k] ? App.modes[k].title : k) + '</td><td>' + r.fps + ' FPS average</td><td class="' + (ok ? 'ok' : 'bad') + '">' + r.low + ' FPS at the slowest</td><td>' + r.ms + ' ms work</td><td>' + r.calls + ' draws, ' + Math.round(r.tris / 1000) + 'k triangles, ' + r.mb + ' MB, ' + r.w + 'x' + r.h + '</td></tr>'; });
    $('results').innerHTML = rows.length ? '<table>' + rows.join('') + '</table>' : '';
    // one line to copy back to whoever is tuning this: the build, the graphics chip, the screen and every result
    let chip = '?'; try { const g = R.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'); chip = x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) { }
    const line = k => { const r = all[k]; return k + ' ' + r.fps + '/' + r.low + ' fps ' + r.ms + ' ms ' + r.w + 'x' + r.h + ' size ' + Math.round((r.scale || 1) * 100) + '%'; };
    $('report').textContent = rows.length ? 'Report: build ' + (BUILD || 'local') + ' | ' + Object.keys(all).map(line).join(' | ') + ' | ' + chip + ' | screen ' + innerWidth + 'x' + innerHeight + ' @' + (devicePixelRatio || 1) + ' | ' + (navigator.deviceMemory || '?') + ' GB, ' + (navigator.hardwareConcurrency || '?') + ' cores' : (BUILD ? 'Test build ' + BUILD : '');
}
$('fs').onclick = () => { const d = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else d.requestFullscreen().catch(() => { }); } catch (e) { } };
for (const b of document.querySelectorAll('#menu button[data-go]')) b.onclick = () => { Snd.init(); const n = b.dataset.go; lock(); start(n, false); };
for (const b of document.querySelectorAll('#menu button[data-test]')) b.onclick = () => runTest(b.dataset.test);

// for tests and for looking around from the console
window.__proof = { App, R, HG3D, keys, mouse, start, toMenu, runTest, step(dt, n) { for (let i = 0; i < (n || 1); i++) tick(dt || 1 / 60); return App.calls; } };
