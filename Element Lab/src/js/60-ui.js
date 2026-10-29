// ==========================================
// ELEMENT LAB - interface: toolbar, element palette, dialogs, title screen
// ==========================================
let curCat = 'Powders', searchQ = '';
const SPEEDS = [0.5, 1, 2];
let toastTimer = 0;
function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}
function openDlg(title, html, mount) {
    $('dlg-t').textContent = title; $('dlg-b').innerHTML = html;
    $('dlg').classList.remove('hidden');
    if (mount) mount($('dlg-b'));
}
function closeDlg() { $('dlg').classList.add('hidden'); }

function mkBtn(parent, id, label, title, fn, cls) {
    const b = document.createElement('button');
    b.className = 'tb' + (cls ? ' ' + cls : ''); b.id = id; b.textContent = label; b.title = title || label;
    b.addEventListener('click', () => { audioUnlock(); fn(); });
    parent.appendChild(b); return b;
}
function stepOnce() { if (paused) { step(); } }
function cycleSpeed() { const k = (SPEEDS.indexOf(speed) + 1) % SPEEDS.length; speed = SPEEDS[k]; refreshUi(); }

function buildTop() {
    const tl = $('tools');
    Object.keys(TOOLS).forEach(k => mkBtn(tl, 'tool-' + k, TOOLS[k], TOOLS[k] + ' (' + (k === 'erase' ? 'E' : k === 'zap' ? 'Z' : k === 'heat' ? 'H' : k === 'cool' ? 'C' : k === 'wind' ? 'W' : k === 'rect' ? 'R' : k === 'line' ? 'L' : 'B') + ')', () => setTool(k)));
    const sm = $('sim');
    mkBtn(sm, 'b-pause', 'Pause', 'Pause / play (Space)', togglePause);
    mkBtn(sm, 'b-step', 'Step', 'Advance one tick while paused (.)', stepOnce);
    mkBtn(sm, 'b-speed', '1x', 'Simulation speed', cycleSpeed);
    mkBtn(sm, 'b-undo', 'Undo', 'Undo (Ctrl+Z)', doUndo);
    mkBtn(sm, 'b-clear', 'Clear', 'Clear everything', () => { pushUndo(); clearGrid(); toast('Cleared (Undo brings it back)'); });
    const ac = $('acts');
    mkBtn(ac, 'b-scenes', 'Scenes', 'Load a preset scene', showScenes);
    mkBtn(ac, 'b-chal', 'Challenges', 'Challenges', showChallenges);
    mkBtn(ac, 'b-share', 'Share', 'Share code', showShare);
    mkBtn(ac, 'b-shot', 'Photo', 'Save a PNG screenshot', () => { screenshot(); toast('Screenshot saved'); });
    mkBtn(ac, 'b-set', 'Settings', 'Settings', showSettings);
    mkBtn(ac, 'b-help', '?', 'How to play', showHelp);
    $('size-r').addEventListener('input', e => setBrush(+e.target.value));
    onToolChange = refreshUi; onUiRefresh = refreshUi;
}
function refreshUi() {
    for (const k in TOOLS) $('tool-' + k).classList.toggle('on', tool === k);
    $('b-pause').textContent = paused ? 'Play' : 'Pause'; $('b-pause').classList.toggle('on', paused);
    $('b-speed').textContent = speed + 'x';
    $('size-r').value = brushR; $('size-v').textContent = brushR;
    document.querySelectorAll('.el').forEach(b => b.classList.toggle('sel', +b.dataset.e === curEl));
    document.querySelectorAll('#cats .tb').forEach(b => b.classList.toggle('on', !searchQ && b.dataset.c === curCat));
}
function textOn(c) { return (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) > 140 ? '#14161c' : '#fff'; }
function buildPalette() {
    const cats = $('cats'); cats.innerHTML = '';
    CATS.forEach(c => { const b = mkBtn(cats, '', c, c, () => { curCat = c; searchQ = ''; $('search').value = ''; fillPalette(); refreshUi(); }); b.dataset.c = c; });
    $('search').addEventListener('input', e => { searchQ = e.target.value.trim().toLowerCase(); fillPalette(); refreshUi(); });
    fillPalette();
}
function fillPalette() {
    const box = $('els'); box.innerHTML = '';
    for (let e = 1; e < NE; e++) {
        const d = DEFS[e];
        if (searchQ ? !(d.label.toLowerCase().includes(searchQ) || d.name.includes(searchQ) || d.cat.toLowerCase().includes(searchQ)) : d.cat !== curCat) continue;
        const b = document.createElement('button');
        b.className = 'el'; b.dataset.e = e; b.textContent = d.label;
        const c = d.col;
        b.style.background = 'linear-gradient(180deg, rgb(' + Math.min(255, c[0] + 28) + ',' + Math.min(255, c[1] + 28) + ',' + Math.min(255, c[2] + 28) + '), rgb(' + c[0] + ',' + c[1] + ',' + c[2] + '))';
        b.style.color = textOn(c);
        b.title = d.label + ' (' + d.cat + ')';
        b.addEventListener('click', () => { audioUnlock(); selectElement(e); });
        box.appendChild(b);
    }
    if (!box.children.length) box.innerHTML = '<div style="grid-column:1/-1;color:var(--dim);padding:8px">No element matches.</div>';
}
function selectElement(e) {
    curEl = e;
    if (tool !== 'brush' && tool !== 'line' && tool !== 'rect') setTool('brush');
    refreshUi();
}
function updateHover() {
    const h = $('hover');
    if (!ptr.inside || !inb(ptr.gx, ptr.gy)) { h.textContent = DEFS[curEl].label + ' selected  |  ' + TOOLS[tool]; return; }
    const i = ix(ptr.gx, ptr.gy), e = el[i];
    h.textContent = (e ? DEFS[e].label : 'Empty') + '  ' + (e ? tp[i] : AMB) + ' C   (' + ptr.gx + ', ' + ptr.gy + ')  |  ' + DEFS[curEl].label + ' - ' + TOOLS[tool];
}

// ---------- dialogs ----------
function showHelp() {
    openDlg('How to play', '<p>Pick an element on the right, then click or drag on the lab to pour it. Everything reacts: fire burns wood, water cools lava into obsidian, acid eats stone, sodium explodes in water.</p>' +
        '<ul><li><b>Tools</b>: Brush, Line, Rectangle, Eraser, Heat gun, Cooler, Wind (drag to push things), Lightning (click).</li>' +
        '<li><b>Size</b>: the slider, mouse wheel, or <kbd>[</kbd> <kbd>]</kbd>.</li><li><b>Pause</b> <kbd>Space</kbd>, step <kbd>.</kbd>, undo <kbd>Ctrl+Z</kbd>.</li>' +
        '<li>Hover over anything to see what it is and how hot it is. Turn on the temperature view in Settings.</li>' +
        '<li>Electricity: touch a Battery to Metal wire; the charge runs along it and lights Lamps. Sparks light fires and set off TNT.</li>' +
        '<li>Life: Seeds grow into Plants when they touch water. Ants eat plants. Viruses spread through living things.</li>' +
        '<li>Try <b>Scenes</b> for ready made worlds, and <b>Challenges</b> for goals. <b>Share</b> turns your scene into a code you can paste to a friend.</li></ul>' +
        '<p style="color:var(--dim)">On a touch screen: tap or drag to paint.</p>');
}
function showScenes() {
    openDlg('Scenes', Object.keys(SCENES).map(k => '<button class="scn" data-s="' + k + '"><b>' + SCENES[k].label + '</b><span>' + SCENES[k].desc + '</span></button>').join(''), box => {
        box.querySelectorAll('.scn').forEach(b => b.addEventListener('click', () => { loadScene(b.dataset.s); closeDlg(); startPlay(); toast(SCENES[b.dataset.s].label + ' loaded'); }));
    });
}
function showChallenges() {
    openDlg('Challenges  ' + challengeCount() + '/' + CHALLENGES.length, CHALLENGES.map(c => '<div class="chal' + (DONE[c.id] ? ' done' : '') + '"><b>' + c.name + '</b><span>' + c.hint + '</span></div>').join(''));
}
function showShare() {
    const code = encodeScene();
    openDlg('Share a scene', '<p>Copy this code and send it to a friend. To load one, paste it below and press Load.</p><textarea id="sh-code" spellcheck="false"></textarea>' +
        '<div class="row"><button class="btn small" id="sh-copy">Copy</button><button class="btn small" id="sh-load">Load</button></div>', box => {
        const ta = box.querySelector('#sh-code'); ta.value = code;
        box.querySelector('#sh-copy').addEventListener('click', () => { ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Press Ctrl+C to copy'); } });
        box.querySelector('#sh-load').addEventListener('click', () => { if (decodeScene(ta.value)) { closeDlg(); startPlay(); toast('Scene loaded'); } else toast('That code does not look right'); });
    });
}
function changeQuality(q) {
    SETTINGS.quality = q; saveSettings();
    resizeGrid(QUAL[q].w, QUAL[q].h); initRender(); wakeAll();
}
function showSettings() {
    const opt = (k, name, sub) => '<div class="opt"><div>' + name + '<span>' + sub + '</span></div><input type="checkbox" data-k="' + k + '"' + (SETTINGS[k] ? ' checked' : '') + '></div>';
    openDlg('Settings', '<div class="opt"><div>Quality<span>Grid size. Lower is faster on slow computers.</span></div><div class="grp" id="q-btns"></div></div>' +
        opt('sound', 'Sound', 'Sizzle, boom and splash') + opt('overlay', 'Temperature view', 'Colour every cell by how hot it is') +
        opt('glow', 'Glow', 'Light from fire, lava and electricity') + opt('fx', 'Effects', 'Explosion flashes and screen shake') +
        opt('replace', 'Brush replaces', 'Paint over existing cells instead of only empty space'), box => {
        const qb = box.querySelector('#q-btns');
        QUAL.forEach((q, k) => { const b = document.createElement('button'); b.className = 'tb' + (SETTINGS.quality === k ? ' on' : ''); b.textContent = q.n + ' ' + q.w + 'x' + q.h;
            b.addEventListener('click', () => { changeQuality(k); qb.querySelectorAll('.tb').forEach((x, n) => x.classList.toggle('on', n === k)); }); qb.appendChild(b); });
        box.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('change', () => { SETTINGS[inp.dataset.k] = inp.checked; saveSettings(); if (inp.dataset.k === 'sound' && inp.checked) { audioUnlock(); sfx('pop'); } }));
    });
}

// ---------- title screen ----------
function startPlay() { $('title').classList.add('hidden'); audioUnlock(); layoutStage(); if (!SETTINGS.seenHelp) { SETTINGS.seenHelp = true; saveSettings(); toast('Pick an element and drag on the lab. Press ? for help.'); } }
function initTitle() {
    const bg = $('tbg');
    for (let k = 0; k < 26; k++) { const i = document.createElement('i'); i.style.left = (rnd() * 100) + '%'; i.style.animationDelay = (rnd() * 4) + 's'; i.style.animationDuration = (3 + rnd() * 3) + 's'; i.style.background = ['#ff9d3c', '#ffd36b', '#7ec8ff', '#9cff7e'][k & 3]; bg.appendChild(i); }
    $('t-play').addEventListener('click', startPlay);
    $('t-scenes').addEventListener('click', showScenes);
    $('t-chal').addEventListener('click', showChallenges);
    $('t-how').addEventListener('click', showHelp);
    $('t-set').addEventListener('click', showSettings);
    const sv = LS.get('elementlab_autosave', null);
    if (sv && sv.code) $('t-cont').addEventListener('click', () => { if (decodeScene(sv.code)) { startPlay(); toast('Welcome back'); } });
    else $('t-cont').classList.add('hidden');
    $('dlg-x').addEventListener('click', closeDlg);
    $('dlg').addEventListener('pointerdown', e => { if (e.target === $('dlg')) closeDlg(); });
}
