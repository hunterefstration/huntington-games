// ==========================================
// ELEMENT LAB - the element table. One line per element; everything else is derived from it (12-derive.js).
// def(name, label, category, kind, [r,g,b], props)
//   props: dens (air = 100), ti start temp, cond heat conduction (0..0.5), cool loss to the air, var colour variation,
//   hi/lo [temp, into, alt?, altChance?] phase change above / below a temperature, ign ignition temp, ip ignite chance,
//   burn [ticks, temp, leaves], flam chance a flame lights it, boom blast radius, bd blast delay, hard (0..1),
//   rub what pieces turn into when blown up, unb unbreakable, g groups, mv move chance, disp flow reach, slide pile slipperiness,
//   life [min,max] start timer, aux0 start extra value, self (do not tint when hot), glow [r,g,b,strength], alpha, awake, leak
//   2.0: elc electric role ('c' conductor, 'src' source, 'dev' powered device, 'gate', 'sensor', 'switch'),
//   fis fissile, mod neutron moderator, abs neutron absorber, refl neutron reflector, rad neutrons given off per tick,
//   dir faces the brush direction, hide (not in the palette), danger (people avoid it), burst gas pressure that breaks it,
//   dec [chance, into] slow change over time, desc a line for the inspector.
// The first 55 elements keep their 1.x order: share codes and autosaves store element numbers.
// Reactions between elements live in data/reactions.tsv.
// ==========================================
const K = { EMPTY: 0, SOLID: 1, POWDER: 2, LIQUID: 3, GAS: 4, CREATURE: 5 };
const CATS = ['Land', 'Liquids', 'Gases', 'Building', 'Metals', 'Chemicals', 'Food', 'Energy', 'Electric', 'Machines', 'Nuclear', 'Explosives', 'Life', 'Special'];
const DEFS = [{ name: 'empty', label: 'Empty', cat: '', kind: 0, col: [0, 0, 0] }];
function def(name, label, cat, kind, col, o) { DEFS.push(Object.assign({ name, label, cat, kind, col }, o || {})); }
const P_ = K.POWDER, L_ = K.LIQUID, G_ = K.GAS, S_ = K.SOLID, C_ = K.CREATURE;

// ================= 1.x elements (order fixed) =================
def('sand', 'Sand', 'Land', P_, [222, 190, 105], { dens: 1600, var: .12, cond: .12, hi: [1100, 'moltenglass'], g: ['diss'] });
def('wetsand', 'Wet Sand', 'Land', P_, [150, 122, 70], { dens: 1900, slide: .25, var: .1, cond: .15, hi: [105, 'sand'], g: ['diss'] });
def('dirt', 'Dirt', 'Land', P_, [112, 74, 42], { dens: 1500, slide: .45, var: .14, cond: .08, g: ['diss', 'soil'] });
def('salt', 'Salt', 'Land', P_, [236, 236, 242], { dens: 1400, slide: .9, var: .08, hi: [801, 'moltensalt'], g: ['diss'] });
def('snow', 'Snow', 'Land', P_, [244, 249, 255], { dens: 300, slide: .6, ti: -8, cond: .05, cool: .006, hi: [1, 'water'], g: ['douse'] });
def('ash', 'Ash', 'Land', P_, [125, 125, 132], { dens: 400, slide: .85, g: ['diss'] });
def('rust', 'Rust', 'Land', P_, [166, 76, 34], { dens: 1800, slide: .8, g: ['diss'] });
def('coal', 'Coal', 'Land', P_, [38, 38, 44], { dens: 1300, slide: .8, ign: 350, ip: .1, burn: [255, 800, 'ash'], flam: .08, g: ['diss', 'carbon'] });
def('gravel', 'Gravel', 'Land', P_, [132, 127, 122], { dens: 2000, slide: .9, var: .14, hi: [1100, 'lava'], g: ['diss'] });
def('water', 'Water', 'Liquids', L_, [48, 118, 232], { dens: 1000, disp: 5, cond: .25, var: .05, lo: [0, 'ice'], hi: [100, 'steam'], g: ['douse', 'wet'], mod: 1, abs: .005 });
def('saltwater', 'Salt Water', 'Liquids', L_, [70, 150, 205], { dens: 1100, disp: 5, cond: .25, var: .05, lo: [-4, 'ice'], hi: [100, 'steam', 'salt', .35], g: ['douse', 'wet'], elc: 'c', mod: 1, abs: .02 });
def('oil', 'Oil', 'Liquids', L_, [98, 62, 26], { dens: 800, disp: 4, mv: .85, cond: .1, ign: 200, burn: [90, 750, 'smoke'], flam: .35 });
def('lava', 'Lava', 'Liquids', L_, [255, 96, 12], { dens: 2500, disp: 3, mv: .45, ti: 1300, cond: .035, cool: .002, lo: [500, 'stone'], self: 1, glow: [255, 90, 20, 3], awake: 1, danger: 1 });
def('acid', 'Acid', 'Chemicals', L_, [140, 255, 50], { dens: 1200, disp: 4, hi: [300, 'acidgas'], var: .05, danger: 1, g: ['acidic'] });
def('mercury', 'Mercury', 'Liquids', L_, [196, 200, 210], { dens: 13500, disp: 4, var: .03, cond: .3, hi: [357, 'mercuryvapor'], elc: 'c' });
def('mud', 'Mud', 'Land', L_, [92, 62, 36], { dens: 1700, disp: 1, mv: .12, hi: [105, 'dirt'], g: ['diss', 'douse', 'soil'] });
def('lnitro', 'Liquid Nitrogen', 'Liquids', L_, [168, 228, 255], { dens: 800, disp: 4, ti: -196, cond: .2, cool: .008, hi: [-150, 'nitrogen'], g: ['douse'] });
def('moltenmetal', 'Molten Metal', 'Metals', L_, [255, 160, 70], { dens: 6000, disp: 3, mv: .3, ti: 1500, cond: .35, cool: .01, lo: [1300, 'metal'], self: 1, glow: [255, 140, 50, 3], awake: 1, danger: 1, g: ['molten'] });
def('moltenglass', 'Molten Glass', 'Liquids', L_, [255, 176, 80], { dens: 2300, disp: 2, mv: .3, ti: 1150, cond: .15, cool: .01, lo: [1000, 'glass'], self: 1, glow: [255, 150, 60, 2], awake: 1, danger: 1 });
def('steam', 'Steam', 'Gases', G_, [214, 222, 235], { dens: 60, ti: 110, alpha: .5, cool: .04, life: [160, 240] });
def('smoke', 'Smoke', 'Gases', G_, [88, 88, 96], { dens: 90, ti: 80, alpha: .55, life: [100, 260] });
def('methane', 'Methane', 'Gases', G_, [150, 205, 120], { dens: 55, alpha: .4, ign: 260, ip: .9, burn: [4, 1000, 'co2'], flam: .9, g: ['fgas'] });
def('hydrogen', 'Hydrogen', 'Gases', G_, [220, 235, 255], { dens: 7, alpha: .35, ign: 240, ip: .95, burn: [3, 1100, 'steam'], flam: .95, g: ['fgas'] });
def('oxygen', 'Oxygen', 'Gases', G_, [150, 205, 255], { dens: 110, alpha: .35, lo: [-183, 'lox'] });
def('nitrogen', 'Nitrogen', 'Gases', G_, [180, 190, 240], { dens: 101, ti: -150, alpha: .3, cool: .2, lo: [-196, 'lnitro'] });
def('cloud', 'Cloud', 'Gases', G_, [238, 242, 250], { dens: 100, mv: .12, alpha: .85, aux0: 60, leak: 0, hi: [100, 'steam'], var: .05 });
def('stone', 'Stone', 'Land', S_, [112, 112, 118], { hard: .6, rub: 'gravel', cond: .08, hi: [1100, 'lava'], g: ['diss'], abs: .1 });
def('wall', 'Wall', 'Building', S_, [58, 60, 72], { hard: 1, unb: 1, cond: .01, var: .03, abs: .3, desc: 'Unbreakable. Does not conduct heat or electricity.' });
def('wood', 'Wood', 'Building', S_, [132, 86, 40], { hard: .35, rub: 'sawdust', cond: .04, ign: 280, ip: .12, burn: [150, 650, 'charcoal'], flam: .12, var: .1, g: ['diss', 'organic'], burst: 200 });
def('metal', 'Metal', 'Metals', S_, [162, 168, 180], { hard: .85, cond: .45, cool: .01, hi: [1400, 'moltenmetal'], g: ['diss', 'metal'], elc: 'c', desc: 'Conducts electricity and heat.' });
def('glass', 'Glass', 'Building', S_, [175, 220, 235], { hard: .1, rub: 'glassshard', hi: [1100, 'moltenglass'], var: .04, burst: 170, clear: 1 });
def('ice', 'Ice', 'Land', S_, [172, 226, 255], { hard: .2, rub: 'snow', ti: -10, cond: .2, cool: .01, hi: [1, 'water'], g: ['diss', 'douse'], mod: 1, abs: .01, clear: 1 });
def('obsidian', 'Obsidian', 'Land', S_, [34, 22, 50], { hard: .7, rub: 'gravel', ti: 300, hi: [1200, 'lava'], g: ['diss'] });
def('fire', 'Fire', 'Energy', G_, [255, 150, 30], { dens: 20, ti: 700, cond: .3, life: [12, 30], mv: .55, self: 1, glow: [255, 140, 30, 2], awake: 1, leak: 0, danger: 1 });
def('spark', 'Spark', 'Electric', G_, [255, 250, 140], { dens: 100, ti: 100, life: [6, 12], self: 1, glow: [255, 240, 150, 3], awake: 1, leak: 0, elc: 'src', desc: 'A short burst of charge. Powers wires it touches.' });
def('battery', 'Battery', 'Electric', S_, [60, 200, 100], { hard: .5, g: ['diss'], elc: 'src', desc: 'Always on. Powers wires and devices it touches.' });
def('lamp', 'Light Bulb', 'Electric', S_, [185, 170, 110], { hard: .1, glow: [255, 240, 160, 0], g: ['diss'], elc: 'dev', burst: 170, desc: 'Lights up when powered. Passes power on.' });
def('heater', 'Heater', 'Energy', S_, [210, 70, 45], { hard: .6, ti: 900, cond: .3, awake: 1, glow: [255, 80, 30, 1], desc: 'Always hot (900 C). Use E-Heater for a switchable one.' });
def('freezer', 'Freezer', 'Energy', S_, [70, 130, 215], { hard: .6, ti: -80, cond: .3, awake: 1, desc: 'Always cold (-80 C).' });
def('gunpowder', 'Gunpowder', 'Explosives', P_, [75, 75, 82], { dens: 1300, slide: .9, boom: 2, bd: 1, ign: 230, flam: .9, g: ['diss'] });
def('tnt', 'TNT', 'Explosives', S_, [205, 45, 45], { hard: .3, boom: 4, bd: 3, ign: 300, flam: .7, g: ['diss'] });
def('c4', 'C4', 'Explosives', S_, [222, 218, 190], { hard: .3, boom: 6, bd: 4, ign: 700, flam: 0, g: ['diss'] });
def('nitro', 'Nitroglycerin', 'Explosives', L_, [196, 232, 70], { dens: 1500, disp: 4, boom: 4, bd: 2, ign: 190, flam: .8, g: ['diss'] });
def('thermite', 'Thermite', 'Explosives', P_, [178, 92, 72], { dens: 2400, slide: .9, ign: 650, ip: .15, burn: [90, 2600, 'moltenmetal'], flam: .15, g: ['diss'] });
def('fuse', 'Fuse', 'Explosives', S_, [150, 125, 85], { hard: .2, ign: 190, ip: .6, burn: [12, 700, 'ash'], flam: .6, g: ['diss'] });
def('plant', 'Plant', 'Life', S_, [50, 172, 62], { hard: .1, rub: 'ash', var: .15, ign: 230, ip: .2, burn: [50, 600, 'ash'], flam: .25, awake: 1, hi: [150, 'deadplant'], g: ['organic', 'diss', 'living', 'greens'] });
def('seed', 'Seed', 'Life', P_, [160, 120, 60], { dens: 1100, slide: .7, ign: 220, ip: .2, burn: [20, 500, 'ash'], flam: .3, awake: 1, g: ['organic', 'diss', 'living'] });
def('ant', 'Ant', 'Life', C_, [175, 45, 35], { hi: [75, 'ash'], awake: 1, g: ['organic', 'diss', 'living', 'critter'] });
def('firefly', 'Firefly', 'Life', C_, [220, 255, 90], { hi: [75, 'ash'], awake: 1, glow: [200, 255, 90, 1], g: ['organic', 'diss', 'living', 'critter'] });
def('fish', 'Fish', 'Life', C_, [255, 152, 52], { hi: [55, 'cookedmeat'], awake: 1, g: ['organic', 'diss', 'living', 'critter'] });
def('virus', 'Virus', 'Life', L_, [184, 64, 224], { dens: 1100, disp: 2, mv: .4, hi: [75, 'smoke'], awake: 1, var: .1, danger: 1 });
def('clone', 'Cloner', 'Machines', S_, [226, 206, 48], { unb: 1, hard: 1, awake: 1, desc: 'Copies the first thing that touches it, forever.' });
def('void', 'Void', 'Machines', S_, [45, 8, 64], { unb: 1, hard: 1, awake: 1, desc: 'Deletes anything that touches it.' });
def('sodium', 'Sodium', 'Metals', P_, [232, 226, 170], { dens: 970, slide: .3, ign: 115, ip: .3, burn: [40, 900, 'ash'], flam: .4, g: ['diss'] });
def('potassium', 'Potassium', 'Metals', P_, [215, 170, 205], { dens: 860, slide: .3, ign: 70, ip: .4, burn: [40, 900, 'ash'], flam: .5, g: ['diss'] });

// ================= 2.0 elements =================
// ---- Land
def('clay', 'Clay', 'Land', P_, [170, 120, 95], { dens: 1700, slide: .3, hi: [900, 'brick'], g: ['diss'] });
def('redsand', 'Red Sand', 'Land', P_, [205, 110, 60], { dens: 1600, var: .12, hi: [1100, 'moltenglass'], g: ['diss'] });
def('sulfur', 'Sulfur', 'Land', P_, [232, 214, 58], { dens: 2000, slide: .8, ign: 250, ip: .3, burn: [40, 600, 'so2'], flam: .3, hi: [300, 'moltensulfur'], g: ['diss'] });
def('saltpeter', 'Saltpeter', 'Land', P_, [240, 235, 225], { dens: 2100, slide: .85, g: ['diss'] });
def('charcoal', 'Charcoal', 'Land', P_, [52, 46, 44], { dens: 600, slide: .8, ign: 320, ip: .15, burn: [200, 800, 'ash'], flam: .1, g: ['diss', 'carbon'] });
def('sawdust', 'Sawdust', 'Land', P_, [214, 180, 120], { dens: 450, slide: .7, ign: 240, ip: .3, burn: [30, 550, 'ash'], flam: .4, g: ['diss', 'organic'] });
def('quartz', 'Quartz', 'Land', S_, [230, 225, 240], { hard: .6, rub: 'sand', hi: [1650, 'moltenglass'], var: .05 });
def('limestone', 'Limestone', 'Land', S_, [208, 202, 180], { hard: .5, rub: 'gravel', hi: [825, 'quicklime', 'co2', .3], g: ['diss'] });
def('quicklime', 'Quicklime', 'Land', P_, [240, 240, 232], { dens: 1300, slide: .8, g: ['diss'] });
def('cement', 'Cement', 'Building', P_, [168, 168, 160], { dens: 1500, slide: .8, g: ['diss'] });
def('wetcement', 'Wet Cement', 'Building', L_, [140, 140, 134], { dens: 2200, disp: 1, mv: .15, dec: [.003, 'concrete'], awake: 1, desc: 'Sets into concrete after a while.' });
def('concrete', 'Concrete', 'Building', S_, [150, 150, 146], { hard: .8, rub: 'gravel', cond: .05, hi: [1500, 'lava'], abs: .3, var: .06, desc: 'Strong, shields radiation, never bursts.' });
def('sandstone', 'Sandstone', 'Land', S_, [214, 180, 120], { hard: .4, rub: 'sand', hi: [1200, 'moltenglass'], g: ['diss'] });
def('basalt', 'Basalt', 'Land', S_, [60, 60, 66], { hard: .7, rub: 'gravel', hi: [1200, 'lava'], g: ['diss'] });
def('granite', 'Granite', 'Land', S_, [168, 140, 140], { hard: .75, rub: 'gravel', hi: [1250, 'lava'], var: .15, g: ['diss'] });
def('marble', 'Marble', 'Land', S_, [236, 232, 228], { hard: .6, rub: 'gravel', hi: [825, 'quicklime', 'co2', .3], var: .05, g: ['diss'] });
def('pumice', 'Pumice', 'Land', P_, [190, 186, 170], { dens: 600, slide: .6, g: ['diss'] });
def('permafrost', 'Permafrost', 'Land', S_, [120, 140, 160], { hard: .4, rub: 'dirt', ti: -20, cond: .1, hi: [2, 'mud'], g: ['diss'] });
def('ironore', 'Iron Ore', 'Land', P_, [130, 88, 70], { dens: 3000, slide: .8, hi: [1350, 'molten_iron', 'slag', .4], g: ['diss'] });
def('copperore', 'Copper Ore', 'Land', P_, [70, 130, 110], { dens: 3000, slide: .8, hi: [1100, 'molten_copper', 'slag', .4], g: ['diss'] });
def('goldore', 'Gold Ore', 'Land', P_, [150, 130, 90], { dens: 3200, slide: .8, hi: [1100, 'molten_gold', 'slag', .6], g: ['diss'] });
def('bauxite', 'Bauxite', 'Land', P_, [175, 100, 70], { dens: 2600, slide: .8, hi: [1000, 'molten_aluminum', 'slag', .5], g: ['diss'] });
def('slag', 'Slag', 'Land', P_, [80, 72, 70], { dens: 2500, slide: .8, hi: [1300, 'lava'], g: ['diss'] });
def('fertilizer', 'Fertilizer', 'Land', P_, [130, 110, 80], { dens: 1200, slide: .7, g: ['diss'], desc: 'Plants touching it grow fast.' });
def('compost', 'Compost', 'Land', P_, [75, 55, 35], { dens: 1100, slide: .5, g: ['diss', 'soil', 'organic'] });
def('peat', 'Peat', 'Land', P_, [70, 50, 34], { dens: 900, slide: .4, ign: 300, ip: .05, burn: [255, 500, 'ash'], flam: .05, g: ['diss', 'soil'] });
def('soot', 'Soot', 'Land', P_, [30, 30, 32], { dens: 300, slide: .8, g: ['diss'] });
def('glassshard', 'Glass Shards', 'Building', P_, [190, 225, 235], { dens: 2400, slide: .9, hi: [1100, 'moltenglass'], var: .1 });
def('diamond', 'Diamond', 'Land', S_, [190, 240, 255], { hard: .98, cond: .5, var: .12, ign: 900, ip: .01, burn: [255, 900, 'co2'] });
def('dust', 'Dust', 'Land', P_, [160, 150, 135], { dens: 200, slide: .9, ign: 300, ip: .2, burn: [3, 600, 'smoke'], flam: .3, g: ['diss'] });
// ---- Liquids
def('gasoline', 'Gasoline', 'Liquids', L_, [210, 190, 90], { dens: 740, disp: 5, ign: 140, ip: .8, burn: [25, 900, 'smoke'], flam: .8, hi: [180, 'propane'] });
def('tar', 'Tar', 'Liquids', L_, [26, 22, 22], { dens: 1150, disp: 1, mv: .08, ign: 350, ip: .05, burn: [200, 700, 'smoke'], flam: .05, lo: [-10, 'asphalt'] });
def('dirtywater', 'Dirty Water', 'Liquids', L_, [90, 110, 80], { dens: 1010, disp: 4, cond: .25, lo: [0, 'ice'], hi: [100, 'steam', 'dirt', .2], g: ['douse', 'wet'], mod: 1, abs: .015 });
def('lox', 'Liquid Oxygen', 'Liquids', L_, [140, 200, 255], { dens: 1140, disp: 4, ti: -190, cond: .2, cool: .008, hi: [-183, 'oxygen'] });
def('mercuryvapor', 'Mercury Vapor', 'Gases', G_, [170, 175, 190], { dens: 300, ti: 380, alpha: .45, lo: [340, 'mercury'], danger: 1 });
def('moltensalt', 'Molten Salt', 'Liquids', L_, [255, 200, 120], { dens: 1550, disp: 3, ti: 900, cond: .3, cool: .006, lo: [790, 'salt'], self: 1, glow: [255, 170, 80, 2], danger: 1, desc: 'A coolant that stays liquid when very hot.' });
def('moltensulfur', 'Molten Sulfur', 'Liquids', L_, [210, 80, 40], { dens: 1800, disp: 3, ti: 320, lo: [115, 'sulfur'], ign: 330, ip: .2, burn: [30, 600, 'so2'], flam: .2, danger: 1 });
def('moltenwax', 'Molten Wax', 'Liquids', L_, [250, 230, 190], { dens: 900, disp: 3, mv: .5, ti: 80, lo: [60, 'wax'], ign: 300, ip: .3, burn: [60, 600, 'smoke'], flam: .3 });
def('moltenplastic', 'Molten Plastic', 'Liquids', L_, [230, 230, 240], { dens: 950, disp: 2, mv: .3, ti: 230, lo: [200, 'plastic'], ign: 350, ip: .2, burn: [60, 600, 'smoke'], flam: .2 });
def('slime', 'Slime', 'Special', L_, [120, 230, 90], { dens: 1300, disp: 1, mv: .2, var: .08, hi: [120, 'steam', 'glue', .3] });
// ---- Gases
def('co2', 'Carbon Dioxide', 'Gases', G_, [200, 200, 205], { dens: 150, alpha: .25, lo: [-78, 'dryice'], g: ['douse'] });
def('chlorine', 'Chlorine', 'Gases', G_, [200, 235, 90], { dens: 250, alpha: .45, danger: 1 });
def('propane', 'Propane', 'Gases', G_, [190, 170, 240], { dens: 150, alpha: .35, ign: 200, ip: .9, burn: [5, 1100, 'co2'], flam: .9, g: ['fgas'] });
def('helium', 'Helium', 'Gases', G_, [250, 230, 210], { dens: 14, alpha: .3 });
def('neon', 'Neon', 'Gases', G_, [255, 110, 160], { dens: 70, alpha: .35, glow: [255, 60, 140, 0], desc: 'Glows pink next to live wires.' });
def('argon', 'Argon', 'Gases', G_, [190, 160, 255], { dens: 140, alpha: .3, glow: [170, 110, 255, 0], g: ['douse'] });
def('ozone', 'Ozone', 'Gases', G_, [140, 170, 255], { dens: 160, alpha: .35, life: [200, 255], dec: [.004, 'oxygen'], awake: 1 });
def('so2', 'Sulfur Dioxide', 'Gases', G_, [215, 200, 120], { dens: 220, alpha: .35, danger: 1 });
def('poisongas', 'Poison Gas', 'Gases', G_, [150, 200, 60], { dens: 120, alpha: .45, danger: 1, g: ['toxic'] });
def('fluorine', 'Fluorine', 'Gases', G_, [240, 240, 140], { dens: 130, alpha: .45, danger: 1 });
def('acidgas', 'Acid Vapor', 'Gases', G_, [170, 230, 100], { dens: 90, ti: 310, alpha: .4, lo: [290, 'acid'], danger: 1, g: ['acidic'] });
def('stormcloud', 'Storm Cloud', 'Gases', G_, [96, 100, 118], { dens: 100, mv: .12, alpha: .9, aux0: 200, leak: 0, var: .08 });
def('snowcloud', 'Snow Cloud', 'Gases', G_, [226, 236, 250], { dens: 100, mv: .12, alpha: .85, aux0: 80, leak: 0, ti: -10, var: .05 });
def('acidcloud', 'Acid Cloud', 'Gases', G_, [176, 220, 120], { dens: 100, mv: .12, alpha: .8, aux0: 60, leak: 0, var: .05, danger: 1 });
// ---- Building
def('brick', 'Brick', 'Building', S_, [168, 72, 52], { hard: .7, rub: 'gravel', cond: .04, var: .1, hi: [1600, 'lava'], burst: 230 });
def('rglass', 'Strong Glass', 'Building', S_, [140, 200, 225], { hard: .7, rub: 'glassshard', hi: [1500, 'moltenglass'], var: .03, clear: 1, desc: 'Glass that pressure cannot burst.' });
def('plastic', 'Plastic', 'Building', S_, [225, 225, 235], { hard: .3, cond: .02, hi: [200, 'moltenplastic'], burst: 160, var: .03 });
def('rubber', 'Rubber', 'Building', S_, [44, 40, 40], { hard: .4, cond: .02, ign: 400, ip: .05, burn: [120, 600, 'smoke'], flam: .02, desc: 'Electric insulator. Wrap wires with it.' });
def('insulation', 'Insulation', 'Building', S_, [240, 200, 120], { hard: .2, cond: .002, cool: .001, var: .1, desc: 'Barely lets heat through.' });
def('wool', 'Wool', 'Building', S_, [236, 230, 222], { hard: .1, cond: .01, ign: 300, ip: .2, burn: [40, 500, 'ash'], flam: .2, var: .06, g: ['organic'] });
def('paper', 'Paper', 'Building', S_, [245, 242, 230], { hard: .05, ign: 230, ip: .6, burn: [15, 500, 'ash'], flam: .6, burst: 60, g: ['organic', 'diss'] });
def('cardboard', 'Cardboard', 'Building', S_, [190, 150, 100], { hard: .1, ign: 260, ip: .4, burn: [30, 550, 'ash'], flam: .4, burst: 80, g: ['organic', 'diss'] });
def('ceramic', 'Ceramic', 'Building', S_, [225, 220, 205], { hard: .5, rub: 'gravel', cond: .03, hi: [1700, 'lava'], burst: 240 });
def('asphalt', 'Asphalt', 'Building', S_, [44, 44, 48], { hard: .5, rub: 'gravel', hi: [150, 'tar'], var: .08 });
def('straw', 'Straw', 'Building', P_, [220, 196, 100], { dens: 300, slide: .2, ign: 220, ip: .6, burn: [20, 500, 'ash'], flam: .6, g: ['organic', 'diss'] });
def('wax', 'Wax', 'Building', S_, [245, 235, 200], { hard: .2, hi: [60, 'moltenwax'] });
def('sponge', 'Sponge', 'Building', S_, [240, 220, 90], { hard: .1, var: .1, desc: 'Soaks up water.' });
def('mirror', 'Mirror', 'Building', S_, [210, 225, 235], { hard: .5, rub: 'glassshard', refl: 1, desc: 'Reflects light beams and neutrons.' });
// ---- Metals (each solid metal melts into its own liquid)
const METALS = [];
function metal(name, label, col, dens, melt, o) {
    const mcol = [Math.min(255, col[0] * .4 + 160), Math.min(255, col[1] * .3 + 90), Math.min(255, col[2] * .2 + 30)];
    def(name, label, 'Metals', S_, col, Object.assign({ hard: .85, cond: .42, cool: .01, hi: [melt, 'molten_' + name], g: ['diss', 'metal'], elc: 'c' }, o || {}));
    def('molten_' + name, 'Molten ' + label, 'Metals', L_, mcol, { dens: dens, disp: 3, mv: .35, ti: melt + 150, cond: .35, cool: .01, lo: [melt - 20, name], self: 1, glow: [255, 140, 50, 3], awake: 1, danger: 1, g: ['molten'] });
    METALS.push(name);
}
metal('iron', 'Iron', [150, 150, 160], 7000, 1538, { abs: .2 });
metal('copper', 'Copper', [205, 115, 62], 8000, 1085, { cond: .5 });
metal('gold', 'Gold', [245, 200, 60], 17000, 1064, { cond: .48 });
metal('silver', 'Silver', [205, 210, 220], 9800, 962, { cond: .5 });
metal('aluminum', 'Aluminum', [192, 198, 208], 2400, 660, { cond: .48 });
metal('tin', 'Tin', [178, 178, 172], 7000, 232);
metal('lead', 'Lead', [90, 96, 112], 10600, 327, { abs: .5, desc: 'Heavy. Blocks neutrons well.' });
metal('zinc', 'Zinc', [160, 172, 178], 6600, 420);
metal('nickel', 'Nickel', [172, 166, 140], 7800, 1455);
metal('titanium', 'Titanium', [142, 142, 158], 4100, 1668, { hard: .95 });
metal('tungsten', 'Tungsten', [112, 112, 124], 17600, 3400, { hard: .97, desc: 'Melts at 3400 C.' });
metal('steel', 'Steel', [120, 126, 138], 7000, 1450, { hard: .95, abs: .2 });
metal('bronze', 'Bronze', [188, 128, 62], 7800, 950);
metal('brass', 'Brass', [214, 172, 82], 7600, 930);
metal('solder', 'Solder', [168, 168, 174], 8000, 190);
metal('platinum', 'Platinum', [218, 218, 228], 19000, 1768, { desc: 'A catalyst: hydrogen and oxygen react cold next to it.' });
metal('magnesium', 'Magnesium', [205, 205, 198], 1600, 650, { ign: 470, ip: .2, burn: [60, 2500, 'quicklime'], flam: .05, glow: [255, 255, 255, 0] });
metal('lithium', 'Lithium', [190, 190, 202], 500, 180, { hard: .3 });
def('patina', 'Patina', 'Metals', P_, [80, 170, 140], { dens: 1800, slide: .8, g: ['diss'] });
// ---- Chemicals
def('lye', 'Lye', 'Chemicals', L_, [200, 160, 240], { dens: 1200, disp: 4, hi: [110, 'steam'], danger: 1, g: ['basic'] });
def('bleach', 'Bleach', 'Chemicals', L_, [235, 240, 210], { dens: 1100, disp: 5, hi: [110, 'steam', 'chlorine', .3] });
def('ammonia', 'Ammonia', 'Chemicals', L_, [205, 225, 255], { dens: 900, disp: 5, hi: [60, 'poisongas'], g: ['basic'] });
def('vinegar', 'Vinegar', 'Chemicals', L_, [235, 225, 200], { dens: 1010, disp: 5, hi: [118, 'steam'], g: ['wet'] });
def('ethanol', 'Ethanol', 'Chemicals', L_, [220, 235, 245], { dens: 790, disp: 5, ign: 200, ip: .7, burn: [20, 800, 'co2'], flam: .7, hi: [78, 'propane', 'steam', .5], alpha: .8 });
def('peroxide', 'Peroxide', 'Chemicals', L_, [210, 235, 250], { dens: 1450, disp: 5, hi: [150, 'oxygen', 'steam', .5] });
def('bakingsoda', 'Baking Soda', 'Chemicals', P_, [250, 250, 248], { dens: 1100, slide: .8, g: ['diss'] });
def('soap', 'Soap', 'Chemicals', S_, [240, 180, 220], { hard: .1, g: ['diss'] });
def('soapywater', 'Soapy Water', 'Chemicals', L_, [150, 190, 245], { dens: 1000, disp: 5, hi: [100, 'steam', 'bubble', .3], lo: [0, 'ice'], g: ['douse', 'wet'] });
def('cuso4', 'Copper Sulfate', 'Chemicals', P_, [60, 120, 230], { dens: 1300, slide: .85, g: ['diss'], desc: 'Dissolves in water. Boil it off to grow crystals.' });
def('cuso4sol', 'Blue Solution', 'Chemicals', L_, [40, 90, 220], { dens: 1080, disp: 4, hi: [100, 'steam', 'cuso4crystal', .45], lo: [0, 'ice'], g: ['douse', 'wet'] });
def('cuso4crystal', 'Blue Crystal', 'Chemicals', S_, [50, 110, 255], { hard: .2, rub: 'cuso4', var: .2, clear: 1 });
def('rocksalt', 'Salt Crystal', 'Chemicals', S_, [238, 232, 240], { hard: .25, rub: 'salt', var: .1, hi: [801, 'moltensalt'] });
def('borax', 'Borax', 'Chemicals', P_, [235, 235, 250], { dens: 1700, slide: .8, abs: .5, g: ['diss'] });
def('glue', 'Glue', 'Chemicals', L_, [240, 240, 235], { dens: 1100, disp: 1, mv: .15, dec: [.0008, 'plastic'], awake: 1 });
def('poison', 'Poison', 'Chemicals', L_, [130, 40, 170], { dens: 1050, disp: 4, hi: [100, 'poisongas'], danger: 1, g: ['toxic'] });
def('dryice', 'Dry Ice', 'Chemicals', S_, [225, 235, 245], { hard: .2, ti: -80, cond: .15, cool: .005, hi: [-78, 'co2'] });
def('phosphorus', 'Phosphorus', 'Chemicals', P_, [240, 235, 190], { dens: 1800, slide: .6, ign: 40, ip: .3, burn: [30, 800, 'smoke'], flam: .7, glow: [190, 255, 190, 0] });
def('blackmix', 'Powder Mix', 'Chemicals', P_, [90, 86, 80], { dens: 1500, slide: .85, ign: 300, ip: .3, burn: [10, 500, 'smoke'], flam: .3, g: ['diss'], desc: 'Saltpeter and charcoal. Add sulfur to make gunpowder.' });
// ---- Food
def('flour', 'Flour', 'Food', P_, [246, 240, 226], { dens: 600, slide: .6, ign: 400, ip: .4, burn: [3, 600, 'smoke'], flam: .5, g: ['diss', 'organic', 'food'] });
def('dough', 'Dough', 'Food', S_, [236, 214, 170], { hard: .1, hi: [180, 'bread'], g: ['organic', 'food', 'diss'] });
def('bread', 'Bread', 'Food', S_, [214, 160, 90], { hard: .1, hi: [260, 'toast'], g: ['organic', 'food', 'diss'] });
def('toast', 'Toast', 'Food', S_, [160, 100, 46], { hard: .1, ign: 330, ip: .2, burn: [40, 500, 'ash'], flam: .2, g: ['organic', 'food', 'diss'] });
def('batter', 'Batter', 'Food', L_, [244, 220, 150], { dens: 1200, disp: 1, mv: .2, hi: [160, 'cake'], g: ['organic', 'food', 'diss'] });
def('cake', 'Cake', 'Food', S_, [230, 180, 110], { hard: .05, hi: [300, 'charcoal'], g: ['organic', 'food', 'diss'] });
def('egg', 'Egg', 'Food', P_, [245, 236, 220], { dens: 1030, slide: .2, hi: [80, 'cookedegg'], g: ['organic', 'food', 'diss'] });
def('cookedegg', 'Fried Egg', 'Food', P_, [250, 245, 200], { dens: 1030, slide: .2, hi: [300, 'charcoal'], g: ['organic', 'food', 'diss'] });
def('meat', 'Meat', 'Food', P_, [200, 70, 70], { dens: 1050, slide: .2, hi: [90, 'cookedmeat'], dec: [.0003, 'rottenmeat'], awake: 1, g: ['organic', 'food', 'diss'] });
def('cookedmeat', 'Cooked Meat', 'Food', P_, [150, 80, 50], { dens: 1050, slide: .2, hi: [300, 'charcoal'], g: ['organic', 'food', 'diss'] });
def('rottenmeat', 'Rotten Meat', 'Food', P_, [110, 120, 70], { dens: 1050, slide: .2, ign: 300, burn: [30, 500, 'ash'], flam: .1, g: ['organic', 'diss'] });
def('cheese', 'Cheese', 'Food', P_, [250, 210, 80], { dens: 1100, slide: .2, hi: [60, 'meltedcheese'], g: ['organic', 'food', 'diss'] });
def('meltedcheese', 'Melted Cheese', 'Food', L_, [255, 200, 60], { dens: 1100, disp: 1, mv: .2, lo: [40, 'cheese'], g: ['organic', 'food', 'diss'] });
def('milk', 'Milk', 'Food', L_, [250, 250, 245], { dens: 1030, disp: 4, hi: [100, 'steam', 'cheese', .2], lo: [-1, 'icecream'], g: ['organic', 'food', 'wet'] });
def('sugar', 'Sugar', 'Food', P_, [252, 252, 252], { dens: 1600, slide: .85, hi: [186, 'caramel'], g: ['diss', 'food'] });
def('sugarwater', 'Sugar Water', 'Food', L_, [190, 220, 245], { dens: 1050, disp: 5, hi: [100, 'steam', 'sugar', .3], lo: [-2, 'ice'], g: ['douse', 'wet', 'food'] });
def('caramel', 'Caramel', 'Food', L_, [200, 120, 40], { dens: 1300, disp: 1, mv: .2, ti: 190, lo: [100, 'candy'], hi: [300, 'charcoal'], g: ['food'] });
def('candy', 'Candy', 'Food', S_, [255, 90, 160], { hard: .2, hi: [160, 'caramel'], var: .2, g: ['food', 'diss'] });
def('honey', 'Honey', 'Food', L_, [240, 170, 30], { dens: 1400, disp: 1, mv: .12, g: ['food', 'diss'] });
def('chocolate', 'Chocolate', 'Food', S_, [92, 52, 30], { hard: .2, hi: [40, 'meltedchoc'], g: ['food', 'diss'] });
def('meltedchoc', 'Melted Chocolate', 'Food', L_, [110, 62, 34], { dens: 1300, disp: 2, mv: .3, lo: [30, 'chocolate'], g: ['food', 'diss'] });
def('kernel', 'Corn Kernel', 'Food', P_, [240, 200, 60], { dens: 1200, slide: .8, hi: [180, 'popcorn'], g: ['food', 'diss'] });
def('popcorn', 'Popcorn', 'Food', P_, [255, 250, 225], { dens: 200, slide: .5, ign: 300, burn: [20, 500, 'ash'], flam: .2, g: ['food', 'diss'] });
def('potato', 'Potato', 'Food', P_, [190, 150, 90], { dens: 1100, slide: .3, hi: [150, 'bakedpotato'], g: ['food', 'diss', 'organic'] });
def('bakedpotato', 'Baked Potato', 'Food', P_, [170, 120, 60], { dens: 1100, slide: .3, hi: [320, 'charcoal'], g: ['food', 'diss', 'organic'] });
def('fries', 'Fries', 'Food', P_, [245, 200, 90], { dens: 900, slide: .5, hi: [320, 'charcoal'], g: ['food', 'diss'] });
def('apple', 'Apple', 'Food', P_, [210, 40, 40], { dens: 900, slide: .3, var: .1, hi: [120, 'juice'], g: ['food', 'diss', 'organic'] });
def('juice', 'Juice', 'Food', L_, [250, 160, 40], { dens: 1040, disp: 5, hi: [100, 'steam', 'sugar', .2], lo: [-2, 'icecream'], g: ['food', 'wet'] });
def('icecream', 'Ice Cream', 'Food', P_, [255, 230, 240], { dens: 600, slide: .1, ti: -10, hi: [8, 'milk'], g: ['food'] });
def('yeast', 'Yeast', 'Food', P_, [214, 190, 140], { dens: 900, slide: .6, hi: [60, 'ash'], g: ['food', 'diss'] });
def('coffeebeans', 'Coffee Beans', 'Food', P_, [100, 60, 40], { dens: 700, slide: .7, ign: 300, burn: [60, 500, 'ash'], flam: .1, g: ['food', 'diss'] });
def('coffee', 'Coffee', 'Food', L_, [70, 40, 25], { dens: 1010, disp: 5, ti: 70, hi: [100, 'steam'], lo: [0, 'ice'], g: ['food', 'wet'] });
// ---- Energy
def('plasma', 'Plasma', 'Energy', G_, [250, 170, 255], { dens: 30, ti: 4000, cond: .4, life: [10, 25], mv: .7, self: 1, glow: [230, 140, 255, 4], awake: 1, leak: 0, danger: 1 });
def('ember', 'Ember', 'Energy', P_, [255, 110, 40], { dens: 700, slide: .7, ti: 700, cool: .005, life: [80, 200], self: 1, glow: [255, 100, 30, 2], awake: 1, danger: 1 });
def('bluefire', 'Blue Fire', 'Energy', G_, [90, 150, 255], { dens: 20, ti: 1400, cond: .3, life: [15, 35], mv: .55, self: 1, glow: [80, 140, 255, 3], awake: 1, leak: 0, danger: 1 });
def('coldfire', 'Cold Fire', 'Energy', G_, [140, 230, 255], { dens: 20, ti: -180, cond: .3, life: [15, 35], mv: .55, self: 1, glow: [120, 220, 255, 2], awake: 1, leak: 0 });
def('torch', 'Torch', 'Energy', S_, [120, 80, 40], { hard: .3, ti: 400, awake: 1, glow: [255, 160, 60, 1], desc: 'Burns forever.' });
def('candle', 'Candle', 'Energy', S_, [245, 240, 220], { hard: .1, hi: [90, 'moltenwax'], awake: 1, glow: [255, 200, 90, 1] });
def('light', 'Light', 'Energy', G_, [255, 255, 200], { self: 1, glow: [255, 255, 200, 3], awake: 1, desc: 'A beam of light. Mirrors bounce it.' });
def('sun', 'Sun', 'Special', S_, [255, 230, 120], { unb: 1, hard: 1, ti: 3000, cond: .3, self: 1, glow: [255, 220, 120, 6], awake: 1, danger: 1, desc: 'Extremely hot, gives off light.' });
// ---- Electric
def('wire', 'Wire', 'Electric', S_, [210, 120, 60], { hard: .7, cond: .45, hi: [1085, 'molten_copper'], elc: 'c', var: .03, g: ['metal'], desc: 'Carries power. Runs along any conductor it touches.' });
def('solar', 'Solar Panel', 'Electric', S_, [40, 60, 130], { hard: .3, elc: 'src', burst: 200, desc: 'Gives power when nothing but air or glass is above it.' });
def('led_r', 'Red LED', 'Electric', S_, [110, 40, 40], { hard: .2, elc: 'dev', glow: [255, 40, 40, 0] });
def('led_g', 'Green LED', 'Electric', S_, [40, 100, 50], { hard: .2, elc: 'dev', glow: [40, 255, 80, 0] });
def('led_b', 'Blue LED', 'Electric', S_, [40, 60, 120], { hard: .2, elc: 'dev', glow: [60, 120, 255, 0] });
def('switch', 'Switch', 'Electric', S_, [100, 70, 70], { hard: .5, elc: 'switch', desc: 'Click it with the Hand tool to turn it on or off.' });
def('and_gate', 'AND Gate', 'Electric', S_, [70, 140, 220], { hard: .5, elc: 'gate', desc: 'Inputs: left, right, top. Output: bottom. On when every connected input is on.' });
def('or_gate', 'OR Gate', 'Electric', S_, [220, 160, 60], { hard: .5, elc: 'gate', desc: 'Inputs: left, right, top. Output: bottom. On when any input is on.' });
def('not_gate', 'NOT Gate', 'Electric', S_, [220, 70, 90], { hard: .5, elc: 'gate', desc: 'Inputs: left, right, top. Output: bottom. On when no input is on.' });
def('xor_gate', 'XOR Gate', 'Electric', S_, [150, 90, 220], { hard: .5, elc: 'gate', desc: 'Inputs: left, right, top. Output: bottom. On when exactly one input is on.' });
def('heatsensor', 'Heat Sensor', 'Electric', S_, [200, 100, 60], { hard: .5, cond: .3, elc: 'sensor', desc: 'Gives power when touching something at 100 C or more.' });
def('pressuresensor', 'Pressure Sensor', 'Electric', S_, [90, 160, 160], { hard: .5, elc: 'sensor', desc: 'Gives power when gas next to it is under pressure.' });
def('sensor', 'Detector', 'Electric', S_, [230, 220, 100], { hard: .5, elc: 'sensor', desc: 'Gives power when any material (not wire) touches it.' });
def('eheater', 'E-Heater', 'Electric', S_, [170, 70, 50], { hard: .6, cond: .35, elc: 'dev', glow: [255, 80, 30, 0], desc: 'Heats up to 450 C while powered.' });
def('ecooler', 'E-Cooler', 'Electric', S_, [60, 110, 170], { hard: .6, cond: .35, elc: 'dev', desc: 'Cools down to -60 C while powered.' });
def('teslacoil', 'Tesla Coil', 'Electric', S_, [120, 120, 150], { hard: .6, elc: 'dev', desc: 'Throws sparks around while powered.' });
def('sparkplug', 'Spark Plug', 'Electric', S_, [190, 190, 200], { hard: .6, elc: 'dev', desc: 'Lights fuel next to it while powered.' });
def('laser', 'Laser', 'Electric', S_, [150, 40, 50], { hard: .6, elc: 'dev', dir: 1, desc: 'Fires a hot light beam the way it faces while powered.' });
// ---- Machines
def('pipe', 'Pipe', 'Machines', S_, [92, 100, 108], { hard: .8, cond: .3, awake: 1, desc: 'Open ends suck in liquids or gases; the other end lets them out.' });
def('pump', 'Pump', 'Machines', S_, [60, 130, 150], { hard: .8, elc: 'dev', dir: 1, desc: 'Powered: moves liquid, gas or powder from behind it to the front (or into a pipe).' });
def('valve', 'Valve', 'Machines', S_, [150, 80, 80], { hard: .8, cond: .3, elc: 'dev', desc: 'A pipe piece that only lets things through while powered.' });
def('fan', 'Fan', 'Machines', S_, [150, 170, 180], { hard: .6, elc: 'dev', dir: 1, desc: 'Powered: blows loose stuff the way it faces.' });
def('conveyor', 'Conveyor', 'Machines', S_, [70, 70, 80], { hard: .7, elc: 'dev', dir: 1, desc: 'Powered: carries whatever sits on it left or right.' });
def('piston', 'Piston', 'Machines', S_, [140, 110, 70], { hard: .9, elc: 'dev', dir: 1, desc: 'Powered: pushes up to 16 cells the way it faces. Unpowered: pulls back.' });
def('pistonhead', 'Piston Head', 'Machines', S_, [180, 150, 100], { hard: .95, hide: 1 });
def('spout', 'Spout', 'Machines', S_, [80, 160, 200], { unb: 1, hard: 1, awake: 1, dir: 1, desc: 'Copies what touches it and pours it out the way it faces.' });
def('drain', 'Drain', 'Machines', S_, [40, 40, 50], { unb: 1, hard: 1, awake: 1, desc: 'Swallows liquids and gases.' });
def('turbine', 'Turbine', 'Machines', S_, [170, 175, 190], { hard: .9, awake: 1, elc: 'src', desc: 'Steam pushing through it spins it and makes power.' });
def('mesh', 'Mesh', 'Machines', S_, [100, 100, 110], { hard: .7, desc: 'Liquids and gases pass through, powders do not.' });
def('furnace', 'Furnace', 'Machines', S_, [120, 64, 44], { hard: .9, cond: .45, elc: 'dev', glow: [255, 120, 40, 0], desc: 'Heats up to 1600 C while powered: melts ore and metal.' });
def('drill', 'Drill', 'Machines', S_, [170, 150, 60], { hard: .95, elc: 'dev', dir: 1, desc: 'Powered: breaks whatever is in front of it.' });
// ---- Nuclear
def('uranium', 'Uranium', 'Nuclear', S_, [70, 190, 60], { hard: .8, cond: .3, hi: [1800, 'corium'], fis: 1, rad: .0006, awake: 1, glow: [80, 255, 60, 0], desc: 'Fuel. Slow neutrons split it: heat and more neutrons.' });
def('plutonium', 'Plutonium', 'Nuclear', S_, [130, 160, 140], { hard: .8, cond: .3, hi: [1600, 'corium'], fis: 1.6, rad: .002, awake: 1, desc: 'Very fissile fuel.' });
def('thorium', 'Thorium', 'Nuclear', S_, [110, 120, 110], { hard: .8, cond: .3, hi: [1750, 'corium'], fis: .2, rad: .0002, awake: 1 });
def('controlrod', 'Control Rod', 'Nuclear', S_, [70, 70, 80], { hard: .9, cond: .2, abs: .95, hi: [2000, 'moltenmetal'], desc: 'Soaks up neutrons. More rods = cooler reactor.' });
def('graphite', 'Graphite', 'Nuclear', S_, [60, 60, 64], { hard: .5, cond: .3, mod: 1, abs: .003, ign: 750, ip: .02, burn: [255, 900, 'co2'], flam: .01, elc: 'c', desc: 'Slows neutrons (a moderator). Conducts electricity.' });
def('heavywater', 'Heavy Water', 'Nuclear', L_, [70, 110, 210], { dens: 1100, disp: 5, cond: .25, lo: [4, 'ice'], hi: [101, 'steam'], mod: 1, abs: .001, g: ['douse', 'wet'], desc: 'A moderator that barely absorbs neutrons.' });
def('corium', 'Corium', 'Nuclear', L_, [255, 200, 80], { dens: 9000, disp: 2, mv: .25, ti: 2600, cond: .25, cool: .0005, lo: [1200, 'nuclearwaste'], fis: .5, rad: .004, self: 1, glow: [255, 210, 90, 4], awake: 1, danger: 1, desc: 'Molten reactor core. Do not add water.' });
def('radiation', 'Radiation', 'Nuclear', G_, [120, 255, 90], { dens: 100, life: [20, 60], mv: .9, self: 1, glow: [100, 255, 80, 2], awake: 1, alpha: .6, danger: 1 });
def('nuclearwaste', 'Nuclear Waste', 'Nuclear', P_, [100, 140, 40], { dens: 3000, slide: .5, ti: 60, rad: .0008, awake: 1, glow: [120, 255, 40, 1], danger: 1 });
def('spentfuel', 'Spent Fuel', 'Nuclear', S_, [60, 100, 60], { hard: .7, cond: .3, fis: .08, rad: .0006, awake: 1, hi: [1800, 'corium'] });
def('neutron', 'Neutron', 'Nuclear', G_, [180, 240, 255], { self: 1, awake: 1, glow: [150, 220, 255, 2], desc: 'Fast neutrons. Water or graphite slows them.' });
def('beryllium', 'Beryllium', 'Nuclear', S_, [190, 200, 190], { hard: .6, refl: 1, cond: .3, desc: 'Bounces neutrons back (a reflector).' });
def('uraninite', 'Uraninite', 'Nuclear', P_, [60, 70, 50], { dens: 4000, slide: .7, fis: .05, rad: .0001, hi: [1500, 'corium', 'slag', .7] });
def('radon', 'Radon', 'Nuclear', G_, [150, 255, 160], { dens: 400, alpha: .35, life: [200, 255], dec: [.003, 'empty'], awake: 1, danger: 1 });
def('nsource', 'Neutron Source', 'Nuclear', S_, [200, 230, 255], { hard: .8, rad: .05, awake: 1, glow: [150, 220, 255, 1], desc: 'Gives off a steady trickle of neutrons to start a reactor.' });
// ---- Explosives
def('dynamite', 'Dynamite', 'Explosives', S_, [200, 60, 60], { hard: .3, boom: 5, bd: 5, ign: 250, flam: .5, g: ['diss'] });
def('firework', 'Firework', 'Explosives', P_, [230, 60, 200], { dens: 1200, slide: .5, ign: 200, flam: .7, var: .3, g: ['diss'], desc: 'Light it: flies up and bursts.' });
def('napalm', 'Napalm', 'Explosives', L_, [230, 120, 40], { dens: 900, disp: 1, mv: .25, ign: 150, ip: .9, burn: [200, 1100, 'smoke'], flam: .9, danger: 1 });
def('flashpowder', 'Flash Powder', 'Explosives', P_, [200, 200, 210], { dens: 1300, slide: .9, ign: 200, ip: 1, burn: [2, 2500, 'smoke'], flam: 1, g: ['diss'] });
def('landmine', 'Landmine', 'Explosives', S_, [80, 90, 60], { hard: .4, boom: 6, bd: 1, ign: 300, flam: .3, desc: 'Goes off when a creature or person steps next to it.' });
def('smokebomb', 'Smoke Bomb', 'Explosives', P_, [110, 110, 120], { dens: 1300, slide: .6, ign: 200, ip: 1, burn: [80, 300, 'smoke'], flam: .8 });
def('firecracker', 'Firecracker', 'Explosives', P_, [220, 40, 40], { dens: 1200, slide: .6, boom: 1, bd: 1, ign: 200, flam: .9 });
def('nuke', 'Nuke', 'Explosives', S_, [90, 220, 80], { hard: .5, boom: 20, bd: 6, ign: 800, flam: 0, desc: 'A huge blast and radioactive fallout. Neutrons set it off.' });
// ---- Life
def('human', 'Human', 'Life', C_, [60, 110, 200], { life: [100, 100], ti: 37, awake: 1, g: ['organic', 'living', 'critter'], desc: 'Walks, climbs steps, runs from danger.' });
def('head', 'Head', 'Life', C_, [240, 196, 160], { hide: 1, ti: 37, awake: 1, g: ['organic', 'living'] });
def('body', 'Body', 'Life', P_, [170, 90, 90], { dens: 1050, slide: .1, hi: [200, 'cookedmeat'], dec: [.0004, 'rottenmeat'], awake: 1, g: ['organic', 'diss'] });
def('blood', 'Blood', 'Life', L_, [150, 10, 20], { dens: 1060, disp: 3, mv: .6, hi: [110, 'steam', 'salt', .1], lo: [-2, 'ice'], g: ['wet', 'organic'] });
def('bone', 'Bone', 'Life', P_, [232, 226, 210], { dens: 1900, slide: .2, hi: [1200, 'quicklime'], g: ['diss'] });
def('bird', 'Bird', 'Life', C_, [90, 70, 60], { hi: [70, 'cookedmeat'], awake: 1, g: ['organic', 'diss', 'living', 'critter'] });
def('worm', 'Worm', 'Life', C_, [220, 130, 140], { hi: [60, 'ash'], awake: 1, g: ['organic', 'diss', 'living', 'critter'] });
def('bee', 'Bee', 'Life', C_, [250, 200, 30], { hi: [60, 'ash'], awake: 1, g: ['organic', 'diss', 'living', 'critter'] });
def('grass', 'Grass', 'Life', P_, [70, 180, 60], { dens: 1200, slide: 0, var: .15, ign: 220, ip: .3, burn: [15, 500, 'ash'], flam: .4, awake: 1, hi: [150, 'deadplant'], g: ['organic', 'diss', 'living', 'greens'] });
def('sapling', 'Tree Seed', 'Life', P_, [120, 90, 50], { dens: 1100, slide: .5, ign: 220, burn: [20, 500, 'ash'], flam: .3, awake: 1, g: ['organic', 'diss', 'living'] });
def('tree', 'Tree', 'Life', S_, [110, 76, 40], { hide: 1, hard: .4, rub: 'sawdust', ign: 280, ip: .12, burn: [150, 650, 'charcoal'], flam: .12, awake: 1, g: ['organic', 'diss'] });
def('leaves', 'Leaves', 'Life', S_, [56, 150, 50], { hard: .05, var: .2, ign: 220, ip: .4, burn: [12, 500, 'ash'], flam: .4, hi: [140, 'deadplant'], g: ['organic', 'diss', 'living', 'greens'] });
def('vine', 'Vine', 'Life', S_, [40, 140, 50], { hard: .05, var: .15, ign: 230, ip: .3, burn: [20, 500, 'ash'], flam: .3, awake: 1, aux0: 40, hi: [150, 'deadplant'], g: ['organic', 'diss', 'living', 'greens'] });
def('flowerseed', 'Flower Seed', 'Life', P_, [150, 110, 70], { dens: 1100, slide: .5, ign: 220, burn: [20, 500, 'ash'], flam: .3, awake: 1, g: ['organic', 'diss', 'living'] });
def('stem', 'Stem', 'Life', S_, [60, 160, 60], { hide: 1, hard: .05, ign: 230, ip: .3, burn: [20, 500, 'ash'], flam: .3, awake: 1, hi: [150, 'deadplant'], g: ['organic', 'diss', 'living', 'greens'] });
def('petal', 'Petals', 'Life', S_, [240, 90, 160], { hard: .05, ign: 220, ip: .4, burn: [10, 500, 'ash'], flam: .4, hi: [140, 'ash'], g: ['organic', 'diss', 'living'] });
def('cactus', 'Cactus', 'Life', S_, [60, 140, 70], { hard: .15, var: .1, awake: 1, aux0: 6, ign: 300, burn: [40, 500, 'ash'], flam: .1, g: ['organic', 'diss', 'living', 'greens'] });
def('spore', 'Spores', 'Life', P_, [180, 160, 140], { dens: 300, slide: .6, awake: 1, g: ['organic', 'diss', 'living'] });
def('mushroom', 'Mushroom', 'Life', S_, [200, 80, 70], { hard: .05, var: .15, ign: 260, burn: [20, 500, 'ash'], flam: .2, g: ['organic', 'diss', 'living', 'food'] });
def('algae', 'Algae', 'Life', P_, [60, 130, 70], { dens: 1001, slide: .6, awake: 1, hi: [80, 'deadplant'], g: ['organic', 'diss', 'living'] });
def('moss', 'Moss', 'Life', S_, [80, 120, 50], { hard: .05, var: .2, awake: 1, hi: [120, 'deadplant'], ign: 300, burn: [20, 400, 'ash'], flam: .1, g: ['organic', 'diss', 'living', 'greens'] });
def('deadplant', 'Dead Plant', 'Life', P_, [150, 130, 70], { dens: 400, slide: .5, ign: 200, ip: .5, burn: [15, 500, 'ash'], flam: .5, g: ['organic', 'diss'] });
def('bamboo', 'Bamboo', 'Life', S_, [150, 190, 80], { hard: .3, awake: 1, aux0: 25, ign: 260, burn: [60, 600, 'ash'], flam: .15, g: ['organic', 'diss', 'living', 'greens'] });
// ---- Special
def('antimatter', 'Antimatter', 'Special', P_, [255, 80, 220], { dens: 1000, slide: .8, self: 1, glow: [255, 80, 220, 2], awake: 1, danger: 1, desc: 'Annihilates whatever it touches.' });
def('blackhole', 'Black Hole', 'Special', S_, [8, 0, 14], { unb: 1, hard: 1, awake: 1, desc: 'Pulls things in and deletes them.' });
def('rainbow', 'Rainbow', 'Special', S_, [255, 0, 0], { hard: .5, self: 1 });
def('glitter', 'Glitter', 'Special', P_, [230, 200, 255], { dens: 1100, slide: .9, self: 1 });
def('confetti', 'Confetti', 'Special', P_, [255, 100, 100], { dens: 200, slide: .5, self: 1, ign: 230, burn: [10, 400, 'ash'], flam: .3 });
def('bubble', 'Bubble', 'Special', G_, [200, 230, 255], { dens: 80, life: [60, 200], mv: .4, alpha: .45, awake: 1, leak: 0 });
