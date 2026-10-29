// ===================== Level editor =====================

const ED_TILE = 25;                       // editor zoom: 18 rows x 25px = 450px, the bar covers the rest
const ED_VIEW_H = ROWS * ED_TILE;
const ED_MIN_W = 20, ED_MAX_W = 150, ED_DEFAULT_W = 40;
const TOOLS = [
    { ch: '#', name: 'Block' },
    { ch: '^', name: 'Spike (up)' },
    { ch: 'v', name: 'Spike (down)' },
    { ch: '<', name: 'Spike (left)' },
    { ch: '>', name: 'Spike (right)' },
    { ch: '-', name: 'Moving platform (sideways) - turns at blocks or stoppers' },
    { ch: '|', name: 'Moving platform (up and down)' },
    { ch: 'x', name: 'Stopper - invisible, turns moving platforms around' },
    { ch: 'B', name: 'Bounce pad' },
    { ch: 'C', name: 'Crumbling block - falls soon after you step on it' },
    { ch: '{', name: 'Conveyor belt (moves you left)' },
    { ch: '}', name: 'Conveyor belt (moves you right)' },
    { ch: 'O', name: 'Spinning saw' },
    { ch: 'R', name: 'Rotating saw (clockwise)' },
    { ch: 'r', name: 'Rotating saw (counter-clockwise)' },
    { ch: 'K', name: 'Key' },
    { ch: 'D', name: 'Door - one key opens a whole door' },
    { ch: 'g', name: 'Gravity-flip zone - flips gravity when you enter' },
    { ch: 'S', name: 'Start' },
    { ch: 'G', name: 'Goal' },
    { ch: '.', name: 'Eraser' }
];
const TOOL_NAMES = {};
TOOLS.forEach(t => { TOOL_NAMES[t.ch] = t.name; });

let editor = { w: ED_DEFAULT_W, grid: [], name: '', tool: '#', camX: 0, hoverX: -1, hoverY: -1,
               painting: 0, lastX: -1, lastY: -1, undo: [], unsaved: false, id: null, verified: false,
               strokeUndo: false };   // true while a click/drag has not changed anything yet (undo step is pushed on the first real change)
let editorDirty = true;
let editorToolsBuilt = false;

function drawTileIcon(g, ch, x, y, s) {
    g.save();
    g.translate(x, y);
    if (s !== TILE) g.scale(s / TILE, s / TILE);
    switch (ch) {
        case '#': drawBlock(g, 0, 0, 30, 30); break;
        case '^': drawSpike(g, 3, 10, 0); break;
        case 'v': drawSpike(g, 3, 0, 1); break;
        case '<': drawSpike(g, 10, 3, 2); break;
        case '>': drawSpike(g, 0, 3, 3); break;
        case 'C': drawCrumble(g, 0, 0, 0); break;
        case 'K': drawKey(g, 6, 4); break;
        case 'D': drawDoor(g, 0, 0); break;
        case 'B': drawBounce(g, 0, 0, true, false, 0); break;
        case '{': drawConveyor(g, 0, 0, 30, -1, 0); break;
        case '}': drawConveyor(g, 0, 0, 30, 1, 0); break;
        case '-':
        case '|':
            drawMoverSlab(g, 0, 0, 30);
            g.strokeStyle = '#a5f3fc';
            g.lineWidth = 2;
            g.beginPath();
            if (ch === '-') { g.moveTo(4, 22); g.lineTo(26, 22); g.moveTo(8, 18); g.lineTo(4, 22); g.lineTo(8, 26); g.moveTo(22, 18); g.lineTo(26, 22); g.lineTo(22, 26); }
            else { g.moveTo(15, 16); g.lineTo(15, 29); g.moveTo(11, 20); g.lineTo(15, 16); g.lineTo(19, 20); g.moveTo(11, 25); g.lineTo(15, 29); g.lineTo(19, 25); }
            g.stroke();
            break;
        case 'x':
            g.strokeStyle = 'rgba(34, 211, 238, 0.7)';
            g.lineWidth = 2;
            g.setLineDash(DASH);
            g.strokeRect(3, 3, 24, 24);
            g.setLineDash(NO_DASH);
            g.beginPath(); g.moveTo(9, 9); g.lineTo(21, 21); g.moveTo(21, 9); g.lineTo(9, 21); g.stroke();
            break;
        case 'O': drawSaw(g, 15, 15, 0); break;
        case 'R':
        case 'r':
            g.fillStyle = '#475569';
            g.beginPath(); g.arc(15, 15, 7, 0, Math.PI * 2); g.fill();
            g.strokeStyle = '#f43f5e';
            g.lineWidth = 2.5;
            g.beginPath();
            if (ch === 'R') { g.arc(15, 15, 12, -2.6, 0.9); g.moveTo(22, 25); g.lineTo(23.5, 23); g.lineTo(26, 23.5); }
            else { g.arc(15, 15, 12, 2.2, 5.8, false); g.moveTo(25, 8); g.lineTo(26, 11); g.lineTo(23, 11.5); }
            g.stroke();
            break;
        case 'g': drawZoneRect(g, 0, 0, 30, 30, 0); break;
        case 'S': drawPlayerShape(g, 3, 6, 24, 24, 1, 0); break;
        case 'G':
            g.scale(0.5, 0.5);
            drawGoalShape(g, 10, 0);
            break;
        case '.':
            g.strokeStyle = '#f43f5e';
            g.lineWidth = 3;
            g.strokeRect(5, 5, 20, 20);
            g.beginPath(); g.moveTo(8, 8); g.lineTo(22, 22); g.stroke();
            break;
    }
    g.restore();
}

function buildEditorTools() {
    if (editorToolsBuilt) return;
    editorToolsBuilt = true;
    const row = document.getElementById('edTools');
    TOOLS.forEach((t) => {
        const b = document.createElement('button');
        b.className = 'ed-tool';
        b.title = t.name;
        b.dataset.tool = t.ch;
        const c = document.createElement('canvas');
        c.width = c.height = 30;
        drawTileIcon(c.getContext('2d'), t.ch, 0, 0, 30);
        b.appendChild(c);
        b.addEventListener('click', () => selectTool(t.ch));
        row.appendChild(b);
    });
    editorBar.addEventListener('click', (e) => {
        const b = e.target.closest ? e.target.closest('[data-ed]') : null;
        if (b) editorAction(b.dataset.ed);
    });
    document.getElementById('edName').addEventListener('input', (e) => {
        editor.name = e.target.value.slice(0, 24);
        editor.unsaved = true;
    });
}

function selectTool(ch) {
    editor.tool = ch;
    const btns = document.querySelectorAll('#edTools .ed-tool');
    for (let i = 0; i < btns.length; i++) btns[i].classList.toggle('sel', btns[i].dataset.tool === ch);
    editorDirty = true;
}

function blankEditorGrid(w) {
    const grid = new Array(w * ROWS).fill('.');
    for (let x = 0; x < w; x++) { grid[16 * w + x] = '#'; grid[17 * w + x] = '#'; }
    grid[15 * w + 2] = 'S';
    grid[15 * w + (w - 3)] = 'G';
    return grid;
}

function openEditor(lv) {
    buildEditorTools();
    if (lv) {
        editor.w = lv.w;
        editor.grid = lv.grid.slice();
        editor.name = lv.name || 'My Level';
        editor.id = lv.id || null;
        editor.verified = !!lv.verified;
    } else {
        editor.w = ED_DEFAULT_W;
        editor.grid = blankEditorGrid(ED_DEFAULT_W);
        editor.name = 'My Level ' + (customLevels.length + 1);
        editor.id = null;
        editor.verified = false;
    }
    editor.undo = [];
    editor.camX = 0;
    editor.unsaved = !lv;
    document.getElementById('edName').value = editor.name;
    selectTool(editor.tool);
    reopenEditor();
}

function reopenEditor() {
    hideAllScreens();
    closeModal();
    hud.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    editorBar.classList.remove('hidden');
    document.getElementById('edWidth').textContent = editor.w;
    gameState = 'EDITOR';
    editor.painting = 0;
    editorDirty = true;
    ensureLoop();
}

function editorPushUndo() {
    editor.undo.push({ w: editor.w, grid: editor.grid.slice() });
    if (editor.undo.length > 40) editor.undo.shift();
}

function editorChanged() {
    editor.unsaved = true;
    editor.verified = false;
    editorDirty = true;
}

function editorSet(tx, ty, ch) {
    if (tx < 0 || ty < 0 || tx >= editor.w || ty >= ROWS) return;
    const i = ty * editor.w + tx;
    if (editor.grid[i] === ch) return;
    if (editor.strokeUndo) { editor.strokeUndo = false; editorPushUndo(); }
    if (ch === 'S' || ch === 'G') {
        for (let k = 0; k < editor.grid.length; k++) if (editor.grid[k] === ch) editor.grid[k] = '.';
    }
    editor.grid[i] = ch;
    editorChanged();
}

function editorPaintLine(x0, y0, x1, y1, ch) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k++) {
        const t = n ? k / n : 0;
        editorSet(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), ch);
    }
}

function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
}

function editorTileFromPoint(p) {
    return { x: Math.floor((p.x + editor.camX) / ED_TILE), y: Math.floor(p.y / ED_TILE) };
}

canvas.addEventListener('pointerdown', (e) => {
    if (gameState !== 'EDITOR' || !modal.classList.contains('hidden')) return;
    const p = canvasPoint(e);
    if (p.y >= ED_VIEW_H) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    const t = editorTileFromPoint(p);
    editor.strokeUndo = true;            // clicks that change nothing don't use up an undo step
    editor.painting = e.button === 2 ? 2 : 1;
    const ch = editor.painting === 2 ? '.' : editor.tool;
    editorSet(t.x, t.y, ch);
    editor.lastX = t.x; editor.lastY = t.y;
    if (ch === 'S' || ch === 'G') endPaint();   // one start / goal: no dragging
});

canvas.addEventListener('pointermove', (e) => {
    if (gameState !== 'EDITOR') return;
    const p = canvasPoint(e);
    const t = editorTileFromPoint(p);
    if (p.y >= ED_VIEW_H) { t.x = -1; t.y = -1; }
    if (t.x !== editor.hoverX || t.y !== editor.hoverY) { editor.hoverX = t.x; editor.hoverY = t.y; editorDirty = true; }
    if (editor.painting && t.y >= 0) {
        editorPaintLine(editor.lastX, editor.lastY, t.x, t.y, editor.painting === 2 ? '.' : editor.tool);
        editor.lastX = t.x; editor.lastY = t.y;
    }
});

function endPaint() { editor.painting = 0; editor.strokeUndo = false; }
canvas.addEventListener('pointerup', endPaint);
canvas.addEventListener('pointercancel', endPaint);
canvas.addEventListener('pointerleave', () => { if (gameState === 'EDITOR') { editor.hoverX = editor.hoverY = -1; editorDirty = true; } });

canvas.addEventListener('wheel', (e) => {
    if (gameState !== 'EDITOR') return;
    e.preventDefault();
    editorScroll((Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) > 0 ? 3 : -3);
}, { passive: false });

function editorScroll(tiles) {
    const maxCam = Math.max(0, editor.w * ED_TILE - canvas.width + ED_TILE * 2);
    editor.camX = Math.max(0, Math.min(maxCam, editor.camX + tiles * ED_TILE));
    editorDirty = true;
}

function editorKey(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { editorScroll(-4); e.preventDefault(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { editorScroll(4); e.preventDefault(); }
    else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { editorUndo(); e.preventDefault(); }
    else if (e.code === 'Home') { editor.camX = 0; editorDirty = true; }
    else if (e.code === 'End') { editorScroll(9999); }
}

function editorUndo() {
    const u = editor.undo.pop();
    if (!u) { showToast('Nothing to undo', true); return; }
    editor.w = u.w;
    editor.grid = u.grid;
    document.getElementById('edWidth').textContent = editor.w;
    editorScroll(0);
    editorChanged();
}

function editorResize(newW) {
    newW = Math.max(ED_MIN_W, Math.min(ED_MAX_W, newW));
    if (newW === editor.w) { showToast(newW === ED_MAX_W ? 'Levels can be up to 150 tiles long' : 'Levels must be at least 20 tiles long', true); return; }
    editorPushUndo();
    const ow = editor.w, g = new Array(newW * ROWS);
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < newW; x++) {
            let ch = '.';
            if (x < ow) ch = editor.grid[y * ow + x];
            else if (editor.grid[y * ow + ow - 1] === '#') ch = '#';   // carry the ground on
            g[y * newW + x] = ch;
        }
    }
    // narrowing must not silently delete the Start or Goal: pull them back inside the new edge (same row)
    let moved = '';
    if (newW < ow) {
        for (let k = 0; k < 2; k++) {
            const ch = k ? 'G' : 'S';
            let oy = -1;
            for (let y = 0; y < ROWS && oy < 0; y++) for (let x = newW; x < ow; x++) if (editor.grid[y * ow + x] === ch) { oy = y; break; }
            if (oy < 0) continue;
            let tx = newW - (k ? 3 : 4);
            while (tx > 0 && (g[oy * newW + tx] === '#' || g[oy * newW + tx] === 'S' || g[oy * newW + tx] === 'G')) tx--;
            g[oy * newW + tx] = ch;
            moved += (moved ? ' and ' : '') + (k ? 'Goal' : 'Start');
        }
    }
    editor.w = newW;
    editor.grid = g;
    document.getElementById('edWidth').textContent = newW;
    editorScroll(0);
    editorChanged();
    if (moved) showToast(moved + ' moved inside the new edge (Ctrl+Z to undo)');
}

function editorValidate() {
    let s = 0, gl = 0;
    for (let i = 0; i < editor.grid.length; i++) { if (editor.grid[i] === 'S') s++; else if (editor.grid[i] === 'G') gl++; }
    if (!s) return 'Place a Start tile first (the blue square in the tool bar).';
    if (!gl) return 'Place a Goal tile first (the green door in the tool bar).';
    return '';
}

function editorAction(act) {
    if (gameState !== 'EDITOR') return;
    switch (act) {
        case 'narrow': editorResize(editor.w - 5); break;
        case 'widen': editorResize(editor.w + 5); break;
        case 'undo': editorUndo(); break;
        case 'clear':
            showModal({ title: 'Clear level?', text: 'Wipe everything back to a flat floor? (Undo can bring it back.)', buttons: [
                { label: 'Clear', cls: 'btn-red', action: () => { editorPushUndo(); editor.grid = blankEditorGrid(editor.w); editorChanged(); } },
                { label: 'Cancel', cls: 'btn-grey' }] });
            break;
        case 'test': {
            const err = editorValidate();
            if (err) { showToast(err, true); return; }
            playMode = 'test';
            customLevel = { name: editor.name || 'My Level', w: editor.w, grid: editor.grid.slice(), id: editor.id };
            customDeaths = 0;
            loadCustomLevel();
            enterPlay();
            break;
        }
        case 'save': editorSave(); break;
        case 'share': {
            const err = editorValidate();
            if (err) { showToast(err, true); return; }
            const saved = editorSave(true);
            if (!saved) return;
            showShareCode(editor.name || 'My Level', saved.code, editor.verified);
            break;
        }
        case 'exit':
            if (editor.unsaved) {
                showModal({ title: 'Save changes?', text: `"${editor.name || 'My Level'}" has changes that are not saved.`, buttons: [
                    { label: 'Save', cls: 'btn-green', action: () => { if (editorSave()) setTimeout(() => openCustomScreen(editor.id), 0); else return false; } },
                    { label: "Don't Save", cls: 'btn-red', action: () => { setTimeout(() => openCustomScreen(), 0); } },
                    { label: 'Cancel', cls: 'btn-grey' }] });
            } else openCustomScreen(editor.id);
            break;
    }
}

function editorSave(quiet) {
    const err = editorValidate();
    if (err) { showToast(err, true); return null; }
    const name = (editor.name || '').trim() || 'My Level';
    const code = encodeLevel(name, editor.w, editor.grid, editor.verified);
    let lv = editor.id ? findCustom(editor.id) : null;
    if (!lv) {
        lv = { id: newId(), name: name, code: code, verified: editor.verified, imported: false, updated: Date.now() };
        customLevels.unshift(lv);
        editor.id = lv.id;
    } else {
        lv.name = name; lv.code = code; lv.verified = editor.verified; lv.updated = Date.now();
    }
    if (!saveCustomLevels()) return null;
    editor.unsaved = false;
    if (!quiet) showToast(`Saved "${name}"`);
    return lv;
}

function markEditorVerified() {
    // only if the level tested is still exactly what is in the editor
    if (!customLevel || customLevel.w !== editor.w || customLevel.grid.join('') !== editor.grid.join('')) return;
    editor.verified = true;
    const lv = editor.id ? findCustom(editor.id) : null;
    if (lv && !editor.unsaved) {
        lv.verified = true;
        lv.code = encodeLevel(lv.name, editor.w, editor.grid, true);
        saveCustomLevels();
    } else if (lv) editor.unsaved = true;
}

function drawEditor() {
    editorDirty = false;
    if (!bgGradient) { draw(); }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = ED_TILE, w = editor.w;
    const camX = Math.round(editor.camX);
    const c0 = Math.max(0, Math.floor(camX / s)), c1 = Math.min(w, Math.ceil((camX + canvas.width) / s));
    ctx.save();
    ctx.translate(-camX, 0);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.fillRect(0, 0, w * s, ED_VIEW_H);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = c0; x <= c1; x++) { ctx.moveTo(x * s + 0.5, 0); ctx.lineTo(x * s + 0.5, ED_VIEW_H); }
    for (let y = 0; y <= ROWS; y++) { ctx.moveTo(c0 * s, y * s + 0.5); ctx.lineTo(c1 * s, y * s + 0.5); }
    ctx.stroke();
    // a faint line every 5 columns helps count distances
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.beginPath();
    for (let x = Math.ceil(c0 / 5) * 5; x <= c1; x += 5) { ctx.moveTo(x * s + 0.5, 0); ctx.lineTo(x * s + 0.5, ED_VIEW_H); }
    ctx.stroke();

    const grid = editor.grid;
    let goalAt = -1;
    for (let y = 0; y < ROWS; y++) {
        for (let x = c0; x < c1; x++) {
            const ch = grid[y * w + x];
            if (ch === '.') continue;
            if (ch === 'G') { goalAt = y * w + x; continue; }
            drawTileIcon(ctx, ch, x * s, y * s, s);
        }
    }
    if (goalAt < 0) { for (let i = 0; i < grid.length; i++) if (grid[i] === 'G') { goalAt = i; break; } }
    if (goalAt >= 0) {
        const gx = goalAt % w, gy = Math.floor(goalAt / w);
        ctx.save();
        ctx.translate(gx * s, gy * s);
        ctx.scale(s / TILE, s / TILE);
        drawGoalShape(ctx, -5, TILE - goal.h);
        ctx.restore();
    }
    // previews: where moving platforms travel and where rotating saws swing
    ctx.lineWidth = 2;
    ctx.setLineDash(DASH);
    for (let y = 0; y < ROWS; y++) {
        let x = 0;
        while (x < w) {
            const ch = grid[y * w + x];
            if (ch !== '-' && ch !== '|') { x++; continue; }
            let x1 = x;
            while (x1 < w && grid[y * w + x1] === ch) x1++;
            if (x1 > c0 - 30 && x < c1 + 30) {
                const rg = moverRange(grid, w, x, x1, y, ch === '-' ? 0 : 1);
                const k = s / TILE;
                ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
                ctx.beginPath();
                if (ch === '-') { ctx.moveTo(rg.min * k, y * s + s * 0.25); ctx.lineTo((rg.max + (x1 - x) * TILE) * k, y * s + s * 0.25); }
                else { const cx = (x + x1) * s / 2; ctx.moveTo(cx, rg.min * k); ctx.lineTo(cx, (rg.max + MOVER_H) * k); }
                ctx.stroke();
            }
            x = x1;
        }
    }
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
    for (let y = 0; y < ROWS; y++) {
        for (let x = Math.max(0, c0 - 4); x < Math.min(w, c1 + 4); x++) {
            const ch = grid[y * w + x];
            if (ch !== 'R' && ch !== 'r') continue;
            ctx.beginPath();
            ctx.arc(x * s + s / 2, y * s + s / 2, ORBIT_R * s / TILE, 0, Math.PI * 2);
            ctx.stroke();
            drawSaw(ctx, x * s + s / 2 + (ch === 'R' ? 1 : -1) * ORBIT_R * s / TILE, y * s + s / 2, 0);
        }
    }
    ctx.setLineDash(NO_DASH);
    // level end
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w * s + 1.5, 0); ctx.lineTo(w * s + 1.5, ED_VIEW_H); ctx.stroke();
    // hover
    if (editor.hoverX >= 0 && editor.hoverX < w && editor.hoverY >= 0 && editor.hoverY < ROWS) {
        ctx.globalAlpha = 0.55;
        if (editor.tool !== '.') drawTileIcon(ctx, editor.tool, editor.hoverX * s, editor.hoverY * s, s);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.strokeRect(editor.hoverX * s + 1, editor.hoverY * s + 1, s - 2, s - 2);
    }
    ctx.restore();

    // info box
    const info = (TOOL_NAMES[editor.tool] || '') +
        (editor.hoverX >= 0 && editor.hoverX < w ? `   ·   column ${editor.hoverX + 1}, row ${editor.hoverY + 1}` : '');
    ctx.font = 'bold 15px "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'left';
    const help = 'Left-click: draw  ·  Right-click: erase  ·  Wheel / arrow keys: scroll  ·  Ctrl+Z: undo';
    const bw = Math.max(ctx.measureText(info).width, ctx.measureText(help).width * 0.87) + 20;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.fillRect(8, 8, bw, 46);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(info, 18, 27);
    ctx.font = '13px "Segoe UI", Tahoma, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(help, 18, 46);
    if (editor.verified) {
        ctx.font = 'bold 14px "Segoe UI", Tahoma, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#10b981';
        ctx.fillText('✓ Verified', canvas.width - 14, 26);
    }
}


