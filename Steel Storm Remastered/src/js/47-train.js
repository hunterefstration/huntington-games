// ============================================================
// TRAINING: a proving-ground lesson, a step at a time. Nothing shoots back. Each step puts what it needs on the field
// (a ring to drive to, a parked tank, a truck) and waits for you to do the thing; the words along the bottom say what.
// Finishing it the first time pays a little research and credits.
// ============================================================
KINDS.truck = { name: 'TRUCK', model: 'truck', hp: 0.22, speed: 1, reload: 1, dmg: 0, guard: 1.6, shade: 1, desc: 'A supply truck: no armour at all.' };
MODES.train = { name: 'TRAINING', blurb: 'Six steps on a quiet field: driving, laying the gun, armour, shells, the gun sight, repairs. Nothing shoots back.', goal: 'steps' };
const Train = { STEPS: [
    'DRIVE INTO THE LIGHT   (W A S D: the hull goes where you steer, not where you look)',
    'LAY THE GUN ON THE PARKED TANK AND FIRE   (the mouse turns the turret; the ring goes green when the gun is on; click or Space)',
    'ARMOUR: ITS FRONT IS THICK. DRIVE ROUND AND HIT ITS SIDE OR REAR',
    'SHELLS: PRESS 2 FOR HIGH EXPLOSIVE AND DESTROY THE TRUCK   (1 is armour piercing)',
    'THE GUN SIGHT: PRESS E (or the right button, or Shift) AND HIT THE FAR TANK',
    'REPAIRS: YOU HAVE BEEN HIT. PRESS R TO USE A REPAIR KIT'] };
// a spot d metres ahead of the player, a little to one side, on clear ground
Train.ahead = function (G, d, side) { const P = G.P; for (let k = 0; k < 16; k++) { const a = P.yaw + (side || 0) + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.3, s = [P.x + Math.sin(a) * d, P.z + Math.cos(a) * d]; if (Game.clear(s[0], s[1], 6)) return s; } return Game.spot(P.x + Math.sin(P.yaw) * d, P.z + Math.cos(P.yaw) * d, 6); };
Train.begin = function (G) { G.train = { i: -1, units: [], beam: null, flag: false, t: 0 }; G.kits = 2; Train.next(G); };
Train.next = function (G) {
    const T = G.train, P = G.P; T.i++; T.t = 0; T.flag = false; for (const U of T.units) if (!U.dead && Units.list.indexOf(U) >= 0) Units.retire(U); T.units = []; Beams.clear(); T.beam = null;
    if (T.i >= Train.STEPS.length) return Train.done(G);
    const park = (d, side, kind, turn) => { const s = Train.ahead(G, d, side), U = Units.make(1, s[0], s[1], Math.atan2(P.x - s[0], P.z - s[1]) + (turn || 0), kind); U.reload = 99; T.units.push(U); return U; };
    if (T.i === 0) { const s = Train.ahead(G, 55, 0); T.beam = Beams.add(s[0], s[1]); T.beam.c = [0.5, 1, 0.45]; }
    else if (T.i === 1) park(75, 0, 'medium'); else if (T.i === 2) { const U = park(60, 0.5, 'heavy'); U.max = U.hp = 900; } else if (T.i === 3) park(70, -0.4, Units.extra.truck ? 'truck' : 'light'); else if (T.i === 4) park(Math.min(230, World.size * 0.4), 0, 'medium');
    else if (T.i === 5) { P.hp = Math.min(P.hp, P.max * 0.45); G.kits = Math.max(G.kits, 1); G.hurt = 1; G.shakeK = 0.8; }
    HUD.banner('STEP ' + (T.i + 1) + ' OF ' + Train.STEPS.length, Train.STEPS[T.i].split('   ')[0].toLowerCase()); Snd.tone(520, 0.15, 0.3, 'triangle', 780);
};
Train.text = G => G.train ? Train.STEPS[Math.min(G.train.i, Train.STEPS.length - 1)] : '';
// a shell of yours struck something
Train.struck = function (G, U, dmg, word) {
    const T = G.train; if (!T || T.units.indexOf(U) < 0) return;
    if (T.i === 2 && (word === 'FRONT HIT' || word === 'TURRET HIT' || word === 'RICOCHET') && !U.dead) { U.hp = U.max; HUD.callout('THAT WAS THE FRONT: GET ROUND IT'); }
    if (T.i === 2 && U.dead && word !== 'SIDE HIT' && word !== 'REAR HIT' && word !== 'BLAST') { T.flag = false; T.redo = true; }
    if (T.i === 3 && G.P.shellType !== 'he' && !U.dead) HUD.callout('PRESS 2: HIGH EXPLOSIVE');
    if (T.i === 4 && U.dead && G.sight < 0.5) T.redo = true;
};
Train.step = function (G, dt) {
    const T = G.train, P = G.P; if (!T || G.over) return; T.t += dt; if (P.hp < 200 && T.i !== 5) P.hp = 200; let ok = false; const gone = () => T.units.length > 0 && T.units.every(U => U.dead);
    if (T.i === 0) ok = T.beam && Math.hypot(P.x - T.beam.x, P.z - T.beam.z) < 9;
    else if (T.i === 5) ok = P.hp > P.max * 0.5;
    else if (gone()) { if (T.redo) { T.redo = false; T.i--; HUD.callout(T.i === 3 ? 'USE THE GUN SIGHT THIS TIME: E' : 'FROM THE SIDE OR THE REAR THIS TIME'); return Train.next(G); } ok = true; }
    if (ok) { Snd.ui('buy'); Train.next(G); }
};
Train.done = function (G) {
    const sv = Save.data, first = !sv.trained; if (G.over) return; G.over = true; G.overT = 2; sv.trained = true; let rp = 0, cr = 0; if (first) { rp = 200; cr = 1500; sv.rp += rp; sv.cr += cr; } Save.store();
    G.result = { title: 'TRAINING', big: 'COMPLETE', wave: 0, kills: G.kills, score: G.score, acc: G.shots ? Math.round(G.hits / G.shots * 100) : 0, time: G.time, record: false, rp, cr }; HUD.banner('TRAINING COMPLETE', first ? 'a little research and credits to start with' : 'well driven'); Snd.tone(440, 0.25, 0.9, 'triangle', 880); Music.set('menu');
};
