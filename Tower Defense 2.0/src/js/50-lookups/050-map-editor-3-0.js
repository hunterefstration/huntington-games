// =====================================================================
//  MAP EDITOR (3.0)
//  Paint a map on the 24 x 15 tile grid: roads (lists of corner tiles that
//  always end at the base), the base, terrain, scenery, the theme, starting
//  money and base health. The editor works on plain map data (blankMapData);
//  the board is drawn with the game's own painter (paintBoard), so what you
//  see is what you get. It only redraws when something changes or the mouse
//  moves to another tile. Unsaved work is kept as a draft in td2_editor;
//  saved maps are share codes in td2_custom.
// =====================================================================
const ROAD_COLORS = ['#ffd54f', '#4fc3f7', '#ff8a80', '#b388ff', '#69f0ae', '#ffab40'];
const ED_TOOLS = [['road', '&#9473;', 'Road'], ['base', '&#9873;', 'Base'], ['terrain', '&#8776;', 'Terrain'], ['scenery', '&#9650;', 'Scenery'], ['erase', '&#10006;', 'Eraser']];
const edCanvas = $('ed-canvas'), edCtx = edCanvas.getContext('2d');
const edView = { scale: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
let ED = null, edBg = null, edBgOk = false, edBoard = null, edBoardDirty = true, edDrawQueued = false, edDraftT = 0, edSayT = 0;
let mapsArm = null, mapsArmT = 0;            // maps list: a button waiting for its second tap ('new', 'del:<id>', 'edit:<id>')
function edNew(d, id, clean, cur) {
  if (!d.roads.length) d.roads.push([]);
  ED = { d, id: id || null, dirty: !clean, cur: clamp(cur | 0, 0, d.roads.length - 1), tool: 'road', terrT: 1, decoK: Math.max(0, CM_DECO.indexOf((THEMES[d.theme] || THEMES.grass).deco[0])), brush: 1,
    gm: menuPrefs.gm, undo: [], redo: [], hover: -1, stroke: null, drag: null, clearArm: false, msg: '', msgCls: '' };
  edBoardDirty = true;
}
const edRoad = () => ED.d.roads[ED.cur];
const edDecoCount = () => { let n = 0; for (let i = 0; i < ED.d.deco.length; i++) if (ED.d.deco[i]) n++; return n; };
function edSnapData() { const d = ED.d; return { theme: d.theme, scenery: d.scenery, money: d.money, lives: d.lives, base: d.base, roads: d.roads.map(r => r.slice()), terr: d.terr.slice(), deco: d.deco.slice(), cur: ED.cur }; }
function edPush(snap) { ED.undo.push(snap || edSnapData()); if (ED.undo.length > 60) ED.undo.shift(); ED.redo.length = 0; }
function edRestore(sn) { ED.d = { name: ED.d.name, theme: sn.theme, scenery: sn.scenery, money: sn.money, lives: sn.lives, base: sn.base, roads: sn.roads, terr: sn.terr, deco: sn.deco }; ED.cur = clamp(sn.cur, 0, sn.roads.length - 1); }
function edUndo() { if (!ED.undo.length) { edSay('Nothing to undo'); return; } ED.redo.push(edSnapData()); edRestore(ED.undo.pop()); edChanged(); edSay('Undone'); }
function edRedo() { if (!ED.redo.length) { edSay('Nothing to redo'); return; } ED.undo.push(edSnapData()); edRestore(ED.redo.pop()); edChanged(); edSay('Redone'); }
// after every change: rebuild the board, keep the draft, refresh the panel
function edChanged() { ED.dirty = true; ED.clearArm = false; edBoardDirty = true; edQueueDraft(); edRenderSide(); edRenderTop(); edRequest(); }
function edSay(msg, cls) { ED.msg = msg || ''; ED.msgCls = cls || ''; clearTimeout(edSayT); if (msg) edSayT = setTimeout(() => { if (ED) { ED.msg = ''; edRenderTop(); } }, cls === 'bad' ? 6000 : 3500); edRenderTop(); }
// ---- draft (unsaved work survives a reload or a crash) ----
function edSaveDraft() { clearTimeout(edDraftT); if (ED) store.set(KEYS.editor, { code: encodeMap(ED.d), id: ED.id, dirty: ED.dirty, cur: ED.cur }); }
function edQueueDraft() { clearTimeout(edDraftT); edDraftT = setTimeout(edSaveDraft, 400); }
function edReadDraft() {
  const o = store.get(KEYS.editor, null);
  if (!isPlainObj(o) || typeof o.code !== 'string') return null;
  try { return { d: decodeMap(o.code, true), id: typeof o.id === 'string' && /^[a-z0-9]{1,16}$/.test(o.id) ? o.id : null, dirty: o.dirty === true, cur: Math.floor(numOr(o.cur, 0, 0, CM_LIMITS.roads)) }; }
  catch (e) { warnTD('editor draft could not be read: ' + e.message); return null; }
}
// ---- screen ----
function openEditor(d, id) {
  if (d) { edNew(d, id, true); edSaveDraft(); }
  else if (!ED) { const dr = edReadDraft(); if (dr) edNew(dr.d, dr.id, !dr.dirty, dr.cur); else edNew(blankMapData(), null, false); }
  $('menu-screen').classList.add('hidden'); $('game-screen').classList.add('hidden'); $('editor-screen').classList.remove('hidden');
  ED.hover = -1; ED.stroke = null; ED.drag = null;
  edRenderTop(); edRenderSide(); edResize();
}
function edLeave() { if (ED) { ED.stroke = null; ED.drag = null; edSaveDraft(); } mapsMsg(''); showMenu('maps'); }
function edResize() {
  const r = $('ed-stage').getBoundingClientRect();
  edView.cw = Math.max(50, r.width); edView.ch = Math.max(50, r.height);
  edView.dpr = Math.min(2, window.devicePixelRatio || 1);
  edCanvas.width = Math.round(edView.cw * edView.dpr); edCanvas.height = Math.round(edView.ch * edView.dpr);
  const room = edView.ch - 40;           // leave a strip at the bottom for the hint
  edView.scale = Math.max(0.1, Math.min((edView.cw - 12) / W, (room - 8) / H));
  edView.ox = (edView.cw - W * edView.scale) / 2; edView.oy = 6 + Math.max(0, (room - 8 - H * edView.scale) / 2);
  edBgOk = false; edRequest();
}
const edVisible = () => !!ED && !$('editor-screen').classList.contains('hidden');
// the board as the game will build it (hand-placed scenery only: random scenery changes every game)
function edGetBoard() {
  if (!edBoardDirty && edBoard) return edBoard;
  const d = ED.d, m = compileMap(d, null, true), B = { opts: { variant: 'normal' }, seed: 20261014 };
  if (m.paths.length) { setupMap(B, Object.assign({}, m, { scenery: 0 })); if (d.base < 0) B.base = null; }
  else {
    const rng = mulberry32(B.seed); rng(); rng();
    B.map = m; B.theme = THEMES[m.theme]; B.paths = []; B.bridges = []; B.water = terrainList(m, (x) => x, (y) => y);
    B.base = d.base >= 0 ? { x: tileXY(d.base)[0], y: tileXY(d.base)[1] } : null;
    B.obstacles = m.deco.map(o => ({ x: o.x * W, y: o.y * H, r: 15, kind: o.k, s: o.s, fixed: true }));
    B.blotches = []; for (let i = 0; i < 70; i++) B.blotches.push({ x: rng() * W, y: rng() * H, r: 18 + rng() * 60, a: 0.05 + rng() * 0.08 });
  }
  B.shown = new Set(B.obstacles.map(o => Math.round(o.x) + ',' + Math.round(o.y)));
  edBoard = B; edBoardDirty = false; edBgOk = false;
  return B;
}
function edRequest() { if (edDrawQueued) return; edDrawQueued = true; requestAnimationFrame(() => { edDrawQueued = false; if (edVisible()) guarded(edDraw); }); }
function edDraw() {
  const B = edGetBoard(), k = edView.dpr * edView.scale, d = ED.d;
  if (!edBgOk || !edBg) {
    if (!edBg) edBg = document.createElement('canvas');
    edBg.width = Math.max(1, Math.round(W * k)); edBg.height = Math.max(1, Math.round(H * k));
    const b = edBg.getContext('2d'); b.setTransform(k, 0, 0, k, 0, 0); paintBoard(b, B); edBgOk = true;
  }
  const c = edCtx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b0e12'; c.fillRect(0, 0, edCanvas.width, edCanvas.height);
  c.drawImage(edBg, Math.round(edView.ox * edView.dpr), Math.round(edView.oy * edView.dpr));
  c.setTransform(k, 0, 0, k, Math.round(edView.ox * edView.dpr), Math.round(edView.oy * edView.dpr));
  // the tile grid
  c.strokeStyle = 'rgba(255,255,255,0.1)'; c.lineWidth = 1 / edView.scale; c.beginPath();
  for (let i = 1; i < GW; i++) { c.moveTo(i * GRID, 0); c.lineTo(i * GRID, H); }
  for (let j = 1; j < GH; j++) { c.moveTo(0, j * GRID); c.lineTo(W, j * GRID); }
  c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.4)'; c.strokeRect(0, 0, W, H);
  // scenery that sits on a road or the base is left out of the game: show it crossed out
  for (let i = 0; i < GW * GH; i++) if (d.deco[i]) {
    const [x, y] = tileXY(i); if (B.shown.has(x + ',' + y)) continue;
    c.globalAlpha = 0.45; drawDeco(c, { x, y, r: 15, kind: CM_DECO[d.deco[i] - 1], s: 0.3 }); c.globalAlpha = 1;
    c.strokeStyle = '#ff5252'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - 9, y - 9); c.lineTo(x + 9, y + 9); c.moveTo(x + 9, y - 9); c.lineTo(x - 9, y + 9); c.stroke();
  }
  // roads: the drawn line, the corners, the entrance number and arrows
  c.lineJoin = 'round'; c.lineCap = 'round';
  d.roads.forEach((r, i) => {
    if (!r.length) return;
    const cur = i === ED.cur && ED.tool === 'road', col = ROAD_COLORS[i % ROAD_COLORS.length];
    c.globalAlpha = cur ? 1 : 0.55; c.strokeStyle = col; c.lineWidth = cur ? 3 : 2;
    c.beginPath(); r.forEach((cell, j) => { const [x, y] = tileXY(cell); if (j) c.lineTo(x, y); else c.moveTo(x, y); }); c.stroke();
    if (d.base >= 0 && r[r.length - 1] !== d.base) { const [x0, y0] = tileXY(r[r.length - 1]), [x1, y1] = tileXY(d.base); c.setLineDash([6, 6]); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.setLineDash([]); }
    c.fillStyle = col;
    for (let j = 1; j < r.length; j++) {
      const [ax, ay] = tileXY(r[j - 1]), [bx, by] = tileXY(r[j]), a = Math.atan2(by - ay, bx - ax), mx = (ax + bx) / 2, my = (ay + by) / 2;
      c.save(); c.translate(mx, my); c.rotate(a); c.beginPath(); c.moveTo(6, 0); c.lineTo(-4, -5); c.lineTo(-4, 5); c.closePath(); c.fill(); c.restore();
    }
    for (let j = 1; j < r.length; j++) { const [x, y] = tileXY(r[j]); c.beginPath(); c.arc(x, y, cur ? 6 : 4, 0, 6.283); c.fill(); if (cur) { c.strokeStyle = '#1b1b1b'; c.lineWidth = 1.5; c.stroke(); c.strokeStyle = col; c.lineWidth = 3; } }
    const [ex, ey] = tileXY(r[0]);
    c.beginPath(); c.arc(ex, ey, 11, 0, 6.283); c.fill(); c.strokeStyle = '#1b1b1b'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#1b1b1b'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), ex, ey + 0.5);
    c.globalAlpha = 1;
  });
  if (d.base >= 0) { const [bx, by] = tileXY(d.base); c.strokeStyle = '#ffd54f'; c.lineWidth = 2; c.setLineDash([4, 3]); c.strokeRect(bx - GRID / 2 + 2, by - GRID / 2 + 2, GRID - 4, GRID - 4); c.setLineDash([]); }
  // what the mouse would do
  const hv = ED.hover;
  if (hv >= 0 && !ED.drag) {
    const [hx, hy] = tileXY(hv), t = ED.tool;
    if (t === 'road') {
      const r = edRoad(), col = ROAD_COLORS[ED.cur % ROAD_COLORS.length];
      if (r.length && hv !== r[r.length - 1]) { const [lx, ly] = tileXY(r[r.length - 1]); c.globalAlpha = 0.7; c.strokeStyle = col; c.lineWidth = 3; c.setLineDash([5, 5]); c.beginPath(); c.moveTo(lx, ly); c.lineTo(hx, hy); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; }
      c.strokeStyle = col; c.lineWidth = 2.5; c.strokeRect(hx - GRID / 2 + 1, hy - GRID / 2 + 1, GRID - 2, GRID - 2);
    } else if (t === 'base') { c.strokeStyle = '#ffd54f'; c.lineWidth = 3; c.strokeRect(hx - GRID / 2 + 1, hy - GRID / 2 + 1, GRID - 2, GRID - 2); }
    else if (t === 'scenery') { c.globalAlpha = 0.65; drawDeco(c, { x: hx, y: hy, r: 15, kind: CM_DECO[ED.decoK], s: 0.3 }); c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.strokeRect(hx - GRID / 2 + 1, hy - GRID / 2 + 1, GRID - 2, GRID - 2); }
    else {
      const T = TERRAIN[CM_TERRAIN[ED.terrT]];
      for (const cell of edBrushCells(hv, ED.brush)) { const [x, y] = tileXY(cell); if (t === 'terrain') { c.globalAlpha = 0.5; c.fillStyle = T.fill; c.fillRect(x - GRID / 2, y - GRID / 2, GRID, GRID); c.globalAlpha = 1; } c.strokeStyle = t === 'erase' ? '#ff5252' : '#ffffff'; c.lineWidth = 2; c.strokeRect(x - GRID / 2 + 1, y - GRID / 2 + 1, GRID - 2, GRID - 2); }
    }
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  // the hint line under the board
  const r = edRoad(), tipEl = $('ed-tip').firstChild;
  const tip = ED.tool === 'road' ? 'Road ' + (ED.cur + 1) + ': ' + (r.length ? 'click the next corner \u00b7 drag a corner to move it \u00b7 right-click removes the last one' : 'click the tile where its enemies come in (an edge tile = from off the map)')
    : ED.tool === 'base' ? 'Click a tile to put your base there' : ED.tool === 'terrain' ? 'Drag to paint ' + TERRAIN[CM_TERRAIN[ED.terrT]].name.toLowerCase() + ' \u00b7 start on the same terrain or right-click to erase'
    : ED.tool === 'scenery' ? 'Click to place: ' + CM_DECO_NAMES[CM_DECO[ED.decoK]] + ' \u00b7 click it again or right-click to remove' : 'Drag to erase terrain and scenery';
  if (tipEl.textContent !== tip) tipEl.textContent = tip;
}
function edBrushCells(cell, size) {
  const col = cell % GW, row = (cell / GW) | 0, out = [], lo = size === 3 ? -1 : 0, hi = size === 1 ? 0 : 1;
  for (let r = row + lo; r <= row + hi; r++) for (let c = col + lo; c <= col + hi; c++) if (c >= 0 && r >= 0 && c < GW && r < GH) out.push(r * GW + c);
  return out;
}
function edCellAt(ev) {
  const b = edCanvas.getBoundingClientRect(), x = (ev.clientX - b.left - edView.ox) / edView.scale, y = (ev.clientY - b.top - edView.oy) / edView.scale;
  if (!(x >= 0 && y >= 0 && x < W && y < H)) return -1;
  return ((y / GRID) | 0) * GW + ((x / GRID) | 0);
}
// ---- painting terrain and scenery (one undo step per stroke) ----
function edStrokeStart(cell, right) {
  const d = ED.d, t = ED.tool;
  let mode;
  if (t === 'erase') mode = 'erase';
  else if (t === 'terrain') mode = right ? 'clearT' : d.terr[cell] === ED.terrT ? 'unpaint' : 'paint';
  else if (t === 'scenery') mode = right || d.deco[cell] === ED.decoK + 1 ? 'unplace' : 'place';
  else return;
  ED.stroke = { mode, changed: false, snap: edSnapData() };
  edApply(cell); edRequest();
}
function edApply(cell) {
  const d = ED.d, st = ED.stroke, m = st.mode;
  if (m === 'place') {
    if (d.deco[cell] === ED.decoK + 1) return;
    if (!d.deco[cell] && edDecoCount() >= CM_LIMITS.deco) { edSay('That is all the scenery a map can hold (' + CM_LIMITS.deco + ').', 'bad'); return; }
    d.deco[cell] = ED.decoK + 1; st.changed = true;
  } else if (m === 'unplace') { if (d.deco[cell]) { d.deco[cell] = 0; st.changed = true; } }
  else for (const c of edBrushCells(cell, ED.brush)) {
    if (m === 'paint') { if (d.terr[c] !== ED.terrT) { d.terr[c] = ED.terrT; st.changed = true; } }
    else if (m === 'unpaint') { if (d.terr[c] === ED.terrT) { d.terr[c] = 0; st.changed = true; } }
    else if (m === 'clearT') { if (d.terr[c]) { d.terr[c] = 0; st.changed = true; } }
    else if (d.terr[c] || d.deco[c]) { d.terr[c] = 0; d.deco[c] = 0; st.changed = true; }
  }
  if (st.changed) edBoardDirty = true;
}
// a fast drag skips tiles: fill in every tile on the line between two mouse positions
function edStrokeTo(from, to) {
  if (from < 0) { edApply(to); return; }
  const c0 = from % GW, r0 = (from / GW) | 0, c1 = to % GW, r1 = (to / GW) | 0, n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
  for (let i = 1; i <= n; i++) edApply(Math.round(r0 + (r1 - r0) * i / n) * GW + Math.round(c0 + (c1 - c0) * i / n));
}
function edStrokeEnd() { const st = ED.stroke; ED.stroke = null; if (st && st.changed) { edPush(st.snap); edChanged(); } }
// ---- roads and the base ----
function edRoadDown(cell) {
  const r = edRoad(), at = r.lastIndexOf(cell);
  if (r.length && at >= 0) { ED.drag = { i: at, moved: false, snap: edSnapData(), cell }; return; }       // on a corner: drag it (or a plain click adds it again)
  edRoadAdd(cell);
}
function edRoadAdd(cell) {
  const d = ED.d, r = edRoad(), n = ED.cur + 1;
  if (!r.length) {
    if (cell === d.base) { edSay('Start road ' + n + ' where the enemies come in, not on your base.', 'bad'); return; }
    for (let k = 0; k < d.roads.length; k++) {          // starting on a corner of another road: branch off it (share its way up to there)
      if (k === ED.cur) continue;
      const j = d.roads[k].indexOf(cell);
      if (j >= 0) { edPush(); d.roads[ED.cur] = d.roads[k].slice(0, j + 1); edChanged(); edSay('Road ' + n + ' branches off road ' + (k + 1) + ' here. Now click its own corners.', 'good'); return; }
    }
    edPush(); r.push(cell); edChanged();
    edSay(edgeEntry(cell, 1, 0) ? 'Entrance set: enemies come in from off the map here. Now click each corner on the way to your base.' : 'Entrance set inside the map: enemies come out of a warp gate here. Now click each corner.', 'good');
    return;
  }
  if (cell === d.base) { edSay('Road ' + n + ' already ends at your base.', 'good'); return; }
  if (cell === r[r.length - 1]) return;
  if (r.length >= CM_LIMITS.corners) { edSay('A road can have at most ' + CM_LIMITS.corners + ' corners.', 'bad'); return; }
  edPush(); r.push(cell); edChanged();
}
function edDragTo(cell) {
  const dr = ED.drag, r = edRoad();
  if (cell === ED.d.base || r[dr.i] === cell) return;
  if (!dr.moved) { dr.moved = true; edPush(dr.snap); }
  r[dr.i] = cell; edBoardDirty = true; edRequest();
}
function edDragEnd() {
  const dr = ED.drag, r = edRoad(); ED.drag = null;
  if (dr.moved) { for (let i = r.length - 1; i > 0; i--) if (r[i] === r[i - 1]) r.splice(i, 1); edChanged(); }
  else if (dr.i !== r.length - 1) edRoadAdd(dr.cell);
}
function edRoadUndo() { const r = edRoad(); if (!r.length) { edSay('Road ' + (ED.cur + 1) + ' is empty.'); return; } edPush(); r.pop(); edChanged(); }
function edNewRoad() {
  const d = ED.d;
  if (d.roads.length >= CM_LIMITS.roads) { edSay('A map can have up to ' + CM_LIMITS.roads + ' roads.', 'bad'); return; }
  if (!edRoad().length) { edSay('Road ' + (ED.cur + 1) + ' is still empty: click where its enemies come in.', 'bad'); return; }
  edPush(); d.roads.push([]); ED.cur = d.roads.length - 1; edChanged();
  edSay('Road ' + (ED.cur + 1) + ': click where its enemies come in, or on a corner of another road to branch off it.', 'good');
}
function edDelRoad() {
  const d = ED.d; edPush();
  if (d.roads.length === 1) d.roads[0] = []; else { d.roads.splice(ED.cur, 1); ED.cur = Math.min(ED.cur, d.roads.length - 1); }
  edChanged(); edSay('Road deleted');
}
function edSetBase(cell) {
  const d = ED.d; if (cell === d.base) return;
  edPush(); d.base = cell;
  for (const r of d.roads) for (let i = r.length - 1; i >= 1; i--) if (r[i] === cell) r.splice(i, 1);     // a corner on the base would just be the end of the road
  edChanged(); edSay('Base placed. Every road now ends here.', 'good');
}
function edSetTool(t) { if (!ED || ED.tool === t) return; ED.tool = t; ED.stroke = null; ED.drag = null; edRenderSide(); edRequest(); }
// ---- save, share, test ----
function edSave() {
  const pr = mapProblems(ED.d);
  if (pr.length) { edSay('Not ready to save: ' + pr[0], 'bad'); return false; }
  const code = encodeMap(ED.d), list = getCustomMaps();
  let e = ED.id ? list.find(x => x.id === ED.id) : null;
  if (e) { if (e.code !== code) { e.code = code; e.best = 0; e.won = false; } e.ts = Date.now(); list.splice(list.indexOf(e), 1); list.unshift(e); }
  else {
    if (list.length >= CM_LIMITS.maps) { edSay('You already have ' + CM_LIMITS.maps + ' maps. Delete one in My maps first.', 'bad'); return false; }
    e = { id: newMapId(), code, ts: Date.now(), best: 0, won: false }; list.unshift(e);
  }
  if (!setCustomMaps(list)) { edSay('Could not save: the browser storage is full or blocked.', 'bad'); return false; }
  ED.id = e.id; ED.dirty = false; edSaveDraft();
  edSay(unlockMenu('cartographer') ? 'Saved! Achievement unlocked: Cartographer' : 'Saved "' + ED.d.name + '" to your maps.', 'good');
  return true;
}
function edShare() {
  const pr = mapProblems(ED.d);
  if (pr.length) { edSay('Finish the map before sharing it: ' + pr[0], 'bad'); return; }
  openShare(encodeMap(ED.d), ED.d.name);
}
function edTest(sandbox) {
  const pr = mapProblems(ED.d);
  if (pr.length) { edSay('Not ready to test: ' + pr[0], 'bad'); return; }
  edSaveDraft(); activeSlot = 0; ED.stroke = null; ED.drag = null;
  try { startGame({ gm: ED.gm, diff: 'normal', mode: sandbox ? 'sandbox' : 'test', variant: 'normal', map: 0, custom: encodeMap(ED.d), test: true }); }
  catch (err) { console.error('[TD] test run failed', err); toMenu(); openEditor(); edSay('The test run could not start.', 'bad'); }
}
function openShare(code, name) {
  $('share-title').textContent = 'Share "' + name + '"';
  $('share-note').textContent = 'Send this code to a friend. They open the Map Editor, paste it under "Load a map from a share code" and press Load code. (' + code.length + ' characters)';
  $('share-code').value = code; $('share-msg').textContent = ''; $('share-msg').className = 'maps-msg';
  openModal('share');
  setTimeout(() => { try { $('share-code').focus(); $('share-code').select(); } catch (e) {} }, 30);
}
function copyText(txt, ta, msgEl) {
  const done = (ok) => { msgEl.className = 'maps-msg ' + (ok ? 'good' : 'bad'); msgEl.textContent = ok ? 'Copied! Paste it anywhere to share your map.' : 'Copying is blocked here: the code is selected, press Ctrl+C to copy it.'; };
  const legacy = () => { try { ta.focus(); ta.select(); return document.execCommand('copy'); } catch (e) { return false; } };
  try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(() => done(true), () => done(legacy())); return; } } catch (e) {}
  done(legacy());
}
$('share-copy').onclick = () => copyText($('share-code').value, $('share-code'), $('share-msg'));
// achievements earned outside a game (the Map Editor)
function unlockMenu(id) { const got = store.get(KEYS.ach, {}); if (!isPlainObj(got) || got[id]) return false; got[id] = Date.now(); store.set(KEYS.ach, got); return true; }
// ---- panels ----
function edSummary() {
  const m = compileMap(ED.d, null, true), d = ED.d, roads = d.roads.filter(r => r.length);
  const starts = new Set(roads.map(r => r[0])).size, lens = roads.map(r => roadLen(d, r) / GRID);
  return roads.length + (roads.length === 1 ? ' road' : ' roads') + (starts > 1 ? ', ' + starts + ' entrances' : '') + ', ' + Math.round(Math.min.apply(null, lens)) + (lens.length > 1 ? '-' + Math.round(Math.max.apply(null, lens)) : '') + ' tiles long. Looks ' + MAP_RANK[m.rank] + '.';
}
function edRenderTop() {
  if (!ED) return;
  const nm = $('ed-name'); if (document.activeElement !== nm && nm.value !== ED.d.name) nm.value = ED.d.name;
  $('ed-undo').disabled = !ED.undo.length; $('ed-redo').disabled = !ED.redo.length;
  const st = $('ed-status');
  st.textContent = ED.msg || (ED.dirty ? (ED.id ? 'Unsaved changes' : 'New map, not saved yet') : 'Saved');
  st.className = ED.msg ? ED.msgCls : ED.dirty ? '' : 'good';
  st.title = st.textContent;
  $('ed-save').classList.toggle('on', ED.dirty);
}
function edBrushRow() { return '<div class="ed-row"><label>Brush</label><div class="seg">' + [1, 2, 3].map(n => '<button data-brush="' + n + '"' + (ED.brush === n ? ' class="on"' : '') + '>' + n + 'x' + n + '</button>').join('') + '</div></div>'; }
function edRenderSide() {
  if (!ED) return;
  const d = ED.d, t = ED.tool;
  let h = '<div class="ed-h">Tools</div><div class="ed-tools">' + ED_TOOLS.map(([id, ic, nm], i) => '<button class="btn ed-tool' + (t === id ? ' on' : '') + '" data-tool="' + id + '" title="' + nm + ' (key ' + (i + 1) + ')"><b>' + ic + '</b>' + nm + '</button>').join('') + '</div>';
  if (t === 'road') {
    h += '<div class="ed-h">Roads</div><div class="ed-chips">' + d.roads.map((r, i) => '<button class="btn ed-chip' + (i === ED.cur ? ' on' : '') + '" data-road="' + i + '"><i style="background:' + ROAD_COLORS[i % ROAD_COLORS.length] + '"></i>Road ' + (i + 1) + ' <span style="color:var(--dim);font-weight:600">' + (r.length ? r.length + (r.length === 1 ? ' tile' : ' tiles') : 'empty') + '</span></button>').join('') + '</div>';
    h += '<div class="ed-btns"><button class="btn" data-act="newroad"' + (d.roads.length >= CM_LIMITS.roads ? ' disabled' : '') + ' title="Start another road (N)">&#10010; New road</button><button class="btn" data-act="popcorner" title="Remove the last corner (Backspace)">&#8630; Last corner</button><button class="btn btn-red" data-act="delroad">Delete road</button></div>';
    h += '<p class="ed-hint"><b>Click</b> the tile where enemies come in (a tile on the edge brings them in from off the map), then <b>click each corner</b> on the way. Every road ends at your base by itself, and straight or diagonal lines both work. <b>Drag</b> a corner to move it; <b>right-click</b> removes the last one. Start a new road on a corner of another road to <b>branch</b> off it. Roads can cross. Up to ' + CM_LIMITS.roads + ' roads.</p>';
  } else if (t === 'base') {
    h += '<p class="ed-hint"><b>Click a tile</b> to put your base (the command bunker) there. Every road ends at it, and each enemy that reaches it takes health off it.</p>';
  } else if (t === 'terrain') {
    const tt = CM_TERRAIN[ED.terrT];
    h += '<div class="ed-h">Terrain</div><div class="ed-pal">' + CM_TERRAIN.slice(1).map((k, i) => '<button class="btn' + (ED.terrT === i + 1 ? ' on' : '') + '" data-terr="' + (i + 1) + '"><span class="ed-sw" style="background:' + (k === 'water' && THEMES[d.theme].water ? THEMES[d.theme].water : TERRAIN[k].fill) + '"></span>' + TERRAIN[k].name + '</button>').join('') + '</div>';
    h += '<p class="ed-hint"><b>' + TERRAIN[tt].name + ':</b> ' + CM_TERRAIN_INFO[tt] + '</p>' + edBrushRow() + '<p class="ed-hint"><b>Drag</b> to paint. Start on the same terrain (or right-click) to erase it. Roads can run across any terrain.</p>';
  } else if (t === 'scenery') {
    const th = THEMES[d.theme] || THEMES.grass, idx = CM_DECO.map((k, i) => i), own2 = (i) => th.deco.indexOf(CM_DECO[i]) >= 0 ? 0 : 1;
    idx.sort((a, b) => own2(a) - own2(b) || a - b);
    h += '<div class="ed-h">Scenery <span style="letter-spacing:0;font-weight:600">' + edDecoCount() + ' / ' + CM_LIMITS.deco + ' placed</span></div><div class="ed-deco">' + idx.map(i => '<button class="btn' + (ED.decoK === i ? ' on' : '') + '" data-deco="' + i + '" title="' + CM_DECO_NAMES[CM_DECO[i]] + '"><canvas width="60" height="60" data-icon="' + i + '"></canvas>' + CM_DECO_NAMES[CM_DECO[i]] + '</button>').join('') + '</div>';
    h += '<p class="ed-hint"><b>Click</b> or drag to place, click it again (or right-click) to remove. Scenery blocks building, so you decide where towers can go. The first ones belong to the theme. Scenery on a road is left out (crossed out in red).</p>';
  } else {
    h += '<div class="ed-h">Eraser</div>' + edBrushRow() + '<p class="ed-hint"><b>Drag</b> to clear terrain and scenery. Roads are changed with the Road tool (Last corner, Delete road).</p>';
  }
  h += '<div class="ed-h">Map settings</div>';
  h += '<div class="ed-row"><label for="ed-theme">Theme</label><select id="ed-theme">' + CM_THEMES.map(k => '<option value="' + k + '"' + (k === d.theme ? ' selected' : '') + '>' + THEMES[k].name + '</option>').join('') + '</select></div>';
  h += '<div class="ed-row"><label for="ed-money">Starting money</label><input type="number" class="ed-input" id="ed-money" min="25" max="' + CM_LIMITS.money + '" step="25" placeholder="Default" value="' + (d.money || '') + '"></div>';
  h += '<div class="ed-row"><label for="ed-lives">Base health</label><input type="number" class="ed-input" id="ed-lives" min="1" max="' + CM_LIMITS.lives + '" step="10" placeholder="Default" value="' + (d.lives || '') + '"></div>';
  h += '<p class="ed-hint" style="margin-top:0">Empty = the difficulty\'s usual amount ($75 and 100 health on Regular). Troop Mode adds its usual $700.</p>';
  h += '<div class="ed-row"><label>Random scenery</label><div class="seg" id="ed-scen">' + CM_SCENERY.map((n, i) => '<button data-v="' + i + '"' + (d.scenery === i ? ' class="on"' : '') + '>' + n + '</button>').join('') + '</div></div>';
  h += '<p class="ed-hint" style="margin-top:0">Extra theme scenery scattered around your own, different every game.</p>';
  const pr = mapProblems(d);
  h += '<div class="ed-h">Check</div>' + (pr.length ? '<div class="ed-check no"><b>Not playable yet:</b><ul>' + pr.map(x => '<li>' + escHTML(x) + '</li>').join('') + '</ul></div>' : '<div class="ed-check ok"><b>&#10004; Ready to play.</b> ' + escHTML(edSummary()) + '</div>');
  h += '<div class="ed-h">Test play</div><div class="ed-row"><div class="seg" id="ed-gm">' + PICKABLE_MODES.map(k => '<button data-v="' + k + '"' + (ED.gm === k ? ' class="on"' : '') + '>' + GAME_MODES[k].name + '</button>').join('') + '</div></div>';
  h += '<div class="ed-btns"><button class="btn btn-green" data-act="test"' + (pr.length ? ' disabled' : '') + ' title="Play it with the map\'s own money">&#9654; Test play</button><button class="btn btn-gold" data-act="testsb"' + (pr.length ? ' disabled' : '') + ' title="Sandbox: unlimited money">&#9654; Unlimited $</button></div>';
  h += '<p class="ed-hint">Test runs are on Regular, have no finish line and are never saved. Pause and press Back to Editor to return.</p>';
  h += '<div class="ed-btns" style="margin-top:12px"><button class="btn btn-red" data-act="clear">' + (ED.clearArm ? 'Tap again: clear everything' : 'Clear map') + '</button></div>';
  const side = $('ed-side'), top = side.scrollTop; side.innerHTML = h; side.scrollTop = top;
  side.querySelectorAll('canvas[data-icon]').forEach(cv => { const x = cv.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0); drawDeco(x, { x: 15, y: 16, r: 11, kind: CM_DECO[+cv.dataset.icon], s: 0.3 }); });
}
$('ed-side').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b || b.disabled || !ED) return;
  const ds = b.dataset, pid = b.parentElement && b.parentElement.id;
  if (ds.tool) edSetTool(ds.tool);
  else if (ds.road != null) { ED.cur = +ds.road; edRenderSide(); edRequest(); }
  else if (ds.terr) { ED.terrT = +ds.terr; edRenderSide(); edRequest(); }
  else if (ds.deco != null) { ED.decoK = +ds.deco; edRenderSide(); }
  else if (ds.brush) { ED.brush = +ds.brush; edRenderSide(); }
  else if (pid === 'ed-scen') { const v = +ds.v; if (v !== ED.d.scenery) { edPush(); ED.d.scenery = v; edChanged(); } }
  else if (pid === 'ed-gm') { ED.gm = ds.v; edRenderSide(); }
  else if (ds.act === 'newroad') edNewRoad();
  else if (ds.act === 'popcorner') edRoadUndo();
  else if (ds.act === 'delroad') edDelRoad();
  else if (ds.act === 'test') edTest(false);
  else if (ds.act === 'testsb') edTest(true);
  else if (ds.act === 'clear') {
    if (!ED.clearArm) { ED.clearArm = true; edRenderSide(); setTimeout(() => { if (ED && ED.clearArm) { ED.clearArm = false; edRenderSide(); } }, 4000); return; }
    edPush(); const n = blankMapData(); n.name = ED.d.name; n.theme = ED.d.theme; ED.d = n; ED.cur = 0; edChanged(); edSay('Map cleared. Undo brings it back.');
  }
});
$('ed-side').addEventListener('change', (ev) => {
  if (!ED) return; const el = ev.target, d = ED.d;
  if (el.id === 'ed-theme') { if (own(THEMES, el.value) && el.value !== d.theme) { edPush(); d.theme = el.value; ED.decoK = Math.max(0, CM_DECO.indexOf(THEMES[d.theme].deco[0])); edChanged(); } }
  else if (el.id === 'ed-money' || el.id === 'ed-lives') {
    const money = el.id === 'ed-money', raw = el.value.trim(), lim = money ? CM_LIMITS.money : CM_LIMITS.lives;
    let v = raw === '' ? 0 : Math.round(+raw);
    if (!isFinite(v) || v < 0) v = 0;
    if (v) v = money ? clamp(Math.round(v / 25) * 25, 25, lim) : clamp(v, 1, lim);
    if (v !== (money ? d.money : d.lives)) { edPush(); if (money) d.money = v; else d.lives = v; edChanged(); edSay((money ? 'Starting money: ' : 'Base health: ') + (v ? (money ? money$(v) : v) : 'the difficulty\'s usual amount'), 'good'); }
    else el.value = v || '';
  }
});
$('ed-name').addEventListener('input', () => {
  if (!ED) return; const el = $('ed-name'), v = el.value.replace(/[^ A-Za-z0-9-]/g, '');
  if (v !== el.value) el.value = v;
  ED.d.name = cleanMapName(v) || 'My Map'; ED.dirty = true; edQueueDraft(); edRenderTop();
});
$('ed-name').addEventListener('blur', () => { if (ED) $('ed-name').value = ED.d.name; });
$('ed-back').onclick = edLeave;
$('ed-undo').onclick = () => ED && edUndo();
$('ed-redo').onclick = () => ED && edRedo();
$('ed-save').onclick = () => ED && edSave();
$('ed-share').onclick = () => ED && edShare();
$('ed-test').onclick = () => ED && edTest(false);
// ---- mouse ----
edCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
edCanvas.addEventListener('pointerdown', (ev) => {
  if (!ED) return;
  const cell = edCellAt(ev); if (cell < 0) return;
  try { edCanvas.setPointerCapture(ev.pointerId); } catch (e) {}
  ED.hover = cell;
  if (ev.button === 2) { if (ED.tool === 'road') edRoadUndo(); else if (ED.tool !== 'base') edStrokeStart(cell, true); return; }
  if (ev.button !== 0) return;
  if (ED.tool === 'road') edRoadDown(cell);
  else if (ED.tool === 'base') edSetBase(cell);
  else edStrokeStart(cell, false);
  edRequest();
});
edCanvas.addEventListener('pointermove', (ev) => {
  if (!ED) return;
  const cell = edCellAt(ev); if (cell === ED.hover) return;
  const prev = ED.hover; ED.hover = cell;
  if (cell >= 0 && ED.stroke) edStrokeTo(prev, cell);
  if (cell >= 0 && ED.drag) edDragTo(cell);
  edRequest();
});
edCanvas.addEventListener('pointerup', () => { if (!ED) return; if (ED.stroke) edStrokeEnd(); if (ED.drag) edDragEnd(); edRequest(); });
edCanvas.addEventListener('pointercancel', () => { if (!ED) return; if (ED.stroke) edStrokeEnd(); if (ED.drag) edDragEnd(); });
edCanvas.addEventListener('pointerleave', () => { if (ED && !ED.stroke && !ED.drag) { ED.hover = -1; edRequest(); } });
document.addEventListener('keydown', (ev) => {
  if (!edVisible()) return;
  const k = ev.key.toLowerCase(), mod = ev.ctrlKey || ev.metaKey, typing = ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
  if (mod && k === 's') { ev.preventDefault(); if (document.querySelector('.modal:not(.hidden)')) return; if (typing) ev.target.blur(); edSave(); return; }   // blur first: a typed money / health value is applied on change
  if (typing || document.querySelector('.modal:not(.hidden)')) return;
  if (mod && k === 'z') { ev.preventDefault(); if (ev.shiftKey) edRedo(); else edUndo(); }
  else if (mod && k === 'y') { ev.preventDefault(); edRedo(); }
  else if (!mod && /^[1-5]$/.test(k)) edSetTool(ED_TOOLS[+k - 1][0]);
  else if ((k === 'backspace' || k === 'delete') && ED.tool === 'road') { ev.preventDefault(); edRoadUndo(); }
  else if (k === 'n' && !mod && ED.tool === 'road') edNewRoad();
});
window.addEventListener('resize', () => { if (edVisible()) edResize(); });
if (window.ResizeObserver) new ResizeObserver(() => { if (edVisible()) edResize(); }).observe($('ed-stage'));
// ---- the My maps screen ----
function armMaps(v) { mapsArm = v; clearTimeout(mapsArmT); if (v) mapsArmT = setTimeout(() => { mapsArm = null; if (!$('menu-maps').classList.contains('hidden')) renderMapsList(); }, 4000); }
function renderMapsList() {
  const list = getCustomMaps(), box = $('maps-list'); box.innerHTML = '';
  $('maps-count').textContent = '(' + list.length + ' / ' + CM_LIMITS.maps + ')';
  const dr = ED ? { d: ED.d, dirty: ED.dirty } : edReadDraft(), db = $('btn-maps-draft');
  db.classList.toggle('hidden', !dr);
  if (dr) db.innerHTML = '&#9998; Continue editing: ' + escHTML(dr.d.name) + (dr.dirty ? ' <small style="font-weight:600;font-size:12px">(not saved)</small>' : '');
  $('btn-maps-new').innerHTML = mapsArm === 'new' ? 'Tap again: discard the unsaved map' : '&#10010; New map';
  if (!list.length) { const p = document.createElement('p'); p.className = 'subtitle'; p.style.cssText = 'font-style:normal;grid-column:1/-1;margin:0'; p.textContent = 'No maps yet. Press New map to draw your first one, or load a code a friend sent you.'; box.appendChild(p); }
  for (const e of list) {
    const m = e.m, card = document.createElement('div'); card.className = 'map-card cmap'; card.dataset.cmap = e.id;
    const c = document.createElement('canvas'); c.width = 192; c.height = 120; drawMapPreview(c, m, 'normal'); card.appendChild(c);
    const n = document.createElement('div'); n.className = 'mname'; n.style.fontWeight = '800'; n.textContent = m.name; card.appendChild(n);
    const tg = document.createElement('div'); tg.className = 'mtags'; tg.innerHTML = mapTags(m).map(([cls, txt]) => '<span class="' + cls + '">' + txt + '</span>').join(''); card.appendChild(tg);
    const nt = document.createElement('div'); nt.className = 'mbest'; nt.textContent = m.note.replace(/^Custom map( \u00b7 )?/, '') || 'Default money and base health'; card.appendChild(nt);
    const bw = document.createElement('div'); bw.className = 'mbest'; bw.textContent = (e.won ? 'Won! ' : '') + (e.best ? 'Best: wave ' + e.best + ' cleared' : e.won ? '' : 'Not played yet'); card.appendChild(bw);
    const bt = document.createElement('div'); bt.className = 'cmap-btns'; card.appendChild(bt);
    const mk = (txt, cls, act, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.dataset.act = act; b.innerHTML = txt; b.onclick = fn; bt.appendChild(b); };
    const armedEdit = mapsArm === 'edit:' + e.id, armedDel = mapsArm === 'del:' + e.id;
    mk('&#9654; Play', 'btn-green', 'play', () => playCustom(e.id));
    mk(armedEdit ? 'Tap again' : '&#9998; Edit', 'btn-teal', 'edit', () => {
      const dr = ED ? { dirty: ED.dirty, id: ED.id } : edReadDraft();
      if (dr && dr.dirty && dr.id !== e.id && !armedEdit) { armMaps('edit:' + e.id); renderMapsList(); mapsMsg('Your unsaved map will be replaced. Tap Edit again to go on.', 'bad'); return; }
      armMaps(null); try { openEditor(decodeMap(e.code, true), e.id); } catch (err) { mapsMsg(err.message, 'bad'); }
    });
    mk('Share', 'btn-purple', 'share', () => openShare(e.code, m.name));
    mk(armedDel ? 'Tap again: delete' : 'Delete', 'btn-red', 'delete', () => {
      if (!armedDel) { armMaps('del:' + e.id); renderMapsList(); return; }
      armMaps(null); const l2 = getCustomMaps().filter(x => x.id !== e.id);
      if (!setCustomMaps(l2)) { mapsMsg('Could not delete: the browser storage is blocked.', 'bad'); return; }
      if (ED && ED.id === e.id) { ED.id = null; ED.dirty = true; edSaveDraft(); }
      mapsMsg('Deleted "' + m.name + '". Games already saved on it still load.', 'good'); renderMapsList();
    });
    box.appendChild(card);
  }
}
function mapsMsg(txt, cls) { const el = $('maps-note'); el.textContent = txt || ''; el.className = 'maps-msg ' + (cls || ''); }
// Play: the New Game screen (slot, mode, difficulty, length) with this map picked out
function playCustom(id) {
  const sl = allSlots(), e = sl.find(s => s.state === 'empty'); newSlot = e ? e.n : (activeSlot || 1); newOk = false; newPending = -1;
  showMenu('new');
  const card = document.querySelector('#custom-choices [data-cmap="' + id + '"]');
  if (card) { card.classList.add('flash'); try { card.scrollIntoView({ block: 'center' }); } catch (err) {} setTimeout(() => card.classList.remove('flash'), 2500); }
}
$('btn-maps').onclick = () => { mapsMsg(''); $('maps-msg').textContent = ''; armMaps(null); showMenu('maps'); };
$('btn-maps-back').onclick = () => { armMaps(null); showMenu('main'); };
$('btn-maps-draft').onclick = () => { armMaps(null); openEditor(); };
$('btn-maps-new').onclick = () => {
  const dr = ED ? { dirty: ED.dirty } : edReadDraft();
  if (dr && dr.dirty && mapsArm !== 'new') { armMaps('new'); renderMapsList(); return; }
  armMaps(null); openEditor(blankMapData(), null); ED.dirty = true; edSaveDraft(); edRenderTop();
  edSay('New map: start with the Road tool. Click where enemies come in.', 'good');
};
$('btn-maps-load').onclick = () => {
  const msg = $('maps-msg'), say = (t, cls) => { msg.textContent = t; msg.className = 'maps-msg ' + cls; };
  let d; try { d = decodeMap($('maps-code').value, false); } catch (err) { say(err.message, 'bad'); return; }
  const code = encodeMap(d), list = getCustomMaps(), dup = list.find(x => x.code === code);
  if (dup) { say('You already have this map: ' + dup.m.name + '.', 'good'); return; }
  if (list.length >= CM_LIMITS.maps) { say('You already have ' + CM_LIMITS.maps + ' maps. Delete one first.', 'bad'); return; }
  const e = { id: newMapId(), code, ts: Date.now(), best: 0, won: false }; list.unshift(e);
  if (!setCustomMaps(list)) { say('Could not save it: the browser storage is full or blocked.', 'bad'); return; }
  $('maps-code').value = ''; renderMapsList();
  say('Loaded "' + d.name + '" into your maps. Press Play to fight on it, or Edit to change it.', 'good');
  const card = document.querySelector('#maps-list [data-cmap="' + e.id + '"]'); if (card) { card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 2500); }
};
$('btn-news').onclick = () => openCodex('news');

// =====================================================================
//  START
// =====================================================================
function startGame(opts, loading) {
  initAudio();
  setAbilityMode(own(GAME_MODES, opts.gm) ? opts.gm : 'legacy'); applyModeCosts(own(GAME_MODES, opts.gm) ? opts.gm : 'legacy');
  if (opts.mode === 'daily' && opts.daily && opts.daily.mods.indexOf('cheap') >= 0) for (const t of TOWERS) t.cost = Math.max(5, Math.round(t.cost * 0.75 / 5) * 5);     // Daily: Lend-Lease
  G = newGameState(opts); enemyUid = 1; parts.length = 0;
  setupMap(G);
  $('menu-screen').classList.add('hidden'); $('editor-screen').classList.add('hidden'); $('game-screen').classList.remove('hidden');
  paused = false; ['pause', 'end', 'confirm', 'share'].forEach(closeModal);
  requestAnimationFrame(() => { resize(); });
  resize();
  if (!loading) { G.nextWave = buildWave(1); if (opts.mode === 'daily' || opts.test) activeSlot = 0; else { if (!activeSlot) { const e = allSlots().find(s => s.state === 'empty'); if (e) setActiveSlot(e.n); } if (activeSlot) clearSlot(activeSlot); } }
  shopTab = gmTabs()[0]; buildTabs(); $('b-boxmode').classList.toggle('hidden', G.gm === 'tower'); boxMode = 'auto'; $('b-boxmode').textContent = 'Box: Auto'; $('b-boxmode').classList.remove('on'); { const hm = $('h-mode'); hm.textContent = GAME_MODES[G.gm].tag; hm.style.color = GAME_MODES[G.gm].color; } specOpen = null; specScope = null; rebuildShop(true); $('abilities').innerHTML = ''; renderAbilities(); renderHeroBar(true); refreshSelection(); updateHUD(true);
  if (!loading) { announce(G.map.name, GAME_MODES[G.gm].name + ' &middot; ' + DIFFICULTIES[opts.diff].name + ' &middot; ' + MODES[opts.mode].name + (G.variantUsed !== 'normal' ? ' &middot; ' + G.variantUsed : ''), '#fff'); if (S.showTips) setTimeout(() => G && toast('Tip: ' + tipList()[0]), 2600); }
}
buildTabs();
$('b-boxmode').onclick = () => { boxMode = boxMode === 'auto' ? 'towers' : boxMode === 'towers' ? 'troops' : 'auto'; $('b-boxmode').textContent = 'Box: ' + (boxMode === 'auto' ? 'Auto' : boxMode === 'towers' ? 'Towers' : 'Troops'); $('b-boxmode').classList.toggle('on', boxMode !== 'auto'); };
$('b-wave').onclick = () => startWave();
$('b-auto').onclick = () => { G.auto = !G.auto; if (G.auto && !G.waveActive && G.countdown <= 0) G.countdown = 6 * TPS; if (!G.auto) G.countdown = 0; updateHUD(); };
$('b-speed').onclick = cycleSpeed;
$('b-pause').onclick = () => setPaused(true);
$('b-deselect').onclick = deselectAll;
$('b-sellmode').onclick = toggleRanges;
window.addEventListener('resize', () => { if (G) resize(); });
if (window.ResizeObserver) new ResizeObserver(() => { if (G) resize(); }).observe($('stage'));

// =====================================================================
//  MAIN LOOP (fixed 60 ticks/second simulation, rendering as fast as allowed)
// =====================================================================
let rtErrors = 0;
function guarded(fn, a) { try { fn(a); return true; } catch (err) { if (rtErrors++ < 5) console.error('[TD] runtime error', err); else if (rtErrors === 6) toast('Something went wrong, but the game keeps running.', '#ff8a80'); return false; } }
function simStep() { G.beams.length = 0; tick(); stepVisuals(); }
let last = performance.now(), acc = 0, lastRender = 0, frames = 0, fpsT = 0, uiT = 0, tipT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!G) return;
  if (!paused && !G.over) {
    acc += dt * G.speed * TPS;
    let n = 0;
    while (acc >= 1 && n < 12) { guarded(simStep); acc -= 1; n++; }
    if (n >= 12) acc = 0;
    // build mode drops out by itself when you can no longer afford / place another
    if (G.place) { const pd = TOWER[G.place]; const err = pd ? buyError(pd) : 'Unavailable'; if (err) cancelPlace(err); }
    if (G.placeMerc) { const err = MERC[G.placeMerc] ? mercError(MERC[G.placeMerc]) : 'Unavailable'; if (err) cancelMerc(err); }
  }
  if (S.fpsCap && now - lastRender < 1000 / S.fpsCap - 2) return;
  lastRender = now; frames++;
  guarded(render, now);
  if (now - fpsT >= 1000) { const fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; if (S.showFps) { $('fps').classList.remove('hidden'); $('fps').textContent = Math.round(fps) + ' FPS'; } autoQualityTick(fps); }
  if (now - uiT > 200) { uiT = now; guarded(() => { updateHUD(); refreshShopState(); renderAbilities(); renderHeroBar(); renderSelPanel(); updateHoverTooltip(); heroPickerCash(); }); }
  if (S.showTips && now - tipT > 45000 && G.wave > 1) { tipT = now; toast('Tip: ' + pick(tipList()), '#9fd3ff'); }
}
migrateSaves();
showMenu('main');
requestAnimationFrame(loop);
// ---- small debug hook for automated tests (window.__td) ----
window.__td = {
  get G() { return G; },
  start(o) { startGame(Object.assign({ gm: 'tower', diff: 'normal', mode: 'sandbox', variant: 'normal', map: 0 }, o || {})); return true; },
  spawn(id, n, at) { const out = []; for (let i = 0; i < (n || 1); i++) { const e = makeEnemy(id, G.wave, { d: at || 0 }); G.enemies.push(e); out.push(e); } return out.length; },
  wave(n) { G.wave = n; G.nextWave = buildWave(n); if (G.hero) heroRefresh(G.hero); updateHUD(true); rebuildShop(true); },
  build(id, x, y) { const def = TOWER[id], g = new TowerGroup(def, x, y); g.builtWave = G.wave; if (def.onPath) { const np = nearestPathPoint(G, x, y); g.x = np.x; g.y = np.y; } if (isStructure(def)) syncStructure(g); G.towers.push(g); return G.towers.length - 1; },
  hero(id, x, y) { return !!deployHero(id, x, y); },
  heroXp(n) { if (G.hero) heroGainXp(G.hero, n); },
  heroUse(i, x, y) { return useHeroAbility(i, x, y); },
  run(n) { for (let i = 0; i < n; i++) simStep(); },
  pathPoint(frac, pi) { const p = G.paths[pi || 0]; pathPos(p, p.len * frac, _p); return { x: _p.x, y: _p.y, d: p.len * frac }; },
  // 2.6: bosses, campaign and the Daily Challenge
  boss(id, frac, pi) { const p = G.paths[pi || 0], e = makeEnemy(id, G.wave, { path: pi || 0, d: p.len * (frac || 0) }); G.enemies.push(e); return e; },
  waveLabel(n) { return buildWave(n).label; },
  daily(gm, date) { if (date) { settleDailyRun(true); activeSlot = 0; startGame(dailyOpts(gm || 'tower', dailySetup(date))); } else startDaily(gm || 'tower'); return G.opts.daily; },
  dailySetup(date) { return dailySetup(date || dateKey()); },
  // 3.0: custom maps and the Map Editor
  blankMap() { return blankMapData(); },
  mapCode(d) { return encodeMap(d); },
  mapData(code, lenient) { try { return decodeMap(code, lenient); } catch (e) { return { error: e.message }; } },
  customMaps() { return getCustomMaps().map(e => ({ id: e.id, code: e.code, name: e.m.name, best: e.best, won: e.won })); },
  get ED() { return typeof ED === 'undefined' ? null : ED; }
};
