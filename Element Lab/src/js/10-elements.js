// ==========================================
// ELEMENT LAB - the element table. One line per element; everything else is derived from it.
// def(name, label, category, kind, [r,g,b], props)
//   props: dens (air = 100), ti start temp, cond heat conduction (0..0.5), cool loss to the air, var colour variation,
//   hi/lo [temp, into, alt?, altChance?] phase change above / below a temperature, ign ignition temp, ip ignite chance,
//   burn [ticks, temp, leaves], flam chance a flame lights it, boom blast radius, bd blast delay, hard (0..1),
//   rub what pieces turn into when blown up, unb unbreakable, g groups, mv move chance, disp flow reach, slide pile slipperiness,
//   life [min,max] start timer, aux0 start extra byte, self (do not tint when hot), glow [r,g,b,strength], alpha, awake, leak
// Reactions between elements live in data/reactions.tsv.
// ==========================================
const K = { EMPTY: 0, SOLID: 1, POWDER: 2, LIQUID: 3, GAS: 4, CREATURE: 5 };
const CATS = ['Powders', 'Liquids', 'Gases', 'Solids', 'Energy', 'Explosives', 'Life', 'Special'];
const DEFS = [{ name: 'empty', label: 'Empty', cat: '', kind: 0, col: [0, 0, 0] }];
function def(name, label, cat, kind, col, o) { DEFS.push(Object.assign({ name, label, cat, kind, col }, o || {})); }
const P_ = K.POWDER, L_ = K.LIQUID, G_ = K.GAS, S_ = K.SOLID, C_ = K.CREATURE;

// ---- Powders
def('sand', 'Sand', 'Powders', P_, [222, 190, 105], { dens: 1600, var: .12, cond: .12, hi: [1100, 'moltenglass'], g: ['diss'] });
def('wetsand', 'Wet Sand', 'Powders', P_, [150, 122, 70], { dens: 1900, slide: .25, var: .1, cond: .15, hi: [105, 'sand'], g: ['diss'] });
def('dirt', 'Dirt', 'Powders', P_, [112, 74, 42], { dens: 1500, slide: .45, var: .14, cond: .08, g: ['diss'] });
def('salt', 'Salt', 'Powders', P_, [236, 236, 242], { dens: 1400, slide: .9, var: .08, g: ['diss'] });
def('snow', 'Snow', 'Powders', P_, [244, 249, 255], { dens: 300, slide: .6, ti: -8, cond: .05, cool: .006, hi: [1, 'water'], g: ['douse'] });
def('ash', 'Ash', 'Powders', P_, [125, 125, 132], { dens: 400, slide: .85, g: ['diss'] });
def('rust', 'Rust', 'Powders', P_, [166, 76, 34], { dens: 1800, slide: .8, g: ['diss'] });
def('coal', 'Coal', 'Powders', P_, [38, 38, 44], { dens: 1300, slide: .8, ign: 350, ip: .1, burn: [255, 800, 'ash'], flam: .08, g: ['diss'] });
def('gravel', 'Gravel', 'Powders', P_, [132, 127, 122], { dens: 2000, slide: .9, var: .14, hi: [1100, 'lava'], g: ['diss'] });
// ---- Liquids
def('water', 'Water', 'Liquids', L_, [48, 118, 232], { dens: 1000, disp: 5, cond: .25, var: .05, lo: [0, 'ice'], hi: [100, 'steam'], g: ['douse'] });
def('saltwater', 'Salt Water', 'Liquids', L_, [70, 150, 205], { dens: 1100, disp: 5, cond: .25, var: .05, lo: [-4, 'ice'], hi: [100, 'steam', 'salt', .35], g: ['douse'] });
def('oil', 'Oil', 'Liquids', L_, [98, 62, 26], { dens: 800, disp: 4, mv: .85, cond: .1, ign: 200, burn: [90, 750, 'smoke'], flam: .35 });
def('lava', 'Lava', 'Liquids', L_, [255, 96, 12], { dens: 2500, disp: 3, mv: .45, ti: 1300, cond: .035, cool: .002, lo: [500, 'stone'], self: 1, glow: [255, 90, 20, 3], awake: 1 });
def('acid', 'Acid', 'Liquids', L_, [140, 255, 50], { dens: 1200, disp: 4, hi: [300, 'steam'], var: .05 });
def('mercury', 'Mercury', 'Liquids', L_, [196, 200, 210], { dens: 13500, disp: 4, var: .03, cond: .3 });
def('mud', 'Mud', 'Liquids', L_, [92, 62, 36], { dens: 1700, disp: 1, mv: .12, hi: [105, 'dirt'], g: ['diss', 'douse'] });
def('lnitro', 'Liquid N2', 'Liquids', L_, [168, 228, 255], { dens: 800, disp: 4, ti: -196, cond: .2, cool: .008, hi: [-150, 'nitrogen'], g: ['douse'] });
def('moltenmetal', 'Molten Metal', 'Liquids', L_, [255, 160, 70], { dens: 6000, disp: 3, mv: .3, ti: 1500, cond: .35, cool: .01, lo: [1300, 'metal'], self: 1, glow: [255, 140, 50, 3], awake: 1 });
def('moltenglass', 'Molten Glass', 'Liquids', L_, [255, 176, 80], { dens: 2300, disp: 2, mv: .3, ti: 1150, cond: .15, cool: .01, lo: [1000, 'glass'], self: 1, glow: [255, 150, 60, 2], awake: 1 });
// ---- Gases
def('steam', 'Steam', 'Gases', G_, [214, 222, 235], { dens: 60, ti: 110, alpha: .5, cool: .12 });
def('smoke', 'Smoke', 'Gases', G_, [88, 88, 96], { dens: 90, ti: 80, alpha: .55, life: [100, 260] });
def('methane', 'Methane', 'Gases', G_, [150, 205, 120], { dens: 55, alpha: .4, ign: 260, ip: .9, burn: [4, 1000, 'smoke'], flam: .9 });
def('hydrogen', 'Hydrogen', 'Gases', G_, [220, 235, 255], { dens: 7, alpha: .35, ign: 240, ip: .95, burn: [3, 1100, 'steam'], flam: .95 });
def('oxygen', 'Oxygen', 'Gases', G_, [150, 205, 255], { dens: 110, alpha: .35 });
def('nitrogen', 'Nitrogen', 'Gases', G_, [180, 190, 240], { dens: 101, ti: -150, alpha: .3, cool: .2 });
def('cloud', 'Cloud', 'Gases', G_, [238, 242, 250], { dens: 100, mv: .12, alpha: .85, aux0: 60, leak: 0, hi: [100, 'steam'], var: .05 });
// ---- Solids
def('stone', 'Stone', 'Solids', S_, [112, 112, 118], { hard: .6, rub: 'gravel', cond: .08, hi: [1100, 'lava'], g: ['diss'] });
def('wall', 'Wall', 'Solids', S_, [58, 60, 72], { hard: 1, unb: 1, cond: .01, var: .03 });
def('wood', 'Wood', 'Solids', S_, [132, 86, 40], { hard: .35, rub: 'ash', cond: .04, ign: 280, ip: .12, burn: [150, 650, 'ash'], flam: .12, var: .1, g: ['diss'] });
def('metal', 'Metal', 'Solids', S_, [162, 168, 180], { hard: .85, cond: .45, cool: .01, hi: [1400, 'moltenmetal'], g: ['diss', 'conduct'] });
def('glass', 'Glass', 'Solids', S_, [175, 220, 235], { hard: .1, rub: 'sand', hi: [1100, 'moltenglass'], var: .04 });
def('ice', 'Ice', 'Solids', S_, [172, 226, 255], { hard: .2, rub: 'snow', ti: -10, cond: .2, cool: .01, hi: [1, 'water'], g: ['diss', 'douse'] });
def('obsidian', 'Obsidian', 'Solids', S_, [34, 22, 50], { hard: .7, rub: 'gravel', ti: 300, hi: [1200, 'lava'], g: ['diss'] });
// ---- Energy
def('fire', 'Fire', 'Energy', G_, [255, 150, 30], { dens: 20, ti: 700, cond: .3, life: [12, 30], mv: .55, self: 1, glow: [255, 140, 30, 2], awake: 1, leak: 0 });
def('spark', 'Spark', 'Energy', G_, [255, 250, 140], { dens: 100, ti: 100, life: [6, 12], self: 1, glow: [255, 240, 150, 3], awake: 1, leak: 0 });
def('battery', 'Battery', 'Energy', S_, [60, 200, 100], { hard: .5, awake: 1, g: ['diss'] });
def('lamp', 'Lamp', 'Energy', S_, [185, 170, 110], { hard: .1, glow: [255, 240, 160, 0], g: ['diss', 'conduct'] });
def('heater', 'Heater', 'Energy', S_, [210, 70, 45], { hard: .6, ti: 900, cond: .3, awake: 1, glow: [255, 80, 30, 1] });
def('freezer', 'Freezer', 'Energy', S_, [70, 130, 215], { hard: .6, ti: -80, cond: .3, awake: 1 });
// ---- Explosives
def('gunpowder', 'Gunpowder', 'Explosives', P_, [75, 75, 82], { dens: 1300, slide: .9, boom: 2, bd: 1, ign: 230, flam: .9, g: ['diss'] });
def('tnt', 'TNT', 'Explosives', S_, [205, 45, 45], { hard: .3, boom: 4, bd: 3, ign: 300, flam: .7, g: ['diss'] });
def('c4', 'C4', 'Explosives', S_, [222, 218, 190], { hard: .3, boom: 6, bd: 4, ign: 700, flam: 0, g: ['diss'] });
def('nitro', 'Nitro', 'Explosives', L_, [196, 232, 70], { dens: 1500, disp: 4, boom: 4, bd: 2, ign: 190, flam: .8, g: ['diss'] });
def('thermite', 'Thermite', 'Explosives', P_, [178, 92, 72], { dens: 2400, slide: .9, ign: 650, ip: .15, burn: [90, 2600, 'moltenmetal'], flam: .15, g: ['diss'] });
def('fuse', 'Fuse', 'Explosives', S_, [150, 125, 85], { hard: .2, ign: 190, ip: .6, burn: [12, 700, 'ash'], flam: .6, g: ['diss'] });
// ---- Life
def('plant', 'Plant', 'Life', S_, [50, 172, 62], { hard: .1, rub: 'ash', var: .15, ign: 230, ip: .2, burn: [50, 600, 'ash'], flam: .25, awake: 1, g: ['organic', 'diss'] });
def('seed', 'Seed', 'Life', P_, [160, 120, 60], { dens: 1100, slide: .7, ign: 220, ip: .2, burn: [20, 500, 'ash'], flam: .3, awake: 1, g: ['organic', 'diss'] });
def('ant', 'Ant', 'Life', C_, [175, 45, 35], { hi: [75, 'ash'], awake: 1, g: ['organic', 'diss'] });
def('firefly', 'Firefly', 'Life', C_, [220, 255, 90], { hi: [75, 'ash'], awake: 1, glow: [200, 255, 90, 1], g: ['organic', 'diss'] });
def('fish', 'Fish', 'Life', C_, [255, 152, 52], { hi: [55, 'ash'], awake: 1, g: ['organic', 'diss'] });
def('virus', 'Virus', 'Life', L_, [184, 64, 224], { dens: 1100, disp: 2, mv: .4, hi: [75, 'smoke'], awake: 1, var: .1 });
// ---- Special
def('clone', 'Clone', 'Special', S_, [226, 206, 48], { unb: 1, hard: 1, awake: 1 });
def('void', 'Void', 'Special', S_, [45, 8, 64], { unb: 1, hard: 1, awake: 1 });
def('sodium', 'Sodium', 'Special', P_, [232, 226, 170], { dens: 970, slide: .3, ign: 115, ip: .3, burn: [40, 900, 'ash'], flam: .4, g: ['diss'] });
def('potassium', 'Potassium', 'Special', P_, [215, 170, 205], { dens: 860, slide: .3, ign: 70, ip: .4, burn: [40, 900, 'ash'], flam: .5, g: ['diss'] });

// ---------- derived arrays ----------
const NE = DEFS.length;
const ID = {};
DEFS.forEach((d, i) => { ID[d.name] = i; });
const KIND = new Uint8Array(NE), FLUID = new Uint8Array(NE), DENS = new Float32Array(NE);
const HI = new Int16Array(NE).fill(32767), HIE = new Uint8Array(NE), HIA = new Uint8Array(NE), HIAP = new Float32Array(NE);
const LO = new Int16Array(NE).fill(-32768), LOE = new Uint8Array(NE), LOA = new Uint8Array(NE), LOAP = new Float32Array(NE);
const TINIT = new Int16Array(NE).fill(AMB), COND = new Float32Array(NE), COOL = new Float32Array(NE);
const IGN = new Int16Array(NE), BIGN = new Float32Array(NE), BLIFE = new Uint8Array(NE), BTEMP = new Int16Array(NE), BPROD = new Uint8Array(NE);
const FLAM = new Float32Array(NE), BOOM = new Uint8Array(NE), BDELAY = new Uint8Array(NE), HARD = new Float32Array(NE);
const RUB = new Uint8Array(NE), UNB = new Uint8Array(NE), MOVEP = new Float32Array(NE), DISP = new Uint8Array(NE), SLIDE = new Float32Array(NE);
const L0 = new Uint8Array(NE), L1 = new Uint8Array(NE), AUX0 = new Uint8Array(NE), AWAKE = new Uint8Array(NE), LEAK = new Uint8Array(NE);
const SELF = new Uint8Array(NE), GLR = new Uint8Array(NE), GLG = new Uint8Array(NE), GLB = new Uint8Array(NE), GLS = new Uint8Array(NE);
const CONDUCT = new Uint8Array(NE), DOUSE = new Uint8Array(NE), ALPHA = new Float32Array(NE), VARY = new Float32Array(NE);
const GROUPS = {};
const nm = n => { if (!(n in ID)) throw new Error('unknown element ' + n); return ID[n]; };
DEFS.forEach((d, e) => {
    KIND[e] = d.kind; FLUID[e] = d.kind === K.LIQUID || d.kind === K.GAS ? 1 : 0;
    DENS[e] = d.dens !== undefined ? d.dens : 5000;
    if (d.hi) { HI[e] = d.hi[0]; HIE[e] = nm(d.hi[1]); if (d.hi[2]) { HIA[e] = nm(d.hi[2]); HIAP[e] = d.hi[3]; } }
    if (d.lo) { LO[e] = d.lo[0]; LOE[e] = nm(d.lo[1]); if (d.lo[2]) { LOA[e] = nm(d.lo[2]); LOAP[e] = d.lo[3]; } }
    if (d.ti !== undefined) TINIT[e] = d.ti;
    const gas = d.kind === K.GAS;
    COND[e] = d.cond !== undefined ? d.cond : gas ? .12 : .1;
    COOL[e] = d.cool !== undefined ? d.cool : gas ? .1 : .03;
    if (d.ign) { IGN[e] = d.ign; BIGN[e] = d.ip !== undefined ? d.ip : .3; }
    if (d.burn) { BLIFE[e] = d.burn[0]; BTEMP[e] = d.burn[1]; BPROD[e] = d.burn[2] === 'empty' ? 0 : nm(d.burn[2]); }
    FLAM[e] = d.flam || 0; BOOM[e] = d.boom || 0; BDELAY[e] = d.bd || 1; HARD[e] = d.hard || 0;
    RUB[e] = d.rub ? nm(d.rub) : 0; UNB[e] = d.unb ? 1 : 0;
    MOVEP[e] = d.mv !== undefined ? d.mv : gas ? .85 : 1;
    DISP[e] = d.disp || 3; SLIDE[e] = d.slide !== undefined ? d.slide : 1;
    if (d.life) { L0[e] = d.life[0]; L1[e] = d.life[1]; }
    AUX0[e] = d.aux0 || 0;
    AWAKE[e] = d.awake || gas ? 1 : 0; LEAK[e] = d.leak !== undefined ? d.leak : 1;
    SELF[e] = d.self ? 1 : 0;
    if (d.glow) { GLR[e] = d.glow[0]; GLG[e] = d.glow[1]; GLB[e] = d.glow[2]; GLS[e] = d.glow[3]; }
    ALPHA[e] = d.alpha !== undefined ? d.alpha : gas ? .45 : 1;
    VARY[e] = d.var !== undefined ? d.var : .06;
    (d.g || []).forEach(g => { (GROUPS[g] = GROUPS[g] || []).push(e); });
});
(GROUPS.conduct || []).forEach(e => { CONDUCT[e] = 1; });
(GROUPS.douse || []).forEach(e => { DOUSE[e] = 1; });
const WALL = ID.wall;
