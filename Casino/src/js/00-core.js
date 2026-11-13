// The Lucky Goon: a play-money casino for goons. Every outcome and every chip lives on the Grapevine server
// (or, in practice mode, in the mock in 05-mock.js); this page only asks and shows.

// ---------- tiny DOM helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  if (a) for (const k in a) {
    const v = a[k]; if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const fmt = n => Math.floor(n).toLocaleString('en-US');
const fmtX = m => (+(+m).toFixed(m >= 100 ? 0 : 2)) + 'x';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pick = a => a[Math.floor(Math.random() * a.length)];

// ---------- remembered settings (one key; hgq: = settings-like) ----------
const STORE_KEY = 'hgq:casino';
const store = (() => {
  let d = {}; try { d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch {}
  return {
    get: (k, def) => (k in d ? d[k] : def),
    set: (k, v) => { d[k] = v; try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch {} }
  };
})();

// ---------- shared state ----------
const S = {
  practice: false, ready: false, api: null, me: null,
  bal: { chips: 0, goons: 0 }, hold: null,           // hold: the chips shown while an outcome animates
  limits: { min: 5, max: 5000, rate: 100 }, stats: { plays: 0, wag: 0, won: 0, big: 0 },
  edge: {}, names: {}, tables: null, live: null, feed: [], turn: null, daily: false,
  offset: 0, fast: !!store.get('fast', false), mute: !!store.get('mute', false),
  game: null, busy: false
};
const now = () => Date.now() + S.offset;               // the server's clock

// ---------- WebAudio sounds (all synthesised) ----------
const sfx = (() => {
  let ac = null, master = null;
  const ctx = () => {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.35; master.connect(ac.destination); } catch { return null; } }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  };
  function tone(f, d, type = 'sine', vol = 0.5, at = 0, slide = 0) {
    if (S.mute) return; const a = ctx(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, vol = 0.3, at = 0, hp = 1500) {
    if (S.mute) return; const a = ctx(); if (!a) return;
    const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(a.currentTime + at);
  }
  return {
    unlock: ctx,
    chip() { noise(0.05, 0.35, 0, 3000); tone(2200, 0.05, 'triangle', 0.15); },
    click() { tone(900, 0.04, 'square', 0.08); },
    tick() { tone(1500, 0.025, 'square', 0.06); },
    flip() { noise(0.08, 0.25, 0, 2000); },
    deal() { noise(0.1, 0.2, 0, 1200); },
    spin() { for (let i = 0; i < 6; i++) tone(300 + i * 40, 0.08, 'triangle', 0.08, i * 0.06); },
    roll() { for (let i = 0; i < 5; i++) noise(0.04, 0.3, i * 0.07, 800); },
    pop() { tone(500, 0.12, 'sine', 0.3, 0, 500); },
    boom() { noise(0.7, 0.6, 0, 80); tone(120, 0.6, 'sawtooth', 0.3, 0, -90); },
    lose() { tone(330, 0.18, 'triangle', 0.25); tone(247, 0.3, 'triangle', 0.25, 0.16); },
    win(big) {
      const n = big ? [523, 659, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
      n.forEach((f, i) => tone(f, 0.22, 'triangle', 0.3, i * 0.09));
      if (big) n.forEach((f, i) => tone(f * 1.5, 0.3, 'sine', 0.15, 0.6 + i * 0.07));
    },
    coin() { tone(1800, 0.06, 'square', 0.1); tone(2400, 0.12, 'square', 0.1, 0.05); }
  };
})();

// ---------- skippable, fast-able animation ----------
let skipGen = 0;                                        // bumped by a click while something animates: everything finishes now
const ease = { out: p => 1 - Math.pow(1 - p, 3), inOut: p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2, lin: p => p };
const dur = ms => (S.fast ? ms * 0.25 : ms);
function tween(ms, fn, ez = ease.out) {
  ms = dur(ms); const gen = skipGen;
  return new Promise(res => {
    const t0 = performance.now();
    const step = t => {
      let p = ms <= 0 ? 1 : Math.min(1, (t - t0) / ms); if (gen !== skipGen) p = 1;
      try { fn(ez(p), p); } catch (e) { console.error(e); p = 1; }
      if (p < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
function wait(ms) {                                     // a skippable pause
  ms = dur(ms); const gen = skipGen;
  return new Promise(res => { const t0 = performance.now(); const f = () => { if (gen !== skipGen || performance.now() - t0 >= ms) res(); else requestAnimationFrame(f); }; f(); setTimeout(res, ms + 50); });
}
let animating = 0;
async function animate(fn) { animating++; document.body.classList.add('anim'); try { return await fn(); } finally { if (--animating <= 0) { animating = 0; document.body.classList.remove('anim'); } } }
function skip() { if (animating) skipGen++; }

// ---------- outcome bus (tests await these) ----------
const doneWaiters = [];
function announce(info) { while (doneWaiters.length) doneWaiters.shift()(info); }
const nextDone = () => new Promise(r => doneWaiters.push(r));
