#!/usr/bin/env node
// Brown E Clicker balance simulator.
// Loads the game's real pure logic (src/js/10-game/*.js up to "PURE GAME LOGIC END") in a node vm,
// so every cost / production / chip formula is the game's own, then plays it with model players.
//
//   node "Brown E Clicker/tools/sim.js"                 classic + rb, all players, writes sim-results.json
//   node "Brown E Clicker/tools/sim.js" classic active  one variant / one player, prints a summary
//
// What is NOT modelled: garden, market, seasonal events (date based), skins. Golden E effects,
// buffs, offline earnings, achievements, the prestige tree, challenges and wins are.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const DIR = path.join(__dirname, '../src/js/10-game');

function loadPure(variant) {
    const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort();
    let src = '';
    for (const f of files) {
        const t = fs.readFileSync(path.join(DIR, f), 'utf8');
        const i = t.indexOf('=== PURE GAME LOGIC END ===');
        if (i >= 0) { src += t.slice(0, i); break; }
        src += t + '\n';
    }
    src += `\n;this.G = { get state(){return state}, set state(v){state=v}, shopItems, BUILDING, BASE_COSTS, UPGRADES, UPGRADE_BY_ID,
        ACHIEVEMENTS, TREE, TREE_BY_ID, CHALLENGES, CHALLENGE_BY_ID, PRES, GFX, MULTS, CLICK_BUFFS, recalcPrestige, recalcGarden,
        repriceBuildings, recalculateStats, bulkCost, buildingGrowth, upgCost, getMultiplierCost, chipsForRun, luckyAmount,
        goldenSettings, offlineSettings, achievementCount, totalBuildings, freshRun, freshLife, freshMeta, treeAvailable, challengeIs,
        CHIP_BASE, B: typeof BAL !== 'undefined' ? BAL : null };`;
    const ctx = { console, __BEC_VARIANT__: variant, performance: { now: () => 0 } };
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: 'brown-e-pure.js' });
    return ctx.G;
}

// ---------- model players ----------
// sessions: [startHourOfDay, minutes]; catch = share of golden E's clicked; policy: greedy (affordable only) or payback (waits for the best)
const PLAYERS = {
    casual: { cps: 2, sessions: [[18, 10]], catch: 0.4, policy: 'greedy', ascend: [1, 1], checkEvery: 30 },
    active: { cps: 5, sessions: [[8, 35], [17, 35]], catch: 0.75, policy: 'payback', ascend: [2, 0.75], checkEvery: 5 },
    optimizer: { cps: 8, sessions: [[8, 50], [19, 50]], catch: 0.97, policy: 'payback', ascend: [3, 0.5], checkEvery: 2 },
    // same as active but an auto-clicker at the guard's limit (15/s) the whole session, to see if it dominates
    autoclick15: { cps: 15, sessions: [[8, 35], [17, 35]], catch: 0.75, policy: 'payback', ascend: [2, 0.75], checkEvery: 5 }
};
const TREE_SKIP = { gard1: 1, gard2: 1, gard3: 1, gard4: 1, mkt1: 1, mkt2: 1, mkt3: 1, festive: 1 }; // minigame nodes do nothing here

function makeSim(variant, P, opts) {
    opts = opts || {};
    const G = loadPure(variant);
    const S = () => G.state;
    let rng = opts.seed || 12345;
    const rand = () => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng / 2147483648; };
    const sim = { G, day: 0, play: 0, cal: 0, log: [], ascents: [], buys: [], src: { click: 0, prod: 0, golden: 0, offline: 0, auto: 0 }, srcWin: [], firstOwn: {}, maxBank: 0, wins: 0 };
    const gold = { timer: 25 + rand() * 20, life: 0 }; // first golden E (same in both variants)
    let target = null, targetAt = -1, lastAchCheck = 0;

    function earn(a, src) {
        if (!(a > 0)) return;
        const st = S(); st.brownEs += a; st.run.earned += a; st.life.earned += a;
        if (src === 'click' || src === 'auto') { st.run.handmade += a; st.life.handmade += a; }
        sim.src[src] = (sim.src[src] || 0) + a;
    }
    function recalc() { G.recalculateStats(); }
    function shown(i) { const it = G.shopItems[i]; return i === 0 || it.owned > 0 || S().run.earned >= G.BASE_COSTS[i] * 0.5; }
    function blocked(it) {
        if (it.type === 'click' && G.challengeIs('noclick')) return true;
        if (it.type === 'bps' && G.challengeIs('clicksonly')) return true;
        if (it.type !== 'win' && G.challengeIs('minimal') && it.owned >= 10) return true;
        return false;
    }
    const clickMult = () => (1 + 24 * (G.PRES.crit || 0));
    function income(cps) {
        const st = S();
        const noClick = G.challengeIs('noclick');
        return st.bpsBase + (noClick ? 0 : st.clickPower * clickMult() * (cps + G.PRES.autoClick));
    }
    function candidates() {
        const st = S(), out = [];
        G.shopItems.forEach((it, i) => {
            if (it.type === 'win' || blocked(it) || !shown(i)) return;
            out.push({ kind: 'b', it, cost: it.cost, name: it.id });
        });
        if (!G.challengeIs('noupgrades')) {
            for (const u of G.UPGRADES) if (!st.upgrades[u.id] && u.unlock()) out.push({ kind: 'u', u, cost: G.upgCost(u), name: u.id });
            out.push({ kind: 'g', which: 'clickMultiLevel', cost: G.getMultiplierCost(st.clickMultiLevel), name: 'genClick' });
            out.push({ kind: 'g', which: 'bpsMultiLevel', cost: G.getMultiplierCost(st.bpsMultiLevel), name: 'genBps' });
        }
        return out;
    }
    function apply(c, undo) {
        const st = S();
        if (c.kind === 'b') c.it.owned += undo ? -1 : 1;
        else if (c.kind === 'u') { if (undo) delete st.upgrades[c.u.id]; else st.upgrades[c.u.id] = true; }
        else st[c.which] += undo ? -1 : 1;
    }
    // value of a candidate = extra income per second it gives (buffs removed while measuring)
    function value(c, base, cps) {
        if (c.kind === 'u' && (c.u.kind === 'golden' || c.u.kind === 'offline')) {
            // no direct income: worth ~ a share of income (golden ~6%, offline matters more to idlers)
            const share = c.u.kind === 'golden' ? 0.06 : (P.policy === 'greedy' ? 0.15 : 0.04);
            return base * share;
        }
        apply(c); recalc(); const v = income(cps) - base; apply(c, true);
        return v;
    }
    // score every candidate: payback seconds + seconds still to wait for it; returns them best first
    function decide(cps, greedy) {
        const st = S();
        const buffs = st.buffs; st.buffs = [];
        recalc();
        const base = income(cps);
        const list = [];
        for (const c of candidates()) {
            if (greedy && c.cost > st.brownEs) continue;
            if (c.cost > st.brownEs + base * 7200) continue; // over 2 hours away: never the best pick
            const v = value(c, base, cps);
            if (!(v > 0)) continue;
            c.v = v;
            c.payback = c.cost / v;
            c.score = c.payback + Math.max(0, c.cost - st.brownEs) / Math.max(1e-9, base);
            list.push(c);
        }
        st.buffs = buffs; recalc();
        list.sort((a, b) => a.score - b.score);
        return list;
    }
    function buy(c) {
        const st = S();
        if (st.brownEs < c.cost) return false;
        st.brownEs -= c.cost;
        if (c.kind === 'b') {
            const g = G.buildingGrowth(c.it);
            c.it.owned++; c.it.cost = Math.ceil(c.it.cost * g);
            // x10 / x100 buttons: when a building is very cheap compared to the bank, buy a batch
            let extra = c.it.type === 'click' ? 9 : 99;
            while (extra-- > 0 && c.it.cost * 1000 < st.brownEs && !blocked(c.it)) { st.brownEs -= c.it.cost; c.it.owned++; c.it.cost = Math.ceil(c.it.cost * g); }
            if (!sim.firstOwn[c.it.id + '#' + st.meta.ascensions]) sim.firstOwn[c.it.id + '#' + st.meta.ascensions] = st.run.time;
            st.life.buildings++;
        } else if (c.kind === 'u') { st.upgrades[c.u.id] = true; st.life.upgrades++; }
        else st[c.which]++;
        sim.buys.push({ t: sim.play, rt: st.run.time, asc: st.meta.ascensions, name: c.name, payback: c.payback, cost: c.cost });
        recalc();
        return true;
    }
    function checkAch() {
        const st = S();
        let n = 0;
        for (const a of G.ACHIEVEMENTS) if (!st.achievements[a.id] && a.check && a.check()) { st.achievements[a.id] = 1; n++; }
        if (n) recalc();
    }
    function addBuff(type, mult, time) {
        const st = S();
        st.buffs = st.buffs.filter(b => b.type !== type);
        st.buffs.push({ type, mult, time, max: time });
        recalc();
    }
    function goldenEffect(type) {
        const g = G.goldenSettings(), st = S(), B = G.B ? G.B.golden : null;
        const hasBps = G.shopItems.some(i => i.type === 'bps' && i.owned > 0);
        if (type === 'rush' && !hasBps) type = 'lucky';
        const F = B || { frenzy: [7, 66], click: [777, 13], elder: [111, 6], rush: [0.1, 30] };
        if (type === 'elder') addBuff('elder', F.elder[0], Math.round(F.elder[1] * g.dur));
        else if (type === 'frenzy') addBuff('frenzy', F.frenzy[0], Math.round(F.frenzy[1] * g.dur));
        else if (type === 'click') addBuff('click', F.click[0], Math.round(F.click[1] * g.dur));
        else if (type === 'rush') {
            const owned = G.shopItems.filter(i => i.type === 'bps' && i.owned > 0);
            const it = owned[Math.floor(rand() * owned.length)];
            addBuff('rush', 1 + it.owned * F.rush[0], Math.round(F.rush[1] * g.dur));
        } else earn(G.luckyAmount(), 'golden');
    }
    function pickGolden() {
        if (G.PRES.elder && rand() < 0.08) return 'elder';
        const w = G.B ? G.B.golden.weights : [0.42, 0.77, 0.88];
        const r = rand();
        return r < w[0] ? 'frenzy' : r < w[1] ? 'lucky' : r < w[2] ? 'click' : 'rush';
    }
    function goldenTick(dt) {
        if (G.challengeIs('nogold')) return;
        const g = G.goldenSettings();
        if (gold.life > 0) {
            gold.life -= dt;
            if (gold.life <= g.life - 2 && gold.pending !== undefined) {
                // decided once per golden E whether this player catches it
                const caught = gold.pending; gold.pending = undefined;
                if (caught) {
                    gold.life = 0;
                    gold.timer = g.minGap + rand() * (g.maxGap - g.minGap);
                    if (G.PRES.twins > 0 && rand() < G.PRES.twins) gold.timer = 3;
                    const first = pickGolden();
                    goldenEffect(first);
                    if (G.PRES.doubleGold > 0 && rand() < G.PRES.doubleGold) { let s = pickGolden(); if (s === first) s = first === 'lucky' ? 'frenzy' : 'lucky'; goldenEffect(s); }
                    S().run.golden++; S().life.golden++;
                    return;
                }
            }
            if (gold.life <= 0) { gold.timer = g.minGap + rand() * (g.maxGap - g.minGap); S().life.goldenMissed++; }
            return;
        }
        gold.timer -= dt;
        if (gold.timer <= 0) { gold.life = g.life; gold.pending = rand() < P.catch; }
    }
    function buffTick(dt) {
        const st = S();
        let ex = false;
        for (const b of st.buffs) { b.time -= dt; if (b.time <= 0) ex = true; }
        if (ex) { st.buffs = st.buffs.filter(b => b.time > 0); recalc(); }
    }
    function step(dt, cps) {
        const st = S();
        earn(st.bps * dt, 'prod');
        if (!G.challengeIs('noclick')) {
            earn(st.clickPower * clickMult() * cps * dt, 'click');
            st.run.clicks += cps * dt; st.life.clicks += cps * dt;
            if (G.PRES.autoClick > 0) earn(st.clickPower * G.PRES.autoClick * dt, 'auto');
        }
        st.run.time += dt; st.life.played += dt; sim.play += dt; sim.cal += dt;
        buffTick(dt);
        goldenTick(dt);
        if (st.bpsBase > st.run.bestBase) st.run.bestBase = st.bpsBase;
        if (st.brownEs > sim.maxBank) sim.maxBank = st.brownEs;
    }
    // buys up to 6 items per scoring round (re-scored with stale values in between: much faster, nearly the same picks)
    function shopping(cps, force) {
        const st = S();
        if (!force && P.policy !== 'greedy' && target && st.brownEs < target.cost && sim.play - targetAt < 20) return;
        for (let round = 0; round < 40; round++) {
            const list = decide(cps, P.policy === 'greedy');
            if (!list.length) { target = null; return; }
            let n = 0;
            while (n < 6 && list.length) {
                const c = list[0];
                if (c.cost > st.brownEs) { target = c; targetAt = sim.play; return; }
                const was = c.cost;
                if (!buy(c)) return;
                n++;
                if (c.kind === 'b' && c.it.owned < 1e9) { c.cost = c.it.cost; c.payback = c.cost / c.v; c.score = c.payback + Math.max(0, c.cost - st.brownEs) / Math.max(1e-9, income(cps)); }
                else list.shift();
                if (P.policy === 'greedy') list.sort((a, b) => a.payback - b.payback); else list.sort((a, b) => a.score - b.score);
                if (c.kind === 'b' && was === c.cost) list.shift();
            }
            target = null;
        }
    }
    function tryWin() {
        const st = S(), w = G.shopItems.find(i => i.type === 'win');
        if (st.brownEs >= w.cost && !st.meta.challenge) {
            if (sim.winAt == null) sim.winAt = st.run.time;
            if (opts.noAscend) return;
            st.brownEs -= w.cost; st.wins++; sim.wins++;
            sim.log.push({ ev: 'win', play: sim.play, run: st.run.time });
            ascend('win');
        }
    }
    function resetRun(keep) {
        const old = S();
        const kept = {};
        if (keep && G.PRES.keepUpg) for (const id in old.upgrades) { const u = G.UPGRADE_BY_ID[id]; if (u && (u.kind === 'golden' || u.kind === 'offline')) kept[id] = true; }
        G.state = { brownEs: 0, clickPower: 1, bps: 0, bpsBase: 0, clickMultiLevel: 0, bpsMultiLevel: 0, wins: keep ? old.wins : 0, pendingWin: false,
            upgrades: kept, achievements: keep ? old.achievements : {}, buffs: [], run: G.freshRun(), life: keep ? old.life : G.freshLife(), meta: keep ? old.meta : G.freshMeta() };
        G.state.meta.challenge = null;
        G.shopItems.forEach(i => { i.owned = 0; });
        G.recalcPrestige(); G.recalcGarden(); G.repriceBuildings(); recalc();
    }
    function buyTree() {
        const m = S().meta;
        for (let k = 0; k < 100; k++) {
            let best = null;
            for (const n of G.TREE) if (!TREE_SKIP[n.id] && G.treeAvailable(n) && m.chips >= n.cost && (!best || n.cost < best.cost)) best = n;
            if (!best) break;
            m.chips -= best.cost; m.tree[best.id] = true;
        }
    }
    function beginRun(chId) {
        const st = S();
        const ch = chId ? G.CHALLENGE_BY_ID[chId] : null;
        st.meta.heaven = false; st.meta.challenge = ch ? ch.id : null;
        st.run = G.freshRun(); st.brownEs = 0;
        G.shopItems.forEach(i => { i.owned = 0; });
        G.recalcPrestige();
        if (!ch) {
            for (const id in G.PRES.start) if (G.BUILDING[id]) G.BUILDING[id].owned = G.PRES.start[id];
            st.clickMultiLevel = Math.max(st.clickMultiLevel, G.PRES.genStart);
            st.bpsMultiLevel = Math.max(st.bpsMultiLevel, G.PRES.genStart);
        }
        G.repriceBuildings(); recalc();
        if (!ch && G.PRES.startE > 0) earn(G.PRES.startE, 'gift');
        gold.timer = 25 + rand() * 20; gold.life = 0;
        target = null; peak = 0; runStartCal = sim.cal; unlockAt = null;
    }
    let peak = 0, runStartCal = 0;
    function ascend(why) {
        const st = S();
        const gain = G.chipsForRun(st.run.earned);
        const m = st.meta;
        sim.ascents.push({ n: m.ascensions + 1, play: sim.play, cal: sim.cal, run: st.run.time, unlock: unlockAt, gain, total: m.chipsTotal + gain, bps: st.bpsBase, why,
            clickShare: st.run.handmade / Math.max(1, st.run.earned) });
        m.chips += gain; m.chipsTotal += gain; m.ascensions++;
        resetRun(true);
        m.heaven = true;
        buyTree();
        G.recalcPrestige();
        beginRun(null);
    }
    let unlockAt = null;
    function maybeAscend() {
        const st = S();
        if (unlockAt == null && G.chipsForRun(st.run.earned) >= 1) unlockAt = st.run.time;
        if (st.meta.challenge || opts.noAscend) return;
        const gain = G.chipsForRun(st.run.earned);
        if (gain < 1) return;
        // ascend: [a, r] = when this run gives at least a chips and at least r x the chips earned so far
        // and never sit in one run for more than 4 hours of play when it would still add 10%
        const [a, r] = P.ascend;
        if (gain >= Math.max(a, Math.ceil(st.meta.chipsTotal * r))) ascend('ratio');
        else if (st.run.time > 4 * 3600 && gain >= Math.max(a, st.meta.chipsTotal * 0.1)) ascend('long');
    }
    function offline(sec) {
        const st = S();
        st.buffs = st.buffs.filter(b => (b.time -= sec) > 0); recalc();
        const off = G.offlineSettings();
        const counted = Math.min(sec, off.capHours * 3600);
        earn(st.bpsBase * counted * off.eff, 'offline');
        sim.cal += sec;
    }

    sim.state = S;
    sim.beginRun = beginRun; sim.buyTree = buyTree; sim.checkAch = checkAch; sim.recalc = recalc;
    // play `days` days; returns sim
    sim.runDays = function (days, onSecond) {
        const sessions = P.sessions;
        for (let n = 0; n < days; n++) {
            const d = sim.day++;
            if (sim.wins >= (opts.maxWins || 25)) { sim.stopped = true; return sim; } // the game is solved: stop simulating
            for (let si = 0; si < sessions.length; si++) {
                const [hour, mins] = sessions[si];
                const startCal = d * 86400 + hour * 3600;
                if (sim.cal < startCal) offline(startCal - sim.cal);
                for (let s = 0; s < mins * 60; s++) {
                    if (sim.wins >= (opts.maxWins || 25)) { sim.stopped = true; return sim; }
                    step(1, P.cps);
                    if (s % P.checkEvery === 0) shopping(P.cps);
                    if (s % 5 === 0) { checkAch(); tryWin(); }
                    if (s % 60 === 59) maybeAscend();
                    if (onSecond) onSecond(sim, s);
                }
                if (P.policy === 'greedy') shopping(P.cps);
            }
        }
        return sim;
    };
    // continuous play for `sec` seconds of play time (no offline)
    sim.playFor = function (sec, onSecond) {
        for (let s = 0; s < sec; s++) {
            step(1, P.cps);
            if (s % P.checkEvery === 0) shopping(P.cps);
            if (s % 5 === 0) { checkAch(); tryWin(); }
            if (s % 60 === 59) maybeAscend();
            if (onSecond && onSecond(sim, s) === false) break;
        }
        return sim;
    };
    sim.offline = offline;
    G.recalcPrestige(); G.recalcGarden(); G.repriceBuildings(); recalc();
    return sim;
}

// ---------- measurements ----------
const fmt = (n) => !isFinite(n) ? String(n) : n >= 1e6 ? n.toExponential(2) : n >= 100 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
const mins = (s) => s == null ? '-' : (s / 60).toFixed(1);

// First run, continuous play: building tiers, purchase gaps, click share, payback of what is bought, items never bought
function firstRun(variant, who, limit) {
    const P = PLAYERS[who];
    const sim = makeSim(variant, P, { noAscend: true });
    const G = sim.G;
    const shareAt = {};
    const checkpoints = [300, 600, 1200, 1800, 3600, 5400, 7200, 10800];
    let unlockAt = null, newThings = [], lastNew = 0;
    const seen = {};
    sim.playFor(limit || 3 * 3600, (s, t) => {
        const st = s.state();
        if (unlockAt == null && G.chipsForRun(st.run.earned) >= 1) unlockAt = st.run.time;
        if (checkpoints.includes(t + 1)) shareAt[t + 1] = { click: (s.src.click) / Math.max(1, st.run.earned), bps: st.bpsBase, cp: st.clickPower, earned: st.run.earned };
    });
    for (const b of sim.buys) {
        const key = b.name.startsWith('gen') ? b.name + Math.floor(Math.log10(b.cost)) : b.name;
        if (!seen[key]) { seen[key] = 1; newThings.push(b.rt); }
    }
    // gaps between "something new" (new building / upgrade / multiplier level) during the first 10 and 60 minutes
    const gaps = (until) => { let prev = 0, mx = 0, all = []; for (const t of newThings) { if (t > until) break; all.push(t - prev); mx = Math.max(mx, t - prev); prev = t; } return { max: mx, n: all.length, median: all.sort((a, b) => a - b)[Math.floor(all.length / 2)] || 0 }; };
    // longest gap between ANY purchases in each phase
    const buyGap = (from, to) => { let prev = from, mx = 0; for (const b of sim.buys) { if (b.rt < from) continue; if (b.rt > to) break; mx = Math.max(mx, b.rt - prev); prev = b.rt; } return Math.max(mx, Math.min(to, sim.state().run.time) - prev); };
    const tiers = {};
    G.shopItems.forEach(it => { if (it.type !== 'win') tiers[it.id] = sim.firstOwn[it.id + '#0'] ?? null; });
    const bought = new Set(sim.buys.map(b => b.name));
    const neverBuildings = G.shopItems.filter(it => it.type !== 'win' && tiers[it.id] == null && it.cost <= sim.state().run.earned).map(it => it.id);
    const clickBuild = G.shopItems.filter(it => it.type === 'click').map(it => ({ id: it.id, owned: it.owned }));
    return { variant, who, unlockAt, shareAt, gaps10: gaps(600), gaps60: gaps(3600), buyGap: [buyGap(0, 600), buyGap(600, 1800), buyGap(1800, 3600), buyGap(3600, 7200)], tiers, neverBuildings, clickBuild,
        earned: sim.state().run.earned, bps: sim.state().bpsBase, cp: sim.state().clickPower, nBuys: sim.buys.length, genLevels: [sim.state().clickMultiLevel, sim.state().bpsMultiLevel],
        upgradesNeverBought: G.UPGRADES.filter(u => u.unlock() && !bought.has(u.id)).length };
}

// Long play with sessions + offline: ascension times, chip growth, offline share, late game
function career(variant, who, days) {
    const P = PLAYERS[who];
    const sim = makeSim(variant, P);
    const dayLog = [];
    for (let d = 0; d < days; d++) {
        sim.runDays(1);
        const st = sim.state();
        dayLog.push({ d: d + 1, asc: st.meta.ascensions, chips: st.meta.chipsTotal, bps: st.bpsBase, life: st.life.earned });
    }
    const tot = Object.values(sim.src).reduce((a, b) => a + b, 0);
    const share = {}; for (const k in sim.src) share[k] = sim.src[k] / Math.max(1, tot);
    return { variant, who, ascents: sim.ascents.map(a => ({ n: a.n, playMin: +(a.play / 60).toFixed(1), day: +(a.cal / 86400).toFixed(2), runMin: +(a.run / 60).toFixed(1), unlockMin: a.unlock == null ? null : +(a.unlock / 60).toFixed(1), gain: a.gain, total: a.total, bps: a.bps, clickShare: +a.clickShare.toFixed(3), why: a.why })),
        share, wins: sim.wins, dayLog, life: sim.state().life.earned, maxBank: sim.maxBank };
}

// Offline strength: E/hour away vs E/hour playing (active player, at the end of a run hour)
function offlineStrength(variant) {
    const out = [];
    for (const at of [1800, 3600, 7200]) {
        const sim = makeSim(variant, PLAYERS.active, { noAscend: true });
        sim.playFor(at);
        const st = sim.state();
        const e0 = st.run.earned; sim.playFor(3600); const playHour = st.run.earned - e0;
        const sim2 = makeSim(variant, PLAYERS.active, { noAscend: true });
        sim2.playFor(at);
        const s2 = sim2.state(); const e1 = s2.run.earned; sim2.offline(8 * 3600); const off8 = s2.run.earned - e1;
        const off = sim2.G.offlineSettings();
        out.push({ atMin: at / 60, playHour, offlinePerHour: off8 / 8, ratio: off8 / 8 / playHour, eff: off.eff, capHours: off.capHours });
    }
    return out;
}

// Challenges: optimizer's tree after `asc` ascensions, then each challenge played actively for up to 3h
function challenges(variant, asc) {
    const base = makeSim(variant, PLAYERS.optimizer);
    let days = 0;
    while (base.state().meta.ascensions < asc && days < 60) { base.runDays(1); days++; }
    const snapshot = JSON.stringify({ meta: base.state().meta, ach: base.state().achievements, life: base.state().life });
    const res = {};
    for (const ch of base.G.CHALLENGES) {
        const sim = makeSim(variant, PLAYERS.active, { noAscend: true });
        const snap = JSON.parse(snapshot);
        const st = sim.state();
        Object.assign(st.meta, snap.meta); st.meta.tree = snap.meta.tree; st.achievements = snap.ach; st.life = snap.life;
        sim.G.recalcPrestige();
        if (!st.meta.tree.trial) st.meta.tree.trial = true; // the snapshot player always has the gate by then
        sim.G.recalcPrestige();
        sim.beginRun(ch.id);
        let done = null; const at = {};
        sim.playFor(3 * 3600, (s, t) => {
            const r = s.state();
            if (t + 1 === 600 || t + 1 === 3600 || t + 1 === 10800) at[(t + 1) / 60] = r.run.earned;
            if (done == null && r.run.earned >= ch.goal) done = r.run.time;
            if (ch.limit && r.run.time > ch.limit) { at[10] = r.run.earned; return false; }
        });
        res[ch.id] = { goal: ch.goal, min: done == null ? null : +(done / 60).toFixed(1), limitMin: ch.limit ? ch.limit / 60 : null, at };
    }
    return { asc, chipsTotal: base.state().meta.chipsTotal, days, res };
}

function runAll(variant) {
    const t0 = Date.now();
    const r = { variant };
    r.firstRun = {};
    for (const who of ['casual', 'active', 'optimizer', 'autoclick15']) r.firstRun[who] = firstRun(variant, who, who === 'casual' ? 4 * 3600 : 3 * 3600);
    r.career = {};
    for (const who of ['casual', 'active', 'optimizer']) r.career[who] = career(variant, who, who === 'casual' ? 30 : 30);
    r.career.autoclick15 = career(variant, 'autoclick15', 10);
    r.offline = offlineStrength(variant);
    r.challenges = challenges(variant, 5);
    r.ms = Date.now() - t0;
    return r;
}

if (require.main === module) {
    const [variant, who] = process.argv.slice(2);
    if (variant && who) {
        const fr = firstRun(variant, who);
        console.log(JSON.stringify({ unlockMin: mins(fr.unlockAt), gaps10: fr.gaps10, buyGap: fr.buyGap.map(mins), never: fr.neverBuildings, click: fr.clickBuild, shareAt: Object.fromEntries(Object.entries(fr.shareAt).map(([k, v]) => [k, +v.click.toFixed(2)])) }));
        const c = career(variant, who, 14);
        console.log(JSON.stringify(c.ascents.slice(0, 8)));
        console.log(JSON.stringify(c.share));
    } else {
        const file = path.join(__dirname, 'sim-results.json');
        let out = {};
        try { out = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
        for (const v of (variant ? [variant] : ['classic', 'rb'])) { out[v] = runAll(v); console.error(v, 'done in', out[v].ms, 'ms'); }
        fs.writeFileSync(file, JSON.stringify(out, null, 1));
        console.error('wrote', file);
    }
}
module.exports = { loadPure, makeSim, PLAYERS, firstRun, career, offlineStrength, challenges, runAll };
