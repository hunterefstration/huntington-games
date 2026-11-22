// ============================================================
// HOLDOUT: the game. Waves of ashen come at the players; kills pay cash; between waves the supply crate sells guns,
// upgrades, armour and perks for this run; every fifth wave is a boss. A run ends when everyone is down, and pays
// experience toward the next rank (ranks unlock guns and classes). The same code runs alone, as the host of a squad,
// and (drawing only) as a guest: see 70-net.js.
// ============================================================
const CLASSES = {
    assault: { name: 'ASSAULT', rank: 0, cd: 40, ability: 'ADRENALINE', desc: 'Six seconds of fast hands, fast legs and harder hits. Reloads a little quicker all the time.' },
    medic:   { name: 'MEDIC', rank: 2, cd: 32, ability: 'FIELD DRESSING', desc: 'Patch yourself up for 70 at once (squad mates nearby too). Wounds close faster by themselves.' },
    heavy:   { name: 'HEAVY', rank: 4, cd: 45, ability: 'BULWARK', desc: 'Eight seconds taking a third of the damage. Starts every run with armour on.' },
    recon:   { name: 'RECON', rank: 6, cd: 38, ability: 'MARK', desc: 'Eight seconds in which every ashen is marked and takes far more. Headshots always hit harder.' }
};
const PERKS = {
    vital:  { name: 'VITALITY', desc: '+25 health a level' }, agile: { name: 'AGILITY', desc: '+7% speed a level' }, fire: { name: 'FIREPOWER', desc: '+10% damage a level' },
    hands:  { name: 'QUICK HANDS', desc: 'reload 10% faster a level' }, scav: { name: 'SCAVENGER', desc: '+25% cash and more drops a level' }, eye: { name: 'DEADEYE', desc: '+15% headshot damage a level' }
};
const PERK_COST = [600, 1200, 2000];
const DIFFS = { easy: { name: 'RECRUIT', dmg: 0.6, count: 0.8, cash: 1.2, xp: 0.75 }, normal: { name: 'REGULAR', dmg: 1, count: 1, cash: 1, xp: 1 }, hard: { name: 'VETERAN', dmg: 1.4, count: 1.25, cash: 1.1, xp: 1.5 }, brutal: { name: 'ASHBORN', dmg: 1.9, count: 1.5, cash: 1.3, xp: 2.2 } };
const TIPS = ['Press E to aim down the sight: no right button needed.', 'Headshots do more than double. Aim high.', 'The supply crate opens between waves: press B.', 'A Cinder glows. Shoot it while it is still among its friends.', 'Brutes shrug off small rounds. Bring something heavy, or aim for the head.', 'Kills in a row raise your cash multiplier. Keep the chain going.', 'V is a quick strike with whatever you are holding.', 'Running? Your gun is down. Stop before you shoot.', 'Every fifth wave something bigger comes over the wall.', 'G throws a grenade. Cook nothing: it goes off in two seconds.'];

// ---- the HUD: only touches the page when something changed
const HUD = { last: {},
    set(id, v, prop) { const k = id + (prop || ''); if (this.last[k] === v) return false; this.last[k] = v; const el = $(id); if (prop === 'w') el.style.width = v; else if (prop === 'o') el.style.opacity = v; else if (prop === 'c') el.className = v; else if (prop === 'h') el.innerHTML = v; else el.textContent = v; return true; },
    reset() { this.last = {}; $('feed').innerHTML = ''; $('banner').className = ''; $('callout').className = ''; this.set('msg', ''); this.set('prompt', ''); this.set('hurt', 0, 'o'); this.set('dot', 0, 'o'); $('cross').style.opacity = ''; document.body.classList.remove('scoped'); },
    banner(text, sub) { const b = $('banner'); b.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : ''); b.className = ''; void b.offsetWidth; b.className = 'show'; },
    callout(text) { const b = $('callout'); b.textContent = text; b.className = ''; void b.offsetWidth; b.className = 'show'; },
    feed(html) { const f = $('feed'), d = document.createElement('div'); d.innerHTML = html; f.appendChild(d); while (f.children.length > 5) f.removeChild(f.firstChild); setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 4000); },
    hit(kill) { const h = $('hit'); h.className = kill ? 'kill' : ''; h.style.transition = 'none'; h.style.opacity = 1; h.style.transform = 'rotate(45deg) scale(' + (kill ? 1.5 : 1) + ')'; void h.offsetWidth; h.style.transition = 'opacity .25s'; h.style.opacity = 0; },
    // the cross opens with the spread and goes away when aiming; a scope fills the screen
    aim(ad, scoped, W) { this.set('dot', ad > 0.9 && !scoped && WINFO[W.id] && WINFO[W.id].scope ? 1 : 0, 'o'); const o = ad > 0.5 || W.melee ? 0 : ''; if (this.last.crossO !== o) { this.last.crossO = o; $('cross').style.opacity = o; } if (this.last.scoped !== scoped) { this.last.scoped = scoped; document.body.classList.toggle('scoped', !!scoped); } },
    spread(s) { const g = Math.round(5 + s * 420) + 'px'; if (this.last.gap !== g) { this.last.gap = g; $('cross').style.setProperty('--gap', g); } },
    from(dx, dz, yaw) { const a = Math.atan2(dx, dz) - yaw, el = $('dmg-dir'); el.style.transition = 'none'; el.style.transform = 'rotate(' + (-a + Math.PI).toFixed(2) + 'rad)'; el.style.opacity = 1; void el.offsetWidth; el.style.transition = 'opacity 1s'; el.style.opacity = 0; } };

const Game = { players: [], flows: [], frame: 0, over: false, shopOpen: false };
// start a run. o = { map, diff, cls, net } (net: null alone)
Game.start = function (o) {
    const G = Game, D = G.D = DIFFS[o.diff] || DIFFS.normal, sv = Save.data;
    G.diff = o.diff || 'normal'; G.cls = CLASSES[o.cls] ? o.cls : 'assault'; G.dmgK = D.dmg; G.net = o.net || null; G.mode = o.net && o.net.mode !== 'coop' ? 'dm' : 'holdout'; G.teams = !!o.net && o.net.mode === 'tdm'; G.teamK = [0, 0]; G.goal = o.net ? o.net.goal : 0; G.matchT = 480; G.lead = null; G.deaths = 0;
    G.wave = 0; G.phase = 'break'; G.phaseT = 4; G.toSpawn = []; G.spawnT = 0; G.cash = 0; G.kills = 0; G.heads = 0; G.shotsFired = 0; G.shotsHit = 0; G.combo = 0; G.comboT = 0; G.multiT = 0; G.multiN = 0; G.streak = 0; G.time = 0; G.over = false; G.overT = 0; G.frame = 0; G.slow = 0; G.shakeK = 0; G.earned = 0; G.bossAlive = null; G.xpRun = 0; G.shown = false;
    G.perks = { vital: 0, agile: 0, fire: 0, hands: 0, scav: 0, eye: 0 }; G.nades = 2; G.rockets = []; G.thrown = []; G.pickups = []; G.abilT = 0; G.abilOn = 0; G.shopOpen = false; G.dir = [0, 0, -1];
    Foes.clear(); World.clearFx(); HUD.reset();
    const s0 = World.spots.length ? World.spots[(Math.random() * World.spots.length) | 0] : World.home;
    const P = G.P = { id: 0, name: sv.name || 'You', x: World.home[0], z: World.home[1], yaw: Math.atan2(World.mid[0] - s0[0], World.mid[1] - s0[1]), pitch: 0, hp: 100, max: 100, armor: G.cls === 'heavy' ? 50 : 0, reload: 0, cool: 0, kick: 0, bob: 0, hurt: 0, dead: false, gone: false, lastHurt: -99, light: new Float32Array(4), swayX: 0, swayY: 0, flashT: 0, ads: 0, bloom: 0, moving: 0, running: false, melee: 0, swap: 0, vm: null, shots: 0 };
    P.team = G.net ? o.net.team : -1; G.players = [P].concat(G.net ? Net.others() : []); G.flows = G.players.map(() => World.newFlow()); G.flowT = 0; G.flowI = 0;
    // everyone starts at a different spot of the ring
    if (G.net) { const order = Net.roster.map(r => r.id), sp = World.spots.length ? World.spots : [World.home]; G.players.forEach(p => { const s = sp[(Math.max(0, order.indexOf(p === P ? Net.me.id : p.id)) * 5) % sp.length]; p.x = p.tx = s[0]; p.z = p.tz = s[1]; }); P.yaw = Math.atan2(P.x - World.mid[0], P.z - World.mid[1]); P.safe = G.mode === 'dm' ? 2 : 0; }
    G.players.forEach((p, k) => World.flow(G.flows[k], p.x, p.z));
    if (G.mode === 'dm') { G.phase = 'dm'; Net.scores(); }
    Game.stats(); P.hp = P.max;
    Gun.reset([G.mode === 'dm' && o.kit && Gun.models[o.kit] ? o.kit : 'carbine', null, Gun.models.pistol ? 'pistol' : null]); G.slot = 0; G.lastSlot = Gun.slots[2] ? 2 : 0; Gun.equip(Gun.slots[0], P);
    $('hud').dataset.mode = 'holdout'; Game.hud(true); Game.hint();
    Music.set('fight'); Snd.wind(true); sv.stats.games++; Save.store();
    // the first runs explain the keys, one line at a time
    G.tips = (sv.stats.games <= 2 && !G.net) ? [[1, 'W A S D to move    MOUSE to look    CLICK to fire'], [7, 'E aims down the sight    R reloads'], [13, '1 2 3 switch weapons    G throws a grenade    V strikes'], [19, 'X is your class ability    SHIFT sprints']] : []; G.tip = ''; G.tipT = 0;
};
// the numbers that perks, the class and the running ability change
Game.stats = function () {
    const G = Game, P = G.P, k = G.perks, ab = G.abilOn > 0;
    P.max = 100 + 25 * k.vital; P.speedK = (1 + 0.07 * k.agile) * (ab && G.cls === 'assault' ? 1.3 : 1); P.dmgK = (1 + 0.1 * k.fire) * (ab && G.cls === 'assault' ? 1.25 : 1) * (ab && G.cls === 'recon' ? 1.4 : 1);
    P.fastHands = (1 - 0.1 * k.hands) * (G.cls === 'assault' ? (ab ? 0.5 : 0.9) : 1); P.headK = (1 + 0.15 * k.eye) * (G.cls === 'recon' ? 1.2 : 1); P.regen = G.cls === 'medic' ? 2 : 1; P.guard = ab && G.cls === 'heavy' ? 0.33 : 1; P.cashK = 1 + 0.25 * k.scav;
};
Game.stop = function () { Snd.wind(false); HUD.reset(); delete $('hud').dataset.mode; if (Gun.cur) Gun.cur.node.visible = false; Music.set('menu'); };
Game.hint = function () { const G = Game; if (App.game !== G) return; HUD.set('msg', G.over ? '' : (!App.locked && !App.demo && !App.paused && !G.shopOpen ? 'CLICK TO FIGHT' : '')); };
Game.statLine = () => Foes.list.length + ' ashen';
Game.hud = function (all) {
    const G = Game, P = G.P, S = Gun.S, W = Gun.W; if (all) HUD.last = {};
    HUD.set('hp', Math.max(0, P.hp / P.max * 100).toFixed(0) + '%', 'w'); HUD.set('hp-n', Math.max(0, Math.ceil(P.hp))); HUD.set('hp-n', P.hp < P.max * 0.3 ? 'low' : '', 'c'); HUD.set('ar', Math.min(100, P.armor / 1.5).toFixed(0) + '%', 'w');
    if (W) { HUD.set('wname', W.name + (W.lvl ? '  ' + UP_NAMES[W.lvl] : '')); HUD.set('ammo', W.melee ? '' : P.reload > 0 ? '--' : S.ammo); HUD.set('ammo', !W.melee && S.ammo <= W.mag * 0.25 ? 'low' : '', 'c'); HUD.set('reserve', W.melee ? '' : ' / ' + S.reserve); }
    HUD.set('nades', (G.nades ? 'GRENADES ' + G.nades + '   ' : '') + CLASSES[G.cls].ability + (G.abilOn > 0 ? ' ACTIVE' : G.abilT > 0 ? ' ' + Math.ceil(G.abilT) + 's' : ' READY [X]'));
    HUD.set('cash', '$' + G.cash); const left = G.toSpawn.length + Foes.alive();
    if (G.mode === 'dm') { const t = Math.max(0, G.matchT), L = G.lead; HUD.set('hud-top', (G.teams ? (P.team ? 'RED ' : 'BLUE ') + G.teamK[P.team] + '     ' + (P.team ? 'BLUE ' : 'RED ') + G.teamK[1 - P.team] + '     FIRST TO ' + G.goal * 2 : 'KILLS ' + G.kills + ' / ' + G.goal + (L ? '     LEADER ' + L.name.toUpperCase() + ' ' + L.kills : '')) + '     ' + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')); HUD.set('cash', ''); HUD.set('prompt', P.dead && !G.over ? 'BACK IN ' + Math.ceil(Math.max(0, P.respawnT)) : P.safe > 0 ? 'SHIELDED' : 'TAB: SCORES'); return; }
    HUD.set('hud-top', 'WAVE ' + G.wave + (G.phase === 'fight' ? '     ' + left + ' LEFT' : '') + (G.combo > 1 ? '     x' + (1 + Math.min(10, G.combo) * 0.1).toFixed(1) : ''));
    HUD.set('prompt', G.over ? '' : G.tip ? G.tip : G.phase === 'break' && G.wave > 0 ? 'SUPPLY CRATE [B]      NEXT WAVE IN ' + Math.ceil(G.phaseT) + '  [ENTER]' : '');
};

// ---- waves
Game.nextWave = function () {
    const G = Game, w = ++G.wave, D = G.D, boss = w % 5 === 0, list = [];
    const pool = FOE_IDS.filter(id => !FOES[id].boss && FOES[id].from <= w && Foes.can(id)), total = pool.reduce((s, id) => s + FOES[id].w, 0), n = Math.min(70, Math.round((6 + w * 2.4) * D.count * (boss ? 0.6 : 1)) * (1 + (G.players.length - 1) * 0.6));
    const cnt = {}; for (let i = 0; i < n; i++) { let r = Math.random() * total, id = pool[0]; for (const p of pool) { r -= FOES[p].w; if (r <= 0) { id = p; break; } } const m = FOES[id].max; if (m && (cnt[id] || 0) >= m + (w >> 3)) id = 'walker'; cnt[id] = (cnt[id] || 0) + 1; list.push(id); }
    if (boss && Foes.can('furnace')) list.splice(Math.min(3, list.length), 0, 'furnace');
    G.toSpawn = list; G.hpK = (1 + 0.06 * (w - 1)) * (1 + (G.players.length - 1) * 0.25); G.spK = 1 + Math.min(0.3, 0.02 * w); G.phase = 'fight'; G.spawnT = 0.5;
    HUD.banner(boss ? 'BOSS WAVE' : 'WAVE ' + w, boss ? 'something big is coming over the wall' : n + ' ashen inbound'); Snd.boom(0.5); Snd.tone(boss ? 70 : 110, 0.4, 1.2, 'sawtooth', boss ? 50 : 82);
    if (G.net) Net.event('wave', { w, boss });
};
Game.spawnOne = function () {
    const G = Game, id = G.toSpawn.shift(), T = FOES[id], F = G.flows[(Math.random() * G.flows.length) | 0], p = World.farSpot(F, T.boss ? 30 : 24);
    const e = Foes.spawn(id, p[0], p[1], T.boss ? Math.max(1, G.wave / 5) * (1 + (G.players.length - 1) * 0.5) : G.hpK, G.spK);
    if (T.boss) { G.bossAlive = e; HUD.banner(T.name, 'bring it down'); Snd.boom(1); Game.shake(1, e.x, e.z); }
};
Game.waveDone = function () {
    const G = Game, bonus = Math.round((60 + 20 * G.wave) * G.D.cash); G.phase = 'break'; G.phaseT = 22; G.cash += bonus; G.earned += bonus;
    HUD.banner('WAVE ' + G.wave + ' CLEAR', '+$' + bonus + '    the supply crate is open: B'); Snd.ui('buy'); G.slow = 0.7;
    if (G.P.dead) Game.revive(); else G.P.hp = Math.min(G.P.max, G.P.hp + 25);
    if (G.net) Net.event('clear', { w: G.wave, bonus });
};

// ---- what the gun and the ashen tell the game
// one bullet (or pellet): what it meets first, a wall or a figure; a piercing round goes on through figures
Game.shot = function (P, ux, uy, uz, W, i) {
    const G = Game, wall = World.ray(P.x, World.eye, P.z, ux, uy, uz, 120); let left = W.pierce || 0, from = 0, end = wall, any = false; const done = [];
    if (G.mode === 'dm') { const h = Net.trace(P.x, World.eye, P.z, ux, uy, uz, wall); if (h.p) { any = true; end = h.t; let dmg = W.dmg * 0.62; if (W.falloff) dmg *= clamp(1 - (h.t - W.falloff[0]) / (W.falloff[1] - W.falloff[0]), 0.25, 1); if (h.head) dmg *= Math.min(2, W.head || 1.5); Net.hitPlayer(h.p, dmg, h.head, W.id); HUD.hit(false); Snd.tone(h.head ? 900 : 520, 0.09, 0.05, 'square'); } P.safe = 0; }
    else
    for (;;) {
        const h = Foes.trace(P.x, World.eye, P.z, ux, uy, uz, wall, done); if (!h.e || h.t < from) break; any = true; done.push(h.e);
        let dmg = W.dmg * P.dmgK; if (W.falloff) dmg *= clamp(1 - (h.t - W.falloff[0]) / (W.falloff[1] - W.falloff[0]), 0.25, 1); if (h.head) dmg *= (W.head || 1.5) * P.headK;
        G.hitFoe(h.e, dmg, h.head, 0); if (left-- <= 0) { end = h.t; break; } from = h.t;
    }
    if (i === 0) { G.shotsFired++; if (any) G.shotsHit++; }
    const ex = P.x + ux * end, ey = World.eye + uy * end, ez = P.z + uz * end;
    if (end >= wall - 0.01 && wall < 120) { World.spark(ex, ey, ez, 0.4); if (i < 3) World.dust(ex, ey, ez, 2); }
    if (i < 4 && Gun.cur) { const m = Gun.muzzleWorld(Game.tmp); World.tracer(m[0], m[1], m[2], ex, ey, ez); }
};
Game.tmp = [0, 0, 0];
// damage to an ashen from the local player: alone or as host it lands now; a guest tells the host
Game.hitFoe = function (e, dmg, head, splash) {
    const G = Game; if (G.net && !G.net.host) { e.flash = 1; World.blood(e.x, (head ? 1.65 : 1.1) * e.size, e.z, head ? 6 : 3); Net.hitFoe(e.id, dmg, head); HUD.hit(false); return; }
    const dead = Foes.damage(e, dmg, head, G, 0, splash); HUD.hit(dead); if (!dead) Snd.tone(head ? 900 : 520, 0.09, 0.05, 'square');
};
Game.meleeHit = function (P, dmg) {
    const G = Game, d = G.dir; let best = null, bd = 2.3;
    for (const e of Foes.list) { if (e.state === 'die') continue; const dx = e.x - P.x, dz = e.z - P.z, dist = Math.hypot(dx, dz); if (dist < bd + 0.3 * e.size && (dx * d[0] + dz * d[2]) / (dist || 1) > 0.55) { bd = dist; best = e; } }
    if (best) { G.hitFoe(best, dmg * P.dmgK, false, 0); Snd.noise(0.3, 900, 200, 0.12); G.shake(0.25); }
};
Game.rocket = function (P, dx, dy, dz, W) { const m = Gun.muzzleWorld([0, 0, 0]); Game.rockets.push({ x: m[0], y: m[1], z: m[2], vx: dx * 46, vy: dy * 46, vz: dz * 46, t: 0, dmg: W.dmg * P.dmgK, r: W.blast, by: 0 }); Snd.noise(0.5, 1500, 300, 0.7); };
Game.explode = function (x, y, z, r, dmg, mine) {
    const G = Game; World.boom(x, y, z, true); Snd.boom(0.8); G.shake(0.9, x, z);
    for (const e of Foes.list.slice()) { if (e.state === 'die') continue; const d = Math.hypot(e.x - x, e.z - z); if (d < r + 0.4 * e.size) { const k = clamp(1.15 - d / r, 0.2, 1); if (mine) G.hitFoe(e, dmg * k, false, 1); } }
    const P = G.P, pd = Math.hypot(P.x - x, P.z - z); if (mine && pd < r * 0.6 && !P.dead) G.hurt(0, 25 * (1 - pd / (r * 0.6)), x, z, null);       // your own blast, up close
};
// an ashen (or its spit, or a blast) hurts player k
Game.hurt = function (k, dmg, fx, fz, e) {
    const G = Game, P = G.players[k]; if (!P || P.dead) return;
    if (k !== 0) { if (G.net && G.net.host) Net.hurt(k, dmg, fx, fz); return; }
    dmg *= P.guard || 1; if (P.armor > 0) { const a = Math.min(P.armor, dmg * 0.6); P.armor -= a; dmg -= a; }
    P.hp -= dmg; P.hurt = 1; P.lastHurt = G.time; G.streak = 0; Snd.noise(0.35, 700, 120, 0.2); Snd.tone(90, 0.3, 0.2, 'sine', 50); HUD.from(fx - P.x, fz - P.z, P.yaw + Math.PI); G.shake(0.35);
    if (P.hp <= 0) { P.hp = 0; P.dead = true; Game.down(); }
};
Game.blastPlayers = function (x, z, r, dmg) { const G = Game; for (let k = 0; k < G.players.length; k++) { const p = G.players[k]; if (p.dead || p.gone) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < r) G.hurt(k, dmg * clamp(1.2 - d / r, 0.25, 1), x, z, null); } };
Game.shake = function (k, x, z) { const G = Game; if (!Save.data.settings.shake) return; let f = 1; if (x !== undefined) f = clamp(1 - Math.hypot(x - G.P.x, z - G.P.z) / 30, 0, 1); G.shakeK = Math.max(G.shakeK, k * f); };
Game.bossRage = function (e) { HUD.banner(e.T.name, 'it is furious'); Snd.boom(0.8); };
Game.gone = function (e) { };
// an ashen died. by = which player (0 = here); the host tells guests so each pays its own killer
Game.killed = function (e, head, by) {
    const G = Game, T = e.T; if (G.net && G.net.host) Net.event('k', { id: e.id, by, h: head ? 1 : 0 });
    if (T.boss) { G.bossAlive = null; World.boom(e.x, 1.5, e.z, true); Snd.boom(1); G.shake(1, e.x, e.z); HUD.banner(T.name + ' DOWN', 'well fought'); G.pickups.push({ kind: 'hp', x: e.x, z: e.z, t: 0 }, { kind: 'ammo', x: e.x + 0.6, z: e.z, t: 0 }); }
    else if (Math.random() < 0.09 * (1 + G.perks.scav * 0.4)) G.pickups.push({ kind: Math.random() < 0.45 ? 'hp' : 'ammo', x: e.x, z: e.z, t: 0 });
    if (by === 0) G.reward(T, head);
    Snd.tone(110, 0.2, 0.3, 'sawtooth', 60);
};
Game.reward = function (T, head) {
    const G = Game, P = G.P; G.kills++; if (head) G.heads++; G.streak++; G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = 3.5;
    const cash = Math.round(T.cash * (1 + Math.min(10, G.combo - 1) * 0.1) * G.D.cash * P.cashK * (head ? 1.25 : 1)); G.cash += cash; G.earned += cash; G.xpRun = (G.xpRun || 0) + (T.xp || 10) + (head ? 5 : 0);
    HUD.feed((head ? '<b>HEADSHOT</b> ' : '') + esc(T.name) + ' <b>+$' + cash + '</b>'); if (head) Snd.tone(1500, 0.12, 0.18, 'triangle', 2200);
    G.multiN = G.multiT > 0 ? G.multiN + 1 : 1; G.multiT = 1.3;
    if (G.multiN >= 2) { HUD.callout(['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL', 'RAMPAGE'][Math.min(5, G.multiN)]); Snd.tone(600 + G.multiN * 120, 0.12, 0.2, 'square', 900 + G.multiN * 150); }
    else if (G.streak % 10 === 0) HUD.callout(G.streak + ' KILL STREAK');
    Save.data.stats.kills++; if (head) Save.data.stats.heads++;
};
// the local player is down: alone, that is the end of the run
Game.down = function () {
    const G = Game, P = G.P; Snd.boom(0.6); Input.aimOn = false;
    if (G.mode === 'dm') { P.respawnT = 3; G.deaths++; G.streak = 0; if (Net.host) Net.scoreKill(P.lastBy || '', 'H', P.lastHead, P.lastW); else Net.event('dead', { by: P.lastBy || '', head: P.lastHead ? 1 : 0, w: P.lastW || '' }); P.lastBy = ''; return; }
    if (G.net) { Net.event('dead', {}); HUD.set('msg', 'YOU ARE DOWN'); if (G.players.some(p => !p.dead && !p.gone)) return; }
    Game.finish();
};
Game.finish = function () {
    const G = Game, sv = Save.data; if (G.over) return; G.over = true; G.overT = 2.2; if (G.net && G.net.host) Net.event('over', { w: G.wave });
    const key = World.id + '_' + G.diff, was = sv.stats.best[key] || 0, xp = Math.round(((G.xpRun || 0) + G.wave * 40 + (G.wave > 1 ? (G.wave - 1) * 10 : 0)) * G.D.xp), before = Save.rank();
    G.result = { wave: G.wave, kills: G.kills, heads: G.heads, acc: G.shotsFired ? Math.round(G.shotsHit / G.shotsFired * 100) : 0, cash: G.earned, xp, best: Math.max(was, G.wave), record: G.wave > was && G.wave > 1, before, time: G.time };
    sv.xp += xp; sv.stats.best[key] = Math.max(was, G.wave); sv.stats.time += G.time; Save.store(); G.result.after = Save.rank();
    Music.set('menu');
};

Game.revive = function () { const G = Game, P = G.P; P.dead = false; P.hp = Math.round(P.max * 0.5); P.hurt = 0; HUD.set('msg', ''); HUD.feed('<b>BACK ON YOUR FEET</b>'); Snd.ui('buy'); };
// a place to come back at: the ring spot farthest from everyone else who is alive
Game.spawnSpot = function () { const G = Game, sp = World.spots.length ? World.spots : [World.home]; let best = sp[0], bd = -1; for (const s of sp) { let d = 1e9; for (const p of G.players) if (!p.dead && !p.gone) d = Math.min(d, Math.hypot(p.x - s[0], p.z - s[1])); d += Math.random() * 3; if (d > bd) { bd = d; best = s; } } return best; };
Game.respawn = function () { const G = Game, P = G.P, s = Game.spawnSpot(); P.x = s[0]; P.z = s[1]; P.yaw = Math.atan2(P.x - World.mid[0], P.z - World.mid[1]); P.pitch = 0; P.dead = false; P.hp = P.max; P.armor = 0; P.hurt = 0; P.safe = 2; for (const id in Gun.state) { const w = Gun.stats(id); Gun.state[id].ammo = w.mag; Gun.state[id].reserve = w.reserve; } G.nades = 1; Gun.equip(Gun.slots[G.slot] || Gun.slots[0], P); Snd.ui('buy'); };
// we killed another player
Game.pvpKill = function (v, head) { const G = Game; G.kills++; if (head) G.heads++; G.streak++; G.xpRun += 15 + (head ? 5 : 0); HUD.hit(true); if (head) Snd.tone(1500, 0.12, 0.18, 'triangle', 2200); G.multiN = G.multiT > 0 ? G.multiN + 1 : 1; G.multiT = 4; HUD.callout(G.multiN >= 2 ? ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL', 'RAMPAGE'][Math.min(5, G.multiN)] : G.streak >= 3 ? G.streak + ' IN A ROW' : head ? 'HEADSHOT' : 'ELIMINATED'); Snd.tone(600 + G.multiN * 120, 0.12, 0.2, 'square', 900 + G.multiN * 150); Save.data.stats.kills++; };
Game.finishMatch = function (winId) {
    const G = Game, sv = Save.data; if (G.over) return; G.over = true; G.overT = 1.6; const won = G.teams ? winId === 't' + G.P.team : winId === Net.me.id, rows = Net.roster.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths), place = rows.findIndex(r => r.id === Net.me.id) + 1, w = Net.roster.find(r => r.id === winId);
    const xp = Math.round(G.xpRun + (won ? 150 : 40)), before = Save.rank(); sv.xp += xp; if (won) sv.stats.mpWins++; sv.stats.time += G.time; Save.store();
    G.result = { title: G.teams ? (winId === 't1' ? 'RED' : 'BLUE') + ' TAKES IT' : won ? 'DEATHMATCH' : (w ? w.name.toUpperCase() + ' TAKES IT' : 'TIME'), big: won ? 'VICTORY' : G.teams ? 'DEFEAT' : '#' + place, wave: 0, kills: G.kills, heads: G.heads, acc: G.shotsFired ? Math.round(G.shotsHit / G.shotsFired * 100) : 0, cash: G.deaths, cashLabel: 'deaths', xp, record: false, before, after: Save.rank(), time: G.time };
    Music.set('menu'); Snd.boom(0.7);
};
// ---- the frame
Game.update = function (dt0) {
    const G = Game, P = G.P; let dt = dt0; G.frame++;
    if (G.slow > 0) { G.slow -= dt0; dt *= 0.35; }          // the last kill of a wave lands in slow motion
    G.time += dt;
    if (G.over) { G.overT -= dt0; if (G.overT <= 0 && !G.shown) { G.shown = true; UI.results(G.result); } dt *= 0.3; }
    // ---- the player
    let mx = 0, mz = 0, fire = false, run = false;
    if (!P.dead && !G.shopOpen) {
        const st = Save.data.settings, sens = 0.0023 * st.sens * lerp(1, (Gun.W ? Gun.W.adsFov : 60) / st.fov * st.adsSens, P.ads); P.yaw -= mouse.dx * sens; P.pitch = clamp(P.pitch - mouse.dy * sens, -1.45, 1.45);
        P.swayX = lerp(P.swayX, clamp(mouse.dx * 0.0006, -0.03, 0.03), Math.min(1, dt * 10)); P.swayY = lerp(P.swayY, clamp(mouse.dy * 0.0006, -0.03, 0.03), Math.min(1, dt * 10));
        const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        run = !!(keys.ShiftLeft || keys.ShiftRight) && f > 0 && P.reload <= 0;
        if (f || s) { const l = Math.hypot(f, s), sp = (run ? 5.6 : 3.7) * (Gun.W ? Gun.W.move : 1) * P.speedK * lerp(1, 0.6, P.ads) * dt / l, sn = Math.sin(P.yaw), cs = Math.cos(P.yaw); mx = (-sn * f + cs * s) * sp; mz = (-cs * f - sn * s) * sp; }
        if (mx && !World.blocked(P.x + mx, P.z, 0.34)) P.x += mx; if (mz && !World.blocked(P.x, P.z + mz, 0.34)) P.z += mz;
        if (mx || mz) P.bob += Math.hypot(mx, mz); if (run && Input.aimOn) Input.aimOn = false;
        fire = mouse.down && App.locked;
        // weapons: 1, 2, 3, Q = the one before, the wheel = the next
        let want = -1; if (hit.Digit1) want = 0; else if (hit.Digit2) want = 1; else if (hit.Digit3) want = 2; else if (hit.KeyQ) want = G.lastSlot; else if (mouse.wheel) { for (let k = 1; k <= 3; k++) { const j = (G.slot + (mouse.wheel > 0 ? k : 3 - k)) % 3; if (Gun.slots[j]) { want = j; break; } } }
        if (want >= 0 && want !== G.slot && Gun.slots[want] && P.swap <= 0) { P.swap = 0.44; P.swapTo = want; P.reload = 0; Input.aimOn = false; }
        if (hit.KeyG && G.nades > 0) { G.nades--; const d = G.dir; G.thrown.push({ x: P.x + d[0] * 0.5, y: World.eye - 0.1, z: P.z + d[2] * 0.5, vx: d[0] * 13, vy: d[1] * 13 + 4, vz: d[2] * 13, t: 0 }); Snd.noise(0.15, 1500, 400, 0.15, 300); }
        if (hit.KeyX && G.abilT <= 0 && G.abilOn <= 0) Game.ability();
        if ((hit.KeyB || hit.KeyF) && G.phase === 'break' && G.wave > 0 && !G.over) UI.shop(true);
        if (hit.Enter && G.phase === 'break' && G.wave > 0) G.phaseT = Math.min(G.phaseT, 0.01);
    }
    P.running = !!(run && (mx || mz)); P.moving = lerp(P.moving, mx || mz ? (run ? 1.6 : 1) : 0, Math.min(1, dt * 8));
    if (P.swap > 0) { const was = P.swap; P.swap -= dt; if (was > 0.22 && P.swap <= 0.22) { G.lastSlot = G.slot; G.slot = P.swapTo; Gun.equip(Gun.slots[G.slot], P); } }
    const cp = Math.cos(P.pitch); G.dir[0] = -Math.sin(P.yaw) * cp; G.dir[1] = Math.sin(P.pitch); G.dir[2] = -Math.cos(P.yaw) * cp;
    Gun.update(dt, P, fire && P.swap <= 0 && !G.shopOpen, mouse.fired && P.swap <= 0 && !G.shopOpen, G);
    HUD.spread(Gun.W ? lerp(Gun.W.spread[0], Gun.W.spread[1], P.ads) + P.bloom + P.moving * 0.02 : 0.02);
    if (G.abilOn > 0) { G.abilOn -= dt; if (G.abilOn <= 0) { Game.stats(); G.abilT = CLASSES[G.cls].cd; } } else if (G.abilT > 0) G.abilT -= dt;
    // ---- rockets, grenades, things lying about
    for (let i = G.rockets.length - 1; i >= 0; i--) { const r = G.rockets[i]; r.t += dt; let boom = r.t > 4; for (let s = 0; s < 3 && !boom; s++) { const h = dt / 3; r.x += r.vx * h; r.y += r.vy * h; r.z += r.vz * h; if (r.y <= 0.05 || World.blocked(r.x, r.z, 0.08) && World.ray(r.x - r.vx * h, r.y, r.z - r.vz * h, r.vx / 46, r.vy / 46, r.vz / 46, 1.2) < 1.2) boom = true; else for (const e of Foes.list) if (e.state !== 'die' && Math.hypot(e.x - r.x, e.z - r.z) < 0.5 * e.size && r.y < 1.95 * e.size) { boom = true; break; } }
        World.smoke.add(r.x, r.y, r.z, 0, 0.3, 0, 0.25, 1.2, 0.7, 0.8, 0.8, 0.8, 0.5); World.sparks.add(r.x, r.y, r.z, 0, 0, 0, 0.5, -3, 0.08, 1, 0.8, 0.5, 1);
        if (boom) { Game.explode(r.x, Math.max(0.2, r.y), r.z, r.r, r.dmg, r.by === 0); G.rockets.splice(i, 1); } }
    { const B = World.balls, e = B.instanceMatrix.array; let n = 0;
        for (let i = G.thrown.length - 1; i >= 0; i--) { const g = G.thrown[i]; g.t += dt; g.vy -= 12 * dt; const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt; if (World.blocked(nx, g.z, 0.07)) g.vx *= -0.4; else g.x = nx; if (World.blocked(g.x, nz, 0.07)) g.vz *= -0.4; else g.z = nz; g.y += g.vy * dt; if (g.y < 0.07) { g.y = 0.07; g.vy *= -0.35; g.vx *= 0.6; g.vz *= 0.6; }
            if (g.t > 2) { Game.explode(g.x, 0.3, g.z, 5.5, 380 * P.dmgK, true); G.thrown.splice(i, 1); continue; }
            const o = n++ * 16; e.fill(0, o, o + 16); e[o] = e[o + 5] = e[o + 10] = e[o + 15] = 1; e[o + 12] = g.x; e[o + 13] = g.y; e[o + 14] = g.z; }
        B.count = n; if (n) B.instanceMatrix.needsUpdate = true; }
    { const C = World.crates, e = C.instanceMatrix.array, c = C.instanceColor.array; let n = 0;
        for (let i = G.pickups.length - 1; i >= 0; i--) { const p = G.pickups[i]; p.t += dt; if (p.t > 30) { G.pickups.splice(i, 1); continue; }
            if (!P.dead && Math.hypot(p.x - P.x, p.z - P.z) < 1.1) { if (p.kind === 'hp' && P.hp < P.max) { P.hp = Math.min(P.max, P.hp + 35); HUD.feed('<b>MEDKIT</b> +35'); Snd.ui('buy'); G.pickups.splice(i, 1); continue; } if (p.kind === 'ammo') { for (const id in Gun.state) { const w = Gun.stats(id); Gun.state[id].reserve = Math.min(w.reserve, Gun.state[id].reserve + Math.ceil(w.mag * 1.5)); } HUD.feed('<b>AMMO</b>'); Snd.ui('buy'); G.pickups.splice(i, 1); continue; } }
            const o = n * 16, a = p.t * 1.5, ca = Math.cos(a), sa = Math.sin(a); e.fill(0, o, o + 16); e[o] = ca; e[o + 2] = -sa; e[o + 5] = 1; e[o + 8] = sa; e[o + 10] = ca; e[o + 15] = 1; e[o + 12] = p.x; e[o + 13] = 0.28 + Math.sin(p.t * 3) * 0.06; e[o + 14] = p.z;
            if (p.kind === 'hp') { c[n * 3] = 1.6; c[n * 3 + 1] = 0.25; c[n * 3 + 2] = 0.2; } else { c[n * 3] = 0.5; c[n * 3 + 1] = 0.95; c[n * 3 + 2] = 0.35; } n++; }
        C.count = n; if (n) { C.instanceMatrix.needsUpdate = true; C.instanceColor.needsUpdate = true; } }
    // ---- the ashen and the waves (not on a guest: the host runs them)
    const guest = G.net && !G.net.host;
    if (!guest) {
        G.flowT -= dt; if (G.flowT <= 0) { G.flowT = 0.3 / G.players.length; const k = G.flowI = (G.flowI + 1) % G.players.length, p = G.players[k]; if (!p.dead && !p.gone) World.flow(G.flows[k], p.x, p.z); }
        if (G.mode === 'dm') { if (!G.over) { G.matchT -= dt; if (G.matchT <= 0 && G.net.host) { const win = Net.leader(); Net.all({ t: 'end', win }); G.finishMatch(win); } } }
        else {
        if (G.phase === 'break' && !G.over) { if (!(G.shopOpen && !G.net)) G.phaseT -= dt; if (G.phaseT <= 0) { if (G.shopOpen) UI.shop(false); Game.nextWave(); } }
        else if (G.phase === 'fight') {
            G.spawnT -= dt; if (G.toSpawn.length && G.spawnT <= 0 && Foes.alive() < Foes.max) { Game.spawnOne(); G.spawnT = Math.max(0.12, 0.7 - G.wave * 0.03); }
            if (!G.toSpawn.length && !Foes.alive() && !G.over) Game.waveDone();
        }
        Foes.update(dt, G); }
    } else Net.guestStep(dt);
    if (G.mode === 'dm') { if (P.dead && !G.over) { P.respawnT -= dt; if (P.respawnT <= 0) Game.respawn(); } P.safe = Math.max(0, (P.safe || 0) - dt); }
    if (G.net) Net.step(dt);
    // ---- feedback
    if (!P.dead && G.time - P.lastHurt > (G.mode === 'dm' ? 7 : 5) && P.hp < P.max) P.hp = Math.min(P.max, P.hp + dt * 6 * P.regen);
    if (G.tips.length && G.time > G.tips[0][0]) { G.tip = G.tips.shift()[1]; G.tipT = 5.5; Snd.ui('hover'); } if (G.tipT > 0) { G.tipT -= dt; if (G.tipT <= 0) G.tip = ''; }
    if (Foes.list.length && Math.random() < dt * 0.35) { const e = Foes.list[(Math.random() * Foes.list.length) | 0]; if (e.state !== 'die') Snd.groan(clamp(1.1 - Math.hypot(e.x - P.x, e.z - P.z) / 28, 0, 1)); }
    P.hurt = Math.max(0, P.hurt - dt * 1.5); G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; G.multiT -= dt; G.shakeK = Math.max(0, G.shakeK - dt * 2.4);
    HUD.set('hurt', P.dead ? 0.85 : (P.hurt * 0.8 + (P.hp < P.max * 0.3 ? 0.25 : 0)).toFixed(2), 'o');
    Game.hud(false);
};
Game.ability = function () {
    const G = Game, P = G.P, c = G.cls; Snd.tone(300, 0.2, 0.4, 'sawtooth', 900); HUD.callout(CLASSES[c].ability);
    if (c === 'medic') { P.hp = Math.min(P.max, P.hp + 70); G.abilT = CLASSES[c].cd; if (G.net) Net.event('heal', { x: P.x, z: P.z }); }
    else { G.abilOn = c === 'assault' ? 6 : 8; Game.stats(); if (c === 'recon') for (const e of Foes.list) e.flash = 1; }
};
Game.render = function () {
    const G = Game, P = G.P, A = World.A, cam = World.camera, d = G.dir, bobY = Math.sin(P.bob * 3.4) * 0.025 * (1 - P.ads * 0.7), sh = G.shakeK * G.shakeK * 0.05, dead = P.dead ? Math.min(1, (G.time - P.lastHurt) * 1.5) : 0;
    const ey = World.eye + bobY - dead * 1.1 + (Math.random() - 0.5) * sh, sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    cam.lookFrom(P.x, ey, P.z, P.x + d[0] + sx, ey + d[1] + sy + dead * 0.4, P.z + d[2]);
    const cw = cam.matrixWorld.elements; World.shBegin(); Foes.render(P, 1 / 60); if (G.net) Net.render(P); World.shEnd();
    if (G.abilOn > 0 && G.cls === 'recon') for (const e of Foes.list) if (e.state !== 'die') e.flash = Math.max(e.flash, 0.5);
    World.step(1 / 60, cw); draw(World.scene, cam, true);
    A.probe(P.x, P.z, P.light);
    if (!P.dead) Gun.render(P);
};
