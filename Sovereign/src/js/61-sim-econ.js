// The formulas. Every month each nation runs econMonth(); every number keeps a "Why?" list of what moved it.
// Effects are measured against the nation's starting point (n.base), so the real 2026 numbers are where it begins.
const RATING_SPREAD = r => r >= 20 ? 0.1 : r >= 17 ? 0.35 : r >= 14 ? 0.7 : r >= 12 ? 1.3 : r >= 9 ? 2.6 : r >= 6 ? 4.6 : r >= 3 ? 9 : 15;
const soft = (x, k = 4) => x / (1 + Math.abs(x) / k);       // diminishing returns
const cut = (x, k = 4, hurt = 1.4) => soft(x, k) * (x < 0 ? hurt : 1); // cuts hurt more than raises help

const TRAITS = [
  { id: 'charismatic', name: 'Charismatic', desc: '+5 approval', mods: { approval: 5 } },
  { id: 'economist', name: 'Economist', desc: '+0.3% growth a year', mods: { growth: 0.3 } },
  { id: 'warhero', name: 'War Hero', desc: 'The army trusts you: +6 stability', mods: { stability: 6 } },
  { id: 'diplomat', name: 'Diplomat', desc: 'Better deals abroad (diplomacy update)', mods: { diplomacy: 10 } },
  { id: 'populist', name: 'Populist', desc: 'Spending wins more approval, business is wary', mods: { spendPop: 1.3, growth: -0.1 } },
  { id: 'technocrat', name: 'Technocrat', desc: 'Investment pays off 25% better', mods: { invest: 1.25, approval: -2 } },
  { id: 'honest', name: 'Honest', desc: 'Less corruption, taxes collected better', mods: { corruption: -0.08 } },
  { id: 'corrupt', name: 'Corrupt', desc: 'More corruption, but loyal friends: +4 stability', mods: { corruption: 0.08, stability: 4 } },
  { id: 'ironfist', name: 'Iron Fist', desc: '+8 stability, -4 approval in free countries', mods: { stability: 8, approvalFree: -4 } },
  { id: 'reformer', name: 'Reformer', desc: 'Long honeymoon: 24 months', mods: { honeymoon: 24 } },
  { id: 'mediadarling', name: 'Media Darling', desc: 'Scandals hurt half as much (events update)', mods: { approval: 2 } },
  { id: 'frugal', name: 'Frugal', desc: 'Borrowing costs 0.4% lower', mods: { yield: -0.4 } },
  { id: 'spender', name: 'Big Spender', desc: '+3 approval, borrowing costs 0.3% higher', mods: { approval: 3, yield: 0.3 } },
  { id: 'green', name: 'Green', desc: 'Environment spending also lifts approval', mods: { greenPop: 1 } },
  { id: 'hawk', name: 'Hawk', desc: 'Defence spending lifts stability', mods: { hawk: 1 } },
  { id: 'unifier', name: 'Unifier', desc: '+4 stability, +2 approval', mods: { stability: 4, approval: 2 } },
  { id: 'young', name: 'Young', desc: '+3 approval with energy, -2 stability (inexperience)', mods: { approval: 3, stability: -2 } },
  { id: 'veteran', name: 'Veteran Politician', desc: '+3 stability, no honeymoon fatigue for 4 years', mods: { stability: 3, fatigue: 48 } },
  { id: 'wealthy', name: 'Self-made Billionaire', desc: 'Business booms (+0.2% growth), -3 approval', mods: { growth: 0.2, approval: -3 } },
  { id: 'scholar', name: 'Scholar', desc: 'Research and education pay off 30% better', mods: { learn: 1.3 } }
];
function applyTraits(n, ids) {
  const m = { approval: 0, growth: 0, stability: 0, corruption: 0, yield: 0, approvalFree: 0, honeymoon: 12, fatigue: 30, invest: 1, learn: 1, spendPop: 1, greenPop: 0, hawk: 0 };
  for (const id of ids) { const t = TRAITS.find(x => x.id === id); if (!t) continue; for (const k in t.mods) m[k] = ['invest', 'learn', 'spendPop', 'honeymoon', 'fatigue'].includes(k) ? t.mods[k] : (m[k] || 0) + t.mods[k]; }
  if (GOV[n.gov].free) m.approval += m.approvalFree;
  n.mods = m;
  n.corruption = clamp(n.base.corruption + m.corruption, 0.02, 0.9);
}

// Named effects added by other systems (laws, war, trade, events, technology...): n.mod.growth['Trade deals'] = 0.3
function extra(n, k) { const m = n.mod && n.mod[k]; return m ? Object.entries(m).filter(e => e[1]) : []; }
function setMod(n, stat, label, v) { n.mod = n.mod || {}; (n.mod[stat] = n.mod[stat] || {})[label] = v; }
const sumMap = m => { let a = 0; if (m) for (const k in m) a += m[k]; return a; };
function potentialOf(n) { return clamp(5.5 - 4.2 * n.dev, 1.2, 6); }
function safeDebt(n) { return 60 + 160 * reserveShareOf(n) + 45 * n.dev; }
function reserveShareOf(n) { const c = G.cur[n.mon.cur]; return c && (n.mon.type === 'float' || n.mon.type === 'union') ? c.share : 0; }
function reserveAbsorb(n) { return clamp(reserveShareOf(n) * 1.25, 0, 0.8); }
function gdpL(n) { return n.real * n.P; }
function gdpUsd(n) { return n.real * n.P * n.fx / 100; }
function debtPct(n) { return n.debt / gdpL(n) * 100; }
function anchorNation(code) { return code === 'EUR' ? null : G.nations[World.byId[CUR_ISSUER[code]] ? World.byId[CUR_ISSUER[code]].idx : 0]; }

// Snapshot of where each nation starts: all effects are relative to this
function calibrate() {
  for (const n of G.nations) {
    if (!n) continue;
    const rev = revenueOf(n).total;
    n.pot = potentialOf(n);
    n.base = {
      growth: n.growth, infl: n.infl, un: n.unemp, debtPct: n.debt / gdpL(n) * 100, approval: n.approval, stability: n.stability,
      rev, tax: Object.assign({}, n.tax), spend: Object.assign({}, n.spend), k: Object.assign({}, n.k), rate: n.mon.rate,
      realRate: n.mon.rate - n.infl, corruption: n.corruption, offG: n.growth - n.pot, rent: n.rent
    };
    n.feel = { infl: n.infl, un: n.unemp, growth: n.growth };
    n.base.feel = feelOf(n);
    n.mods = n.mods || { approval: 0, growth: 0, stability: 0, yield: 0, honeymoon: 12, fatigue: 30, invest: 1, learn: 1, spendPop: 1, greenPop: 0, hawk: 0 };
    n.fx12 = [];
    n.evAppr = 0; n.evStab = 0;
  }
  // ratings for unrated states, starting yields, interest bills, deficits
  for (const n of G.nations) {
    if (!n) continue;
    n.ratingOff = 0;
    const f = ratingFormula(n);
    if (n.rating < 0) n.rating = clamp(Math.round(f), 2, 19), n.unrated = true;
    n.ratingOff = n.rating - f;
    if (n.rating <= 1) n.defaulted = 36; // already in default: not paying full interest
    n.yield = yieldOf(n); n.effRate = 0.7 * n.yield; // older debt was borrowed at older, lower rates
    balanceStart(n);
  }
  world0();
  for (const n of G.nations) if (n) { n.mon.rateOff = n.mon.rate - taylorOf(n); n.base.fxT = 1; }
  for (const code in G.cur) { const t = currencyTrust(code); G.cur[code].trust = G.cur[code].trust0 = t.total; }
  for (const n of G.nations) if (n && n.mon.type === 'float' && !G.cur[n.mon.cur]) n.trust0 = currencyTrust(n.mon.cur).total;
}
// Start every budget near a normal deficit once interest is counted (inflation-adjusted, about 2.5% of GDP)
function opDeficit(n, bud) { return bud.deficit - n.infl * (n.debt / gdpL(n)); }
function balanceStart(n) {
  const want = n.rent > 10 ? -2 : 2.5;
  for (let i = 0; i < 8; i++) {
    const gap = opDeficit(n, budgetOf(n)) - want; if (Math.abs(gap) < 0.2) break;
    const r = revenueOf(n).total || 1, k = clamp(1 + gap / r, 0.7, 1.5);
    // keep rates believable: a country that cannot balance at normal rates simply starts with a bigger deficit
    n.tax.income = clamp(n.tax.income * k, 0, 15 + 30 * n.dev); n.tax.sales = clamp(n.tax.sales * k, 0, 12 + 13 * n.dev); n.tax.corporate = clamp(n.tax.corporate * Math.sqrt(k), 5, 30);
  }
  const gap = opDeficit(n, budgetOf(n)) - want;
  if (gap > 2.5) { const sp = spendOf(n) - n.spend.defence, k = clamp(1 - (gap - 2.5) / sp, 0.7, 1); for (const m of MINISTRIES) if (m.id !== 'defence') n.spend[m.id] = +(n.spend[m.id] * k).toFixed(2); }
  for (const k in n.tax) n.tax[k] = Math.round(n.tax[k] * 2) / 2;
  const b = n.base, bud = budgetOf(n);
  b.rev = bud.rev; b.tax = Object.assign({}, n.tax); b.spend = Object.assign({}, n.spend); b.deficit = bud.deficit; b.opDef = opDeficit(n, bud);
  n.k = { infra: n.spend.infrastructure, know: n.spend.science, human: n.spend.education, health: n.spend.health }; b.k = Object.assign({}, n.k);
}
function world0() {
  const W = G.world, ez = currencyMembers('EUR').filter(n => n.mon.type === 'union');
  W.ezGdp0 = ez.reduce((a, n) => a + gdpL(n), 0);
  W.ecb = 2.0; W.ecbOff = 0; W.ecbOff = W.ecb - ecbTaylor(); W.usP = 1; W.ezP = 1; W.eurFx = 100;
  W.worldGdp0 = G.nations.reduce((a, n) => a + (n ? gdpUsd(n) : 0), 0); W.worldGdp = W.worldGdp0;
}
function ecbTaylor() {
  const ez = currencyMembers('EUR').filter(n => n.mon.type === 'union'); let wsum = 0, inf = 0, gap = 0;
  for (const n of ez) { const w = gdpL(n); wsum += w; inf += n.infl * w; gap += (n.growth - n.pot - n.base.offG) * w; }
  inf /= wsum; gap /= wsum;
  return Math.max(0, 1 + 2 + 0.6 * (inf - 2) + 0.4 * gap) + (G.world.ecbOff || 0);
}
function taylorOf(n) {
  const neutral = n.dev > 0.6 ? 1 : 2.5;
  return Math.max(0, neutral + n.mon.anchorInfl + 0.6 * (n.infl - n.mon.target) + 0.4 * (n.growth - n.pot - n.base.offG)) + (n.mon.rateOff || 0);
}
function ratingFormula(n) {
  const d = n.debt / gdpL(n) * 100;
  return 8 + 9 * n.dev - 0.035 * d + 0.12 * n.growth - 0.05 * Math.max(0, n.infl - 6) + 0.07 * (n.stability - 50) - (n.defaulted > 0 ? 6 : 0)
    + 12 * reserveShareOf(n) + (n.ratingOff || 0);
}
function yieldOf(n) {
  const b = n.base, d = n.debt / gdpL(n) * 100, safe = safeDebt(n);
  const ex = Math.max(0, d - Math.max(b.debtPct, safe));
  const parts = [
    ['Central bank rate', n.mon.rate * 0.8 + 0.2 * Math.max(n.mon.anchorInfl, 0)],
    ['Long-term premium', 0.7],
    ['Credit rating ' + RATINGS[clamp(n.rating, 0, 21)], RATING_SPREAD(n.rating)],
    ['Too much debt', 0.035 * ex + 0.0008 * ex * ex],
    ['Instability', 0.05 * Math.max(0, b.stability - n.stability)],
    ['Reserve currency', -4 * (reserveShareOf(n) - (G.cur[n.mon.cur] ? G.cur[n.mon.cur].share0 : 0)) * (n.mon.type === 'float' || n.mon.type === 'union' ? 1 : 0)],
    ['Past default', n.defaulted > 0 ? 6 * n.defaulted / 60 : 0],
    ['Leader traits', n.mods.yield || 0],
    ...extra(n, 'yield')
  ];
  let y = parts.reduce((a, p) => a + p[1], 0);
  if (n.imf > 0 && y > 6) { parts.push(['IMF programme', 6 - y]); y = 6; }
  n.why.yield = parts;
  return Math.max(0.1, y);
}
function budgetOf(n) {
  const rev = revenueOf(n), W = G.world, gl = gdpL(n);
  const rent = n.rent * (n.rentMult || 1) * (n.res.includes('oil') || n.res.includes('gas') ? W.oil / 100 : 1);
  const seign = reserveShareOf(n) * 0.9;
  const other = sumMap(n.cost), income = sumMap(n.income); // laws, projects, wars, aid / arms sales, state companies
  const spend = spendOf(n) + other, interest = n.debt * n.effRate / 100 / gl * 100;
  return { rev: rev.total + income, parts: rev.parts, rent, seign, spend, other, income, interest, deficit: spend + interest - rev.total - income - rent - seign };
}
function feelOf(n) { return -1.8 * (n.feel.infl - 3) - 1.4 * (n.feel.un - 5) + 0.6 * (n.feel.growth - 2); }

function econMonth(n, noise = true) {
  const b = n.base, W = G.world, m = n.mods, mon = n.mon, why = {};
  const R = noise ? () => G.rng() - 0.5 : () => 0;
  const sum = (k, parts) => { why[k] = parts; return parts.reduce((a, p) => a + p[1], 0); };
  // slow-moving foundations (what spending builds over years)
  n.k.infra += (n.spend.infrastructure - n.k.infra) / 30; n.k.know += (n.spend.science - n.k.know) / 60;
  n.k.human += (n.spend.education - n.k.human) / 72; n.k.health += (n.spend.health - n.k.health) / 36;
  const bud = n.budget = budgetOf(n), d = n.debt / gdpL(n) * 100, safe = safeDebt(n);
  const dOp = opDeficit(n, bud) - b.opDef; // change in the inflation-adjusted deficit (inflation eats old debt)
  const stress = clamp((d - Math.max(b.debtPct, safe)) / 80, 0, 1) + (n.crisis ? 0.5 : 0), absorb = reserveAbsorb(n);
  const realRate = mon.rate - n.infl, qe = mon.qe || 0;
  const oilX = (n.res.includes('oil') || n.res.includes('gas')) ? n.rent / 10 : -0.25;
  const fxGap = mon.type === 'float' ? clamp(0.015 * (100 * W.usP / n.P - n.fx) * n.open, -1.5, 1.5) : 0;
  n.shock = n.shock * 0.92 + R() * 0.35;
  // growth
  const gT = sum('growth', [
    ['Long-term trend', n.pot + b.offG],
    ['Infrastructure', 0.35 * m.invest * (n.k.infra - b.k.infra)],
    ['Research', 0.6 * m.learn * (n.k.know - b.k.know)],
    ['Education', 0.3 * m.learn * (n.k.human - b.k.human)],
    ['Health', 0.12 * (n.k.health - b.k.health)],
    ['Taxes', -0.08 * (bud.rev - bud.income - b.rev) - 0.03 * (n.tax.corporate - b.tax.corporate)],
    ['Import tariffs', -0.08 * (n.tax.tariff - b.tax.tariff) * n.open],
    ['Government borrowing', clamp(0.22 * dOp * (1 - Math.min(1, stress)), -3, 3)],
    ['Interest rates', clamp(-0.15 * (realRate - b.realRate), -3, 3)],
    ['Printing money', 0.12 * Math.min(qe, 8)],
    ['High inflation', clamp(-0.08 * (Math.max(0, n.infl - 10) - Math.max(0, b.infl - 10)), -6, 6)],
    ['Unrest', -0.06 * (b.stability - n.stability)],
    ['Debt worries', -1.6 * stress],
    ['Exchange rate', fxGap],
    ['World economy', W.cycle * (0.5 + n.open)],
    ['Oil prices', clamp(0.02 * (W.oil - 100) * oilX, -3, 3)],
    ['Leader traits', m.growth],
    ['Events', n.evGrowth || 0],
    ['Luck', n.shock],
    ...extra(n, 'growth')
  ]);
  n.growth += (clamp(gT, -25, 25) - n.growth) * 0.3;
  n.real *= 1 + n.growth / 1200; n.pop *= 1 + n.popGrowth / 1200;
  n.pot += (potentialOf(n) - n.pot) * 0.002; b.offG *= Math.abs(b.offG) > 3 ? 0.985 : 0.9985; // war-hit economies bounce back faster // very slowly, every country drifts toward its natural trend
  // inflation
  if (mon.type === 'float') mon.anchorInfl += (mon.independent ? (mon.target - mon.anchorInfl) * 0.02 : (n.infl - mon.anchorInfl) * 0.06);
  else { const a = mon.anchor === 'EUR' ? 2 : (anchorNation(mon.anchor) || n).infl; mon.anchorInfl += (a - mon.anchorInfl) * 0.04; }
  // only a fall beyond what inflation differences explain makes imports dearer
  const fx12 = n.fx12.length >= 12 ? n.fx12[n.fx12.length - 12] : n.fx12[0] || n.fx, depr = clamp((fx12 / n.fx - 1) * 100 - (n.infl - W.usInfl), -30, 100);
  const iT = sum('infl', [
    ['Expectations', 0.6 * mon.anchorInfl + 0.4 * n.infl],
    ['Government borrowing', 0.3 * dOp * (1 - absorb)],
    ['Printing money', (1.1 * qe + (qe > 5 ? 0.35 * (qe - 5) ** 2 : 0)) * (1 - absorb)],
    ['Overheating', 0.35 * (n.growth - n.pot - b.offG)],
    ['Interest rates', clamp(-0.45 * (realRate - b.realRate), -6, 6)],
    ['Import tariffs', 0.08 * (n.tax.tariff - b.tax.tariff)],
    ['Sales tax', 0.1 * (n.tax.sales - b.tax.sales)],
    ['Weaker currency', 0.25 * depr],
    ['Oil prices', 0.025 * (W.oil - 100) * (oilX > 0 ? 0.3 : 1)],
    ['Events', n.evInfl || 0],
    ...extra(n, 'infl')
  ]);
  n.infl += (clamp(iT, -5, 2000) - n.infl) * 0.18;
  n.P *= 1 + n.infl / 1200;
  // unemployment
  const uT = sum('unemp', [
    ['Normal level', b.un],
    ['Economy', clamp(-0.45 * (n.growth - n.pot - b.offG), -8, 15)],
    ['Welfare', 0.12 * (n.spend.welfare - b.spend.welfare)],
    ['Skills (education)', -0.2 * (n.k.human - b.k.human)],
    ['Income tax', 0.03 * (n.tax.income - b.tax.income)],
    ['Debt crisis', 4 * stress],
    ...extra(n, 'unemp')
  ]);
  n.unemp += (clamp(uT, 0.3, 60) - n.unemp) * 0.12;
  // central bank
  // AI governments that run their central bank still follow a rule; only the player can leave a rate where it is
  if (mon.type === 'float' && (mon.independent || n.idx !== G.player.idx)) mon.rate += (taylorOf(n) - mon.rate) * (mon.independent ? 0.12 : 0.08);
  else if (mon.type === 'union') mon.rate = W.ecb;
  else if (mon.type !== 'float') { const an = anchorNation(mon.anchor), ar = mon.anchor === 'EUR' ? W.ecb : an ? an.mon.rate : 3; mon.rate = Math.max(0, ar + (b.rate - (mon.anchor === 'EUR' ? 2 : RATE0[CUR_ISSUER[mon.anchor]] || 3)) + mon.pressure * 10); }
  mon.rate = clamp(mon.rate, 0, 200);
  // exchange rate (US dollars per unit, 100 at the start)
  const conf = Math.exp(0.03 * (realRate - b.realRate) - 0.02 * dOp * (1 - absorb) - 0.5 * Math.min(1, stress) - 0.01 * (b.stability - n.stability) + 0.02 * (n.growth - b.growth));
  if (mon.type === 'float') {
    const fxT = (n.id === 'USA' ? 100 : 100 * W.usP / n.P) * conf * (n.devalued || 1);
    n.fx += (fxT - n.fx) * 0.1;
  } else if (mon.type === 'union' || (mon.type === 'adopted' && mon.anchor === 'EUR')) n.fx = W.eurFx;
  else if (mon.type === 'adopted') { const an = anchorNation(mon.anchor); n.fx = an ? an.fx : 100; }
  else { // peg: holds until the pressure is too much
    const fair = 100 * W.usP / n.P * conf * (mon.anchor === 'EUR' ? W.eurFx / 100 : 1), gap = Math.log(fair / n.fx);
    mon.pressure = clamp(mon.pressure * 0.9 + Math.max(0, -gap) * 0.1, 0, 1);
    if (noise && gap < -0.25 && G.rng() < (-gap - 0.25) * 0.15) forceDevalue(n, fair);
  }
  n.fx12.push(n.fx); if (n.fx12.length > 13) n.fx12.shift();
  // debt and borrowing costs
  n.yield = yieldOf(n);
  why.yield = n.why.yield;
  n.effRate += (n.yield - n.effRate) / 60;
  n.debt += bud.deficit / 100 * gdpL(n) / 12;
  if (n.defaulted > 0) n.defaulted--;
  if (n.months % 6 === 5) { // ratings agencies look every 6 months
    const t = Math.round(clamp(ratingFormula(n), 0, 21));
    if (t > n.rating) n.rating++; else if (t < n.rating - 0) n.rating--;
  }
  // what people feel lags a few months behind the numbers
  n.feel.infl += (n.infl - n.feel.infl) / 5; n.feel.un += (n.unemp - n.feel.un) / 5; n.feel.growth += (n.growth - n.feel.growth) / 5;
  // approval
  const sp = (id, k) => cut(n.spend[id] - b.spend[id], 3) * k * m.spendPop;
  const months = n.months, free = GOV[n.gov].free;
  const taxPop = TAXES.reduce((a, t) => a + t.pop * (n.tax[t.id] - b.tax[t.id]), 0);
  const aT = sum('approval', [
    ['Starting point', b.approval],
    ['Economy', clamp(1.1 * (feelOf(n) - b.feel), -30, 20)],
    ['Public services', sp('health', 2.2) + sp('education', 1.6) + sp('welfare', 1.3) + sp('pensions', 1.8) + sp('police', 0.6) + sp('infrastructure', 0.6) + sp('culture', 1.2) + sp('environment', m.greenPop ? 1.5 : 0.3)],
    ['Taxes', clamp(taxPop, -30, 15)],
    ['Debt crisis', -12 * Math.min(1, stress)],
    ['Honeymoon', n.honeymoon ? 8 * Math.max(0, 1 - months / m.honeymoon) : 0],
    ['Time in office', n.idx === G.player.idx ? -Math.min(10, 0.12 * Math.max(0, months - m.fatigue)) : 0],
    ['Leader traits', m.approval],
    ['Events', n.evAppr],
    ...extra(n, 'approval')
  ]);
  // the player's approval is the sum of what each group of society thinks (politics module)
  const aGoal = n.idx === G.player.idx && typeof groupsApproval === 'function' ? groupsApproval(n, aT) : aT;
  n.approval += (clamp(aGoal, 2, 98) - n.approval) * (free ? 0.2 : 0.1);
  const sT = sum('stability', [
    ['Starting point', b.stability],
    ['Approval', 0.35 * (n.approval - b.approval)],
    ['Unemployment', clamp(-0.7 * (n.unemp - b.un), -25, 10)],
    ['Inflation', clamp(-0.25 * (Math.max(0, n.infl - 8) - Math.max(0, b.infl - 8)), -25, 10)],
    ['Police', cut(n.spend.police - b.spend.police, 1.5) * 3],
    ['Welfare', cut(n.spend.welfare - b.spend.welfare, 3) * 1.2],
    ['Defence', m.hawk ? cut(n.spend.defence - b.spend.defence, 2) * 2 : 0],
    ['Debt crisis', -15 * Math.min(1, stress) ** 2],
    ['Leader traits', m.stability],
    ['Events', n.evStab],
    ...extra(n, 'stability')
  ]);
  n.stability += (clamp(sT, 0, 100) - n.stability) * 0.12;
  n.evAppr *= 0.9; n.evStab *= 0.92; n.evGrowth = (n.evGrowth || 0) * 0.9; n.evInfl = (n.evInfl || 0) * 0.85;
  if (n.honeymoon && months > m.honeymoon) n.honeymoon = 0;
  // debt crisis: markets stop lending
  const realYield = n.yield - Math.max(0, mon.anchorInfl);
  if (!n.crisis && realYield > 15 && n.defaulted <= 0 && reserveShareOf(n) < 0.05 && n.debt > 0) { n.crisis = 1; if (noise && n.idx === G.player.idx) inbox('crisis', 'Debt crisis!', 'Lenders want ' + n.yield.toFixed(1) + '% to lend to us. Open Money & Debt to ask for an IMF bailout, default, or print money.'); }
  else if (n.crisis && realYield < 9) n.crisis = 0;
  n.months++;
  n.why = Object.assign(n.why, why);
}

// AI budget autopilot: drift back toward the starting deficit; in a debt crisis take an IMF loan or default
function aiFiscal(n) {
  const b = n.base, bud = n.budget, gap = opDeficit(n, bud) - b.opDef;
  if (Math.abs(gap) > 1) {
    const k = clamp(gap, -4, 6) * 0.0025;
    for (const m of MINISTRIES) if (m.id !== 'defence') n.spend[m.id] = Math.max(0, n.spend[m.id] * (1 - k));
    n.tax.income = clamp(n.tax.income * (1 + k), 0, 55); n.tax.sales = clamp(n.tax.sales * (1 + k), 0, 27);
  }
  if (n.crisis && G.rng() < 0.15) { if ((n.imf > 0 || n.rating <= 3) && n.defaulted <= 0) doDefault(n); else if (!(n.imf > 0)) doIMF(n); }
}
function doDefault(n) {
  const cutAmt = n.debt * 0.55; n.debt -= cutAmt; n.defaulted = 72; n.rating = 1; n.crisis = 0; n.evGrowth -= 4; n.evAppr -= 8; n.evStab -= 10; n.fx *= 0.75;
  newsWorld(World.countries[n.idx].name + ' defaults on its debt');
  return cutAmt;
}
function doIMF(n) {
  n.imf = 36; n.effRate = Math.min(n.effRate, 4); n.crisis = 0; n.ratingOff += 2;
  for (const m of MINISTRIES) if (m.id !== 'defence') n.spend[m.id] = +(n.spend[m.id] * 0.88).toFixed(2);
  n.tax.sales = clamp(n.tax.sales + 2, 0, 30); n.evAppr -= 7; n.evStab -= 4;
  newsWorld(World.countries[n.idx].name + ' agrees an IMF bailout');
}
function forceDevalue(n, fair) {
  const old = n.fx; n.fx = fair * 0.95; n.mon.pressure = 0; n.evAppr -= 6; n.evStab -= 4;
  if (G.player && n.idx === G.player.idx) inbox('bad', 'Currency peg broke', 'Speculators forced a devaluation of the ' + n.mon.cur + ' by ' + Math.round((1 - n.fx / old) * 100) + '%. Imports cost more.');
}

// The whole world, once a month
function worldMonth(noise = true) {
  const W = G.world, R = noise ? () => G.rng() - 0.5 : () => 0;
  // global business cycle with rare recessions
  W.cycleShock *= 0.9;
  if (noise && G.rng() < 0.005) { W.cycleShock = -2.5 - G.rng() * 2; newsWorld('Global recession fears as markets tumble'); }
  W.cycle = W.cycle * 0.93 + R() * 0.25 + W.cycleShock * 0.1;
  W.oil = clamp(W.oil * (1 + R() * 0.07) + (100 - W.oil) * 0.03, 35, 260);
  const us = G.nations[World.byId.USA.idx];
  W.usInfl = us.infl; W.usP *= 1 + us.infl / 1200;
  const ez = currencyMembers('EUR').filter(n => n.mon.type === 'union');
  let wsum = 0, p = 0, rr = 0, conf = 0;
  for (const n of ez) { const w = gdpL(n); wsum += w; p += n.P * w; rr += (n.mon.rate - n.infl - n.base.realRate) * w; conf += (n.stability - n.base.stability) * w; }
  W.ezP = p / wsum;
  W.ecb += (ecbTaylor() - W.ecb) * 0.12;
  W.eurFx += (100 * W.usP / W.ezP * Math.exp(0.03 * rr / wsum + 0.004 * conf / wsum) - W.eurFx) * 0.1;
  for (const n of G.nations) if (n) econMonth(n, noise);
  W.worldGdp = G.nations.reduce((a, n) => a + (n ? gdpUsd(n) : 0), 0);
  W.worldReal = G.nations.reduce((a, n) => a + (n ? n.real : 0), 0);
  for (const n of G.nations) if (n && n.idx !== G.player.idx) aiFiscal(n);
  reserveMonth();
}

// Reserve currencies: the world holds the currencies it trusts
function currencyTrust(code) {
  const W = G.world, mem = code === 'EUR' ? currencyMembers('EUR').filter(n => n.mon.type === 'union') : G.nations.filter(n => n && n.mon.cur === code && n.mon.type === 'float');
  if (!mem.length) return { total: 0, parts: [] };
  // size in real terms (start-year dollars), so hyperinflation elsewhere does not distort it
  let gdp = 0, dem = 0, mil = 0, infl = 0, stab = 0;
  for (const n of mem) { const g = n.real; gdp += g; dem += n.dem * g; mil += n.spend.defence / 100 * g; infl += n.infl * g; stab += n.stability * g; }
  dem /= gdp; infl /= gdp; stab /= gdp;
  const worldReal = W.worldReal || G.nations.reduce((a, n) => a + (n ? n.real : 0), 0);
  const open = code === 'CNY' ? 30 : 85;
  const parts = [
    ['Size of the economy', 0.3 * clamp(gdp / worldReal * 250, 0, 100)],
    ['Rule of law', 0.2 * dem * 10],
    ['Military power', 0.15 * clamp(mil / 1e9 / 10, 0, 100)],
    ['Steady prices', 0.15 * clamp(100 - 8 * Math.abs(infl - 2), 0, 100)],
    ['Stability', 0.1 * stab],
    ['Open money markets', 0.1 * open],
    ['Sanctions overuse', -(G.cur[code] && G.cur[code].sanctions || 0)]
  ];
  return { total: parts.reduce((a, p) => a + p[1], 0), parts };
}
function reserveMonth() {
  const targets = {};
  let sum = 0;
  for (const code in G.cur) {
    const c = G.cur[code], t = currencyTrust(code);
    c.trust = t.total; c.why = t.parts;
    targets[code] = c.share0 > 0 ? c.share0 * Math.exp((c.trust - c.trust0) / 12) : Math.max(0, (c.trust - Math.max(c.trust0, 60)) / 40) * 0.3;
    sum += targets[code];
  }
  // the player's own currency can join the club if trust in it rises high enough
  const p = G.nations[G.player.idx];
  if (p.mon.type === 'float' && !G.cur[p.mon.cur]) {
    const t = currencyTrust(p.mon.cur).total;
    if (t > Math.max(p.trust0 || 0, 60)) G.cur[p.mon.cur] = { share: 0, share0: 0, trust0: p.trust0 || 60, trust: t };
  }
  const k = sum > 0.98 ? 0.98 / sum : 1;
  for (const code in G.cur) { const c = G.cur[code]; c.share += ((targets[code] || 0) * k - c.share) * 0.02; }
}

// Monthly history (player every month, everyone else every year)
const HIST_KEYS = ['gdp', 'growth', 'infl', 'unemp', 'debt', 'deficit', 'approval', 'stability', 'rate', 'fx', 'yield'];
function recordHistory(first) {
  for (const n of G.nations) {
    if (!n) continue;
    if (!first && n.idx !== G.player.idx && n.months % 12 !== 0) continue;
    const vals = { gdp: gdpUsd(n), growth: n.growth, infl: n.infl, unemp: n.unemp, debt: n.debt / gdpL(n) * 100, deficit: (n.budget || budgetOf(n)).deficit,
      approval: n.approval, stability: n.stability, rate: n.mon.rate, fx: n.fx, yield: n.yield };
    for (const k of HIST_KEYS) { const h = n.hist[k] = n.hist[k] || []; h.push(+vals[k].toPrecision(5)); if (h.length > 360) h.shift(); }
  }
}

// Forecast: run the player's nation forward without luck, with and without a change, and compare
function forecast(change, months = 12) {
  const save = { rng: G.rng.state(), world: JSON.stringify(G.world) };
  const p = G.nations[G.player.idx];
  const run = mod => {
    const n = structuredClone(Object.assign({}, p, { why: {}, hist: {} }));
    if (mod) mod(n);
    for (let i = 0; i < months; i++) econMonth(n, false);
    return { approval: n.approval, growth: n.growth, infl: n.infl, unemp: n.unemp, debt: n.debt / gdpL(n) * 100, deficit: n.budget.deficit, stability: n.stability };
  };
  const a = run(null), bb = run(change);
  G.rng.set(save.rng); G.world = JSON.parse(save.world);
  const out = {}; for (const k in a) out[k] = bb[k] - a[k];
  return out;
}
