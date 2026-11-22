// ============================================================
// THE ARMORY: what a player owns between runs and what they carry in.
//   credits      paid by every run, operation, match and contract; they buy weapons, throwables and traits for good
//   the kit      a main gun, a sidearm, a throwable [G] and one trait: what a run starts with (the supply crate in the
//                field still sells the rest for that run's cash, and what you own costs half there)
//   mastery      kills with a weapon raise its mastery; each level opens an attachment, and a finish for the gun
//   contracts    three small jobs a day, each paying credits
// Nothing here is drawn in a run except the throwables (fire on the ground, mines); the weapon on the armory page is the
// real model, drawn into the small picture on that page.
// ============================================================
// an attachment changes the numbers of a weapon (w is a copy made by Weapons.at)
const ATTACH = {
    ext:     { name: 'EXTENDED MAGAZINE', desc: 'a third more rounds before a reload', mod: w => { w.mag = Math.round(w.mag * 1.34); } },
    fast:    { name: 'SPEED LOADER', desc: 'reloads a fifth faster', mod: w => { w.reloadK *= 0.8; } },
    comp:    { name: 'COMPENSATOR', desc: 'a third less kick', mod: w => { w.kick *= 0.67; } },
    barrel:  { name: 'HEAVY BARREL', desc: '+12% damage, a little slower on your feet', mod: w => { w.dmg *= 1.12; w.move *= 0.97; } },
    stock:   { name: 'LIGHT STOCK', desc: 'move 6% faster with it out', mod: w => { w.move *= 1.06; } },
    laser:   { name: 'LASER', desc: 'far tighter from the hip', mod: w => { w.spread = [w.spread[0] * 0.55, w.spread[1]]; } },
    grip:    { name: 'FOREGRIP', desc: 'tighter when aimed, and from the hip a little', mod: w => { w.spread = [w.spread[0] * 0.85, w.spread[1] * 0.5]; } },
    hollow:  { name: 'HOLLOW POINTS', desc: '+20% to the head', mod: w => { w.head = (w.head || 1.5) * 1.2; } },
    ap:      { name: 'AP ROUNDS', desc: 'goes on through one more body', mod: w => { w.pierce = (w.pierce || 0) + 1; } },
    band:    { name: 'BANDOLIER', desc: 'half as much ammunition again', mod: w => { w.reserve = Math.round(w.reserve * 1.5); } },
    choke:   { name: 'CHOKE', desc: 'a tighter pattern that carries further', mod: w => { w.spread = [w.spread[0] * 0.7, w.spread[1] * 0.7]; if (w.falloff) w.falloff = [w.falloff[0] * 1.3, w.falloff[1] * 1.3]; } },
    warhead: { name: 'HEAVY WARHEAD', desc: 'a wider blast', mod: w => { w.blast = (w.blast || 5) * 1.3; } },
    edge:    { name: 'HONED EDGE', desc: '+35% damage', mod: w => { w.dmg *= 1.35; } },
    balance: { name: 'BALANCED GRIP', desc: 'run faster still with it out', mod: w => { w.move *= 1.07; } }
};
// which attachments a weapon can take, in the order mastery opens them
const ATT_FOR = {
    pistol: ['ext', 'laser', 'fast', 'hollow', 'comp'], carbine: ['grip', 'ext', 'comp', 'fast', 'barrel', 'ap'], smg: ['laser', 'ext', 'stock', 'fast', 'comp', 'hollow'],
    revolver: ['fast', 'hollow', 'comp', 'barrel', 'band'], shotgun: ['choke', 'fast', 'band', 'barrel', 'stock'], dmr: ['comp', 'ext', 'ap', 'fast', 'barrel'],
    lmg: ['grip', 'comp', 'fast', 'barrel', 'stock', 'band'], sniper: ['fast', 'ap', 'ext', 'band', 'stock'], rpg: ['fast', 'band', 'warhead', 'stock'],
    minigun: ['comp', 'band', 'stock', 'barrel', 'grip'], knife: ['edge', 'balance'], machete: ['edge', 'balance'],
    burst: ['grip', 'ext', 'comp', 'fast', 'barrel', 'hollow'], lever: ['fast', 'hollow', 'barrel', 'band', 'stock'], autoshot: ['choke', 'ext', 'comp', 'fast', 'band'],
    gl: ['fast', 'band', 'warhead', 'stock'], flamer: ['band', 'stock', 'ext', 'barrel'], crossbow: ['fast', 'ap', 'band', 'stock']
};
const MASTERY = [15, 50, 120, 250, 450, 800];          // kills with a weapon for each level of mastery
// a finish: the gun's picture multiplied by a colour (the arms are left alone). lvl = the mastery that opens it.
const CAMOS = {
    factory: { name: 'FACTORY', tint: [1, 1, 1], lvl: 0 }, ash: { name: 'ASH', tint: [1.5, 1.5, 1.52], lvl: 1 }, olive: { name: 'OLIVE', tint: [0.85, 1.2, 0.6], lvl: 2 }, rust: { name: 'RUST', tint: [1.7, 0.85, 0.5], lvl: 3 },
    bone: { name: 'BONE', tint: [2.1, 1.95, 1.6], lvl: 4 }, ember: { name: 'EMBER', tint: [2.6, 0.9, 0.3], lvl: 5 }, gold: { name: 'GOLD', tint: [3, 2.1, 0.55], lvl: 6 }
};
// what G does. n = how many a run starts with.
const THROWS = {
    frag:  { name: 'FRAG GRENADE', short: 'GRENADES', n: 2, rank: 0, cost: 0, desc: 'Two seconds, then everything within five metres regrets it.' },
    fire:  { name: 'FIREBOMB', short: 'FIREBOMBS', n: 2, rank: 0, cost: 300, desc: 'Sets four metres of ground alight for seven seconds. Close a doorway with it.' },
    shock: { name: 'SHOCK CHARGE', short: 'SHOCK CHARGES', n: 3, rank: 0, cost: 300, desc: 'Everything within eight metres is slowed to a crawl for five seconds.' },
    mine:  { name: 'PROXIMITY MINE', short: 'MINES', n: 3, rank: 1, cost: 500, desc: 'Dropped at your feet. It waits for the first thing to walk over it.' },
    c4:    { name: 'SATCHEL CHARGE', short: 'SATCHELS', n: 2, rank: 1, cost: 450, desc: 'Toss it, walk away, press G again. Seven metres of nothing left.' },
    stim:  { name: 'STIM', short: 'STIMS', n: 2, rank: 2, cost: 400, desc: 'Sixty health at once and five seconds of faster legs.' },
    turret: { name: 'SENTRY GUN', short: 'SENTRY GUNS', n: 1, rank: 3, cost: 700, desc: 'Set it down and it fights beside you for half a minute.' }
};
const TRAITS = {
    none:   { name: 'NO TRAIT', rank: 0, cost: 0, desc: 'Nothing extra.' },
    plates: { name: 'PLATE CARRIER', rank: 0, cost: 300, desc: 'Start every run with 50 armour on.' },
    stash:  { name: 'HEAD START', rank: 0, cost: 400, desc: 'Start every run with $600 for the first crate.' },
    demo:   { name: 'DEMOLITIONS', rank: 1, cost: 500, desc: 'Two more throwables, and every blast of yours is a quarter wider.' },
    wind:   { name: 'SECOND WIND', rank: 2, cost: 800, desc: 'Once a run, a killing blow leaves you standing on 40 health.' },
    scav:   { name: 'PACK RAT', rank: 2, cost: 700, desc: 'The ashen drop twice as much, and you carry a quarter more ammunition.' },
    cool:   { name: 'COOL HEAD', rank: 3, cost: 900, desc: 'Your class ability comes back 30% sooner.' }
};
// the jobs a day's three contracts are drawn from: [what is counted, how many, credits, the words]
const JOBS = [
    ['kills', 60, 100, 'Put down 60 ashen'], ['kills', 120, 180, 'Put down 120 ashen'], ['heads', 20, 120, 'Land 20 headshots'], ['heads', 40, 200, 'Land 40 headshots'],
    ['wave', 6, 120, 'Reach wave 6 in one run'], ['wave', 10, 220, 'Reach wave 10 in one run'], ['boss', 1, 150, 'Bring down a Furnace'], ['cash', 6000, 130, 'Earn $6000 in the field'],
    ['kind:Rifle', 40, 130, 'Get 40 kills with a rifle'], ['kind:Sidearm', 20, 150, 'Get 20 kills with a sidearm'], ['ops', 1, 150, 'Finish an operation'], ['mp', 1, 150, 'Play a multiplayer match to the end'],
    ['kind:SMG', 40, 140, 'Get 40 kills with an SMG'], ['kind:Shotgun', 30, 140, 'Get 30 kills with a shotgun']
];

const Armory = { tab: 'guns', sel: 'carbine', loading: '', t: 0, box: {}, light: new Float32Array([1, 1, 1, 1]), M: new Float32Array(16) };
// a weapon's record in the save (made the first time it is needed, owned or not)
Armory.rec = function (id) { const k = Save.data.mastery; if (!k[id]) k[id] = { kills: 0, att: [], camo: 'factory' }; return k[id]; };
Armory.owns = id => !!Save.data.weapons[id];
Armory.level = function (id) { const n = Armory.rec(id).kills; let l = 0; while (l < MASTERY.length && n >= MASTERY[l]) l++; return l; };
Armory.slots = id => Armory.level(id) >= 5 ? 3 : 2;
Armory.price = id => Math.round(WEAPONS[id].price / 4 / 25) * 25;
Armory.atts = function (id) { const r = Armory.rec(id), ok = ATT_FOR[id] || [], lvl = Armory.level(id); return r.att.filter(a => ATTACH[a] && ok.indexOf(a) >= 0 && ok.indexOf(a) < lvl).slice(0, Armory.slots(id)); };
// the attachments of the local player's copy of a weapon (called by Weapons.at)
Armory.mods = function (id, w) { w.spread = w.spread.slice(); if (w.falloff) w.falloff = w.falloff.slice(); for (const a of Armory.atts(id)) ATTACH[a].mod(w); return w; };
// what a run starts with: only what is owned, made, and still allowed
Armory.kit = function () {
    const L = Save.data.loadout, ok = (id, slot2) => WEAPONS[id] && Armory.owns(id) && Weapons.made(id) && (WEAPONS[id].slot === 2) === slot2;
    return { primary: ok(L.primary, false) ? L.primary : 'carbine', sidearm: ok(L.secondary, true) ? L.secondary : (Weapons.made('pistol') ? 'pistol' : null), throw: THROWS[L.throw] && Save.data.own[L.throw] ? L.throw : 'frag', trait: TRAITS[Save.data.perk] && Save.data.own[Save.data.perk] ? Save.data.perk : 'none' };
};
// everything rank r (0 = the first) opens: weapons for the crate and the armory, classes, throwables, traits
Armory.opens = function (r) { const of = (set, tag) => Object.keys(set).filter(id => set[id].rank === r && (set !== WEAPONS || Weapons.made(id))).map(id => set[id].name + tag); return of(WEAPONS, '').concat(of(CLASSES, ' (class)'), of(THROWS, ''), of(TRAITS, ' (trait)')); };
Armory.testUnlock = function () {
    const sv = Save.data; sv.xp = 9999999; sv.credits = (sv.credits || 0) + 100000; sv.testAll = true;
    for (const id of WEAPON_ORDER) { if (!sv.weapons[id]) sv.weapons[id] = { lvl: 0 }; Armory.rec(id).kills = Math.max(Armory.rec(id).kills, MASTERY[MASTERY.length - 1]); } for (const id in THROWS) sv.own[id] = 1; for (const id in TRAITS) sv.own[id] = 1;
    Save.store(); Snd.ui('buy'); Snd.tone(440, 0.2, 0.5, 'triangle', 880); if (App.game) HUD.banner('TEST MODE', 'everything is unlocked'); else { UI.card(); if (UI.panel) UI.draw(); UI.fatal('TEST MODE: every rank, weapon, class, attachment and operation is unlocked, and you have 100 000 credits.', true); }
};
Armory.earn = function (n) { n = Math.round(n * (1 + 0.1 * (Save.data.prestige || 0))); Save.data.credits = Math.max(0, Math.round((Save.data.credits || 0) + n)); return n; };
// a kill with a weapon: mastery, and the day's contracts
Armory.kill = function (id, head, T) {
    const W = WEAPONS[id]; if (!W) return; const r = Armory.rec(id), was = Armory.level(id); r.kills++; const now = Armory.level(id);
    if (now > was) { const a = (ATT_FOR[id] || [])[now - 1], c = Object.keys(CAMOS).find(k => CAMOS[k].lvl === now); HUD.banner(W.name + ' MASTERY ' + now, (a ? ATTACH[a].name : '') + (a && c ? ' and the ' : '') + (c ? CAMOS[c].name + ' finish' : '') + ' unlocked'); Snd.tone(520, 0.2, 0.5, 'triangle', 1040); Armory.earn(25 * now); }
    Armory.note('kills', 1); if (head) Armory.note('heads', 1); Armory.note('kind:' + W.kind, 1); if (T && T.boss) Armory.note('boss', 1);
};
// ---- contracts
Armory.today = function () { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
Armory.contracts = function () {
    const C = Save.data.contracts, day = Armory.today();
    if (C.day !== day || !C.list || C.list.length !== 3) {
        let s = 0; for (const ch of day) s = (s * 31 + ch.charCodeAt(0)) >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        const pick = [], seen = {}; let guard = 0; while (pick.length < 3 && guard++ < 200) { const i = (rnd() * JOBS.length) | 0, key = JOBS[i][0].split(':')[0]; if (seen[i] || seen[key]) continue; seen[i] = seen[key] = 1; pick.push(i); }
        C.day = day; C.list = pick.map(i => ({ job: i, have: 0, paid: false })); Save.store();
    }
    return C.list;
};
// something a contract may be counting happened. max: the number is a best-in-one-run, not a running total
Armory.note = function (k, n, max) { if (!max) Extras.note(k, n); for (const c of Armory.contracts()) { const J = JOBS[c.job]; if (!J || J[0] !== k || c.paid) continue; c.have = max ? Math.max(c.have, n) : c.have + n; } };
Armory.claim = function (i) { const c = Armory.contracts()[i], J = c && JOBS[c.job]; if (!J || c.paid || c.have < J[1]) return false; c.paid = true; Armory.earn(J[2]); Save.store(); Snd.ui('buy'); Snd.tone(440, 0.2, 0.5, 'triangle', 880); return true; };
Armory.ready = () => Armory.contracts().filter(c => !c.paid && JOBS[c.job] && c.have >= JOBS[c.job][1]).length + Extras.wReady();

// ---- the gun's finish
Armory.paint = function (M) { const t = (CAMOS[Armory.rec(M.id).camo] || CAMOS.factory).tint; for (const m of M.node.children) if (m.name !== 'vm_arms' && m.material) m.material.color = { r: t[0], g: t[1], b: t[2] }; };

// ---- the armory page
Armory.html = function () {
    const sv = Save.data, tab = Armory.tab, n = Armory.ready();
    let h = '<div class="arm-top"><div class="seg">' + [['guns', 'WEAPONS'], ['gear', 'GEAR'], ['jobs', 'CONTRACTS' + (n ? ' (' + n + ')' : '')]].map(t => '<button data-ar="tab:' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div class="credits"><small>CREDITS</small> ' + (sv.credits || 0) + '</div></div>';
    return h + (tab === 'gear' ? Armory.gearHTML() : tab === 'jobs' ? Armory.jobsHTML() : Armory.gunsHTML());
};
Armory.gunsHTML = function () {
    const sv = Save.data, r = Save.rank().index, kit = Armory.kit(), sel = WEAPONS[Armory.sel] ? Armory.sel : 'carbine', w = WEAPONS[sel], own = Armory.owns(sel), made = Weapons.made(sel), bars = Weapons.bars(sel, 0), rec = Armory.rec(sel), lvl = Armory.level(sel), on = Armory.atts(sel), list = ATT_FOR[sel] || [];
    const tiles = WEAPON_ORDER.map(id => { const x = WEAPONS[id], o = Armory.owns(id), mk = Weapons.made(id), lock = r < x.rank, tag = !mk ? 'SOON' : o ? (kit.primary === id ? 'MAIN' : kit.sidearm === id ? 'SIDE' : 'OWNED') : lock ? 'RANK ' + (x.rank + 1) : Armory.price(id) + ' CR';
        return '<button class="tile' + (sel === id ? ' sel' : '') + (!o ? ' locked' : '') + '" data-ar="sel:' + id + '"><b>' + x.name + '</b><small>' + x.kind + (o ? ' &middot; mastery ' + Armory.level(id) : '') + '</small><span class="lock' + (o ? ' own' : '') + '">' + tag + '</span></button>'; }).join('');
    const need = lvl < MASTERY.length ? MASTERY[lvl] : 0, base = lvl ? MASTERY[lvl - 1] : 0;
    let act = '';
    if (!made) act = '<button class="btn" disabled>NOT MADE YET</button>';
    else if (!own) act = r < w.rank ? '<button class="btn" disabled>REACH RANK ' + (w.rank + 1) + '</button>' : '<button class="btn go" data-ar="buy:' + sel + '"' + ((sv.credits || 0) < Armory.price(sel) ? ' disabled' : '') + '>BUY &middot; ' + Armory.price(sel) + ' CR</button>';
    else act = (kit.primary === sel || kit.sidearm === sel) ? '<button class="btn" disabled>IN YOUR KIT</button>' : '<button class="btn go" data-ar="take:' + sel + '">' + (w.slot === 2 ? 'TAKE AS SIDEARM' : 'TAKE AS MAIN GUN') + '</button>';
    return '<div class="cols"><div style="flex:1 1 330px"><div class="tiles arm-list">' + tiles + '</div></div>' +
        '<div class="detail" style="flex:1.25 1 430px"><canvas id="arm-view" width="640" height="250"></canvas><div class="arm-name"><div><h3>' + w.name + '</h3><small style="letter-spacing:.2em;color:var(--ember2)">' + w.kind.toUpperCase() + '</small></div>' + act + '</div><p>' + esc(w.desc) + '</p>' +
        '<div class="arm-two"><div>' + Object.keys(bars).map(k => '<div class="stat"><span>' + k + '</span><div><i style="width:' + (bars[k] * 100).toFixed(0) + '%"></i></div></div>').join('') + '</div>' +
        '<div><div class="h3">Mastery ' + lvl + (need ? ' &middot; ' + rec.kills + ' / ' + need + ' kills' : ' &middot; complete') + '</div><div class="xp"><i style="width:' + (need ? clamp((rec.kills - base) / (need - base), 0, 1) * 100 : 100).toFixed(0) + '%"></i></div>' +
        '<div class="h3" style="margin-top:12px">Attachments &middot; ' + on.length + ' of ' + Armory.slots(sel) + ' fitted</div><div class="chips">' + (list.map((a, i) => { const open = i < lvl; return '<button class="chip' + (on.indexOf(a) >= 0 ? ' on' : '') + (open ? '' : ' locked') + '" data-ar="att:' + a + '"' + (open && own ? '' : ' disabled') + ' title="' + esc(ATTACH[a].desc) + '">' + ATTACH[a].name + '<small>' + (open ? esc(ATTACH[a].desc) : 'mastery ' + (i + 1)) + '</small></button>'; }).join('') || '<small>none for this one</small>') + '</div>' +
        '<div class="h3" style="margin-top:12px">Finish</div><div class="chips">' + Object.keys(CAMOS).map(c => { const C = CAMOS[c], open = C.lvl <= lvl, t = C.tint, m = Math.max(t[0], t[1], t[2], 1); return '<button class="chip sw' + (rec.camo === c ? ' on' : '') + (open ? '' : ' locked') + '" data-ar="camo:' + c + '"' + (open ? '' : ' disabled') + '><i style="background:rgb(' + t.map(v => Math.round(40 + v / m * 190)).join(',') + ')"></i>' + C.name + (open ? '' : '<small>mastery ' + C.lvl + '</small>') + '</button>'; }).join('') + '</div></div></div></div></div>';
};
Armory.gearHTML = function () {
    const sv = Save.data, r = Save.rank().index, kit = Armory.kit();
    const row = (set, cur, key) => Object.keys(set).map(id => { const x = set[id], own = !!sv.own[id], lock = r < x.rank;
        return '<button class="tile big' + (cur === id ? ' sel' : '') + (own ? '' : ' locked') + '" data-ar="' + (own ? key : 'gbuy') + ':' + id + '"' + (!own && (lock || (sv.credits || 0) < x.cost) ? ' disabled' : '') + '><b>' + x.name + '</b><small>' + esc(x.desc) + '</small><span class="lock' + (own ? ' own' : '') + '">' + (cur === id ? 'IN YOUR KIT' : own ? 'OWNED' : lock ? 'RANK ' + (x.rank + 1) : x.cost + ' CR') + '</span></button>'; }).join('');
    return '<div class="h3">Throwable &middot; G in the field</div><div class="tiles wide">' + row(THROWS, kit.throw, 'throw') + '</div><div class="h3" style="margin-top:18px">Trait &middot; one, always on (not in deathmatch)</div><div class="tiles wide">' + row(TRAITS, kit.trait, 'trait') + '</div>' +
        '<p style="color:var(--dim);font-size:12.5px;margin-top:14px">Your kit: ' + WEAPONS[kit.primary].name + (kit.sidearm ? ', ' + WEAPONS[kit.sidearm].name : '') + ', ' + THROWS[kit.throw].name + ', ' + TRAITS[kit.trait].name + '.</p>';
};
Armory.jobsHTML = function () {
    const sv = Save.data, s = sv.stats, best = Object.keys(s.best).reduce((m, k) => Math.max(m, s.best[k]), 0), stars = Object.keys(sv.ops).reduce((m, k) => m + (sv.ops[k] || 0), 0);
    return '<div class="h3">Today&rsquo;s contracts &middot; three new ones every day</div>' + Armory.contracts().map((c, i) => { const J = JOBS[c.job], done = c.have >= J[1];
        return '<div class="job' + (c.paid ? ' paid' : '') + '"><div><b>' + esc(J[3]) + '</b><div class="xp"><i style="width:' + (clamp(c.have / J[1], 0, 1) * 100).toFixed(0) + '%"></i></div><small>' + Math.min(c.have, J[1]) + ' / ' + J[1] + '</small></div><button class="btn' + (done && !c.paid ? ' go' : '') + '" data-ar="claim:' + i + '"' + (done && !c.paid ? '' : ' disabled') + '>' + (c.paid ? 'PAID' : J[2] + ' CR') + '</button></div>'; }).join('') +
        '<div class="h3" style="margin-top:20px">Service record</div><div class="grid rec">' + [['kills', s.kills], ['headshots', s.heads], ['best wave', best], ['runs', s.games], ['operation stars', stars], ['matches won', s.mpWins], ['hours', (s.time / 3600).toFixed(1)]].map(x => '<div><b>' + x[1] + '</b><small>' + x[0] + '</small></div>').join('') + '</div>' + Extras.jobsHTML();
};
Armory.click = function (key) {
    const sv = Save.data, i = key.indexOf(':'), k = key.slice(0, i), id = key.slice(i + 1), deny = () => { Snd.ui('deny'); }, pay = c => { if ((sv.credits || 0) < c) { deny(); return false; } sv.credits -= c; Snd.ui('buy'); return true; };
    if (k === 'tab') { Armory.tab = id; Snd.ui('click'); }
    else if (k === 'sel') { Armory.sel = id; Snd.ui('click'); }
    else if (k === 'buy') { const w = WEAPONS[id]; if (!w || Armory.owns(id) || Save.rank().index < w.rank || !pay(Armory.price(id))) return; sv.weapons[id] = { lvl: 0 }; if (w.slot === 2) sv.loadout.secondary = id; else sv.loadout.primary = id; Snd.tone(440, 0.2, 0.5, 'triangle', 880); }
    else if (k === 'take') { const w = WEAPONS[id]; if (!w || !Armory.owns(id)) return; if (w.slot === 2) sv.loadout.secondary = id; else sv.loadout.primary = id; Snd.ui('buy'); }
    else if (k === 'att') { const w = Armory.sel, r = Armory.rec(w), at = r.att.indexOf(id); if (at >= 0) r.att.splice(at, 1); else { r.att = Armory.atts(w); while (r.att.length >= Armory.slots(w)) r.att.shift(); r.att.push(id); } Snd.ui('click'); }
    else if (k === 'camo') { Armory.rec(Armory.sel).camo = id; if (Gun.models[Armory.sel]) Armory.paint(Gun.models[Armory.sel]); Snd.ui('click'); }
    else if (k === 'gbuy') { const x = THROWS[id] || TRAITS[id]; if (!x || sv.own[id] || !pay(x.cost)) return; sv.own[id] = 1; if (THROWS[id]) sv.loadout.throw = id; else sv.perk = id; }
    else if (k === 'throw') { if (!sv.own[id]) return; sv.loadout.throw = id; Snd.ui('click'); }
    else if (k === 'trait') { if (!sv.own[id]) return; sv.perk = id; Snd.ui('click'); }
    else if (k === 'claim') { if (!Armory.claim(+id)) return; }
    else if (k === 'wclaim' || k === 'prestige') { if (!Extras.click(k, id)) return; }
    Save.store(); UI.draw(); UI.card();
};
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button[data-ar]'); if (b && !b.disabled) { Snd.init(); Armory.click(b.dataset.ar); } });

// ---- the weapon on the armory page: the real model (without the arms), turning slowly, drawn on the game's own picture
// and copied into the page's small one before the menu's background is drawn over it
Armory.render = function (dt) {
    const id = WEAPONS[Armory.sel] ? Armory.sel : 'carbine', view = $('arm-view'); if (!view || !World.loaded || !World.gunScene || Armory.tab !== 'guns') return;
    let M = Gun.models[id];
    if (!M) { if (!Armory.loading && Weapons.made(id)) { Armory.loading = id; Gun.load(id).then(() => { Armory.loading = ''; for (const k of Object.keys(Gun.models)) if (k !== Armory.sel && !App.game) Gun.drop(k); }, () => { Armory.loading = ''; }); } const g = view.getContext('2d'); g.clearRect(0, 0, view.width, view.height); return; }
    Armory.t += dt;
    // where the gun is in its own space: the box round the gun's points (once per model)
    let B = Armory.box[id];
    if (!B) { let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], any = false; for (const m of M.node.children) { const p = m.name !== 'vm_arms' && m.geometry && m.geometry.attributes && m.geometry.attributes.position; if (!p) continue; const a = p.array; for (let i = 0; i < a.length; i += 3) for (let k = 0; k < 3; k++) { if (a[i + k] < lo[k]) lo[k] = a[i + k]; if (a[i + k] > hi[k]) hi[k] = a[i + k]; } any = true; }
        if (!any) { const mz = M.I.muzzle; lo = [-0.05, mz[1] - 0.15, mz[2]]; hi = [0.05, mz[1] + 0.08, mz[2] + 0.5]; }
        B = Armory.box[id] = { c: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], len: Math.max(0.25, hi[2] - lo[2]), tall: hi[1] - lo[1] }; }
    const S = Gun.scale, yaw = Math.PI / 2 + Math.sin(Armory.t * 0.45) * 0.55, cy = Math.cos(yaw), sy = Math.sin(yaw), cx = B.c[0] * S, cz = B.c[2] * S, D = Math.max(0.42, B.len * S * 0.98, B.tall * S * 2.6), q = quatEuler(0, yaw, 0);
    M4.compose(Armory.M, -(cx * cy + cz * sy), -B.c[1] * S + Math.sin(Armory.t * 0.9) * 0.004, -D - (-cx * sy + cz * cy), q[0], q[1], q[2], q[3], S, S, S);
    const J = World.A.json, cam = World.gunCam; if (cam.fov !== 50) { cam.fov = 50; cam.updateProjection(); }
    World.gunRig.set([0.35, 0.75, 0.55], J.sun ? J.sun.color : null); World.gunRig.up(0, 1, 0);
    World.A.probe(World.home[0], World.home[1], Armory.light); for (let k = 0; k < 3; k++) Armory.light[k] *= 1.6;
    for (const k in Gun.models) Gun.models[k].node.visible = k === id; for (const m of M.node.children) m.visible = m.name !== 'vm_arms'; World.flash.visible = false;
    const fr = M.A.frame(M.clips.vm_idle, 0); M.vm.begin(); M.vm.add(0, 0, 0, 0, 1, fr, Armory.light, 0, 0, fr, 0); M.vm.end(); HG3D.place(M.node, Armory.M);
    draw(World.gunScene, cam, true);
    for (const m of M.node.children) m.visible = true; M.node.visible = false;
    // the middle of the game's picture, in the shape of the small one
    const g = view.getContext('2d'), sh = canvas.height * 0.62, sw = Math.min(canvas.width, sh * view.width / view.height); g.clearRect(0, 0, view.width, view.height);
    try { g.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, view.width, view.height); } catch (e) { }
};

// ---- throwables in a run
// the fuse ran out (or the mine was stepped on): what it does there
Armory.burst = function (G, kind, x, z) {
    const P = G.P, k = G.blastK || 1;
    if (kind === 'fire') { G.fires.push({ x, z, t: 7, r: 4 * k, tick: 0 }); World.boom(x, 0.3, z, false); Snd.noise(0.5, 1800, 300, 0.8); }
    else if (kind === 'shock') { World.sparks.add(x, 0.6, z, 0, 0, 0, 2, 26, 0.3, 0.6, 0.8, 1.6, 1); Snd.tone(1800, 0.3, 0.5, 'sawtooth', 90); Snd.noise(0.4, 6000, 1500, 0.25, 2500); G.shake(0.5, x, z);
        for (const e of Foes.list) { if (e.state === 'die') continue; if (Math.hypot(e.x - x, e.z - z) < 8 * k) { e.slow = e.T.boss ? 1.5 : 5; e.flash = 1; Armory.hurt(G, e, 30 * P.dmgK); } } }
    else Game.explode(x, 0.3, z, (kind === 'mine' ? 5 : 5.5), (kind === 'mine' ? 520 : 380) * P.dmgK, true);
};
// damage with no hit mark and no sound (fire, shock): the host lands it, a guest tells the host
Armory.hurt = function (G, e, dmg) { if (G.net && !G.net.host) Net.hitFoe(e.id, dmg, false); else Foes.damage(e, dmg, false, G, 0, 1); };
Armory.step = function (dt, G) {
    if (!World.flames) { World.flames = makePuffs(World.scene, 70, World.glowTex, true); }
    for (let i = G.fires.length - 1; i >= 0; i--) { const f = G.fires[i]; f.t -= dt; f.tick -= dt; if (f.t <= 0) { G.fires.splice(i, 1); continue; }
        for (let n = 0; n < 2; n++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * f.r; World.flames.add(f.x + Math.cos(a) * d, 0.1, f.z + Math.sin(a) * d, 0, rand(0.8, 1.9), 0, rand(0.5, 0.9), -0.5, rand(0.4, 0.7), 1.6, 0.8, 0.3, Math.min(1, f.t), 0); }
        if (Math.random() < dt * 5) { const a = Math.random() * 6.28, d = Math.random() * f.r; World.smoke.add(f.x + Math.cos(a) * d, 1.2, f.z + Math.sin(a) * d, 0, 0.9, 0, 0.7, 0.9, 1.4, 0.2, 0.2, 0.2, 0.5); }
        if (f.tick <= 0) { f.tick = 0.25; for (const e of Foes.list) if (e.state !== 'die' && Math.hypot(e.x - f.x, e.z - f.z) < f.r + 0.3 * e.size) Armory.hurt(G, e, 24 * G.P.dmgK); const P = G.P; if (!P.dead && Math.hypot(P.x - f.x, P.z - f.z) < f.r * 0.8) G.hurt(0, 3, f.x, f.z, null); } }
    // a mine goes off under the first ashen to come within two metres (a second after it was set)
    for (let i = G.pickups.length - 1; i >= 0; i--) { const p = G.pickups[i]; if (p.kind !== 'mine' || p.t < 1) continue; for (const e of Foes.list) if (e.state !== 'die' && e.born <= 0 && Math.hypot(e.x - p.x, e.z - p.z) < 2) { G.pickups.splice(i, 1); Armory.burst(G, 'mine', p.x, p.z); break; } }
};
// G was pressed
Armory.use = function (G, P) {
    const kind = G.throwKind, d = G.dir;
    if (kind === 'c4') { const live = G.thrown.filter(g => g.kind === 'c4'); if (live.length) { for (const g of live) { G.thrown.splice(G.thrown.indexOf(g), 1); Game.explode(g.x, 0.3, g.z, 7, 760 * P.dmgK, true); } return; } if (G.nades <= 0) return; G.nades--; G.thrown.push({ kind, x: P.x + d[0] * 0.5, y: World.eye - 0.2, z: P.z + d[2] * 0.5, vx: d[0] * 8, vy: d[1] * 8 + 2.5, vz: d[2] * 8, t: -1e6 }); Snd.noise(0.15, 1200, 400, 0.15, 300); HUD.feed('<b>CHARGE SET</b> press G again to fire it'); return; }
    if (G.nades <= 0) return; G.nades--;
    if (kind === 'stim') { P.hp = Math.min(P.max, P.hp + 60); P.stim = 5; Game.stats(); HUD.callout('STIM'); Snd.tone(500, 0.2, 0.3, 'triangle', 1000); return; }
    if (kind === 'turret') { Extras.turret(G, P.x + d[0] * 1.3, P.z + d[2] * 1.3, 30); return; }
    if (kind === 'mine') { G.pickups.push({ kind: 'mine', x: P.x + d[0] * 0.6, z: P.z + d[2] * 0.6, t: 0 }); Snd.tone(900, 0.08, 0.06, 'square', 600); Snd.noise(0.12, 1500, 500, 0.08); HUD.feed('<b>MINE SET</b>'); return; }
    G.thrown.push({ kind, x: P.x + d[0] * 0.5, y: World.eye - 0.1, z: P.z + d[2] * 0.5, vx: d[0] * 13, vy: d[1] * 13 + 4, vz: d[2] * 13, t: kind === 'frag' ? 0 : 0.8 }); Snd.noise(0.15, 1500, 400, 0.15, 300);
};
// what the kit's trait changes at the start of a run (not in deathmatch)
Armory.begin = function (G, P, kit) {
    G.throwKind = kit.throw; G.nades = THROWS[kit.throw].n; G.fires = []; G.blastK = 1; G.dropK = 1; G.cdK = 1; G.wind = false; G.trait = G.mode === 'dm' ? 'none' : kit.trait;
    const t = G.trait; if (t === 'plates') P.armor += 50; else if (t === 'stash') G.cash += 600; else if (t === 'demo') { G.nades += 2; G.blastK = 1.25; } else if (t === 'wind') G.wind = true; else if (t === 'scav') { G.dropK = 2; for (const id in Gun.state) Gun.state[id].reserve = Math.round(Gun.state[id].reserve * 1.25); } else if (t === 'cool') G.cdK = 0.7;
};
