// Game state: nations built from data/stats.tsv, money systems, budgets, new game, saves.
// Money is kept in "local units" (1 unit = 1 US dollar at the start); USD values = local * fx / 100.
const START_DAY = Date.UTC(2026, 6, 1); // the game starts on 1 July 2026
const SAVE_VERSION = 1;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateOf = day => new Date(START_DAY + day * 864e5);
const fmtDate = day => { const d = dateOf(day); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const fmtMonth = day => { const d = dateOf(day); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };

const GOV = {
  PRES: { name: 'Presidential republic', free: true }, PARL: { name: 'Parliamentary republic', free: true },
  CMON: { name: 'Constitutional monarchy', free: true }, SEMI: { name: 'Semi-presidential republic', free: true },
  AUTH: { name: 'Authoritarian republic' }, ONEP: { name: 'One-party state' }, AMON: { name: 'Absolute monarchy' },
  JUNTA: { name: 'Military government' }, THEO: { name: 'Theocracy' }, TRANS: { name: 'Transitional government' }
};
const BLOCS = {
  UNSC: 'UN Security Council (permanent)', NATO: 'NATO', EU: 'European Union', G7: 'G7', G20: 'G20', OECD: 'OECD', BRICS: 'BRICS',
  SCO: 'Shanghai Cooperation Org.', CSTO: 'CSTO', EEU: 'Eurasian Economic Union', ASEAN: 'ASEAN', AU: 'African Union',
  AL: 'Arab League', GCC: 'Gulf Cooperation Council', OPEC: 'OPEC', MERC: 'Mercosur', USMCA: 'USMCA', CW: 'Commonwealth',
  AUKUS: 'AUKUS', ECOWAS: 'ECOWAS', AES: 'Alliance of Sahel States', SADC: 'SADC', EAC: 'East African Community',
  CARICOM: 'CARICOM', PIF: 'Pacific Islands Forum'
};
const RES_NAMES = { oil: 'Oil', gas: 'Gas', coal: 'Coal', food: 'Farming', metal: 'Metals', rare: 'Rare earths', chips: 'Microchips', tech: 'Tech', tour: 'Tourism', fin: 'Finance', manu: 'Factories' };
const RATINGS = ['D', 'SD', 'CC', 'CCC-', 'CCC', 'CCC+', 'B-', 'B', 'B+', 'BB-', 'BB', 'BB+', 'BBB-', 'BBB', 'BBB+', 'A-', 'A', 'A+', 'AA-', 'AA', 'AA+', 'AAA'];

const TAXES = [
  { id: 'income', name: 'Income & payroll tax', max: 60, step: 0.5, unit: '%', base: n => 0.65 * n.formal, pop: -0.6 },
  { id: 'corporate', name: 'Company tax', max: 50, step: 0.5, unit: '%', base: () => 0.10, pop: -0.1 },
  { id: 'sales', name: 'Sales tax / VAT', max: 30, step: 0.5, unit: '%', base: n => 0.48 * (0.5 + 0.5 * n.formal), pop: -0.45 },
  { id: 'tariff', name: 'Import tariffs', max: 60, step: 0.5, unit: '%', base: n => 0.08 + 0.12 * n.open, pop: -0.1 },
  { id: 'wealth', name: 'Wealth tax', max: 4, step: 0.1, unit: '%', base: () => 2.0, pop: 0.3 },
  { id: 'property', name: 'Property tax', max: 3, step: 0.05, unit: '%', base: () => 1.6, pop: -1.2 },
  { id: 'carbon', name: 'Carbon tax', max: 200, step: 5, unit: '$/t', base: () => 0.00022, pop: -0.012 }
];
const MINISTRIES = [
  { id: 'defence', name: 'Defence', w: 0 }, { id: 'health', name: 'Health', w: 0.17 }, { id: 'education', name: 'Education', w: 0.13 },
  { id: 'infrastructure', name: 'Infrastructure', w: 0.09 }, { id: 'welfare', name: 'Welfare', w: 0.13 }, { id: 'pensions', name: 'Pensions', w: 0.19 },
  { id: 'police', name: 'Police', w: 0.04 }, { id: 'justice', name: 'Justice', w: 0.02 }, { id: 'science', name: 'Science', w: 0.025 },
  { id: 'environment', name: 'Environment', w: 0.015 }, { id: 'culture', name: 'Culture & sport', w: 0.012 }, { id: 'aid', name: 'Foreign aid', w: 0.006 },
  { id: 'intel', name: 'Intelligence', w: 0.01 }, { id: 'space', name: 'Space', w: 0.004 }
];

// Money systems. Euro members share one central bank; pegs follow an anchor; some states use another country's money.
const PEGS = { SAU: 'USD', ARE: 'USD', QAT: 'USD', BHR: 'USD', OMN: 'USD', KWT: 'USD', JOR: 'USD', LBN: 'USD', DJI: 'USD', ERI: 'USD', TKM: 'USD', CUB: 'USD',
  BHS: 'USD', BRB: 'USD', BLZ: 'USD', DNK: 'EUR', BIH: 'EUR', CPV: 'EUR', COM: 'EUR', STP: 'EUR', MKD: 'EUR', BTN: 'INR', NPL: 'INR', LSO: 'ZAR', SWZ: 'ZAR', NAM: 'ZAR', BRN: 'SGD' };
const UNION_PEG = { XOF: 'EUR', XAF: 'EUR', XCD: 'USD' }; // CFA francs and the East Caribbean dollar
const CUR_ISSUER = { USD: 'USA', JPY: 'JPN', GBP: 'GBR', CNY: 'CHN', CAD: 'CAN', AUD: 'AUS', CHF: 'CHE', INR: 'IND', ZAR: 'ZAF', SGD: 'SGP', NZD: 'NZL' };
const RESERVE0 = { USD: 0.57, EUR: 0.20, JPY: 0.058, GBP: 0.048, CAD: 0.027, CNY: 0.021, AUD: 0.021, CHF: 0.002 };
const RATE0 = { USA: 3.9, JPN: 0.75, GBR: 4.0, CHE: 0, CAN: 2.25, AUS: 3.6, NZL: 2.5, CHN: 3.0, IND: 5.5, BRA: 15, RUS: 16.5, TUR: 39.5, ARG: 30,
  MEX: 7.5, ZAF: 7, KOR: 2.5, IDN: 4.75, SWE: 1.75, NOR: 4, POL: 4.5, CZE: 3.5, HUN: 6.5, ISR: 4.5, EGY: 24, NGA: 27, PAK: 11, UKR: 15.5, IRN: 23, VEN: 59 };
const APPROVAL0 = { USA: 41, GBR: 24, FRA: 22, DEU: 30, JPN: 62, KOR: 55, IND: 70, MEX: 70, BRA: 45, ARG: 45, CAN: 52, ITA: 44, ESP: 38, AUS: 47,
  POL: 40, NLD: 45, TUR: 45, ISR: 38, UKR: 60, PAK: 45, NGA: 30, ZAF: 40, KEN: 30, PHL: 35, IDN: 70, SLV: 85, CHL: 50, COL: 35, PER: 20, ECU: 50 };
const STABILITY0 = { UKR: 38, RUS: 55, SDN: 8, SSD: 12, SOM: 14, YEM: 10, HTI: 8, MMR: 14, SYR: 22, AFG: 30, PSE: 8, LBY: 22, LBN: 30, COD: 22,
  ETH: 30, MLI: 22, BFA: 20, NER: 25, CAF: 15, VEN: 25, IRN: 35, ISR: 52, IRQ: 32, NGA: 35, PAK: 35, MOZ: 30, CMR: 32, TCD: 25, MDG: 30, GNB: 25, NIC: 40, CUB: 38 };
const CB_TARGET = d => d > 0.75 ? 2 : d > 0.5 ? 3 : 4.5;

let G = null; // the running game
// Systems register here: SYSTEM_INITS fill missing state (new games and old saves), DAILY/MONTHLY run for the player's world
const SYSTEM_INITS = [], DAILY = [], MONTHLY = [];
function ensureSystems(g) { g.feed = g.feed || []; for (const f of SYSTEM_INITS) f(g); }

function devOf(gdpUsd, pop) { return clamp((Math.log10(Math.max(gdpUsd / Math.max(pop, 1), 100)) - 2.7) / 2.2, 0, 1); }

function makeNation(c, s) {
  const pop = s.pop * 1e6, gdp = Math.max(s.gdp, 0.01) * 1e9, dev = devOf(gdp, pop), res = String(s.res || '').split(',').filter(Boolean);
  const blocs = String(s.blocs || '').split(',').filter(Boolean);
  const n = {
    idx: c.idx, id: c.id, gov: s.gov || 'AUTH', dem: s.dem === '' ? 0 : s.dem, leader: s.leader, title: s.title, blocs, res,
    pop, popGrowth: clamp(2.6 - 2.4 * dev, -0.5, 3.2), real: gdp, P: 1, fx: 100, dev,
    growth: s.gr, infl: s.inf, unemp: s.un, debt: s.debt / 100 * gdp,
    mil: s.mil * 1000, milx: s.milx * 1e9, nukes: s.nuke || 0,
    rating: RATINGS.indexOf(s.cr) >= 0 ? RATINGS.indexOf(s.cr) : -1,
    corruption: clamp(0.62 - 0.42 * dev - 0.025 * (s.dem || 0), 0.04, 0.85),
    formal: clamp(0.3 + 0.65 * dev, 0.25, 0.97), open: clamp(0.35 + 0.15 * (res.includes('manu') + res.includes('fin') + res.includes('tour')), 0.2, 0.8),
    rent: (res.includes('oil') ? (s.gov === 'AMON' ? 22 : 5) : 0) + (res.includes('gas') ? (s.gov === 'AMON' ? 6 : 2) : 0),
    approval: APPROVAL0[c.id] || (GOV[s.gov] && GOV[s.gov].free ? 44 : 58),
    stability: 0, months: 0, defaulted: 0, shock: 0, why: {}, hist: {}
  };
  n.stability = STABILITY0[c.id] != null ? STABILITY0[c.id] : clamp(32 + 30 * dev + 2.2 * n.dem - (s.gov === 'TRANS' ? 20 : 0) - (s.gov === 'JUNTA' ? 12 : 0) - (s.gr < 0 ? 8 : 0), 10, 90);
  // budget: total spending by development, defence from the data, the rest split by typical shares
  const total = clamp(15 + 24 * dev + (n.dem > 8.5 ? 5 : 0) + (s.gov === 'ONEP' ? 4 : 0) + (n.rent > 10 ? 8 : 0), 10, 52);
  const defence = clamp(n.milx / gdp * 100, 0, 25), rest = Math.max(4, total - defence), wsum = MINISTRIES.reduce((a, m) => a + m.w, 0);
  n.spend = {};
  for (const m of MINISTRIES) n.spend[m.id] = m.id === 'defence' ? defence : rest * m.w / wsum * (m.id === 'pensions' ? 0.4 + dev : m.id === 'aid' ? dev * 1.6 : m.id === 'space' ? dev * 1.5 : 1);
  const sc = rest / MINISTRIES.filter(m => m.id !== 'defence').reduce((a, m) => a + n.spend[m.id], 0);
  for (const m of MINISTRIES) if (m.id !== 'defence') n.spend[m.id] *= sc;
  for (const k in n.spend) n.spend[k] = +n.spend[k].toFixed(2);
  n.tax = { income: 8 + 26 * dev, corporate: 22, sales: 9 + 9 * dev, tariff: clamp(14 - 11 * dev, 1.5, 20), wealth: 0, property: +(0.2 + 0.7 * dev).toFixed(2), carbon: blocs.includes('EU') ? 30 : 0 };
  if (n.gov === 'AMON' && n.rent > 10) Object.assign(n.tax, { income: 0, corporate: 10, sales: 5 });
  // scale income tax and VAT so the starting deficit is about 3% of GDP
  const want = Math.max(4, total - 3 - n.rent);
  for (let i = 0; i < 6; i++) {
    const r = revenueOf(n).total; if (r <= 0) break;
    const k = clamp(want / r, 0.5, 1.6);
    n.tax.income = clamp(n.tax.income * k, 0, 55); n.tax.sales = clamp(n.tax.sales * k, 0, 27);
  }
  for (const k in n.tax) n.tax[k] = Math.round(n.tax[k] * 2) / 2;
  // money
  const cur = c.cur;
  let mon;
  if (cur === 'EUR') mon = { type: n.blocs.includes('EU') ? 'union' : 'adopted', anchor: 'EUR' };
  else if (UNION_PEG[cur]) mon = { type: 'peg', anchor: UNION_PEG[cur] };
  else if (PEGS[c.id]) mon = { type: 'peg', anchor: PEGS[c.id] };
  else if (CUR_ISSUER[cur] && CUR_ISSUER[cur] !== c.id) mon = { type: 'adopted', anchor: cur };
  else mon = { type: 'float', anchor: '' };
  mon.cur = cur; mon.independent = n.dem >= 6 || ['union'].includes(mon.type); mon.qe = 0; mon.pressure = 0;
  mon.target = CB_TARGET(dev); mon.anchorInfl = clamp(s.inf, -1, 300);
  mon.rate = RATE0[c.id] != null ? RATE0[c.id] : clamp(s.inf + 2 - dev, 0.25, 120);
  n.mon = mon;
  n.k = { infra: n.spend.infrastructure, know: n.spend.science, human: n.spend.education, health: n.spend.health };
  return n;
}

function revenueOf(n) {
  const coll = clamp(1 - n.corruption * 0.55, 0.3, 1), out = { total: 0, parts: {} };
  for (const t of TAXES) { const v = n.tax[t.id] * t.base(n) * coll; out.parts[t.id] = v; out.total += v; }
  return out;
}
const spendOf = n => MINISTRIES.reduce((a, m) => a + n.spend[m.id], 0);

// Euro area and other currencies as blocks
function currencyMembers(code) { return G.nations.filter(n => n && (n.mon.cur === code || (n.mon.type !== 'float' && n.mon.anchor === code))); }

function newGame(opt) {
  const stats = World.stats;
  G = { v: SAVE_VERSION, seed: opt.seed || (Math.random() * 2 ** 31) | 0, day: 0, speed: 1, nations: [null], player: null,
    world: { cycle: 0, cycleShock: 0, oil: 100, rate: 3.5, usInfl: 2.8 }, cur: {}, inbox: [], log: [] };
  G.rng = makeRng(G.seed);
  for (const c of World.countries) if (c) G.nations[c.idx] = makeNation(c, stats[c.id]);
  for (const code in RESERVE0) G.cur[code] = { share: RESERVE0[code], share0: RESERVE0[code], trust0: 0, trust: 0 };
  calibrate();
  const n = G.nations[opt.idx];
  G.player = {
    idx: opt.idx, name: opt.name, title: opt.title, party: opt.party, econ: opt.econ, social: opt.social, traits: opt.traits.slice(),
    face: opt.face, real: !!opt.real, startDay: 0
  };
  n.leader = opt.name; n.title = opt.title;
  if (!opt.real) { n.approval = Math.max(n.approval, GOV[n.gov].free ? 48 : 60); n.base.approval = n.approval; } // a fresh face starts with a clean slate
  n.honeymoon = opt.real ? 0 : 1;
  applyTraits(n, G.player.traits);
  ensureSystems(G);
  recordHistory(true);
  return G;
}
