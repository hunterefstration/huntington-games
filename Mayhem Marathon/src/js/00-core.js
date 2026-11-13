import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================
// MAYHEM MARATHON: a knockout obstacle show for up to 16 wobbly Tumblers.
// Core helpers, the save file, synthesised sound effects and music.
// ============================================================
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const PI = Math.PI, TAU = Math.PI * 2;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor((rnd || Math.random)() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const now = () => performance.now() / 1000;
let toastT = 0;
function toast(t) { const e = $('#toast'); if (!e) return; e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2800); }
const LP = () => { try { const p = window.parent; return p && p !== window ? p : null; } catch (e) { return null; } };

// ---------- the save file: localStorage mayhem_save = {v:1, ...}. Old saves are migrated, never wiped. ----------
const SAVE_KEY = 'mayhem_save', SAVE_V = 1;
let save = null;
function defaultSave() {
    return {
        v: SAVE_V, name: '', kudos: 150, fame: 0, owned: {},
        look: { col: 'c0', col2: 'c5', pat: 'p0', hat: 'h0', visor: 'v0', trail: 't0', pose: 'e0' },
        stats: { crowns: 0, shows: 0, qualified: 0, rounds: 0, eliminations: 0, finals: 0, kudosEarned: 0 },
        settings: { quality: 'med', music: 0.55, sfx: 0.8, mute: false, sens: 1, invertY: false, names: true },
        opts: { bots: 15, skill: 1, length: 4, scoring: 'auto' }, seenHow: false
    };
}
// Older/foreign shapes are folded in: future versions add `if (s.v < 2) { ...; s.v = 2; }` steps, never delete fields.
function migrateSave(s) {
    if (typeof s.v !== 'number') {                     // pre-release test builds kept the counters at the top level
        s.stats = Object.assign({}, s.stats || {});
        for (const k of ['crowns', 'shows', 'qualified', 'eliminations']) if (typeof s[k] === 'number') { s.stats[k] = Math.max(s.stats[k] || 0, s[k]); delete s[k]; }
        if (Array.isArray(s.unlocked)) { s.owned = Object.assign({}, s.owned || {}); for (const id of s.unlocked) s.owned[id] = true; delete s.unlocked; }
        if (typeof s.coins === 'number' && typeof s.kudos !== 'number') { s.kudos = s.coins; delete s.coins; }
        s.v = 1;
    }
    return s;
}
function mergeInto(base, s) {
    for (const k of Object.keys(s)) {
        const bv = base[k], sv = s[k];
        if (bv && typeof bv === 'object' && !Array.isArray(bv) && sv && typeof sv === 'object' && !Array.isArray(sv)) mergeInto(bv, sv);
        else if (sv !== undefined) base[k] = sv;
    }
    return base;
}
function loadSave() {
    let raw = null; try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
    const d = defaultSave();
    if (!raw) return fixSave(d);
    let s; try { s = JSON.parse(raw); } catch (e) { try { localStorage.setItem(SAVE_KEY + '_bak', raw); } catch (e2) {} return fixSave(d); }
    if (!s || typeof s !== 'object') return fixSave(d);
    return fixSave(mergeInto(d, migrateSave(s)));
}
function fixSave(s) {
    for (const k of Object.keys(s.stats)) if (!(s.stats[k] >= 0)) s.stats[k] = 0;
    if (!(s.kudos >= 0)) s.kudos = 0; if (!(s.fame >= 0)) s.fame = 0;
    for (const slot of Object.keys(SLOT_CAT)) { const id = s.look[slot]; if (!ITEM[id] || ITEM[id].cat !== SLOT_CAT[slot] || !itemOwned(ITEM[id], s)) s.look[slot] = defaultSave().look[slot]; }
    if (!['low', 'med', 'high'].includes(s.settings.quality)) s.settings.quality = 'med';
    s.opts.bots = clamp(s.opts.bots | 0, 0, 15); s.opts.skill = clamp(s.opts.skill | 0, 0, 2); s.opts.length = clamp(s.opts.length | 0, 3, 5);
    if (!['auto', 'knockout', 'points'].includes(s.opts.scoring)) s.opts.scoring = 'auto';
    return s;
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
function myName() {
    try { const p = LP(), me = p && p.HGGrapevine && p.HGGrapevine.me && p.HGGrapevine.me(); if (me && me.name) return String(me.name).slice(0, 16); } catch (e) {}
    if (save && save.name) return save.name;
    const n = 'Tumbler ' + (100 + Math.floor(Math.random() * 900)); if (save) { save.name = n; writeSave(); } return n;
}
const signedIn = () => { try { const p = LP(); return !!(p && p.HGGrapevine && p.HGGrapevine.me && p.HGGrapevine.me()); } catch (e) { return false; } };

// ---------- audio: everything is synthesised with WebAudio ----------
const A = { ctx: null, master: null, sfx: null, mus: null, noise: null, last: {}, song: null, step: 0, nextT: 0, timer: 0 };
function ac() {
    if (!A.ctx) {
        try {
            const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
            A.ctx = new C(); A.master = A.ctx.createGain(); A.master.connect(A.ctx.destination);
            A.sfx = A.ctx.createGain(); A.sfx.connect(A.master); A.mus = A.ctx.createGain(); A.mus.connect(A.master);
            const n = A.ctx.sampleRate, b = A.ctx.createBuffer(1, n, A.ctx.sampleRate), d = b.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
            A.noise = b; applyVolume();
        } catch (e) { A.ctx = null; }
    }
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
}
function applyVolume() {
    if (!A.ctx || !save) return; const s = save.settings;
    A.master.gain.value = s.mute ? 0 : 1; A.sfx.gain.value = s.sfx; A.mus.gain.value = s.music * 0.5;
}
function tone(c, type, f0, f1, dur, vol, t0, out) {
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(out || A.sfx); o.start(t0); o.stop(t0 + dur + 0.03);
}
function noiseBurst(c, dur, vol, f0, f1, type, t0, out) {
    const s = c.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f); f.connect(g); g.connect(out || A.sfx); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.03);
}
const SFX = {
    jump: (c, t) => { tone(c, 'square', 280, 620, 0.12, 0.12, t); },
    land: (c, t) => { noiseBurst(c, 0.1, 0.25, 600, 120, 'lowpass', t); },
    dive: (c, t) => { noiseBurst(c, 0.28, 0.35, 900, 3000, 'bandpass', t); tone(c, 'triangle', 500, 250, 0.2, 0.1, t); },
    bonk: (c, t) => { tone(c, 'sine', 420, 90, 0.25, 0.5, t); noiseBurst(c, 0.12, 0.4, 2000, 300, 'lowpass', t); },
    boing: (c, t) => { tone(c, 'sine', 180, 720, 0.3, 0.35, t); },
    grab: (c, t) => { tone(c, 'square', 200, 160, 0.08, 0.12, t); },
    whoosh: (c, t) => { noiseBurst(c, 0.4, 0.25, 400, 2400, 'bandpass', t); },
    splash: (c, t) => { noiseBurst(c, 0.6, 0.5, 2500, 200, 'lowpass', t); tone(c, 'sine', 300, 80, 0.4, 0.2, t); },
    crack: (c, t) => { noiseBurst(c, 0.15, 0.3, 3000, 900, 'highpass', t); },
    tick: (c, t) => { tone(c, 'square', 880, 880, 0.12, 0.18, t); },
    go: (c, t) => { tone(c, 'square', 1320, 1320, 0.45, 0.2, t); tone(c, 'triangle', 660, 660, 0.45, 0.2, t); },
    qual: (c, t) => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, 'triangle', f, f, 0.25, 0.25, t + i * 0.07)); },
    out: (c, t) => { [392, 370, 349, 262].forEach((f, i) => tone(c, 'sawtooth', f, f * 0.97, i === 3 ? 0.6 : 0.22, 0.13, t + i * 0.2)); },
    coin: (c, t) => { tone(c, 'square', 988, 988, 0.07, 0.12, t); tone(c, 'square', 1318, 1318, 0.2, 0.12, t + 0.07); },
    pop: (c, t) => { noiseBurst(c, 0.08, 0.5, 4000, 800, 'bandpass', t); },
    click: (c, t) => { tone(c, 'triangle', 700, 560, 0.05, 0.15, t); },
    score: (c, t) => { tone(c, 'triangle', 784, 784, 0.1, 0.25, t); tone(c, 'triangle', 1175, 1175, 0.25, 0.25, t + 0.08); },
    steal: (c, t) => { tone(c, 'square', 600, 1200, 0.15, 0.15, t); },
    crown: (c, t) => { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(c, 'square', f, f, 0.3, 0.12, t + i * 0.11)); },
    buy: (c, t) => { [660, 880, 1320].forEach((f, i) => tone(c, 'triangle', f, f, 0.15, 0.2, t + i * 0.06)); }
};
let listenerPos = null;
function sfx(name, pos, vol) {
    const c = ac(); if (!c || !SFX[name] || G.manual) return;
    const t = c.currentTime;
    if (A.last[name] && t - A.last[name] < 0.05) return; A.last[name] = t;
    let k = vol || 1;
    if (pos && listenerPos) { const dx = pos.x - listenerPos.x, dy = pos.y - listenerPos.y, dz = pos.z - listenerPos.z; k *= clamp(1 - Math.sqrt(dx * dx + dy * dy + dz * dz) / 40, 0, 1); if (k < 0.05) return; }
    if (k >= 0.99) return SFX[name](c, t);
    const g = c.createGain(); g.gain.value = k; g.connect(A.sfx);
    const keep = A.sfx; A.sfx = g; try { SFX[name](c, t); } finally { A.sfx = keep; }
}

// ---------- music: a tiny step sequencer playing original tunes (scale degrees over chord roots) ----------
// melody strings: one char per 16th; 0-9 a-e = scale degree (from the chord root's octave), '.' rest, '-' hold.
const SONGS = {
    menu: { bpm: 112, key: 60, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 5, 3, 4], lead: 'square',
        mel: ['4.4.5.4.2...0.2.', '3.3.4.3.1...6.5.', '5.5.6.5.4.3.2.1.', '2.4.7.6.4-------'],
        bass: '0...0.4.0...0.4.', drum: 'k.h.s.h.k.k.s.h.' },
    race: { bpm: 150, key: 62, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 4, 5, 3], lead: 'square',
        mel: ['0242.420.4.7.4.2', '4.4.5654.2.1.0..', '5.4.3.2.3454.2..', '7.6.5.4.5.6.7---'],
        bass: '0.0.4.0.0.0.4.4.', drum: 'k.hsk.hsk.hsk.ss' },
    survive: { bpm: 132, key: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 6, 4], lead: 'triangle',
        mel: ['0..2..3.4..3..2.', '0..2..3.5..4..3.', '4.4.5.4.3.2.3...', '2.3.4.5.4.3.2.1.'],
        bass: '00.000.000.00.0.', drum: 'k..hk.s.k..hk.s.' },
    final: { bpm: 140, key: 55, scale: [0, 2, 3, 5, 7, 8, 11], chords: [0, 5, 3, 4], lead: 'sawtooth',
        mel: ['7.7.6.5.4...7...', '8.8.7.6.5...4...', '3.4.5.6.7.6.5.4.', '4.5.6.7.9-------'],
        bass: '0.00.00.0.00.04.', drum: 'k.hsk.hsk.hskkss' },
    win: { bpm: 120, key: 60, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 3, 4, 0], lead: 'square',
        mel: ['0.2.4.7---4.7.9-', '7.5.3.5---3.5.7-', '6.5.4.5.6.7.9---', 'b.9.7.4.7-------'],
        bass: '0...4...0...4...', drum: 'k...s...k.k.s...' }
};
const DEG = c => c === '.' || c === '-' ? null : parseInt(c, 16);
function noteHz(song, chord, deg) { const sc = song.scale, o = Math.floor(deg / 7), r = sc[((deg % 7) + 7) % 7] + 12 * o; return 440 * Math.pow(2, (song.key + song.chords[chord] + r - 69) / 12); }
function playMusic(name) {
    if (A.songName === name) return; A.songName = name;
    const c = ac(); if (!c) return;
    A.song = SONGS[name] || null; A.step = 0; A.nextT = c.currentTime + 0.1;
    if (!A.timer) A.timer = setInterval(musicTick, 30);
}
function musicTick() {
    const c = A.ctx, s = A.song; if (!c || !s) return;
    const sp = 60 / s.bpm / 4;
    if (A.nextT < c.currentTime - 0.5) A.nextT = c.currentTime + 0.05;
    while (A.nextT < c.currentTime + 0.15) {
        const st = A.step % 64, bar = Math.floor(st / 16), i = st % 16, t = A.nextT;
        const m = s.mel[bar][i], d = DEG(m);
        if (d !== null) { let len = 1; while (i + len < 16 && s.mel[bar][i + len] === '-') len++; tone(c, s.lead, noteHz(s, bar, d + 7), noteHz(s, bar, d + 7), sp * len * 0.95, 0.07, t, A.mus); }
        const b = DEG(s.bass[i]); if (b !== null) tone(c, 'triangle', noteHz(s, bar, b - 7), noteHz(s, bar, b - 7), sp * 1.6, 0.22, t, A.mus);
        const dr = s.drum[i];
        if (dr === 'k') tone(c, 'sine', 150, 40, 0.18, 0.5, t, A.mus);
        else if (dr === 's') noiseBurst(c, 0.14, 0.22, 3000, 900, 'bandpass', t, A.mus);
        else if (dr === 'h') noiseBurst(c, 0.04, 0.08, 9000, 6000, 'highpass', t, A.mus);
        A.nextT += sp; A.step++;
    }
}
function stopMusic() { A.song = null; A.songName = ''; }
