// ---------------- 3.0 General perks: commander XP from battles buys perks in three branches ----------------
// They work in Quick Battles, the Campaign and Endless War, and are off in online battles (so those stay fair).
// tier 1 is open at once, tier 2 needs 3 points in that branch, tier 3 needs 6. mod = per rank, added to the army's modifiers.
const GEN_BR = [{ id: 'eco', n: 'Economy', c: '#f6c04e', d: 'More money, cheaper troops and buildings, a bigger army.' }, { id: 'atk', n: 'Assault', c: '#ff8a5a', d: 'Harder hitting, faster troops and quicker Support powers.' }, { id: 'def', n: 'Defense', c: '#5aa9ff', d: 'Tougher troops and buildings, sharper eyes and self-repair.' }];
const GEN = [
  { id: 'funds', br: 'eco', tier: 1, n: 'War Funds', max: 3, d: r => 'Start every battle (and every new Endless War) with ' + 150 * r + ' more money.' },
  { id: 'supply', br: 'eco', tier: 1, n: 'Supply Network', max: 3, d: r => 'Earn ' + 5 * r + '% more money.', mod: { inc: .05 } },
  { id: 'bulk', br: 'eco', tier: 2, n: 'Bulk Orders', max: 2, d: r => 'Every troop costs ' + 4 * r + '% less.', mod: { cost: -.04 } },
  { id: 'contract', br: 'eco', tier: 2, n: 'Contractors', max: 2, d: r => 'Buildings and level-ups cost ' + 8 * r + '% less.' },
  { id: 'quarter', br: 'eco', tier: 3, n: 'Quartermaster Corps', max: 2, d: r => 'Army limit +' + 8 * r + '.', mod: { pop: 8 } },
  { id: 'spoils', br: 'eco', tier: 3, n: 'Spoils of War', max: 1, d: () => 'Earn 10% of the cost of every enemy troop you destroy.' },
  { id: 'aim', br: 'atk', tier: 1, n: 'Sharpshooters', max: 3, d: r => 'Bullets, pulse guns and rail rifles do ' + 4 * r + '% more damage.', mod: { dmgBul: .04 } },
  { id: 'charges', br: 'atk', tier: 1, n: 'Shaped Charges', max: 3, d: r => 'Rockets, cannons and plasma do ' + 4 * r + '% more damage.', mod: { dmgAT: .04 } },
  { id: 'advance', br: 'atk', tier: 2, n: 'Rapid Advance', max: 2, d: r => 'Soldiers and vehicles move ' + 4 * r + '% faster.', mod: { spdInf: .04, spdVeh: .04 } },
  { id: 'hardened', br: 'atk', tier: 2, n: 'Battle Hardened', max: 2, d: r => 'Troops rank up ' + 15 * r + '% faster.', mod: { xp: .15 } },
  { id: 'fire', br: 'atk', tier: 3, n: 'Fire Support', max: 2, d: r => 'Support powers recharge ' + 8 * r + '% faster; artillery, ships and bombs hit ' + 5 * r + '% harder.', mod: { callCd: -.08, dmgShell: .05 } },
  { id: 'spear', br: 'atk', tier: 3, n: 'Spearhead', max: 1, d: () => 'Start every battle with 2 Light Tanks (Hover Tanks for the Iron Legion).' },
  { id: 'concrete', br: 'def', tier: 1, n: 'Reinforced Concrete', max: 3, d: r => 'Buildings have ' + 6 * r + '% more health.', mod: { hpBld: .06 } },
  { id: 'armor', br: 'def', tier: 1, n: 'Field Armor', max: 3, d: r => 'Soldiers have ' + 5 * r + '% more health, vehicles and ships ' + 4 * r + '% more.', mod: { hpInf: .05, hpVeh: .04, hpHvy: .04 } },
  { id: 'watch', br: 'def', tier: 2, n: 'Lookouts', max: 2, d: r => 'Your troops see ' + 8 * r + '% farther (great at night and in fog).', mod: { vis: .08 } },
  { id: 'medics', br: 'def', tier: 2, n: 'Field Medicine', max: 2, d: r => 'Medics heal ' + 12 * r + '% faster and energy shields hold ' + 10 * r + '% more.', mod: { heal: .12, shCap: .1 } },
  { id: 'repair', br: 'def', tier: 3, n: 'Repair Crews', max: 2, d: r => 'Damaged buildings repair themselves (' + r + '% a second) after 8 seconds out of combat.' },
  { id: 'dugin', br: 'def', tier: 3, n: 'Dug In', max: 1, d: () => 'Your HQ starts every battle ringed with Fortified Walls.' }
];
const GENBY = {}; GEN.forEach(g => GENBY[g.id] = g);
const GEN_TIER = [0, 0, 3, 6];
function genXp(k) { return 50 * k + 8 * k * k; }                          // total XP needed for the k-th point
function genPts(xp) { let k = 0; while (genXp(k + 1) <= xp) k++; return k; }
function genSpent(G, br) { let n = 0; for (const k in G) if (GENBY[k] && (!br || GENBY[k].br === br)) n += G[k] | 0; return n; }
function genFree() { return genPts(PROF.xp) - genSpent(PROF.gen); }
function genActive() { const G = PROF.gen || {}, o = {}; for (const k in G) if (GENBY[k] && G[k] > 0) o[k] = Math.min(G[k] | 0, GENBY[k].max); return o; }
function genCanBuy(id) { const g = GENBY[id], G = PROF.gen, r = G[id] | 0; if (!g || r >= g.max) return 'max'; if (genSpent(G, g.br) < GEN_TIER[g.tier]) return 'tier'; if (genFree() <= 0) return 'pts'; return ''; }
// Doctrines (Campaign / Endless War) and General perks, summed into one set of army modifiers
function perkModOf(D, G) { const o = {}; for (const id in D || {}) { const d = DOCS[id]; if (d && d.mod) for (const k in d.mod) o[k] = (o[k] || 0) + d.mod[k] * D[id]; } for (const id in G || {}) { const g = GENBY[id]; if (g && g.mod) for (const k in g.mod) o[k] = (o[k] || 0) + g.mod[k] * G[id]; } return o; }
// profile XP for a battle or a wave; returns what the results screen should show
function grantXp(xp) { const r0 = rankOf(PROF.xp), g0 = genPts(PROF.xp); PROF.xp += xp; const r1_ = rankOf(PROF.xp); return { rankUp: r1_ > r0 ? RANKS[r1_][0] : '', genUp: genPts(PROF.xp) - g0 }; }
// =====================================================================
//  MAPS: procedural, symmetric, deterministic
// =====================================================================
const BIOME = {
  grass: { sky: 0xb7dcf0, fog: 0xcfe6ee, low: 0xd2c795, mid: 0x86b360, high: 0x95ba6c, cliff: 0x8f9a74, water: 0x5fa6d4, trees: [0, 0, 1, 1, 0], sun: 0xfff4e0, hemi: 0xd8ecff, grd: 0x6e7f58 },
  desert: { sky: 0xf0dfb8, fog: 0xeedcb2, low: 0xe8d098, mid: 0xdfbd80, high: 0xd2a96c, cliff: 0xad8862, water: 0x62b2c0, trees: [3, 3, 4, 3, 4], sun: 0xfff0d0, hemi: 0xfff1d8, grd: 0x9a7a52 },
  jungle: { sky: 0xb4e0d6, fog: 0xc2e4d8, low: 0xbcad7a, mid: 0x62a058, high: 0x7cac60, cliff: 0x84806a, water: 0x4aa4a8, trees: [2, 2, 2, 0, 2], sun: 0xfff6dc, hemi: 0xd0f2e4, grd: 0x476a40 },
  snow: { sky: 0xcfe3f2, fog: 0xdeeaf3, low: 0xd6e2ec, mid: 0xf0f5f9, high: 0xe2eaf2, cliff: 0xa8b2be, water: 0xaedcf0, trees: [5, 5, 5, 1, 5], sun: 0xfdfdff, hemi: 0xe6f0fc, grd: 0xa4b2c4 },
  urban: { sky: 0xbfcad4, fog: 0xcfd7de, low: 0xa59f90, mid: 0x939a96, high: 0x868d8e, cliff: 0x77797a, water: 0x5d849c, trees: [4, 0, 4, 0, 4], sun: 0xfff1de, hemi: 0xd4dee8, grd: 0x6a6f74 },
  coast: { sky: 0xaed6ee, fog: 0xc6e2f0, low: 0xe2d3a0, mid: 0x7fb25e, high: 0x8fb46a, cliff: 0x9a9480, water: 0x3f8fc4, trees: [3, 0, 2, 0, 3], sun: 0xfff3dc, hemi: 0xd6ecff, grd: 0x6a7c58 }
};
// 3.0 battle conditions: weather and night. vis = how far everyone sees (units; buildings keep their floodlights at night),
// spdI / spdV = soldier / vehicle speed, acc = hit chance of guns. Night and fog always turn fog of war on.
const WXD = {
  clear: { n: 'Clear', vis: 1, spdI: 1, spdV: 1, acc: 1, d: '' },
  rain: { n: 'Rain', vis: .85, spdI: .96, spdV: .9, acc: .9, d: 'Rain: vehicles bog down in the mud (10% slower) and guns miss more often. With fog of war on, everyone sees 15% less. Lightning now and then.' },
  fog: { n: 'Fog', vis: .6, spdI: 1, spdV: 1, acc: .95, fog: 1, d: 'Thick fog: everyone sees 40% less, so fog of war is always on. Scouts, radar and recon flights matter more than ever.' },
  snow: { n: 'Snow', vis: .8, spdI: .9, spdV: .88, acc: 1, d: 'Snowstorm: soldiers and vehicles move 10-12% slower. With fog of war on, everyone sees 20% less.' }
};
const TODD = { day: { n: 'Day', vis: 1 }, night: { n: 'Night', vis: .65, fog: 1, d: 'Night: troops see a third less and fog of war is always on. Muzzle flashes give away whoever fires, vehicles drive with headlights, and HQs and towers sweep searchlights that spot enemies.' } };
function wxOf(o) { const w = WXD[o.weather] ? o.weather : 'clear', W0 = WXD[w], nt = o.tod === 'night', T = TODD[nt ? 'night' : 'day']; return { w, night: nt, vis: W0.vis * T.vis, bvis: W0.vis, spdI: W0.spdI, spdV: W0.spdV, acc: W0.acc, fog: !!(W0.fog || T.fog) }; }
function wxName(o) { const w = WXD[o.weather] ? o.weather : 'clear'; return (o.tod === 'night' ? 'Night' : 'Day') + (w !== 'clear' ? ', ' + WXD[w].n : ''); }
// resolve a menu choice ('map' = the map's own conditions, 'random') into a battle's tod / weather
function pickWx(def, tod, wx) {
  const t = tod === 'random' ? (Math.random() < .45 ? 'night' : 'day') : tod === 'day' || tod === 'night' ? tod : def.tod || 'day';
  const w = wx === 'random' ? ['clear', 'clear', 'rain', 'fog', 'snow'][(Math.random() * 5) | 0] : WXD[wx] ? wx : def.wx || 'clear';
  return { tod: t, weather: w };
}
// searchlights at night: HQs and these towers sweep a beam (it locks on to whatever the tower shoots at)
const SLT = { hq: 1, turret: 1, cannon: 1, flakt: 1, tesla: 1 };
function slAng(b) { return b.w ? b.aim : W.t * .35 + b.id * 1.7; }
function slDist(b) { return b.type === 'hq' ? 24 : clamp(b.w ? b.w.rng * .55 : 20, 14, 28); }
const ROTS = { 1: [(x, z) => [x, z]], 2: [(x, z) => [x, z], (x, z) => [-x, -z]], 4: [(x, z) => [x, z], (x, z) => [-z, x], (x, z) => [-x, -z], (x, z) => [z, -x]] };
const ROTA = { 1: [0], 2: [0, PI], 4: [0, -PI / 2, PI, PI / 2] };
function hash2(ix, iz, s) { let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s, 982451653); h = Math.imul(h ^ (h >>> 13), 1274126177); return (((h ^ (h >>> 16)) >>> 0) & 0xffff) / 65535; }
function vnoise(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return lerp(lerp(hash2(ix, iz, s), hash2(ix + 1, iz, s), u), lerp(hash2(ix, iz + 1, s), hash2(ix + 1, iz + 1, s), u), v); }
function segDist(px, pz, x1, z1, x2, z2) { const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz; let t = l2 > 0 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0; t = clamp(t, 0, 1); const cx = x1 + dx * t - px, cz = z1 + dz * t - pz; return Math.sqrt(cx * cx + cz * cz); }

// 3.1: the Endless War map. The Bastion sits in the middle; enemy commanders land at one of eight sites around the edge.
const WARMAP = { id: 'bastion', name: 'The Bastion', sym: 1, w: 300, d: 300, seed: 61, biome: 'grass', maxP: 2, amp: 1.3, desc: 'Your fortress on the Heart Beacon. Hold it against every wave.',
  build(m) {
    m.spawn(0, 0, 1, 'The Bastion');
    const R = 122, DIRS = ['East', 'South-East', 'South', 'South-West', 'West', 'North-West', 'North', 'North-East'];
    for (let k = 0; k < 8; k++) { const a = k * PI / 4, r = k % 2 ? R * .93 : R; m.spawn(Math.cos(a) * r, Math.sin(a) * r, 0, DIRS[k] + ' Landing'); }
    const OUT = ['Gatehouse', 'Old Mill', 'Signal Hill', 'Quarry', 'Orchard', 'Waterworks'];
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + PI / 6; m.point(Math.cos(a) * 64, Math.sin(a) * 64, OUT[k], 1.2, -1, 1); }
    const MID = ['Ash Ford', 'Red Barn', 'Stone Bridge', 'Crow Ridge', 'Dry Creek', 'Pine Hollow', 'Iron Gate', 'Lantern Rock'];
    for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; m.point(Math.cos(a) * 98, Math.sin(a) * 98, MID[k], 1, -1, 1); }
    for (let k = 0; k < 8; k++) { const a = k * PI / 4; m.road(0, 0, Math.cos(a) * R * .95, Math.sin(a) * R * .95, 4); }
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + PI / 6; m.hill(Math.cos(a) * 82, Math.sin(a) * 82, 16, 3.2, 1); m.forest(Math.cos(a + .35) * 80, Math.sin(a + .35) * 80, 14, .5); m.rocks(Math.cos(a - .3) * 74, Math.sin(a - .3) * 74, 8, 5); }
    for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; m.forest(Math.cos(a) * 125, Math.sin(a) * 125, 16, .45); m.lake(Math.cos(a + .2) * 116, Math.sin(a + .2) * 116, 8, 3, 1); }
    m.paint(0, 0, 44, 0x8f8a78, .45); m.ridge(-140, -40, -140, 40, 6, 3, 1); m.ridge(140, -40, 140, 40, 6, 3, 1);
  } };
const MAPS = [
  { id: 'greenfield', name: 'Greenfield Crossing', sym: 2, w: 240, d: 160, seed: 3, biome: 'grass', maxP: 2, amp: 1.5, desc: 'Rolling farmland split by a river. Fight for the bridge and the fords.',
    build(m) {
      m.spawn(-102, 0);
      m.ridge(0, -92, 0, 92, 12, -4.4, 1);
      m.deck(0, 0, 26, 10, PI / 2, 1.85, 1); m.deck(0, -46, 26, 12, PI / 2, -0.2, 1); m.deck(0, 46, 26, 12, PI / 2, -0.2, 1);
      m.point(-72, 10, 'Farmstead', 1, 0); m.point(-44, -52, 'North Barn', 1); m.point(-44, 44, 'Orchard', 1); m.point(-24, -8, 'Windmill Hill', 1.3); m.point(0, 0, 'Old Bridge', 2, -1, 1);
      m.hill(-26, -8, 24, 4.2); m.hill(-64, -38, 18, 2.4); m.hill(-70, 52, 16, 2.2);
      m.ridge(-18, -72, -16, -40, 6, 4.5); m.ridge(-100, -62, -78, -62, 5, 3.5);
      m.forest(-58, -34, 17, .55); m.forest(-34, 14, 12, .5); m.forest(-90, 40, 16, .5); m.forest(-14, -40, 9, .45); m.forest(-60, 30, 10, .4);
      m.rocks(-40, 4, 8, 5); m.rocks(-52, 62, 10, 6); m.rocks(-8, 28, 7, 4);
      m.road(-102, 0, -72, 10, 3); m.road(-72, 10, -24, -8, 3); m.road(-24, -8, 0, 0, 3);
      m.paint(-72, 10, 10, 0xb89a5a, .5); m.paint(-44, -52, 9, 0xb89a5a, .5); m.paint(-44, 44, 9, 0xb89a5a, .5);
      m.block(-76, 22, 6, 5, 4, .3, 0x9a6a4a); m.block(-66, 20, 5, 4, 3.5, 1.2, 0xa87d58); m.block(-46, -44, 7, 5, 4.5, 0, 0xa5543c);
    } },
  { id: 'dustbowl', name: 'Dustbowl Ridge', sym: 2, w: 240, d: 160, seed: 17, biome: 'desert', maxP: 2, amp: 1.1, desc: 'Desert canyon with raised ridges and a contested oasis in the middle.',
    build(m) {
      m.spawn(-102, 0);
      m.lake(0, -42, 12, 3.2, 1); m.lake(0, 42, 12, 3.2, 1);
      m.ridge(-34, -84, -34, -26, 9, 5.6); m.ridge(-34, 26, -34, 84, 9, 5.6);
      m.ridge(-78, -30, -58, -30, 5, 4); m.ridge(-78, 30, -58, 30, 5, 4);
      m.point(-74, 0, 'Camp Dune', 1, 0); m.point(-52, -50, 'Quarry', 1.2); m.point(-52, 50, 'Salt Mine', 1.2); m.point(-14, -40, 'Watchtower', 1.2); m.point(0, 0, 'Oasis', 2, -1, 1);
      m.hill(-50, 0, 20, 2.2); m.hill(-14, 30, 18, 3); m.hill(-86, -52, 14, 2.5);
      m.forest(-62, -18, 10, .22); m.forest(-20, 6, 9, .2); m.forest(-44, 66, 12, .25);
      m.rocks(-26, -12, 9, 7); m.rocks(-60, 22, 9, 6); m.rocks(-84, 28, 8, 5); m.rocks(-10, -62, 10, 6);
      m.road(-102, 0, -74, 0, 3); m.road(-74, 0, -34, 0, 3); m.road(-34, 0, 0, 0, 3);
      m.paint(-74, 0, 11, 0xb08a54, .5); m.paint(0, 0, 22, 0x58a860, .4);
      m.block(-70, -12, 5, 5, 3, .4, 0xb89870); m.block(-44, 42, 6, 6, 4, 1, 0xa88860);
    } },
  { id: 'corners', name: 'Four Corners', sym: 4, w: 200, d: 200, seed: 29, biome: 'jungle', maxP: 4, amp: 1.7, desc: 'Dense jungle with a base in each corner. Built for four commanders.',
    build(m) {
      m.spawn(-82, -82);
      m.point(-56, -34, 'Outpost', 1, 0); m.point(0, -76, 'Ford', 1.2); m.point(0, 0, 'Crossroads', 2.2, -1, 1);
      m.hill(0, 0, 26, 3.6, 1); m.hill(-34, -38, 14, 2.6); m.hill(-84, -40, 14, 3);
      m.lake(-42, -86, 9, 3); m.lake(-30, -16, 8, 3);
      m.ridge(-52, -58, -34, -62, 5, 3.5); m.ridge(-80, -40, -78, -24, 5, 3.5);
      m.forest(-40, -60, 18, .5); m.forest(-20, -34, 14, .5); m.forest(-72, -10, 14, .5); m.forest(-16, -60, 12, .5); m.forest(-48, -6, 13, .5); m.forest(-8, 24, 10, .45);
      m.rocks(-34, -50, 7, 5); m.rocks(-12, -14, 8, 5); m.rocks(-66, 14, 9, 5);
      m.road(-82, -82, -56, -34, 3); m.road(-56, -34, 0, 0, 3);
      m.paint(-56, -34, 10, 0x8c7a4a, .5); m.paint(0, 0, 18, 0x8f8a78, .6);
      m.block(-6, -6, 3, 3, 5, .2, 0x8d8b72); m.block(6, 6, 3, 3, 5, .6, 0x8d8b72); m.block(-6, 6, 3, 3, 4, 0, 0x8d8b72); m.block(6, -6, 3, 3, 4.5, 0, 0x8d8b72);
    } },
  { id: 'frostbite', name: 'Frostbite Basin', sym: 4, w: 200, d: 200, seed: 41, biome: 'snow', maxP: 4, amp: 1.2, desc: 'A frozen basin. Hold the island in the middle, behind four ice causeways.',
    build(m) {
      m.spawn(0, -84);
      m.lake(0, 0, 40, 4.2, 1);
      m.deck(0, 0, 90, 9, 0, -0.2, 1); m.deck(0, 0, 90, 9, PI / 2, -0.2, 1);
      m.point(-34, -62, 'Pine Camp', 1, 0); m.point(-74, -74, 'Ridge', 1.3); m.point(0, 0, 'Frozen Island', 2.3, -1, 1);
      m.hill(-74, -74, 20, 3.4); m.hill(-40, -30, 14, 2.4); m.hill(0, 0, 16, 5.6, 1);
      m.ridge(-64, -26, -48, -12, 6, 4); m.ridge(-26, -64, -12, -48, 6, 4);
      m.forest(-52, -46, 14, .5); m.forest(-20, -76, 14, .45); m.forest(-76, -34, 12, .45); m.forest(-46, 8, 12, .4);
      m.rocks(-30, -42, 7, 5); m.rocks(-68, -50, 8, 5); m.rocks(-14, 40, 8, 5);
      m.road(0, -84, -34, -62, 3); m.paint(0, 0, 14, 0xd8e4ee, .6);
      m.block(-8, -8, 3, 3, 4, .2, 0x9aa6b4); m.block(8, 8, 3, 3, 4, .6, 0x9aa6b4);
    } },
  { id: 'ironworks', name: 'Ironworks', sym: 4, w: 200, d: 200, seed: 53, biome: 'urban', maxP: 4, amp: .5, desc: 'Ruined industrial district. Tight streets, heavy cover and a central plaza.',
    build(m) {
      m.spawn(-82, -82);
      m.point(-58, -30, 'Freight Yard', 1, 0); m.point(0, -62, 'Foundry', 1.2); m.point(0, 0, 'Plaza', 2.2, -1, 1);
      m.city(-52, -60, 3, 2, 17, 2); m.city(-24, -40, 2, 2, 17, 3); m.city(-80, -20, 2, 3, 17, 4); m.city(14, -34, 2, 1, 16, 7); m.city(-36, 8, 2, 2, 16, 9); m.city(16, 14, 1, 2, 16, 11);
      m.paint(-58, -30, 10, 0x55595f, .6); m.paint(0, 0, 20, 0x9a968c, .6); m.paint(0, -62, 10, 0x55595f, .6);
      m.road(-82, -82, -58, -30, 5); m.road(-58, -30, 0, 0, 5); m.road(0, -62, 0, 0, 5); m.road(-82, -82, 0, -62, 5);
      m.rocks(-20, -14, 8, 6); m.rocks(-70, 30, 9, 6); m.forest(-90, 10, 6, .2);
    } },
  // ---------------- 3.0 new maps. naval: ships can sail here (docks give flags a coastal Shipyard spot); tod / wx: the map's own time of day and weather ----------------
  { id: 'lighthouse', name: 'Lighthouse Bay', sym: 2, w: 260, d: 200, seed: 71, biome: 'coast', maxP: 2, amp: 1.2, naval: 1, wx: 'rain', desc: 'A stormy bay splits the coast. Build a Shipyard at your docks, rule the water, and land troops on Lighthouse Isle. Armies on foot go round by the cliff passes.',
    build(m) {
      m.spawn(-112, 0);
      m.sea(0, -32, 0, 32, 44, 6.5, 1);
      m.point(-84, -54, 'Fisher Village', 1, 0); m.point(-62, 4, 'West Docks', 1.3); m.dock(-41, 4); m.point(-86, 56, 'Pine Cove', 1); m.point(-26, -86, 'Cliff Pass', 1.3); m.point(0, 0, 'Lighthouse Isle', 2.2, -1, 1); m.hill(0, 0, 20, 9, 1);
      m.hill(-46, -66, 18, 3.4); m.hill(-104, 70, 16, 3); m.hill(-30, 64, 14, 2.4); m.ridge(-58, -78, -40, -92, 6, 4.5); m.ridge(-120, -40, -100, -28, 5, 3);
      m.forest(-100, -70, 16, .5); m.forest(-70, 76, 14, .5); m.forest(-48, 34, 10, .4); m.forest(-112, 38, 10, .45); m.forest(-8, 84, 9, .4);
      m.rocks(-52, -24, 8, 5); m.rocks(-96, -20, 7, 4); m.rocks(-20, 68, 7, 5); m.rocks(-46, 46, 6, 4);
      m.road(-112, 0, -62, 4, 3); m.road(-62, 4, -84, -54, 3); m.road(-84, -54, -26, -86, 3); m.road(-62, 4, -86, 56, 3);
      m.paint(-84, -54, 10, 0xb89a5a, .5); m.paint(-62, 4, 10, 0x8a8478, .55);
      m.block(-90, -46, 6, 5, 3.5, .3, 0xb8a080); m.block(-78, -62, 5, 4, 3, 1.1, 0xa88d6a); m.block(-70, 12, 5, 6, 4, 0, 0x8c8f94); m.block(5, -13, 2.6, 2.6, 10, 0, 0xe8e4dc);
    } },
  { id: 'coral', name: 'Coral Straits', sym: 4, w: 220, d: 220, seed: 83, biome: 'coast', maxP: 4, amp: 1.4, naval: 1, desc: 'Four islands around a sunny lagoon. Every base has a harbor: fight for Coral Isle in the middle by boat, or go round by land.',
    build(m) {
      m.spawn(-84, -84);
      m.lake(0, 0, 70, 6.5, 1); m.hill(0, 0, 20, 9, 1);
      m.point(-50, -84, 'Palm Point', 1, 0); m.point(-52, -52, 'Harbor', 1.3); m.dock(-37, -37); m.point(0, -92, 'Reef Road', 1.2); m.point(0, 0, 'Coral Isle', 2.4, -1, 1);
      m.hill(-90, -40, 16, 3); m.hill(-60, -96, 12, 2.4); m.ridge(-24, -96, -12, -74, 5, 3.6);
      m.forest(-74, -56, 14, .5); m.forest(-96, -14, 12, .5); m.forest(-30, -96, 10, .45); m.forest(-62, -24, 9, .4);
      m.rocks(-70, -70, 7, 5); m.rocks(-16, -66, 6, 4); m.rocks(-88, -60, 6, 4);
      m.road(-84, -84, -52, -52, 3); m.road(-84, -84, -50, -84, 3); m.road(-50, -84, 0, -92, 3);
      m.paint(-52, -52, 10, 0xd6c48e, .5); m.paint(0, 0, 12, 0xd6c48e, .4);
      m.block(-62, -44, 5, 4, 3, .4, 0xd8c8a0); m.block(5, 5, 2.4, 2.4, 6, 0, 0xc9b88f);
    } },
  { id: 'harbor', name: 'Harbor Run', sym: 2, w: 240, d: 180, seed: 97, biome: 'urban', maxP: 2, amp: .6, naval: 1, wx: 'fog', desc: 'A foggy port city cut in two by its harbor. Piers on both sides, streets for cover, and gunboats on the water.',
    build(m) {
      m.spawn(-100, 0);
      m.sea(0, -50, 0, 50, 21, 6, 1);
      m.point(-76, -46, 'Rail Yard', 1, 0); m.point(-44, -22, 'Pier 9', 1.3); m.dock(-26, -22); m.point(-62, 46, 'Market Square', 1.2); m.point(0, 82, 'Mole', 1.5);
      m.city(-92, -78, 2, 2, 16, 21); m.city(-58, -76, 2, 1, 16, 22); m.city(-92, 22, 2, 2, 16, 23); m.city(-60, 14, 1, 2, 16, 24); m.city(-48, 58, 1, 1, 14, 25);
      m.road(-100, 0, -44, -22, 5); m.road(-44, -22, -76, -46, 5); m.road(-100, 0, -62, 46, 5); m.road(-62, 46, 0, 82, 5);
      m.paint(-44, -22, 10, 0x55595f, .6); m.paint(-62, 46, 10, 0x9a968c, .6);
      m.rocks(-34, 84, 6, 4); m.forest(-110, 60, 8, .2); m.block(-16, 80, 3, 3, 7, 0, 0xd0cfc8);
    } },
  { id: 'glacier', name: 'Glacier Pass', sym: 2, w: 240, d: 170, seed: 109, biome: 'snow', maxP: 2, amp: 1.6, wx: 'snow', desc: 'A blizzard over a mountain pass. Three narrow roads through the ice cliffs meet at the frozen summit.',
    build(m) {
      m.spawn(-102, 0);
      m.ridge(-60, -40, -14, -26, 9, 6.5); m.ridge(-60, 40, -14, 26, 9, 6.5); m.ridge(-34, -84, -24, -56, 8, 6); m.ridge(-104, 46, -84, 70, 7, 5);
      m.point(-76, -14, 'Base Camp', 1, 0); m.point(-44, -62, 'Ice Caves', 1.2); m.point(-44, 62, 'Avalanche Run', 1.2); m.point(-30, 0, 'Old Lodge', 1.3); m.point(0, 0, 'Summit', 2.2, -1, 1);
      m.hill(0, 0, 22, 3.2, 1); m.lake(-82, 54, 10, 3); m.hill(-96, -60, 16, 3.5);
      m.forest(-88, 30, 14, .5); m.forest(-60, -86, 12, .45); m.forest(-14, -64, 10, .4); m.forest(-12, 56, 10, .4); m.forest(-104, -32, 10, .45);
      m.rocks(-50, 0, 8, 6); m.rocks(-20, -40, 8, 6); m.rocks(-70, 74, 7, 5);
      m.road(-102, 0, -76, -14, 3); m.road(-76, -14, -30, 0, 3); m.road(-30, 0, 0, 0, 3); m.road(-76, -14, -44, -62, 3); m.road(-102, 0, -44, 62, 3);
      m.paint(-30, 0, 10, 0xc3cfda, .5); m.block(-36, 6, 6, 5, 4, .2, 0x8a6a4a);
    } },
  { id: 'mesa', name: 'Moonlit Mesa', sym: 4, w: 210, d: 210, seed: 127, biome: 'desert', maxP: 4, amp: 1.3, tod: 'night', desc: 'A night battle among towering desert mesas. Searchlights sweep the canyons; the Observatory on top of the world is the prize.',
    build(m) {
      m.spawn(-82, -82);
      m.point(-50, -84, 'Dry Wash', 1, 0); m.point(-46, -40, 'Red Canyon', 1.3); m.point(0, -74, 'Signal Rock', 1.2); m.point(0, 0, 'Observatory', 2.3, -1, 1);
      m.hill(0, 0, 26, 4.5, 1); m.hill(-26, -26, 14, 5.5); m.hill(-74, -40, 12, 4.8); m.hill(-40, -94, 10, 4.2);
      m.ridge(-18, -54, -4, -40, 6, 5); m.ridge(-60, -16, -40, -8, 6, 5);
      m.forest(-64, -60, 10, .22); m.forest(-20, -84, 9, .2); m.forest(-84, -20, 9, .22);
      m.rocks(-36, -60, 8, 7); m.rocks(-60, -30, 8, 6); m.rocks(-12, -24, 7, 5);
      m.road(-82, -82, -46, -40, 3); m.road(-46, -40, 0, 0, 3); m.road(-82, -82, -50, -84, 3); m.road(-50, -84, 0, -74, 3);
      m.paint(-46, -40, 10, 0xb08a54, .5); m.paint(0, 0, 16, 0x8f8a78, .6);
      m.block(-17, 9, 4, 4, 6, .4, 0xcfc8b8);
    } }
];

function genMap(def) {
  const sym = def.sym, rots = ROTS[sym], rota = ROTA[sym], B = BIOME[def.biome];
  const rng = mulberry32(def.seed * 7919 + 13);
  const M = { def, id: def.id, name: def.name, w: def.w, d: def.d, hw: def.w / 2, hd: def.d / 2, sym, biome: B, bname: def.biome, wl: 0, maxP: def.maxP };
  const L = { hills: [], ridges: [], lakes: [], decks: [], paints: [], pads: [], seas: [] };
  const base = { pts: [], forests: [], rocks: [], blocks: [], spawns: [], cities: [], docks: [] };
  const rep = (x, z, c, fn) => { if (c) fn(x, z, 0); else for (let k = 0; k < rots.length; k++) { const p = rots[k](x, z); fn(p[0], p[1], k); } };
  const api = {
    hill(x, z, r, h, c) { rep(x, z, c, (a, b) => L.hills.push({ x: a, z: b, r, h })); },
    ridge(x1, z1, x2, z2, w, h, c) { if (c) L.ridges.push({ x1, z1, x2, z2, w, h }); else for (let k = 0; k < rots.length; k++) { const p = rots[k](x1, z1), q = rots[k](x2, z2); L.ridges.push({ x1: p[0], z1: p[1], x2: q[0], z2: q[1], w, h }); } },
    lake(x, z, r, depth, c) { rep(x, z, c, (a, b) => L.lakes.push({ x: a, z: b, r, depth })); },
    // 3.0: a stretch of deep sea (a capsule from one point to another, w = half width) and a coastal build spot for a Shipyard
    sea(x1, z1, x2, z2, w, depth, c) { if (c) L.seas.push({ x1, z1, x2, z2, w, depth }); else for (let k = 0; k < rots.length; k++) { const p = rots[k](x1, z1), q = rots[k](x2, z2); L.seas.push({ x1: p[0], z1: p[1], x2: q[0], z2: q[1], w, depth }); } },
    dock(x, z, c) { rep(x, z, c, (a, b) => base.docks.push({ x: a, z: b })); },
    deck(x, z, len, wid, rot, h, c) { rep(x, z, c, (a, b, k) => L.decks.push({ x: a, z: b, len, wid, rot: rot + (c ? 0 : rota[k]), h })); },
    point(x, z, name, val, home, c) { base.pts.push({ x, z, name, val, home: home === undefined ? -1 : home, c: !!c }); },
    spawn(x, z, big, name) { base.spawns.push({ x, z, big, name }); },
    forest(x, z, r, dens) { base.forests.push({ x, z, r, dens }); },
    rocks(x, z, r, n) { base.rocks.push({ x, z, r, n }); },
    block(x, z, w, d, h, rot, col) { base.blocks.push({ x, z, w, d, h, rot, col }); },
    city(x, z, cols, rows, sp, seed) { base.cities.push({ x, z, cols, rows, sp, seed }); },
    paint(x, z, r, col, a) { rep(x, z, 0, (p, q) => L.paints.push({ t: 'c', x: p, z: q, r, col, a })); },
    road(x1, z1, x2, z2, w) { for (let k = 0; k < rots.length; k++) { const p = rots[k](x1, z1), q = rots[k](x2, z2); L.paints.push({ t: 's', x1: p[0], z1: p[1], x2: q[0], z2: q[1], w, col: def.biome === 'urban' ? 0x6c7278 : def.biome === 'snow' ? 0xc3cfda : def.biome === 'desert' ? 0xb99a66 : 0xcdb98a, a: .85 }); } }
  };
  def.build(api);
  // ---- points & spawns ----
  M.spawns = []; M.points = [];
  for (const s of base.spawns) rep(s.x, s.z, 0, (a, b, k) => M.spawns.push({ x: a, z: b, k: sym === 1 ? M.spawns.length : k, big: s.big, name: s.name }));
  const spawnIdx = (k) => k;
  for (const s of M.spawns) M.points.push({ id: M.points.length, x: s.x, z: s.z, name: s.name || 'HQ', val: 0, home: -1, hq: s.k, pad: 1, big: s.big ? 1 : 0 });
  for (const p of base.pts) {
    const lbl = 'ABCD';
    rep(p.x, p.z, p.c, (a, b, k) => M.points.push({ id: M.points.length, x: a, z: b, name: p.c || sym === 1 ? p.name : p.name + ' ' + lbl[k], val: p.val, home: p.home >= 0 ? k : -1, hq: -1, pad: 0 }));
  }
  M.spawnPts = M.spawns.map(s => M.points.findIndex(p => p.hq === s.k));
  // ---- height field (1 unit grid) ----
  const W1 = def.w + 1, D1 = def.d + 1; M.hg = new Float32Array(W1 * D1); M.W1 = W1;
  const amp = def.amp;
  const fbm = (x, z, s) => (0.7 * vnoise(x / 46, z / 46, s) + 0.3 * vnoise(x / 24, z / 24, s + 1)) - 0.5;
  const symNoise = (x, z) => { let s = 0; for (let k = 0; k < rots.length; k++) { const p = rots[k](x, z); s += fbm(p[0], p[1], def.seed); } return s / rots.length; };
  const h0 = (x, z) => {
    let h = 1.9 + amp * 1.5 * symNoise(x, z);
    for (const o of L.hills) { const dx = x - o.x, dz = z - o.z, dd = dx * dx + dz * dz, R = o.r * 1.6; if (dd < R * R) { const sg = o.r / 2; h += o.h * Math.exp(-dd / (2 * sg * sg)); } }
    for (const o of L.ridges) { const d = segDist(x, z, o.x1, o.z1, o.x2, o.z2); if (d < o.w * 1.3) h += o.h * .72 * sstep(o.w * 1.3, o.w * .3, d); }
    for (const o of L.lakes) { const dx = x - o.x, dz = z - o.z, d = Math.sqrt(dx * dx + dz * dz); if (d < o.r) h -= o.depth * sstep(o.r, o.r * .55, d); }
    for (const o of L.seas) { const d = segDist(x, z, o.x1, o.z1, o.x2, o.z2); if (d < o.w) h -= o.depth * sstep(o.w, o.w * .62, d); }
    for (const o of L.decks) {
      const c = Math.cos(o.rot), s = Math.sin(o.rot), dx = x - o.x, dz = z - o.z, lz = dx * s + dz * c, lx = dx * c - dz * s; // lz along rot heading
      const al = Math.abs(lz), ac = Math.abs(lx);
      if (al < o.len / 2 + 5 && ac < o.wid / 2 + 3.5) { const t = 1 - Math.max(sstep(o.len / 2, o.len / 2 + 5, al), sstep(o.wid / 2, o.wid / 2 + 3.5, ac)); h = lerp(h, o.h, t); }
    }
    return h;
  };
  for (const p of M.points) { p.gy = h0(p.x, p.z); }
  const padR = p => p.big ? [45, 54] : p.hq >= 0 ? [27, 34] : [19.5, 26];
  for (let iz = 0; iz < D1; iz++) for (let ix = 0; ix < W1; ix++) {
    const x = ix - M.hw, z = iz - M.hd; let h = h0(x, z);
    for (const p of M.points) { const dx = x - p.x, dz = z - p.z, dd = dx * dx + dz * dz, r = padR(p); if (dd < r[1] * r[1]) h = lerp(h, p.gy, sstep(r[1], r[0], Math.sqrt(dd))); }
    // map edge skirt
    const ed = Math.min(M.hw - Math.abs(x), M.hd - Math.abs(z)); if (ed < 4) h -= (4 - ed) * .5;
    M.hg[iz * W1 + ix] = h;
  }
  for (const p of M.points) p.y = p.gy;
  M.H = (x, z) => {
    const fx = clamp(x + M.hw, 0, M.w - .001), fz = clamp(z + M.hd, 0, M.d - .001), ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * W1 + ix, g = M.hg;
    return (g[i] * (1 - tx) + g[i + 1] * tx) * (1 - tz) + (g[i + W1] * (1 - tx) + g[i + W1 + 1] * tx) * tz;
  };
  M.slope = (x, z) => { const a = M.H(x - 1, z), b = M.H(x + 1, z), c = M.H(x, z - 1), d = M.H(x, z + 1); return Math.max(Math.abs(b - a), Math.abs(d - c)) / 2; };
  M.inb = (x, z) => x > -M.hw + 2 && x < M.hw - 2 && z > -M.hd + 2 && z < M.hd - 2;
  // ---- decor ----
  const nearPt = (x, z, r) => { for (const p of M.points) { const dx = x - p.x, dz = z - p.z, rr_ = p.big ? r + 36 : p.hq >= 0 ? r + 16 : r + 6; if (dx * dx + dz * dz < rr_ * rr_) return true; } return false; };
  const onDeck = (x, z) => { for (const o of L.decks) { const c = Math.cos(o.rot), s = Math.sin(o.rot), dx = x - o.x, dz = z - o.z; if (Math.abs(dx * s + dz * c) < o.len / 2 + 5 && Math.abs(dx * c - dz * s) < o.wid / 2 + 4) return true; } return false; };
  M.trees = []; M.rocks = []; M.blocks = [];
  const grid = new Map(); const gk = (x, z) => ((x / 4) | 0) + ',' + ((z / 4) | 0);
  const free = (x, z, d) => { const cx = (x / 4) | 0, cz = (z / 4) | 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get((cx + a) + ',' + (cz + b)); if (l) for (const q of l) { const dx = x - q[0], dz = z - q[1]; if (dx * dx + dz * dz < (d + q[2]) * (d + q[2])) return false; } } return true; };
  const reg = (x, z, r) => { const k = gk(x, z); let l = grid.get(k); if (!l) grid.set(k, l = []); l.push([x, z, r]); };
  for (const b of base.blocks) rep(b.x, b.z, 0, (a, c, k) => { reg(a, c, Math.max(b.w, b.d)); M.blocks.push({ x: a, z: c, w: b.w, d: b.d, h: b.h, rot: b.rot + rota[k], col: b.col }); });
  for (const cy of base.cities) {
    const rg = mulberry32(cy.seed * 101 + 5); const items = [];
    for (let i = 0; i < cy.cols; i++) for (let j = 0; j < cy.rows; j++) {
      if (rg() < .12) continue; const bw = 5 + rg() * 5, bd = 5 + rg() * 5, bh = 3.5 + rg() * 6.5, jx = (rg() - .5) * 3, jz = (rg() - .5) * 3;
      items.push({ x: cy.x + i * cy.sp + jx, z: cy.z + j * cy.sp + jz, w: bw, d: bd, h: bh, rot: (rg() < .3 ? rg() * .5 : 0), col: [0x8a8f96, 0x9a8f80, 0x7a7f88, 0x8c7c70, 0xa0a4a8][(rg() * 5) | 0] });
    }
    for (const b of items) rep(b.x, b.z, 0, (a, c, k) => { if (nearPt(a, c, 14)) return; reg(a, c, Math.max(b.w, b.d)); M.blocks.push({ x: a, z: c, w: b.w, d: b.d, h: b.h, rot: b.rot + rota[k], col: b.col }); });
  }
  for (const f of base.rocks) {
    for (let i = 0; i < Math.ceil(f.n * .7); i++) { const a = rng() * TAU, d = Math.sqrt(rng()) * f.r, x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, sc = 1.5 + rng() * 2.0, rt = rng() * TAU; if (!M.inb(Math.abs(x), Math.abs(z)) && false) continue; const tint = 0.85 + rng() * .3;
      rep(x, z, 0, (p, q, k) => { if (!M.inb(p, q) || nearPt(p, q, 13) || M.H(p, q) < M.wl + .3 || onDeck(p, q) || !free(p, q, sc)) return; reg(p, q, sc); M.rocks.push({ x: p, z: q, r: sc, rot: rt, tint, y: M.H(p, q) }); }); }
  }
  for (const f of base.forests) {
    const n = Math.floor(f.r * f.r * f.dens * .3);
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * f.r, x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d, sc = 1.05 + rng() * .8, kd = B.trees[(rng() * B.trees.length) | 0], rt = rng() * TAU, tint = .85 + rng() * .3;
      rep(x, z, 0, (p, q, k) => {
        if (!M.inb(p, q) || nearPt(p, q, 13) || M.H(p, q) < M.wl + .4 || M.slope(p, q) > .55 || onDeck(p, q) || !free(p, q, 3.1)) return;
        reg(p, q, 3.1); M.trees.push({ x: p, z: q, s: sc, k: kd, rot: rt, tint, y: M.H(p, q) });
      });
    }
  }
  // random order so partial decor density keeps an even spread
  for (let i = M.trees.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = M.trees[i]; M.trees[i] = M.trees[j]; M.trees[j] = t; }
  M.paints = L.paints; M.decks = L.decks;
  // ---- navigation grid ----
  const cs = 2, nx = Math.ceil(M.w / cs), nz = Math.ceil(M.d / cs);
  const nav = M.nav = { cs, nx, nz, blk: new Uint8Array(nx * nz), dyn: new Uint8Array(nx * nz), cover: new Uint8Array(nx * nz), pen: new Float32Array(nx * nz), ver: 1, penVer: 0, cache: new Map() };
  const cidx = (x, z) => clamp(((z + M.hd) / cs) | 0, 0, nz - 1) * nx + clamp(((x + M.hw) / cs) | 0, 0, nx - 1);
  nav.idx = cidx;
  for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) {
    const x = -M.hw + (cx + .5) * cs, z = -M.hd + (cz + .5) * cs, i = cz * nx + cx; const h = M.H(x, z);
    if (h < M.wl - .5 || M.slope(x, z) > .88 || cx < 1 || cz < 1 || cx >= nx - 1 || cz >= nz - 1) nav.blk[i] = 1;
  }
  const mark = (arr, x, z, r, val) => { const c0 = Math.floor((x - r + M.hw) / cs), c1 = Math.floor((x + r + M.hw) / cs), r0 = Math.floor((z - r + M.hd) / cs), r1 = Math.floor((z + r + M.hd) / cs); for (let a = r0; a <= r1; a++) for (let b = c0; b <= c1; b++) { if (a < 0 || b < 0 || a >= nz || b >= nx) continue; const px = -M.hw + (b + .5) * cs - x, pz = -M.hd + (a + .5) * cs - z; if (px * px + pz * pz <= (r + cs * .5) * (r + cs * .5)) arr[a * nx + b] = val; } };
  for (const r of M.rocks) mark(nav.blk, r.x, r.z, r.r * .9, 1);
  for (const t of M.trees) { if (t.k === 3 || t.k === 4) { if (t.k === 3) mark(nav.blk, t.x, t.z, .3, 1); } else nav.blk[cidx(t.x, t.z)] = 1; }
  for (const t of M.trees) mark(nav.cover, t.x, t.z, 3.2, 1);
  for (const b of M.blocks) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot), R = Math.max(b.w, b.d) / 2 + 2;
    for (let a = -R; a <= R; a += 1) for (let bb = -R; bb <= R; bb += 1) {
      const lx = a * c - bb * s, lz = a * s + bb * c; // rotate back (approx)
      if (Math.abs(a) <= b.w / 2 + .7 && Math.abs(bb) <= b.d / 2 + .7) { const wx = b.x + a * c + bb * s, wz = b.z - a * s + bb * c; nav.blk[cidx(wx, wz)] = 1; }
      else if (Math.abs(a) <= b.w / 2 + 3 && Math.abs(bb) <= b.d / 2 + 3) { const wx = b.x + a * c + bb * s, wz = b.z - a * s + bb * c; nav.cover[cidx(wx, wz)] = 1; }
    }
  }
  // keep points and their surroundings walkable
  for (const p of M.points) { const r = p.big ? 47 : p.hq >= 0 ? 28 : 20; for (let a = -r; a <= r; a += 1.5) for (let b = -r; b <= r; b += 1.5) if (a * a + b * b <= r * r) { const i = cidx(p.x + a, p.z + b); const y = M.H(p.x + a, p.z + b); if (y > M.wl - .4 && M.inb(p.x + a, p.z + b)) nav.blk[i] = 0; } }
  for (const b of M.blocks) { const c = Math.cos(b.rot), sn = Math.sin(b.rot); for (let a = -b.w / 2 - .7; a <= b.w / 2 + .7; a += 1) for (let bb = -b.d / 2 - .7; bb <= b.d / 2 + .7; bb += 1) nav.blk[cidx(b.x + a * c + bb * sn, b.z - a * sn + bb * c)] = 1; }   // houses stay solid even inside a flag's cleared area
  for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) if (cx < 1 || cz < 1 || cx >= nx - 1 || cz >= nz - 1) nav.blk[cz * nx + cx] = 1;   // 3.1: the map border must stay solid, or routes wrap from one edge to the other
  // 3.0 sea lanes: ships have their own route map (deep water only; buildings never block it)
  const navW = M.navW = { cs, nx, nz, blk: new Uint8Array(nx * nz), dyn: new Uint8Array(nx * nz), cover: new Uint8Array(nx * nz), pen: new Float32Array(nx * nz), ver: 1, penVer: 0, cache: new Map(), idx: cidx, sea: 1 };
  let wet = 0; for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) { const i = cz * nx + cx, x = -M.hw + (cx + .5) * cs, z = -M.hd + (cz + .5) * cs; const deep = cx >= 2 && cz >= 2 && cx < nx - 2 && cz < nz - 2 && M.H(x, z) < M.wl - .8 && M.H(x + 1, z) < M.wl - .5 && M.H(x - 1, z) < M.wl - .5 && M.H(x, z + 1) < M.wl - .5 && M.H(x, z - 1) < M.wl - .5; navW.blk[i] = deep ? 0 : 1; if (deep) wet++; }
  M.naval = !!def.naval && wet > 0;
  // connected regions of land (static: ignores buildings) and of sea, for islands and for which docks share a sea
  const label = (blk) => { const lab = new Int32Array(nx * nz).fill(-1), q = new Int32Array(nx * nz); let id = 0; for (let s0 = 0; s0 < nx * nz; s0++) { if (blk[s0] || lab[s0] >= 0) continue; let h = 0, t = 0; q[t++] = s0; lab[s0] = id; while (h < t) { const i = q[h++], cx = i % nx, cz = (i / nx) | 0; for (let k = 0; k < 8; k += 2) { const a = cx + NB[k][0], b = cz + NB[k][1]; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const j = b * nx + a; if (blk[j] || lab[j] >= 0) continue; lab[j] = id; q[t++] = j; } } id++; } return lab; };
  M.gcomp = label(nav.blk); M.wcomp = M.naval ? label(navW.blk) : null;
  M.compAt = (x, z) => { const i0 = cidx(x, z); if (M.gcomp[i0] >= 0) return M.gcomp[i0]; const cx = i0 % nx, cz = (i0 / nx) | 0; for (let r = 1; r < 8; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const px = cx + a, pz = cz + b; if (px < 0 || pz < 0 || px >= nx || pz >= nz) continue; const c = M.gcomp[pz * nx + px]; if (c >= 0) return c; } return -1; };
  if (M.naval) { navW.shore = new Uint8Array(nx * nz); for (let i = 0; i < nx * nz; i++) { if (navW.blk[i]) continue; const cx = i % nx, cz = (i / nx) | 0; let ok = 0; for (let a = -3; a <= 3 && !ok; a++) for (let b = -3; b <= 3; b++) { const px = cx + a, pz = cz + b; if (px < 1 || pz < 1 || px >= nx - 1 || pz >= nz - 1) continue; if (!nav.blk[pz * nx + px]) { ok = 1; break; } } navW.shore[i] = ok; } }
  M.docks = M.naval ? base.docks.map(d => { const w = snapWater(M, d.x, d.z, 40); return w ? { x: d.x, z: d.z, wx: w[0], wz: w[1] } : null; }).filter(Boolean) : [];
  M.mapH = M.H;
  return M;
}
// 3.0 water helpers: the nearest deep-water spot (ships), the nearest walkable land (landing troops), a ship's route map
function snapWater(M, x, z, maxR) {
  const n = M.navW; if (!n) return null; const i0 = n.idx(x, z); if (!n.blk[i0]) return [x, z]; const cx = i0 % n.nx, cz = (i0 / n.nx) | 0, R = Math.ceil((maxR || 60) / n.cs);
  for (let r = 1; r <= R; r++) { let best = -1, bd = 1e9; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const px = cx + a, pz = cz + b; if (px < 0 || pz < 0 || px >= n.nx || pz >= n.nz) continue; const j = pz * n.nx + px; if (n.blk[j]) continue; const d = a * a + b * b; if (d < bd) { bd = d; best = j; } } if (best >= 0) return [-M.hw + (best % n.nx + .5) * n.cs, -M.hd + (((best / n.nx) | 0) + .5) * n.cs]; }
  return null;
}
function landNear(M, x, z, maxR) {
  const n = M.nav, i0 = n.idx(x, z), cx = i0 % n.nx, cz = (i0 / n.nx) | 0, R = Math.ceil((maxR || 10) / n.cs); if (!(n.blk[i0] | n.dyn[i0]) && M.H(x, z) > M.wl - .5) return [x, z];
  for (let r = 1; r <= R; r++) { let best = -1, bd = 1e9; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue; const px = cx + a, pz = cz + b; if (px < 1 || pz < 1 || px >= n.nx - 1 || pz >= n.nz - 1) continue; const j = pz * n.nx + px; if (n.blk[j] | n.dyn[j]) continue; const d = a * a + b * b; if (d < bd) { bd = d; best = j; } } if (best >= 0) return [-M.hw + (best % n.nx + .5) * n.cs, -M.hd + (((best / n.nx) | 0) + .5) * n.cs]; }
  return null;
}
const navOf = u => u.T.naval ? W.M.navW : W.M.nav;
function losN(n, x0, z0, x1, z1) { const dx = x1 - x0, dz = z1 - z0, L = Math.sqrt(dx * dx + dz * dz); if (L < 1) return true; const st = Math.ceil(L / 1.2); for (let i = 1; i < st; i++) { const t = i / st, j = n.idx(x0 + dx * t, z0 + dz * t); if (n.blk[j] | n.dyn[j]) return false; } return true; }

