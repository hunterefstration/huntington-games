// ============================================================
// NIGHTLINE: street racing at night, drawn by HG3D alone (no three.js). The owner, 2026-11-24: "make a racing game with
// the new engine. Prioritize looks." The city is one Blender-made, light-baked file (assets/<circuit>.hgm, made by
// tools/blender/make_nl_<circuit>.py through the centre line in art/nightline/tracks.json); everything that moves is lit
// where it stands from the file's baked light, and the picture gets HG3D's glow.
//   10-core   the page, the picture size, keys, sound          14-track  the centre line, where a car is on it, the fast line
//   20-world  the city, its lights on the wet road, particles  30-car    how a car drives and how it is drawn
//   40-race   the grid, the computer's drivers, laps, places   60-ui     menus, the dials, the results
// ============================================================
const $ = id => document.getElementById(id);
const canvas = $('view'), Q = new URLSearchParams(location.search), M4 = HG3D.M4;
const BASE = window.HG_BASE || '', BUILD = window.HG_PROOF || window.HG_VERSION || 0, VERSION = '0.1';
// The paste-in loader gives BASE (this game's folder at a build's tag). The asset files are published in packs of their own
// (tools/proof-publish.mjs: grouped by the first word of the file name); packs.json beside the game folders says which tag holds which.
const Packs = { map: null, slug: 'nightline' };
Packs.ready = (async () => { if (!/@[^\/]+\//.test(BASE)) return; try { const r = await fetch(BASE.replace(/[^\/]+\/$/, '') + 'packs.json'); if (r.ok) Packs.map = await r.json(); } catch (e) { } })();
const AST = file => { const t = Packs.map && Packs.map[Packs.slug + '/' + file.split(/[_.]/)[0]]; return (t ? BASE.replace(/@[^\/]+\//, '@' + t + '/') : BASE) + 'assets/' + file; };
const R = HG3D.createRenderer({ canvas });
const App = { screen: 'boot', paused: true, basePR: 1, scale: 1, lite: 0, fps: 0, ms: 0, calls: 0, tris: 0, errors: [], t: 0 };
if (R) { R.toneMapping = 4; R.outputColorSpace = 'srgb'; }
addEventListener('error', e => { App.errors.push(String(e.message)); });
addEventListener('unhandledrejection', e => { App.errors.push(String(e.reason && e.reason.message || e.reason)); });
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, rand = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = t => { if (!isFinite(t) || t <= 0) return '-:--.---'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(3); };

// ---- picture size: no more pixels than a Chromebook screen has; the governor makes it smaller when frames are slow.
// Glow is a look, so it never costs frames: the first time the picture has to shrink while glow is on, glow goes off
// and this device remembers (g: 0). ?glow=1 tries again, ?glow=0 forces it off.
const PERF_KEY = 'hg3d:perf:nightline'; let perf0 = {}; try { perf0 = JSON.parse(localStorage.getItem(PERF_KEY) || '{}') || {}; } catch (e) { }
App.scale = clamp(+perf0.s || 1, 0.6, 1); App.glowBad = Q.get('glow') === '1' ? false : perf0.g === 0; App.glow = !App.glowBad && Q.get('glow') !== '0';
let perfLive = false; const perfKeep = () => { if (!perfLive) return; try { localStorage.setItem(PERF_KEY, JSON.stringify({ s: App.scale, g: App.glowBad ? 0 : 1 })); } catch (e) { } };
function resize() {
    if (!R) return; const w = innerWidth, h = innerHeight; App.basePR = +Q.get('pr') || Math.min(devicePixelRatio || 1, 1600 / w);
    R.setPixelRatio(App.basePR * App.scale); R.setSize(w, h, false); if (World.camera) { World.camera.aspect = w / h; World.camera.updateProjection(); }
}
addEventListener('resize', resize);
const gov = HG3D.governor({ min: 0.6, start: App.scale, apply: s => { if (s < 1 && App.glow && perfLive) { App.glow = false; App.glowBad = true; } App.scale = s; if (R) R.setPixelRatio(App.basePR * s); perfKeep(); }, paused: () => App.paused });

// ---- keys (a racing game needs no mouse in play)
const keys = {}, hit = {};
addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (!keys[e.code]) hit[e.code] = true; keys[e.code] = true;
    if (/^(Space|Arrow|Tab)/.test(e.code)) e.preventDefault();
    UI.key(e);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// a gamepad, when one is plugged in (stick or pad to steer, right trigger gas, left trigger brake, A handbrake)
const Pad = { steer: 0, gas: 0, brake: 0, hand: false, on: false,
    read() { this.on = false; const ps = navigator.getGamepads ? navigator.getGamepads() : []; for (const p of ps) { if (!p || !p.connected) continue; const b = p.buttons, ax = p.axes[0] || 0; this.steer = Math.abs(ax) > 0.12 ? ax : (b[14] && b[14].pressed ? -1 : b[15] && b[15].pressed ? 1 : 0); this.gas = b[7] ? b[7].value : 0; this.brake = b[6] ? b[6].value : 0; this.hand = !!(b[0] && b[0].pressed); this.on = true; return; } this.steer = this.gas = this.brake = 0; this.hand = false; } };

// ---- small shared things
function aces(c, exposure) {
    const k = exposure / 0.6, r = c[0] * k, g = c[1] * k, b = c[2] * k;
    const a = [0.59719 * r + 0.35458 * g + 0.04823 * b, 0.07600 * r + 0.90834 * g + 0.01566 * b, 0.02840 * r + 0.13383 * g + 0.83777 * b];
    for (let i = 0; i < 3; i++) { const v = a[i]; a[i] = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); }
    return [clamp(1.60475 * a[0] - 0.53108 * a[1] - 0.07367 * a[2], 0, 1), clamp(-0.10208 * a[0] + 1.10813 * a[1] - 0.00605 * a[2], 0, 1), clamp(-0.00327 * a[0] - 0.07276 * a[1] + 1.07602 * a[2], 0, 1)];
}
const lum = c => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
function blobTexture(size, stops, srgb) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const s of stops) gr.addColorStop(s[0], s[1]); g.fillStyle = gr; g.fillRect(0, 0, size, size); return HG3D.texture(c, { srgb: !!srgb });
}
// Where a thing stands and how it is turned, written straight into a matrix (16 numbers, columns: left, up, forward, place).
// Yaw 0 looks along +z and a growing yaw turns LEFT (toward +x when heading +z), the same way round as the track's "left";
// pitch lifts the nose; roll > 0 drops the left side. Models are built +z forward, +y up, so their +x is their left.
function poseMatrix(e, x, y, z, yaw, pitch, roll, s) {
    const sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch || 0), cp = Math.cos(pitch || 0), sr = Math.sin(roll || 0), cr = Math.cos(roll || 0), k = s || 1;
    const fx = sy * cp, fy = sp, fz = cy * cp, lx = cy, lz = -sy, ux = fy * lz, uy = fz * lx - fx * lz, uz = -fy * lx;
    e[0] = (lx * cr - ux * sr) * k; e[1] = (-uy * sr) * k; e[2] = (lz * cr - uz * sr) * k; e[3] = 0;
    e[4] = (ux * cr + lx * sr) * k; e[5] = (uy * cr) * k; e[6] = (uz * cr + lz * sr) * k; e[7] = 0;
    e[8] = fx * k; e[9] = fy * k; e[10] = fz * k; e[11] = 0; e[12] = x; e[13] = y; e[14] = z; e[15] = 1; return e;
}

// ---- sound: all of it made here (no files). An engine is two saws and a square through a low-pass that opens with the
// revs; tyres are filtered noise; the wind is the same noise, lower.
const Snd = { ctx: null, noise: null, eng: null, vol: 0.8,
    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        try { const C = window.AudioContext || window.webkitAudioContext; this.ctx = new C(); const b = this.ctx.createBuffer(1, 44100, 44100), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = b; this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; }
    },
    setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
    tone(freq, vol, dur, type, to) { const c = this.ctx; if (!c) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02); },
    thud(vol) { const c = this.ctx; if (!c) return; const t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.25); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.32); },
    // the player's engine, tyres and wind run all the time a race is on
    engineOn() {
        const c = this.ctx; if (!c || this.eng) return; const E = this.eng = {}; E.out = c.createGain(); E.out.gain.value = 0; E.lp = c.createBiquadFilter(); E.lp.type = 'lowpass'; E.lp.frequency.value = 500; E.lp.Q.value = 1.2;
        E.o = [['sawtooth', 1, 0.5], ['sawtooth', 0.502, 0.42], ['square', 2.01, 0.12]].map(([type, mul, g]) => { const o = c.createOscillator(), gg = c.createGain(); o.type = type; o.frequency.value = 60 * mul; gg.gain.value = g; o.connect(gg); gg.connect(E.lp); o.start(); return { o, mul }; });
        E.lp.connect(E.out); E.out.connect(this.master);
        const mk = (type, f, q) => { const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); s.start(); return { s, fl, g }; };
        E.sq = mk('bandpass', 1500, 3.5); E.wind = mk('lowpass', 420, 0.4);
    },
    engine(rpm, load, slip, speed) {      // rpm 0..1, load 0..1 (the pedal), slip 0..1 (tyres letting go), speed in m/s
        const E = this.eng, c = this.ctx; if (!E) return; const t = c.currentTime, f = 48 + rpm * 165;
        for (const x of E.o) x.o.frequency.setTargetAtTime(f * x.mul, t, 0.03);
        E.lp.frequency.setTargetAtTime(380 + rpm * 2400 * (0.45 + load * 0.55), t, 0.05); E.out.gain.setTargetAtTime(0.11 + load * 0.1 + rpm * 0.05, t, 0.06);
        E.sq.g.gain.setTargetAtTime(Math.min(0.22, slip * 0.3), t, 0.05); E.sq.fl.frequency.setTargetAtTime(1200 + slip * 900, t, 0.1);
        E.wind.g.gain.setTargetAtTime(Math.min(0.2, speed / 380), t, 0.2); E.wind.fl.frequency.setTargetAtTime(300 + speed * 9, t, 0.2);
    },
    engineOff() { const E = this.eng; if (!E) return; const t = this.ctx.currentTime; E.out.gain.setTargetAtTime(0, t, 0.08); E.sq.g.gain.setTargetAtTime(0, t, 0.05); E.wind.g.gain.setTargetAtTime(0, t, 0.1); setTimeout(() => { try { for (const x of E.o) x.o.stop(); E.sq.s.stop(); E.wind.s.stop(); } catch (e) { } }, 500); this.eng = null; }
};

// ---- the loop: the race runs in fixed steps of 1/120 s (the tyres are stiff), the picture as often as it can
let lastTs = 0, accMs = 0, accN = 0, accT = 0, simAcc = 0;
const STEP = 1 / 120;
function tick(dt) {
    App.t += dt; Pad.read();
    if (!App.paused && Race.on) { simAcc = Math.min(simAcc + dt, 0.1); while (simAcc >= STEP) { Race.step(STEP); simAcc -= STEP; } }
    const a = performance.now();
    if (World.loaded) { Race.frame(dt); World.frame(dt); App.calls = 0; App.tris = 0; R.autoClear = true; R.render(World.scene, World.camera); App.calls = R.info.render.calls; App.tris = R.info.render.triangles; World.glowDraw(); }
    UI.frame(dt);
    for (const k in hit) delete hit[k];
    accMs += performance.now() - a; accN++;
}
function frame(ts) {
    requestAnimationFrame(frame); const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016); lastTs = ts; if (document.hidden) return;
    tick(dt); perfLive = !App.paused;
    accT += dt; if (accT >= 0.5) { App.fps = Math.round(accN / accT); App.ms = accMs / accN; accT = 0; accN = 0; accMs = 0; }
}
