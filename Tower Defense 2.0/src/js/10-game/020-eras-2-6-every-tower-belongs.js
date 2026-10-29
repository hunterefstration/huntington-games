// ---------------------------------------------------------------------
//  ERAS (2.6). Every tower belongs to an era of the war, from the trenches
//  of 1914 to the alien invasion. Shown in the shop tooltip and the Codex,
//  and every era has its own hero (see HEROES).
// ---------------------------------------------------------------------
const ERAS = {
  1900:   { name: 'Great War', years: '1900-1918', color: '#a1887f' },
  ww2:    { name: 'World War II', years: '1939-1945', color: '#8d9e5b' },
  cold:   { name: 'Cold War', years: '1947-1991', color: '#78909c' },
  modern: { name: 'Modern', years: '1991-2030', color: '#5d9cec' },
  future: { name: 'Near Future', years: '2030-2080', color: '#00bcd4' },
  alien:  { name: 'Alien Invasion', years: 'First contact', color: '#76ff03' }
};
const ERA_ORDER = ['1900', 'ww2', 'cold', 'modern', 'future', 'alien'];
for (const [era, ids] of [['1900', 'basic standard cannon artillery farm commander sandbag tanktrap mine barracks k9 hospital'], ['ww2', 'flak howitzer factory mgnest concrete tank marksman demo battery heavy oil'],
  ['cold', 'rapid sniper missile radar power cpost workshop'], ['modern', 'minigun mechanic hq'], ['future', 'frost tesla venom inferno laser plasma railgun doomsday cryo']]) for (const id of ids.split(' ')) if (TOWER[id] && !TOWER[id].era) TOWER[id].era = era;
// Older saves used other ids for towers that were renamed in 2.2 and then restored in 2.3.
const LEGACY_TOWER_IDS = { suppress: 'frost', smoke: 'cryo', dew: 'plasma', archery: 'marksman', knights: 'heavy', beasts: 'k9', academy: 'demo', siege: 'battery', shrine: 'hospital', guild: 'hq', banner: 'cpost', wood: 'sandbag', iron: 'concrete', phalanx: 'mgnest', spikes: 'tanktrap', tar: 'oil' };
// Same for the ability that was called 'smokescreen' in 2.2.
const LEGACY_ABILITY_IDS = { smokescreen: 'freeze' };
// ...and these were removed entirely: they are taken out of old saves and refunded.
const RETIRED_TOWERS = { wizard: 'Wizard' };

// ---------------------------------------------------------------------
//  TROOP TYPES  (what each barracks trains).  role decides the behaviour:
//  melee = blocks and fights, ranged = shoots from its post, aoe = grenade
//  and rocket fire that splashes, artillery = lobbed shells / piercing
//  rounds, medic = heals + returns fire, engineer = mines / repairs /
//  builds, sentry = a stationary gun.
//  Numbers here are defaults; the barracks supplies health and damage.
// ---------------------------------------------------------------------
const TROOP_TYPES = {
  soldier: { name: 'Rifleman', role: 'melee', r: 7, speed: 1.7, rate: 45, range: 22, leash: 70, color: '#6b7a3a', look: 'soldier', desc: 'A plain rifleman. Stands on the road and holds one ground enemy at a time.' },
  marksman: { name: 'Marksman', role: 'ranged', r: 6.5, speed: 1.6, rate: 36, range: 150, hitsAir: true, color: '#8a7f4a', look: 'marksman', shotColor: '#f9e79f', desc: 'Shoots ground and air targets from behind your line. Fragile.' },
  heavy: { name: 'Heavy Infantry', role: 'melee', r: 9, speed: 1.3, rate: 50, range: 24, leash: 60, armor: 4, color: '#56606a', look: 'heavy', desc: 'Body armor (4), a riot shield and lots of health. Holds the line.' },
  k9: { name: 'K9 Dog', role: 'melee', r: 6, speed: 3.1, rate: 22, range: 20, leash: 110, lunge: true, color: '#95a5a6', look: 'dog', desc: 'A military dog. Very fast. Chases enemies far from its post. Low health.' },
  grenadier: { name: 'Grenadier', role: 'aoe', r: 6.5, speed: 1.5, rate: 70, range: 135, aoe: 38, hitsAir: true, color: '#7a5a8a', look: 'grenadier', desc: 'Fires a grenade launcher that splashes a group. Airburst rounds hit air. Very fragile.' },
  engineer: { name: 'Engineer', role: 'engineer', r: 7, speed: 1.7, rate: 40, range: 75, color: '#f39c12', look: 'engineer', mineEvery: 600, mineCap: 2, mineMul: 1, repair: 1, shotColor: '#ffe082', desc: 'Plants landmines on the road nearby and repairs walls, traps and troops.' },
  gun: { name: 'Field Gun Crew', role: 'artillery', r: 11, speed: 0.7, rate: 150, range: 300, minRange: 70, aoe: 55, color: '#8d6e63', look: 'gun', desc: 'Lobs shells with a big splash. Slow, ground only, cannot hit close targets.' },
  medic: { name: 'Combat Medic', role: 'medic', r: 7, speed: 1.5, rate: 60, range: 100, heal: 30, hitsAir: true, color: '#d8d6c0', look: 'medic', shotColor: '#fff9c4', desc: 'Heals the most wounded ally in reach; returns fire when nobody needs healing.' },
  sentry: { name: 'Sentry Gun', role: 'sentry', r: 6, speed: 0, rate: 12, range: 120, color: '#7f8c8d', look: 'sentry', fixed: true, shotColor: '#ffe082', desc: 'A small automatic gun built by Sentry Gun Crews. Lasts 25 seconds.' },
  tank: { name: 'Tank', role: 'tank', r: 15, speed: 1, rate: 30, range: 130, color: '#2980b9', look: 'tank', desc: 'Drives up the road from your base, shooting and ramming.' },
  xeno: { name: 'Xeno Warrior', role: 'melee', r: 8, speed: 2.3, rate: 30, range: 22, leash: 115, lifesteal: 0.15, color: '#6ab04c', look: 'xeno', desc: 'A captured alien warrior from the Xeno Hatchery. Fast and fierce, chases enemies a long way and heals itself with every hit.' }
};

// ---------------------------------------------------------------------
//  MERCENARIES  (private military contractors: hired for gold, dropped
//  anywhere near the road, fight for a while and then leave). Stats grow
//  with the wave number; the price grows a little too. wave = unlocks at
//  that wave; hq = unlocks sooner when your Contractor HQ is at least that
//  level.
// ---------------------------------------------------------------------
const MERCS = [
  { id: 'contractor', name: 'Contractors', cost: 150, cd: 20, life: 40, n: 3, wave: 1, hq: 0, role: 'melee', look: 'contractor', color: '#8e5a3c', hp: 220, dmg: 22, rate: 40, range: 22, speed: 1.9, r: 7, armor: 1, leash: 100,
    desc: 'Three private contractors in body armor. Cheap, sturdy, and good at holding the road for a short time.' },
  { id: 'marksmen', name: 'Marksmen', cost: 220, cd: 22, life: 35, n: 3, wave: 3, hq: 1, role: 'ranged', look: 'marksman', color: '#587a3a', hp: 120, dmg: 70, rate: 70, range: 170, speed: 1.6, r: 6.5, detect: false, shotColor: '#dfe6e9',
    desc: 'Three hired marksmen with heavy rifles. Long range, big single hits. Ground only.' },
  { id: 'shock', name: 'Shock Troopers', cost: 320, cd: 30, life: 25, n: 2, wave: 6, hq: 1, role: 'melee', look: 'shock', color: '#b33939', hp: 300, dmg: 40, rate: 25, range: 22, speed: 2.6, r: 8, armor: 0, leash: 130, lifesteal: 0.25, frenzy: true,
    desc: 'Two assault troopers with SMGs and combat stimulants. Fast, hit hard, recover by hitting, and fight 50% harder below half health.' },
  { id: 'drones', name: 'Combat Drones', cost: 420, cd: 28, life: 30, n: 4, wave: 9, hq: 2, role: 'ranged', look: 'drone', color: '#b0bec5', hp: 90, dmg: 32, rate: 20, range: 125, speed: 3.0, r: 6, hitsAir: true, shotColor: '#80d8ff',
    desc: 'Four armed hover drones. Fast and cheap to lose: they shoot ground AND air targets and swarm anything that gets close.' },
  { id: 'officer', name: 'Armored Officer', cost: 550, cd: 40, life: 45, n: 1, wave: 10, hq: 2, role: 'melee', look: 'officer', color: '#f1c40f', hp: 1200, dmg: 35, rate: 40, range: 24, speed: 1.4, r: 10, armor: 5, leash: 120, medAura: 18, medRad: 95, guard: 0.8,
    desc: 'One armored command officer with a medic kit. Heals allies within 95 units (18 health a second) and takes 20% less damage.' },
  { id: 'flame', name: 'Flamethrowers', cost: 650, cd: 35, life: 30, n: 2, wave: 12, hq: 2, role: 'aoe', look: 'flame', color: '#e74c3c', hp: 100, dmg: 55, rate: 80, range: 140, speed: 1.5, r: 6.5, aoe: 55, burn: 0.5, hitsAir: false,
    desc: 'Two flamethrower troops. Burning fuel splashes a group and sets enemies burning. Ground only.' },
  { id: 'plasmatroop', name: 'Plasma Troopers', cost: 600, cd: 32, life: 30, n: 3, wave: 14, hq: 2, role: 'ranged', look: 'plasmarifle', color: '#00bcd4', hp: 170, dmg: 62, rate: 55, range: 160, speed: 1.6, r: 6.5, aoe: 30, hitsAir: true, shotColor: '#18ffff',
    desc: 'Three troopers with plasma rifles. Their bolts splash a small area, hit air and long range targets, and cook anything bunched up.' },
  { id: 'special', name: 'Special Forces', cost: 480, cd: 35, life: 25, n: 3, wave: 15, hq: 3, role: 'melee', look: 'special', color: '#2d3436', hp: 140, dmg: 90, rate: 30, range: 20, speed: 3.4, r: 6.5, armor: 0, leash: 280, hunt: true, crit: 0.35, critMult: 3, pierceArmor: true, dodge: 0.3, backstab: 3,
    desc: 'Three operators that hunt the strongest enemy anywhere nearby. Ignore armor, crit 35% for triple damage, dodge 30%.' },
  { id: 'powerarmor', name: 'Power Armor Squad', cost: 850, cd: 45, life: 40, n: 2, wave: 17, hq: 3, role: 'melee', look: 'powerarmor', color: '#5c7fa8', hp: 1000, dmg: 60, rate: 45, range: 24, speed: 1.4, r: 10, armor: 6, leash: 120, guard: 0.8, cleave: 40,
    desc: 'Two soldiers in powered exoskeletons. Thick armor (6), 20% less damage taken, and every punch hits the group around the target.' },
  { id: 'lighttank', name: 'Light Tank', cost: 1100, cd: 60, life: 40, n: 1, wave: 20, hq: 4, role: 'melee', look: 'tank', color: '#6d7a52', hp: 3000, dmg: 150, rate: 90, range: 28, speed: 0.9, r: 15, armor: 8, leash: 110, cleave: 62, stun: 0.2, stunTicks: 30,
    desc: 'A hired light tank with 3000 health and armor 8. Every shell is an area blast that may stun.' },
  { id: 'mech', name: 'Mech Walker', cost: 2400, cd: 80, life: 45, n: 1, wave: 30, hq: 5, role: 'melee', look: 'mech', color: '#7f8fa6', hp: 6000, dmg: 230, rate: 80, range: 30, speed: 0.9, r: 17, armor: 10, leash: 120, cleave: 75, stun: 0.25, stunTicks: 36, guard: 0.85,
    desc: 'A piloted combat mech with 6000 health and armor 10. Its servo-fists smash whole groups and may stun. Level 5 Contractor HQ unlocks it early.' },
  { id: 'greys', name: 'Grey Defectors', cost: 700, cd: 34, life: 30, n: 3, wave: 16, hq: 3, role: 'ranged', look: 'grey', color: '#b8c4c2', hp: 160, dmg: 70, rate: 50, range: 175, speed: 1.8, r: 6.5, hitsAir: true, detect: true, pierceArmor: true, shieldMul: 3, shotColor: '#76ff03',
    desc: 'Three aliens who turned against the invasion, with psionic blasters. They hit air and ground, see cloaked enemies, ignore armor and do triple damage to shields and barriers.' }
];
const MERC = Object.fromEntries(MERCS.map(m => [m.id, m]));
// Troop Mode tuning: troops scale with the wave much faster than in Tower Mode, because towers are not carrying the fight.
const TM = { hp: 0.6, dmg: 1.0, merc: 0.45, tank: 0.45, reward: 1.6, start: 700, barracksLimit: 1.5, cost: 0.5, wavePay: 1.25, boss: 0.75 };
// Troop Mode prices: barracks and troop structures are cheaper (see applyModeCosts, called when a game starts)
for (const t of TOWERS) t.baseCost = t.cost;
function applyModeCosts(gm) { for (const t of TOWERS) t.cost = (gm === 'troop' && (t.kind === 'barracks' || t.kind === 'hq' || t.aura === 'cpost' || t.id === 'mechanic')) ? Math.round(t.baseCost * TM.cost / 10) * 10 : t.baseCost; }
const isTroopMode = () => !!(G && G.gm === 'troop');
const mercScale = (wave) => 1 + wave * (isTroopMode() ? TM.merc : 0.12);
const mercCostAt = (m, wave) => Math.round(m.cost * (1 + wave * 0.02));
const BASE_MERC_CAP = 3;

const TABS = ['Attack', 'Support', 'Troops', 'Defense', 'Mercs', 'Alien'];
const TABS_BY_MODE = { tower: ['Attack', 'Support', 'Defense', 'Alien'], troop: ['Troops', 'Mercs', 'Support', 'Defense', 'Alien'], legacy: TABS };
const TAB_NAMES = { Attack: 'Attack', Support: 'Support', Troops: 'Troops', Defense: 'Defense', Mercs: 'Mercs', Alien: 'Alien' };

// ---------------------------------------------------------------------
//  HEROES (2.6). One hero per game, in both modes, one for every era.
//  Pick one from the hero bar, pay HERO_COST and click near the road to deploy it, then
//  select it and right-click to move it like a troop. It earns XP from its
//  own kills (and 30% from enemies that die near it), levels up to 10, and
//  has two abilities (Z and X; the second unlocks at hero level 3).
//  A fallen hero comes back after 20 seconds.
//  aim: 0 = instant, a number = click a spot (that radius), 'line', 'enemy'.
// ---------------------------------------------------------------------
const HERO_MAX = 10, HERO_ABIL2_LV = 3, HERO_RESPAWN = 20, HERO_COST = 250;
const HEROES = [
  { id: 'ashford', era: '1900', name: 'Captain Ashford', title: 'The Trench Lion', look: 'h_ashford', color: '#7d6b45', role: 'ranged', hp: 320, dmg: 34, rate: 40, range: 165, speed: 1.6, r: 9, shotColor: '#ffe082',
    desc: 'A Great War officer with a service rifle and a whistle. Steady fire at ground targets, and the best hero for driving the towers and troops around him.',
    abil: [{ id: 'overtop', name: 'Over the Top!', cd: 45, aim: 0, desc: 'Blows the whistle: for 10 seconds towers within 220 of him fire 40% faster, and troops there hit 40% harder and take 25% less damage.' },
           { id: 'barrage', name: 'Creeping Barrage', cd: 55, aim: 60, desc: 'Click the road: 10 shells land along it, starting there and walking back toward the enemy spawn.' }] },
  { id: 'kowalski', era: 'ww2', name: 'Sgt. Kowalski', title: 'Tank Ace', look: 'h_tank', color: '#5b6b3a', role: 'melee', hp: 1500, dmg: 60, rate: 60, range: 30, leash: 140, cleave: 45, armor: 4, speed: 1.0, r: 14,
    desc: 'A WWII tank ace in a battered Sherman. Very tough: he parks on the road, blocks ground enemies and blasts them with splashing shells.',
    abil: [{ id: 'sabot', name: 'Sabot Round', cd: 25, aim: 'line', desc: 'Click a direction: an armor-piercing round tears through every enemy on a 500-long line (double damage to armored enemies and bosses).' },
           { id: 'hulldown', name: 'Hull Down', cd: 45, aim: 0, desc: 'For 8 seconds he takes 75% less damage, fires twice as fast, and his shells stun for half a second.' }] },
  { id: 'kane', era: 'cold', name: 'Agent Kane', title: 'Shadow Operative', look: 'h_kane', color: '#2b2f33', role: 'ranged', hp: 240, dmg: 95, rate: 90, range: 290, speed: 1.8, r: 8, hitsAir: true, detect: true, pierceArmor: true, shotColor: '#eceff1',
    desc: 'A Cold War spy with a silenced long rifle. Huge range, sees cloaked enemies, ignores armor and hits air.',
    abil: [{ id: 'mark', name: 'Marked for Death', cd: 30, aim: 'enemy', desc: 'Click an enemy: for 10 seconds it is revealed, takes +75% damage from everything (bosses +40%), and pays double if it dies.' },
           { id: 'sleep', name: 'Sleeper Darts', cd: 40, aim: 0, desc: 'Darts put the 6 nearest enemies within 280 to sleep for 3 seconds (bosses 1 second). One more dart every 2 hero levels.' }] },
  { id: 'reyes', era: 'modern', name: 'Cmdr. Reyes', title: 'Drone Operator', look: 'h_reyes', color: '#6d7a52', role: 'ranged', hp: 300, dmg: 15, rate: 12, range: 170, speed: 1.7, r: 8, hitsAir: true, shotColor: '#ffd180',
    desc: 'A modern special forces commander with a carbine and a drone uplink. Fast fire at air and ground.',
    abil: [{ id: 'hellfire', name: 'Hellfire Strike', cd: 30, aim: 80, desc: 'Click the map: a drone missile hits that spot a moment later, blasting everything within 80 (flyers too).' },
           { id: 'drones', name: 'Drone Swarm', cd: 50, aim: 0, desc: '4 attack drones circle her for 15 seconds, each shooting air and ground enemies within 160.' }] },
  { id: 'nova', era: 'future', name: 'Nova', title: 'Vanguard Exo-Pilot', look: 'h_nova', color: '#5c7fa8', role: 'melee', hp: 1200, dmg: 64, rate: 36, range: 26, leash: 130, cleave: 38, armor: 6, speed: 2.0, r: 11,
    desc: 'A near-future exosuit pilot. A fast, armored brawler who holds the road and smashes whole groups.',
    abil: [{ id: 'jump', name: 'Jump Jets', cd: 20, aim: 90, desc: 'Click a spot within 360: she leaps there and the landing shockwave hits everything within 90, stunning it for 1.2 seconds (not bosses). She holds the new spot.' },
           { id: 'overcharge', name: 'Plasma Overcharge', cd: 45, aim: 0, desc: 'For 8 seconds her blows deal 2.5x damage and she fires plasma bolts at enemies within 160 (flyers too) 3 times a second.' }] },
  { id: 'zyxara', era: 'alien', name: "Zyx'ara", title: 'The Defector', look: 'h_zyx', color: '#9575cd', role: 'aoe', hp: 270, dmg: 32, rate: 42, range: 190, speed: 1.7, r: 8, hitsAir: true, chain: 2, aoe: 0, shieldMul: 3, shotColor: '#e040fb',
    desc: 'An alien psion who turned against the invasion. Her psionic bolts chain to 2 more enemies, hit air and do triple damage to shields and alien barriers.',
    abil: [{ id: 'seize', name: 'Mind Seize', cd: 35, aim: 'enemy', desc: 'Click an enemy (not a boss): for 8 seconds it turns around and fights its own side.' },
           { id: 'collapse', name: 'Gravity Collapse', cd: 50, aim: 80, desc: 'Click the map: a small black hole holds every non-boss enemy within 80 for 3 seconds, tearing at them, then collapses with a blast.' }] }
];
const HERO = Object.fromEntries(HEROES.map(h => [h.id, h]));


// ---------------------------------------------------------------------
//  ENEMIES   hp / speed (units per tick) / reward ($) / dmg (to your base)
// ---------------------------------------------------------------------
const ENEMIES = [
  { id: 'swarm', name: 'Swarm Bots', hp: 12, speed: 3.5, reward: 3, color: '#00cec9', r: 8, dmg: 2, wave: 1, desc: 'Tiny robotic crawlers that sprint in. They come in big groups.' },
  { id: 'basic', name: 'Rifleman', hp: 40, speed: 1.5, reward: 10, color: '#a5523a', r: 12, dmg: 10, wave: 1, desc: 'The standard enemy infantryman.' },
  { id: 'fast', name: 'Motorcycle Scout', hp: 25, speed: 2.8, reward: 12, color: '#c9a227', r: 10, dmg: 5, wave: 2, desc: 'Runs nearly twice as fast as a Rifleman.' },
  { id: 'tank', name: 'Light Tank', hp: 150, speed: 0.8, reward: 25, color: '#6f7a55', r: 16, dmg: 50, wave: 4, armor: 2, desc: 'Slow and tough, with light armor.' },
  { id: 'truck', name: 'Troop Truck', hp: 90, speed: 1.0, reward: 15, color: '#7d9a4a', r: 14, dmg: 15, wave: 6, split: 'dismount', splitN: 3, desc: 'Unloads 3 Dismounted Troops when it is destroyed.' },
  { id: 'dismount', name: 'Dismounted Troops', hp: 20, speed: 2.5, reward: 2, color: '#5e7a35', r: 6, dmg: 3, wave: 999, desc: 'The infantry that was riding in a Troop Truck.' },
  { id: 'commando', name: 'Commando', hp: 35, speed: 4.2, reward: 15, color: '#2d2d2d', r: 9, dmg: 8, wave: 7, dodge: 0.2, desc: 'Extremely fast and takes cover from 20% of bullets (blasts and beams always hit).' },
  { id: 'drone', name: 'Attack Drone', hp: 15, speed: 2.5, reward: 15, color: '#ecf0f1', r: 9, dmg: 10, wave: 8, air: true, desc: 'Flies straight at your base, ignoring the road. Needs anti-air.' },
  { id: 'armored', name: 'Armored Car', hp: 220, speed: 0.9, reward: 30, color: '#7f8c8d', r: 15, dmg: 40, wave: 8, armor: 6, desc: 'Heavy armor: every hit does 6 less damage. Rapid fire towers struggle.' },
  { id: 'shredder', name: 'Shredder', hp: 120, speed: 2.2, reward: 20, color: '#d35400', r: 12, dmg: 15, wave: 9, shred: true, desc: 'A buzz-saw robot that tears through walls and troops at triple speed.' },
  { id: 'medic', name: 'Combat Medic', hp: 60, speed: 1.4, reward: 20, color: '#ff7675', r: 11, dmg: 10, wave: 10, heal: 0.25, healRange: 80, desc: 'Heals every enemy near it. Kill it first.' },
  { id: 'regen', name: 'Regen Bot', hp: 120, speed: 1.3, reward: 25, color: '#55efc4', r: 13, dmg: 20, wave: 10, regen: 0.004, desc: 'Nanite repair swarms regenerate its health quickly unless it is poisoned or burning.' },
  { id: 'phasewalker', name: 'Phase Walker', hp: 60, speed: 1.8, reward: 20, color: 'rgba(200,225,255,0.75)', r: 11, dmg: 15, wave: 11, noSlow: true, desc: 'A phase-shifted robot. Cannot be slowed or frozen.' },
  { id: 'jet', name: 'Fighter Jet', hp: 80, speed: 1.5, reward: 25, color: '#34495e', r: 11, dmg: 20, wave: 12, air: true, desc: 'A tougher flyer.' },
  { id: 'shielded', name: 'Shielded', hp: 40, speed: 1.2, reward: 25, color: '#e67e22', r: 12, dmg: 15, wave: 12, shield: 75, desc: 'Power-armored trooper with an energy shield that soaks damage first.' },
  { id: 'teleporter', name: 'Teleporter', hp: 80, speed: 1.0, reward: 25, color: '#e056fd', r: 11, dmg: 20, wave: 13, blink: true, desc: 'Blinks 45 units forward every few seconds.' },
  { id: 'heavytank', name: 'Heavy Tank', hp: 400, speed: 0.5, reward: 50, color: '#2d3436', r: 20, dmg: 100, wave: 14, armor: 4, desc: 'A slow wall of health and armor.' },
  { id: 'zeppelin', name: 'Zeppelin', hp: 220, speed: 0.5, reward: 40, color: '#bdc3c7', r: 18, dmg: 60, wave: 15, air: true, desc: 'A slow, tanky airship.' },
  { id: 'carrier', name: 'Carrier', hp: 350, speed: 0.7, reward: 60, color: '#fdcb6e', r: 18, dmg: 80, wave: 16, onDeath: 'swarm', onDeathN: 5, desc: 'A walking carrier that releases 5 Swarm Bots when destroyed.' },
  { id: 'phantom', name: 'Phantom', hp: 70, speed: 1.6, reward: 30, color: '#6c5ce7', r: 11, dmg: 20, wave: 16, stealth: true, desc: 'CLOAKED: only towers that detect (Sniper, Tesla, supers) or anything inside a Radar circle can target it. Blasts still hit it.' },
  { id: 'dronecmd', name: 'Drone Commander', hp: 300, speed: 0.6, reward: 50, color: '#833471', r: 16, dmg: 60, wave: 18, summon: 'swarm', desc: 'A command platform that launches a fresh Swarm Bot every 2 seconds.' },
  { id: 'assault', name: 'Assault Trooper', hp: 180, speed: 1.1, reward: 30, color: '#b33939', r: 14, dmg: 30, wave: 19, enrage: true, desc: 'Charges at double speed when below half health. Finish it fast.' },
  { id: 'burrower', name: 'Burrower', hp: 160, speed: 1.2, reward: 30, color: '#8d6e63', r: 13, dmg: 25, wave: 20, burrow: true, desc: 'A tunneling machine. Digs underground for 2 seconds out of every 7. While burrowed nothing can hurt it.' },
  { id: 'colossus', name: 'Colossus Mech', hp: 600, speed: 0.45, reward: 70, color: '#636e72', r: 22, dmg: 120, wave: 25, armor: 12, noSlow: true, desc: 'A walking fortress. Massive armor (12) and immune to slows. Use armor piercing, poison or big hits.' },
  { id: 'hive', name: 'Hive Ship', hp: 500, speed: 0.45, reward: 80, color: '#fab1a0', r: 20, dmg: 90, wave: 30, air: true, summon: 'drone', desc: 'A flying carrier ship that launches Attack Drones every 4 seconds.' },
  { id: 'boss', name: 'Armored Train', hp: 800, speed: 0.6, reward: 150, color: '#7a2e24', r: 24, dmg: 200, wave: 999, armor: 3, boss: true, desc: 'Arrives every 5th wave. Takes off a huge chunk of base health if it gets through.' },
  // ---- the six BOSS WAVE bosses (every 10th wave, see BOSS_ROTATION). Each one has its own trick. ----
  { id: 'railway', name: 'Railway Gun', hp: 2000, speed: 0.4, reward: 300, color: '#1a252f', r: 30, dmg: 500, wave: 999, armor: 8, boss: true, steam: true, trick: 'FULL STEAM', tip: 'every 8 seconds it charges at triple speed, smashing walls and running over troops. Spread your firepower along the road.', desc: 'An armored rail monster. FULL STEAM: every 8 seconds it blows its whistle (a burst of smoke), then charges at triple speed for 2 seconds, smashing walls and running over troops in its way. Spread your firepower along the road.' },
  { id: 'titan', name: 'Titan Mech', hp: 2300, speed: 0.4, reward: 300, color: '#2c3e50', r: 30, dmg: 500, wave: 999, armor: 8, boss: true, stomp: true, trick: 'WAR STOMP', tip: 'at 2/3 and 1/3 health it stomps, stunning troops and wrecking walls, and gets faster each time.', desc: 'A towering war machine. WAR STOMP: at two thirds and one third health it stomps, stunning troops and heroes within 150 for 2 seconds and wrecking walls nearby, and every stomp makes it 25% faster.' },
  { id: 'jammer', name: 'Storm Jammer', hp: 1800, speed: 0.42, reward: 300, color: '#3d5361', r: 28, dmg: 500, wave: 999, armor: 5, boss: true, jammer: true, trick: 'EMP PULSE', tip: 'its pulse knocks out towers within 160. Shield Pylons protect towers; a Radar Jammer or EMP Blast stops the charge.', desc: 'An electronic-warfare crawler. EMP PULSE: every 7 seconds a blue ring charges around it, then every tower within 160 is knocked out for 2.5 seconds (troops are stunned). Long-range towers outside the ring keep firing. Towers under a Shield Pylon are safe, a Radar Jammer stops the charge, and EMP Blast resets it.' },
  { id: 'factory', name: 'War Factory', hp: 2300, speed: 0.36, reward: 320, color: '#6b5a45', r: 30, dmg: 500, wave: 999, armor: 6, boss: true, factory: true, trick: 'ASSEMBLY LINE', tip: 'it rolls out escorts every 6 seconds and a Heavy Tank at 2/3 and 1/3 health. Burst it down fast.', desc: 'A rolling tank factory. ASSEMBLY LINE: every 6 seconds it rolls out an escort squad (riflemen early on, then scouts, assault troopers and tanks), and at two thirds and one third health it ejects a Heavy Tank. Kill it fast or drown in escorts.' },
  { id: 'aegis', name: 'Aegis Walker', hp: 1800, speed: 0.4, reward: 320, color: '#5262b8', r: 28, dmg: 500, wave: 999, armor: 2, boss: true, aegis: 0.6, trick: 'REGENERATING SHIELD', tip: 'its shield recharges whenever it goes 3 seconds without a hit. Keep up the pressure, or strip it with EMP Blast.', desc: 'A four-legged walker behind a REGENERATING SHIELD worth 60% of its health. If it takes no damage for 3 seconds the shield recharges fast. When the shield breaks the walker overloads and stalls for 2 seconds. EMP Blast strips the shield and keeps it offline for 8 seconds; shield-breaker weapons tear through it.' },
  { id: 'warlord', name: 'Warlord', hp: 2400, speed: 0.4, reward: 320, color: '#7d2a24', r: 30, dmg: 500, wave: 999, armor: 6, boss: true, warlord: true, trick: 'BATTLE STANDARD', tip: 'enemies near it are faster and take 30% less damage, and its rally heals them. Kill the Warlord first.', desc: 'A command tank flying a war banner. BATTLE STANDARD: enemies within 150 of it move 25% faster and take 30% less damage, and every 8 seconds it sounds a RALLY that heals them by 15%. Take the Warlord out first and its army falls apart.' },
  // ---------------- ALIEN INVADERS (2.6: first contact at wave 16) ----------------
  // barrier = an alien energy barrier that blocks ALL damage until it breaks, then the alien is exposed for 5 seconds before it snaps back
  { id: 'greyscout', alien: true, name: 'Grey Scout', hp: 40, speed: 1.8, reward: 15, color: '#b0bec5', r: 10, dmg: 10, wave: 16, barrier: 25, desc: 'A small alien soldier inside a personal BARRIER. A barrier blocks ALL damage until it breaks; then the alien is exposed for 5 seconds before it snaps back to full. Burst it down while it is open.' },
  { id: 'stalker', alien: true, name: 'Warp Stalker', hp: 110, speed: 1.3, reward: 28, color: '#aa00ff', r: 11, dmg: 20, wave: 16, warp: 160, desc: 'Charges a warp jump every 4 seconds (it glows purple) and teleports 160 units ahead along the road, straight past walls. Stun it while it charges to cancel the jump. A Radar Jammer stops it completely.' },
  { id: 'splitter', alien: true, name: 'Splitter', hp: 80, speed: 1.0, reward: 30, color: '#76ff03', r: 15, dmg: 20, wave: 16, splits: 2, desc: 'A mass of alien jelly. When it dies it splits into two smaller, faster blobs, and those split again (7 blobs in all). Area damage is your friend.' },
  { id: 'saucer', alien: true, name: 'Flying Saucer', hp: 150, speed: 1.1, reward: 35, color: '#90a4ae', r: 15, dmg: 30, wave: 18, air: true, barrier: 40, abduct: true, desc: 'Flies straight at your base behind a barrier. Every 5 seconds its tractor beam knocks out the nearest tower below it for 3 seconds (Shield Pylons protect towers). Needs real anti-air.' },
  { id: 'shielddrone', alien: true, name: 'Barrier Drone', hp: 90, speed: 1.2, reward: 30, color: '#26c6da', r: 11, dmg: 15, wave: 20, projector: true, desc: 'Every 5 seconds it throws a fresh barrier (25% of their health) onto every enemy within 95 units, and snaps broken alien barriers straight back. Kill it first, or jam it with a Radar.' },
  { id: 'xbrute', alien: true, name: 'Xeno Brute', hp: 360, speed: 0.7, reward: 55, color: '#558b2f', r: 18, dmg: 50, wave: 23, armor: 3, barrier: 120, berserk: true, desc: 'A hulking alien warrior with thick hide (armor 3) and a heavy barrier. When its barrier breaks it goes berserk and runs 50% faster until the barrier snaps back.' },
  { id: 'mothership', alien: true, name: 'Mothership', hp: 2800, speed: 0.3, reward: 400, color: '#78909c', r: 34, dmg: 500, wave: 999, air: true, boss: true, barrier: 900, summon: 'saucer', summonEvery: 480, desc: 'Arrives on waves 35, 55, 75 and so on. A colossal flying saucer behind a huge barrier that launches Flying Saucers every 8 seconds. Bring anti-air and burst damage.' }
];
// robots, drones, flyers and alien machines: EMP and ion bolts stun these
const MACHINE_IDS = new Set(['swarm', 'shredder', 'regen', 'phasewalker', 'dronecmd', 'colossus', 'carrier', 'burrower', 'teleporter', 'shielddrone', 'saucer', 'mothership', 'hive', 'drone', 'jet', 'jammer', 'aegis']);
// BOSS WAVES (2.6): every 10th wave brings the next boss in this order (10 Railway Gun, 20 Titan Mech, 30 Storm Jammer,
// 40 War Factory, 50 Aegis Walker, 60 Warlord, 70 Railway Gun ...). Campaign maps and the Daily Challenge start the cycle elsewhere.
const BOSS_ROTATION = ['railway', 'titan', 'jammer', 'factory', 'aegis', 'warlord'];
// 3.0.1: the first boss of a run (wave 10, or 5 and 10 with Boss Rush) comes at 80% health: it is where players meet
// the boss tricks, with the small defense of wave 10 (2.5's plain wave-10 Railway Gun had no trick at all)
const BOSS_INTRO_HP = 0.8;
const STOMP_AT = [0.67, 0.34], FACTORY_TANK_AT = [0.67, 0.34];   // Titan stomps / War Factory Heavy Tanks at these health fractions (also the boss bar marks)
const isMachine = (e) => e.air || MACHINE_IDS.has(e.id);
const ENEMY = Object.fromEntries(ENEMIES.map(e => [e.id, e]));

// Random affixes that make individual enemies different (more common in later waves)
const AFFIXES = [
  { id: 'swift', name: 'Motorized', color: '#f1c40f', hp: 0.85, speed: 1.35, desc: '+35% speed, -15% health' },
  { id: 'heavy', name: 'Heavy', color: '#e17055', hp: 1.8, speed: 0.85, size: 1.3, reward: 1.6, desc: '+80% health, bigger, slower' },
  { id: 'plated', name: 'Up-Armored', color: '#b2bec3', armor: 4, desc: '+4 armor' },
  { id: 'warded', name: 'Shielded', color: '#74b9ff', shield: 0.5, desc: 'Gains an energy shield worth 50% of its health' },
  { id: 'vital', name: 'Nanite', color: '#55efc4', regen: 0.003, desc: 'Regenerates health' },
  { id: 'elite', name: 'Elite', color: '#ffd54f', hp: 1.5, reward: 2.5, desc: '+50% health, pays 2.5x' }
];

// s2 / s3 = share of base health you must still have at the end of a won map for 2 / 3 STARS (Recruit tops out at 2 stars)
const DIFFICULTIES = {
  easy:      { name: 'Recruit', color: 'btn-green', hp: 0.75, money: 150, limits: 1.5, lives: 150, s2: 0.5, s3: 2, desc: 'More money, weaker enemies, 1.5x tower limits.' },
  normal:    { name: 'Regular', color: 'btn-blue', hp: 1.0, money: 75, limits: 1.0, lives: 100, s2: 0.4, s3: 0.8, desc: 'The intended balance.' },
  hard:      { name: 'Veteran', color: 'btn-red', hp: 1.5, money: 50, limits: 0.6, lives: 100, s2: 0.25, s3: 0.6, desc: 'Tougher enemies, tighter limits.' },
  nightmare: { name: 'Total War', color: 'btn-purple', hp: 2.2, money: 50, limits: 0.5, lives: 50, s2: 0, s3: 0.35, desc: 'The hardest setting. Half limits, 50 base health.' }
};
// goal = waves to win (0 = no finish line). 'daily' is started from the Daily Challenge screen only (hidden in the Length row).
const MODES = {
  campaign: { name: 'Campaign', goal: 40, desc: 'Hold the map for 40 waves (4 boss waves). Win to earn up to 3 stars.' },
  classic: { name: 'Classic', goal: 100, desc: 'Survive 100 waves.' },
  endless: { name: 'Endless', goal: 0, desc: 'No finish line. How far can you go?' },
  sandbox: { name: 'Sandbox', goal: 0, desc: 'Unlimited money, nothing is saved. Test builds.' },
  daily: { name: 'Daily Challenge', goal: 30, hidden: true, desc: "Today's map and modifiers, 30 waves, best score counts." },
  test: { name: 'Test play', goal: 0, hidden: true, desc: 'A Map Editor test run: real money, no finish line, nothing is saved.' }
};
// DAILY CHALLENGE modifiers (2.6): every day picks one boon and two twists from the date
const DAILY_MODS = [
  { id: 'cash2', good: true, name: 'War Bonds', desc: 'Double cash: kill bounties and wave pay are doubled.' },
  { id: 'rich', good: true, name: 'Deep Pockets', desc: 'Start with an extra $1,000.' },
  { id: 'cheap', good: true, name: 'Lend-Lease', desc: 'Towers, barracks and contractors cost 25% less.' },
  { id: 'fastcd', good: true, name: 'Air Superiority', desc: 'Q / W / E abilities recharge twice as fast.' },
  { id: 'lives2', good: true, name: 'Fortified Base', desc: 'Your base has 50% more health.' },
  { id: 'fast', name: 'Blitzkrieg', desc: 'Enemies move 30% faster.' },
  { id: 'cap3', name: 'Budget Cuts', desc: 'No upgrades past level 3 (so no specialties).' },
  { id: 'armor', name: 'Up-Armored', desc: 'Every enemy gets +3 armor (it grows with the waves).' },
  { id: 'tough', name: 'Hardened', desc: 'Enemies have 40% more health.' },
  { id: 'elite', name: 'Elite Forces', desc: 'One enemy in three spawns with a random variant.' },
  { id: 'glass', name: 'Glass Base', desc: 'Your base has half the health.' },
  { id: 'noabil', name: 'Radio Silence', desc: 'No Q / W / E abilities.' },
  { id: 'shields', name: 'Energy Shields', desc: 'Every enemy carries a shield worth 30% of its health.' },
  { id: 'limits', name: 'Rationing', desc: 'Tower and barracks limits are halved.' },
  { id: 'bossx', name: 'Boss Rush', desc: 'A boss wave every 5 waves instead of every 10.' }
];
const DAILY_MOD = Object.fromEntries(DAILY_MODS.map(m => [m.id, m]));
const DAILY_CLASH = { fastcd: 'noabil', lives2: 'glass' };       // boon -> twist that would cancel it out
const starsFor = (lives, maxLives, diff) => { const d = DIFFICULTIES[diff] || DIFFICULTIES.normal, f = maxLives > 0 ? lives / maxLives : 0; return f >= d.s3 ? 3 : f >= d.s2 ? 2 : 1; };
const VARIANTS = {
  normal: { name: 'Normal', desc: 'The map as designed.' },
  mirror: { name: 'Mirrored', desc: 'Flipped left to right.' },
  flip: { name: 'Flipped', desc: 'Flipped top to bottom.' },
  random: { name: 'Random', desc: 'A random flip and random scenery every game.' }
};

// ---------------------------------------------------------------------
//  MAPS  (points in 0..1, scaled to the 960 x 600 board).  A map can have
//  several paths: each enemy picks one at random.
//  rank: 1 easy / 2 medium / 3 hard (shown on the map select).
//  water (2.6): terrain features in 0..1 coordinates that block building -
//    { river: [[x, y], ...], w: px }, { lake: [x, y, rx px, ry px] }, { poly: [[x, y], ...] }
//    t: 'water' (default) | 'lava' | 'ice' | 'mud' | 'crater'.  Roads cross
//    water and lava on bridges; on ICE enemies slide 25% faster, in MUD they
//    wade 25% slower.
// ---------------------------------------------------------------------
const MAPS = [
  { name: 'S-Curve', theme: 'grass', rank: 1, paths: [[[-0.05, 0.17], [0.72, 0.17], [0.72, 0.5], [0.26, 0.5], [0.26, 0.83], [0.95, 0.83]]] },
  { name: 'The Loop', theme: 'grass', rank: 1, paths: [[[-0.05, 0.5], [0.86, 0.5], [0.86, 0.15], [0.14, 0.15], [0.14, 0.85], [0.95, 0.85]]] },
  { name: 'Zig-Zag', theme: 'desert', rank: 1, paths: [[[-0.05, 0.1], [0.22, 0.1], [0.22, 0.9], [0.46, 0.9], [0.46, 0.1], [0.7, 0.1], [0.7, 0.9], [0.95, 0.9]]] },
  { name: 'Straightaway', theme: 'desert', bonus: 1.5, rank: 2, paths: [[[-0.05, 0.5], [0.95, 0.5]]], note: 'Short path, but every kill pays 1.5x.' },
  { name: 'The Spiral', theme: 'snow', rank: 1, paths: [[[-0.05, 0.08], [0.92, 0.08], [0.92, 0.92], [0.07, 0.92], [0.07, 0.25], [0.78, 0.25], [0.78, 0.75], [0.22, 0.75], [0.22, 0.42], [0.6, 0.42]]] },
  { name: 'Crossroads', theme: 'grass', rank: 2, paths: [[[-0.05, 0.17], [0.5, 0.17], [0.5, 0.83], [0.85, 0.83], [0.85, 0.33], [0.95, 0.33]]] },
  { name: 'The Snake', theme: 'snow', rank: 1, paths: [[[0.12, -0.08], [0.12, 0.33], [0.37, 0.33], [0.37, 0.67], [0.62, 0.67], [0.62, 0.33], [0.87, 0.33], [0.87, 0.93]]] },
  { name: 'The Fork', theme: 'scorched', rank: 2, paths: [[[-0.05, 0.5], [0.3, 0.5], [0.3, 0.18], [0.72, 0.18], [0.72, 0.5], [0.95, 0.5]], [[-0.05, 0.5], [0.3, 0.5], [0.3, 0.82], [0.72, 0.82], [0.72, 0.5], [0.95, 0.5]]], note: 'The path splits in two. Enemies pick a side at random.' },
  { name: 'Twin Fronts', theme: 'night', rank: 2, paths: [[[-0.05, 0.2], [0.4, 0.2], [0.4, 0.5], [0.95, 0.5]], [[-0.05, 0.8], [0.58, 0.8], [0.58, 0.5], [0.95, 0.5]]], note: 'Two entrances that merge before the base.' },
  { name: 'Crossfire', theme: 'scorched', rank: 3, paths: [[[-0.05, 0.3], [0.28, 0.3], [0.28, 0.7], [0.6, 0.7], [0.6, 0.5], [0.93, 0.5]], [[0.45, -0.08], [0.45, 0.3], [0.6, 0.3], [0.6, 0.5], [0.93, 0.5]], [[0.45, 1.08], [0.45, 0.88], [0.78, 0.88], [0.78, 0.5], [0.93, 0.5]]], note: 'Three entrances. Hard to cover them all.' },
  // ---------------- 2.6: twelve new theaters ----------------
  { name: 'Bridgehead', theme: 'grass', rank: 1, isNew: true, paths: [[[-0.05, 0.3], [0.3, 0.3], [0.3, 0.12], [0.64, 0.12], [0.64, 0.45], [0.36, 0.45], [0.36, 0.8], [0.76, 0.8], [0.76, 0.55], [0.94, 0.55]]],
    water: [{ river: [[0.5, -0.05], [0.47, 0.2], [0.53, 0.42], [0.47, 0.62], [0.52, 0.85], [0.49, 1.05]], w: 40 }], note: 'A river cuts the field in two. The road crosses it on three bridges; nothing can be built on the water.' },
  { name: 'Rubble City', theme: 'urban', rank: 2, isNew: true, paths: [
      [[-0.05, 0.5], [0.16, 0.5], [0.16, 0.18], [0.44, 0.18], [0.44, 0.5], [0.58, 0.5], [0.58, 0.18], [0.84, 0.18], [0.84, 0.5], [0.94, 0.5]],
      [[-0.05, 0.5], [0.16, 0.5], [0.16, 0.82], [0.44, 0.82], [0.44, 0.5], [0.58, 0.5], [0.58, 0.82], [0.84, 0.82], [0.84, 0.5], [0.94, 0.5]],
      [[-0.05, 0.5], [0.16, 0.5], [0.16, 0.18], [0.44, 0.18], [0.44, 0.5], [0.58, 0.5], [0.58, 0.82], [0.84, 0.82], [0.84, 0.5], [0.94, 0.5]],
      [[-0.05, 0.5], [0.16, 0.5], [0.16, 0.82], [0.44, 0.82], [0.44, 0.5], [0.58, 0.5], [0.58, 0.18], [0.84, 0.18], [0.84, 0.5], [0.94, 0.5]]],
    note: 'The streets split around the city blocks twice. Every enemy picks its own way through.' },
  { name: 'Swamp Delta', theme: 'swamp', rank: 2, isNew: true, paths: [[[0.08, -0.08], [0.08, 0.3], [0.42, 0.3], [0.42, 0.5], [0.66, 0.5], [0.66, 0.86], [0.88, 0.86], [0.88, 0.3]], [[0.08, 1.08], [0.08, 0.72], [0.42, 0.72], [0.42, 0.5], [0.66, 0.5], [0.66, 0.86], [0.88, 0.86], [0.88, 0.3]]],
    water: [{ lake: [0.66, 0.68, 62, 46], t: 'mud' }, { lake: [0.25, 0.51, 70, 42] }, { lake: [0.52, 0.13, 58, 36] }, { lake: [0.77, 0.58, 40, 48] }], note: 'Two roads out of the marsh meet in the middle. The mud bog slows everything that wades through it.' },
  { name: 'Caldera', theme: 'volcanic', rank: 2, isNew: true, paths: [[[-0.05, 0.5], [0.12, 0.5], [0.27, 0.12], [0.73, 0.12], [0.88, 0.5], [0.73, 0.88], [0.27, 0.88], [0.2, 0.7], [0.34, 0.34], [0.62, 0.34], [0.62, 0.6]]],
    water: [{ lake: [0.43, 0.63, 50, 38], t: 'lava' }, { lake: [0.05, 0.12, 46, 36], t: 'lava' }, { lake: [0.95, 0.12, 46, 36], t: 'lava' }, { lake: [0.95, 0.88, 46, 36], t: 'lava' }, { lake: [0.05, 0.88, 46, 36], t: 'lava' }], note: 'The road circles the volcano, then spirals into your base in the crater. Lava pools block building.' },
  { name: 'Moonbase', theme: 'lunar', rank: 3, isNew: true, paths: [[[0.12, -0.08], [0.12, 0.3], [0.5, 0.3], [0.5, 0.6], [0.2, 0.6], [0.2, 0.86], [0.9, 0.86]], [[0.5, -0.08], [0.5, 0.6], [0.2, 0.6], [0.2, 0.86], [0.9, 0.86]], [[0.88, -0.08], [0.88, 0.3], [0.5, 0.3], [0.5, 0.6], [0.2, 0.6], [0.2, 0.86], [0.9, 0.86]]],
    water: [{ lake: [0.75, 0.6, 62, 46], t: 'crater' }, { lake: [0.3, 0.13, 42, 30], t: 'crater' }, { lake: [0.06, 0.6, 34, 28], t: 'crater' }], note: 'Three landing zones on the Moon feed one road. Watch every lane.' },
  { name: 'Canyon Run', theme: 'canyon', rank: 1, isNew: true, paths: [[[-0.05, 0.12], [0.32, 0.12], [0.12, 0.47], [0.46, 0.47], [0.26, 0.84], [0.64, 0.84], [0.8, 0.47], [0.62, 0.14], [0.94, 0.14]]], note: 'Diagonal switchbacks down a red canyon. A long road, and the lanes run close together.' },
  { name: 'Beachhead', theme: 'coast', rank: 2, isNew: true, paths: [[[0.2, 1.08], [0.2, 0.55], [0.4, 0.55], [0.4, 0.32], [0.14, 0.32], [0.14, 0.1], [0.5, 0.1]], [[0.8, 1.08], [0.8, 0.55], [0.6, 0.55], [0.6, 0.32], [0.86, 0.32], [0.86, 0.1], [0.5, 0.1]]],
    water: [{ poly: [[-0.02, 0.79], [0.2, 0.75], [0.42, 0.81], [0.6, 0.76], [0.8, 0.8], [1.02, 0.76], [1.02, 1.02], [-0.02, 1.02]] }], note: 'Two landing roads come in from the sea and meet at your bunker on the bluff.' },
  { name: 'Glacier Pass', theme: 'snow', rank: 2, isNew: true, paths: [[[-0.05, 0.85], [0.15, 0.85], [0.15, 0.15], [0.38, 0.15], [0.38, 0.55], [0.7, 0.55], [0.7, 0.85], [0.94, 0.85]]],
    water: [{ lake: [0.54, 0.55, 118, 84], t: 'ice' }, { lake: [0.86, 0.4, 42, 52], t: 'ice' }], note: 'The road crosses a frozen lake. On the ice enemies slide 25% faster.' },
  { name: 'Jungle Crossing', theme: 'jungle', rank: 1, isNew: true, paths: [[[-0.05, 0.5], [0.7, 0.5], [0.7, 0.15], [0.4, 0.15], [0.4, 0.85], [0.94, 0.85]]],
    water: [{ river: [[0.86, -0.05], [0.84, 0.3], [0.9, 0.6], [0.86, 1.05]], w: 36 }], note: 'The trail loops back and crosses itself. Towers at the crossing cover it twice.' },
  { name: 'Iron Works', theme: 'factory', rank: 2, isNew: true, paths: [[[-0.05, 0.2], [0.4, 0.2], [0.4, 0.78], [0.74, 0.78], [0.74, 0.5], [0.94, 0.5]], [[-0.05, 0.85], [0.22, 0.85], [0.22, 0.5], [0.6, 0.5], [0.6, 0.15], [0.84, 0.15], [0.84, 0.5], [0.94, 0.5]]],
    water: [{ lake: [0.5, 0.94, 52, 26], t: 'lava' }], note: 'Two conveyor roads cross in the middle of the works and meet at the gate.' },
  { name: 'The Gauntlet', theme: 'night', rank: 1, isNew: true, paths: [[[-0.05, 0.1], [0.9, 0.1], [0.9, 0.3], [0.1, 0.3], [0.1, 0.5], [0.9, 0.5], [0.9, 0.7], [0.1, 0.7], [0.1, 0.9], [0.94, 0.9]]], note: 'The longest road of all: five lanes stacked on top of each other. A good map for new commanders.' },
  { name: 'Encirclement', theme: 'scorched', rank: 3, isNew: true, paths: [[[-0.05, 0.12], [0.7, 0.12], [0.7, 0.32], [0.5, 0.32], [0.5, 0.5]], [[0.88, -0.08], [0.88, 0.72], [0.66, 0.72], [0.66, 0.5], [0.5, 0.5]], [[1.05, 0.88], [0.3, 0.88], [0.3, 0.68], [0.5, 0.68], [0.5, 0.5]], [[0.12, 1.08], [0.12, 0.3], [0.34, 0.3], [0.34, 0.5], [0.5, 0.5]]],
    note: 'The hardest map. Four roads close in on a base in the middle, one from every side.' }
];
const MAP_RANK = ['', 'Easy', 'Medium', 'Hard'];

const THEMES = {
  grass:   { name: 'Farmland', ground: '#2f7d3b', ground2: '#2a7035', path: '#8a7f6a', edge: '#5b5242', deco: ['tree', 'tree', 'rock', 'bush'], water: '#3d8fd1' },
  desert:  { name: 'Desert', ground: '#c8a45c', ground2: '#bd9850', path: '#8c6f45', edge: '#6b5333', deco: ['cactus', 'rock', 'rock'] },
  snow:    { name: 'Arctic', ground: '#dfe8ee', ground2: '#d2dde5', path: '#7c8a96', edge: '#5d6a75', deco: ['pine', 'pine', 'rock'] },
  scorched: { name: 'Scorched earth', ground: '#3b3330', ground2: '#342c29', path: '#6b5a4c', edge: '#2b221c', deco: ['rock', 'rock', 'wreck'] },
  night:   { name: 'Night', ground: '#1d2b3a', ground2: '#192634', path: '#4a5568', edge: '#2d3748', deco: ['pine', 'rock', 'wreck', 'crystal'] },
  // 2.6
  urban:   { name: 'Ruined city', ground: '#5c5f63', ground2: '#505357', path: '#3c4045', edge: '#26292c', deco: ['ruin', 'ruin', 'rubble', 'crate', 'car'], water: '#3b6f8f' },
  swamp:   { name: 'Swamp', ground: '#445a39', ground2: '#3a4f30', path: '#6b5e43', edge: '#463b28', deco: ['reed', 'reed', 'deadtree', 'bush'], water: '#3a5a4a' },
  volcanic: { name: 'Volcano', ground: '#2f2624', ground2: '#3f2f29', path: '#5b4a42', edge: '#1d1614', deco: ['vent', 'rock', 'rock', 'spire'] },
  lunar:   { name: 'Moon', ground: '#5a5a6c', ground2: '#4c4c5f', path: '#80808f', edge: '#3a3a4c', deco: ['crater', 'crater', 'crystal', 'dish', 'rock'] },
  canyon:  { name: 'Canyon', ground: '#b9693f', ground2: '#a95d36', path: '#8a5735', edge: '#5f3820', deco: ['mesa', 'mesa', 'rock', 'cactus'] },
  coast:   { name: 'Beach', ground: '#d6c18a', ground2: '#cbb57c', path: '#9e8b63', edge: '#77663f', deco: ['hedgehog', 'hedgehog', 'palm', 'bunker'], water: '#2b7bb5' },
  jungle:  { name: 'Jungle', ground: '#22663a', ground2: '#1c5931', path: '#7a5934', edge: '#4d3820', deco: ['palm', 'fern', 'fern', 'tree'], water: '#2f7f70' },
  factory: { name: 'Factory', ground: '#4c5047', ground2: '#43473f', path: '#36393c', edge: '#222426', deco: ['crate', 'barrel', 'pipe', 'chimney'] }
};
// terrain features (MAPS[].water): fill, shore line, and the speed change for enemies on a road across them
const TERRAIN = {
  water:  { fill: '#3d8fd1', shore: 'rgba(255,255,255,0.35)', name: 'Water' },
  lava:   { fill: '#ff6a1f', shore: '#3a120a', name: 'Lava' },
  ice:    { fill: '#cbe9f6', shore: '#8fb9cc', name: 'Ice', mul: 1.25 },
  mud:    { fill: '#5b4a2e', shore: '#3d311d', name: 'Mud', mul: 0.75 },
  crater: { fill: '#3f3f50', shore: '#8a8a9c', name: 'Crater' }
};

// ---------------------------------------------------------------------
//  CUSTOM MAPS (3.0). The Map Editor works on a 24 x 15 grid of 40 px tiles.
//  Roads are lists of tiles (the first one is where enemies come in) that
//  always end at the base; terrain and scenery are painted on tiles.
//  These lists are part of the share-code format: only ever ADD to the end.
// ---------------------------------------------------------------------
const GRID = 40, GW = W / GRID, GH = H / GRID;
const CM_THEMES = ['grass', 'desert', 'snow', 'scorched', 'night', 'urban', 'swamp', 'volcanic', 'lunar', 'canyon', 'coast', 'jungle', 'factory'];
const CM_TERRAIN = ['', 'water', 'lava', 'ice', 'mud', 'crater'];
const CM_DECO = ['tree', 'bush', 'pine', 'rock', 'cactus', 'crystal', 'wreck', 'ruin', 'rubble', 'crate', 'car', 'reed', 'deadtree', 'vent', 'spire', 'crater', 'dish', 'mesa', 'hedgehog', 'palm', 'fern', 'bunker', 'barrel', 'pipe', 'chimney'];
const CM_DECO_NAMES = { tree: 'Tree', bush: 'Bush', pine: 'Pine', rock: 'Rock', cactus: 'Cactus', crystal: 'Crystal', wreck: 'Tank wreck', ruin: 'Ruin', rubble: 'Rubble', crate: 'Crate', car: 'Wrecked car', reed: 'Reeds', deadtree: 'Dead tree', vent: 'Lava vent', spire: 'Obsidian spire', crater: 'Shell crater',
  dish: 'Radar dish', mesa: 'Mesa', hedgehog: 'Hedgehog', palm: 'Palm', fern: 'Fern', bunker: 'Bunker', barrel: 'Barrels', pipe: 'Pipe', chimney: 'Chimney' };
const CM_TERRAIN_INFO = { water: 'Nothing can be built on it. Roads cross on bridges.', lava: 'Nothing can be built on it. Roads cross on bridges.', ice: 'No building. Enemies slide 25% faster on a road across it.', mud: 'No building. Enemies wade 25% slower on a road across it.', crater: 'No building. Just a hole in the ground.' };
const CM_LIMITS = { roads: 6, corners: 40, deco: 120, name: 24, maps: 40, minRoad: 200, money: 25000, lives: 1000 };
const CM_SCENERY = ['None', 'Light', 'Normal'];

// Targeting priorities: name + scoring function (bigger = shot first)
const TARGETING = [
  { id: 'first', name: 'First (closest to base)' },
  { id: 'last', name: 'Last (just arrived)' },
  { id: 'strong', name: 'Strongest (max health)' },
  { id: 'weak', name: 'Weakest (max health)' },
  { id: 'mosthp', name: 'Most health left' },
  { id: 'leasthp', name: 'Least health left' },
  { id: 'close', name: 'Closest to tower' },
  { id: 'far', name: 'Farthest from tower' },
  { id: 'fast', name: 'Fastest' },
  { id: 'slow', name: 'Slowest' },
  { id: 'air', name: 'Air first' },
  { id: 'ground', name: 'Ground first' },
  { id: 'armored', name: 'Armored / shielded first' },
  { id: 'boss', name: 'Bosses first' },
  { id: 'random', name: 'Random' }
];

const ALL_ABILITIES = [
  { id: 'strike', name: 'Airstrike', key: 'Q', cd: 60, wave: 3, desc: 'Click the map: bombers carpet-bomb a line through that spot.' },
  { id: 'reinforce', gm: 'troop', name: 'Paratroopers', key: 'W', cd: 50, wave: 5, desc: 'Click the map: 4 paratroopers drop in and fight for 25 seconds.' },
  { id: 'emp', gm: 'tower', name: 'EMP Blast', key: 'W', cd: 55, wave: 5, desc: 'Every enemy on the map loses its energy shield and alien barrier, flyers, machines and aliens are stunned for 2 seconds, and everything takes 6% of its health (bosses 2%).' },
  { id: 'freeze', name: 'Cryo Burst', key: 'E', cd: 75, wave: 8, desc: 'Every enemy on the map is frozen for 1.5 seconds, then slowed for 4 more.' }
];
// ABILITIES is the list for the game that is running; setAbilityMode() refills it (in place) for a mode.
const ABILITIES = ALL_ABILITIES.filter(a => a.gm !== 'troop');
function setAbilityMode(gm) { const list = ALL_ABILITIES.filter(a => inMode(a, gm) && !(gm === 'legacy' && a.id === 'emp')); ABILITIES.length = 0; for (const a of list) ABILITIES.push(a); }

const ACHIEVEMENTS = [
  { id: 'first', name: 'First Contact', desc: 'Clear wave 1.' },
  { id: 'w50_tower', name: 'Tower Veteran', desc: 'Reach wave 50 in Tower Mode.', gm: 'tower' },
  { id: 'w50_troop', name: 'Field Commander', desc: 'Reach wave 50 in Troop Mode.', gm: 'troop' },
  { id: 'win_tower', name: 'Master Builder', desc: 'Beat wave 100 in Tower Mode.', gm: 'tower' },
  { id: 'win_troop', name: 'Field Marshal', desc: 'Beat wave 100 in Troop Mode.', gm: 'troop' },
  { id: 'w25', name: 'Holding the Line', desc: 'Reach wave 25.' },
  { id: 'w50', name: 'Halfway to Victory', desc: 'Reach wave 50.' },
  { id: 'win', name: 'Victory', desc: 'Beat wave 100 in Classic.' },
  { id: 'flawless', name: 'Untouchable', desc: 'Beat wave 100 without losing any base health.' },
  { id: 'nightmare', name: 'Hardened Veteran', desc: 'Beat wave 100 on Total War.' },
  { id: 'endless150', name: 'The Long War', desc: 'Reach wave 150 in Endless.' },
  { id: 'spec', name: 'Specialist', desc: 'Specialize a tower.' },
  { id: 'super', name: 'Strategic Asset', desc: 'Build a super tower.', gm: 'tower' },
  { id: 'army', name: 'Army', desc: 'Have 12 barracks troops on the field at once.', gm: 'troop' },
  { id: 'hire', name: 'Private Contract', desc: 'Hire your first contractor squad.', gm: 'troop' },
  { id: 'drill', name: 'Drill Instructor', desc: 'Specialize 5 or more units with a single click.' },
  { id: 'garrison', name: 'Combined Arms', desc: 'Own one of every barracks type at the same time.', gm: 'troop' },
  { id: 'bigspender', name: 'War Chest', desc: 'Have 5 contractor squads out at the same time.', gm: 'troop' },
  { id: 'rich', name: 'War Economy', desc: 'Hold $25,000 at once.' },
  { id: 'stack10', name: 'Tall Order', desc: 'Stack 10 towers on one spot.', gm: 'tower' },
  { id: 'kills1000', name: 'Body Count', desc: 'Kill 1,000 enemies in one game.' },
  { id: 'allmaps', name: 'Theater Commander', desc: 'Earn at least one star on every map.' },
  { id: 'hero10', name: 'Living Legend', desc: 'Raise a hero to level 10.' },
  { id: 'contact', name: 'Close Encounter', desc: 'Survive the first alien invasion wave (wave 16).' },
  { id: 'mothership', name: 'Saucer Down', desc: 'Destroy an alien Mothership.' },
  { id: 'alientech', name: 'Reverse Engineered', desc: 'Build 5 different alien-tech towers in one game.' },
  { id: 'campaign', name: 'Campaign Ribbon', desc: 'Win a map in Campaign (hold it for 40 waves).' },
  { id: 'stars30', name: 'Star Collector', desc: 'Earn 30 map stars.' },
  { id: 'allstars', name: 'Perfect Record', desc: 'Earn 3 stars on every map.' },
  { id: 'bosshunter', name: 'Boss Hunter', desc: 'Defeat all six boss-wave bosses: Railway Gun, Titan Mech, Storm Jammer, War Factory, Aegis Walker and Warlord.' },
  { id: 'dailywin', name: 'Order of the Day', desc: 'Win a Daily Challenge (hold all 30 waves).' },
  { id: 'streak3', name: 'Reporting for Duty', desc: 'Play the Daily Challenge three days in a row.' },
  { id: 'cartographer', name: 'Cartographer', desc: 'Save a map you made in the Map Editor.' },
  { id: 'fieldtest', name: 'Home Turf', desc: 'Clear wave 10 on a custom map (test runs count, Sandbox does not).' }
];

const TIPS_TOWER = [
  'Tower Mode: stack Basic towers early, then add Standard, Sniper and Flak. Mix ground and air coverage before wave 8.',
  'Farms pay out at the end of every wave. Power Plants boost them by 20% per level.',
  'Frost towers and Cryo-Emitters right before a Field Gun or Inferno multiply their damage.',
  'Phantoms are cloaked: Snipers, Tesla coils, supers or any tower inside a Radar circle can shoot them.',
  'EMP Blast strips every shield and stuns flyers and machines: save it for Shielded waves and Hive Ships.',
  'Super towers are limited to one on the board. Pick the one that fits the wave you are afraid of.',
  'Pick a hero (' + '$250' + ') from the hero bar and drop it near the road. Heroes level up from kills: Z and X fire their two abilities.',
  'Aliens arrive at wave 16. Their barriers block ALL damage until broken: burst them with big hits, Xeno Blasters, Ion Disruptors or EMP Blast.',
  'Flying Saucers knock out the tower below them. Shoot them down with SAM Sites, Flak or CIWS, or cover your towers with a Shield Pylon.',
  'Boss waves come every 10 waves. The Storm Jammer knocks out towers near it: keep a Shield Pylon over your key towers, or stop its charge with a Radar Jammer or EMP Blast.',
  'The Aegis Walker regrows its shield after 3 quiet seconds. Hit it with everything at once, or strip the shield with EMP Blast.',
  'Win a map in Campaign (40 waves) to earn stars. Try the Daily Challenge on the main menu: a new map and modifiers every day.',
  'Make your own map in the Map Editor (main menu), then press Share code to send it to a friend. They paste the code to play it.'
];
const TIPS_TROOP = [
  'Troop Mode: start with an Infantry Barracks near the road, then add a Marksman School for anti-air.',
  'Drag a box over troops, then right-click to move the whole group. Troops hold their new post.',
  'Marksmen and Grenadiers hit air. Sniper Teams, Gauss Snipers and Dual-Purpose Guns ignore armor: bring them for tanks and bosses.',
  'A Command Post makes troops in its circle hit harder and heal. Put it just behind your front line.',
  'Contractors are paid-for squads: drop them on a boss or into a hole in your line. A Contractor HQ cuts prices.',
  'Field Hospitals and Mechanic Bays keep your troops alive between fights. Radar lets troops see Phantoms.',
  'Sandbags make enemies stop and chew while your marksmen and gun crews shoot them.',
  'Pick a hero from the hero bar and drop it near the road. Heroes level up from kills: Z and X fire their two abilities.',
  'From wave 10 the Alien tab has a Xeno Hatchery, Shield Pylons, Stasis Fields and Warp Mines. Aliens arrive at wave 16.',
  'Boss waves come every 10 waves. The Titan Mech stomps at 2/3 and 1/3 health and stuns troops near it: pull your line back before it stomps.',
  'The Warlord makes nearby enemies faster and tougher. Send a contractor squad or your hero straight at it.',
  'Win a map in Campaign (40 waves) to earn stars. Try the Daily Challenge on the main menu: a new map and modifiers every day.',
  'Make your own map in the Map Editor (main menu): roads, rivers, lava and scenery. Share code turns it into a short code for your friends.'
];
// Tips shown in a legacy (mixed) game
const TIPS = [
  'Drag a box over towers or troops to select a group. Right-click moves selected troops. Hold Alt while dragging to grab only towers.',
  'At level 5, pick a specialty for one unit, a whole stack, or every eligible tower in your selection at once.',
  'Open the Mercs tab to hire contractor squads for gold. Click the map near the road to drop them. They fight for a while, then leave.',
  'A Contractor HQ lowers hire prices, shortens cooldowns and unlocks stronger contractors early.',
  'Tank Traps and Oil Slicks do not block enemies, but they slow and hurt everything that crosses them. Sandbags make enemies stop and chew.',
  'Engineers plant mines, Medics heal, Grenadiers splash, Marksmen hit air. Mix barracks types and add a Command Post.',
  'Press Esc or right-click empty ground to deselect. The Deselect button works too.',
  'Almost every tower, barracks, wall and trap specializes at level 5. Each path changes how it plays.',
  'Armor removes damage from EVERY hit. Use big hits, poison, or armor-piercing upgrades on Armored Cars and Colossus Mechs.',
  'Cloaked Phantoms can only be shot by Snipers, Tesla coils, supers, or towers near a Radar.',
  'Click a tower in the shop while placing to stack another one onto the same spot.',
  'Starting the next wave early (while the timer runs) pays a bonus.',
  'The Codex lists the stats of every tower at every level.',
  'Frost towers and Cryo-Emitters right before a Field Gun or Inferno multiply their damage.',
  'Farms pay out at the end of every wave. Power Plants boost them by 20% per level.',
  'Numbers 1 to 9 pick towers from the shop. Q / W / E fire your abilities.',
  'The Tesla coil hits air and sees stealth, and its Coil Array specialty chains lightning across a whole group.',
  'Sci-fi options: Plasma Rifles, Power Armor, Drone Swarms and Rail Cannons are specialties on the barracks, and the Mercs tab has Combat Drones, Plasma Troopers, Power Armor and a Mech Walker.'
];
