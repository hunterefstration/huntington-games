// ============================================================
// The page round the game. The opening (hangar doors part on the vehicle, the name is stamped on letter by letter), then
// one frame for everything outside a battle: a bar along the top (HOME, BATTLE, GARAGE, RESEARCH, SETTINGS, your research
// points and credits) over the chosen vehicle standing on the ground it will fight on. Pause, the end of a battle.
// ============================================================
const UI = { panel: '', tab: 'home', map: 'range', mode: 'tdm', size: 5, skill: 'normal', rsel: '', line: 'g', wx: 'clear', len: 'normal', ff: false };
UI.logo = cls => '<div class="sslogo ' + (cls || '') + '"><div>' + 'STEEL STORM'.split('').map((c, i) => c === ' ' ? '<i></i>' : '<span style="--i:' + i + '">' + c + '</span>').join('') + '</div><em>REMASTERED</em></div>';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TIPS = ['The ring is where your shell will land. Wait for it to turn green.', 'Rear and side armour is thin. Get round them.', 'A shell that strikes at a shallow angle glances off. Face them square, catch them slanted.', 'E brings up the gunner\'s sight for the far shots.', 'HE does not care about armour angle and hurts everything near where it lands.', 'Keep moving: their gunners lead you, and a change of speed throws them off.', 'R spends a repair kit.', 'A tank destroyer has no turret: turn the hull to bring the gun round.', 'Artillery lobs its shell: aim at the ground where they will be, not at them.', 'In Conquest, sit inside a ring to take it. More tanks take it faster.', 'An aircraft goes where you look. Keep your speed, and keep off the ground.', 'Anti-air tanks are the only ground vehicles that shoot at aircraft. Bring one, or hunt theirs.', 'Research points open the next vehicle of a branch; credits buy it and improve its modules.'];
const own = id => !!Save.data.own[id], researched = id => own(id) || !!Save.data.res[id] || VEHS[id].rp === 0;
const canResearch = id => { const v = VEHS[id]; return v.tier === 1 || own(v.br + (v.tier - 1)); };
const anyKey = ms => new Promise(r => { const f = () => { removeEventListener('keydown', f); removeEventListener('mousedown', f); r(); }; addEventListener('keydown', f); addEventListener('mousedown', f); if (ms) setTimeout(f, ms); });

// ---- the opening: a key (sound needs one), an engine turning over, the doors part, the name is stamped on
UI.intro = async function () {
    const box = $('intro'), tx = $('intro-text'); App.screen = 'intro'; box.className = ''; tx.innerHTML = '<span class="press">[ PRESS ANY KEY ]</span>';
    await anyKey(); Snd.init(); tx.innerHTML = ''; UI.bgLoad();
    // the starter, then the engine catching
    for (let i = 0; i < 5; i++) { Snd.noise(0.25, 500, 90, 0.12); Snd.tone(48 + i * 3, 0.3, 0.14, 'sawtooth', 40); await sleep(150); }
    Snd.tone(38, 0.55, 3.2, 'sawtooth', 62); Snd.noise(0.35, 300, 60, 2.4); await sleep(450);
    App.screen = 'menu'; box.classList.add('open'); Snd.noise(0.5, 1800, 200, 1.3); Snd.tone(70, 0.3, 1.3, 'square', 55); await sleep(900);
    tx.innerHTML = UI.logo('big') + '<div class="lamps"><span>ENGINE</span><span>GUN</span><span>CREW</span></div><div class="go">CLICK TO ROLL OUT</div>';
    const L = [...tx.querySelectorAll('.sslogo span')]; for (let i = 0; i < L.length; i++) { await sleep(85); L[i].classList.add('in'); Snd.noise(0.5, 3200, 500, 0.07); Snd.tone(150 + (i % 3) * 22, 0.3, 0.09, 'square', 70); }
    await sleep(260); tx.querySelector('.sslogo').classList.add('done'); Snd.boom(0.8); document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake');
    for (const s of tx.querySelectorAll('.lamps span')) { await sleep(330); s.classList.add('on'); Snd.tone(880, 0.14, 0.09, 'square', 880); }
    tx.querySelector('.go').classList.add('in'); Save.data.intro = true; Save.store();
    await sleep(300); await anyKey(7000); Snd.ui('click'); box.classList.add('hidden'); UI.menu();
};
// the ground comes in behind the menu when it is ready
UI.bgLoad = function () { if (World.loaded || UI.bgLoading || !R) return; UI.bgLoading = true; World.check().then(() => { if (HAVE.valley === true && !UI.picked && !Q.get('ground')) UI.map = 'valley'; return World.load(null, UI.map); }).then(() => { UI.bgLoading = false; if (App.screen === 'menu' && !UI.panel) UI.page(); }).catch(e => { UI.bgLoading = false; App.errors.push('terrain: ' + e.message); }); };
UI.menu = function () {
    App.screen = 'menu'; App.game = null; App.paused = true; UI.close(); Music.set('menu'); if (World.loaded) World.weather('clear');
    for (const id of ['hud', 'vig', 'stats', 'pause', 'results', 'loading', 'intro']) $(id).classList.add('hidden');
    $('menu').classList.remove('hidden'); $('top-logo').innerHTML = UI.logo('small'); UI.fresh = true;
    $('menu-foot').innerHTML = '<span>STEEL STORM REMASTERED ' + VERSION + (BUILD ? ' &middot; BUILD ' + esc(BUILD) : '') + '</span><span>' + esc(TIPS[(Math.random() * TIPS.length) | 0]) + '</span>';
    UI.page(); UI.bgLoad();
};
UI.tabTo = function (t) { Snd.ui('click'); if (t === 'settings') return UI.open('settings'); UI.fresh = UI.tab !== t; UI.tab = t; UI.close(); UI.page(); };
const bars = v => [['Armour', v.hp / 2.95], ['Speed', v.speed / 1.5], ['Rate of fire', Math.min(1, 0.62 / v.reload)], ['Gun', v.dmg * (v.shells && v.shells[0] === 'hh' ? 1.5 : v.shells ? 0.2 : 1) / 3.1]].map(b => '<div class="stat"><span>' + b[0] + '</span><div><i style="width:' + Math.round(clamp(b[1], 0.04, 1) * 100) + '%"></i></div></div>').join('');
// the vehicle to work toward: the next tier of the branch you are driving, else the cheapest one that can be opened
UI.next = function () { const sv = Save.data, v = VEHS[sv.veh] || VEHS.mt1, up = VEHS[v.br + (v.tier + 1)]; if (up && !own(up.id)) return up; return VEH_IDS.map(id => VEHS[id]).filter(x => !own(x.id) && canResearch(x.id)).sort((a, b) => a.rp + a.cr / 5 - b.rp - b.cr / 5)[0] || null; };
UI.nextHTML = function () { const n = UI.next(), sv = Save.data; if (!n) return ''; const res = researched(n.id), have = res ? sv.cr : sv.rp, need = res ? n.cr : n.rp, ok = have >= need;
    return '<div class="goal"><small>NEXT: ' + n.name + ' &middot; ' + BR[n.br].one.toUpperCase() + ' ' + TIER[n.tier] + '</small><div class="xp"><i style="width:' + Math.round(clamp(have / Math.max(1, need), 0, 1) * 100) + '%"></i></div><span>' + (ok ? '<b>READY</b> to ' + (res ? 'buy' : 'research') + ' in RESEARCH' : Math.min(have, need) + ' / ' + need + (res ? ' credits to buy it' : ' research points to open it')) + '</span></div>'; };
const tag = v => v.br.toUpperCase() + '-' + v.tier + ' &middot; ' + BR[v.br].one.toUpperCase() + ' &middot; TIER ' + TIER[v.tier];
UI.page = function () {
    const sv = Save.data, s = sv.stats, v = VEHS[sv.veh] || VEHS.mt1, t = UI.tab, P = $('page');
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === t);
    $('purse').innerHTML = '<span class="rp"><small>RESEARCH</small>' + sv.rp + '</span><span class="cr"><small>CREDITS</small>' + sv.cr + '</span>';
    P.className = 'p-' + t + (UI.fresh ? ' fresh' : '');
    if (t === 'home') P.innerHTML = '<div class="plate"><small>YOUR VEHICLE</small><h2>' + v.name + '</h2><div class="tagline">' + tag(v) + '</div><p>' + esc(v.desc) + '</p>' + bars(v) + UI.nextHTML() + '</div>' +
        '<div class="deck"><button class="btn go huge" data-do="deploy">TO BATTLE<small>' + MODES[UI.mode].name + ' &middot; ' + MAPS[UI.map].name + '</small></button>' + (sv.trained ? '' : '<button class="btn" data-do="train">NEW HERE? TRAINING</button>') + '<button class="btn" data-tab="battle">CHANGE THE BATTLE</button><button class="btn" data-tab="garage">GARAGE</button></div>' +
        '<div class="record"><div><b>' + s.battles + '</b><small>battles</small></div><div><b>' + s.wins + '</b><small>won</small></div><div><b>' + s.kills + '</b><small>knocked out</small></div><div><b>' + s.bestWave + '</b><small>best wave</small></div><div><b>' + VEH_IDS.filter(own).length + ' / ' + VEH_IDS.length + '</b><small>vehicles</small></div><button class="btn" data-do="ash">ASHFALL &rarr;</button></div>';
    else if (t === 'battle') { const maps = World.maps(); P.innerHTML = '<div class="sheet"><div class="h3">The battle</div><div class="tiles one">' + Object.keys(MODES).map(id => '<button class="tile' + (UI.mode === id ? ' sel' : '') + '" data-mode="' + id + '"><b>' + MODES[id].name + '</b><small>' + esc(MODES[id].blurb) + '</small></button>').join('') + '</div>' +
        '<div class="h3">The ground</div><div class="tiles two">' + (maps.length ? maps : [UI.map]).map(id => '<button class="tile' + (UI.map === id ? ' sel' : '') + '" data-map="' + id + '"><b>' + MAPS[id].name + '</b><small>' + esc(MAPS[id].blurb || '') + '</small></button>').join('') + '</div>' +
        (UI.mode !== 'waves' ? '<div class="pair"><div><div class="h3">Tanks a side</div><div class="seg">' + [3, 4, 5, 6].map(n => '<button data-size="' + n + '" class="' + (UI.size === n ? 'on' : '') + '">' + n + ' v ' + n + '</button>').join('') + '</div></div><div><div class="h3">Their crews</div><div class="seg">' + Object.keys(BOT_SKILL).map(id => '<button data-skill="' + id + '" class="' + (UI.skill === id ? 'on' : '') + '">' + BOT_SKILL[id].name + '</button>').join('') + '</div></div></div>' : '') +
        (UI.mode !== 'waves' ? '<div class="pair"><div><div class="h3">How long</div><div class="seg">' + Object.keys(LENGTHS).map(id => '<button data-len="' + id + '" class="' + (UI.len === id ? 'on' : '') + '">' + LENGTHS[id].name + '</button>').join('') + '</div></div><div><div class="h3">Friendly fire</div><div class="seg"><button data-ff="0" class="' + (UI.ff ? '' : 'on') + '">OFF</button><button data-ff="1" class="' + (UI.ff ? 'on' : '') + '">ON</button></div></div></div>' : '') +
        '<div class="h3" style="margin-top:10px">The weather</div><div class="seg">' + Object.keys(WEATHER).map(id => '<button data-wx="' + id + '" class="' + (UI.wx === id ? 'on' : '') + '">' + WEATHER[id].name + '</button>').join('') + '</div>' +
        '<div class="roll"><span>' + v.name + ' &middot; ' + tag(v) + '</span><button class="btn go" data-do="deploy">ROLL OUT</button></div></div>'; }
    else if (t === 'garage') { const m = sv.mods[v.id] || {};
        P.innerHTML = '<div class="sheet"><div class="h3">Your vehicles</div>' + BRANCHES.map(b => { const L = VEH_IDS.filter(id => VEHS[id].br === b.id && own(id)); return L.length ? '<div class="brow"><small>' + b.name + '</small>' + L.map(id => '<button class="tile' + (sv.veh === id ? ' sel' : '') + '" data-veh="' + id + '"><b>' + VEHS[id].name + '</b><small>TIER ' + TIER[VEHS[id].tier] + '</small></button>').join('') + '</div>' : ''; }).join('') + '<p class="hint">More vehicles come from RESEARCH.</p></div>' +
            '<div class="sheet right"><small class="tagline">' + tag(v) + '</small><h2>' + v.name + '</h2><p>' + esc(v.desc) + '</p>' + bars(v) + '<div class="h3" style="margin-top:14px">Modules</div>' + Object.keys(MODS).map(k => { const l = m[k] || 0, c = modCost(v.id, l); return '<div class="mod"><div><b>' + MODS[k].name + '</b><small>' + MODS[k].desc + '</small></div><span class="pips">' + [0, 1, 2].map(i => '<i class="' + (i < l ? 'on' : '') + '"></i>').join('') + '</span><button class="btn" data-mod="' + k + '"' + (l >= MOD_MAX || sv.cr < c ? ' disabled' : '') + '>' + (l >= MOD_MAX ? 'MAX' : c + ' CR') + '</button></div>'; }).join('') + '</div>'; }
    else if (t === 'mp') P.innerHTML = Net.pageHTML();
    else if (t === 'research') { const r = VEHS[UI.rsel] || v; UI.rsel = r.id; const cols = BRANCHES.filter(b => (b.ln || 'g') === UI.line), hasAir = Object.keys(AIRS).some(a => Units.extra[a]), old = P.querySelector('.tree'), sc = old ? old.scrollTop : 0;
        P.innerHTML = '<div class="sheet pickbox" id="pick">' + UI.pickHTML(r) + '</div><div class="sheet tree">' + (hasAir ? '<div class="seg lines">' + [['g', 'GROUND FORCES'], ['a', 'AIR FORCES']].map(l => '<button data-line="' + l[0] + '" class="' + (UI.line === l[0] ? 'on' : '') + '">' + l[1] + '</button>').join('') + '</div>' : '') + '<div class="grid" style="grid-template-columns:repeat(' + cols.length + ',minmax(0,1fr))">' + cols.map(b => '<div class="col"><div class="h3">' + b.name + '</div>' + [1, 2, 3, 4, 5].map(tr => { const x = VEHS[b.id + tr], s2 = own(x.id) ? 'own' : researched(x.id) ? 'buy' : canResearch(x.id) ? 'res' : 'lock'; return '<button class="cell ' + s2 + (r.id === x.id ? ' sel' : '') + (sv.veh === x.id ? ' cur' : '') + '" data-res="' + x.id + '"><small>' + TIER[tr] + '</small><b>' + x.name + '</b><span>' + (s2 === 'own' ? 'OWNED' : s2 === 'buy' ? x.cr + ' CR' : s2 === 'res' ? x.rp + ' RP' : 'LOCKED') + '</span></button>'; }).join('') + '</div>').join('') + '</div></div>';
        const tr = P.querySelector('.tree'); if (tr) tr.scrollTop = sc; }
    UI.fresh = false;
};
// the plate about the vehicle picked on the research page (the vehicle itself stands behind it)
UI.pickHTML = function (r) { const sv = Save.data, st = own(r.id) ? 'own' : researched(r.id) ? 'buy' : canResearch(r.id) ? 'res' : 'lock';
    return '<small class="tagline">' + tag(r) + '</small><h2>' + r.name + '</h2><p>' + esc(r.desc) + '</p>' + bars(r) + '<div class="act">' + (st === 'own' ? (sv.veh === r.id ? '<button class="btn" disabled>YOUR VEHICLE</button>' : '<button class="btn go" data-veh="' + r.id + '">TAKE IT</button>') : st === 'buy' ? '<button class="btn go" data-do="buy"' + (sv.cr < r.cr ? ' disabled' : '') + '>BUY &middot; ' + r.cr + ' CR</button>' : st === 'res' ? '<button class="btn go" data-do="research"' + (sv.rp < r.rp ? ' disabled' : '') + '>RESEARCH &middot; ' + r.rp + ' RP</button>' : '<button class="btn" disabled>NEEDS ' + VEHS[r.br + (r.tier - 1)].name + '</button>') + '</div>'; };
UI.act = function (a) { Snd.init(); Snd.ui('click'); if (a === 'settings' || a === 'psettings') UI.open('settings'); else if (a === 'resume') UI.pause(false); else if (a === 'quit') { if (Game.net) Net.leave(); Game.stop(); UI.menu(); } };
UI.open = function (name) { UI.panel = name; $('panel').classList.remove('hidden'); $('panel-title').textContent = { settings: 'SETTINGS', up: 'FIELD UPGRADE' }[name]; $('panel-x').style.visibility = name === 'up' ? 'hidden' : ''; UI.draw(); };
UI.close = function () { if (!UI.panel) return; UI.panel = ''; $('panel').classList.add('hidden'); };
UI.draw = function () {
    if (!UI.panel) return UI.page();
    if (UI.panel === 'up') { $('panel-body').innerHTML = '<p style="color:#b9b2a6">The crew has time for one job before the next wave. Pick it.</p><div class="tiles">' + UI.upChoice.map(id => '<button class="tile" data-up="' + id + '" style="padding:18px 16px"><b>' + UPGRADES[id].name + '</b><small>' + UPGRADES[id].desc + '</small></button>').join('') + '</div>'; return; }
    const s = Save.data.settings, rng = (k, lo, hi, step, label, fmt) => '<div class="row"><label>' + label + '</label><span><input type="range" data-set="' + k + '" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + s[k] + '"> <b style="display:inline-block;width:48px;text-align:right">' + fmt(s[k]) + '</b></span></div>';
    const seg = (k, opts, label, hint) => '<div class="row"><label>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</label><div class="seg">' + opts.map(o => '<button data-seg="' + k + '" data-v="' + o[0] + '" class="' + (String(s[k]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div></div>';
    $('panel-body').innerHTML = '<div class="cols"><div>' + rng('sens', 0.3, 3, 0.05, 'Aim speed', v => (+v).toFixed(2)) + rng('adsSens', 0.4, 1.6, 0.05, 'Aim speed in the gun sight', v => (+v).toFixed(2)) + rng('fov', 50, 75, 1, 'Field of view', v => v + '°') +
        seg('aimToggle', [[true, 'PRESS E'], [false, 'HOLD E']], 'Gun sight', 'the right button and Shift always work as well') + seg('shake', [[true, 'ON'], [false, 'OFF']], 'Screen shake') + seg('quality', [['auto', 'AUTO'], ['low', 'LOW']], 'Picture') +
        rng('sfx', 0, 1, 0.05, 'Sound', v => Math.round(v * 100) + '%') + rng('music', 0, 1, 0.05, 'Music', v => Math.round(v * 100) + '%') + '<div class="row"><label>Full screen</label><button class="btn" data-do="fs">TOGGLE</button></div><div class="row"><label>The opening</label><button class="btn" data-do="intro">PLAY IT AGAIN</button></div></div>' +
        '<div><div class="h3">Controls</div><div class="keys">' + [['W A S D', 'drive'], ['Mouse', 'aim the gun (up and down too)'], ['Click or Space', 'fire (hold it for an autocannon)'], ['E', 'gunner\'s sight'], ['1 2', 'which shell'], ['R', 'repair kit'], ['Flying', 'look where you want to go; W S throttle; 1 2 3 gun, rockets, bombs'], ['Tab', 'scores (team battles)'], ['Enter', 'call the next wave'], ['Esc', 'pause'], ['F3', 'numbers']].map(k => '<div><kbd>' + k[0] + '</kbd>' + k[1] + '</div>').join('') + '</div></div></div>';
};
// after a wave: three jobs to choose from (the mouse is let go while choosing, the next wave waits)
UI.upgrade = function () { const G = Game, ids = Object.keys(UPGRADES).sort(() => Math.random() - 0.5).slice(0, 3); UI.upChoice = ids; G.shopOpen = true; if (document.pointerLockElement) document.exitPointerLock(); UI.open('up'); };
// o = what Game.start takes; none: what the BATTLE page says, in the vehicle of the garage
UI.play = async function (o) {
    o = o || { mode: UI.mode, veh: Save.data.veh, size: UI.size, skill: UI.skill, wx: UI.wx, len: UI.len, ff: UI.ff };
    UI.close(); $('menu').classList.add('hidden'); $('results').classList.add('hidden'); const L = $('loading'); L.classList.remove('hidden'); $('load-logo').innerHTML = $('load-logo').innerHTML || UI.logo('small'); $('load-map').textContent = MAPS[UI.map].name; $('load-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0]; const bar = $('load-bar').firstElementChild; bar.style.width = '10%';
    try { await World.check(); if (HAVE.valley === true && !UI.picked && !Q.get('ground')) UI.map = 'valley'; $('load-map').textContent = (MODES[o.mode] ? MODES[o.mode].name + ' · ' : '') + MAPS[UI.map].name; await World.load(f => { bar.style.width = Math.round(f * 100) + '%'; }, UI.map); } catch (e) { L.classList.add('hidden'); UI.menu(); UI.fatal('Could not load: ' + e.message, true); return false; }
    bar.style.width = '100%'; await sleep(200); L.classList.add('hidden'); App.screen = 'game'; App.game = Game; App.paused = false; App.demo = false;
    $('hud').classList.remove('hidden'); $('vig').classList.remove('hidden'); $('stats').classList.toggle('hidden', !App.showStats); resize();
    Game.start(o); lock(); return true;
};
UI.fatal = function (text, soft) { const f = $('fatal'); f.classList.remove('hidden'); f.innerHTML = '<div>' + esc(text) + (soft ? '<br><br><button class="btn" onclick="this.parentNode.parentNode.classList.add(\'hidden\')">OK</button>' : '') + '</div>'; };
UI.pause = function (on) {
    if (!App.game || Game.over) return; if (on && !Game.net) { App.paused = true; Snd.engine(0, false); } $('pause').classList.toggle('hidden', !on); UI.paused = on;
    if (!on) { App.paused = false; UI.close(); lock(); } else if (document.pointerLockElement) document.exitPointerLock();
    Game.hint();
};
UI.results = function (r) {
    if (document.pointerLockElement) document.exitPointerLock(); $('results').classList.remove('hidden'); $('scores').classList.add('hidden');
    const pay = '<div class="pay"><span class="rp">+' + (r.rp || 0) + ' <small>RESEARCH</small></span><span class="cr">+' + (r.cr || 0) + ' <small>CREDITS</small></span></div>' + UI.nextHTML(), btns = '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn' + (Game.net ? ' go' : '') + '" data-do="tomenu">' + (Game.net ? 'BACK TO THE PARTY' : 'MENU') + '</button>' + (Game.net ? '' : '<button class="btn go" data-do="again">GO AGAIN</button>') + '</div>';
    const clock = Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0');
    if (r.team) $('results').innerHTML = '<div class="box wide"><small style="letter-spacing:.4em;color:var(--ember2)">' + r.sub + '</small><div class="big ' + (r.win === 0 ? 'won' : r.win === 1 ? 'lost' : '') + '">' + r.title + '</div><div class="line">' + r.line + '</div>' +
        '<div class="grid">' + [['knocked out', r.kills], ['times lost', r.deaths], ['score', r.score], ['accuracy', r.acc + '%'], ['time', clock]].map(x => '<div><b>' + x[1] + '</b><small>' + x[0] + '</small></div>').join('') + '</div>' + pay +
        '<div class="boards">' + [0, 1].map(t => '<table class="t' + t + '"><tr><th>' + SIDE[t] + '</th><th>vehicle</th><th>K</th><th>D</th><th>score</th></tr>' + r.rows.filter(x => x.team === t).map(x => '<tr class="' + (x.me ? 'me' : '') + '"><td>' + esc(x.name) + '</td><td>' + esc(x.veh) + '</td><td>' + x.kills + '</td><td>' + x.deaths + '</td><td>' + x.score + '</td></tr>').join('') + '</table>').join('') + '</div>' + btns + '</div>';
    else $('results').innerHTML = '<div class="box"><small style="letter-spacing:.4em;color:var(--ember2)">' + (r.title || 'KNOCKED OUT ON WAVE ' + r.wave) + '</small><div class="big">' + (r.big || r.score) + '</div>' + (r.record ? '<div style="color:var(--good);letter-spacing:.3em;font-weight:700">NEW BEST</div>' : '') +
        '<div class="grid">' + [['tanks destroyed', r.kills], ['accuracy', r.acc + '%'], ['wave reached', r.wave], ['time', clock]].map(x => '<div><b>' + x[1] + '</b><small>' + x[0] + '</small></div>').join('') + '</div>' + pay + btns + '</div>';
};
document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled && b !== UI.hov) { UI.hov = b; Snd.ui('hover'); } });
document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return; const d = b.dataset, sv = Save.data; Snd.init();
    if (d.act) return UI.act(d.act);
    if (d.tab) return UI.tabTo(d.tab);
    if (b.id === 'panel-x') { Snd.ui('back'); UI.close(); if (App.game && App.paused) $('pause').classList.remove('hidden'); return; }
    if (d.seg) { const v = d.v === 'true' ? true : d.v === 'false' ? false : d.v; sv.settings[d.seg] = v; Save.store(); Snd.ui('click'); resize(); return UI.draw(); }
    if (d.do === 'fs') { const el = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen().catch(() => { }); } catch (x) { } return; }
    if (d.do === 'intro') { UI.close(); $('menu').classList.add('hidden'); Music.stop(); return UI.intro(); }
    if (d.mode) { UI.mode = d.mode; Snd.ui('click'); return UI.page(); }
    if (d.size) { UI.size = +d.size; Snd.ui('click'); return UI.page(); }
    if (d.wx) { UI.wx = d.wx; Snd.ui('click'); return UI.page(); }
    if (d.len) { UI.len = d.len; Snd.ui('click'); return UI.page(); }
    if (d.ff) { UI.ff = d.ff === '1'; Snd.ui('click'); return UI.page(); }
    if (d.skill) { UI.skill = d.skill; Snd.ui('click'); return UI.page(); }
    if (d.map) { UI.map = d.map; UI.picked = true; Snd.ui('click'); UI.page(); if (!App.game && !UI.bgLoading) { UI.bgLoading = true; World.load(null, UI.map).then(() => { UI.bgLoading = false; }, () => { UI.bgLoading = false; }); } return; }
    if (d.veh) { if (own(d.veh)) { sv.veh = d.veh; Save.store(); Snd.ui('buy'); Net.kit(); } return UI.page(); }
    if (d.line) { UI.line = d.line; Snd.ui('click'); return UI.page(); }
    if (d.res) { UI.rsel = d.res; Snd.ui('click'); for (const c of document.querySelectorAll('#page .cell')) c.classList.toggle('sel', c.dataset.res === d.res); const pk = $('pick'); if (pk) pk.innerHTML = UI.pickHTML(VEHS[d.res]); else UI.page(); return; }
    if (d.do === 'research') { const r = VEHS[UI.rsel]; if (r && canResearch(r.id) && !researched(r.id) && sv.rp >= r.rp) { sv.rp -= r.rp; sv.res[r.id] = 1; Save.store(); Snd.ui('buy'); Snd.tone(520, 0.2, 0.5, 'triangle', 1040); } return UI.page(); }
    if (d.do === 'buy') { const r = VEHS[UI.rsel]; if (r && researched(r.id) && !own(r.id) && sv.cr >= r.cr) { sv.cr -= r.cr; sv.own[r.id] = 1; sv.veh = r.id; Save.store(); Snd.ui('buy'); Snd.boom(0.4); } return UI.page(); }
    if (d.mod) { const id = sv.veh, m = sv.mods[id] || (sv.mods[id] = {}), l = m[d.mod] || 0, c = modCost(id, l); if (l < MOD_MAX && sv.cr >= c) { sv.cr -= c; m[d.mod] = l + 1; Save.store(); Snd.ui('buy'); if (Units.show) { Units.retire(Units.show); Units.show = null; } } return UI.page(); }
    if (d.do === 'deploy') { Snd.ui('click'); return UI.play(); }
    if (d.do === 'train') { Snd.ui('click'); return UI.play({ mode: 'train', veh: sv.veh }); }
    if (d.up) { const G = Game; UPGRADES[d.up].apply(G.P, G); G.ups.push(d.up); G.shopOpen = false; Snd.ui('buy'); HUD.callout(UPGRADES[d.up].name); UI.close(); $('panel-x').style.visibility = ''; return lock(); }
    if (d.do === 'ash') { Snd.ui('click'); return leaveTo('Ashfall'); }
    if (d.do === 'tomenu') { Snd.ui('click'); const party = !!Game.net && Net.on; Game.stop(); Game.net = null; UI.menu(); if (party) { Net.state = 'lobby'; UI.tab = 'mp'; UI.page(); if (Net.host) Net.lobby(); } return; }
    if (d.do === 'again') { Snd.ui('click'); $('results').classList.add('hidden'); App.paused = false; Game.start(); return lock(); }
});
document.addEventListener('input', e => { const t = e.target, k = t.dataset && t.dataset.set; if (k) { Save.data.settings[k] = +t.value; Save.store(); Snd.volumes(); const b = t.parentNode.querySelector('b'); if (b) b.textContent = k === 'fov' ? t.value + '°' : k === 'sfx' || k === 'music' ? Math.round(t.value * 100) + '%' : (+t.value).toFixed(2); } });
UI.key = function (e) {
    const c = e.code;
    if (c === 'KeyP' && App.screen !== 'intro' && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) { const sv = Save.data; for (const id of VEH_IDS) { sv.own[id] = 1; sv.res[id] = 1; } sv.rp += 500000; sv.cr += 5000000; Save.store(); Snd.ui('buy'); if (App.game) HUD.banner('TEST MODE', 'every vehicle is unlocked'); else { UI.page(); UI.fatal('TEST MODE: every vehicle is yours, with research points and credits to spare.', true); } return; }
    if (App.screen === 'menu' && !UI.panel && !App.game) { const T = ['home', 'battle', 'garage', 'research', 'mp'], i = T.indexOf(UI.tab); if ($('menu').classList.contains('hidden')) return; if (c === 'ArrowRight' || c === 'KeyD') UI.tabTo(T[(i + 1) % T.length]); else if (c === 'ArrowLeft' || c === 'KeyA') UI.tabTo(T[(i + T.length - 1) % T.length]); else if (c === 'Enter') UI.play(); return; }
    if (c === 'Escape') { if (UI.panel) { Snd.ui('back'); UI.close(); if (App.game && App.paused) $('pause').classList.remove('hidden'); } else if (App.game && UI.paused) UI.pause(false); else if (App.game && !document.pointerLockElement && !Game.over) UI.pause(true); }
    if (c === 'Tab' && App.game && Game.teams && !Game.over) { $('scores').innerHTML = Game.scoresHTML(); $('scores').classList.remove('hidden'); }
};
addEventListener('keyup', e => { if (e.code === 'Tab') $('scores').classList.add('hidden'); });
