// ---------- 4.0 CHALLENGES ----------
// 3 daily and 3 weekly challenges, picked from the pool below by the date (so they rotate by themselves: daily ones at
// midnight, weekly ones on Monday), tracked across runs and saved in this browser. Finishing one pays its XP straight
// away and its cash into the run you're in (if you're not in one, it's banked and paid at the start of your next run).
// They count in solo and co-op runs, not in Sandbox or PvP.
const CH_KEY = 'huntington.blockyshooter.challenges.v1';
const CH_EXPLOSIVE = new Set(['explosive', 'rpg', 'glauncher', 'grenade', 'c4', 'landmine', 'airstrike', 'nuke', 'boom', 'launcher']);
const CH_PLAIN = new Set(['grunt', 'sprinter', 'mite', 'risen', 'phclone', 'egg']);         // everything else is a "special" zombie
const CH_DIFF = { easy: 0, normal: 1, hard: 2, nightmare: 3 };
const chW = (id) => weaponsDb[id] ? weaponsDb[id].name : id;
// d / w: the target as a daily / weekly. r: how hard it is (sets the reward). arg: what it's about. best: your best single
// result counts (not a running total).
const CHALLENGES = {
    kills:      { d: 300, w: 2000, r: 1, text: (n) => `Kill ${n} zombies` },
    heads:      { d: 60, w: 400, r: 2, text: (n) => `Get ${n} headshot kills` },
    weapon:     { d: 75, w: 400, r: 2, arg: 'weapon', text: (n, a) => `Get ${n} kills with the ${chW(a)}` },
    boss:       { d: 1, w: 6, r: 2, text: (n) => n > 1 ? `Defeat ${n} bosses` : 'Defeat a boss' },
    bossWith:   { d: 1, w: 2, r: 3, arg: 'bossWeapon', weeklyOnly: true, text: (n, a) => `Kill ${n > 1 ? n + ' bosses' : 'a boss'} with the ${chW(a)}` },
    wave:       { d: 10, w: 15, r: 3, arg: 'diff', best: true, text: (n, a) => `Clear wave ${n} on ${DIFFICULTIES[a].name} or harder` },
    waves:      { d: 25, w: 120, r: 1, text: (n) => `Clear ${n} waves` },
    mapWaves:   { d: 8, w: 40, r: 2, arg: 'map', text: (n, a) => `Clear ${n} waves on ${MAPS[a].name}` },
    classKills: { d: 150, w: 800, r: 1, arg: 'cls', text: (n, a) => `Get ${n} kills as ${CLASSES[a].name}` },
    ability:    { d: 10, w: 50, r: 1, text: (n) => `Use your class ability ${n} times` },
    explosive:  { d: 50, w: 300, r: 2, text: (n) => `Get ${n} kills with explosives` },
    melee:      { d: 30, w: 150, r: 2, text: (n) => `Get ${n} melee kills (Katana or V shove)` },
    special:    { d: 50, w: 300, r: 2, text: (n) => `Kill ${n} special zombies (not Walkers or Runners)` },
    combo:      { d: 15, w: 30, r: 2, best: true, text: (n) => `Reach a x${n} kill combo` },
    airstrike:  { d: 2, w: 12, r: 2, text: (n) => `Call in ${n} airstrikes` },
    untouched:  { d: 1, w: 4, r: 3, text: (n) => `Clear ${n > 1 ? n + ' waves' : 'a wave'} from wave 8 on without losing health` }
};
const chText = (c) => CHALLENGES[c.t].text(c.n, c.a);
// local calendar day number (days since 1 Jan 1970) and week number (weeks start on Monday)
const chDay = () => { const d = new Date(); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const chWeekOf = (day) => Math.floor((day - 4) / 7);           // day 4 (5 Jan 1970) was a Monday
function chTimeLeft(weekly) {
    const now = new Date(), dow = ((chDay() - 4) % 7 + 7) % 7;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (weekly ? 7 - dow : 1));
    const m = Math.max(0, Math.floor((end - now) / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
    return d ? `${d}d ${h}h` : `${h}h ${m % 60}m`;
}
let chState = null, waveHurt = false;
function chValid(c) {
    const T = c && CHALLENGES[c.t];
    if (!T || !(c.n > 0)) return false;
    if (T.arg === 'weapon' || T.arg === 'bossWeapon') return !!weaponsDb[c.a];
    if (T.arg === 'map') return !!MAPS[c.a];
    if (T.arg === 'cls') return !!CLASSES[c.a];
    if (T.arg === 'diff') return CH_DIFF[c.a] !== undefined;
    return true;
}
function chMake(t, weekly, rng) {
    const T = CHALLENGES[t], pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
    let a = null;
    if (T.arg === 'weapon') a = pick(WEAPON_ORDER.filter(id => id !== 'pistol' && isUnlocked('weapon', id)));
    else if (T.arg === 'bossWeapon') { const l = ['katana', 'shotgun', 'sniper', 'rpg', 'railgun', 'revolver', 'crossbow'].filter(id => isUnlocked('weapon', id)); a = pick(l.includes('katana') && rng() < 0.4 ? ['katana'] : l); }
    else if (T.arg === 'map') a = pick(Object.keys(MAPS));
    else if (T.arg === 'cls') a = pick(CLASS_ORDER);
    else if (T.arg === 'diff') a = weekly ? 'hard' : 'normal';
    return { t, a, n: weekly ? T.w : T.d, p: 0, done: false, xp: weekly ? 1500 + 1000 * T.r : 300 + 200 * T.r, cash: weekly ? 1000 + 750 * T.r : 250 + 250 * T.r };
}
// the same date always gives the same three (a seeded shuffle of the pool)
function chPick(seed, weekly) {
    const rng = mulberry32(seed), keys = Object.keys(CHALLENGES).filter(k => weekly || !CHALLENGES[k].weeklyOnly);
    for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [keys[i], keys[j]] = [keys[j], keys[i]]; }
    return keys.slice(0, 3).map(t => chMake(t, weekly, rng));
}
function chSave() { if (chState) saveJSON(CH_KEY, chState); }
// new day / new week: roll new challenges (old progress on them is dropped - that's the point of them)
function chRoll() {
    const d = chDay(), w = chWeekOf(d);
    let changed = false;
    if (chState.day !== d) { chState.day = d; chState.daily = chPick(d * 7919 + 101, false); changed = true; }
    if (chState.week !== w) { chState.week = w; chState.weekly = chPick(w * 104729 + 7, true); changed = true; }
    if (changed) chSave();
}
function chLoad() {
    const s = loadJSON(CH_KEY, null);
    chState = Object.assign({ v: 1, day: -1, week: -1, daily: [], weekly: [], bank: 0, doneD: 0, doneW: 0 }, s && typeof s === 'object' ? s : {});
    for (const [k, when] of [['daily', 'day'], ['weekly', 'week']]) if (!Array.isArray(chState[k]) || chState[k].length !== 3 || !chState[k].every(chValid)) { chState[k] = []; chState[when] = -1; }
    for (const k of ['bank', 'doneD', 'doneW']) chState[k] = Math.max(0, chState[k] | 0);
    chRoll();
}
const chOn = () => !!chState && !NET.pvp && run.mode !== 'sandbox';
// progress on every active challenge of type t: adds `amount` (or, for "best" ones, keeps the best). `a` must match the
// challenge's weapon / map / class; for "clear wave N on <difficulty>" it's the difficulty played (that one or harder counts).
function chAdd(t, amount, a) {
    if (!chOn()) return;
    for (let k = 0; k < 2; k++) {
        const list = k ? chState.weekly : chState.daily;
        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            if (c.done || c.t !== t) continue;
            if (c.a !== null && c.a !== undefined && (t === 'wave' ? (CH_DIFF[a] ?? -1) < CH_DIFF[c.a] : a !== c.a)) continue;
            c.p = CHALLENGES[t].best ? Math.max(c.p, amount) : c.p + amount;
            if (c.p >= c.n) chComplete(c, k === 1);
        }
    }
}
function chComplete(c, weekly) {
    c.done = true; c.p = c.n;
    if (weekly) chState.doneW++; else chState.doneD++;
    const inRun = (currentGameState === 'playing' || currentGameState === 'paused' || currentGameState === 'shop') && run.mode !== 'sandbox' && !NET.pvp;
    if (inRun) playerStats.money += c.cash; else chState.bank += c.cash;
    gainXP(c.xp, true);
    chSave();
    const tag = weekly ? 'WEEKLY' : 'DAILY';
    toast(`${tag} CHALLENGE COMPLETE!  +${c.xp} XP  +$${c.cash}`, '#c4b5fd', 3);
    showIntel(`<div class="text-sm font-black hud-text" style="color:#c4b5fd">${tag} CHALLENGE COMPLETE</div><div class="text-xs text-gray-100">${chText(c)}</div><div class="text-xs font-bold text-green-300">+${c.xp} XP · +$${c.cash}${inRun ? '' : ' (paid at the start of your next run)'}</div>`, 6);
    sfx('upgrade');
    updateHUD();
}
// a kill you got (called from awardKill)
function chKill(cfg, headshot, src) {
    if (!chOn()) return;
    chAdd('kills', 1);
    if (headshot) chAdd('heads', 1);
    chAdd('weapon', 1, src);
    if (cfg.boss) { chAdd('boss', 1); chAdd('bossWith', 1, src); }
    const cl = myClass(); if (cl) chAdd('classKills', 1, cl);
    if (CH_EXPLOSIVE.has(src)) chAdd('explosive', 1);
    if (src === 'melee' || src === 'katana') chAdd('melee', 1);
    if (!cfg.boss && !CH_PLAIN.has(cfg.id)) chAdd('special', 1);
    chAdd('combo', combo);
}
// a wave you were in got cleared (solo, co-op host and co-op guests)
function chWave(cleared) {
    if (!chOn()) return;
    chAdd('waves', 1); chAdd('mapWaves', 1, run.map); chAdd('wave', cleared, run.diff);
    if (cleared >= 8 && !waveHurt) chAdd('untouched', 1);
    chSave();
}
// cash you earned from challenges while you weren't in a run, plus the prestige bonus: paid when a new run starts
function runStartBonus(fresh) {
    if (run.mode === 'sandbox') return;
    const lines = [];
    if (fresh && prestigeLvl() > 0) { playerStats.money += 100 * prestigeLvl(); lines.push(`PRESTIGE ${prestigeLvl()} BONUS +$${100 * prestigeLvl()}`); }
    if (chState && chState.bank > 0) { playerStats.money += chState.bank; lines.push(`CHALLENGE REWARDS +$${chState.bank}`); chState.bank = 0; chSave(); }
    if (lines.length) showIntel(lines.map(l => `<div class="text-sm font-black hud-text text-green-300">${l}</div>`).join(''), 5);
}
// the challenge list for the menu tab and the pause menu
function chCard(c, weekly) {
    const T = CHALLENGES[c.t], pct = Math.min(100, c.p / c.n * 100), col = weekly ? '#f472b6' : '#a78bfa';
    return `<div class="bcard items-center" style="padding:8px 12px${c.done ? ';border-color:rgba(74,222,128,0.55)' : ''}"><div class="flex-1" style="min-width:0">
        <div class="flex justify-between items-baseline gap-2"><div class="font-black text-sm ${c.done ? 'text-green-300' : 'text-white'}">${c.done ? '✓ ' : ''}${chText(c)}</div><div class="text-xs font-bold text-gray-400 whitespace-nowrap">${T.best && !c.done ? 'BEST ' : ''}${Math.min(c.p, c.n)} / ${c.n}</div></div>
        <div class="bg-black/50 rounded overflow-hidden" style="height:7px;margin-top:5px"><div class="h-full" style="width:${pct}%;background:${c.done ? '#4ade80' : col}"></div></div>
        <div class="text-[11px] font-bold ${c.done ? 'text-green-300' : 'text-amber-300'}" style="margin-top:3px">${c.done ? 'COMPLETE - ' : 'REWARD '}+${c.xp} XP · +$${c.cash}</div></div></div>`;
}
function chPanel() {
    chRoll();
    const head = (label, col, weekly) => `<div class="mlabel flex justify-between"><span style="color:${col}">${label}</span><span class="text-gray-400">NEW ONES IN ${chTimeLeft(weekly)}</span></div>`;
    let h = `<div class="mdesc">Challenges carry over from run to run. Finish one to get its XP right away and its cash in the run you're playing. They count in solo and co-op runs (not Sandbox or PvP).</div>`;
    h += head('DAILY CHALLENGES', '#c4b5fd', false) + `<div class="flex flex-col gap-2">${chState.daily.map(c => chCard(c, false)).join('')}</div>`;
    h += head('WEEKLY CHALLENGES', '#f9a8d4', true) + `<div class="flex flex-col gap-2">${chState.weekly.map(c => chCard(c, true)).join('')}</div>`;
    if (chState.bank > 0) h += `<div class="mdesc text-green-300" style="font-weight:800">$${chState.bank} in challenge rewards will be added to your next run.</div>`;
    h += `<div class="mdesc">Completed so far: ${chState.doneD} daily, ${chState.doneW} weekly.</div>`;
    return h;
}
function chPauseList() {
    if (!chOn()) return '';
    chRoll();
    const row = (c, weekly) => `<div class="flex justify-between gap-3 text-xs font-bold" style="padding:2px 0"><span class="${c.done ? 'text-green-300' : 'text-gray-200'}">${c.done ? '✓' : '•'} ${chText(c)}</span><span class="${c.done ? 'text-green-300' : 'text-gray-400'} whitespace-nowrap">${c.done ? 'DONE' : `${c.p} / ${c.n}`}</span></div>`;
    return `<div class="text-[10px] font-black tracking-widest text-gray-400" style="margin-bottom:3px">CHALLENGES</div>` + chState.daily.map(c => row(c, false)).join('') + chState.weekly.map(c => row(c, true)).join('');
}
chLoad();
window.addEventListener('pagehide', chSave);


// Permadeath: wipe everything. A new arena is generated on the next run.
function resetRun() {
    waveActive = false; intermission = 0; savedWave = -1;
    playerStats = JSON.parse(JSON.stringify(defaultStats));
    playerStats.cls = validClass(settings.cls);             // 4.0: the class picked on the Play tab (or in the multiplayer menu)
    abilityCd = 0; abilityT = 0; abilReadyWas = true;
    resetAmmo();
    maxHp = 100; currentHp = maxHp; lastHurtBy = ''; currentArmor = 0; secondaryCooldown = 0; activeC4 = null; combo = 0; comboTimer = 0; lastHurtT = -99;
    streak = 0; strikeCharges = 0; meleeCd = 0;
    lungeT = 0; lungeCd = 0; slashAt = -1; vm.slashT = 0; vm.lungeK = 0; if (railC > 0) railCancel();      // 4.0 weapons
    enemies.forEach(e => { scene.remove(e); disposeEnemy(e); }); enemies = [];
    corpses.forEach(c => { scene.remove(c.e); disposeEnemy(c.e); }); corpses = [];
    projectiles.forEach(p => scene.remove(p.mesh)); projectiles = [];
    pickups.forEach(p => scene.remove(p.mesh)); pickups = [];
    [...supplies].forEach(removeSupply); supplyTimer = -1; power = null;
    [...orbs].forEach(removeOrb); boosts = {}; overshield = 0; boomQ.length = 0; turretCd = 0;
    clearGadgets();
    seenTypes = new Set(); resetCampState();
    cancelReload();
    needsNewWorld = true;
}
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Start a brand-new run with whatever is selected in the menu
function startRun() {
    if (currentGameState === 'playing' || currentGameState === 'paused') commitLife();
    else if (loadRunSave()) commitSavedRun();       // starting over throws the saved run away (its stats still count)
    clearRunSave();
    resetRun();
    changeGameState('playing');
}
