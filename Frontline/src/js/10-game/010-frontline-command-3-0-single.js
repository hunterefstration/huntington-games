
import * as THREE from 'three';
// =====================================================================
//  FRONTLINE: COMMAND 3.0  -  single file RTS for Huntington Games
//  Armies from the 1900s to the far future. Capture flags, hold more than the enemy.
// =====================================================================
const VERSION = '3.1';
const TICK = 0.05;                 // simulation step (20 Hz)
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const rr = (a, b) => a + Math.random() * (b - a);
const PI = Math.PI, TAU = PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Grapevine (the launcher's account): one commander name everywhere, players proven by their account key, and a
// Friend button that sends a real Grapevine friend request. The launcher owns the account (window.parent.HGGrapevine); opened on
// its own, or while signed out, none of this shows and the game behaves exactly as before.
const GVL = {
  get L() { try { const w = window.parent !== window ? window.parent : window.opener; return (w && w.HGGrapevine) || null; } catch (e) { return null; } },   // in the launcher's frame, or in a new tab it opened
  name() {
    const L = this.L, me = L && L.me();
    if (me) return me.name;
    try { return (localStorage.getItem('hgv:key') && localStorage.getItem('hgv:name')) || ''; } catch (e) { return ''; }   // new-tab copy: the name only
  },
  on() { const L = this.L; return !!(L && L.online()); },
  tag(name) {   // a verified mark, plus a Friend button when it is somebody else
    if (!name) return '';
    const L = this.L, st = L ? L.friendState(name) : 'self';
    const btn = st === 'none' ? ` <button class="tbtn" data-act="gvfriend" data-n="${esc(name)}" data-tip="Friend|Send a Grapevine friend request to ${esc(name)}.">+ Friend</button>`
      : st === 'friend' ? ' <span class="note" style="color:#7be08a">friends</span>' : st === 'outgoing' ? ' <span class="note">request sent</span>' : st === 'incoming' ? ' <span class="note" style="color:#ffe2a6">asked you</span>' : '';
    return ` <span style="color:#7be08a" data-tip="Verified|This is the Grapevine account ${esc(name)}.">&#10003;</span>` + btn;
  }
};
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
const hex3 = n => '#' + ('000000' + n.toString(16)).slice(-6);

// ---------------- teams / colours ----------------
const PCOL = [
  { n: 'Azure', c: 0x3b8cff, rank: 0 }, { n: 'Crimson', c: 0xf0483c, rank: 0 }, { n: 'Emerald', c: 0x36cf6a, rank: 0 }, { n: 'Amber', c: 0xffb52e, rank: 0 },
  { n: 'Violet', c: 0xa56bff, rank: 2 }, { n: 'Cyan', c: 0x2ee6e0, rank: 3 }, { n: 'Rose', c: 0xff6fb5, rank: 4 }, { n: 'Ivory', c: 0xeaeaea, rank: 6 }
];

// ---------------- combat tables ----------------
// armour classes: 0 infantry, 1 vehicle, 2 heavy, 3 air, 4 building
const WTM = {
  bullet: [1, .45, .2, .9, .25], rocket: [.5, 1.3, 1.2, 0, 1], shell: [1.1, .8, .5, 0, 1.2], cannon: [.6, 1.2, 1, 0, .9],
  snipe: [2, .15, .05, 0, .1], tesla: [1.25, .8, .55, .5, .4], flak: [.35, .3, .15, 2.2, .1], aam: [0, 0, 0, 1.8, 0], comm: [1, .6, .3, .5, 1.6], bomb: [1.2, 1, .8, 0, 1.5], mine: [1.1, 1.3, 1, 0, 0],
  // 3.0 Iron Legion energy weapons: pulse = rapid bolts (soldiers, a little vs aircraft), plasma = heavy bolts (armor, buildings), rail = armor-piercing slug (soldiers and vehicles)
  pulse: [1, .5, .25, .9, .3], plasma: [.55, 1.3, 1.2, 0, 1.05], rail: [1.7, .85, .55, 0, .35]
};
const WTD = { tesla: 'b', bullet: 'b', rocket: 'g', shell: 'g', cannon: 'g', snipe: 'g', flak: 'b', aam: 'a', comm: 'b', bomb: 'g', mine: 'g', pulse: 'b', plasma: 'g', rail: 'g' };
const WKIND = { tesla: 5, bullet: 0, rocket: 1, shell: 2, bomb: 3, flak: 4, snipe: 5, cannon: 7, aam: 9, comm: 0, mine: 2, pulse: 11, plasma: 12, rail: 13 };
const VETDMG = [1, 1.1, 1.2, 1.32], VETHP = [1, 1.1, 1.22, 1.38];
const VETNAME = ['Recruit', 'Veteran', 'Elite', 'Hero'];
function Wp(wt, dmg, cd, rng, o) { return Object.assign({ wt, dmg, cd, rng, minr: 0, spl: 0, ps: 0, arc: 0, shots: 1, scat: 0, g: WTD[wt], k: WKIND[wt] }, o || {}); }

// ---------------- units (1900s to the far future) ----------------
const UT = {};
function defU(id, o) { o.id = id; o.src = o.src || []; o.r = o.r || 1; o.vis = o.vis || 26; o.air = o.cls === 3; o.cap = o.cap !== false && !o.air; UT[id] = o; return o; }
// d = one-line card text, info = longer text for the Field Guide
defU('rifleman', { n: 'Rifleman', role: 'Soldier', cls: 0, pop: 1, cost: 50, bt: 7, hp: 70, spd: 6, vis: 26, r: .9, w: Wp('bullet', 8, .75, 17), src: [['barracks', 1], ['hq', 1]], d: 'Cheap. Good vs soldiers.', info: 'A cheap all-rounder. Good against soldiers, weak against tanks.' });
defU('rocket', { n: 'Bazooka Team', role: 'Anti-tank', cls: 0, pop: 1, cost: 90, bt: 10, hp: 65, spd: 5.5, vis: 26, r: .9, w: Wp('rocket', 55, 2.6, 22, { ps: 38 }), w2: Wp('aam', 34, 3, 26, { ps: 60 }), src: [['barracks', 1]], d: 'Great vs tanks. Also shoots down helicopters.', info: 'Shoulder-fired rockets destroy vehicles and buildings. They also lock on to helicopters and drones and knock them out of the sky.' });
defU('engineer', { n: 'Engineer', role: 'Builder', cls: 0, pop: 1, cost: 70, bt: 9, hp: 60, spd: 5.5, vis: 24, r: .9, w: Wp('bullet', 4, 1, 10), eng: 1, src: [['barracks', 1], ['hq', 1]], d: 'Builds fast, repairs, captures flags.', info: 'Repairs vehicles and buildings, speeds up construction, captures flags faster and can build a Sandbag Nest.' });
defU('scout', { n: 'Scout', role: 'Runner', cls: 0, pop: 1, cost: 40, bt: 5, hp: 40, spd: 9.5, vis: 44, r: .8, w: Wp('bullet', 4, .8, 14), src: [['barracks', 2]], d: 'Very fast. Grabs flags, sees far.', info: 'A cheap, very fast runner that sees far. Great for grabbing empty flags and spotting the enemy, but it is not much of a fighter.' });
defU('heavy', { n: 'Machine Gunner', role: 'Heavy infantry', cls: 0, pop: 1, cost: 110, bt: 12, hp: 150, spd: 4.8, vis: 26, r: 1, w: Wp('bullet', 6, .2, 18), src: [['barracks', 2]], d: 'Shreds soldiers and helicopters.', info: 'Tough soldier with a belt-fed machine gun. Melts soldiers and is good at shooting down helicopters.' });
defU('sniper', { n: 'Sniper', role: 'Marksman', cls: 0, pop: 1, cost: 130, bt: 13, hp: 50, spd: 5, vis: 44, r: .9, w: Wp('snipe', 72, 3.2, 42), sf: 1, src: [['barracks', 2]], d: 'Long range. Picks off soldiers.', info: 'Kills soldiers from far away in 1-2 shots. Useless against vehicles. Must stand still to fire.' });
defU('mortar', { n: 'Mortar Team', role: 'Light artillery', cls: 0, pop: 1, cost: 100, bt: 11, hp: 70, spd: 5.2, vis: 30, r: .9, w: Wp('shell', 40, 3.2, 54, { minr: 12, spl: 4.5, ps: 24, arc: 1 }), sf: 1, src: [['barracks', 2]], d: 'Lobs shells at groups of soldiers.', info: 'Drops shells on groups from a distance. Cannot hit targets that are very close. Stands still to fire.' });
defU('grenadier', { n: 'Grenadier', role: 'Grenade thrower', cls: 0, pop: 1, cost: 100, bt: 11, hp: 85, spd: 5.2, vis: 26, r: .9, w: Wp('shell', 42, 2.3, 22, { spl: 4.5, ps: 22, arc: 1 }), src: [['barracks', 3]], d: 'Tosses grenades at groups.', info: 'Lobs grenades that hurt groups of soldiers and buildings. Short range, but it keeps moving while it fights.' });
defU('commando', { n: 'Commando', role: 'Elite soldier', cls: 0, pop: 2, cost: 240, bt: 16, hp: 175, spd: 7.5, vis: 30, r: 1, w: Wp('comm', 14, .55, 20), src: [['barracks', 3, 'elite']], d: 'Elite fighter. Wrecks buildings.', info: 'A tough, fast elite soldier with demolition charges. Strong against everything on the ground and brilliant against buildings. Needs the Veteran Training upgrade on a Level 3 Barracks.' });
defU('medic', { n: 'Medic', role: 'Healer', cls: 0, pop: 1, cost: 80, bt: 9, hp: 55, spd: 6, vis: 24, r: .9, heal: 16, src: [['barracks', 2], ['medical', 1]], d: 'Heals nearby soldiers.', info: 'Heals wounded soldiers nearby automatically.' });
defU('merc', { n: 'Mercenary', role: 'Hired gun', cls: 0, pop: 0, cost: 0, bt: 0, hp: 125, spd: 6.5, vis: 28, r: 1, w: Wp('bullet', 11, .55, 20), nobuild: 1, d: 'Hired soldier. Leaves after 2 minutes.', info: 'A hired veteran with a rifle. Arrives by parachute with the Hire Mercenaries power, takes no army space and leaves when the contract ends.' });
defU('mechanic', { n: 'Mechanic', role: 'Repairs vehicles', cls: 0, pop: 1, cost: 80, bt: 9, hp: 75, spd: 6, vis: 24, r: .9, w: Wp('bullet', 4, 1, 10), mech: 1, rep: 34, src: [['factory', 1]], d: 'Repairs vehicles and buildings fast.', info: 'A Motor Pool grease monkey with a wrench and a toolbox. Follows your army and repairs damaged vehicles (first) and buildings more than twice as fast as an Engineer.' });
defU('jeep', { n: 'Scout Car', role: 'Fast scout', cls: 1, pop: 2, cost: 100, bt: 9, hp: 140, spd: 12, vis: 34, r: 1.5, w: Wp('bullet', 5, .25, 17), src: [['factory', 1]], d: 'Very fast. Great for taking flags.', info: 'A fast, light car with a machine gun. Excellent at grabbing flags and chasing down weak units.' });
defU('apc', { n: 'APC', role: 'Armored carrier', cls: 1, pop: 3, cost: 170, bt: 12, hp: 480, spd: 8.5, vis: 28, r: 1.7, tur: 1, w: Wp('bullet', 7, .2, 19), src: [['factory', 1]], d: 'Tough. Great vs soldiers.', info: 'An armored troop carrier with a roof-mounted machine gun. Tough and strong against soldiers, weak against bazookas.' });
defU('lighttank', { n: 'Light Tank', role: 'Tank', cls: 1, pop: 3, cost: 220, bt: 15, hp: 400, spd: 8, vis: 28, r: 1.8, tur: 1, w: Wp('cannon', 36, 1.5, 25, { ps: 60 }), src: [['factory', 2]], d: 'Fast. Good vs cars and tanks.', info: 'A mobile cannon platform. Good against vehicles and buildings.' });
defU('tank', { n: 'Main Battle Tank', role: 'Heavy tank', cls: 2, pop: 4, cost: 400, bt: 22, hp: 800, spd: 6.5, vis: 28, r: 2.1, tur: 1, w: Wp('cannon', 85, 2.2, 29, { ps: 70 }), src: [['factory', 3]], d: 'Strongest tank. Weak vs bazookas.', info: 'Very hard to kill and hits hard. Beats most things, but bazooka teams and groups of soldiers can bring it down.' });
defU('artillery', { n: 'Self-Propelled Gun', role: 'Artillery', cls: 1, pop: 3, cost: 270, bt: 18, hp: 230, spd: 5, vis: 26, r: 1.9, tur: 1, w: Wp('shell', 78, 4.5, 72, { minr: 24, spl: 7, ps: 30, arc: 1 }), sf: 1, src: [['factory', 2]], d: 'Huge range. Hits groups.', info: 'Long-range shells with a big blast. Needs something to see the target and cannot hit enemies up close.' });
defU('aa', { n: 'Anti-Air Gun', role: 'Anti-aircraft', cls: 1, pop: 2, cost: 200, bt: 14, hp: 270, spd: 8, vis: 30, r: 1.7, tur: 1, w: Wp('flak', 10, .2, 40, { ps: 0 }), src: [['factory', 2]], d: 'Shoots down planes and helicopters.', info: 'Rapid-fire flak guns. Deadly against aircraft and almost useless against ground targets.' });
defU('mlrs', { n: 'Rocket Battery', role: 'Rocket artillery', cls: 1, pop: 4, cost: 380, bt: 22, hp: 300, spd: 6, vis: 26, r: 1.9, tur: 1, w: Wp('shell', 26, 9, 90, { minr: 30, spl: 5, ps: 34, arc: 1, shots: 8, scat: 6 }), sf: 1, src: [['factory', 3, 'artillery']], d: 'Fires a huge rocket volley.', info: 'Launches eight rockets at once over a huge range. Great against groups and buildings. Needs something to see the target and cannot hit enemies up close. Needs the Long-Range Guns upgrade on a Level 3 Motor Pool.' });
defU('titan', { n: 'Titan', role: 'Walking mech', cls: 2, pop: 6, cost: 700, bt: 32, hp: 1700, spd: 5, vis: 30, r: 2.5, tur: 1, walker: 1, w: Wp('cannon', 135, 2.6, 30, { ps: 70 }), w2: Wp('bullet', 7, .2, 22), src: [['factory', 3, 'heavy']], d: 'Giant walking mech. Super tough.', info: 'A giant walking war machine with a heavy cannon and a machine gun. It takes a huge beating, but bazooka teams, gunships and air power can bring it down. Needs the Extra Armor upgrade on a Level 3 Motor Pool.' });
defU('drone', { n: 'Recon Drone', role: 'Flying scout', cls: 3, pop: 1, cost: 90, bt: 7, hp: 55, spd: 15, vis: 46, r: 1, alt: 9, w: Wp('bullet', 4, .3, 16), src: [['airfield', 1]], d: 'Cheap flying scout.', info: 'A small flying scout with a light gun. Sees very far.' });
defU('strike', { n: 'Attack Drone', role: 'One-shot flyer', cls: 3, pop: 1, cost: 60, bt: 6, hp: 35, spd: 20, vis: 30, r: 1, alt: 8, kami: 1, w: Wp('bomb', 100, 0, 2.2, { spl: 5.5 }), src: [['airfield', 1]], d: 'Crashes into a target. One use.', info: 'An explosive drone that dives into its target and blows up.' });
defU('heli', { n: 'Attack Helicopter', role: 'Gunship', cls: 3, pop: 4, cost: 380, bt: 18, hp: 170, spd: 11, vis: 30, r: 1.8, alt: 8, rotor: 1, w: Wp('rocket', 28, 3.4, 19, { ps: 50 }), w2: Wp('bullet', 3, .3, 16), src: [['airfield', 2]], d: 'Fragile. Rockets hurt tanks.', info: 'A fast but fragile helicopter with a few anti-tank rockets and a light chain gun. Machine guns, bazookas, bunkers and Anti-Air Guns all shoot it down quickly.' });
defU('gunship', { n: 'Gunship', role: 'Heavy flyer', cls: 3, pop: 6, cost: 750, bt: 28, hp: 420, spd: 8, vis: 30, r: 2.4, alt: 9, rotor: 1, w: Wp('cannon', 24, 1.2, 21, { ps: 70 }), w2: Wp('rocket', 18, 2.4, 19, { ps: 48 }), src: [['airfield', 3, 'gunship']], d: 'Slow flyer. Cannon and rockets.', info: 'A slow, expensive flyer with an autocannon and rockets. It cannot hit aircraft, and machine guns, bazookas, bunkers and Anti-Air Guns all bring it down. Needs the Combat Pilots upgrade on a Level 3 Airfield.' });
defU('interceptor', { n: 'Sky Hunter', role: 'Air fighter', cls: 3, pop: 3, cost: 300, bt: 16, hp: 300, spd: 17, vis: 36, r: 1.6, alt: 12, rotor: 1, w: Wp('aam', 60, 1, 38, { ps: 70 }), src: [['airfield', 3, 'superiority']], d: 'Fast jet. Only hits aircraft.', info: 'A very fast jet fighter with air-to-air missiles. It only attacks aircraft, so keep it away from the ground fight. Needs the Better Engines upgrade on a Level 3 Airfield.' });
// ---------------- 3.0 the Iron Legion: a second army, trained in the same buildings ----------------
// fac: 1 = Iron Legion (no fac = the Banner armies). eq = the Banner troop it stands in for (AI plans, Endless War waves, call-ins).
// Added after every Banner troop so the type numbers sent in online games stay the same. shp = energy shield points:
// they soak up hits first and recharge after a few seconds out of fire; Tesla lightning drains them twice as fast.
// bh / bw = health bar height and width over walkers.
defU('legionary', { fac: 1, eq: 'rifleman', n: 'Legionary', role: 'Shield trooper', cls: 0, pop: 1, cost: 62, bt: 8, hp: 55, shp: 45, spd: 5.8, vis: 26, r: .9, w: Wp('pulse', 10, .8, 20), src: [['barracks', 1], ['hq', 1]], d: 'Energy shield. Good vs soldiers.', info: 'The Iron Legion foot soldier. A pulse carbine and a personal energy shield that soaks up hits and recharges out of combat. Costs more than a Rifleman, so you get fewer of them.' });
defU('lancer', { fac: 1, eq: 'rocket', n: 'Lancer', role: 'Anti-armor', cls: 0, pop: 1, cost: 98, bt: 11, hp: 50, shp: 35, spd: 5.3, vis: 26, r: .9, w: Wp('plasma', 62, 2.8, 24, { ps: 46 }), w2: Wp('aam', 20, 3.8, 22, { ps: 60 }), src: [['barracks', 1]], d: 'Plasma lance. Great vs tanks.', info: 'Fires a heavy plasma bolt that melts vehicles, mechs and buildings, from a little farther than a bazooka. Its flak darts are much weaker against aircraft than a Bazooka Team.' });
defU('technician', { fac: 1, eq: 'engineer', n: 'Technician', role: 'Builder', cls: 0, pop: 1, cost: 70, bt: 9, hp: 50, shp: 30, spd: 5.6, vis: 24, r: .9, w: Wp('pulse', 4, 1, 11), eng: 1, src: [['barracks', 1], ['hq', 1]], d: 'Builds fast, repairs, captures flags.', info: 'Legion field engineer. Repairs vehicles and buildings, speeds up construction, captures flags faster and can build a Sandbag Nest.' });
defU('jumptrooper', { fac: 1, eq: 'scout', n: 'Jump Trooper', role: 'Jet raider', cls: 0, pop: 1, cost: 85, bt: 8, hp: 55, shp: 30, spd: 10.5, vis: 40, r: .85, jump: 1, w: Wp('pulse', 7, .55, 15), src: [['barracks', 2]], d: 'Jump jets: leaps over walls.', info: 'Very fast, and its jump jets carry it straight over walls and buildings, so it can raid flags and bases from behind. Light armor and a small gun: keep it away from Machine Gunners.' });
defU('shredder', { fac: 1, eq: 'heavy', n: 'Shredder', role: 'Heavy trooper', cls: 0, pop: 1, cost: 120, bt: 12, hp: 115, shp: 55, spd: 4.6, vis: 26, r: 1, w: Wp('pulse', 6, .18, 19), src: [['barracks', 2]], d: 'Rotary pulse gun. Shreds soldiers.', info: 'A heavy trooper with a rotary pulse cannon and a strong shield. Melts soldiers and helps against helicopters and drones.' });
defU('railgunner', { fac: 1, eq: 'sniper', n: 'Railgunner', role: 'Marksman', cls: 0, pop: 1, cost: 145, bt: 13, hp: 45, shp: 30, spd: 5, vis: 46, r: .9, w: Wp('rail', 66, 3.6, 44), sf: 1, src: [['barracks', 2]], d: 'Long range. Pierces armor.', info: 'A long-range rail rifle. Kills soldiers in one or two shots and, unlike a Sniper, also hurts vehicles. Must stand still to fire.' });
defU('nanomedic', { fac: 1, eq: 'medic', n: 'Nano-Medic', role: 'Healer', cls: 0, pop: 1, cost: 85, bt: 9, hp: 50, shp: 40, spd: 6, vis: 24, r: .9, heal: 14, src: [['barracks', 2], ['medical', 1]], d: 'Heals nearby soldiers.', info: 'Sprays healing nanites on wounded soldiers nearby. Its own shield keeps it alive at the front.' });
defU('arctrooper', { fac: 1, eq: 'grenadier', n: 'Arc Trooper', role: 'Lightning gun', cls: 0, pop: 1, cost: 110, bt: 11, hp: 70, shp: 45, spd: 5.2, vis: 26, r: .9, w: Wp('tesla', 24, 1.9, 16, { chain: 3 }), src: [['barracks', 3]], d: 'Lightning jumps between enemies.', info: 'Throws an arc of lightning that jumps to 3 enemies. Brutal against groups of soldiers and enemy shields. Short range.' });
defU('praetorian', { fac: 1, eq: 'commando', n: 'Praetorian', role: 'Elite guard', cls: 0, pop: 2, cost: 260, bt: 17, hp: 150, shp: 110, spd: 7, vis: 30, r: 1, w: Wp('comm', 15, .55, 21), src: [['barracks', 3, 'elite']], d: 'Elite. Huge shield. Wrecks buildings.', info: 'The Legion elite: heavy armor, the strongest personal shield and a breaching gun that tears through buildings. Needs the Veteran Training upgrade on a Level 3 Barracks.' });
defU('servitor', { fac: 1, eq: 'mechanic', n: 'Servitor', role: 'Repair robot', cls: 0, pop: 1, cost: 85, bt: 9, hp: 75, spd: 6, vis: 24, r: .9, w: Wp('pulse', 4, 1, 10), mech: 1, rep: 34, src: [['factory', 1]], d: 'Repairs mechs and buildings fast.', info: 'A four-legged repair robot with a welding arm. Follows your army and repairs damaged mechs and vehicles (first) and buildings more than twice as fast as a Technician.' });
defU('strider', { fac: 1, eq: 'jeep', n: 'Strider', role: 'Scout walker', cls: 1, pop: 2, cost: 110, bt: 9, hp: 150, spd: 12.5, vis: 36, r: 1.4, walker: 1, bh: 4.4, bw: 2.6, tur: 1, w: Wp('pulse', 6, .3, 18), src: [['factory', 1]], d: 'Fast two-legged walker.', info: 'A quick two-legged walker with twin pulse guns. Great for grabbing flags and hunting soldiers. Fragile against rockets.' });
defU('combatmech', { fac: 1, eq: 'apc', n: 'Combat Mech', role: 'Assault mech', cls: 1, pop: 3, cost: 190, bt: 12, hp: 460, spd: 7.5, vis: 28, r: 1.7, walker: 1, bh: 5.6, bw: 3, tur: 1, w: Wp('pulse', 8, .22, 20), w2: Wp('plasma', 26, 3.2, 20, { ps: 46 }), src: [['factory', 1]], d: 'Tough mech. Great vs soldiers.', info: 'The Legion fights with mechs instead of tanks. This armored walker carries a pulse gun and a light plasma launcher. Strong against soldiers, weak against Bazooka Teams and Cannon Towers.' });
defU('hovertank', { fac: 1, eq: 'lighttank', n: 'Hover Tank', role: 'Fast tank', cls: 1, pop: 3, cost: 230, bt: 14, hp: 330, spd: 10.5, vis: 30, r: 1.8, hover: 1, tur: 1, w: Wp('plasma', 38, 1.6, 26, { ps: 70 }), src: [['factory', 2]], d: 'Very fast. Plasma cannon.', info: 'Floats on anti-gravity pads, so it is the fastest tank on the field, with a plasma cannon that hurts vehicles and buildings. Thin armor: do not let it get caught.' });
defU('artwalker', { fac: 1, eq: 'artillery', n: 'Artillery Walker', role: 'Artillery', cls: 1, pop: 3, cost: 280, bt: 18, hp: 260, spd: 4.6, vis: 26, r: 1.9, walker: 1, bh: 5.4, bw: 3, tur: 1, w: Wp('shell', 80, 4.8, 76, { minr: 24, spl: 7, ps: 30, arc: 1, k: 12 }), sf: 1, src: [['factory', 2]], d: 'Huge range. Hits groups.', info: 'A four-legged walker with a very long gun. Walks over rough ground and shells enemies from across the map. Needs something to see the target and cannot hit enemies up close.' });
defU('skyguard', { fac: 1, eq: 'aa', n: 'Skyguard', role: 'Anti-aircraft', cls: 1, pop: 2, cost: 210, bt: 14, hp: 260, spd: 7.5, vis: 32, r: 1.7, walker: 1, bh: 5, bw: 2.8, tur: 1, w: Wp('aam', 30, .9, 44, { ps: 70 }), src: [['factory', 2]], d: 'Shoots down aircraft.', info: 'A walker with two seeker-missile pods. Deadly against helicopters, gunships and drones, useless against ground targets.' });
defU('warmech', { fac: 1, eq: 'tank', n: 'Warmech', role: 'Heavy mech', cls: 2, pop: 4, cost: 420, bt: 22, hp: 760, shp: 120, spd: 6, vis: 28, r: 2.2, walker: 1, bh: 7, bw: 3.6, tur: 1, w: Wp('plasma', 70, 1.9, 28, { ps: 70 }), w2: Wp('pulse', 6, .25, 20), src: [['factory', 3]], d: 'Heavy mech with a shield.', info: 'The Legion main battle unit: a heavy mech with a plasma cannon arm, a pulse gun and an energy shield. Lancers, Bazookas and Tesla Towers bring it down.' });
defU('stormwalker', { fac: 1, eq: 'mlrs', n: 'Storm Walker', role: 'Rocket artillery', cls: 1, pop: 4, cost: 390, bt: 22, hp: 300, spd: 5.5, vis: 26, r: 1.9, walker: 1, bh: 5.4, bw: 3, tur: 1, w: Wp('shell', 24, 8.5, 88, { minr: 30, spl: 5, ps: 36, arc: 1, shots: 8, scat: 6, k: 12 }), sf: 1, src: [['factory', 3, 'artillery']], d: 'Fires a huge rocket volley.', info: 'A walker that launches eight plasma rockets at once over a huge range. Needs something to see the target and cannot hit enemies up close. Needs the Long-Range Guns upgrade on a Level 3 Motor Pool.' });
defU('siegetitan', { fac: 1, eq: 'titan', n: 'Siege Titan', role: 'Walking fortress', cls: 2, pop: 7, cost: 820, bt: 36, hp: 1900, shp: 500, spd: 4, vis: 32, r: 3, walker: 1, bh: 12, bw: 5, tur: 1, w: Wp('shell', 150, 3.2, 40, { spl: 6, ps: 50, arc: 1, k: 12 }), w2: Wp('pulse', 8, .2, 22), src: [['factory', 3, 'heavy']], d: 'Giant walking fortress.', info: 'A colossal four-legged war machine with a siege cannon, pulse guns and a huge energy shield. Smashes walls and bases, but it is very slow and cannot hit aircraft. Needs the Extra Armor upgrade on a Level 3 Motor Pool.' });
defU('swarm', { fac: 1, eq: 'drone', n: 'Drone Swarm', role: 'Attack drones', cls: 3, pop: 1, cost: 70, bt: 6, hp: 70, spd: 16, vis: 34, r: 1.2, alt: 8, rotor: 1, w: Wp('pulse', 3, .2, 15), src: [['airfield', 1]], d: 'Three cheap attack drones.', info: 'Three small attack drones that fly together and pepper soldiers with pulse fire. Cheap and fast, but flak and machine guns knock them down quickly.' });
defU('seeker', { fac: 1, eq: 'strike', n: 'Seeker Drone', role: 'One-shot flyer', cls: 3, pop: 1, cost: 65, bt: 6, hp: 30, spd: 22, vis: 30, r: 1, alt: 8, kami: 1, w: Wp('bomb', 110, 0, 2.2, { spl: 5 }), src: [['airfield', 1]], d: 'Crashes into a target. One use.', info: 'A plasma-charged dart drone that dives into its target and blows up.' });
defU('wraith', { fac: 1, eq: 'heli', n: 'Wraith', role: 'Hover gunship', cls: 3, pop: 4, cost: 390, bt: 18, hp: 190, shp: 60, spd: 12, vis: 30, r: 1.8, alt: 8, rotor: 1, w: Wp('plasma', 30, 3, 20, { ps: 60 }), w2: Wp('pulse', 3, .3, 16), src: [['airfield', 2]], d: 'Fast flyer. Plasma hurts tanks.', info: 'An anti-gravity gunship with a plasma cannon and a pulse gun, protected by a light shield. Anti-air, flak and bazookas still shoot it down quickly.' });
defU('harbinger', { fac: 1, eq: 'gunship', n: 'Harbinger', role: 'Heavy flyer', cls: 3, pop: 6, cost: 760, bt: 28, hp: 440, shp: 160, spd: 7.5, vis: 30, r: 2.6, alt: 10, rotor: 1, w: Wp('plasma', 26, 1.2, 22, { ps: 70 }), w2: Wp('pulse', 6, .3, 18), src: [['airfield', 3, 'gunship']], d: 'Flying fortress with a shield.', info: 'A slow flying wing with plasma cannons, pulse guns and a strong shield. It cannot hit aircraft. Needs the Combat Pilots upgrade on a Level 3 Airfield.' });
defU('raptor', { fac: 1, eq: 'interceptor', n: 'Raptor', role: 'Air fighter', cls: 3, pop: 3, cost: 310, bt: 16, hp: 280, spd: 18, vis: 36, r: 1.6, alt: 12, rotor: 1, w: Wp('aam', 58, 1, 40, { ps: 70 }), src: [['airfield', 3, 'superiority']], d: 'Fast jet. Only hits aircraft.', info: 'A forward-swept jet fighter with seeker missiles. It only attacks aircraft. Needs the Better Engines upgrade on a Level 3 Airfield.' });
defU('plasmortar', { fac: 1, eq: 'mortar', n: 'Plasma Mortar', role: 'Light artillery', cls: 0, pop: 1, cost: 112, bt: 11, hp: 60, shp: 35, spd: 5.2, vis: 30, r: .9, w: Wp('shell', 42, 3.4, 56, { minr: 12, spl: 5, ps: 24, arc: 1, k: 12 }), sf: 1, src: [['barracks', 2]], d: 'Lobs plasma at groups of soldiers.', info: 'Lobs glowing plasma shells onto groups of soldiers and buildings from far away. Cannot hit targets that are very close. Stands still to fire.' });
// ---------------- 3.0 the navy: ships come from a Shipyard on a coastal build spot and only sail on deep water ----------------
// naval: 1 = moves on water (its own route map), carry = army space a Landing Craft holds. Added last so older type numbers stay the same.
defU('gunboat', { n: 'Gunboat', role: 'Patrol boat', cls: 1, pop: 2, cost: 160, bt: 10, hp: 340, spd: 13, vis: 36, r: 1.9, naval: 1, cap: false, tur: 1, bh: 3.2, w: Wp('bullet', 7, .2, 22), w2: Wp('rocket', 30, 2.8, 26, { ps: 44 }), src: [['shipyard', 1]], d: 'Fast boat. Machine gun and rockets.', info: 'A fast patrol boat with a bow machine gun and a rocket rack. Hunts Landing Craft, shoots up soldiers on the beach and rules the water early on. Only sails on deep water.' });
defU('lcraft', { n: 'Landing Craft', role: 'Troop boat', cls: 1, pop: 2, cost: 140, bt: 10, hp: 440, spd: 10, vis: 30, r: 2.2, naval: 1, cap: false, carry: 8, bh: 3, w: Wp('bullet', 5, .3, 18), src: [['shipyard', 1]], d: 'Carries 8 soldiers to the shore.', info: 'Carries up to 8 soldiers (army space) across the water. Select soldiers and click the Landing Craft to load them; click a beach (or press Unload) to land them. The only way to reach islands without aircraft. If it sinks, everyone on board is lost.' });
defU('destroyer', { n: 'Destroyer', role: 'Warship', cls: 2, pop: 6, cost: 680, bt: 30, hp: 1500, spd: 7, vis: 42, r: 3.2, naval: 1, cap: false, tur: 1, bh: 5.6, bw: 4, w: Wp('shell', 90, 3.6, 70, { minr: 14, spl: 6, ps: 40, arc: 1 }), w2: Wp('flak', 9, .2, 36), src: [['shipyard', 2]], d: 'Big guns from the sea. Shoots down aircraft.', info: 'A heavy warship. Its deck gun shells the shore from very far away (it needs something to see the target) and its flak guns shred aircraft. Slow, and weak against Gunboats and bazookas up close.' });
defU('hydrofoil', { fac: 1, eq: 'gunboat', n: 'Hydrofoil', role: 'Patrol boat', cls: 1, pop: 2, cost: 170, bt: 10, hp: 280, shp: 70, spd: 14.5, vis: 36, r: 1.9, naval: 1, cap: false, tur: 1, bh: 3.2, w: Wp('pulse', 7, .22, 22), w2: Wp('plasma', 30, 3, 26, { ps: 50 }), src: [['shipyard', 1]], d: 'Skims over the water. Pulse gun, plasma.', info: 'A Legion attack boat that rides on glowing foils above the waves: the fastest ship there is, with a pulse gun, a plasma lance and an energy shield. Only sails on deep water.' });
defU('assaultbarge', { fac: 1, eq: 'lcraft', n: 'Assault Barge', role: 'Troop boat', cls: 1, pop: 2, cost: 150, bt: 10, hp: 380, shp: 90, spd: 10.5, vis: 30, r: 2.2, naval: 1, cap: false, carry: 8, bh: 3, w: Wp('pulse', 5, .3, 18), src: [['shipyard', 1]], d: 'Carries 8 troopers to the shore.', info: 'A shielded Legion troop barge that carries up to 8 troopers (army space). Select troopers and click it to load them; click a beach (or press Unload) to land them. If it sinks, everyone on board is lost.' });
defU('leviathan', { fac: 1, eq: 'destroyer', n: 'Leviathan', role: 'Warship', cls: 2, pop: 6, cost: 700, bt: 30, hp: 1250, shp: 300, spd: 7, vis: 42, r: 3.2, naval: 1, cap: false, tur: 1, bh: 5.6, bw: 4, w: Wp('shell', 86, 3.4, 72, { minr: 14, spl: 6, ps: 40, arc: 1, k: 12 }), w2: Wp('aam', 26, 1.1, 40, { ps: 70 }), src: [['shipyard', 2]], d: 'Plasma battery and seeker missiles.', info: 'The Legion warship: a long plasma battery that shells the shore, seeker missiles against aircraft and a huge energy shield. It needs something to see far targets.' });
// the two armies; LEG_OF maps a Banner troop to its Legion counterpart
const FACS = [{ id: 0, n: 'Banner Army', s: 'Banner', d: 'The Eight Banners: lots of cheap soldiers, tanks, helicopters and jets. Easy to learn.' }, { id: 1, n: 'Iron Legion', s: 'Legion', d: 'Shielded troopers, combat mechs, hover tanks and drone swarms. Fewer, stronger units.' }];
const LEG_OF = {}; for (const k in UT) if (UT[k].fac === 1 && UT[k].eq) LEG_OF[UT[k].eq] = k;
const facOfT = T => T.fac | 0;
// display order for building cards and the Field Guide: each Legion troop sits where its Banner counterpart does (type ids sent online keep definition order)
const UTORD = (() => { const ks = Object.keys(UT), o = k => ks.indexOf(UT[k].eq || k) * 2 + facOfT(UT[k]); return ks.slice().sort((a, b) => o(a) - o(b)); })();
// the troop of this type that a player's army fields (a Banner type is swapped for the Legion one, and back)
function fu(p, type) { const f = p && p.fac | 0, T = UT[type]; if (!T) return type; if (f === 1) return T.fac === 1 ? type : (LEG_OF[type] || type); return T.fac === 1 ? (T.eq || type) : type; }


// ---------------- buildings ----------------
const BT = {};
function defB(id, o) { o.id = id; BT[id] = o; return o; }
const SPEC_COST = 250, SPEC_TIME = 16;
// hq1 = HQ level needed before you can build it
defB('hq', { n: 'Headquarters', sz: 8, hp: [7000, 9000, 11500], cost: [0, 260, 480], bt: [0, 35, 50], ros: [3, 4, 5], d: 'Your base. Lose it and you lose.', info: 'Your base. Keeps a small squad of Riflemen and Engineers (3, 4 and 5 troops by level). If it is destroyed you lose. Upgrading raises income and unlocks new buildings, Upgrades and Support powers.', up: ['More money. Unlocks new stuff.', 'Even more money. More Support powers.'], upl: ['More money. Unlocks the Airfield, Artillery Battery, Medical Tent, Radar, Upgrades and the first Support powers.', 'Even more money. Unlocks Fortified Walls and the strongest Support powers.'], specs: [
  { id: 'fortress', n: 'Hardened HQ', d: 'Much tougher, plus a machine gun to defend your base.' },
  { id: 'logi', n: 'Supply Lines', d: '+25% money and every unit costs 8% less.' },
  { id: 'warroom', n: 'Staff Officers', d: 'Support powers recharge faster. Units rank up faster.' }] });
defB('barracks', { n: 'Barracks', sz: 5.5, hp: [700, 950, 1250], cost: [160, 130, 210], bt: [14, 16, 20], hq1: 1, ros: [5, 10, 20], d: 'Holds a squad of soldiers.', info: 'Pick which soldiers this Barracks keeps: it trains them and replaces any that die. Level 1 holds 5 soldiers, Level 2 holds 10 and Level 3 holds 20. Level 2 unlocks Machine Gunner, Sniper, Mortar, Scout and Medic. Level 3 unlocks the Grenadier. The Veteran Training upgrade also unlocks the Commando.', up: ['Holds 10. Unlocks 5 new soldiers.', 'Holds 20. Unlocks the Grenadier.'], upl: ['Holds 10 soldiers. Unlocks Machine Gunner, Sniper, Mortar Team, Scout and Medic.', 'Holds 20 soldiers. Stronger building. Unlocks the Grenadier. Then pick 1 of 3 upgrades.'], specs: [
  { id: 'elite', n: 'Veteran Training', d: 'New soldiers start as Veterans (stronger). Also unlocks the Commando.' },
  { id: 'conscript', n: 'Mass Recruiting', d: 'Holds 30 soldiers instead of 20. Trains 40% faster. Soldiers cost 15% less.' },
  { id: 'shock', n: 'Assault Training', d: 'New soldiers get +20% health, +10% speed, +10% damage.' }] });
defB('factory', { n: 'Motor Pool', sz: 6.5, hp: [900, 1250, 1650], cost: [260, 200, 300], bt: [18, 20, 24], hq1: 1, ros: [3, 6, 10], d: 'Holds a group of vehicles.', info: 'Pick which vehicles this Motor Pool keeps: it builds them and replaces any that are destroyed. Level 1 holds 3 vehicles, Level 2 holds 6 and Level 3 holds 10. Level 2: Light Tank, Self-Propelled Gun, Anti-Air Gun. Level 3: Main Battle Tank. Its upgrades unlock the giant Titan mech or the Rocket Battery.', up: ['Holds 6. Unlocks 3 new vehicles.', 'Holds 10. Unlocks the Main Battle Tank.'], upl: ['Holds 6 vehicles. Unlocks Light Tank, Self-Propelled Gun and Anti-Air Gun.', 'Holds 10 vehicles. Unlocks the Main Battle Tank. Then pick 1 of 3 upgrades.'], specs: [
  { id: 'heavy', n: 'Extra Armor', d: 'Vehicles built here have +15% health. Also unlocks the Titan mech.' },
  { id: 'rapid', n: 'Assembly Line', d: 'Holds 14 vehicles instead of 10. Builds 50% faster. Vehicles cost 15% less.' },
  { id: 'artillery', n: 'Long-Range Guns', d: 'Self-Propelled Guns shoot 20% farther. Also unlocks the Rocket Battery.' }] });
defB('airfield', { n: 'Airfield', sz: 7, hp: [800, 1100, 1450], cost: [300, 220, 320], bt: [18, 20, 24], hq1: 2, ros: [2, 3, 4], max: 2, d: 'Holds a few aircraft.', info: 'Pick which aircraft this Airfield keeps: it builds them and replaces any that are shot down. Level 1 holds 2 aircraft, Level 2 holds 3 and Level 3 holds 4. You can only have 2 Airfields. Level 2 unlocks the Attack Helicopter. Its upgrades unlock the Gunship or the Sky Hunter jet.', up: ['Holds 3. Unlocks the Attack Helicopter.', 'Holds 4. Pick 1 of 3 upgrades.'], upl: ['Holds 3 aircraft. Unlocks the Attack Helicopter.', 'Holds 4 aircraft. Stronger building. Pick 1 of 3 upgrades.'], specs: [
  { id: 'gunship', n: 'Combat Pilots', d: 'All your aircraft deal +15% damage. Also unlocks the Gunship.' },
  { id: 'superiority', n: 'Better Engines', d: 'All your aircraft fly 15% faster. Also unlocks the Sky Hunter jet.' },
  { id: 'swarm', n: 'Drone Factory', d: 'Holds 4 more drones. Drones cost 40% less and build twice as fast.' }] });
defB('depot', { n: 'Supply Depot', sz: 4.5, hp: [500, 700, 950], cost: [120, 100, 150], bt: [10, 12, 14], hq1: 1, d: 'Money and +3 army space.', info: 'Generates extra money every second and raises your army limit: +3, +6 and +10 by level.', inc: [2.5, 4.5, 7], up: ['More money. +6 army space.', 'Even more money. +10 army space.'], upl: ['Makes more money and raises the army limit to +6.', 'Makes even more money and raises the army limit to +10. Then pick 1 of 3 upgrades.'], specs: [
  { id: 'trade', n: 'Trade Post', d: '+60% money from this depot.' },
  { id: 'logistics', n: 'Logistics Hub', d: 'Buildings at this flag recharge troops 25% faster.' },
  { id: 'armory', n: 'Ammo Dump', d: 'Your troops near this depot deal +12% damage.' }] });
defB('farm', { n: 'Resource Farm', sz: 4.5, hp: [450, 650, 900], cost: [100, 90, 140], bt: [10, 12, 14], hq1: 1, max: 4, d: 'Grows money, more the longer it stands.', info: 'Fields and a grain silo that produce money every second: +1.6, +3 and +5 by level. A farm that is left standing ripens: its output climbs by up to +50% over three minutes, and starts over if it is destroyed. Farms do not raise your army limit. You can have up to 4.', inc: [1.6, 3, 5], up: ['More fields. More money.', 'A barn and a second silo. Even more money.'], upl: ['Grows more money every second.', 'Grows the most money of any farm.'] });
defB('turret', { n: 'MG Bunker', def: 1, sz: 3.6, hp: [800, 1500, 2600], cost: [140, 120, 180], bt: [10, 11, 13], hq1: 1, d: 'Guards the flag by itself.', info: 'A concrete machine gun bunker that shoots enemies automatically. Its armor shrugs off 15% of damage at Level 1, 30% at Level 2 and 45% at Level 3.', up: ['Much tougher, faster gun, 30% armor.', 'A fortress: huge health, 45% armor. Pick an upgrade.'], specs: [
  { id: 'twin', n: 'Twin Machine Guns', d: 'Almost twice the fire rate. Great vs soldiers.' },
  { id: 'at', n: 'Anti-Tank Gun', d: 'Long-range cannon that kills vehicles.' },
  { id: 'flak', n: 'Anti-Aircraft Gun', d: 'Flak cannon that shoots down aircraft.' }] });
// 4.2 defenses. They fit on any build spot, and also on the defense pads every flag now has just outside its walls.
defB('cannon', { n: 'Cannon Tower', def: 1, sz: 3.8, hp: [900, 1600, 2600], cost: [220, 170, 240], bt: [12, 13, 15], hq1: 1, d: 'Long-range gun that kills vehicles.', info: 'An armored tower with a long anti-tank gun. Wrecks cars, tanks and mechs from far away, but it is slow against soldiers.', up: ['Bigger gun, tougher, more range.', 'Strongest. Pick an upgrade.'], specs: [
  { id: 'hgun', n: 'Heavy Gun', d: '+40% damage per shot, slower reload.' },
  { id: 'autol', n: 'Autoloader', d: 'Fires twice as fast, 30% less damage per shot.' },
  { id: 'lbarrel', n: 'Long Barrel', d: 'Shoots 25% farther.' }] });
defB('flakt', { n: 'Flak Tower', def: 1, sz: 3.6, hp: [800, 1400, 2300], cost: [200, 150, 220], bt: [12, 13, 15], hq1: 1, d: 'Shreds helicopters and drones.', info: 'A tall tower of quad flak cannons. It only shoots at aircraft, and nothing in the sky lasts long near it.', up: ['Faster and longer range.', 'Strongest. Pick an upgrade.'], specs: [
  { id: 'fradar', n: 'Radar Guidance', d: 'Shoots 25% farther.' },
  { id: 'fburst', n: 'Burst Fire', d: 'Fires 50% faster.' },
  { id: 'fheavy', n: 'Heavy Shells', d: '60% bigger blast and +20% damage.' }] });
defB('mortarpit', { n: 'Mortar Pit', def: 1, sz: 3.6, hp: [700, 1200, 2000], cost: [180, 140, 200], bt: [10, 12, 14], hq1: 1, d: 'Lobs shells on groups of soldiers.', info: 'A dug-in mortar crew that drops shells on enemy groups from long range. Cannot hit targets right next to it.', up: ['Bigger shells, more range.', 'Strongest. Pick an upgrade.'], specs: [
  { id: 'mhe', n: 'High Explosive', d: '50% bigger blast.' },
  { id: 'mrapid', n: 'Fast Crew', d: 'Fires 55% faster.' },
  { id: 'mincend', n: 'Smoke and Fire', d: 'Shells also slow down enemies for a few seconds.' }] });
defB('tesla', { n: 'Tesla Tower', def: 1, sz: 3.4, hp: [850, 1500, 2500], cost: [320, 240, 320], bt: [16, 18, 20], hq1: 2, d: 'Lightning that jumps between enemies.', info: 'Prototype tech from a Warden vault. Its lightning bolt jumps from enemy to enemy (3, 4 and then 5 targets) and is brutal against crowds of soldiers. Short range.', up: ['More damage, jumps to 4 targets.', 'Jumps to 5 targets. Pick an upgrade.'], specs: [
  { id: 'tarc', n: 'Arc Chain', d: 'Lightning jumps to 2 more targets.' },
  { id: 'tover', n: 'Overload', d: '+40% damage.' },
  { id: 'tstun', n: 'Stun Field', d: 'Every hit slows enemies down.' }] });
defB('shieldgen', { n: 'Shield Generator', def: 1, sz: 3.8, hp: [700, 1200, 2000], cost: [300, 220, 300], bt: [16, 18, 20], hq1: 2, d: 'A force field that blocks all damage.', info: 'Projects a force field dome. While it is up, it soaks up ALL damage to your buildings and troops inside (1200, 2500 and then 4500 points by level). When it runs out the field breaks; after 8 seconds it recharges and switches back on at half strength.', up: ['Shield holds 2500 damage, recharges faster.', 'Shield holds 4500 damage. Pick an upgrade.'], specs: [
  { id: 'sregen', n: 'Fast Recharge', d: 'Recharges 2.5 times as fast, and starts after only 4 seconds.' },
  { id: 'swide', n: 'Wide Field', d: 'The dome covers a 50% bigger area.' },
  { id: 'shard', n: 'Hardened Field', d: 'The field holds 60% more damage.' }] });
defB('medical', { n: 'Medical Tent', sz: 5, hp: [450, 650, 850], cost: [130, 100, 160], bt: [11, 12, 14], hq1: 2, ros: [2, 3, 4], d: 'Heals soldiers nearby.', info: 'Keeps a few Medics (2, 3 and 4 by level) and slowly heals friendly soldiers around it. Healing grows with each level.', up: ['Heals faster.', 'Heals fastest. Pick an upgrade.'], specs: [
  { id: 'triage', n: 'Triage Ward', d: 'Double healing. Nearby soldiers take 15% less damage.' },
  { id: 'stim', n: 'Stim Lab', d: 'Nearby soldiers shoot 20% faster and run 10% faster.' },
  { id: 'motor', n: 'Repair Bay', d: 'Also repairs vehicles and aircraft nearby.' }] });
defB('arty', { n: 'Artillery Battery', def: 1, sz: 4.5, hp: [520, 760, 1000], cost: [260, 200, 260], bt: [16, 18, 20], hq1: 2, d: 'Shells enemies from far away.', info: 'Long-range guns. They need a unit or building nearby to see the target.', up: ['Stronger guns, more health.', 'Strongest. Pick an upgrade.'], specs: [
  { id: 'howitzer', n: 'Heavy Howitzer', d: 'Bigger shells and longer range, slower reload.' },
  { id: 'salvo', n: 'Rocket Barrage', d: 'Fires four rockets at once.' },
  { id: 'shock', n: 'Smoke Shells', d: 'Shells slow enemy units for a few seconds.' }] });
defB('radar', { n: 'Radar Station', sz: 4.5, hp: [400, 600, 800], cost: [180, 140, 220], bt: [13, 14, 16], hq1: 2, d: 'Sees far. Unlocks the Cruise Missile.', info: 'A radar dish that shows a wide area (most useful with Fog of war on). A Level 3 Radar Station unlocks the Cruise Missile Support power.', vis: [55, 80, 110], up: ['Sees farther.', 'Sees farthest. Unlocks the Cruise Missile. Pick an upgrade.'], specs: [
  { id: 'scan', n: 'Deep Scan', d: 'Radar sees 60% farther.' },
  { id: 'jammer', n: 'Jammer Field', d: 'Enemies within range shoot 20% weaker.' },
  { id: 'aircon', n: 'Air Control', d: 'Recon and Airstrike recharge 40% faster. Airstrikes drop 50% more bombs.' }] });
defB('wall', { n: 'Fortified Walls', sz: 0, hp: [900, 1800, 3200], cost: [120, 150, 200], bt: [10, 12, 14], hq1: 3, d: 'Rings a flag with walls.', info: 'A ring of walls with four gates around a flag. Your troops inside take less ranged damage, and enemies have to go through the gates. Click the wall ring to level it up.', red: [.15, .25, .35], up: ['Taller, stronger walls.', 'Strongest walls. Pick an upgrade.'], specs: [
  { id: 'bulwark', n: 'Bulwark', d: 'Walls have 80% more health. Your troops inside take 10% less damage.' },
  { id: 'mines', n: 'Minefield', d: 'Hidden mines at the gates blast enemy ground units.' },
  { id: 'wire', n: 'Razor Wire', d: 'Enemy soldiers near the walls are slowed and hurt.' }] });
defB('nest', { n: 'Sandbag Nest', sz: 2.2, hp: [320, 320, 320], cost: [60, 0, 0], bt: [6, 0, 0], d: 'Engineer-built machine gun nest.', specs: [], free: 1 });
// 3.0: sea = only fits the coastal build spot (anchor pad) that some flags by the water have, and that spot takes nothing else
defB('shipyard', { n: 'Shipyard', sz: 6, sea: 1, hp: [900, 1250, 1650], cost: [240, 200, 300], bt: [18, 20, 24], hq1: 1, ros: [3, 5, 8], d: 'Builds ships. Coastal spot only.', info: 'Only fits the coastal build spot (anchor pad) of a flag by the sea. Pick which ships it keeps: it builds them and replaces any that sink. Level 1 holds 3 ships (Gunboat, Landing Craft), Level 2 holds 5 and unlocks the Destroyer, Level 3 holds 8. It repairs your ships near it.', up: ['Holds 5. Unlocks the Destroyer.', 'Holds 8. Pick 1 of 3 upgrades.'], upl: ['Holds 5 ships. Unlocks the Destroyer.', 'Holds 8 ships. Stronger building. Pick 1 of 3 upgrades.'], specs: [
  { id: 'drydock', n: 'Dry Dock', d: 'Ships built here have +20% health, and it repairs ships twice as fast.' },
  { id: 'convoy', n: 'Convoy Yards', d: 'Holds 3 more ships. Builds 40% faster. Ships cost 15% less.' },
  { id: 'gunnery', n: 'Naval Gunnery', d: 'Ships built here shoot 15% farther.' }] });
const BUILDABLE = ['barracks', 'factory', 'depot', 'farm', 'turret', 'cannon', 'flakt', 'mortarpit', 'medical', 'airfield', 'arty', 'tesla', 'shieldgen', 'radar', 'wall', 'shipyard'];
// 3.0: the Iron Legion uses the same buildings (with its own look); only the text that names troops changes
const BT_LG = {
  hq: { info: 'Your base. Keeps a small squad of Legionaries and Technicians (3, 4 and 5 troops by level). If it is destroyed you lose. Upgrading raises income and unlocks new buildings, Upgrades and Support powers.' },
  barracks: { info: 'Pick which Legion troopers this Barracks keeps: it trains them and replaces any that die. Level 1 holds 5, Level 2 holds 10 and Level 3 holds 20. Level 2 unlocks the Jump Trooper, Shredder, Railgunner, Plasma Mortar and Nano-Medic. Level 3 unlocks the Arc Trooper. The Veteran Training upgrade also unlocks the Praetorian.', up: ['Holds 10. Unlocks 5 new troopers.', 'Holds 20. Unlocks the Arc Trooper.'], upl: ['Holds 10 troopers. Unlocks Jump Trooper, Shredder, Railgunner, Plasma Mortar and Nano-Medic.', 'Holds 20 troopers. Stronger building. Unlocks the Arc Trooper. Then pick 1 of 3 upgrades.'], specs: { elite: 'New troopers start as Veterans (stronger). Also unlocks the Praetorian.', conscript: 'Holds 30 troopers instead of 20. Trains 40% faster. Troopers cost 15% less.', shock: 'New troopers get +20% health, +10% speed, +10% damage.' } },
  factory: { info: 'Pick which mechs this Motor Pool keeps: it builds them and replaces any that are destroyed. Level 1 holds 3, Level 2 holds 6 and Level 3 holds 10. Level 2: Hover Tank, Artillery Walker, Skyguard. Level 3: Warmech. Its upgrades unlock the Siege Titan or the Storm Walker.', up: ['Holds 6. Unlocks 3 new mechs.', 'Holds 10. Unlocks the Warmech.'], upl: ['Holds 6 mechs. Unlocks Hover Tank, Artillery Walker and Skyguard.', 'Holds 10 mechs. Unlocks the Warmech. Then pick 1 of 3 upgrades.'], specs: { heavy: 'Mechs built here have +15% health. Also unlocks the Siege Titan.', rapid: 'Holds 14 mechs instead of 10. Builds 50% faster. Mechs cost 15% less.', artillery: 'Artillery Walkers shoot 20% farther. Also unlocks the Storm Walker.' } },
  airfield: { info: 'Pick which flyers this Airfield keeps: it builds them and replaces any that are shot down. Level 1 holds 2, Level 2 holds 3 and Level 3 holds 4. You can only have 2 Airfields. Level 2 unlocks the Wraith. Its upgrades unlock the Harbinger or the Raptor jet.', up: ['Holds 3. Unlocks the Wraith.', 'Holds 4. Pick 1 of 3 upgrades.'], upl: ['Holds 3 flyers. Unlocks the Wraith.', 'Holds 4 flyers. Stronger building. Pick 1 of 3 upgrades.'], specs: { gunship: 'All your flyers deal +15% damage. Also unlocks the Harbinger.', superiority: 'All your flyers are 15% faster. Also unlocks the Raptor jet.', swarm: 'Holds 4 more drones. Drone Swarms and Seekers cost 40% less and build twice as fast.' } },
  medical: { info: 'Keeps a few Nano-Medics (2, 3 and 4 by level) and slowly heals friendly troopers around it. Healing grows with each level.' },
  shipyard: { info: 'Only fits the coastal build spot (anchor pad) of a flag by the sea. Pick which ships it keeps: it builds them and replaces any that sink. Level 1 holds 3 (Hydrofoil, Assault Barge), Level 2 holds 5 and unlocks the Leviathan, Level 3 holds 8. It repairs your ships near it.', up: ['Holds 5. Unlocks the Leviathan.', 'Holds 8. Pick 1 of 3 upgrades.'], upl: ['Holds 5 ships. Unlocks the Leviathan.', 'Holds 8 ships. Stronger building. Pick 1 of 3 upgrades.'] }
};
// a building's text for one army: { n, d, info, up, upl, specs }
function btx(type, fac) { const T = BT[type], L = fac === 1 && BT_LG[type]; if (!L) return T; return Object.assign({}, T, { info: L.info || T.info, up: L.up || T.up, upl: L.upl || T.upl, specs: L.specs ? T.specs.map(s => Object.assign({}, s, { d: L.specs[s.id] || s.d })) : T.specs }); }

// ---------------- upgrades (global research) ----------------
const TBR = [
  { id: 'wpn', n: 'Weapons' }, { id: 'arm', n: 'Armor' }, { id: 'eco', n: 'Money' }, { id: 'mob', n: 'Speed' }, { id: 'opt', n: 'Vision', adv: 1 }, { id: 'cmd', n: 'Command', adv: 1 }];
const TECH = [];
// x.f: 0 = Banner armies only, 1 = Iron Legion only (none = both). x.eq = the Banner upgrade a Legion one replaces.
function defT(id, br, tier, n, d, mod, x) { TECH.push(Object.assign({ id, br, tier, n, d, mod, cost: [150, 260, 420][tier - 1], time: [22, 32, 46][tier - 1] }, x || {})); }
defT('w1', 'wpn', 1, 'Better Rifles', 'Bullets do 10% more damage.', { dmgBul: .10 }, { f: 0 });
defT('w2', 'wpn', 2, 'Armor-Piercing Shells', 'Rockets and tank cannons do 12% more damage.', { dmgAT: .12 }, { f: 0 });
defT('w3', 'wpn', 3, 'High-Explosive Shells', 'Artillery and bombs do 12% more damage with a bigger blast.', { dmgShell: .12, spl: .08 });
defT('a1', 'arm', 1, 'Steel Helmets', 'Soldiers have 15% more health.', { hpInf: .15 }, { f: 0 });
defT('a2', 'arm', 2, 'Thicker Armor', 'Cars and light vehicles have 15% more health.', { hpVeh: .15 }, { f: 0 });
defT('a3', 'arm', 3, 'Reinforced Hulls', 'Tanks and aircraft have 15% more health. Buildings 20% more.', { hpHvy: .15, hpBld: .20 });
defT('e1', 'eco', 1, 'Supply Trucks', 'Earn 12% more money.', { inc: .12 });
defT('e2', 'eco', 2, 'Mass Production', 'Every unit costs 8% less.', { cost: -.08 }, { f: 0 });
defT('e3', 'eco', 3, 'War Economy', 'Earn 15% more money and raise the army limit by 20.', { inc: .15, pop: 20 });
defT('m1', 'mob', 1, 'Forced March', 'Soldiers walk 10% faster.', { spdInf: .10 }, { f: 0 });
defT('m2', 'mob', 2, 'Better Engines', 'Vehicles drive 10% faster. Troop cooldowns 10% shorter.', { spdVeh: .10, prod: .10 });
defT('m3', 'mob', 3, 'Rapid Deployment', 'Troop cooldowns 15% shorter. Aircraft fly 10% faster.', { prod: .15, spdAir: .10 });
defT('o1', 'opt', 1, 'Binoculars', 'Your units see 15% farther.', { vis: .15 });
defT('o2', 'opt', 2, 'Targeting Computers', 'All weapons reach 8% farther.', { rng: .08 });
defT('o3', 'opt', 3, 'Fire Control', 'Weapons are more accurate and do 10% more damage to buildings.', { acc: .15, bldDmg: .10 });
defT('c1', 'cmd', 1, 'Drill Instructors', 'Troops rank up 30% faster.', { xp: .30 });
defT('c2', 'cmd', 2, 'Field Hospitals', 'Medics heal 30% faster. Support powers recharge 15% faster.', { heal: .30, callCd: -.15 }, { f: 0 });
defT('c3', 'cmd', 3, 'Supreme Command', 'Support powers recharge 15% faster and cost 20% less.', { callCd: -.15, callCost: -.20 });
// 3.0 Iron Legion research (replaces the Banner upgrade in the same spot)
defT('lw1', 'wpn', 1, 'Focused Emitters', 'Pulse guns and rail rifles do 10% more damage.', { dmgBul: .10 }, { f: 1, eq: 'w1' });
defT('lw2', 'wpn', 2, 'Plasma Overcharge', 'Plasma lances and cannons do 12% more damage.', { dmgAT: .12 }, { f: 1, eq: 'w2' });
defT('la1', 'arm', 1, 'Shield Capacitors', 'Energy shields hold 40% more.', { shCap: .4 }, { f: 1, eq: 'a1' });
defT('la2', 'arm', 2, 'Mech Plating', 'Mechs, walkers and hover tanks have 15% more health.', { hpVeh: .15 }, { f: 1, eq: 'a2' });
defT('le2', 'eco', 2, 'Automated Foundries', 'Every unit costs 8% less.', { cost: -.08 }, { f: 1, eq: 'e2' });
defT('lm1', 'mob', 1, 'Jump Jet Tuning', 'Legion troopers move 10% faster.', { spdInf: .10 }, { f: 1, eq: 'm1' });
defT('lc2', 'cmd', 2, 'Nanite Repair', 'Nano-Medics heal 30% faster, shields recharge twice as fast, Support powers recharge 15% faster.', { heal: .30, shRegen: 1, callCd: -.15 }, { f: 1, eq: 'c2' });
const TECHBY = {}; TECH.forEach(t => TECHBY[t.id] = t);
const TECHF = [0, 1].map(f => TECH.filter(t => t.f === undefined || t.f === f).sort((a, b) => a.tier - b.tier));   // each army's list, tier 1 first (the Legion entries are defined last)
const techList = fac => TECHF[fac === 1 ? 1 : 0];
function techPrev(t, fac) { return t.tier > 1 ? techList(fac).find(x => x.br === t.br && x.tier === t.tier - 1) : null; }

// ---------------- support powers ----------------
const CALL = {
  recon: { n: 'Recon Flyover', cost: 80, cd: 40, req: ['hq', 2], rad: 44, col: '#5ad1ff', ic: 'R', fogOnly: 1, d: 'A jet sweeps the area and shows everything there for 22 seconds. Only needed when Fog of war is on.' },
  air: { n: 'Airstrike', cost: 220, cd: 70, req: ['hq', 2], rad: 22, col: '#ff8a5a', ic: 'A', d: 'Bombers hit a long strip of ground. Great vs groups and buildings.' },
  supply: { n: 'Supply Drop', cost: 150, cd: 60, req: ['hq', 2], rad: 28, col: '#8ff0c0', ic: 'S', d: 'Crates land and heal your troops in the area.' },
  merc: { n: 'Hire Mercenaries', cost: 250, cd: 75, req: ['hq', 2], rad: 12, col: '#ffcf5a', ic: 'M', d: 'Four hired soldiers parachute in. They leave after 2 minutes and take no army space.' },
  para: { n: 'Paratroopers', cost: 180, cd: 60, req: ['hq', 3], rad: 14, col: '#7be08a', ic: 'P', d: 'Drops 5 riflemen and a medic anywhere you can see.' },
  barrage: { n: 'Artillery Barrage', cost: 280, cd: 90, req: ['hq', 3], rad: 24, col: '#ff5a5a', ic: 'B', d: 'Heavy shells rain down on an area for six seconds.' },
  armor: { n: 'Armor Drop', cost: 520, cd: 120, req: ['hq', 3], rad: 14, col: '#c9d0ff', ic: 'T', d: 'Two Main Battle Tanks are dropped in anywhere you can see.' },
  cruise: { n: 'Cruise Missile', cost: 700, cd: 240, req: ['radar', 3], rad: 22, col: '#ff3b3b', ic: 'X', d: 'A huge guided missile wipes out everything in a wide area. Needs a Level 3 Radar Station.' }
};
const CALLORDER = ['recon', 'air', 'supply', 'merc', 'para', 'barrage', 'armor', 'cruise'];
const CALLKEYS = ['1', '2', '3', '4', '5', '6', '7', '8'];   // hold F and press the number (no F-keys needed: Chromebook friendly)
CALLORDER.forEach((id, i) => { CALL[id].num = CALLKEYS[i]; CALL[id].key = 'Hold F + ' + CALLKEYS[i]; });
const FKEYS = {}; CALLORDER.forEach(id => { FKEYS[CALL[id].num] = id; });
const callReqText = C => C.req[0] === 'hq' ? 'HQ Lv ' + C.req[1] : BT[C.req[0]].n.replace(' Station', '') + ' Lv ' + C.req[1];
// 3.0: the Iron Legion's versions of the troop drops
const CALL_LG = { para: { n: 'Drop Pods', d: 'Drop pods land 5 Legionaries and a Nano-Medic anywhere you can see.' }, armor: { n: 'Mech Drop', d: 'Two Warmechs are dropped in anywhere you can see.' } };
function callText(id, fac) { const C = CALL[id], L = fac === 1 && CALL_LG[id]; return L ? Object.assign({}, C, L) : C; }

// ---------------- 3.1 lore: the world of Ardena ----------------
// Frontline: Command - world lore and story text (plain data only)
const LORE = {
  world: {
    name: 'Ardena',
    tagline: 'The Beacons went dark. The flags went up. Now every hill is worth fighting for.'
  },

  chapters: [
    {
      title: 'The World of Ardena',
      text: 'Ardena is a wide, wild world of green farmland, red canyons, deep jungles and frozen lakes. Deep under its soil lies Embercore, a warm orange crystal that hums with power. One fist-sized chunk can light a town for a year. For centuries, the people of Ardena dug it up, shared it, and built amazing machines with it.\n\nBut Embercore is hard to reach. It only rises close to the surface in a few special places. Whoever controls those places controls the power that runs everything: the lights, the factories, the farms and, sooner or later, the armies.'
    },
    {
      title: 'The Beacons and the Long Peace',
      text: 'Long ago, eight great peoples agreed to stop fighting over Embercore. They built tall towers called Beacons on top of every rich Embercore site. Each Beacon pulled up the crystal energy and beamed it across the land, so everyone got a fair share.\n\nThe eight peoples signed the Lantern Accord, a promise of peace. Each people chose a color for its banner: Azure, Crimson, Emerald, Amber, Violet, Cyan, Rose and Ivory. Together they were called the Eight Banners.\n\nFor almost two hundred years, the Beacons glowed and nobody fired a shot. People called it the Long Peace, and many believed it would last forever.'
    },
    {
      title: 'The Armories of Every Age',
      text: 'To keep the peace, the Eight Banners created the Wardens, a group of neutral guardians. Their job was simple: lock away every weapon so no Banner could ever start a war.\n\nThe Wardens took this job very seriously. They collected old bolt-action rifles, rusty biplanes and clanking early tanks. They also collected brand new inventions: walking mechs, jet fighters and robot drones that were never allowed to leave the lab.\n\nAll of it was sealed inside giant underground Armories, hidden beneath mountains and cities. Rows and rows of weapons from every age sat in the dark, quietly waiting. Most people forgot they were even there.'
    },
    {
      title: 'The Night the Beacons Went Dark',
      text: 'Then came the night everything changed. Without warning, every Beacon across Ardena flickered and went dark at the same moment. Cities lost their lights. Factories stopped. Trains froze on their tracks.\n\nNobody knew who did it. The Azure Banner blamed the Crimson. The Crimson blamed the Emerald. Every Banner pointed at someone else. Angry messages flew back and forth, and the Wardens could not calm anyone down.\n\nBy sunrise, the Lantern Accord was torn to pieces. Each Banner decided that if the Beacons would not share Embercore anymore, they would simply grab the Beacon sites for themselves. The Long Peace was over.'
    },
    {
      title: 'The Great Scramble',
      text: 'Every Banner needed an army, fast. But nobody had kept an army during the Long Peace. So they did the only thing they could: they broke open the Wardens’ Armories and took everything inside.\n\nThat is why the battlefields of Ardena look so strange today. A rifleman carrying a hundred-year-old rifle might march beside a towering Titan mech. A shaky old artillery gun might fire next to a sleek jet fighter. Commanders use whatever works, from any era.\n\nThe Wardens tried to stop the raids, but they were guardians, not soldiers. Within a year, the Armories were empty and the Wardens had vanished from sight.'
    },
    {
      title: 'The Eight Banners at War',
      text: 'Today the Eight Banners are rival armies, each with its own style and pride.\n\nThe Azure Legion is famous for discipline. The Crimson Guard loves bold attacks. The Emerald Rangers are masters of jungle and forest. The Amber Company grew rich on desert trade routes. The Violet Order hides its secrets well. The Cyan Fleet rules the skies and rivers. The Rose Brigade is quick and clever. The Ivory Watch never forgets a defeat.\n\nAlliances shift all the time. Yesterday’s friend can be tomorrow’s enemy. The only thing every Banner agrees on is that the Beacons are worth fighting for.'
    },
    {
      title: 'Flags on the Beacons',
      text: 'Even dark, a Beacon still sits on top of rich Embercore. When an army captures a Beacon site, it plants its flag there and starts digging. Every flag you hold sends a steady stream of Embercore back to your base, and Embercore pays for soldiers, tanks and aircraft.\n\nThat is why every battle in Ardena is a fight over flags. More flags means more money. More money means a bigger army. A bigger army means even more flags.\n\nBut every army also has a Headquarters, its command center and its heart. Lose your flags and you grow weak. Lose your Headquarters and the battle is lost.'
    },
    {
      title: 'A Short Timeline',
      text: 'Year 1: The first Beacon is lit. Ardenans start counting years “After Lighting.”\n\nYear 210: The Eight Banners sign the Lantern Accord. The Long Peace begins.\n\nYear 215: The Wardens finish sealing the great Armories.\n\nYear 402: The Night the Beacons Went Dark. The Accord breaks.\n\nYear 403: The Great Scramble. Every Armory is raided. The Wardens disappear.\n\nYear 405: The Battle of Old Bridge at Greenfield Crossing, the first big clash of the Flag War.\n\nYear 407: The Iron Vault opens under the Frostbite hills, and the Iron Legion marches out.\n\nYear 409: The five great commanders, Vex, Stone, Hale, Kruger and Voss, rise to fame. Legate Kael leads the Iron Legion against all of them.\n\nYear 410: Today. A new commander joins the fight. That commander is you.'
    },
    {
      title: 'The Iron Legion',
      text: 'Not every Warden ran away when the Armories were raided. A small group of Warden engineers locked themselves inside the Iron Vault, the deepest and most secret Armory of all. It did not hold old rifles. It held the inventions the Wardens had judged too dangerous to ever use: energy shields, walking combat mechs, hover tanks floating on Embercore, and swarms of thinking drones.\n\nFour years later the Iron Vault opened, and the Iron Legion marched out. Its troopers wear sealed armor and glowing shields that soak up bullets. It has no tanks, only mechs that stride over rubble and hover tanks that skim across the ground. Its Jump Troopers leap over walls, and its Siege Titans are walking fortresses.\n\nThe Legion flies no Banner color. It says Embercore needs a guardian strong enough to protect it from everyone, Banners included. Some commanders have joined it and traded their rifles for shields. The Legion is strong and proud, but small: every trooper is expensive, and Tesla lightning cracks its shields wide open.'
    },
    {
      title: 'The Five Great Commanders',
      text: 'Out of the chaos, five commanders became legends.\n\nColonel Vex strikes first and fast, flooding the field with cheap soldiers and speeding scout cars. General Stone builds walls and bunkers so strong they seem to grow from the ground, then rolls out tanks and giant mechs when you least expect it. Major Hale studies every move you make and builds exactly what beats it. Marshal Kruger runs a rich, steady economy and pours it all into tanks and Titans. Admiral Voss rules the sky with helicopters, gunships, jets and drones.\n\nSooner or later, every new commander has to face all five. And then there is Legate Kael of the Iron Legion, who answers to no Banner at all.'
    },
    {
      title: 'Your Story Begins',
      text: 'You started as a Private, carrying a rifle and digging trenches like everyone else. But you noticed things. You saw where the enemy was weak. You knew when to charge and when to hold.\n\nYour officers noticed too. You were promoted to Sergeant, then Lieutenant, then Captain. Now High Command has given you your own army and your own Headquarters.\n\nEach operation you win brings new Doctrines, battle-tested tricks that make your forces stronger. Win enough, and you could climb all the way to General. Lose, and you learn, rebuild and try again. The flags are waiting, Commander.'
    },
    {
      title: 'The Bastion',
      text: 'High above the battle lines stands the Bastion, a giant fortress built on the ruins of the largest Beacon ever made, the Heart Beacon. Scouts say that if the Heart Beacon is ever lit again, it could wake up every Beacon in Ardena.\n\nHigh Command has handed the Bastion to you. Hold it, strengthen it, and never let it fall for good.\n\nBut someone else wants the Heart Beacon too. Wave after wave of enemy commanders are marching on the Bastion from every direction. Nobody knows who is sending them, or why they never stop. Your job is to hold the line and find out.'
    }
  ],

  commanders: {
    vex: {
      bio: 'Colonel Vex grew up racing scout cars across the Dustbowl canyons, and she never learned to slow down. Her motto is simple: hit them before they are ready. Vex sends huge waves of cheap riflemen, scouts and fast cars in the first minutes of a battle, hoping to grab every flag before her enemy has even built a Barracks. Her soldiers love her because she always rides near the front. If you can survive her first rush, she can run out of steam. That is a big if.',
      quotes: [
        'Go, go, go! Grab those flags!',
        'Speed wins wars. Move it!',
        'They are still building? Perfect. Charge!',
        'More soldiers! Cheap and fast!',
        'Do not stop until you see their Headquarters!'
      ],
      taunt: 'Still unpacking your boxes, rookie? My scouts are already at your door.',
      defeat: 'Not fast enough... this time. Next time I will start even sooner.'
    },
    stone: {
      bio: 'General Stone is patient, calm and almost impossible to move. Before the war he was an engineer who built dams and bridges, and now he builds fortresses. Stone surrounds his Headquarters with walls, bunkers and artillery, then waits while his enemies crash against them. Once they are worn out, his gates swing open and out roll heavy tanks and giant Titan mechs. Attacking Stone too early is a mistake. Waiting too long is an even bigger one.',
      quotes: [
        'Dig in. Let them come to us.',
        'Another wall. Then another.',
        'Artillery, fire on that hill.',
        'Patience. The walls will hold.',
        'Open the gates. Send out the Titans.'
      ],
      taunt: 'Knock all you like, Commander. My walls have stood longer than you have been in uniform.',
      defeat: 'You found the crack in my wall. I will not leave that crack open again.'
    },
    hale: {
      bio: 'Major Hale never builds the same army twice. A former Warden scholar, she treats every battle like a puzzle. Hale watches what you build and answers it: tanks meet Bazooka Teams, aircraft meet Anti-Air Guns, infantry swarms meet Machine Gunners. She keeps a balanced force ready for anything and is famous for switching plans halfway through a fight. To beat Hale, you must stay one step ahead and never let her guess your next move.',
      quotes: [
        'Interesting. I know just the answer.',
        'You build tanks? I build rockets.',
        'Balance is the key to victory.',
        'Change the plan. Adapt and win.',
        'Every move has a counter.'
      ],
      taunt: 'I have already read your plan, Commander. Shall I tell you how it ends?',
      defeat: 'Well played. You surprised me. That does not happen often.'
    },
    kruger: {
      bio: 'Marshal Kruger believes that money wins wars, and tanks spend money best. He spends the first part of every battle quietly grabbing flags and building Supply Depots. Then the ground starts to shake. Rows of Main Battle Tanks and mighty Titan mechs roll forward together like a steel wall. Kruger is slow to start but almost unstoppable once he gets going. The smart move is to hit his economy early, before his factories are humming.',
      quotes: [
        'Build the economy. The tanks will follow.',
        'Armor, advance in formation!',
        'Send in the Titans.',
        'Steel and patience win the day.',
        'Roll over them. Do not stop.'
      ],
      taunt: 'Hear that rumble, Commander? That is the sound of fifty tanks with your name on them.',
      defeat: 'My steel wall... broken. I must build a thicker one.'
    },
    voss: {
      bio: 'Admiral Voss once commanded the Cyan Fleet’s airships, and she still thinks the ground is for other people. Her army lives in the sky: Attack Helicopters, heavy Gunships, Sky Hunter jets and clouds of drones. Voss strikes from unexpected angles and loves hitting bases that forgot to build Anti-Air Guns. She has few ground troops, so a commander with strong air defense and a quick push to her Airfield can catch her off guard.',
      quotes: [
        'All squadrons, take off!',
        'Look up, Commander.',
        'Drones out. Find their weak spot.',
        'Gunships, rain fire on that flag.',
        'The sky belongs to me.'
      ],
      taunt: 'You built walls, Commander? How cute. I fly over walls.',
      defeat: 'Grounded... for now. The sky will be mine again.'
    },
    kael: {
      bio: 'Legate Kael was the youngest engineer ever sealed inside the Iron Vault, and the first to walk back out. She rebuilt the Legion’s mechs with her own hands and knows every bolt of them. Kael fights with fewer soldiers than anyone, but every one of them carries a shield, and her Combat Mechs and Hover Tanks hit fast and hard. Behind them stride Warmechs and, when she is ready, a Siege Titan. Her troopers are expensive, so trading blow for blow with her cheap soldiers can work, and Tesla Towers crack her shields wide open.',
      quotes: [
        'Shields up. Advance.',
        'One Legionary is worth five of your rifles.',
        'Mechs forward. Let them see us coming.',
        'Jump Troopers, over the wall!',
        'The Vault built us for this day.'
      ],
      taunt: 'Your bullets will bounce off my shields, Commander. Bring something better.',
      defeat: 'My shields broke before my will did. The Legion will return stronger.'
    }
  },

  units: {
    rifleman: 'The backbone of every army, armed with sturdy rifles from the old Armories. Cheap, quick to train and brave, Riflemen take flags and hold ground better than anyone.',
    rocket: 'Two soldiers and one big tube that tanks fear. Bazooka Teams are slow to reload, but a few well-placed rockets can stop an armored column cold.',
    mechanic: 'Mechanics keep the Motor Pool rolling. Send them behind your tanks and the wrecks keep fighting.',
    engineer: 'Engineers build, repair and patch things up under fire. A smart commander keeps them close, because a fixed bunker is cheaper than a new one.',
    scout: 'Fast on foot and hard to spot, Scouts run ahead to find enemy bases and empty flags. They are not great fighters, but they win wars with what they see.',
    heavy: 'Machine Gunners lug heavy belt-fed guns that pin down enemy infantry. Anyone charging across open ground toward one will quickly wish they had not.',
    sniper: 'Patient sharpshooters with long-range rifles and plenty of camouflage. Snipers pick off enemy soldiers from far away, then quietly slip back into cover.',
    mortar: 'Mortar Teams lob explosive shells high over walls and hills. They cannot hit what is right in front of them, so keep them safely behind the front line.',
    grenadier: 'Grenadiers toss explosive grenades into trenches, bunkers and clumps of enemy soldiers. They are perfect for clearing out a well-defended flag.',
    commando: 'Elite soldiers trained in the hidden Warden camps. Commandos are tough, fast and deadly, able to sneak behind enemy lines and wreck important targets.',
    medic: 'Medics carry bandages, splints and a lot of courage. They patch up nearby soldiers and get them back in the fight, keeping your infantry going longer.',
    merc: 'Mercenaries fight for Embercore, not for a Banner. They arrive fast, fight hard and do not ask questions, as long as the payment keeps coming.',
    jeep: 'A speedy open-top Scout Car with a mounted gun. Perfect for racing to empty flags, chasing down infantry and spotting what the enemy is building.',
    apc: 'An armored troop carrier that keeps soldiers safe on the way to the front. The APC is tough enough to shrug off rifle fire and has a gun of its own.',
    lighttank: 'Quicker and cheaper than the big tanks, the Light Tank zips across the battlefield, flanking enemies and helping infantry push forward.',
    tank: 'The Main Battle Tank is the king of the ground war. Thick armor and a huge cannon let it smash through defenses that would stop anything smaller.',
    artillery: 'A big cannon on tank tracks that fires shells across half the map. Self-Propelled Guns can roll into position, flatten a target and roll away again.',
    aa: 'The Anti-Air Gun points its rapid-fire barrels at the sky. Helicopters, gunships and jets learn to fear these guns very quickly.',
    mlrs: 'The Rocket Battery launches a whole volley of rockets at once, covering a wide area in explosions. Slow to reload, but every salvo is spectacular.',
    titan: 'A towering walking mech from the deepest Warden vaults. The Titan stomps over obstacles, shrugs off most attacks and makes the ground tremble with every step.',
    drone: 'A small flying eye that buzzes high over the battlefield. The Recon Drone reveals hidden enemies and lets your army see what is coming next.',
    strike: 'A Recon Drone with teeth. The Attack Drone dives in fast, fires its small missiles and is gone before the enemy can take aim.',
    heli: 'The Attack Helicopter hovers low and hammers tanks with rockets. It is fast and fierce, but it must watch out for Anti-Air Guns.',
    gunship: 'A heavy flying fortress bristling with guns. The Gunship circles over the battlefield, raining fire on anything that is not hiding under cover.',
    interceptor: 'The Sky Hunter is a screaming jet fighter built to clear the skies. It hunts enemy helicopters, gunships and drones faster than they can flee.',
    legionary: 'Every Legionary wears sealed armor and a shield belt that hums with Embercore. Bullets spark off the glowing shield, and a few seconds out of the fight are enough for it to charge back up.',
    lancer: 'The Lancer carries a long tube that throws a white-hot bolt of plasma. One good hit can melt a hole straight through tank armor.',
    technician: 'Technicians keep the Legion’s machines running. They carry a toolkit the size of a backpack and can patch a mech in the middle of a firefight.',
    jumptrooper: 'Jump Troopers wear jet packs and love nothing more than a high wall. They bound over it, grab the flag behind it and are gone before anyone can turn around.',
    shredder: 'A Shredder’s rotary pulse gun spins up with a whine that every Banner soldier has learned to fear.',
    railgunner: 'A rail rifle throws a metal slug so fast that it punches through helmets, sandbags and even thin armor.',
    nanomedic: 'Nano-Medics carry a cloud of tiny healing robots that close wounds in seconds. Soldiers call them the glow-bugs.',
    arctrooper: 'Arc Troopers carry Tesla coils on their backs and throw lightning that jumps from enemy to enemy. They were once Warden test pilots for the Tesla Tower.',
    praetorian: 'The Praetorians guard Legate Kael herself. Their shields are the strongest the Iron Vault ever built, and their breaching guns turn bunkers into gravel.',
    servitor: 'A four-legged repair robot that scuttles after the mechs with a welding arm. It never sleeps, never complains and never stops fixing things.',
    strider: 'The Strider runs on two long legs like a giant metal bird. It is the fastest way across a battlefield full of craters.',
    combatmech: 'The Legion never built tanks. It built the Combat Mech instead: a walking machine that climbs over rubble, turns on the spot and sprays pulse fire at anything in front of it.',
    hovertank: 'Hover Tanks float on pads of glowing Embercore and skim over the ground faster than any tank with tracks. Their armor is thin, so they strike and slide away.',
    artwalker: 'Four long legs keep the Artillery Walker’s huge gun steady. It walks to a hill, plants its feet and starts shelling things far over the horizon.',
    skyguard: 'Skyguard walkers watch the sky with whirling sensors. When an aircraft comes too close, a pair of seeker missiles is already on the way.',
    warmech: 'The Warmech is the backbone of every Legion attack: a heavy walker with a plasma cannon for an arm and a shield that shrugs off the first volley.',
    stormwalker: 'The Storm Walker carries a box of plasma rockets on its back and empties it in one long, roaring volley.',
    siegetitan: 'The Siege Titan is a walking fortress, slow as a glacier and just as hard to stop. Its siege cannon was built to crack the walls of a Bastion.',
    swarm: 'Drone Swarms are trios of small attack drones that think together. They buzz around a target like angry hornets.',
    seeker: 'A Seeker Drone is a flying plasma charge. It picks a target, dives and lights up the sky.',
    wraith: 'The Wraith hovers without a single rotor, kept up by Embercore engines that glow under its belly. It strikes fast and ghosts away.',
    harbinger: 'The Harbinger is a flying wing as wide as a house, wrapped in an energy shield. When it appears over a battlefield, the shooting usually stops for a moment.',
    raptor: 'The Raptor is a forward-swept jet built for one job: clearing the sky of anything that is not the Legion.',
    plasmortar: 'A Plasma Mortar team plants its tube, feeds it a glowing Embercore cell and sends a ball of blue fire high over the battlefield. Where it lands, sandbags melt.',
    // 3.0 the navy
    gunboat: 'Gunboat crews say they are the only soldiers who never have to march. Their fast little boats race along the coast, rattling machine guns and rippling rockets at anything on the beach.',
    lcraft: 'A Landing Craft is little more than a steel box with an engine and a ramp, but no island in Ardena is safe from an army that has one. The ride is short, wet and very loud.',
    destroyer: 'The Destroyers were pulled out of the old harbor yards after the Long Peace ended. Their big deck guns can hit a flag from far out at sea, and their flak keeps the gulls (and gunships) away.',
    hydrofoil: 'The Legion Hydrofoil lifts out of the water on glowing foils and skims over the waves faster than any boat should go. By the time you hear it, it is already gone.',
    assaultbarge: 'Assault Barges carry Legion troopers to the shore behind a humming energy shield. When the ramp drops, the shield drops with it, and eight troopers charge up the beach.',
    leviathan: 'The Leviathan is the Legion answer to the old Destroyers: a long dark hull with a plasma battery along its spine and enough shield power to shrug off a whole coastal battery.'
  },
  // 3.0 how Iron Legion buildings look
  legionBuildings: 'The Iron Legion builds the same kinds of buildings as everyone else, but out of dark Vault steel lit with glowing Embercore. Its Headquarters is a tall Citadel with a beacon spire.',
  // 3.0 Field Guide text for the Legion versions of the buildings that train troops (the rest share the Banner text)
  lgBuildings: {
    hq: 'The Legion Citadel rises like a dark steel spire with an Embercore beacon at its tip. Every order, every shield charge and every drop pod is guided from inside its walls. If the Citadel falls, the battle is lost.',
    barracks: 'Inside a Legion Barracks, recruits are sealed into armor, fitted with a shield belt and drilled until they move as one. Out march Legionaries, Lancers and Jump Troopers, and the very best join the Praetorian guard.',
    factory: 'The Legion Motor Pool never builds a tank. Its cranes and welders put together walking machines instead: Striders, Combat Mechs, Warmechs and the colossal Siege Titan, plus Hover Tanks that float out on glowing pads.',
    airfield: 'You will not hear a propeller at a Legion Airfield. Drone Swarms buzz out of its hangars, Wraiths and Harbingers lift off on Embercore engines, and Raptor jets howl down its glowing runway.',
    medical: 'A Legion medical station is a clean white dome humming with clouds of healing nanites. Wounded troopers step inside, and the tiny robots patch them up before their shields have even recharged.',
    wall: 'Legion walls are cast from dark Vault steel, with a glowing Embercore seam along the top that lights up the night.'
  },

  buildings: {
    hq: 'The heart of your army, where orders go out and Embercore comes in. Protect your Headquarters at all costs, because if it falls, the battle is lost.',
    barracks: 'Where new recruits get their boots, rifles and training. The Barracks turns volunteers into soldiers, from Riflemen to elite Commandos.',
    factory: 'A busy garage full of mechanics, cranes and spare parts. The Motor Pool builds Scout Cars, APCs, tanks, artillery and even giant Titan mechs.',
    airfield: 'A strip of runway and a few hangars that unlock the sky. The Airfield launches drones, helicopters, gunships and Sky Hunter jets.',
    depot: 'Crates, fuel and Embercore are stacked high at the Supply Depot. More depots means a stronger economy and a faster-growing army.',
    turret: 'A concrete bunker with a machine gun poking out of the slot. MG Bunkers guard flags and gates, shredding enemy infantry that wander too close.',
    medical: 'A canvas tent with a red stripe and a team of busy doctors. Wounded soldiers nearby heal up and get ready to fight again.',
    arty: 'A fixed battery of big guns that can pound enemies from long range. The Artillery Battery turns any defensive line into a nightmare for attackers.',
    radar: 'A spinning dish that listens to the whole battlefield. The Radar Station reveals enemy movements so no attack ever takes you by surprise.',
    wall: 'Thick concrete and steel walls that block the enemy’s path. Fortified Walls buy precious time for your bunkers and guns to do their work.',
    nest: 'A quick ring of sandbags that gives soldiers a safe spot to shoot from. Cheap to build and great for holding a freshly captured flag.',
    shipyard: 'A slipway, a long wooden pier and a crane that never stops moving. The Shipyard only fits where a flag touches deep water, and it turns out Gunboats, Landing Craft and Destroyers.'
  },

