// ---------- RANKS & UNLOCKS ----------
// You earn XP from kills and waves (more on harder difficulties). Ranks unlock new stuff.
// Ranks unlock cosmetics and (4.0) the five new weapons - the classic guns, gadgets, maps, modes and difficulties
// are always available
const UNLOCKS = {
    sleeve: { tan: 2, crimson: 3, arctic: 5, teal: 6, royal: 8, carbon: 10, gold: 15, plasma: 20 },
    glove: { brown: 2, tan: 3, skin: 4, dark: 4, blue: 6, red: 7, gold: 15 },
    xhStyle: { dot: 2, circle: 4 },
    xhColor: { '#22d3ee': 2, '#facc15': 3, '#f472b6': 5, '#ef4444': 6 },
    camo: { desert: 3, forest: 4, arctic: 5, crimson: 7, midnight: 9, toxic: 11, chrome: 13, gold: 16, rainbow: 22, ember: 99, hazard: 99, warden: 99, static: 99, toxin: 99, outbreak: 99 },
    tracer: { red: 3, green: 4, blue: 6, purple: 8, gold: 12, rainbow: 18 },
    killfx: { confetti: 5, fire: 7, ice: 9, void: 12, gold: 14 },
    weapon: { dual: 2, katana: 3, glauncher: 4, tesla: 5, railgun: 6, carbine: 4, lever: 6 }      // 4.0: buyable in the Armory from this rank
};
// player upgrades, bought in the Armory (reset every run)
const PERKS = {
    hp:     { name: 'VITALITY',     color: 0xef4444, desc: '+20 max health per level.' },
    speed:  { name: 'AGILITY',      color: 0x22d3ee, desc: '+7% move speed per level.' },
    dmg:    { name: 'FIREPOWER',    color: 0xf97316, desc: '+8% damage from guns and explosives per level.' },
    reload: { name: 'QUICK HANDS',  color: 0xfacc15, desc: '8% faster reloads per level.' },
    regen:  { name: 'REGENERATION', color: 0x4ade80, desc: 'Heal 1 HP/s per level after 4s without getting hit.' },
    scav:   { name: 'SCAVENGER',    color: 0xa3e635, desc: '+25% more cash and health drops from zombies per level.' },
    dead:   { name: 'DEADEYE',      color: 0xe879f9, desc: '+12% headshot damage per level.' }
};
const PERK_COSTS = [500, 1000, 1800, 2800, 4000];
const perk = (id) => (playerStats.perks && playerStats.perks[id]) || 0;
// ---------- 4.0 CLASSES ----------
// Picked on the Play tab before a run, switched between waves in the Armory. Each class has an ability on X (with a
// cooldown), a passive, and a 3-step upgrade tree bought with cash during the run. Upgrades are kept per class, so
// switching back to a class keeps what you bought for it. Off in PvP (like power-ups) so it stays fair.
const CLASSES = {
    assault:  { name: 'ASSAULT',  color: 0xf97316, role: 'Front-line shooter', ability: 'ADRENALINE', cd: [40, 40, 40, 28],
                abilityDesc: 'Instant reload of every gun, +35% speed and +25% damage for 6 seconds.',
                passive: 'Every kill takes 1s off the Adrenaline cooldown.',
                tree: [{ name: 'SECOND WIND', desc: 'Adrenaline also heals 30 HP and lasts 8 seconds.' },
                       { name: 'BERSERKER', desc: 'The damage boost goes up to +50% and you fire 20% faster.' },
                       { name: 'UNSTOPPABLE', desc: 'Take 40% less damage during Adrenaline. Cooldown 40s to 28s.' }] },
    medic:    { name: 'MEDIC',    color: 0x4ade80, role: 'Keeps the squad alive', ability: 'HEALING FIELD', cd: [45, 45, 45, 30],
                abilityDesc: 'Drop a field that heals you and co-op teammates 8 HP/s for 8 seconds.',
                passive: 'Regenerate 2 HP/s after 3 seconds without getting hit.',
                tree: [{ name: 'WIDE FIELD', desc: 'Field radius 6m to 9m, and it lasts 12 seconds.' },
                       { name: 'FIELD ARMOR', desc: 'The field also repairs armor, and your passive regen doubles to 4 HP/s.' },
                       { name: 'TRIAGE', desc: 'The field heals 14 HP/s instead of 8. Cooldown 45s to 30s.' }] },
    engineer: { name: 'ENGINEER', color: 0xfacc15, role: 'Builds and resupplies', ability: 'FIELD KIT', cd: [45, 45, 45, 32],
                abilityDesc: 'Deploy a mini sentry and an ammo crate that refills your mags and gadgets.',
                passive: 'Secondaries and Sentry Turret upgrades cost 25% less.',
                tree: [{ name: 'HARDENED', desc: 'The mini sentry gets +60% health and ammo and lasts 35 seconds.' },
                       { name: 'MEDKIT CRATE', desc: 'The crate holds 5 resupplies and each one also heals 20 HP.' },
                       { name: 'ROCKET SENTRY', desc: 'The mini sentry fires rockets too. Cooldown 45s to 32s.' }] },
    recon:    { name: 'RECON',    color: 0xa78bfa, role: 'Sees everything', ability: 'RADAR PULSE', cd: [30, 30, 30, 20],
                abilityDesc: 'A sonar pulse marks every zombie within 70m through walls for 6 seconds.',
                passive: 'Bigger minimap, and zombies you hit stay marked for 3 seconds.',
                tree: [{ name: 'WIDE BAND', desc: 'The pulse covers the whole map and marks last 9 seconds.' },
                       { name: 'WEAK SPOT', desc: 'Marked zombies take +15% damage from you.' },
                       { name: 'UPLINK', desc: 'Co-op teammates get your marks too. Cooldown 30s to 20s.' }] }
};
const CLASS_ORDER = Object.keys(CLASSES);
for (const k of CLASS_ORDER) { const C = CLASSES[k]; C.css = hex(C.color); C.glow = `0 0 14px ${C.css}66`; }     // the HUD reads these every frame
const CLASS_COSTS = [750, 1500, 2750];
const validClass = (id) => CLASSES[id] ? id : 'assault';
// the class you're playing right now (null in PvP), and how far its upgrade tree goes
const myClass = () => (!NET.pvp && CLASSES[playerStats.cls]) ? playerStats.cls : null;
const clsLvl = (id) => (playerStats.clsUp && playerStats.clsUp[id]) || 0;
const clsUp = (id, n) => myClass() === id && clsLvl(id) >= n;          // does the current class have upgrade step n?
// weapon camos (upgrade levels 4-5 keep their own gold / plasma look)
const CAMOS = {
    stock: { name: 'STOCK' }, desert: { name: 'DESERT', c: 0xb89a6a }, forest: { name: 'FOREST', c: 0x3f5a36 }, arctic: { name: 'ARCTIC', c: 0xe5e9f0 },
    crimson: { name: 'CRIMSON', c: 0x8b1e2d }, midnight: { name: 'MIDNIGHT', c: 0x1e2a55 }, toxic: { name: 'TOXIC', c: 0x1c2b12, glow: 0xa3e635 },
    chrome: { name: 'CHROME', c: 0xd0d6de, metal: true }, gold: { name: 'GOLD', c: 0xf0b832, metal: true, emissive: 0x6a4300 }, rainbow: { name: 'RAINBOW', rainbow: true },
    ember: { name: 'EMBER', c: 0xc2410c, glow: 0xfb923c }, hazard: { name: 'HAZARD', c: 0xeab308, glow: 0x713f12 }, warden: { name: 'WARDEN', c: 0x3b0764, metal: true, glow: 0xe879f9 },
    static: { name: 'STATIC', c: 0x1e3a5f, metal: true, glow: 0x38bdf8 }, toxin: { name: 'TOXIN', c: 0x365314, glow: 0xa3e635 }, outbreak: { name: 'OUTBREAK', c: 0x7f1d1d, metal: true, glow: 0xfca5a5 },      // 5.0: campaign rewards
    obsidian: { name: 'OBSIDIAN', c: 0x1a1426, metal: true, glow: 0xfbbf24 }          // 4.0: prestige 1
};
const TRACERS = { default: { name: 'DEFAULT' }, red: { name: 'RED', c: 0xff4040 }, green: { name: 'GREEN', c: 0x4ade80 }, blue: { name: 'BLUE', c: 0x60a5fa }, purple: { name: 'PURPLE', c: 0xc084fc }, gold: { name: 'GOLD', c: 0xfbbf24 }, rainbow: { name: 'RAINBOW', rainbow: true }, starlight: { name: 'STARLIGHT', c: 0xdbe4ff } };
const KILLFX = { blocks: { name: 'BLOCKS' }, confetti: { name: 'CONFETTI' }, fire: { name: 'FIRE' }, ice: { name: 'ICE' }, void: { name: 'VOID' }, gold: { name: 'GOLD RUSH' }, stardust: { name: 'STARDUST' } };
const UNLOCK_KIND_NAMES = { sleeve: 'Sleeves', glove: 'Gloves', xhStyle: 'Crosshair', xhColor: 'Crosshair color', camo: 'Weapon camo', tracer: 'Tracers', killfx: 'Kill effect', weapon: 'Weapon' };
const XP_MULT = { easy: 0.75, normal: 1, hard: 1.5, nightmare: 2.2 };
const MAX_RANK = 50;
const xpNeed = (r) => 600 + 200 * r;               // XP to go from rank r to r+1
function rankInfo(xp = life.xp) {
    let r = 1, rem = Math.max(0, xp);
    while (r < MAX_RANK && rem >= xpNeed(r)) { rem -= xpNeed(r); r++; }
    return { rank: r, into: rem, need: xpNeed(r) };
}
const unlockRank = (kind, id) => (UNLOCKS[kind] && UNLOCKS[kind][id]) || 1;
// ---------- 4.0 PRESTIGE ----------
// At max rank you can PRESTIGE (Ranks tab): your rank goes back to 1 and your prestige level goes up (10 at most).
// Nothing you've unlocked is taken away. Every prestige level gives +5% XP and +$100 starting cash, a new badge
// colour (shown next to your rank on the menu and the HUD), and prestige 1-5 each unlock a prestige-only cosmetic.
const MAX_PRESTIGE = 10;
const PRESTIGE_COLORS = ['#9ca3af', '#cd7f32', '#d1d5db', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f43f5e', '#67e8f9', '#f472b6', '#fde047'];
const PRESTIGE_UNLOCKS = { camo: { obsidian: 1 }, sleeve: { obsidian: 2 }, tracer: { starlight: 3 }, killfx: { stardust: 4 }, glove: { obsidian: 5 } };
if (!Number.isFinite(life.prestige)) life.prestige = 0;
const prestigeLvl = () => clamp(life.prestige | 0, 0, MAX_PRESTIGE);
const prestigeNeed = (kind, id) => (PRESTIGE_UNLOCKS[kind] && PRESTIGE_UNLOCKS[kind][id]) || 0;
// after your first prestige everything that unlocks by rank stays unlocked, whatever your rank is now
const unlockLevel = () => prestigeLvl() > 0 ? MAX_RANK : rankInfo().rank;
const isUnlocked = (kind, id) => { if (campOwns(kind, id)) return true; const p = prestigeNeed(kind, id); return p ? prestigeLvl() >= p : unlockLevel() >= unlockRank(kind, id); };
const lockTag = (kind, id) => campSkin(kind, id) ? 'C' : prestigeNeed(kind, id) ? 'P' + prestigeNeed(kind, id) : String(unlockRank(kind, id));      // '12' = rank 12, 'P2' = prestige 2
const canPrestige = () => rankInfo().rank >= MAX_RANK && prestigeLvl() < MAX_PRESTIGE;
function doPrestige() {
    if (!canPrestige()) return false;
    life.prestige = prestigeLvl() + 1; life.xp = 0;
    saveJSON('blocky21_life', life);
    return true;
}
// the badge: a shield in the prestige colour with the level on it (a star at the top level)
function prestigeBadge(p, size = 20) {
    p = clamp(p | 0, 0, MAX_PRESTIGE);
    const c = PRESTIGE_COLORS[p];
    return `<svg class="pbadge" width="${size}" height="${size}" viewBox="0 0 24 24" style="filter:drop-shadow(0 0 3px ${c})"><path d="M12 1.5 L21.5 5.5 V12.5 C21.5 17.5 17 21.3 12 22.8 C7 21.3 2.5 17.5 2.5 12.5 V5.5 Z" fill="${c}" stroke="#111827" stroke-width="1.5"/>` +
        (p >= MAX_PRESTIGE ? '<path d="M12 6.2 L13.6 10.3 L18 10.4 L14.6 13.1 L15.8 17.4 L12 14.9 L8.2 17.4 L9.4 13.1 L6 10.4 L10.4 10.3 Z" fill="#111827"/>'
                           : `<text x="12" y="16.4" text-anchor="middle" font-size="11.5" font-weight="900" font-family="Segoe UI, Arial, sans-serif" fill="#111827">${p}</text>`) + '</svg>';
}
function unlockLabel(kind, id) {
    const n = { sleeve: () => id, glove: () => id, xhStyle: () => XH_STYLES[id], xhColor: () => ({ '#22d3ee': 'cyan', '#facc15': 'yellow', '#f472b6': 'pink', '#ef4444': 'red' }[id] || id),
                camo: () => CAMOS[id].name, tracer: () => TRACERS[id].name, killfx: () => KILLFX[id].name, power: () => BOOSTS[id].name, weapon: () => weaponsDb[id].name }[kind];
    return `${UNLOCK_KIND_NAMES[kind]}: ${String(n ? n() : id).toUpperCase()}`;
}
function unlocksAtRank(r) {
    const out = [];
    for (const kind in UNLOCKS) for (const id in UNLOCKS[kind]) if (UNLOCKS[kind][id] === r) out.push({ kind, id });
    return out;
}
const shownUnlocksAtRank = (r) => unlocksAtRank(r);
const DIFF = () => DIFFICULTIES[run.diff] || DIFFICULTIES.normal;
const bestKey = (diff, mode) => diff + (mode === 'rush' ? '_rush' : mode === 'bossrush' ? '_boss' : '');


const SUPPLY_KINDS = {
    ammo: { name: 'AMMO RESUPPLY', color: 0x38bdf8 },
    med:  { name: 'MEDICAL SUPPLIES', color: 0x4ade80 }
};


// cls / clsUp (4.0): your class and the upgrade steps bought for each class this run - saved with the run
// atts (4.0): weapon attachments bought this run, { ar: { scope: 1, grip: 1 }, ... } - saved with the run
const defaultStats = { level: 1, money: 0, weapons: ['pistol'], currentWeapon: 'pistol', secondaries: [], currentSecondary: null, armorTier: null, upgrades: {}, perks: {}, cls: 'assault', clsUp: {}, atts: {} };
let playerStats = JSON.parse(JSON.stringify(defaultStats));
playerStats.cls = validClass(settings.cls);
let currentHp = 100;
let maxHp = 100;               // goes up with the VITALITY upgrade
let currentArmor = 0;
let runStats = null;
function freshRunStats() { return { kills: 0, headshots: 0, shots: 0, hits: 0, damage: 0, time: 0, bosses: 0, weaponKills: {} }; }
runStats = freshRunStats();


// Derived weapon stats (with upgrades applied), cached until an upgrade changes them
const wCache = {};
function W(id) {
    if (wCache[id]) return wCache[id];
    const b = weaponsDb[id], L = playerStats.upgrades[id] || 0;
    const sc = hasAtt(id, 'scope'), gr = hasAtt(id, 'grip');
    return (wCache[id] = Object.assign({}, b, {
        // each level: +18% damage (pistol +10% so it still needs 2 headshots), +20% mag, faster reload & fire, tighter spread, less kick
        level: L, damage: b.damage * (1 + (b.dmgUp ?? (id === 'pistol' ? 0.1 : 0.18)) * L) * (1 + 0.08 * perk('dmg')), magSize: Math.round(b.magSize * (1 + 0.2 * L) * (hasAtt(id, 'mag') ? 1.4 : 1)),
        reloadTime: b.reloadTime * (1 - 0.1 * L) * (1 - 0.08 * perk('reload')), shellTime: (b.shellTime || 0) * (1 - 0.1 * L) * (1 - 0.08 * perk('reload')),
        fireRate: b.fireRate * (1 - 0.05 * L), spread: b.spread * (1 - 0.08 * L), recoil: b.recoil * (1 - 0.08 * L) * (gr ? 0.7 : 1), punch: b.punch * (1 - 0.08 * L) * (gr ? 0.7 : 1),
        // 4.0 attachments: SCOPE = more zoom + tighter aim + headshots, GRIP = steadier hip fire
        zoomFov: sc ? Math.round(b.zoomFov * 0.72) : b.zoomFov, hsMult: b.hsMult * (sc ? 1.1 : 1), adsMul: sc ? 0.65 : 1, hipMul: gr ? 0.75 : 1,
        // 4.0 new weapons: more chain jumps / a faster charge / a bigger blast / a quicker lunge per level
        chain: (b.chain || 0) + L, charge: (b.charge || 0) * (1 - 0.06 * L), radius: (b.radius || 0) + (b.grenade ? 0.3 * L : 0), lungeCd: (b.lungeCd || 0) * (1 - 0.06 * L)
    }));
}
function clearWCache() { for (const k in wCache) delete wCache[k]; }


let ammoState = {};
function resetAmmo() { clearWCache(); WEAPON_ORDER.forEach(k => ammoState[k] = W(k).magSize); }
resetAmmo();
let isReloading = false, reloadTimer = 0, reloadTotal = 1, reloadStyle = 'mag', reloadElapsed = 0, shellTimer = 0, reloadEnding = 0;


let camera, scene, renderer, controls, viewScene, weaponCam;
let hemi, sun, viewHemi, viewSun, viewFill, vmLight, muzzleLight = null;
// shared shader inputs for the cheap lighting extras (rim light, cool shadows, ground haze) - set per theme
const LIGHT_U = { uRim: { value: new THREE.Color() }, uRimE: { value: new THREE.Color() }, uCool: { value: new THREE.Color(1, 1, 1) }, uHaze: { value: 0.35 },
                   // fake dynamic lights for tiers with no real point lights: xyz = world position, w = strength (muzzle / explosion)
                   uMz: { value: new THREE.Vector4(0, 0, 0, 0) }, uBm: { value: new THREE.Vector4(0, 0, 0, 0) } };
let boomLights = [], lampLights = [];
let autoStage = 0, autoCalm = 0;
let skyMat, skyGroup, stars, envScene, pmrem, envRT = null, envTex = null;
let theme = THEMES.night, themeId = 'night', currentMap = 'blockyard';
const _tint = new THREE.Color();
let Q = null, dynScale = 1, lowFpsStreak = 0;
let solids = [];               // THREE.Box3 list used for ALL collision + bullet hits
let worldGroup = null, worldBlocks = [], lampSpots = [];
let enemies = [], corpses = [];
let raycaster;


let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let sprintHeld = false, jumpHeld = false, aimHeld = false;
let onGround = false, coyote = 0;
let velocity = new V3();       // local (x = strafe, z = forward) like PointerLockControls expects
let direction = new V3();
const push = new V3();         // world-space knockback on the player
let feetY = 0, eyeH = 1.6;
const EYE_STAND = 1.6, EYE_SLIDE = 0.95;
let slideT = 0, slideCd = 0;
const playerRadius = 0.6;
const PLAYER_BODY = 1.8;       // full body height for collision
const GRAVITY = 45;
const JUMP_V = 21;             // ~4.9 units high: clears every 4-unit block with room to spare
const STEP = 0.6;              // auto step-up / ledge-grab tolerance
const ENEMY_JUMP_V = Math.sqrt(2 * GRAVITY * 5.3);   // enemies top out at 5.3m - what you can reach with a jump + ledge grab


let gameTime = 0;              // seconds of actual play time (pauses when paused)
let prevTime = null;
let isMouseDown = false, triggerFresh = false;
let lastShootTime = -10, burstLeft = 0, nextBurstAt = 0, spinT = 0, heat = 0;
// 4.0 weapons: railgun charge (0..1) and its hum, katana lunge / pending slash
let railC = 0, railOn = false, railHold = 0, railHum = null, railStart = 0, lungeT = 0, lungeCd = 0, lungeSeq = 0, slashAt = -1, aimWas = false;
const lungeDir = new V3();
let waveActive = false;
let intermission = 0;          // countdown to the armory after a wave clear
let needsNewWorld = false;
let seenTypes = new Set();


let secondaryCooldown = 0, turretCd = 0;
// class ability (X): cooldown left, time left on whatever it's doing right now (and how long that lasts in total)
let abilityCd = 0, abilityT = 0, abilityDur = 1;
let healFields = [], crates = [], radarT = 0, markUntil = -1, radarSweep = 0;
let activeC4 = null;
let projectiles = [];          // player grenades/shells/c4 + enemy spit
let pickups = [];
let supplies = [], supplyTimer = -1, suppliesLeft = 0;
let CAMP = { on: false, over: false, m: null, st: null, waves: false, decoys: [], T: [], marks: [], objs: [], nm: 0, stat: {}, skins: {}, inv: 0, dmg: 0, deaths: 0 };   // 5.0 campaign mission in progress (30-campaign.js)
let lastHurtT = -99;                                       // when you last took damage (REGENERATION)
// Multiplayer (experimental). Everything else checks NET.on before doing anything network-y.
//   host: this browser runs the enemies and is the "referee".  pvp: team deathmatch instead of waves.
const NET = { on: false, host: false, pvp: false, inGame: false, dead: false, id: 0, team: 0, mode: 'coop', slowT: 0 };
let dmgOwner = 0;              // host only: which player's hit is being applied right now (0 = the host)
let turrets = [], fires = [], strikes = [];
let streak = 0, strikeCharges = 0, meleeCd = 0;
const STREAK_FOR_STRIKE = 12;
let menuView = 'home';      // 5.0 start screen: 'home' | 'setup' (29-start-screen.js)
const MZ = { grp: null, zs: [], glow: null, t: 0, n: 0, gy: 0, key: '', mood: false };
let menuOrbit = 0, lightningT = 6, lightningFlash = 0;
let shake = 0;
const camOffset = new V3();
let aimPunch = 0, aimPunchApplied = 0, yawPunch = 0, yawPunchApplied = 0;
let fovNow = 75;
let combo = 0, comboTimer = 0;
let toastTimer = 0, intelTimer = 0;


let currentGameState = 'main';
let returnMenuState = 'main', settingsReturn = 'main';
let debugNoLock = false, debugGod = false, debugFreeze = false, debugSlashHold = false;


const ui = {
    mainMenu: $('main-menu-overlay'), pauseMenu: $('pause-menu-overlay'), shop: $('shop-overlay'), settings: $('settings-overlay'), hudRank: $('hud-rank'), pauseCh: $('pause-ch'),
    hud: $('ui-hud'), minimap: $('minimap'), crosshair: $('crosshair'), gameOver: $('gameover-overlay'),
    hitMarker: $('hit-marker'), hitMarkerSvg: $('hit-marker-svg'),
    btnStart: $('btn-start'), btnMainShop: $('btn-main-shop'), btnPauseShop: $('btn-pause-shop'),
    btnResume: $('btn-resume'), btnQuit: $('btn-quit'), btnShopBack: $('btn-shop-back'), btnShopBackTop: $('btn-shop-back-top'),
    btnRespawn: $('btn-respawn'),
    txtLevel: $('hud-level'), txtEnemies: $('hud-enemies'), txtMoney: $('hud-money'), txtWeapon: $('hud-weapon'),
    railRing: $('rail-ring'),
    txtAmmoCur: $('hud-ammo-current'), txtAmmoMax: $('hud-ammo-max'), txtReloading: $('hud-reloading'),
    healthBar: $('hud-health-bar'), healthText: $('hud-health-text'),
    armorWrap: $('hud-armor-wrap'), armorBar: $('hud-armor-bar'), armorText: $('hud-armor-text'),
    secName: $('hud-sec-name'), secStatus: $('hud-sec-status'), secCd: $('sec-cd'),
    combo: $('hud-combo'), toast: $('toast'), vignette: $('vignette'), flash: $('screen-flash'), scope: $('scope'), optic: $('optic'),
    dmgLayer: $('dmg-layer'), dmgDir: $('dmg-dir'), shopMoney: $('shop-money'), shopSubtitle: $('shop-subtitle'),
    slots: $('hud-slots'), intel: $('hud-intel'),
    fps: $('fps'), menuBest: $('menu-best'), pauseStats: $('pause-stats'), strike: $('hud-strike'), streak: $('hud-streak'), boss: $('hud-boss'), bossName: $('hud-boss-name'), bossBar: $('hud-boss-bar'), boosts: $('hud-boosts'), pu: $('hud-pu')
};
Object.assign(ui, { abil: $('hud-abil'), abilCls: $('hud-abil-cls'), abilName: $('hud-abil-name'), abilStatus: $('hud-abil-status'), abilBar: $('abil-cd'),
                    clsFx: $('cls-fx'), healing: $('hud-healing'), healthWrap: $('hud-health-wrap') });
const minimapCtx = ui.minimap.getContext('2d');
// Only touch the DOM when a value actually changes (cheap HUD updates every frame)
function setText(el, s) { if (el._t !== s) { el._t = s; el.textContent = s; } }
function setStyle(el, prop, v) { const k = '_s' + prop; if (el[k] !== v) { el[k] = v; el.style.setProperty(prop, v); } }
function setWidth(el, pct) { const s = pct.toFixed(1) + '%'; if (el._w !== s) { el._w = s; el.style.width = s; } }
