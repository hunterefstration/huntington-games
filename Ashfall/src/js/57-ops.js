// ============================================================
// OPERATIONS: the campaign. Eighteen missions in three chapters; each is a few STAGES played one after another on one
// map while the ashen keep coming (the waves never stop, the supply crate opens any time):
//   survive n   clear n waves                 hold secs    stand in the ring until it is full
//   intel n     pick up n cases               repair n     stay beside each of n generators until it runs
//   rescue n    bring n survivors home, one at a time      defend secs  keep the thing in the middle alive
//   hunt n      kill n alphas (marked)        boss id      bring it down        extract   reach the ring and wait
// Done missions pay credits and up to three stars (done; inside the par time; never below 35 health), and open the next.
// Marks = the rings and pillars of light that show where an objective is.
// ============================================================
const CHAPTERS = [
    { name: 'I. EMBERS', sub: 'The rail yard is the last gate that still shuts.' },
    { name: 'II. COLD STORAGE', sub: 'Something in the depot is still running.' },
    { name: 'III. THE LONG ROAD', sub: 'Everyone who is left goes out down Main Street, or not at all.' }
];
const OPS = [
    { id: 'o1', ch: 0, name: 'FIRST LIGHT', map: 'yard', diff: 'easy', par: 150, brief: 'You are awake. Good. The yard gate still shuts, and it is the last one that does. Show us you can hold a rifle, then get to the lamp.', stages: [['survive', 2], ['extract']] },
    { id: 'o2', ch: 0, name: 'DEAD FREIGHT', map: 'yard', diff: 'easy', par: 200, brief: 'Three wagons came in before the line went quiet. Their manifests say what was on them. We want to know what was on them.', stages: [['intel', 3], ['survive', 1], ['extract']] },
    { id: 'o3', ch: 0, name: 'HOLD THE LINE', map: 'yard', diff: 'normal', par: 230, brief: 'The relay only talks while someone stands beside it. Stand beside it. Then clear what the noise brings.', stages: [['hold', 45], ['survive', 2]] },
    { id: 'o4', ch: 0, name: 'LIGHTS OUT', map: 'depot', diff: 'normal', par: 260, brief: 'The depot has its own generators. Two of them will turn if somebody stays long enough to ask them nicely.', stages: [['repair', 2], ['hold', 40]] },
    { id: 'o5', ch: 0, name: 'NO ONE LEFT BEHIND', map: 'depot', diff: 'normal', par: 300, brief: 'Three of the night shift are still in there, hiding in the dark. Find them. Walk each one back to the lamp.', stages: [['rescue', 3], ['extract']] },
    { id: 'o6', ch: 0, name: 'THE FOREMAN', map: 'yard', diff: 'normal', par: 300, boss: true, brief: 'He ran this yard for thirty years. He is still doing his rounds. He does not know he stopped being himself.', stages: [['survive', 1], ['boss', 'foreman']] },
    { id: 'o7', ch: 1, name: 'STATIC', map: 'subway', diff: 'normal', par: 320, brief: 'There is a voice on the long-wave, and the station under the town has the mast. Four sets of crystals, then keep them off the radio.', stages: [['intel', 4], ['defend', 60]] },
    { id: 'o8', ch: 1, name: 'THE LONG AISLE', map: 'depot', diff: 'normal', par: 360, brief: 'They are nesting between the shelves. Two of them are bigger than the rest and the others follow them. Remove those two.', stages: [['survive', 2], ['hunt', 2]] },
    { id: 'o9', ch: 1, name: 'SAFE PASSAGE', map: 'mall', diff: 'normal', par: 380, brief: 'Four families hiding in the shops of the arcade. Bring them to the fountain, hold the concourse, and leave by the east doors.', stages: [['rescue', 4], ['hold', 40], ['extract']] },
    { id: 'o10', ch: 1, name: 'DEAD GRID', map: 'street', diff: 'normal', par: 380, brief: 'Three substations. If the street lamps come back on, the ones in the dark will have fewer places to stand.', stages: [['repair', 3], ['survive', 2]] },
    { id: 'o11', ch: 1, name: 'WHAT THE ASH KEEPS', map: 'lab', diff: 'hard', par: 420, brief: 'Sublevel 3 was sealed from the inside. Three alphas are guarding it. Whatever they are guarding, we want the notes.', stages: [['hunt', 3], ['intel', 3], ['extract']] },
    { id: 'o12', ch: 1, name: 'THE WIDOW', map: 'depot', diff: 'hard', par: 420, boss: true, brief: 'She was the night nurse. She kept them all alive in here, and she is still keeping them. Do not let her reach the radio.', stages: [['defend', 45], ['boss', 'widow']] },
    { id: 'o13', ch: 2, name: 'QUARANTINE LINE', map: 'outpost', diff: 'hard', par: 400, brief: 'Checkpoint 9 is the only thing between the town and the road out. The army left. It holds for as long as you do.', stages: [['hold', 60], ['survive', 3]] },
    { id: 'o14', ch: 2, name: 'CODE RED', map: 'yard', diff: 'hard', par: 380, brief: 'The last engine is taking on water. Ninety seconds. Nothing touches the engine.', stages: [['defend', 90], ['extract']] },
    { id: 'o15', ch: 2, name: 'LAST TRAIN', map: 'yard', diff: 'hard', par: 520, brief: 'Points, signals, people, in that order. Then stand by the engine until it moves, and be on it when it does.', stages: [['repair', 3], ['rescue', 3], ['defend', 60], ['extract']] },
    { id: 'o16', ch: 2, name: 'FLASHPOINT', map: 'carnival', diff: 'hard', par: 460, brief: 'Four alphas have come down from the ridge and through the fairground, and everything is moving with them. Take the heads off the column.', stages: [['hunt', 4], ['survive', 3]] },
    { id: 'o17', ch: 2, name: 'DESCENT', map: 'subway', diff: 'brutal', par: 560, brief: 'The notes say where it started: under the town, past the last platform. Five keys, one door, and the Warden still keeps it.', stages: [['intel', 5], ['hold', 60], ['boss', 'warden'], ['extract']] },
    { id: 'o18', ch: 2, name: 'ASHFALL', map: 'street', diff: 'brutal', par: 640, boss: true, brief: 'It is coming down the road behind the ash. Everything we have left is on this street. So are you.', stages: [['survive', 2], ['boss', 'furnace'], ['hold', 45], ['boss', 'hollow']] }
];
const TRAINING = { id: 't0', ch: 0, name: 'BASIC TRAINING', map: 'yard', diff: 'easy', par: 300, train: true, brief: 'Before you go through the gate, show the sergeant you know which end the rounds come out of. Nothing here bites.', stages: [['drill']] };
const DRILL = ['WALK INTO THE RING   (W A S D, the mouse looks)', 'SHOOT THE THREE TARGETS   (click, or F)', 'AIM WITH E, THEN HIT THE FAR ONE', 'RELOAD   (R)', 'THROW AT THE GROUP   (G)', 'SPRINT TO THE NEXT RING   (hold Shift)', 'OPEN THE ARMORY, BUY SOMETHING OR NOT, CLOSE IT   (B)', 'USE YOUR CLASS ABILITY   (X)', 'JUMP   (Space: it gets you onto a crate or over a barrier)'];
const STAGE_NAME = { drill: 'Follow the sergeant',  survive: 'Clear the waves', hold: 'Hold the ring', intel: 'Collect the cases', repair: 'Start the generators', rescue: 'Bring the survivors home', defend: 'Keep it alive', hunt: 'Kill the alphas', boss: 'Bring it down', extract: 'Get to the lamp' };

// ---- rings and pillars of light
const Marks = { list: [], rings: [], beams: [], M: new Float32Array(16) };
Marks.setup = function () {
    if (Marks.rings.length || !World.scene) return;
    const ring = blobTexture(128, [[0, 'rgba(255,255,255,.10)'], [0.74, 'rgba(255,255,255,.05)'], [0.86, 'rgba(255,255,255,1)'], [0.93, 'rgba(255,255,255,.25)'], [1, 'rgba(255,255,255,0)']], true), beam = blobTexture(64, [[0, 'rgba(255,255,255,.9)'], [0.3, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']], true);
    for (let i = 0; i < 8; i++) for (const [arr, tex] of [[Marks.rings, ring], [Marks.beams, beam]]) { const m = HG3D.mesh(quadGeo(), HG3D.material({ lit: false, map: tex, transparent: true, blending: 2, depthWrite: false, fog: false, side: 2 })); m.frustumCulled = false; m.renderOrder = 4; m.visible = false; World.scene.add(m); arr.push(m); }
};
Marks.clear = function () { Marks.list.length = 0; for (const m of Marks.rings.concat(Marks.beams)) m.visible = false; };
// a mark: where, how wide the ring is (0: none), its colour, how tall the pillar is (0: none)
Marks.add = function (x, z, r, c, tall) { Marks.setup(); const m = { x, z, r, c: c || [1, 0.55, 0.2], tall: tall === undefined ? 14 : tall, fill: -1 }; Marks.list.push(m); return m; };
Marks.remove = function (m) { const i = Marks.list.indexOf(m); if (i >= 0) Marks.list.splice(i, 1); };
Marks.draw = function (cw, t) {
    const e = Marks.M, L = Marks.list; let rl = Math.hypot(cw[0], cw[2]) || 1; const rx = cw[0] / rl, rz = cw[2] / rl;
    for (let i = 0; i < 8; i++) {
        const m = L[i], R1 = Marks.rings[i], B = Marks.beams[i]; if (!R1) return; R1.visible = !!m && m.r > 0; B.visible = !!m && m.tall > 0; if (!m) continue;
        const k = 0.75 + 0.25 * Math.sin(t * 3 + i), c = m.c;
        if (m.r > 0) { const d = m.r * 2.3; e.fill(0); e[0] = d; e[6] = d; e[9] = 1; e[12] = m.x; e[13] = 0.07; e[14] = m.z; e[15] = 1; HG3D.place(R1, e); R1.material.color = { r: c[0] * k * 1.6, g: c[1] * k * 1.6, b: c[2] * k * 1.6 }; }
        if (m.tall > 0) { const w = 1.5; e.fill(0); e[0] = rx * w; e[2] = rz * w; e[5] = m.tall; e[8] = -rz; e[10] = rx; e[12] = m.x; e[13] = m.tall / 2; e[14] = m.z; e[15] = 1; HG3D.place(B, e); B.material.color = { r: c[0] * k, g: c[1] * k, b: c[2] * k }; }
    }
};

const Ops = {};
Ops.by = id => id === 't0' ? TRAINING : OPS.find(o => o.id === id);
Ops.open = function (op) { if (op.train) return true; const i = OPS.indexOf(op); return i <= 0 || !!Save.data.ops[OPS[i - 1].id] || Q.get('all') === '1' || !!Save.data.testAll; };
Ops.pay = op => op.train ? 100 : 120 + OPS.indexOf(op) * 25;
// a walkable spot at least `far` metres from the player and `apart` from every spot in `avoid`
Ops.spot = function (G, far, avoid, apart, room) {
    const F = World.mainFlow, P = G.P; let best = null, bs = -1;
    for (let n = 0; n < 260; n++) { const c = (Math.random() * World.NX * World.NZ) | 0; if (F.dist[c] < 0) continue; const x = World.cellX(c), z = World.cellZ(c); if (World.blocked(x, z, room || 0.8)) continue;
        let d = Math.hypot(x - P.x, z - P.z), score = Math.min(d, far); for (const a of avoid || []) { const da = Math.hypot(x - a[0], z - a[1]); score = Math.min(score, da * far / (apart || 10)); d = Math.min(d, da); }
        if (score > bs) { bs = score; best = [x, z]; if (score >= far) break; } }
    return best || World.home;
};
Ops.start = function (G, op) { G.op = { def: op, i: -1, st: null, minHp: 100, used: [], t: 0 }; G.wave = Math.max(0, Math.floor(OPS.indexOf(op) * 0.5)); for (const s of op.stages) if (s[0] === 'boss') Foes.want(s[1]); Ops.next(G); };
Ops.next = function (G) {
    const O = G.op; Marks.clear(); if (O.obj) Ops.dropObj(G); O.i++;
    if (O.i >= O.def.stages.length) return Ops.win(G);
    const [k, n] = O.def.stages[O.i], st = O.st = { k, n: n || 0, have: 0, t: 0, items: [], waves: 0 }, P = G.P, EM = [1, 0.55, 0.2], GR = [0.35, 1, 0.45], BL = [0.4, 0.75, 1.3];
    const place = (count, far, r, c, tall) => { for (let i = 0; i < count; i++) { const s = Ops.spot(G, far, O.used.concat(st.items.map(m => [m.x, m.z])), 12, r > 3 ? 3.2 : 0.8); st.items.push(Object.assign(Marks.add(s[0], s[1], r, c, tall), { p: 0 })); } };
    if (k === 'hold') { place(1, 18, 5, EM); O.used.push([st.items[0].x, st.items[0].z]); }
    else if (k === 'intel') place(Math.min(n, 6), 16, 1.1, BL, 9);
    else if (k === 'repair') place(Math.min(n, 5), 18, 2.2, [1.2, 1, 0.3], 11);
    else if (k === 'rescue') { place(Math.min(n, 5), 20, 1.3, BL, 9); st.home = Marks.add(World.home[0], World.home[1], 3.5, GR, 16); st.carry = false; }
    else if (k === 'extract') { place(1, 26, 3.5, GR, 22); }
    else if (k === 'defend') { const o = O.obj = { x: World.home[0], z: World.home[1], hp: 500 + 60 * OPS.indexOf(O.def), max: 0, dead: false, gone: false, obj: true, name: 'it' }; o.max = o.hp; G.players.push(o); const F = World.newFlow(); World.flow(F, o.x, o.z); G.flows.push(F); st.mark = Marks.add(o.x, o.z, 2.5, GR, 18); }
    else if (k === 'hunt') st.alpha = null;
    else if (k === 'drill') { st.n = DRILL.length; st.have = -1; Ops.drillNext(G); }
    else if (k === 'boss') { st.id = Foes.can(n) ? n : 'furnace'; st.n = 1; st.wait = 2.5; }
    HUD.banner(O.i ? 'NEXT: ' + STAGE_NAME[k].toUpperCase() : O.def.name, O.i ? Ops.line(G) : STAGE_NAME[k]); Snd.tone(330, 0.2, 0.6, 'triangle', 660);
};
Ops.dropObj = function (G) { const O = G.op, i = G.players.indexOf(O.obj); if (i > 0) { G.players.splice(i, 1); G.flows.splice(i, 1); } O.obj = null; for (const e of Foes.list) e.tgt = 0; };
// the objective's line on the HUD
Ops.line = function (G) {
    const O = G.op, st = O.st; if (!st) return ''; const k = st.k, sec = v => Math.ceil(Math.max(0, v)) + 's';
    if (k === 'drill') return DRILL[Math.min(st.have, DRILL.length - 1)] || '';
    return (k === 'survive' ? 'CLEAR ' + (st.n - st.have) + ' MORE WAVE' + (st.n - st.have === 1 ? '' : 'S') : k === 'hold' ? 'HOLD THE RING  ' + Math.floor(st.have / st.n * 100) + '%' : k === 'intel' ? 'CASES  ' + st.have + ' / ' + st.n : k === 'repair' ? 'GENERATORS  ' + st.have + ' / ' + st.n
        : k === 'rescue' ? (st.carry ? 'BRING THEM TO THE GREEN LAMP' : 'SURVIVORS  ' + st.have + ' / ' + st.n) : k === 'defend' ? 'KEEP IT ALIVE  ' + sec(st.n - st.t) + '   ' + Math.max(0, Math.ceil(O.obj ? O.obj.hp / O.obj.max * 100 : 0)) + '%' : k === 'hunt' ? 'ALPHAS  ' + st.have + ' / ' + st.n : k === 'boss' ? 'BRING IT DOWN' : 'GET TO THE GREEN LAMP' + (st.have > 0 ? '  ' + sec(3 - st.have) : ''));
};
// how far along this stage is (0..1), for the bar under the objective
Ops.frac = function (G) { const O = G.op, st = O.st; if (!st) return 0; const k = st.k; return clamp(k === 'drill' ? st.have / DRILL.length : k === 'defend' ? st.t / st.n : k === 'extract' ? st.have / 3 : k === 'boss' ? (st.boss ? 1 - st.boss.hp / st.boss.max : 0) : k === 'repair' ? (st.have + (st.items[0] ? st.items.reduce((m, x) => Math.max(m, x.p), 0) : 0)) / st.n : st.have / st.n, 0, 1); };
// where the player should be going: the nearest thing this stage wants (none while clearing waves)
Ops.goal = function (G) {
    const O = G.op, st = O.st, P = G.P; if (!st) return null; if (st.k === 'rescue' && st.carry) return st.home; if (st.k === 'defend') return O.obj; if (st.k === 'hunt') return st.alpha; if (st.k === 'boss') return st.boss || null;
    let best = null, bd = 1e9; for (const m of st.items) { const d = Math.hypot(m.x - P.x, m.z - P.z); if (d < bd) { bd = d; best = m; } } return best;
};
// a place in front of the player, d metres off (a little to one side for each i), on open ground
Ops.ahead = function (G, d, i) { const P = G.P, a = P.yaw + (i || 0) * 0.16; for (let k = 0; k < 14; k++) { const b = a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.45, x = P.x - Math.sin(b) * d, z = P.z - Math.cos(b) * d; if (!World.blocked(x, z, 0.8) && World.sees(P.x, P.z, x, z, 1.4)) return [x, z]; } return Ops.spot(G, d, [], 4); };
Ops.dummy = function (G, d, i) { const s = Ops.ahead(G, d, i), e = Foes.spawn('walker', s[0], s[1], 0.5, 0); e.dummy = true; e.born = 0.3; e.yaw = Math.atan2(G.P.x - e.x, G.P.z - e.z); return e; };
// training: set up the next step
Ops.drillNext = function (G) {
    const st = G.op.st, P = G.P; st.have++; st.t = 0; st.flag = false; for (const m of st.items) Marks.remove(m); st.items = []; for (const e of Foes.list) if (e.dummy && e.state !== 'die') { e.state = 'die'; e.t = 0; }
    if (st.have >= DRILL.length) return Ops.next(G); const i = st.have, ring = d => { const s = Ops.ahead(G, d, 0); st.items.push(Object.assign(Marks.add(s[0], s[1], 2.5, [0.35, 1, 0.45], 14), { p: 0 })); };
    if (i === 0) ring(9); else if (i === 1) st.dum = [Ops.dummy(G, 9, -2), Ops.dummy(G, 10, 0), Ops.dummy(G, 9, 2)]; else if (i === 2) st.dum = [Ops.dummy(G, 24, 0)]; else if (i === 3) { if (Gun.S && Gun.W && !Gun.W.melee) Gun.S.ammo = Math.min(Gun.S.ammo, Math.max(1, Math.floor(Gun.W.mag / 4))); }
    else if (i === 4) { st.dum = [0, 1, 2, 3].map(n => Ops.dummy(G, 12 + (n & 1), n - 1.5)); G.nades = Math.max(G.nades, 2); } else if (i === 5) ring(22); else if (i === 6) G.cash = Math.max(G.cash, 600); else if (i === 7) { G.abilT = 0; G.abilOn = 0; }
    HUD.banner('STEP ' + (i + 1) + ' OF ' + DRILL.length, DRILL[i].split('   ')[0].toLowerCase()); Snd.tone(520, 0.15, 0.3, 'triangle', 780);
};
Ops.drill = function (G, st, dt) {
    const P = G.P, i = st.have, near = (m, r) => m && Math.hypot(P.x - m.x, P.z - m.z) < r, gone = () => !st.dum.some(e => e.state !== 'die'); G.phase = 'break'; G.phaseT = 99; G.toSpawn.length = 0; let ok = false;
    if (i === 0 || i === 5) ok = near(st.items[0], 2.6); else if (i === 1) ok = gone();
    else if (i === 2) { if (gone()) { if (st.flag) ok = true; else { st.dum = [Ops.dummy(G, 24, 0)]; HUD.callout('AIM FIRST: PRESS E'); } } else if (P.ads > 0.6) st.flag = true; else if (st.dum[0].hp === st.dum[0].max) st.flag = false; }
    else if (i === 3) { if (P.reload > 0) st.flag = true; else if (st.flag) ok = true; }
    else if (i === 4) { if (G.thrown.length || G.fires.length || G.turrets.length || G.pickups.some(p => p.kind === 'mine') || P.stim > 0) st.flag = true; if (st.flag && (gone() || st.t > 14)) ok = true; if (!st.flag && G.nades <= 0) G.nades = 1; }
    else if (i === 6) { if (G.shopOpen) st.flag = true; else if (st.flag) ok = true; }
    else if (i === 7) ok = G.abilOn > 0 || G.abilT > 0;
    else if (i === 8) { if (P.y > 0.5) st.flag = true; else if (st.flag && !P.air) ok = true; }
    if (ok) { Snd.ui('buy'); Ops.drillNext(G); }
};
Ops.waveDone = function (G) { const st = G.op.st; if (st && st.k === 'survive' && ++st.have >= st.n) Ops.next(G); };
Ops.killed = function (G, e) { const st = G.op.st; if (!st) return; if (st.k === 'hunt' && e === st.alpha) { st.alpha = null; if (st.mark) { Marks.remove(st.mark); st.mark = null; } HUD.callout('ALPHA DOWN'); if (++st.have >= st.n) Ops.next(G); } else if (st.k === 'boss' && e === st.boss) { st.have = 1; G.slow = 1.2; Ops.next(G); } };
// something hit the thing being defended
Ops.hitObj = function (G, o, dmg) { o.hp -= dmg; if (Math.random() < 0.3) World.spark(o.x + rand(-0.6, 0.6), rand(0.4, 1.6), o.z + rand(-0.6, 0.6), 0.5); if (o.hp <= 0 && !G.over) { o.dead = true; World.boom(o.x, 1, o.z, true); Snd.boom(1); HUD.banner('IT IS GONE', 'the operation has failed'); G.op.lost = true; Game.finish(); } };
Ops.step = function (dt, G) {
    const O = G.op, st = O.st, P = G.P; if (!st || G.over) return; st.t += dt; O.t += dt; if (!P.dead) O.minHp = Math.min(O.minHp, P.hp);
    const near = (m, r) => !P.dead && Math.hypot(P.x - m.x, P.z - m.z) < r, k = st.k;
    if (k === 'hold') { const m = st.items[0]; if (near(m, 5)) { st.have += dt; if (st.have >= st.n) Ops.next(G); } }
    else if (k === 'intel') { for (let i = st.items.length - 1; i >= 0; i--) if (near(st.items[i], 1.3)) { Marks.remove(st.items[i]); st.items.splice(i, 1); st.have++; HUD.callout('CASE ' + st.have + ' OF ' + st.n); Snd.ui('buy'); if (st.have >= st.n) return Ops.next(G); if (!st.items.length) { const s = Ops.spot(G, 16, O.used, 12); st.items.push(Object.assign(Marks.add(s[0], s[1], 1.1, [0.4, 0.75, 1.3], 9), { p: 0 })); } } }
    else if (k === 'repair') { for (let i = st.items.length - 1; i >= 0; i--) { const m = st.items[i]; if (!near(m, 2.4)) continue; m.p += dt / 7; if (Math.random() < dt * 6) World.spark(m.x + rand(-0.4, 0.4), rand(0.5, 1.4), m.z + rand(-0.4, 0.4), 0.4); HUD.set('msg', 'STARTING IT  ' + Math.floor(m.p * 100) + '%');
            if (m.p >= 1) { Marks.remove(m); st.items.splice(i, 1); st.have++; HUD.set('msg', ''); HUD.callout('GENERATOR ' + st.have + ' OF ' + st.n); Snd.tone(110, 0.3, 1, 'sawtooth', 220); if (st.have >= st.n) return Ops.next(G); if (!st.items.length) { const s = Ops.spot(G, 18, O.used, 12); st.items.push(Object.assign(Marks.add(s[0], s[1], 2.2, [1.2, 1, 0.3], 11), { p: 0 })); } } } }
    else if (k === 'rescue') {
        if (!st.carry) { for (let i = st.items.length - 1; i >= 0; i--) if (near(st.items[i], 1.6)) { Marks.remove(st.items[i]); st.items.splice(i, 1); st.carry = true; P.speedK *= 0.85; HUD.callout('STAY CLOSE TO ME'); Snd.ui('buy'); break; } }
        else if (near(st.home, 3.5)) { st.carry = false; Game.stats(); st.have++; HUD.callout('SAFE: ' + st.have + ' OF ' + st.n); Snd.tone(440, 0.2, 0.5, 'triangle', 880); if (st.have >= st.n) return Ops.next(G); if (!st.items.length) { const s = Ops.spot(G, 20, O.used, 12); st.items.push(Object.assign(Marks.add(s[0], s[1], 1.3, [0.4, 0.75, 1.3], 9), { p: 0 })); } } }
    else if (k === 'defend') { if (st.t >= st.n) Ops.next(G); }
    else if (k === 'hunt') {
        if (!st.alpha && st.t > 2 && Foes.can('brute')) { const p = World.farSpot(G.flows[0], 24), e = Foes.spawn('brute', p[0], p[1], 3 * (G.hpK || 1), 1.15); e.alpha = true; e.size *= 1.18; st.alpha = e; st.mark = Marks.add(e.x, e.z, 0, [1.4, 0.2, 0.15], 12); HUD.banner('ALPHA', 'it is marked: bring it down'); Snd.boom(0.7); }
        if (st.alpha && st.mark) { st.mark.x = st.alpha.x; st.mark.z = st.alpha.z; st.alpha.flash = Math.max(st.alpha.flash, 0.25); } }
    else if (k === 'boss') { if (!st.boss && (st.wait -= dt) <= 0) { const p = World.farSpot(G.flows[0], 30), T = FOES[st.id], e = st.boss = Foes.spawn(st.id, p[0], p[1], 0.8 + OPS.indexOf(O.def) * 0.04, 1); G.bossAlive = e; HUD.banner(T.name, 'bring it down'); Snd.boom(1); G.shake(1, e.x, e.z); } }
    else if (k === 'drill') Ops.drill(G, st, dt);
    else if (k === 'extract') { const m = st.items[0]; if (near(m, 3.5)) { st.have += dt; if (st.have >= 3) Ops.next(G); } else st.have = 0; }
};
Ops.win = function (G) {
    const O = G.op, op = O.def, sv = Save.data, first = !sv.ops[op.id], stars = 1 + (G.time <= op.par ? 1 : 0) + (O.minHp >= 35 ? 1 : 0); if (G.over) return; G.over = true; G.overT = 2.6; G.slow = 1.5; Marks.clear();
    const xp = Math.round(((G.xpRun || 0) + 150 + OPS.indexOf(op) * 20) * G.D.xp), before = Save.rank(), cr = Armory.earn(Math.round(Ops.pay(op) * (first ? 1 : 0.25)) + Math.round(G.earned / 25));
    sv.xp += xp; sv.ops[op.id] = Math.max(sv.ops[op.id] || 0, stars); sv.stats.time += G.time; Armory.note('ops', 1); Extras.clsPay(G.cls, xp); Save.store();
    G.result = { title: 'OPERATION COMPLETE', big: op.name, stars, wave: 0, kills: G.kills, heads: G.heads, acc: G.shotsFired ? Math.round(G.shotsHit / G.shotsFired * 100) : 0, cash: G.earned, xp, credits: cr, record: false, before, after: Save.rank(), time: G.time, op: op.id };
    HUD.banner('OPERATION COMPLETE', op.name); Snd.tone(440, 0.25, 0.9, 'triangle', 880); Snd.tone(660, 0.2, 1.2, 'triangle', 1320); Music.set('menu');
};

// ---- the operations page
Ops.sel = '';
Ops.html = function () {
    const sv = Save.data, cur = Ops.by(Ops.sel) || (!sv.ops.t0 && !sv.ops.o1 ? TRAINING : OPS.find(o => !sv.ops[o.id])) || OPS[0], open = Ops.open(cur), star = n => '<span class="stars">' + '&#9733;'.repeat(n) + '<i>' + '&#9733;'.repeat(3 - n) + '</i></span>';
    Ops.sel = cur.id;
    const tr = '<div class="tiles ops"><button class="tile' + (cur === TRAINING ? ' sel' : '') + '" data-op="t0"><b>BASIC TRAINING</b><small>five minutes, nothing bites</small>' + star(sv.ops.t0 || 0) + '</button></div>';
    return '<div class="cols"><div style="flex:1.2 1 420px">' + (sv.ops.t0 ? '' : '<div class="h3">Start here</div>' + tr) + CHAPTERS.map((c, ci) => '<div class="h3">' + c.name + ' &middot; <span style="color:var(--dim);letter-spacing:.05em;text-transform:none">' + esc(c.sub) + '</span></div><div class="tiles ops">' + OPS.filter(o => o.ch === ci).map(o => { const ok = Ops.open(o); return '<button class="tile' + (cur === o ? ' sel' : '') + (ok ? '' : ' locked') + (o.boss ? ' boss' : '') + '" data-op="' + o.id + '"><b>' + (OPS.indexOf(o) + 1) + '. ' + o.name + '</b><small>' + MAPS[o.map].name + '</small>' + (ok ? star(sv.ops[o.id] || 0) : '<span class="lock">LOCKED</span>') + '</button>'; }).join('') + '</div>').join('') + (sv.ops.t0 ? '<div class="h3">Again, if you like</div>' + tr : '') + '</div>' +
        '<div class="detail" style="flex:1 1 320px"><small style="letter-spacing:.2em;color:var(--ember2)">' + CHAPTERS[cur.ch].name + ' &middot; ' + MAPS[cur.map].name + ' &middot; ' + DIFFS[cur.diff].name + '</small><h3>' + cur.name + '</h3><p class="brief">&ldquo;' + esc(cur.brief) + '&rdquo;</p>' +
        '<div class="h3">Objectives</div><ol class="objs">' + cur.stages.map(s => '<li>' + STAGE_NAME[s[0]] + (typeof s[1] === 'number' ? ' <b>' + (s[0] === 'hold' || s[0] === 'defend' ? s[1] + ' s' : '&times;' + s[1]) + '</b>' : s[1] && FOES[s[1]] ? ' <b>' + FOES[s[1]].name + '</b>' : '') + '</li>').join('') + '</ol>' +
        '<div class="h3">Stars</div><p style="font-size:13px;color:#b9b2a6;margin:0 0 6px">&#9733; finish it &nbsp; &#9733; inside ' + Math.floor(cur.par / 60) + ':' + String(cur.par % 60).padStart(2, '0') + ' &nbsp; &#9733; never below 35 health</p><p style="font-size:13px;color:#b9b2a6">Pays <b style="color:var(--ember2)">' + Ops.pay(cur) + ' credits</b> the first time, a quarter after that.</p>' +
        '<div class="h3">Who you are</div><div class="seg">' + Object.keys(CLASSES).map(id => '<button data-cls="' + id + '" class="' + (UI.setup.cls === id ? 'on' : '') + '"' + (Save.rank().index < CLASSES[id].rank ? ' disabled' : '') + '>' + CLASSES[id].name + '</button>').join('') + '</div>' + Extras.perksHTML(UI.setup.cls) +
        '<div style="text-align:right;margin-top:16px"><button class="btn go" data-go="op"' + (open ? '' : ' disabled') + '>' + (open ? 'DEPLOY' : 'LOCKED') + '</button></div></div></div>';
};
document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.op) { Ops.sel = b.dataset.op; Snd.ui('click'); UI.draw(); }
    else if (b.dataset.go === 'op') { const op = Ops.by(Ops.sel); if (op && Ops.open(op)) { Snd.ui('click'); UI.play({ map: HAVE[MAPS[op.map].file] === true ? op.map : 'yard', diff: op.diff, cls: UI.setup.cls, rule: 'rush', op: op.id }); } }
});
