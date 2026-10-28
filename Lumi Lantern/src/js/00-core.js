// ==========================================
// LUMI'S LANTERN - core: helpers, saves, settings, input, sound
// ==========================================
const TS = 32;                                   // one tile, in world pixels
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;
const approach = (v, t, d) => v < t ? Math.min(v + d, t) : Math.max(v - d, t);
const ease = { out: t => 1 - (1 - t) * (1 - t), inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) };
// a small seeded random, so a level's decoration is the same every time
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
const $ = id => document.getElementById(String(id).replace(/^#/, ''));
const fmtTime = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };

// ---------- save (one key, so the launcher's cloud saves carry it) ----------
const SAVE_KEY = 'lumi_save';
const SAVE = (() => {
    const blank = () => ({ v: 1, levels: {}, abilities: { double: false, wall: false, dash: false }, deaths: 0, sparks: 0, playTime: 0 });
    let d;
    try { d = Object.assign(blank(), JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') || {}); } catch (e) { d = blank(); }
    d.abilities = Object.assign(blank().abilities, d.abilities || {});
    return { d, write() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) {} } };
})();

// ---------- settings ----------
const SET_KEY = 'lumi_settings';
const settings = Object.assign({ music: 0.6, sfx: 0.8, quality: 'auto', hard: false, shake: true, touch: 'auto', timer: true },
    (() => { try { return JSON.parse(localStorage.getItem(SET_KEY) || '{}'); } catch (e) { return {}; } })());
const saveSettings = () => { try { localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch (e) {} };

// ---------- input: keyboard, gamepad, touch -> one set of actions ----------
const Input = (() => {
    const down = new Set(), pressed = new Set(), touch = new Set();
    const MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
        Space: 'jump', KeyZ: 'jump', KeyK: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash', KeyJ: 'dash', KeyC: 'dash',
        Escape: 'pause', KeyP: 'pause', KeyR: 'retry', Enter: 'ok' };
    const JUMP_TOO = { up: 1 };                            // W / Up also jump
    addEventListener('keydown', e => {
        const a = MAP[e.code]; if (!a) return;
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (['left', 'right', 'up', 'down', 'jump'].includes(a)) e.preventDefault();
        if (e.repeat) return;
        down.add(a); pressed.add(a); if (JUMP_TOO[a]) { down.add('jump'); pressed.add('jump'); }
    });
    addEventListener('keyup', e => { const a = MAP[e.code]; if (!a) return; down.delete(a); if (JUMP_TOO[a]) down.delete('jump'); });
    addEventListener('blur', () => { down.clear(); touch.clear(); });
    let padPrev = {};
    function pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const p = pads && [...pads].find(x => x && x.connected); if (!p) return {};
        const b = i => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes[0] || 0;
        const st = { left: ax < -0.4 || b(14), right: ax > 0.4 || b(15), up: (p.axes[1] || 0) < -0.6 || b(12), down: (p.axes[1] || 0) > 0.6 || b(13),
            jump: b(0) || b(3), dash: b(2) || b(1) || b(5) || b(7), pause: b(9), retry: b(8) };
        for (const k in st) if (st[k] && !padPrev[k]) pressed.add(k);
        padPrev = st; return st;
    }
    let pad = {};
    return {
        poll() { pad = pollPad(); },
        held: a => down.has(a) || touch.has(a) || !!pad[a],
        hit: a => pressed.has(a),
        endFrame() { pressed.clear(); },
        touchSet(a, on) { if (on) { if (!touch.has(a)) pressed.add(a); touch.add(a); } else touch.delete(a); },
        clear() { down.clear(); pressed.clear(); touch.clear(); }
    };
})();

// ---------- sound: everything is synthesized (no files to download) ----------
const Sound = (() => {
    let ac = null, master, sfxBus, musBus, noiseBuf;
    function init() {
        if (ac) return ac.state === 'suspended' ? ac.resume() : null;
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
        master = ac.createGain(); master.connect(ac.destination);
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(master);
        sfxBus = ac.createGain(); sfxBus.connect(comp); musBus = ac.createGain(); musBus.connect(comp);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        volumes();
    }
    function volumes() { if (!ac) return; sfxBus.gain.value = settings.sfx * 0.7; musBus.gain.value = settings.music * 0.32; }
    function tone(f0, f1, dur, type = 'square', vol = 0.25, when = 0, bus) {
        if (!ac) return; const t = ac.currentTime + when;
        const o = ac.createOscillator(), g = ac.createGain(); o.type = type;
        o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, f0, f1, vol = 0.3, when = 0, q = 1) {
        if (!ac) return; const t = ac.currentTime + when;
        const s = ac.createBufferSource(); s.buffer = noiseBuf; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
        bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
        const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(bp); bp.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.02);
    }
    const SFX = {
        jump: () => { tone(330, 620, 0.12, 'square', 0.12); tone(660, 1240, 0.08, 'triangle', 0.08); },
        djump: () => { tone(520, 1050, 0.14, 'triangle', 0.16); tone(780, 1560, 0.1, 'sine', 0.1, 0.03); noise(0.15, 3000, 800, 0.08); },
        walljump: () => { tone(280, 700, 0.12, 'square', 0.12); noise(0.08, 2000, 600, 0.12); },
        land: () => noise(0.07, 900, 200, 0.12),
        dash: () => { noise(0.22, 4000, 400, 0.25, 0, 0.7); tone(900, 300, 0.18, 'sawtooth', 0.06); },
        spark: (n = 0) => { const f = 880 * Math.pow(2, (n % 8) / 12); tone(f, f, 0.09, 'sine', 0.12); tone(f * 2, f * 2, 0.07, 'triangle', 0.06, 0.04); },
        moth: () => [0, 4, 7, 12, 16].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), 0.25, 'sine', 0.12, i * 0.07)),
        stomp: () => { tone(220, 60, 0.18, 'square', 0.18); noise(0.12, 1500, 300, 0.2); },
        hurt: () => { tone(300, 80, 0.3, 'sawtooth', 0.2); noise(0.25, 2500, 200, 0.2); },
        die: () => { tone(500, 60, 0.6, 'sawtooth', 0.18); noise(0.5, 3000, 100, 0.2); },
        spring: () => { tone(200, 900, 0.25, 'sine', 0.2); tone(400, 1800, 0.2, 'triangle', 0.06); },
        lantern: () => [0, 7, 12, 19].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), 0.5, 'triangle', 0.1, i * 0.08)),
        crumble: () => noise(0.35, 700, 120, 0.22, 0, 0.6),
        shoot: () => { tone(500, 200, 0.15, 'square', 0.08); },
        key: () => [0, 12].forEach((s, i) => tone(988 * Math.pow(2, s / 12), 988 * Math.pow(2, s / 12), 0.18, 'square', 0.08, i * 0.08)),
        door: () => { noise(0.4, 500, 120, 0.25); tone(110, 80, 0.4, 'square', 0.1); },
        gate: () => [0, 4, 7, 11, 14, 19, 24].forEach((s, i) => tone(440 * Math.pow(2, s / 12), 440 * Math.pow(2, s / 12), 0.6, 'triangle', 0.1, i * 0.06)),
        shrine: () => [0, 5, 9, 12, 17, 21, 24].forEach((s, i) => { tone(392 * Math.pow(2, s / 12), 392 * Math.pow(2, s / 12), 0.9, 'sine', 0.1, i * 0.1); }),
        boss: () => { tone(80, 40, 0.8, 'sawtooth', 0.25); noise(0.8, 400, 60, 0.3); },
        click: () => tone(1200, 900, 0.05, 'square', 0.06),
        bounce: () => tone(400, 700, 0.1, 'sine', 0.12)
    };
    // music: a soft generative pad + plucked arpeggio per world, scheduled a bar at a time
    const SCALES = [[0, 2, 4, 7, 9], [0, 3, 5, 7, 10], [0, 2, 4, 5, 7, 9, 11], [0, 1, 4, 5, 7, 8, 10], [0, 3, 6, 7, 10]];
    const ROOTS = [57, 50, 62, 52, 45];
    const PROG = [[0, 5, 3, 4], [0, 3, 5, 4], [0, 4, 5, 3], [0, 1, 0, 5], [0, 1, 3, 2]];
    let mus = null;
    const mf = n => 440 * Math.pow(2, (n - 69) / 12);
    function musicFor(world) {
        if (!ac) return;
        if (mus && mus.world === world) return;
        stopMusic();
        mus = { world, bar: 0, next: ac.currentTime + 0.1, timer: null };
        const bar = 2.4, sc = SCALES[world % SCALES.length], root = ROOTS[world % ROOTS.length], prog = PROG[world % PROG.length];
        const step = () => {
            if (!mus || mus.world !== world) return;
            while (mus.next < ac.currentTime + 1.2) {
                const t0 = mus.next, ch = prog[mus.bar % prog.length], deg = n => root + sc[(ch + n) % sc.length] + 12 * Math.floor((ch + n) / sc.length);
                [0, 2, 4].forEach(n => tone(mf(deg(n)), mf(deg(n)), bar * 1.05, 'sine', 0.05, t0 - ac.currentTime, musBus));
                tone(mf(deg(0) - 12), mf(deg(0) - 12), bar, 'triangle', 0.07, t0 - ac.currentTime, musBus);
                const r = seeded(mus.bar * 31 + world * 7);
                for (let i = 0; i < 8; i++) if (r() < 0.72) {
                    const n = deg(Math.floor(r() * 5)) + 12;
                    tone(mf(n), mf(n), 0.35, world === 4 ? 'square' : 'triangle', 0.035, t0 - ac.currentTime + i * bar / 8, musBus);
                }
                mus.next += bar; mus.bar++;
            }
            mus.timer = setTimeout(step, 400);
        };
        step();
    }
    function stopMusic() { if (mus && mus.timer) clearTimeout(mus.timer); mus = null; }
    return { init, volumes, play: (k, a) => { if (ac && SFX[k]) SFX[k](a); }, musicFor, stopMusic, get ok() { return !!ac; } };
})();
