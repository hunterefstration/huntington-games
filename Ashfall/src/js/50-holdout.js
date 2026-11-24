// ============================================================
// HOLDOUT: the game. Waves of ashen come at the players; kills pay cash; between waves the supply crate sells guns,
// upgrades, armour and perks for this run; every fifth wave is a boss. A run ends when everyone is down, and pays
// experience toward the next rank (ranks unlock guns and classes). The same code runs alone, as the host of a squad,
// and (drawing only) as a guest: see 70-net.js.
// ============================================================
const CLASSES = {
    assault: { name: 'ASSAULT', rank: 0, cd: 40, ability: 'ADRENALINE', desc: 'Six seconds of fast hands, fast legs and harder hits. Reloads a little quicker all the time.' },
    medic:   { name: 'MEDIC', rank: 0, cd: 32, ability: 'FIELD DRESSING', desc: 'Patch yourself up for 70 at once (squad mates nearby too). Wounds close faster by themselves.' },
    heavy:   { name: 'HEAVY', rank: 1, cd: 45, ability: 'BULWARK', desc: 'Eight seconds taking a third of the damage. Starts every run with armour on.' },
    recon:   { name: 'RECON', rank: 1, cd: 38, ability: 'MARK', desc: 'Eight seconds in which every ashen is marked and takes far more. Headshots always hit harder.' },
    engineer: { name: 'ENGINEER', rank: 0, cd: 45, ability: 'SENTRY GUN', desc: 'Sets down a sentry gun that fights beside you for 25 seconds. The supply crate sells you guns a tenth cheaper.' },
    demo:     { name: 'DEMOLITIONS', rank: 2, cd: 35, ability: 'CLUSTER CHARGE', desc: 'Five blasts walk out from where you are looking. One more throwable, and every blast of yours is wider.' },
    marksman: { name: 'MARKSMAN', rank: 3, cd: 30, ability: 'MARK FOR DEATH', desc: 'The biggest thing in sight takes double from everything for ten seconds. Your shots beyond 15 metres always hit harder.' },
    scout:    { name: 'SCOUT', rank: 3, cd: 7, ability: 'DASH', desc: 'A burst of speed that nothing can touch you during. Always a tenth faster on your feet.' }
};
const PERKS = {
    vital:  { name: 'VITALITY', desc: '+25 health a level' }, agile: { name: 'AGILITY', desc: '+7% speed a level' }, fire: { name: 'FIREPOWER', desc: '+10% damage a level' },
    hands:  { name: 'QUICK HANDS', desc: 'reload 10% faster a level' }, scav: { name: 'SCAVENGER', desc: '+25% cash and more drops a level' }, eye: { name: 'DEADEYE', desc: '+15% headshot damage a level' }
};
const PERK_COST = [600, 1200, 2000];
const DIFFS = { easy: { name: 'RECRUIT', dmg: 0.6, count: 0.8, cash: 1.2, xp: 0.75 }, normal: { name: 'REGULAR', dmg: 1, count: 1, cash: 1, xp: 1 }, hard: { name: 'VETERAN', dmg: 1.4, count: 1.25, cash: 1.1, xp: 1.5 }, brutal: { name: 'ASHBORN', dmg: 1.9, count: 1.5, cash: 1.3, xp: 2.2 } };
const RULES = { classic: { name: 'CLASSIC', blurb: 'Waves with a breather between them. The supply crate opens in the breaks.' }, rush: { name: 'RUSH', blurb: 'No breathers: the next wave is already coming. Half as much cash again, and the crate opens any time (nothing stops while you shop).' }, boss: { name: 'BOSS RUSH', blurb: 'Something big comes over the wall every wave. You start with $2000.' }, sandbox: { name: 'SANDBOX', blurb: 'All the cash you can spend and every weapon in the crate whatever your rank. Nothing is recorded: try things.' } };
const TIPS = ['Press E to aim down the sight: no right button needed.', 'Headshots do more than double. Aim high.', 'The armory opens between waves (B): guns, attachments, gear and perks, all for this run.', 'A Cinder glows. Shoot it while it is still among its friends.', 'Brutes shrug off small rounds. Bring something heavy, or aim for the head.', 'Kills in a row raise your cash multiplier. Keep the chain going.', 'V is a quick strike with whatever you are holding.', 'Running? Your gun is down. Stop before you shoot.', 'Every fifth wave something bigger comes over the wall.', 'G throws a grenade. Cook nothing: it goes off in two seconds.'];

// ---- the HUD: only touches the page when something changed
const HUD = { last: {},
    set(id, v, prop) { const k = id + (prop || ''); if (this.last[k] === v) return false; this.last[k] = v; const el = $(id); if (prop === 'w') el.style.width = v; else if (prop === 'o') el.style.opacity = v; else if (prop === 'c') el.className = v; else if (prop === 'h') el.innerHTML = v; else el.textContent = v; return true; },
    reset() { this.last = {}; $('boss').className = 'hidden'; $('obj').className = 'hidden'; $('way').className = 'hidden'; $('feed').innerHTML = ''; $('banner').className = ''; $('callout').className = ''; this.set('msg', ''); this.set('prompt', ''); $('between').className = 'hidden'; this.set('hurt', 0, 'o'); this.set('dot', 0, 'o'); $('cross').style.opacity = ''; document.body.classList.remove('scoped'); },
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
    G.diff = o.diff || 'normal'; G.cls = CLASSES[o.cls] ? o.cls : 'assault'; G.dmgK = D.dmg; G.net = o.net || null; G.mode = o.net && o.net.mode !== 'coop' ? 'dm' : 'holdout'; G.teams = !!o.net && !!MP_MODES[o.net.mode].teams; G.teamK = [0, 0]; G.goal = o.net ? o.net.goal : 0; G.matchT = 480; G.lead = null; G.deaths = 0;
    G.wave = 0; G.phase = 'break'; G.phaseT = 4; G.toSpawn = []; G.spawnT = 0; G.cash = 0; G.kills = 0; G.heads = 0; G.shotsFired = 0; G.shotsHit = 0; G.combo = 0; G.comboT = 0; G.multiT = 0; G.multiN = 0; G.streak = 0; G.time = 0; G.over = false; G.overT = 0; G.frame = 0; G.slow = 0; G.shakeK = 0; G.earned = 0; G.bossAlive = null; G.rule = RULES[o.rule] && !o.net ? o.rule : 'classic'; if (G.rule === 'boss') G.cash = 2000; G.demo = !!o.demo; G.xpRun = 0; G.shown = false; G.strike = false; G.strikeAt = 12; G.falling = [];
    G.cp = Extras.perksOf(G.cls); G.perks = { vital: 0, agile: 0, fire: 0, hands: 0, scav: 0, eye: 0 }; G.nades = 2; G.rockets = []; G.thrown = []; G.pickups = []; G.abilT = 0; G.abilOn = 0; G.shopOpen = false; G.dir = [0, 0, -1];
    Foes.clear(); World.clearFx(); HUD.reset();
    const s0 = World.spots.length ? World.spots[(Math.random() * World.spots.length) | 0] : World.home;
    const P = G.P = { id: 0, name: sv.name || 'You', x: World.home[0], z: World.home[1], yaw: Math.atan2(World.mid[0] - s0[0], World.mid[1] - s0[1]), pitch: 0, hp: 100, max: 100, armor: G.cls === 'heavy' ? 50 : 0, reload: 0, cool: 0, kick: 0, bob: 0, hurt: 0, dead: false, gone: false, lastHurt: -99, light: new Float32Array(4), swayX: 0, swayY: 0, flashT: 0, ads: 0, bloom: 0, moving: 0, running: false, melee: 0, swap: 0, vm: null, shots: 0, y: 0, vy: 0, dip: 0, jumpT: 0, air: false }; World.eye = 1.65; G.atts = {}; G.gotThrows = {}; G.nums = [];
    P.team = G.net ? o.net.team : -1; G.players = [P].concat(G.net ? Net.others() : []); G.flows = G.players.map(() => World.newFlow()); G.flowT = 0; G.flowI = 0;
    // everyone starts at a different spot of the ring
    if (G.net) { const order = Net.roster.map(r => r.id), sp = World.spots.length ? World.spots : [World.home]; G.players.forEach(p => { const s = sp[(Math.max(0, order.indexOf(p === P ? Net.me.id : p.id)) * 5) % sp.length]; p.x = p.tx = s[0]; p.z = p.tz = s[1]; }); P.yaw = Math.atan2(P.x - World.mid[0], P.z - World.mid[1]); P.safe = G.mode === 'dm' ? 2 : 0; }
    G.players.forEach((p, k) => World.flow(G.flows[k], p.x, p.z));
    if (G.mode === 'dm') { G.phase = 'dm'; Net.scores(); }
    Game.stats(); P.hp = P.max;
    const kit = Armory.kit(), g1 = G.mode === 'dm' && o.kit && Gun.models[o.kit] ? o.kit : Gun.models[kit.primary] ? kit.primary : 'carbine', g2 = kit.sidearm && Gun.models[kit.sidearm] ? kit.sidearm : Gun.models.pistol ? 'pistol' : null;
    Gun.reset([g1, null, g2]); G.slot = 0; G.lastSlot = Gun.slots[2] ? 2 : 0; Gun.equip(Gun.slots[0], P); Armory.begin(G, P, kit); Extras.begin(G, P, o);
    Marks.clear(); G.op = null; G.crew = G.players.length; if (G.mode === 'dm') Modes.begin(G); if (o.op && Ops.by(o.op) && !G.net) Ops.start(G, Ops.by(o.op));
    $('hud').dataset.mode = 'holdout'; Game.hud(true); Game.hint();
    Music.set('fight'); sv.stats.games++; Save.store();
    // the first runs explain the keys, one line at a time
    G.tips = (sv.stats.games <= 2 && !G.net) ? [[1, 'W A S D to move    MOUSE to look    CLICK to fire'], [7, 'SPACE jumps: onto crates, over barriers    SHIFT sprints'], [13, 'E aims down the sight    R reloads'], [19, 'C crouches (steadier aim); in a sprint it slides'], [25, '1 2 3 switch weapons    G throws    V strikes    X is your class ability']] : []; G.tip = ''; G.tipT = 0;
};
// the numbers that perks, the class and the running ability change
Game.stats = function () {
    const G = Game, P = G.P, k = G.perks, ab = G.abilOn > 0;
    P.max = 100 + 25 * k.vital; P.speedK = (1 + 0.07 * k.agile) * (ab && G.cls === 'assault' ? 1.3 : 1); P.dmgK = (1 + 0.1 * k.fire) * (ab && G.cls === 'assault' ? 1.25 : 1) * (ab && G.cls === 'recon' ? 1.4 : 1);
    P.fastHands = (1 - 0.1 * k.hands) * (G.cls === 'assault' ? (ab ? 0.5 : 0.9) : 1); P.headK = (1 + 0.15 * k.eye) * (G.cls === 'recon' ? 1.2 : 1); P.regen = G.cls === 'medic' ? 2 : 1; P.guard = ab && G.cls === 'heavy' ? 0.33 : 1; P.cashK = 1 + 0.25 * k.scav; Extras.stats(G, P);
};
Game.stop = function () { Marks.clear(); Game.turrets = []; Extras.draw(Game); Snd.wind(false); HUD.reset(); delete $('hud').dataset.mode; if (Gun.cur) Gun.cur.node.visible = false; Music.set('menu'); };
Game.hint = function () { const G = Game; if (App.game !== G) return; HUD.set('msg', G.demo ? 'SPEED TEST' : G.over ? '' : (!App.locked && !App.demo && !App.paused && !G.shopOpen ? 'CLICK TO FIGHT' : '')); };
Game.statLine = () => Foes.list.length + ' ashen';
Game.hud = function (all) {
    const G = Game, P = G.P, S = Gun.S, W = Gun.W; if (all) HUD.last = {};
    HUD.set('hp', Math.max(0, P.hp / P.max * 100).toFixed(0) + '%', 'w'); HUD.set('hp-n', Math.max(0, Math.ceil(P.hp))); HUD.set('hp-n', P.hp < P.max * 0.3 ? 'low' : '', 'c'); HUD.set('hud-bl', (P.hp < P.max * 0.3 ? 'low' : '') + (G.time - P.lastHurt < 0.14 ? ' hit' : ''), 'c'); HUD.set('ar', Math.min(100, P.armor / 1.5).toFixed(0) + '%', 'w');
    if (W) { HUD.set('wname', W.name + (W.lvl ? '  ' + UP_NAMES[W.lvl] : '')); HUD.set('ammo', W.melee ? '' : P.reload > 0 ? '--' : S.ammo); HUD.set('ammo', !W.melee && S.ammo <= W.mag * 0.25 ? 'low' : '', 'c'); HUD.set('reserve', W.melee ? '' : ' / ' + S.reserve); }
    HUD.set('nades', (Gun.W && Gun.W.lunge ? (P.lungeCd > 0 ? 'THRUST [HOLD E]  LUNGE ' + Math.ceil(P.lungeCd) + 's   ' : 'LUNGE READY [E]   ') : '') + (G.strike ? 'MORTARS [C]   ' : '') + (G.nades ? THROWS[G.throwKind || 'frag'].short + ' ' + G.nades + '   ' : '') + CLASSES[G.cls].ability + (G.abilOn > 0 ? ' ACTIVE' : G.abilT > 0 ? ' ' + Math.ceil(G.abilT) + 's' : ' READY [X]'));
    HUD.set('cash', '$' + G.cash); const left = G.toSpawn.length + Foes.alive(), B = G.bossAlive && G.bossAlive.state !== 'die' ? G.bossAlive : null;
    if (HUD.set('boss', B ? '' : 'hidden', 'c') && B) $('boss').firstElementChild.textContent = B.T.name; if (B) { HUD.set('boss-bar', Math.max(0, B.hp / B.max * 100).toFixed(1) + '%', 'w'); HUD.set('boss-sub', Kinds.bossLine(B)); }
    if (G.mode === 'dm') { const t = Math.max(0, G.matchT), L = G.lead; HUD.set('hud-top', Modes.line(G) || (G.teams ? (P.team ? 'RED ' : 'BLUE ') + G.teamK[P.team] + '     ' + (P.team ? 'BLUE ' : 'RED ') + G.teamK[1 - P.team] + '     FIRST TO ' + G.goal * 2 : 'KILLS ' + G.kills + ' / ' + G.goal + (L ? '     LEADER ' + L.name.toUpperCase() + ' ' + L.kills : '')) + '     ' + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0')); HUD.set('cash', ''); HUD.set('prompt', P.dead && !G.over ? (P.respawnT > 99 ? 'OUT UNTIL THE ROUND ENDS' : 'BACK IN ' + Math.ceil(Math.max(0, P.respawnT))) : P.safe > 0 ? 'SHIELDED' : 'TAB: SCORES'); return; }
    HUD.set('obj', G.op && !G.over ? '' : 'hidden', 'c'); { if (G.op) { const O = G.op; HUD.set('obj-n', O.def.name + '   ' + Math.min(O.i + 1, O.def.stages.length) + ' / ' + O.def.stages.length); HUD.set('obj-t', Ops.line(G)); HUD.set('obj-b', (Ops.frac(G) * 100).toFixed(1) + '%', 'w'); } }
    HUD.set('hud-top', 'WAVE ' + G.wave + (G.phase === 'fight' ? '     ' + left + ' LEFT' : '') + (G.combo > 1 ? '     x' + (1 + Math.min(10, G.combo) * 0.1).toFixed(1) : ''));
    HUD.set('prompt', G.over ? '' : P.jam > 0 ? 'GUN JAMMED' : P.chill > 0 ? 'CHILLED: YOU ARE SLOW' : G.tip ? G.tip : G.rule === 'rush' && G.wave > 0 ? 'ARMORY [B]' : '');
    { const bw = G.phase === 'break' && G.wave > 0 && !G.over && !G.tip && !G.shopOpen && G.rule !== 'rush' && !P.dead; HUD.set('between', bw ? '' : 'hidden', 'c'); if (bw) { HUD.set('bw-t', 'starts in ' + Math.ceil(G.phaseT) + ' s'); HUD.set('bw-bar', (clamp(G.phaseT / 22, 0, 1) * 100).toFixed(0) + '%', 'w'); } }
};

// ---- waves
// how heavily each kind is drawn for wave w, and which two lead it (G.pack)
Game.packOf = function (pool, w, boss) {
    const G = Game, wt = {}, feat = []; for (const id of pool) wt[id] = FOES[id].w;
    if (w >= 3) { const c = pool.filter(id => id !== 'walker'); for (let k = 0; k < Math.min(boss ? 1 : 2, c.length); k++) { const left = c.filter(id => feat.indexOf(id) < 0), fresh = left.filter(id => FOES[id].from === w), from = fresh.length ? fresh : left; feat.push(from[(Math.random() * from.length) | 0]); } for (const id of feat) wt[id] *= 3.5; }
    G.pack = feat; return wt;
};
Game.nextWave = function () {
    const G = Game, w = ++G.wave, D = G.D, BS = BOSS_ORDER.filter(id => Foes.can(id)), boss = (w % 5 === 0 || G.rule === 'boss') && BS.length && !G.op ? BS[(G.rule === 'boss' ? w - 1 : Math.floor(w / 5) - 1) % BS.length] : '', list = [];
    const pool = FOE_IDS.filter(id => !FOES[id].boss && FOES[id].from <= w && Foes.can(id)), wt = pool.length ? Game.packOf(pool, w, !!boss) : {}, total = pool.reduce((s, id) => s + wt[id], 0), n = Math.min(70, Math.round((5 + w * 1.9 + Math.max(0, w - 6) * 0.8) * D.count * (boss ? 0.6 : 1)) * (1 + (G.crew - 1) * 0.6));
    for (const id of FOE_IDS) if (!FOES[id].boss && FOES[id].w > 0 && FOES[id].from <= w + 1) Foes.want(id);          // the next wave's new kinds are fetched now
    if (!pool.length) { G.wave--; G.phaseT = 0.5; return; }          // no figure has arrived yet (a slow line): the wave waits for them instead of stopping the game
    if ((w + 1) % 5 === 0 || G.rule === 'boss') { const nb = BS[(G.rule === 'boss' ? w : Math.floor((w + 1) / 5) - 1) % BS.length]; if (nb) Foes.want(nb); }
    const cnt = {}; for (let i = 0; i < n; i++) { let r = Math.random() * total, id = pool[0]; for (const p of pool) { r -= wt[p]; if (r <= 0) { id = p; break; } } const m = FOES[id].max; if (m && (cnt[id] || 0) >= m + (w >> 3) + (G.pack.indexOf(id) >= 0 ? 4 : 0)) id = 'walker'; cnt[id] = (cnt[id] || 0) + 1; list.push(id); }
    if (boss) list.splice(Math.min(3, list.length), 0, boss);
    G.toSpawn = list; G.hpK = (1 + 0.06 * (w - 1)) * (1 + (G.crew - 1) * 0.25); G.spK = (0.8 + Math.min(0.2, 0.04 * (w - 1))) * (1 + Math.min(0.3, 0.02 * w)); G.dmgK = D.dmg * Math.min(1, 0.65 + 0.07 * (w - 1)); G.phase = 'fight'; G.spawnT = 0.5;          // the first waves: slower and softer, full by wave six
    HUD.banner(boss ? 'BOSS WAVE' : 'WAVE ' + w, boss ? 'something big is coming over the wall' : n + ' ashen inbound' + (G.pack.length ? ':   ' + G.pack.map(id => (FOES[id].name + (id === 'risen' ? '' : 's')).toUpperCase()).join(' AND ') : '')); Snd.boom(0.5); Snd.tone(boss ? 70 : 110, 0.4, 1.2, 'sawtooth', boss ? 50 : 82);
    if (G.net) Net.event('wave', { w, boss });
};
Game.spawnOne = function () {
    const G = Game, id = G.toSpawn.shift(), T = FOES[id], F = G.flows[(Math.random() * G.flows.length) | 0], p = World.farSpot(F, T.boss ? 30 : 24);
    const e = Foes.spawn(id, p[0], p[1], T.boss ? (G.rule === 'boss' ? 0.45 + G.wave * 0.12 : Math.max(1, G.wave / 5)) * (1 + (G.crew - 1) * 0.5) : G.hpK, G.spK);
    if (T.boss) { G.bossAlive = e; HUD.banner(T.name, 'bring it down'); Snd.boom(1); Game.shake(1, e.x, e.z); }
};
Game.waveDone = function () {
    const G = Game, rush = G.rule === 'rush', bonus = Math.round((60 + 20 * G.wave) * G.D.cash * (rush ? 1.5 : 1)); G.phase = 'break'; G.phaseT = rush ? 3 : 22; G.cash += bonus; G.earned += bonus;
    HUD.banner('WAVE ' + G.wave + ' CLEAR', '+$' + bonus + (rush ? '    no rest: the next one is coming' : '    the armory is open: B')); Snd.ui('buy'); G.slow = 0.7;
    if (G.P.dead) Game.revive(); else G.P.hp = Math.min(G.P.max, G.P.hp + 25);
    if (G.net) Net.event('clear', { w: G.wave, bonus });
    if (G.op) Ops.waveDone(G); Extras.waveDone(G);
};

// ---- what the gun and the ashen tell the game
// one bullet (or pellet): what it meets first, a wall or a figure; a piercing round goes on through figures
Game.shot = function (P, ux, uy, uz, W, i) {
    const G = Game, wall = World.ray(P.x, World.eye, P.z, ux, uy, uz, 120); let left = (W.pierce || 0) + (G.pierceK || 0), from = 0, end = wall, any = false; const done = [];
    if (G.mode === 'dm') { const h = Net.trace(P.x, World.eye, P.z, ux, uy, uz, wall); if (h.p) { any = true; end = h.t; let dmg = W.dmg * 0.62; if (W.falloff) dmg *= clamp(1 - (h.t - W.falloff[0]) / (W.falloff[1] - W.falloff[0]), 0.25, 1); if (h.head) dmg *= Math.min(2, W.head || 1.5); Net.hitPlayer(h.p, dmg, h.head, W.id); HUD.hit(false); Snd.tone(h.head ? 900 : 520, 0.09, 0.05, 'square'); } P.safe = 0; }
    else
    for (;;) {
        const h = Foes.trace(P.x, World.eye, P.z, ux, uy, uz, wall, done); if (!h.e || h.t < from) break; any = true; done.push(h.e);
        let dmg = W.dmg * P.dmgK * (G.cls === 'marksman' && h.t > 15 ? 1.2 : 1) * (P.ambush > 0 ? 2 : 1); if (W.falloff) dmg *= clamp(1 - (h.t - W.falloff[0]) / (W.falloff[1] - W.falloff[0]), 0.25, 1); if (h.head) dmg *= (W.head || 1.5) * P.headK;
        G.hitFoe(h.e, dmg, h.head, 0); if (left-- <= 0) { end = h.t; break; } from = h.t;
    }
    if (i === 0) { G.shotsFired++; if (any) G.shotsHit++; }
    const ex = P.x + ux * end, ey = World.eye + uy * end, ez = P.z + uz * end;
    if (end >= wall - 0.01 && wall < 120) { World.spark(ex, ey, ez, 0.4); if (i < 3) World.dust(ex, ey, ez, 2); }
    if (i < 4 && Gun.cur) { const m = Gun.muzzleWorld(Game.tmp); World.tracer(m[0], m[1], m[2], ex, ey, ez); }
};
Game.tmp = [0, 0, 0];
Game.num = function (e, dmg, head, dead) {
    const L = Game.nums; if (!L || dmg < 0.5 || Save.data.settings.nums === false) return; const last = L[L.length - 1];
    if (last && last.e === e && last.t < 0.14) { last.n += dmg; last.head = last.head || head; last.dead = last.dead || dead; last.t = Math.min(last.t, 0.04); return; }
    if (L.length > 20) L.shift(); L.push({ e, x: e.x + rand(-0.25, 0.25), y: (head ? 2.38 : 2.26) * e.size, z: e.z + rand(-0.25, 0.25), n: dmg, head, dead, t: 0 });
};
// damage to an ashen from the local player: alone or as host it lands now; a guest tells the host
// the katana. A lunge cuts each thing it passes once. A thrust goes through everything in a straight line in front, and does
// more the faster you are moving (any direction, falling too): its own damage standing still, up to three and a half times it.
Game.lungeHit = function (P, W) {
    const G = Game, L = W.lunge, seen = P.lungeSeen || (P.lungeSeen = {}); let n = 0;
    for (const e of Foes.list) { if (e.state === 'die' || e.born > 0.4 || seen[e.id]) continue; if (Math.hypot(e.x - P.x, e.z - P.z) < 1.5 + 0.35 * e.size) { seen[e.id] = 1; G.hitFoe(e, L.dmg * P.dmgK, false, 0); n++; } }
    if (G.mode === 'dm') for (let k = 1; k < G.players.length; k++) { const p = G.players[k]; if (p.dead || p.gone || seen['p' + k] || (G.teams && p.team === P.team)) continue; if (Math.hypot(p.x - P.x, p.z - P.z) < 1.6) { seen['p' + k] = 1; Net.hitPlayer(p, L.dmg, false, W.id); n++; } }
    if (n) { Snd.noise(0.3, 900, 200, 0.12); G.shake(0.3); }
};
Game.stabHit = function (P, W) {
    const G = Game, d = G.dir, L = W.lunge, hl = Math.hypot(d[0], d[2]) || 1, fx = d[0] / hl, fz = d[2] / hl, sp = Math.hypot(P.vx || 0, P.vy || 0, P.vz || 0), k = Math.min(3.5, 1 + sp / 5), dmg = L.stab * k; let n = 0;
    const inLine = (x, z, size) => { const dx = x - P.x, dz = z - P.z, along = dx * fx + dz * fz; return along > -0.2 && along < L.reach + 0.3 * size && Math.abs(dx * fz - dz * fx) < 0.6 + 0.3 * size; };
    for (const e of Foes.list) { if (e.state === 'die' || e.born > 0.4) continue; if (inLine(e.x, e.z, e.size)) { G.hitFoe(e, dmg * P.dmgK, false, 0); n++; } }
    if (G.mode === 'dm') for (let i = 1; i < G.players.length; i++) { const p = G.players[i]; if (p.dead || p.gone || (G.teams && p.team === P.team)) continue; if (inLine(p.x, p.z, 1)) { Net.hitPlayer(p, dmg, false, W.id); n++; } }
    if (n) { Snd.noise(0.3, 1400, 300, 0.14); G.shake(0.2 + 0.1 * k); if (k > 2) HUD.callout('RUNNING THRUST  x' + k.toFixed(1)); } G.lastStab = { dmg, k, n };
};
Game.hitFoe = function (e, dmg, head, splash) {
    const G = Game; if (G.net && !G.net.host) { e.flash = 1; World.blood(e.x, (head ? 1.65 : 1.1) * e.size, e.z, head ? 6 : 3); Net.hitFoe(e.id, dmg, head); HUD.hit(false); Game.num(e, dmg, head, false); return; }
    const hp0 = e.hp, dead = Foes.damage(e, dmg, head, G, 0, splash); HUD.hit(dead); if (!dead) Snd.tone(head ? 900 : 520, 0.09, 0.05, 'square'); Game.num(e, Math.max(0, hp0 - Math.max(0, e.hp)), head, dead);
};
Game.meleeHit = function (P, dmg) {
    const G = Game, d = G.dir, W = Gun.W && Gun.W.melee ? Gun.W : {}, reach = W.reach || 2.3, arc = W.arc || 0.55, hl = Math.hypot(d[0], d[2]) || 1, near = [];
    for (const e of Foes.list) { if (e.state === 'die' || e.born > 0.4) continue; const dx = e.x - P.x, dz = e.z - P.z, dist = Math.hypot(dx, dz); if (dist < reach + 0.3 * e.size && (dx * d[0] + dz * d[2]) / ((dist || 1) * hl) > arc) near.push([dist, e]); }
    if (G.mode === 'dm') { let bp = null, bd = reach + 0.4; for (let k = 1; k < G.players.length; k++) { const p = G.players[k]; if (p.dead || p.gone || (G.teams && p.team === P.team)) continue; const dx = p.x - P.x, dz = p.z - P.z, dist = Math.hypot(dx, dz); if (dist < bd && (dx * d[0] + dz * d[2]) / ((dist || 1) * hl) > arc) { bd = dist; bp = p; } } if (bp) { Net.hitPlayer(bp, dmg, false, Gun.W ? Gun.W.id : ''); HUD.hit(false); Snd.noise(0.3, 900, 200, 0.12); } return; }
    near.sort((a, b) => a[0] - b[0]); for (const n of near.slice(0, W.cleave || 1)) G.hitFoe(n[1], dmg * P.dmgK, false, 0);
    if (near.length) { Snd.noise(0.3, 900, 200, 0.12); G.shake(0.25); }
};
// a launched grenade: flies on an arc and goes off on whatever it meets first
Game.lob = function (P, dx, dy, dz, W) { const m = Gun.muzzleWorld([0, 0, 0]); Game.thrown.push({ kind: 'gl', x: m[0], y: m[1], z: m[2], vx: dx * 27, vy: dy * 27 + 2.2, vz: dz * 27, t: 0, dmg: W.dmg * P.dmgK, r: W.blast }); };
// one beat of the flamethrower: fire down a short cone, and everything standing in it burns
Game.flame = function (P, dx, dy, dz, W) {
    const G = Game, m = Gun.muzzleWorld(Game.tmp), R = Math.min(W.flame.range, World.ray(P.x, World.eye, P.z, dx, dy, dz, W.flame.range) + 0.6), hl = Math.hypot(dx, dz) || 1, v = W.flame.range / 0.5;
    if (World.flames) for (let i = 0; i < 3; i++) World.flames.add(m[0] + dx * 0.25, m[1] + dy * 0.25, m[2] + dz * 0.25, dx * v * rand(0.7, 1.05) + rand(-1.2, 1.2), dy * v + rand(-0.8, 1.4), dz * v * rand(0.7, 1.05) + rand(-1.2, 1.2), 0.16, 3.4, rand(0.32, 0.5), 1.7, 0.75, 0.25, 0.9, 0);
    for (const e of Foes.list) { if (e.state === 'die' || e.born > 0.4) continue; const ex = e.x - P.x, ez = e.z - P.z, dist = Math.hypot(ex, ez); if (dist > R + 0.4 * e.size) continue; if (dist > 1.3 && (ex * dx + ez * dz) / (dist * hl) < 1 - W.flame.cone) continue; Armory.hurt(G, e, W.dmg * P.dmgK); e.flash = Math.max(e.flash, 0.5); if (!e.T.heavy) e.slow = Math.max(e.slow, 0.3); }
    if (G.mode === 'dm') for (const p of G.players) { if (p === P || p.dead || p.gone || (G.teams && p.team === P.team)) continue; const ex = p.x - P.x, ez = p.z - P.z, dist = Math.hypot(ex, ez); if (dist < R && (dist < 1.3 || (ex * dx + ez * dz) / (dist * hl) > 1 - W.flame.cone)) Net.hitPlayer(p, W.dmg * 0.62, false, W.id); }
};
Game.rocket = function (P, dx, dy, dz, W) { const m = Gun.muzzleWorld([0, 0, 0]); Game.rockets.push({ x: m[0], y: m[1], z: m[2], vx: dx * 46, vy: dy * 46, vz: dz * 46, t: 0, dmg: W.dmg * P.dmgK, r: W.blast, by: 0 }); Snd.noise(0.5, 1500, 300, 0.7); };
Game.explode = function (x, y, z, r, dmg, mine) {
    const G = Game; if (mine) { r *= G.blastK || 1; dmg *= G.blastDmg || 1; } World.boom(x, y, z, true); Snd.boom(0.8); G.shake(0.9, x, z);
    for (const e of Foes.list.slice()) { if (e.state === 'die') continue; const d = Math.hypot(e.x - x, e.z - z); if (d < r + 0.4 * e.size) { const k = clamp(1.15 - d / r, 0.2, 1); if (mine) G.hitFoe(e, dmg * k, false, 1); } }
    if (G.mode === 'dm' && mine) for (let k = 1; k < G.players.length; k++) { const p = G.players[k]; if (p.dead || p.gone || (G.teams && p.team === G.P.team)) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < r) Net.hitPlayer(p, dmg * 0.35 * clamp(1.15 - d / r, 0.2, 1), false, ''); }
    const P = G.P, pd = Math.hypot(P.x - x, P.z - z); if (mine && pd < r * 0.6 && !P.dead) G.hurt(0, 25 * (1 - pd / (r * 0.6)), x, z, null);       // your own blast, up close
};
// an ashen (or its spit, or a blast) hurts player k
Game.hurt = function (k, dmg, fx, fz, e) {
    const G = Game, P = G.players[k]; if (!P || P.dead) return;
    if (k !== 0) { if (P.obj) Ops.hitObj(G, P, dmg); else if (G.net && G.net.host) Net.hurt(k, dmg, fx, fz); return; }
    if (P.dashSafe > 0) return;
    dmg *= P.guard || 1; if (P.armor > 0) { const a = Math.min(P.armor, dmg * 0.6); P.armor -= a; dmg -= a; }
    P.hp -= dmg; P.hurt = 1; P.lastHurt = G.time; G.streak = 0; Snd.noise(0.35, 700, 120, 0.2); Snd.tone(90, 0.3, 0.2, 'sine', 50); HUD.from(fx - P.x, fz - P.z, P.yaw + Math.PI); G.shake(0.35);
    if (P.hp <= 0) { if (G.stand) { G.stand = false; P.hp = 1; P.dashSafe = 3; HUD.callout('LAST STAND'); Snd.tone(300, 0.2, 0.5, 'triangle', 900); } else if (G.wind) { G.wind = false; P.hp = 40; HUD.callout('SECOND WIND'); Snd.tone(300, 0.2, 0.5, 'triangle', 900); } else { P.hp = 0; P.dead = true; Game.down(); } }
};
Game.blastPlayers = function (x, z, r, dmg) { const G = Game; for (let k = 0; k < G.players.length; k++) { const p = G.players[k]; if (p.dead || p.gone) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < r) G.hurt(k, dmg * clamp(1.2 - d / r, 0.25, 1), x, z, null); } };
Game.shake = function (k, x, z) { const G = Game; if (!Save.data.settings.shake) return; let f = 1; if (x !== undefined) f = clamp(1 - Math.hypot(x - G.P.x, z - G.P.z) / 30, 0, 1); G.shakeK = Math.max(G.shakeK, k * f); };
Game.bossRage = function (e) { HUD.banner(e.T.name, 'it is furious'); Snd.boom(0.8); };
Game.gone = function (e) { };
// an ashen died. by = which player (0 = here); the host tells guests so each pays its own killer
Game.killed = function (e, head, by) {
    const G = Game, T = e.T; if (G.op) Ops.killed(G, e); if (G.net && G.net.host) Net.event('k', { id: e.id, by, h: head ? 1 : 0 });
    if (T.boss) { G.bossAlive = null; World.boom(e.x, 1.5, e.z, true); Snd.boom(1); G.shake(1, e.x, e.z); HUD.banner(T.name + ' DOWN', 'well fought'); G.pickups.push({ kind: 'hp', x: e.x, z: e.z, t: 0 }, { kind: 'ammo', x: e.x + 0.6, z: e.z, t: 0 }); }
    else if (Math.random() < 0.09 * (1 + G.perks.scav * 0.4) * (G.dropK || 1)) G.pickups.push({ kind: Math.random() < 0.45 ? 'hp' : 'ammo', x: e.x, z: e.z, t: 0 });
    if (by === 0) { const sn = Save.data.seen; sn[e.type] = (sn[e.type] || 0) + 1; G.reward(T, head); }
    Snd.tone(110, 0.2, 0.3, 'sawtooth', 60);
};
Game.reward = function (T, head) {
    const G = Game, P = G.P; if (G.cls === 'assault' && G.cp[0] && Gun.S && Gun.W && !Gun.W.melee) Gun.S.ammo = Math.min(Gun.W.mag, Gun.S.ammo + 3);
    G.kills++; if (head) G.heads++; G.streak++; G.combo = G.comboT > 0 ? G.combo + 1 : 1; G.comboT = 3.5;
    if (G.combo >= 2) { HUD.callout(['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL'][G.combo] || 'RAMPAGE  x' + G.combo); Snd.tone(480 + Math.min(8, G.combo) * 110, 0.12, 0.22, 'triangle', 900 + Math.min(8, G.combo) * 150); }
    const cash = Math.round(T.cash * (1 + Math.min(10, G.combo - 1) * 0.1) * G.D.cash * P.cashK * (head ? 1.25 : 1) * (G.rule === 'rush' ? 1.5 : 1)); G.cash += cash; G.earned += cash; G.xpRun = (G.xpRun || 0) + (T.xp || 10) + (head ? 5 : 0);
    HUD.feed((head ? '<b>HEADSHOT</b> ' : '') + esc(T.name) + ' <b>+$' + cash + '</b>'); if (head) Snd.tone(1500, 0.12, 0.18, 'triangle', 2200);
    G.multiN = G.multiT > 0 ? G.multiN + 1 : 1; G.multiT = 1.3;
    if (G.multiN >= 2) { HUD.callout(['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL', 'RAMPAGE'][Math.min(5, G.multiN)]); Snd.tone(600 + G.multiN * 120, 0.12, 0.2, 'square', 900 + G.multiN * 150); }
    else if (G.streak % 10 === 0) HUD.callout(G.streak + ' KILL STREAK');
    if (G.streak >= G.strikeAt && !G.strike && G.mode !== 'dm') { G.strike = true; G.strikeAt = G.streak + 12; HUD.banner('MORTAR STRIKE READY', 'press C to call it where you are looking'); Snd.tone(520, 0.2, 0.5, 'triangle', 1040); }
    Save.data.stats.kills++; if (head) Save.data.stats.heads++; if (Gun.W) Armory.kill(Gun.W.id, head, T); Armory.note('cash', cash);
};
// the local player is down: alone, that is the end of the run
Game.down = function () {
    const G = Game, P = G.P; Snd.boom(0.6); Input.aimOn = false;
    if (G.mode === 'dm') { P.respawnT = Net.cfg.mode === 'lts' ? 1e9 : 3; G.deaths++; G.streak = 0; if (Net.host) Net.scoreKill(P.lastBy || '', 'H', P.lastHead, P.lastW); else Net.event('dead', { by: P.lastBy || '', head: P.lastHead ? 1 : 0, w: P.lastW || '' }); P.lastBy = ''; return; }
    if (G.net) { Net.event('dead', {}); HUD.set('msg', 'YOU ARE DOWN'); if (G.players.some(p => !p.dead && !p.gone)) return; }
    Game.finish();
};
Game.finish = function () {
    const G = Game, sv = Save.data; if (G.over) return; G.over = true; G.overT = 2.2; if (G.net && G.net.host) Net.event('over', { w: G.wave });
    const key = World.id + '_' + G.diff + (G.rule !== 'classic' ? '_' + G.rule : ''), was = sv.stats.best[key] || 0, xp = G.rule === 'sandbox' ? 0 : Math.round(((G.xpRun || 0) + G.wave * 40 + (G.wave > 1 ? (G.wave - 1) * 10 : 0)) * G.D.xp), before = Save.rank();
    G.result = { wave: G.wave, kills: G.kills, heads: G.heads, acc: G.shotsFired ? Math.round(G.shotsHit / G.shotsFired * 100) : 0, cash: G.earned, xp, best: Math.max(was, G.wave), record: G.wave > was && G.wave > 1, before, time: G.time };
    if (G.op) { G.result.title = 'OPERATION FAILED'; G.result.big = G.op.def.name; G.result.record = false; G.result.op = G.op.def.id; G.result.lost = true; }
    sv.xp += xp; if (!G.op && G.rule !== 'sandbox') sv.stats.best[key] = Math.max(was, G.wave); sv.stats.time += G.time; G.result.credits = Armory.earn(G.rule === 'sandbox' ? 0 : Math.round(G.earned / 25) + G.wave * 5); Armory.note('wave', G.wave, true); Extras.drop(); if (xp && Extras.clsPay(G.cls, xp)) G.result.clsUp = Extras.clsLevel(G.cls); Save.store(); G.result.after = Save.rank();
    Music.set('menu');
};

Game.revive = function () { const G = Game, P = G.P; P.dead = false; P.hp = Math.round(P.max * 0.5); P.hurt = 0; HUD.set('msg', ''); HUD.feed('<b>BACK ON YOUR FEET</b>'); Snd.ui('buy'); };
// a place to come back at: the ring spot farthest from everyone else who is alive
Game.spawnSpot = function () { const G = Game, sp = World.spots.length ? World.spots : [World.home]; let best = sp[0], bd = -1; for (const s of sp) { let d = 1e9; for (const p of G.players) if (!p.dead && !p.gone) d = Math.min(d, Math.hypot(p.x - s[0], p.z - s[1])); d += Math.random() * 3; if (d > bd) { bd = d; best = s; } } return best; };
Game.respawn = function () { const G = Game, P = G.P, s = Game.spawnSpot(); P.x = s[0]; P.z = s[1]; P.yaw = Math.atan2(P.x - World.mid[0], P.z - World.mid[1]); P.pitch = 0; P.y = 0; P.vy = 0; P.vx = 0; P.vz = 0; P.slide = 0; P.crouch = 0; P.dead = false; P.hp = P.max; P.armor = 0; P.hurt = 0; P.safe = 2; for (const id in Gun.state) { const w = Gun.stats(id); Gun.state[id].ammo = w.mag; Gun.state[id].reserve = w.reserve; } G.nades = 1; Gun.equip(Gun.slots[G.slot] || Gun.slots[0], P); Snd.ui('buy'); };
// we killed another player
Game.pvpKill = function (v, head) { const G = Game; G.kills++; if (head) G.heads++; G.streak++; G.xpRun += 15 + (head ? 5 : 0); HUD.hit(true); if (head) Snd.tone(1500, 0.12, 0.18, 'triangle', 2200); G.multiN = G.multiT > 0 ? G.multiN + 1 : 1; G.multiT = 4; HUD.callout(G.multiN >= 2 ? ['', '', 'DOUBLE KILL', 'TRIPLE KILL', 'QUAD KILL', 'RAMPAGE'][Math.min(5, G.multiN)] : G.streak >= 3 ? G.streak + ' IN A ROW' : head ? 'HEADSHOT' : 'ELIMINATED'); Snd.tone(600 + G.multiN * 120, 0.12, 0.2, 'square', 900 + G.multiN * 150); Save.data.stats.kills++; if (Gun.W) Armory.kill(Gun.W.id, head, null); };
Game.finishMatch = function (winId) {
    const G = Game, sv = Save.data; if (G.over) return; G.over = true; G.overT = 1.6; const won = G.teams ? winId === 't' + G.P.team : winId === Net.me.id, rows = Net.roster.slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths), place = rows.findIndex(r => r.id === Net.me.id) + 1, w = Net.roster.find(r => r.id === winId);
    const xp = Math.round(G.xpRun + (won ? 150 : 40)), before = Save.rank(); sv.xp += xp; if (won) sv.stats.mpWins++; sv.stats.time += G.time; const cr = Armory.earn(30 + G.kills * 4 + (won ? 60 : 0)); Armory.note('mp', 1); Save.store();
    G.result = { title: G.teams ? Modes.side(winId === 't1' ? 1 : 0) + (Net.cfg.mode === 'inf' ? ' TAKE IT' : ' TAKES IT') : won ? MP_MODES[Net.cfg.mode].name : (w ? w.name.toUpperCase() + ' TAKES IT' : 'TIME'), big: won ? 'VICTORY' : G.teams ? 'DEFEAT' : '#' + place, wave: 0, kills: G.kills, heads: G.heads, acc: G.shotsFired ? Math.round(G.shotsHit / G.shotsFired * 100) : 0, cash: G.deaths, cashLabel: 'deaths', xp, record: false, before, after: Save.rank(), time: G.time };
    G.result.credits = cr; Music.set('menu'); Snd.boom(0.7);
};
// ---- the frame
Game.update = function (dt0) {
    const G = Game, P = G.P; let dt = dt0; G.frame++;
    if (G.slow > 0) { G.slow -= dt0; dt *= 0.35; }          // the last kill of a wave lands in slow motion
    G.time += dt;
    if (G.over) { G.overT -= dt0; if (G.overT <= 0 && !G.shown) { G.shown = true; UI.results(G.result); } dt *= 0.3; }
    // ---- the player
    let mx = 0, mz = 0, fire = false, run = false;
    if (G.demo) {              // the speed test: nobody at the keys. Keep the yard full, turn on the nearest, shoot, drift sideways.
        P.hp = P.max; G.phase = 'fight'; G.wave = Math.max(G.wave, 6); G.hpK = 1; G.spK = 1; const kinds = FOE_IDS.filter(id => !FOES[id].boss && Foes.can(id)); if (Foes.alive() + G.toSpawn.length < 24 && kinds.length) G.toSpawn.push(kinds[(Math.random() * kinds.length) | 0]);
        let bd = 1e9, b = null; for (const e of Foes.list) { if (e.state === 'die' || e.born > 0) continue; const d = Math.hypot(e.x - P.x, e.z - P.z); if (d < bd) { bd = d; b = e; } }
        if (b) { let dy = Math.atan2(-(b.x - P.x), -(b.z - P.z)) - P.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; P.yaw += dy * Math.min(1, dt * 5); P.pitch = lerp(P.pitch, Math.atan2(1.2 * b.size - World.eye, Math.max(1, bd)), Math.min(1, dt * 5)); fire = Math.abs(dy) < 0.1 && bd < 30; }
        const sn = Math.sin(P.yaw), cs = Math.cos(P.yaw), sp = 2.2 * dt * (Math.sin(G.time * 0.4) > 0 ? 1 : -1); mx = cs * sp; mz = -sn * sp; if (!World.blocked(P.x + mx, P.z, 0.34)) P.x += mx; if (!World.blocked(P.x, P.z + mz, 0.34)) P.z += mz; P.bob += Math.abs(sp); if (Gun.S && Gun.S.reserve < 60) Gun.S.reserve = 180;
    } else
    if (!P.dead && !G.shopOpen) {
        const st = Save.data.settings, sens = 0.0023 * st.sens * lerp(1, (Gun.W ? Gun.W.adsFov : 60) / st.fov * st.adsSens, P.ads); P.yaw -= mouse.dx * sens; P.pitch = clamp(P.pitch - mouse.dy * sens, -1.45, 1.45);
        P.swayX = lerp(P.swayX, clamp(mouse.dx * 0.0006, -0.03, 0.03), Math.min(1, dt * 10)); P.swayY = lerp(P.swayY, clamp(mouse.dy * 0.0006, -0.03, 0.03), Math.min(1, dt * 10));
        const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
        run = !!(keys.ShiftLeft || keys.ShiftRight) && f > 0 && !(mouse.down || keys.KeyF || mouse.fired || hit.KeyF); if (P.running && !run) P.cool = Math.max(P.cool, 0.1);
        const duck = !!keys.KeyC && !P.air; if (P.slideCd > 0) P.slideCd -= dt;
        if (hit.KeyC && run && !P.air && !(P.slide > 0) && !(P.slideCd > 0)) { P.slide = 0.75; P.slideCd = 1.2; P.slideX = -Math.sin(P.yaw); P.slideZ = -Math.cos(P.yaw); Snd.noise(0.12, 900, 200, 0.45, 150); }
        if (duck || P.slide > 0) run = false;
        if (f || s) { const l = Math.hypot(f, s), sp = (run ? 5.6 * (P.runK || 1) : 3.7) * (Gun.W ? Gun.W.move : 1) * P.speedK * (P.chill > 0 ? 0.6 : 1) * lerp(1, 0.6, P.ads) * dt / l, sn = Math.sin(P.yaw), cs = Math.cos(P.yaw); mx = (-sn * f + cs * s) * sp; mz = (-cs * f - sn * s) * sp; }
        if (duck && !(P.slide > 0)) { mx *= 0.55; mz *= 0.55; }
        { const k = 1 - Math.exp(-dt * (P.air ? 3.2 : f || s ? 18 : 24)); P.vx = (P.vx || 0) + (mx / dt - (P.vx || 0)) * k; P.vz = (P.vz || 0) + (mz / dt - (P.vz || 0)) * k; mx = Math.abs(P.vx) > 0.02 ? P.vx * dt : 0; mz = Math.abs(P.vz) > 0.02 ? P.vz * dt : 0; }
        if (P.slide > 0) { P.slide -= dt; const v = 8.4 * (0.35 + 0.65 * Math.max(0, P.slide) / 0.75) * P.speedK; P.vx = P.slideX * v; P.vz = P.slideZ * v; mx = P.vx * dt; mz = P.vz * dt; }          /* a slide: fast at first, in the direction it began, the gun still up */
        if (P.chill > 0) P.chill -= dt; if (P.pull) { const st = Math.min(P.pull.d, 22 * dt); mx += P.pull.x * st; mz += P.pull.z * st; P.pull.d -= st; if (P.pull.d <= 0.01) P.pull = null; }          // a chiller's cold; a lasher's drag
        if (P.dash > 0) { P.dash -= dt; const sn = Math.sin(P.yaw), cs = Math.cos(P.yaw), l = Math.hypot(f, s) || 1, df = f || s ? f / l : 1, ds = f || s ? s / l : 0, sp = 17 * dt; mx = (-sn * df + cs * ds) * sp; mz = (-cs * df - sn * ds) * sp; }
        if (P.lunge > 0 && Gun.W && Gun.W.lunge) { const v = Gun.W.lunge.speed; P.vx = P.lungeX * v; P.vz = P.lungeZ * v; mx = P.vx * dt; mz = P.vz * dt; }          /* the katana's lunge */
        if (World.blockedAt(P.x, P.z, 0.34, P.y)) { const f = World.free(P.x, P.z, 0.5); P.x = f[0]; P.z = f[1]; P.y = 0; P.vy = 0; }      /* never left standing inside something */
        /* in the air and stopped by the edge of something low you have nearly cleared: a pull up onto it */
        const up = (nx, nz) => { if (!P.air) return false; const h = World.ledge(nx, nz, 0.34, P.y); if (!(h > P.y) || h - P.y > 0.95) return false; P.vy = Math.max(P.vy, Math.sqrt(64 * (h - P.y + 0.14))); return true; };
        if (mx) { if (!World.blockedAt(P.x + mx, P.z, 0.34, P.y)) P.x += mx; else if (!up(P.x + mx, P.z)) { P.vx = 0; if (P.slide > 0) P.slide = 0; } } if (mz) { if (!World.blockedAt(P.x, P.z + mz, 0.34, P.y)) P.z += mz; else if (!up(P.x, P.z + mz)) { P.vz = 0; if (P.slide > 0) P.slide = 0; } }
        P.crouch = lerp(P.crouch || 0, duck || P.slide > 0 ? 1 : 0, Math.min(1, dt * 12));
        if (hit.Space) P.jumpT = 0.14;
        if ((mx || mz) && !P.air) { const was = Math.floor(P.bob / 0.92); P.bob += Math.hypot(mx, mz); if (Math.floor(P.bob / 0.92) !== was) { Snd.noise(run ? 0.09 : 0.06, 420, 110, 0.07); } } if (run && Input.aimOn) Input.aimOn = false;
        fire = (mouse.down || !!keys.KeyF) && App.locked;          // F fires too: a trackpad is hard to press and slide at once
        // weapons: 1, 2, 3, Q = the one before, the wheel = the next
        let want = -1; if (hit.Digit1) want = 0; else if (hit.Digit2) want = 1; else if (hit.Digit3) want = 2; else if (hit.KeyQ) want = G.lastSlot; else if (mouse.wheel) { for (let k = 1; k <= 3; k++) { const j = (G.slot + (mouse.wheel > 0 ? k : 3 - k)) % 3; if (Gun.slots[j]) { want = j; break; } } }
        if (want >= 0 && P.swap > 0) { P.swapNext = want; want = -1; } else if (want < 0 && P.swap <= 0 && P.swapNext >= 0) { want = P.swapNext; P.swapNext = -1; }
        if (want >= 0 && want !== G.slot && Gun.slots[want] && P.swap <= 0) { P.swap = SWAP; P.swapTo = want; P.reload = 0; P.burstQ = 0; Input.aimOn = false; if (P.vm && P.vm.cur !== 'vm_idle' && P.vm.cur !== 'vm_run') Gun.play(P.vm, 'vm_idle', 0.08); }          /* a reload or a shot cut short does not stay frozen in the hands */
        if (hit.KeyG && (G.nades > 0 || G.thrown.some(g => g.kind === 'c4'))) Armory.use(G, P);
        if (hit.KeyX && G.abilT <= 0 && G.abilOn <= 0) Game.ability();
        // the mortar strike: six shells walk in on the spot under the cross
        if (hit.KeyT && G.strike) { G.strike = false; const d = G.dir, t = Math.min(60, World.ray(P.x, World.eye, P.z, d[0], d[1], d[2], 60)), tx = P.x + d[0] * t, tz = P.z + d[2] * t; for (let i = 0; i < 6; i++) G.falling.push({ x: tx + rand(-5, 5), z: tz + rand(-5, 5), t: 1.1 + i * 0.38 }); HUD.callout('MORTARS INBOUND'); Snd.tone(1800, 0.25, 1.3, 'sine', 300); }
        if (hit.KeyB && (G.phase === 'break' || G.rule === 'rush') && (G.wave > 0 || (G.op && G.op.def.train)) && !G.over) UI.shop(true);
        if (hit.Enter && G.phase === 'break' && G.wave > 0) G.phaseT = Math.min(G.phaseT, 0.01);
    }
    // up and down: a jump is about two metres and quick, enough to get on top of a crate or over a barrier; a low roof stops it short
    { const gnd = World.under(P.x, P.z, 0.34, P.y); if (P.jumpT > 0) { P.jumpT -= dt; if (P.y <= gnd + 0.01 && !P.dead && !G.shopOpen) { P.vy = 11.6; P.jumpT = 0; Snd.noise(0.07, 520, 160, 0.06); } }
        if (P.vy !== 0 || P.y > gnd) { P.vy -= 32 * dt; P.y += P.vy * dt; if (P.y + 1.7 > World.roof) { P.y = Math.max(gnd, World.roof - 1.701); if (P.vy > 0) P.vy = 0; } if (P.y <= gnd) { if (P.vy < -4.5) { P.dip = Math.min(0.16, -P.vy * 0.014); Snd.noise(0.1, 300, 80, 0.09); } P.y = gnd; P.vy = 0; } } else P.y = gnd;
        P.air = P.y > gnd + 0.02; if (P.dip > 0) P.dip = Math.max(0, P.dip - dt * 0.55); World.eye = 1.65 + P.y - P.dip - (P.crouch || 0) * 0.6; }
    P.running = !!(run && (mx || mz)); P.moving = lerp(P.moving, mx || mz ? (run ? 1.6 : 1) : 0, Math.min(1, dt * 8));
    if (P.swap > 0) { const was = P.swap; P.swap -= dt; if (was > SWAP / 2 && P.swap <= SWAP / 2) { G.lastSlot = G.slot; G.slot = P.swapTo; Gun.equip(Gun.slots[G.slot], P); } }
    const cp = Math.cos(P.pitch); G.dir[0] = -Math.sin(P.yaw) * cp; G.dir[1] = Math.sin(P.pitch); G.dir[2] = -Math.cos(P.yaw) * cp;
    Gun.update(dt, P, fire && P.swap <= 0 && !G.shopOpen, G.demo ? fire : (mouse.fired || !!hit.KeyF) && App.locked && P.swap <= 0 && !G.shopOpen, G);
    HUD.spread(Gun.W ? lerp(Gun.W.spread[0], Gun.W.spread[1], P.ads) + P.bloom + P.moving * 0.02 : 0.02);
    if (G.abilOn > 0) { G.abilOn -= dt; if (G.abilOn <= 0) { Game.stats(); G.abilT = CLASSES[G.cls].cd * (G.cdK || 1); } } else if (G.abilT > 0) G.abilT -= dt;
    for (let i = G.falling.length - 1; i >= 0; i--) { const m = G.falling[i]; m.t -= dt; if (m.t <= 0) { Game.explode(m.x, 0.3, m.z, m.r || 6.5, (m.dmg || 650) * P.dmgK, true); G.falling.splice(i, 1); } else if (Math.random() < dt * 8) World.smoke.add(m.x, 0.2, m.z, 0, 0.4, 0, 0.6, 0.5, 0.5, 0.9, 0.3, 0.2, 0.5); }
    // ---- rockets, grenades, things lying about
    { const L = G.nums; for (const it of L) it.t += dt; while (L.length && L[0].t > 0.95) L.shift(); }
    Armory.step(dt, G); Extras.step(dt, G); if (G.op) Ops.step(dt, G);
    for (let i = G.rockets.length - 1; i >= 0; i--) { const r = G.rockets[i]; r.t += dt; let boom = r.t > 4; for (let s = 0; s < 3 && !boom; s++) { const h = dt / 3; r.x += r.vx * h; r.y += r.vy * h; r.z += r.vz * h; if (r.y <= 0.05 || World.blocked(r.x, r.z, 0.08) && World.ray(r.x - r.vx * h, r.y, r.z - r.vz * h, r.vx / 46, r.vy / 46, r.vz / 46, 1.2) < 1.2) boom = true; else for (const e of Foes.list) if (e.state !== 'die' && Math.hypot(e.x - r.x, e.z - r.z) < 0.5 * e.size && r.y < 1.95 * e.size) { boom = true; break; } }
        World.smoke.add(r.x, r.y, r.z, 0, 0.3, 0, 0.25, 1.2, 0.7, 0.8, 0.8, 0.8, 0.5); World.sparks.add(r.x, r.y, r.z, 0, 0, 0, 0.5, -3, 0.08, 1, 0.8, 0.5, 1);
        if (boom) { Game.explode(r.x, Math.max(0.2, r.y), r.z, r.r, r.dmg, r.by === 0); G.rockets.splice(i, 1); } }
    { const B = World.balls, e = B.instanceMatrix.array; let n = 0;
        for (let i = G.thrown.length - 1; i >= 0; i--) { const g = G.thrown[i]; g.t += dt; g.vy -= 12 * dt; const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt; if (World.blocked(nx, g.z, 0.07)) g.vx *= -0.4; else g.x = nx; if (World.blocked(g.x, nz, 0.07)) g.vz *= -0.4; else g.z = nz; g.y += g.vy * dt; if (g.y < 0.07) { g.y = 0.07; g.vy *= -0.35; g.vx *= 0.6; g.vz *= 0.6; if (g.kind === 'gl') g.t = 9; }
            if (g.kind === 'gl') { let hit = g.t >= 9 || (g.t > 0.06 && g.y < 3 && World.blocked(g.x + g.vx * dt, g.z + g.vz * dt, 0.07)); if (!hit) for (const e of Foes.list) if (e.state !== 'die' && Math.hypot(e.x - g.x, e.z - g.z) < 0.6 * e.size && g.y < 2 * e.size) { hit = true; break; } if (hit) { Game.explode(g.x, Math.max(0.3, g.y), g.z, g.r, g.dmg, true); G.thrown.splice(i, 1); continue; } if (Math.random() < dt * 40) World.smoke.add(g.x, g.y, g.z, 0, 0.2, 0, 0.12, 0.5, 0.4, 0.7, 0.7, 0.7, 0.35); }
            if (g.t > 2) { Armory.burst(G, g.kind || 'frag', g.x, g.z); G.thrown.splice(i, 1); continue; }
            if (n >= 12) continue; const o = n++ * 16; e.fill(0, o, o + 16); e[o] = e[o + 5] = e[o + 10] = e[o + 15] = 1; e[o + 12] = g.x; e[o + 13] = g.y; e[o + 14] = g.z; }
        B.count = n; if (n) B.instanceMatrix.needsUpdate = true; }
    { const C = World.crates, e = C.instanceMatrix.array, c = C.instanceColor.array; let n = 0;
        for (let i = G.pickups.length - 1; i >= 0; i--) { const p = G.pickups[i]; p.t += dt; if (p.t > 30 && p.kind !== 'mine') { G.pickups.splice(i, 1); continue; }
            if (!P.dead && Math.hypot(p.x - P.x, p.z - P.z) < 1.1) { if (p.kind === 'hp' && P.hp < P.max) { P.hp = Math.min(P.max, P.hp + 35); HUD.feed('<b>MEDKIT</b> +35'); Snd.ui('buy'); G.pickups.splice(i, 1); continue; } if (p.kind === 'ammo') { for (const id in Gun.state) { const w = Gun.stats(id); Gun.state[id].reserve = Math.min(w.reserve, Gun.state[id].reserve + Math.ceil(w.mag * 1.5)); } HUD.feed('<b>AMMO</b>'); Snd.ui('buy'); G.pickups.splice(i, 1); continue; } }
            if (n >= 24) continue; const mine = p.kind === 'mine', o = n * 16, a = mine ? 0.6 : p.t * 1.5, ca = Math.cos(a), sa = Math.sin(a); e.fill(0, o, o + 16); e[o] = ca; e[o + 2] = -sa; e[o + 5] = 1; e[o + 8] = sa; e[o + 10] = ca; e[o + 15] = 1; e[o + 12] = p.x; e[o + 13] = mine ? 0.1 : 0.28 + Math.sin(p.t * 3) * 0.06; e[o + 14] = p.z;
            if (p.kind === 'tag') { c[n * 3] = p.mine ? 2.4 : 2.2; c[n * 3 + 1] = p.mine ? 1.8 : 0.3; c[n * 3 + 2] = p.mine ? 0.3 : 0.2; } else if (mine) { c[n * 3] = Math.sin(p.t * 6) > 0.6 ? 3 : 0.5; c[n * 3 + 1] = 0.08; c[n * 3 + 2] = 0.05; } else if (p.kind === 'hp') { c[n * 3] = 1.6; c[n * 3 + 1] = 0.25; c[n * 3 + 2] = 0.2; } else { c[n * 3] = 0.5; c[n * 3 + 1] = 0.95; c[n * 3 + 2] = 0.35; } n++; }
        C.count = n; if (n) { C.instanceMatrix.needsUpdate = true; C.instanceColor.needsUpdate = true; } }
    // ---- the ashen and the waves (not on a guest: the host runs them)
    const guest = G.net && !G.net.host;
    if (!guest) {
        G.flowT -= dt; if (G.flowT <= 0) { G.flowT = 0.3 / G.players.length; const k = G.flowI = (G.flowI + 1) % G.players.length, p = G.players[k]; if (!p.dead && !p.gone) World.flow(G.flows[k], p.x, p.z); }
        if (G.mode === 'dm') { if (!G.over) { G.matchT -= dt; if (G.matchT <= 0 && G.net.host) { const win = Net.leader(); Net.all({ t: 'end', win }); G.finishMatch(win); } } }
        else {
        if (G.phase === 'break' && !G.over) { if (!(G.shopOpen && !G.net && G.rule !== 'rush')) G.phaseT -= dt; if (G.phaseT <= 0) { if (G.shopOpen && G.rule !== 'rush') UI.shop(false); Game.nextWave(); } }
        else if (G.phase === 'fight') {
            G.spawnT -= dt; if (G.toSpawn.length && G.spawnT <= 0 && Foes.alive() < Foes.max) { Game.spawnOne(); G.spawnT = Math.max(0.12, 0.7 - G.wave * 0.03); }
            if (!G.toSpawn.length && !Foes.alive() && !G.over) Game.waveDone();
        }
        Foes.update(dt, G); }
    } else Net.guestStep(dt);
    if (G.mode === 'dm') { if (P.dead && !G.over) { P.respawnT -= dt; if (P.respawnT <= 0) Game.respawn(); } P.safe = Math.max(0, (P.safe || 0) - dt); }
    if (G.net) Net.step(dt);
    // ---- feedback
    if (!P.dead && G.time - P.lastHurt > (G.mode === 'dm' ? 7 : G.cls === 'medic' && G.cp[0] ? 3.5 : 5) && P.hp < P.max) P.hp = Math.min(P.max, P.hp + dt * 6 * P.regen);
    if (G.tips.length && G.time > G.tips[0][0]) { G.tip = G.tips.shift()[1]; G.tipT = 5.5; Snd.ui('hover'); } if (G.tipT > 0) { G.tipT -= dt; if (G.tipT <= 0) G.tip = ''; }
    if (Foes.list.length && Math.random() < dt * 0.35) { const e = Foes.list[(Math.random() * Foes.list.length) | 0]; if (e.state !== 'die') Snd.groan(clamp(1.1 - Math.hypot(e.x - P.x, e.z - P.z) / 28, 0, 1)); }
    P.hurt = Math.max(0, P.hurt - dt * 1.5); G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; G.multiT -= dt; G.shakeK = Math.max(0, G.shakeK - dt * 2.4);
    HUD.set('hurt', P.dead ? 0.85 : (P.hurt * 0.8 + (P.hp < P.max * 0.3 ? 0.25 : 0)).toFixed(2), 'o');
    Game.hud(false);
};
Game.ability = function () {
    const G = Game, P = G.P, c = G.cls; Snd.tone(300, 0.2, 0.4, 'sawtooth', 900); HUD.callout(CLASSES[c].ability);
    if (c === 'medic') { P.hp = Math.min(P.max, P.hp + (G.cp[1] ? 100 : 70)); G.abilT = CLASSES[c].cd * (G.cdK || 1); if (G.net) Net.event('heal', { x: P.x, z: P.z }); }
    else if (Extras.ability(G, P, c)) G.abilT = CLASSES[c].cd * (G.cdK || 1);
    else { G.abilOn = c === 'assault' ? (G.cp[2] ? 9 : 6) : G.cp[2] ? (c === 'heavy' ? 11 : 12) : 8; Game.stats(); if (c === 'recon') for (const e of Foes.list) e.flash = 1; }
};
Game.render = function () {
    const G = Game, P = G.P, A = World.A, cam = World.camera, d = G.dir, bobY = Math.sin(P.bob * 3.4) * 0.025 * (1 - P.ads * 0.7), sh = G.shakeK * G.shakeK * 0.05, dead = P.dead ? Math.min(1, (G.time - P.lastHurt) * 1.5) : 0;
    const ey = World.eye + bobY - dead * 1.1 + (Math.random() - 0.5) * sh, sx = (Math.random() - 0.5) * sh, sy = (Math.random() - 0.5) * sh;
    cam.lookFrom(P.x, ey, P.z, P.x + d[0] + sx, ey + d[1] + sy + dead * 0.4, P.z + d[2]);
    const cw = cam.matrixWorld.elements; World.shBegin(); Foes.render(P, 1 / 60); if (G.net) Net.render(P); World.shEnd();
    if (G.abilOn > 0 && G.cls === 'recon') for (const e of Foes.list) if (e.state !== 'die') e.flash = Math.max(e.flash, 0.5);
    Marks.draw(cw, G.time); Extras.draw(G); if (World.flames) World.flames.update(1 / 60, cw); World.step(1 / 60, cw); draw(World.scene, cam, true);
    A.probe(P.x, P.z, P.light); World.floorL(P.light);
    if (!P.dead) Gun.render(P);
    { const tf = Math.tan(cam.fov * Math.PI / 360), s2 = Game.s2 || (Game.s2 = [0, 0]), toScreen = (x, y, z) => { const rx = x - cw[12], ry = y - cw[13], rz = z - cw[14], vz = -(rx * cw[8] + ry * cw[9] + rz * cw[10]); if (vz < 0.5) return false; s2[0] = (0.5 + (rx * cw[0] + ry * cw[1] + rz * cw[2]) / (vz * tf * cam.aspect) / 2) * innerWidth; s2[1] = (0.5 - (rx * cw[4] + ry * cw[5] + rz * cw[6]) / (vz * tf) / 2) * innerHeight; return true; };
        const nb = $('nums'), L = G.nums || []; while (nb.children.length < L.length) nb.appendChild(document.createElement('div'));
        for (let i = 0; i < nb.children.length; i++) { const m = nb.children[i], it = L[i]; if (!it || !toScreen(it.x, it.y + it.t * 0.9, it.z)) { if (m.style.display !== 'none') m.style.display = 'none'; continue; } m.style.display = ''; const cls = 'num' + (it.dead ? ' kill' : it.head ? ' head' : ''), tx = String(Math.round(it.n)); if (m.className !== cls) m.className = cls; if (m.textContent !== tx) m.textContent = tx; m.style.opacity = clamp(1.9 - it.t * 2, 0, 1).toFixed(2); m.style.transform = 'translate(' + s2[0].toFixed(0) + 'px,' + s2[1].toFixed(0) + 'px) scale(' + (1 + Math.max(0, 0.12 - it.t) * 5).toFixed(2) + ')'; }
        const eb = $('ebars'); let n = 0;
        if (!P.dead) for (const e of Foes.list) { if (n >= 14) break; if (!(e.barT > 0) || e.state === 'die' || e.T.boss || Kinds.hidden(e)) continue; if (Math.hypot(e.x - P.x, e.z - P.z) > 45 || !toScreen(e.x, 2.05 * e.size + (e.y || 0), e.z) || !World.sees(P.x, P.z, e.x, e.z, 1.5)) continue;
            let m = eb.children[n]; if (!m) { m = document.createElement('div'); m.className = 'ebar'; m.innerHTML = '<i></i>'; eb.appendChild(m); } n++; m.style.display = ''; m.style.opacity = clamp(e.barT, 0, 1).toFixed(2); m.style.transform = 'translate(' + s2[0].toFixed(0) + 'px,' + s2[1].toFixed(0) + 'px)'; m.firstChild.style.width = clamp(e.hp / e.max * 100, 0, 100).toFixed(0) + '%'; }
        for (let i = n; i < eb.children.length; i++) if (eb.children[i].style.display !== 'none') eb.children[i].style.display = 'none'; }
    const tg = G.op && !G.over && !P.dead ? Ops.goal(G) : null, way = $('way');
    if (!tg) { if (way.className !== 'hidden') way.className = 'hidden'; }
    else { let rel = Math.atan2(-(tg.x - P.x), -(tg.z - P.z)) - P.yaw; while (rel > Math.PI) rel -= Math.PI * 2; while (rel < -Math.PI) rel += Math.PI * 2; const far = Math.hypot(tg.x - P.x, tg.z - P.z), show = Math.abs(rel) > 0.3 && far > 4;
        if ((way.className === 'hidden') === show) way.className = show ? '' : 'hidden';
        if (show) { const R2 = Math.min(innerWidth, innerHeight) * 0.36; way.style.transform = 'translate(' + (-Math.sin(rel) * R2).toFixed(0) + 'px,' + (-Math.cos(rel) * R2).toFixed(0) + 'px) rotate(' + (-rel).toFixed(2) + 'rad)'; const dEl = $('way-d'), t = Math.round(far) + ' m'; if (dEl.textContent !== t) dEl.textContent = t; dEl.style.transform = 'rotate(' + rel.toFixed(2) + 'rad)'; } }
};
