// ===== Simple mode: a big colourful song grid. Notes are stored by scale degree (row) so changing key or scale moves
// them with it. It plays through the same engine: simpleToProject() turns the grid into a one-pattern project. =====
const ICON = {
  piano: '<rect x="3" y="6" width="26" height="20" rx="2"/><path d="M9 6v20M15 6v20M21 6v20" stroke-width="1.5"/><rect x="7" y="6" width="4" height="11" fill="currentColor"/><rect x="13" y="6" width="4" height="11" fill="currentColor"/><rect x="19" y="6" width="4" height="11" fill="currentColor"/>',
  marimba: '<rect x="4" y="8" width="5" height="18" rx="1"/><rect x="11" y="10" width="5" height="14" rx="1"/><rect x="18" y="12" width="5" height="10" rx="1"/><rect x="25" y="14" width="4" height="6" rx="1"/>',
  guitar: '<circle cx="11" cy="21" r="7"/><path d="M15 17L27 5M24 4l4 4"/><circle cx="11" cy="21" r="2" fill="currentColor"/>',
  strings: '<path d="M16 3c-4 4-4 7 0 9-5 3-6 9 0 17 6-8 5-14 0-17 4-2 4-5 0-9z"/><path d="M16 9v18"/>',
  flute: '<rect x="3" y="13" width="26" height="6" rx="3"/><circle cx="10" cy="16" r="1.2" fill="currentColor"/><circle cx="15" cy="16" r="1.2" fill="currentColor"/><circle cx="20" cy="16" r="1.2" fill="currentColor"/><circle cx="25" cy="16" r="1.2" fill="currentColor"/>',
  synth: '<path d="M3 16c3-9 5-9 7 0s4 9 7 0 4-9 6 0 4 9 6 0"/>',
  choir: '<circle cx="16" cy="11" r="6"/><path d="M6 28c1-7 5-10 10-10s9 3 10 10"/><ellipse cx="16" cy="12.5" rx="2" ry="1.5" fill="currentColor"/>',
  bells: '<path d="M16 4c-6 0-8 6-8 12l-3 6h22l-3-6c0-6-2-12-8-12z"/><circle cx="16" cy="26" r="2.5" fill="currentColor"/>',
  chip: '<rect x="6" y="6" width="20" height="20" rx="2"/><path d="M11 11h4v4h-4zM17 17h4v4h-4zM17 11h4v4h-4z" fill="currentColor"/>',
  bass: '<path d="M8 26c-3-3-2-7 2-8l10-12 3 3-12 10c-1 4-5 5-3 7z"/><path d="M22 4l6 6"/>'
};
const SIMPLE_INST = E.SIMPLE_INST, SIMPLE_KITS = E.SIMPLE_KITS, LANES = E.SIMPLE_LANES;
const SIMPLE_SCALES = ['major', 'minor', 'pentatonic', 'minpent', 'blues', 'dorian', 'chromatic'];
const simpleNormalize = E.simpleNormalize, sCols = E.simpleCols, sRows = E.simpleRows, sMidi = E.simpleMidi;
const simpleToProject = (s, name) => E.fromSimple(s, name);
function newSimpleProject(name) { return { id: uid(), name: name || 'My song', mode: 'simple', simple: simpleNormalize({}), t: Date.now() }; }
let SP = null;                                     // the engine's copy of the simple song
function simpleSync() { SP = simpleToProject(A.p.simple, A.p.name); A.eng.load(SP); }

// ---------------------------------------------------------------- the view
const SV = { cv: null, dirty: true, drag: null, hover: null, lastCol: -1, pulse: {} };
function svgIcon(name) { return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' + (ICON[name] || '') + '</svg>'; }
function buildSimple() {
  const root = $('#simple');
  root.innerHTML = '';
  const s = () => A.p.simple;
  const edit = (label, fn) => Hist.edit(label, () => { fn(s()); });
  // top: play, tempo, instruments, kits
  const play = h('button', { id: 's-play', class: 'bigplay', title: 'Play / stop (Space)', onclick: () => togglePlay() }, h('span', { class: 'pi' }));
  const tempoVal = h('b', null, '');
  const tempo = h('input', { type: 'range', min: 40, max: 220, value: 110, class: 'slider', 'aria-label': 'Tempo' });
  tempo.addEventListener('pointerdown', () => Hist.begin());
  tempo.addEventListener('input', () => { s().bpm = +tempo.value; tempoVal.textContent = tempo.value; changed(); });
  tempo.addEventListener('change', () => Hist.end('Change tempo'));
  const insts = h('div', { class: 's-insts' }, SIMPLE_INST.map(x => h('button', { class: 'ibtn', 'data-id': x.id, title: x.n, onclick: () => { edit('Instrument', d => d.inst = x.id); A.eng.hit(1, sMidi(s(), SCALES[s().scale].s.length), 0.8, 0.5); } }, h('i', { html: svgIcon(x.id) }), h('span', null, x.n))));
  const kits = h('div', { class: 's-kits' }, SIMPLE_KITS.map(x => h('button', { class: 'kbtn', 'data-id': x.id, onclick: () => { edit('Drum kit', d => d.kit = x.id); A.eng.hit(2, 60, 0.9, 0.3); } }, x.n)));
  root.append(h('div', { class: 's-top' }, play, h('div', { class: 's-tempo' }, h('label', null, 'Tempo'), tempo, tempoVal), h('div', { class: 's-sounds' }, h('div', { class: 's-lab' }, 'Instrument'), insts, h('div', { class: 's-lab' }, 'Drums'), kits)));
  // grid
  const wrap = h('div', { class: 's-gridwrap' }), cv = h('canvas', { id: 's-grid' });
  wrap.append(cv); root.append(wrap); SV.cv = cv; SV.wrap = wrap;
  // bottom
  const keySel = select(NOTE_NAMES.map((n, i) => [i, n]), 0, v => edit('Key', d => d.key = +v));
  const scaleSel = select(SIMPLE_SCALES.map(k => [k, SCALES[k].n]), 'major', v => edit('Scale', d => d.scale = v));
  const octSel = select([[2, 'Low'], [3, 'Middle-low'], [4, 'Middle'], [5, 'High']], 4, v => edit('Octave', d => d.oct = +v));
  const rangeSel = select([[1, '1 octave'], [2, '2 octaves'], [3, '3 octaves']], 2, v => edit('Range', d => d.range = +v));
  const beatsSel = select([2, 3, 4, 5, 6, 7].map(n => [n, n + ' beats']), 4, v => edit('Beats', d => d.beats = +v));
  const splitSel = select([[1, 'No split'], [2, 'Split in 2'], [3, 'Split in 3'], [4, 'Split in 4']], 2, v => edit('Beat split', d => d.split = +v));
  const barsVal = h('b', null, '4');
  const bars = h('div', { class: 's-bars' }, h('button', { class: 'rnd', title: 'Fewer bars', onclick: () => edit('Bars', d => d.bars = clamp(d.bars - 1, 1, 16)) }, '-'), h('span', null, 'Bars ', barsVal), h('button', { class: 'rnd', title: 'More bars', onclick: () => edit('Bars', d => d.bars = clamp(d.bars + 1, 1, 16)) }, '+'));
  const echo = toggleBtn('Echo', true, v => edit('Echo', d => d.echo = v ? 1 : 0), 'Reverb on everything'), swing = toggleBtn('Swing', false, v => edit('Swing', d => d.swing = v ? 1 : 0), 'A bouncy, shuffled feel');
  const songs = select([['', 'Songs to start from...']].concat(SIMPLE_SONGS.map((x, i) => [i, x.n])), '', v => { if (v === '') return; songs.value = ''; const so = SIMPLE_SONGS[+v]; Hist.edit('Load ' + so.n, () => { A.p.simple = simpleNormalize(E.clone(so.s())); }); toast('Loaded "' + so.n + '": press Play'); });
  root.append(h('div', { class: 's-bottom' },
    h('div', { class: 's-group' }, h('label', null, 'Key'), keySel, scaleSel), h('div', { class: 's-group' }, h('label', null, 'Notes'), octSel, rangeSel),
    h('div', { class: 's-group' }, bars, beatsSel, splitSel), h('div', { class: 's-group' }, echo, swing),
    h('div', { class: 's-group' }, h('button', { class: 'btn', title: 'Undo (Ctrl+Z)', onclick: () => Hist.doUndo() }, 'Undo'), h('button', { class: 'btn', title: 'Redo (Ctrl+Y)', onclick: () => Hist.doRedo() }, 'Redo'),
      h('button', { class: 'btn', onclick: () => confirmBox('Clear the song?', 'Every note and drum hit goes (Undo brings them back).', 'Clear', () => edit('Clear', d => { d.mel = []; d.drm = []; })) }, 'Clear')),
    h('div', { class: 's-group' }, h('button', { class: 'btn fun', title: 'Make up a melody and a beat', onclick: () => edit('Surprise', d => surprise(d)) }, 'Surprise me!'), songs),
    h('div', { class: 's-group right' }, h('button', { class: 'btn', title: 'Save the song as a WAV sound file', onclick: () => exportWav(true) }, 'Save WAV'), h('button', { class: 'btn', title: 'Play this song on the launcher\'s pages', onclick: () => launcherMusic() }, '♪ Launcher music'), h('button', { class: 'btn primary', title: 'Turn this into a full Studio project', onclick: openInStudio }, 'Open in Studio →'))));
  SV.refresh = () => {
    const d = s();
    tempo.value = d.bpm; tempoVal.textContent = d.bpm;
    $$('.ibtn', insts).forEach(b => b.classList.toggle('on', b.dataset.id === d.inst));
    $$('.kbtn', kits).forEach(b => b.classList.toggle('on', b.dataset.id === d.kit));
    keySel.value = d.key; scaleSel.value = d.scale; octSel.value = d.oct; rangeSel.value = d.range; beatsSel.value = d.beats; splitSel.value = d.split; barsVal.textContent = d.bars;
    echo.set(d.echo); swing.set(d.swing);
    SV.dirty = true;
  };
  // painting
  cv.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    A.eng.audio();
    const cell = simpleHit(e); if (!cell) return;
    cv.setPointerCapture(e.pointerId);
    const d = s(), list = cell.drum ? d.drm : d.mel, key = cell.drum ? cell.lane : cell.row;
    const has = list.some(n => n[0] === cell.col && n[1] === key);
    Hist.begin();
    SV.drag = { add: !has, drum: cell.drum, done: new Set() };
    paintCell(cell);
  });
  cv.addEventListener('pointermove', e => {
    const cell = simpleHit(e);
    SV.hover = cell; SV.dirty = true;
    if (SV.drag && cell && cell.drum === SV.drag.drum) paintCell(cell);
  });
  const end = () => { if (SV.drag) { SV.drag = null; Hist.end('Paint notes'); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { SV.hover = null; SV.dirty = true; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  new ResizeObserver(() => { SV.dirty = true; }).observe(wrap);
}
function paintCell(cell) {
  const d = A.p.simple, k = (cell.drum ? 'd' : 'm') + cell.col + ':' + (cell.drum ? cell.lane : cell.row);
  if (SV.drag.done.has(k)) return; SV.drag.done.add(k);
  const list = cell.drum ? d.drm : d.mel, key = cell.drum ? cell.lane : cell.row;
  const i = list.findIndex(n => n[0] === cell.col && n[1] === key);
  if (SV.drag.add && i < 0) {
    list.push([cell.col, key]);
    if (cell.drum) A.eng.hit(2 + cell.lane, 60, 0.9, 0.3); else A.eng.hit(1, sMidi(d, cell.row), 0.8, 0.35);
    SV.pulse[k] = performance.now();
  } else if (!SV.drag.add && i >= 0) list.splice(i, 1);
  changed();
}
function simpleGeom() {
  const d = A.p.simple, cols = sCols(d), rows = sRows(d), r = SV.wrap.getBoundingClientRect();
  const W = Math.max(r.width, cols * 20), H = r.height;
  const laneH = clamp(H * 0.075, 20, 34), drumH = laneH * 4 + 10, cw = W / cols, rh = (H - drumH) / rows;
  return { d, cols, rows, W, H, laneH, drumH, cw, rh, top: H - drumH + 10 };
}
function simpleHit(e) {
  const r = SV.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, G = simpleGeom();
  const col = Math.floor(x / G.cw); if (col < 0 || col >= G.cols) return null;
  if (y < G.H - G.drumH) { const row = G.rows - 1 - Math.floor(y / G.rh); if (row < 0 || row >= G.rows) return null; return { col, row, drum: false }; }
  const lane = Math.floor((y - G.top) / G.laneH); if (lane < 0 || lane > 3) return null;
  return { col, lane, drum: true };
}
const pcHue = pc => [0, 18, 36, 52, 75, 120, 160, 185, 205, 230, 265, 300][pc];
function drawSimple(pos) {
  const G = simpleGeom(), { d, cols, rows, cw, rh, laneH } = G;
  if (SV.cvW !== G.W) { SV.cvW = G.W; SV.cv.style.width = G.W + 'px'; }
  const { g, w, h: H } = fitCanvas(SV.cv);
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, H);
  const mh = H - G.drumH, n = SCALES[d.scale].s.length, now = performance.now();
  const playCol = pos == null ? -1 : Math.floor(pos / (PPQ / d.split));
  // beat shading and the playhead column
  for (let c = 0; c < cols; c++) {
    const beat = Math.floor(c / d.split);
    if (beat % 2) { g.fillStyle = '#f4f6fb'; g.fillRect(c * cw, 0, cw, H); }
  }
  if (playCol >= 0) { g.fillStyle = 'rgba(255, 214, 10, 0.28)'; g.fillRect(playCol * cw, 0, cw, H); }
  // rows: tonic rows tinted
  for (let r = 0; r < rows; r++) { if (r % n === 0) { g.fillStyle = 'rgba(90, 120, 255, 0.07)'; g.fillRect(0, mh - (r + 1) * rh, w, rh); } }
  g.strokeStyle = '#e3e7f0'; g.lineWidth = 1; g.beginPath();
  for (let r = 1; r < rows; r++) { const y = Math.round(mh - r * rh) + 0.5; g.moveTo(0, y); g.lineTo(w, y); }
  for (let c = 1; c < cols; c++) { const x = Math.round(c * cw) + 0.5; g.moveTo(x, 0); g.lineTo(x, H); }
  g.stroke();
  g.strokeStyle = '#b8c0d6'; g.lineWidth = 1; g.beginPath();
  for (let c = 0; c <= cols; c += d.split) { const x = Math.round(c * cw) + 0.5; g.moveTo(x, 0); g.lineTo(x, H); }
  g.stroke();
  g.strokeStyle = '#6c7a99'; g.lineWidth = 2; g.beginPath();
  for (let c = 0; c <= cols; c += d.split * d.beats) { const x = Math.round(c * cw); g.moveTo(x, 0); g.lineTo(x, H); }
  g.stroke();
  // drum lanes
  g.fillStyle = '#eef1f8'; g.fillRect(0, mh, w, G.drumH);
  g.fillStyle = '#9aa5be'; g.fillRect(0, mh, w, 2);
  g.font = '600 10px system-ui, sans-serif'; g.fillStyle = '#8a94ad';
  for (let l = 0; l < 4; l++) g.fillText(LANES[l], 4, G.top + l * laneH + 11);
  // hover
  if (SV.hover) { g.fillStyle = 'rgba(0,0,0,0.06)'; if (SV.hover.drum) g.fillRect(SV.hover.col * cw, G.top + SV.hover.lane * laneH, cw, laneH); else g.fillRect(SV.hover.col * cw, mh - (SV.hover.row + 1) * rh, cw, rh); }
  // notes
  const pad = Math.min(3, cw * 0.12), rad = Math.min(8, Math.min(cw, rh) * 0.3);
  for (const [c, r] of d.mel) {
    if (c >= cols || r >= rows) continue;
    const pc = ((sMidi(d, r) % 12) + 12) % 12, live = c === playCol;
    const k = 'm' + c + ':' + r, pt = SV.pulse[k] ? clamp(1 - (now - SV.pulse[k]) / 250, 0, 1) : 0, grow = (live ? 1.5 : 0) + pt * 3;
    g.fillStyle = 'hsl(' + pcHue(pc) + ', 85%, ' + (live ? 55 : 60) + '%)';
    roundRect(g, c * cw + pad - grow, mh - (r + 1) * rh + pad - grow, cw - pad * 2 + grow * 2, rh - pad * 2 + grow * 2, rad); g.fill();
  }
  const shapes = ['circle', 'tri', 'diamond', 'square'], cols4 = ['#ff5f7e', '#4c6ef5', '#20c997', '#fab005'];
  for (const [c, l] of d.drm) {
    if (c >= cols) continue;
    const live = c === playCol, cx = c * cw + cw / 2, cy = G.top + l * laneH + laneH / 2, sz = Math.min(cw, laneH) * (live ? 0.42 : 0.34);
    g.fillStyle = cols4[l]; g.beginPath();
    if (shapes[l] === 'circle') g.arc(cx, cy, sz, 0, Math.PI * 2);
    else if (shapes[l] === 'tri') { g.moveTo(cx, cy - sz); g.lineTo(cx + sz, cy + sz * 0.8); g.lineTo(cx - sz, cy + sz * 0.8); }
    else if (shapes[l] === 'diamond') { g.moveTo(cx, cy - sz); g.lineTo(cx + sz, cy); g.lineTo(cx, cy + sz); g.lineTo(cx - sz, cy); }
    else g.rect(cx - sz * 0.85, cy - sz * 0.85, sz * 1.7, sz * 1.7);
    g.fill();
  }
  if (!d.mel.length && !d.drm.length) {                 // an empty song: say what to do
    g.textAlign = 'center'; g.fillStyle = 'rgba(91, 91, 247, 0.55)'; g.font = '800 26px system-ui, sans-serif';
    const cx = Math.min(w, SV.wrap.clientWidth) / 2 + SV.wrap.scrollLeft;
    g.fillText('Click the squares to make music', cx, mh / 2 - 6);
    g.font = '600 15px system-ui, sans-serif'; g.fillStyle = 'rgba(80, 90, 120, 0.6)';
    g.fillText('Top part: the tune. Bottom rows: drums. Then press the big Play button.', cx, mh / 2 + 22);
    g.textAlign = 'left';
  }
  for (const k in SV.pulse) if (now - SV.pulse[k] > 300) delete SV.pulse[k];
  SV.dirty = Object.keys(SV.pulse).length > 0;
  if (pos != null && playCol !== SV.lastCol && playCol >= 0) {           // keep the playhead in view on wide songs
    SV.lastCol = playCol;
    const x = playCol * cw, wr = SV.wrap;
    if (x < wr.scrollLeft || x > wr.scrollLeft + wr.clientWidth - cw) wr.scrollLeft = Math.max(0, x - 40);
  }
}
function roundRect(g, x, y, w, hh, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

// a random tune that sounds like one: a few motifs over the scale, ending home, plus a beat that fits the kit
function surprise(d) {
  const rnd = Math.random, n = SCALES[d.scale].s.length, cols = sCols(d), per = d.beats * d.split;
  d.mel = []; d.drm = [];
  const motif = [];
  for (let c = 0; c < per; c++) { const onBeat = c % d.split === 0; if (rnd() < (onBeat ? 0.8 : 0.35)) motif.push(c); }
  if (!motif.length) motif.push(0);
  let deg = Math.floor(n * (d.range > 1 ? 0.8 : 0.4));
  for (let b = 0; b < d.bars; b++) {
    const vary = b % 2 === 1;
    for (const c of motif) {
      if (vary && rnd() < 0.3) continue;
      deg += [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)];
      deg = clamp(deg, 0, sRows(d) - 1);
      d.mel.push([b * per + c, deg]);
      if (rnd() < 0.18 && deg + 2 < sRows(d)) d.mel.push([b * per + c, deg + 2]);      // a harmony note now and then
    }
  }
  d.mel.push([cols - per, Math.min(n, sRows(d) - 1)]);
  d.mel = d.mel.filter((x, i, a) => a.findIndex(y => y[0] === x[0] && y[1] === x[1]) === i);
  for (let b = 0; b < d.bars; b++) for (let bt = 0; bt < d.beats; bt++) {
    const c = b * per + bt * d.split;
    if (bt % 2 === 0) d.drm.push([c, 0]); else d.drm.push([c, 1]);
    if (bt === d.beats - 1 && rnd() < 0.5 && d.split > 1) d.drm.push([c + 1, 0]);
    for (let k = 0; k < d.split; k++) if (d.split === 1 || k % 2 === 0 || rnd() < 0.4) d.drm.push([c + k, 2]);
    if (bt % 2 === 1 && rnd() < 0.4) d.drm.push([c, 3]);
  }
}
function openInStudio() {
  const s = A.p.simple;
  const p = simpleToProject(s, A.p.name + ' (Studio)');
  p.id = uid(); p.mode = 'studio';
  openProjectObj(p); Store.save(A.p);
  toast('Opened "' + p.name + '" in the Studio. Your simple song is still saved too.', 3500);
}
// songs to start from (degrees in the scale; -1 = rest)
const mk = (o, mel, drums) => () => {
  const s = Object.assign(simpleNormalize({}), o); s.mel = []; s.drm = [];
  mel.forEach((r, c) => { if (Array.isArray(r)) r.forEach(x => s.mel.push([c, x])); else if (r >= 0) s.mel.push([c, r]); });
  (drums || []).forEach((str, lane) => { for (let c = 0; c < sCols(s); c++) if (str[c % str.length] === 'x') s.drm.push([c, lane]); });
  return s;
};
const SIMPLE_SONGS = [
  { n: 'Twinkle Twinkle', s: mk({ split: 1, bars: 4, bpm: 100, inst: 'bells', kit: 'acoustic', oct: 4 }, [0, 0, 4, 4, 5, 5, 4, -1, 3, 3, 2, 2, 1, 1, 0, -1], ['x...', '....', 'xxxx', '..x.']) },
  { n: 'Ode to Joy', s: mk({ split: 1, bars: 8, bpm: 120, inst: 'piano', kit: 'acoustic', oct: 4 }, [2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 2, 1, 1, -1, 2, 2, 3, 4, 4, 3, 2, 1, 0, 0, 1, 2, 1, 0, 0, -1], ['x.x.', '.x.x', 'xxxx']) },
  { n: 'Happy Pop', s: mk({ scale: 'pentatonic', split: 2, bars: 8, bpm: 118, inst: 'marimba', kit: 'electronic', oct: 4 },
    [5, -1, 7, -1, 6, 5, -1, 3, 5, -1, -1, -1, 2, -1, 3, -1, 5, -1, 7, -1, 8, 7, -1, 6, 5, -1, -1, -1, -1, -1, -1, -1, 3, -1, 5, -1, 3, 2, -1, 0, 2, -1, -1, -1, 3, -1, 2, -1, 0, -1, 2, -1, 3, 5, -1, 3, 5, -1, -1, -1, -1, -1, -1, -1],
    ['x...x...', '....x...', 'x.x.x.x.', '......x.']) },
  { n: 'Lo-fi Chill', s: mk({ scale: 'minor', key: 9, split: 2, bars: 4, bpm: 80, inst: 'piano', kit: 'lofi', swing: 1, oct: 4 },
    [[0, 2, 4], -1, -1, 7, -1, 6, -1, 4, [5, 7, 9], -1, -1, 8, -1, 7, -1, 5, [3, 5, 7], -1, -1, 6, -1, 4, -1, 3, [4, 6, 8], -1, -1, 7, -1, 6, 4, -1],
    ['x.....x.......x.', '....x.......x...', 'x.x.x.x.x.x.x.x.']) },
  { n: 'Arcade Hero', s: mk({ scale: 'major', split: 2, bars: 4, bpm: 150, inst: 'chip', kit: 'chip', oct: 4, echo: 0 },
    [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 4, -1, 3, 5, 7, 10, 7, 5, 3, 5, 4, 6, 8, 11, 8, 6, 7, -1], ['x...x...', '....x...', 'xxxxxxxx']) },
  { n: 'Trap Bells', s: mk({ scale: 'minor', split: 2, bars: 2, bpm: 140, inst: 'bells', kit: 'trap', oct: 5, range: 1 },
    [4, 2, 0, 2, 4, 3, 2, 1, 4, 2, 0, 2, 5, -1, 4, -1], ['x.....x...x.....', '........x.......', 'xxxxxxxxxxxxxxxx', '........x.......']) },
  { n: 'Bongo Party', s: mk({ scale: 'mixolydian', split: 2, bars: 2, bpm: 112, inst: 'marimba', kit: 'latin', oct: 4 },
    [0, -1, 4, -1, 6, 4, -1, 2, 0, -1, 4, -1, 7, -1, 6, -1], ['x..x..x.', '.x..x..x', 'xxxxxxxx', '..x...x.']) }
];
