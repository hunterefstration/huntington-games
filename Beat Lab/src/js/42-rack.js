// ===== Channel rack: one row per instrument channel, a step sequencer for the current pattern =====
const ROWH = 34;
const RK = { rows: [], sig: '', velMode: false, cv: null, ov: null, drag: null, cw: 20 };
function buildRack(root) {
  const lenBtns = h('div', { class: 'seg' }, [16, 32, 64].map(n => h('button', { 'data-n': n, title: n + ' steps', onclick: () => Hist.edit('Pattern length', () => { const q = curPat(); q.len = n; for (const k in q.st) { const a = q.st[k]; while (a.length < n) a.push(0); a.length = Math.max(a.length, n); } }) }, String(n))));
  const vel = toggleBtn('Velocity', false, v => { RK.velMode = v; RK.dirty(); }, 'Show and draw how hard each step plays');
  const add = h('button', { class: 'btn small primary', title: 'Add a channel', onclick: e => addMenu(e.clientX, e.clientY) }, '+ Add channel');
  const tools = h('div', { class: 'ptools' }, h('span', { class: 'lab' }, 'Steps'), lenBtns, vel, add,
    h('span', { class: 'hint' }, 'Click a step to turn it on · right-click/drag to erase · shift-drag up/down: velocity · double-click a name for its instrument'));
  const heads = h('div', { class: 'rk-heads' }), cv = h('canvas', { class: 'rk-cv' }), ov = h('canvas', { class: 'rk-ov' });
  const grid = h('div', { class: 'rk-grid' }, cv, ov);
  const drop = h('div', { class: 'rk-drop' }, 'Drop a sound here to add a channel');
  const body = h('div', { class: 'rk-body' }, h('div', { class: 'rk-inner' }, heads, grid), drop);
  root.append(tools, body);
  Object.assign(RK, { root, heads, grid, cv, ov, body, lenBtns, vel });
  const dropOn = (el, f) => {
    el.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/beatlab-preset')) { e.preventDefault(); el.classList.add('over'); } });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', e => { el.classList.remove('over'); const id = e.dataTransfer.getData('text/beatlab-preset'); if (id) { e.preventDefault(); f(id, e); } });
  };
  dropOn(drop, id => addChannelFromPreset(id));
  dropOn(grid, (id, e) => { const r = cv.getBoundingClientRect(), row = Math.floor((e.clientY - r.top) / ROWH), c = A.p.ch[row]; if (c) loadPresetIntoChannel(id, c.id); else addChannelFromPreset(id); });
  RK.dropOn = dropOn;
  cv.addEventListener('pointerdown', rackDown);
  cv.addEventListener('pointermove', rackMove);
  cv.addEventListener('pointerup', rackUp); cv.addEventListener('pointercancel', rackUp);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  new ResizeObserver(() => RK.dirty()).observe(body);
  RK.dirty = () => { if (A.views.rack) A.views.rack.dirty = true; };
  A.views.rack = { dirty: true, draw: drawRack, overlay: rackOverlay, show: () => syncRackRows(true) };
}
function addMenu(x, y) {
  const quick = [['Kick', '808-kick'], ['Snare', '808-snare'], ['Clap', '808-clap'], ['Hi-hat', '808-closed-hat'], ['Open hat', '808-open-hat'], ['Piano', 'grand-piano'], ['Synth lead', 'saw-lead'], ['Pad', 'warm-pad'], ['808 bass', '808-bass'], ['Pluck', 'synth-pluck'], ['Strings', 'string-ensemble']];
  menu(x, y, quick.map(([n, id]) => ({ t: n, f: () => addChannelFromPreset(id) })).concat([{ sep: 1 }, { t: 'More: pick any sound in the browser on the left', dis: true, f: () => {} }]));
}
function rackSig() { return A.p.ch.map(c => [c.id, c.n, c.col, c.mix, c.p].join('|')).join(';') + '#' + A.p.mix.length; }
// header rows are DOM (knobs); rebuilt only when channels are added/removed/renamed, otherwise values are updated in place
function syncRackRows(force) {
  if (!RK.heads) return;
  const sig = rackSig();
  if (force || sig !== RK.sig) {
    RK.sig = sig; RK.heads.innerHTML = ''; RK.rows = [];
    A.p.ch.forEach((c, i) => {
      const led = h('button', { class: 'led', title: 'Mute (right-click: solo)' });
      led.addEventListener('click', () => Hist.edit('Mute', () => { const ch = chById(c.id); ch.mute = ch.mute ? 0 : 1; }));
      led.addEventListener('contextmenu', e => { e.preventDefault(); Hist.edit('Solo', () => { const ch = chById(c.id), was = ch.solo; A.p.ch.forEach(x => x.solo = 0); ch.solo = was ? 0 : 1; }); });
      const pan = knob({ label: '', min: -1, max: 1, value: c.pan, def: 0, small: true, title: 'Pan', fmt: v => v === 0 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100), undo: 'Pan', onInput: v => { chById(c.id).pan = v; changed(); } });
      const vol = knob({ label: '', min: 0, max: 1, value: c.vol, def: 0.8, small: true, title: 'Volume', fmt: v => Math.round(v * 100) + '%', undo: 'Volume', onInput: v => { chById(c.id).vol = v; changed(); } });
      const mix = h('button', { class: 'mixno', title: 'Mixer track this channel plays through (click to change)', onclick: e => routeMenu(e.clientX, e.clientY, c.id) }, c.mix ? String(c.mix) : 'M');
      const name = h('button', { class: 'cname', style: { '--c': c.col }, title: c.n + ' (' + ((presetById(c.p) || {}).n || 'custom') + ')' }, c.n);
      name.addEventListener('click', () => { A.ui.ch = c.id; markViews(); syncRackRows(); });
      name.addEventListener('dblclick', () => { A.ui.ch = c.id; showTab('synth'); });
      name.addEventListener('contextmenu', e => { e.preventDefault(); A.ui.ch = c.id; syncRackRows(); channelMenu(e.clientX, e.clientY, c.id); });
      const row = h('div', { class: 'rk-row' }, led, pan, vol, mix, name);
      RK.dropOn(row, id => loadPresetIntoChannel(id, c.id));
      RK.heads.appendChild(row);
      RK.rows.push({ id: c.id, row, led, pan, vol, mix });
    });
  }
  for (const r of RK.rows) {
    const c = chById(r.id); if (!c) continue;
    r.led.classList.toggle('off', !!c.mute); r.led.classList.toggle('solo', !!c.solo);
    r.pan.set(c.pan); r.vol.set(c.vol); r.mix.textContent = c.mix ? String(c.mix) : 'M';
    r.row.classList.toggle('sel', c.id === A.ui.ch);
  }
  const q = curPat();
  $$('button', RK.lenBtns).forEach(b => b.classList.toggle('on', +b.dataset.n === q.len));
}
function routeMenu(x, y, chId) {
  menu(x, y, A.p.mix.map((m, i) => ({ t: (i ? i + ': ' : '') + m.n, f: () => Hist.edit('Route channel', () => { chById(chId).mix = i; }) })).concat([{ sep: 1 }, { t: 'New mixer track for it', f: () => Hist.edit('Route channel', () => { const c = chById(chId), i = freeInsert(A.p); c.mix = i; if (i) A.p.mix[i].n = c.n; }) }]));
}
function channelMenu(x, y, chId) {
  const c = chById(chId), i = A.p.ch.indexOf(c);
  const fill = n => Hist.edit('Fill steps', () => { const q = curPat(), a = q.st[c.id] = new Array(q.len).fill(0); for (let s = 0; s < q.len; s += n) a[s] = 100; delete q.nt[c.id]; });
  menu(x, y, [
    { t: 'Piano roll', f: () => { A.ui.ch = c.id; showTab('roll'); } },
    { t: 'Instrument', f: () => { A.ui.ch = c.id; showTab('synth'); } },
    { sep: 1 },
    { t: 'Rename...', f: () => ask('Rename channel', c.n, v => Hist.edit('Rename channel', () => { c.n = v; })) },
    { t: 'Colour...', f: () => colorPick(c.col, col => Hist.edit('Channel colour', () => { c.col = col; })) },
    { t: 'Step note: ' + noteName(c.root) + '...', f: () => stepNoteDialog(c) },
    { t: 'Clone', f: () => Hist.edit('Clone channel', () => { const n = E.clone(c); n.id = A.p.ch.reduce((m, x) => Math.max(m, x.id), 0) + 1; n.n = c.n + ' 2'; A.p.ch.splice(i + 1, 0, n); for (const q of A.p.pat) { if (q.st[c.id]) q.st[n.id] = q.st[c.id].slice(); if (q.nt[c.id]) q.nt[n.id] = E.clone(q.nt[c.id]); } A.ui.ch = n.id; }) },
    { t: 'Move up', dis: i === 0, f: () => Hist.edit('Move channel', () => { A.p.ch.splice(i, 1); A.p.ch.splice(i - 1, 0, c); }) },
    { t: 'Move down', dis: i === A.p.ch.length - 1, f: () => Hist.edit('Move channel', () => { A.p.ch.splice(i, 1); A.p.ch.splice(i + 1, 0, c); }) },
    { sep: 1 },
    { t: 'Fill every 2 steps', f: () => fill(2) }, { t: 'Fill every 4 steps', f: () => fill(4) }, { t: 'Fill every 8 steps', f: () => fill(8) },
    { t: 'Clear steps and notes', f: () => Hist.edit('Clear channel', () => { const q = curPat(); delete q.st[c.id]; delete q.nt[c.id]; }) },
    { sep: 1 },
    { t: 'Delete channel', f: () => confirmBox('Delete "' + c.n + '"?', 'Its steps and notes in every pattern go too.', 'Delete', () => Hist.edit('Delete channel', () => {
      A.p.ch = A.p.ch.filter(x => x !== c); for (const q of A.p.pat) { delete q.st[c.id]; delete q.nt[c.id]; } fixUi();
    })) }
  ]);
}
function stepNoteDialog(c) {
  const opts = []; for (let m = 24; m <= 96; m++) opts.push([m, noteName(m)]);
  const s = select(opts, c.root, () => {});
  modal('Step note for ' + c.n, h('div', null, h('p', null, 'The note the step sequencer plays on this channel.'), s), [{ t: 'Cancel' }, { t: 'OK', primary: true, f: () => Hist.edit('Step note', () => { c.root = +s.value; }) }]);
}
function colorPick(cur, cb) {
  const box = h('div', { class: 'swatches' }, CH_COLS.concat(['#adb5bd', '#ffffff', '#e64980', '#5c7cfa']).map(col => h('button', { class: 'sw' + (col === cur ? ' on' : ''), style: { background: col }, onclick: () => { closeModal(); cb(col); } })));
  modal('Pick a colour', box, [{ t: 'Cancel' }]);
}
function rackGeom() {
  const q = curPat(), avail = RK.body.clientWidth - RK.heads.offsetWidth - 8;
  RK.cw = clamp(Math.floor(avail / q.len), 12, 34);
  return { q, cw: RK.cw, W: RK.cw * q.len + 2, H: Math.max(ROWH, A.p.ch.length * ROWH) };
}
function drawRack() {
  syncRackRows();
  const G = rackGeom(), { q, cw } = G;
  RK.cv.style.width = RK.ov.style.width = G.W + 'px'; RK.cv.style.height = RK.ov.style.height = G.H + 'px';
  const { g } = fitCanvas(RK.cv);
  g.fillStyle = '#20252b'; g.fillRect(0, 0, G.W, G.H);
  const beat = PPQ * 4 / A.p.sig[1] / STEP;          // steps per beat
  A.p.ch.forEach((c, r) => {
    const y = r * ROWH, nt = q.nt[c.id];
    if (nt && nt.length) {                           // this channel uses the piano roll: show a mini roll
      g.fillStyle = '#2b333b'; g.fillRect(1, y + 3, G.W - 2, ROWH - 6);
      let lo = 127, hi = 0; for (const n of nt) { lo = Math.min(lo, n[2]); hi = Math.max(hi, n[2]); }
      const span = Math.max(6, hi - lo + 1), len = q.len * STEP;
      g.fillStyle = c.col;
      for (const n of nt) { if (n[0] >= len) continue; const x = n[0] / len * (G.W - 2) + 1, w = Math.max(2, n[1] / len * (G.W - 2)), yy = y + 5 + (1 - (n[2] - lo + 0.5) / span) * (ROWH - 12); g.fillRect(x, yy - 1.5, w - 1, 3); }
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.font = '10px system-ui, sans-serif'; g.fillText('piano roll →', G.W - 70, y + ROWH - 8);
      return;
    }
    const st = q.st[c.id] || [];
    for (let s = 0; s < q.len; s++) {
      const x = s * cw + 1, grp = Math.floor(s / beat) % 2, v = st[s] || 0;
      g.fillStyle = grp ? '#3a424c' : '#4a3a3e';
      roundRect(g, x + 1, y + 4, cw - 3, ROWH - 8, 3); g.fill();
      if (v > 0) {
        g.fillStyle = c.col;
        if (RK.velMode) { const hh = (ROWH - 10) * v / 127; roundRect(g, x + 2, y + ROWH - 5 - hh, cw - 5, hh, 2); g.fill(); }
        else { g.globalAlpha = 0.45 + 0.55 * v / 127; roundRect(g, x + 2, y + 5, cw - 5, ROWH - 10, 3); g.fill(); g.globalAlpha = 1; }
      }
    }
  });
  RK.lastOv = null;
}
function rackOverlay(pos) {
  const q = curPat(), key = pos == null || A.ui.playMode !== 'pat' ? -1 : Math.floor((pos % (q.len * STEP)) / STEP);
  if (key === RK.lastOv) return;
  RK.lastOv = key;
  const { g } = fitCanvas(RK.ov);
  g.clearRect(0, 0, RK.ov.width, RK.ov.height);
  if (key < 0) return;
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(key * RK.cw + 1, 0, RK.cw, A.p.ch.length * ROWH);
}
function rackCell(e) {
  const r = RK.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const row = Math.floor(y / ROWH), s = Math.floor((x - 1) / RK.cw), c = A.p.ch[row];
  return c ? { c, row, s, y: y - row * ROWH } : null;
}
function rackDown(e) {
  const cell = rackCell(e); if (!cell) return;
  A.eng.audio();
  const q = curPat(), c = cell.c;
  A.ui.ch = c.id; syncRackRows();
  if (q.nt[c.id] && q.nt[c.id].length) { showTab('roll'); return; }
  if (cell.s < 0 || cell.s >= q.len) return;
  RK.cv.setPointerCapture(e.pointerId);
  Hist.begin();
  const st = q.st[c.id] = q.st[c.id] || new Array(q.len).fill(0);
  while (st.length < q.len) st.push(0);
  if (e.shiftKey && st[cell.s] > 0) { RK.drag = { mode: 'vel', c, s: cell.s, y0: e.clientY, v0: st[cell.s] }; return; }
  if (RK.velMode && e.button === 0) { RK.drag = { mode: 'velpaint', c }; velPaint(cell); return; }
  const on = e.button === 2 ? false : !(st[cell.s] > 0);
  RK.drag = { mode: 'paint', c, on, done: new Set() };
  paintStep(cell);
}
function velPaint(cell) {
  const q = curPat(), st = q.st[cell.c.id];
  if (cell.s < 0 || cell.s >= q.len || !(st[cell.s] > 0)) return;
  st[cell.s] = clamp(Math.round((1 - (cell.y - 5) / (ROWH - 10)) * 127), 1, 127);
  changed();
}
function paintStep(cell) {
  const d = RK.drag; if (cell.c !== d.c || cell.s < 0 || cell.s >= curPat().len || d.done.has(cell.s)) return;
  d.done.add(cell.s);
  const st = curPat().st[d.c.id];
  st[cell.s] = d.on ? (st[cell.s] > 0 ? st[cell.s] : 100) : 0;
  if (d.on) A.eng.hit(d.c.id, d.c.root || 60, 0.8, 0.25);
  changed();
}
function rackMove(e) {
  const d = RK.drag; if (!d) return;
  if (d.mode === 'vel') { const st = curPat().st[d.c.id]; st[d.s] = clamp(Math.round(d.v0 + (d.y0 - e.clientY)), 1, 127); changed(); setStatus('Velocity ' + st[d.s]); return; }
  const cell = rackCell(e); if (!cell) return;
  if (d.mode === 'velpaint') { if (cell.c === d.c) velPaint(cell); return; }
  paintStep(cell);
}
function rackUp() { if (RK.drag) { RK.drag = null; Hist.end('Edit steps'); } }
on('changed', () => { if (A.views.rack) A.views.rack.dirty = true; });
