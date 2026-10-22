// Sovereign - a Huntington Games production.
// Source is split into src/js/*.js and joined (in file-name order) into one module by tools/build-sovereign.js.
import * as THREE from 'three';

const VERSION = '1.0';
const DEG = Math.PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtInt = n => Math.round(n).toLocaleString('en-US');
const fmtBig = n => n >= 1e12 ? (n / 1e12).toFixed(n >= 1e13 ? 0 : 1) + 'T' : n >= 1e9 ? (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(Math.round(n));

// Seeded random (mulberry32): every random roll in the simulation goes through one of these.
function makeRng(seed) {
  let a = seed >>> 0;
  const r = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.state = () => a; r.set = s => { a = s >>> 0; };
  return r;
}

// Tiny event bus: Bus.on('select', fn), Bus.emit('select', id)
const Bus = {
  h: {},
  on(n, f) { (this.h[n] = this.h[n] || []).push(f); },
  emit(n, ...a) { (this.h[n] || []).forEach(f => { try { f(...a); } catch (e) { console.error(n, e); } }); }
};

// Browser storage (shared with the Launcher and other games, so every key starts with "sov.")
const Store = {
  get(k, d) { try { const v = localStorage.getItem('sov.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('sov.' + k, JSON.stringify(v)); } catch (e) {} }
};

const SETTINGS_DEFAULT = { quality: 'auto', clouds: true, labels: 'normal', fps: false, ui: 1, autoLevel: 'medium' };
const Settings = Object.assign({}, SETTINGS_DEFAULT, Store.get('settings', {}));
function saveSettings() { Store.set('settings', Settings); Bus.emit('settings'); }

function readData(id) {
  const el = document.getElementById('sov-data-' + id);
  if (!el) throw new Error('missing data block ' + id);
  const v = JSON.parse(el.textContent);
  el.remove(); // free the text, the parsed copy is all we need
  return v;
}

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}
