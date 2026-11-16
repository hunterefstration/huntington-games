// ==========================================
// SCENARIOS (1.4): different worlds to start in, for New Game, Simulator and online rooms (the host picks one and
// every player's game builds the same world from the same seed). A scenario only changes the starting world:
// relations, sanctions, money and moods, with a few pressures that fade over the first years. Each has its own goal.
// ==========================================
const SCENARIOS = [
  { id: 'standard', icon: '🌍', name: 'The world of 2026', desc: 'The real world as it is in mid 2026.' },
  { id: 'coldwar', icon: '🧊', name: 'Cold War II', desc: 'The world has split into two camps: the West around the USA and the East around China and Russia. Sanctions, arms races and spies everywhere. Pick a side, or play them off against each other.' },
  { id: 'collapse', icon: '🏚', name: 'After the Crash', desc: 'A global depression has wiped a fifth off every economy. Jobs are gone, debts are huge, governments are fragile. Rebuild your country from the ruins.' },
  { id: 'scramble', icon: '🛢', name: 'Resource Scramble', desc: 'Oil is at $185 and rising. Energy exporters are rich, everyone else is squeezed, and hungry powers eye their neighbours\' fields.' },
  { id: 'peace', icon: '🕊', name: 'Age of Peace', desc: 'The war in Ukraine has ended, sanctions are lifted and markets are booming. A gentler start: build a golden age.' }
];
const scnOf = id => SCENARIOS.find(s => s.id === id) || SCENARIOS[0];
const SCN_WEST = ['USA', 'CAN', 'GBR', 'FRA', 'DEU', 'ITA', 'JPN', 'KOR', 'AUS', 'NZL', 'TWN', 'ISR'];
const SCN_EAST = ['CHN', 'RUS', 'IRN', 'PRK', 'BLR', 'VEN', 'CUB', 'NIC', 'SYR', 'MMR'];
function scnCamp(idx) {
  const s = G && G.scenario; if (!s || !s.camps) return null;
  return s.camps.w.includes(idx) ? 'w' : s.camps.e.includes(idx) ? 'e' : null;
}
function applyScenario(g, id) {
  const S = scnOf(id); g.scenario = { id: S.id, start: g.day };
  if (S.id === 'standard') return;
  const G0 = G; G = g;
  try {
    const nat = c => g.nations[World.byId[c] ? World.byId[c].idx : -1];
    if (S.id === 'coldwar') {
      const w = [], e = [];
      for (const m of g.nations) { if (!m) continue; const c = World.countries[m.idx];
        if (SCN_WEST.includes(c.id) || m.blocs.includes('NATO') || m.blocs.includes('EU') || m.blocs.includes('AUKUS')) w.push(m.idx);
        else if (SCN_EAST.includes(c.id) || m.blocs.includes('CSTO')) e.push(m.idx); }
      g.scenario.camps = { w, e };
      for (const a of w) for (const b of e) addRel(a, b, -35);
      for (const side of [w, e]) for (let i = 0; i < side.length; i++) for (let j = i + 1; j < side.length; j++) addRel(side[i], side[j], 8);
      const chn = nat('CHN'), usa = nat('USA'), rus = nat('RUS');
      for (const i of w) if (chn && !g.sanctions.some(s => s.by === i && s.on === chn.idx) && G.nations[i].dev > 0.6) g.sanctions.push({ by: i, on: chn.idx, level: 1, since: 0 });
      for (const i of e) if (usa && i !== usa.idx && !g.sanctions.some(s => s.by === i && s.on === usa.idx)) g.sanctions.push({ by: i, on: usa.idx, level: 1, since: 0 });
      for (const i of w.concat(e)) { const m = g.nations[i]; m.spend.defence = +(m.spend.defence + 0.6).toFixed(2); m.army && (m.army.E *= 1.1); m.evStab -= 3; }
      if (chn && rus && !hasTreaty(chn.idx, rus.idx, 'defence')) g.treaties.push({ type: 'defence', a: chn.idx, b: rus.idx, since: 0 });
      g.world.oil = 125; g.world.cycleShock = -1;
      g.feed.unshift({ type: 'news', day: 0, outlet: 'World Wire', text: 'A new Cold War: the world splits into two camps', mood: -1 });
    } else if (S.id === 'collapse') {
      for (const m of g.nations) {
        if (!m) continue;
        m.preReal = m.real;
        m.real *= 0.82; m.debt += 0.25 * gdpL(m);
        m.unemp = clamp(m.unemp + 5 + 4 * m.dev, 0, 45); m.feel.un = m.unemp;
        m.infl = clamp(m.infl - 1.5, -3, 300); m.growth -= 3;
        m.approval = clamp(m.approval - 10, 5, 95); m.stability = clamp(m.stability - 12, 5, 95);
        m.evGrowth = (m.evGrowth || 0) - 2.5; m.evStab -= 6; m.evAppr -= 5;
        m.ratingOff = (m.ratingOff || 0) - 1.5;
      }
      g.world.oil = 55; g.world.cycleShock = -3.5; g.world.cycle = -1.5;
      g.feed.unshift({ type: 'news', day: 0, outlet: 'World Wire', text: 'The Great Crash: a fifth of the world economy is gone', mood: -1 });
    } else if (S.id === 'scramble') {
      for (const m of g.nations) {
        if (!m) continue;
        const exporter = m.res.includes('oil') || m.res.includes('gas');
        if (exporter) { m.rent = +(m.rent * 1.4 + 1).toFixed(2); m.evGrowth = (m.evGrowth || 0) + 0.8; m.approval = clamp(m.approval + 4, 5, 95); }
        else { m.evGrowth = (m.evGrowth || 0) - 1.2; m.infl = clamp(m.infl + 3, -3, 300); m.evInfl = (m.evInfl || 0) + 2; m.approval = clamp(m.approval - 4, 5, 95); }
        if (m.persona && m.persona.aggr > 50) m.persona.aggr = Math.min(100, m.persona.aggr + 10);
      }
      g.world.oil = 185;
      g.feed.unshift({ type: 'news', day: 0, outlet: 'World Wire', text: 'Oil hits $185: the great resource scramble begins', mood: -1 });
    } else if (S.id === 'peace') {
      for (const w of g.wars.slice()) { g.wars.splice(g.wars.indexOf(w), 1); for (const i of w.a.concat(w.d)) g.nations[i].atWar = false; }
      g.sanctions = g.sanctions.filter(s => !['RUS'].includes(World.countries[s.on].id));
      const rus = nat('RUS'), ukr = nat('UKR');
      for (const m of g.nations) { if (!m) continue; m.evGrowth = (m.evGrowth || 0) + 0.8; m.approval = clamp(m.approval + 5, 5, 95); m.stability = clamp(m.stability + 5, 5, 95); }
      if (rus) for (const m of g.nations) if (m && m.idx !== rus.idx) addRel(m.idx, rus.idx, 12);
      if (ukr) { ukr.stability = clamp(ukr.stability + 15, 5, 95); ukr.evGrowth += 2; }
      g.world.cycleShock = 1.5; g.world.oil = 85;
      g.feed = g.feed.filter(f => !/Ukraine grinds on/.test(f.text));
      g.feed.unshift({ type: 'news', day: 0, outlet: 'World Wire', text: 'Peace in Ukraine: a treaty is signed and markets soar', mood: 1 });
    }
  } finally { G = G0 || g; }
}
// pressures that fade over the first years
function scenarioMonth() {
  const s = G.scenario; if (!s || s.id === 'standard') return;
  const yrs = (G.day - (s.start || 0)) / 365;
  if (s.id === 'scramble' && yrs < 4) G.world.oil = Math.max(G.world.oil, 185 - yrs * 25);
  if (s.id === 'coldwar' && yrs < 10 && G.rng() < 0.15) { // the camps keep each other on edge
    const w = s.camps.w, e = s.camps.e; if (w.length && e.length) { const a = w[Math.floor(G.rng() * w.length)], b = e[Math.floor(G.rng() * e.length)]; addRel(a, b, -4); if (G.rng() < 0.3) newsWorld(cnName(a) + ' and ' + cnName(b) + ' expel each other\'s diplomats'); }
  }
  if (s.id === 'collapse' && yrs < 3) G.world.cycleShock = Math.min(G.world.cycleShock, -1.5 + yrs * 0.5);
}
MONTHLY.push(scenarioMonth);
SYSTEM_INITS.push(g => { g.scenario = g.scenario || { id: 'standard', start: 0 }; });

// ---- 1.4 victories: the World Council, global crises and one goal per scenario (shown only in that scenario)
const vicMe = () => G.nations[G.player.idx];
const scnIs = id => !!(G.scenario && G.scenario.id === id);
VICTORIES.push(
  { id: 'council', name: 'Voice of the World', desc: 'Council influence of 80 and 5 of your own resolutions passed', test: n => Council.influence(n) >= 80 && (G.council.stats.passed || 0) >= 5, months: 0 },
  { id: 'saviour', name: 'Saviour of Humanity', desc: 'Help beat 2 global crises with pledges of 0.3% of GDP or more', test: () => (G.council.stats.bigCrises || 0) >= 2, months: 0 },
  { id: 'thaw', only: 'coldwar', name: 'The Thaw', desc: 'Cold War II: relations of 30+ with both the USA and China (or with the other one, if you lead one of them) for a year', months: 12,
    test: n => { const u = World.byId.USA.idx, c = World.byId.CHN.idx; return scnIs('coldwar') && (n.idx === u ? relation(u, c) >= 30 : n.idx === c ? relation(c, u) >= 30 : relation(n.idx, u) >= 30 && relation(n.idx, c) >= 30); } },
  { id: 'recovery', only: 'collapse', name: 'The Great Recovery', desc: 'After the Crash: your economy back above its pre-crash size, with unemployment under 6%', months: 6,
    test: n => scnIs('collapse') && n.preReal > 0 && n.real >= n.preReal && n.unemp < 6 },
  { id: 'energy', only: 'scramble', name: 'Energy Independence', desc: 'Resource Scramble: research cheap solar, grid batteries and small reactors, with inflation under 4%', months: 0,
    test: n => scnIs('scramble') && ['solar', 'batteries', 'smr'].every(techDone) && n.infl < 4 },
  { id: 'golden', only: 'peace', name: 'Golden Age', desc: 'Age of Peace: approval over 60 and growth over 3% for 2 years', months: 24, test: n => scnIs('peace') && n.approval > 60 && n.growth > 3 }
);
A('council1', 'Diplomat at large', 'Pass your own resolution at the World Council', () => (G.council.stats.passed || 0) >= 1);
A('council5', 'The world listens', 'Pass 5 of your own resolutions at the World Council', () => (G.council.stats.passed || 0) >= 5);
A('vetoed', 'Vetoed!', 'Have one of your resolutions vetoed', () => (G.council.stats.vetoed || 0) >= 1);
A('inf75', 'Heavyweight', 'Reach 75 Council influence', n => Council.influence(n) >= 75);
A('defy12', 'Rogue state', 'Defy the World Council for 12 months', () => (G.council.defyMonths || 0) >= 12);
A('crisis1', 'Answering the call', 'Help beat a global crisis', () => (G.council.stats.crises || 0) >= 1);
A('asteroid', 'Planetary defence', 'Help push an asteroid off course', () => (G.council.crisisLog || []).some(c => c.id === 'asteroid' && c.won && c.mine > 0));
A('sanctioned', 'Pariah', 'Get sanctioned by the World Council', () => (G.council.history || []).some(h => h.kind === 'sanction' && h.pass && h.t === G.player.idx));
A('scn_cold', 'Iron curtain', 'Survive 2 years in Cold War II', () => scnIs('coldwar') && G.day - (G.player.startDay || 0) >= 730);
A('scn_crash', 'From the ashes', 'Survive 2 years After the Crash', () => scnIs('collapse') && G.day - (G.player.startDay || 0) >= 730);
A('scn_oil', 'Running on empty', 'Survive 2 years in the Resource Scramble', () => scnIs('scramble') && G.day - (G.player.startDay || 0) >= 730);
A('scn_peace', 'Blessed are the peacemakers', 'Keep out of every war for 5 years in the Age of Peace', n => scnIs('peace') && G.day - (G.player.startDay || 0) >= 1825 && !(n.warsWon || n.warsLost) && !n.atWar);
