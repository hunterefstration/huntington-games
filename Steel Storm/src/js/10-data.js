// ============================================================
// VEHICLES + RESEARCH TREE (2.0). 3 domains (ground / air / naval), several branches each, tiers I-V, 69 vehicles.
// hp, ar (armor: damage / (1 + ar/100)), sp (top speed u/s), tn (hull turn rad/s), tt (turret rad/s)
// w1 main, w2 secondary, w3 extra (bombs / torpedoes / missiles). k = shell | bullet | rocket | bomb | missile | torp.
// pierce = share of armor ignored. prox = flak burst radius against aircraft. Ids of the 1.x vehicles never change (saves use them).
// ============================================================
const LINES = { g: { name: 'Ground', tag: 'TANKS', col: '#9bc44a' }, a: { name: 'Air', tag: 'AIRCRAFT', col: '#58b8ff' }, n: { name: 'Naval', tag: 'WARSHIPS', col: '#3ad0c4' } };
const BRANCHES = {
    g: [['lt', 'Light tanks'], ['mt', 'Medium tanks'], ['ht', 'Heavy tanks'], ['td', 'Tank destroyers'], ['spaa', 'Anti-air'], ['arty', 'Artillery']],
    a: [['ftr', 'Fighters'], ['atk', 'Attackers'], ['bmb', 'Bombers'], ['heli', 'Helicopters']],
    n: [['pb', 'Patrol boats'], ['dd', 'Destroyers'], ['cl', 'Cruisers'], ['bb', 'Battleships'], ['ss', 'Submarines']]
};
const CLS_NAME = {}; for (const ln in BRANCHES) for (const [k, n] of BRANCHES[ln]) CLS_NAME[k] = n.replace(/s$/, '').replace(/ie$/, 'y');
const RP_COST = [0, 0, 350, 1100, 3000, 6500], CR_COST = [0, 0, 1800, 6500, 22000, 48000];
const COL = { OL: 0x5b6b3a, OL2: 0x76874a, TN: 0xa89463, TN2: 0xc2ad74, GR: 0x66707a, GR2: 0x8893a0, DK: 0x3a3d44, DK2: 0x50555e, NV: 0x3b4d6b, RD: 0x8a3b2f, WH: 0xdfe3e8, SD: 0xc2a35a, BL: 0x2e6fa8 };
const VEHS = [];
const W = {      // weapon factories
    cannon: (dmg, rl, v) => ({ n: 'Cannon', k: 'shell', dmg, rl, v, sp: 2 + dmg / 35, life: 4, g: 14, snd: dmg > 120 ? 'heavy' : 'cannon' }),
    mg: t => ({ n: 'Machine gun', k: 'bullet', dmg: 2 + t * 1.2, rl: 0.1, v: 430, life: 0.9, g: 3, sprd: 0.02 }),
    flak: (dmg, rl, v, prox) => ({ n: 'Autocannon', k: 'bullet', dmg, rl, v, life: 1.7, g: 4, sprd: 0.01, prox }),
    how: (dmg, rl, v) => ({ n: 'Howitzer', k: 'shell', dmg, rl, v, sp: 6 + dmg / 45, life: 14, g: 14, arty: 1, snd: 'heavy', spread: 0.012 }),
    atgm: (cnt, dmg, rl) => ({ n: 'ATGM', k: 'missile', dmg, cnt: cnt || 0, rl: rl || 1.4, rel: 26, v: 120, life: 7, turn: 1.7, g: 0, sp: 3.5, pierce: 0.6 }),
    sam: (cnt, dmg) => ({ n: 'SAM', k: 'missile', dmg, cnt, rl: 1, rel: 24, v: 230, life: 6, turn: 3.2, g: 0, sp: 6, air: 1 }),
    aam: (cnt, dmg) => ({ n: 'Missiles', k: 'missile', dmg, cnt, rl: 0.9, rel: 30, v: 270, life: 5, turn: 3.4, g: 0, sp: 6, air: 1 }),
    ashm: (cnt, dmg) => ({ n: 'Anti-ship missiles', k: 'missile', dmg, cnt, rl: 1.5, rel: 40, v: 160, life: 9, turn: 1.4, g: 0, sp: 8, pierce: 0.5, sea: 1 }),
    torp: (cnt, dmg) => ({ n: 'Torpedoes', k: 'torp', dmg, cnt, rl: 1.1, rel: 30, v: 46, life: 14, g: 0, sp: 7, pierce: 0.5 }),
    rockets: (cnt, dmg) => ({ n: 'Rockets', k: 'rocket', dmg, cnt, rl: 0.4, rel: 22, v: 340, sp: 7, life: 3.2, g: 3, pierce: 0.4 }),
    bombs: (cnt, dmg, r) => ({ n: 'Bombs', k: 'bomb', dmg, cnt, rl: 0.6, rel: 40, sp: r, life: 12, g: 20, pierce: 0.7 }),
    guns: (dmg, rl) => ({ n: 'Cannons', k: 'bullet', dmg, rl, v: 560, life: 0.85, g: 2, sprd: 0.012 })
};
const EL = { lt: .5, mt: .5, ht: .45, td: .4, spaa: 1.35, arty: 1.15 };
// ground: o = {id,t,n,req,cls,hp,ar,sp,tt,dmg,rl,v,m,desc, w1?,w2?,w3?}
function G(o) {
    const m = o.m;
    const v = Object.assign({ ln: 'g', tn: 2.1 - o.t * 0.12, r: Math.max(m.hull[0], m.hull[2] * 0.5) * 0.6 + 0.8, cd: 15 + m.hull[2] * 0.6, el: EL[o.cls] || .5 }, o);
    v.w1 = o.w1 || (o.cls === 'spaa' ? W.flak(o.dmg, o.rl, o.v, o.prox || 5) : o.cls === 'arty' ? W.how(o.dmg, o.rl, o.v) : W.cannon(o.dmg, o.rl, o.v));
    v.w2 = o.w2 === null ? undefined : (o.w2 || W.mg(o.t));
    VEHS.push(v);
}
// air: o = {id,t,n,req,cls,hp,ar,minSp,sp,turn,gd,grl,rk,bm,ms,m,desc}
function A(o) {
    const m = o.m, heli = o.cls === 'heli';
    const v = Object.assign({ ln: 'a', r: heli ? 2.4 + m.len * .12 : 2.6 + m.len * 0.12, cd: heli ? 16 + m.len * .6 : 20 + m.len * 0.6, heli }, o);
    v.w1 = heli ? Object.assign(W.guns(o.gd, o.grl), { n: 'Chin gun', v: 520, life: 1.3, g: 4, sprd: .01 }) : W.guns(o.gd, o.grl);
    if (o.ms && o.cls !== 'heli') v.w2 = W.aam(o.ms[0], o.ms[1]); else if (o.rk) v.w2 = W.rockets(o.rk[0], o.rk[1]);
    if (o.bm) v.w3 = W.bombs(o.bm[0], o.bm[1], o.bm[2]); else if (o.ms && heli) v.w3 = W.atgm(o.ms[0], o.ms[1]);
    if (heli) v.minSp = 0;
    VEHS.push(v);
}
// naval: o = {id,t,n,req,cls,hp,ar,sp,tn,dmg,rl,salvo,v,tp,m,desc}
function N(o) {
    const m = o.m;
    const v = Object.assign({ ln: 'n', tt: 0.55 - o.t * 0.04, r: m.w * 0.5 + m.len * 0.2, cd: 28 + m.len * 0.9, el: .75, sub: o.cls === 'ss' }, o);
    v.w1 = o.w1 || { n: o.cls === 'ss' ? 'Deck gun' : 'Main guns', k: 'shell', dmg: o.dmg, rl: o.rl, v: o.v, nn: o.salvo || 1, spread: 0.014, sp: 5 + o.dmg / 28, life: 6, g: 22, snd: o.dmg > 150 ? 'heavy' : 'cannon' };
    v.w2 = o.w2 === null ? undefined : (o.w2 || { n: 'Secondary guns', k: 'bullet', dmg: 4 + o.t * 2.5, rl: 0.12, v: 400, life: 0.9, g: 5, sprd: 0.03 });
    if (o.tp) v.w3 = W.torp(o.tp[0], o.tp[1]); else if (o.ms) v.w3 = W.ashm(o.ms[0], o.ms[1]);
    VEHS.push(v);
}
const SHIP = [0x7d8791, 0x5a636d], SHIP2 = [0x6c7b8a, 0x4d5a68], SHIP3 = [0x5f6f82, 0x44505f], SHIP4 = [0x4f5f70, 0x38444f];
// ===================== GROUND =====================
// m: hull [w,h,l], tur [w,h,l], tz turret z, gun [length, radius, barrels], ty turret type (box cast wedge cas aa arty ml open), wh road wheels,
//    f flags: sk skirts, ret return rollers, cup cupola, mz muzzle brake, fume bore evacuator, era reactive blocks, ml missile tubes,
//    rad radar dish, spade recoil spade, bins stowage, exh exhausts, ant antenna, wl wheeled (8x8)
G({ id: 'g1a', t: 1, cls: 'lt', n: 'M-1 Scout', req: null, hp: 140, ar: 8, sp: 17, tt: 2.6, dmg: 38, rl: 1.5, v: 290, m: { hull: [3, .9, 5], tur: [1.9, .8, 2.2], tz: -.2, gun: [3.2, .14, 1], ty: 'box', wh: 4, f: 'ret cup ant exh', c: [COL.OL, COL.OL2] }, desc: 'Fast light tank. Weak armor, quick gun.' });
G({ id: 'g1b', t: 1, cls: 'mt', n: 'Bruiser', req: null, hp: 200, ar: 20, sp: 12, tt: 2.2, dmg: 55, rl: 2.4, v: 280, m: { hull: [3.6, 1.1, 5.8], tur: [2.4, 1, 2.8], tz: -.3, gun: [3.8, .18, 1], ty: 'cast', wh: 5, f: 'cup exh bins', c: [COL.OL, COL.OL2] }, desc: 'Sturdy medium tank with a cast turret. A good all-rounder.' });
G({ id: 'g2a', t: 2, cls: 'lt', n: 'Hornet', req: 'g1a', hp: 180, ar: 10, sp: 19, tt: 2.8, dmg: 26, rl: .85, v: 330, m: { hull: [3, .9, 5.4], tur: [1.7, .9, 2], tz: 0, gun: [3, .12, 2], ty: 'wedge', wh: 5, f: 'ret ant', c: [COL.TN, COL.TN2] }, desc: 'Twin autocannons: a storm of small shells.' });
G({ id: 'g2b', t: 2, cls: 'mt', n: 'Warhammer', req: 'g1b', hp: 280, ar: 35, sp: 13, tt: 2.2, dmg: 80, rl: 2.8, v: 300, m: { hull: [3.8, 1.2, 6.2], tur: [2.6, 1.1, 3], tz: -.3, gun: [4.4, .2, 1], ty: 'box', wh: 6, f: 'sk cup mz bins exh', c: [COL.TN, COL.TN2] }, desc: 'Armored medium tank with a hard-hitting gun.' });
G({ id: 'g2c', t: 2, cls: 'td', n: 'Stalker TD', req: 'g1b', hp: 240, ar: 45, sp: 11, tt: 1.4, dmg: 120, rl: 4, v: 340, m: { hull: [3.6, 1.1, 6.4], tur: [3.2, 1, 4.2], tz: -.8, gun: [5.2, .2, 1], ty: 'cas', wh: 6, f: 'mz exh', c: [COL.TN2, COL.TN] }, desc: 'Casemate tank destroyer. Slow traverse, big punch.' });
G({ id: 'g3a', t: 3, cls: 'lt', n: 'Viper', req: 'g2a', hp: 260, ar: 25, sp: 18, tt: 2.8, dmg: 70, rl: 2, v: 350, m: { hull: [3.2, 1, 6], tur: [2, .9, 2.6], tz: -.2, gun: [4.6, .17, 1], ty: 'cast', wh: 5, f: 'ret mz fume ant', c: [COL.GR, COL.GR2] }, desc: 'Fast hunter with a long gun.' });
G({ id: 'g3b', t: 3, cls: 'ht', n: 'Bastion', req: 'g2b', hp: 480, ar: 80, sp: 9, tt: 1.8, dmg: 110, rl: 3.4, v: 320, m: { hull: [4.6, 1.5, 6.8], tur: [3.4, 1.4, 3.6], tz: -.4, gun: [4.8, .26, 1], ty: 'cast', wh: 7, f: 'sk cup mz exh', c: [COL.GR, COL.GR2] }, desc: 'Heavy tank. Thick plates, slow.' });
G({ id: 'g3c', t: 3, cls: 'td', n: 'Longbow', req: 'g2c', hp: 300, ar: 55, sp: 10, tt: 1.3, dmg: 170, rl: 5, v: 400, m: { hull: [3.8, 1.2, 7.2], tur: [3.4, 1.1, 4.6], tz: -1, gun: [6.6, .22, 1], ty: 'cas', wh: 7, f: 'mz fume', c: [COL.GR2, COL.GR] }, desc: 'Long-range casemate tank destroyer.' });
G({ id: 'g4a', t: 4, cls: 'ht', n: 'Colossus', req: 'g3b', hp: 750, ar: 120, sp: 8, tt: 1.7, dmg: 90, rl: 3.4, v: 330, m: { hull: [5.4, 1.8, 8.2], tur: [4.2, 1.6, 4.4], tz: -.5, gun: [5.6, .26, 2], ty: 'box', wh: 8, f: 'sk cup mz exh bins ant', c: [COL.DK, COL.DK2] }, desc: 'Super-heavy twin-gun fortress.' });
G({ id: 'g4b', t: 4, cls: 'mt', n: 'Ghost', req: 'g3a', hp: 420, ar: 70, sp: 20, tt: 3, dmg: 105, rl: 2.2, v: 420, m: { hull: [3.6, 1, 6.6], tur: [2.4, .9, 3.2], tz: -.3, gun: [5.4, .18, 1], ty: 'wedge', wh: 6, f: 'sk fume era ant bins', c: [COL.DK2, COL.NV] }, desc: 'Fast modern battle tank with reactive armour.' });
G({ id: 'g4c', t: 4, cls: 'lt', n: 'Wasp IFV', req: 'g3a', hp: 300, ar: 30, sp: 24, tt: 3.2, dmg: 34, rl: .55, v: 480, w3: W.atgm(4, 170), m: { hull: [3.2, 1.3, 7], tur: [1.8, .7, 2], tz: -.6, gun: [3.4, .1, 1], ty: 'wedge', wh: 4, f: 'wl ml ant', c: [COL.OL2, COL.OL] }, desc: '8x8 wheeled fighting vehicle: rapid autocannon plus 4 guided anti-tank missiles (B).' });
G({ id: 'g5a', t: 5, cls: 'lt', n: 'Phantom LT', req: 'g4c', hp: 460, ar: 70, sp: 23, tt: 3.2, dmg: 110, rl: 2.1, v: 450, m: { hull: [3.4, 1, 6.6], tur: [2.2, .85, 2.8], tz: -.3, gun: [5, .16, 1], ty: 'wedge', wh: 6, f: 'ret sk fume era ant', c: [COL.DK2, COL.GR] }, desc: 'Top light tank: very fast, modern sights, long gun.' });
G({ id: 'g3d', t: 3, cls: 'mt', n: 'Ranger', req: 'g2b', hp: 330, ar: 50, sp: 15, tt: 2.4, dmg: 95, rl: 2.6, v: 360, m: { hull: [3.7, 1.15, 6.4], tur: [2.5, 1.05, 3], tz: -.3, gun: [4.8, .19, 1], ty: 'cast', wh: 5, f: 'sk cup mz fume bins exh', c: [COL.OL, COL.TN] }, desc: 'Balanced medium tank with a fume-extractor gun.' });
G({ id: 'g5b', t: 5, cls: 'mt', n: 'Paladin MBT', req: 'g4b', hp: 560, ar: 110, sp: 18, tt: 2.8, dmg: 140, rl: 2.4, v: 470, m: { hull: [3.8, 1.05, 7], tur: [2.8, .95, 3.6], tz: -.4, gun: [5.8, .2, 1], ty: 'wedge', wh: 7, f: 'sk fume era ant bins exh', c: [COL.DK, COL.DK2] }, desc: 'Main battle tank: wedge armour, stabilised smoothbore.' });
G({ id: 'g2e', t: 2, cls: 'ht', n: 'Rhino', req: 'g1b', hp: 340, ar: 55, sp: 10, tt: 1.8, dmg: 90, rl: 3.2, v: 290, m: { hull: [4.2, 1.4, 6.2], tur: [3, 1.3, 3.2], tz: -.4, gun: [4, .22, 1], ty: 'box', wh: 6, f: 'cup exh bins', c: [COL.OL, COL.DK2] }, desc: 'First heavy tank: a riveted box on tracks.' });
G({ id: 'g5c', t: 5, cls: 'ht', n: 'Behemoth', req: 'g4a', hp: 900, ar: 160, sp: 9, tt: 1.6, dmg: 200, rl: 3.8, v: 400, m: { hull: [5.2, 1.7, 8.4], tur: [4, 1.5, 4.6], tz: -.6, gun: [6.4, .28, 1], ty: 'cast', wh: 8, f: 'sk cup mz fume exh bins ant', c: [COL.DK, COL.GR] }, desc: 'The heaviest tank there is. One huge gun.' });
G({ id: 'g4d', t: 4, cls: 'td', n: 'Reaper', req: 'g3c', hp: 480, ar: 100, sp: 11, tt: 1.2, dmg: 230, rl: 5, v: 440, m: { hull: [4.2, 1.2, 7.6], tur: [3.8, 1.2, 4.8], tz: -1.2, gun: [7.2, .25, 1], ty: 'cas', wh: 7, f: 'sk mz fume exh', c: [COL.GR, COL.DK2] }, desc: 'Armoured casemate with a very long gun.' });
G({ id: 'g5d', t: 5, cls: 'td', n: 'Striker', req: 'g4d', hp: 420, ar: 60, sp: 20, tt: 2.4, w1: Object.assign(W.atgm(0, 250, 3.2), { n: 'Missile launcher', v: 150, turn: 2 }), m: { hull: [3.4, 1.3, 6.8], tur: [2.2, .8, 2.4], tz: -.8, gun: [1.4, .1, 1], ty: 'ml', wh: 4, f: 'wl ant', c: [COL.TN, COL.TN2] }, desc: 'Wheeled missile tank destroyer: guided missiles that steer to the target under your reticle.' });
G({ id: 'g2f', t: 2, cls: 'spaa', n: 'Flak Hound', req: 'g1a', hp: 200, ar: 10, sp: 16, tt: 3.2, dmg: 9, rl: .12, v: 520, prox: 5, m: { hull: [3, .9, 5.2], tur: [2, .6, 2], tz: -.3, gun: [2.6, .08, 2], ty: 'aa', wh: 5, f: 'ret', c: [COL.OL2, COL.TN] }, desc: 'Open-top anti-air: twin flak guns burst near aircraft.' });
G({ id: 'g3e', t: 3, cls: 'spaa', n: 'Quadra', req: 'g2f', hp: 280, ar: 25, sp: 15, tt: 3.2, dmg: 10, rl: .08, v: 560, prox: 6, m: { hull: [3.4, 1, 6], tur: [2.4, .8, 2.4], tz: -.4, gun: [2.8, .08, 4], ty: 'aa', wh: 6, f: 'sk exh', c: [COL.GR, COL.OL2] }, desc: 'Four-barrel flak: a wall of shells in the sky.' });
G({ id: 'g4e', t: 4, cls: 'spaa', n: 'Skyguard', req: 'g3e', hp: 360, ar: 40, sp: 16, tt: 3.4, dmg: 22, rl: .11, v: 700, prox: 7, m: { hull: [3.6, 1.1, 6.6], tur: [2.8, 1.2, 3], tz: -.4, gun: [3.6, .11, 2], ty: 'aa', wh: 6, f: 'rad sk exh ant', c: [COL.DK2, COL.GR] }, desc: 'Radar anti-air with twin 35 mm cannons.' });
G({ id: 'g5e', t: 5, cls: 'spaa', n: 'Sentry SAM', req: 'g4e', hp: 420, ar: 50, sp: 17, tt: 3.6, dmg: 24, rl: .1, v: 760, prox: 8, w3: W.sam(6, 190), m: { hull: [3.6, 1.1, 6.8], tur: [2.6, 1, 2.8], tz: -.4, gun: [3.4, .1, 2], ty: 'aa', wh: 6, f: 'rad ml sk ant', c: [COL.DK, COL.GR2] }, desc: 'Cannons plus 6 radar-guided missiles (B) that chase aircraft.' });
G({ id: 'g3f', t: 3, cls: 'arty', n: 'Mortar Carriage', req: 'g2b', hp: 300, ar: 25, sp: 12, tt: 1.6, dmg: 220, rl: 7, v: 170, m: { hull: [3.6, 1.1, 6], tur: [3, 1.4, 3.4], tz: -1.2, gun: [3.6, .3, 1], ty: 'arty', wh: 6, f: 'spade exh', c: [COL.OL, COL.OL2] }, desc: 'Artillery: lobs heavy shells far over hills. Aim at the ground.' });
G({ id: 'g4f', t: 4, cls: 'arty', n: 'Howler SPG', req: 'g3f', hp: 380, ar: 35, sp: 13, tt: 1.6, dmg: 280, rl: 7.5, v: 200, m: { hull: [3.8, 1.2, 7], tur: [3.4, 1.6, 3.8], tz: -1.4, gun: [5.6, .24, 1], ty: 'arty', wh: 7, f: 'spade mz fume exh', c: [COL.TN, COL.OL] }, desc: 'Self-propelled howitzer with a long reach.' });
G({ id: 'g5f', t: 5, cls: 'arty', n: 'Thunderclap', req: 'g4f', hp: 460, ar: 45, sp: 14, tt: 1.7, dmg: 340, rl: 8, v: 230, m: { hull: [4, 1.3, 7.8], tur: [3.8, 1.7, 4.2], tz: -1.6, gun: [6.8, .26, 1], ty: 'arty', wh: 7, f: 'spade mz fume exh ant sk', c: [COL.DK2, COL.DK] }, desc: 'Modern artillery: the biggest shells on land.' });
// ===================== AIR =====================
// m: k prop|jet|bomber|heavy|delta|atk|stealth|wing|heli, len, span (rotor diameter for helis), sweep, f flags:
//    low/mid/high wing, bubble/framed canopy, glassnose, twin (twin tail), twintail (bomber twin fins), tip tanks, nose intake,
//    side intakes, canard, canted, gear, big, eng4, twinpod, scout, tandem, stubs, coax
A({ id: 'a1a', t: 1, cls: 'ftr', n: 'Sparrow', req: null, hp: 70, ar: 0, minSp: 42, sp: 82, turn: 1.7, gd: 4, grl: .06, m: { k: 'prop', len: 7, span: 9, f: 'low bubble', c: [COL.SD, COL.RD] }, desc: 'Nimble propeller fighter.' });
A({ id: 'a1b', t: 1, cls: 'atk', n: 'Mule', req: null, hp: 90, ar: 3, minSp: 38, sp: 70, turn: 1.3, gd: 3.5, grl: .08, bm: [2, 160, 14], m: { k: 'prop', len: 8, span: 11, f: 'low framed gear belly', c: [COL.OL, COL.OL2] }, desc: 'Light attack plane with 2 bombs.' });
A({ id: 'a2a', t: 2, cls: 'ftr', n: 'Falcon', req: 'a1a', hp: 85, ar: 0, minSp: 48, sp: 98, turn: 1.9, gd: 5, grl: .05, rk: [4, 60], m: { k: 'prop', len: 8.6, span: 9.5, f: 'mid bubble long', c: [COL.GR2, COL.NV] }, desc: 'Fast long-nosed fighter with rockets.' });
A({ id: 'a2b', t: 2, cls: 'ftr', n: 'Hawk J1', req: 'a1a', hp: 100, ar: 2, minSp: 55, sp: 112, turn: 1.7, gd: 6, grl: .06, rk: [4, 60], m: { k: 'jet', len: 9, span: 10, sweep: 0.08, f: 'mid tip side', c: [COL.GR2, COL.DK] }, desc: 'First jet. Straight wings with tip tanks.' });
A({ id: 'a2c', t: 2, cls: 'bmb', n: 'Stormer', req: 'a1b', hp: 160, ar: 8, minSp: 38, sp: 68, turn: 1, gd: 4, grl: .09, bm: [4, 200, 16], m: { k: 'bomber', len: 12, span: 17, f: 'mid glassnose twintail', c: [COL.OL, COL.DK] }, desc: 'Twin-engine bomber: 4 bombs.' });
A({ id: 'a3a', t: 3, cls: 'ftr', n: 'Lancer', req: 'a2b', hp: 130, ar: 4, minSp: 60, sp: 128, turn: 1.8, gd: 7, grl: .05, rk: [6, 70], m: { k: 'jet', len: 12, span: 11, sweep: 0.5, f: 'mid nose', c: [COL.GR, COL.NV] }, desc: 'Swept-wing jet fighter with a nose intake.' });
A({ id: 'a3b', t: 3, cls: 'bmb', n: 'Anvil', req: 'a2c', hp: 240, ar: 14, minSp: 48, sp: 100, turn: 1.1, gd: 6, grl: .07, rk: [4, 70], bm: [6, 240, 18], m: { k: 'heavy', len: 15, span: 16, sweep: .3, f: 'high glassnose', c: [COL.DK2, COL.GR] }, desc: 'Heavy jet bomber, 6 big bombs.' });
A({ id: 'a3c', t: 3, cls: 'ftr', n: 'Wraith', req: 'a2a', hp: 110, ar: 3, minSp: 66, sp: 152, turn: 2, gd: 8, grl: .045, rk: [6, 70], m: { k: 'delta', len: 11, span: 10, f: 'side', c: [COL.NV, COL.WH] }, desc: 'Delta-wing interceptor. Very fast.' });
A({ id: 'a4a', t: 4, cls: 'ftr', n: 'Spectre', req: 'a3a', hp: 190, ar: 10, minSp: 70, sp: 168, turn: 2, gd: 9, grl: .04, rk: [10, 80], m: { k: 'jet', len: 14, span: 12, sweep: 0.55, f: 'side twin', c: [COL.DK, COL.BL] }, desc: 'Twin-tail superfighter.' });
A({ id: 'a4b', t: 4, cls: 'atk', n: 'Hammerhead', req: 'a3b', hp: 300, ar: 22, minSp: 55, sp: 138, turn: 1.4, gd: 8, grl: .05, rk: [8, 90], bm: [6, 320, 22], m: { k: 'heavy', len: 16, span: 15, sweep: .4, f: 'side twin', c: [COL.DK2, COL.RD] }, desc: 'Strike jet: rockets and huge bombs.' });
A({ id: 'a4c', t: 4, cls: 'ftr', n: 'Tempest', req: 'a3c', hp: 160, ar: 6, minSp: 68, sp: 162, turn: 2.05, gd: 9, grl: .045, rk: [8, 80], m: { k: 'delta', len: 13, span: 10, f: 'side canard', c: [COL.GR2, COL.WH] }, desc: 'Canard delta: turns tighter than any jet before it.' });
A({ id: 'a5a', t: 5, cls: 'ftr', n: 'Valkyrie', req: 'a4a', hp: 220, ar: 12, minSp: 72, sp: 176, turn: 2.1, gd: 10, grl: .04, ms: [6, 120], m: { k: 'jet', len: 15, span: 12, sweep: 0.6, f: 'side twin canted', c: [COL.GR, COL.DK] }, desc: 'Air superiority fighter with 6 heat-seeking missiles (right click).' });
A({ id: 'a5b', t: 5, cls: 'ftr', n: 'Nighthawk', req: 'a4c', hp: 200, ar: 14, minSp: 70, sp: 170, turn: 2, gd: 10, grl: .045, ms: [4, 140], m: { k: 'stealth', len: 15, span: 13, f: '', c: [COL.DK, COL.DK2] }, desc: 'Faceted stealth fighter with 4 missiles.' });
A({ id: 'a2d', t: 2, cls: 'atk', n: 'Brawler', req: 'a1b', hp: 140, ar: 10, minSp: 40, sp: 76, turn: 1.2, gd: 5, grl: .07, rk: [6, 70], bm: [2, 180, 15], m: { k: 'prop', len: 9.5, span: 13, f: 'low framed gear big', c: [COL.OL2, COL.SD] }, desc: 'Armoured ground-attack plane: rockets and bombs.' });
A({ id: 'a3d', t: 3, cls: 'atk', n: 'Tusker', req: 'a2d', hp: 260, ar: 22, minSp: 45, sp: 105, turn: 1.3, gd: 12, grl: .05, rk: [8, 80], bm: [4, 220, 16], m: { k: 'atk', len: 13, span: 15, f: 'twinpod', c: [COL.GR, COL.GR2] }, desc: 'Straight-wing tank buster with a huge nose cannon.' });
A({ id: 'a4d', t: 4, cls: 'atk', n: 'Gale', req: 'a3d', hp: 280, ar: 22, minSp: 55, sp: 140, turn: 1.45, gd: 10, grl: .05, rk: [8, 90], bm: [6, 260, 18], m: { k: 'jet', len: 14, span: 11, sweep: .65, f: 'side high', c: [COL.TN, COL.DK2] }, desc: 'Swing-wing strike jet.' });
A({ id: 'a4e', t: 4, cls: 'bmb', n: 'Stratos', req: 'a3b', hp: 360, ar: 20, minSp: 50, sp: 120, turn: 1, gd: 7, grl: .06, bm: [8, 300, 22], m: { k: 'heavy', len: 18, span: 20, sweep: .45, f: 'high eng4', c: [COL.WH, COL.GR2] }, desc: 'Four-engine jet bomber: 8 heavy bombs.' });
A({ id: 'a5c', t: 5, cls: 'bmb', n: 'Monolith', req: 'a4e', hp: 420, ar: 26, minSp: 55, sp: 130, turn: 1.05, gd: 8, grl: .06, bm: [10, 340, 24], m: { k: 'wing', len: 12, span: 24, f: '', c: [COL.DK, COL.DK2] }, desc: 'Flying-wing bomber: 10 bombs, hard to catch.' });
A({ id: 'a2e', t: 2, cls: 'heli', n: 'Dragonfly', req: 'a1b', hp: 150, ar: 6, sp: 52, turn: 1.4, gd: 4, grl: .08, rk: [8, 50], m: { k: 'heli', len: 9, span: 9, f: 'scout', c: [COL.OL, COL.OL2] }, desc: 'Scout helicopter. Can hover! W/S fly, A/D strafe, E/Q up/down.' });
A({ id: 'a3e', t: 3, cls: 'heli', n: 'Mantis', req: 'a2e', hp: 220, ar: 14, sp: 58, turn: 1.4, gd: 7, grl: .07, rk: [10, 60], ms: [4, 170], m: { k: 'heli', len: 11, span: 11, f: 'tandem stubs', c: [COL.OL2, COL.TN] }, desc: 'Attack helicopter: chin gun, rockets, 4 guided missiles (B).' });
A({ id: 'a4f', t: 4, cls: 'heli', n: 'Viperfang', req: 'a3e', hp: 280, ar: 20, sp: 64, turn: 1.5, gd: 9, grl: .06, rk: [12, 70], ms: [6, 200], m: { k: 'heli', len: 12.5, span: 12, f: 'tandem stubs', c: [COL.GR, COL.DK2] }, desc: 'Fast gunship with 6 anti-tank missiles.' });
A({ id: 'a5d', t: 5, cls: 'heli', n: 'Typhoon', req: 'a4f', hp: 340, ar: 26, sp: 70, turn: 1.5, gd: 11, grl: .055, rk: [14, 80], ms: [8, 230], m: { k: 'heli', len: 13.5, span: 13, f: 'tandem stubs coax', c: [COL.DK, COL.GR] }, desc: 'Coaxial-rotor heavy gunship.' });
// ===================== NAVAL =====================
// m: k pb|mtb|dd|cl|bb|mon|mod|sub, len, w, h, tur [[z, size, barrels]], br [bridge z, height], fun funnels, tp torpedo tubes shown
N({ id: 'n1a', t: 1, cls: 'pb', n: 'Gull', req: null, hp: 260, ar: 10, sp: 14, tn: .5, dmg: 45, rl: 2.5, salvo: 1, v: 250, m: { k: 'pb', len: 14, w: 3.6, tur: [[3, .9, 1]], br: [-2, 1.2], c: SHIP }, desc: 'Fast patrol boat.' });
N({ id: 'n1b', t: 1, cls: 'pb', n: 'Pike', req: null, hp: 320, ar: 14, sp: 12, tn: .42, dmg: 62, rl: 3, salvo: 1, v: 250, m: { k: 'pb', len: 17, w: 4.2, tur: [[4, 1, 1], [-5, .8, 1]], br: [-1, 1.4], c: SHIP }, desc: 'Gunboat with two turrets.' });
N({ id: 'n2a', t: 2, cls: 'pb', n: 'Marlin', req: 'n1a', hp: 450, ar: 25, sp: 15, tn: .5, dmg: 60, rl: 1.8, salvo: 1, v: 270, m: { k: 'dd', len: 22, w: 4.6, tur: [[6, 1, 1], [-6, 1, 1]], br: [0, 1.6], fun: 1, c: SHIP2 }, desc: 'Quick corvette.' });
N({ id: 'n2b', t: 2, cls: 'dd', n: 'Dagger', req: 'n1b', hp: 600, ar: 30, sp: 13, tn: .42, dmg: 80, rl: 2.8, salvo: 2, v: 270, tp: [2, 260], m: { k: 'dd', len: 28, w: 5, tur: [[8, 1.2, 2], [-7, 1.2, 2]], br: [1, 1.8], fun: 2, tp: 1, c: SHIP2 }, desc: 'Destroyer with twin-barrel turrets and torpedoes (B).' });
N({ id: 'n2c', t: 2, cls: 'bb', n: 'Monitor', req: 'n1b', hp: 650, ar: 45, sp: 6, tn: .3, dmg: 200, rl: 6, salvo: 1, v: 300, m: { k: 'mon', len: 24, w: 8, h: 2.2, tur: [[4, 2.2, 2]], br: [-6, 1.6], c: [0x6a6f55, 0x4a4e3b] }, desc: 'Slow armoured barge with a huge gun.' });
N({ id: 'n3a', t: 3, cls: 'dd', n: 'Sentinel', req: 'n2a', hp: 800, ar: 45, sp: 14, tn: .42, dmg: 85, rl: 2.2, salvo: 2, v: 290, m: { k: 'dd', len: 30, w: 5.4, tur: [[9, 1.2, 2], [0, 1, 1], [-9, 1.2, 2]], br: [3, 2], fun: 2, c: SHIP3 }, desc: 'Fast frigate.' });
N({ id: 'n3b', t: 3, cls: 'cl', n: 'Bulwark', req: 'n2b', hp: 1000, ar: 60, sp: 11, tn: .34, dmg: 115, rl: 3.5, salvo: 3, v: 300, m: { k: 'cl', len: 38, w: 6, tur: [[11, 1.5, 3], [-11, 1.5, 3]], br: [1, 2.4], fun: 2, c: SHIP3 }, desc: 'Cruiser with triple turrets.' });
N({ id: 'n3c', t: 3, cls: 'cl', n: 'Thunder', req: 'n2c', hp: 1200, ar: 70, sp: 9, tn: .3, dmg: 210, rl: 6, salvo: 2, v: 330, m: { k: 'cl', len: 42, w: 6.6, tur: [[13, 1.7, 2], [8, 1.6, 2], [-12, 1.7, 2]], br: [-2, 2.6], fun: 2, c: [0x586a7a, 0x3e4b58] }, desc: 'Heavy cruiser. Hits very hard.' });
N({ id: 'n4a', t: 4, cls: 'bb', n: 'Leviathan', req: 'n3b', hp: 1800, ar: 100, sp: 8.5, tn: .27, dmg: 280, rl: 7, salvo: 3, v: 340, m: { k: 'bb', len: 52, w: 8, tur: [[16, 2, 3], [10, 2, 3], [-14, 2, 3]], br: [0, 3.2], fun: 2, c: SHIP4 }, desc: 'Battleship.' });
N({ id: 'n4b', t: 4, cls: 'bb', n: 'Titan', req: 'n3c', hp: 2400, ar: 130, sp: 7, tn: .24, dmg: 360, rl: 9, salvo: 3, v: 360, m: { k: 'bb', len: 60, w: 9, tur: [[20, 2.2, 3], [13, 2.2, 3], [-14, 2.2, 3], [-22, 2.2, 3]], br: [0, 3.6], fun: 2, c: [0x46535f, 0x333d46] }, desc: 'Super-battleship. A floating fortress.' });
N({ id: 'n2d', t: 2, cls: 'pb', n: 'Barracuda', req: 'n1a', hp: 260, ar: 8, sp: 22, tn: .7, dmg: 30, rl: 1.6, salvo: 1, v: 260, tp: [2, 260], m: { k: 'mtb', len: 15, w: 3.4, tur: [[2, .7, 1]], br: [-1, 1.1], tp: 1, c: [0x6f7a6a, 0x4f5a4a] }, desc: 'Motor torpedo boat: very fast, 2 torpedoes (B).' });
N({ id: 'n3d', t: 3, cls: 'pb', n: 'Stingray', req: 'n2d', hp: 360, ar: 14, sp: 23, tn: .66, dmg: 45, rl: 1.5, salvo: 1, v: 270, tp: [4, 300], m: { k: 'mtb', len: 18, w: 3.8, tur: [[3, .8, 1], [-4.5, .7, 1]], br: [-.5, 1.2], tp: 1, c: SHIP2 }, desc: 'Fast attack craft with 4 torpedoes.' });
N({ id: 'n3e', t: 3, cls: 'dd', n: 'Vanguard', req: 'n2b', hp: 820, ar: 40, sp: 15.5, tn: .45, dmg: 85, rl: 2.4, salvo: 2, v: 290, tp: [4, 320], m: { k: 'dd', len: 32, w: 5.2, tur: [[10, 1.2, 2], [5, 1.1, 2], [-10, 1.2, 2]], br: [2, 2], fun: 2, tp: 1, c: SHIP3 }, desc: 'Fleet destroyer: three turrets, 4 torpedoes.' });
N({ id: 'n4c', t: 4, cls: 'dd', n: 'Corsair', req: 'n3e', hp: 1100, ar: 55, sp: 16, tn: .44, dmg: 100, rl: 2.4, salvo: 2, v: 310, tp: [6, 360], m: { k: 'dd', len: 36, w: 5.6, tur: [[12, 1.3, 2], [7, 1.2, 2], [-11, 1.3, 2], [-6, 1.2, 2]], br: [2.5, 2.2], fun: 2, tp: 1, c: SHIP4 }, desc: 'Large destroyer with 6 torpedoes.' });
N({ id: 'n5a', t: 5, cls: 'dd', n: 'Aegis', req: 'n4c', hp: 1500, ar: 70, sp: 17, tn: .44, dmg: 120, rl: 2, salvo: 1, v: 380, ms: [8, 380], w2: { n: 'CIWS', k: 'bullet', dmg: 14, rl: .06, v: 620, life: 1.4, g: 3, sprd: .012, prox: 6 }, m: { k: 'mod', len: 40, w: 6, tur: [[14, 1.3, 1]], br: [4, 3.2], c: [0x7a848e, 0x5a646e] }, desc: 'Missile destroyer: 8 anti-ship missiles (B) and a CIWS that shreds aircraft.' });
N({ id: 'n4d', t: 4, cls: 'cl', n: 'Sovereign', req: 'n3b', hp: 1600, ar: 85, sp: 12, tn: .32, dmg: 140, rl: 3.4, salvo: 3, v: 330, m: { k: 'cl', len: 46, w: 7, tur: [[15, 1.7, 3], [9, 1.6, 3], [-14, 1.7, 3], [-20, 1.6, 3]], br: [1, 2.8], fun: 2, c: SHIP4 }, desc: 'Big cruiser: four triple turrets.' });
N({ id: 'n5b', t: 5, cls: 'cl', n: 'Dominion', req: 'n4d', hp: 2100, ar: 110, sp: 12.5, tn: .32, dmg: 170, rl: 3.4, salvo: 3, v: 360, ms: [4, 360], m: { k: 'cl', len: 52, w: 7.6, tur: [[18, 1.8, 3], [11, 1.8, 3], [-15, 1.8, 3], [-22, 1.8, 3]], br: [1, 3], fun: 1, c: [0x56606a, 0x3a444e] }, desc: 'Missile cruiser: heavy guns plus 4 anti-ship missiles.' });
N({ id: 'n5c', t: 5, cls: 'bb', n: 'Juggernaut', req: 'n4b', hp: 3200, ar: 160, sp: 7.5, tn: .23, dmg: 420, rl: 9.5, salvo: 3, v: 380, m: { k: 'bb', len: 68, w: 10, tur: [[23, 2.5, 3], [15, 2.5, 3], [-18, 2.5, 3], [-26, 2.5, 3]], br: [0, 4], fun: 1, c: [0x3f4a55, 0x2c343c] }, desc: 'The largest battleship afloat.' });
N({ id: 'n2e', t: 2, cls: 'ss', n: 'Eel', req: 'n1b', hp: 300, ar: 8, sp: 12, tn: .5, dmg: 30, rl: 2, salvo: 1, v: 240, tp: [4, 280], w2: null, m: { k: 'sub', len: 20, w: 2.6, tur: [[3.5, .6, 1]], c: [0x3e4650, 0x2a3038] }, desc: 'Submarine: C to dive (hidden, only torpedoes hit you), B torpedoes.' });
N({ id: 'n3f', t: 3, cls: 'ss', n: 'Narwhal', req: 'n2e', hp: 420, ar: 14, sp: 13, tn: .5, dmg: 38, rl: 2, salvo: 1, v: 250, tp: [6, 320], w2: null, m: { k: 'sub', len: 24, w: 3, tur: [[4.5, .7, 1]], c: [0x38404a, 0x262c33] }, desc: 'Ocean-going submarine with 6 torpedoes.' });
N({ id: 'n4e', t: 4, cls: 'ss', n: 'Kraken', req: 'n3f', hp: 560, ar: 20, sp: 14, tn: .48, dmg: 45, rl: 2.2, salvo: 1, v: 260, tp: [6, 380], w2: null, m: { k: 'sub', len: 30, w: 3.6, tur: [[6, .8, 1]], c: [0x30373f, 0x20252b] }, desc: 'Fast attack submarine.' });
N({ id: 'n5d', t: 5, cls: 'ss', n: 'Abyss', req: 'n4e', hp: 720, ar: 28, sp: 15, tn: .46, dmg: 50, rl: 2.2, salvo: 1, v: 270, tp: [8, 440], w2: null, m: { k: 'sub', len: 36, w: 4.2, tur: [], c: [0x262b31, 0x181c20] }, w1: { n: 'Sub missiles', k: 'missile', dmg: 160, rl: 4, v: 160, life: 8, turn: 1.4, g: 0, sp: 6, sea: 1 }, desc: 'Nuclear submarine: 8 torpedoes and guided missiles (surfaced).' });
// balance pass: jets are made of paper next to their guns, so they get a lot more hit points; tanks a little more.
const HPK = { g: 1.6, a: 2.4, n: 1.5 };
VEHS.forEach(v => { v.hp = Math.round(v.hp * HPK[v.ln]); });
const BR_ADJ = { lt: 0, mt: 0, ht: .3, td: .2, spaa: -.2, arty: 0, ftr: 0, atk: -.1, bmb: .1, heli: 0, pb: -.2, dd: 0, cl: .2, bb: .4, ss: .1 };
const VBY = {};
function calcDps(v) { let dps = 0; for (const k of ['w1', 'w2', 'w3']) { const w = v[k]; if (w) dps += w.dmg * (w.nn || 1) / Math.max(0.04, w.rl) * (w.sp ? 1.6 : 1); } return dps; }
VEHS.forEach((v, i) => {
    v.i = i; VBY[v.id] = v;
    const idx = VEHS.filter(o => o.ln === v.ln && o.t === v.t).indexOf(v);
    v.rp = v.t === 1 ? 0 : Math.round(RP_COST[v.t] * (1 + idx * 0.04) / 10) * 10;
    v.cost = v.t === 1 ? 0 : Math.round(CR_COST[v.t] * (1 + idx * 0.04) / 50) * 50;
    v.br = Math.round((v.t + (BR_ADJ[v.cls] || 0) + (VEHS.filter(o => o.ln === v.ln && o.t === v.t && o.cls === v.cls).indexOf(v)) * .3) * 10) / 10;
    v.maxDps = calcDps(v);      // top damage per second, used by the host to sanity-check hits
});
const TIER_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
const MAX_TIER = 5;
// ---------- modules: 5 per vehicle, researched with RP once you own the vehicle, installed automatically ----------
const MOD_DEFS = {
    g: [['eng', 'Engine', '+15% top speed, quicker turns'], ['arm', 'Armour kit', '+25% armour, +8% hit points (skirts + plates)'], ['gun', 'Gun upgrade', '+12% main weapon damage'], ['ammo', 'AP ammunition', 'Main weapon ignores 30% more armour'], ['stab', 'Stabiliser', 'Turret +25% faster, 60% tighter spread']],
    a: [['eng', 'Engine', '+10% top speed, +8% turn rate'], ['arm', 'Armour plates', '+12% hit points, +4 armour'], ['gun', 'Gun pods', '+15% gun damage'], ['ord', 'Ordnance racks', '+50% rockets / bombs / missiles'], ['cm', 'Countermeasures', 'Flares (F) that decoy missiles']],
    n: [['eng', 'Turbines', '+12% top speed'], ['arm', 'Belt armour', '+20% armour, +8% hit points'], ['gun', 'Fire control', '-12% main gun reload'], ['ammo', 'AP shells', 'Main guns ignore 30% more armour'], ['radar', 'Radar', '+25% turret speed, spots dived submarines']]
};
const MODS = [], MODBY = {};
const MOD_FRAC = [.25, .3, .35, .25, .3];
VEHS.forEach(v => MOD_DEFS[v.ln].forEach(([k, n, desc], bit) => {
    const m = { id: v.id + '.' + k, v: v.id, k, n, desc, bit, rp: Math.round((v.rp || 250) * MOD_FRAC[bit] / 10) * 10 };
    MODS.push(m); MODBY[m.id] = m; (v.mods = v.mods || []).push(m);
}));
// a vehicle definition with modules applied (cached). def.i / def.id stay the base vehicle's so the network and saves keep working.
const DEFC = {};
function vdef(id, mask) {
    const b = typeof id === 'number' ? VEHS[id] : VBY[id]; if (!b) return VBY.g1a;
    mask = mask | 0; if (!mask) return b;
    const key = b.id + '|' + mask; if (DEFC[key]) return DEFC[key];
    const d = Object.assign({}, b), has = k => { const m = b.mods.find(x => x.k === k); return m && (mask & (1 << m.bit)); };
    for (const s of ['w1', 'w2', 'w3']) if (b[s]) d[s] = Object.assign({}, b[s]);
    d.mask = mask; d.base = b;
    if (has('eng')) { const k = b.ln === 'g' ? 1.15 : b.ln === 'a' ? 1.1 : 1.12; d.sp *= k; if (d.tn) d.tn *= 1.1; if (d.turn) d.turn *= 1.08; }
    if (has('arm')) { if (b.ln === 'a') { d.hp = Math.round(d.hp * 1.12); d.ar += 4; } else { d.ar = Math.round(d.ar * (b.ln === 'g' ? 1.25 : 1.2)); d.hp = Math.round(d.hp * 1.08); } d.kit = true; }
    if (has('gun')) { if (b.ln === 'n') d.w1.rl *= .88; else d.w1.dmg = Math.round(d.w1.dmg * (b.ln === 'a' ? 1.15 : 1.12) * 10) / 10; }
    if (has('ammo')) d.w1.pierce = (d.w1.pierce || 0) + .3;
    if (has('stab')) { d.tt *= 1.25; d.w1.spread = (d.w1.spread || .004) * .4; d.stab = true; }
    if (has('ord')) for (const s of ['w2', 'w3']) if (d[s] && d[s].cnt) d[s].cnt = Math.ceil(d[s].cnt * 1.5);
    if (has('cm')) d.flares = true;
    if (has('radar')) { d.tt *= 1.25; d.radar = true; }
    d.maxDps = calcDps(d);
    return DEFC[key] = d;
}
function modMask(id) { const v = VBY[id]; if (!v || !save) return 0; let m = 0; for (const x of v.mods) if (save.mods[x.id]) m |= 1 << x.bit; return m; }
const popc = m => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
function brOf(d) { return Math.round(((d.base || d).br + popc(d.mask || 0) * .1) * 10) / 10; }
function vStats(v) {
    const w = v.w1, s = [['Class', CLS_NAME[v.cls] || ''], ['Battle rating', brOf(v).toFixed(1)], ['Hit points', v.hp], ['Armor', v.ar], ['Top speed', Math.round(v.sp * 3.6) + ' km/h']];
    s.push([w.n, w.dmg + (w.nn > 1 ? ' x' + w.nn : '') + ' dmg']);
    if (w.k === 'bullet') s.push(['Rate of fire', Math.round(1 / w.rl) + '/s']); else s.push(['Reload', (w.rl).toFixed(1) + ' s']);
    for (const k of ['w2', 'w3']) { const x = v[k]; if (x && x.cnt) s.push([x.n, x.cnt + ' x ' + x.dmg]); else if (x && v.ln !== 'g') s.push([x.n, x.dmg + ' dmg']); }
    return s;
}
// ---------- research / purchase rules (vehicle ids and module ids "veh.key" share the same RP pool) ----------
function isResearched(id) { return MODBY[id] ? !!save.mods[id] : !!save.researched[id]; }
function isOwned(id) { return !!save.owned[id]; }
function canResearch(id) {
    const md = MODBY[id]; if (md) return !save.mods[id] && isOwned(md.v);
    const v = VBY[id]; return !!v && !isResearched(id) && (!v.req || isResearched(v.req));
}
function rpNeed(id) { return MODBY[id] ? MODBY[id].rp : VBY[id].rp; }
function rpOf(id) { return save.rp[id] || 0; }
function finishResearch(id) {
    if (MODBY[id]) { save.mods[id] = true; delete save.rp[id]; return MODBY[id].n + ' installed on ' + VBY[MODBY[id].v].n + '!'; }
    save.researched[id] = true; delete save.rp[id]; return VBY[id].n + ' researched! Buy it with credits.';
}
function addRp(n) {      // match RP go to what is being researched, leftovers to free RP
    n = Math.round(n); if (n <= 0) return;
    const id = save.target;
    if (id && canResearch(id)) {
        const need = rpNeed(id) - rpOf(id), put = Math.min(need, n);
        save.rp[id] = rpOf(id) + put; n -= put;
        if (rpOf(id) >= rpNeed(id)) { toast(finishResearch(id)); save.target = null; }
    }
    save.freeRp += n;
}
function setTarget(id) { if (!canResearch(id)) return false; save.target = id; writeSave(); return true; }
function spendFreeRp(id) {
    if (!canResearch(id)) return false; const need = rpNeed(id) - rpOf(id), put = Math.min(need, save.freeRp);
    if (put <= 0) return false; save.freeRp -= put; save.rp[id] = rpOf(id) + put;
    if (rpOf(id) >= rpNeed(id)) { finishResearch(id); if (save.target === id) save.target = null; }
    writeSave(); return true;
}
function buyVeh(id) {
    const v = VBY[id]; if (!v || !isResearched(id) || isOwned(id) || save.credits < v.cost) return false;
    save.credits -= v.cost; save.owned[id] = true; if (save.lineup.length < 5) save.lineup.push(id); writeSave(); return true;
}
function lineupToggle(id) {
    const i = save.lineup.indexOf(id);
    if (i >= 0) { if (save.lineup.length > 1) save.lineup.splice(i, 1); }
    else if (isOwned(id) && save.lineup.length < 5) save.lineup.push(id);
    else return false;
    save.sel = clamp(save.sel, 0, save.lineup.length - 1); writeSave(); return true;
}
function lineupBr() { return Math.max(1, ...save.lineup.map(id => VBY[id] ? brOf(vdef(id, modMask(id))) : 1)); }
