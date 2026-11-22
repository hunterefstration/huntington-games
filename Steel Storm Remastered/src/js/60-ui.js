// ============================================================
// The page round the game: the name, the main menu over a slow turn round the proving ground, settings, pause, the end.
// ============================================================
const UI = { panel: '', navI: 0, cls: 'medium', map: 'range' };
UI.logo = () => '<svg class="logo" viewBox="0 0 900 190" role="img" aria-label="STEEL STORM"><g filter="url(#lg-erode)"><text x="450" y="150" text-anchor="middle" textLength="870" lengthAdjust="spacingAndGlyphs" fill="url(#lg-fill)" font-style="italic">STEEL STORM</text></g></svg>';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TIPS = ['The ring is where your shell will land. Wait for it to turn green.', 'Rear and side armour is thin. Get round them.', 'A shell that strikes at a shallow angle glances off. Face them square, catch them slanted.', 'E brings up the gunner\'s sight for the far shots.', 'HE does not care about armour angle and hurts everything near where it lands.', 'Keep moving: their gunners lead you, and a change of speed throws them off.', 'R spends a repair kit. Clearing a wave gives one back.'];
// the name: wait for a key (sound needs one), then it lands
UI.intro = async function () {
    const box = $('intro'), tx = $('intro-text'); App.screen = 'intro'; box.classList.remove('hidden', 'name');
    tx.innerHTML = '<span style="animation:pulse 1.4s infinite;letter-spacing:.3em;font-size:.6em">[ PRESS ANY KEY ]</span>';
    await new Promise(r => { const f = () => { removeEventListener('keydown', f); removeEventListener('mousedown', f); r(); }; addEventListener('keydown', f); addEventListener('mousedown', f); });
    Snd.init(); box.classList.add('name'); tx.innerHTML = UI.logo() + '<div class="sub">REMASTERED</div><div class="go">CLICK TO BEGIN</div>';
    const fl = $('flash'); fl.className = ''; void fl.offsetWidth; fl.className = 'go'; document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); Snd.boom(1); Snd.tone(65, 0.5, 2.2, 'sawtooth', 44);
    await sleep(800); await new Promise(r => { const f = () => { removeEventListener('keydown', f); removeEventListener('mousedown', f); r(); }; addEventListener('keydown', f); addEventListener('mousedown', f); setTimeout(f, 3500); });
    Snd.ui('click'); box.classList.add('hidden'); UI.menu();
};
UI.menu = function () {
    App.screen = 'menu'; App.game = null; App.paused = true; UI.close(); Music.set('menu');
    for (const id of ['hud', 'vig', 'stats', 'pause', 'results', 'loading', 'intro']) $(id).classList.add('hidden');
    $('menu').classList.remove('hidden'); $('menu-logo').innerHTML = UI.logo(); const s = Save.data.stats;
    $('menu-card').innerHTML = '<div class="rank">PROVING GROUND</div><div>BEST SCORE <b>' + s.bestScore + '</b> &nbsp; BEST WAVE <b>' + s.bestWave + '</b></div><div>TANKS DESTROYED <b>' + s.kills + '</b></div><div style="margin-top:14px"><button class="btn" data-do="ash">ASHFALL &rarr;</button></div>';
    $('menu-foot').innerHTML = '<span>STEEL STORM REMASTERED ' + VERSION + (BUILD ? ' &middot; BUILD ' + esc(BUILD) : '') + ' &middot; the garage, aircraft and multiplayer of Steel Storm follow</span><span>' + esc(TIPS[(Math.random() * TIPS.length) | 0]) + '</span>';
    UI.nav(UI.navI);
    if (!World.loaded && !UI.bgLoading && R) { UI.bgLoading = true; World.check().then(() => World.load(null, UI.map)).then(() => { UI.bgLoading = false; }).catch(e => { UI.bgLoading = false; App.errors.push('terrain: ' + e.message); }); }
};
UI.nav = function (i) { const b = [...document.querySelectorAll('#menu-nav button')]; UI.navI = (i + b.length) % b.length; b.forEach((x, k) => x.classList.toggle('sel', k === UI.navI)); };
UI.act = function (a) {
    Snd.init(); Snd.ui('click');
    if (a === 'play') UI.open('play'); else if (a === 'settings' || a === 'psettings') UI.open('settings');
    else if (a === 'resume') UI.pause(false); else if (a === 'quit') { Game.stop(); UI.menu(); }
};
UI.open = function (name) { UI.panel = name; $('panel').classList.remove('hidden'); $('panel-title').textContent = { settings: 'SETTINGS', play: 'SKIRMISH', up: 'FIELD UPGRADE' }[name]; $('panel-x').style.visibility = name === 'up' ? 'hidden' : ''; UI.draw(); };
UI.close = function () { if (!UI.panel) return; UI.panel = ''; $('panel').classList.add('hidden'); };
UI.draw = function () {
    if (UI.panel === 'play') { const k = KINDS[UI.cls], maps = World.maps(); $('panel-body').innerHTML = '<div class="cols"><div>' + (maps.length > 1 ? '<div class="h3">Where</div><div class="tiles" style="margin-bottom:8px">' + maps.map(id => '<button class="tile' + (UI.map === id ? ' sel' : '') + '" data-map="' + id + '"><b>' + MAPS[id].name + '</b></button>').join('') + '</div><p style="color:#b9b2a6">' + esc(MAPS[UI.map].blurb) + '</p>' : '') + '<div class="h3">Your tank</div><div class="tiles">' + Object.keys(KINDS).map(id => '<button class="tile' + (UI.cls === id ? ' sel' : '') + '" data-cls="' + id + '"><b>' + KINDS[id].name + '</b><small>hull ' + Math.round(TD.hp * KINDS[id].hp) + '</small></button>').join('') + '</div></div><div class="detail"><h3>' + k.name + '</h3><p>' + esc(k.desc) + '</p>' + [['Armour', k.hp / 1.5], ['Speed', k.speed / 1.3], ['Rate of fire', 0.75 / k.reload], ['Gun', k.dmg / 1.35]].map(b => '<div class="stat"><span>' + b[0] + '</span><div><i style="width:' + Math.round(b[1] * 100) + '%"></i></div></div>').join('') + '<div style="text-align:right;margin-top:14px"><button class="btn go" data-do="deploy">ROLL OUT</button></div></div></div>'; return; }
    if (UI.panel === 'up') { $('panel-body').innerHTML = '<p style="color:#b9b2a6">The crew has time for one job before the next wave. Pick it.</p><div class="tiles">' + UI.upChoice.map(id => '<button class="tile" data-up="' + id + '" style="padding:18px 16px"><b>' + UPGRADES[id].name + '</b><small>' + UPGRADES[id].desc + '</small></button>').join('') + '</div>'; return; }
    const s = Save.data.settings, rng = (k, lo, hi, step, label, fmt) => '<div class="row"><label>' + label + '</label><span><input type="range" data-set="' + k + '" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + s[k] + '"> <b style="display:inline-block;width:48px;text-align:right">' + fmt(s[k]) + '</b></span></div>';
    const seg = (k, opts, label, hint) => '<div class="row"><label>' + label + (hint ? '<small>' + hint + '</small>' : '') + '</label><div class="seg">' + opts.map(o => '<button data-seg="' + k + '" data-v="' + o[0] + '" class="' + (String(s[k]) === String(o[0]) ? 'on' : '') + '">' + o[1] + '</button>').join('') + '</div></div>';
    $('panel-body').innerHTML = '<div class="cols"><div>' + rng('sens', 0.3, 3, 0.05, 'Aim speed', v => (+v).toFixed(2)) + rng('adsSens', 0.4, 1.6, 0.05, 'Aim speed in the gun sight', v => (+v).toFixed(2)) + rng('fov', 50, 75, 1, 'Field of view', v => v + '°') +
        seg('aimToggle', [[true, 'PRESS E'], [false, 'HOLD E']], 'Gun sight', 'the right button and Shift always work as well') + seg('shake', [[true, 'ON'], [false, 'OFF']], 'Screen shake') + seg('quality', [['auto', 'AUTO'], ['low', 'LOW']], 'Picture') +
        rng('sfx', 0, 1, 0.05, 'Sound', v => Math.round(v * 100) + '%') + rng('music', 0, 1, 0.05, 'Music', v => Math.round(v * 100) + '%') + '<div class="row"><label>Full screen</label><button class="btn" data-do="fs">TOGGLE</button></div></div>' +
        '<div><div class="h3">Controls</div><div class="keys">' + [['W A S D', 'drive'], ['Mouse', 'aim the gun (up and down too)'], ['Click or Space', 'fire'], ['E', 'gunner\'s sight'], ['1', 'armour piercing'], ['2', 'high explosive'], ['R', 'repair kit'], ['Enter', 'call the next wave'], ['Esc', 'pause'], ['F3', 'numbers']].map(k => '<div><kbd>' + k[0] + '</kbd>' + k[1] + '</div>').join('') + '</div></div></div>';
};
// after a wave: three jobs to choose from (the mouse is let go while choosing, the next wave waits)
UI.upgrade = function () { const G = Game, ids = Object.keys(UPGRADES).sort(() => Math.random() - 0.5).slice(0, 3); UI.upChoice = ids; G.shopOpen = true; if (document.pointerLockElement) document.exitPointerLock(); UI.open('up'); };
UI.play = async function () {
    UI.close(); $('menu').classList.add('hidden'); const L = $('loading'); L.classList.remove('hidden'); $('load-logo').innerHTML = $('load-logo').innerHTML || UI.logo(); $('load-map').textContent = MAPS[UI.map].name; $('load-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0]; const bar = $('load-bar').firstElementChild; bar.style.width = '10%';
    try { await World.check(); await World.load(f => { bar.style.width = Math.round(f * 100) + '%'; }, UI.map); } catch (e) { L.classList.add('hidden'); UI.menu(); UI.fatal('Could not load: ' + e.message, true); return false; }
    bar.style.width = '100%'; await sleep(200); L.classList.add('hidden'); App.screen = 'game'; App.game = Game; App.paused = false; App.demo = false;
    $('hud').classList.remove('hidden'); $('vig').classList.remove('hidden'); $('stats').classList.toggle('hidden', !App.showStats); resize();
    Game.start({ cls: UI.cls }); lock(); return true;
};
UI.fatal = function (text, soft) { const f = $('fatal'); f.classList.remove('hidden'); f.innerHTML = '<div>' + esc(text) + (soft ? '<br><br><button class="btn" onclick="this.parentNode.parentNode.classList.add(\'hidden\')">OK</button>' : '') + '</div>'; };
UI.pause = function (on) {
    if (!App.game || Game.over) return; if (on) App.paused = true; $('pause').classList.toggle('hidden', !on); UI.paused = on;
    if (!on) { App.paused = false; UI.close(); lock(); } else if (document.pointerLockElement) document.exitPointerLock();
    Game.hint();
};
UI.results = function (r) {
    if (document.pointerLockElement) document.exitPointerLock(); $('results').classList.remove('hidden');
    $('results').innerHTML = '<div class="box"><small style="letter-spacing:.4em;color:var(--ember2)">KNOCKED OUT ON WAVE ' + r.wave + '</small><div class="big">' + r.score + '</div>' + (r.record ? '<div style="color:var(--good);letter-spacing:.3em;font-weight:700">NEW BEST</div>' : '') +
        '<div class="grid">' + [['tanks destroyed', r.kills], ['accuracy', r.acc + '%'], ['wave reached', r.wave], ['time', Math.floor(r.time / 60) + ':' + String(Math.floor(r.time % 60)).padStart(2, '0')]].map(x => '<div><b>' + x[1] + '</b><small>' + x[0] + '</small></div>').join('') + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" data-do="tomenu">MENU</button><button class="btn go" data-do="again">GO AGAIN</button></div></div>';
};
document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled && b !== UI.hov) { UI.hov = b; Snd.ui('hover'); const nav = [...document.querySelectorAll('#menu-nav button')].indexOf(b); if (nav >= 0) UI.nav(nav); } });
document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return; const d = b.dataset; Snd.init();
    if (d.act) return UI.act(d.act);
    if (b.id === 'panel-x') { Snd.ui('back'); UI.close(); if (App.game && App.paused) $('pause').classList.remove('hidden'); return; }
    if (d.seg) { const v = d.v === 'true' ? true : d.v === 'false' ? false : d.v; Save.data.settings[d.seg] = v; Save.store(); Snd.ui('click'); resize(); return UI.draw(); }
    if (d.do === 'fs') { const el = document.documentElement; try { if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen().catch(() => { }); } catch (x) { } return; }
    if (d.cls) { UI.cls = d.cls; Snd.ui('click'); return UI.draw(); }
    if (d.map) { UI.map = d.map; Snd.ui('click'); return UI.draw(); }
    if (d.do === 'deploy') { Snd.ui('click'); return UI.play(); }
    if (d.up) { const G = Game; UPGRADES[d.up].apply(G.P, G); G.ups.push(d.up); G.shopOpen = false; Snd.ui('buy'); HUD.callout(UPGRADES[d.up].name); UI.close(); $('panel-x').style.visibility = ''; return lock(); }
    if (d.do === 'ash') { Snd.ui('click'); return leaveTo('Ashfall'); }
    if (d.do === 'tomenu') { Snd.ui('click'); Game.stop(); return UI.menu(); }
    if (d.do === 'again') { Snd.ui('click'); $('results').classList.add('hidden'); App.paused = false; Game.start(); return lock(); }
});
document.addEventListener('input', e => { const t = e.target, k = t.dataset && t.dataset.set; if (k) { Save.data.settings[k] = +t.value; Save.store(); Snd.volumes(); const b = t.parentNode.querySelector('b'); if (b) b.textContent = k === 'fov' ? t.value + '°' : k === 'sfx' || k === 'music' ? Math.round(t.value * 100) + '%' : (+t.value).toFixed(2); } });
UI.key = function (e) {
    const c = e.code;
    if (App.screen === 'menu' && !UI.panel) { if (c === 'ArrowDown' || c === 'KeyS') { UI.nav(UI.navI + 1); Snd.ui('hover'); } else if (c === 'ArrowUp' || c === 'KeyW') { UI.nav(UI.navI - 1); Snd.ui('hover'); } else if (c === 'Enter' || c === 'Space') { const b = document.querySelectorAll('#menu-nav button')[UI.navI]; if (b) UI.act(b.dataset.act); } return; }
    if (c === 'Escape') { if (UI.panel) { Snd.ui('back'); UI.close(); if (App.game && App.paused) $('pause').classList.remove('hidden'); } else if (App.game && UI.paused) UI.pause(false); else if (App.game && !document.pointerLockElement && !Game.over) UI.pause(true); }
};
