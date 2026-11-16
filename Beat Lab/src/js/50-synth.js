// ===== Instrument editor: every preset is editable (synth or drum) and can be saved as a user preset =====
const SY = { sig: '', knobs: [] };
const WAVE_OPTS = [{ group: 'Basic', items: [['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Square'], ['sawtooth', 'Saw']] },
  { group: 'Wavetables', items: E.WAVES.slice(4).map(w => [w, w]) },
  { group: 'Sources', items: [['noise', 'Noise'], ['pluck', 'Plucked string']].concat(Object.keys(E.dsp.MODAL).map(k => ['m:' + k, 'Modal: ' + k])) }, { group: 'None', items: [['off', 'Off']] }];
function buildSynth(root) {
  SY.root = root;
  A.views.synth = { dirty: true, draw: drawSynth, show: () => { SY.sig = ''; } };
}
function synthCh() { return curCh(); }
function pget(o, path) { return path.split('.').reduce((a, k) => a && a[k], o); }
function pset(o, path, v) { const ks = path.split('.'), last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; }
function drawSynth() {
  const c = synthCh();
  const sig = c ? c.id + '|' + c.s.k + '|' + c.p + '|' + (c.s.o1 && c.s.o1.w) + (c.s.o2 && c.s.o2.w) : 'none';
  if (sig !== SY.sig) { SY.sig = sig; buildSynthUi(c); }
  for (const k of SY.knobs) k.refresh();
  drawEnv();
}
function sKnob(path, label, min, max, curve, unit, o) {
  const id = A.ui.ch;
  const get = () => { const c = chById(id); return c ? pget(c.s, path) : 0; };
  const k = knob(Object.assign({ label, min, max, value: get(), def: pget(E.normParams(presetById(chById(id).p) ? presetById(chById(id).p).p : null), path), curve, unit, undo: label,
    onInput: v => { const c = chById(id); if (!c) return; pset(c.s, path, v); changed(); SY.envDirty = true; if (c.s.k === 'drm') drumPreviewSoon(); } }, o || {}));
  SY.knobs.push({ refresh: () => k.set(get()) });
  return k;
}
function sSel(path, label, opts, o) {
  const id = A.ui.ch, c = chById(id);
  const s = select(opts, pget(c.s, path), v => { Hist.edit(label, () => { const ch = chById(id); pset(ch.s, path, o && o.num ? +v : v); }); if (c.s.k === 'drm') drumPreviewSoon(); SY.sig = ''; });
  SY.knobs.push({ refresh: () => { const ch = chById(id); if (ch) s.value = pget(ch.s, path); } });
  return h('div', { class: 'kchoice' }, h('label', null, label), s);
}
function sTog(path, label, title) {
  const id = A.ui.ch;
  const b = toggleBtn(label, !!pget(chById(id).s, path), v => Hist.edit(label, () => pset(chById(id).s, path, v ? 1 : 0)), title);
  SY.knobs.push({ refresh: () => { const ch = chById(id); if (ch) b.set(pget(ch.s, path)); } });
  return b;
}
const card = (title, ...kids) => h('div', { class: 'sy-card' }, h('div', { class: 'sy-t' }, title), h('div', { class: 'knobs' }, ...kids));
function buildSynthUi(c) {
  const root = SY.root; root.innerHTML = ''; SY.knobs = [];
  if (!c) { root.appendChild(h('p', { class: 'hint pad' }, 'Add a channel first: pick a sound in the browser.')); return; }
  const info = presetById(c.p);
  const head = h('div', { class: 'ptools' },
    h('span', { class: 'sy-name', style: { '--c': c.col } }, c.n), h('span', { class: 'hint' }, info ? 'preset: ' + info.n + ' (' + info.c + ')' : 'custom sound'),
    h('button', { class: 'btn small', title: 'Hear it', onclick: () => A.eng.hit(c.id, c.s.k === 'drm' ? 60 : 60, 0.85, 0.8) }, 'Play C4'),
    h('button', { class: 'btn small', title: 'Undo every change since the preset', onclick: () => { if (info) Hist.edit('Reset sound', () => { chById(c.id).s = E.normParams(info.p); }); SY.sig = ''; } }, 'Reset to preset'),
    h('button', { class: 'btn small primary', title: 'Keep this sound in the browser under User', onclick: () => ask('Save as a user preset', c.n, n => { const id = Store.saveUserPreset(n, E.clone(chById(c.id).s)); Hist.edit('Save preset', () => { chById(c.id).p = id; }); fillBrowser(ST.search.value); toast('Saved "' + n + '" to User presets'); }) }, 'Save as preset'));
  root.appendChild(head);
  const body = h('div', { class: 'sy-body' });
  root.appendChild(body);
  if (c.s.k === 'drm') {
    body.append(card('Drum', sSel('d.type', 'Type', E.dsp.DRUM_TYPES), sKnob('d.tune', 'Tune', -24, 24, 'lin', 'st', { step: 0.1 }), sKnob('d.dec', 'Decay', 0.1, 5, 'log', 'x'),
      sKnob('d.tone', 'Tone', 0, 1, 'lin', '%'), sKnob('d.snap', 'Snap', 0, 1, 'lin', '%'), sKnob('d.drive', 'Drive', 0, 1, 'lin', '%'), sKnob('d.crush', 'Lo-fi', 0, 1, 'lin', '%')),
    card('Output', sKnob('gain', 'Volume', 0, 1.5, 'lin', '%'), sKnob('cg', 'Choke group', 0, 4, 'int', '', { fmt: v => v ? String(v) : 'off', title: 'Drums in the same group cut each other off (closed hat stops the open hat)' })));
    const wave = h('canvas', { class: 'sy-wave' }); SY.wave = wave;
    body.appendChild(h('div', { class: 'sy-card wide' }, h('div', { class: 'sy-t' }, 'Sound'), wave));
    setTimeout(drawDrumWave, 30);
  } else {
    const osc = n => card('Oscillator ' + n, sSel('o' + n + '.w', 'Wave', WAVE_OPTS), sKnob('o' + n + '.oct', 'Octave', -3, 3, 'int', ''), sKnob('o' + n + '.semi', 'Semi', -12, 12, 'int', 'st'),
      sKnob('o' + n + '.fine', 'Fine', -100, 100, 'lin', 'c', { step: 1 }), sKnob('o' + n + '.lvl', 'Level', 0, 1, 'lin', '%'), sKnob('o' + n + '.uni', 'Unison', 1, 7, 'int', ''), sKnob('o' + n + '.det', 'Detune', 0, 60, 'lin', 'c', { step: 1 }));
    body.append(osc(1), osc(2));
    body.append(card('Extra', sKnob('sub', 'Sub', 0, 1, 'lin', '%'), sKnob('nz', 'Noise', 0, 1, 'lin', '%'), sKnob('fm', 'FM amount', 0, 10, 'lin', '', { step: 0.05 }), sKnob('fmr', 'FM ratio', 0.25, 16, 'log', 'x', { step: 0.01 }), sKnob('fmd', 'FM decay', 0, 4, 'lin', 's', { step: 0.01 })));
    if ([c.s.o1.w, c.s.o2.w].includes('pluck')) body.append(card('Plucked string', sKnob('ks.damp', 'Damping', 0, 1, 'lin', '%'), sKnob('ks.bright', 'Brightness', 0, 1, 'lin', '%'), sKnob('ks.dur', 'Length', 0.3, 8, 'log', 's'), sKnob('ks.pos', 'Pick spot', 0.02, 0.5, 'lin', '')));
    body.append(card('Filter', sSel('f.t', 'Type', [['lp', 'Low-pass'], ['hp', 'High-pass'], ['bp', 'Band-pass'], ['notch', 'Notch']]), sKnob('f.fc', 'Cutoff', 30, 18000, 'log', 'Hz'), sKnob('f.q', 'Resonance', 0.3, 24, 'log', ''),
      sKnob('f.env', 'Env amount', -4, 6, 'lin', 'oct', { step: 0.05 }), sKnob('f.kt', 'Key track', 0, 1, 'lin', '%'), sKnob('f.vel', 'Vel > cutoff', 0, 3, 'lin', 'oct', { step: 0.05 }),
      sKnob('f.a', 'Attack', 0.001, 5, 'log', 's'), sKnob('f.d', 'Decay', 0.01, 6, 'log', 's'), sKnob('f.s', 'Sustain', 0, 1, 'lin', '%'), sKnob('f.r', 'Release', 0.005, 6, 'log', 's')));
    const env = h('canvas', { class: 'sy-env' }); SY.env = env;
    body.append(card('Amp envelope', sKnob('amp.a', 'Attack', 0.001, 5, 'log', 's'), sKnob('amp.d', 'Decay', 0.01, 6, 'log', 's'), sKnob('amp.s', 'Sustain', 0, 1, 'lin', '%'), sKnob('amp.r', 'Release', 0.005, 6, 'log', 's'), sKnob('vel', 'Velocity', 0, 1, 'lin', '%'), env));
    body.append(card('Pitch', sKnob('pe', 'Env amount', -36, 36, 'int', 'st'), sKnob('pt', 'Env time', 0.005, 4, 'log', 's'), sKnob('glide', 'Glide', 0, 1, 'lin', 's', { step: 0.005 }), sTog('mono', 'Mono', 'One note at a time; overlapping notes glide'), sKnob('poly', 'Voices', 1, 16, 'int', '')));
    body.append(card('LFO', sSel('lfo.tgt', 'Target', [['off', 'Off'], ['pitch', 'Pitch (vibrato)'], ['filter', 'Filter (wah)'], ['amp', 'Volume (tremolo)']]), sSel('lfo.w', 'Shape', [['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Square'], ['sawtooth', 'Saw']]),
      sKnob('lfo.r', 'Rate', 0.05, 20, 'log', 'Hz'), sSel('lfo.sync', 'Sync', [['', 'Free']].concat(Object.keys(E.SYNC).map(k => [k, k]))), sKnob('lfo.amt', 'Amount', 0, 4, 'lin', '', { step: 0.01, title: 'Pitch: semitones · Filter: x2 octaves · Volume: depth' })));
    body.append(card('Character', sKnob('drive', 'Drive', 0, 1, 'lin', '%'), sSel('vowel', 'Vowel', [['', 'None'], ['a', 'Aah'], ['e', 'Eh'], ['i', 'Ee'], ['o', 'Oh'], ['u', 'Ooh']]), sKnob('gain', 'Volume', 0, 1.5, 'lin', '%')));
  }
  const kb = h('canvas', { class: 'sy-kb', title: 'Click to play' });
  root.appendChild(kb); SY.kb = kb;
  let held = null;
  kb.addEventListener('pointerdown', e => { A.eng.audio(); kb.setPointerCapture(e.pointerId); held = kbNote(e); if (held != null) A.eng.noteOn(c.id, held, 0.85); });
  kb.addEventListener('pointermove', e => { if (held == null) return; const n = kbNote(e); if (n !== held && n != null) { A.eng.noteOff(c.id, held); held = n; A.eng.noteOn(c.id, n, 0.85); } });
  const up = () => { if (held != null) A.eng.noteOff(c.id, held); held = null; };
  kb.addEventListener('pointerup', up); kb.addEventListener('pointercancel', up);
  setTimeout(drawKb, 0);
  SY.envDirty = true;
}
const KB_LO = 36, KB_HI = 84;
function kbLayout() { const whites = []; for (let m = KB_LO; m <= KB_HI; m++) if (!isBlack(m)) whites.push(m); return whites; }
function drawKb() {
  if (!SY.kb || !SY.kb.isConnected) return;
  const { g, w, h: H } = fitCanvas(SY.kb), whites = kbLayout(), ww = w / whites.length;
  g.fillStyle = '#111'; g.fillRect(0, 0, w, H);
  whites.forEach((m, i) => { g.fillStyle = '#f1f3f5'; g.fillRect(i * ww + 0.5, 0, ww - 1, H); if (m % 12 === 0) { g.fillStyle = '#868e96'; g.font = '9px system-ui'; g.fillText(noteName(m), i * ww + 3, H - 5); } });
  whites.forEach((m, i) => { if (m < KB_HI && isBlack(m + 1)) { g.fillStyle = '#212529'; g.fillRect((i + 1) * ww - ww * 0.3, 0, ww * 0.6, H * 0.6); } });
}
function kbNote(e) {
  const r = SY.kb.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, whites = kbLayout(), ww = r.width / whites.length;
  const i = Math.floor(x / ww); if (i < 0 || i >= whites.length) return null;
  if (y < r.height * 0.6) { const fx = x / ww - i; if (fx > 0.7 && whites[i] < KB_HI && isBlack(whites[i] + 1)) return whites[i] + 1; if (fx < 0.3 && i > 0 && isBlack(whites[i] - 1)) return whites[i] - 1; }
  return whites[i];
}
function drawEnv() {
  if (!SY.envDirty || !SY.env || !SY.env.isConnected) return;
  SY.envDirty = false;
  const c = synthCh(); if (!c || c.s.k !== 'syn') return;
  const { g, w, h: H } = fitCanvas(SY.env), A0 = c.s.amp, F0 = c.s.f;
  g.fillStyle = '#14181c'; g.fillRect(0, 0, w, H);
  const plot = (e, col, scale) => {
    const tot = e.a + e.d + 0.6 + e.r, sx = (w - 6) / tot;
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
    g.moveTo(3, H - 3); g.lineTo(3 + e.a * sx, 4 + (H - 8) * (1 - scale));
    g.lineTo(3 + (e.a + e.d) * sx, 4 + (H - 8) * (1 - scale * e.s)); g.lineTo(3 + (e.a + e.d + 0.6) * sx, 4 + (H - 8) * (1 - scale * e.s)); g.lineTo(3 + tot * sx, H - 3); g.stroke();
  };
  if (F0.env) plot(F0, 'rgba(116, 192, 252, 0.8)', 0.8);
  plot(A0, '#ff922b', 1);
}
let drumT = 0;
function drumPreviewSoon() { clearTimeout(drumT); drumT = setTimeout(() => { drawDrumWave(); const c = synthCh(); if (c && !Hist.pending) A.eng.hit(c.id, 60, 0.85, 0.5); }, 250); }
function drawDrumWave() {
  const c = synthCh(); if (!c || c.s.k !== 'drm' || !SY.wave || !SY.wave.isConnected) return;
  const data = E.dsp.drum(c.s.d, 22050), { g, w, h: H } = fitCanvas(SY.wave);
  g.fillStyle = '#14181c'; g.fillRect(0, 0, w, H);
  g.fillStyle = c.col; const step = Math.max(1, Math.floor(data.length / w));
  for (let x = 0; x < w; x++) { let pk = 0; for (let i = x * step; i < (x + 1) * step && i < data.length; i++) pk = Math.max(pk, Math.abs(data[i])); const hh = pk * (H / 2 - 2); g.fillRect(x, H / 2 - hh, 1, hh * 2 || 1); }
  g.fillStyle = '#868e96'; g.font = '10px system-ui'; g.fillText((data.length / 22050).toFixed(2) + ' s', 6, 12);
}
on('changed', all => { if (all) SY.sig = ''; if (A.views.synth) A.views.synth.dirty = true; SY.envDirty = true; });
