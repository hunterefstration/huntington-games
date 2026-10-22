// Events: things that happen to you, with choices. Chances come from the state of the country (strikes when workers
// are angry, scandals when ministers are dishonest, earthquakes where the earth really shakes...).
// Effects: a approval, s stability, g growth, i inflation, $ one-off cost (% of GDP, negative = income), pc political capital,
// r relations with the event's other country, x prestige, f freedom, grp group reactions, mil army equipment, t research.
const EVENTS = [];
const EV_CATS = {};
function E(id, cat, w, title, text, choices, opt = {}) { EVENTS.push(Object.assign({ id, cat, w, title, text, choices }, opt)); EV_CATS[cat] = (EV_CATS[cat] || 0) + 1; }
const isIn = (c, ...ids) => ids.includes(c.id);
const reg = (c, r) => c.region === r || c.sub === r;
const QUAKE = ['JPN', 'CHL', 'TUR', 'IDN', 'IRN', 'NPL', 'MEX', 'PER', 'ECU', 'ITA', 'GRC', 'NZL', 'PHL', 'PAK', 'AFG', 'CHN', 'USA', 'TWN', 'GTM', 'SLV', 'HTI', 'COL', 'ALB', 'MAR', 'DZA', 'IND', 'MMR', 'VUT', 'PNG', 'TJK', 'KGZ', 'GEO', 'ARM', 'SYR'];
const STORM = ['USA', 'MEX', 'CUB', 'HTI', 'DOM', 'JAM', 'BHS', 'PHL', 'JPN', 'CHN', 'TWN', 'VNM', 'BGD', 'IND', 'MMR', 'AUS', 'FJI', 'VUT', 'TON', 'WSM', 'MOZ', 'MDG', 'KOR', 'HND', 'NIC', 'BLZ', 'ATG', 'DMA', 'LCA', 'GRD', 'VCT', 'KNA', 'BRB', 'SLB', 'OMN'];
const FLOOD = ['BGD', 'PAK', 'IND', 'CHN', 'NGA', 'DEU', 'BRA', 'IDN', 'VNM', 'THA', 'SSD', 'SOM', 'KEN', 'NPL', 'LKA', 'ITA', 'ESP', 'GBR', 'FRA', 'POL', 'ROU', 'NLD', 'BEL', 'LBY', 'COD', 'NER', 'TCD', 'MMR', 'PHL', 'ARG', 'COL', 'PER', 'AUS', 'JPN', 'KOR', 'USA'];
const FIRE = ['AUS', 'USA', 'CAN', 'GRC', 'PRT', 'ESP', 'CHL', 'TUR', 'ITA', 'FRA', 'RUS', 'BRA', 'BOL', 'IDN', 'ISR', 'DZA', 'CYP'];
const VOLCANO = ['IDN', 'ISL', 'PHL', 'ITA', 'JPN', 'GTM', 'CHL', 'ECU', 'MEX', 'NZL', 'TON', 'PNG', 'VUT', 'CRI', 'NIC', 'COD', 'USA'];
const SAHEL_DROUGHT = c => c.region === 'Africa' || isIn(c, 'AUS', 'IND', 'BRA', 'AFG', 'IRN', 'SYR', 'IRQ', 'MEX', 'ARG', 'ESP', 'MAR');
const COAST = c => !c.landlocked;

// ---- disasters
E('quake', 'Disaster', (n, c) => QUAKE.includes(c.id) ? 0.012 : 0, 'Earthquake in {city}', 'A strong earthquake shook {city}. Buildings are down and people are trapped.',
  [['Send the army and spare no cost', { $: 0.4, a: 4, s: 2, grp: { military: 2, workers: 2 } }], ['Ask the world for help', { $: 0.1, a: 1, r: 0, x: -1, worldAid: 1 }], ['Let the regions handle it', { a: -6, s: -4 }]], { disaster: '🌋', fx: 3 });
E('storm', 'Disaster', (n, c) => STORM.includes(c.id) ? 0.014 : 0, 'Hurricane hits {city}', 'Winds of 200 km/h tore through {city}. Power is out for millions.',
  [['Emergency rebuilding fund', { $: 0.5, a: 4, s: 1, g: 0.1 }], ['Insurance and charities will cover it', { a: -4, $: 0.05 }], ['Rebuild stronger, with new flood defences', { $: 0.8, a: 3, infra: 0.05 }]], { disaster: '🌀', fx: 2 });
E('flood', 'Disaster', (n, c) => FLOOD.includes(c.id) ? 0.014 : 0, 'Floods around {city}', 'Rivers burst their banks. Farms and homes are under water.',
  [['Pay farmers and families', { $: 0.3, a: 3, grp: { farmers: 5 } }], ['Build new dams and walls', { $: 0.6, a: 1, infra: 0.05 }], ['Say it was an act of nature', { a: -5, grp: { farmers: -6 } }]], { disaster: '🌊', fx: 2 });
E('fire', 'Disaster', (n, c) => FIRE.includes(c.id) ? 0.012 : 0, 'Wildfires near {city}', 'Huge fires are burning. Smoke covers the sky for hundreds of kilometres.',
  [['Hire more firefighters and planes', { $: 0.2, a: 3, grp: { green: 3 } }], ['Blame climate change and pass green laws', { a: 1, grp: { green: 6, business: -3 } }], ['Arrest the arsonists', { a: 2, grp: { police: 3 } }]], { disaster: '🔥', fx: 2 });
E('volcano', 'Disaster', (n, c) => VOLCANO.includes(c.id) ? 0.005 : 0, 'Volcano erupts near {city}', 'Ash clouds have grounded flights. Villages near the mountain are being evacuated.',
  [['Evacuate everyone now', { $: 0.15, a: 3, g: -0.1 }], ['Evacuate only the closest villages', { a: -1, s: -1 }]], { disaster: '🌋', fx: 2 });
E('drought', 'Disaster', (n, c) => SAHEL_DROUGHT(c) ? 0.01 : 0.002, 'Drought', 'No rain for months. Crops are failing and food prices are climbing.',
  [['Import food and cap prices', { $: 0.3, i: -0.5, a: 3, grp: { farmers: 2 } }], ['Pay farmers to switch crops', { $: 0.2, g: -0.1, grp: { farmers: 4 } }], ['Do nothing: the rain will come', { i: 1.5, s: -4, grp: { farmers: -6 } }]], { disaster: '☀', fx: 1 });
E('heat', 'Disaster', (n, c) => c.region !== 'Antarctic' ? 0.006 : 0, 'Record heatwave', 'Temperatures hit record highs. Hospitals are full and the power grid strains.',
  [['Open cooling centres everywhere', { $: 0.05, a: 2 }], ['Order factories to pause in the hottest hours', { g: -0.1, a: 1, grp: { workers: 2, business: -3 } }]], { disaster: '🌡', fx: 1 });
E('cold', 'Disaster', (n, c) => ['Europe', 'Northern America', 'Central Asia', 'Eastern Asia'].includes(c.sub) || c.region === 'Europe' ? 0.005 : 0, 'Deep freeze', 'A brutal cold snap. Gas use has doubled and pipes are bursting.',
  [['Subsidise heating bills', { $: 0.2, a: 3, grp: { retirees: 5 } }], ['Ask people to turn down the heat', { a: -2 }]], { disaster: '❄', fx: 1 });
E('locusts', 'Disaster', (n, c) => isIn(c, 'ETH', 'KEN', 'SOM', 'SDN', 'ERI', 'YEM', 'PAK', 'IND', 'EGY', 'SAU', 'UGA', 'TZA', 'NER', 'MLI', 'TCD', 'MRT') ? 0.008 : 0, 'Locust swarms', 'Billions of locusts are eating the harvest.',
  [['Spray from the air', { $: 0.05, a: 2, grp: { farmers: 4, green: -3 } }], ['Ask the UN for help', { a: 1, worldAid: 1 }]], { disaster: '🦗', fx: 1 });
E('tsunami', 'Disaster', (n, c) => isIn(c, 'JPN', 'IDN', 'CHL', 'PHL', 'LKA', 'THA', 'IND', 'PNG', 'TON', 'WSM', 'NZL', 'PER', 'MEX') ? 0.002 : 0, 'Tsunami warning', 'An undersea quake sent a wave toward the coast near {city}.',
  [['Order a full coastal evacuation', { $: 0.2, a: 4, g: -0.1 }], ['Trust the sea walls', { a: -3, s: -3 }]], { disaster: '🌊', fx: 3 });
E('pandemic', 'Disaster', () => 0.0025, 'A new virus is spreading', 'Doctors report a fast-spreading new illness. The world is watching.',
  [['Lockdown: close schools and shops', { g: -1.5, a: 2, s: 2, grp: { business: -6, youth: -4, retirees: 5 } }], ['Masks and testing, keep the economy open', { g: -0.4, a: -1, grp: { retirees: -2, business: 3 } }], ['Fund a vaccine crash programme', { $: 0.6, t: 3, a: 4, x: 2 }]], { disaster: '🦠', fx: 0, worldwide: true });
E('epidemic', 'Disaster', (n) => n.dev < 0.4 ? 0.006 : 0.001, 'Outbreak of disease', 'A deadly outbreak is spreading in poor areas around {city}.',
  [['Send doctors and clean water', { $: 0.1, a: 3, s: 1 }], ['Quarantine the area', { a: -1, s: 1, f: -1 }]], { disaster: '🦠', fx: 1 });
E('blackout', 'Disaster', (n) => 0.003 + Math.max(0, (n.base.k.infra - n.k.infra)) * 0.01, 'Nationwide blackout', 'The power grid failed. Millions are in the dark.',
  [['Promise a huge grid upgrade', { $: 0.4, a: 1, infra: 0.05 }], ['Blame the power company and fine it', { a: 2, grp: { business: -4 } }]], { disaster: '⚡', fx: 0 });
E('mine', 'Disaster', (n, c) => n.res.includes('metal') || n.res.includes('coal') ? 0.004 : 0, 'Mine collapse', 'Miners are trapped deep underground near {city}. Rescue teams are racing against time.',
  [['Lead the rescue in person', { a: 4, pc: -3, grp: { workers: 5 } }], ['Tighten mine safety rules', { g: -0.05, grp: { workers: 4, business: -3 } }]], { disaster: '⛏', fx: 0 });
E('oilspill', 'Disaster', (n) => n.res.includes('oil') ? 0.004 : 0, 'Oil spill off the coast', 'A tanker leaked oil near {city}. Beaches are black.',
  [['Make the oil company pay for everything', { $: -0.05, a: 3, grp: { green: 5, business: -3 } }], ['Clean it up with public money', { $: 0.1, a: 1 }]], { disaster: '🛢', fx: 0 });
E('bridge', 'Disaster', (n) => 0.002 + Math.max(0, (n.base.k.infra - n.k.infra)) * 0.015, 'Bridge collapses', 'An old bridge in {city} fell into the river during rush hour.',
  [['Inspect every bridge in the country', { $: 0.15, a: 2, infra: 0.02 }], ['Fire the transport chief', { a: 1, pc: -2 }]], { disaster: '🌉', fx: 0 });

// ---- economy
E('crash', 'Economy', (n) => 0.003 + (n.growth > 4 ? 0.004 : 0), 'Stock market crash', 'Shares fell 20% in a single day. Investors are panicking.',
  [['Bail out the banks', { $: 1.5, g: 0.3, a: -3, grp: { business: 5, workers: -5 } }], ['Let the market fix itself', { g: -0.8, a: -2, grp: { business: -4 } }], ['Ask the central bank to cut rates', { i: 0.5, g: 0.2 }]]);
E('bank', 'Economy', (n) => 0.002 + (debtPct(n) > 100 ? 0.003 : 0), 'A big bank is failing', 'One of the largest banks cannot pay its customers. Queues form outside branches.',
  [['Rescue it with public money', { $: 1, a: -2, s: 2, grp: { elite: 3, workers: -4 } }], ['Protect savers only, let the bank die', { $: 0.3, g: -0.4, a: 2, grp: { workers: 3, business: -3 } }], ['Nationalise it', { $: 0.6, a: 1, grp: { business: -6, workers: 4 } }]]);
E('housing', 'Economy', (n) => n.dev > 0.5 ? 0.004 : 0.001, 'House prices out of control', 'Young people say they will never afford a home.',
  [['Build public housing', { $: 0.4, a: 3, grp: { youth: 6 } }], ['Tax empty homes and foreign buyers', { $: -0.05, a: 2, grp: { elite: -4, youth: 3 } }], ['Do nothing: prices show a strong economy', { a: -2, grp: { youth: -5, elite: 2 } }]]);
E('factory', 'Economy', (n) => 0.006, '{company} closes its biggest factory', 'Thousands of jobs in {city} will go.',
  [['Offer subsidies to keep it open', { $: 0.08, a: 2, grp: { workers: 4 } }], ['Retrain the workers', { $: 0.05, a: 1, grp: { workers: 2 } }], ['Accept it: the market decides', { a: -2, grp: { workers: -5, business: 2 } }]]);
E('invest', 'Economy', (n) => 0.006 + n.dev * 0.004, '{company} wants to build a giant factory', 'A global company offers to build in {city}, if we give it tax breaks.',
  [['Yes, roll out the red carpet', { $: 0.05, g: 0.25, grp: { business: 4, workers: 3, green: -2 } }], ['Only if they hire local workers and pay well', { g: 0.12, grp: { workers: 4 } }], ['No tax breaks', { grp: { business: -2 } }]]);
E('oilfind', 'Economy', (n, c) => COAST(c) ? 0.002 : 0.001, 'Oil discovered offshore', 'Geologists found a large oil field off our coast.',
  [['Drill now', { g: 0.4, rent: 2, grp: { business: 5, green: -6 } }], ['Drill slowly and save the money in a fund', { g: 0.15, rent: 1, grp: { green: -2 } }], ['Leave it in the ground', { x: 1, grp: { green: 8, business: -4 } }]]);
E('goldfind', 'Economy', () => 0.002, 'Gold rush', 'Huge gold deposits were found near {city}.',
  [['Open it to big mining companies', { g: 0.2, $: -0.1, grp: { business: 4, green: -3 } }], ['State mining company', { g: 0.1, $: -0.2, grp: { workers: 2, business: -3 } }]]);
E('strike', 'Economy', (n) => n.groups && n.groups.workers < 40 ? 0.025 : 0.004, 'General strike', 'Unions have shut down the country. Trains, ports and schools are closed.',
  [['Give them the pay rise', { $: 0.3, i: 0.3, a: 2, grp: { workers: 8, business: -4 } }], ['Negotiate a middle ground', { $: 0.1, grp: { workers: 3 } }], ['Send police to reopen the ports', { s: -3, a: -3, grp: { workers: -8, police: 3, business: 4 } }]]);
E('portstrike', 'Economy', (n, c) => COAST(c) ? 0.004 : 0, 'Dock workers walk out', 'Ships are stuck at sea. Shops are running low.',
  [['Settle quickly', { $: 0.05, grp: { workers: 3 } }], ['Bring in the army to unload ships', { a: -1, grp: { workers: -5, military: 1 } }]]);
E('tourism', 'Economy', (n) => n.res.includes('tour') ? 0.008 : 0.002, 'Tourism boom', 'Our country is the hot destination this year.',
  [['Advertise even more', { $: 0.03, g: 0.15, x: 1 }], ['Add a tourist tax', { $: -0.05, a: 1, grp: { business: -2 } }]]);
E('fuel', 'Economy', (n) => G.world.oil > 130 ? 0.03 : 0.003, 'Fuel shortage', 'Long queues at petrol stations. Truckers threaten to block roads.',
  [['Cut fuel taxes', { $: 0.2, i: -0.4, a: 3 }], ['Ration fuel', { a: -3, s: -1 }], ['Release strategic reserves', { $: 0.05, i: -0.2, a: 1 }]]);
E('harvest', 'Economy', (n) => n.res.includes('food') ? 0.01 : 0.003, 'Record harvest', 'Farmers had their best year in decades.',
  [['Export the surplus', { g: 0.1, $: -0.03, grp: { farmers: 4 } }], ['Store it for bad years', { $: 0.02, s: 1, grp: { farmers: 2 } }]]);
E('cropfail', 'Economy', (n) => n.res.includes('food') ? 0.006 : 0.003, 'Crop disease', 'A plant disease is destroying the main crop.',
  [['Fund research and compensation', { $: 0.1, t: 1, grp: { farmers: 5 } }], ['Import food', { i: 0.4, grp: { farmers: -3 } }]]);
E('startup', 'Economy', (n) => 0.002 + n.dev * 0.006, 'Start-up {company} is worth billions', 'A young company from {city} became a global hit.',
  [['Invite the founders to the palace', { a: 2, x: 1, grp: { youth: 3 } }], ['Tax its windfall', { $: -0.03, grp: { business: -3 } }]]);
E('billionaire', 'Economy', (n) => n.tax.wealth > 1 || n.tax.income > 45 ? 0.02 : 0.002, 'Billionaire moves abroad', 'The country\'s richest person is leaving, blaming our taxes.',
  [['Let them go', { $: 0.03, grp: { elite: -3, workers: 2 } }], ['Offer them a tax deal to stay', { a: -2, grp: { elite: 4, workers: -3 } }]]);
E('crypto', 'Economy', (n) => n.laws && n.laws.crypto > 0 ? 0.006 : 0, 'Crypto crash', 'A popular cryptocurrency lost 80% of its value. Savers are furious.',
  [['Compensate small savers', { $: 0.05, a: 2 }], ['Ban crypto ads', { grp: { youth: -3, retirees: 2 } }], ['Tell people it was their risk', { a: -2 }]]);
E('automation', 'Economy', (n) => n.dev > 0.6 ? 0.006 : 0.001, 'Robots replace workers', 'A wave of AI and robots is cutting office and factory jobs.',
  [['Tax robots to fund retraining', { $: -0.1, g: -0.1, grp: { workers: 5, business: -5 } }], ['Embrace it: productivity!', { g: 0.25, grp: { business: 5, workers: -6 } }], ['Shorter work week for everyone', { g: -0.1, a: 2, grp: { workers: 6, business: -4 } }]]);
E('chipshort', 'Economy', (n) => !n.res.includes('chips') ? 0.004 : 0, 'Microchip shortage', 'Car and phone factories have stopped. There are no chips.',
  [['Build our own chip factory', { $: 0.4, t: 2, g: -0.1 }], ['Beg our allies to share supplies', { g: -0.2, a: -1 }]]);
E('fraud', 'Economy', () => 0.003, '{company} fraud exposed', 'Auditors found billions missing at a big company.',
  [['Prosecute the bosses', { a: 3, grp: { workers: 4, elite: -3 } }], ['Quietly arrange a merger', { a: -2, grp: { media: -3 } }]]);
E('remit', 'Economy', (n) => n.dev < 0.45 ? 0.004 : 0, 'Remittances surge', 'Money sent home by workers abroad hit a record.',
  [['Make sending money cheaper', { g: 0.1, a: 2 }], ['Tax it lightly', { $: -0.03, a: -2 }]]);
E('aidoffer', 'Economy', (n) => n.dev < 0.4 ? 0.006 : 0, 'A foreign power offers a giant loan', '{rival} offers to build a new port and railway, paid with a loan.',
  [['Accept the deal', { g: 0.3, $: -0.2, r: 15, debtTrap: 1 }], ['Refuse politely', { r: -5 }]], { needRival: true });

// ---- politics & people
E('scandal', 'Politics', (n) => n.cabinet ? Object.values(n.cabinet).some(m => m.honesty < 30) ? 0.02 : 0.004 : 0, 'Minister {minister} in scandal', 'Papers say {minister} took bribes from a construction company.',
  [['Fire them at once', { a: 2, pc: -2, fire: 1 }], ['Defend them', { a: -4, grp: { media: -4 } }], ['Order an independent inquiry', { a: 1, pc: -1 }]]);
E('leak', 'Politics', (n) => 0.004 + n.corruption * 0.02, 'Leaked documents', 'Secret files about government spending were leaked to the press.',
  [['Admit mistakes and promise reform', { a: 2, pc: -3, grp: { media: 4 } }], ['Call it fake news', { a: -2, grp: { media: -6 } }], ['Hunt down the leaker', { f: -2, grp: { media: -8, police: 2 } }]]);
E('rebels', 'Politics', (n) => n.parl && n.approval < 40 ? 0.01 : 0.002, 'Party rebellion', 'A group of your own lawmakers is plotting against you.',
  [['Give the rebels jobs in government', { pc: -5, a: -1 }], ['Expel them from the party', { pc: 3, a: -2, seats: -0.03 }], ['Call a leadership vote and win it', { pc: 4, a: 1, risk: 0.25 }]]);
E('opposurge', 'Politics', (n) => GOV[n.gov].free ? 0.006 : 0, 'Opposition leader {person} surges', 'A charismatic opposition leader is packing stadiums.',
  [['Attack their record', { a: 1, grp: { media: -2 } }], ['Steal their best idea', { a: 3, pc: -2 }], ['Ignore them', { a: -2 }]]);
E('celebrity', 'Politics', () => 0.006, '{celeb} backs you', 'A huge pop star posted a video supporting your government.',
  [['Invite them to a rally', { a: 3, grp: { youth: 5 } }], ['Thank them quietly', { a: 1 }]]);
E('celebrun', 'Politics', (n) => GOV[n.gov].free ? 0.002 : 0, '{celeb} runs for office', 'A famous TV star says they will run against you.',
  [['Laugh it off', { a: -1 }], ['Offer them a job in government', { a: 2, pc: -3 }]]);
E('journalist', 'Politics', (n) => n.laws && n.laws.press < 2 ? 0.01 : 0.003, 'Journalist arrested', 'Police arrested a well-known reporter who criticised the government.',
  [['Free them and apologise', { a: 2, f: 2, grp: { media: 5, police: -2 } }], ['Let the courts decide', { f: -1, grp: { media: -3 } }], ['Keep them locked up', { f: -4, s: 1, grp: { media: -8 }, abroad: -4 }]]);
E('whistle', 'Politics', () => 0.003, 'Whistleblower', 'A government worker says the army spied on citizens.',
  [['Open a public inquiry', { a: 2, f: 2, grp: { media: 4, military: -3 } }], ['Charge the whistleblower', { f: -3, grp: { media: -6, police: 2 } }]]);
E('students', 'Politics', (n) => n.groups && n.groups.students < 40 ? 0.02 : 0.004, 'Students occupy universities', 'Thousands of students are camping on campuses in protest.',
  [['Meet their leaders', { a: 2, grp: { students: 6 } }], ['Wait for the holidays', { s: -1 }], ['Clear the campuses with police', { s: 1, f: -2, grp: { students: -10, police: 3 } }]], { crowd: 'students' });
E('farmers', 'Politics', (n) => n.groups && n.groups.farmers < 40 ? 0.02 : 0.004, 'Tractor protest', 'Farmers drove tractors into the capital and blocked the roads.',
  [['Promise more farm subsidies', { $: 0.1, grp: { farmers: 8, green: -2 } }], ['Hold firm', { s: -2, grp: { farmers: -5 } }]], { crowd: 'farmers' });
E('police', 'Politics', (n) => n.laws && n.laws.policing >= 2 ? 0.012 : 0.004, 'Police caught on video', 'A video of police beating a protester went viral.',
  [['Suspend the officers and reform training', { a: 2, grp: { minorities: 5, police: -4 } }], ['Back the police', { s: 1, grp: { police: 5, minorities: -6, students: -4 } }]], { crowd: 'minorities' });
E('prison', 'Politics', () => 0.002, 'Prison break', 'Dozens of dangerous prisoners escaped overnight.',
  [['Massive manhunt', { $: 0.02, a: 2, grp: { police: 3 } }], ['Fire the justice minister', { pc: -2, a: 1 }]]);
E('plot', 'Politics', (n) => !GOV[n.gov].free && n.groups && n.groups.military < 45 ? 0.02 : 0, 'Plot uncovered', 'Intelligence says officers are planning a coup.',
  [['Arrest the plotters', { s: 2, grp: { military: -6, police: 3 } }], ['Raise military pay', { $: 0.1, grp: { military: 8 } }], ['Do nothing and watch', { coup: 0.2 }]]);
E('separatists', 'Politics', (n, c) => n.laws && n.laws.federal === 0 ? 0.008 : 0.002, 'Region demands independence', 'Leaders in {city} want a vote on breaking away.',
  [['Allow a referendum', { s: -3, f: 3, referendum: 1 }], ['Offer more self-rule', { s: 2, grp: { minorities: 4 } }], ['Refuse and send police', { s: -4, f: -2, grp: { minorities: -8 } }]]);
E('mayor', 'Politics', () => 0.004, 'Feud with the mayor of {city}', 'The mayor of {city} keeps attacking you on TV.',
  [['Cut their city\'s budget', { a: -1, pc: 2 }], ['Make peace over lunch', { pc: -1, a: 1 }]]);
E('fraudclaim', 'Politics', (n) => n.nextElection && n.nextElection - G.day < 60 && n.nextElection > G.day ? 0.05 : 0, 'Claims of election fraud', 'Rumours say the vote will be rigged.',
  [['Invite international observers', { a: 2, f: 1, abroad: 2 }], ['Dismiss the claims', { a: -1 }]]);
E('royal', 'Politics', (n) => ['CMON', 'AMON'].includes(n.gov) ? 0.004 : 0, 'Royal wedding', 'The royal family announced a wedding. The whole country is excited.',
  [['Make it a national holiday', { $: 0.02, a: 3, g: -0.02 }], ['Keep it simple', { a: 1 }]]);
E('religion', 'Politics', (n) => 0.004, 'Religious leader speaks out', 'An important religious leader criticised your laws.',
  [['Meet them and listen', { a: 1, grp: { religious: 4, students: -1 } }], ['Say the state is separate from faith', { grp: { religious: -5, students: 3 } }]]);
E('general', 'Politics', (n) => 0.004, 'General {person} speaks out', 'A top general says the army does not have enough money.',
  [['Raise the defence budget', { $: 0.1, grp: { military: 6 } }], ['Fire the general', { pc: -2, grp: { military: -5 } }], ['Ignore it', { grp: { military: -2 } }]]);
E('union', 'Politics', () => 0.004, 'Union boss {person} threatens action', 'The head of the biggest union warns of strikes unless wages rise.',
  [['Invite them for talks', { grp: { workers: 3 }, pc: -1 }], ['Call their bluff', { grp: { workers: -3 } }]]);
E('ceo', 'Politics', () => 0.004, 'CEO {person} praises your policies', 'The boss of a giant company says our country is the best place to invest.',
  [['Thank them publicly', { a: 1, grp: { business: 3, workers: -1 } }], ['Stay neutral', {}]]);
E('lobby', 'Politics', (n) => 0.004 + n.corruption * 0.01, 'Lobbyists offer a "gift"', 'An industry group offers your party a huge donation if you weaken a law.',
  [['Refuse and expose them', { a: 3, grp: { media: 3, business: -3 } }], ['Take the money', { pc: 8, scandalRisk: 0.35 }]]);
E('nobudget', 'Politics', (n) => n.parl && GOV[n.gov].free && n.parl.parties.filter(p => p.gov).reduce((a, p) => a + p.seats, 0) < n.parl.total / 2 ? 0.03 : 0, 'Parliament blocks spending', 'Without a majority, parliament refuses to pass parts of the budget.',
  [['Make a deal with the opposition', { pc: -6, a: 1 }], ['Govern by decree', { f: -3, grp: { media: -4 } }]]);

// ---- society & culture
E('worldcup', 'Society', () => 0.004, 'National team wins the cup!', 'Our football team won a major tournament. Streets are full of fans.',
  [['Declare a public holiday', { a: 5, s: 2, g: -0.02, x: 2 }], ['Invite the team to the palace', { a: 3, x: 1 }]], { party: 1 });
E('teamlose', 'Society', () => 0.004, 'Humiliating defeat', 'Our national team was knocked out by a tiny country. Fans are furious.',
  [['Fire the coach on TV', { a: 1 }], ['Promise more money for sport', { $: 0.02, a: 1 }]]);
E('olympic', 'Society', (n) => 0.002 + n.dev * 0.004, 'Olympic gold', 'An athlete from {city} won Olympic gold!',
  [['Name a stadium after them', { a: 2, x: 1 }], ['Fund youth sports', { $: 0.02, a: 2, grp: { youth: 3 } }]], { party: 1 });
E('film', 'Society', () => 0.003, 'Our film wins top award', 'A film from {city} won the world\'s biggest film prize.',
  [['Fund the film industry', { $: 0.02, x: 2, grp: { youth: 2 } }], ['Congratulate them', { a: 1, x: 1 }]]);
E('music', 'Society', () => 0.003, 'Global hit song', 'A singer from our country has the number one song on Earth.',
  [['Make them a cultural ambassador', { x: 2, a: 1 }], ['Nothing to do with us', {}]]);
E('nobel', 'Society', (n) => 0.001 + n.dev * 0.003, 'Nobel Prize!', 'A scientist from our country won the Nobel Prize.',
  [['Double research funding for a year', { $: 0.1, t: 3, x: 2 }], ['Throw a party', { a: 2, x: 1 }]]);
E('meme', 'Society', () => 0.004, 'You became a meme', 'A funny video of you tripping on stairs has a billion views.',
  [['Laugh along and post a joke', { a: 2, grp: { youth: 4 } }], ['Demand it be taken down', { a: -2, f: -1, grp: { youth: -4 } }]]);
E('festival', 'Society', () => 0.004, 'Huge festival in {city}', 'A million people came to celebrate. Hotels are full.',
  [['Make it yearly and fund it', { $: 0.01, g: 0.03, a: 1 }], ['Enjoy it', { a: 1 }]], { party: 1 });
E('refugees', 'Society', (n, c) => G.wars.some(w => w.a.concat(w.d).some(i => World.countries[i].borders.includes(c.id))) ? 0.03 : 0.003, 'Refugees at the border', 'Thousands of people fleeing war are arriving at our border.',
  [['Welcome them', { $: 0.1, a: -1, f: 1, abroad: 4, grp: { minorities: 4, workers: -3 } }], ['Take some, with checks', { $: 0.05 }], ['Close the border', { a: 1, abroad: -4, grp: { minorities: -5, police: 2 } }]]);
E('defector', 'Society', () => 0.002, 'Famous athlete defects', 'A star from {rival} asked to live here.',
  [['Welcome them', { r: -12, a: 2, x: 1 }], ['Send them back', { r: 6, a: -2 }]], { needRival: true });
E('crime', 'Society', (n) => n.stability < 40 ? 0.02 : 0.003, 'Crime wave', 'Robberies and gang violence are rising in {city}.',
  [['More police on the streets', { $: 0.05, s: 2, grp: { police: 4, retirees: 3 } }], ['Youth clubs and jobs programmes', { $: 0.05, s: 1, grp: { youth: 4 } }], ['Emergency curfew', { s: 3, f: -2, grp: { youth: -5 } }]]);
E('birth', 'Society', (n) => n.dev > 0.6 ? 0.004 : 0, 'Births at a record low', 'Fewer babies are being born than ever. Experts warn of an ageing country.',
  [['Big bonuses for parents', { $: 0.2, pop: 0.1, grp: { women: 3, religious: 2 } }], ['More immigration', { pop: 0.15, grp: { minorities: 3, workers: -2 } }]]);
E('obesity', 'Society', (n) => n.dev > 0.5 ? 0.003 : 0, 'Health crisis: obesity', 'Doctors say a third of children are seriously overweight.',
  [['Sugar tax', { $: -0.03, grp: { business: -2, workers: -1 } }], ['Free school sports', { $: 0.02, grp: { youth: 2 } }]]);
E('alien', 'Society', () => 0.0004, 'Strange signal from space', 'Our radio telescope picked up a mysterious repeating signal.',
  [['Announce it to the world', { x: 3, a: 2, t: 1 }], ['Keep it secret until we know more', { f: -1 }]]);
E('panda', 'Society', () => 0.001, 'Zoo celebrity', 'A baby animal born at the capital\'s zoo is a national sensation.',
  [['Name it after yourself', { a: -1, grp: { youth: 2 } }], ['Let children name it', { a: 2 }]]);

// ---- foreign
E('borderclash', 'Foreign', (n, c, ctx) => ctx.rival && World.countries[ctx.rival].borders.includes(c.id) ? 0.02 : 0, 'Border clash with {rival}', 'Soldiers exchanged fire on the border with {rival}.',
  [['Demand an apology', { r: -10, grp: { military: 3 } }], ['Calm things down with a call', { r: 4, grp: { military: -2 } }], ['Strike back hard', { r: -25, s: 1, grp: { military: 6 } }]], { needRival: true });
E('hijack', 'Foreign', (n, c) => COAST(c) ? 0.003 : 0, 'Ship hijacked', 'Pirates seized one of our cargo ships.',
  [['Send special forces', { a: 3, x: 1, risk: 0.2 }], ['Pay the ransom', { $: 0.01, a: -2 }]]);
E('insult', 'Foreign', (n, c, ctx) => ctx.rival ? 0.008 : 0, '{rival} leader insults you', 'The leader of {rival} mocked you in a speech.',
  [['Insult them back', { r: -8, a: 2, grp: { military: 2 } }], ['Rise above it', { a: 1, r: 2 }]], { needRival: true });
E('summitinv', 'Foreign', (n, c, ctx) => ctx.friend ? 0.006 : 0, 'Invitation to a summit', '{friend} invites you to a world summit on its soil.',
  [['Go, and talk trade', { r: 8, pc: -1, x: 1, friendSide: 1 }], ['Send a minister instead', { r: -2 }]], { needFriend: true });
E('embassy', 'Foreign', (n, c, ctx) => ctx.rival ? 0.004 : 0, 'Embassy attacked', 'A mob stormed our embassy in {rival}.',
  [['Recall our ambassador', { r: -15, grp: { military: 2 } }], ['Demand protection and wait', { r: -4 }]], { needRival: true });
E('cyber', 'Foreign', () => 0.004, 'Cyber attack on hospitals', 'Hackers locked hospital computers and want money.',
  [['Pay quietly', { $: 0.005, a: -1 }], ['Refuse and rebuild', { $: 0.03, g: -0.05, a: 1 }], ['Blame {rival} and retaliate', { r: -10, grp: { military: 2 } }]], { needRival: true });
E('spycaught', 'Foreign', (n, c, ctx) => ctx.rival ? 0.004 : 0, 'Spy from {rival} caught', 'Police arrested a spy working for {rival}.',
  [['Expel their diplomats', { r: -12, grp: { police: 3 } }], ['Trade them for our own prisoners', { r: 3 }]], { needRival: true });
E('aidplea', 'Foreign', (n, c, ctx) => ctx.poor ? 0.006 : 0, '{poor} begs for help', 'A famine is hitting {poor}.',
  [['Send food and doctors', { $: 0.02, x: 1, poorRel: 12, abroad: 1 }], ['We have our own problems', { poorRel: -4 }]], { needPoor: true });
E('investoffer', 'Foreign', (n, c, ctx) => ctx.friend ? 0.004 : 0, '{friend} wants to invest', 'Investors from {friend} offer to build a new industrial park.',
  [['Accept', { g: 0.15, r: 5, friendSide: 1, grp: { business: 3 } }], ['Only with local ownership', { g: 0.08 }]], { needFriend: true });
E('climate', 'Foreign', () => 0.004, 'World climate deal', 'Most countries are signing a new climate treaty.',
  [['Sign it', { g: -0.1, abroad: 3, x: 1, grp: { green: 6, business: -3 } }], ['Refuse: our economy first', { abroad: -3, grp: { green: -6, business: 3 } }]]);
E('wardrums', 'Foreign', (n, c, ctx) => ctx.rival && relation(ctx.rival, n.idx) < -60 ? 0.01 : 0, '{rival} masses troops', 'Satellite photos show {rival} moving tanks toward us.',
  [['Mobilise our army', { mobilize: 1, r: -5 }], ['Ask allies for support', { r: -2, pc: -2 }], ['Offer talks', { r: 6, grp: { military: -2 } }]], { needRival: true });

// ---- technology
E('aibreak', 'Technology', (n) => 0.002 + n.dev * 0.004, 'AI breakthrough', 'Our scientists built an AI that designs new medicines.',
  [['Make it free for the world', { x: 3, abroad: 3, t: 1 }], ['Sell it to companies', { $: -0.1, g: 0.1 }], ['Keep it for our army', { mil: 0.05, t: 2 }]]);
E('vaccine', 'Technology', (n) => 0.001 + n.dev * 0.003, 'New vaccine discovered', 'A lab in {city} made a vaccine for a common disease.',
  [['Give it to poor countries cheaply', { x: 3, abroad: 3 }], ['Patent it', { $: -0.05, g: 0.05 }]]);
E('satellite', 'Technology', (n) => n.spend.space > 0.05 ? 0.008 : 0.001, 'Satellite launch', 'Our first big satellite reached orbit.',
  [['Celebrate', { a: 2, x: 2 }], ['Use it for defence', { mil: 0.02 }]]);
E('fusion', 'Technology', (n) => (n.techLv || 0) > 30 ? 0.003 : 0, 'Fusion power works!', 'A test reactor made more energy than it used.',
  [['Build a fusion plant', { $: 0.5, g: 0.3, x: 4 }], ['Share it with the world', { x: 6, abroad: 6 }]]);
E('hack', 'Technology', () => 0.003, 'Data leak', 'Millions of citizens\' records were stolen from a government website.',
  [['New data protection rules', { $: 0.02, grp: { youth: 2, business: -2 } }], ['Fire the agency chief', { pc: -1, a: 1 }]]);
E('drone', 'Technology', (n) => n.spend.defence > 2 ? 0.004 : 0.001, 'New drone tested', 'Our engineers built a cheap, deadly drone. Other countries want to buy it.',
  [['Sell it abroad', { $: -0.05, r: -3, grp: { business: 3 } }], ['Keep it secret', { mil: 0.03 }]]);

// ---- the engine
function eventContext(n) {
  const c = World.countries[n.idx], cities = World.cities.filter(x => x.c === n.idx).sort((a, b) => b.pop - a.pop);
  const r = G.rng, others = G.nations.filter(m => m && m.idx !== n.idx);
  const byRel = others.map(m => [m.idx, relation(m.idx, n.idx)]).sort((a, b) => a[1] - b[1]);
  const poor = others.filter(m => m.dev < 0.3);
  const mins = n.cabinet ? Object.entries(n.cabinet) : [];
  const dishonest = mins.slice().sort((a, b) => a[1].honesty - b[1].honesty)[0];
  const cityI = World.cities.indexOf(cities[Math.floor(Math.pow(r(), 2) * Math.min(cities.length, 10))] || cities[0]);
  return {
    city: cityI, rival: byRel[0] && byRel[0][1] < -15 ? byRel[0][0] : null, friend: byRel[byRel.length - 1] && byRel[byRel.length - 1][1] > 20 ? byRel[byRel.length - 1][0] : null,
    poor: poor.length ? poor[Math.floor(r() * poor.length)].idx : null, minister: dishonest ? dishonest[1].name : 'a minister', ministerPost: dishonest ? dishonest[0] : null,
    person: personName(c, r), celeb: personName(c, r), company: ['Apex', 'Nova', 'Titan', 'Orion', 'Zenith', 'Pioneer', 'Summit', 'Atlas'][Math.floor(r() * 8)] + ' ' + ['Motors', 'Steel', 'Tech', 'Foods', 'Energy', 'Bank', 'Pharma', 'Mining'][Math.floor(r() * 8)]
  };
}
function fillText(s, ctx) {
  return s.replace(/\{(\w+)\}/g, (m, k) => k === 'city' ? World.cities[ctx.city].name : ['rival', 'friend', 'poor'].includes(k) ? (ctx[k] != null ? World.countries[ctx[k]].name : 'a neighbour') : ctx[k] || m);
}
function fxSummary(fx, n) {
  const t = [], gl = gdpUsd(n);
  if (fx.a) t.push(['Approval', fx.a]); if (fx.s) t.push(['Stability', fx.s]); if (fx.g) t.push(['Growth', fx.g, '%']); if (fx.i) t.push(['Inflation', -fx.i, '%', true]);
  if (fx.$) t.push(['Cost', -fx.$, '', false, '$' + fmtBig(Math.abs(fx.$) / 100 * gl)]); if (fx.pc) t.push(['Capital', fx.pc]); if (fx.r) t.push(['Relations', fx.r]); if (fx.x) t.push(['Prestige', fx.x]);
  if (fx.f) t.push(['Freedom', fx.f]); if (fx.abroad) t.push(['World opinion', fx.abroad]);
  return t.map(([k, v, u, inv, txt]) => `<span class="${v > 0 ? 'up' : 'down'}">${k} ${txt ? (v > 0 ? '+' : '-') + txt : (inv ? (v > 0 ? '-' : '+') + Math.abs(v) : (v > 0 ? '+' : '') + v) + (u || '')}</span>`).join(' · ')
    + (fx.grp ? ' · ' + Object.entries(fx.grp).map(([g, v]) => `<span class="${v > 0 ? 'up' : 'down'}">${GROUPS[G_IDX[g]].icon}${v > 0 ? '+' : ''}${v}</span>`).join(' ') : '');
}
function applyEventFx(n, fx, ev, ctx, label) {
  const gl = gdpL(n);
  n.evAppr += fx.a || 0; n.evStab += fx.s || 0; n.evGrowth = (n.evGrowth || 0) + (fx.g || 0) * 2; n.evInfl = (n.evInfl || 0) + (fx.i || 0) * 2;
  if (fx.$) n.debt += fx.$ / 100 * gl;
  if (fx.pc) n.pc = clamp(n.pc + fx.pc, 0, 100);
  if (fx.r && ctx.rival != null && !fx.friendSide) addRel(n.idx, ctx.rival, fx.r);
  if (fx.r && fx.friendSide && ctx.friend != null) addRel(n.idx, ctx.friend, fx.r);
  if (fx.poorRel && ctx.poor != null) addRel(n.idx, ctx.poor, fx.poorRel);
  if (fx.x) n.prestige = (n.prestige || 0) + fx.x;
  if (fx.f) { n.freeHit = (n.freeHit || 0) + fx.f; applyLaws(n); }
  if (fx.t) n.techLv = (n.techLv || 0) + fx.t;
  if (fx.mil) n.army.E *= 1 + fx.mil;
  if (fx.rent) n.rent += fx.rent;
  if (fx.y) n.ratingOff += fx.y < 0 ? 0.7 : -0.7;
  if (fx.infra) n.base.k.infra -= fx.infra * 10;
  if (fx.pop) n.popGrowth0 += fx.pop, n.popGrowth += fx.pop;
  if (fx.fire && ctx.ministerPost) { n.cabinet[ctx.ministerPost] = makeMinister(World.countries[n.idx], G.rng, ctx.ministerPost); applyLaws(n); }
  if (fx.seats) { const me = n.parl.parties.find(p => p.id === 'me'), lose = Math.round(me.seats * -fx.seats); me.seats -= lose; const opp = n.parl.parties.find(p => !p.gov) || n.parl.parties[1]; if (opp) opp.seats += lose; }
  if (fx.risk && G.rng() < fx.risk) { n.evAppr -= 6; inbox('bad', 'It went wrong', 'The gamble failed and the press is merciless.'); }
  if (fx.scandalRisk && G.rng() < fx.scandalRisk) { n.evAppr -= 8; react(n, { title: 'Party took secret donations', stance: { media: -8, workers: -4 }, size: 1.5, mood: -0.5 }); }
  if (fx.coup && G.rng() < fx.coup) setTimeout(() => crisis(n, 'coup'), 300);
  if (fx.mobilize) War.mobilize(true);
  if (fx.worldAid) { for (const m of G.nations) if (m && m.idx !== n.idx && relation(m.idx, n.idx) > 20) addRel(n.idx, m.idx, 2); n.debt -= 0.001 * gl; }
  if (fx.debtTrap) n.debtTrap = ctx.rival;
  if (fx.referendum) { if (G.rng() < 0.35) { const lost = 0.06; n.real *= 1 - lost; n.pop *= 1 - lost; react(n, { title: 'Region votes to leave', stance: { military: -5 }, size: 2, mood: -0.8 }); } else react(n, { title: 'Region votes to stay', stance: {}, size: 1, mood: 0.4 }); }
  react(n, { title: fillText(ev.title, ctx) + ': ' + label, stance: fx.grp || {}, size: 0.9, abroad: fx.abroad || 0, mood: ((fx.a || 0) > 0 ? 0.15 : (fx.a || 0) < 0 ? -0.15 : 0), city: ctx.city, topic: ev.id });
  if (ev.crowd) addCrowd(n, ctx.city, 'protest', GROUPS[G_IDX[ev.crowd]], 5, ev.title);
  if (ev.party) addCrowd(n, ctx.city, 'rally', GROUPS[G_IDX.youth], 9, ev.title);
  Bus.emit('changed');
}
function eventsMonth() {
  const n = G.nations[G.player.idx], c = World.countries[n.idx];
  G.evCool = G.evCool || {};
  // other countries' disasters make the news (and appear on the map)
  if (G.rng() < 0.5) {
    const m = G.nations[1 + Math.floor(G.rng() * (G.nations.length - 1))], mc = World.countries[m.idx];
    const pool = EVENTS.filter(e => e.disaster && e.w(m, mc, {}) > 0.004);
    if (pool.length && m.idx !== n.idx) { const e = pool[Math.floor(G.rng() * pool.length)], city = World.cities.find(x => x.c === m.idx) || null; m.evStab -= 2; m.evGrowth = (m.evGrowth || 0) - 0.2;
      if (city) { G.disasters.push({ city: World.cities.indexOf(city), icon: e.disaster, until: G.day + 25, c: m.idx }); newsWorld(e.title.replace('{city}', city.name) + ' (' + mc.name + ')'); } }
  }
  if (G.over) return;
  const ctx = eventContext(n);
  const cands = EVENTS.filter(e => !(G.evCool[e.id] > G.day) && !(e.needRival && ctx.rival == null) && !(e.needFriend && ctx.friend == null) && !(e.needPoor && ctx.poor == null));
  let fired = 0;
  for (const e of cands.sort(() => G.rng() - 0.5)) {
    if (fired >= 1) break;
    const p = e.w(n, c, ctx); if (!p || G.rng() > p * 2.2) continue;
    G.evCool[e.id] = G.day + (e.disaster ? 400 : 700);
    fired++;
    G.pendingEvents = G.pendingEvents || []; G.pendingEvents.push({ id: e.id, ctx });
    if (e.disaster && ctx.city != null) { G.disasters.push({ city: ctx.city, icon: e.disaster, until: G.day + 30, c: n.idx }); const ci = World.cities[ctx.city]; for (let i = 0; i < (e.fx || 1) * 3; i++) Life.flash(ci.lon + (G.rng() - 0.5) * 0.6, ci.lat + (G.rng() - 0.5) * 0.4, 1.2, [1, 0.5, 0.2], 3); }
  }
  G.disasters = G.disasters.filter(d => d.until > G.day);
  if (G.pendingEvents && G.pendingEvents.length) setTimeout(showNextEvent, 50);
}
function showNextEvent() {
  if (!G || !G.pendingEvents || !G.pendingEvents.length || !$('#modal').classList.contains('hidden')) return;
  const { id, ctx } = G.pendingEvents.shift(), e = EVENTS.find(x => x.id === id), n = G.nations[G.player.idx];
  Clock.pause();
  if (e.disaster || ctx.city != null && e.cat === 'Disaster') { const ci = World.cities[ctx.city]; flyTo(ci.lon, ci.lat, 0.25); }
  UI.modal(`<div class="sub" style="text-transform:uppercase;letter-spacing:.1em">${e.disaster || ''} ${e.cat}</div><h2>${esc(fillText(e.title, ctx))}</h2><p style="font-size:15px">${esc(fillText(e.text, ctx))}</p>
    <div class="menu" style="width:auto">${e.choices.map(([label, fx], i) => `<button class="btn" data-ev="${i}">${esc(fillText(label, ctx))}<div class="sub" style="font-size:12px;margin-top:3px">${fxSummary(fx, n) || 'No direct effect'}</div></button>`).join('')}</div>`);
  $$('[data-ev]').forEach(b => b.onclick = () => { const [label, fx] = e.choices[+b.dataset.ev]; UI.closeModal(); applyEventFx(n, fx, e, ctx, fillText(label, ctx)); inbox('info', fillText(e.title, ctx), 'You chose: ' + fillText(label, ctx) + '.'); setTimeout(showNextEvent, 200); });
}
SYSTEM_INITS.push(g => { g.disasters = g.disasters || []; g.evCool = g.evCool || {}; g.pendingEvents = g.pendingEvents || []; });
MONTHLY.push(eventsMonth);
ICON_SOURCES.push(() => G.disasters.map(d => { const c = World.cities[d.city]; return { lon: c.lon, lat: c.lat, icon: d.icon, ring: '#ffb347' }; }));
