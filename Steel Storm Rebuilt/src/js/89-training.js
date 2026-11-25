// ===== 2.3 Training: three lessons on the Tutor engine (88-tutor.js), the Training list (menu), the first-visit offer =====
// Lessons 1 and 2 run in a solo practice match (M.tut = lesson id): easy enemies only, the player takes 35% damage, the match never
// ends by itself and finishMatch gives nothing, so save.stats (wins / kills, read by the launcher's leaderboards) never change.
// Lessons done: save.tut[id] = 1 (steelstorm_save, synced). save.tutOffer: the first-visit offer was shown (once).
const TRN = { want: null, prev: 'menu' };
Tutor.config({ done: id => !!(save && save.tut && save.tut[id]), mark: id => { save.tut = save.tut || {}; save.tut[id] = 1; writeSave(); trainBadge(); }, z: 9000, nextKey: 'Enter' });
const tFired = s => (M && M.fired && M.fired[s]) | 0;
const tMe = () => !!(M && M.tut && ME);
// a solo practice match: o = { veh, mm, mode, bots, foes }
function trainMatch(id, o) {
    if (M) return false;
    if (PARTY.code || PARTY.net) { toast('Leave your party first: training is a solo practice match'); return false; }
    const veh = o.veh || myVeh();
    const cfg = makeConfig([{ id: 0, name: myName(), veh, mm: o.mm !== undefined ? o.mm : modMask(veh) }], { mode: o.mode, size: 3, bots: o.bots || 'match', diff: 'easy', map: 'small', len: 15, wx: 'noon', ff: 0 });
    cfg.bots = cfg.bots.filter(b => b.team === 1).slice(0, o.foes || 2);      // a few easy enemies; nobody on your side takes your captures
    cfg.tut = id;
    TRN.prev = UIS.screen; TRN.want = o.keep || null;
    cfg.ground = GROUND; ac(); beginMatch(cfg, 0, true);
    if (!M) return false;
    M.tut = id; $('#ps-leave').textContent = 'Leave training';
    UI.msg('Training: ' + (id === 'air' ? 'Wings and rotors' : 'Basic training'), -1);
    return true;
}
function trainLeave() {
    TRN.want = null; $('#ps-leave').textContent = 'Leave match';
    if (M && M.tut) UI.leaveMatch(true);
    if (!M) UI.go(VIEWS.includes(TRN.prev) ? TRN.prev : 'menu');
}
// put the player in another vehicle right now (lesson 2: plane -> helicopter); every module on, it is practice
function trainSwap(id) {
    if (!tMe()) return false;
    TRN.want = id;
    if (ME.def.id === id && ME.alive) return true;
    ME.alive = false; ME.respT = 0;
    $('#s-dead').classList.add('hidden');
    return respawnMe(id);
}
const kb = k => '<kbd>' + k + '</kbd>';
const moved = b => ME && ME.alive && Math.hypot(ME.x - b.x, ME.z - b.z);

Tutor.define({
    id: 'basic', title: 'Basic training', blurb: 'Drive, aim, fire, destroy, capture, respawn, the map and the scoreboard', coach: true, next: 'air',
    begin: () => trainMatch('basic', { veh: 'g1a', mm: 0, mode: 'conq', foes: 2 }),
    finish: () => trainLeave(), alive: () => !!(M && M.tut === 'basic'), atEnd: () => trainLeave(),
    end: 'You can drive, shoot, capture and respawn. That is a whole battle! Next, <b>Wings and rotors</b> puts you in a plane and a helicopter.',
    steps: [
        { title: 'Drive', text: 'You are in a tank. Click the game to take control of the mouse, then hold ' + kb('W') + ' to drive forward (' + kb('S') + ' backs up). Drive a little way.',
            base: () => ({ x: ME.x, z: ME.z }), wait: b => moved(b) > 12 },
        { title: 'Turn', text: 'Hold ' + kb('A') + ' or ' + kb('D') + ' to turn the tank.', base: () => ({ y: ME.yaw }), wait: b => ME.alive && Math.abs(angDiff(b.y, ME.yaw)) > .9 },
        { title: 'Aim with the mouse', text: 'Move the <b>mouse</b>: the camera and the turret follow it. The crosshair shows where the gun points.', el: '#h-xh',
            base: () => ({ y: IN.camYaw, p: IN.camPitch }), wait: b => Math.abs(IN.camYaw - b.y) > .7 || Math.abs(IN.camPitch - b.p) > .35 },
        { title: 'Fire', text: '<b>Left click</b> fires the main gun. It needs a moment to reload between shots. Fire once.', el: '#h-xh', base: () => ({ n: tFired('w1') }), wait: b => tFired('w1') > b.n },
        { title: 'Zoom', text: 'Roll the <b>mouse wheel</b> to zoom the camera in or out.', base: () => ({ z: IN.zoom }), wait: b => Math.abs(IN.zoom - b.z) > .15 },
        { title: 'Find an enemy', text: 'Red dots on the <b>minimap</b> are enemies. Head for one, put the crosshair on it and fire until it is destroyed. Your tank is extra tough in training.', el: '#h-map',
            base: () => ({ k: ME.kills }), wait: b => ME.kills > b.k },
        { title: 'Capture a point', text: 'This is <b>Conquest</b>: drive into a point\'s circle (A, B or C, on the minimap) and stay inside until it turns blue. Holding more points drains the enemy\'s tickets.', el: '#h-cap',
            base: () => ({ c: M.my.caps }), wait: b => M.my.caps > b.c },
        { title: 'Respawn in another vehicle', text: 'When you are destroyed you choose your next vehicle from your lineup. Try it: press ' + kb('K') + ' to self-destruct, pick a <b>different vehicle</b> (keys ' + kb('1') + '-' + kb('5') + ' or click) and press <b>DEPLOY</b>.',
            act: ['Self-destruct (K)', () => { if (tMe() && ME.alive) meDied(-1, 'crash'); }], key: 'KeyK',
            base: () => ({ id: ME.def.id, dead: !ME.alive }),
            wait: b => { if (!ME.alive) b.dead = 1; return !!b.dead && ME.alive && (ME.def.id !== b.id || save.lineup.length < 2); } },
        { title: 'The minimap', text: 'You are the arrow in the middle of the minimap. <b>Blue</b> is your team, <b>red</b> the enemy, and the letters are the capture points.', el: '#h-map' },
        { title: 'The scoreboard', text: 'Hold ' + kb('Tab') + ' to see the scoreboard: everyone\'s score, kills and deaths.', wait: () => UIS.board }
    ]
});
Tutor.define({
    id: 'air', title: 'Wings and rotors', blurb: 'Throttle, steering, guns, bombs, flares; then hover, strafe and lock missiles in a helicopter', coach: true, next: 'garage',
    begin: () => trainMatch('air', { veh: 'a1b', mm: 31, mode: 'tdm', bots: 'mixed', foes: 3, keep: 'a1b' }),
    finish: () => trainLeave(), alive: () => !!(M && M.tut === 'air'), atEnd: () => trainLeave(),
    end: 'You can fly planes and helicopters. Research more of them in the <b>Research</b> tab. Last lesson: <b>Your garage</b>.',
    steps: [
        { title: 'Throttle', text: 'You are flying the <b>Mule</b>, an attack plane. ' + kb('W') + ' opens the throttle, ' + kb('S') + ' closes it. Too slow and you stall! Change your throttle.',
            enter: () => trainSwap('a1b'), base: () => ({ t: ME.thr }), wait: b => ME.alive && Math.abs(ME.thr - b.t) > .15 },
        { title: 'Steer with the mouse', text: 'The plane flies toward where you point the <b>mouse</b>: up and down to climb or dive, left and right to bank and turn (' + kb('A') + ' ' + kb('D') + ' turn too).',
            base: () => ({ y: IN.camYaw, p: IN.camPitch }), wait: b => Math.abs(IN.camYaw - b.y) > .8 || Math.abs(IN.camPitch - b.p) > .3 },
        { title: 'Guns', text: '<b>Left click</b> fires the guns. They aim a little ahead of a target near the crosshair.', el: '#h-xh', base: () => ({ n: tFired('w1') }), wait: b => tFired('w1') > b.n },
        { title: 'Bombs', text: 'This plane carries <b>bombs</b>. Press ' + kb('B') + ' (or ' + kb('Shift') + ') to drop one. Fly low over ground targets to hit them.', when: () => tMe() && ME.def.w3 && ME.def.w3.k === 'bomb',
            base: () => ({ n: tFired('w3') }), wait: b => tFired('w3') > b.n },
        { title: 'Flares', text: 'Press ' + kb('F') + ' to drop <b>flares</b>: they pull enemy missiles away from you. Use them when you hear the lock warning.', when: () => tMe() && ME.def.flares,
            base: () => ({ n: ME.nFl }), wait: b => ME.nFl < b.n },
        { title: 'Helicopter time', text: 'Now you are in a <b>Mantis</b> attack helicopter. Helicopters can stop in the air and hide behind hills.', enter: () => trainSwap('a3e') },
        { title: 'Hover', text: 'Hold ' + kb('E') + ' to climb (' + kb('Q') + ' goes down). ' + kb('W') + ' ' + kb('S') + ' fly forward and back. Climb up and hover.',
            enter: () => trainSwap('a3e'), base: () => ({ y: ME.y }), wait: b => ME.alive && ME.def.heli && ME.y > b.y + 12 },
        { title: 'Strafe', text: 'Hold ' + kb('A') + ' or ' + kb('D') + ' to slide sideways (strafe) while the nose follows the mouse.',
            base: () => ({ n: 0 }), wait: b => (b.n += ME.alive && ME.def.heli && (IN.keys.KeyA || IN.keys.KeyD) ? 1 : 0) > 5 },
        { title: 'Rockets', text: '<b>Right click</b> fires rockets: great against tanks and boats.', base: () => ({ n: tFired('w2') }), wait: b => tFired('w2') > b.n },
        { title: 'Missile lock', text: 'Guided missiles need a <b>lock</b>: hold the crosshair on an enemy tank, boat or helicopter for half a second until the red <b>LOCK</b> shows.', el: '#h-xh',
            wait: () => Cam.mlT >= LOCK_T && Cam.mlId >= 0 },
        { title: 'Fire the missile', text: 'Press ' + kb('B') + ' while locked: the missile chases the target on its own.', base: () => ({ n: tFired('w3') }), wait: b => tFired('w3') > b.n }
    ]
});
const navBtn = v => () => document.querySelector('#mnav [data-go="' + v + '"]');
const tGo = v => () => { if (!M && UIS.screen !== v) UI.go(v); };
Tutor.define({
    id: 'garage', title: 'Your garage', blurb: 'Vehicle cards, research, buying, the lineup, modules and multiplayer', next: null,
    begin: () => { if (M) return false; UIS.lobby = false; UI.go('menu'); return true; }, alive: () => !M,
    end: 'That is everything! Play battles to earn <b>credits</b> and <b>research points</b>, and climb to tier V. Lessons stay in <b>Training</b> if you want them again.',
    steps: [
        { title: 'Your vehicle', text: 'This card shows the vehicle you take into battle: its <b>tier</b> (I to V), <b>battle rating</b> (BR), role, and bars for hit points, armour, speed and firepower. Yellow on a bar is what its modules add.', el: '#h-vcard', enter: tGo('menu') },
        { title: 'Research', text: 'Open the <b>Research</b> tab.', el: navBtn('research'), wait: () => UIS.screen === 'research' },
        { title: 'The research tree', text: 'Every vehicle in a line needs the one before it. Ground and Air each have a tree. <b>Click any vehicle</b> in the tree to see its card.', el: '#v-research .rs-wrap', enter: tGo('research'), base: () => ({ r: UIS.rs }), wait: b => UIS.rs !== b.r },
        { title: 'Pick a research target', text: 'Battles earn <b>research points</b> (RP) for your target. Find a vehicle you can research (it shows RP) and press <b>Research this</b>. Free RP can go to anything.', el: '#rs-info', enter: tGo('research'), at: 'tl',
            base: () => ({ t: save.target }), wait: b => !!save.target && save.target !== b.t },
        { title: 'Buy', text: 'When the research is done, the card says <b>Buy for ... credits</b>. Credits come from every battle; win, capture and destroy for more.', el: '#rs-info', enter: tGo('research'), at: 'tl' },
        { title: 'The garage', text: 'Open the <b>Garage</b>: every vehicle you own.', el: navBtn('garage'), wait: () => UIS.screen === 'garage' },
        { title: 'Your lineup', text: 'Your <b>lineup</b> holds up to 5 vehicles you can switch between in battle. <b>Add to lineup</b> on a card puts it here; the &times; takes it out.', el: '#g-lineup', enter: tGo('garage') },
        { title: 'Modules', text: 'Each vehicle you own has 5 <b>modules</b> (engine, armour, guns and more). Research them like vehicles: they install themselves when done.', el: '#g-info', enter: tGo('garage'), at: 'tl' },
        { title: 'Pick what you spawn in', text: 'Back on <b>Home</b>, the lineup slot marked <b>IN BATTLE</b> is what you spawn in. <b>Click another vehicle</b> in your lineup.', el: '#lineup', enter: tGo('menu'),
            when: () => save.lineup.length > 1, base: () => ({ s: save.sel }), wait: b => save.sel !== b.s },
        { title: 'Multiplayer', text: 'Open the <b>Multiplayer</b> tab to play with friends.', el: navBtn('mp'), when: () => !PARTY.code, wait: () => UIS.screen === 'mp' },
        { title: 'Join a game', text: 'Type a friend\'s <b>6-digit code</b> and press <b>Join</b>, or pick an open game from the list below.', el: '.mp-join', enter: tGo('mp'), when: () => !PARTY.code },
        { title: 'Host a game', text: 'Or <b>host</b>: pick the mode and options and press <b>HOST GAME</b>. Your code shows in the lobby; friends join with it, bots fill the empty places.', el: '.mp-side .sheet', enter: tGo('mp'), when: () => !PARTY.code }
    ]
});

// the menu's Training button says NEW until the player has finished a lesson
function trainBadge() { const e = $('#nv-train'); if (!e || !save) return; e.textContent = 'NEW'; e.classList.toggle('hidden', Tutor.list.some(l => Tutor.done(l.id))); }
// a step's helper key (lesson 1: K self-destructs), since the mouse is captured in battle
addEventListener('keydown', e => { const st = Tutor.active && Tutor.step; if (st && st.key === e.code && st.act && !e.repeat && !typing(e)) st.act[1](); });
function trainHub() {
    if (M) return;
    Tutor.hub({ title: 'Steel Storm training', intro: 'Short lessons where you do each step yourself. Lessons 1 and 2 are practice matches against easy bots: they never count for your stats or the leaderboards. Esc or "Skip lesson" leaves at any time.' });
}
// a new player's first visit: offer Basic training once (the answer, or just seeing it, is remembered)
function trainOffer() {
    if (!save || save.tutOffer || Tutor.active || M) return false;
    save.tutOffer = 1; writeSave();
    Tutor.offer({ kicker: 'Welcome', time: '2 minutes', les: 'basic', title: 'New here? Take Basic training?', text: 'A practice battle against a few easy bots: drive, aim, fire, capture a point and respawn. You do each step yourself.',
        answer: yes => { if (!yes) toast('Training is in the menu whenever you want it'); trainBadge(); } });
    return true;
}
$('#b-train').onclick = () => { ac(); trainHub(); };
function trainHook() {
    return {
        start: id => Tutor.start(id), stop: how => Tutor.stop(how), next: () => Tutor.next(), back: () => Tutor.back(), hub: () => trainHub(), offer: () => trainOffer(),
        get active() { return Tutor.active; }, get lesson() { return Tutor.lesson && Tutor.lesson.id; }, get i() { return Tutor.i; }, get title() { return Tutor.step && Tutor.step.title; },
        get finale() { return Tutor.finale; }, get stepDone() { return Tutor.stepDone; }, get hubOpen() { return Tutor.hubOpen; }, get offerOpen() { return Tutor.offerOpen; },
        get lessons() { return Tutor.list.map(l => ({ id: l.id, title: l.title, steps: l.steps.length, done: Tutor.done(l.id) })); },
        get fired() { return M && M.fired; }, get cam() { return Cam; }, get want() { return TRN.want; }, swap: trainSwap
    };
}
