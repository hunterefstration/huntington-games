// ===== Playlist: the arrangement. Pattern clips on tracks, a loop region, song position =====
const TRH = 40, PRUL = 24;
const PL = { pps: 8, sx: 0, tool: 'draw', snap: 'bar', sel: new Set(), drag: null, clip: null };
function plSnap() { const bar = E.barTicks(A.p) / STEP; return PL.snap === 'bar' ? bar : PL.snap === 'beat' ? 4 * 4 / A.p.sig[1] : 1; }
function buildPlaylist(root) {
  const tools = h('div', { class: 'seg tools' }, [['draw', 'Draw', 'Click to place the pattern, drag to move, drag the end to make it longer (it repeats), right-click to delete, shift-drag to copy'], ['select', 'Select', 'Drag a box to select clips']]
    .map(([id, n, t]) => h('button', { 'data-t': id, title: t, onclick: () => { PL.tool = id; syncPlTools(); } }, n)));
  const brush = h('select', { class: 'sel', title: 'Pattern you place with a click' });
  brush.addEventListener('change', () => { A.ui.brush = +brush.value; brush.blur(); });
  brush.addEventListener('keydown', e => e.stopPropagation());
  const snap = select([['bar', 'Bar'], ['beat', 'Beat'], ['step', 'Step']], 'bar', v => { PL.snap = v; }, 'small'); snap.title = 'Snap';
  const loop = toggleBtn('Loop', false, v => Hist.edit('Loop', () => { A.p.loop = v ? (PL.lastLoop || [0, Math.round(E.songTicks(A.p) / STEP)]) : null; }), 'Loop a part of the song (drag in the ruler to set it)');
  const zoom = h('div', { class: 'seg' }, h('button', { title: 'Zoom out', onclick: () => plZoom(0.8) }, '−'), h('button', { title: 'Zoom in', onclick: () => plZoom(1.25) }, '+'));
  const addTr = h('button', { class: 'btn small', title: 'Add a track', onclick: () => Hist.edit('Add track', () => A.p.pl.tr.push({ n: 'Track ' + (A.p.pl.tr.length + 1), mute: 0 })) }, '+ Track');
  const len = h('span', { class: 'hint' });
  root.append(h('div', { class: 'ptools' }, tools, h('span', { class: 'lab' }, 'Place'), brush, h('span', { class: 'lab' }, 'Snap'), snap, loop, zoom, addTr, len));
  const ruler = h('canvas', { class: 'pl-rul' }), corner = h('div', { class: 'pl-corner' }, 'Tracks');
  const heads = h('div', { class: 'pl-heads' }), cv = h('canvas', { class: 'pl-cv' }), ov = h('canvas', { class: 'pl-ov' });
  const body = h('div', { class: 'pl-body' }, h('div', { class: 'pl-inner' }, heads, h('div', { class: 'pl-grid' }, cv, ov)));
  const hs = h('div', { class: 'pl-hscroll' }, h('div', { class: 'pl-spacer' }));
  root.append(h('div', { class: 'pl-top' }, corner, h('div', { class: 'pl-rulwrap' }, ruler)), body, hs);
  Object.assign(PL, { root, tools, brush, loopBtn: loop, ruler, heads, cv, ov, body, hs, len });
  hs.addEventListener('scroll', () => { PL.sx = hs.scrollLeft; A.views.playlist.dirty = true; });
  cv.addEventListener('pointerdown', plDown); cv.addEventListener('pointermove', plMove);
  cv.addEventListener('pointerup', plUp); cv.addEventListener('pointercancel', plUp);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('dblclick', e => { const c = clipAt(plPt(e)); if (c) { selectPattern(c[0]); refreshStudio(); showTab('rack'); } });
  cv.addEventListener('wheel', plWheel, { passive: false }); ruler.addEventListener('wheel', plWheel, { passive: false });
  ruler.addEventListener('pointerdown', rulerDown);
  new ResizeObserver(() => { A.views.playlist.dirty = true; }).observe(body);
  A.views.playlist = { dirty: true, draw: drawPlaylist, overlay: plOverlay, key: plKey, show: syncPlTools };
}
function syncPlTools() {
  $$('button', PL.tools).forEach(b => b.classList.toggle('on', b.dataset.t === PL.tool));
  PL.brush.innerHTML = '';
  for (const q of A.p.pat) PL.brush.appendChild(h('option', { value: q.id }, q.n));
  PL.brush.value = A.ui.brush;
  PL.loopBtn.set(!!A.p.loop);
  const secs = E.songTicks(A.p) * 60 / (A.p.bpm * PPQ);
  PL.len.textContent = 'Song: ' + (E.songTicks(A.p) / E.barTicks(A.p)) + ' bars, ' + fmtTime(secs);
}
function plZoom(f, atX) {
  const w = PL.cv.clientWidth, x = atX == null ? w / 2 : atX, s = (x + PL.sx) / PL.pps;
  PL.pps = clamp(PL.pps * f, 1.5, 40); PL.sx = Math.max(0, s * PL.pps - x); PL.hs.scrollLeft = PL.sx;
  A.views.playlist.dirty = true;
}
const px = s => s * PL.pps - PL.sx;
function syncPlHeads() {
  const sig = A.p.pl.tr.map(t => t.n + (t.mute ? '1' : '0')).join('|');
  if (sig === PL.hsig) return; PL.hsig = sig;
  PL.heads.innerHTML = '';
  A.p.pl.tr.forEach((t, i) => {
    const m = h('button', { class: 'led' + (t.mute ? ' off' : ''), title: 'Mute this track', onclick: () => Hist.edit('Mute track', () => { A.p.pl.tr[i].mute = A.p.pl.tr[i].mute ? 0 : 1; }) });
    const n = h('span', { class: 'tn', title: 'Double-click to rename' }, t.n);
    n.addEventListener('dblclick', () => ask('Rename track', t.n, v => Hist.edit('Rename track', () => { A.p.pl.tr[i].n = v; })));
    PL.heads.appendChild(h('div', { class: 'pl-head' }, m, n));
  });
}
function patSummary(q) {                          // tiny note preview for clip drawing
  const out = [];
  const len = q.len * STEP;
  for (const ch of A.p.ch) {
    const st = q.st[ch.id]; if (st) for (let i = 0; i < q.len; i++) if (st[i] > 0) out.push([i * STEP, STEP, -1]);
    const nt = q.nt[ch.id]; if (nt) for (const n of nt) if (n[0] < len) out.push([n[0], n[1], n[2]]);
  }
  return out;
}
function drawPlaylist() {
  syncPlHeads(); syncPlTools();
  const rows = A.p.pl.tr.length, W = PL.body.clientWidth - PL.heads.offsetWidth - 2, H = rows * TRH;
  PL.cv.style.width = PL.ov.style.width = W + 'px'; PL.cv.style.height = PL.ov.style.height = H + 'px';
  const songSteps = E.songTicks(A.p) / STEP, total = Math.max(songSteps + 16 * 8, (PL.sx + W) / PL.pps + 16);
  $('.pl-spacer', PL.hs).style.width = (total * PL.pps) + 'px';
  PL.hs.style.marginLeft = PL.heads.offsetWidth + 'px';
  const { g } = fitCanvas(PL.cv);
  g.fillStyle = '#1d2227'; g.fillRect(0, 0, W, H);
  const bar = E.barTicks(A.p) / STEP, beat = 4 * 4 / A.p.sig[1];
  for (let r = 0; r < rows; r++) { g.fillStyle = r % 2 ? '#22282e' : '#1f252a'; g.fillRect(0, r * TRH, W, TRH); if (A.p.pl.tr[r].mute) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, r * TRH, W, TRH); } }
  const s0 = PL.sx / PL.pps, s1 = (PL.sx + W) / PL.pps;
  for (let s = Math.floor(s0 / beat) * beat; s <= s1; s += beat) { const x = Math.round(px(s)) + 0.5; g.fillStyle = s % bar === 0 ? '#3b4450' : '#283038'; if (PL.pps * beat >= 8 || s % bar === 0) g.fillRect(x - 0.5, 0, 1, H); }
  if (A.p.loop) { g.fillStyle = 'rgba(255, 212, 59, 0.06)'; g.fillRect(px(A.p.loop[0]), 0, (A.p.loop[1] - A.p.loop[0]) * PL.pps, H); }
  const byId = new Map(A.p.pat.map(q => [q.id, q])), sums = new Map();
  g.font = '600 11px system-ui, sans-serif'; g.textBaseline = 'top';
  for (const c of A.p.pl.cl) {
    const q = byId.get(c[0]); if (!q) continue;
    const x = px(c[2]), w = c[3] * PL.pps, y = c[1] * TRH;
    if (x > W || x + w < 0) continue;
    const col = q.col || '#5c7cfa', sel = PL.sel.has(c);
    g.fillStyle = col; g.globalAlpha = 0.28; g.fillRect(x + 1, y + 2, w - 2, TRH - 4); g.globalAlpha = 1;
    g.fillStyle = col; g.fillRect(x + 1, y + 2, w - 2, 14);
    // repeats of the pattern inside the clip
    const plen = q.len;
    let sm = sums.get(q.id); if (!sm) { sm = patSummary(q); sums.set(q.id, sm); }
    let lo = 127, hi = 0; for (const n of sm) if (n[2] >= 0) { lo = Math.min(lo, n[2]); hi = Math.max(hi, n[2]); }
    const span = Math.max(8, hi - lo + 1);
    g.save(); g.beginPath(); g.rect(x + 1, y + 2, w - 2, TRH - 4); g.clip();
    for (let off = 0; off < c[3]; off += plen) {
      if (off) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + off * PL.pps, y + 16, 1, TRH - 18); }
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (const n of sm) {
        const t = off + n[0] / STEP; if (t >= c[3]) continue;
        const yy = n[2] < 0 ? y + TRH - 6 : y + 18 + (1 - (n[2] - lo) / span) * (TRH - 26);
        g.fillRect(x + t * PL.pps, yy, Math.max(1, n[1] / STEP * PL.pps - 0.5), 2);
      }
    }
    g.fillStyle = '#111'; g.fillText(q.n, x + 4, y + 3);
    g.restore();
    g.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,0.5)'; g.lineWidth = sel ? 2 : 1; g.strokeRect(x + 1, y + 2, w - 2, TRH - 4);
  }
  const d = PL.drag;
  if (d && d.mode === 'box') { g.strokeStyle = '#fff'; g.setLineDash([4, 3]); g.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0)); g.setLineDash([]); }
  // ruler
  const R = fitCanvas(PL.ruler), rg = R.g;
  rg.fillStyle = '#2a3038'; rg.fillRect(0, 0, R.w, R.h);
  if (A.p.loop) { rg.fillStyle = '#e8b923'; rg.globalAlpha = 0.6; rg.fillRect(px(A.p.loop[0]), 0, (A.p.loop[1] - A.p.loop[0]) * PL.pps, 7); rg.globalAlpha = 1; }
  rg.fillStyle = '#aab3c0'; rg.font = '600 10px system-ui, sans-serif'; rg.textBaseline = 'middle';
  const every = PL.pps * bar < 30 ? 4 : PL.pps * bar < 60 ? 2 : 1;
  for (let s = Math.floor(s0 / bar) * bar; s <= s1; s += bar) { const x = px(s), b = s / bar; if (b % every) continue; rg.fillRect(x, 12, 1, R.h - 12); rg.fillText(String(b + 1), x + 3, 16); }
  const st = A.ui.startTick / STEP; rg.fillStyle = '#69db7c'; rg.beginPath(); rg.moveTo(px(st) - 5, 8); rg.lineTo(px(st) + 5, 8); rg.lineTo(px(st), 15); rg.fill();
  PL.lastOv = null;
}
function plOverlay(pos) {
  const key = pos == null || A.ui.playMode !== 'song' ? null : Math.round(pos / STEP * PL.pps);
  if (key === PL.lastOv) return;
  PL.lastOv = key;
  const { g, w, h: H } = fitCanvas(PL.ov);
  g.clearRect(0, 0, w, H);
  if (key == null) return;
  const x = px(pos / STEP);
  if (A.set.follow && (x > w - 10 || x < 0)) { PL.sx = Math.max(0, pos / STEP * PL.pps - 20); PL.hs.scrollLeft = PL.sx; A.views.playlist.dirty = true; return; }
  g.fillStyle = '#ffd43b'; g.fillRect(x, 0, 1.5, H);
}
function plPt(e) { const r = PL.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; return { x, y, s: (x + PL.sx) / PL.pps, tr: Math.floor(y / TRH) }; }
function clipAt(p) { const cl = A.p.pl.cl; for (let i = cl.length - 1; i >= 0; i--) { const c = cl[i]; if (c[1] === p.tr && p.s >= c[2] && p.s < c[2] + c[3]) return c; } return null; }
function plDown(e) {
  const p = plPt(e); if (p.tr < 0 || p.tr >= A.p.pl.tr.length) return;
  PL.cv.setPointerCapture(e.pointerId);
  const hit = clipAt(p), sn = plSnap();
  Hist.begin();
  if (e.button === 2) { PL.drag = { mode: 'erase' }; if (hit) { A.p.pl.cl = A.p.pl.cl.filter(c => c !== hit); PL.sel.delete(hit); changed(); } return; }
  if (hit) {
    if (e.shiftKey && !PL.sel.has(hit)) {               // shift-drag: copy
      const cp = hit.slice(); A.p.pl.cl.push(cp); PL.sel = new Set([cp]);
      PL.drag = { mode: 'move', group: [cp], orig: [cp.slice()], s0: p.s, tr0: p.tr }; changed(); return;
    }
    if (!PL.sel.has(hit)) PL.sel = new Set([hit]);
    const group = [...PL.sel].filter(c => A.p.pl.cl.includes(c));
    const edge = Math.abs(px(hit[2] + hit[3]) - p.x) < 7;
    PL.drag = { mode: edge ? 'resize' : 'move', hit, group, orig: group.map(c => c.slice()), s0: p.s, tr0: p.tr };
    A.ui.brush = hit[0];
    A.views.playlist.dirty = true; return;
  }
  if (PL.tool === 'select' || e.ctrlKey) { PL.sel.clear(); PL.drag = { mode: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y }; Hist.cancel(); return; }
  const q = patById(A.ui.brush); if (!q) { Hist.cancel(); return; }
  const c = [q.id, p.tr, Math.max(0, Math.floor(p.s / sn) * sn), q.len];
  A.p.pl.cl.push(c); PL.sel = new Set([c]);
  PL.drag = { mode: 'move', group: [c], orig: [c.slice()], s0: p.s, tr0: p.tr };
  changed();
}
function plMove(e) {
  const d = PL.drag; if (!d) { const p = plPt(e), c = clipAt(p); PL.cv.style.cursor = c ? (Math.abs(px(c[2] + c[3]) - p.x) < 7 ? 'ew-resize' : 'move') : (PL.tool === 'select' ? 'crosshair' : 'copy'); return; }
  const p = plPt(e), sn = plSnap();
  if (d.mode === 'erase') { const c = clipAt(p); if (c) { A.p.pl.cl = A.p.pl.cl.filter(x => x !== c); changed(); } return; }
  if (d.mode === 'box') {
    d.x1 = p.x; d.y1 = p.y;
    const sa = (Math.min(d.x0, d.x1) + PL.sx) / PL.pps, sb = (Math.max(d.x0, d.x1) + PL.sx) / PL.pps, ta = Math.floor(Math.min(d.y0, d.y1) / TRH), tb = Math.floor(Math.max(d.y0, d.y1) / TRH);
    PL.sel = new Set(A.p.pl.cl.filter(c => c[1] >= ta && c[1] <= tb && c[2] + c[3] > sa && c[2] < sb));
    A.views.playlist.dirty = true; return;
  }
  if (d.mode === 'move') {
    let ds = Math.round((p.s - d.s0) / sn) * sn, dt = p.tr - d.tr0;
    ds = Math.max(-Math.min(...d.orig.map(o => o[2])), ds);
    dt = clamp(dt, -Math.min(...d.orig.map(o => o[1])), A.p.pl.tr.length - 1 - Math.max(...d.orig.map(o => o[1])));
    d.group.forEach((c, i) => { c[2] = d.orig[i][2] + ds; c[1] = d.orig[i][1] + dt; });
    changed(); return;
  }
  if (d.mode === 'resize') {
    const dl = Math.round((p.s - d.s0) / sn) * sn;
    d.group.forEach((c, i) => { c[3] = Math.max(sn, d.orig[i][3] + dl); });
    changed();
  }
}
function plUp() { const d = PL.drag; PL.drag = null; if (!d) return; if (d.mode === 'box') { A.views.playlist.dirty = true; return; } Hist.end({ move: 'Move clips', resize: 'Resize clip', erase: 'Delete clips' }[d.mode] || 'Edit playlist'); }
function plWheel(e) {
  e.preventDefault();
  const r = PL.cv.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey) plZoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX - r.left);
  else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.currentTarget === PL.ruler) { PL.sx = Math.max(0, PL.sx + (e.deltaX || e.deltaY)); PL.hs.scrollLeft = PL.sx; A.views.playlist.dirty = true; }
  else PL.body.scrollTop += e.deltaY;
}
function rulerDown(e) {
  const r = PL.ruler.getBoundingClientRect(), s0 = (e.clientX - r.left + PL.sx) / PL.pps, sn = plSnap();
  PL.ruler.setPointerCapture(e.pointerId);
  let moved = false;
  const a = Math.max(0, Math.round(s0 / sn) * sn);
  const mv = ev => {
    const s1 = (ev.clientX - r.left + PL.sx) / PL.pps;
    if (!moved && Math.abs(s1 - s0) * PL.pps < 5) return;
    if (!moved) { moved = true; Hist.begin(); }
    const b = Math.max(0, Math.round(s1 / sn) * sn);
    A.p.loop = b > a ? [a, b] : b < a ? [b, a] : null; PL.lastLoop = A.p.loop || PL.lastLoop;
    changed();
  };
  const up = () => {
    PL.ruler.removeEventListener('pointermove', mv); PL.ruler.removeEventListener('pointerup', up);
    if (moved) { Hist.end('Loop region'); return; }
    A.ui.startTick = a * STEP;
    if (A.playing && A.ui.playMode === 'song') A.eng.seek(A.ui.startTick);
    if (A.ui.playMode !== 'song') setPlayMode('song');
    A.views.playlist.dirty = true;
  };
  PL.ruler.addEventListener('pointermove', mv); PL.ruler.addEventListener('pointerup', up);
}
function plKey(e) {
  const k = e.key, ctrl = e.ctrlKey || e.metaKey, sel = A.p.pl.cl.filter(c => PL.sel.has(c));
  if (k === 'Delete' || k === 'Backspace') { if (!sel.length) return false; Hist.edit('Delete clips', () => { A.p.pl.cl = A.p.pl.cl.filter(c => !PL.sel.has(c)); PL.sel.clear(); }); return true; }
  if (k === 'Escape') { PL.sel.clear(); A.views.playlist.dirty = true; return true; }
  if (ctrl && (k === 'a' || k === 'A')) { PL.sel = new Set(A.p.pl.cl); A.views.playlist.dirty = true; return true; }
  if (ctrl && (k === 'c' || k === 'C')) { if (sel.length) { const s0 = Math.min(...sel.map(c => c[2])); PL.clip = { cl: sel.map(c => [c[0], c[1], c[2] - s0, c[3]]), span: Math.max(...sel.map(c => c[2] + c[3])) - s0 }; toast('Copied ' + sel.length + ' clips', 1000); } return true; }
  if (ctrl && (k === 'v' || k === 'V') || ctrl && (k === 'd' || k === 'D')) {
    const src = (k === 'd' || k === 'D') ? (sel.length ? { cl: sel.map(c => [c[0], c[1], c[2] - Math.min(...sel.map(x => x[2])), c[3]]), span: Math.max(...sel.map(c => c[2] + c[3])) - Math.min(...sel.map(c => c[2])) } : null) : PL.clip;
    if (!src) return true;
    const at = sel.length ? Math.max(...sel.map(c => c[2] + c[3])) : Math.round(A.ui.startTick / STEP);
    Hist.edit('Paste clips', () => { const made = src.cl.map(c => [c[0], c[1], c[2] + at, c[3]]); A.p.pl.cl.push(...made); PL.sel = new Set(made); });
    return true;
  }
  return false;
}
on('changed', all => { if (all) PL.sel.clear(); if (A.views.playlist) A.views.playlist.dirty = true; });
