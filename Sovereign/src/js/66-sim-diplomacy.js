// Diplomacy and trade: relations between every pair of countries, leaders with personalities, deals, sanctions,
// organisations, the UN, world prices for key goods, and AI countries acting on their own.
// Relations = a base attitude worked out from the data + remembered events (which fade) + treaties.
const RIVALS = [['USA', 'CHN', -35], ['USA', 'RUS', -55], ['USA', 'IRN', -80], ['USA', 'PRK', -85], ['USA', 'CUB', -45], ['USA', 'VEN', -60], ['RUS', 'UKR', -95],
  ['IND', 'PAK', -70], ['ISR', 'IRN', -95], ['KOR', 'PRK', -75], ['CHN', 'TWN', -60], ['CHN', 'JPN', -30], ['CHN', 'IND', -30], ['GRC', 'TUR', -25], ['ARM', 'AZE', -45],
  ['SAU', 'IRN', -35], ['MAR', 'DZA', -45], ['ETH', 'ERI', -40], ['SRB', 'UNK', -70], ['RUS', 'POL', -60], ['RUS', 'LTU', -60], ['RUS', 'EST', -60], ['RUS', 'LVA', -60],
  ['RUS', 'GBR', -55], ['RUS', 'FIN', -45], ['ISR', 'PSE', -70], ['ISR', 'LBN', -55], ['ISR', 'SYR', -45], ['VEN', 'GUY', -40], ['AFG', 'PAK', -30], ['SDN', 'SSD', -30],
  ['CHN', 'PHL', -40], ['CHN', 'VNM', -20], ['CHN', 'AUS', -15], ['RUS', 'GEO', -50], ['RUS', 'MDA', -40], ['COD', 'RWA', -55], ['EGY', 'ETH', -30], ['KHM', 'THA', -30], ['IRN', 'ARE', -15]];
const FRIENDS = [['USA', 'ISR', 50], ['USA', 'GBR', 45], ['USA', 'JPN', 40], ['USA', 'KOR', 40], ['USA', 'CAN', 30], ['USA', 'AUS', 40], ['RUS', 'BLR', 55], ['CHN', 'PAK', 50], ['CHN', 'RUS', 40],
  ['IND', 'RUS', 25], ['FRA', 'DEU', 40], ['AUS', 'NZL', 50], ['CHN', 'PRK', 30], ['RUS', 'IRN', 35], ['SAU', 'ARE', 40], ['TUR', 'AZE', 55], ['GRC', 'CYP', 50], ['USA', 'TWN', 35],
  ['UKR', 'POL', 40], ['UKR', 'GBR', 45], ['UKR', 'USA', 30], ['UKR', 'DEU', 40], ['UKR', 'FRA', 40], ['UKR', 'CAN', 40], ['UKR', 'NLD', 40], ['UKR', 'SWE', 45], ['UKR', 'FIN', 45], ['UKR', 'DNK', 45], ['UKR', 'NOR', 40], ['UKR', 'EST', 45], ['UKR', 'LVA', 45], ['UKR', 'LTU', 45], ['UKR', 'CZE', 35], ['UKR', 'ITA', 30], ['UKR', 'JPN', 30], ['UKR', 'AUS', 30], ['RUS', 'PRK', 35], ['SRB', 'RUS', 30], ['ARG', 'USA', 20], ['IND', 'USA', 20], ['EGY', 'SAU', 30], ['QAT', 'TUR', 35]];
const PAIR = (a, b) => a < b ? a + ',' + b : b + ',' + a;
const Diplo = { base: null, pairMap: {} };
function buildBaseRelations() {
  const N = World.countries.length, B = Diplo.base = new Float32Array(N * N), r = makeRng(99);
  const S = idx => World.nat0[idx];
  for (let a = 1; a < N; a++) for (let b = a + 1; b < N; b++) {
    const A = S(a), Bn = S(b), ca = World.countries[a], cb = World.countries[b];
    let v = 0;
    const shared = A.blocs.filter(x => Bn.blocs.includes(x));
    if (shared.includes('NATO')) v += 25; if (shared.includes('EU')) v += 20; if (shared.includes('CSTO')) v += 15;
    v += Math.min(30, shared.filter(x => !['NATO', 'EU', 'CSTO', 'G20', 'OECD'].includes(x)).length * 8);
    if (GOV[A.gov].free === GOV[Bn.gov].free) v += 8; else v -= 6;
    if (ca.region === cb.region) v += 6;
    if (ca.borders.includes(cb.id)) v += 4;
    v += (r() - 0.5) * 10;
    B[a * N + b] = B[b * N + a] = clamp(v, -100, 100);
  }
  for (const [x, y, v] of RIVALS.concat(FRIENDS)) { const a = World.byId[x].idx, b = World.byId[y].idx; B[a * N + b] = B[b * N + a] = v; }
}
function relation(a, b) {
  if (a === b) return 100;
  const N = World.countries.length, k = PAIR(a, b);
  return clamp(Diplo.base[a * N + b] + (G.relD[k] || 0) + treatyBonus(a, b) - sanctionMalus(a, b), -100, 100);
}
function relWhy(a, b) {
  const N = World.countries.length, k = PAIR(a, b);
  return [['History, alliances and ideology', Diplo.base[a * N + b]], ['Recent events', G.relD[k] || 0], ['Treaties', treatyBonus(a, b)], ['Sanctions and tariffs', -sanctionMalus(a, b)]];
}
function addRel(a, b, v) { if (a === b) return; const k = PAIR(a, b); G.relD[k] = clamp((G.relD[k] || 0) + v, -150, 150); }
function treatyBonus(a, b) { let v = 0; for (const t of G.treaties) if ((t.a === a && t.b === b) || (t.a === b && t.b === a)) v += TREATIES[t.type].rel; return v; }
function sanctionMalus(a, b) { let v = 0; for (const s of G.sanctions) if ((s.by === a && s.on === b) || (s.by === b && s.on === a)) v += s.level * 15; return v; }
const TREATIES = {
  trade: { name: 'Free trade deal', rel: 10 }, defence: { name: 'Defence pact', rel: 20 }, nonagg: { name: 'Non-aggression pact', rel: 6 },
  tech: { name: 'Technology sharing', rel: 8 }, visa: { name: 'Visa-free travel', rel: 5 }, base: { name: 'Military base', rel: 8 }
};
const hasTreaty = (a, b, type) => G.treaties.some(t => t.type === type && ((t.a === a && t.b === b) || (t.a === b && t.b === a)));

// ---- leaders' personalities (0-100); real leaders get a few known leanings, everyone else is seeded
const PERSONA = { USA: { aggr: 60, greed: 85, pride: 90, honor: 35 }, RUS: { aggr: 90, greed: 50, pride: 85, honor: 30, paranoia: 85 }, CHN: { aggr: 55, greed: 60, pride: 80, honor: 55, paranoia: 70 },
  PRK: { aggr: 90, paranoia: 95, pride: 95 }, IRN: { aggr: 70, paranoia: 80, honor: 40 }, ISR: { aggr: 75, paranoia: 75 }, IND: { pride: 75, aggr: 45 }, TUR: { pride: 85, aggr: 55 },
  DEU: { aggr: 20, honor: 75 }, FRA: { pride: 70, honor: 65 }, GBR: { honor: 70, aggr: 30 }, CHE: { aggr: 5, honor: 85 }, SWE: { aggr: 15, honor: 85 }, NZL: { aggr: 10, honor: 85 },
  SAU: { greed: 70, pride: 75 }, ARE: { greed: 75, aggr: 40 }, VEN: { aggr: 55, paranoia: 80 }, BLR: { paranoia: 85, aggr: 45 }, UKR: { aggr: 70, pride: 80, honor: 70 } };
function makePersona(n) {
  const r = makeRng(hashStr(n.leader + n.id)), base = PERSONA[n.id] || {};
  const p = { aggr: 20 + r() * 50, greed: 20 + r() * 60, pride: 20 + r() * 60, honor: 30 + r() * 50, paranoia: 15 + r() * 50 };
  if (!GOV[n.gov].free) { p.aggr += 10; p.paranoia += 15; }
  return Object.assign(p, base);
}
function personaText(p) {
  const t = [];
  if (p.aggr > 70) t.push('aggressive'); else if (p.aggr < 25) t.push('peaceful');
  if (p.greed > 70) t.push('loves a good deal'); if (p.pride > 75) t.push('proud: hates being lectured'); if (p.honor > 70) t.push('keeps promises'); else if (p.honor < 35) t.push('breaks promises');
  if (p.paranoia > 70) t.push('suspicious of everyone');
  return t.join(', ') || 'pragmatic';
}

// ---- organisations you can join or leave
const ORGS = {
  EU: { name: 'European Union', can: c => c.region === 'Europe', need: 7, fx: { g: 0.4 }, leaveFx: { g: -0.6 } },
  NATO: { name: 'NATO', can: c => c.region === 'Europe' || ['USA', 'CAN'].includes(c.id), need: 6, fx: { s: 3 }, leaveFx: { s: -3 } },
  BRICS: { name: 'BRICS', can: () => true, need: 0, fx: { g: 0.1 } },
  SCO: { name: 'Shanghai Cooperation Org.', can: c => c.region === 'Asia' || c.id === 'RUS', need: 0, fx: { s: 1 } },
  ASEAN: { name: 'ASEAN', can: c => c.sub === 'South-Eastern Asia', need: 0, fx: { g: 0.2 } },
  AU: { name: 'African Union', can: c => c.region === 'Africa', need: 0, fx: { s: 1 } },
  OPEC: { name: 'OPEC', can: (c, n) => n.res.includes('oil'), need: 0, fx: { g: 0.1 } },
  CW: { name: 'Commonwealth', can: (c, n) => n.blocs.includes('CW'), need: 0, fx: {} },
  MERC: { name: 'Mercosur', can: c => c.sub === 'South America', need: 0, fx: { g: 0.2 } },
  CSTO: { name: 'CSTO', can: c => ['Asia', 'Europe'].includes(c.region), need: 0, fx: { s: 2 } }
};
function orgMembers(id) { return G.nations.filter(m => m && m.blocs.includes(id)); }

// ---- key world goods: price indices (100 = 2026). Embargoes and wars on big producers push prices up.
const GOODS = { oil: 'Oil', gas: 'Gas', food: 'Food', metal: 'Metals', rare: 'Rare earths', chips: 'Microchips' };
function goodsMonth() {
  const W = G.world; W.prices = W.prices || { oil: 100, gas: 100, food: 100, metal: 100, rare: 100, chips: 100 };
  const shock = {};
  for (const k in GOODS) {
    const prod = G.nations.filter(m => m && m.res.includes(k)), tot = prod.reduce((a, m) => a + gdpUsd(m), 0) || 1;
    let s = 0;
    for (const m of prod) { const w = gdpUsd(m) / tot, emb = G.sanctions.filter(x => x.on === m.idx && x.level >= 2).reduce((a, x) => a + gdpUsd(G.nations[x.by]) / W.worldGdp, 0); s += w * (emb * 1.2 + (m.atWar ? 0.25 : 0) + (m.stability < 20 ? 0.1 : 0)); }
    shock[k] = s;
    const target = 100 * (1 + s * 1.5);
    W.prices[k] = clamp(W.prices[k] + (target - W.prices[k]) * 0.15 + (G.rng() - 0.5) * 4, 40, 400);
  }
  W.oil = W.oil * 0.6 + W.prices.oil * 0.4; W.prices.oil = W.oil;
  for (const n of G.nations) {
    if (!n) continue;
    let g = 0, i = 0;
    for (const k of ['gas', 'food', 'metal', 'rare', 'chips']) { const d = W.prices[k] - 100; if (n.res.includes(k)) g += d * 0.004; else i += d * (k === 'food' ? 0.012 : 0.004) * (1 - n.dev * 0.4); }
    setMod(n, 'growth', 'World prices', clamp(g, -2, 2)); setMod(n, 'infl', 'World prices', clamp(i, -2, 6));
  }
}

// ---- monthly: memories fade, treaties and sanctions work, AI countries act
function diploMonth() {
  for (const k in G.relD) { G.relD[k] *= 0.985; if (Math.abs(G.relD[k]) < 0.3) delete G.relD[k]; }
  const W = G.world;
  for (const n of G.nations) {
    if (!n) continue;
    let tradeG = 0, sanc = 0, sanI = 0;
    for (const t of G.treaties) if (t.type === 'trade' && (t.a === n.idx || t.b === n.idx)) { const o = G.nations[t.a === n.idx ? t.b : t.a]; tradeG += 0.15 * Math.min(1, gdpUsd(o) / gdpUsd(n)) * n.open * 2; }
    for (const s of G.sanctions) if (s.on === n.idx) { const w = gdpUsd(G.nations[s.by]) / W.worldGdp; sanc += w * s.level * 6 * n.open; sanI += w * s.level * 4; }
    for (const s of G.tariffs || []) if (s.on === n.idx) sanc += gdpUsd(G.nations[s.by]) / W.worldGdp * s.pct / 25 * n.open;
    setMod(n, 'growth', 'Trade deals', clamp(tradeG, 0, 1.5)); setMod(n, 'growth', 'Sanctions & tariffs on us', -clamp(sanc, 0, 8)); setMod(n, 'infl', 'Sanctions on us', clamp(sanI, 0, 15));
  }
  // a reserve currency that is used as a weapon slowly loses trust
  for (const code in G.cur) {
    const c = G.cur[code], issuers = G.nations.filter(m => m && m.mon.cur === code && m.mon.type !== 'adopted');
    const v = issuers.reduce((a, m) => a + G.sanctions.filter(s => s.by === m.idx).reduce((x, s) => x + s.level * gdpUsd(G.nations[s.on]) / W.worldGdp * 40, 0), 0);
    if (c.sanc0 == null) c.sanc0 = v; // sanctions that already existed in 2026 are part of the starting trust
    c.sanctions = Math.max(0, v - c.sanc0);
  }
  goodsMonth();
  aiDiplomacy();
  if (G.day % 365 < 31) unscRotate();
}
// AI countries: friendly deals, sanctions on rivals, requests to the player
function aiDiplomacy() {
  const N = G.nations.length, me = G.player.idx;
  for (let k = 0; k < 6; k++) {
    const a = 1 + Math.floor(G.rng() * (N - 1)), n = G.nations[a]; if (!n || a === me) continue;
    const p = n.persona = n.persona || makePersona(n);
    const b = 1 + Math.floor(G.rng() * (N - 1)); if (b === a) continue;
    const o = G.nations[b], rel = relation(a, b), ca = World.countries[a], cb = World.countries[b];
    if (rel > 35 && !hasTreaty(a, b, 'trade') && G.rng() < p.greed / 150 && b !== me) { G.treaties.push({ type: 'trade', a, b, since: G.day }); newsWorld(ca.name + ' and ' + cb.name + ' sign a free trade deal'); }
    else if (rel < -45 && gdpUsd(n) > gdpUsd(o) && G.rng() < p.aggr / 400 && !G.sanctions.some(s => s.by === a && s.on === b) && b !== me) { G.sanctions.push({ by: a, on: b, level: 1, since: G.day }); newsWorld(ca.name + ' puts sanctions on ' + cb.name); }
    else if (rel < -60 && G.rng() < 0.15) { addRel(a, b, -5); newsWorld(ca.name + ' denounces ' + cb.name); }
    else if (rel > 20) addRel(a, b, 2);
  }
  // someone asks the player for something
  if (G.rng() < 0.35) {
    const cands = G.nations.filter(m => m && m.idx !== me), m = cands[Math.floor(G.rng() * cands.length)], rel = relation(m.idx, me), c = World.countries[m.idx];
    let req = null;
    if (rel > 25 && !hasTreaty(m.idx, me, 'trade')) req = { type: 'trade', text: c.name + ' proposes a free trade deal.' };
    else if (m.dev < 0.4 && rel > 0 && m.stability < 45) req = { type: 'aid', text: c.name + ' asks for emergency aid of ' + usd(gdpUsd(G.nations[me]) * 0.0005) + '.' };
    else if (rel < -40 && G.nations[me].nukes === 0 && (m.persona || makePersona(m)).aggr > 60) req = { type: 'threat', text: c.name + ' demands you stop criticising them, or else.' };
    else if (rel > 45 && !hasTreaty(m.idx, me, 'defence') && G.rng() < 0.3) req = { type: 'defence', text: c.name + ' offers a defence pact.' };
    if (req) { G.requests.push(Object.assign(req, { from: m.idx, day: G.day, until: G.day + 60 })); inbox('info', 'Message from ' + c.name, req.text + ' Answer it in Diplomacy.'); }
  }
  G.requests = G.requests.filter(r => r.until > G.day);
}
function unscRotate() {
  const elig = G.nations.filter(m => m && !m.blocs.includes('UNSC'));
  G.unsc = []; while (G.unsc.length < 10) { const m = elig[Math.floor(G.rng() * elig.length)]; if (!G.unsc.includes(m.idx)) G.unsc.push(m.idx); }
}
function diploAbroad(n, v) { // the world's public reacts to what we do; democracies' leaders follow their public
  for (const m of G.nations) if (m && m.idx !== n.idx) addRel(n.idx, m.idx, v * (0.3 + m.dem / 15));
}

// ---- what the player can do to another country
function acceptChance(target, value, extra = 0) {
  const me = G.player.idx, rel = relation(target, me), p = G.nations[target].persona || (G.nations[target].persona = makePersona(G.nations[target]));
  const trust = G.trust[PAIR(target, me)] == null ? 50 : G.trust[PAIR(target, me)];
  const dip = G.player.traits.includes('diplomat') ? 10 : 0, minister = (G.nations[me].cabinet ? G.nations[me].cabinet.foreign.skill - 5 : 0) * 2;
  const parts = [['What they get out of it', value], ['How they feel about you', 0.4 * rel], ['Trust', 0.3 * (trust - 50)], ['Their personality', extra], ['Your diplomacy', dip + minister]];
  const x = parts.reduce((a, q) => a + q[1], 0);
  return { p: 1 / (1 + Math.exp(-(x - 10) / 10)), parts };
}
const ACTIONS = [
  { id: 'call', name: 'Phone call', pc: 1, desc: 'A friendly chat. Small boost to relations.', cool: 30 },
  { id: 'visit', name: 'State visit', pc: 3, desc: 'Fly over with cameras. Bigger boost; you can talk deals there.', cool: 120 },
  { id: 'aid', name: 'Send aid', pc: 1, desc: 'Give 0.05% of our GDP. They like it; their people like it more.' },
  { id: 'trade', name: 'Propose free trade deal', pc: 4, ask: true, desc: 'Both economies grow; some of our workers and farmers dislike competition.' },
  { id: 'defence', name: 'Propose defence pact', pc: 5, ask: true, desc: 'Each side must help if the other is attacked.' },
  { id: 'nonagg', name: 'Propose non-aggression pact', pc: 3, ask: true, desc: 'A promise not to attack each other.' },
  { id: 'tech', name: 'Propose technology sharing', pc: 3, ask: true, desc: 'Both research faster.' },
  { id: 'base', name: 'Ask to host a military base', pc: 4, ask: true, desc: 'Project power in their region. Their people may object.' },
  { id: 'arms', name: 'Sell them weapons', pc: 2, ask: true, desc: 'Money for us, a stronger army for them. Their rivals will be angry.' },
  { id: 'tariff', name: 'Put tariffs on their goods', pc: 2, desc: 'Protects our factories, raises our prices, hurts them.' },
  { id: 'sanction', name: 'Sanctions', pc: 3, desc: 'Cut business with them. Hurts them, costs us a little. A reserve currency used this way loses trust.' },
  { id: 'embargo', name: 'Full embargo', pc: 5, desc: 'Stop all trade. Big damage, big anger.' },
  { id: 'lift', name: 'Lift sanctions and tariffs', pc: 2, desc: 'End our sanctions and tariffs on them.' },
  { id: 'denounce', name: 'Denounce them publicly', pc: 1, desc: 'Relations drop. Popular at home if people dislike them.' },
  { id: 'expel', name: 'Expel their diplomats', pc: 2, desc: 'A sharp insult.' },
  { id: 'apologise', name: 'Apologise', pc: 2, desc: 'Repair some damage. Proud voters may not like it.' },
  { id: 'cancel', name: 'Cancel all treaties with them', pc: 2, desc: 'Tear up deals. They will remember.' }
];
const DiploAct = {
  available(t) {
    const me = G.player.idx, n = G.nations[me];
    return ACTIONS.filter(a => {
      if (a.id === 'trade' || a.id === 'defence' || a.id === 'nonagg' || a.id === 'tech' || a.id === 'base') return !hasTreaty(me, t, a.id);
      if (a.id === 'lift') return G.sanctions.some(s => s.by === me && s.on === t) || (G.tariffs || []).some(s => s.by === me && s.on === t);
      if (a.id === 'sanction') return !G.sanctions.some(s => s.by === me && s.on === t);
      if (a.id === 'embargo') return !G.sanctions.some(s => s.by === me && s.on === t && s.level >= 2);
      if (a.id === 'tariff') return !(G.tariffs || []).some(s => s.by === me && s.on === t);
      if (a.id === 'cancel') return G.treaties.some(x => (x.a === me && x.b === t) || (x.a === t && x.b === me));
      return true;
    });
  },
  value(a, t) { // what an "ask" is worth to them
    const me = G.player.idx, m = G.nations[t], n = G.nations[me], p = m.persona || (m.persona = makePersona(m)), size = Math.log10(gdpUsd(n) / gdpUsd(m));
    return { trade: 10 + size * 8 + p.greed / 10, defence: (n.milx > m.milx ? 12 : -5) + size * 5 - p.paranoia / 10, nonagg: 15 - p.aggr / 6, tech: 8 + (n.dev - m.dev) * 30, base: -10 + size * 6 - p.pride / 8, arms: 12 + p.aggr / 8 }[a] || 0;
  },
  chance(a, t) { const m = G.nations[t], p = m.persona || (m.persona = makePersona(m)); return acceptChance(t, this.value(a, t), a === 'base' ? -p.pride / 10 : a === 'arms' ? p.aggr / 10 - 5 : 0); },
  cooldown(a, t) { const k = a + ':' + t; return G.cool[k] && G.cool[k] > G.day ? G.cool[k] - G.day : 0; },
  run(a, t) {
    const me = G.player.idx, n = G.nations[me], m = G.nations[t], A = ACTIONS.find(x => x.id === a), c = World.countries[t], mine = World.countries[me];
    if (this.cooldown(a, t)) return 'Too soon to do that again.';
    if (n.pc < A.pc) return 'Not enough political capital.';
    n.pc -= A.pc; if (A.cool) G.cool[a + ':' + t] = G.day + A.cool;
    const pubView = relation(me, t); // what our public thinks of them, roughly
    const say = (title, stance, size, abroad) => react(n, { title, stance, size, abroad, topic: c.name.replace(/ /g, '') });
    if (A.ask) {
      const ch = this.chance(a, t);
      if (G.rng() > ch.p) { addRel(me, t, -3); return c.name + ' said no.'; }
    }
    switch (a) {
      case 'call': addRel(me, t, 4); return 'A warm call with ' + m.leader + '.';
      case 'visit': addRel(me, t, 9); say('State visit to ' + c.name, { business: 2, media: 1 }, 0.6); Talks.open(t); return 'Welcome ceremony in ' + c.capital + '.';
      case 'aid': { const amt = gdpL(n) * 0.0005; n.debt += amt; m.evStab += 2; addRel(me, t, 10); diploAbroad(n, 1); say('Aid sent to ' + c.name, { workers: -1, media: 2 }, 0.5); return usd(amt * n.fx / 100) + ' of aid sent.'; }
      case 'trade': case 'defence': case 'nonagg': case 'tech': case 'base':
        G.treaties.push({ type: a, a: me, b: t, since: G.day }); G.trust[PAIR(t, me)] = (G.trust[PAIR(t, me)] || 50) + 5;
        if (a === 'trade') say('Free trade deal with ' + c.name, { business: 5, farmers: -3, workers: -2 }, 1);
        if (a === 'defence') say('Defence pact with ' + c.name, { military: 4, students: -2 }, 0.8);
        if (a === 'base') { say('New military base in ' + c.name, { military: 4 }, 0.6); for (const o of G.nations) if (o && relation(o.idx, t) < -30) addRel(me, o.idx, -6); }
        if (a === 'tech') setMod(n, 'growth', 'Technology sharing', 0.05 * G.treaties.filter(x => x.type === 'tech' && (x.a === me || x.b === me)).length);
        newsWorld(mine.name + ' and ' + c.name + ': ' + TREATIES[a].name); return TREATIES[a].name + ' signed!';
      case 'arms': { const amt = Math.min(gdpUsd(m) * 0.003, gdpUsd(n) * 0.002); n.income = n.income || {}; n.income['Arms sales'] = (n.income['Arms sales'] || 0) + amt / gdpUsd(n) * 100 / 3; m.milx *= 1.05; addRel(me, t, 8); for (const o of G.nations) if (o && relation(o.idx, t) < -40) addRel(me, o.idx, -8); say('Arms deal with ' + c.name, { business: 3, military: 2, students: -3 }, 0.7, -1); return 'Weapons sold for ' + usd(amt) + '.'; }
      case 'tariff': G.tariffs.push({ by: me, on: t, pct: 25, since: G.day }); addRel(me, t, -15); setMod(n, 'infl', 'Our tariffs', 0.3 * G.tariffs.filter(x => x.by === me).reduce((s, x) => s + gdpUsd(G.nations[x.on]) / G.world.worldGdp * 10, 0)); say('25% tariffs on ' + c.name, { workers: 3, farmers: 3, business: -4 }, 0.8); return 'Tariffs announced.';
      case 'sanction': G.sanctions.push({ by: me, on: t, level: 1, since: G.day }); addRel(me, t, -10); say('Sanctions on ' + c.name, pubView < -20 ? { military: 2, media: 1 } : { business: -3 }, 0.8, -1); return 'Sanctions in place.';
      case 'embargo': { const s = G.sanctions.find(x => x.by === me && x.on === t); if (s) s.level = 2; else G.sanctions.push({ by: me, on: t, level: 2, since: G.day }); addRel(me, t, -20); say('Full embargo on ' + c.name, { business: -5, military: 3 }, 1.2, -3); return 'Embargo in force.'; }
      case 'lift': G.sanctions = G.sanctions.filter(x => !(x.by === me && x.on === t)); G.tariffs = G.tariffs.filter(x => !(x.by === me && x.on === t)); addRel(me, t, 10); say('Sanctions lifted on ' + c.name, { business: 3 }, 0.6); return 'Lifted.';
      case 'denounce': addRel(me, t, -12); say(mine.name + ' leader denounces ' + c.name, pubView < -20 ? { military: 3, religious: 1 } : { media: -1 }, 0.6, -0.5); return 'Strong words.';
      case 'expel': addRel(me, t, -18); say('Diplomats from ' + c.name + ' expelled', { police: 2, media: -1 }, 0.7, -1); return 'Expelled.';
      case 'apologise': addRel(me, t, 12); G.trust[PAIR(t, me)] = (G.trust[PAIR(t, me)] || 50) + 4; say('Apology to ' + c.name, { military: -2, media: 1 }, 0.5); return 'Apology accepted.';
      case 'cancel': G.treaties = G.treaties.filter(x => !((x.a === me && x.b === t) || (x.a === t && x.b === me))); addRel(me, t, -25); G.trust[PAIR(t, me)] = (G.trust[PAIR(t, me)] || 50) - 25; for (const o of G.nations) if (o) addRel(me, o.idx, -1); say('Treaties with ' + c.name + ' torn up', { media: -2 }, 0.8, -2); return 'Treaties cancelled. Others now trust us less.';
    }
  },
  answer(i, yes) {
    const r = G.requests[i], me = G.player.idx; if (!r) return;
    G.requests.splice(i, 1);
    const c = World.countries[r.from], n = G.nations[me];
    if (r.type === 'joinwar' || r.type === 'peace') {
      const w = G.wars.find(x => x.id === r.war); if (!w) return;
      if (r.type === 'joinwar') { if (yes) { joinWar(w, me, r.side); react(n, { title: 'We join the war to defend ' + c.name, stance: { military: 5, students: -5, business: -3 }, size: 1.5, topic: 'War' }); } else { addRel(me, r.from, -25); G.trust[PAIR(r.from, me)] = (G.trust[PAIR(r.from, me)] || 50) - 20; } }
      else if (yes) { const mine = w.a.includes(me) ? w.score : -w.score; endWar(w, mine > 35 ? (w.a.includes(me) ? 'a' : 'd') : 'white', 'talks'); }
      syncWarVisuals(); return;
    }
    if (!yes) { addRel(me, r.from, r.type === 'threat' ? 5 : -6); if (r.type === 'threat') { addRel(me, r.from, -15); react(n, { title: 'We refuse to bow to ' + c.name, stance: { military: 3 }, size: 0.6 }); } return; }
    if (r.type === 'trade' || r.type === 'defence') { G.treaties.push({ type: r.type, a: me, b: r.from, since: G.day }); react(n, { title: TREATIES[r.type].name + ' with ' + c.name, stance: r.type === 'trade' ? { business: 4, farmers: -2 } : { military: 3 }, size: 0.8 }); }
    if (r.type === 'aid') { const amt = gdpL(n) * 0.0005; n.debt += amt; addRel(me, r.from, 12); G.nations[r.from].evStab += 2; }
    if (r.type === 'threat') { addRel(me, r.from, 10); react(n, { title: 'Government gives in to ' + c.name, stance: { military: -5, media: -3 }, size: 0.8 }); }
  },
  joinOrg(id) {
    const me = G.player.idx, n = G.nations[me], o = ORGS[id], c = World.countries[me];
    if (n.blocs.includes(id)) return 'Already a member.';
    if (!o.can(c, n)) return 'We cannot join this one.';
    if (n.freedom / 10 < o.need) return 'Members want a freer country first (freedom ' + o.need * 10 + '+).';
    const mem = orgMembers(id), yes = mem.filter(m => relation(m.idx, me) > 5).length;
    if (mem.length && yes < mem.length * 0.6) return 'Members voted no (' + yes + ' of ' + mem.length + ').';
    if (n.pc < 8) return 'Not enough political capital.'; n.pc -= 8;
    n.blocs.push(id); for (const m of mem) addRel(me, m.idx, 10);
    if (o.fx.g) setMod(n, 'growth', id + ' membership', o.fx.g); if (o.fx.s) setMod(n, 'stability', id + ' membership', o.fx.s);
    react(n, { title: c.name + ' joins ' + o.name, stance: { business: 3, media: 2 }, size: 1.2, abroad: 2 }); newsWorld(c.name + ' joins ' + o.name);
    return 'Welcome to ' + o.name + '!';
  },
  leaveOrg(id) {
    const me = G.player.idx, n = G.nations[me], o = ORGS[id] || { name: BLOCS[id] || id, fx: {}, leaveFx: {} }, c = World.countries[me];
    if (!n.blocs.includes(id) || id === 'UNSC' || id === 'G7' || id === 'G20' || id === 'OECD') return 'Not possible.';
    if (n.pc < 6) return 'Not enough political capital.'; n.pc -= 6;
    n.blocs = n.blocs.filter(b => b !== id); for (const m of orgMembers(id)) addRel(me, m.idx, -12);
    setMod(n, 'growth', id + ' membership', (o.leaveFx || {}).g || 0); setMod(n, 'stability', id + ' membership', (o.leaveFx || {}).s || 0);
    react(n, { title: c.name + ' leaves ' + o.name, stance: { business: -4, military: 1, retirees: 1 }, size: 1.5, abroad: -3 }); newsWorld(c.name + ' leaves ' + o.name);
    return 'We have left ' + o.name + '.';
  },
  // UN Security Council resolution: condemn or sanction a country; any permanent member can veto
  resolution(kind, t) {
    const me = G.player.idx, n = G.nations[me]; if (n.pc < 6) return 'Not enough political capital.'; n.pc -= 6;
    const council = G.nations.filter(m => m && (m.blocs.includes('UNSC') || G.unsc.includes(m.idx)));
    let yes = 0, veto = null;
    for (const m of council) {
      if (m.idx === t) { if (m.blocs.includes('UNSC')) veto = m; continue; }
      const v = m.idx === me || (relation(m.idx, t) < -5 && relation(m.idx, me) > -30) || relation(m.idx, me) > 40;
      if (v) yes++; else if (m.blocs.includes('UNSC') && relation(m.idx, t) > 25) veto = veto || m;
    }
    const c = World.countries[t], pass = !veto && yes >= 9;
    newsWorld('UN vote to ' + kind + ' ' + c.name + ': ' + (pass ? 'passed' : veto ? 'vetoed by ' + World.countries[veto.idx].name : 'failed') + ' (' + yes + ' votes)');
    if (pass) { for (const m of G.nations) if (m && m.idx !== t) addRel(m.idx, t, kind === 'sanction' ? -10 : -5); if (kind === 'sanction') for (const m of council) if (m.idx !== t && !G.sanctions.some(s => s.by === m.idx && s.on === t)) G.sanctions.push({ by: m.idx, on: t, level: 1, since: G.day }); G.nations[t].evStab -= 3; }
    addRel(me, t, -10);
    react(n, { title: 'UN resolution against ' + c.name + (pass ? ' passes' : ' fails'), stance: pass ? { media: 2 } : {}, size: 0.6, abroad: pass ? 2 : 0 });
    return pass ? 'Resolution passed with ' + yes + ' votes.' : veto ? World.countries[veto.idx].name + ' vetoed it.' : 'Only ' + yes + ' votes (needs 9).';
  }
};
// talks during a visit: one exchange, the answer that fits their personality works best
const Talks = {
  open(t) {
    const m = G.nations[t], p = m.persona || (m.persona = makePersona(m)), c = World.countries[t];
    const opts = [['Flatter them: praise their leadership', p.pride / 10], ['Talk money: offer investment', p.greed / 10], ['Be firm: warn about consequences', (p.aggr > 60 ? -6 : 2) + (p.paranoia > 70 ? -3 : 0)], ['Be honest: admit our disagreements', p.honor / 12]];
    UI.modal(`<h2>Talks with ${esc(m.title + ' ' + m.leader)}</h2><p class="sub" style="font-size:14px">${esc(c.name)}: ${esc(personaText(p))}. How do you open?</p>
      <div class="menu" style="width:auto">${opts.map((o, i) => `<button class="btn" data-talk="${i}">${o[0]}</button>`).join('')}</div>`);
    $$('[data-talk]').forEach(b => b.onclick = () => { const v = opts[+b.dataset.talk][1] + (G.rng() - 0.5) * 4; addRel(G.player.idx, t, v); UI.closeModal(); toast(v > 4 ? 'They loved it. Relations up.' : v < 0 ? 'That went badly.' : 'Polite smiles.'); Bus.emit('changed'); });
  }
};
SYSTEM_INITS.push(g => {
  if (!Diplo.base) buildBaseRelations();
  g.relD = g.relD || {}; g.trust = g.trust || {}; g.treaties = g.treaties || []; g.sanctions = g.sanctions || []; g.tariffs = g.tariffs || []; g.requests = g.requests || []; g.cool = g.cool || {};
  if (!g.unsc) { const r = makeRng(g.seed + 3), elig = g.nations.filter(m => m && !m.blocs.includes('UNSC')); g.unsc = []; while (g.unsc.length < 10) { const m = elig[Math.floor(r() * elig.length)]; if (!g.unsc.includes(m.idx)) g.unsc.push(m.idx); } }
  if (!g.sanctionsInit) { // the world of 2026 already has sanctions on Russia, Iran, North Korea, Venezuela...
    g.sanctionsInit = true;
    const S = [['USA', 'RUS', 2], ['GBR', 'RUS', 2], ['CAN', 'RUS', 1], ['JPN', 'RUS', 1], ['AUS', 'RUS', 1], ['CHE', 'RUS', 1], ['USA', 'IRN', 2], ['USA', 'PRK', 2], ['USA', 'CUB', 2], ['USA', 'VEN', 1], ['USA', 'SYR', 1]];
    for (const m of g.nations) if (m && m.blocs.includes('EU')) S.push([m.id, 'RUS', 1]);
    for (const [a, b, l] of S) { const A = World.byId[a].idx, B = World.byId[b].idx; if (!g.sanctions.some(s => s.by === A && s.on === B)) g.sanctions.push({ by: A, on: B, level: l, since: 0 }); }
  }
  for (const m of g.nations) if (m && !m.persona) m.persona = makePersona(m);
});
MONTHLY.push(diploMonth);
MapModes.add('rel', 'Relations', c => { if (!G) return '#5b6270'; const v = c.idx === G.player.idx ? 100 : relation(c.idx, G.player.idx); return c.idx === G.player.idx ? '#e2b65c' : divColor(v / 80); }, { type: 'div', lo: 'Hostile', mid: '', hi: 'Friendly', title: 'Relations with you' });
