// ===== controls: knobs, faders, selects. Dragging one is a single undo step. =====
function toNorm(v, o) { return o.curve === 'log' ? Math.log(v / o.min) / Math.log(o.max / o.min) : (v - o.min) / (o.max - o.min); }
function fromNorm(n, o) {
  n = clamp(n, 0, 1);
  let v = o.curve === 'log' ? o.min * Math.pow(o.max / o.min, n) : o.min + n * (o.max - o.min);
  if (o.curve === 'int') v = Math.round(v);
  else if (o.step) v = Math.round(v / o.step) * o.step;
  return v;
}
function fmtVal(v, unit) {
  if (unit === 'Hz') return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : Math.round(v) + '';
  if (unit === 's') return v < 1 ? Math.round(v * 1000) + 'ms' : v.toFixed(2) + 's';
  if (unit === 'ms') return Math.round(v) + 'ms';
  if (unit === 'dB') return (v > 0 ? '+' : '') + v.toFixed(1);
  if (unit === '%') return Math.round(v * 100) + '%';
  if (unit === 'st') return (v > 0 ? '+' : '') + Math.round(v);
  if (Math.abs(v) >= 100) return Math.round(v) + (unit || '');
  return (Math.round(v * 100) / 100) + (unit || '');
}
// o: { label, min, max, value, def, curve: lin|log|int, unit, fmt, onInput(v), undo: label (false = no history), small }
function knob(o) {
  const el = h('div', { class: 'knob' + (o.small ? ' small' : ''), title: o.title || o.label || '' });
  const dial = h('div', { class: 'dial' }), lab = o.label ? h('div', { class: 'kl' }, o.label) : null, val = h('div', { class: 'kv' });
  el.append(dial); if (lab) el.append(lab); el.append(val);
  let v = o.value;
  const show = () => { const n = clamp(toNorm(v, o), 0, 1); dial.style.setProperty('--p', n.toFixed(3)); val.textContent = o.fmt ? o.fmt(v) : fmtVal(v, o.unit); };
  const setV = (nv) => { nv = clamp(nv, Math.min(o.min, o.max), Math.max(o.min, o.max)); if (nv === v) return; v = nv; show(); o.onInput(v); };
  el.set = nv => { v = nv; show(); };
  show();
  dial.addEventListener('pointerdown', e => {
    e.preventDefault(); dial.setPointerCapture(e.pointerId);
    if (o.undo !== false) Hist.begin();
    const y0 = e.clientY, n0 = toNorm(v, o);
    el.classList.add('drag');
    const mv = ev => setV(fromNorm(n0 + (y0 - ev.clientY) / (ev.shiftKey ? 700 : 160), o));
    const up = () => { dial.removeEventListener('pointermove', mv); dial.removeEventListener('pointerup', up); dial.removeEventListener('pointercancel', up); el.classList.remove('drag'); if (o.undo !== false) Hist.end(o.undo || ('Change ' + (o.label || 'value'))); };
    dial.addEventListener('pointermove', mv); dial.addEventListener('pointerup', up); dial.addEventListener('pointercancel', up);
  });
  dial.addEventListener('dblclick', () => { if (o.def == null) return; if (o.undo !== false) Hist.begin(); setV(o.def); if (o.undo !== false) Hist.end('Reset ' + (o.label || 'value')); });
  dial.addEventListener('wheel', e => {
    e.preventDefault();
    if (o.undo !== false) Hist.begin();
    const st = o.curve === 'int' ? Math.sign(-e.deltaY) / (o.max - o.min) : -Math.sign(e.deltaY) * (e.shiftKey ? 0.005 : 0.03);
    setV(fromNorm(toNorm(v, o) + st, o));
    if (o.undo !== false) { clearTimeout(el._wt); el._wt = setTimeout(() => Hist.end(o.undo || ('Change ' + (o.label || 'value'))), 400); }
  }, { passive: false });
  return el;
}
// vertical fader 0..1
function fader(o) {
  const el = h('div', { class: 'fader', title: o.title || 'Volume (double-click: reset)' }), thumb = h('div', { class: 'fth' });
  el.append(h('div', { class: 'ftr' }), thumb);
  let v = o.value;
  const show = () => { thumb.style.bottom = 'calc(' + (v / (o.max || 1) * 100) + '% - 7px)'; };
  el.set = nv => { v = nv; show(); };
  show();
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); Hist.begin();
    const r = el.getBoundingClientRect(), y0 = e.clientY, v0 = v, onThumb = e.target === thumb;
    const mv = ev => { v = onThumb ? clamp(v0 + (y0 - ev.clientY) / r.height * (o.max || 1), 0, o.max || 1) : clamp((r.bottom - ev.clientY) / r.height * (o.max || 1), 0, o.max || 1); show(); o.onInput(v); };
    if (!onThumb) mv(e);
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); Hist.end(o.undo || 'Change volume'); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  });
  el.addEventListener('dblclick', () => { Hist.begin(); v = o.def == null ? 0.8 : o.def; show(); o.onInput(v); Hist.end('Reset volume'); });
  return el;
}
// <select> from [[value, label], ...] or [value, ...]
function select(options, value, onChange, cls) {
  const s = h('select', { class: 'sel' + (cls ? ' ' + cls : '') });
  for (const op of options) {
    if (op && op.group) { const g = h('optgroup', { label: op.group }); for (const x of op.items) g.appendChild(h('option', { value: x[0] }, x[1])); s.appendChild(g); continue; }
    const [v, l] = Array.isArray(op) ? op : [op, op];
    s.appendChild(h('option', { value: v }, l));
  }
  s.value = value;
  s.addEventListener('change', () => onChange(s.value));
  s.addEventListener('keydown', e => e.stopPropagation());
  return s;
}
// a number you can drag up/down or type (tempo)
function dragNum(o) {
  const el = h('div', { class: 'dragnum', title: o.title || '' }), lab = h('span', { class: 'dl' }, o.label || ''), val = h('span', { class: 'dv' });
  el.append(lab, val);
  let v = o.value;
  const show = () => { val.textContent = o.fmt ? o.fmt(v) : v; };
  el.set = nv => { v = nv; show(); };
  show();
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); el.setPointerCapture(e.pointerId); Hist.begin();
    const y0 = e.clientY, v0 = v; let moved = false;
    const mv = ev => { const d = Math.round((y0 - ev.clientY) / (ev.shiftKey ? 12 : 3)); if (d) moved = true; const nv = clamp(v0 + d * (o.step || 1), o.min, o.max); if (nv !== v) { v = nv; show(); o.onInput(v); } };
    const up = () => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); Hist.end(o.undo || 'Change ' + (o.label || 'value'));
      if (!moved) ask(o.label || 'Value', String(v), s => { const n = clamp(Math.round(+s) || v, o.min, o.max); Hist.begin(); v = n; show(); o.onInput(v); Hist.end(o.undo || 'Change value'); });
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  });
  el.addEventListener('wheel', e => { e.preventDefault(); Hist.begin(); v = clamp(v - Math.sign(e.deltaY) * (o.step || 1), o.min, o.max); show(); o.onInput(v); clearTimeout(el._wt); el._wt = setTimeout(() => Hist.end(o.undo || 'Change value'), 400); }, { passive: false });
  return el;
}
function toggleBtn(label, on, onChange, title) {
  const b = h('button', { class: 'tog' + (on ? ' on' : ''), title: title || '' }, label);
  b.addEventListener('click', () => { const v = !b.classList.contains('on'); b.classList.toggle('on', v); onChange(v); });
  b.set = v => b.classList.toggle('on', !!v);
  return b;
}
