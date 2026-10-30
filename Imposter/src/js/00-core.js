// ==========================================
// CORE: helpers, constants, saves, audio
// ==========================================
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const r1 = v => Math.round(v * 10) / 10;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

const TS = 32;                 // tile size in world px
const VERSION = 1;
const MAXP = 10;               // seats per match
const BASE_SPEED = 170;        // px/s at speed 1
const PR = 10;                 // player collision radius
const KILL_RANGE = 62, REPORT_RANGE = 96, USE_RANGE = 62, BTN_RANGE = 104;
const VIS_CREW = 250, VIS_IMP = 390, VIS_DARK = 92;
const COLORS = [
  { n: 'Ember', c: '#e8332e', d: '#8f1717' }, { n: 'Tide', c: '#2f55e0', d: '#17297f' }, { n: 'Moss', c: '#1f9c3f', d: '#0c5a22' },
  { n: 'Rose', c: '#f26ac0', d: '#a53a80' }, { n: 'Amber', c: '#f28a1d', d: '#9a4f08' }, { n: 'Brass', c: '#f2dc3a', d: '#a08a10' },
  { n: 'Soot', c: '#3b4455', d: '#171b25' }, { n: 'Pearl', c: '#e8edf5', d: '#8a93a8' }, { n: 'Dusk', c: '#8a3fd8', d: '#4a1c86' },
  { n: 'Teal', c: '#3fd7e0', d: '#16808a' }, { n: 'Cedar', c: '#8a5a33', d: '#4a2c14' }, { n: 'Fern', c: '#90e038', d: '#4a8a10' }];
const BOT_NAMES = ['Nova', 'Pip', 'Juno', 'Kit', 'Bolt', 'Zed', 'Mochi', 'Rex', 'Luna', 'Orbit', 'Fizz', 'Nugget', 'Echo', 'Sprout', 'Taffy', 'Comet', 'Pixel', 'Waffle', 'Ziggy', 'Tango', 'Biscuit', 'Gizmo', 'Poppy', 'Moose'];
const DEFAULT_SET = { imps: 2, kcd: 25, speed: 1, tasks: 5, map: 'ship', disc: 15, vote: 30, confirm: 1, meet: 1 };

// ---- saves (never wiped: unknown keys are kept, missing ones filled in) ----
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
const settings = Object.assign({ v: 1, name: '', vol: 60, touch: 'auto', hostSet: Object.assign({}, DEFAULT_SET) }, LS.get('imposter_settings', {}));
settings.hostSet = Object.assign({}, DEFAULT_SET, settings.hostSet || {});
const stats = Object.assign({ v: 1, games: 0, crewGames: 0, impGames: 0, crewWins: 0, impWins: 0, kills: 0, tasks: 0, meetings: 0, ejectedImps: 0, deaths: 0 }, LS.get('imposter_save', {}));
const saveSettings = () => LS.set('imposter_settings', settings);
const saveStats = () => LS.set('imposter_save', stats);
function playerName() { return (settings.name || '').trim().slice(0, 12) || ('Guest' + (1 + (Math.abs(hashStr(navigator.userAgent + (screen.width || 0))) % 99))); }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function cleanText(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }

// ---- audio (tiny synth, nothing to download) ----
let AC = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = false; } }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => { });
  return AC;
}
function tone(f, d, type, vol, slide, delay) {
  const v = settings.vol / 100; if (v <= 0) return; const a = ac(); if (!a) return;
  try {
    const t = a.currentTime + (delay || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((vol || 0.2) * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + 0.05);
  } catch (e) { }
}
const sfx = {
  click() { tone(520, .07, 'square', .08); }, ok() { tone(660, .1, 'triangle', .2); tone(990, .14, 'triangle', .2, 0, .09); },
  bad() { tone(160, .25, 'sawtooth', .18, -60); }, task() { tone(523, .1, 'triangle', .22); tone(659, .1, 'triangle', .22, 0, .1); tone(784, .18, 'triangle', .22, 0, .2); },
  kill() { tone(180, .3, 'sawtooth', .3, -120); tone(90, .35, 'square', .25, -30, .05); }, vent() { tone(300, .25, 'sawtooth', .12, -200); },
  meeting() { for (let i = 0; i < 4; i++) tone(880, .16, 'square', .22, 0, i * .28); }, alarm() { tone(700, .3, 'square', .12, -250); },
  vote() { tone(440, .12, 'triangle', .2); }, win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, 'triangle', .25, 0, i * .14)); },
  lose() { [392, 311, 262, 196].forEach((f, i) => tone(f, .3, 'sawtooth', .18, 0, i * .18)); }, chat() { tone(880, .06, 'sine', .1); },
  sab() { tone(220, .4, 'sawtooth', .25, 200); tone(330, .4, 'sawtooth', .2, 200, .2); }
};

// ---- small UI helpers ----
let toastT = 0;
function toast(msg, ms) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 2200); }
const SCREENS = ['s-title', 's-join', 's-lobby', 's-how', 's-set', 's-stats', 's-pause'];
function showScreen(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
function hideScreens() { showScreen(''); }
const isTouch = () => settings.touch === 'on' || (settings.touch !== 'off' && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer:coarse)').matches));
function getHG() {
  try { if (window.HGNet) return window.HGNet; } catch (e) { }
  try { if (window.parent && window.parent.HGNet) return window.parent.HGNet; } catch (e) { }
  return null;
}
// run a repeating job; HGNet.every keeps its pace in background tabs (important for the host)
function every(ms, fn) {
  const H = getHG();
  if (H && H.every) return H.every(ms, fn);
  let last = performance.now(); const id = setInterval(() => { const n = performance.now(); fn(n - last); last = n; }, ms); return () => clearInterval(id);
}
