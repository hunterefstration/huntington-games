// ===== Piano roll: notes of the selected channel in the current pattern, drawn on one canvas =====
const KW = 58, RULH = 20, VELH = 76;
const CHORDS = { 'Major': [0, 4, 7], 'Minor': [0, 3, 7], 'Scale triad': 'tri', 'Scale 7th': 'sev', '7': [0, 4, 7, 10], 'Maj7': [0, 4, 7, 11], 'Min7': [0, 3, 7, 10], 'Min9': [0, 3, 7, 10, 14], 'Maj9': [0, 4, 7, 11, 14], 'Add9': [0, 4, 7, 14], 'Sus2': [0, 2, 7], 'Sus4': [0, 5, 7], 'Dim': [0, 3, 6], 'Aug': [0, 4, 8], '6': [0, 4, 7, 9], 'Power': [0, 7, 12], 'Octave': [0, 12] };
const SNAPS = [['48', '1 beat'], ['24', '1/2 beat'], ['12', '1/4 beat (step)'], ['6', '1/8 beat'], ['3', '1/16 beat'], ['16', '1/3 beat (triplet)'], ['8', '1/6 beat (triplet)'], ['bar', 'Bar'], ['1', 'None']];
const RL = { ppt: 2, rowH: 14, sx: 0, sy: 0, tool: 'draw', snap: '12', lastLen: 12, sel: new Set(), clip: null, chord: 'Major', inv: 0, lock: false, drag: null, hover: null, init: false };
function snapTicks() { return RL.snap === 'bar' ? E.barTicks(A.p) : +RL.snap; }
function buildRoll(root) {
  const toolBtns = h('div', { class: 'seg tools' }, [['draw', 'Draw', 'Click to add, drag to move, drag the end to resize, right-click to delete'], ['paint', 'Paint', 'Drag to paint a run of notes'], ['select', 'Select', 'Drag a box to select'], ['erase', 'Erase', 'Click or drag over notes to delete them'], ['chord', 'Chord', 'Click to stamp a whole chord']]
    .map(([id, n, t]) => h('button', { 'data-t': id, title: t, onclick: () => { RL.tool = id; syncRollTools(); } }, n)));
  const chSel = h('select', { class: 'sel', title: 'Channel to edit' });
  chSel.addEventListener('change', () => { A.ui.ch = +chSel.value; RL.sel.clear(); RL.init = false; markViews(); });
  chSel.addEventListener('keydown', e => e.stopPropagation());
  const snap = select(SNAPS, RL.snap, v => { RL.snap = v; }, 'small'); snap.title = 'Snap to grid';
  const chord = select(Object.keys(CHORDS), RL.chord, v => { RL.chord = v; RL.tool = 'chord'; syncRollTools(); }, 'small'); chord.title = 'Chord to stamp';
  const inv = select([[0, 'Root'], [1, '1st inv'], [2, '2nd inv']], 0, v => { RL.inv = +v; }, 'small'); inv.title = 'Chord inversion';
  const key = select(NOTE_NAMES.map((n, i) => [i, n]), 0, v => Hist.edit('Key', () => { A.p.key = +v; }), 'small'); key.title = 'Key (rows outside the scale are shaded)';
  const scale = select(Object.keys(SCALES).map(k => [k, SCALES[k].n]), 'minor', v => Hist.edit('Scale', () => { A.p.scale = v; }), 'small');
  const lock = toggleBtn('Scale lock', false, v => { RL.lock = v; }, 'New and moved notes stay in the scale');
  const ghost = toggleBtn('Ghosts', true, v => { A.set.ghosts = v ? 1 : 0; Store.saveSet(); markViews(); }, 'Show other channels\' notes faintly');
  const quant = h('button', { class: 'btn small', title: 'Snap the selected notes (or all) to the grid', onclick: quantize }, 'Quantize');
  const zoom = h('div', { class: 'seg' }, h('button', { title: 'Zoom out', onclick: () => rollZoom(0.8) }, '−'), h('button', { title: 'Zoom in', onclick: () => rollZoom(1.25) }, '+'));
  const tools = h('div', { class: 'ptools' }, chSel, toolBtns, h('span', { class: 'lab' }, 'Snap'), snap, chord, inv, h('span', { class: 'lab' }, 'Scale'), key, scale, lock, ghost, quant, zoom);
  const cv = h('canvas', { class: 'rl-cv' }), ov = h('canvas', { class: 'rl-ov' });
  const box = h('div', { class: 'rl-box' }, cv, ov);
  root.append(tools, box);
  Object.assign(RL, { root, cv, ov, box, toolBtns, chSel, key, scale, ghost, lock, snapSel: snap });
  cv.addEventListener('pointerdown', rollDown);
  cv.addEventListener('pointermove', rollMove);
  cv.addEventListener('pointerup', rollUp); cv.addEventListener('pointercancel', rollUp);
  cv.addEventListener('pointerleave', () => { RL.hover = null; if (!RL.drag) { cv.style.cursor = ''; } });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', rollWheel, { passive: false });
  cv.addEventListener('dblclick', e => { const p = rollPt(e); if (p.area === 'grid') { const n = noteAt(p); if (n && RL.tool === 'draw') { Hist.edit('Delete note', () => delNotes([n])); } } });
  new ResizeObserver(() => { if (A.views.roll) A.views.roll.dirty = true; }).observe(box);
  A.views.roll = { dirty: true, draw: drawRoll, overlay: rollOverlay, key: rollKey, show: () => { syncRollTools(); } };
}
function syncRollTools() {
  $$('button', RL.toolBtns).forEach(b => b.classList.toggle('on', b.dataset.t === RL.tool));
  RL.chSel.innerHTML = '';
  for (const c of A.p.ch) RL.chSel.appendChild(h('option', { value: c.id }, c.n));
  const c = curCh(); if (c) RL.chSel.value = c.id;
  RL.key.value = A.p.key; RL.scale.value = A.p.scale; RL.ghost.set(A.set.ghosts);
}
function rollNotes() { const c = curCh(), q = curPat(); if (!c) return null; return (q.nt[c.id] = q.nt[c.id] || []); }
const tx = t => KW + t * RL.ppt - RL.sx;
const ny = m => RULH + (127 - m) * RL.rowH - RL.sy;
function rollGeom() { const r = RL.box.getBoundingClientRect(); return { W: r.width, H: r.height, gh: r.height - RULH - VELH }; }
function rollCenter() {                       // first look: centre on the notes, or around C4-C5
  const ns = rollNotes() || [], G = rollGeom();
  let mid = 66; if (ns.length) { let lo = 127, hi = 0; for (const n of ns) { lo = Math.min(lo, n[2]); hi = Math.max(hi, n[2]); } mid = (lo + hi) / 2; }
  RL.sy = clamp((127 - mid) * RL.rowH - G.gh / 2, 0, 128 * RL.rowH - G.gh); RL.sx = 0;
  const q = curPat(); RL.ppt = clamp((G.W - KW - 20) / Math.max(q.len * STEP, PPQ * 4), 0.6, 4);
}
function rollZoom(f, atX) {
  const G = rollGeom(), x = atX == null ? (G.W - KW) / 2 : atX - KW, t = (x + RL.sx) / RL.ppt;
  RL.ppt = clamp(RL.ppt * f, 0.25, 12); RL.sx = Math.max(0, t * RL.ppt - x);
  A.views.roll.dirty = true;
}
function drawRoll() {
  if (!RL.init) { RL.init = true; rollCenter(); }
  syncRollTools();
  const { g, w: W, h: H } = fitCanvas(RL.cv), q = curPat(), c = curCh(), gh = H - RULH - VELH;
  RL.sy = clamp(RL.sy, 0, Math.max(0, 128 * RL.rowH - gh));
  const snap = snapTicks(), bar = E.barTicks(A.p), beat = PPQ * 4 / A.p.sig[1], plen = q.len * STEP;
  g.fillStyle = '#1b1f24'; g.fillRect(0, 0, W, H);
  // rows
  g.save(); g.beginPath(); g.rect(KW, RULH, W - KW, gh); g.clip();
  const top = Math.max(0, Math.floor(127 - (RL.sy + gh) / RL.rowH)), bot = Math.min(127, Math.ceil(127 - RL.sy / RL.rowH));
  for (let m = top; m <= bot; m++) {
    const y = ny(m), ins = inScale(m, A.p.key, A.p.scale);
    g.fillStyle = isBlack(m) ? (ins ? '#272d34' : '#20252a') : (ins ? '#323a43' : '#272c32');
    if (((m - A.p.key) % 12 + 12) % 12 === 0 && A.p.scale !== 'chromatic') g.fillStyle = '#38404b';
    g.fillRect(KW, y, W - KW, RL.rowH);
    if (m % 12 === 0) { g.fillStyle = '#495260'; g.fillRect(KW, y + RL.rowH - 1, W - KW, 1); }
  }
  // vertical lines
  const t0 = Math.max(0, Math.floor(RL.sx / RL.ppt)), t1 = (RL.sx + W) / RL.ppt;
  const minor = snap * RL.ppt >= 6 ? snap : STEP * RL.ppt >= 6 ? STEP : beat;
  for (let t = Math.floor(t0 / minor) * minor; t <= t1; t += minor) {
    const x = Math.round(tx(t)) + 0.5;
    g.fillStyle = t % bar === 0 ? '#5d6878' : t % beat === 0 ? '#414a56' : '#2f363e';
    g.fillRect(x - 0.5, RULH, 1, gh);
  }
  if (tx(plen) < W) { g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(Math.max(KW, tx(plen)), RULH, W, gh); g.fillStyle = '#ff9a3c'; g.fillRect(tx(plen), RULH, 1.5, gh); }
  // ghost notes from the other channels
  if (A.set.ghosts) for (const ch of A.p.ch) {
    if (!c || ch.id === c.id) continue;
    const ns = q.nt[ch.id]; if (!ns) continue;
    g.fillStyle = ch.col; g.globalAlpha = 0.18;
    for (const n of ns) { const x = tx(n[0]); if (x > W || x + n[1] * RL.ppt < KW) continue; g.fillRect(x, ny(n[2]) + 1, Math.max(2, n[1] * RL.ppt - 1), RL.rowH - 2); }
    g.globalAlpha = 1;
  }
  // notes
  const ns = rollNotes() || [], col = c ? c.col : '#4dabf7';
  g.font = '600 10px system-ui, sans-serif'; g.textBaseline = 'middle';
  for (const n of ns) {
    const x = tx(n[0]), y = ny(n[2]), w = Math.max(3, n[1] * RL.ppt - 1);
    if (x > W || x + w < KW || y > RULH + gh || y + RL.rowH < RULH) continue;
    const sel = RL.sel.has(n);
    g.fillStyle = col; g.globalAlpha = 0.55 + 0.45 * n[3] / 127;
    roundRect(g, x, y + 1, w, RL.rowH - 2, 3); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = sel ? '#ffffff' : 'rgba(0,0,0,0.55)'; g.lineWidth = sel ? 2 : 1; g.stroke();
    if (w > 26 && RL.rowH >= 11) { g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillText(noteName(n[2]), x + 4, y + RL.rowH / 2 + 0.5); }
  }
  // the box being dragged
  const d = RL.drag;
  if (d && d.mode === 'box') { g.strokeStyle = '#fff'; g.setLineDash([4, 3]); g.lineWidth = 1; g.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); g.setLineDash([]); }
  // chord stamp preview
  if (RL.tool === 'chord' && RL.hover && RL.hover.area === 'grid' && !d) {
    const t = Math.floor(RL.hover.t / snap) * snap;
    g.fillStyle = col; g.globalAlpha = 0.35;
    for (const m of chordNotes(RL.hover.m)) g.fillRect(tx(t), ny(m) + 1, RL.lastLen * RL.ppt - 1, RL.rowH - 2);
    g.globalAlpha = 1;
  }
  g.restore();
  // keyboard
  g.save(); g.beginPath(); g.rect(0, RULH, KW, gh); g.clip();
  for (let m = top; m <= bot; m++) {
    const y = ny(m), b = isBlack(m);
    g.fillStyle = b ? '#1d2126' : (RL.keyDown === m ? '#ffd8a8' : '#e9ecef');
    if (b && RL.keyDown === m) g.fillStyle = '#d9480f';
    g.fillRect(0, y, b ? KW * 0.62 : KW, RL.rowH);
    if (!b) { g.fillStyle = '#adb5bd'; g.fillRect(0, y + RL.rowH - 1, KW, 1); }
    if (m % 12 === 0) { g.fillStyle = '#495057'; g.font = '600 9px system-ui, sans-serif'; g.textBaseline = 'middle'; g.fillText(noteName(m), KW - 24, y + RL.rowH / 2); }
  }
  g.restore();
  // ruler
  g.fillStyle = '#2a3038'; g.fillRect(KW, 0, W - KW, RULH);
  g.fillStyle = '#9aa4b2'; g.font = '600 10px system-ui, sans-serif'; g.textBaseline = 'middle';
  for (let t = Math.floor(t0 / bar) * bar; t <= t1; t += bar) { const x = tx(t); if (x >= KW - 1) { g.fillRect(x, 10, 1, RULH - 10); g.fillText(String(t / bar + 1), x + 3, 8); } }
  g.fillStyle = '#1b1f24'; g.fillRect(0, 0, KW, RULH);
  g.fillStyle = col; g.fillRect(4, 6, 8, 8); g.fillStyle = '#ced4da'; g.fillText(c ? c.n.slice(0, 7) : '', 15, 10);
  // velocity lane
  const vy = RULH + gh;
  g.fillStyle = '#161a1e'; g.fillRect(0, vy, W, VELH);
  g.fillStyle = '#2f363e'; g.fillRect(0, vy, W, 1);
  g.fillStyle = '#6c757d'; g.font = '600 9px system-ui, sans-serif'; g.fillText('VELOCITY', 6, vy + 12);
  g.save(); g.beginPath(); g.rect(KW, vy, W - KW, VELH); g.clip();
  for (const n of ns) {
    const x = tx(n[0]) + 1; if (x < KW - 4 || x > W) continue;
    const hh = (VELH - 12) * n[3] / 127, sel = RL.sel.has(n);
    g.fillStyle = sel ? '#fff' : col; g.fillRect(x, vy + VELH - 4 - hh, 2, hh);
    g.beginPath(); g.arc(x + 1, vy + VELH - 4 - hh, 3.5, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  RL.lastOv = null;
}
function rollOverlay(pos) {
  const q = curPat(), key = pos == null || A.ui.playMode !== 'pat' ? null : Math.round((pos % (q.len * STEP)) * RL.ppt);
  if (key === RL.lastOv) return;
  RL.lastOv = key;
  const { g, w: W, h: H } = fitCanvas(RL.ov);
  g.clearRect(0, 0, W, H);
  if (key == null) return;
  const t = pos % (q.len * STEP), x = tx(t);
  if (A.set.follow && (x > W - 20 || x < KW)) { RL.sx = Math.max(0, t * RL.ppt - 30); A.views.roll.dirty = true; return; }
  if (x < KW) return;
  g.fillStyle = '#ffd43b'; g.fillRect(x, RULH, 1.5, H - RULH);
  g.beginPath(); g.moveTo(x - 5, 0); g.lineTo(x + 6, 0); g.lineTo(x + 0.5, 8); g.fill();
}
function rollPt(e) {
  const r = RL.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, gh = r.height - RULH - VELH;
  const t = (x - KW + RL.sx) / RL.ppt, m = 127 - Math.floor((y - RULH + RL.sy) / RL.rowH);
  const area = y < RULH ? 'ruler' : y > RULH + gh ? 'vel' : x < KW ? 'keys' : 'grid';
  return { x, y, t, m: clamp(m, 0, 127), area };
}
function noteAt(p) {
  const ns = rollNotes() || [];
  for (let i = ns.length - 1; i >= 0; i--) { const n = ns[i]; if (n[2] === p.m && p.t >= n[0] && p.t < n[0] + Math.max(n[1], 3 / RL.ppt)) return n; }
  return null;
}
function nearEdge(n, p) { return Math.abs(tx(n[0] + n[1]) - p.x) <= Math.max(4, Math.min(8, n[1] * RL.ppt / 3)); }
function scaleSnap(m) { if (!RL.lock || inScale(m, A.p.key, A.p.scale)) return m; for (let d = 1; d < 12; d++) { if (inScale(m - d, A.p.key, A.p.scale)) return m - d; if (inScale(m + d, A.p.key, A.p.scale)) return m + d; } return m; }
function chordNotes(root) {
  let iv = CHORDS[RL.chord];
  if (iv === 'tri' || iv === 'sev') {                  // stacked thirds from the scale
    const sc = SCALES[A.p.scale].s, rel = ((root - A.p.key) % 12 + 12) % 12;
    let deg = sc.indexOf(rel); if (deg < 0) { root = scaleSnap(root); deg = Math.max(0, sc.indexOf(((root - A.p.key) % 12 + 12) % 12)); }
    const count = iv === 'sev' ? 4 : 3; iv = [];
    for (let k = 0; k < count; k++) { const dd = deg + k * 2, o = Math.floor(dd / sc.length); iv.push(sc[dd % sc.length] + 12 * o - sc[deg]); }
  }
  let ms = iv.map(i => root + i);
  for (let k = 0; k < RL.inv && k < ms.length - 1; k++) { ms.sort((a, b) => a - b); ms[0] += 12; }
  return ms.filter(m => m >= 0 && m <= 127).sort((a, b) => a - b);
}
function delNotes(list) { const ns = rollNotes(), set = new Set(list); const c = curCh(), q = curPat(); q.nt[c.id] = ns.filter(n => !set.has(n)); for (const n of list) RL.sel.delete(n); }
function extendPattern() {
  const q = curPat(), ns = rollNotes() || []; let end = 0;
  for (const n of ns) end = Math.max(end, n[0] + n[1]);
  if (end > q.len * STEP) { const bar = E.barTicks(A.p); q.len = Math.ceil(end / bar) * bar / STEP; }
}
function audition(m, vel) { const c = curCh(); if (c && m !== RL.lastAud) { RL.lastAud = m; A.eng.hit(c.id, m, (vel || 100) / 127, 0.25); } }
function rollDown(e) {
  A.eng.audio();
  const p = rollPt(e), c = curCh(); if (!c) return toast('Add a channel first');
  RL.cv.setPointerCapture(e.pointerId);
  RL.lastAud = null;
  const snap = snapTicks(), ns = rollNotes();
  if (p.area === 'keys') { RL.keyDown = p.m; A.eng.noteOn(c.id, p.m, 0.85); RL.drag = { mode: 'key', m: p.m }; A.views.roll.dirty = true; return; }
  if (p.area === 'ruler') { if (A.playing && A.ui.playMode === 'pat') A.eng.seek(Math.max(0, Math.floor(p.t / snap) * snap)); return; }
  if (p.area === 'vel') { Hist.begin(); RL.drag = { mode: 'vel' }; velAt(p); return; }
  const hit = noteAt(p), right = e.button === 2;
  Hist.begin();
  if (right || RL.tool === 'erase') { RL.drag = { mode: 'erase' }; if (hit) delNotes([hit]); changed(); return; }
  if (hit && e.shiftKey) { if (RL.sel.has(hit)) RL.sel.delete(hit); else RL.sel.add(hit); A.views.roll.dirty = true; RL.drag = null; Hist.cancel(); return; }
  if (hit && RL.tool !== 'paint') {
    if (!RL.sel.has(hit)) { RL.sel.clear(); RL.sel.add(hit); }
    const group = [...RL.sel].filter(n => ns.includes(n));
    const resize = nearEdge(hit, p);
    RL.drag = { mode: resize ? 'resize' : 'move', hit, group, orig: group.map(n => n.slice()), t0: p.t, m0: p.m };
    audition(hit[2], hit[3]);
    A.views.roll.dirty = true; return;
  }
  if (RL.tool === 'select' || e.ctrlKey) { RL.sel.clear(); RL.drag = { mode: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y }; Hist.cancel(); return; }
  const t = Math.max(0, Math.floor(p.t / snap) * snap);
  if (RL.tool === 'chord') {
    const made = chordNotes(scaleSnap(p.m)).map(m => [t, RL.lastLen, m, 100]);
    ns.push(...made); RL.sel = new Set(made);
    RL.drag = { mode: 'move', hit: made[0], group: made, orig: made.map(n => n.slice()), t0: p.t, m0: p.m };
    made.forEach(n => A.eng.hit(c.id, n[2], 0.75, 0.4));
  } else {
    const n = [t, RL.lastLen, scaleSnap(p.m), 100];
    ns.push(n); RL.sel = new Set([n]);
    RL.drag = RL.tool === 'paint' ? { mode: 'paint', m: n[2], done: new Set([t]) } : { mode: 'move', hit: n, group: [n], orig: [n.slice()], t0: p.t, m0: p.m, fresh: true };
    audition(n[2]);
  }
  changed();
}
function velAt(p) {
  const ns = rollNotes() || [], v = clamp(Math.round((1 - (p.y - (RL.cv.getBoundingClientRect().height - VELH) - 8) / (VELH - 12)) * 127), 1, 127);
  const pool = RL.sel.size ? ns.filter(n => RL.sel.has(n)) : ns;
  let any = false;
  for (const n of pool) if (Math.abs(tx(n[0]) - p.x) < 5) { n[3] = v; any = true; }
  if (any) { changed(); setStatus('Velocity ' + v); }
}
function rollMove(e) {
  const p = rollPt(e), d = RL.drag;
  if (!d) {
    const prev = RL.hover; RL.hover = p;
    let cur = '';
    if (p.area === 'grid') { const n = noteAt(p); cur = n ? (nearEdge(n, p) && RL.tool !== 'erase' ? 'ew-resize' : (RL.tool === 'erase' ? 'not-allowed' : 'move')) : (RL.tool === 'select' ? 'crosshair' : 'cell'); }
    RL.cv.style.cursor = cur;
    if (RL.tool === 'chord' && (!prev || prev.m !== p.m || Math.floor(prev.t / snapTicks()) !== Math.floor(p.t / snapTicks()))) A.views.roll.dirty = true;
    return;
  }
  const snap = snapTicks(), ns = rollNotes();
  if (d.mode === 'key') { if (p.m !== d.m && p.area === 'keys') { const c = curCh(); A.eng.noteOff(c.id, d.m); A.eng.noteOn(c.id, p.m, 0.85); d.m = p.m; RL.keyDown = p.m; A.views.roll.dirty = true; } return; }
  if (d.mode === 'vel') { velAt(p); return; }
  if (d.mode === 'erase') { const n = noteAt(p); if (n) { delNotes([n]); changed(); } return; }
  if (d.mode === 'box') {
    d.x1 = p.x; d.y1 = p.y;
    const ta = (Math.min(d.x0, d.x1) - KW + RL.sx) / RL.ppt, tb = (Math.max(d.x0, d.x1) - KW + RL.sx) / RL.ppt;
    const ma = 127 - Math.floor((Math.max(d.y0, d.y1) - RULH + RL.sy) / RL.rowH), mb = 127 - Math.floor((Math.min(d.y0, d.y1) - RULH + RL.sy) / RL.rowH);
    RL.sel = new Set(ns.filter(n => n[0] + n[1] > ta && n[0] < tb && n[2] >= ma && n[2] <= mb));
    A.views.roll.dirty = true; return;
  }
  if (d.mode === 'paint') {
    const t = Math.max(0, Math.floor(p.t / snap) * snap);
    if (!d.done.has(t)) { d.done.add(t); if (!ns.some(n => n[0] === t && n[2] === d.m)) { ns.push([t, RL.lastLen, d.m, 100]); changed(); } }
    return;
  }
  if (d.mode === 'move') {
    let dt = Math.round((p.t - d.t0) / snap) * snap, dm = p.m - d.m0;
    const minT = Math.min(...d.orig.map(o => o[0])), minM = Math.min(...d.orig.map(o => o[2])), maxM = Math.max(...d.orig.map(o => o[2]));
    dt = Math.max(-minT, dt); dm = clamp(dm, -minM, 127 - maxM);
    d.group.forEach((n, i) => { n[0] = d.orig[i][0] + dt; n[2] = d.group.length === 1 ? scaleSnap(d.orig[i][2] + dm) : d.orig[i][2] + dm; });
    audition(d.hit[2], d.hit[3]);
    changed(); return;
  }
  if (d.mode === 'resize') {
    const dl = Math.round((p.t - d.t0) / snap) * snap;
    d.group.forEach((n, i) => { n[1] = Math.max(snap > 1 ? Math.min(snap, d.orig[i][1]) : 1, d.orig[i][1] + dl); });
    RL.lastLen = d.hit[1];
    changed(); return;
  }
}
function rollUp() {
  const d = RL.drag; RL.drag = null;
  if (!d) return;
  if (d.mode === 'key') { const c = curCh(); if (c) A.eng.noteOff(c.id, d.m); RL.keyDown = null; A.views.roll.dirty = true; return; }
  if (d.mode === 'box') { A.views.roll.dirty = true; return; }
  if (d.mode === 'move' && d.hit && !d.fresh) RL.lastLen = d.hit[1];
  extendPattern();
  Hist.end(d.fresh ? 'Add note' : { move: 'Move notes', resize: 'Resize notes', erase: 'Delete notes', paint: 'Paint notes', vel: 'Velocity' }[d.mode] || 'Add notes');
  A.views.roll.dirty = true;
}
function rollWheel(e) {
  e.preventDefault();
  const r = RL.cv.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey) rollZoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX - r.left);
  else if (e.altKey) { const f = e.deltaY < 0 ? 1.12 : 0.9, my = e.clientY - r.top - RULH, m = (my + RL.sy) / RL.rowH; RL.rowH = clamp(RL.rowH * f, 7, 30); RL.sy = Math.max(0, m * RL.rowH - my); }
  else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) RL.sx = Math.max(0, RL.sx + (e.deltaX || e.deltaY));
  else RL.sy = Math.max(0, RL.sy + e.deltaY);
  A.views.roll.dirty = true;
}
function quantize() {
  const ns = rollNotes(); if (!ns || !ns.length) return;
  const snap = snapTicks(), pool = RL.sel.size ? ns.filter(n => RL.sel.has(n)) : ns;
  Hist.edit('Quantize', () => { for (const n of pool) n[0] = Math.max(0, Math.round(n[0] / snap) * snap); });
  toast('Quantized ' + pool.length + ' notes');
}
function rollKey(e) {
  const k = e.key, ctrl = e.ctrlKey || e.metaKey, ns = rollNotes(); if (!ns) return false;
  const sel = ns.filter(n => RL.sel.has(n)), snap = snapTicks();
  if (k === 'Delete' || k === 'Backspace') { if (!sel.length) return false; Hist.edit('Delete notes', () => delNotes(sel)); return true; }
  if (k === 'Escape') { RL.sel.clear(); A.views.roll.dirty = true; return true; }
  if (ctrl && (k === 'a' || k === 'A')) { RL.sel = new Set(ns); A.views.roll.dirty = true; return true; }
  if (ctrl && (k === 'c' || k === 'C' || k === 'x' || k === 'X')) {
    if (!sel.length) return true;
    const t0 = Math.min(...sel.map(n => n[0])), end = Math.max(...sel.map(n => n[0] + n[1]));
    RL.clip = { notes: sel.map(n => [n[0] - t0, n[1], n[2], n[3]]), span: Math.ceil((end - t0) / E.barTicks(A.p)) * E.barTicks(A.p) || E.barTicks(A.p), from: t0 };
    if (k === 'x' || k === 'X') Hist.edit('Cut notes', () => delNotes(sel)); else toast('Copied ' + sel.length + ' notes', 1000);
    return true;
  }
  if (ctrl && (k === 'v' || k === 'V')) {
    if (!RL.clip) return true;
    const at = sel.length ? Math.ceil(Math.max(...sel.map(n => n[0] + n[1])) / snap) * snap : RL.clip.from;
    let made;
    Hist.edit('Paste notes', () => { made = RL.clip.notes.map(n => [n[0] + at, n[1], n[2], n[3]]); rollNotes().push(...made); RL.sel = new Set(made); extendPattern(); });
    return true;
  }
  if (ctrl && (k === 'd' || k === 'D')) {
    if (!sel.length) return true;
    const t0 = Math.min(...sel.map(n => n[0])), end = Math.max(...sel.map(n => n[0] + n[1])), bar = E.barTicks(A.p), span = Math.ceil((end - t0) / bar) * bar || bar;
    Hist.edit('Duplicate notes', () => { const made = sel.map(n => [n[0] + span, n[1], n[2], n[3]]); rollNotes().push(...made); RL.sel = new Set(made); extendPattern(); });
    return true;
  }
  if (sel.length && (k === 'ArrowUp' || k === 'ArrowDown')) {
    const d = (k === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1);
    if (sel.some(n => n[2] + d < 0 || n[2] + d > 127)) return true;
    Hist.edit('Transpose', () => sel.forEach(n => n[2] += d)); audition(sel[0][2]); return true;
  }
  if (sel.length && (k === 'ArrowLeft' || k === 'ArrowRight')) {
    const d = (k === 'ArrowRight' ? 1 : -1) * snap;
    if (sel.some(n => n[0] + d < 0)) return true;
    Hist.edit('Move notes', () => { sel.forEach(n => n[0] += d); extendPattern(); }); return true;
  }
  return false;
}
on('changed', all => { if (all) RL.sel.clear(); if (A.views.roll) A.views.roll.dirty = true; });
