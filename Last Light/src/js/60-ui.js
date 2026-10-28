// ==========================================
// MENUS: title (a living scene behind it), world map, pause, results, settings, how to play, touch buttons
// ==========================================
const UI = {
    cur: 'title',
    show(id) {
        for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
        this.cur = id;
        if (id) $('s-' + id) ? $('s-' + id).classList.remove('hidden') : 0;
        const focus = id && $('s-' + id) && $('s-' + id).querySelector('.btn.big, .lvl:not([disabled]), .btn');
        if (focus) setTimeout(() => focus.focus({ preventScroll: true }), 30);
    },
    banner(a, b, c) {
        const el = $('#banner'); el.querySelector('.b1').textContent = a; el.querySelector('.b2').textContent = b;
        let sub = el.querySelector('.b3'); if (!sub) { sub = document.createElement('div'); sub.className = 'b1 b3'; sub.style.marginTop = '8px'; sub.style.letterSpacing = '.08em'; sub.style.textTransform = 'none'; sub.style.fontSize = '18px'; el.appendChild(sub); }
        sub.textContent = c || '';
        el.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => el.classList.remove('on'), c ? 3600 : 2200);
    },
    unlocked(i) {
        if (i === 0) return true;
        const prev = LEVELS[i - 1]; return !!SAVE.d.levels[prev.id];
    },
    map() {
        G.state = 'map'; $('#hud').classList.add('hidden'); Sound.musicFor(0);
        const box = $('#worlds'); box.innerHTML = '';
        let moths = 0, mothsOf = 0;
        WORLDS.forEach((W, wi) => {
            const lv = LEVELS.map((l, i) => ({ l, i })).filter(o => o.l.world === wi); if (!lv.length) return;
            const card = document.createElement('div'); card.className = 'world' + (this.unlocked(lv[0].i) ? '' : ' locked');
            const art = document.createElement('div'); art.className = 'wart'; const cv = document.createElement('canvas'); cv.width = 600; cv.height = 240; art.appendChild(cv);
            const layers = paintBackground(wi, 600, 240), cx = cv.getContext('2d'); layers.forEach(l => cx.drawImage(l.c, 0, l.fixed ? 0 : 20 * (1 - l.k)));
            const done = lv.filter(o => SAVE.d.levels[o.l.id]).length;
            art.insertAdjacentHTML('beforeend', `<div class="wname">${W.name}</div><div class="wsub">${done}/${lv.length}</div>`);
            card.appendChild(art);
            const list = document.createElement('div'); list.className = 'lvls';
            lv.forEach(({ l, i }) => {
                const rec = SAVE.d.levels[l.id], b = document.createElement('button'); b.className = 'lvl' + (l.world === 4 ? ' boss' : ''); b.disabled = !this.unlocked(i);
                const m = (rec && rec.moths) || [false, false, false], n = l.map.join('').split('*').length - 1;
                moths += m.filter(Boolean).length; mothsOf += n;
                b.innerHTML = `<span class="num">${l.world === 4 ? '☠' : l.id.split('-')[1]}</span><span class="nm">${l.name}<small>${rec && rec.best != null ? 'Best ' + fmtTime(rec.best) : b.disabled ? 'Locked' : 'New'}</small></span>`
                    + (n ? `<span class="moths">${m.slice(0, n).map(x => `<span class="${x ? 'moth-on' : 'moth-off'}">✦</span>`).join('')}</span>` : '');
                b.onclick = () => { Sound.play('click'); fadeTo(() => G.start(i)); };
                list.appendChild(b);
            });
            card.appendChild(list); box.appendChild(card);
        });
        $('#m-total').innerHTML = `<span class="moth-on">✦</span> ${moths}/${mothsOf}`;
        this.show('map');
    },
    pause() {
        if (G.state !== 'play' || G.done) return;
        G.state = 'paused'; Input.clear();
        const rec = SAVE.d.levels[G.L.def.id];
        $('#p-info').innerHTML = `<div class="drow"><span>${G.L.def.id} · ${G.L.def.name}</span><b>${fmtTime(G.time)}</b></div>` + (rec && rec.best != null ? `<div class="drow"><span>Best</span><b>${fmtTime(rec.best)}</b></div>` : '')
            + `<div class="drow"><span>Falls this run</span><b>${G.stats.deaths}</b></div><div class="drow"><span>Sparks</span><b>${G.got.sparks} / ${G.L.sparks}</b></div>`;
        this.show('pause');
    },
    resume() { if (G.state !== 'paused') return; G.state = 'play'; this.show(null); Input.clear(); },
    results(r) {
        const rows = [
            ['Time', fmtTime(r.time) + (r.best ? '<span class="new">NEW BEST</span>' : '')],
            ['Sparks', r.sparks + ' / ' + r.sparksOf],
            ['Star moths', r.moths.slice(0, LEVELS[G.idx].map.join('').split('*').length - 1).map(m => `<span class="${m ? 'moth-on' : 'moth-off'}">✦</span>`).join(' ') + (r.mothsNew > 0 ? '<span class="new">+' + r.mothsNew + ' NEW</span>' : '')],
            ['Hits taken', r.hits ? r.hits : 'none<span class="new">FLAWLESS</span>'],
            ['Enemies defeated', r.kills],
            ['Falls', r.deaths]
        ];
        $('#d-title').textContent = r.def.world === 4 ? 'You relit the world!' : 'Level complete!';
        $('#d-rows').innerHTML = rows.map(([a, b]) => `<div class="drow"><span>${a}</span><b>${b}</b></div>`).join('');
        const next = LEVELS[G.idx + 1];
        $('#d-unlock').textContent = r.def.gives && SAVE.d.abilities[r.def.gives] && r.rec.clears === 1 ? 'New world unlocked: ' + (next ? WORLDS[next.world].name : '') : (next && next.world !== r.def.world && r.rec.clears === 1 ? 'New world unlocked: ' + WORLDS[next.world].name : '');
        $('#d-next').classList.toggle('hidden', !next);
        $('#d-next').textContent = next ? 'Next: ' + next.name : 'Next';
        $('#hud').classList.add('hidden');
        this.show('done');
    },
    settings(back) {
        this._back = back;
        const rows = [
            ['Music', 'music', [[0, 'Off'], [0.3, 'Low'], [0.6, 'Mid'], [1, 'High']]],
            ['Sound effects', 'sfx', [[0, 'Off'], [0.4, 'Low'], [0.8, 'Mid'], [1, 'High']]],
            ['Graphics', 'quality', [['auto', 'Auto'], ['low', 'Fast'], ['high', 'Sharp']], 'Fast draws fewer pixels; Auto picks for you'],
            ['Screen shake', 'shake', [[true, 'On'], [false, 'Off']]],
            ['Hearts', 'hard', [[false, '3 hearts'], [true, 'One-hit (hard)']]],
            ['Touch buttons', 'touch', [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']]]
        ];
        $('#set-rows').innerHTML = rows.map(([label, k, opts, sub]) => `<div class="setrow"><span>${label}${sub ? '<small>' + sub + '</small>' : ''}</span><div class="seg">${opts.map(([v, n]) => `<button data-k="${k}" data-v='${JSON.stringify(v)}' class="${settings[k] === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>`).join('');
        for (const b of $('#set-rows').querySelectorAll('button')) b.onclick = () => {
            settings[b.dataset.k] = JSON.parse(b.dataset.v); saveSettings(); Sound.volumes(); Sound.play('click');
            if (b.dataset.k === 'quality') applyQuality();
            if (b.dataset.k === 'touch') touchControls();
            if (b.dataset.k === 'hard' && G.p) { G.p.hearts = Math.min(G.p.hearts, G.maxHearts()); G.hud(); }
            this.settings(back);
        };
        this.show('settings');
    }
};
// the light went out: what got you, how it is going, and straight back in with one key
const CAUSE = { pit: 'You fell into the dark.', spike: 'Spikes.', lava: 'The lava took you.', slime: 'A slime got you.', bat: 'A bat got you.',
    thorn: 'A thornback. Never land on those spines.', turret: 'A flower turret hit you.', boss: 'The Gloom caught you.' };
const TIPS = ['Lanterns are checkpoints: light every one you pass.', 'Hold jump longer to jump higher.', 'You can still jump a moment after running off a ledge.',
    'Stomp slimes, bats and turrets from above. Never thornbacks.', 'A dash goes straight through enemies.', 'Press R to go back to the last lantern.',
    'Crumbling blocks fall soon after you touch them: keep moving.', 'Turret shots fly straight: jump over them or dash through.', 'Hearts refill at every lantern.',
    'Hold down to drop through a thin ledge.'];
UI.died = function () {
    G.state = 'dead'; Input.clear(); $('#banner').classList.remove('on'); $('#hud').classList.add('hidden'); $('#touch').classList.add('hidden');
    $('#dd-cause').textContent = CAUSE[G.cause] || 'The light went out.';
    const rec = SAVE.d.levels[G.L.def.id];
    $('#dd-rows').innerHTML = `<div><b>${G.stats.deaths}</b><span>this run</span></div><div><b>${SAVE.d.deaths}</b><span>all time</span></div><div><b>${fmtTime(G.time)}</b><span>time</span></div>` + (rec && rec.best != null ? `<div><b>${fmtTime(rec.best)}</b><span>best</span></div>` : '');
    $('#dd-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    SAVE.write(); this.show('dead');
};
UI.retry = function () { if (G.state !== 'dead') return; respawn(G); G.state = 'play'; this.show(null); $('#hud').classList.remove('hidden'); touchControls(); Input.clear(); };
UI.stats = function () {
    const S = SAVE.d.stats, n = k => Math.round(S[k] || 0), lv = SAVE.d.levels;
    const moths = Object.keys(lv).reduce((t, k) => t + (lv[k].moths || []).filter(Boolean).length, 0), allMoths = LEVELS.reduce((t, l) => t + l.map.join('').split('*').length - 1, 0);
    const done = LEVELS.filter(l => lv[l.id] && lv[l.id].best != null), total = done.length === LEVELS.length ? done.reduce((t, l) => t + lv[l.id].best, 0) : null;
    const pt = SAVE.d.playTime || 0, tp = pt >= 3600 ? Math.floor(pt / 3600) + 'h ' + Math.floor(pt % 3600 / 60) + 'm' : Math.floor(pt / 60) + 'm ' + Math.floor(pt % 60) + 's';
    const enemy = n('death_enemy');
    const rows = [['sec', 'Progress'], ['Time played', tp], ['Levels cleared', done.length + ' / ' + LEVELS.length], ['Star moths', moths + ' / ' + allMoths], ['Sparks collected', SAVE.d.sparks],
        ['Flawless clears', n('flawless')], ['Bosses beaten', n('bossKills')], ['All best times', total == null ? 'clear every level' : fmtTime(total)],
        ['sec', 'Falls'], ['Total', SAVE.d.deaths], ['Into pits', n('death_pit')], ['On spikes', n('death_spike')], ['In lava', n('death_lava')], ['To enemies', enemy], ['Hits taken', n('hits')],
        ['sec', 'Moves'], ['Jumps', n('jumps')], ['Double jumps', n('djumps')], ['Wall jumps', n('walljumps')], ['Dashes', n('dashes')], ['Enemies defeated', n('kills')], ['Lanterns lit', n('lanterns')],
        ['Distance', n('dist').toLocaleString() + ' tiles']];
    $('#st-rows').innerHTML = rows.map(([a, b]) => a === 'sec' ? `<div class="sec">${b}</div>` : `<div class="drow"><span>${a}</span><b>${b}</b></div>`).join('');
    this.show('stats');
};
function fadeTo(fn) { const f = $('#fade'); f.classList.add('on'); setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 330); }

// title scene: the first world's sky, the wisp floating over a hill of lanterns
function renderTitle(t) {
    const x = R.x, W = R.W, H = R.H;
    const key = 'title:' + W + 'x' + H;
    if (R.bgFor !== key) { R.bg = paintBackground(0, Math.round(W * 1.5), H); R.bgFor = key; }
    x.setTransform(1, 0, 0, 1, 0, 0);
    // sky and the two far ridges only: the near trees would bury the hill
    R.bg.slice(0, 3).forEach((l, i) => { if (l.fixed) { x.drawImage(l.c, 0, 0); return; } const bw = l.c.width, off = ((t * 14 * l.k * 3) % bw + bw) % bw, oy = H * 0.12 * i; x.drawImage(l.c, -off, oy); x.drawImage(l.c, bw - off, oy); });
    const s = Math.min(W / 900, H / 520);
    // a soft hill along the bottom with a grass rim
    x.setTransform(1, 0, 0, 1, 0, 0);
    const hy = H * 0.86;
    const hill = (dy, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(-10, H); x.lineTo(-10, hy + dy + 60 * s); x.quadraticCurveTo(W / 2, hy + dy - 70 * s, W + 10, hy + dy + 60 * s); x.lineTo(W + 10, H); x.fill(); };
    hill(-6 * s, '#2e9a52'); hill(-2 * s, '#4fd06a'); hill(2 * s, '#3a2430');
    const T = WORLDS[0];
    x.setTransform(s * 1.5, 0, 0, s * 1.5, 0, 0);
    [[0.3, -0.5], [0.7, 0.4]].forEach(([fx, ph], i) => { const lxp = W * fx / (s * 1.5), lyp = (hy - 24 * s + Math.abs(fx - 0.5) * 120 * s) / (s * 1.5) - 18; Sprites.lantern(x, { x: lxp, y: lyp, lit: true, seed: i + ph }, t, T); });
    const ly = H * 0.62 + Math.sin(t * 1.6) * 12 * s;
    x.setTransform(s * 2.6, 0, 0, s * 2.6, W / 2, ly);
    Sprites.lumi(x, { x: 0, y: 0, sx: 1 + Math.sin(t * 3.2) * 0.03, sy: 1 - Math.sin(t * 3.2) * 0.03, face: Math.sin(t * 0.5) > 0 ? 1 : -1, vx: 0, vy: Math.cos(t * 1.6) * 60, blinkSeed: 1, hurtT: 0 }, t);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'lighter';
    const spr = glowSprite('rgba(255,200,120,0.5)'), gs = 520 * s;
    x.globalAlpha = 0.7; x.drawImage(spr, W / 2 - gs / 2, ly - gs / 2, gs, gs);
    [[0.3], [0.7]].forEach(([fx]) => { const g2 = 260 * s; x.globalAlpha = 0.5; x.drawImage(spr, W * fx - g2 / 2 + 18 * s * 1.5, hy - 24 * s + Math.abs(fx - 0.5) * 120 * s - 45 * s * 1.5 - g2 / 2, g2, g2); });
    for (let i = 0; i < 40; i++) { const fx = (Math.sin(i * 12.9898) * 0.5 + 0.5) * W, fy = ((Math.sin(i * 78.233) * 0.5 + 0.5) * H * 0.85 + Math.sin(t * 0.7 + i) * 30) % H;
        x.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + i); x.fillStyle = '#ffe49a'; x.beginPath(); x.arc(fx + Math.sin(t * 0.5 + i) * 20, fy, 2.2 * Math.max(1, s), 0, 7); x.fill(); }
    x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
}
function touchControls() {
    const on = settings.touch === 'on' || (settings.touch === 'auto' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches);
    $('#touch').classList.toggle('hidden', !on || G.state !== 'play');
}
function applyQuality() {
    // Sharp: full device resolution. Fast: 70%. Auto: Fast on small/slow devices, otherwise full but capped at 1x.
    const slow = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 8) <= 4;
    R.q = settings.quality === 'high' ? 1 : settings.quality === 'low' ? 0.7 : (slow ? 0.8 : 1);
    if (settings.quality === 'auto' && (window.devicePixelRatio || 1) > 1) R.q = Math.min(R.q, 1 / Math.min(window.devicePixelRatio, 2) * 1.25);
    R.resize();
}
