// ===================== Main loop (fixed 60 steps per second on any screen) =====================

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = timestamp - lastTime;
    lastTime = timestamp;
    if (dt > 250) dt = STEP_MS;                       // coming back from a hidden tab: don't fast-forward
    if (dt > STEP_MS - 2.5 && dt < STEP_MS + 2.5) dt = STEP_MS; // 60Hz screens: exactly one step per frame
    stepAcc += dt;
    let steps = 0;
    while (stepAcc >= STEP_MS && steps < 4) {
        stepAcc -= STEP_MS;
        steps++;
        if (gameState === 'PAUSED' || gameState === 'EDITOR' || gameState === 'MENU') continue;
        if (gameState === 'PLAYING') {
            if (autoplay) runAutoplay();
            const r = updatePhysics();
            if (r === 1) triggerDeath();
            else if (r === 2) levelComplete();
        }
        if (bannerTimer > 0) { bannerTimer--; if (gameState === 'PLAYING') bannerY += (bannerTarget() - bannerY) * 0.15; }
        updateParticles();
    }
    if (steps >= 4) stepAcc = 0;
    if (gameState === 'EDITOR') { if (editorDirty) drawEditor(); }
    else if (steps > 0 && gameState !== 'PAUSED' && gameState !== 'MENU') draw();
    if (gameState === 'MENU') { loopRunning = false; return; }
    requestAnimationFrame(gameLoop);
}

function ensureLoop() {
    if (loopRunning) return;
    loopRunning = true;
    lastTime = 0;
    stepAcc = 0;
    requestAnimationFrame(gameLoop);
}


// ===================== Saved progress =====================

const PROGRESS_KEY = 'spikes100_progress';
const CUSTOM_KEY = 'spikes100_custom';
let progress = { unlocked: 1, beaten: false, bestOneLife: 0, bestEndless: 0 };
let customLevels = [];

function intIn(v, lo, hi, dflt) {
    v = Math.floor(Number(v));
    return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
}

function loadSaves() {
    try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (raw) {
            const p = JSON.parse(raw);
            if (p && typeof p === 'object') {
                progress.unlocked = intIn(p.unlocked, 1, MAX_LEVELS, 1);
                progress.beaten = !!p.beaten;
                progress.bestOneLife = intIn(p.bestOneLife, 0, MAX_LEVELS, 0);
                progress.bestEndless = intIn(p.bestEndless, 0, 1e6, 0);
            }
        }
    } catch (e) { /* storage blocked or corrupt: play without saves */ }
    try {
        const raw = localStorage.getItem(CUSTOM_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) {
            customLevels = list.filter(l => l && typeof l.code === 'string').map(l => ({
                id: String(l.id || newId()), name: String(l.name || 'Untitled').slice(0, 24), code: l.code,
                verified: !!l.verified, imported: !!l.imported, updated: Number(l.updated) || 0
            }));
        }
    } catch (e) { customLevels = []; }
}

function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ }
}

function saveCustomLevels() {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customLevels)); return true; }
    catch (e) { showToast('Could not save - browser storage is blocked or full', true); return false; }
}

function noteLevelReached(n) {
    let changed = false;
    if (n <= MAX_LEVELS && n > progress.unlocked) { progress.unlocked = n; changed = true; }
    if (isEndless && n > progress.bestEndless) { progress.bestEndless = n; changed = true; }
    if (changed) saveProgress();
}

function newId() {
    return Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}


// ===================== Share codes =====================
// Compact text: "SPK-" + base64url of [version, flags, width, height, nameLen, name...,
// column tokens..., 16-bit checksum]. A column is a list of runs (tile+1)<<3 | (len-1);
// a 0 byte followed by n means "repeat the previous column n more times".

function checksum16(bytes) {
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return ((h >>> 16) ^ (h & 0xffff)) & 0xffff;
}

function encodeLevel(name, w, grid, verified) {
    const bytes = [1, verified ? 1 : 0, w, ROWS];
    const nameBytes = Array.from(new TextEncoder().encode(String(name || '').slice(0, 24))).slice(0, 72);
    bytes.push(nameBytes.length);
    for (let i = 0; i < nameBytes.length; i++) bytes.push(nameBytes[i]);
    let prev = null, repeat = 0;
    for (let x = 0; x < w; x++) {
        let col = '';
        for (let y = 0; y < ROWS; y++) col += grid[y * w + x];
        if (col === prev) {
            repeat++;
            if (repeat === 255) { bytes.push(0, 255); repeat = 0; }
            continue;
        }
        if (repeat > 0) { bytes.push(0, repeat); repeat = 0; }
        let y = 0;
        while (y < ROWS) {
            const ch = col[y];
            let n = 1;
            while (y + n < ROWS && col[y + n] === ch && n < 8) n++;
            bytes.push(((Math.max(0, TILE_CHARS.indexOf(ch)) + 1) << 3) | (n - 1));
            y += n;
        }
        prev = col;
    }
    if (repeat > 0) bytes.push(0, repeat);
    const h = checksum16(bytes);
    bytes.push(h >> 8, h & 255);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'SPK-' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeLevel(code) {
    let s = String(code || '').replace(/\s+/g, '').replace(/^SPK-?/i, '');
    if (!s) throw new Error('Paste a level code first.');
    if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('That is not a level code (it has characters a code never uses).');
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    let bin;
    try { bin = atob(b64); } catch (e) { throw new Error('That code is damaged - check you copied all of it.'); }
    const bytes = new Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bad = new Error('That code is damaged or cut off - check you copied all of it.');
    if (bytes.length < 9) throw bad;
    const body = bytes.slice(0, -2);
    if (checksum16(body) !== ((bytes[bytes.length - 2] << 8) | bytes[bytes.length - 1])) throw bad;
    if (body[0] !== 1) throw new Error('That code was made by a different version of the game.');
    const flags = body[1], w = body[2], h = body[3], nl = body[4];
    if (w < 10 || h !== ROWS || 5 + nl > body.length) throw bad;
    let name = '';
    try { name = new TextDecoder().decode(new Uint8Array(body.slice(5, 5 + nl))); } catch (e) { name = ''; }
    const grid = new Array(w * ROWS);
    let i = 5 + nl, x = 0, prev = null;
    while (x < w) {
        if (i >= body.length) throw bad;
        if (body[i] === 0) {
            const n = body[i + 1];
            i += 2;
            if (!prev || !n) throw bad;
            for (let k = 0; k < n; k++) {
                if (x >= w) throw bad;
                for (let y = 0; y < ROWS; y++) grid[y * w + x] = prev[y];
                x++;
            }
            continue;
        }
        const col = [];
        while (col.length < ROWS) {
            if (i >= body.length) throw bad;
            const t = body[i++];
            const idx = (t >> 3) - 1, n = (t & 7) + 1;
            if (idx < 0 || idx >= TILE_CHARS.length || col.length + n > ROWS) throw bad;
            for (let k = 0; k < n; k++) col.push(TILE_CHARS[idx]);
        }
        for (let y = 0; y < ROWS; y++) grid[y * w + x] = col[y];
        prev = col;
        x++;
    }
    if (i !== body.length) throw bad;
    // only one start and one goal
    let seenS = false, seenG = false;
    for (let k = 0; k < grid.length; k++) {
        if (grid[k] === 'S') { if (seenS) grid[k] = '.'; seenS = true; }
        else if (grid[k] === 'G') { if (seenG) grid[k] = '.'; seenG = true; }
    }
    return { name: name.trim().slice(0, 24) || 'Untitled', w: w, grid: grid, verified: !!(flags & 1) };
}


// ===================== Menus =====================

function refreshMenu() {
    const cont = document.getElementById('continueBtn');
    const lv = Math.min(MAX_LEVELS, progress.unlocked);
    cont.classList.toggle('hidden', lv <= 1);
    cont.textContent = `Continue (Level ${lv})`;
    const bits = [];
    if (progress.beaten) bits.push('All 100 levels beaten!');
    else if (progress.unlocked > 1) bits.push(`Reached level ${lv}`);
    if (progress.bestOneLife > 0) bits.push(`One Life best: ${progress.bestOneLife === MAX_LEVELS ? 'all 100' : 'cleared ' + progress.bestOneLife}`);
    if (progress.bestEndless > 0) bits.push(`Endless best: level ${progress.bestEndless}`);
    if (customLevels.length) bits.push(`${customLevels.length} custom level${customLevels.length === 1 ? '' : 's'}`);
    document.getElementById('statsLine').textContent = bits.join('  ·  ');
}

function openSubScreen(el) {
    hideAllScreens();
    el.classList.remove('hidden');
}

function closeSubScreen() {
    showMainMenu();
}

let levelGridBuilt = false;
function openLevelSelect() {
    const grid = document.getElementById('levelGrid');
    if (!levelGridBuilt) {
        levelGridBuilt = true;
        for (let n = 1; n <= MAX_LEVELS; n++) {
            const b = document.createElement('button');
            b.className = 'lvl-btn' + (n > GENERATED_LEVELS ? ' hand' : '');
            b.textContent = n;
            b.dataset.level = n;
            const def = n > GENERATED_LEVELS ? HAND_LEVELS[n - GENERATED_LEVELS - 1] : null;
            if (def) b.title = def.name;
            b.addEventListener('click', () => { if (!b.disabled) startCampaign(n, false, endlessToggle.checked); });
            grid.appendChild(b);
        }
    }
    const btns = grid.children;
    for (let i = 0; i < btns.length; i++) btns[i].disabled = (i + 1) > progress.unlocked;
    openSubScreen(levelSelectScreen);
}

function openWhatsNew() {
    openSubScreen(whatsNewScreen);
}

function openCustomScreen(flashId) {
    gameState = 'MENU';
    editorBar.classList.add('hidden');
    hud.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    renderCustomList(flashId);
    openSubScreen(customScreen);
    draw();
}

function renderCustomList(flashId) {
    const box = document.getElementById('customList');
    box.textContent = '';
    if (!customLevels.length) {
        const d = document.createElement('div');
        d.className = 'custom-empty';
        d.textContent = 'No custom levels yet. Make one with "+ New Level", or paste a friend\'s share code.';
        box.appendChild(d);
        return;
    }
    customLevels.forEach((lv) => {
        const row = document.createElement('div');
        row.className = 'custom-row' + (lv.id === flashId ? ' flash' : '');
        const name = document.createElement('div');
        name.className = 'custom-name';
        name.textContent = lv.name;
        const badge = document.createElement('span');
        badge.className = lv.verified ? 'badge-ok' : 'badge-no';
        badge.textContent = lv.verified ? '✓ Verified' : 'Not verified';
        badge.title = lv.verified ? 'The creator has beaten this level' : 'Nobody has beaten this level in Test mode yet';
        name.appendChild(badge);
        if (lv.imported) {
            const m = document.createElement('span');
            m.className = 'custom-meta';
            m.textContent = 'from code';
            name.appendChild(m);
        }
        row.appendChild(name);
        const mk = (label, cls, fn) => {
            const b = document.createElement('button');
            b.textContent = label;
            if (cls) b.className = cls;
            b.addEventListener('click', fn);
            row.appendChild(b);
        };
        mk('Play', 'btn-green', () => playCustom(lv.id));
        mk('Edit', 'btn-alt', () => editCustom(lv.id));
        mk('Share', '', () => showShareCode(lv.name, lv.code, lv.verified));
        mk('Delete', 'btn-red', () => confirmDeleteCustom(lv.id));
        box.appendChild(row);
    });
    if (flashId) {
        const el = box.querySelector('.flash');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
    }
}

function findCustom(id) {
    for (let i = 0; i < customLevels.length; i++) if (customLevels[i].id === id) return customLevels[i];
    return null;
}

function playCustom(id) {
    const lv = findCustom(id);
    if (!lv) return;
    let d;
    try { d = decodeLevel(lv.code); } catch (e) { showModal({ title: 'Cannot open level', text: e.message, buttons: [{ label: 'OK' }] }); return; }
    playMode = 'custom';
    customLevel = { name: d.name, w: d.w, grid: d.grid, id: lv.id };
    customDeaths = 0;
    loadCustomLevel();
    enterPlay();
}

function editCustom(id) {
    const lv = findCustom(id);
    if (!lv) return;
    let d;
    try { d = decodeLevel(lv.code); } catch (e) { showModal({ title: 'Cannot open level', text: e.message, buttons: [{ label: 'OK' }] }); return; }
    openEditor({ name: d.name, w: d.w, grid: d.grid, id: lv.id, verified: lv.verified });
}

function confirmDeleteCustom(id) {
    const lv = findCustom(id);
    if (!lv) return;
    showModal({
        title: 'Delete level?',
        text: `"${lv.name}" will be removed from My Levels. Copy its share code first if you want to keep it.`,
        buttons: [
            { label: 'Delete', cls: 'btn-red', action: () => {
                customLevels = customLevels.filter(l => l.id !== id);
                saveCustomLevels();
                renderCustomList();
            } },
            { label: 'Cancel', cls: 'btn-grey' }
        ]
    });
}

function promptImportCode() {
    showModal({
        title: 'Enter Share Code',
        text: 'Paste a level code (it starts with SPK-).',
        input: { value: '', placeholder: 'SPK-...' },
        buttons: [
            { label: 'Add Level', cls: 'btn-green', action: (val) => {
                let d;
                try { d = decodeLevel(val); } catch (e) { return e.message; }
                const code = encodeLevel(d.name, d.w, d.grid, d.verified);
                let lv = customLevels.find(l => l.code === code);
                if (!lv) {
                    lv = { id: newId(), name: d.name, code: code, verified: d.verified, imported: true, updated: Date.now() };
                    customLevels.unshift(lv);
                    if (!saveCustomLevels()) return 'Could not save - browser storage is blocked or full.';
                    showToast(`Added "${d.name}"`);
                } else showToast(`"${d.name}" is already in My Levels`);
                renderCustomList(lv.id);
            } },
            { label: 'Cancel', cls: 'btn-grey' }
        ]
    });
}

function showShareCode(name, code, verified) {
    showModal({
        title: 'Share Code',
        text: `Send this code to a friend so they can play "${name}".` + (verified ? '' : ' (Tip: beat it in Test mode first so it shows as Verified.)'),
        input: { value: code, readonly: true },
        buttons: [
            { label: 'Copy', cls: 'btn-green', action: () => { copyText(code); return false; } },
            { label: 'Done', cls: 'btn-grey' }
        ]
    });
}

function copyText(text) {
    const ta = document.getElementById('modalInput');
    let ok = false;
    try {
        ta.focus();
        ta.select();
        ok = document.execCommand && document.execCommand('copy');
    } catch (e) { ok = false; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast('Code copied!'), () => { if (!ok) showToast('Press Ctrl+C to copy the selected code', true); });
        if (ok) showToast('Code copied!');
    } else showToast(ok ? 'Code copied!' : 'Press Ctrl+C to copy the selected code', !ok);
}

let toastTimer = 0;
function showToast(msg, warn) {
    toastEl.textContent = msg;
    toastEl.style.background = warn ? 'rgba(250, 204, 21, 0.95)' : '';
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

// Small in-game dialog. buttons: [{label, cls, action(inputValue)}]; an action returning a string shows
// it as an error and keeps the dialog open, returning false just keeps it open.
let modalButtons = [];
function showModal(opts) {
    document.getElementById('modalTitle').textContent = opts.title || '';
    document.getElementById('modalText').textContent = opts.text || '';
    const ta = document.getElementById('modalInput');
    const err = document.getElementById('modalError');
    err.classList.add('hidden');
    if (opts.input) {
        ta.classList.remove('hidden');
        ta.value = opts.input.value || '';
        ta.readOnly = !!opts.input.readonly;
        ta.placeholder = opts.input.placeholder || '';
    } else ta.classList.add('hidden');
    const row = document.getElementById('modalButtons');
    row.textContent = '';
    modalButtons = opts.buttons || [{ label: 'OK' }];
    modalButtons.forEach((bd) => {
        const b = document.createElement('button');
        b.textContent = bd.label;
        b.className = bd.cls || '';
        b.addEventListener('click', () => {
            const res = bd.action ? bd.action(ta.value) : undefined;
            if (typeof res === 'string') { err.textContent = res; err.classList.remove('hidden'); return; }
            if (res === false) return;
            closeModal();
        });
        row.appendChild(b);
    });
    modal.classList.remove('hidden');
    if (opts.input) {
        setTimeout(() => { ta.focus(); if (opts.input.readonly) ta.select(); }, 30);
    }
}

function closeModal() {
    modal.classList.add('hidden');
}


