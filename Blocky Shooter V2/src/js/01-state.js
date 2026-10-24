// ==========================================
// 1. STATE & CONFIGURATION (Version 4.0)
// ==========================================


const VERSION = '4.0';
const V3 = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);          // progress of t through [a, b]
const bump = (t, a, b) => Math.sin(Math.PI * seg(t, a, b));       // 0 -> 1 -> 0 across [a, b]


function loadJSON(k, def) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch (e) { return def; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
const settings = Object.assign({ quality: 'auto', fov: 75, sens: 1, volume: 0.8, showFps: false,
    sleeve: 'navy', glove: 'grey', xhStyle: 'cross', xhColor: '#ffffff', camo: 'stock', tracer: 'default', killfx: 'blocks',
    mode: 'classic', map: 'random', light: 'random', diff: 'normal', powers: [], cls: 'assault' }, loadJSON('blocky21_settings', {}));
if (!Array.isArray(settings.powers)) settings.powers = [];
// lifetime stats (the run itself is still permadeath - only these totals are kept)
const life = Object.assign({ xp: undefined, runs: 0, kills: 0, headshots: 0, bosses: 0, shots: 0, hits: 0, damage: 0, time: 0, waves: 0, best: {}, weaponKills: {} }, loadJSON('blocky21_life', {}));
if (!life.cls || typeof life.cls !== 'object') life.cls = {};      // 4.0: { assault: { runs, kills, best } ... } - older saves start at zero
if (!life.maps || typeof life.maps !== 'object') life.maps = {};    // 4.0: { mall: { runs, waves, best } ... } - older saves start at zero
if (life.xp === undefined) life.xp = Math.round((life.kills || 0) * 10 + (life.waves || 0) * 60);   // earlier play counts toward your rank
if (settings.quality === 'medium') settings.quality = 'normal';


// hip: viewmodel position at the hip (camera space). adsDist: how far the sight sits from your eye when aiming.
const weaponsDb = {
    pistol:   { name: 'Pistol',      cost: 0,    color: 0x9ca3af, damage: 22,  fireRate: 240,  auto: false, magSize: 12,  reloadTime: 1150, range: 70,  pellets: 1,  spread: 0.006, recoil: 0.05, punch: 0.012, zoomFov: 62, hsMult: 1.4, vmScale: 1.3, reloadStyle: 'mag',      hip: [0.13, -0.11, -0.4], adsDist: 0.34, flash: 0.22, desc: 'Sidearm. 2 headshots or 3 body shots per grunt.' },
    // 4.0: akimbo machine pistols - the two guns take turns, so holding the trigger keeps a steady stream going
    dual:     { name: 'Dual Pistols', cost: 1200, color: 0xe879f9, damage: 19, fireRate: 120,  auto: true,  magSize: 24,  reloadTime: 1900, range: 70,  pellets: 1,  spread: 0.011, recoil: 0.034, punch: 0.009, zoomFov: 66, hsMult: 1.5, vmScale: 1.15, akimbo: true, dmgUp: 0.15, reloadStyle: 'dual', hip: [0, -0.135, -0.4], adsDist: 0.36, flash: 0.2, desc: 'Akimbo! Hold to fire both guns in turn. Aim to pull them in tight for accuracy.' },
    revolver: { name: 'Revolver',    cost: 900,  color: 0xd4a017, damage: 90,  fireRate: 430,  auto: false, magSize: 6,   reloadTime: 2100, range: 90,  pellets: 1,  spread: 0.003, recoil: 0.15, punch: 0.045, zoomFov: 58, hsMult: 2.5, vmScale: 1.3, reloadStyle: 'revolver', hip: [0.13, -0.115, -0.4], adsDist: 0.36, flash: 0.36, desc: 'Hand cannon. One-taps grunts.' },
    smg:      { name: 'SMG',         cost: 600,  color: 0x3b82f6, damage: 9.6, fireRate: 78,   auto: true,  magSize: 32,  reloadTime: 1700, range: 70,  pellets: 1,  spread: 0.013, recoil: 0.03, punch: 0.006, zoomFov: 62, hsMult: 1.2,   reloadStyle: 'mag',      hip: [0.144, -0.156, -0.384], adsDist: 0.2,  flash: 0.24, desc: 'Bullet hose with a holo sight.' },
    // 4.0: a sword in your weapon slots. No ammo: slashes cut every zombie in an arc in front of you, right-click lunges
    katana:   { name: 'Katana',      cost: 1800, color: 0xfda4af, damage: 55,  fireRate: 340,  auto: true,  magSize: 1,   reloadTime: 1,    range: 3.9, pellets: 1,  spread: 0, recoil: 0.02, punch: 0.012, zoomFov: 75, hsMult: 1, melee: true, noAds: true, moveMult: 1.12, arc: 0.42, lunge: 2.2, lungeCd: 3, reloadStyle: 'none', hip: [0.16, -0.085, -0.4], adsDist: 0.3, flash: 0, desc: 'Slashes cut every zombie in front of you. No ammo. RIGHT-CLICK to LUNGE through the horde.' },
    ar:       { name: 'Rifle',       cost: 1500, color: 0x10b981, damage: 17,  fireRate: 105,  auto: true,  magSize: 30,  reloadTime: 2000, range: 150, pellets: 1,  spread: 0.006, recoil: 0.04, punch: 0.009, zoomFov: 52, hsMult: 1.2, reloadStyle: 'mag',      hip: [0.144, -0.156, -0.36],  adsDist: 0.19, flash: 0.3,  desc: 'Accurate full-auto with a red dot. 3 hits per grunt.' },
    burst:    { name: 'Burst Rifle', cost: 2000, color: 0x14b8a6, damage: 18,  fireRate: 290,  auto: true,  burst: 3, burstGap: 55, magSize: 36, reloadTime: 1650, range: 170, pellets: 1, spread: 0.0025, recoil: 0.026, punch: 0.006, zoomFov: 48, hsMult: 1.15, reloadStyle: 'mag', hip: [0.144, -0.162, -0.36], adsDist: 0.12, flash: 0.28, desc: 'Hold to fire 3-round bursts. One burst to the head drops a grunt.' },
    shotgun:  { name: 'Shotgun',     cost: 2200, color: 0xef4444, damage: 30,  fireRate: 600,  auto: false, magSize: 8,   reloadTime: 250,  shellTime: 400, range: 60, pellets: 12, spread: 0.042, recoil: 0.2, punch: 0.05, zoomFov: 62, hsMult: 2, knock: 1, reloadStyle: 'shell', hip: [0.144, -0.156, -0.36], adsDist: 0.2, flash: 0.46, desc: '12 heavy pellets. Knocks enemies back.' },
    dmr:      { name: 'Marksman',    cost: 3500, color: 0xc2a36b, damage: 75,  fireRate: 280,  auto: false, magSize: 12,  reloadTime: 2200, range: 260, pellets: 1,  spread: 0.002, recoil: 0.08, punch: 0.022, zoomFov: 30, hsMult: 2.5, pierce: 1, scoped: 'optic', reloadStyle: 'mag', hip: [0.144, -0.156, -0.36], adsDist: 0.12, flash: 0.32, desc: '4x optic. Punches through 1 enemy.' },
    crossbow: { name: 'Crossbow',    cost: 2800, color: 0x92400e, damage: 150, fireRate: 260,  auto: false, magSize: 1,   reloadTime: 1050, range: 220, pellets: 1,  spread: 0.0025, recoil: 0.09, punch: 0.028, zoomFov: 42, hsMult: 3, pierce: 4, reloadStyle: 'mag', hip: [0.144, -0.156, -0.36], adsDist: 0.18, flash: 0.06, desc: 'Silent bolts that pass through up to 4 zombies. Headshots do triple damage.' },
    lmg:      { name: 'LMG',         cost: 4500, color: 0x84cc16, damage: 28,  fireRate: 92,   auto: true,  magSize: 90,  reloadTime: 3600, range: 150, pellets: 1,  spread: 0.008, bloom: 0.05, recoil: 0.04, punch: 0.008, zoomFov: 55, hsMult: 2, moveMult: 0.85, reloadStyle: 'box', hip: [0.156, -0.168, -0.36], adsDist: 0.2, flash: 0.34, desc: '90-round box. Heavy and hungry.' },
    // 4.0: drum launcher - bouncing grenades that go off when they touch a zombie, or when the fuse runs out
    glauncher:{ name: 'Grenade Launcher', cost: 4200, color: 0xfacc15, damage: 150, fireRate: 430, auto: false, magSize: 6, reloadTime: 2900, range: 300, pellets: 1, spread: 0.006, recoil: 0.2, punch: 0.05, zoomFov: 55, hsMult: 1, grenade: true, radius: 5.5, fuse: 1.6, reloadStyle: 'revolver', hip: [0.15, -0.16, -0.36], adsDist: 0.2, flash: 0.42, desc: 'Bouncing grenades that blow up when they touch a zombie or after 1.6s. They never hurt you.' },
    flamer:   { name: 'Flamethrower', cost: 5500, color: 0xf97316, damage: 6,  fireRate: 60,   auto: true,  magSize: 150, reloadTime: 2600, range: 13,  pellets: 1,  spread: 0, recoil: 0.006, punch: 0.002, zoomFov: 66, hsMult: 1, flame: true, cone: 0.36, noAds: true, reloadStyle: 'mag', hip: [0.16, -0.17, -0.4], adsDist: 0.3, flash: 0.5, desc: 'A short stream of fire that burns everything in front of you, goes round riot shields and sets zombies alight.' },
    // 4.0: chain lightning - each zap locks onto the zombie nearest your crosshair, then jumps on through the crowd
    tesla:    { name: 'Tesla Gun',   cost: 5200, color: 0x818cf8, damage: 26,  fireRate: 210,  auto: true,  magSize: 30,  reloadTime: 2300, range: 30,  pellets: 1,  spread: 0, recoil: 0.022, punch: 0.006, zoomFov: 62, hsMult: 1, tesla: true, chain: 4, jump: 9, reloadStyle: 'mag', hip: [0.15, -0.165, -0.38], adsDist: 0.2, flash: 0.3, desc: 'Chain lightning: each zap jumps on to 4 more zombies (+1 per level) and arcs round shields.' },
    sniper:   { name: 'Sniper',      cost: 5000, color: 0x8b5cf6, damage: 900, fireRate: 1100, auto: false, magSize: 5,   reloadTime: 2300, range: 500, pellets: 1,  spread: 0.012, recoil: 0.25, punch: 0.07, zoomFov: 14, hsMult: 2.5, pierce: 5, shieldPierce: true, scoped: 'sniper', reloadStyle: 'bolt', hip: [0.144, -0.156, -0.336], adsDist: 0.12, flash: 0.46, desc: 'Pierces 5 enemies and shields.' },
    // 4.0: hold to charge, let go to fire. The beam goes through EVERY zombie in a line (and riot shields) at full damage
    railgun:  { name: 'Railgun',     cost: 6500, color: 0x22d3ee, damage: 520, fireRate: 350,  auto: false, magSize: 4,   reloadTime: 2600, range: 400, pellets: 1,  spread: 0.0015, recoil: 0.3, punch: 0.075, zoomFov: 30, hsMult: 3.5, pierce: 999, shieldPierce: true, rail: true, charge: 0.85, scoped: 'optic', reloadStyle: 'mag', hip: [0.144, -0.16, -0.34], adsDist: 0.12, flash: 0.5, desc: 'HOLD to charge, RELEASE to fire. The beam pierces every zombie in a line, shields too.' },
    minigun:  { name: 'Minigun',     cost: 8000, color: 0xfb7185, damage: 16,  fireRate: 45,   auto: true,  magSize: 240, reloadTime: 4200, range: 120, pellets: 1,  spread: 0.02, recoil: 0.02, punch: 0.004, zoomFov: 70, hsMult: 1.8, spinUp: 0.55, moveMult: 0.7, noAds: true, reloadStyle: 'box', hip: [0.168, -0.186, -0.432], adsDist: 0.3, flash: 0.3, desc: 'Hold right-click to pre-spin.' },
    rpg:      { name: 'RPG',         cost: 6000, color: 0x65a30d, damage: 300, fireRate: 900,  auto: false, magSize: 1,   reloadTime: 1000, range: 400, pellets: 1,  spread: 0.004, recoil: 0.3, punch: 0.06, zoomFov: 50, hsMult: 1, rocket: true, radius: 7, reloadStyle: 'mag', hip: [0.17, -0.13, -0.34], adsDist: 0.16, flash: 0.55, desc: 'Rocket launcher. Huge splash damage and a lightning-fast reload - keep your distance!' }
};
Object.entries(weaponsDb).forEach(([id, w]) => { w.id = id; });
const WEAPON_ORDER = Object.keys(weaponsDb);
const keyLabel = (i) => i < 9 ? String(i + 1) : (i === 9 ? '0' : (i === 10 ? '-' : ''));
// 4.0: number keys pick from the guns you OWN, in armory order (1 = first owned gun, ... 0 = 10th, - = 11th)
const ownedWeapons = () => WEAPON_ORDER.filter(id => playerStats.weapons.includes(id));
const isHandgun = (id) => id === 'pistol' || id === 'revolver' || id === 'dual';
// 4.0 ATTACHMENTS: per-weapon mods bought in the Armory (kept for the run, saved with it). Each one changes the gun's
// stats and shows up on the model. ATT_FIT says which gun takes which mod and where it mounts (gun model space):
//   scope: [top of the rail / old sight, z centre] - a see-through 2x sight sits on a riser above it (the old sight is hidden
//          when it's a separate part, otherwise it stays underneath like a piggyback mount)
//   grip:  [underside of the handguard, z] - a vertical foregrip there, and the support hand moves onto it.
//          'hand' = handguns: a stippled grip sleeve instead
//   mag:   true - a longer magazine (the gun's own mag part is stretched / gets an extension)
const ATTACH = {
    scope: { name: 'SCOPE',   cost: 750, color: 0x22d3ee, desc: '2x sight: more zoom, -35% spread when aiming, +10% headshot damage.' },
    mag:   { name: 'EXT MAG', cost: 600, color: 0xfacc15, desc: '+40% magazine size.' },
    grip:  { name: 'GRIP',    cost: 500, color: 0xa3e635, desc: '-30% recoil, -25% hip-fire and moving spread.' }
};
const ATT_ORDER = ['scope', 'mag', 'grip'];
const ATT_FIT = {
    pistol:   { mag: true, grip: ['hand', -0.052, 0.035, 0.22, 0.04, 0.125, 0.062] },
    dual:     { mag: true, grip: ['hand', -0.052, 0.035, 0.22, 0.04, 0.125, 0.062] },
    revolver: { scope: [0.086, -0.14], grip: ['hand', -0.045, 0.072, 0.35, 0.04, 0.12, 0.058] },
    smg:      { scope: [0.094, 0.02], mag: true },
    ar:       { scope: [0.1, 0.0], mag: true, grip: [0.009, -0.34] },
    burst:    { scope: [0.15, -0.03], mag: true, grip: [-0.025, -0.24] },
    shotgun:  { scope: [0.0725, -0.02], mag: true, grip: [-0.025, 0] },      // the grip goes on the pump
    dmr:      { mag: true, grip: [0.009, -0.4] },
    crossbow: { scope: [0.065, -0.1], grip: [0.035, -0.26] },
    lmg:      { scope: [0.01, -0.1], mag: true, grip: [0.022, -0.42] },      // the scope rides on the feed cover
    glauncher:{ scope: [0.124, -0.12] },
    flamer:   { mag: true },
    tesla:    { mag: true },
    sniper:   { mag: true, grip: [0.0, -0.3] },
    railgun:  { mag: true, grip: [0.001, -0.34] },
    minigun:  { mag: true },
    rpg:      { scope: [0.127, -0.12] }
};
const attFits = (id, a) => !!(ATT_FIT[id] && ATT_FIT[id][a]);
const hasAtt = (id, a) => !!(playerStats.atts && playerStats.atts[id] && playerStats.atts[id][a]) && attFits(id, a);
const attKey = (id) => ATT_ORDER.map(a => hasAtt(id, a) ? a[0] : '').join('');


const secondariesDb = {
    grenade:  { id: 'grenade',  name: 'Frag Grenade',     cost: 600,  cooldown: 8,  damage: 240, radius: 9,  color: 0x65a30d, desc: 'Thrown, bounces, 2s fuse.' },
    c4:       { id: 'c4',       name: 'C4 Charge',        cost: 1200, cooldown: 12, damage: 420, radius: 11, color: 0xdc2626, desc: 'Q to throw (sticks). Q again to detonate.' },
    launcher: { id: 'launcher', name: 'Launch Grenade',   cost: 2000, cooldown: 5,  damage: 420, radius: 7,  color: 0xf59e0b, desc: 'Fast shell. Explodes on impact.' },
    heal:     { id: 'heal',     name: 'Stim Heal',        cost: 1000, cooldown: 25, heal: 50,                color: 0x22c55e, desc: 'Instantly restores 50 HP.' },
    molotov:  { id: 'molotov',  name: 'Molotov',          cost: 900,  cooldown: 10, damage: 45, radius: 4.5, color: 0xf97316, desc: 'Shatters into a fire pool that burns for 6s.' },
    turret:   { id: 'turret',   name: 'Sentry Turret',    cost: 2500, cooldown: 25, damage: 9,  radius: 26,  color: 0x38bdf8, desc: 'Deploys a decoy sentry: nearby enemies stop to attack it while it chips at them. Limited ammo and it can be destroyed.' },
    landmine: { id: 'landmine', name: 'Landmine',         cost: 1400, cooldown: 4,  damage: 1500, radius: 7.5, color: 0xfacc15, desc: 'Drops at your feet (3 max). Arms in 1s, then blows a huge crater when an enemy steps near.' }
};


const armorDb = {
    light:  { id: 'light',  name: 'Light Vest',   cost: 400,  max: 50,  absorb: 0.5,  color: 0x7dd3fc },
    medium: { id: 'medium', name: 'Combat Armor', cost: 1000, max: 100, absorb: 0.6,  color: 0x38bdf8 },
    heavy:  { id: 'heavy',  name: 'Juggernaut',   cost: 2200, max: 150, absorb: 0.75, color: 0x0284c7 }
};
const ARMOR_ORDER = ['light', 'medium', 'heavy'];
const ARMOR_REPAIR_COST = 150;
const HEALTH_COST = 100, HEALTH_AMOUNT = 25;
const UPGRADE_MAX = 5;
// what each upgrade level looks like on the gun / turret
const TIER_NAMES = ['STOCK', 'TACTICAL', 'HEAVY', 'ELITE', 'GOLD ELITE', 'PLASMA PROTOTYPE'];
const TURRET_TIERS = ['MK I', 'ARMORED', 'RADAR', 'QUAD GUNS', 'ROCKET PODS', 'PLASMA CORE'];
// The sentry is a DECOY with some bite, not a killing machine: it has health that enemies chew through,
// a limited ammo belt, misses sometimes, and only one can be out at a time (cooldown starts when it's gone).
function turretStats(L) {
    return { damage: 9 * (1 + 0.12 * L), hp: 250 + 60 * L, ammo: 120 + 25 * L, delay: 0.2 * (1 - 0.04 * L) * (L >= 3 ? 0.9 : 1), range: 26 + 2 * L,
             cooldown: 25 - L, life: 40, aim: 0.7 + 0.03 * L, aggro: 15 + L, rockets: L >= 4 ? (L >= 5 ? 4.5 : 6) : 0 };
}


// Enemy health is FIXED: base HP x type multiplier, the same on every wave.
// Waves get harder through numbers, speed, damage and nastier enemy types instead.
const ENEMY_BASE_HP = 50;
const enemyTypes = {
    grunt:    { id: 'grunt',    name: 'Grunt',    color: 0xef4444, hp: 1,   speed: 1,    scale: 1,    reward: 1,   damage: 10, ai: 'melee', drops: [0.10, 15, 0.12, 20] },
    sprinter: { id: 'sprinter', name: 'Sprinter', color: 0xeab308, hp: 0.5, speed: 1.8,  scale: 0.75, reward: 1.5, damage: 6,  ai: 'melee', slim: 0.8, minLvl: 1, drops: [0.08, 10, 0.10, 15] },
    tank:     { id: 'tank',     name: 'Tank',     color: 0x3b82f6, hp: 3.5, speed: 0.55, scale: 1.45, reward: 3,   damage: 20, ai: 'melee', minLvl: 3, drops: [0.32, 35, 0.35, 70] },
    spitter:  { id: 'spitter',  name: 'Spitter',  color: 0x22c55e, hp: 0.8, speed: 0.8,  scale: 0.95, reward: 2,   damage: 9,  ai: 'ranged', minLvl: 4, drops: [0.15, 20, 0.18, 30] },
    bomber:   { id: 'bomber',   name: 'Bomber',   color: 0xf97316, hp: 0.7, speed: 0.85, scale: 0.9,  reward: 2,   damage: 30, ai: 'bomber', minLvl: 6, drops: [0.10, 15, 0.20, 35] },
    charger:  { id: 'charger',  name: 'Charger',  color: 0x9a3412, hp: 3.5, speed: 0.8,  scale: 1.25, reward: 2.5, damage: 11, ai: 'charger', slim: 1.12, eye: 0xff6a1f, minLvl: 3, intel: 'Stomps for a long moment, then RAMS you in a straight line. Sidestep it - if it hits a wall it is stunned and takes +50% damage.', drops: [0.30, 30, 0.32, 60] },
    leaper:   { id: 'leaper',   name: 'Leaper',   color: 0xec4899, hp: 0.9, speed: 0.9,  scale: 0.85, reward: 2,   damage: 16, ai: 'leaper', slim: 0.9, eye: 0xffffff, minLvl: 4, intel: 'Leaps across the arena and slams down. Keep moving!', drops: [0.16, 20, 0.20, 35] },
    shielder: { id: 'shielder', name: 'Shielder', color: 0x94a3b8, hp: 1.6, speed: 0.75, scale: 1.1,  reward: 2.5, damage: 14, ai: 'shielder', eye: 0x67e8f9, minLvl: 5, intel: 'Its riot shield blocks bullets. Flank it, aim for the head, or use explosives. Sniper rounds punch through.', drops: [0.24, 25, 0.25, 45] },
    marksman: { id: 'marksman', name: 'Marksman', color: 0x3f4a5c, hp: 0.9, speed: 0.85, scale: 1.0,  reward: 3,   damage: 15, ai: 'marksman', eye: 0xff2020, minLvl: 8, cap: 2, intel: 'Laser-sights you from range. When the beam flashes bright it is about to fire - strafe or duck behind cover!', drops: [0.28, 25, 0.38, 75] },
    medic:    { id: 'medic',    name: 'Medic',    color: 0xe2e8f0, hp: 1.0, speed: 0.9,  scale: 0.95, reward: 3.5, damage: 8,  ai: 'medic', eye: 0x86efac, minLvl: 9, cap: 2, intel: 'Heals nearby enemies. Kill it first!', drops: [0.55, 40, 0.20, 50] },
    splitter: { id: 'splitter', name: 'Splitter', color: 0x7c3aed, hp: 1.8, speed: 0.85, scale: 1.15, reward: 2.5, damage: 12, ai: 'melee', eye: 0xd8b4fe, minLvl: 7, intel: 'Swollen with Mites. When it dies it bursts into three fast little Mites. Explosives and fire clear them up.', drops: [0.2, 25, 0.22, 40] },
    mite:     { id: 'mite',     name: 'Mite',     color: 0xa78bfa, hp: 0.25, speed: 2.1, scale: 0.5,  reward: 0.3, damage: 4,  ai: 'melee', slim: 0.9, eye: 0xf5d0fe, minLvl: 999, drops: [0, 0, 0, 0] },
    screamer: { id: 'screamer', name: 'Screamer', color: 0xdc2626, hp: 1.1, speed: 0.9,  scale: 1.0,  reward: 3.5, damage: 8,  ai: 'screamer', eye: 0xfca5a5, minLvl: 10, cap: 2, intel: 'Hangs back and SHRIEKS: every zombie near it goes into a rage (faster, harder hits) for a few seconds. Kill it first!', drops: [0.4, 35, 0.25, 50] },
    boss:     { id: 'boss',     name: 'The Abomination', color: 0x9333ea, hp: 40,  speed: 0.45, scale: 2.3,  reward: 15,  damage: 35, ai: 'boss', eye: 0xff3bd4, drops: [1, 999, 1, 500], boss: true, glow: 0x3b0764, bar: '#e879f9',
                title: 'MOTHER OF THE HORDE', tip: 'Back off when it raises its arms. When enraged, its slams send out a shockwave - JUMP over it.' },
    // ---- 3.9: the boss roster. Every boss fights its own way and gets ENRAGED (phase 2) below half health ----
    jugg:     { id: 'jugg',     name: 'The Juggernaut', color: 0x57534e, hp: 46,  speed: 0.5,  scale: 2.4,  reward: 15,  damage: 34, ai: 'jugg', eye: 0xff7a1a, drops: [1, 999, 1, 500], boss: true, glow: 0x431407, bar: '#fb923c', armor: 0.45, slim: 1.1,
                title: 'THE UNSTOPPABLE', tip: 'Armor halves your bullets. Dodge its charge so it hits a WALL - while stunned the armor cracks and it takes extra damage.' },
    brood:    { id: 'brood',    name: 'The Broodmother', color: 0x65a30d, hp: 34, speed: 0.55, scale: 2.2,  reward: 15,  damage: 20, ai: 'brood', eye: 0xd9f99d, drops: [1, 999, 1, 500], boss: true, glow: 0x1a2e05, bar: '#a3e635',
                title: 'QUEEN OF THE MITES', tip: 'Lobs acid that leaves burning pools and lays egg sacs. Shoot the eggs before they hatch into Mites.' },
    pyro:     { id: 'pyro',     name: 'The Inferno', color: 0xc2410c, hp: 38,  speed: 0.55, scale: 2.2,  reward: 15,  damage: 26, ai: 'pyro', eye: 0xfde047, drops: [1, 999, 1, 500], boss: true, glow: 0x7c2d12, bar: '#f97316', fireImmune: true,
                title: 'THE BURNING ONE', tip: 'Immune to fire. Throws fireballs and erupts in a flame ring when you get close - get out of the glowing circle!' },
    phantom:  { id: 'phantom',  name: 'The Phantom', color: 0x334155, hp: 26,  speed: 0.95, scale: 1.75, reward: 15,  damage: 28, ai: 'phantom', eye: 0x67e8f9, drops: [1, 999, 1, 500], boss: true, glow: 0x083344, bar: '#67e8f9', slim: 0.9,
                title: 'THE UNSEEN', tip: 'Turns invisible and strikes from behind. Listen for it, keep moving - shooting it while cloaked reveals it.' },
    warlord:  { id: 'warlord',  name: 'The Warlord', color: 0x4d5d2a, hp: 36,  speed: 0.5,  scale: 2.2,  reward: 15,  damage: 30, ai: 'warlord', eye: 0xff2020, drops: [1, 999, 1, 500], boss: true, glow: 0x1a2e05, bar: '#ef4444',
                title: 'GENERAL OF THE DEAD', tip: 'Minigun: break line of sight when it spins up. Red circles on the ground mean a rocket strike is coming.' },
    titan:    { id: 'titan',    name: 'The Colossus', color: 0x78716c, hp: 60,  speed: 0.36, scale: 3.0,  reward: 18,  damage: 40, ai: 'titan', eye: 0xfbbf24, drops: [1, 999, 1, 500], boss: true, glow: 0x292524, bar: '#fbbf24', slim: 1.15,
                title: 'THE MOUNTAIN THAT WALKS', tip: 'Its stomps send out shockwaves - JUMP over them. It hurls boulders where the orange circle is.' },
    necro:    { id: 'necro',    name: 'The Necromancer', color: 0x2e1065, hp: 30, speed: 0.6, scale: 2.0,  reward: 15,  damage: 18, ai: 'necro', eye: 0xa78bfa, drops: [1, 999, 1, 500], boss: true, glow: 0x2e1065, bar: '#a78bfa', slim: 0.9,
                title: 'LORD OF THE RISEN', tip: 'Shielded while its Acolytes chant. Hunt down the Acolytes, then unload on it. It raises the dead and fires homing skulls.' },
    // boss helpers (never spawn on their own)
    egg:      { id: 'egg',      name: 'Egg Sac',  color: 0x84cc16, hp: 0.9, speed: 0,    scale: 0.85, reward: 0.5, damage: 0,  ai: 'egg', eye: 0xd9f99d, minLvl: 999, fixed: true, drops: [0, 0, 0.3, 15] },
    phclone:  { id: 'phclone',  name: 'Phantom Decoy', look: 'phantom', color: 0x334155, hp: 0.3, speed: 1.05, scale: 1.75, reward: 0.2, damage: 10, ai: 'melee', eye: 0x67e8f9, slim: 0.9, minLvl: 999, drops: [0, 0, 0, 0] },
    acolyte:  { id: 'acolyte',  name: 'Acolyte',  color: 0x4c1d95, hp: 2.2, speed: 0,    scale: 1.05, reward: 2,   damage: 0,  ai: 'acolyte', eye: 0xc4b5fd, minLvl: 999, fixed: true, drops: [0.3, 25, 0.3, 40] },
    risen:    { id: 'risen',    name: 'Risen',    color: 0x57534e, hp: 0.6, speed: 1.05, scale: 0.95, reward: 0.5, damage: 8,  ai: 'melee', eye: 0xa78bfa, minLvl: 999, drops: [0.04, 10, 0.04, 10] }
};
const BOSS_IDS = Object.keys(enemyTypes).filter(k => enemyTypes[k].boss);


const THEMES = {
    night:  { name: 'MIDNIGHT', bright: 0, top: 0x02040c, horizon: 0x1c2048, bottom: 0x05050a, fog: 0x151a33, fogNear: 30, fogFar: 175,
              sunDir: [-0.45, 0.62, -0.64], sunColor: 0xb4c4ff, sunInt: 1.4, disc: 0xe6ecff, discSize: 0.9993, glow: 0.25,
              hemiSky: 0x8a9ce0, hemiGround: 0x3a3450, hemiInt: 1.6, envInt: 0.7, exposure: 1.45, stars: true,
              neon: 0x6d5cff, lamp: 0xffc47a, lampPool: 0.5, floor: 0x2c3048 },
    sunset: { name: 'SUNSET', bright: 0.55, top: 0x1d2a66, horizon: 0xff8a50, bottom: 0x2a1a2a, fog: 0xa8645a, fogNear: 35, fogFar: 200,
              sunDir: [0.85, 0.16, -0.5], sunColor: 0xffa860, sunInt: 3.0, disc: 0xffd29a, discSize: 0.9985, glow: 0.9,
              hemiSky: 0xffb48a, hemiGround: 0x4b3450, hemiInt: 1.2, envInt: 0.8, exposure: 1.05, stars: false,
              neon: 0xff4fa3, lamp: 0xffb070, lampPool: 0.22, floor: 0x6e5c64 },
    day:    { name: 'DAYBREAK', bright: 1, top: 0x2f6fd0, horizon: 0xcfe2f5, bottom: 0x3c4250, fog: 0xa9c6e4, fogNear: 45, fogFar: 230,
              sunDir: [0.35, 0.82, 0.45], sunColor: 0xfff0d8, sunInt: 3.0, disc: 0xffffff, discSize: 0.9992, glow: 0.6,
              hemiSky: 0xc4dcff, hemiGround: 0x5f5a55, hemiInt: 1.2, envInt: 1.0, exposure: 0.9, stars: false,
              neon: 0x22d3ee, lamp: 0xfff2cc, lampPool: 0.05, floor: 0x8a8f9c },
    bloodmoon: { name: 'BLOOD MOON', bright: 0, top: 0x0a0204, horizon: 0x4a0d12, bottom: 0x080203, fog: 0x2a0a0e, fogNear: 25, fogFar: 160,
              sunDir: [0.3, 0.55, -0.78], sunColor: 0xff7a6a, sunInt: 1.6, disc: 0xff3b2f, discSize: 0.9975, glow: 0.9,
              hemiSky: 0xd07878, hemiGround: 0x3a1a20, hemiInt: 1.4, envInt: 0.6, exposure: 1.4, stars: true,
              neon: 0xff2a2a, lamp: 0xff8a5a, lampPool: 0.45, floor: 0x3a2a30 },
    storm:  { name: 'STORM', bright: 0.45, top: 0x262c35, horizon: 0x5a626e, bottom: 0x1e2227, fog: 0x4a525c, fogNear: 18, fogFar: 125,
              sunDir: [0.2, 0.8, 0.3], sunColor: 0xc8d4e4, sunInt: 0.9, disc: 0x9aa4b0, discSize: 0.99995, glow: 0.05,
              hemiSky: 0xb4c0d0, hemiGround: 0x3a3e44, hemiInt: 1.6, envInt: 0.7, exposure: 1.2, stars: false,
              neon: 0x60a5fa, lamp: 0xffe2b0, lampPool: 0.3, floor: 0x4a505c, rain: true, lightning: true },
    neon:   { name: 'NEON NIGHTS', bright: 0, top: 0x0a0418, horizon: 0x6a1a6e, bottom: 0x06020c, fog: 0x1d0b2e, fogNear: 30, fogFar: 170,
              sunDir: [0, 0.12, -1], sunColor: 0xff7ad9, sunInt: 1.7, disc: 0xff4fb0, discSize: 0.996, glow: 1.3,
              hemiSky: 0x9b7bff, hemiGround: 0x30104a, hemiInt: 1.4, envInt: 0.8, exposure: 1.35, stars: true,
              neon: 0x22e5ff, lamp: 0xff4fd8, lampPool: 0.55, floor: 0x2a1f44 }
};


const DIFFICULTIES = {
    easy:      { name: 'EASY',      dmg: 0.6,  count: 0.75, speed: 0.9, cash: 1.25, color: '#4ade80', desc: 'Fewer enemies that hit softer. More cash.' },
    normal:    { name: 'NORMAL',    dmg: 1,    count: 1,    speed: 1,   cash: 1,    color: '#60a5fa', desc: 'The intended experience.' },
    hard:      { name: 'HARD',      dmg: 1.35, count: 1.25, speed: 1.1, cash: 1.2,  color: '#f59e0b', desc: 'Bigger, faster waves that hit harder.' },
    nightmare: { name: 'NIGHTMARE', dmg: 1.8,  count: 1.5,  speed: 1.2, cash: 1.5,  color: '#ef4444', desc: 'Good luck.' }
};
const MODES = {
    classic: { name: 'CLASSIC', color: '#e5e7eb', desc: 'Survive the waves. The Armory opens between waves.' },
    rush:    { name: 'RUSH',    color: '#f97316', desc: 'No breaks - waves roll straight into each other. 1.5x cash and extra supply drops. Shop from the pause menu.' },
    bossrush: { name: 'BOSS RUSH', color: '#e879f9', desc: 'Every wave is a boss fight - all 8 bosses, one after another, then two at a time. Fewer zombies, 1.5x cash, $2000 to start.' },
    sandbox: { name: 'SANDBOX', color: '#a78bfa', desc: 'Every weapon and gadget unlocked, unlimited cash, and you cannot die. Mess around!' }
};
const MAPS = {
    blockyard: { name: 'BLOCKYARD', size: 100, desc: 'The classic: scattered forts, crates and catwalks, plus climbable watchtowers joined by rope bridges.' },
    downtown:  { name: 'DOWNTOWN',  size: 100, desc: 'City streets between tall glowing buildings. Fire-escape stairs and rope bridges across the rooftops.' },
    fortress:  { name: 'FORTRESS',  size: 100, desc: 'Hold the walls of a big central fort. A watchtower in the yard bridges to the keep and the walls.' },
    plains:    { name: 'PLAINS',    size: 100, desc: 'Wide open fields with trees, rocks and ruins. Climb the lookout towers for the long shots.' },
    skybridge: { name: 'SKYBRIDGE', size: 58,  desc: 'COMPACT. Five tall towers linked by rope bridges high above a tight courtyard.' },
    shipyard:  { name: 'SHIPYARD',  size: 56,  desc: 'COMPACT. Stacks of shipping containers to climb, catwalks between them and a giant crane.' },
    temple:    { name: 'TEMPLE',    size: 60,  desc: 'COMPACT. A stepped pyramid ringed by a raised stone walkway and ruined towers.' },
    sky:       { name: 'SKY ISLANDS', size: 64, void: true, desc: 'COMPACT. Cloud islands high in the sky, joined by cloud paths and rope bridges. There is no floor: fall off the edge and you die - but so do zombies you knock off!' },
    // 4.0
    mall:      { name: 'MALL',      size: 72,  desc: 'NEW! Two floors of stores round a food court under a glass skylight. Ride the escalators to the balconies, cross the sky bridges, take the outside stairs to the roof.' },
    military:  { name: 'MILITARY BASE', chip: 'MILITARY', size: 100, desc: 'NEW! Hangars on a runway, watchtowers joined by a catwalk, bunkers, fenced compounds and a helipad. Zombies have to find the gates - you can jump the fences.' }
};
const SLEEVES = { navy: 0x36426e, olive: 0x66764f, black: 0x1e1f24, urban: 0x6b7280, tan: 0xb59a6d, crimson: 0x8b1e2d, arctic: 0xdfe5ec, teal: 0x0f766e, royal: 0x5b3a9c, carbon: 0x2b2d33, gold: 0xc9a227, plasma: 0x7c3aed, obsidian: 0x2a1f45 };
const GLOVES = { grey: 0x5c5c63, black: 0x2e2e31, brown: 0x6b4a2f, tan: 0xb08d5a, skin: 0xd9a066, dark: 0x8d5a3b, blue: 0x2b4a8a, red: 0x9b1c1c, gold: 0xc9a227, obsidian: 0x2a1f45 };
const XH_COLORS = ['#ffffff', '#4ade80', '#22d3ee', '#facc15', '#f472b6', '#ef4444'];
const XH_STYLES = { cross: 'CROSS', crossdot: 'CROSS + DOT', dot: 'DOT', circle: 'CIRCLE' };
let run = { mode: 'classic', map: 'blockyard', diff: 'normal' };   // what the current run is using
let ARENA = 100;               // half-width of the current map (compact maps are smaller)
let VOID = false;              // no floor on this map (Sky Islands): groundAt() finds nothing below the clouds
const VOID_Y = -200, FALL_DEATH_Y = -30;
let cageOverride = null;       // a map can say exactly where the ram's cage goes
let cageArea = null;           // { x, z, half } of this map's cage - nothing spawns on top of it
const inCage = (x, z, pad = 1.5) => !!cageArea && Math.abs(x - cageArea.x) < cageArea.half + pad && Math.abs(z - cageArea.z) < cageArea.half + pad;
let spawnPt = [0, 0];          // where the player starts on this map
