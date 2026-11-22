// ============================================================
// THE VEHICLES AND THE RESEARCH TREE. Six branches of ground vehicles, five tiers each (the original Steel Storm's ground
// line; its aircraft and ships are not here yet). A vehicle is RESEARCHED with research points (RP), then BOUGHT with
// credits (CR); both are paid by battles. Each owned vehicle has five MODULES that credits improve, three levels each.
// Numbers are multipliers on TD (30-units.js): hp, speed, reload (time), dmg, guard (damage taken). model = which tank
// model draws it (a model that is not in the files falls back to the medium tank, tinted).
//   arc     the gun only swings this far each way (a tank destroyer turns its hull to aim)
//   shells  what it can load (SHELLS); auto = the trigger can be held
//   shellV  how fast its shell leaves (slower = a higher arc: artillery)
// ============================================================
const BRANCHES = [
    { id: 'lt', name: 'LIGHT TANKS', one: 'Light tank', role: 'Fast scout: flanks and spots, thin armour', model: 'light', hp: 0.72, speed: 1.32, reload: 0.74, dmg: 0.78, guard: 1.05 },
    { id: 'mt', name: 'MEDIUM TANKS', one: 'Medium tank', role: 'All-rounder: good gun, armour and speed', model: 'tank', hp: 1, speed: 1, reload: 1, dmg: 1, guard: 1 },
    { id: 'ht', name: 'HEAVY TANKS', one: 'Heavy tank', role: 'Tough and slow: soaks up hits, hits back harder', model: 'heavy', hp: 1.5, speed: 0.72, reload: 1.3, dmg: 1.35, guard: 0.9 },
    { id: 'td', name: 'TANK DESTROYERS', one: 'Tank destroyer', role: 'The biggest gun and no turret: lie in wait, turn the hull to aim', model: 'td', alt: 'heavy', hp: 0.85, speed: 0.92, reload: 1.15, dmg: 1.75, guard: 1, arc: 0.3, shellV: 240 },
    { id: 'spaa', name: 'ANTI-AIR', one: 'Anti-air tank', role: 'Autocannon: a stream of small shells that strips light armour', model: 'spaa', alt: 'light', hp: 0.6, speed: 1.2, reload: 0.085, dmg: 1, guard: 1.1, shells: ['ac'], auto: true, shellV: 260, elevMax: 1.25 },
    { id: 'arty', name: 'ARTILLERY', one: 'Self-propelled gun', role: 'Lobs heavy shells over hills: huge blast, slow to load, made of paper', model: 'arty', alt: 'tank', hp: 0.62, speed: 0.8, reload: 2.5, dmg: 1, guard: 1.15, shells: ['hh'], shellV: 95, elevMax: 0.95 },
    // aircraft (35-air.js): fly = top speed in metres a second, turn = how fast the nose comes round (radians a second)
    { id: 'ftr', ln: 'a', name: 'FIGHTERS', one: 'Fighter', role: 'Fast and quick in the turn: owns the sky, with a gun and a few rockets', model: 'ftr', air: true, hp: 0.3, fly: 96, turn: 1.05, dmg: 1, shells: ['ac', 'rk'] },
    { id: 'atk', ln: 'a', name: 'ATTACKERS', one: 'Attacker', role: 'Tank hunter: a heavy gun, rockets and bombs, slower in the turn', model: 'atk', air: true, hp: 0.5, fly: 77, turn: 0.75, dmg: 1.25, shells: ['ac', 'rk', 'bm'] },
    { id: 'bmb', ln: 'a', name: 'BOMBERS', one: 'Bomber', role: 'A belly full of bombs for whatever sits in a ring; needs the sky kept clear for it', model: 'bmb', air: true, hp: 0.78, fly: 66, turn: 0.5, dmg: 1.6, shells: ['bm', 'ac'] },
    { id: 'heli', ln: 'a', name: 'HELICOPTERS', one: 'Helicopter', role: 'Hangs behind a ridge, comes up, empties its rocket pods, drops back', model: 'heli', air: true, heli: true, hp: 0.45, fly: 42, turn: 1.1, dmg: 1, shells: ['ac', 'rk'] }
];
const AIRS = { ftr: 1, atk: 1, bmb: 1, heli: 1 };
const BR = {}; for (const b of BRANCHES) BR[b.id] = b;
const TIER = ['', 'I', 'II', 'III', 'IV', 'V'], MAX_TIER = 5;
const RP_COST = [0, 0, 350, 1100, 3000, 6500], CR_COST = [0, 0, 1800, 6500, 22000, 48000], RL_K = [1, 1, 0.96, 0.92, 0.88, 0.84];
const VEH_NAMES = {
    lt: ['Lynx', 'Jackal', 'Ferret', 'Sabre', 'Wraith'], mt: ['Pioneer', 'Lancer', 'Centaur', 'Warden', 'Paladin'], ht: ['Bulwark', 'Mammoth', 'Goliath', 'Colossus', 'Leviathan'],
    td: ['Stalker', 'Hunter', 'Ambusher', 'Javelin', 'Reaper'], spaa: ['Sparrow', 'Hornet', 'Whirlwind', 'Tempest', 'Skysweeper'], arty: ['Bishop', 'Thunder', 'Hammer', 'Tremor', 'Earthshaker'],
    ftr: ['Kestrel', 'Merlin', 'Peregrine', 'Tempest', 'Stormbird'], atk: ['Badger', 'Wolverine', 'Razorback', 'Thunderhead', 'Devastator'], bmb: ['Courier', 'Condor', 'Albatross', 'Valkyrie', 'Juggernaut'], heli: ['Dragonfly', 'Wasp', 'Mantis', 'Cobra', 'Hellhound']
};
const VEHS = {}, VEH_IDS = [];
for (const b of BRANCHES) for (let t = 1; t <= MAX_TIER; t++) {
    const id = b.id + t, k = t - 1;
    VEHS[id] = { id, br: b.id, tier: t, name: VEH_NAMES[b.id][k].toUpperCase(), full: b.id.toUpperCase() + '-' + t + ' ' + VEH_NAMES[b.id][k], model: b.model, alt: b.alt, hp: b.hp * (1 + 0.24 * k), speed: (b.speed || b.fly / 62) * (1 + 0.025 * k), reload: (b.reload || 1) * RL_K[t], dmg: b.dmg * (1 + 0.19 * k), guard: b.guard || 1, ln: b.ln || 'g', air: !!b.air, heli: !!b.heli, fly: b.fly ? b.fly * (1 + 0.04 * k) : 0, turn: b.turn || 0,
        shade: 1.08 - 0.05 * k, arc: b.arc, shells: b.shells, auto: b.auto, shellV: b.shellV, elevMax: b.elevMax, desc: b.role,
        rp: t === 1 ? (b.id === 'lt' || b.id === 'mt' || b.id === 'ht' ? 0 : 150) : RP_COST[t], cr: t === 1 ? (b.id === 'lt' || b.id === 'mt' || b.id === 'ht' ? 0 : 900) : CR_COST[t] };
    VEH_IDS.push(id);
}
// modules: three levels each; a level costs a share of the vehicle's price
const MODS = {
    gun:    { name: 'GUN', desc: '+6% shell damage a level', apply: (k, n) => { k.dmg *= 1 + 0.06 * n; } },
    armour: { name: 'ARMOUR', desc: '+7% hull a level', apply: (k, n) => { k.hp *= 1 + 0.07 * n; } },
    engine: { name: 'ENGINE', desc: '+5% speed a level', apply: (k, n) => { k.speed *= 1 + 0.05 * n; } },
    loader: { name: 'LOADER', desc: 'loads 5% faster a level', apply: (k, n) => { k.reload *= 1 - 0.05 * n; } },
    optics: { name: 'TRAVERSE', desc: 'the turret and gun move 10% faster a level', apply: (k, n) => { k.slew = (k.slew || 1) * (1 + 0.1 * n); } }
};
const MOD_MAX = 3;
const modCost = (id, lvl) => Math.round((600 + VEHS[id].cr * 0.12) * (lvl + 1) / 50) * 50;
// the modes a battle can be. size = tanks a side (you are one of yours).
const MODES = {
    tdm:   { name: 'TEAM BATTLE', blurb: 'Two platoons, one valley. The first side to knock out enough of the other wins. Wrecked crews come back in a new tank.', goal: 'kills' },
    conq:  { name: 'CONQUEST', blurb: 'Three positions to take and hold. The side holding more bleeds the other dry of tickets. Sit in a ring to make it yours.', goal: 'tickets' },
    waves: { name: 'PROVING GROUND', blurb: 'Alone against wave after wave, with a field upgrade after each. How long can one tank last?', goal: 'waves' }
};
const BOT_SKILL = { easy: { name: 'RECRUITS', skill: 0.15, pay: 0.8 }, normal: { name: 'REGULARS', skill: 0.45, pay: 1 }, hard: { name: 'VETERANS', skill: 0.75, pay: 1.3 }, elite: { name: 'ACES', skill: 0.95, pay: 1.6 } };
const CALLSIGNS = ['Anvil', 'Badger', 'Cobra', 'Dagger', 'Echo', 'Falcon', 'Gunner', 'Hammer', 'Iron', 'Jester', 'Kodiak', 'Lancer', 'Mauler', 'Nomad', 'Ox', 'Piston', 'Rhino', 'Saber', 'Tusk', 'Viper', 'Wolf', 'Zeus'];
