// ==========================================
// ELEMENT LAB - mouse / touch input and keyboard shortcuts
// ==========================================
const ptr = { gx: -1, gy: -1, inside: false };
let drag = null, holdFrames = 0;
let paused = false, speed = 1;
let onToolChange = null, onUiRefresh = null;

function toGrid(ev) {
    const r = $('wrap').getBoundingClientRect();
    return { x: Math.floor((ev.clientX - r.left) / r.width * W), y: Math.floor((ev.clientY - r.top) / r.height * H) };
}
function placeCursor() {
    const c = $('cursor'), wrap = $('wrap');
    if (!c) return;
    if (!ptr.inside || tool === 'zap' || (drag && (tool === 'line' || tool === 'rect'))) { c.style.display = 'none'; return; }
    const cell = wrap.clientWidth / W, d = (brushR * 2 + 1) * cell;
    c.style.display = 'block'; c.style.width = c.style.height = d + 'px';
    c.style.left = ((ptr.gx + 0.5) * cell - d / 2) + 'px'; c.style.top = ((ptr.gy + 0.5) * cell - d / 2) + 'px';
}
function applyHold() {                             // runs every frame while the button is down
    if (!drag) return;
    holdFrames++;
    const x = drag.lx, y = drag.ly;
    if (tool === 'brush' || tool === 'erase') paintAt(x, y);
    else if (tool === 'heat') heatAt(x, y, 45);
    else if (tool === 'cool') heatAt(x, y, -45);
    else if (tool === 'zap' && holdFrames % 14 === 0) zapAt(x, y);
    dirtySave = true;
}
function pDown(ev) {
    if (drag) return;
    audioUnlock();
    if (ev.button !== undefined && ev.button > 0 && ev.pointerType === 'mouse') return;
    ev.preventDefault();
    try { $('wrap').setPointerCapture(ev.pointerId); } catch (e) { }
    const g = toGrid(ev);
    ptr.gx = g.x; ptr.gy = g.y; ptr.inside = true;
    drag = { id: ev.pointerId, x0: g.x, y0: g.y, lx: g.x, ly: g.y };
    holdFrames = 0;
    if (tool !== 'zap') pushUndo();
    if (tool === 'brush' || tool === 'erase') { paintAt(g.x, g.y); if (curEl === ID.water && tool === 'brush') sfx('splash', 0.6); }
    else if (tool === 'zap') { zapAt(g.x, g.y); holdFrames = 1; }
    else if (tool === 'line' || tool === 'rect') preview = { type: tool, x0: g.x, y0: g.y, x1: g.x, y1: g.y };
    dirtySave = true; placeCursor();
}
function pMove(ev) {
    const g = toGrid(ev);
    ptr.gx = g.x; ptr.gy = g.y; ptr.inside = g.x >= 0 && g.y >= 0 && g.x < W && g.y < H;
    if (drag && ev.pointerId === drag.id) {
        const px = drag.lx, py = drag.ly;
        if (tool === 'brush' || tool === 'erase') strokeTo(px, py, g.x, g.y);
        else if (tool === 'heat') heatAt(g.x, g.y, 30);
        else if (tool === 'cool') heatAt(g.x, g.y, -30);
        else if (tool === 'wind') windAt(g.x, g.y, (g.x - px) * 1.2, (g.y - py) * 1.2);
        else if (preview) { preview.x1 = g.x; preview.y1 = g.y; }
        drag.lx = g.x; drag.ly = g.y;
        dirtySave = true;
    }
    placeCursor();
}
function pUp(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    if (preview) {
        if (preview.type === 'line') drawLine(preview.x0, preview.y0, preview.x1, preview.y1);
        else fillRect(preview.x0, preview.y0, preview.x1, preview.y1, tool === 'erase' ? 0 : curEl);
        preview = null;
    }
    drag = null; placeCursor();
}
function pLeave() { if (!drag) { ptr.inside = false; placeCursor(); } }
function setTool(t) { tool = t; preview = null; if (onToolChange) onToolChange(); placeCursor(); }
function setBrush(r) { brushR = clamp(r | 0, 0, 30); if (onToolChange) onToolChange(); placeCursor(); }
function togglePause() { paused = !paused; if (onUiRefresh) onUiRefresh(); }
function doUndo() { if (undo()) toast('Undone'); else toast('Nothing to undo'); }

function initInput() {
    const w = $('wrap');
    w.addEventListener('pointerdown', pDown);
    w.addEventListener('pointermove', pMove);
    w.addEventListener('pointerup', pUp);
    w.addEventListener('pointercancel', pUp);
    w.addEventListener('pointerleave', pLeave);
    w.addEventListener('contextmenu', e => e.preventDefault());
    w.addEventListener('wheel', e => { e.preventDefault(); setBrush(brushR + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    window.addEventListener('keydown', ev => {
        if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) && ev.key !== 'Escape') return;
        if (!$('title').classList.contains('hidden') || !$('dlg').classList.contains('hidden')) { if (ev.key === 'Escape') closeDlg(); return; }
        const k = ev.key.toLowerCase();
        if (ev.ctrlKey || ev.metaKey) { if (k === 'z') { ev.preventDefault(); doUndo(); } return; }
        const map = { b: 'brush', l: 'line', r: 'rect', e: 'erase', h: 'heat', c: 'cool', w: 'wind', z: 'zap' };
        if (map[k]) setTool(map[k]);
        else if (k === ' ') { ev.preventDefault(); togglePause(); }
        else if (k === '.') stepOnce();
        else if (k === '[') setBrush(brushR - 1);
        else if (k === ']') setBrush(brushR + 1);
        else if (k === 'u') doUndo();
    });
}
