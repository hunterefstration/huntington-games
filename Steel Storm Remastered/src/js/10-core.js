// ============================================================
// STEEL STORM REMASTERED: the tank game on the new look (light baked in Blender, drawn by HG3D alone). This first part is
// the PROVING GROUND: one tank against waves of others on one terrain tile. The files, in the order they are joined:
//   10-core     the page, the renderer, input, sound, the loop (the same core Ashfall uses)
//   15-save     what is kept between visits
//   20-range    the terrain: heights, what is solid, smoke and dust, shadows
//   30-units    a tank: its parts, driving, laying the gun, shells and armour, the ones the computer drives
//   40-battle   the skirmish: waves, score, the HUD
//   60-ui       the menu, settings, pause, the end
// ============================================================
const $ = id => document.getElementById(id);
const canvas = $('view'), Q = new URLSearchParams(location.search), M4 = HG3D.M4;
// a loader page (jsfiddle, the launcher) says where the asset files are; opened from its own folder they are beside it
const BASE = window.HG_BASE || '', BUILD = window.HG_PROOF || window.HG_VERSION || 0, VERSION = 'R0.1';
// Where a file of assets/ lives. On the CDN the assets are split over several tags ("packs"), because one tag may hold 50 MB
// at most: packs.json beside the games (written by tools/proof-publish.mjs) says which tag has the files whose name starts
// with which word (yard_light.webp -> "ssr/yard"). With no packs.json the files sit beside the page.
const Packs = { map: null, slug: 'ssr' };
Packs.ready = (async () => { if (!/@[^\/]+\//.test(BASE)) return; try { const r = await fetch(BASE.replace(/[^\/]+\/$/, '') + 'packs.json'); if (r.ok) Packs.map = await r.json(); } catch (e) { } })();
const AST = file => { const t = Packs.map && Packs.map[Packs.slug + '/' + file.split(/[_.]/)[0]]; return (t ? BASE.replace(/@[^\/]+\//, '@' + t + '/') : BASE) + 'assets/' + file; };

const R = HG3D.createRenderer({ canvas });
const App = { screen: 'boot', game: null, paused: true, locked: false, demo: false, basePR: 1, scale: 1, fps: 0, ms: 0, calls: 0, tris: 0, showStats: Q.get('stats') === '1', errors: [], time: 0 };
if (R) { R.toneMapping = 4; R.outputColorSpace = 'srgb'; }
addEventListener('error', e => { App.errors.push(String(e.message)); });
addEventListener('unhandledrejection', e => { App.errors.push(String(e.reason && e.reason.message || e.reason)); });
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rand = (a, b) => a + Math.random() * (b - a);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- picture size: no more pixels than a Chromebook screen has; the governor makes it smaller when frames are slow
function resize() {
    if (!R) return;
    const w = innerWidth, h = innerHeight; App.basePR = +Q.get('pr') || Math.min(devicePixelRatio || 1, 1600 / w) * (Save.data.settings.quality === 'low' ? 0.75 : 1);
    R.setPixelRatio(App.basePR * App.scale); R.setSize(w, h, false);
    if (World.camera) World.resize(w / h);
}
addEventListener('resize', () => resize());
const gov = HG3D.governor({ min: 0.6, apply: s => { App.scale = s; if (R) R.setPixelRatio(App.basePR * s); }, paused: () => App.paused || !App.game });

// ---- input. keys = held now; hit = went down since the last frame. The mouse only counts while it is captured.
const keys = {}, hit = {}, mouse = { dx: 0, dy: 0, down: false, fired: false, right: false, wheel: 0 };
const Input = { aimOn: false,
    // aiming down the sight: the right button (held), or E, which a trackpad player can reach (pressed once, or held: a setting)
    aim() { return mouse.right || (Save.data.settings.aimToggle ? Input.aimOn : !!keys.KeyE); },
    typing() { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'); } };
addEventListener('keydown', e => {
    if (Input.typing()) return;
    if (!keys[e.code]) hit[e.code] = true; keys[e.code] = true;
    if (e.code === 'KeyE' && Save.data.settings.aimToggle && !e.repeat) Input.aimOn = !Input.aimOn;
    if (e.code === 'F3') { App.showStats = !App.showStats; $('stats').classList.toggle('hidden', !App.showStats || !App.game); e.preventDefault(); }
    if (App.game && /^(Space|Arrow|Tab|F1)/.test(e.code)) e.preventDefault();
    UI.key(e);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = mouse.right = false; });
addEventListener('mousemove', e => { if (App.locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; } });
canvas.addEventListener('mousedown', e => { if (!App.game || App.demo || App.paused) return; if (!App.locked) lock(); else if (e.button === 0) { mouse.down = true; mouse.fired = true; } else if (e.button === 2) mouse.right = true; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; else if (e.button === 2) mouse.right = false; });
addEventListener('wheel', e => { if (App.locked) mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
function lock() { App.lockAt = performance.now(); try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
document.addEventListener('pointerlockchange', () => {
    const was = App.locked; App.locked = document.pointerLockElement === canvas;
    if (was && !App.locked && App.game && !App.demo && !App.paused && !App.game.over && !App.game.shopOpen && performance.now() - (App.lockAt || 0) > 500) UI.pause(true);        // Esc lets the mouse go: pause (not the late echo of the crate letting it go, just before it was asked back)
    if (App.game && App.game.hint) App.game.hint();
});

// ---- small shared things for the picture
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
let QUAD = null;
function quadGeo() { return QUAD || (QUAD = HG3D.geometry({ position: new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) }, new Uint16Array([0, 1, 2, 0, 2, 3]))); }
const QE = new Float32Array(4);
function quatEuler(x, y, z) { const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2); QE[0] = s1 * c2 * c3 + c1 * s2 * s3; QE[1] = c1 * s2 * c3 - s1 * c2 * s3; QE[2] = c1 * c2 * s3 + s1 * s2 * c3; QE[3] = c1 * c2 * c3 - s1 * s2 * s3; return QE; }
// a frame draws more than one scene (the world, then the gun): add the numbers up
function draw(scene, camera, first) { if (first) { App.calls = 0; App.tris = 0; R.autoClear = true; } else R.autoClear = false; R.render(scene, camera); App.calls += R.info.render.calls; App.tris += R.info.render.triangles; }

// ---- sound: everything is synthesised (no files). Two volumes: effects and music.
const Snd = { ctx: null, noiseBuf: null, sfx: null, mus: null,
    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        try { const C = window.AudioContext || window.webkitAudioContext, c = this.ctx = new C(); const b = c.createBuffer(1, 44100, 44100), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
            const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6; comp.connect(c.destination);
            this.sfx = c.createGain(); this.mus = c.createGain(); this.sfx.connect(comp); this.mus.connect(comp); this.volumes(); } catch (e) { this.ctx = null; }
    },
    volumes() { if (!this.ctx) return; const s = Save.data.settings; this.sfx.gain.value = s.sfx * s.sfx; this.mus.gain.value = s.music * s.music * 0.7; },
    tone(freq, vol, dur, type, to, out) { const c = this.ctx; if (!c) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, to || freq * 0.5), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(out || this.sfx); o.start(t); o.stop(t + dur + 0.02); },
    // filtered noise: a crack (high start), a thud (low), a hiss; hp > 0 cuts the lows
    noise(vol, from, to, dur, hp, out) { const c = this.ctx; if (!c) return; const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4; f.type = 'lowpass'; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
        let n = s; if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; s.connect(h); n = h; } n.connect(f); f.connect(g); g.connect(out || this.sfx); s.start(t); s.stop(t + dur + 0.02); },
    // a gunshot from three layers: the crack, the body, the tail. p = { vol, crack, body, tail } from the weapon
    gun(p, far) { const v = (p.vol || 0.5) * (far === undefined ? 1 : far); this.noise(v, p.crack || 6000, 700, 0.07, 500); this.tone(p.body || 150, v * 0.9, 0.13, 'triangle', 45); this.noise(v * 0.35, 1800, 200, p.tail || 0.35); },
    ui(kind) { if (kind === 'hover') this.tone(1500, 0.03, 0.03, 'square', 1400); else if (kind === 'click') { this.tone(520, 0.1, 0.07, 'square', 780); this.noise(0.05, 5000, 1500, 0.04, 1500); } else if (kind === 'back') this.tone(420, 0.08, 0.09, 'square', 260); else if (kind === 'buy') { this.tone(660, 0.1, 0.09, 'triangle', 660); setTimeout(() => this.tone(990, 0.1, 0.16, 'triangle', 990), 80); } else if (kind === 'deny') this.tone(140, 0.12, 0.18, 'sawtooth', 110); },
    type() { this.tone(720 + Math.random() * 90, 0.07, 0.035, 'square', 640); },
    // the engine of the tank you drive: two saws an octave apart through a low filter; rev (0..1) raises the note and opens the filter
    engine(rev, on) { const c = this.ctx; if (!c) return; if (!this.eng) { if (!on) return; const o1 = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o1.type = o2.type = 'sawtooth'; f.type = 'lowpass'; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.sfx); o1.start(); o2.start(); this.eng = { o1, o2, f, g }; } const E = this.eng, t = c.currentTime, hz = 33 + rev * 44; E.o1.frequency.setTargetAtTime(hz, t, 0.12); E.o2.frequency.setTargetAtTime(hz * 2.02, t, 0.12); E.f.frequency.setTargetAtTime(170 + rev * 520, t, 0.15); E.g.gain.setTargetAtTime(on ? 0.09 + rev * 0.1 : 0, t, 0.2); },
    wind(on) { const c = this.ctx; if (!c) return; if (!on) { if (this.windG) this.windG.gain.setTargetAtTime(0, c.currentTime, 0.4); return; }
        if (!this.windG) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = this.windG = c.createGain(), l = c.createOscillator(), lg = c.createGain(); s.buffer = this.noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6; l.frequency.value = 0.11; lg.gain.value = 180; l.connect(lg); lg.connect(f.frequency); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfx); s.start(); l.start(); }
        this.windG.gain.setTargetAtTime(0.11, c.currentTime, 1.2); },
    groan(far) { const f = 70 + Math.random() * 50; this.tone(f, 0.16 * far, 0.7, 'sawtooth', f * 0.7); this.noise(0.05 * far, 500, 200, 0.5, 100); },
    boom(v) { this.tone(95, 0.9 * (v || 1), 1.3, 'sine', 26); this.noise(0.6 * (v || 1), 2500, 80, 0.9); this.noise(0.25 * (v || 1), 9000, 2000, 0.12, 2000); } };
// music: a small step sequencer (16 steps a bar). 'menu' is a slow, low drone with a far pulse; 'fight' adds drums and a driving bass.
const Music = { mode: '', step: 0, next: 0, timer: 0, bar: 0,
    set(mode) { if (mode === this.mode) return; this.mode = mode; if (!Snd.ctx) return; if (!this.timer) { this.next = Snd.ctx.currentTime + 0.1; this.timer = setInterval(() => this.pump(), 90); } },
    stop() { this.mode = ''; },
    pump() { const c = Snd.ctx; if (!c || !this.mode) return; const spb = this.mode === 'fight' ? 60 / 124 / 4 : 60 / 84 / 4; while (this.next < c.currentTime + 0.25) { this.play(this.step, this.next); this.next += spb; this.step = (this.step + 1) % 16; if (!this.step) this.bar++; } },
    note(t, freq, vol, dur, type, cut) { const c = Snd.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = type; o.frequency.setValueAtTime(freq, t); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, cut * 0.25), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(f); f.connect(g); g.connect(Snd.mus); o.start(t); o.stop(t + dur + 0.05); },
    hat(t, vol, dur) { const c = Snd.ctx, s = c.createBufferSource(), h = c.createBiquadFilter(), g = c.createGain(); s.buffer = Snd.noiseBuf; h.type = 'highpass'; h.frequency.value = 7000; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(h); h.connect(g); g.connect(Snd.mus); s.start(t); s.stop(t + dur + 0.02); },
    kick(t, vol) { const c = Snd.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.14); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.22); o.connect(g); g.connect(Snd.mus); o.start(t); o.stop(t + 0.25); },
    play(s, t) {
        const root = [55, 55, 46.25, 49][this.bar % 4];          // A, A, F#, G: a falling, uneasy line
        if (this.mode === 'menu') {
            if (s === 0) { this.note(t, root, 0.3, 3.2, 'sawtooth', 240); this.note(t, root * 1.5, 0.12, 3.2, 'sawtooth', 320); }
            if (s % 4 === 2) this.note(t, root * 4 * [1, 1.2, 1.5, 1.2][(s >> 2) % 4], 0.07, 0.5, 'triangle', 1400);
            if (s === 8 && this.bar % 2) this.kick(t, 0.5);
        } else {
            if (s % 4 === 0) this.kick(t, 0.75); if (s % 2 === 1) this.hat(t, s % 4 === 3 ? 0.1 : 0.05, 0.04); if (s === 4 || s === 12) { this.hat(t, 0.16, 0.12); this.note(t, 190, 0.2, 0.12, 'triangle', 900); }
            if ([0, 3, 6, 8, 11, 14].indexOf(s) >= 0) this.note(t, root * (s === 6 || s === 14 ? 2 : 1), 0.34, 0.2, 'sawtooth', 520);
            if (s === 0 && this.bar % 2 === 0) this.note(t, root * 2, 0.1, 1.7, 'sawtooth', 700);
        }
    } };

// ---- going over to another game of the family (its folder sits beside this one). Opened from a folder that is a plain
// page change; inside a loader page (jsfiddle) there is no address to go to, so this game shuts itself down and the
// other one is written into the same page, told where its files are the way the loader told this one.
async function leaveTo(dir) {
    if (!BASE) { location.href = '../' + dir + '/index.html'; return; }
    const base = BASE.replace(/[^\/]+\/$/, '') + dir + '/'; let html;
    try { const r = await fetch(base + 'index.html'); if (!r.ok) throw new Error('HTTP ' + r.status); html = await r.text(); } catch (e) { UI.fatal('Could not load it (' + e.message + ').', true); return; }
    App.dead = true; Music.stop(); clearInterval(Music.timer); try { if (typeof Net !== 'undefined') Net.reset(); } catch (e) { } try { if (Snd.ctx) Snd.ctx.close(); } catch (e) { } try { R.dispose(); } catch (e) { }
    const tag = '<script>window.HG_BASE = ' + JSON.stringify(base) + '; window.HG_PROOF = ' + JSON.stringify(window.HG_PROOF || 0) + ';<\/script>';
    document.open(); document.write(html.replace(/<head[^>]*>/i, m => m + tag)); document.close();
}
// ---- the loop
let lastTs = 0, accMs = 0, accN = 0, accT = 0;
const Ticker = { w: null, last: 0,
    start() { if (this.w) return; try { this.w = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},50)'], { type: 'text/javascript' }))); this.w.onmessage = () => this.beat(); } catch (e) { this.w = null; } },
    stop() { if (this.w) { this.w.terminate(); this.w = null; } },
    beat() { const now = performance.now(), dt = Math.min(0.1, (now - (this.last || now)) / 1000); this.last = now; if (!document.hidden || !App.game || App.paused || !App.game.net || !dt) return; App.game.update(dt); mouse.dx = mouse.dy = 0; mouse.fired = false; mouse.wheel = 0; for (const k in hit) delete hit[k]; } };
function tick(dt) {
    const a = performance.now(); App.time += dt;
    if (App.game && !App.paused) { App.game.update(dt); App.game.render(); }
    else if (App.screen === 'menu' && World.loaded && !App.game) World.flyBy(dt);
    mouse.dx = mouse.dy = 0; mouse.fired = false; mouse.wheel = 0; for (const k in hit) delete hit[k];
    accMs += performance.now() - a; accN++;
}
function frame(ts) {
    if (App.dead) return; requestAnimationFrame(frame);
    const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016); lastTs = ts;
    if (!R || (App.screen !== 'menu' && !(App.game && !App.paused))) return;
    tick(dt); accT += dt;
    if (accT >= 0.5) {
        App.fps = accN / accT; App.ms = accMs / accN; accMs = accN = accT = 0;
        if (App.showStats && App.game) { const i = R.info; $('stats').textContent = App.fps.toFixed(0) + ' FPS   ' + App.ms.toFixed(1) + ' ms\n' + App.calls + ' draws   ' + (App.tris / 1000).toFixed(1) + 'k tris\n' + (i.memory.textureBytes / 1048576).toFixed(0) + ' MB pictures   size ' + Math.round(App.scale * 100) + '%' + (App.game.statLine ? '\n' + App.game.statLine() : ''); }
    }
}
