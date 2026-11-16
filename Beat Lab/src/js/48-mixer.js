// ===== Mixer: insert tracks with volume, pan, mute/solo, meters, routing, a send, and effect slots =====
const MX = { sel: 1, slot: 0, sig: '', esig: '', strips: [], buf: new Float32Array(256), peaks: [], frame: 0 };
function buildMixer(root) {
  const strips = h('div', { class: 'mx-strips' }), editor = h('div', { class: 'mx-editor' });
  root.append(h('div', { class: 'ptools' }, h('button', { class: 'btn small', onclick: () => Hist.edit('Add mixer track', () => { if (A.p.mix.length < 25) A.p.mix.push(Object.assign(E.clone(E.TRACK_DEFAULT), { n: 'Insert ' + A.p.mix.length })); }) }, '+ Track'),
    h('span', { class: 'hint' }, 'Channels play into a mixer track (the number on each channel in the rack). Click a track to edit its effects.')), h('div', { class: 'mx-body' }, strips, editor));
  Object.assign(MX, { root, stripsEl: strips, editor });
  A.views.mixer = { dirty: true, draw: drawMixer, overlay: mixerMeters, show: () => { MX.sig = ''; } };
}
function mixSig() { return A.p.mix.map(m => [m.n, m.out, m.snd ? m.snd[0] : '', m.fx.map(f => f.t + f.on).join(',')].join('|')).join(';') + '#' + A.p.ch.map(c => c.mix + c.n).join(','); }
function drawMixer() {
  if (MX.sel >= A.p.mix.length) MX.sel = 0;
  const sig = mixSig();
  if (sig !== MX.sig) { MX.sig = sig; MX.esig = ''; buildStrips(); }
  const m0 = A.p.mix[MX.sel], esig = MX.sel + ':' + MX.slot + ':' + (m0 ? m0.n + m0.fx.map(f => f.t + f.on).join(',') : '');
  if (esig !== MX.esig) { MX.esig = esig; buildFxEditor(); }
  const anySolo = A.p.mix.some((m, i) => i > 0 && m.solo);
  MX.strips.forEach((s, i) => {
    const m = A.p.mix[i]; if (!m) return;
    s.fader.set(m.vol); if (s.pan) s.pan.set(m.pan); if (s.snd) s.snd.set(m.snd ? m.snd[1] : 0);
    s.mute.classList.toggle('on', !!m.mute); if (s.solo) s.solo.classList.toggle('on', !!m.solo);
    s.el.classList.toggle('dim', !!(m.mute || (i > 0 && anySolo && !m.solo)));
    s.el.classList.toggle('sel', i === MX.sel);
    s.slots.forEach((b, j) => b.classList.toggle('on', i === MX.sel && j === MX.slot));
    s.db.textContent = m.vol > 0 ? (20 * Math.log10(E.volGain(m.vol))).toFixed(1) : '-inf';
  });
  if (MX.knobs) for (const k of MX.knobs) k.refresh();
}
function buildStrips() {
  MX.stripsEl.innerHTML = ''; MX.strips = [];
  A.p.mix.forEach((m, i) => {
    const name = h('div', { class: 'mx-name', title: 'Double-click to rename' }, i ? i + ' ' + m.n : 'Master');
    name.addEventListener('dblclick', () => ask('Rename mixer track', m.n, v => Hist.edit('Rename track', () => { A.p.mix[i].n = v; })));
    const meter = h('canvas', { class: 'mx-meter' });
    const fd = fader({ value: m.vol, max: 1, def: 0.8, undo: 'Track volume', onInput: v => { A.p.mix[i].vol = v; changed(); } });
    const db = h('div', { class: 'mx-db' });
    const pan = i ? knob({ min: -1, max: 1, value: m.pan, def: 0, small: true, title: 'Pan', fmt: v => v === 0 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100), undo: 'Track pan', onInput: v => { A.p.mix[i].pan = v; changed(); } }) : null;
    const mute = h('button', { class: 'ms', title: 'Mute', onclick: e => { e.stopPropagation(); Hist.edit('Mute track', () => { A.p.mix[i].mute = A.p.mix[i].mute ? 0 : 1; }); } }, 'M');
    const solo = i ? h('button', { class: 'ms solo', title: 'Solo', onclick: e => { e.stopPropagation(); Hist.edit('Solo track', () => { const was = A.p.mix[i].solo; A.p.mix.forEach(x => x.solo = 0); A.p.mix[i].solo = was ? 0 : 1; }); } }, 'S') : null;
    const slotEls = m.fx.map((f, j) => h('button', { class: 'slot' + (f.on ? '' : ' byp'), title: E.FX[f.t] ? E.FX[f.t].name : f.t, onclick: e => { e.stopPropagation(); MX.sel = i; MX.slot = j; markViews(); } }, E.FX[f.t] ? E.FX[f.t].name : f.t));
    const slots = h('div', { class: 'mx-slots' }, slotEls,
      m.fx.length < 8 ? h('button', { class: 'slot add', onclick: e => { e.stopPropagation(); fxAddMenu(e.clientX, e.clientY, i); } }, '+ effect') : null);
    let route = null, snd = null, sndTo = null;
    if (i) {
      route = select(A.p.mix.map((x, k) => [k, k ? k + ' ' + x.n : 'Master']).filter(o => +o[0] !== i), m.out, v => Hist.edit('Route track', () => { A.p.mix[i].out = +v; }), 'tiny');
      route.title = 'Output: where this track goes';
      sndTo = select([[0, 'no send']].concat(A.p.mix.map((x, k) => [k, 'to ' + k + ' ' + x.n]).filter(o => +o[0] > 0 && +o[0] !== i)), m.snd ? m.snd[0] : 0, v => Hist.edit('Send', () => { A.p.mix[i].snd = +v ? [+v, A.p.mix[i].snd ? A.p.mix[i].snd[1] : 0.4] : null; }), 'tiny');
      sndTo.title = 'Send a copy to another track (e.g. a shared reverb)';
      snd = knob({ min: 0, max: 1, value: m.snd ? m.snd[1] : 0, def: 0.4, small: true, title: 'Send level', fmt: v => Math.round(v * 100) + '%', undo: 'Send level', onInput: v => { if (!A.p.mix[i].snd) A.p.mix[i].snd = [0, v]; A.p.mix[i].snd[1] = v; changed(); } });
    }
    const chans = A.p.ch.filter(c => c.mix === i).map(c => c.n).join(', ');
    const el = h('div', { class: 'mx-strip' + (i === 0 ? ' master' : ''), title: chans ? 'Channels: ' + chans : '' },
      name, slots, i ? h('div', { class: 'mx-row' }, h('span', { class: 'lab' }, 'Out'), route) : h('div', { class: 'mx-row' }, toggleBtn('Limiter', !!m.lim, v => Hist.edit('Limiter', () => { A.p.mix[0].lim = v ? 1 : 0; }), 'Brick-wall limiter so the song never clips')),
      i ? h('div', { class: 'mx-row send' }, sndTo, snd) : h('div', { class: 'mx-row' }),
      h('div', { class: 'mx-fade' }, meter, fd), db, h('div', { class: 'mx-row' }, pan, mute, solo));
    el.addEventListener('pointerdown', () => { if (MX.sel !== i) { MX.sel = i; MX.slot = 0; markViews(); } });
    MX.stripsEl.appendChild(el);
    MX.strips.push({ el, fader: fd, pan, mute, solo, meter, snd, db, slots: slotEls });
  });
}
function fxAddMenu(x, y, track) {
  menu(x, y, E.FX_ORDER.map(t => ({ t: E.FX[t].name, f: () => { Hist.edit('Add ' + E.FX[t].name, () => { A.p.mix[track].fx.push({ t, on: 1, p: E.fxDefaults(t) }); }); MX.sel = track; MX.slot = A.p.mix[track].fx.length - 1; markViews(); } })));
}
function buildFxEditor() {
  const m = A.p.mix[MX.sel], ed = MX.editor; ed.innerHTML = ''; MX.knobs = [];
  if (!m) return;
  ed.appendChild(h('h4', null, (MX.sel ? 'Track ' + MX.sel + ': ' : '') + m.n));
  if (!m.fx.length) { ed.appendChild(h('p', { class: 'hint' }, 'No effects yet. Add one with "+ effect" on the track.')); return; }
  MX.slot = clamp(MX.slot, 0, m.fx.length - 1);
  const list = h('div', { class: 'fx-list' });
  m.fx.forEach((f, j) => {
    const row = h('div', { class: 'fx-row' + (j === MX.slot ? ' on' : '') },
      h('button', { class: 'led' + (f.on ? '' : ' off'), title: f.on ? 'On (click to bypass)' : 'Bypassed (click to turn on)', onclick: () => Hist.edit('Bypass effect', () => { m.fx[j].on = m.fx[j].on ? 0 : 1; }) }),
      h('span', { class: 'fn', onclick: () => { MX.slot = j; markViews(); } }, (j + 1) + '. ' + (E.FX[f.t] ? E.FX[f.t].name : f.t)),
      h('button', { class: 'mini', title: 'Move up', onclick: () => { if (j > 0) { Hist.edit('Move effect', () => { const a = m.fx; [a[j - 1], a[j]] = [a[j], a[j - 1]]; }); MX.slot = j - 1; } } }, '▲'),
      h('button', { class: 'mini', title: 'Move down', onclick: () => { if (j < m.fx.length - 1) { Hist.edit('Move effect', () => { const a = m.fx; [a[j + 1], a[j]] = [a[j], a[j + 1]]; }); MX.slot = j + 1; } } }, '▼'),
      h('button', { class: 'mini', title: 'Remove', onclick: () => Hist.edit('Remove effect', () => { m.fx.splice(j, 1); }) }, '✕'));
    list.appendChild(row);
  });
  ed.appendChild(list);
  const f = m.fx[MX.slot], spec = E.FX[f.t];
  if (!spec) return;
  const box = h('div', { class: 'knobs' });
  for (const prm of spec.params) {
    const [key, label, def] = prm, track = MX.sel, slot = MX.slot;
    const get = () => { const t = A.p.mix[track], fx = t && t.fx[slot]; return fx ? fx.p : null; };
    if (Array.isArray(prm[3])) {
      const s = select(prm[3], f.p[key], v => Hist.edit(label, () => { get()[key] = v; }), 'small');
      box.appendChild(h('div', { class: 'kchoice' }, h('label', null, label), s));
      MX.knobs.push({ refresh: () => { const p = get(); if (p) s.value = p[key]; } });
    } else {
      const k = knob({ label, min: prm[3], max: prm[4], value: f.p[key], def, curve: prm[5], unit: prm[6], undo: label, onInput: v => { const p = get(); if (p) { p[key] = v; changed(); } } });
      box.appendChild(k);
      MX.knobs.push({ refresh: () => { const p = get(); if (p) k.set(p[key]); } });
    }
  }
  ed.append(h('div', { class: 'fx-title' }, spec.name), box);
}
function mixerMeters() {
  if (++MX.frame % 2) return;
  const eng = A.eng; if (!eng.ctx) return;
  MX.strips.forEach((s, i) => {
    const t = eng.mix[i]; if (!t) return;
    t.an.getFloatTimeDomainData(MX.buf);
    let pk = 0; for (let k = 0; k < MX.buf.length; k++) { const a = Math.abs(MX.buf[k]); if (a > pk) pk = a; }
    const prev = MX.peaks[i] || 0, v = Math.max(pk, prev * 0.88); MX.peaks[i] = v;
    if (v < 0.002 && prev < 0.002 && s.meter._z) return;
    s.meter._z = v < 0.002;
    const { g, w, h: H } = fitCanvas(s.meter);
    g.fillStyle = '#111518'; g.fillRect(0, 0, w, H);
    const db = v > 0 ? 20 * Math.log10(v) : -90, n = clamp((db + 48) / 54, 0, 1);
    const grad = g.createLinearGradient(0, H, 0, 0); grad.addColorStop(0, '#2fbf71'); grad.addColorStop(0.75, '#e8d44d'); grad.addColorStop(1, '#ff4d4d');
    g.fillStyle = grad; g.fillRect(1, H - n * H, w - 2, n * H);
    if (v >= 0.99) { g.fillStyle = '#ff4d4d'; g.fillRect(0, 0, w, 3); }
  });
}
on('changed', all => { if (all) MX.sig = ''; if (A.views.mixer) A.views.mixer.dirty = true; });
