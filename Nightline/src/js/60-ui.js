// ============================================================
// The page round the game: the menu (your car drives the circuit behind it), the dials in a race, pause, results, settings.
// ============================================================
const UI = { view: '', panel: '', keysT: 0, mapCv: null, lastBoard: '' };
const show = (id, on) => $(id).classList.toggle('hidden', !on);
UI.fatal = msg => { $('fatal').textContent = msg; show('fatal', true); };
UI.loading = (on, text) => { show('loading', on); if (text) $('load-map').textContent = text; if (on) $('load-bar').firstChild.style.width = '4%'; };
UI.prog = p => { $('load-bar').firstChild.style.width = Math.round(p * 100) + '%'; };

// ---- the menu ----
UI.menu = async function () {
    const S = Save.data; App.screen = 'menu'; App.paused = false; show('hud', false); show('results', false); show('pause', false); show('menu', true); UI.view = UI.view || S.car; UI.render();
    await UI.showCar();
};
// the car on the road behind the menu: the one being looked at, in its paint, driven round the circuit for you
UI.showCar = async function () {
    const S = Save.data, id = UI.view, key = id + '|' + (S.paint[id] | 0) + '|' + S.settings.circuit; if (UI.showing === key && Race.on && Race.mode === 'show') return; UI.showing = key;
    const first = !World.loaded; if (first) UI.loading(true, 'NEON QUAY');
    await Race.start({ mode: 'show', car: id, paint: S.paint[id] | 0, circuit: S.settings.circuit }, UI.prog);
    if (first) UI.loading(false);
};
UI.render = function () {
    const S = Save.data, st = S.settings, id = UI.view, d = CARS[id], own = !!S.cars[id], T = TRACKDATA[st.circuit] || TRACKDATA.quay;
    $('go-sub').textContent = own ? T.name + ' · ' + st.laps + ' LAPS · ' + LEVELS[st.level].name : 'LOCKED';
    $('seg-level').innerHTML = LEVELS.map((l, i) => '<button data-level="' + i + '" class="' + (st.level === i ? 'on' : '') + '">' + l.name + '</button>').join('');
    $('seg-laps').innerHTML = [3, 5, 7].map(n => '<button data-laps="' + n + '" class="' + (st.laps === n ? 'on' : '') + '">' + n + '</button>').join('');
    $('car-head').innerHTML = '<small>' + d.cls + (own ? '' : ' · LOCKED') + '</small><h2>' + d.name + '</h2><p>' + esc(d.blurb) + '</p>';
    const bar = (name, v, text) => '<div class="bar"><span>' + name + '</span><i><u style="width:' + Math.round(clamp(v, 0.05, 1) * 100) + '%"></u></i><b>' + text + '</b></div>';
    $('car-bars').innerHTML = bar('TOP SPEED', d.top / 88, Math.round(d.top * (st.mph ? 2.237 : 3.6))) + bar('POWER', d.acc / 10, (100 / 3.6 / d.acc * 1.25).toFixed(1) + 's') + bar('GRIP', (d.grip - 9) / 7, (d.grip / 9.81).toFixed(2) + 'g') + bar('BRAKES', (d.brake - 9) / 9, (d.brake / 9.81).toFixed(2) + 'g');
    $('car-paint').innerHTML = PAINTS.map((p, i) => '<button data-paint="' + i + '" title="' + p[0] + '" class="' + ((S.paint[id] | 0) === i ? 'on' : '') + '" style="background:#' + p[1].toString(16).padStart(6, '0') + ';color:#' + p[1].toString(16).padStart(6, '0') + '"></button>').join('');
    $('car-pick').innerHTML = CAR_IDS.map(k => '<button data-car="' + k + '" class="' + (k === id ? 'on ' : '') + (S.cars[k] ? '' : 'lock') + '"><b>' + CARS[k].name + '</b><small>' + (S.cars[k] ? CARS[k].cls : 'LOCKED') + '</small></button>').join('') + (own ? '' : '<div id="car-lock" style="grid-column:1/-1">To drive it: ' + esc((d.need || '').toLowerCase()) + '.</div>');
    const b = Save.best(T.id, S.car);
    $('m-rec').innerHTML = '<div><b>' + S.wins + '</b><small>WINS</small></div><div><b>' + S.podiums + '</b><small>PODIUMS</small></div><div><b>' + fmtTime(b.lap) + '</b><small>BEST LAP · ' + CARS[S.car].name + '</small></div>';
    $('m-foot').innerHTML = '<span>Nightline ' + VERSION + (BUILD ? ' · test build ' + BUILD : '') + '</span><span>' + T.name + ' · ' + (T.length / 1000).toFixed(2) + ' km</span>';
};
document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const S = Save.data, st = S.settings, d = b.dataset; Snd.init();
    if (d.level !== undefined) { st.level = +d.level; Save.store(); UI.render(); }
    else if (d.laps) { st.laps = +d.laps; Save.store(); UI.render(); }
    else if (d.car) { UI.view = d.car; if (S.cars[d.car]) { S.car = d.car; Save.store(); } UI.render(); UI.showCar(); }
    else if (d.paint !== undefined) { S.paint[UI.view] = +d.paint; Save.store(); UI.render(); UI.showCar(); }
    else if (d.act === 'race' || d.act === 'trial') { if (!S.cars[UI.view]) { $('car-lock') && ($('car-lock').style.color = '#fff'); return; } UI.play(d.act); }
    else if (d.act === 'settings' || d.act === 'psettings') UI.settings();
    else if (d.act === 'how') UI.how();
    else if (d.act === 'resume') UI.pause(false);
    else if (d.act === 'restart' || d.act === 'again') UI.play(Race.mode === 'trial' ? 'trial' : 'race');
    else if (d.act === 'quit' || d.act === 'menu') { Race.clear(); UI.showing = ''; UI.menu(); }
    else if (b.id === 'panel-x') UI.close();
    else if (d.set) { const k = d.set; if (k === 'quality') st.quality = st.quality === 'low' ? 'auto' : 'low'; else st[k] = !st[k]; Save.store(); UI.settings(); }
});
UI.play = async function (mode) {
    const S = Save.data, st = S.settings; if (Race.busy) return; App.screen = 'race'; UI.showing = ''; Race.shown = false;
    show('menu', false); show('results', false); show('pause', false); UI.loading(true, (TRACKDATA[st.circuit] || TRACKDATA.quay).name);
    await Race.start({ mode, car: S.car, paint: S.paint[S.car] | 0, circuit: st.circuit, laps: st.laps, level: st.level }, UI.prog);
    UI.loading(false); show('hud', true); App.paused = false; UI.hudStart(); return true;
};

// ---- the dials ----
UI.hudStart = function () {
    const race = Race.mode === 'race'; show('h-pos', race); show('h-board', race); $('h-lapof').textContent = race ? '/' + Race.laps : ''; $('h-of').textContent = '/' + Race.cars.length; $('h-unit').textContent = Save.data.settings.mph ? 'MPH' : 'KM/H';
    $('h-keys').innerHTML = '<kbd>W</kbd>gas<kbd>S</kbd>brake<kbd>A</kbd><kbd>D</kbd>steer<kbd>Space</kbd>handbrake<kbd>C</kbd>camera<kbd>R</kbd>back on the road<kbd>Esc</kbd>pause'; $('h-keys').style.opacity = 1; UI.keysT = 9;
    // the circuit, drawn once
    const cv = UI.mapCv = document.createElement('canvas'); cv.width = cv.height = 170; const c = cv.getContext('2d'), S = Track.S; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); z0 = Math.min(z0, s[2]); z1 = Math.max(z1, s[2]); }
    const k = 150 / Math.max(x1 - x0, z1 - z0), ox = 85 - (x0 + x1) / 2 * k, oz = 85 + (z0 + z1) / 2 * k; UI.mapK = [k, ox, oz];
    c.lineJoin = 'round'; for (const [w, col] of [[7, 'rgba(5,6,12,.75)'], [3, 'rgba(255,255,255,.85)']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); S.forEach((s, i) => { const X = s[0] * k + ox, Y = -s[2] * k + oz; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.stroke(); }
    c.fillStyle = '#ff2e88'; c.fillRect(S[0][0] * k + ox - 2, -S[0][2] * k + oz - 5, 4, 10);
};
UI.frame = function (dt) {
    if (App.screen !== 'race' || !Race.on) return; const me = Race.me, st = Save.data.settings;
    $('h-kmh').textContent = Math.round(Math.abs(me.u) * (st.mph ? 2.237 : 3.6)); $('h-gear').textContent = me.gear ? me.gear : 'R'; $('h-rev').firstChild.style.width = Math.round(me.rpm * 100) + '%';
    const live = Race.state !== 'grid'; $('h-t').textContent = fmtTime(live ? (me.done || Race.t) : 0.0001); $('h-best').textContent = fmtTime(Race.best); $('h-last').textContent = fmtTime(me.laps[me.laps.length - 1]);
    $('h-lapn').textContent = Math.max(1, Math.min(Race.laps || 999, me.lap + 1)); $('h-place').textContent = Race.place(me);
    // the start lights
    const L = $('h-lights'); show('h-lights', Race.state === 'grid' || (live && Race.t < 1.2 && Race.mode !== 'show')); if (!L.classList.contains('hidden')) { const n = Race.lights; L.classList.toggle('go', n === 4); for (let i = 0; i < 3; i++) L.children[i].classList.toggle('on', n > i && n < 4); }
    const M = $('h-msg'); if (Race.msg) { const h = esc(Race.msg.text) + (Race.msg.sub ? '<small>' + esc(Race.msg.sub) + '</small>' : ''); if (M.dataset.h !== h) { M.dataset.h = h; M.innerHTML = h; } M.classList.add('on'); } else M.classList.remove('on');
    show('h-wrong', me.wrong > 1);
    if (UI.keysT > 0 && live && (UI.keysT -= dt) <= 0) $('h-keys').style.opacity = 0;
    // who is where
    if (Race.mode === 'race') { let h = ''; const O = Race.order; for (let i = 0; i < O.length; i++) { const c = O[i]; h += '<div class="' + (c === me ? 'me' : '') + '"><i>' + (i + 1) + '</i>' + c.name + (c.done ? '<em>' + fmtTime(c.done) + '</em>' : '') + '</div>'; } if (h !== UI.lastBoard) { UI.lastBoard = h; $('h-board').innerHTML = h; } }
    // the map
    const c = $('h-map').getContext('2d'), K = UI.mapK; if (K && UI.mapCv) { c.clearRect(0, 0, 170, 170); c.drawImage(UI.mapCv, 0, 0); for (const car of Race.cars) { if (car === me) continue; c.fillStyle = '#35e0ff'; c.beginPath(); c.arc(car.x * K[0] + K[1], -car.z * K[0] + K[2], 3, 0, 7); c.fill(); } c.fillStyle = '#ff2e88'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(me.x * K[0] + K[1], -me.z * K[0] + K[2], 4.5, 0, 7); c.fill(); c.stroke(); }
    if (App.fps && (st.stats || Q.get('stats') === '1')) { show('stats', true); $('stats').textContent = App.fps + ' FPS  ' + App.ms.toFixed(1) + ' ms\n' + App.calls + ' draws  ' + Math.round(App.tris / 1000) + 'k tris\nscale ' + App.scale.toFixed(2) + (App.glow ? '  glow' : '') + (World.standin ? '  STAND-IN CITY' : ''); } else show('stats', false);
};
UI.pause = function (on) { if (App.screen !== 'race' || Race.state === 'over') return; App.paused = on; show('pause', on); if (on) Snd.engine(0.1, 0, 0, 0); };
UI.key = function (e) {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (UI.panel) UI.close(); else if (App.screen === 'race' && !$('results').classList.contains('hidden')) return; else if (App.screen === 'race') UI.pause(!App.paused); }
    else if (e.code === 'KeyC' && App.screen === 'race' && Race.on) { Race.camMode = (Race.camMode + 1) % 3; Save.data.settings.cam = Race.camMode; Save.store(); }
    else if (e.code === 'Enter' && !$('results').classList.contains('hidden')) UI.play(Race.mode === 'trial' ? 'trial' : 'race');
};

// ---- after the flag ----
UI.results = function () {
    const r = Race.result, me = Race.me, ord = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'], S = Save.data;
    let rows = ''; Race.order.forEach((c, i) => { rows += '<tr class="' + (c === me ? 'me' : '') + '"><td>' + (i + 1) + '</td><td>' + c.name + '</td><td>' + c.def.name + '</td><td>' + (c.done ? fmtTime(c.done) : 'still racing') + '</td></tr>'; });
    const got = r.got.map(id => '<div class="got">NEW CAR: <b>' + CARS[id].name + '</b> · ' + CARS[id].cls + '. It is in your garage.</div>').join('');
    const next = CAR_IDS.find(id => !S.cars[id]), hint = next ? '<div class="next">Next car, the ' + CARS[next].name + ': ' + CARS[next].need.toLowerCase() + '.</div>' : '';
    $('results').innerHTML = '<div class="res"><div class="place">' + ord[r.place] + '<small>' + LEVELS[r.level].name + ' · ' + Track.name + '</small></div><div class="nums"><div><b>' + fmtTime(r.time) + '</b><small>RACE TIME</small></div><div><b>' + fmtTime(r.best) + '</b><small>YOUR BEST LAP</small></div><div><b>' + fmtTime(Race.best) + '</b><small>RECORD · ' + me.def.name + '</small></div></div>' + got + '<table>' + rows + '</table>' + hint + '<div class="btns"><button class="pri" data-act="again">RACE AGAIN <kbd>Enter</kbd></button><button data-act="menu">GARAGE</button></div></div>';
    show('results', true); Snd.engineOff();
};
// ---- panels ----
UI.open = (title, html) => { UI.panel = title; $('panel-title').textContent = title; $('panel-body').innerHTML = html; show('panel', true); };
UI.close = () => { UI.panel = ''; show('panel', false); };
UI.settings = function () {
    const st = Save.data.settings, tog = (k, name, on, off) => '<div class="set"><span>' + name + '</span><div class="seg"><button data-set="' + k + '" class="' + (st[k] ? 'on' : '') + '">' + on + '</button><button data-set="' + k + '" class="' + (st[k] ? '' : 'on') + '">' + off + '</button></div></div>';
    UI.open('SETTINGS', '<div class="set"><span>SOUND</span><input type="range" min="0" max="100" value="' + Math.round(st.sfx * 100) + '" id="set-sfx"></div>' + tog('mph', 'SPEED IN', 'MPH', 'KM/H') + tog('shake', 'CAMERA SHAKE', 'ON', 'OFF') + '<div class="set"><span>PICTURE</span><div class="seg"><button data-set="quality" class="' + (st.quality !== 'low' ? 'on' : '') + '">FULL</button><button data-set="quality" class="' + (st.quality === 'low' ? 'on' : '') + '">PLAIN</button></div></div>' + tog('stats', 'FRAME COUNTER', 'ON', 'OFF') + '<p>PLAIN turns off the glow round the lights. The game also shrinks its picture by itself when frames are slow.</p>');
    $('set-sfx').oninput = e => { st.sfx = e.target.value / 100; Snd.setVol(st.sfx); Save.store(); };
};
UI.how = () => UI.open('HOW TO DRIVE', '<div class="keys"><span><kbd>W</kbd> <kbd>↑</kbd></span><span>Gas</span><span><kbd>S</kbd> <kbd>↓</kbd></span><span>Brake, then reverse</span><span><kbd>A</kbd> <kbd>D</kbd></span><span>Steer</span><span><kbd>Space</kbd></span><span>Handbrake: lets the back slide round a tight bend</span><span><kbd>C</kbd></span><span>Camera: close, far, bonnet</span><span><kbd>R</kbd></span><span>Put the car back on the road</span></div><p>Brake in a straight line before a bend, turn in, and come back on the gas as the road opens. Too much gas while the wheels are turned and the back steps out: ease off and steer into it.</p><p>The blue barrier is on your left and the pink one on your right, all the way round.</p><p>A gamepad works too: stick to steer, right trigger gas, left trigger brake.</p>');
