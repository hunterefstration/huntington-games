// ============================================================
// The page round the game: the menu (your car drives the circuit behind it), the dials in a race, pause, results, settings.
// ============================================================
const UI = { view: '', panel: '', keysT: 0, mapCv: null, lastBoard: '' };
const show = (id, on) => $(id).classList.toggle('hidden', !on);
UI.fatal = msg => { $('fatal').textContent = msg; show('fatal', true); };
UI.loading = (on, text) => { show('loading', on); if (text) $('load-map').textContent = text; if (on) $('load-bar').firstChild.style.width = '4%'; };
UI.prog = p => { $('load-bar').firstChild.style.width = Math.round(p * 100) + '%'; };

// ---- the two pages before a race ----
// HOME: race, time trial, the circuit, and the car you have equipped, which drives the circuit behind the page.
// THE GARAGE: every car on the left; the one you click stands on the road and the camera walks round it (drag to turn it);
// on the right what it is, its paints, your seat time in it, and EQUIP, or what opens it when it is locked.
const hex = n => '#' + n.toString(16).padStart(6, '0');
UI.paintOf = id => { const i = Save.data.paint[id] | 0; return i === -1 && Save.data.tint[id] ? -1 : paintOpen(id, i) ? i : 0; };
// YOUR OWN COLOURS (the owner: "add color customization"): a car's body, its rims and the light under it, each any colour. Kept for each
// car (Save.data.tint[id] = { body, rim, glow } as '#rrggbb'); the paint number -1 means "the custom one".
const hexN = h => parseInt(String(h).slice(1), 16) || 0, hexRGB = h => { const n = hexN(h); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
UI.tintRaw = id => { const S = Save.data; if (!S.tint[id]) { const p = PAINTS[Math.max(0, S.paint[id] | 0)] || PAINTS[0]; S.tint[id] = { body: hex(p[1]), rim: '#ffffff', glow: hex(Math.round(p[2][0] * 255) << 16 | Math.round(p[2][1] * 255) << 8 | Math.round(p[2][2] * 255)) }; } return S.tint[id]; };
UI.tintOf = id => { if (UI.paintOf(id) !== -1) return null; const t = Save.data.tint[id]; return { body: hexN(t.body), rim: hexN(t.rim), glow: hexRGB(t.glow) }; };
UI.bodyHex = id => { const i = UI.paintOf(id); return i === -1 ? Save.data.tint[id].body : hex(PAINTS[i][1]); };
UI.menu = async function () {
    const S = Save.data; App.screen = 'menu'; App.paused = false; show('hud', false); show('results', false); show('pause', false); show('garage', false); show('menu', true);
    if (!owns(S.car)) { S.car = 'kite'; Save.store(); } UI.render();
    await UI.showCar();
};
UI.garage = async function () {
    App.screen = 'garage'; show('menu', false); show('garage', true); if (!CARS[UI.view]) UI.view = Save.data.car; UI.renderGarage();
    const on = $('g-list').querySelector('button.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'center' });
    await UI.showCar();
};
// the car behind the page: HOME drives the equipped one round the circuit, the garage parks the one being looked at.
// One at a time, and only the newest wish counts (clicking down the list must not start five at once).
UI.showCar = function () {
    const run = async () => {
        const S = Save.data, park = App.screen === 'garage'; if (App.screen !== 'menu' && !park) return;
        const id = park ? UI.view : S.car, paint = UI.paintOf(id), mode = park ? 'park' : 'show', key = mode + '|' + id + '|' + paint + '|' + S.settings.circuit + (paint === -1 ? '|c' : ''); if (UI.showing === key && Race.on && Race.mode === mode) return; UI.showing = key;
        const first = !World.loaded || World.id !== S.settings.circuit; if (first) UI.loading(true, (TRACKDATA[S.settings.circuit] || TRACKDATA.quay).name);
        await Race.start({ mode, car: id, paint, tint: UI.tintOf(id), circuit: S.settings.circuit }, UI.prog);
        if (first) UI.loading(false);
    };
    return UI.q = (UI.q || Promise.resolve()).then(run, run);
};
UI.bars = function (d) {
    const st = Save.data.settings, bar = (name, v, text) => '<div class="bar"><span>' + name + '</span><i><u style="width:' + Math.round(clamp(v, 0.05, 1) * 100) + '%"></u></i><b>' + text + '</b></div>';
    return bar('TOP SPEED', d.top / 90, Math.round(d.top * (st.mph ? 2.237 : 3.6))) + bar('POWER', d.acc / 10.4, (100 / 3.6 / d.acc * 1.25).toFixed(1) + 's') + bar('GRIP', (d.grip - 9) / 7.2, (d.grip / 9.81).toFixed(2) + 'g') + bar('BRAKES', (d.brake - 9) / 8.8, (d.brake / 9.81).toFixed(2) + 'g');
};
UI.seatHtml = function (id, long, title) {
    const s = SEAT.of(id), np = PAINTS.find(p => p[3] > s.n);
    return '<div class="seat"><span>' + (title || 'SEAT TIME') + '</span><i><u style="width:' + Math.round(s.frac * 100) + '%"></u></i><b>LEVEL ' + s.n + '</b>' + (long ? '<small>' + (s.n < SEAT.max ? s.left + ' more to level ' + (s.n + 1) + '. ' : 'As far as it goes. ') + 'Laps and results in this car earn it' + (np ? '; level ' + np[3] + ' opens the ' + np[0] + ' paint.' : '.') + '</small>' : '') + '</div>';
};
UI.render = function () {
    const S = Save.data, st = S.settings, id = S.car, d = CARS[id], T = TRACKDATA[st.circuit] || TRACKDATA.quay;
    $('go-sub').textContent = T.name + ' · ' + st.laps + ' LAPS · ' + LEVELS[st.level].name;
    $('seg-level').innerHTML = LEVELS.map((l, i) => '<button data-level="' + i + '" class="' + (st.level === i ? 'on' : '') + '">' + l.name + '</button>').join('');
    $('seg-laps').innerHTML = [3, 5, 7].map(n => '<button data-laps="' + n + '" class="' + (st.laps === n ? 'on' : '') + '">' + n + '</button>').join('');
    $('car-head').innerHTML = '<small>YOUR CAR · ' + d.cls + '</small><h2>' + d.name + '</h2>'; $('car-seat').innerHTML = UI.seatHtml(id, false); $('car-bars').innerHTML = UI.bars(d);
    $('gar-sub').textContent = CAR_IDS.filter(owns).length + ' of ' + CAR_IDS.length + ' cars open · pick, paint and look at them';
    { const nx = REP.next(), r = S.rep | 0; $('m-rep').innerHTML = '<span>REP</span><b>' + r + '</b>' + (nx ? '<i><u style="width:' + Math.round(clamp(r / nx.rep, 0, 1) * 100) + '%"></u></i><small>' + nx.id + ' cars at ' + nx.rep + '</small>' : '<small>every class is open</small>'); }
    const ids = Object.keys(TRACKDATA); $('row-circuit').style.display = ids.length > 1 ? '' : 'none'; $('seg-circuit').innerHTML = ids.map(k => '<button data-circuit="' + k + '" class="' + (st.circuit === k ? 'on' : '') + '">' + TRACKDATA[k].name + '</button>').join('');
    const b = Save.best(T.id, S.car);
    $('m-rec').innerHTML = '<div><b>' + S.wins + '</b><small>WINS</small></div><div><b>' + S.podiums + '</b><small>PODIUMS</small></div><div><b>' + fmtTime(b.lap) + '</b><small>BEST LAP · ' + d.name + '</small></div>';
    $('m-foot').innerHTML = '<span>Highbeam ' + VERSION + (BUILD ? ' · test build ' + BUILD : '') + (S.admin ? ' · ADMIN: EVERYTHING OPEN' : '') + '</span><span>' + T.name + ' · ' + (T.length / 1000).toFixed(2) + ' km</span>';
};
UI.renderGarage = function () {
    const S = Save.data, id = UI.view, d = CARS[id], own = owns(id), eq = S.car === id, L = $('g-list'), top = L.scrollTop; let h = '';
    CLASSES.forEach((c, i) => {
        const ids = CAR_IDS.filter(k => CARS[k].ci === i), open = owns(ids[0]);
        h += '<div class="g-cls' + (open ? '' : ' lock') + '"><b>' + c.id + '</b><small>' + (open ? 'OPEN' : 'LOCKED · ' + c.rep + ' REP') + '</small></div><div class="g-cars">' + ids.map(k => '<button data-car="' + k + '" class="' + (k === id ? 'on ' : '') + (owns(k) ? '' : 'lock ') + (S.car === k ? 'eq' : '') + '"><i style="background:' + UI.bodyHex(k) + '"></i><b>' + CARS[k].name + '</b><small>' + (S.car === k ? 'EQUIPPED' : owns(k) ? 'SEAT TIME ' + SEAT.of(k).n : 'LOCKED') + '</small></button>').join('') + '</div>';
    });
    L.innerHTML = h; L.scrollTop = top;
    $('g-info').innerHTML = '<small class="cls">' + d.cls + ' CLASS' + (eq ? ' · EQUIPPED' : own ? '' : ' · LOCKED') + '</small><h2>' + d.name + '</h2><p>' + esc(d.blurb) + '</p>' + UI.bars(d)
        + '<div id="car-paint">' + PAINTS.map((p, i) => { const o = paintOpen(id, i); return '<button data-paint="' + i + '" title="' + p[0] + (o ? '' : ': opens at seat time level ' + p[3] + ' in this car') + '" class="' + (UI.paintOf(id) === i ? 'on ' : '') + (o ? '' : 'lock') + '" style="background:' + hex(p[1]) + ';color:' + hex(p[1]) + '">' + (o ? '' : '<em>' + p[3] + '</em>') + '</button>'; }).join('') + '</div>'
        + (() => { const t = UI.tintRaw(id), on = UI.paintOf(id) === -1, inp = (k, name) => '<label>' + name + '<input type="color" data-tint="' + k + '" value="' + t[k] + '"></label>'; return '<div id="car-custom" class="' + (on ? 'on' : '') + '"><button data-paint="-1" class="' + (on ? 'on' : '') + '">YOUR OWN COLOURS</button>' + inp('body', 'BODY') + inp('rim', 'RIMS') + inp('glow', 'GLOW') + '</div>'; })()
        + UI.seatHtml(id, true)
        + (own ? (eq ? '<div class="g-eq">EQUIPPED · THE CAR YOU RACE</div>' : '<button class="go" data-act="equip"><b>EQUIP</b></button>') : '<div class="g-lock"><b>LOCKED</b><span>The ' + d.cls + ' cars open at ' + CLASSES[d.ci].rep + ' REP. You have ' + (S.rep | 0) + ': every race and every lap pays some, more for a better place, better drivers and slide boosts.</span></div>');
    $('g-admin').textContent = S.admin ? 'ADMIN · EVERYTHING OPEN · P TURNS IT OFF' : '';
};
// ADMIN UNLOCK (the owner asked for it; TEMPORARY like Ashfall's P key: before a release, tie it to the launcher's admin powers or take it out).
// P on HOME or in the garage: every car and paint counts as open while it is on. It changes nothing you have earned: P again and the save's own cars are back.
UI.admin = function () {
    const S = Save.data; S.admin = !S.admin; if (!owns(S.car)) S.car = 'kite'; Save.store(); UI.showing = '';
    if (App.screen === 'garage') UI.renderGarage(); else UI.render(); UI.showCar();
};
// the garage: dragging on the picture turns the car
(function () {
    const G = $('garage'); let x0 = 0, id = null;
    G.addEventListener('pointerdown', e => { if (e.target !== G) return; id = e.pointerId; x0 = e.clientX; Race.hold = true; G.classList.add('drag'); try { G.setPointerCapture(id); } catch (err) { } });
    G.addEventListener('pointermove', e => { if (e.pointerId !== id) return; Race.spin -= (e.clientX - x0) * 0.008; x0 = e.clientX; });
    const up = e => { if (e.pointerId !== id) return; id = null; Race.hold = false; G.classList.remove('drag'); }; G.addEventListener('pointerup', up); G.addEventListener('pointercancel', up);
})();
document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const S = Save.data, st = S.settings, d = b.dataset; Snd.init();
    if (d.level !== undefined) { st.level = +d.level; Save.store(); UI.render(); }
    else if (d.laps) { st.laps = +d.laps; Save.store(); UI.render(); }
    else if (d.circuit) { if (st.circuit !== d.circuit && TRACKDATA[d.circuit]) { st.circuit = d.circuit; Save.store(); UI.render(); UI.showCar(); } }
    else if (d.car) { if (CARS[d.car]) { UI.view = d.car; UI.renderGarage(); UI.showCar(); } }
    else if (d.paint !== undefined) { if (+d.paint === -1) UI.tintRaw(UI.view); else if (!paintOpen(UI.view, +d.paint)) return; S.paint[UI.view] = +d.paint; Save.store(); UI.renderGarage(); UI.showCar(); }
    else if (d.act === 'equip') { if (owns(UI.view)) { S.car = UI.view; Save.store(); UI.renderGarage(); Snd.tone(660, 0.12, 0.2, 'triangle', 880); } }
    else if (d.act === 'garage') { UI.view = S.car; UI.garage(); }
    else if (d.act === 'home') { UI.showing = ''; UI.menu(); }
    else if (d.act === 'race' || d.act === 'trial') UI.play(d.act);
    else if (d.act === 'settings' || d.act === 'psettings') UI.settings();
    else if (d.act === 'how') UI.how();
    else if (d.act === 'resume') UI.pause(false);
    else if (d.act === 'restart' || d.act === 'again') UI.play(Race.mode === 'trial' ? 'trial' : 'race');
    else if (d.act === 'quit' || d.act === 'menu') { Race.clear(); UI.showing = ''; UI.menu(); }
    else if (b.id === 'panel-x') UI.close();
    else if (d.set) { const k = d.set; if (k === 'quality') st.quality = st.quality === 'low' ? 'auto' : 'low'; else st[k] = !st[k]; Save.store(); UI.settings(); }
});

// a colour is picked: the car in the garage takes it at once (no reload), the save a moment after the picker stops
document.addEventListener('input', e => {
    const k = e.target && e.target.dataset && e.target.dataset.tint; if (!k) return; const S = Save.data, id = UI.view, t = UI.tintRaw(id); t[k] = e.target.value;
    if (S.paint[id] !== -1) { S.paint[id] = -1; UI.showing = 'park|' + id + '|-1|' + S.settings.circuit + '|c'; const cc = document.getElementById('car-custom'); if (cc) { cc.classList.add('on'); cc.firstChild.classList.add('on'); } for (const b of document.querySelectorAll('#car-paint button')) b.classList.remove('on'); }
    const me = Race.mode === 'park' && Race.cars[0]; if (me && me.id === id && me.mdl && me.mdl.repaint) { me.tint = UI.tintOf(id); me.mdl.repaint(me.tint); }
    clearTimeout(UI.tintT); UI.tintT = setTimeout(() => Save.store(), 400);
});
UI.play = async function (mode) {
    const S = Save.data, st = S.settings; if (Race.busy) return; App.screen = 'race'; UI.showing = ''; Race.shown = false;
    show('menu', false); show('results', false); show('pause', false); UI.loading(true, (TRACKDATA[st.circuit] || TRACKDATA.quay).name);
    show('garage', false); await UI.q; await Race.start({ mode, car: S.car, paint: UI.paintOf(S.car), tint: UI.tintOf(S.car), circuit: st.circuit, laps: st.laps, level: st.level }, UI.prog);
    UI.loading(false); show('hud', true); App.paused = false; UI.hudStart(); return true;
};

// ---- the dials ----
UI.hudStart = function () {
    const race = Race.mode === 'race'; show('h-pos', race); show('h-board', race); $('h-lapof').textContent = race ? '/' + Race.laps : ''; $('h-of').textContent = '/' + Race.cars.length; $('h-unit').textContent = Save.data.settings.mph ? 'MPH' : 'KM/H';
    $('h-keys').innerHTML = '<kbd>W</kbd>gas<kbd>S</kbd>brake<kbd>A</kbd><kbd>D</kbd>steer<kbd>Space</kbd>slide (hold in a bend, let go to boost)<kbd>C</kbd>camera<kbd>R</kbd>back on the road<kbd>Esc</kbd>pause'; $('h-keys').style.opacity = 1; UI.keysT = 9;
    // the circuit, drawn once
    const cv = UI.mapCv = document.createElement('canvas'); cv.width = cv.height = 170; const c = cv.getContext('2d'), S = Track.S; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const s of S) { x0 = Math.min(x0, s[0]); x1 = Math.max(x1, s[0]); z0 = Math.min(z0, s[2]); z1 = Math.max(z1, s[2]); }
    const k = 150 / Math.max(x1 - x0, z1 - z0), ox = 85 - (x0 + x1) / 2 * k, oz = 85 + (z0 + z1) / 2 * k; UI.mapK = [k, ox, oz];
    c.lineJoin = 'round'; for (const [w, col] of [[7, 'rgba(5,6,12,.75)'], [3, 'rgba(255,255,255,.85)']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); S.forEach((s, i) => { const X = s[0] * k + ox, Y = -s[2] * k + oz; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.stroke(); }
    c.fillStyle = '#ffd23f'; c.fillRect(S[0][0] * k + ox - 2, -S[0][2] * k + oz - 5, 4, 10);
};
UI.frame = function (dt) {
    if (App.screen !== 'race' || !Race.on) return; const me = Race.me, st = Save.data.settings;
    $('h-kmh').textContent = Math.round(Math.abs(me.u) * (st.mph ? 2.237 : 3.6)); $('h-gear').textContent = me.gear ? me.gear : 'R'; $('h-rev').firstChild.style.width = Math.round(me.rpm * 100) + '%';
    const live = Race.state !== 'grid'; $('h-t').textContent = fmtTime(live ? (me.done || Race.t) : 0.0001); $('h-best').textContent = fmtTime(Race.best); $('h-last').textContent = fmtTime(me.laps[me.laps.length - 1]);
    { const lv = me.dr ? driftLevel(me) : 0, el = $('h-slide'), key = me.boost > 0 ? 'b' + me.boostLv : me.dr ? 'd' + lv : ''; if (el.dataset.k !== key) { el.dataset.k = key; el.className = key ? (me.boost > 0 ? 'boost l' + me.boostLv : 'on l' + lv) : ''; el.lastChild.textContent = me.boost > 0 ? 'BOOST' : 'SLIDE'; } if (me.dr) { const T = DRIFT.tiers, a = lv ? T[lv - 1] : 0, b = lv < 3 ? T[lv] : a + 1; el.firstChild.firstChild.style.width = Math.round((lv + (lv < 3 ? clamp((me.drT - a) / (b - a), 0, 1) : 0)) / 3 * 100) + '%'; } }
    $('h-lapn').textContent = Math.max(1, Math.min(Race.laps || 999, me.lap + 1)); $('h-place').textContent = Race.place(me);
    // the start lights
    const L = $('h-lights'); show('h-lights', Race.state === 'grid' || (live && Race.t < 1.2 && Race.mode !== 'show')); if (!L.classList.contains('hidden')) { const n = Race.lights; L.classList.toggle('go', n === 4); for (let i = 0; i < 3; i++) L.children[i].classList.toggle('on', n > i && n < 4); }
    const M = $('h-msg'); if (Race.msg) { const h = esc(Race.msg.text) + (Race.msg.sub ? '<small>' + esc(Race.msg.sub) + '</small>' : ''); if (M.dataset.h !== h) { M.dataset.h = h; M.innerHTML = h; } M.classList.add('on'); } else M.classList.remove('on');
    show('h-wrong', me.wrong > 1);
    if (UI.keysT > 0 && live && (UI.keysT -= dt) <= 0) $('h-keys').style.opacity = 0;
    // who is where
    if (Race.mode === 'race') { let h = ''; const O = Race.order; for (let i = 0; i < O.length; i++) { const c = O[i]; h += '<div class="' + (c === me ? 'me' : '') + '"><i>' + (i + 1) + '</i>' + c.name + (c.done ? '<em>' + fmtTime(c.done) + '</em>' : '') + '</div>'; } if (h !== UI.lastBoard) { UI.lastBoard = h; $('h-board').innerHTML = h; } }
    // the map
    const c = $('h-map').getContext('2d'), K = UI.mapK; if (K && UI.mapCv) { c.clearRect(0, 0, 170, 170); c.drawImage(UI.mapCv, 0, 0); for (const car of Race.cars) { if (car === me) continue; c.fillStyle = '#8fd8ff'; c.beginPath(); c.arc(car.x * K[0] + K[1], -car.z * K[0] + K[2], 3, 0, 7); c.fill(); } c.fillStyle = '#ffd23f'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(me.x * K[0] + K[1], -me.z * K[0] + K[2], 4.5, 0, 7); c.fill(); c.stroke(); }
    if (App.fps && (st.stats || Q.get('stats') === '1')) { show('stats', true); $('stats').textContent = App.fps + ' FPS  ' + App.ms.toFixed(1) + ' ms\n' + App.calls + ' draws  ' + Math.round(App.tris / 1000) + 'k tris\nscale ' + App.scale.toFixed(2) + (App.glow ? '  glow' : '') + (World.standin ? '  STAND-IN CITY' : ''); } else show('stats', false);
};
UI.pause = function (on) { if (App.screen !== 'race' || Race.state === 'over') return; App.paused = on; show('pause', on); if (on) Snd.engine(0.1, 0, 0, 0); };
UI.key = function (e) {
    if (e.code === 'KeyP' && (App.screen === 'menu' || App.screen === 'garage') && !UI.panel) return UI.admin();
    if (e.code === 'Escape' && App.screen === 'garage' && !UI.panel) { UI.showing = ''; return UI.menu(); }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (UI.panel) UI.close(); else if (App.screen === 'race' && !$('results').classList.contains('hidden')) return; else if (App.screen === 'race') UI.pause(!App.paused); }
    else if (e.code === 'KeyC' && App.screen === 'race' && Race.on) { Race.camMode = (Race.camMode + 1) % 3; Save.data.settings.cam = Race.camMode; Save.store(); }
    else if (e.code === 'Enter' && !$('results').classList.contains('hidden')) UI.play(Race.mode === 'trial' ? 'trial' : 'race');
};

// ---- after the flag ----
UI.results = function () {
    const r = Race.result, me = Race.me, ord = ['', '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'], S = Save.data;
    let rows = ''; Race.order.forEach((c, i) => { rows += '<tr class="' + (c === me ? 'me' : '') + '"><td>' + (i + 1) + '</td><td>' + c.name + '</td><td>' + c.def.name + '</td><td>' + (c.done ? fmtTime(c.done) : 'still racing') + '</td></tr>'; });
    const gc = [...new Set(r.got.map(id => CARS[id].ci))], got = gc.map(i => '<div class="got">NEW CARS: the <b>' + CLASSES[i].id + '</b> class · ' + r.got.filter(id => CARS[id].ci === i).map(id => CARS[id].name).join(', ') + '. They are in your garage.</div>').join('');
    const st = r.seat, seat = st ? '<div class="seatres">' + UI.seatHtml(me.id, false, me.def.name + ' · SEAT TIME +' + st.gain) + (st.to > st.from ? '<div><em>LEVEL ' + st.to + '</em> in the ' + me.def.name + (st.paints.length ? ': the ' + st.paints.join(' and ') + ' paint is open for it in the garage' : '') + '.</div>' : '') + '</div>' : '';
    const nx = REP.next(), hint = '<div class="next"><b>+' + r.rep.gain + ' REP</b> · you have ' + r.rep.to + (nx ? ' · the ' + nx.id + ' cars open at ' + nx.rep : ' · every class is open') + '</div>';
    $('results').innerHTML = '<div class="res"><div class="place">' + ord[r.place] + '<small>' + LEVELS[r.level].name + ' · ' + Track.name + '</small></div><div class="nums"><div><b>' + fmtTime(r.time) + '</b><small>RACE TIME</small></div><div><b>' + fmtTime(r.best) + '</b><small>YOUR BEST LAP</small></div><div><b>' + fmtTime(Race.best) + '</b><small>RECORD · ' + me.def.name + '</small></div></div>' + got + seat + '<table>' + rows + '</table>' + hint + '<div class="btns"><button class="pri" data-act="again">RACE AGAIN <kbd>Enter</kbd></button><button data-act="menu">MENU</button></div></div>';
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
UI.how = () => UI.open('HOW TO DRIVE', '<div class="keys"><span><kbd>W</kbd> <kbd>↑</kbd></span><span>Gas</span><span><kbd>S</kbd> <kbd>↓</kbd></span><span>Brake, then reverse</span><span><kbd>A</kbd> <kbd>D</kbd></span><span>Steer</span><span><kbd>Space</kbd></span><span>Slide: hold it while you steer into a bend and the car holds a slide. Steer with it to turn tighter, against it to run wide. The sparks turn blue, yellow, red as it charges; let go for a boost</span><span><kbd>C</kbd></span><span>Camera: close, far, bonnet</span><span><kbd>R</kbd></span><span>Put the car back on the road</span></div><p>Brake in a straight line before a bend, turn in, and come back on the gas as the road opens. The car grips unless you ask it to slide. A wall ends a slide and loses its charge.</p><p>Every race pays REP, whoever you race: more for a better place, better drivers and slide boosts. REP opens the next class of cars.</p><p>The blue barrier is on your left and the pink one on your right, all the way round.</p><p>A gamepad works too: stick to steer, right trigger gas, left trigger brake.</p>');
