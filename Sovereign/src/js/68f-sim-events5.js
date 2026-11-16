// Events, fifth batch (1.4): the World Council, the scenarios, and a few rare ones people will remember.
// fx.inf moves Council influence (standing); fx.fn(n, ctx) runs custom code when chosen.
const hasAgenda = () => !!(G.council && G.council.agenda.length);
const scn = id => !!(G.scenario && G.scenario.id === id);
const NORTH = ['RUS', 'CAN', 'NOR', 'ISL', 'FIN', 'SWE', 'DNK', 'USA', 'GRL'];

// ---- the World Council
E('councilbribe', 'Foreign', (n, c, ctx) => hasAgenda() && ctx.rival != null ? 0.012 : 0, 'A suitcase for your vote', ['A diplomat from {rival} hints that a "development grant" would follow if we vote their way at the next World Council session.'],
  [['Take the money and vote their way', { $: -0.15, r: 12, inf: -3, scandalRisk: 0.25 }], ['Refuse politely', { r: -3 }], ['Expose the offer to the press', { r: -15, inf: 3, abroad: 3, grp: { media: 3 } }]], { needRival: true });
E('councilspeech', 'Foreign', () => hasAgenda() ? 0.012 : 0, 'Your ambassador\'s big speech', ['Our ambassador to the World Council wants to give a fiery speech before the next vote. Diplomats say it could go either way.'],
  [['Let them speak their mind', { inf: 3, risk: 0.3, grp: { media: 2 } }], ['Write them a careful, boring speech', { inf: 1 }], ['Skip the debate', { inf: -1 }]]);
E('vetoplea', 'Foreign', (n) => hasAgenda() && !n.blocs.includes('UNSC') ? 0.008 : 0, 'A great power asks a favour', ['A permanent member of the Security Council asks us to stand with them at the next session. In return they offer investment.'],
  [['Promise our support', { g: 0.1, inf: -1, fn: n => { const it = G.council.agenda[0]; if (it && it.vote == null) it.vote = it.by != null && relation(n.idx, it.by) > 0 ? 1 : -1; } }], ['We vote our conscience', { inf: 1, a: 1 }]]);
E('secgen', 'Foreign', (n) => G.council && Council.influence(n) > 35 ? 0.002 : 0, 'One of ours for Secretary-General?', ['The world\'s diplomats are looking for a new Secretary-General of the World Council, and {person}, our former foreign minister, is on the shortlist. Campaigning would cost a fortune.'],
  [['Campaign for the job', { $: 0.05, pc: -8, fn: n => { if (G.rng() < 0.3 + Council.influence(n) / 200) { Council.stand(12); n.prestige = (n.prestige || 0) + 4; inbox('good', 'Secretary-General!', 'Our candidate won the vote. The world\'s top diplomat is one of us.'); } else { Council.stand(-2); inbox('bad', 'Not this time', 'Our candidate lost the Secretary-General vote.'); } } }], ['Back a candidate from a friendly country', { inf: 2, r: 5, friendSide: true }]], { needFriend: true });
E('peacekeepers', 'Foreign', (n) => G.council && G.council.laws.some(l => l.kind === 'peacekeep') && !n.atWar ? 0.01 : 0, 'Send blue helmets?', ['The World Council needs soldiers for its peacekeeping mission. Will we send some of ours?'],
  [['Send a battalion', { $: 0.03, inf: 4, x: 1, grp: { military: 2 } }], ['Send money, not soldiers', { $: 0.05, inf: 2 }], ['Not our war', { inf: -1 }]]);
E('defylaw', 'Politics', () => G.council && Object.keys(G.council.defy || {}).length ? 0.015 : 0, 'Defiance at home and abroad', ['Our refusal to follow a World Council law is front-page news. Some voters love it; foreign investors are nervous.'],
  [['"Nobody tells us what to do"', { a: 3, inf: -3, grp: { military: 2, media: -2 } }], ['Promise to comply soon', { a: -1, inf: 1 }]]);

// ---- scenarios
E('proxyask', 'Foreign', (n) => scn('coldwar') && !scnCamp(n.idx) ? 0.02 : 0, 'Pick a side', ['Both camps of the new Cold War are courting us. Washington offers a trade deal; Beijing offers a port and a railway.'],
  [['Join the West', { g: 0.15, fn: n => { G.scenario.camps.w.push(n.idx); for (const i of G.scenario.camps.w) addRel(n.idx, i, 12); for (const i of G.scenario.camps.e) addRel(n.idx, i, -15); } }],
   ['Join the East', { g: 0.15, fn: n => { G.scenario.camps.e.push(n.idx); for (const i of G.scenario.camps.e) addRel(n.idx, i, 12); for (const i of G.scenario.camps.w) addRel(n.idx, i, -15); } }],
   ['Stay non-aligned and trade with both', { inf: 2, a: 1 }]]);
E('defectpilot', 'Foreign', (n) => scn('coldwar') && scnCamp(n.idx) ? 0.008 : 0, 'A pilot defects with a jet', ['A fighter pilot from the other camp landed his newest jet at one of our airbases and asked for asylum.'],
  [['Take the jet apart and study it', { t: 2, mil: 0.02, fn: n => { const foe = scnCamp(n.idx) === 'w' ? G.scenario.camps.e : G.scenario.camps.w; for (const i of foe.slice(0, 6)) addRel(n.idx, i, -6); } }], ['Give the jet back, keep the pilot', { x: 1, abroad: 2 }]]);
E('barter', 'Economy', (n) => scn('collapse') && G.day < 1100 ? 0.02 : 0, 'Barter towns', ['In {city} people trade eggs for haircuts and firewood for medicine. Cash has lost its meaning.'],
  [['Hand out emergency food cards', { $: 0.2, a: 3, s: 2 }], ['Let the markets work it out', { g: 0.05, s: -3, grp: { workers: -3, business: 2 } }]]);
E('reconloan', 'Economy', (n, c, ctx) => scn('collapse') && ctx.friend != null && G.day < 1500 ? 0.015 : 0, 'Reconstruction loan', ['{friend} offers a huge reconstruction loan: new factories and roads, but their companies get the contracts.'],
  [['Accept it', { $: -0.6, g: 0.3, r: 8, friendSide: true, grp: { business: -2, workers: 3 } }], ['Rebuild on our own', { a: 1, grp: { military: 1 } }]], { needFriend: true });
E('lithiumrush', 'Economy', (n, c) => scn('scramble') && ['CHL', 'ARG', 'BOL', 'AUS', 'CHN', 'COD', 'ZWE', 'BRA', 'MEX', 'CAN', 'USA', 'PER', 'MLI', 'NAM'].includes(c.id) ? 0.015 : 0, 'Lithium rush', ['Battery makers are fighting over our lithium. Prices have tripled.'],
  [['Nationalise the mines', { rent: 1.5, g: -0.05, grp: { workers: 4, business: -6 } }], ['Auction licences to the highest bidder', { $: -0.4, g: 0.2, grp: { business: 4 } }]]);
E('peacedividend', 'Economy', (n) => scn('peace') && G.day < 1100 ? 0.015 : 0, 'The peace dividend', ['With wars ending everywhere, generals expect their budgets cut. Economists say the money could do more good elsewhere.'],
  [['Move money from arms to schools', { g: 0.1, a: 2, grp: { military: -5, students: 4 } }], ['Keep the army strong, just in case', { grp: { military: 3 } }]]);

// ---- ordinary troubles
E('superbug', 'Society', (n) => n.dev > 0.3 ? 0.005 : 0, 'Superbug in the hospitals', ['A bacterium that no antibiotic can kill is spreading through hospitals in {city}.'],
  [['Close wards and fund new drugs', { $: 0.08, t: 0.5, a: 1 }], ['Keep it quiet to avoid panic', { risk: 0.4 }]]);
E('cablecut', 'Economy', (n, c) => !c.landlocked ? 0.004 : 0, 'Undersea cable cut', ['The undersea internet cable to {country} was cut overnight. Banks and shops are offline. Nobody knows who did it.'],
  [['Blame {rival} publicly', { r: -12, grp: { military: 3 } }], ['Repair it quietly and add a second cable', { $: 0.03, infra: 0.01 }]], { needRival: true });
E('waterdam', 'Foreign', (n, c, ctx) => c.borders.length && ctx.rival != null ? 0.003 : 0, 'A dam upstream', ['{rival} is building a giant dam on a river that feeds our farms. Our farmers fear the water will stop.'],
  [['Take it to the World Council', { inf: 1, r: -6, grp: { farmers: 2 } }], ['Negotiate a water-sharing treaty', { r: 6, pc: -3 }], ['Threaten military action', { r: -20, s: 1, grp: { military: 4, farmers: 3 } }]], { needRival: true });
E('arcticroute', 'Economy', (n, c) => NORTH.includes(c.id) ? 0.005 : 0, 'The Arctic opens', ['Melting ice has opened a summer shipping lane along our northern coast. Ship owners want ports; scientists want it protected.'],
  [['Build Arctic ports', { $: 0.1, g: 0.15, grp: { business: 3, green: -5 } }], ['Declare a protected zone', { x: 1, grp: { green: 5 } }]]);
E('spacejunk', 'Society', () => 0.003, 'Space junk lands in a village', ['A piece of an old satellite crashed into a barn near {city}. Nobody was hurt, but the cow is famous now.'],
  [['Demand compensation from whoever launched it', { $: -0.002, abroad: -1 }], ['Put it in a museum', { a: 1, x: 0.5 }]]);
E('chipsplant', 'Economy', (n) => n.dev > 0.45 ? 0.004 : 0, 'A giant chip factory', ['{company} wants to build the world\'s most advanced microchip factory here, if we pay a third of the cost.'],
  [['Pay it: the future is chips', { $: 0.3, g: 0.2, t: 1, grp: { business: 3 } }], ['Offer tax breaks instead', { g: 0.08, grp: { business: 1 } }], ['Say no', { grp: { business: -2 } }]]);
E('aiminister', 'Politics', (n) => n.dev > 0.5 ? 0.003 : 0, 'An AI minister?', ['A tech company offers an AI system that could run the tax office better than any person. Unions are horrified.'],
  [['Try it in one ministry', { g: 0.05, c: -0.01, grp: { workers: -3, youth: 2 } }], ['Ban AI from government', { grp: { workers: 3, youth: -2 } }]]);
E('formerleader', 'Politics', (n) => GOV[n.gov].free && G.day > 400 ? 0.003 : 0, 'A former leader returns', ['A popular former leader of {country} says the country needs them again and is touring the talk shows.'],
  [['Offer them a job in the government', { a: 2, pc: -4, grp: { elite: 3 } }], ['Attack their record', { a: -1, grp: { media: 2 } }], ['Ignore them', { a: -2 }]]);

// ---- rare and memorable
E('ancientcity', 'Society', () => 0.0012, 'A lost city is found', ['Archaeologists using laser scans found the ruins of a lost city near {city}: temples, roads and a royal tomb, untouched for 2,000 years.'],
  [['Open it to tourists', { g: 0.2, x: 2, a: 3, grp: { business: 3 } }], ['Protect it for science', { x: 3, t: 0.5, grp: { students: 3 } }]]);
E('treasureship', 'Economy', (n, c) => !c.landlocked ? 0.0012 : 0, 'Treasure ship found', ['Divers found a sunken galleon off our coast, full of silver coins. Its old colonial owner says the treasure is theirs.'],
  [['It is ours: put it in our museum', { x: 2, a: 3, abroad: -1 }], ['Sell some of it at auction', { $: -0.05, a: 1 }], ['Share it with them as a gesture', { x: 1, abroad: 4, inf: 2 }]]);
E('meteorite', 'Society', () => 0.0008, 'A meteorite lands', ['A meteorite the size of a car landed in an empty field near {city}. Scientists, tourists and treasure hunters are racing there.'],
  [['Fence it off for scientists', { t: 1, x: 1 }], ['Let the town sell tickets', { a: 2, g: 0.02 }]]);
E('centenarian', 'Society', () => 0.0012, 'The oldest person on Earth', ['{person}, aged 118, is now the oldest person in the world. Reporters from 40 countries are at her door asking for her secret.'],
  [['Throw her a state birthday party', { a: 2, x: 1 }], ['Respect her privacy', { a: 1 }]]);
E('cryptoheist', 'Economy', () => 0.0012, 'The heist of the century', ['Hackers emptied part of the central bank\'s foreign reserves in a single night and vanished into the dark web.'],
  [['Hunt them down whatever it costs', { $: 0.05, risk: 0.5, grp: { police: 3 } }], ['Admit it and reform the bank', { $: 0.1, y: 1, a: -2, c: -0.01 }], ['Cover it up', { $: 0.1, scandalRisk: 0.4 }]]);
