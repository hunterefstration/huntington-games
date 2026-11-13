// ============================================================
// DATA: the wardrobe (cosmetics), the fame track, bot names and the round list.
// ============================================================
const ITEMS = [];
const item = (cat, id, name, price, extra) => ITEMS.push(Object.assign({ cat, id, name, price }, extra || {}));
// colours (used for the main and the second colour)
[['c0', 'Bubblegum', 0xff5fa2, 0], ['c1', 'Sunny', 0xffd23f, 0], ['c2', 'Sky', 0x3fb8ff, 0], ['c3', 'Lime', 0x7ee23a, 0], ['c4', 'Tangerine', 0xff8a2b, 0],
 ['c5', 'Snow', 0xf4f1ea, 0], ['c6', 'Grape', 0x9a5cff, 60], ['c7', 'Mint', 0x52f2c2, 60], ['c8', 'Cherry', 0xe8324a, 60], ['c9', 'Ink', 0x2f3247, 80],
 ['c10', 'Coral', 0xff7f6b, 80], ['c11', 'Lagoon', 0x1fc9d6, 80], ['c12', 'Lemonade', 0xfff17a, 100], ['c13', 'Cocoa', 0x8a5a3c, 100], ['c14', 'Royal', 0x3550ff, 120],
 ['c15', 'Lavender', 0xc9a8ff, 120], ['c16', 'Gold', 0xf2b705, 0, 12], ['c17', 'Neon', 0x39ff14, 0, 20]]
    .forEach(([id, n, hex, p, lvl]) => item('col', id, n, p, { hex, lvl }));
// patterns: drawn by the body shader (see 30-world.js), 0 = solid
[['p0', 'Plain', 0, 0], ['p1', 'Stripes', 1, 80], ['p2', 'Polka', 2, 80], ['p3', 'Two-tone', 3, 100], ['p4', 'Belly', 4, 60],
 ['p5', 'Zigzag', 5, 140], ['p6', 'Checkers', 6, 140], ['p7', 'Spots', 7, 0, 6], ['p8', 'Sunset fade', 8, 160], ['p9', 'Starry', 9, 0, 16]]
    .forEach(([id, n, k, p, lvl]) => item('pat', id, n, p, { k, lvl }));
// hats: built in 30-world.js (hatGeometry)
[['h0', 'None', 0], ['h1', 'Ball cap', 60], ['h2', 'Party cone', 60], ['h3', 'Top hat', 120], ['h4', 'Antenna', 0, 3], ['h5', 'Bobble beanie', 100],
 ['h6', 'Horns', 150], ['h7', 'Chef hat', 150], ['h8', 'Halo', 0, 10], ['h9', 'Propeller', 180], ['h10', 'Bunny ears', 160], ['h11', 'Daisy', 90],
 ['h12', 'Traffic cone', 130], ['h13', 'Wizard hat', 220], ['h14', 'Headphones', 0, 8], ['h15', 'Viking helm', 0, 25]]
    .forEach(([id, n, p, lvl]) => item('hat', id, n, p, { lvl }));
// visors: glass tint + eye glow
[['v0', 'Classic', 0x1b2340, 0x7cf9ff, 0], ['v1', 'Sunset', 0x40141f, 0xffb347, 60], ['v2', 'Toxic', 0x0f2a12, 0x8dff5a, 80], ['v3', 'Love', 0x3a0f2c, 0xff6ec7, 80],
 ['v4', 'Mirror', 0xc8d6e5, 0x1b2340, 120], ['v5', 'Ember', 0x2b0d05, 0xff4b1f, 0, 5], ['v6', 'Ghost', 0xe9f3ff, 0x6b8cff, 150], ['v7', 'Gold rim', 0x3b2a05, 0xffe066, 0, 18]]
    .forEach(([id, n, glass, eye, p, lvl]) => item('visor', id, n, p, { glass, eye, lvl }));
// trails: particles behind a running Tumbler
[['t0', 'None', 0, 0], ['t1', 'Dust puffs', 0xffffff, 0, 2], ['t2', 'Rainbow', -1, 200], ['t3', 'Hearts', 0xff5fa2, 150], ['t4', 'Sparks', 0xffd23f, 150],
 ['t5', 'Bubbles', 0x7fe7ff, 120], ['t6', 'Leaves', 0x7ee23a, 0, 14], ['t7', 'Stardust', 0xc9a8ff, 0, 22]]
    .forEach(([id, n, hex, p, lvl]) => item('trail', id, n, p, { hex, lvl }));
// victory poses (winner ceremony, lobby)
[['e0', 'Wave', 0], ['e1', 'Flex', 80], ['e2', 'Spin', 100], ['e3', 'Bounce', 0, 4], ['e4', 'Robot', 140], ['e5', 'Cheer', 120], ['e6', 'Moonwalk', 0, 28]]
    .forEach(([id, n, p, lvl]) => item('pose', id, n, p, { lvl }));
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const SLOT_CAT = { col: 'col', col2: 'col', pat: 'pat', hat: 'hat', visor: 'visor', trail: 'trail', pose: 'pose' };
const CATS = [['col', 'Colour'], ['col2', 'Second colour'], ['pat', 'Pattern'], ['hat', 'Hat'], ['visor', 'Visor'], ['trail', 'Trail'], ['pose', 'Victory pose']];
const FAME_MAX = 30;
const fameNeed = l => 80 + l * 40;                  // fame to go from level l to l+1
function fameLevel(f) { let l = 1; while (l < FAME_MAX && f >= fameNeed(l)) { f -= fameNeed(l); l++; } return l; }
function fameProgress(f) { let l = 1; while (l < FAME_MAX && f >= fameNeed(l)) { f -= fameNeed(l); l++; } return { lvl: l, have: f, need: fameNeed(l) }; }
function itemOwned(it, s) { s = s || save; if (!it) return false; if (it.lvl) return fameLevel(s.fame) >= it.lvl || !!s.owned[it.id]; return it.price === 0 || !!s.owned[it.id]; }
const LOOK_SLOTS = ['col', 'col2', 'pat', 'hat', 'visor', 'trail', 'pose'];
function sanitizeLook(l) {     // looks from the network: unknown ids fall back to defaults
    const d = defaultSave().look, o = {};
    for (const k of LOOK_SLOTS) o[k] = l && ITEM[l[k]] && ITEM[l[k]].cat === SLOT_CAT[k] ? l[k] : d[k];
    return o;
}
function randomLook(rnd) {
    const pick = cat => { const a = ITEMS.filter(i => i.cat === cat); return a[Math.floor(rnd() * a.length)].id; };
    const l = { col: pick('col'), col2: pick('col'), pat: pick('pat'), hat: rnd() < 0.55 ? pick('hat') : 'h0', visor: pick('visor'), trail: rnd() < 0.3 ? pick('trail') : 't0', pose: pick('pose') };
    if (l.col2 === l.col) l.col2 = 'c5';
    return l;
}
const BOT_NAMES = ['Wobblesworth', 'Bolt Nibbler', 'Sir Topple', 'Pudding Pete', 'Zippy Rex', 'Mochi', 'Bumble Bot', 'Captain Clank', 'Noodle', 'Professor Bonk',
    'Jellybean', 'Rusty Spud', 'Turbo Tot', 'Gizmo Gus', 'Pickles', 'Dizzy Dot', 'Waffles', 'Sprocket', 'Biscuit', 'Fizzwhit', 'Marbles', 'Tater Chip',
    'Boing Boing', 'Sparky Sue', 'Clunk', 'Puddle Jumper', 'Grumbles', 'Cosmo', 'Lil Rivet', 'Tumbleweed', 'Sprout', 'Wigglebot'];
const SKILLS = ['Easy', 'Normal', 'Hard'];
// The round list. kind: race | survive | team | final. min = fewest contestants it needs (knockout shows).
const ROUND_INFO = {
    spin: { name: 'Spin Cycle', kind: 'race', time: 120, min: 2, desc: 'Dodge the spinning bars and swinging hammers, ride the turntables and reach the finish!' },
    teeter: { name: 'Teeter Trek', kind: 'race', time: 120, min: 2, desc: 'Cross the rocking see-saw bridges and dodge the pushers. Mind the gaps!' },
    goo: { name: 'Goo Rush', kind: 'race', time: 120, min: 2, desc: 'Climb to the top before the rising goo catches you. Touch the goo and you are out!' },
    doors: { name: 'Door Dash', kind: 'race', time: 120, min: 2, desc: 'Burst through the doors - but some are fake and solid! Conveyor belts in between.' },
    boulder: { name: 'Boulder Hill', kind: 'race', time: 120, min: 2, desc: 'Run up the hill while giant boulders roll down at you. Hide behind the posts!' },
    beam: { name: 'Beam Jumper', kind: 'survive', time: 80, min: 2, desc: 'Jump the sweeping beam and duck the high one. It keeps getting faster. Stay on!' },
    tiles: { name: 'Vanishing Tiles', kind: 'survive', time: 90, min: 2, desc: 'Tiles drop away a moment after you step on them. Three floors. Do not fall!' },
    squeeze: { name: 'Squeeze Plate', kind: 'survive', time: 80, min: 2, desc: 'The platform shrinks and the wind pushes. Fight your way to the middle!' },
    fruit: { name: 'Fruit Memory', kind: 'survive', time: 90, min: 2, desc: 'Remember the fruit on each tile. When a fruit is called, stand on it - the rest drop!' },
    tail: { name: 'Tail Chase', kind: 'team', time: 75, min: 4, desc: 'Grab a tail (F or click) from someone who has one. Have a tail when time runs out!' },
    hoard: { name: 'Ball Hoard', kind: 'team', time: 90, min: 6, desc: 'Teams push the big balls into their own pen. The team with the fewest balls is out!' },
    hoops: { name: 'Hoop Hop', kind: 'team', time: 80, min: 6, desc: 'Jump through the glowing hoops to score for your team. Use the bounce pads!' },
    crown: { name: 'Crown Peak', kind: 'final', time: 150, min: 1, desc: 'The final climb! First Tumbler to grab the crown at the top wins the show!' },
    hex: { name: 'Hex Drop', kind: 'final', time: 150, min: 1, desc: 'The final! Hex tiles fall when stepped on. Last Tumbler standing wins!' }
};
const KIND_LABEL = { race: 'Race', survive: 'Survival', team: 'Team', final: 'Final' };
const TEAM_COLS = [0xff4f6d, 0x3fa9ff, 0xffd23f, 0x7ee23a];
const TEAM_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];
