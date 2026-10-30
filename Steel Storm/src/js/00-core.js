import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ============================================================
// STEEL STORM: tanks, jets and warships. Core helpers, save file, audio.
// ============================================================
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const PI = Math.PI, TAU = Math.PI * 2;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const TEAM_COL = [0x3b9bff, 0xff4d4d];
let toastT = 0;
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 2600); }

// ---------- the save file: localStorage steelstorm_save = {v:1, ...}. Old saves are migrated, never wiped. ----------
const SAVE_KEY = 'steelstorm_save', SAVE_V = 1;
let save = null;
function defaultSave() {
    return {
        v: SAVE_V, name: '', credits: 800, freeRp: 0, rp: {}, researched: {}, owned: {}, target: null,
        lineup: ['g1a', 'a1a', 'n1a'], sel: 0, mode: 'tdm', size: 5, split: 0, bots: 'match', diff: 'normal',
        settings: { quality: 'med', sens: 1, vol: 0.7, invertY: false },
        stats: { matches: 0, wins: 0, kills: 0, deaths: 0, caps: 0 }, seenHow: false
    };
}
// future versions: add `if (s.v < 2) { ...; s.v = 2; }` steps here, never delete fields
function migrateSave(s) {
    if (typeof s.v !== 'number') s.v = 1;
    return s;
}
function mergeInto(base, s) {
    for (const k of Object.keys(s)) {
        const bv = base[k], sv = s[k];
        if (bv && typeof bv === 'object' && !Array.isArray(bv) && sv && typeof sv === 'object' && !Array.isArray(sv)) mergeInto(bv, sv);
        else base[k] = sv;
    }
    return base;
}
function loadSave() {
    let raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
    const d = defaultSave();
    if (!raw) return fixSave(d);
    let s;
    try { s = JSON.parse(raw); } catch (e) { try { localStorage.setItem(SAVE_KEY + '_bak', raw); } catch (e2) {} return fixSave(d); }
    if (!s || typeof s !== 'object') return fixSave(d);
    return fixSave(mergeInto(d, migrateSave(s)));
}
function fixSave(s) {      // tier I is always owned; drop unknown ids; keep a usable lineup
    for (const v of VEHS) if (v.t === 1) { s.owned[v.id] = true; s.researched[v.id] = true; }
    for (const id of Object.keys(s.owned)) if (!VBY[id]) delete s.owned[id];
    s.lineup = (Array.isArray(s.lineup) ? s.lineup : []).filter((id, i, a) => VBY[id] && s.owned[id] && a.indexOf(id) === i).slice(0, 5);
    if (!s.lineup.length) s.lineup = ['g1a'];
    s.sel = clamp(s.sel | 0, 0, s.lineup.length - 1);
    if (s.target && (!VBY[s.target] || s.researched[s.target])) s.target = null;
    if (!(s.credits >= 0)) s.credits = 0;
    if (!(s.freeRp >= 0)) s.freeRp = 0;
    if (s.mode !== 'tdm' && s.mode !== 'conq') s.mode = 'tdm';
    s.size = s.size === 3 ? 3 : 5;
    return s;
}
let saveT = 0;
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// player name: the Grapevine profile if the launcher has one
function myName() {
    try { const p = window.parent, me = p && p !== window && p.HGGrapevine && p.HGGrapevine.me && p.HGGrapevine.me(); if (me && me.name) return String(me.name).slice(0, 16); } catch (e) {}
    if (save && save.name) return save.name;
    let n = ''; try { n = localStorage.getItem('steelstorm_name') || ''; } catch (e) {}
    if (!n) { n = 'Commander ' + (100 + Math.floor(Math.random() * 900)); try { localStorage.setItem('steelstorm_name', n); } catch (e) {} }
    return n;
}

// ---------- audio: everything is synthesised with WebAudio ----------
const A = { ctx: null, master: null, noise: null, last: {}, eng: null };
function ac() {
    if (!A.ctx) {
        try {
            const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
            A.ctx = new C(); A.master = A.ctx.createGain(); A.master.gain.value = save ? save.settings.vol : 0.7; A.master.connect(A.ctx.destination);
            const n = A.ctx.sampleRate * 1.5, b = A.ctx.createBuffer(1, n, A.ctx.sampleRate), d = b.getChannelData(0);
            for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
            A.noise = b;
        } catch (e) { A.ctx = null; }
    }
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
}
function setVolume(v) { if (A.master) A.master.gain.value = v; }
function tone(c, type, f0, f1, dur, vol, t0) {
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); o.connect(g); g.connect(A.master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noiseBurst(c, dur, vol, f0, f1, type, t0) {
    const s = c.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    s.connect(f); f.connect(g); g.connect(A.master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
const SFX = {
    cannon: c => { const t = c.currentTime; noiseBurst(c, 0.35, 0.9, 1400, 150, 'lowpass', t); tone(c, 'sine', 130, 35, 0.3, 0.9, t); },
    heavy: c => { const t = c.currentTime; noiseBurst(c, 0.7, 1, 900, 80, 'lowpass', t); tone(c, 'sine', 90, 25, 0.6, 1, t); },
    mg: c => { const t = c.currentTime; noiseBurst(c, 0.06, 0.35, 3500, 1200, 'bandpass', t); },
    gun: c => { const t = c.currentTime; noiseBurst(c, 0.07, 0.4, 2500, 700, 'bandpass', t); tone(c, 'square', 220, 110, 0.05, 0.08, t); },
    rocket: c => { const t = c.currentTime; noiseBurst(c, 0.7, 0.5, 500, 3000, 'bandpass', t); },
    bomb: c => { const t = c.currentTime; tone(c, 'sine', 900, 250, 0.9, 0.12, t); },
    boom: c => { const t = c.currentTime; noiseBurst(c, 0.9, 1, 900, 50, 'lowpass', t); tone(c, 'sine', 70, 22, 0.8, 1, t); },
    small: c => { const t = c.currentTime; noiseBurst(c, 0.3, 0.6, 1500, 120, 'lowpass', t); tone(c, 'sine', 100, 30, 0.25, 0.5, t); },
    splash: c => { const t = c.currentTime; noiseBurst(c, 0.4, 0.4, 3000, 400, 'bandpass', t); },
    hit: c => { const t = c.currentTime; tone(c, 'square', 1200, 900, 0.05, 0.12, t); },
    ping: c => { const t = c.currentTime; tone(c, 'triangle', 700, 650, 0.07, 0.25, t); },
    hurt: c => { const t = c.currentTime; noiseBurst(c, 0.25, 0.5, 700, 100, 'lowpass', t); tone(c, 'sawtooth', 160, 60, 0.2, 0.15, t); },
    kill: c => { const t = c.currentTime; tone(c, 'triangle', 660, 660, 0.1, 0.3, t); tone(c, 'triangle', 990, 990, 0.2, 0.3, t + 0.09); },
    cap: c => { const t = c.currentTime; [523, 659, 784, 1046].forEach((f, i) => tone(c, 'triangle', f, f, 0.22, 0.25, t + i * 0.08)); },
    click: c => { const t = c.currentTime; tone(c, 'square', 600, 500, 0.04, 0.1, t); },
    ready: c => { const t = c.currentTime; tone(c, 'square', 300, 300, 0.03, 0.08, t); },
    win: c => { const t = c.currentTime; [392, 523, 659, 784].forEach((f, i) => tone(c, 'triangle', f, f, 0.35, 0.3, t + i * 0.14)); },
    lose: c => { const t = c.currentTime; [392, 330, 262, 196].forEach((f, i) => tone(c, 'sawtooth', f, f * 0.98, 0.35, 0.18, t + i * 0.16)); }
};
// positional: quieter with distance from the camera
let listenerPos = null;
function sfx(name, x, y, z, vol) {
    const c = ac(); if (!c || !SFX[name]) return;
    const now = c.currentTime, lim = (name === 'gun' || name === 'mg') ? 0.07 : 0.04;
    if (A.last[name] && now - A.last[name] < lim) return; A.last[name] = now;
    if (x !== undefined && listenerPos) {
        const dx = x - listenerPos.x, dy = y - listenerPos.y, dz = z - listenerPos.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const k = clamp(1 - d / 700, 0, 1); if (k < 0.04) return;
        const g = c.createGain(); g.gain.value = k * k * (vol || 1);
        const keep = A.master; A.master = g; g.connect(keep); try { SFX[name](c); } finally { A.master = keep; }
    } else SFX[name](c);
}
// engine hum for the player's own vehicle
function engineStart(kind) {
    const c = ac(); if (!c || A.eng) return;
    const g = c.createGain(); g.gain.value = 0; g.connect(A.master);
    const o = c.createOscillator(); o.type = kind === 'a' ? 'sawtooth' : 'triangle'; o.frequency.value = 50; o.connect(g); o.start();
    const s = c.createBufferSource(); s.buffer = A.noise; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'a' ? 1800 : 300; const ng = c.createGain(); ng.gain.value = 0.5;
    s.connect(f); f.connect(ng); ng.connect(g); s.start();
    A.eng = { o, g, f, s, kind };
}
function engineStop() { if (!A.eng) return; try { A.eng.o.stop(); A.eng.s.stop(); A.eng.g.disconnect(); } catch (e) {} A.eng = null; }
function engineSet(k, kind) {      // k: 0..1 how hard
    if (!A.eng || A.eng.kind !== kind) { engineStop(); engineStart(kind); }
    if (!A.eng) return; const t = A.ctx.currentTime;
    A.eng.o.frequency.setTargetAtTime(kind === 'a' ? 70 + k * 160 : kind === 'n' ? 38 + k * 22 : 40 + k * 45, t, 0.1);
    A.eng.f.frequency.setTargetAtTime(kind === 'a' ? 500 + k * 2500 : 200 + k * 200, t, 0.1);
    A.eng.g.gain.setTargetAtTime(kind === 'a' ? 0.1 + k * 0.1 : 0.08 + k * 0.08, t, 0.1);
}
