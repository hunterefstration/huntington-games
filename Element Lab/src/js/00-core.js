// ==========================================
// ELEMENT LAB - core: helpers, saves, settings, sound
// ==========================================
const AMB = 20;                                   // room temperature, degrees C
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const $ = id => document.getElementById(id);

// small xorshift random: fast and (with seedRnd) repeatable for tests
let rs = 2463534242;
function rnd() { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; return (rs >>> 0) / 4294967296; }
const rndi = n => (rnd() * n) | 0;
function seedRnd(s) { rs = (s | 0) || 1; }

// ---------- saves (every key starts with elementlab_) ----------
const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const QUAL = [{ n: 'Low', w: 160, h: 90 }, { n: 'Medium', w: 240, h: 135 }, { n: 'High', w: 320, h: 180 }];
const SETTINGS = Object.assign({ quality: 1, sound: true, overlay: false, glow: true, fx: true, replace: false, seenHelp: false },
    LS.get('elementlab_settings', {}) || {});
if (!(SETTINGS.quality >= 0 && SETTINGS.quality < QUAL.length)) SETTINGS.quality = 1;
function saveSettings() { LS.set('elementlab_settings', SETTINGS); }

// ---------- sound (WebAudio, short synthesized effects; silent until the first click) ----------
let AC = null, NOISE = null;
const SFX_GAP = { sizzle: 140, boom: 60, splash: 160, zap: 120, pop: 80, ding: 200 };
const sfxLast = {};
function audioUnlock() {
    try {
        if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; AC = new C(); }
        if (AC.state === 'suspended') AC.resume();
    } catch (e) { AC = null; }
}
function noiseBuffer() {
    if (NOISE) return NOISE;
    NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = NOISE.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return NOISE;
}
function sfx(kind, vol) {
    if (!AC || !SETTINGS.sound || AC.state !== 'running') return;
    vol = vol === undefined ? 1 : vol;
    const now = performance.now();
    if (now - (sfxLast[kind] || 0) < (SFX_GAP[kind] || 80)) return;
    sfxLast[kind] = now;
    try {
        const t = AC.currentTime, g = AC.createGain();
        g.connect(AC.destination);
        const env = (peak, dur, atk) => {
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), t + (atk || 0.01));
            g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        };
        const noise = (dur, type, f0, f1, q) => {
            const s = AC.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
            const f = AC.createBiquadFilter(); f.type = type; f.Q.value = q || 1;
            f.frequency.setValueAtTime(f0, t);
            if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
            s.connect(f); f.connect(g); s.start(t); s.stop(t + dur + 0.05);
        };
        const tone = (type, f0, f1, dur) => {
            const o = AC.createOscillator(); o.type = type;
            o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
            o.connect(g); o.start(t); o.stop(t + dur + 0.05);
        };
        if (kind === 'sizzle') { env(0.09, 0.4, 0.03); noise(0.4, 'highpass', 3200, 5000, 0.7); }
        else if (kind === 'boom') { env(0.5, 0.7, 0.005); noise(0.7, 'lowpass', 900, 70, 0.8); tone('sine', 110, 28, 0.6); }
        else if (kind === 'splash') { env(0.14, 0.28, 0.02); noise(0.28, 'bandpass', 700, 1800, 1.2); }
        else if (kind === 'zap') { env(0.12, 0.18, 0.003); tone('sawtooth', 1400, 90, 0.18); }
        else if (kind === 'pop') { env(0.12, 0.1, 0.002); tone('square', 420, 120, 0.09); }
        else if (kind === 'ding') { env(0.12, 0.5, 0.01); tone('triangle', 660, 990, 0.35); }
    } catch (e) { /* audio is optional */ }
}
