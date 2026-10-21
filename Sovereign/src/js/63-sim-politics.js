// Politics: groups of society, laws, parliament, courts, cabinet, political capital, big projects.
// Only the player's nation is run in this detail; AI nations use the simpler approval formula.
const GROUPS = [
  { id: 'workers', name: 'Workers & unions', icon: '🔧', share: n => 0.22, lean: [-0.6, 0.1] },
  { id: 'business', name: 'Business', icon: '💼', share: n => 0.04, lean: [0.7, 0] },
  { id: 'farmers', name: 'Farmers', icon: '🌾', share: n => 0.03 + 0.2 * (1 - n.dev), lean: [0.1, 0.5] },
  { id: 'retirees', name: 'Retirees', icon: '👴', share: n => 0.05 + 0.15 * n.dev, lean: [0, 0.4] },
  { id: 'youth', name: 'Young people', icon: '🧑', share: n => 0.12 + 0.08 * (1 - n.dev), lean: [-0.3, -0.5] },
  { id: 'students', name: 'Students', icon: '🎓', share: n => 0.04, lean: [-0.4, -0.7] },
  { id: 'women', name: "Women's groups", icon: '♀', share: n => 0.08, lean: [-0.2, -0.5] },
  { id: 'minorities', name: 'Minorities', icon: '🤝', share: n => 0.07, lean: [-0.3, -0.6] },
  { id: 'religious', name: 'Religious groups', icon: '⛪', share: n => 0.06 + (['THEO', 'AMON'].includes(n.gov) ? 0.12 : 0), lean: [0.2, 0.9] },
  { id: 'green', name: 'Environmentalists', icon: '🌳', share: n => 0.02 + 0.03 * n.dev, lean: [-0.4, -0.6] },
  { id: 'military', name: 'Military', icon: '🎖', share: n => 0.015, lean: [0.3, 0.6] },
  { id: 'police', name: 'Police', icon: '👮', share: n => 0.01, lean: [0.2, 0.6] },
  { id: 'media', name: 'Media', icon: '📰', share: n => 0.01, lean: [-0.1, -0.4] },
  { id: 'elite', name: 'Wealthy elite', icon: '💎', share: n => 0.01, lean: [0.8, 0.2] }
];
const G_IDX = Object.fromEntries(GROUPS.map((g, i) => [g.id, i]));
// how much each group matters for power (not votes): free countries vs the rest
const CLOUT = { workers: [1, 0.5], business: [1.4, 1.2], farmers: [0.8, 0.5], retirees: [1, 0.4], youth: [0.8, 0.6], students: [0.6, 0.7], women: [0.7, 0.3], minorities: [0.6, 0.3],
  religious: [0.7, 1.2], green: [0.5, 0.2], military: [0.8, 2.5], police: [0.6, 1.5], media: [1.2, 0.5], elite: [1.2, 2] };
const cloutOf = (n, id) => CLOUT[id][GOV[n.gov].free ? 0 : 1];

// ---- Laws. Each step up a level adds these effects (relative to where the country started):
// g growth, i inflation, u unemployment, s stability, a approval, c corruption, f freedom, $ cost (% of GDP), y borrowing cost, t research
// Groups: how each group feels about one step up (-10 hate ... +10 love). k = courts may strike it down, sup = needs 2/3 of parliament.
const LAW_CATS = ['Economy', 'Work', 'Welfare', 'Health & Education', 'Justice', 'Rights', 'Media & Internet', 'Environment & Energy', 'Immigration', 'Military', 'Technology', 'Society', 'Constitution'];
const LAWS = [];
function L(cat, id, name, levels, def, fx, groups, opt = {}) { LAWS.push(Object.assign({ cat: LAW_CATS[cat], id, name, levels: levels.split('|'), def, fx, groups, ideo: [0, 0] }, opt)); }
const free = n => GOV[n.gov].free, dvl = (n, a, b) => n.dev > b ? 2 : n.dev > a ? 1 : 0;
// Economy
L(0, 'minwage', 'Minimum wage', 'None|Low|Medium|High', n => dvl(n, 0.3, 0.7) + (free(n) ? 0 : 0), { g: -0.08, u: 0.35, a: 0.6, i: 0.1 }, { workers: 6, business: -5, youth: 3, elite: -2 }, { ideo: [-1, 0] });
L(0, 'regulation', 'Business regulation', 'Light|Normal|Strict|Heavy', n => 1, { g: -0.15, c: -0.01, s: 0.3 }, { business: -7, workers: 3, green: 4, elite: -4 }, { ideo: [-1, 0] });
L(0, 'antitrust', 'Breaking up monopolies', 'None|Weak|Strong', n => free(n) ? 1 : 0, { g: 0.06, c: -0.02 }, { business: -4, elite: -6, workers: 2, media: 1 }, { ideo: [-0.5, 0] });
L(0, 'stateoil', 'State control of oil & gas', 'Private|Mixed|State-owned', n => n.rent > 4 ? 2 : 1, { g: -0.1, c: 0.02, rentK: 0.15 }, { business: -6, workers: 3, elite: -3 }, { ideo: [-1, 0] });
L(0, 'statebanks', 'State banks', 'Private|Mixed|State-owned', n => ['ONEP', 'AUTH'].includes(n.gov) ? 2 : 0, { g: -0.12, c: 0.02, y: -0.1 }, { business: -5, workers: 2 }, { ideo: [-1, 0] });
L(0, 'staterail', 'State railways & airlines', 'Private|Mixed|State-owned', n => 1, { g: -0.04, $: 0.2, a: 0.3 }, { workers: 3, business: -3 }, { ideo: [-1, 0] });
L(0, 'sez', 'Special economic zones', 'None|Some|Many', n => n.dev < 0.7 ? 1 : 0, { g: 0.18, c: 0.01, u: -0.2 }, { business: 6, workers: -1, farmers: -2, green: -3 }, { ideo: [1, 0] });
L(0, 'subsidies', 'Farm subsidies', 'None|Some|Generous', n => 1, { $: 0.3, g: -0.03, a: 0.2 }, { farmers: 8, business: -1, green: -1 });
L(0, 'fuelsub', 'Fuel subsidies', 'None|Some|Large', n => n.rent > 4 ? 2 : n.dev < 0.5 ? 1 : 0, { $: 0.8, i: -0.4, a: 1 }, { workers: 4, farmers: 4, green: -6, business: 2 });
L(0, 'taxhaven', 'Low-tax deals for global companies', 'No|Some|Tax haven', n => 0, { g: 0.2, $: -0.4, f: 0 }, { business: 7, elite: 5, workers: -3, media: -2 }, { ideo: [1, 0], abroad: -6 });
L(0, 'swf', 'Sovereign wealth fund', 'None|Small|Large', n => n.rent > 6 || n.id === 'NOR' || n.id === 'SGP' ? 2 : 0, { $: 0.6, y: -0.15, g: 0.03 }, { business: 1, elite: 1 });
L(0, 'capital', 'Capital controls', 'Open|Some|Strict', n => n.id === 'CHN' ? 2 : n.dev < 0.4 ? 1 : 0, { g: -0.12, i: -0.2 }, { business: -6, elite: -8, workers: 1 }, { ideo: [-1, 0] });
L(0, 'crypto', 'Crypto as legal money', 'Banned|Allowed|Legal tender', n => n.id === 'SLV' ? 2 : n.id === 'CHN' ? 0 : 1, { g: 0.03, i: 0.15, c: 0.01 }, { youth: 5, business: 1, elite: 2, retirees: -3 });
// Work
L(1, 'unions', 'Union rights', 'Banned|Limited|Normal|Strong', n => free(n) ? 2 : 1, { g: -0.06, u: 0.12, s: 0.4, f: 2 }, { workers: 8, business: -6 }, { ideo: [-1, 0] });
L(1, 'workweek', 'Working week', '48 hours|40 hours|35 hours|4 days', n => dvl(n, 0.3, 0.8), { g: -0.12, u: -0.05, a: 0.8 }, { workers: 6, youth: 4, business: -6 }, { ideo: [-1, 0] });
L(1, 'childlabor', 'Child labour ban', 'None|Partial|Full', n => n.dev < 0.25 ? 1 : 2, { g: -0.03, s: 0.3, f: 2 }, { workers: 2, women: 3, business: -2 });
L(1, 'retire', 'Retirement age', '70|67|65|62', n => n.dev > 0.6 ? 2 : 3, { $: 0.6, u: -0.05, a: 0.6 }, { retirees: 8, workers: 4, youth: -2, business: -3 });
L(1, 'gig', 'Gig worker protections', 'None|Basic|Full', n => n.dev > 0.75 ? 1 : 0, { g: -0.03, u: 0.04 }, { workers: 4, youth: 3, business: -4 });
L(1, 'parental', 'Paid parental leave', 'None|3 months|1 year', n => dvl(n, 0.45, 0.75), { $: 0.2, a: 0.5, p: 0.05 }, { women: 7, workers: 3, business: -2, religious: 1 });
L(1, 'ubi', 'Universal basic income', 'None|Pilot|Full', n => 0, { $: 4, u: 0.4, a: 2, i: 0.3 }, { workers: 5, youth: 7, students: 6, business: -6, elite: -6, retirees: 2 }, { ideo: [-1, 0] });
// Welfare
L(2, 'jobless', 'Unemployment benefits', 'None|Basic|Generous', n => dvl(n, 0.4, 0.75), { $: 0.6, u: 0.2, s: 1.2, a: 0.8 }, { workers: 6, youth: 3, business: -3 }, { ideo: [-1, 0] });
L(2, 'childben', 'Child benefits', 'None|Basic|Generous', n => dvl(n, 0.4, 0.75), { $: 0.5, a: 0.8, p: 0.05 }, { women: 5, workers: 3, religious: 2 });
L(2, 'housing', 'Public housing', 'None|Some|Large', n => n.id === 'SGP' ? 2 : 1, { $: 0.6, a: 0.9, s: 0.6, g: 0.02 }, { workers: 6, youth: 6, business: -1, elite: -2 }, { ideo: [-1, 0] });
L(2, 'rentcontrol', 'Rent control', 'None|Some|Strict', n => 0, { g: -0.04, a: 0.6 }, { youth: 6, workers: 4, elite: -6, business: -4 }, { ideo: [-1, 0] });
L(2, 'foodaid', 'Food aid', 'None|Basic|Large', n => n.dev < 0.5 ? 1 : 1, { $: 0.3, s: 1, a: 0.6 }, { workers: 4, farmers: 3, religious: 2 });
// Health & Education
L(3, 'healthcare', 'Healthcare system', 'Private|Mixed|Free for all', n => n.dev > 0.6 && n.id !== 'USA' ? 2 : 1, { $: 1.2, a: 1.5, g: 0.03, s: 0.6 }, { workers: 7, retirees: 6, business: -3, elite: -4 }, { ideo: [-1, 0] });
L(3, 'tuition', 'University fees', 'Expensive|Low|Free', n => n.dev > 0.7 ? 1 : 1, { $: 0.4, a: 0.6, t: 0.1 }, { students: 9, youth: 5, elite: -2 }, { ideo: [-1, 0] });
L(3, 'school', 'School leaving age', '12|16|18', n => n.dev > 0.4 ? 1 : 0, { $: 0.3, g: 0.05, u: -0.1 }, { youth: 2, students: 3, women: 2 });
L(3, 'vaccines', 'Vaccination programme', 'Voluntary|Free|Required', n => 1, { $: 0.05, s: 0.3, a: 0.2, f: -1 }, { retirees: 3, religious: -2, youth: -1 });
L(3, 'drugs', 'Drug policy', 'Death penalty|Prison|Treatment|Legal cannabis', n => free(n) ? 1 : 0, { s: 0.2, c: -0.01, f: 3 }, { youth: 6, students: 5, religious: -7, police: -3, retirees: -3 }, { ideo: [0, -1] });
L(3, 'religioused', 'Religious schools', 'Banned|Allowed|State-funded', n => ['THEO', 'AMON'].includes(n.gov) ? 2 : 1, { $: 0.1 }, { religious: 7, students: -3, minorities: -3, media: -2 }, { ideo: [0, 1] });
// Justice
L(4, 'policing', 'Police powers', 'Limited|Normal|Strong|Unlimited', n => free(n) ? 1 : 2, { s: 1.5, f: -5, c: 0.01 }, { police: 7, minorities: -6, youth: -4, retirees: 3, media: -3 }, { ideo: [0, 1] });
L(4, 'deathpen', 'Death penalty', 'Abolished|Rare|Common', n => free(n) ? 0 : 1, { s: 0.4, f: -3 }, { police: 3, religious: 1, media: -4, minorities: -3, students: -4 }, { ideo: [0, 1], abroad: -3 });
L(4, 'prisons', 'Prison conditions', 'Harsh|Normal|Reform-focused', n => free(n) ? 1 : 0, { $: 0.1, s: 0.1, f: 2 }, { minorities: 3, police: -3, students: 2 }, { ideo: [0, -1] });
L(4, 'anticorr', 'Anti-corruption agency', 'None|Weak|Strong|Untouchable', n => free(n) ? 2 : 1, { c: -0.05, $: 0.05, g: 0.05 }, { elite: -7, business: 1, media: 4, workers: 3 }, {});
L(4, 'guns', 'Gun ownership', 'Banned|Licensed|Easy', n => n.id === 'USA' ? 2 : 1, { s: -0.4, f: 1 }, { police: -3, retirees: 2, women: -3, farmers: 3, students: -4 }, { ideo: [0, 1] });
L(4, 'surveil', 'Mass surveillance', 'None|Targeted|Everywhere', n => free(n) ? 1 : 2, { s: 1, f: -6, t: 0.05 }, { police: 5, media: -6, youth: -5, minorities: -4 }, { ideo: [0, 1], k: 1 });
// Rights
L(5, 'speech', 'Free speech', 'Censored|Limited|Free', n => free(n) ? 2 : n.dem > 3 ? 1 : 0, { f: 8, s: -0.5 }, { media: 8, students: 5, religious: -2, police: -2 }, { ideo: [0, -1] });
L(5, 'protest', 'Right to protest', 'Banned|Permits only|Free', n => free(n) ? 2 : 0, { f: 6, s: -0.8 }, { students: 6, workers: 3, police: -4, media: 3 }, { ideo: [0, -1] });
L(5, 'samesex', 'Same-sex marriage', 'Illegal|Partners|Legal', n => free(n) && n.dev > 0.6 ? 2 : 0, { f: 3 }, { youth: 5, students: 5, minorities: 3, religious: -9, retirees: -3 }, { ideo: [0, -1], abroad: 2 });
L(5, 'womenrights', "Women's rights", 'Restricted|Partial|Equal', n => ['THEO'].includes(n.gov) || ['AFG'].includes(n.id) ? 0 : free(n) ? 2 : 1, { g: 0.12, f: 5, s: 0.2 }, { women: 9, religious: -4, youth: 3 }, { ideo: [0, -1], abroad: 4 });
L(5, 'minority', 'Minority rights', 'None|Some|Full', n => free(n) ? 2 : 1, { f: 4, s: 0.6 }, { minorities: 9, religious: -2, police: -1 }, { ideo: [0, -1] });
L(5, 'abortion', 'Abortion', 'Banned|Limited|Legal', n => free(n) && n.dev > 0.6 ? 2 : 1, { f: 2 }, { women: 6, religious: -8, students: 3, retirees: -2 }, { ideo: [0, -1] });
L(5, 'religion', 'State religion', 'Secular|Recognised|Official|Religious law', n => n.gov === 'THEO' ? 3 : n.gov === 'AMON' ? 2 : 0, { f: -3, s: 0.3 }, { religious: 8, minorities: -6, students: -4, media: -2 }, { ideo: [0, 1] });
// Media & Internet
L(6, 'press', 'Press freedom', 'State media only|Licensed|Free', n => free(n) ? 2 : n.dem > 3 ? 1 : 0, { f: 7, c: -0.02, s: -0.3 }, { media: 9, students: 3, elite: -2 }, { ideo: [0, -1], k: -1 });
L(6, 'internet', 'Internet control', 'Open|Filtered|Great Firewall', n => n.id === 'CHN' || n.id === 'PRK' || n.id === 'IRN' ? 2 : free(n) ? 0 : 1, { f: -6, s: 0.6, g: -0.05 }, { youth: -7, students: -6, media: -6, police: 3, business: -2 }, { ideo: [0, 1], k: 1 });
L(6, 'social', 'Social media rules', 'None|Age limits|Strict', n => n.dev > 0.8 ? 1 : 0, { s: 0.2, f: -1 }, { retirees: 3, youth: -4, media: 1, women: 2 });
L(6, 'propaganda', 'State propaganda', 'None|Some|Constant', n => free(n) ? 0 : 2, { a: 2, f: -4, $: 0.1 }, { media: -6, students: -3, military: 2 }, { k: 1 });
// Environment & Energy
L(7, 'emissions', 'Emission limits', 'None|Moderate|Strict|Net zero by 2040', n => n.blocs.includes('EU') ? 2 : n.dev > 0.6 ? 1 : 0, { g: -0.1, e: -1 }, { green: 8, business: -5, workers: -2, youth: 3 }, { ideo: [-0.5, -0.5], abroad: 2 });
L(7, 'coal', 'Coal power', 'Banned|Phasing out|Allowed|Expanding', n => n.res.includes('coal') ? 2 : n.blocs.includes('EU') ? 1 : 2, { g: 0.04, e: 1, s: -0.1 }, { green: -8, workers: 3, business: 2 }, { ideo: [0.5, 0.5] });
L(7, 'nuclear', 'Nuclear power', 'Banned|Allowed|Expanding', n => n.dev > 0.6 ? 1 : 0, { g: 0.04, e: -0.5, $: 0.2 }, { green: -3, business: 3, students: -1 });
L(7, 'renew', 'Renewable energy support', 'None|Some|Massive', n => n.dev > 0.5 ? 1 : 0, { $: 0.4, e: -1, g: 0.03 }, { green: 8, youth: 4, business: 1 });
L(7, 'evs', 'Electric car incentives', 'None|Some|Petrol ban 2035', n => n.blocs.includes('EU') ? 2 : n.dev > 0.6 ? 1 : 0, { $: 0.15, e: -0.5 }, { green: 6, youth: 2, workers: -2, farmers: -3 });
L(7, 'forest', 'Forest protection', 'None|Some|Strict', n => 1, { g: -0.03, e: -0.4 }, { green: 7, farmers: -5, business: -2 });
L(7, 'fracking', 'Fracking', 'Banned|Allowed', n => n.id === 'USA' || n.id === 'CAN' || n.id === 'ARG' ? 1 : 0, { g: 0.06, e: 0.5, i: -0.1 }, { green: -8, business: 4, farmers: -2 });
// Immigration
L(8, 'immig', 'Immigration', 'Closed|Strict|Normal|Open', n => n.dev > 0.7 ? 2 : 1, { g: 0.12, u: 0.1, s: -0.5, p: 0.2 }, { business: 6, minorities: 5, workers: -4, religious: -2, retirees: -3, police: -2 }, { ideo: [0, -1] });
L(8, 'refugees', 'Refugee policy', 'Turn away|Limited|Welcoming', n => free(n) ? 1 : 0, { $: 0.1, s: -0.3, f: 1 }, { minorities: 5, religious: 1, workers: -3, retirees: -3 }, { ideo: [0, -1], abroad: 3 });
L(8, 'skilledvisa', 'Visas for skilled people', 'None|Some|Fast-track', n => n.dev > 0.6 ? 1 : 0, { g: 0.08, t: 0.15 }, { business: 6, students: 2, workers: -2 });
L(8, 'border', 'Border security', 'Open|Normal|Tight|Wall', n => 1, { $: 0.1, s: 0.3, f: -1 }, { police: 4, military: 2, minorities: -4, workers: 2, business: -2 }, { ideo: [0, 1] });
L(8, 'goldenvisa', 'Golden visas (residency for investors)', 'No|Yes', n => 0, { g: 0.03, c: 0.02, $: -0.05 }, { elite: 5, business: 3, youth: -3, workers: -2 });
// Military
L(9, 'conscript', 'Military service', 'Volunteer|Selective draft|Everyone serves', n => ['KOR', 'ISR', 'SGP', 'FIN', 'TWN', 'UKR', 'RUS', 'PRK', 'IRN', 'EGY', 'TUR', 'GRC', 'SWE', 'NOR', 'DNK', 'EST', 'LTU', 'LVA', 'CHE', 'AUT', 'CUB', 'VNM', 'ERI'].includes(n.id) ? 2 : 0, { g: -0.06, u: -0.3, milK: 0.35 }, { military: 7, youth: -8, students: -6, retirees: 2 }, { ideo: [0, 1] });
L(9, 'reserves', 'Military reserves', 'Small|Normal|Large', n => 1, { $: 0.2, milK: 0.15 }, { military: 5, workers: -1 });
L(9, 'arms', 'Arms exports', 'Banned|Allies only|Anyone', n => ['USA', 'RUS', 'FRA', 'CHN', 'DEU', 'ITA', 'GBR', 'ISR', 'KOR', 'TUR', 'ESP'].includes(n.id) ? 1 : 1, { g: 0.04, $: -0.15 }, { business: 4, military: 3, students: -4, media: -2 }, { abroad: -2 });
L(9, 'martial', 'Military in politics', 'Barracks only|Advisory|Ruling', n => n.gov === 'JUNTA' ? 2 : free(n) ? 0 : 1, { s: 1, f: -6, g: -0.08 }, { military: 9, media: -6, students: -6, business: -2 }, { k: 1, sup: true });
L(9, 'nukedoc', 'Nuclear doctrine', 'No first use|Deterrence|Any threat', n => n.nukes ? 1 : 0, { s: 0.2 }, { military: 4, students: -3, green: -3 }, { abroad: -5 });
// Technology
L(10, 'ai', 'AI rules', 'Unregulated|Balanced|Strict', n => n.blocs.includes('EU') ? 2 : 1, { g: -0.06, t: -0.1, u: -0.1 }, { workers: 4, business: -4, media: 2, youth: -1 });
L(10, 'chips', 'Chip industry support', 'None|Some|National priority', n => n.res.includes('chips') ? 2 : 0, { $: 0.4, g: 0.08, t: 0.3 }, { business: 5, workers: 2 });
L(10, 'privacy', 'Data privacy', 'None|Basic|Strong', n => n.blocs.includes('EU') ? 2 : free(n) ? 1 : 0, { g: -0.02, f: 2 }, { youth: 4, media: 2, business: -3 });
L(10, 'openresearch', 'Research funding prizes', 'None|Some|Large', n => n.dev > 0.6 ? 1 : 0, { $: 0.25, t: 0.4 }, { students: 5, business: 2 });
// Society
L(11, 'alcohol', 'Alcohol', 'Banned|Restricted|Legal', n => ['SAU', 'KWT', 'IRN', 'AFG', 'LBY', 'YEM', 'SDN', 'SOM', 'MRT', 'BRN'].includes(n.id) ? 0 : 2, { f: 1, $: -0.1, s: -0.1 }, { religious: -6, youth: 4, business: 3 }, { ideo: [0, -1] });
L(11, 'gambling', 'Gambling', 'Banned|Licensed|Open', n => 1, { $: -0.15, c: 0.01 }, { religious: -5, business: 3, elite: 2 });
L(11, 'dresscode', 'Dress code', 'None|Public places|Strict religious', n => ['IRN', 'AFG', 'SAU'].includes(n.id) ? 2 : 0, { f: -4 }, { religious: 6, women: -8, youth: -6, students: -5 }, { ideo: [0, 1], abroad: -3 });
L(11, 'culture', 'National culture push', 'None|Some|Strong', n => free(n) ? 0 : 1, { $: 0.1, s: 0.3, x: 1 }, { religious: 2, minorities: -3, military: 2 });
L(11, 'sport', 'Sports & Olympics funding', 'Low|Normal|High', n => 1, { $: 0.1, a: 0.3, x: 1 }, { youth: 4, workers: 1 });
L(11, 'language', 'Official languages', 'One only|Main + regional|All equal', n => 1, { s: 0.3, f: 1 }, { minorities: 7, religious: -1, retirees: -2 });
// Constitution (need two thirds of parliament in free countries)
L(12, 'termlimit', 'Term limits', 'None|3 terms|2 terms', n => free(n) ? 2 : (['USA', 'MEX', 'BRA', 'COL', 'KOR', 'PHL'].includes(n.id) ? 2 : 0), { f: 3, s: 0.2 }, { media: 3, students: 2, military: -1 }, { sup: true, k: -1 });
L(12, 'emergency', 'Emergency powers', 'None|Limited|Broad', n => free(n) ? 0 : 2, { s: 1.5, f: -8 }, { police: 4, military: 4, media: -7, students: -6, minorities: -4 }, { k: 1, sup: true });
L(12, 'federal', 'Power of regions', 'Central|Devolved|Federal', n => ['USA', 'DEU', 'IND', 'BRA', 'CAN', 'AUS', 'MEX', 'ARG', 'NGA', 'RUS', 'CHE', 'AUT', 'BEL', 'MYS', 'ETH', 'PAK', 'ARE', 'NPL', 'BIH', 'SOM', 'SSD', 'IRQ', 'VEN', 'FSM', 'KNA', 'COM'].includes(n.id) ? 2 : 1, { s: 0.6, c: 0.01, f: 2 }, { minorities: 5, farmers: 2, elite: -1 }, { sup: true });
L(12, 'court', 'Supreme court size', 'Normal|Expanded', n => 0, { f: -4 }, { media: -6, students: -3, elite: -2 }, { sup: false, k: 0, courtPack: true });
L(12, 'elections', 'Elections', 'None|Managed|Free and fair', n => free(n) ? 2 : ['AMON', 'THEO', 'ONEP', 'JUNTA'].includes(n.gov) ? 0 : 1, { f: 10, s: -0.4 }, { media: 6, students: 6, military: -3, elite: -2 }, { sup: true });
L(12, 'oppos', 'Opposition parties', 'Banned|Harassed|Free', n => free(n) ? 2 : n.gov === 'AUTH' ? 1 : 0, { f: 8, s: -0.6 }, { media: 5, students: 5, police: -3, military: -2 }, { k: -1 });

// ---- names for generated people, by culture
const NAMES = {
  en: ['James Carter|Emily Hart|Daniel Brooks|Sarah Mitchell|Michael Reid|Olivia Grant|David Shaw|Grace Bennett|Thomas Hale|Laura Pierce|Robert Lane|Anna Doyle'],
  es: ['Carlos Mendoza|Lucía Herrera|Javier Ortega|María Castillo|Andrés Rojas|Sofía Navarro|Diego Ramírez|Elena Vargas|Pablo Morales|Valentina Cruz|Raúl Delgado|Camila Reyes'],
  pt: ['João Ferreira|Ana Carvalho|Pedro Almeida|Mariana Costa|Rafael Souza|Beatriz Lima|Lucas Ribeiro|Camila Rocha|Tiago Martins|Juliana Pereira'],
  fr: ['Pierre Lefèvre|Claire Dubois|Antoine Moreau|Camille Laurent|Julien Girard|Sophie Bernard|Nicolas Fournier|Élise Lambert|Mathieu Rousseau|Chloé Martin'],
  de: ['Lukas Schneider|Anna Becker|Jonas Weber|Lea Hoffmann|Felix Wagner|Hannah Fischer|Maximilian Koch|Clara Richter|Paul Neumann|Marie Schulz'],
  it: ['Marco Rossi|Giulia Bianchi|Luca Romano|Francesca Ricci|Matteo Greco|Chiara Conti|Alessandro Gallo|Sara Marino'],
  sl: ['Ivan Petrov|Anna Volkova|Dmitri Sokolov|Elena Morozova|Andrei Kuznetsov|Olga Pavlova|Piotr Nowak|Katarzyna Wójcik|Tomáš Novák|Jana Horvat|Milan Jovanović|Ivana Kovač'],
  no: ['Erik Lindqvist|Ingrid Hansen|Lars Johansson|Sofie Nielsen|Mikael Virtanen|Emma Andersen|Olav Berg|Freja Larsen'],
  ar: ['Ahmed Al-Masri|Fatima Haddad|Omar Khalil|Layla Nasser|Youssef Saleh|Mariam Aziz|Khalid Rahman|Noura Hassan|Tariq Mansour|Huda Karim'],
  fa: ['Reza Tehrani|Maryam Ahmadi|Ali Karimi|Zahra Hosseini|Hassan Moradi|Leila Rostami'],
  tr: ['Mehmet Yılmaz|Ayşe Demir|Emre Kaya|Zeynep Şahin|Murat Aydın|Elif Çelik|Nursultan Abenov|Aigerim Bekova|Rustam Karimov|Dilnoza Yusupova'],
  in: ['Arjun Sharma|Priya Patel|Rahul Verma|Ananya Iyer|Vikram Singh|Kavya Reddy|Imran Khan|Ayesha Siddiqui|Rajesh Kumar|Sunita Das|Tanvir Ahmed|Nusrat Begum'],
  zh: ['Wang Wei|Li Na|Zhang Jun|Chen Jing|Liu Yang|Huang Mei|Zhao Lei|Lin Hui|Wu Gang|Xu Ying'],
  ja: ['Takashi Sato|Yuki Tanaka|Hiroshi Suzuki|Aiko Watanabe|Kenji Ito|Mei Yamamoto|Daisuke Kobayashi|Sakura Nakamura'],
  ko: ['Kim Min-jun|Lee Seo-yeon|Park Ji-hoon|Choi Yu-na|Jung Hyun-woo|Kang Ji-min'],
  sea: ['Nguyen Van Minh|Tran Thi Lan|Somchai Wongsakul|Siriporn Chaiyasit|Budi Santoso|Siti Rahayu|Jose Reyes|Maria Santos|Ahmad Zulkifli|Nur Aisyah'],
  af: ['Kwame Mensah|Amara Okafor|Chinedu Eze|Ngozi Adeyemi|Tendai Moyo|Thandiwe Nkosi|Juma Otieno|Wanjiru Kamau|Moussa Diallo|Aminata Traoré|Abebe Tesfaye|Hirut Bekele'],
  pac: ['Sione Tupou|Mele Fifita|Ratu Vuniani|Losana Tuilagi|Tavita Faleolo|Lani Kealoha']
};
function cultureOf(c) {
  const L0 = (c.langs[0] || ''), sub = c.sub || '', r = c.region;
  if (/Spanish/.test(L0)) return 'es'; if (/Portuguese/.test(L0)) return 'pt'; if (/French/.test(L0) && r === 'Europe') return 'fr';
  if (/German/.test(c.langs.join())) return 'de'; if (/Italian/.test(L0)) return 'it'; if (/Arabic/.test(c.langs.join())) return 'ar';
  if (/Persian|Dari|Pashto/.test(c.langs.join())) return 'fa'; if (/Turkish|Kazakh|Uzbek|Turkmen|Kyrgyz|Azerbaijani/.test(c.langs.join())) return 'tr';
  if (/Chinese/.test(c.langs.join())) return 'zh'; if (L0 === 'Japanese') return 'ja'; if (/Korean/.test(L0)) return 'ko';
  if (/Swedish|Norwegian|Danish|Finnish|Icelandic/.test(c.langs.join())) return 'no';
  if (/Eastern Europe|Southeast Europe/.test(sub) || /Russian|Polish|Czech|Slovak|Serbian|Croatian|Bulgarian|Ukrainian|Belarusian|Slovene|Macedonian|Bosnian/.test(c.langs.join())) return 'sl';
  if (sub === 'Southern Asia') return 'in'; if (sub === 'South-Eastern Asia') return 'sea';
  if (r === 'Africa') return /French/.test(L0) ? (sub === 'Northern Africa' ? 'ar' : 'af') : 'af';
  if (r === 'Oceania' && c.id !== 'AUS' && c.id !== 'NZL') return 'pac';
  return 'en';
}
function personName(c, r) { const list = NAMES[cultureOf(c)][0].split('|'); return list[Math.floor(r() * list.length)]; }

// ---- Big projects, built at one of your cities and shown on the map
const PROJECTS = [
  { id: 'hsr', name: 'High-speed railway', cost: 1.2, months: 48, fx: { infra: 0.4, a: 2 }, look: 'rail', desc: 'Links your two biggest cities. Faster trips, more growth.' },
  { id: 'motorway', name: 'Motorway network', cost: 0.8, months: 30, fx: { infra: 0.3, a: 1 }, look: 'road' },
  { id: 'port', name: 'Mega port', cost: 0.5, months: 30, fx: { infra: 0.15, g: 0.15 }, look: 'port' },
  { id: 'airport', name: 'International airport', cost: 0.4, months: 30, fx: { infra: 0.1, g: 0.08, tour: 1 }, look: 'tower' },
  { id: 'nuclear', name: 'Nuclear power plant', cost: 0.7, months: 72, fx: { infra: 0.15, e: -1, g: 0.05 }, look: 'dome' },
  { id: 'solar', name: 'Giant solar farm', cost: 0.3, months: 18, fx: { e: -0.6, g: 0.03 }, look: 'flat' },
  { id: 'wind', name: 'Offshore wind farm', cost: 0.35, months: 24, fx: { e: -0.6, g: 0.03 }, look: 'flat' },
  { id: 'dam', name: 'Hydro dam', cost: 0.6, months: 60, fx: { e: -0.5, infra: 0.1, g: 0.05 }, look: 'dam' },
  { id: 'uni', name: 'Flagship university', cost: 0.25, months: 36, fx: { human: 0.15, t: 0.3, a: 1 }, look: 'campus' },
  { id: 'hospital', name: 'Network of new hospitals', cost: 0.4, months: 30, fx: { health: 0.25, a: 3 }, look: 'campus' },
  { id: 'chipfab', name: 'Chip factory', cost: 0.6, months: 42, fx: { g: 0.2, t: 0.5, know: 0.1 }, look: 'factory' },
  { id: 'datacenter', name: 'AI data centres', cost: 0.4, months: 24, fx: { g: 0.12, t: 0.4 }, look: 'factory' },
  { id: 'capital', name: 'New capital city', cost: 2.5, months: 96, fx: { infra: 0.3, s: 4, x: 3 }, look: 'tower' },
  { id: 'wall', name: 'Border wall', cost: 0.5, months: 36, fx: { s: 2, f: -2 }, look: 'wall', groups: { police: 4, minorities: -5, military: 2 } },
  { id: 'space', name: 'Space programme', cost: 0.5, months: 60, fx: { t: 0.6, x: 4, a: 2 }, look: 'rocket' },
  { id: 'moon', name: 'Moon base', cost: 1.5, months: 96, fx: { t: 1, x: 8, a: 4 }, look: 'rocket', needs: 'space' },
  { id: 'stadium', name: 'National stadium', cost: 0.1, months: 24, fx: { a: 2, x: 1 }, look: 'dome' },
  { id: 'olympics', name: 'Host the Olympics', cost: 0.6, months: 48, fx: { a: 4, x: 6, g: 0.05, tour: 2 }, look: 'dome' },
  { id: 'monument', name: 'National monument', cost: 0.05, months: 18, fx: { a: 1, x: 1, s: 1 }, look: 'tower' },
  { id: 'housingplan', name: 'One million homes', cost: 1.0, months: 48, fx: { a: 4, s: 2, g: 0.05 }, look: 'blocks', groups: { youth: 6, workers: 4 } },
  { id: 'water', name: 'Clean water for all', cost: 0.3, months: 30, fx: { health: 0.15, a: 3, s: 1 }, look: 'flat' },
  { id: 'broadband', name: 'Fast internet everywhere', cost: 0.3, months: 30, fx: { g: 0.08, t: 0.2, a: 1 }, look: 'tower' },
  { id: 'metro', name: 'City metro system', cost: 0.5, months: 48, fx: { infra: 0.2, a: 2, e: -0.2 }, look: 'rail' },
  { id: 'missiledef', name: 'Missile defence shield', cost: 0.6, months: 48, fx: { milK: 0.1, s: 1 }, look: 'dome', groups: { military: 6 } },
  { id: 'navybase', name: 'Naval base', cost: 0.3, months: 36, fx: { milK: 0.08 }, look: 'port', groups: { military: 5 } }
];

SYSTEM_INITS.push(initPolitics);
MONTHLY.push(() => politicsMonth(G.nations[G.player.idx]));
DAILY.push(() => reactionDay(G.nations[G.player.idx]));
// what each group thinks of a budget change (per % of GDP spent, per point of tax)
const SPEND_FANS = { health: { workers: 2, retirees: 3, women: 1 }, education: { students: 4, youth: 2, women: 1 }, pensions: { retirees: 6 }, welfare: { workers: 3, youth: 1, minorities: 2 },
  defence: { military: 6, students: -1 }, police: { police: 6, minorities: -1 }, infrastructure: { workers: 2, business: 2, farmers: 1 }, science: { students: 2, business: 1 },
  environment: { green: 6, youth: 1 }, culture: { youth: 2 }, aid: { media: 1, workers: -1 }, intel: { police: 1, military: 1 }, space: { youth: 1, students: 1 }, justice: { police: 1 } };
const TAX_FANS = { income: { workers: -0.6, elite: -0.6, youth: -0.3 }, corporate: { business: -0.8, elite: -0.3, workers: 0.2 }, sales: { workers: -0.7, retirees: -0.6 },
  tariff: { farmers: 0.4, business: -0.5, workers: 0.1 }, wealth: { elite: -5, workers: 1, students: 1 }, property: { elite: -2, retirees: -2 }, carbon: { green: 0.15, business: -0.08, farmers: -0.08, workers: -0.04 } };
function budgetStances(n, tax, spend) {
  const s = {}, add = (m, k) => { for (const g in m) s[g] = (s[g] || 0) + m[g] * k; };
  for (const id in SPEND_FANS) add(SPEND_FANS[id], soft((spend[id] || 0) - n.spend[id], 3) * 1.6);
  for (const id in TAX_FANS) add(TAX_FANS[id], (tax[id] || 0) - n.tax[id]);
  for (const g in s) s[g] = clamp(s[g], -10, 10);
  return s;
}
// ---- set up the player's political world (fills only what is missing, so old saves gain it too)
function initPolitics(g) {
  const n = g.nations[g.player.idx], c = World.countries[n.idx], r = makeRng(g.seed + 7);
  if (!n.laws) { n.laws = {}; for (const l of LAWS) n.laws[l.id] = clamp(l.def(n), 0, l.levels.length - 1); n.laws0 = Object.assign({}, n.laws); }
  if (!n.groups) {
    const P = g.player;
    n.groups = {}; n.gmem = {};
    for (const gr of GROUPS) { const like = -6 * Math.abs(P.econ - gr.lean[0]) - 6 * Math.abs(P.social - gr.lean[1]) + 6; n.groups[gr.id] = clamp(n.approval + like, 5, 95); n.gmem[gr.id] = 0; }
    n.groups0 = Object.assign({}, n.groups);
  }
  if (n.pc == null) n.pc = 40;
  if (n.freedom == null) n.freedom = clamp(n.dem * 10, 3, 98), n.freedom0 = n.freedom;
  if (n.polar == null) n.polar = free(n) ? 35 : 15;
  if (!n.parl) n.parl = makeParliament(n, g.player, r);
  if (!n.court) n.court = { indep: clamp(n.dem / 10, 0.05, 0.95), packed: false, pending: [] };
  if (!n.cabinet) n.cabinet = makeCabinet(n, r);
  if (!n.projects) n.projects = [];
  if (n.tech == null) n.tech = 0;
  applyLaws(n);
}
const PARTY_TEMPLATES = [
  { name: 'Workers Party', ideo: [-0.8, -0.2], color: '#d94b4b' }, { name: 'Green Alliance', ideo: [-0.4, -0.8], color: '#3fae6a' },
  { name: 'Liberal Democrats', ideo: [0.1, -0.5], color: '#f0c040' }, { name: 'Centre Union', ideo: [0, 0], color: '#e08a3c' },
  { name: 'Conservative Party', ideo: [0.6, 0.5], color: '#3b7dd8' }, { name: 'National Front', ideo: [0.3, 0.9], color: '#5a3d8a' }
];
function makeParliament(n, P, r) {
  const mine = { id: 'me', name: P.party, ideo: [P.econ, P.social], color: '#e2b65c', seats: 0, gov: true };
  const others = PARTY_TEMPLATES.filter(t => Math.hypot(t.ideo[0] - P.econ, t.ideo[1] - P.social) > 0.45).map((t, i) => Object.assign({ id: 'p' + i, seats: 0, gov: false }, t));
  const total = clamp(Math.round(Math.pow(n.pop, 0.33) / 2.2) * 2 + 1, 41, 651);
  const parties = [mine, ...others];
  if (free(n)) {
    let myShare = clamp(0.32 + (n.approval - 40) / 200, 0.25, 0.5);
    mine.seats = Math.round(total * myShare);
    const w = others.map(() => 0.3 + r()), ws = w.reduce((a, b) => a + b, 0);
    others.forEach((p, i) => p.seats = Math.round((total - mine.seats) * w[i] / ws));
    // coalition: closest partners until a majority
    const sorted = others.slice().sort((a, b) => Math.hypot(a.ideo[0] - P.econ, a.ideo[1] - P.social) - Math.hypot(b.ideo[0] - P.econ, b.ideo[1] - P.social));
    let have = mine.seats; for (const p of sorted) { if (have > total / 2) break; p.gov = true; have += p.seats; }
  } else {
    mine.seats = Math.round(total * (0.75 + r() * 0.2));
    const rest = total - mine.seats; others.slice(0, 2).forEach((p, i) => p.seats = Math.round(rest * (i ? 0.4 : 0.6)));
  }
  const sum = parties.reduce((a, p) => a + p.seats, 0); mine.seats += total - sum;
  return { parties: parties.filter(p => p.seats > 0), total };
}
const POSTS = [['finance', 'Finance'], ['economy', 'Economy'], ['foreign', 'Foreign Affairs'], ['defence', 'Defence'], ['interior', 'Interior'], ['health', 'Health'], ['education', 'Education'], ['justice', 'Justice']];
function makeMinister(c, r, post) {
  return { post, name: personName(c, r), skill: 3 + Math.floor(r() * 7), loyalty: 40 + Math.floor(r() * 50), ambition: Math.floor(r() * 100), honesty: Math.floor(r() * 100) };
}
function makeCabinet(n, r) { const c = World.countries[n.idx]; return Object.fromEntries(POSTS.map(([p]) => [p, makeMinister(c, r, p)])); }

// Law and cabinet effects become named modifiers on the formulas
function applyLaws(n) {
  const tot = {}, gr = {};
  for (const l of LAWS) {
    const d = n.laws[l.id] - n.laws0[l.id]; if (!d) continue;
    for (const k in l.fx) tot[k] = (tot[k] || 0) + l.fx[k] * d;
    for (const k in l.groups) gr[k] = (gr[k] || 0) + l.groups[k] * d;
  }
  n.lawGroups = gr; n.lawFx = tot;
  n.rentMult = 1 + (tot.rentK || 0); n.popGrowth0 = n.popGrowth0 == null ? n.popGrowth : n.popGrowth0; n.popGrowth = n.popGrowth0 + (tot.p || 0);
  setMod(n, 'growth', 'Laws', tot.g || 0); setMod(n, 'infl', 'Laws', tot.i || 0); setMod(n, 'unemp', 'Laws', tot.u || 0);
  setMod(n, 'stability', 'Laws', tot.s || 0); setMod(n, 'approval', 'Laws', tot.a || 0); setMod(n, 'yield', 'Laws', tot.y || 0);
  n.cost = n.cost || {}; n.cost.Laws = tot.$ || 0;
  n.corruption = clamp(n.base.corruption + (n.mods.corruption || 0) + (tot.c || 0), 0.02, 0.9);
  n.freedom = clamp(n.freedom0 + (tot.f || 0) + (n.freeHit || 0), 0, 100);
  n.dem = clamp(n.freedom / 10, 0, 10);
  // ministers: skill 5 is average
  const cab = n.cabinet, sk = p => (cab[p] ? cab[p].skill - 5 : 0);
  setMod(n, 'yield', 'Finance minister', -0.08 * sk('finance')); setMod(n, 'growth', 'Economy minister', 0.04 * sk('economy'));
  setMod(n, 'stability', 'Interior minister', 0.5 * sk('interior')); setMod(n, 'approval', 'Health & Education ministers', 0.25 * (sk('health') + sk('education')));
  n.corruption = clamp(n.corruption - 0.01 * sk('justice'), 0.02, 0.9);
}

// Each group's opinion = the general mood + what that group specifically cares about
function groupsApproval(n, general) {
  if (!n.groups) return general;
  const b = n.base, P = G.player, sp = id => n.spend[id] - b.spend[id], tx = id => n.tax[id] - b.tax[id];
  const spec = {
    workers: 1.2 * sp('welfare') - 0.25 * tx('income') - 0.3 * tx('sales') - 0.3 * (n.unemp - b.un),
    business: -0.5 * tx('corporate') - 0.15 * tx('carbon') / 10 - 0.25 * tx('tariff') + 1.5 * (n.growth - b.growth),
    farmers: 0.3 * tx('tariff'), retirees: 2 * sp('pensions') + 0.8 * sp('health') - 0.6 * (n.infl - b.infl),
    youth: 0.8 * sp('education') - 0.6 * (n.unemp - b.un) + 0.8 * sp('culture'), students: 2 * sp('education') + 0.5 * sp('science'),
    green: 3 * sp('environment') + 0.15 * tx('carbon') / 5, military: 2.5 * sp('defence'), police: 3 * sp('police'),
    elite: -3 * tx('wealth') - 0.3 * tx('income') - 0.2 * tx('property') * 10, media: 0.1 * (n.freedom - n.freedom0),
    women: 0.5 * sp('health') + 0.5 * sp('welfare'), minorities: 0.6 * sp('welfare'), religious: 0
  };
  let sum = 0, wsum = 0; n.gwhy = {};
  for (const gr of GROUPS) {
    const id = gr.id, ideo = 6 - 6 * Math.abs(P.econ - gr.lean[0]) - 6 * Math.abs(P.social - gr.lean[1]);
    const parts = [['General mood', general], ['Your ideology', ideo], ['Laws', clamp(n.lawGroups[id] || 0, -40, 40)], ['Spending and taxes', clamp(spec[id] || 0, -25, 25)], ['Recent events and reactions', n.gmem[id] || 0]];
    const t = clamp(parts.reduce((a, p) => a + p[1], 0), 1, 99);
    n.groups[id] += (t - n.groups[id]) * 0.25;
    n.gwhy[id] = parts;
    const w = gr.share(n); sum += n.groups[id] * w; wsum += w;
    n.gmem[id] *= 0.9;
  }
  return sum / wsum;
}

// ---- parliament votes
function lawVote(n, law, level) {
  const dir = Math.sign(level - n.laws[law.id]), P = n.parl, pc = n.pc;
  const reac = reactionPreview(n, lawStances(law, level - n.laws[law.id]), 1).avg;
  let yes = 0;
  const rows = P.parties.map(p => {
    const align = (law.ideo[0] * p.ideo[0] + law.ideo[1] * p.ideo[1]) * dir;
    let prob = (p.gov ? (p.id === 'me' ? 0.97 : 0.72) : 0.22) + 0.35 * align + 0.012 * reac + (p.id === 'me' ? 0 : 0.002 * Math.min(pc, 60));
    if (!free(n)) prob = p.id === 'me' ? 1 : 0.6;
    prob = clamp(prob, 0.02, 0.99);
    const v = Math.round(p.seats * prob); yes += v; return { name: p.name, color: p.color, seats: p.seats, yes: v };
  });
  const need = law.sup && free(n) ? Math.ceil(P.total * 2 / 3) : Math.floor(P.total / 2) + 1;
  return { yes, need, total: P.total, pass: yes >= need, rows };
}
function lawCost(n, law, level) { return Math.round((4 + 3 * Math.abs(level - n.laws[law.id])) * (law.sup ? 2 : 1) * (free(n) ? 1 : 0.6)); }
function lawStances(law, steps) { const s = {}; for (const k in law.groups) s[k] = law.groups[k] * steps; return s; }

const Politics = {
  propose(lawId, level) {
    const n = G.nations[G.player.idx], law = LAWS.find(l => l.id === lawId), cost = lawCost(n, law, level);
    if (n.pc < cost) return { ok: false, msg: 'Not enough political capital (' + cost + ' needed).' };
    n.pc -= cost;
    const v = lawVote(n, law, level);
    if (!v.pass) { inbox('bad', law.name + ': vote failed', `Parliament voted ${v.yes} to ${v.total - v.yes} (needed ${v.need}).`); react(n, { key: 'lawfail', title: law.name + ' defeated in parliament', stance: {}, size: 0.5, topic: law.name }); Bus.emit('changed'); return { ok: false, msg: 'The vote failed: ' + v.yes + ' of ' + v.total + ' (needed ' + v.need + ').' }; }
    const from = n.laws[law.id], steps = level - from;
    n.laws[law.id] = level; applyLaws(n);
    react(n, { key: 'law', title: law.name + ': ' + law.levels[level], stance: lawStances(law, steps), size: 1 + Math.abs(steps) * 0.4, topic: law.name, abroad: (law.abroad || 0) * steps });
    if (free(n) && law.k && law.k * steps > 0 && G.rng() < n.court.indep * 0.8) n.court.pending.push({ law: law.id, from, due: G.day + 45 + Math.floor(G.rng() * 60) });
    if (law.courtPack && level > 0) { n.court.indep = Math.max(0.1, n.court.indep - 0.4); n.freeHit = (n.freeHit || 0) - 6; applyLaws(n); }
    inbox('info', law.name + ' changed', `Now: ${law.levels[level]}. Parliament voted ${v.yes} to ${v.total - v.yes}.`);
    Bus.emit('changed');
    return { ok: true };
  },
  hire(post, person) { const n = G.nations[G.player.idx]; if (n.pc < 5) return false; n.pc -= 5; n.cabinet[post] = person; applyLaws(n); react(n, { key: 'hire', title: 'New ' + POSTS.find(p => p[0] === post)[1] + ' minister: ' + person.name, stance: {}, size: 0.3 }); Bus.emit('changed'); return true; },
  candidates(post) { const c = World.countries[G.player.idx], r = makeRng(G.seed + G.day + post.length * 13); return [0, 1, 2].map(() => makeMinister(c, r, post)); },
  startProject(id, cityIdx) {
    const n = G.nations[G.player.idx], P = PROJECTS.find(p => p.id === id);
    if (n.projects.some(p => p.id === id && !p.done) || (P.needs && !n.projects.some(p => p.id === P.needs && p.done))) return false;
    if (n.pc < 6) return false; n.pc -= 6;
    n.projects.push({ id, city: cityIdx, start: G.day, months: P.months, progress: 0, done: false });
    react(n, { key: 'project', title: 'Work starts on ' + P.name, stance: Object.assign({ workers: 3, business: 2 }, P.groups || {}), size: 0.8 });
    projectCosts(n); Bus.emit('changed'); return true;
  },
  cancelProject(i) { const n = G.nations[G.player.idx]; const pr = n.projects[i]; if (!pr || pr.done) return; n.projects.splice(i, 1); projectCosts(n); react(n, { key: 'cancel', title: 'Project cancelled: ' + PROJECTS.find(p => p.id === pr.id).name, stance: { workers: -3, business: -2 }, size: 0.6 }); Bus.emit('changed'); }
};
function projectCosts(n) { n.cost = n.cost || {}; n.cost.Projects = n.projects.filter(p => !p.done).reduce((a, p) => { const P = PROJECTS.find(x => x.id === p.id); return a + P.cost / P.months * 12; }, 0); }

// monthly politics for the player
function politicsMonth(n) {
  const P = G.player;
  n.pc = clamp(n.pc + 1 + n.approval / 30 + (P.traits.includes('charismatic') ? 1 : 0) + (free(n) ? 0 : 2), 0, 100);
  n.polar = clamp(n.polar * 0.985 + 0.4, 5, 95);
  // projects
  for (const pr of n.projects) {
    if (pr.done) continue;
    pr.progress = Math.min(1, pr.progress + 1 / pr.months);
    if (pr.progress >= 1) {
      pr.done = true; const PJ = PROJECTS.find(x => x.id === pr.id), fx = PJ.fx;
      n.base.k.infra -= (fx.infra || 0); n.base.k.human -= (fx.human || 0); n.base.k.health -= (fx.health || 0); n.base.k.know -= (fx.know || 0); // shows as stronger foundations
      const done = n.projects.filter(p => p.done).map(p => PROJECTS.find(x => x.id === p.id));
      setMod(n, 'growth', 'Projects', done.reduce((a, p) => a + (p.fx.g || 0), 0));
      setMod(n, 'stability', 'Projects', done.reduce((a, p) => a + (p.fx.s || 0), 0));
      setMod(n, 'approval', 'Projects', done.reduce((a, p) => a + (p.fx.a || 0) * 0.5, 0));
      n.tech += (fx.t || 0) * 10; n.prestige = (n.prestige || 0) + (fx.x || 0);
      inbox('good', PJ.name + ' finished', 'Opened in ' + World.cities[pr.city].name + '. Everyone wants a photo with you.');
      react(n, { key: 'opened', title: PJ.name + ' opens in ' + World.cities[pr.city].name, stance: Object.assign({ workers: 2, business: 3 }, PJ.groups || {}), size: 1.2, city: pr.city, mood: 1 });
      projectCosts(n); Life.refreshProjects && Life.refreshProjects();
    }
  }
  // courts
  for (const cs of n.court.pending.slice()) if (G.day >= cs.due) {
    n.court.pending.splice(n.court.pending.indexOf(cs), 1);
    const law = LAWS.find(l => l.id === cs.law);
    if (G.rng() < n.court.indep) {
      UI.courtRuling && UI.courtRuling(law, cs.from);
    }
  }
  // ministers: loyalty follows approval; disloyal ambitious ministers may quit or leak
  for (const [post, m] of Object.entries(n.cabinet)) {
    m.loyalty = clamp(m.loyalty + (n.approval - 45) / 40 + (G.rng() - 0.5) * 2, 0, 100);
    if (m.loyalty < 20 && m.ambition > 60 && G.rng() < 0.08) {
      const c = World.countries[n.idx];
      inbox('bad', m.name + ' resigned', 'Your ' + POSTS.find(p => p[0] === post)[1] + ' minister quit and attacked you on TV.');
      react(n, { key: 'resign', title: 'Minister ' + m.name + ' quits, slams the government', stance: { media: 2 }, size: 1.2, mood: -1 });
      n.cabinet[post] = makeMinister(c, G.rng, post); n.cabinet[post].loyalty = 60; applyLaws(n);
    }
  }
}
function courtStrike(n, law, from, comply) {
  if (comply) { n.laws[law.id] = from; applyLaws(n); react(n, { key: 'court', title: 'Supreme Court strikes down ' + law.name, stance: { media: 3, students: 2 }, size: 1, mood: -0.5 }); }
  else { n.freeHit = (n.freeHit || 0) - 8; n.court.indep = Math.max(0.05, n.court.indep - 0.2); applyLaws(n); react(n, { key: 'defy', title: 'Government defies the Supreme Court', stance: { media: -8, students: -6, elite: -3, police: 2 }, size: 2, mood: -1, abroad: -4 }); }
  Bus.emit('changed');
}
MONTHLY.push(() => Life.refreshProjects());
