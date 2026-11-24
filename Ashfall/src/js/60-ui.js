// ============================================================
// Everything on the page that is not the game's picture: the intro (white letters typed onto black, then the name),
// the main menu over a slow turn round the map, match setup, the armory, settings, the supply crate, pause, the end.
// ============================================================
// ---- ash and embers drifting over the intro and the menus (a small 2D canvas; the game draws its own in 3D)
const Ash2D = { on: false, list: [], c: $('ash'), g: null, last: 0,
    start() { if (this.on) return; this.on = true; this.g = this.g || this.c.getContext('2d'); this.size(); if (!this.list.length) for (let i = 0; i < 90; i++) this.list.push(this.make(Math.random() < 0.22, true)); this.last = performance.now(); requestAnimationFrame(t => this.frame(t)); },
    stop() { this.on = false; if (this.g) this.g.clearRect(0, 0, this.c.width, this.c.height); },
    size() { this.c.width = innerWidth; this.c.height = innerHeight; },
    make(ember, any) { const w = this.c.width, h = this.c.height; return ember ? { e: 1, x: Math.random() * w, y: any ? Math.random() * h : h + 10, vx: rand(-12, 30), vy: rand(-70, -25), r: rand(1, 2.6), life: rand(3, 7), t: 0, ph: Math.random() * 6 } : { e: 0, x: Math.random() * w, y: any ? Math.random() * h : -10, vx: rand(-8, 26), vy: rand(14, 46), r: rand(1.2, 3.4), life: 99, t: 0, ph: Math.random() * 6 }; },
    burst(n) { const w = this.c.width, h = this.c.height; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rand(120, 700); this.list.push({ e: 1, x: w / 2 + rand(-w * 0.3, w * 0.3), y: h * 0.52 + rand(-30, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 120, r: rand(1, 3.2), life: rand(1.2, 3), t: 0, ph: 0, b: 1 }); } },
    frame(now) {
        if (!this.on) return; requestAnimationFrame(t => this.frame(t)); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
        if (this.c.width !== innerWidth || this.c.height !== innerHeight) this.size();
        const g = this.g, w = this.c.width, h = this.c.height, L = this.list; g.clearRect(0, 0, w, h);
        for (let i = L.length - 1; i >= 0; i--) { const p = L[i]; p.t += dt; p.x += (p.vx + Math.sin(p.t * 1.3 + p.ph) * 14) * dt; p.y += p.vy * dt; if (p.b) { p.vx *= 1 - dt * 1.6; p.vy = p.vy * (1 - dt * 1.6) - 40 * dt; }
            if (p.t > p.life || p.y > h + 20 || p.y < -30 || p.x > w + 30) { if (p.b) L.splice(i, 1); else L[i] = this.make(p.e, false); continue; }
            if (p.e) { const a = Math.min(1, (p.life - p.t) * 1.2) * (0.6 + 0.4 * Math.sin(p.t * 9 + p.ph)); g.fillStyle = 'rgba(255,' + (120 + (p.ph * 20 | 0)) + ',40,' + a.toFixed(2) + ')'; g.shadowColor = 'rgba(255,110,30,.9)'; g.shadowBlur = 8; g.fillRect(p.x, p.y, p.r, p.r); }
            else { g.shadowBlur = 0; g.fillStyle = 'rgba(200,196,188,' + (0.18 + 0.1 * Math.sin(p.ph)).toFixed(2) + ')'; g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.55, p.t + p.ph, 0, 6.3); g.fill(); } }
    } };

const UI = { panel: '', navI: 0, shopTab: 'guns', setup: { map: 'yard', diff: 'normal', cls: 'assault', rule: 'classic' } };
// the map you prefer (`settings.map`: a map, or 'random') is where the PLAY page starts; mapPick: the map to load now
UI.prefs = () => { if (UI.setup.pref || !Save.data) return; UI.setup.pref = 1; const m = Save.data.settings.map; if (m === 'random' || (MAPS[m] && UI.maps().includes(m))) UI.setup.map = m; };
UI.mapPick = () => { UI.prefs(); const m = UI.setup.map, L = UI.maps(); return m === 'random' ? L[Math.floor(Math.random() * L.length)] : (MAPS[m] ? m : 'yard'); };
UI.maps = () => Object.keys(MAPS).filter(id => (HAVE[MAPS[id].file] === true && (!MAPS[id].hold || Q.get('all') === '1')) || id === 'yard');
UI.logo = () => '<svg class="logo" viewBox="0 0 900 190" role="img" aria-label="ASHFALL"><g filter="url(#lg-erode)"><text x="450" y="150" text-anchor="middle" textLength="860" lengthAdjust="spacingAndGlyphs" fill="url(#lg-fill)">ASHFALL</text></g></svg>';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- the intro
const INTRO_LINES = ['Are you there?', 'We made it...?', 'Mission B. Shooter was a success, it seems...'], INTRO_STACK = ['We move', 'not to Blocky Shooter 2', 'but', 'to'];
UI.intro = async function (full) {
    const box = $('intro'), tx = $('intro-text'); App.screen = 'intro'; box.classList.remove('hidden', 'name'); $('intro-skip').style.visibility = 'hidden'; let run = UI.introRun = {};
    const gone = () => UI.introRun !== run;
    // sound needs a key or a click first: wait for one
    tx.innerHTML = '<span style="animation:pulse 1.4s infinite;letter-spacing:.3em;font-size:.6em">[ PRESS ANY KEY ]</span>';
    await new Promise(r => { const f = () => { removeEventListener('keydown', f); removeEventListener('mousedown', f); r(); }; addEventListener('keydown', f); addEventListener('mousedown', f); });
    if (gone()) return; Snd.init(); tx.textContent = ''; await sleep(500);
    // hold Space or the mouse to skip the words (never the name)
    let held = 0, skip = false; const down = e => { if (!e.code || e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') held = performance.now(); }, up = () => { held = 0; }; addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('mousedown', down); addEventListener('mouseup', up);
    const wait = async ms => { const end = performance.now() + ms; while (performance.now() < end && !skip && !gone()) { if (held && performance.now() - held > 550) skip = true; await sleep(30); } };
    const type = async (el, s) => { for (const ch of s) { if (skip || gone()) return; el.insertBefore(document.createTextNode(ch), el.lastChild); if (ch !== ' ') Snd.type(); await wait(/[.?!]/.test(ch) ? 300 : ch === ',' ? 190 : 46); } };
    if (full) {
        $('intro-skip').style.visibility = '';
        for (const s of INTRO_LINES) { if (skip) break; tx.innerHTML = '<span class="caret"></span>'; await type(tx, s); await wait(1250); tx.textContent = ''; await wait(450); }
        if (!skip) { tx.innerHTML = '';
            for (let i = 0; i < INTRO_STACK.length && !skip; i++) { const ln = document.createElement('div'); ln.innerHTML = '<span class="caret"></span>'; tx.appendChild(ln); if (i === 1) { await type(ln, 'not to '); const sp = document.createElement('span'); sp.innerHTML = '<span class="caret"></span>'; ln.insertBefore(sp, ln.lastChild); await type(sp, 'Blocky Shooter 2'); sp.removeChild(sp.lastChild); await wait(520); sp.className = 'cut'; Snd.tone(120, 0.3, 0.3, 'sawtooth', 60); await wait(650); } else await type(ln, INTRO_STACK[i]); ln.removeChild(ln.lastChild); await wait(i === 3 ? 1100 : 620); } }
        tx.textContent = ''; await wait(700);
    }
    removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('mousedown', down); removeEventListener('mouseup', up);
    if (gone()) return;
    // the name
    $('intro-skip').style.visibility = 'hidden'; box.classList.add('name'); tx.innerHTML = UI.logo() + '<div class="sub">A HUNTINGTON GAMES PRODUCTION</div><div class="go">CLICK TO BEGIN</div>';
    const fl = $('flash'); fl.className = ''; void fl.offsetWidth; fl.className = 'go'; document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake');
    Snd.boom(1); Snd.tone(55, 0.5, 2.5, 'sawtooth', 41); Ash2D.start(); Ash2D.burst(140);
    if (!Save.data.intro) { Save.data.intro = true; Save.store(); }
    await sleep(900); if (gone()) return;
    await new Promise(r => { const f = () => { removeEventListener('keydown', f); removeEventListener('mousedown', f); r(); }; addEventListener('keydown', f); addEventListener('mousedown', f); setTimeout(f, full ? 9000 : 3500); });
    if (gone()) return; Snd.ui('click'); box.classList.add('hidden'); UI.menu();
};

// ---- the main menu
UI.menu = function () {
    App.screen = 'menu'; App.game = null; App.paused = true; UI.close(); Ash2D.start(); Music.set('menu');
    for (const id of ['hud', 'vig', 'stats', 'pause', 'results', 'shop', 'loading', 'intro']) $(id).classList.add('hidden');
    $('menu').classList.remove('hidden'); $('menu-logo').innerHTML = UI.logo(); UI.card();
    $('menu-foot').innerHTML = '<span>ASHFALL ' + VERSION + (BUILD ? ' &middot; BUILD ' + esc(BUILD) : '') + '</span><span>' + esc(TIPS[(Math.random() * TIPS.length) | 0]) + '</span>';
    UI.nav(UI.navI);
    // the map comes in behind the menu when it is ready
    if (!World.loaded && !UI.bgLoading && R) { UI.bgLoading = true; Weapons.init().then(() => World.load(UI.mapPick())).then(() => Foes.load()).then(() => { UI.bgLoading = false; if (UI.panel) UI.draw(); }).catch(e => { UI.bgLoading = false; App.errors.push('map: ' + e.message); }); }
};
UI.card = function () { const r = Save.rank(), nx = r.index < RANKS.length - 1 ? Armory.opens(r.index + 1) : [], s = Save.data.stats, best = Object.keys(s.best).reduce((m, k) => Math.max(m, s.best[k]), 0); $('menu-card').innerHTML = '<div class="rank">' + esc(r.name.toUpperCase()) + '</div><div>RANK ' + (r.index + 1) + '</div><div class="xp"><i style="width:' + (r.frac * 100).toFixed(0) + '%"></i></div><div>BEST WAVE <b>' + best + '</b> &nbsp; KILLS <b>' + s.kills + '</b></div>' + (nx.length ? '<div class="nextup">RANK ' + (r.index + 2) + ' OPENS <b>' + esc(nx.slice(0, 3).join(', ')) + (nx.length > 3 ? ' +' + (nx.length - 3) : '') + '</b></div>' : '') + '<div>CREDITS <b>' + (Save.data.credits || 0) + '</b>' + (Armory.ready() ? ' &nbsp; <b style="color:var(--good)">CONTRACT DONE</b>' : '') + '</div><div style="margin-top:14px"><button class="btn" data-do="ssr">STEEL STORM REMASTERED &rarr;</button></div>'; };
UI.nav = function (i) { const b = [...document.querySelectorAll('#menu-nav button')]; UI.navI = (i + b.length) % b.length; b.forEach((x, k) => x.classList.toggle('sel', k === UI.navI)); };
UI.act = function (a) {
    Snd.init(); Snd.ui('click');
    if (a === 'play') UI.open('play'); else if (a === 'ops') UI.open('ops'); else if (a === 'armory') UI.open('armory'); else if (a === 'settings' || a === 'psettings') UI.open('settings'); else if (a === 'mp') UI.open('mp');
    else if (a === 'resume') UI.pause(false); else if (a === 'quit') { if (Game.net) Net.leave(); Game.stop(); UI.menu(); }
};

// ---- panels
UI.open = function (name) { UI.panel = name; $('panel').classList.remove('hidden'); $('panel-title').textContent = { play: 'HOLDOUT', ops: 'OPERATIONS', armory: 'LOCKER', settings: 'SETTINGS', mp: 'MULTIPLAYER' }[name]; UI.draw(); };
UI.close = function () { if (!UI.panel) return; UI.panel = ''; $('panel').classList.add('hidden'); if (App.game && App.paused && !Game.shopOpen) $('pause').classList.remove('hidden'); };
UI.draw = function () { const b = $('panel-body'); if (UI.panel === 'play') b.innerHTML = UI.playHTML(); else if (UI.panel === 'ops') b.innerHTML = Ops.html(); else if (UI.panel === 'armory') b.innerHTML = Armory.html(); else if (UI.panel === 'settings') b.innerHTML = UI.settingsHTML(); else if (UI.panel === 'mp') b.innerHTML = Net.panelHTML(); };
UI.classTiles = function (sel) { const r = Save.rank().index; return Object.keys(CLASSES).map(id => { const c = CLASSES[id], lock = r < c.rank; return '<button class="tile' + (sel === id ? ' sel' : '') + (lock ? ' locked' : '') + '" data-cls="' + id + '"' + (lock ? ' disabled' : '') + '><b>' + c.name + '</b><small>' + c.ability + (Extras.clsLevel(id) ? ' &middot; level ' + Extras.clsLevel(id) : '') + '</small>' + (lock ? '<span class="lock">RANK ' + (c.rank + 1) + '</span>' : '') + '</button>'; }).join(''); };
UI.playHTML = function () {
    UI.prefs(); const s = UI.setup, st = Save.data.stats, c = CLASSES[s.cls];
    return '<div class="cols"><div><div class="h3">Where</div><div class="tiles"><button class="tile' + (s.map === 'random' ? ' sel' : '') + '" data-map="random"><b>RANDOM</b><small>a different place every run</small></button>' + UI.maps().map(id => '<button class="tile' + (s.map === id ? ' sel' : '') + '" data-map="' + id + '"><b>' + MAPS[id].name + '</b><small>best wave ' + (st.best[id + '_' + s.diff + (s.rule !== 'classic' ? '_' + s.rule : '')] || 0) + '</small></button>').join('') + '</div><p style="color:#b9b2a6">' + esc(MAPS[s.map] ? MAPS[s.map].blurb : 'Any of the places above, picked when you deploy.') + '</p>' +
        '<div class="h3">Rules</div><div class="seg">' + Object.keys(RULES).map(id => '<button data-rule="' + id + '" class="' + (s.rule === id ? 'on' : '') + '">' + RULES[id].name + '</button>').join('') + '</div><p style="color:#b9b2a6;margin:8px 0 12px">' + esc(RULES[s.rule].blurb) + '</p>' +
        '<div class="h3">How hard</div><div class="seg">' + Object.keys(DIFFS).map(id => '<button data-diff="' + id + '" class="' + (s.diff === id ? 'on' : '') + '">' + DIFFS[id].name + '</button>').join('') + '</div></div>' +
        '<div><div class="h3">Who you are</div><div class="tiles">' + UI.classTiles(s.cls) + '</div><div class="detail" style="margin-top:12px"><h3>' + c.name + '</h3><p><b style="color:var(--ember2)">' + c.ability + ' [X]</b> &nbsp;' + esc(c.desc) + '</p>' + Extras.perksHTML(s.cls) + '</div>' +
        '<div style="text-align:right;margin-top:10px">' + (Save.data.run && MAPS[Save.data.run.map] ? '<button class="btn" data-go="resume">CONTINUE &middot; WAVE ' + (Save.data.run.wave + 1) + ' &middot; ' + MAPS[Save.data.run.map].name + '</button> ' : '') + '<button class="btn go" data-go="solo">DEPLOY</button></div></div></div>';
};
UI.settingsHTML = function () {
    const s = Save.data.settings, rng = (k, lo, hi, step, label, hint, fmt) => '<div class="row"><label>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</label><span><input type="range" data-set="' + k + '" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + s[k] + '"> <b style="display:inline-block;width:48px;text-align:right">' + fmt(s[k]) + '</b></span></div>';
    const seg = (k, opts, label, hint) => '<div class="row"><label>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</label><div class="seg">' + opts.map(o => '<button data-seg="' + k + '" data-v="' + o[0] + '" class="' + (String(s[k]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div></div>';
    return '<div class="cols"><div>' + rng('sens', 0.3, 3, 0.05, 'Look speed', 'mouse or trackpad', v => (+v).toFixed(2)) + rng('adsSens', 0.4, 1.6, 0.05, 'Look speed while aiming', '', v => (+v).toFixed(2)) + rng('fov', 60, 90, 1, 'Field of view', '', v => v + '°') +
        seg('aimToggle', [[true, 'PRESS E'], [false, 'HOLD E']], 'Aim down the sight', 'the right button always works as well') + seg('nums', [[true, 'ON'], [false, 'OFF']], 'Damage numbers', 'what each hit did, rising off the target') + seg('stats', [[false, 'OFF'], [true, 'ON']], 'Speed readout', 'frames a second and picture size, top right (F3 does the same)') + seg('shake', [[true, 'ON'], [false, 'OFF']], 'Screen shake') + seg('quality', [['auto', 'AUTO'], ['low', 'LOW']], 'Picture', 'auto keeps the frame rate by itself') +
        rng('sfx', 0, 1, 0.05, 'Sound', '', v => Math.round(v * 100) + '%') + rng('music', 0, 1, 0.05, 'Music', '', v => Math.round(v * 100) + '%') +
        '<div class="row"><label>Speed test' + UI.speedHTML() + '</label><button class="btn" data-do="speed">RUN IT</button></div><div class="row"><label>Full screen</label><button class="btn" data-do="fs">TOGGLE</button></div><div class="row"><label>The opening</label><button class="btn" data-do="intro">PLAY IT AGAIN</button></div></div>' +
        '<div><div class="h3">Controls</div><div class="keys">' + [['W A S D', 'move'], ['Shift', 'sprint'], ['Mouse', 'look'], ['Click or F', 'fire'], ['Space', 'jump'], ['E', 'aim down the sight (the katana: lunge, then hold to thrust)'], ['R', 'reload'], ['1 2 3', 'weapons'], ['Q', 'last weapon'], ['V', 'strike'], ['G', 'grenade'], ['X', 'class ability'], ['C', 'crouch (hold): steadier aim; pressed in a sprint, a slide'], ['T', 'mortar strike (12 kills in a row)'], ['B', 'armory (between waves)'], ['Enter', 'call the next wave'], ['Tab', 'scores (multiplayer)'], ['Esc', 'pause'], ['F3', 'numbers']].map(k => '<div><kbd>' + k[0] + '</kbd>' + k[1] + '</div>').join('') + '</div></div></div>';
};

// ---- starting a run
UI.loading = function (on, map, frac) { $('loading').classList.toggle('hidden', !on); if (!on) return; $('load-logo').innerHTML = $('load-logo').innerHTML || UI.logo(); $('load-map').textContent = map || ''; $('load-bar').firstElementChild.style.width = Math.round((frac || 0) * 100) + '%'; if (!frac) $('load-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0]; };
UI.play = async function (o) {
    const op = o.op && Ops.by(o.op), title = op ? op.name : MAPS[o.map].name; UI.close(); $('menu').classList.add('hidden'); $('results').classList.add('hidden'); UI.loading(true, title, 0); if (op) $('load-tip').textContent = op.brief; UI.loading(true, title, 0.05); Ash2D.start();
    try {
        await Weapons.init(); await World.load(o.map, f => UI.loading(true, title, f * 0.7)); await Foes.load();
        await Gun.load('carbine'); UI.loading(true, title, 0.85); if (Weapons.made('pistol')) { try { await Gun.load('pistol'); } catch (e) { } } { const kit = Armory.kit(); for (const id of [kit.primary, kit.sidearm].concat(o.resume ? o.resume.slots || [] : [])) if (id && Weapons.made(id)) { try { await Gun.load(id); } catch (e) { } } } if (o.kit && o.kit !== 'carbine' && Weapons.made(o.kit)) { try { await Gun.load(o.kit); } catch (e) { } }
        UI.loading(true, title, 1);
    } catch (e) { UI.loading(false); UI.menu(); UI.fatal('Could not load: ' + e.message, true); return false; }
    await sleep(250); UI.loading(false); Ash2D.stop(); App.screen = 'game'; App.game = Game; App.paused = false; App.demo = false;
    $('hud').classList.remove('hidden'); $('vig').classList.remove('hidden'); $('stats').classList.toggle('hidden', !App.showStats); resize();
    Game.start(o); lock(); return true;
};
UI.fatal = function (text, soft) { const f = $('fatal'); f.classList.remove('hidden'); f.innerHTML = '<div>' + esc(text) + (soft ? '<br><br><button class="btn" onclick="this.parentNode.parentNode.classList.add(\'hidden\')">OK</button>' : '') + '</div>'; };

// the speed test: 20 seconds of the game playing itself, then the numbers on the settings panel
UI.speedTest = async function () {
    const ok = await UI.play({ map: UI.mapPick(), diff: 'normal', cls: 'assault', demo: true }); if (!ok) return; if (document.pointerLockElement) document.exitPointerLock(); let calls = 0, tris = 0; const peek = setInterval(() => { calls = Math.max(calls, App.calls || 0); tris = Math.max(tris, App.tris || 0); }, 250);
    HG3D.speedTest({ game: 'ashfall', renderer: 'hg', gl: R.getContext(), seconds: +Q.get('secs') || 20, onDone: r => { clearInterval(peek); let chip = '?'; try { const g = R.getContext(), x = g.getExtension('WEBGL_debug_renderer_info'); chip = x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); } catch (e) { }
        Save.data.speed = { fps: r.fps, low: r.low, ms: r.ms, calls, tris, mb: Math.round(R.info.memory.textureBytes / 1048576), w: canvas.width, h: canvas.height, scale: App.scale, chip, build: BUILD || 'local' }; Save.store(); Game.stop(); UI.menu(); UI.open('settings'); } });
};
UI.speedHTML = function () { const r = Save.data.speed; if (!r) return '<small style="color:var(--dim)">the game plays itself for 20 seconds in a full yard</small>'; return '<small style="display:block;max-width:420px;color:' + (r.low >= 30 ? 'var(--good)' : 'var(--bad)') + '">' + r.fps + ' FPS average, ' + r.low + ' at the slowest</small><small style="display:block;max-width:420px;user-select:all;-webkit-user-select:all;font-family:monospace;color:var(--dim)">Report: ashfall build ' + esc(r.build) + ' | ' + r.fps + '/' + r.low + ' fps ' + r.ms + ' ms ' + r.w + 'x' + r.h + ' size ' + Math.round((r.scale || 1) * 100) + '% | ' + r.calls + ' draws ' + Math.round(r.tris / 1000) + 'k tris ' + r.mb + ' MB | ' + esc(r.chip) + '</small>'; };
// ---- pause, the supply crate, the end of a run
UI.pause = function (on) {
    if (!App.game || Game.over) return; if (on && !Game.net) App.paused = true; $('pause').classList.toggle('hidden', !on); UI.paused = on;
    if (!on) { App.paused = false; UI.close(); lock(); } else if (document.pointerLockElement) document.exitPointerLock();
    Game.hint();
};
UI.shop = function (on) { const G = Game; G.shopOpen = on; $('shop').classList.toggle('hidden', !on); if (on) { if (document.pointerLockElement) document.exitPointerLock(); Snd.ui('click'); UI.shopDraw(); } else { Snd.ui('back'); lock(); if (!G.net && !G.op && !G.demo && G.rule !== 'sandbox' && G.phase === 'break' && !G.over && G.wave > 0) Extras.keep(G); } Game.hint(); };
UI.shopDraw = function () {
    const G = Game, P = G.P, r = Save.rank().index, tab = UI.shopTab, btn = (label, cost, key, off, note) => '<button class="tile' + (off ? ' locked' : '') + '" data-buy="' + key + '"' + (off || G.cash < cost ? ' disabled' : '') + '><b>' + label + '</b><small>' + (note || '') + '</small><span class="lock">' + (off === 2 ? 'MAX' : '$' + cost) + '</span></button>';
    let h = '<div class="box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">FIELD ARMORY <small style="font-size:11px;letter-spacing:.14em;color:var(--dim);font-weight:400">&nbsp; what you get here is for this run</small></h2><div style="font:900 24px Arial Black,Roboto,sans-serif;color:var(--ember2)">$' + G.cash + '</div></div><div class="seg" style="margin-bottom:14px">' + [['guns', 'WEAPONS'], ['atts', 'ATTACHMENTS'], ['ups', 'UPGRADES'], ['gear', 'GEAR'], ['perks', 'PERKS'], ['role', 'ROLE']].map(t => '<button data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div class="tiles">';
    if (tab === 'guns') h += Weapons.list().filter(id => !Gun.state[id]).map(id => { const w = WEAPONS[id], lock = r < w.rank && G.rule !== 'sandbox'; return '<button class="tile' + (lock ? ' locked' : '') + '" data-buy="gun:' + id + '"' + (lock || G.cash < Weapons.cost(id) || UI.buying ? ' disabled' : '') + '>' + (Armory.thumbOf(id) ? '<img class="th" alt="" src="' + Armory.thumbOf(id) + '">' : '') + '<b>' + w.name + '</b><small>' + w.kind + (w.slot === 2 ? ' &middot; replaces your sidearm' : Gun.slots[1] ? ' &middot; replaces the gun in hand' : ' &middot; second gun') + '</small><span class="lock">' + (lock ? 'RANK ' + (w.rank + 1) : '$' + Weapons.cost(id)) + '</span></button>'; }).join('') || '<p>You carry everything the crate has for your rank.</p>';
    else if (tab === 'atts') h += Gun.slots.filter(Boolean).map(id => { const have = Armory.atts(id), own = Armory.ownAtts(id); return (ATT_FOR[id] || []).map(a => { const on = have.indexOf(a) >= 0, c = Armory.attCost(id, a); return '<button class="tile' + (on ? ' locked' : '') + '" data-buy="att:' + id + ':' + a + '"' + (on || G.cash < c ? ' disabled' : '') + '><b>' + ATTACH[a].name + '</b><small>' + WEAPONS[id].name + ': ' + ATTACH[a].desc + '</small><span class="lock">' + (on ? (own.indexOf(a) >= 0 ? 'FITTED' : 'ON') : '$' + c) + '</span></button>'; }).join(''); }).join('') || '<p>Nothing you carry takes attachments.</p>';
    else if (tab === 'ups') h += Gun.slots.filter(Boolean).map(id => { const l = Gun.state[id].lvl, c = Weapons.upCost(id, l); return btn(WEAPONS[id].name, c, 'up:' + id, l >= UP_MAX ? 2 : 0, l >= UP_MAX ? UP_NAMES[l] : UP_NAMES[l] + ' &rarr; ' + UP_NAMES[l + 1] + ': +12% damage, bigger magazine, faster reload'); }).join('');
    else if (tab === 'gear') h += btn('AMMUNITION', 150, 'ammo', 0, 'fill every gun') + btn('ARMOUR PLATES', 400, 'armor', P.armor >= 150 ? 2 : 0, '+50, soaks 60% of a hit (' + Math.round(P.armor) + '/150)') + btn('MEDKIT', 250, 'med', P.hp >= P.max ? 2 : 0, 'back to full health') + btn(THROWS[G.throwKind].short, 300, 'nade', G.nades >= THROWS[G.throwKind].n + 2 ? 2 : 0, '+2 (' + G.nades + '/' + (THROWS[G.throwKind].n + 2) + ')') +
        Object.keys(THROWS).filter(t => t !== G.throwKind).map(t => { const mine = Save.data.own[t] || G.gotThrows[t], lock = r < THROWS[t].rank && G.rule !== 'sandbox' && !mine; return '<button class="tile' + (lock ? ' locked' : '') + '" data-buy="throw:' + t + '"' + (lock || (!mine && G.cash < 450) ? ' disabled' : '') + '><b>CARRY ' + THROWS[t].short + '</b><small>instead of ' + THROWS[G.throwKind].short.toLowerCase() + ': ' + THROWS[t].desc + '</small><span class="lock">' + (lock ? 'RANK ' + (THROWS[t].rank + 1) : mine ? 'SWAP' : '$450') + '</span></button>'; }).join('');
    else if (tab === 'role') h += Object.keys(CLASSES).map(id => { const c = CLASSES[id], on = id === G.cls, lock = r < c.rank && G.rule !== 'sandbox'; return '<button class="tile' + (on || lock ? ' locked' : '') + '" data-buy="cls:' + id + '"' + (on || lock || G.cash < 400 ? ' disabled' : '') + '><b>' + c.name + '</b><small>' + c.ability + ': ' + c.desc + '</small><span class="lock">' + (on ? 'YOU' : lock ? 'RANK ' + (c.rank + 1) : '$400') + '</span></button>'; }).join('');
    else h += Object.keys(PERKS).map(id => { const l = G.perks[id]; return btn(PERKS[id].name + (l ? ' ' + 'I'.repeat(l) : ''), PERK_COST[l] || 0, 'perk:' + id, l >= 3 ? 2 : 0, PERKS[id].desc); }).join('');
    h += '</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px"><small style="color:var(--dim);letter-spacing:.1em">' + (G.net ? 'THE WAVE TIMER KEEPS RUNNING' : 'TAKE YOUR TIME: THE NEXT WAVE WAITS') + '</small><div style="display:flex;gap:10px"><button class="btn" data-do="shopx">CLOSE <kbd>B</kbd></button>' + (G.phase === 'break' && G.rule !== 'rush' && G.wave > 0 ? '<button class="btn go" data-do="shopgo">START THE NEXT WAVE <kbd>ENTER</kbd></button>' : '') + '</div></div></div>';
    $('shop').innerHTML = h;
};
UI.buy = async function (key) {
    const G = Game, P = G.P, [k, id] = key.split(':'), pay = c => { if (G.cash < c) { Snd.ui('deny'); return false; } G.cash -= c; Snd.ui('buy'); return true; };
    if (k === 'gun') { const w = WEAPONS[id]; if (UI.buying || G.cash < Weapons.cost(id)) return; UI.buying = true; UI.shopDraw();
        try { await Gun.load(id); } catch (e) { UI.buying = false; Snd.ui('deny'); UI.shopDraw(); return; } UI.buying = false; if (!pay(Weapons.cost(id))) return;
        const slot = w.slot === 2 ? 2 : !Gun.slots[1] ? 1 : (G.slot < 2 ? G.slot : 0), old = Gun.slots[slot]; if (old) { delete Gun.state[old]; if (Gun.cur && Gun.cur.id === old) Gun.cur.node.visible = false; }
        Gun.slots[slot] = id; Gun.give(id, 0); G.lastSlot = G.slot; G.slot = slot; Gun.equip(id, P); if (old && old !== id) Gun.drop(old); }
    else if (k === 'up') { const l = Gun.state[id].lvl; if (l >= UP_MAX || !pay(Weapons.upCost(id, l))) return; Gun.state[id].lvl = l + 1; const w = Gun.stats(id); Gun.state[id].ammo = w.mag; if (Gun.cur && Gun.cur.id === id) Gun.W = w; }
    else if (k === 'att') { const a = key.split(':')[2], s = Gun.state[id]; if (!s || !ATTACH[a] || (ATT_FOR[id] || []).indexOf(a) < 0 || Armory.atts(id).indexOf(a) >= 0 || !pay(Armory.attCost(id, a))) return; (G.atts[id] = G.atts[id] || []).push(a); const w = Gun.stats(id); s.ammo = Math.max(s.ammo, w.mag); s.reserve = Math.max(s.reserve, w.reserve); if (Gun.cur && Gun.cur.id === id) Gun.W = w; }
    else if (k === 'throw') { if (!THROWS[id] || id === G.throwKind) return; const mine = Save.data.own[id] || G.gotThrows[id]; if (!mine) { if (!pay(450)) return; G.gotThrows[id] = 1; } else Snd.ui('buy'); G.throwKind = id; G.nades = THROWS[id].n; }
    else if (k === 'cls') { const c = CLASSES[id]; if (!c || id === G.cls || (Save.rank().index < c.rank && G.rule !== 'sandbox') || !pay(400)) return; Extras.swapClass(G, P, id); HUD.callout('NOW ' + c.name); }
    else if (k === 'ammo') { if (!pay(150)) return; for (const g in Gun.state) { const w = Gun.stats(g); Gun.state[g].ammo = w.mag; Gun.state[g].reserve = w.reserve; } }
    else if (k === 'armor') { if (P.armor >= 150 || !pay(400)) return; P.armor = Math.min(150, P.armor + 50); }
    else if (k === 'med') { if (P.hp >= P.max || !pay(250)) return; P.hp = P.max; }
    else if (k === 'nade') { const cap = THROWS[G.throwKind].n + 2; if (G.nades >= cap || !pay(300)) return; G.nades = Math.min(cap, G.nades + 2); }
    else if (k === 'perk') { const l = G.perks[id]; if (l >= 3 || !pay(PERK_COST[l])) return; G.perks[id]++; const was = P.max; Game.stats(); P.hp += P.max - was; }
    Game.hud(true); UI.shopDraw();
};
UI.results = function (r) {
    if (document.pointerLockElement) document.exitPointerLock(); const up = r.after.index > r.before.index;
    $('results').classList.remove('hidden');
    $('results').innerHTML = '<div class="box"><small style="letter-spacing:.4em;color:var(--ember2)">' + (r.title || 'OVERRUN ON') + '</small><div class="big">' + (r.big || 'WAVE ' + r.wave) + '</div>' + (r.stars ? '<div class="stars big">' + '&#9733;'.repeat(r.stars) + '<i>' + '&#9733;'.repeat(3 - r.stars) + '</i></div>' : '') + (r.record ? '<div style="color:var(--good);letter-spacing:.3em;font-weight:700">NEW BEST</div>' : '') +
        '<div class="grid">' + [['kills', r.kills], ['headshots', r.heads], ['accuracy', r.acc + '%'], [r.cashLabel || 'cash earned', r.cashLabel ? r.cash : '$' + r.cash], ['time', Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0')], ['credits', '+' + (r.credits || 0)]].map(x => '<div><b>' + x[1] + '</b><small>' + x[0] + '</small></div>').join('') + '</div>' +
        '<div style="display:flex;justify-content:space-between;letter-spacing:.14em;font-size:13px"><span>' + (up ? '<b style="color:var(--good)">RANK UP: ' + esc(r.after.name.toUpperCase()) + '</b>' : esc(r.after.name.toUpperCase()) + ' &middot; RANK ' + (r.after.index + 1)) + '</span><span>+' + r.xp + ' XP</span></div><div class="xp"><i style="width:' + ((up ? 0 : r.before.frac) * 100).toFixed(0) + '%"></i></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" data-do="tomenu">' + (Game.net ? 'BACK TO THE PARTY' : 'MENU') + '</button>' + (Game.net ? '' : r.op && !r.lost && OPS[OPS.indexOf(Ops.by(r.op)) + 1] ? '<button class="btn" data-do="again">REPLAY</button><button class="btn go" data-do="nextop">NEXT OPERATION</button>' : '<button class="btn go" data-do="again">' + (r.op ? 'TRY AGAIN' : 'GO AGAIN') + '</button>') + '</div></div>';
    if (up) { const got = []; for (let k = r.before.index + 1; k <= r.after.index; k++) got.push(...Armory.opens(k)); if (got.length) $('results').querySelector('.xp').insertAdjacentHTML('afterend', '<div class="opened"><small>NOW OPEN TO YOU</small>' + got.map(g => '<span>' + esc(g) + '</span>').join('') + '</div>'); }
    setTimeout(() => { const i = document.querySelector('#results .xp i'); if (i) i.style.width = (r.after.frac * 100).toFixed(0) + '%'; if (up) { Snd.ui('buy'); Snd.tone(440, 0.2, 0.6, 'triangle', 880); } }, 350);
};

// ---- clicks and keys
document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled && b !== UI.hov) { UI.hov = b; Snd.ui('hover'); const nav = [...document.querySelectorAll('#menu-nav button')].indexOf(b); if (nav >= 0) UI.nav(nav); } });
document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return; const d = b.dataset; Snd.init();
    if (d.act) return UI.act(d.act);
    if (b.id === 'panel-x') { Snd.ui('back'); return UI.close(); }
    if (d.map) { UI.setup.map = d.map; Save.data.settings.map = d.map; Save.store(); Snd.ui('click'); return UI.draw(); } if (d.diff) { UI.setup.diff = d.diff; Snd.ui('click'); return UI.draw(); } if (d.cls) { UI.setup.cls = d.cls; Net.setCls && Net.setCls(d.cls); Snd.ui('click'); return UI.draw(); }
    if (d.rule) { UI.setup.rule = d.rule; Snd.ui('click'); return UI.draw(); }
    if (d.arm) { UI.armSel = d.arm; Snd.ui('click'); return UI.draw(); }
    if (d.go === 'resume') { const r = Save.data.run; if (!r || !MAPS[r.map]) return; Snd.ui('click'); return UI.play({ map: r.map, diff: r.diff, cls: r.cls, rule: r.rule, resume: r }); }
    if (d.go === 'solo') { Snd.ui('click'); return UI.play({ map: UI.mapPick(), diff: UI.setup.diff, cls: UI.setup.cls, rule: UI.setup.rule }); }
    if (d.seg) { const v = d.v === 'true' ? true : d.v === 'false' ? false : d.v; Save.data.settings[d.seg] = v; Save.store(); Snd.ui('click'); resize(); return UI.draw(); }
    if (d.tab) { UI.shopTab = d.tab; Snd.ui('click'); return UI.shopDraw(); } if (d.buy) return UI.buy(d.buy);
    if (d.do === 'ssr') { Snd.ui('click'); return leaveTo('Steel%20Storm%20Rebuilt'); }      // Steel Storm Remastered lives in the folder 'Steel Storm Rebuilt'
    if (d.do === 'shop') { const G = Game; if (App.game && (G.phase === 'break' || G.rule === 'rush') && G.wave > 0 && !G.over && !G.shopOpen) UI.shop(true); return; }
    if (d.do === 'wave' || d.do === 'shopgo') { const G = Game; if (!App.game || G.over) return; if (G.shopOpen) UI.shop(false); else lock(); if (G.phase === 'break' && G.wave > 0) G.phaseT = Math.min(G.phaseT, 0.01); return; }
    if (d.do === 'shopx') return UI.shop(false); if (d.do === 'fs') { const el = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen().catch(() => { }); } catch (x) { } return; }
    if (d.do === 'speed') { Snd.ui('click'); return UI.speedTest(); }
    if (d.do === 'intro') { UI.close(); $('menu').classList.add('hidden'); Ash2D.stop(); Music.stop(); return UI.intro(true); }
    if (d.do === 'tomenu') { Snd.ui('click'); const party = !!Game.net && Net.on; Game.net = null; Game.stop(); UI.menu(); if (party) { Net.state = 'lobby'; for (const k in Net.tags) { Net.tags[k].remove(); } Net.tags = {}; UI.open('mp'); } return; }
    if (d.do === 'again') { Snd.ui('click'); $('results').classList.add('hidden'); App.paused = false; Game.shown = false; Game.start({ map: World.id, diff: Game.diff, cls: Game.cls, rule: Game.rule, op: Game.op ? Game.op.def.id : undefined }); return lock(); }
    if (d.do === 'nextop') { Snd.ui('click'); const nx = OPS[OPS.indexOf(Game.op.def) + 1]; Game.stop(); App.game = null; App.paused = true; return UI.play({ map: HAVE[MAPS[nx.map].file] === true ? nx.map : 'yard', diff: nx.diff, cls: Game.cls, rule: 'rush', op: nx.id }); }
    if (d.net) return Net.click(d);
});
document.addEventListener('input', e => { const t = e.target, k = t.dataset && t.dataset.set; if (k) { Save.data.settings[k] = +t.value; Save.store(); Snd.volumes(); const b = t.parentNode.querySelector('b'); if (b) b.textContent = k === 'fov' ? t.value + '°' : k === 'sfx' || k === 'music' ? Math.round(t.value * 100) + '%' : (+t.value).toFixed(2); } else if (t.dataset && t.dataset.netin) Net.input(t); });
UI.key = function (e) {
    const c = e.code; if (c === 'KeyP' && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) && App.screen !== 'intro') return Armory.testUnlock();
    if ((c === 'BracketRight' || c === 'BracketLeft') && Save.data.testAll && App.game && !Game.shopOpen) return Armory.testGun(c === 'BracketRight' ? 1 : -1);
    if (App.screen === 'menu' && !UI.panel) { if (c === 'ArrowDown' || c === 'KeyS') { UI.nav(UI.navI + 1); Snd.ui('hover'); } else if (c === 'ArrowUp' || c === 'KeyW') { UI.nav(UI.navI - 1); Snd.ui('hover'); } else if (c === 'Enter' || c === 'Space') { const b = document.querySelectorAll('#menu-nav button')[UI.navI]; if (b) UI.act(b.dataset.act); } return; }
    if (c === 'Escape') { if (UI.panel) { Snd.ui('back'); UI.close(); } else if (Game.shopOpen) UI.shop(false); else if (App.game && UI.paused) UI.pause(false); else if (App.game && !document.pointerLockElement && !Game.over) UI.pause(true); return; }
    if (c === 'KeyB' && Game.shopOpen && App.game) { UI.shop(false); delete hit.KeyB; }
    if (c === 'Enter' && Game.shopOpen && App.game && Game.phase === 'break' && Game.rule !== 'rush' && Game.wave > 0 && !Input.typing()) { UI.shop(false); Game.phaseT = Math.min(Game.phaseT, 0.01); delete hit.Enter; }
    if (c === 'Tab' && App.game && Game.net) $('scores').classList.remove('hidden');
};
addEventListener('keyup', e => { if (e.code === 'Tab') $('scores').classList.add('hidden'); });
