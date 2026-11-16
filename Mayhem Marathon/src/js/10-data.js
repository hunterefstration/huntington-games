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
// 1.1: earned items (see earned() below): unlocked by playing the new rounds, never bought
[['c18', 'Mossy log', 0x5b8c32, { r: 'logs', k: 'q', n: 3 }], ['c19', 'Storm cloud', 0x6f86a6, { r: 'gust', k: 'q', n: 3 }], ['c20', 'Molten', 0xff5a1f, { r: 'pillars', k: 'q', n: 3 }],
 ['c21', 'Platinum', 0xdfe3ea, { s: 'crowns', n: 5 }]].forEach(([id, n, hex, earn]) => item('col', id, n, 0, { hex, earn }));
// patterns: drawn by the body shader (see 30-world.js), 0 = solid
[['p0', 'Plain', 0, 0], ['p1', 'Stripes', 1, 80], ['p2', 'Polka', 2, 80], ['p3', 'Two-tone', 3, 100], ['p4', 'Belly', 4, 60],
 ['p5', 'Zigzag', 5, 140], ['p6', 'Checkers', 6, 140], ['p7', 'Spots', 7, 0, 6], ['p8', 'Sunset fade', 8, 160], ['p9', 'Starry', 9, 0, 16]]
    .forEach(([id, n, k, p, lvl]) => item('pat', id, n, p, { k, lvl }));
[['p10', 'Paint splats', 10, { r: 'turf', k: 'q', n: 2 }], ['p11', 'Hazard stripes', 11, { r: 'bomb', k: 'q', n: 2 }], ['p12', 'Lava cracks', 12, { r: 'meteor', k: 'q', n: 2 }]]
    .forEach(([id, n, k, earn]) => item('pat', id, n, 0, { k, earn }));
// hats: built in 30-world.js (hatGeometry)
[['h0', 'None', 0], ['h1', 'Ball cap', 60], ['h2', 'Party cone', 60], ['h3', 'Top hat', 120], ['h4', 'Antenna', 0, 3], ['h5', 'Bobble beanie', 100],
 ['h6', 'Horns', 150], ['h7', 'Chef hat', 150], ['h8', 'Halo', 0, 10], ['h9', 'Propeller', 180], ['h10', 'Bunny ears', 160], ['h11', 'Daisy', 90],
 ['h12', 'Traffic cone', 130], ['h13', 'Wizard hat', 220], ['h14', 'Headphones', 0, 8], ['h15', 'Viking helm', 0, 25]]
    .forEach(([id, n, p, lvl]) => item('hat', id, n, p, { lvl }));
[['h16', 'Lumberjack cap', { r: 'logs', k: 'q', n: 1 }], ['h17', 'Pinwheel', { r: 'gust', k: 'q', n: 1 }], ['h18', 'Meteor hat', { r: 'meteor', k: 'q', n: 1 }],
 ['h19', 'Paint bucket', { r: 'turf', k: 'q', n: 1 }], ['h20', 'Fuse beanie', { r: 'bomb', k: 'q', n: 1 }], ['h21', 'Flame crest', { r: 'pillars', k: 'q', n: 1 }],
 ['h22', 'Laurel wreath', { r: 'hill', k: 'w', n: 1 }]].forEach(([id, n, earn]) => item('hat', id, n, 0, { earn }));
// visors: glass tint + eye glow
[['v0', 'Classic', 0x1b2340, 0x7cf9ff, 0], ['v1', 'Sunset', 0x40141f, 0xffb347, 60], ['v2', 'Toxic', 0x0f2a12, 0x8dff5a, 80], ['v3', 'Love', 0x3a0f2c, 0xff6ec7, 80],
 ['v4', 'Mirror', 0xc8d6e5, 0x1b2340, 120], ['v5', 'Ember', 0x2b0d05, 0xff4b1f, 0, 5], ['v6', 'Ghost', 0xe9f3ff, 0x6b8cff, 150], ['v7', 'Gold rim', 0x3b2a05, 0xffe066, 0, 18]]
    .forEach(([id, n, glass, eye, p, lvl]) => item('visor', id, n, p, { glass, eye, lvl }));
[['v8', 'Starlight', 0x0b0f2e, 0xfff3a0, { r: 'meteor', k: 'q', n: 3 }], ['v9', 'Paint pop', 0x2a0b3a, 0x52f2c2, { r: 'turf', k: 'q', n: 3 }]]
    .forEach(([id, n, glass, eye, earn]) => item('visor', id, n, 0, { glass, eye, earn }));
// trails: particles behind a running Tumbler
[['t0', 'None', 0, 0], ['t1', 'Dust puffs', 0xffffff, 0, 2], ['t2', 'Rainbow', -1, 200], ['t3', 'Hearts', 0xff5fa2, 150], ['t4', 'Sparks', 0xffd23f, 150],
 ['t5', 'Bubbles', 0x7fe7ff, 120], ['t6', 'Leaves', 0x7ee23a, 0, 14], ['t7', 'Stardust', 0xc9a8ff, 0, 22]]
    .forEach(([id, n, hex, p, lvl]) => item('trail', id, n, p, { hex, lvl }));
[['t8', 'Paint drips', 0x52f2c2, { r: 'turf', k: 'q', n: 5 }], ['t9', 'Embers', 0xff6a1f, { r: 'pillars', k: 'q', n: 5 }], ['t10', 'Gold coins', 0xf2b705, { s: 'crowns', n: 3 }]]
    .forEach(([id, n, hex, earn]) => item('trail', id, n, 0, { hex, earn }));
// victory poses (winner ceremony, lobby)
[['e0', 'Wave', 0], ['e1', 'Flex', 80], ['e2', 'Spin', 100], ['e3', 'Bounce', 0, 4], ['e4', 'Robot', 140], ['e5', 'Cheer', 120], ['e6', 'Moonwalk', 0, 28]]
    .forEach(([id, n, p, lvl]) => item('pose', id, n, p, { lvl }));
[['e7', 'Hula', { r: 'bomb', k: 'q', n: 3 }], ['e8', 'Jumping jacks', { new: 7 }], ['e9', 'Royal wave', { r: 'hill', k: 'w', n: 1 }]]
    .forEach(([id, n, earn]) => item('pose', id, n, 0, { earn }));
// crown celebrations: what plays when YOU win a show (podium effects, and a grander crown the higher the tier)
[['k0', 'Confetti'], ['k1', 'Fireworks', { s: 'crowns', n: 1 }], ['k2', 'Gold rain', { s: 'crowns', n: 3 }], ['k3', 'Meteor shower', { r: 'meteor', k: 'q', n: 5 }],
 ['k4', 'Royal fanfare', { r: 'hill', k: 'w', n: 1 }], ['k5', 'Rainbow storm', { s: 'crowns', n: 10 }]]
    .forEach(([id, n, earn], i) => item('cel', id, n, 0, { earn, tier: i }));
const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));
const SLOT_CAT = { col: 'col', col2: 'col', pat: 'pat', hat: 'hat', visor: 'visor', trail: 'trail', pose: 'pose', cel: 'cel' };
const CATS = [['col', 'Colour'], ['col2', 'Second colour'], ['pat', 'Pattern'], ['hat', 'Hat'], ['visor', 'Visor'], ['trail', 'Trail'], ['pose', 'Victory pose'], ['cel', 'Crown celebration']];
// earned items: { r: round id, k: 'p' played | 'q' qualified/survived | 'w' won, n } or { s: stats key, n } or { new: n } (play n of the 1.1 rounds)
const NEW_ROUNDS = ['logs', 'gust', 'meteor', 'pillars', 'turf', 'bomb', 'hill'];
function earned(e, s) {
    s = s || save; const rp = s.rp || {};
    if (e.r) return ((rp[e.r] || {})[e.k] || 0) >= e.n;
    if (e.s) return (s.stats[e.s] || 0) >= e.n;
    if (e.new) return NEW_ROUNDS.filter(r => (rp[r] || {}).p > 0).length >= e.new;
    return false;
}
function earnText(e) {
    if (e.s === 'crowns') return e.n === 1 ? 'Win a show' : 'Win ' + e.n + ' shows';
    if (e.new) return 'Play all ' + e.new + ' new rounds';
    const nm = ROUND_INFO[e.r] ? ROUND_INFO[e.r].name : e.r, x = e.n === 1 ? '' : ' ' + e.n + ' times';
    if (e.k === 'w') return 'Win ' + nm + x;
    return (ROUND_INFO[e.r] && ROUND_INFO[e.r].kind === 'survive' ? 'Survive ' : 'Qualify in ') + nm + x;
}
const FAME_MAX = 30;
const fameNeed = l => 80 + l * 40;                  // fame to go from level l to l+1
function fameLevel(f) { let l = 1; while (l < FAME_MAX && f >= fameNeed(l)) { f -= fameNeed(l); l++; } return l; }
function fameProgress(f) { let l = 1; while (l < FAME_MAX && f >= fameNeed(l)) { f -= fameNeed(l); l++; } return { lvl: l, have: f, need: fameNeed(l) }; }
function itemOwned(it, s) { s = s || save; if (!it) return false; if (it.earn) return earned(it.earn, s) || !!s.owned[it.id]; if (it.lvl) return fameLevel(s.fame) >= it.lvl || !!s.owned[it.id]; return it.price === 0 || !!s.owned[it.id]; }
const LOOK_SLOTS = ['col', 'col2', 'pat', 'hat', 'visor', 'trail', 'pose', 'cel'];
function sanitizeLook(l) {     // looks from the network: unknown ids fall back to defaults
    const d = defaultSave().look, o = {};
    for (const k of LOOK_SLOTS) o[k] = l && ITEM[l[k]] && ITEM[l[k]].cat === SLOT_CAT[k] ? l[k] : d[k];
    return o;
}
function randomLook(rnd) {
    const pick = cat => { const a = ITEMS.filter(i => i.cat === cat); return a[Math.floor(rnd() * a.length)].id; };
    const l = { col: pick('col'), col2: pick('col'), pat: pick('pat'), hat: rnd() < 0.55 ? pick('hat') : 'h0', visor: pick('visor'), trail: rnd() < 0.3 ? pick('trail') : 't0', pose: pick('pose'), cel: rnd() < 0.3 ? pick('cel') : 'k0' };
    if (l.col2 === l.col) l.col2 = 'c5';
    return l;
}
const BOT_NAMES = ['Wobblesworth', 'Bolt Nibbler', 'Sir Topple', 'Pudding Pete', 'Zippy Rex', 'Mochi', 'Bumble Bot', 'Captain Clank', 'Noodle', 'Professor Bonk',
    'Jellybean', 'Rusty Spud', 'Turbo Tot', 'Gizmo Gus', 'Pickles', 'Dizzy Dot', 'Waffles', 'Sprocket', 'Biscuit', 'Fizzwhit', 'Marbles', 'Tater Chip',
    'Boing Boing', 'Sparky Sue', 'Clunk', 'Puddle Jumper', 'Grumbles', 'Cosmo', 'Lil Rivet', 'Tumbleweed', 'Sprout', 'Wigglebot'];
const SKILLS = ['Easy', 'Normal', 'Hard'];
// The round list. kind: race | survive | team | hunt | final. min = fewest contestants it needs (knockout shows).
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
    logs: { name: 'Log Jam', kind: 'race', time: 120, min: 2, desc: 'Run up the rolling logs, jump the logs rolling at you and balance across the spinning log bridges!' },
    gust: { name: 'Gust Gauntlet', kind: 'race', time: 120, min: 2, desc: 'Slip past the windmills, then cross the narrow bridges while giant fans blow you sideways. Lean into the wind!' },
    meteor: { name: 'Meteor Mayhem', kind: 'survive', time: 80, min: 2, desc: 'Meteors are falling! Get out of the red rings - every hit blasts a hole in the floor. Stay on!' },
    pillars: { name: 'Lava Pillars', kind: 'survive', time: 85, min: 2, desc: 'Hop between pillars over the lava. Shaking pillars sink a moment later - keep jumping to safe ones!' },
    turf: { name: 'Turf War', kind: 'team', time: 70, min: 6, desc: 'Run over the floor to paint it your team colour. The team with the least floor painted is out!' },
    bomb: { name: 'Bomb Tag', kind: 'hunt', time: 55, min: 4, desc: 'Got a bomb? Grab someone (F or click) to pass it on! Whoever holds a bomb when the fuse runs out is OUT.' },
    hill: { name: 'Summit Showdown', kind: 'final', time: 120, min: 1, desc: 'The final! Stand on the summit to fill your meter - first to fill it wins the crown. Shove the others off!' },
    crown: { name: 'Crown Peak', kind: 'final', time: 150, min: 1, desc: 'The final climb! First Tumbler to grab the crown at the top wins the show!' },
    hex: { name: 'Hex Drop', kind: 'final', time: 150, min: 1, desc: 'The final! Hex tiles fall when stepped on. Last Tumbler standing wins!' }
};
const KIND_LABEL = { race: 'Race', survive: 'Survival', team: 'Team', hunt: 'Hunt', final: 'Final' };
// ---------- version, multiplayer protocol and What's New ----------
const VERSION = '1.1', PROTO = 2;          // PROTO: rooms only admit players with the same number (see 70-net.js)
const WHATS_NEW = [
    '7 new rounds (21 in all): the Log Jam and Gust Gauntlet races, Meteor Mayhem and Lava Pillars survival, Turf War (team), Bomb Tag (a new Hunt round) and the Summit Showdown final.',
    'Custom shows: pick exactly which rounds a show can use (solo, or as the host of a room).',
    '22 new things to wear, earned by playing the new rounds: 7 hats, colours, patterns, visors, trails and 3 poses.',
    'Crown celebrations: win shows to unlock fireworks, gold rain and more for your winner podium, with a grander crown each tier.',
    'Bots know how to play every new round, and Mayhem Marathon now has achievements in the launcher.'
];

const TEAM_COLS = [0xff4f6d, 0x3fa9ff, 0xffd23f, 0x7ee23a];
const TEAM_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];
