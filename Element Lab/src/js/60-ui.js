// ==========================================
// ELEMENT LAB - interface: lab bench palette, toolbar, inspector readout, dialogs, title screen
// ==========================================
let searchQ = '';
const SPEEDS = [0.25, 0.5, 1, 2, 4];
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
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// small line icons (24x24 viewBox)
const ICON = {
    brush: '<path d="M4 20c3 0 5-2 5-5l9-9a2 2 0 0 0-3-3l-9 9c-3 0-5 2-5 5"/>', line: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="5" r="1.5"/>',
    rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>', erase: '<path d="M8 20h12M5 15l8-8 6 6-5 5H9z"/>', heat: '<path d="M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
    cool: '<path d="M12 2v20M4 7l16 10M4 17l16-10"/>', wind: '<path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>', zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    use: '<path d="M8 13V5a2 2 0 0 1 4 0v6M12 11V4a2 2 0 0 1 4 0v8M16 12V7a2 2 0 0 1 4 0v7c0 4-3 7-7 7s-6-2-8-5l-2-4a2 2 0 0 1 3-2l2 3"/>',
    pick: '<path d="M14 4l6 6M17 7l-9 9-4 1 1-4 9-9"/>', play: '<path d="M7 5l12 7-12 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', step: '<path d="M6 5l9 7-9 7zM18 5v14"/>',
    undo: '<path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10"/>', clear: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', circle: '<circle cx="12" cy="12" r="7"/>',
    square: '<rect x="5" y="5" width="14" height="14"/>', spray: '<circle cx="7" cy="8" r="1"/><circle cx="14" cy="6" r="1"/><circle cx="17" cy="13" r="1"/><circle cx="10" cy="14" r="1"/><circle cx="6" cy="18" r="1"/><circle cx="15" cy="19" r="1"/>',
    a0: '<path d="M4 12h16M14 6l6 6-6 6"/>', a1: '<path d="M20 12H4M10 6l-6 6 6 6"/>', a2: '<path d="M12 4v16M6 14l6 6 6-6"/>', a3: '<path d="M12 20V4M6 10l6-6 6 6"/>'
};
const svg = k => '<svg viewBox="0 0 24 24">' + ICON[k] + '</svg>';
function mkBtn(parent, id, label, title, fn, cls, icon) {
    const b = document.createElement('button');
    b.className = 'tb' + (cls ? ' ' + cls : ''); if (id) b.id = id; b.title = title || label;
    b.innerHTML = (icon ? svg(icon) : '') + (label ? '<span class="lbl">' + esc(label) + '</span>' : '');
    b.addEventListener('click', () => { audioUnlock(); fn(); });
    parent.appendChild(b); return b;
}
function stepOnce() { if (paused) { step(); } }
function cycleSpeed() { const k = (SPEEDS.indexOf(speed) + 1) % SPEEDS.length; speed = SPEEDS[k]; refreshUi(); }
function setView(v) { SETTINGS.view = v; saveSettings(); refreshUi(); toast(v === 'normal' ? 'Normal view' : v === 'heat' ? 'Temperature view' : v === 'pressure' ? 'Pressure view: gas pressure from blue (low) to red (high)' : 'Charge view: powered conductors glow'); }
function setFacing(d) { SETTINGS.dir = d; saveSettings(); refreshUi(); }
function setShape(s) { SETTINGS.shape = s; saveSettings(); refreshUi(); placeCursor(); }

function buildTop() {
    const tl = $('tools');
    Object.keys(TOOLS).forEach(k => mkBtn(tl, 'tool-' + k, ['brush', 'erase', 'use'].includes(k) ? TOOLS[k] : '', TOOLS[k] + ' (' + TOOL_KEYS[k] + ')', () => setTool(k), 'ic', k));
    ['circle', 'square', 'spray'].forEach(s => mkBtn($('shapes'), 'shape-' + s, '', 'Brush: ' + s, () => setShape(s), 'ic', s));
    [0, 3, 2, 1].forEach(d => mkBtn($('facing'), 'dir-' + d, '', 'New machines face ' + DIRN[d] + ' (F)', () => setFacing(d), 'ic hot', 'a' + d));
    const sm = $('sim');
    mkBtn(sm, 'b-pause', '', 'Pause / play (Space)', togglePause, 'ic', 'pause');
    mkBtn(sm, 'b-step', '', 'One tick while paused (.)', stepOnce, 'ic', 'step');
    mkBtn(sm, 'b-speed', '1x', 'Simulation speed', cycleSpeed);
    mkBtn(sm, 'b-undo', '', 'Undo (Ctrl+Z)', doUndo, 'ic', 'undo');
    mkBtn(sm, 'b-clear', '', 'Clear everything', () => { pushUndo(); clearGrid(); toast('Cleared (Undo brings it back)'); }, 'ic', 'clear');
    const vw = $('views');
    [['normal', 'Look'], ['heat', 'Heat'], ['pressure', 'Press'], ['charge', 'Charge']].forEach(([v, l]) => mkBtn(vw, 'view-' + v, l, 'View: ' + v + ' (V)', () => setView(v)));
    const ac = $('acts');
    mkBtn(ac, 'b-scenes', 'Scenes', 'Example scenes', showScenes);
    mkBtn(ac, 'b-save', 'Save', 'Save and load slots', showSaves);
    mkBtn(ac, 'b-share', 'Share', 'Share code', showShare);
    mkBtn(ac, 'b-chal', 'Goals', 'Challenges', showChallenges);
    mkBtn(ac, 'b-help', 'Guide', 'Lab guide: electricity and the reactor', showHelp);
    mkBtn(ac, 'b-set', 'Settings', 'Settings', showSettings);
    $('size-r').addEventListener('input', e => setBrush(+e.target.value));
    onToolChange = refreshUi; onUiRefresh = refreshUi;
    $('ver').textContent = 'v' + VERSION + ' - lab bench';
    $('t-ver').textContent = VERSION;
    document.querySelector('#title .tag').textContent = 'Build reactors, circuits and cities. ' + (NE - 1 - HIDE.reduce((a, b) => a + b, 0)) + ' elements, ' + REACTIONS.length + ' reactions.';
}
function refreshUi() {
    for (const k in TOOLS) $('tool-' + k).classList.toggle('on', tool === k);
    ['circle', 'square', 'spray'].forEach(s => $('shape-' + s).classList.toggle('on', SETTINGS.shape === s));
    [0, 1, 2, 3].forEach(d => $('dir-' + d).classList.toggle('on', (SETTINGS.dir & 3) === d));
    VIEWS.forEach(v => $('view-' + v).classList.toggle('on', SETTINGS.view === v));
    $('b-pause').innerHTML = svg(paused ? 'play' : 'pause'); $('b-pause').classList.toggle('on', paused);
    $('b-speed').innerHTML = '<span class="lbl">' + speed + 'x</span>';
    $('size-r').value = brushR; $('size-v').textContent = brushR;
    document.querySelectorAll('.chip').forEach(b => b.classList.toggle('sel', +b.dataset.e === curEl));
}

// ---------- the palette: collapsible categories of element chips, with search ----------
const CAT_COL = { Land: '#d8b46a', Liquids: '#3f8cff', Gases: '#c9d6ea', Building: '#9aa3b5', Metals: '#c0c8d8', Chemicals: '#9dff6a', Food: '#ffb347', Energy: '#ff7a2f',
    Electric: '#3ff0ff', Machines: '#7fd1e0', Nuclear: '#7dff4f', Explosives: '#ff4f4f', Life: '#52d66a', Special: '#ff4fd8' };
function catOpen() { if (!Array.isArray(SETTINGS.open)) SETTINGS.open = ['Land', 'Liquids', 'Electric']; return SETTINGS.open; }
function buildPalette() {
    $('search').addEventListener('input', e => { searchQ = e.target.value.trim().toLowerCase(); fillPalette(); refreshUi(); });
    $('search').addEventListener('keydown', e => { if (e.key === 'Enter') { const c = document.querySelector('.chip'); if (c) { selectElement(+c.dataset.e); e.target.blur(); } } });
    fillPalette();
}
function fillPalette() {
    const box = $('palette'); box.innerHTML = '';
    let total = 0;
    const open = catOpen();
    CATS.forEach(cat => {
        const list = [];
        for (let e = 1; e < NE; e++) {
            const d = DEFS[e];
            if (d.cat !== cat || HIDE[e]) continue;
            if (searchQ && !(d.label.toLowerCase().includes(searchQ) || d.name.includes(searchQ) || cat.toLowerCase().includes(searchQ))) continue;
            list.push(e);
        }
        if (!list.length) return;
        total += list.length;
        const det = document.createElement('details');
        det.className = 'cat'; det.open = !!searchQ || open.includes(cat);
        det.innerHTML = '<summary><span class="cdot" style="color:' + CAT_COL[cat] + ';background:' + CAT_COL[cat] + '"></span>' + cat + '<span class="n">' + list.length + '</span></summary>';
        const chips = document.createElement('div'); chips.className = 'chips';
        list.forEach(e => {
            const b = document.createElement('button');
            b.className = 'chip'; b.dataset.e = e; b.title = DEFS[e].label + (DEFS[e].desc ? ' - ' + DEFS[e].desc : '');
            b.innerHTML = '<i style="background:' + cssCol(e) + '"></i><span>' + esc(DEFS[e].label) + '</span>';
            b.addEventListener('click', () => { audioUnlock(); selectElement(e); });
            chips.appendChild(b);
        });
        det.appendChild(chips);
        det.addEventListener('toggle', () => {
            if (searchQ) return;
            const o = catOpen(), k = o.indexOf(cat);
            if (det.open && k < 0) o.push(cat); else if (!det.open && k >= 0) o.splice(k, 1);
            saveSettings();
        });
        box.appendChild(det);
    });
    if (!total) box.innerHTML = '<div style="color:var(--dim);padding:10px">No element matches.</div>';
    $('search-n').textContent = searchQ ? total : '';
    $('search').placeholder = 'Search ' + (NE - 1 - HIDE.reduce((a, b) => a + b, 0)) + ' elements...';
}
function selectElement(e) {
    curEl = e;
    if (tool !== 'brush' && tool !== 'line' && tool !== 'rect') setTool('brush');
    const d = DEFS[e];
    const facts = [];
    if (d.kind === K.SOLID) facts.push('solid'); else if (d.kind === K.POWDER) facts.push('powder'); else if (d.kind === K.LIQUID) facts.push('liquid'); else if (d.kind === K.GAS) facts.push('gas'); else facts.push('creature');
    if (HI[e] < 32767) facts.push('above ' + HI[e] + ' C: ' + DEFS[HIE[e]].label);
    if (LO[e] > -32768) facts.push('below ' + LO[e] + ' C: ' + DEFS[LOE[e]].label);
    if (IGN[e]) facts.push('burns at ' + IGN[e] + ' C');
    if (ELC[e] === E_C) facts.push('conducts');
    $('selinfo').innerHTML = '<span class="sw" style="background:' + cssCol(e) + ';color:' + cssCol(e) + '"></span><b>' + esc(d.label) + '</b> <span>' + esc(d.cat) + '</span><br>' +
        esc(d.desc || facts.join(', ')) + (d.desc ? '<br>' + esc(facts.join(', ')) : '');
    refreshUi();
}
function updateHover() {
    if (!ptr.inside || !inb(ptr.gx, ptr.gy)) {
        $('ro-name').textContent = DEFS[curEl].label; $('ro-sw').style.background = cssCol(curEl);
        $('ro-t').textContent = '-'; $('ro-c').textContent = '-'; $('ro-p').textContent = '-'; $('ro-x').textContent = TOOLS[tool] + ' - ' + DEFS[curEl].label;
        return;
    }
    const i = ix(ptr.gx, ptr.gy), e = el[i];
    $('ro-name').textContent = e ? DEFS[e].label : 'Air'; $('ro-sw').style.background = e ? cssCol(e) : '#0b1020';
    $('ro-t').textContent = (e ? tp[i] : AMB) + ' C';
    const c = ELC[e];
    $('ro-c').textContent = c === 0 ? 'none' : c >= E_GATE && c !== E_SWITCH ? (life[i] ? 'ON' : 'off') : pw[i] ? 'LIVE' : 'off';
    $('ro-p').textContent = KIND[e] === K.GAS ? String(pr[i]) : '-';
    let x = '(' + ptr.gx + ', ' + ptr.gy + ')';
    if (e === ID.human) x += '  health ' + life[i] + ((aux[i] >> 1) & 127 ? '  PANIC' : '') + ((aux[i] >> 8) ? '  carrying ' + DEFS[(aux[i] >> 8) - 1].label : '');
    else if ((e === ID.clone || e === ID.spout) && aux[i]) x += '  copies ' + DEFS[aux[i]].label;
    else if (isPipe(e) && (aux[i] & 1023)) x += '  holds ' + DEFS[aux[i] & 1023].label;
    else if (e === ID.turbine) x += '  spin ' + aux[i];
    else if (e === ID['switch']) x += aux[i] & 1 ? '  on' : '  off (Hand tool flips it)';
    if (DIRL[e]) x += '  faces ' + DIRN[life[i] & 3];
    $('ro-x').textContent = x;
}

// ---------- dialogs ----------
function showHelp() {
    openDlg('Lab guide', '<p>Pick an element on the lab bench (search or open a category), then drag on the lab. Hover anything to read its temperature, charge and pressure below the lab.</p>' +
        '<h3>Tools</h3><ul><li><b>Brush / Line / Box / Erase</b>: brush shape (round, square, spray) and size are next to the tools. Mouse wheel or <kbd>[</kbd> <kbd>]</kbd> sizes it.</li>' +
        '<li><b>Heat / Chill</b> warm or cool what you touch. <b>Wind</b>: drag to push things. <b>Zap</b>: lightning.</li>' +
        '<li><b>Hand</b> <kbd>U</kbd>: flips switches and turns machines. <b>Pick</b> <kbd>I</kbd>: copy an element off the lab.</li>' +
        '<li>Views <kbd>V</kbd>: Look, Heat, Pressure (gas) and Charge (live wires). <kbd>Space</kbd> pause, <kbd>.</kbd> step, <kbd>Ctrl+Z</kbd> undo.</li></ul>' +
        '<h3>Electricity</h3><ul><li>Power comes from a <b>Battery</b>, a <b>Solar Panel</b> in the open, a spinning <b>Turbine</b>, a <b>Spark</b>, or a sensor that is triggered.</li>' +
        '<li>It runs instantly through anything that conducts: <b>Wire</b>, metals, graphite, mercury, salt water, and through devices. Everything else insulates (use <b>Rubber</b>).</li>' +
        '<li>Devices work while powered: Light Bulb, LEDs, E-Heater, E-Cooler, Fan, Pump, Conveyor, Piston, Drill, Laser, Spark Plug, Tesla Coil, Valve.</li>' +
        '<li>Machines face the arrow chosen in the toolbar (<kbd>F</kbd> turns it). The Hand turns a placed machine.</li>' +
        '<li><b>Logic gates</b>: inputs touch the gate on the <b>left, right or top</b>; the output is the wire <b>below</b>. AND = all inputs on, OR = any, NOT = none, XOR = exactly one.</li>' +
        '<li><b>Switch</b>: flip it with the Hand. <b>Detector</b>: on when something touches it. <b>Heat Sensor</b>: on at 100 C. <b>Pressure Sensor</b>: on when gas is squeezed.</li>' +
        '<li>Live wires shock people, set off explosives, light flammable gas and make neon glow.</li></ul>' +
        '<h3>The reactor</h3><ul><li><b>Uranium</b> gives off a few neutrons. <b>Water</b>, heavy water or graphite slow them down; a slow neutron that hits uranium splits it: heat plus 2-3 new neutrons. That is the chain reaction.</li>' +
        '<li><b>Control Rods</b> soak up neutrons. Pull rods out (Erase) and it runs hotter; put more in and it cools. Lead and concrete shield.</li>' +
        '<li>The hot fuel boils the water into <b>steam</b>. Steam rising through a <b>Turbine</b> spins it, and a spinning turbine powers any wire it touches: run wire to your bulbs.</li>' +
        '<li>Keep the water topped up with a <b>Spout</b> (it copies the water touching it). Steam condenses back to water when it cools.</li>' +
        '<li>Boiling the water away means no moderator, so a water reactor slows down by itself. A <b>graphite</b> core has no such brake: without rods or cooling, fuel passes 1800 C and melts into <b>Corium</b> (lava-hot, radioactive, explodes in water). Split fuel keeps giving off decay heat for a while after.</li></ul>' +
        '<h3>Plumbing</h3><ul><li><b>Pipe</b>: an open end sucks in liquid or gas, which flows along and out the far end. <b>Pump</b> pushes into a pipe; <b>Valve</b> only opens when powered. <b>Drain</b> swallows fluids, <b>Mesh</b> lets fluids through.</li></ul>' +
        '<p class="note">Element Lab ' + VERSION + ' - ' + (NE - 1) + ' elements, ' + REACTIONS.length + ' reactions.</p>');
}
function showScenes() {
    openDlg('Example scenes', Object.keys(SCENES).map(k => '<button class="scn" data-s="' + k + '"><b>' + SCENES[k].label + '</b><span>' + SCENES[k].desc + '</span></button>').join(''), box => {
        box.querySelectorAll('.scn').forEach(b => b.addEventListener('click', () => { loadScene(b.dataset.s); closeDlg(); startPlay(); toast(SCENES[b.dataset.s].label + ' loaded'); }));
    });
}
function showChallenges() {
    openDlg('Challenges  ' + challengeCount() + '/' + CHALLENGES.length, CHALLENGES.map(c => '<div class="chal' + (DONE[c.id] ? ' done' : '') + '"><b>' + c.name + '</b><span>' + c.hint + '</span></div>').join(''));
}
function showShare() {
    const code = encodeScene();
    openDlg('Share a machine', '<p>Copy this code and send it to a friend. To load one, paste it below and press Load. Codes from Element Lab 1 still work.</p><textarea id="sh-code" spellcheck="false"></textarea>' +
        '<div class="row"><span class="note" style="margin-right:auto">' + code.length + ' characters</span><button class="btn small" id="sh-copy">Copy</button><button class="btn small" id="sh-load">Load</button></div>', box => {
        const ta = box.querySelector('#sh-code'); ta.value = code;
        box.querySelector('#sh-copy').addEventListener('click', () => { ta.select(); try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Press Ctrl+C to copy'); } });
        box.querySelector('#sh-load').addEventListener('click', () => { if (decodeScene(ta.value)) { closeDlg(); startPlay(); toast('Scene loaded'); } else toast('That code does not look right'); });
    });
}
function showSaves() {
    const draw = box => {
        const slots = loadSlots();
        box.querySelector('#slots').innerHTML = slots.map((s, k) => '<div class="slot"><div><b>Slot ' + (k + 1) + (s ? ': ' + esc(s.name) : '') + '</b><span>' + (s ? new Date(s.t).toLocaleString() + ' - ' + Math.round(s.code.length / 1024 * 10) / 10 + ' KB' : 'Empty') + '</span></div>' +
            '<button class="btn small" data-a="save" data-k="' + k + '">Save</button>' + (s ? '<button class="btn small" data-a="load" data-k="' + k + '">Load</button><button class="btn small" data-a="del" data-k="' + k + '">X</button>' : '') + '</div>').join('');
        box.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', () => {
            const k = +b.dataset.k, a = b.dataset.a;
            if (a === 'save') { const nmv = (box.querySelector('#slot-name').value || '').trim() || 'Lab ' + new Date().toLocaleDateString(); if (saveSlot(k, nmv)) toast('Saved to slot ' + (k + 1)); else toast('Could not save (storage full?)'); draw(box); }
            else if (a === 'load') { if (loadSlot(k)) { closeDlg(); startPlay(); toast('Loaded slot ' + (k + 1)); } else toast('That slot could not be read'); }
            else if (a === 'del') { deleteSlot(k); draw(box); }
        }));
    };
    openDlg('Save slots', '<p>Saves stay in this browser. Use Share to move a machine to another computer.</p><input id="slot-name" placeholder="Name for the save" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--line2);background:#070b16;color:var(--txt);font:inherit;user-select:text"><div id="slots"></div>', draw);
}
function changeQuality(q) {
    SETTINGS.quality = q; saveSettings();
    resizeGrid(QUAL[q].w, QUAL[q].h); initRender(); wakeAll();
}
function showSettings() {
    const opt = (k, name, sub) => '<div class="opt"><div>' + name + '<span>' + sub + '</span></div><input type="checkbox" data-k="' + k + '"' + (SETTINGS[k] ? ' checked' : '') + '></div>';
    openDlg('Settings', '<div class="opt"><div>Canvas resolution<span>Grid size. Lower is faster on slow computers.</span></div><div class="grp" id="q-btns"></div></div>' +
        '<div class="opt"><div>Particle effects<span>One click for all of glow, bloom, shimmer and blast effects.</span></div><div class="grp" id="fx-btns"></div></div>' +
        opt('glow', 'Glow', 'Light from fire, lava, live wires and bulbs') + opt('bloom', 'Bloom', 'A soft halo around bright lights') +
        opt('noise', 'Shimmer', 'Subtle colour noise on liquids and powders') + opt('fx', 'Blast effects', 'Explosion flashes, arcs and screen shake') +
        opt('sound', 'Sound', 'Sizzle, boom and zap') + opt('replace', 'Brush replaces', 'Paint over existing cells instead of only empty space'), box => {
        const qb = box.querySelector('#q-btns');
        QUAL.forEach((q, k) => { const b = document.createElement('button'); b.className = 'tb' + (SETTINGS.quality === k ? ' on' : ''); b.textContent = q.n + ' ' + q.w + 'x' + q.h;
            b.addEventListener('click', () => { changeQuality(k); qb.querySelectorAll('.tb').forEach((x, n) => x.classList.toggle('on', n === k)); }); qb.appendChild(b); });
        const fb = box.querySelector('#fx-btns');
        [['Low', false], ['High', true]].forEach(([n, v]) => { const b = document.createElement('button'); b.className = 'tb'; b.textContent = n;
            b.addEventListener('click', () => { ['glow', 'bloom', 'noise', 'fx'].forEach(k => { SETTINGS[k] = v; const c = box.querySelector('input[data-k="' + k + '"]'); if (c) c.checked = v; }); saveSettings(); }); fb.appendChild(b); });
        box.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('change', () => { SETTINGS[inp.dataset.k] = inp.checked; saveSettings(); if (inp.dataset.k === 'sound' && inp.checked) { audioUnlock(); sfx('pop'); } }));
    });
}

// ---------- title screen ----------
function startPlay() { $('title').classList.add('hidden'); audioUnlock(); layoutStage(); if (!SETTINGS.seenHelp) { SETTINGS.seenHelp = true; saveSettings(); toast('Pick an element on the bench and drag on the lab. Guide explains circuits and the reactor.'); } }
function initTitle() {
    const bg = $('tbg');
    for (let k = 0; k < 30; k++) { const i = document.createElement('i'); i.style.left = (rnd() * 100) + '%'; i.style.animationDelay = (rnd() * 5) + 's'; i.style.animationDuration = (3.5 + rnd() * 3) + 's'; const c = ['#3ff0ff', '#ff4fd8', '#9dff6a', '#b8a6ff'][k & 3]; i.style.background = c; i.style.color = c; bg.appendChild(i); }
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
