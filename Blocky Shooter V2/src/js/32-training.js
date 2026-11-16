// ===== 5.6 Training: three lessons on the Tutor engine (31-tutor.js), the TRAINING button (home), the first-visit offer =====
// Boot camp runs on a SANDBOX practice range (TUTB.on): sandbox runs never touch life (xp, kills, best waves: the launcher's
// leaderboards read them), runSaveOK() is false so the player's saved run on disk is kept, no waves spawn (the lesson brings its
// own zombies) and you cannot die. Lessons done: settings.tut[id] = 1, the offer: settings.tutOffer (blocky21_settings, synced).
const TUTB = { on: null, run: null, view: 'home' };
Tutor.config({ done: id => !!(settings.tut && settings.tut[id]), mark: id => { settings.tut = Object.assign({}, settings.tut, { [id]: 1 }); saveSettings(); trainLabel(); }, z: 9000, nextKey: 'Enter' });
const kbd = k => '<kbd>' + k + '</kbd>';
const tRect = (...els) => {                                   // the box around several elements
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    for (const e of els) { if (!e) continue; const q = e.getBoundingClientRect(); if (q.width < 1) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    return r > l ? { left: l, top: t, width: r - l, height: b - t } : null;
};
const clsOpen = () => !$('cls-overlay').classList.contains('hidden');
const mpOpen = () => !ui.mp.classList.contains('hidden');
const rowOf = key => () => { const c = document.querySelector('#menu-panel [data-set="' + key + '"]'); return c && tRect(c.parentNode.previousElementSibling, c.parentNode); };
const showRow = key => { const c = document.querySelector('#menu-panel [data-set="' + key + '"]'); if (c) c.parentNode.scrollIntoView({ block: 'center' }); };

// ---- the practice range
function bootRun() {
    if (currentGameState !== 'main' || NET.on || CAMP.on) { toast('Training starts from the main menu', '#fcd34d', 2); return false; }
    if (clsOpen()) closeClasses();
    TUTB.on = 'boot'; TUTB.view = menuView; TUTB.run = { mode: 'sandbox', map: 'blockyard', diff: 'easy' };
    try {
        resetRun();                                 // in memory only: a saved run on disk stays where it is
        changeGameState('playing');                 // -> startFreshRun() with TUTB.run
    } finally { TUTB.run = null; }
    enemies.forEach(e => { scene.remove(e); disposeEnemy(e); }); enemies = []; waveActive = false; intermission = 0;
    playerStats.weapons = ['pistol', 'smg', 'ar', 'shotgun'].filter(w => weaponsDb[w]);
    playerStats.currentSecondary = 'grenade'; resetAmmo(); switchWeapon('pistol'); updateGunModel(); updateHUD();
    toast('TRAINING - PRACTICE RANGE', '#a5b4fc', 2);
    return true;
}
function bootLeave() {
    const was = TUTB.on; TUTB.on = null;
    if (!was) return;
    if (currentGameState === 'playing' || currentGameState === 'paused' || currentGameState === 'shop' || currentGameState === 'settings') {
        resetRun(); changeGameState('main'); setMenuView(TUTB.view === 'setup' ? 'setup' : 'home');
    }
}
function bootZombies(n) {                       // a few plain zombies 12-16 m in front of you
    const fw = new THREE.Vector3(); camera.getWorldDirection(fw); fw.y = 0; if (fw.lengthSq() < .01) fw.set(0, 0, -1); fw.normalize();
    for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * 0.35, d = 12 + i * 2, x = camera.position.x + (fw.x * Math.cos(a) - fw.z * Math.sin(a)) * d, z = camera.position.z + (fw.z * Math.cos(a) + fw.x * Math.sin(a)) * d;
        spawnEnemy(enemyTypes.grunt, x, z, groundAt(x, z, 0, 50), waveSpeed(1) * 0.7, waveReward(1));
    }
}
function bootDrop() {                          // a cash cube 4 m away, in front if nothing is in the way (else to the side, or behind)
    const fw = new THREE.Vector3(); camera.getWorldDirection(fw); const yaw = Math.atan2(-fw.x, -fw.z), o = new THREE.Vector3(camera.position.x, feetY + 1.2, camera.position.z);
    let d = null;
    for (const a of [0, .6, -.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) { const v = new THREE.Vector3(-Math.sin(yaw + a), 0, -Math.cos(yaw + a)); if (!raySolids(o, v, 5)) { d = v; break; } }
    if (!d) d = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    spawnPickup(new THREE.Vector3(o.x + d.x * 4, feetY, o.z + d.z * 4), 'cash', 25);
    return pickups[pickups.length - 1];
}
const bootIn = () => TUTB.on === 'boot' && (currentGameState === 'playing' || currentGameState === 'paused' || currentGameState === 'shop' || currentGameState === 'settings');
Tutor.define({
    id: 'boot', title: 'Boot camp', blurb: 'Move, jump, sprint, slide, shoot, aim, reload, switch, grenade, ability, pickups, zombies', coach: true, next: 'loadout',
    begin: () => bootRun(), finish: () => bootLeave(), alive: () => bootIn(), atEnd: () => bootLeave(),
    end: 'You are ready for the real thing! Press <b>PLAY</b> for a run of waves. Next lesson: <b>Classes and loadout</b>.',
    steps: [
        { title: 'Move', text: 'Click the game to take control of the mouse, then use ' + kbd('W') + ' ' + kbd('A') + ' ' + kbd('S') + ' ' + kbd('D') + ' to walk around. The mouse looks around.',
            base: () => ({ x: camera.position.x, z: camera.position.z }), wait: b => Math.hypot(camera.position.x - b.x, camera.position.z - b.z) > 4 },
        { title: 'Jump', text: 'Press ' + kbd('Space') + ' to jump. You can climb onto crates and walls this way.', wait: () => !onGround },
        { title: 'Sprint', text: 'Hold ' + kbd('Shift') + ' while you walk forward to sprint.', base: () => ({ n: 0 }), wait: b => (b.n += sprintHeld && (moveForward || moveLeft || moveRight) ? 1 : 0) > 4 },
        { title: 'Slide', text: 'While sprinting, press ' + kbd('C') + ' to drop into a slide: a fast, low dodge.', wait: () => slideT > 0 },
        { title: 'Shoot', text: '<b>Left click</b> to shoot. The crosshair in the middle is where your bullets go.', base: () => ({ n: runStats.shots }), wait: b => runStats.shots > b.n },
        { title: 'Aim down sights', text: 'Hold the <b>right mouse button</b> (or ' + kbd('E') + ') to aim down the sights: slower, but much more accurate.', wait: () => vm.adsT > .6 },
        { title: 'Reload', text: 'Press ' + kbd('R') + ' to reload (fire a shot or two first if your gun is full). Your ammo shows bottom right.', el: '#hud-ammo-card',
            base: () => ({}), wait: () => isReloading },
        { title: 'Switch weapons', text: 'Press ' + kbd('1') + ' to ' + kbd('4') + ' or roll the <b>mouse wheel</b> to switch guns. Each one plays differently.', el: '#hud-slots',
            base: () => ({ w: playerStats.currentWeapon }), wait: b => playerStats.currentWeapon !== b.w },
        { title: 'Throw a grenade', text: 'Press ' + kbd('Q') + ' to throw your gadget: a grenade here. Buy other gadgets in the Armory.', el: '#hud-sec',
            base: () => ({ c: secondaryCooldown }), wait: b => secondaryCooldown > b.c + .1 },
        { title: 'Class ability', text: 'Every class has its own ability on ' + kbd('X') + '. Use yours now; the bar shows when it is ready again.', el: '#hud-abil', when: () => !!myClass(),
            base: () => ({ c: abilityCd, t: abilityT }), wait: b => abilityCd > b.c + .5 || abilityT > b.t + .1 },
        { title: 'Pick up items', text: 'Zombies drop <b>cash</b> (yellow) and <b>health</b> (green). Walk over the cube that just dropped in front of you to grab it.',
            base: () => ({ p: bootDrop() }), wait: b => { if (b.p && !pickups.includes(b.p) && b.p.life <= 0) b.p = bootDrop(); return !!b.p && !pickups.includes(b.p) && b.p.life > 0; } },
        { title: 'Beat some zombies', text: 'Three zombies are coming! Shoot them down: <b>headshots</b> do extra damage. You cannot die on the practice range.',
            enter: () => { if (enemies.length < 3) bootZombies(3 - enemies.length); }, base: () => ({ k: runStats.kills }), wait: b => runStats.kills >= b.k + 3 }
    ]
});

// ---- menus: classes and loadout
const homeView = () => { if (currentGameState === 'shop') changeGameState('main'); if (clsOpen()) closeClasses(); if (mpOpen()) hideMP(); if (menuView !== 'home') setMenuView('home'); };
const inCls = f => () => { if (!clsOpen()) openClasses(CLSV.k); return f(); };
const setupTab = t => () => { if (currentGameState === 'shop') changeGameState('main'); if (clsOpen()) closeClasses(); if (menuView !== 'setup') setMenuView('setup'); if (menuTab !== t) { menuTab = t; renderMenu(); } };
const menuOk = () => currentGameState === 'main' || currentGameState === 'shop';
Tutor.define({
    id: 'loadout', title: 'Classes and loadout', blurb: 'Classes, levels and skill points, the skill tree, specialisations, the Armory, unlocks and camos', next: 'modes',
    begin: () => { if (!menuOk() || NET.on) return false; homeView(); return true; }, alive: () => menuOk(), finish: () => { if (clsOpen()) closeClasses(); if (currentGameState === 'shop') changeGameState('main'); },
    end: 'That is your loadout: a class you level up, gear from the Armory, and looks you unlock. Last lesson: <b>Modes and multiplayer</b>.',
    steps: [
        { title: 'Classes', text: 'Open <b>CLASSES</b>.', el: '#btn-classes', enter: () => { if (!clsOpen() && currentGameState === 'main' && menuView !== 'home') setMenuView('home'); }, wait: () => clsOpen() },
        { title: 'Eight classes', text: 'There are eight classes, each with its own ability (' + kbd('X') + ') and passive. <b>Click a different class</b> to see it.', el: inCls(() => document.querySelector('.cls-list')),
            base: () => ({ k: CLSV.k }), wait: b => CLSV.k !== b.k },
        { title: 'Levels and skill points', text: 'A class levels up as you play it: the bar shows its XP. Every level gives a <b>skill point</b>. <b>PLAY AS</b> makes it your class.', el: inCls(() => document.querySelector('.cls-top')) },
        { title: 'Specialisations', text: 'At levels ' + CLS_SPEC_LV.join(' and ') + ' you pick one <b>specialisation</b> in each row. You can change them any time, free.', at: 'tl',
            el: inCls(() => { const r = document.querySelectorAll('.cls-specrow'); return tRect(r[0], r[r.length - 1]); }) },
        { title: 'The skill tree', text: 'Spend skill points here: three branches, each node needs the one above it. <b>RESPEC</b> gives every point back for free.', at: 'tl',
            el: inCls(() => document.querySelector('.cls-tree')) },
        { title: 'The Armory', text: 'Close the classes screen and open the <b>ARMORY</b>.', el: () => clsOpen() ? document.querySelector('[data-cact="close"]') : $('btn-main-shop'), wait: () => currentGameState === 'shop' },
        { title: 'Guns and gear', text: 'In a run you spend the cash you earn here between waves: guns, upgrades, attachments, armour and gadgets. The newest guns unlock as your <b>rank</b> goes up.', el: () => $('shop-items'), at: 'tl',
            enter: () => { if (currentGameState === 'main') { returnMenuState = 'main'; changeGameState('shop'); } } },
        { title: 'Back to the menu', text: 'Press <b>BACK</b>.', el: () => currentGameState === 'shop' ? ui.btnShopBackTop : null, wait: () => currentGameState === 'main' },
        { title: 'Ranks and unlocks', text: 'Press <b>PLAY</b>, then open the <b>RANKS</b> tab.', el: () => menuView === 'setup' ? document.querySelector('#menu-tabs [data-tab="ranks"]') : $('btn-home-play'), wait: () => menuView === 'setup' && menuTab === 'ranks' },
        { title: 'What ranks unlock', text: 'Your <b>rank</b> rises with XP from every run. Ranks unlock weapons, maps, modes and cosmetics; at max rank you can <b>prestige</b>.', el: '#menu-panel', enter: setupTab('ranks'), at: 'tr' },
        { title: 'Camos', text: 'Open the <b>CUSTOMIZE</b> tab.', el: () => document.querySelector('#menu-tabs [data-tab="customize"]'), enter: () => { if (menuView !== 'setup') setMenuView('setup'); }, wait: () => menuTab === 'customize' },
        { title: 'Weapon camos', text: '<b>Camos</b> paint every gun. Locked ones show how to earn them: ranks, prestige, bosses and challenges. Sleeves, gloves, tracers and crosshairs are here too.', el: rowOf('camo'), enter: () => { setupTab('customize')(); showRow('camo'); }, at: 'tr' }
    ]
});
Tutor.define({
    id: 'modes', title: 'Modes and multiplayer', blurb: 'Solo modes, PvP modes and HUNTED, Boss Rush, party codes and chat',
    begin: () => { if (!menuOk() || NET.on) return false; homeView(); return true; }, alive: () => menuOk(), finish: () => { if (mpOpen() && !NET.on) { NET.view = 'home'; hideMP(); } },
    end: 'You know your way around! Jump into a run, or host a party and share the code. All three lessons stay in <b>TRAINING</b>.',
    steps: [
        { title: 'Solo modes', text: 'Press <b>PLAY</b> to see the modes.', el: () => $('btn-home-play'), enter: () => { if (mpOpen()) hideMP(); }, wait: () => menuView === 'setup' },
        { title: 'Pick a mode', text: '<b>CLASSIC</b>: survive the waves, the Armory opens between them. <b>RUSH</b>: no breaks, more cash. <b>BOSS RUSH</b>: every wave is a boss fight. <b>SANDBOX</b>: everything unlocked, you cannot die.',
            el: rowOf('mode'), enter: () => { setupTab('play')(); showRow('mode'); }, at: 'tr' },
        { title: 'Maps and difficulty', text: 'Pick a map (or RANDOM), the lighting and a difficulty below. Harder difficulties pay more XP.', el: rowOf('diff'), enter: () => { setupTab('play')(); showRow('diff'); }, at: 'tr' },
        { title: 'Back', text: 'Press <b>BACK</b> to return to the home screen.', el: () => $('btn-setup-back'), wait: () => menuView === 'home' },
        { title: 'Multiplayer', text: 'Open <b>MULTIPLAYER</b>.', el: () => $('btn-mp'), enter: () => { if (!mpOpen() && menuView !== 'home') setMenuView('home'); }, wait: () => mpOpen() },
        { title: 'Host or join', text: '<b>HOST A PARTY</b> gives you a <b>6-digit code</b> to tell your friends; they press <b>JOIN A PARTY</b> and type it in. Up to 10 players.',
            el: () => mpOpen() && tRect($('mp-host'), $('mp-join')), enter: () => { if (!mpOpen()) openMP('home'); } },
        { title: 'PvP modes', text: 'The host picks the mode: CO-OP waves, team deathmatch 1v1 to 5v5, Free-for-all, Gun Game, Kill Confirmed, Capture the Flag, King of the Hill, Infection, the Tournament and <b>HUNTED</b> (one player has 300 HP and a Minigun, and only they score). Bots can fill empty places.',
            el: () => mpOpen() && document.querySelector('#mp-body .mdesc.mt-6'), enter: () => { if (!mpOpen()) openMP('home'); }, at: 'tl' },
        { title: 'Join with a code', text: 'Press <b>JOIN A PARTY</b>.', el: () => mpOpen() && $('mp-join'), enter: () => { if (!mpOpen()) openMP('home'); }, wait: () => mpOpen() && NET.view === 'join' },
        { title: 'Type the code', text: 'Type the host\'s 6-digit code here and press <b>JOIN</b>. (No need now: press Next.)', el: () => $('mp-join-code') },
        { title: 'Chat', text: 'In the launcher, press ' + kbd('T') + ' (in the game too) to open the chat: in a party it talks to your party. Be nice!', el: null, enter: () => { if (mpOpen() && NET.view === 'join' && !NET.on) { NET.view = 'home'; hideMP(); } } }
    ]
});

// ---- the TRAINING button, the list, the first-visit offer
function trainLabel() { const e = $('btn-training-sub'); if (!e) return; const n = Tutor.list.filter(l => Tutor.done(l.id)).length; e.textContent = n ? n + ' / ' + Tutor.list.length : 'NEW'; }
function trainHub() {
    if (currentGameState !== 'main') return;
    Tutor.hub({ title: 'Blocky Shooter training', intro: 'Short lessons where you do each step yourself. Boot camp is a practice range: it never counts for your XP, kills, best waves or the leaderboards. Esc or "Skip lesson" leaves at any time.' });
}
function trainOffer() {
    if (settings.tutOffer || Tutor.active || currentGameState !== 'main' || NET.on || (life.runs | 0) > 0 || (+life.xp || 0) > 0) return false;
    settings.tutOffer = 1; saveSettings();
    Tutor.offer({ kicker: 'Welcome', time: '3 minutes', les: 'boot', title: 'New here? Try Boot camp?', text: 'A practice range: move, shoot, aim, reload, throw a grenade and take down a few zombies. You do each step yourself, and nothing counts.',
        answer: yes => { if (!yes) toast('TRAINING is on the home screen any time', '#a5b4fc', 2); } });
    return true;
}
$('btn-training').addEventListener('click', () => { initAudio(); sfx('click'); trainHub(); });
trainLabel();
{ let n = 0; const iv = setInterval(() => { if (++n > 80 || settings.tutOffer) return clearInterval(iv); if (currentGameState === 'main' && window.__hgReady && menuView === 'home') { clearInterval(iv); setTimeout(trainOffer, 600); } }, 500); }
Object.assign(window.__blocky, {
    tut: {
        start: id => Tutor.start(id), stop: how => Tutor.stop(how), next: () => Tutor.next(), back: () => Tutor.back(), hub: () => trainHub(), offer: () => trainOffer(),
        get active() { return Tutor.active; }, get lesson() { return Tutor.lesson && Tutor.lesson.id; }, get i() { return Tutor.i; }, get title() { return Tutor.step && Tutor.step.title; },
        get finale() { return Tutor.finale; }, get hubOpen() { return Tutor.hubOpen; }, get offerOpen() { return Tutor.offerOpen; }, get on() { return TUTB.on; },
        get lessons() { return Tutor.list.map(l => ({ id: l.id, title: l.title, steps: l.steps.length, done: Tutor.done(l.id) })); },
        get move() { return { onGround, slideT, sprintHeld, isReloading, ads: vm.adsT, sec: secondaryCooldown, abil: abilityCd, shots: runStats.shots, kills: runStats.kills, weapon: playerStats.currentWeapon, mode: run.mode, enemies: enemies.length, pickups: pickups.length }; },
        get drop() { const p = pickups[pickups.length - 1]; return p ? { x: p.mesh.position.x, y: p.mesh.userData.baseY - 0.9, z: p.mesh.position.z } : null; }
    }
});
