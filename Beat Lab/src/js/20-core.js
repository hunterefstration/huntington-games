// ===== Beat Lab app: shared state and small DOM helpers =====
const E = BeatLabEngine, PPQ = E.PPQ, STEP = E.STEP;
const BL_VERSION = '1.1';                         // shown in Help; bump with every change players should hear about
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
const SCALES = E.SCALES;
const inScale = (m, key, scale) => (SCALES[scale] || SCALES.chromatic).s.includes(((m - key) % 12 + 12) % 12);
const CH_COLS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#a9e34b', '#3bc9db', '#ff922b', '#e599f7', '#8ce99a', '#ffe066', '#91a7ff'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  return el;
}

// ---- app state
const A = {
  p: null,                       // the open project
  eng: E.create(),
  set: { mode: '', last: '', oct: 4, keys: 1, metro: 0, countIn: 1, recQ: 12, ghosts: 1, follow: 1 },
  ui: { tab: 'rack', ch: null, pat: 1, playMode: 'pat', brush: 1, startTick: 0, rec: false },
  playing: false,
  views: {},                      // name -> { el, draw(), dirty }
  lastError: ''
};
const BUS = {};
const on = (ev, f) => (BUS[ev] = BUS[ev] || []).push(f);
const emit = (ev, x) => { for (const f of BUS[ev] || []) try { f(x); } catch (e) { reportErr(e); } };
function reportErr(e) {
  A.lastError = (e && (e.stack || e.message)) || String(e);
  console.error(e);
}
window.addEventListener('error', e => { A.lastError = e.message; });
A.eng.onError(m => { A.lastError = m; });

// ---- toast and dialogs
let toastT = 0;
function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2200);
}
function modal(title, body, buttons, opts) {
  closeModal();
  const box = h('div', { class: 'mbox' + (opts && opts.wide ? ' wide' : '') }, h('h3', null, title), body);
  const row = h('div', { class: 'mbtns' });
  (buttons || [{ t: 'OK' }]).forEach(b => row.appendChild(h('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onclick: () => { if (b.f && b.f() === false) return; closeModal(); } }, b.t)));
  box.appendChild(row);
  const wrap = h('div', { id: 'modal', onpointerdown: e => { if (e.target.id === 'modal' && !(opts && opts.sticky)) closeModal(); } }, box);
  document.body.appendChild(wrap);
  const first = box.querySelector('input,select'); if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 30);
  return box;
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
function ask(title, value, cb, label) {
  const inp = h('input', { type: 'text', value: value || '', maxlength: 60, class: 'txt' });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = inp.value.trim(); closeModal(); if (v) cb(v); } e.stopPropagation(); });
  modal(title, h('div', null, label ? h('p', null, label) : null, inp), [{ t: 'Cancel' }, { t: 'OK', primary: true, f: () => { const v = inp.value.trim(); if (v) cb(v); } }]);
}
function confirmBox(title, text, yes, cb) { modal(title, h('p', null, text), [{ t: 'Cancel' }, { t: yes || 'OK', danger: true, f: cb }]); }
// context menu: items [{t, f, sep, dis}]
function menu(x, y, items) {
  closeMenu();
  const m = h('div', { id: 'ctxmenu' });
  for (const it of items) {
    if (it.sep) { m.appendChild(h('div', { class: 'sep' })); continue; }
    m.appendChild(h('button', { class: it.dis ? 'dis' : '', onclick: () => { closeMenu(); if (!it.dis) it.f(); } }, it.t, it.k ? h('span', { class: 'k' }, it.k) : null));
  }
  document.body.appendChild(m);
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 4) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 4) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', closeMenuOutside, true), 0);
}
function closeMenuOutside(e) { const m = $('#ctxmenu'); if (m && !m.contains(e.target)) closeMenu(); }
function closeMenu() { const m = $('#ctxmenu'); if (m) m.remove(); document.removeEventListener('pointerdown', closeMenuOutside, true); }

// ---- canvas helper: size the backing store to the element (device pixels), return a 2d context in CSS pixels
function fitCanvas(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = cv.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w: r.width, h: r.height };
}
function download(name, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob), a = h('a', { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const safeName = s => (s || 'song').replace(/[^a-z0-9 _-]+/gi, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'song';
const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
