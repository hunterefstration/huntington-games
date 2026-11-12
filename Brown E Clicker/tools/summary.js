#!/usr/bin/env node
// Prints the key numbers from sim-results.json (node summary.js [--md])
'use strict';
const fs = require('fs'), path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'sim-results.json'), 'utf8'));
const m = (s) => s == null ? '-' : (s / 60).toFixed(1);
const e = (n) => n == null ? '-' : n >= 1e4 ? n.toExponential(1) : String(Math.round(n));
const TIERS = ['pointer', 'mouse', 'farm', 'factory', 'bank', 'temple', 'planet', 'galaxy', 'dimension', 'multiverse', 'bigbang', 'entropy', 'author'];
const rows = [];
const row = (...c) => rows.push('| ' + c.join(' | ') + ' |');
const vs = Object.keys(R);
row('metric', ...vs); row('---', ...vs.map(() => '---'));
for (const who of ['casual', 'active', 'optimizer', 'autoclick15']) {
    row(`**${who}: first run**`, ...vs.map(() => ''));
    row('ascension unlocked (min of play)', ...vs.map(v => m(R[v].firstRun[who].unlockAt)));
    row('longest wait for something new, first 10 min (s)', ...vs.map(v => Math.round(R[v].firstRun[who].gaps10.max)));
    row('new things bought in first 10 min', ...vs.map(v => R[v].firstRun[who].gaps10.n));
    row('longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s)', ...vs.map(v => R[v].firstRun[who].buyGap.map(x => Math.round(x)).join(' / ')));
    row('share of E from clicking at 5 / 10 / 30 / 60 / 120 min', ...vs.map(v => [300, 600, 1800, 3600, 7200].map(t => { const s = R[v].firstRun[who].shareAt[t]; return s ? Math.round(s.click * 100) + '%' : '-'; }).join(' / ')));
    row('E earned at 10 / 60 / 120 min', ...vs.map(v => [600, 3600, 7200].map(t => { const s = R[v].firstRun[who].shareAt[t]; return s ? e(s.earned) : '-'; }).join(' / ')));
    row('first copy of ' + TIERS.join(', ') + ' (min)', ...vs.map(v => TIERS.map(id => m(R[v].firstRun[who].tiers[id])).join(' ')));
    row('affordable buildings never bought', ...vs.map(v => R[v].firstRun[who].neverBuildings.join(' ') || 'none'));
}
for (const who of ['casual', 'active', 'optimizer', 'autoclick15']) {
    const c = (v) => R[v].career[who];
    row(`**${who}: career (${who === 'autoclick15' ? 10 : 30} days)**`, ...vs.map(() => ''));
    for (const n of [1, 2, 5, 10]) row(`ascension #${n}: play min (run min, chips)`, ...vs.map(v => { const a = c(v).ascents.find(x => x.n === n); return a ? `${a.playMin} (${a.runMin}, +${e(a.gain)})` : '-'; }));
    row('min into the run until ascension unlocks, runs #1 / #2 / #5 / #10', ...vs.map(v => [1, 2, 5, 10].map(n => { const a = c(v).ascents.find(x => x.n === n); return a && a.unlockMin != null ? a.unlockMin : '-'; }).join(' / ')));
    row('Final E #1 / #2 / #5 bought on day', ...vs.map(v => [0, 1, 4].map(i => { const d = (c(v).winDays || [])[i]; return d == null ? '-' : (d + 1).toFixed(1); }).join(' / ')));
    row('wins (The Final E) / ascensions', ...vs.map(v => `${c(v).wins} / ${c(v).ascents.length}`));
    row('income share click / buildings / golden / offline', ...vs.map(v => ['click', 'prod', 'golden', 'offline'].map(k => Math.round(((c(v).share[k] || 0) + (k === 'click' ? c(v).share.auto || 0 : 0)) * 100) + '%').join(' / ')));
    row('chips after day 1 / 7 / 30', ...vs.map(v => [1, 7, 30].map(d => { const x = c(v).dayLog[d - 1] || c(v).dayLog[c(v).dayLog.length - 1]; return x ? e(x.chips) : '-'; }).join(' / ')));
}
row('**offline** (away E/hour vs playing E/hour, at 30 / 60 / 120 min)', ...vs.map(v => R[v].offline.map(o => (o.ratio * 100).toFixed(1) + '%').join(' / ')));
row('**challenges** after 5 ascensions (min to goal, - = not in 3h)', ...vs.map(v => Object.entries(R[v].challenges.res).map(([k, x]) => `${k} ${x.min == null ? '-' : x.min}`).join(', ')));
console.log(rows.join('\n'));
