// ---------- 5.4 CLASS PROGRESS: permanent class levels, skill trees, specialisations, mastery ----------
// Saved inside 'blocky21_life' (so the launcher's cloud sync carries it) next to the 4.0 per-class stats:
//   life.cls[k] = { runs, kills, best,            <- 4.0 stats, unchanged
//                   xp, tree: { nodeId: rank }, spec: ['', ''] }   <- 5.4 progress
//   life.clsV = 1 (migration done), life.clsTotal = sum of every class level (a leaderboard number)
// You level a class by playing it: it gets the same XP your rank gets (kills, waves, objectives, challenges) in every
// mode, plus a bonus for each multiplayer match. Skill points (1 per level) are spent out of game only (CLASSES screen).
// PvP / tournaments: everyone plays the class at the level-1 baseline (ability + passive): trees and specialisations are off.
var CLS_BOOT = false;                       // W() asks for class stats while the file above is still loading
const CLS_MAX_LV = 30;
const CLS_ROW_LV = [1, 4, 8, 13, 18];       // level needed for each row of the tree
const CLS_SPEC_LV = [10, 20];               // the two specialisation choices
const clsNeed = (l) => 400 + 150 * l;       // class XP to go from level l to l+1
const CLS_XP_AT = [0, 0];                   // CLS_XP_AT[l] = total class XP to reach level l
for (let l = 2; l <= CLS_MAX_LV; l++) CLS_XP_AT[l] = CLS_XP_AT[l - 1] + clsNeed(l - 1);
function clsLvOf(xp) { let l = 1; while (l < CLS_MAX_LV && xp >= CLS_XP_AT[l + 1]) l++; return l; }
// caps on what a whole tree can add (PvE only): a maxed class ends up roughly 20-30% stronger than a fresh one
const CLS_CAP = { cd: 0.25, dur: 0.3, pow: 0.3, dmg: 0.1, hs: 0.15, hp: 30, spd: 0.08, rel: 0.12, armor: 0.1, cash: 0.15, start: 300, expl: 0.25,
                  killHeal: 3, killCd: 1, regen: 1, pas: 1, disc: 0.1, markN: 2, bomb: 2, shove: 5, abilHeal: 30, crateN: 1, fieldArm: 4, markDmg: 0.05,
                  topUp: 1, range: 1, lowHp: 1, regenFast: 1, hsKillCd: 1 };
function clsZero() { const o = { sp: {} }; for (const k in CLS_CAP) o[k] = 0; return o; }
const CN = (id, name, max, fx, desc) => ({ id, b: id[0] === 'a' ? 0 : id[0] === 'p' ? 1 : 2, r: +id[1] - 1, name, max, fx, desc });
const CLS_BRANCHES = ['ABILITY', 'CLASS', 'UTILITY'];
// the UTILITY branch is the same for every class (small, capped, mostly convenience)
const CLS_UTIL = [CN('u1', 'TOUGH', 3, { hp: 10 }, '+10 max health per rank.'), CN('u2', 'QUICK HANDS', 3, { rel: 0.04 }, '4% faster reloads per rank.'),
                  CN('u3', 'FLEET', 2, { spd: 0.03 }, '+3% move speed per rank.'), CN('u4', 'SCAVENGER', 3, { cash: 0.05 }, '+5% cash from kills per rank.'),
                  CN('u5', 'WAR CHEST', 2, { start: 150 }, 'Start every run with +$150 per rank.')];
const cdN = () => CN('a1', 'QUICK RECOVERY', 3, { cd: 0.06 }, 'Ability cooldown 6% shorter per rank.');
const durN = (what) => CN('a4', 'LONGER LASTING', 2, { dur: 0.1 }, `${what} lasts 10% longer per rank.`);
const topN = () => CN('a5', 'REARM', 1, { topUp: 1 }, 'Using your ability also recharges your secondary gadget.');
const dmgN = (id) => CN(id, 'FIREPOWER', 2, { dmg: 0.03 }, '+3% damage from everything you fire, per rank.');
const CLASS_TREES = {
    assault: { tree: [cdN(), CN('a2', 'OVERDRIVE', 3, { pow: 0.1 }, 'Adrenaline damage and speed boosts 10% stronger per rank.'),
                      CN('a3', 'TOP UP', 1, { topUp: 1 }, 'Adrenaline also recharges your secondary gadget.'), durN('Adrenaline'),
                      CN('a5', 'SHOCKWAVE', 1, { shove: 5 }, 'Adrenaline throws back every zombie within 5m.'),
                      CN('p1', 'KILL RUSH', 2, { killCd: 0.5 }, 'Kills take another 0.5s off the cooldown per rank.'), CN('p2', 'FIREPOWER', 3, { dmg: 0.03 }, '+3% damage per rank.'),
                      CN('p3', 'FLAK VEST', 2, { armor: 0.04 }, 'Take 4% less damage per rank.'), CN('p4', 'STEADY AIM', 1, { hs: 0.05 }, '+5% headshot damage.'),
                      CN('p5', 'BLOODLUST', 1, { killHeal: 2 }, 'Every kill heals 2 HP.')],
               specs: [[{ id: 'berserk', name: 'BERSERKER', desc: 'Adrenaline gives +50% damage (not 25%) and you fire 20% faster.' },
                        { id: 'wind', name: 'SECOND WIND', desc: 'Adrenaline heals 30 HP at once and lasts 2 seconds longer.' }],
                       [{ id: 'unstop', name: 'UNSTOPPABLE', desc: 'Take 40% less damage while Adrenaline is on.' },
                        { id: 'chain', name: 'CHAIN RUSH', desc: 'Each kill during Adrenaline adds 0.5s to it (up to +4s).' }]] },
    medic: { tree: [cdN(), CN('a2', 'POTENT FIELD', 3, { pow: 0.1 }, 'The field heals 10% more per rank.'),
                    CN('a3', 'CLEANSE', 1, { abilHeal: 20 }, 'Dropping a field heals you 20 HP at once.'), durN('The field'),
                    CN('a5', 'ARMOR WEAVE', 1, { fieldArm: 4 }, 'The field also repairs armor, 4 per second.'),
                    CN('p1', 'VITAL SIGNS', 2, { regen: 0.5 }, 'Passive regeneration +0.5 HP/s per rank.'), CN('p2', 'FIRST AID', 1, { killHeal: 1 }, 'Every kill heals 1 HP.'),
                    dmgN('p3'), CN('p4', 'RESILIENT', 2, { armor: 0.03 }, 'Take 3% less damage per rank.'),
                    CN('p5', 'QUICK RECOVERY', 1, { regenFast: 1 }, 'Passive regeneration starts after 1.5s instead of 3s.')],
             specs: [[{ id: 'wide', name: 'WIDE FIELD', desc: 'Field radius 6m to 9m, and it lasts 12 seconds.' },
                      { id: 'triage', name: 'TRIAGE', desc: 'A small 4.5m field that heals 16 HP/s for 6 seconds.' }],
                     [{ id: 'farmor', name: 'FIELD ARMOR', desc: 'Inside your field you take 15% less damage, and it repairs armor 6/s.' },
                      { id: 'lifeline', name: 'LIFELINE', desc: 'While your field is up, each of your kills heals you 6 HP.' }]] },
    engineer: { tree: [cdN(), CN('a2', 'CALIBRATED', 3, { pow: 0.1 }, 'The mini sentry does 10% more damage per rank.'),
                       CN('a3', 'BIG CRATE', 1, { crateN: 1 }, 'The ammo crate holds one more resupply.'), durN('The mini sentry'), topN(),
                       CN('p1', 'BARGAIN', 2, { disc: 0.05 }, 'Gadgets and sentry upgrades cost another 5% less per rank.'), dmgN('p2'),
                       CN('p3', 'REINFORCED', 2, { hp: 5 }, '+5 max health per rank.'), CN('p4', 'TINKERER', 2, { rel: 0.04 }, '4% faster reloads per rank.'),
                       CN('p5', 'SALVAGE', 1, { killCd: 0.3 }, 'Kills take 0.3s off the Field Kit cooldown.')],
                specs: [[{ id: 'hard', name: 'HARDENED', desc: 'The mini sentry gets +60% health and ammo and lasts 35 seconds.' },
                         { id: 'rocket', name: 'ROCKET SENTRY', desc: 'The mini sentry fires rockets too.' }],
                        [{ id: 'medkit', name: 'MEDKIT CRATE', desc: 'The crate holds 5 resupplies and each one also heals 20 HP.' },
                         { id: 'overclock', name: 'OVERCLOCK', desc: 'The mini sentry fires 35% faster.' }]] },
    recon: { tree: [cdN(), CN('a2', 'STRONG SIGNAL', 3, { pow: 0.1 }, 'Pulse range +10% per rank.'),
                    CN('a3', 'REARM', 1, { topUp: 1 }, 'The pulse also recharges your secondary gadget.'), durN('Pulse marking'),
                    CN('a5', 'EXPOSE', 1, { markDmg: 0.05 }, 'Marked zombies take +5% damage from you.'),
                    CN('p1', 'TRACKER', 2, { pas: 0.5 }, 'Your hits keep zombies marked 50% longer per rank.'), CN('p2', 'STEADY AIM', 2, { hs: 0.05 }, '+5% headshot damage per rank.'),
                    dmgN('p3'), CN('p4', 'LIGHT FEET', 2, { spd: 0.02 }, '+2% move speed per rank.'), CN('p5', 'PREDATOR', 1, { killHeal: 2 }, 'Every kill heals 2 HP.')],
             specs: [[{ id: 'band', name: 'WIDE BAND', desc: 'The pulse covers the whole map and marks last 9 seconds.' },
                      { id: 'weak', name: 'WEAK SPOT', desc: 'Marked zombies take +15% damage from you.' }],
                     [{ id: 'uplink', name: 'UPLINK', desc: 'Co-op teammates get your pulse marks too.' },
                      { id: 'bounty', name: 'BOUNTY', desc: 'Marked zombies drop 50% more cash when you kill them.' }]] },
    heavy: { tree: [cdN(), CN('a2', 'HEAVY SLAM', 3, { pow: 0.1 }, 'Slam damage +10% per rank.'),
                    CN('a3', 'WIDE SLAM', 1, { shove: 2 }, 'The slam reaches 2m further.'), durN('The damage cut'), topN(),
                    CN('p1', 'PLATING', 2, { pas: 0.5 }, 'The Armored passive is 50% stronger per rank (up to 20%).'), CN('p2', 'BIG FRAME', 3, { hp: 5 }, '+5 max health per rank.'),
                    dmgN('p3'), CN('p4', 'BRACED', 1, { armor: 0.03 }, 'Take 3% less damage.'),
                    CN('p5', 'UNBREAKABLE', 1, { lowHp: 1 }, 'The Armored passive works below half health too.')],
             specs: [[{ id: 'quake', name: 'AFTERSHOCK', desc: 'The slam hits twice as hard (and a second, smaller slam follows 1s later).' },
                      { id: 'iron', name: 'IRON WALL', desc: 'Bulwark cuts damage by 65% (not 50%), but the slam only pushes.' }],
                     [{ id: 'thorns', name: 'JUGGERNAUT', desc: 'During Bulwark, zombies that hit you take 25 damage back.' },
                      { id: 'skin', name: 'SECOND SKIN', desc: 'Bulwark restores 40 armor (or 25 HP if you have no armor).' }]] },
    demo: { tree: [cdN(), CN('a2', 'BIGGER BANG', 3, { pow: 0.1 }, 'The charge does 10% more damage per rank.'),
                   CN('a3', 'LONG ARM', 1, { range: 1 }, 'Throw the charge up to 45m.'), CN('a4', 'EXTRA BOMBLETS', 2, { bomb: 1 }, '+1 bomblet per rank.'), topN(),
                   CN('p1', 'BLAST EXPERT', 2, { expl: 0.05 }, 'Your explosions do another 5% more damage per rank.'), dmgN('p2'),
                   CN('p3', 'BLAST VEST', 2, { armor: 0.03 }, 'Take 3% less damage per rank.'), CN('p4', 'PADDED', 2, { hp: 5 }, '+5 max health per rank.'),
                   CN('p5', 'CHAIN REACTION', 1, { killCd: 0.5 }, 'Kills take 0.5s off the cooldown.')],
            specs: [[{ id: 'carpet', name: 'CARPET BOMB', desc: '8 bomblets instead of 4 (30 damage each).' },
                     { id: 'buster', name: 'BUNKER BUSTER', desc: 'One huge blast (240 damage, 8m) and no bomblets.' }],
                    [{ id: 'napalm', name: 'NAPALM', desc: 'The main blast leaves a fire behind for 6 seconds.' },
                     { id: 'fuse', name: 'QUICK FUSE', desc: 'Cooldown 30% shorter, blast 15% smaller.' }]] },
    marksman: { tree: [cdN(), CN('a2', 'LETHAL', 3, { pow: 0.1 }, 'Marked targets take 10% more of the bonus per rank.'),
                       CN('a3', 'WIDE SCOPE', 2, { markN: 1 }, 'Mark one more zombie per rank.'), durN('The mark'), topN(),
                       CN('p1', 'PRECISION', 2, { hs: 0.05 }, '+5% headshot damage per rank.'), dmgN('p2'),
                       CN('p3', 'STEADY', 2, { rel: 0.04 }, '4% faster reloads per rank.'), CN('p4', 'CAMO', 2, { armor: 0.03 }, 'Take 3% less damage per rank.'),
                       CN('p5', 'HEADHUNTER', 1, { hsKillCd: 1 }, 'Headshot kills take 4s off the cooldown (not 2s).')],
                specs: [[{ id: 'exec', name: 'EXECUTIONER', desc: 'Your hits finish marked zombies below 25% health (not 15%).' },
                         { id: 'spot', name: 'SPOTTER', desc: 'Mark up to 6 zombies at once, for +20% damage each.' }],
                        [{ id: 'chainm', name: 'CHAIN MARK', desc: 'Killing a marked zombie marks the nearest unmarked one within 15m.' },
                         { id: 'oneshot', name: 'ONE SHOT', desc: 'Your first hit on each marked zombie does double damage.' }]] },
    scout: { tree: [cdN(), CN('a2', 'SPRINTER', 3, { pow: 0.1 }, 'Dash 10% further per rank.'),
                    CN('a3', 'SHAKE OFF', 1, { abilHeal: 10 }, 'Dashing heals 10 HP.'), durN('The dash damage cut'),
                    CN('a5', 'SHOULDER CHARGE', 1, { shove: 3 }, 'Zombies within 3m of where you land are thrown back.'),
                    CN('p1', 'LIGHT STEP', 2, { spd: 0.02 }, '+2% move speed per rank.'), dmgN('p2'),
                    CN('p3', 'QUICK HANDS', 2, { rel: 0.04 }, '4% faster reloads per rank.'), CN('p4', 'STEADY AIM', 1, { hs: 0.05 }, '+5% headshot damage.'),
                    CN('p5', 'MOMENTUM', 1, { killHeal: 2 }, 'Every kill heals 2 HP.')],
             specs: [[{ id: 'long', name: 'LONG DASH', desc: 'Dash 14m (not 9m).' },
                      { id: 'twin', name: 'TWIN DASH', desc: 'Two dash charges: dash twice before the cooldown.' }],
                     [{ id: 'slip', name: 'SLIPSTREAM', desc: 'After a dash, +25% move speed for 3 seconds.' },
                      { id: 'ambush', name: 'AMBUSH', desc: 'Shots in the 2 seconds after a dash do +60% damage.' }]] }
};
for (const k of CLASS_ORDER) { CLASSES[k].tree = CLASS_TREES[k].tree.concat(CLS_UTIL); CLASSES[k].specs = CLASS_TREES[k].specs; CLASSES[k].node = {}; for (const n of CLASSES[k].tree) CLASSES[k].node[n.id] = n; }
const clsSpecOK = (k, t, id) => CLASSES[k].specs[t].some(s => s.id === id);
const clsSpecInfo = (k, id) => { for (const T of CLASSES[k].specs) for (const s of T) if (s.id === id) return s; return null; };

// ---------- progress (life.cls[k]) ----------
function clsP(k) {
    let c = life.cls[k];
    if (!c || typeof c !== 'object') c = life.cls[k] = { runs: 0, kills: 0, best: 0 };
    if (!Number.isFinite(c.xp) || c.xp < 0) c.xp = 0;
    if (!c.tree || typeof c.tree !== 'object' || Array.isArray(c.tree)) c.tree = {};
    if (!Array.isArray(c.spec)) c.spec = ['', ''];
    return c;
}
const clsLvl = (k) => CLASSES[k] ? clsLvOf(clsP(k).xp) : 1;
const clsSpent = (k) => { const t = clsP(k).tree; let n = 0; for (const id in t) n += t[id] | 0; return n; };
const clsPts = (k) => clsLvl(k) - 1 - clsSpent(k);
const clsTotal = () => CLASS_ORDER.reduce((a, k) => a + clsLvl(k), 0);
// can node id be bought now? (level gate for its row, the node above it in the branch, a free point, not maxed)
function clsCanBuy(k, id) {
    const C = CLASSES[k], n = C.node[id]; if (!n) return false;
    const P = clsP(k), r = P.tree[id] | 0, lv = clsLvl(k);
    if (r >= n.max || clsPts(k) <= 0 || lv < CLS_ROW_LV[n.r]) return false;
    if (n.r > 0) { const up = C.tree.find(m => m.b === n.b && m.r === n.r - 1); if (up && !(P.tree[up.id] > 0)) return false; }
    return true;
}
let CLS_REV = 1;                        // bumps whenever any tree / spec / pick changes (the stats cache checks it)
function clsChanged() { CLS_REV++; life.clsTotal = clsTotal(); saveJSON('blocky21_life', life); try { clearWCache(); } catch (e) {} try { if (NET.on) updateMyLook(); } catch (e) {} }
function clsBuy(k, id) { if (!clsCanBuy(k, id)) return false; const P = clsP(k); P.tree[id] = (P.tree[id] | 0) + 1; clsChanged(); return true; }
function clsRespec(k) { const P = clsP(k); P.tree = {}; P.spec = ['', '']; clsChanged(); return true; }      // free, any time out of a run
function clsPickSpec(k, t, id) {
    if (!CLASSES[k] || !clsSpecOK(k, t, id) || clsLvl(k) < CLS_SPEC_LV[t]) return false;
    const P = clsP(k); P.spec[t] = P.spec[t] === id ? '' : id; clsChanged(); return true;
}
// clean up a save: unknown nodes / specs go, ranks over the max or the level's points come off (a valid save is left as it is)
function clsSanitize(k) {
    const C = CLASSES[k], P = clsP(k), lv = clsLvl(k);
    let changed = false;
    for (const id in P.tree) { const n = C.node[id], r = P.tree[id] | 0; if (!n || r <= 0) { delete P.tree[id]; changed = true; } else if (r > n.max || P.tree[id] !== r) { P.tree[id] = Math.min(r, n.max); changed = true; } }
    // a row above your level, or a node whose parent is empty, comes off
    for (const n of C.tree) if (P.tree[n.id] && (lv < CLS_ROW_LV[n.r] || (n.r > 0 && !(P.tree[(C.tree.find(m => m.b === n.b && m.r === n.r - 1) || {}).id] > 0)))) { delete P.tree[n.id]; changed = true; }
    let over = clsSpent(k) - (lv - 1);
    for (let i = C.tree.length - 1; i >= 0 && over > 0; i--) { const id = C.tree[i].id; while (over > 0 && P.tree[id] > 0) { P.tree[id]--; over--; changed = true; } if (P.tree[id] === 0) delete P.tree[id]; }
    if (P.spec.length !== 2) { P.spec = [P.spec[0] || '', P.spec[1] || '']; changed = true; }
    for (let t = 0; t < 2; t++) if (P.spec[t] && (!clsSpecOK(k, t, P.spec[t]) || lv < CLS_SPEC_LV[t])) { P.spec[t] = ''; changed = true; }
    return changed;
}
// ---------- 5.4 migration ----------
// A save from before 5.4 keeps every field as it was and gets class XP from what you've already played:
//   lifetime XP = your XP now + every rank you've given up by prestiging (274,400 XP per prestige)
//   each 4.0 class (assault/medic/engineer/recon): 6% of that + 8 per kill you got with it, up to level 15
//   each new class: 3% of it, up to level 10
// So a new player starts every class at level 1, a rank-20 player at about 3-5, a prestiged veteran at about 9-15.
const XP_PER_PRESTIGE = (() => { let s = 0; for (let r = 1; r < 50; r++) s += 600 + 200 * r; return s; })();
function clsLifetimeXP() { return Math.max(0, +life.xp || 0) + clamp(life.prestige | 0, 0, 10) * XP_PER_PRESTIGE; }
function clsMigrate() {
    let changed = false;
    if (!(life.clsV >= 1)) {
        const total = clsLifetimeXP();
        for (const k of CLASS_ORDER) {
            const c = clsP(k), old = OLD_CLASSES.includes(k);
            const start = old ? Math.min(CLS_XP_AT[15], total * 0.06 + Math.max(0, c.kills | 0) * 8) : Math.min(CLS_XP_AT[10], total * 0.03);
            c.xp = Math.max(c.xp, Math.round(start));
        }
        life.clsV = 1; changed = true;
    }
    for (const k of CLASS_ORDER) if (clsSanitize(k)) changed = true;
    const tot = clsTotal(); if (life.clsTotal !== tot) { life.clsTotal = tot; changed = true; }
    if (changed) saveJSON('blocky21_life', life);
}
clsMigrate();

// ---------- the stats a class gives right now (cached; PvP = baseline) ----------
const CS = { k: null, pvp: null, rev: 0, s: null };
function clsS() {
    if (!CLS_BOOT) return { rel: 0, sp: {} };          // (only W() asks this early)
    const k = myClass(), pvp = !!NET.pvp;
    if (CS.s && CS.k === k && CS.pvp === pvp && CS.rev === CLS_REV) return CS.s;
    const o = clsZero();
    if (k && !pvp) {
        const P = clsP(k);
        for (const n of CLASSES[k].tree) { const r = P.tree[n.id] | 0; if (r) for (const f in n.fx) o[f] += n.fx[f] * r; }
        for (const f in CLS_CAP) o[f] = Math.min(o[f], CLS_CAP[f]);
        for (const id of P.spec) if (id) o.sp[id] = 1;
    }
    CS.k = k; CS.pvp = pvp; CS.rev = CLS_REV; CS.s = o;
    return o;
}
const clsSp = (id) => !!clsS().sp[id];                    // does the class you're playing have this specialisation (and not in PvP)?
const clsDur = (base) => base * (1 + clsS().dur);
const clsPow = () => 1 + clsS().pow;
function clsMaxHp() { return 100 + 20 * perk('hp') + clsS().hp; }
// the most a maxed tree could ever give (a peer's report is clamped to these)
const CLS_PEER_MAX = { lv: CLS_MAX_LV, mt: 8 };

// ---------- class XP ----------
const CLX = { gain: {}, lv0: {}, ups: [] };              // this run / match: class XP per class, the level each class started at
function clsRunReset() { CLX.gain = {}; CLX.lv0 = {}; CLX.ups = []; }
function clsGainXP(n) {
    const k = myClass(); if (!k || !(n > 0)) return;
    const P = clsP(k), before = clsLvOf(P.xp);
    if (CLX.lv0[k] === undefined) CLX.lv0[k] = before;
    P.xp = Math.round(P.xp + n); CLX.gain[k] = (CLX.gain[k] || 0) + Math.round(n);
    const after = clsLvOf(P.xp);
    if (after > before) {
        life.clsTotal = clsTotal(); CLS_REV++;
        const spec = CLS_SPEC_LV.includes(after);
        CLX.ups.push(`${CLASSES[k].name} ${after}`);
        try { toast(`${CLASSES[k].name} LEVEL ${after}  ·  +1 SKILL POINT${spec ? '  ·  SPECIALISATION!' : ''}`, CLASSES[k].css, 2.4); sfx('upgrade'); } catch (e) {}
        saveJSON('blocky21_life', life);
    }
}
// multiplayer match results: a bonus on top of the kills / waves (PvP gives little XP per kill)
function clsMatchBonus(kind) { clsGainXP(kind === 'win' ? 300 : kind === 'lose' ? 150 : kind === 'draw' ? 200 : 100); }
function clsSummaryHtml() {
    const ks = Object.keys(CLX.gain).filter(k => CLASSES[k] && CLX.gain[k] > 0);
    if (!ks.length) return '';
    return `<div class="cls-sum">${ks.map(k => {
        const C = CLASSES[k], P = clsP(k), lv = clsLvOf(P.xp), l0 = CLX.lv0[k] || lv, up = lv - l0;
        const into = lv >= CLS_MAX_LV ? 1 : (P.xp - CLS_XP_AT[lv]) / clsNeed(lv);
        return `<div class="cls-sum-row"><span class="cls-ico" style="background:${C.css}">${C.icon}</span><b style="color:${C.css}">${C.name}</b> <span>LV ${lv}</span>
            <span class="cls-bar"><i style="width:${(into * 100).toFixed(1)}%;background:${C.css}"></i></span><span class="text-green-300">+${CLX.gain[k]} CLASS XP</span>
            ${up > 0 ? `<span class="cls-up">LEVEL UP! +${up} SKILL POINT${up > 1 ? 'S' : ''}${CLS_SPEC_LV.some(s => s > l0 && s <= lv) ? ' · NEW SPECIALISATION' : ''}</span>` : ''}</div>`;
    }).join('')}${ks.some(k => clsPts(k) > 0) ? '<div class="text-xs text-gray-300 mt-1">Spend skill points in <b>CLASSES</b> on the main menu.</div>' : ''}</div>`;
}

// ---------- mastery: an account-wide track fed by every class level (titles + emblem colour, no power) ----------
const MASTERY = [{ at: 8, n: 'RECRUIT', c: '#9ca3af' }, { at: 20, n: 'SPECIALIST', c: '#a3e635' }, { at: 40, n: 'VETERAN', c: '#4ade80' },
                 { at: 70, n: 'ELITE', c: '#38bdf8', qol: 'Switch class in the Armory even in the middle of a wave.' }, { at: 100, n: 'COMMANDER', c: '#a78bfa' },
                 { at: 140, n: 'WARLORD', c: '#f472b6' }, { at: 190, n: 'LEGEND', c: '#fbbf24' }, { at: 240, n: 'GRANDMASTER', c: '#fde047' }];
function masteryTier(tot = clsTotal()) { let t = 0; for (let i = 0; i < MASTERY.length; i++) if (tot >= MASTERY[i].at) t = i + 1; return t; }
const masteryQoL = () => masteryTier() >= 4;
function masteryEmblem(t, size = 18) {
    if (!t) return '';
    const c = MASTERY[t - 1].c;
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="vertical-align:-3px;filter:drop-shadow(0 0 2px ${c})"><path d="M12 2 L21 7 V17 L12 22 L3 17 V7 Z" fill="${c}" stroke="#111827" stroke-width="1.6"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="900" font-family="Segoe UI, Arial, sans-serif" fill="#111827">${t}</text></svg>`;
}
// what other players see (rides on the 5.2 'look'): class, its level, mastery tier and specialisations. Clamped on arrival.
function clsLookBits() { const k = validClass(settings.cls), P = clsP(k); return { c: k, cv: clsLvl(k), mt: masteryTier(), cs: P.spec.filter(Boolean).slice(0, 2) }; }
function cleanClsLook(l, o) {
    o.c = CLASSES[l.c] ? l.c : '';
    o.cv = o.c ? clamp(l.cv | 0, 1, CLS_PEER_MAX.lv) : 0;
    o.mt = clamp(l.mt | 0, 0, CLS_PEER_MAX.mt);
    o.cs = o.c && Array.isArray(l.cs) ? l.cs.filter((id, i) => typeof id === 'string' && [0, 1].some(t => clsSpecOK(o.c, t, id) && o.cv >= CLS_SPEC_LV[t])).slice(0, 2) : [];
    return o;
}
function clsBadge(l) {
    if (!l || !CLASSES[l.c]) return '';
    const C = CLASSES[l.c];
    return `<span class="cls-tag" style="border-color:${C.css};color:${C.css}" title="${C.name} level ${l.cv}${l.cs && l.cs.length ? ' - ' + l.cs.map(id => (clsSpecInfo(l.c, id) || {}).name).join(', ') : ''}">${C.icon} ${C.name} ${l.cv}</span>${l.mt ? masteryEmblem(l.mt, 14) : ''} `;
}
CLS_BOOT = true;
