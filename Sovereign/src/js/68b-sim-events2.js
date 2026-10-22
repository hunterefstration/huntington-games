// More events: regional flavour, chains that follow your choices, government life.
// economy
E('inflsurge', 'Economy', (n) => n.infl > 8 ? 0.03 : 0, 'Prices out of control', 'Bread has doubled in price. People are hoarding.',
  [['Freeze prices on basic goods', { i: -1, g: -0.2, a: 3, grp: { workers: 5, business: -6 } }], ['Raise interest rates sharply', { i: -1.5, g: -0.5, a: -2, grp: { business: -3 } }], ['Hand out food vouchers', { $: 0.3, a: 3 }]]);
E('unempmarch', 'Economy', (n) => n.unemp > 10 ? 0.03 : 0, 'March of the jobless', 'Tens of thousands of unemployed people marched to parliament.',
  [['Huge public works programme', { $: 0.6, g: 0.2, a: 3, grp: { workers: 6 } }], ['Cut taxes for companies that hire', { $: 0.2, g: 0.1, grp: { business: 4 } }], ['Say the economy will recover by itself', { a: -3, grp: { workers: -5 } }]], { crowd: 'workers' });
E('boom', 'Economy', (n) => n.growth > 5 ? 0.02 : 0, 'Economic miracle', 'Magazines around the world call our growth a miracle.',
  [['Take the credit', { a: 3, x: 2 }], ['Save for harder times', { $: -0.2, a: 1 }]]);
E('ratingcut', 'Economy', (n) => n.yield > 7 ? 0.02 : 0, 'Credit rating agency warns', 'A big agency says it may cut our rating. Bond markets are nervous.',
  [['Announce spending cuts', { $: -0.3, a: -3, y: -0.3 }], ['Attack the agency in a speech', { a: 2, grp: { business: -3 } }]]);
E('debtrally', 'Economy', (n) => debtPct(n) < 40 && n.dev > 0.5 ? 0.006 : 0, 'Investors love us', 'With low debt, investors are queueing to lend us money cheaply.',
  [['Borrow to build infrastructure', { $: 0.5, infra: 0.06, g: 0.15 }], ['Keep the books clean', { x: 1 }]]);
E('rarefind', 'Economy', () => 0.0015, 'Rare earth discovery', 'Rare earth metals, vital for electronics, were found near {city}.',
  [['Mine it ourselves', { g: 0.15, t: 1, grp: { green: -3 } }], ['Sell rights to the highest bidder', { $: -0.3, g: 0.05 }]]);
E('supermarket', 'Economy', (n) => n.infl > 5 ? 0.008 : 0, 'Supermarkets accused of greed', 'Profits at big supermarkets are at a record while families struggle.',
  [['Windfall tax on profits', { $: -0.1, a: 3, grp: { business: -5, workers: 3 } }], ['Ask them nicely to cut prices', { a: 1 }]]);
E('tradewar', 'Economy', (n) => G.tariffs.some(t => t.on === n.idx) ? 0.03 : 0, 'Hit by foreign tariffs', 'Factories that export are laying off workers because of tariffs abroad.',
  [['Retaliate with our own tariffs', { i: 0.3, a: 2, grp: { workers: 2, business: -2 } }], ['Help exporters find new markets', { $: 0.1, g: 0.05 }]]);
E('gig', 'Economy', (n) => n.dev > 0.5 ? 0.004 : 0, 'Delivery riders strike', 'App delivery workers want proper contracts.',
  [['Give them full worker rights', { g: -0.03, grp: { youth: 4, workers: 3, business: -3 } }], ['Leave it to the companies', { grp: { youth: -3 } }]]);
E('tunnel', 'Economy', (n) => n.k.infra > n.base.k.infra ? 0.006 : 0.001, 'Mega-tunnel finished', 'The country\'s longest tunnel opened, cutting travel times in half.',
  [['Cut the ribbon in person', { a: 2, x: 1 }], ['Thank the engineers', { a: 1 }]]);
// politics
E('approvalhigh', 'Politics', (n) => n.approval > 65 ? 0.015 : 0, 'Riding high', 'Polls say you are the most popular leader in decades.',
  [['Spend your popularity on bold reforms', { pc: 15 }], ['Stay humble', { a: 1 }]]);
E('approvallow', 'Politics', (n) => n.approval < 30 ? 0.02 : 0, 'Party wants a new leader', 'Senior figures in your party say it is time for you to go.',
  [['Reshuffle the cabinet', { pc: -4, a: 2 }], ['Give a big speech on TV', { a: 3, risk: 0.3 }], ['Tell them to get in line', { pc: 3, a: -2 }]]);
E('minquit', 'Politics', (n) => n.cabinet && Object.values(n.cabinet).some(m => m.loyalty < 30) ? 0.02 : 0, 'Cabinet split', 'Two ministers openly disagree with you on TV.',
  [['Demand loyalty', { pc: 2, a: -1 }], ['Let them debate: it is democracy', { a: 1, pc: -2 }]]);
E('referendumcall', 'Politics', (n) => GOV[n.gov].free && n.polar > 60 ? 0.01 : 0, 'Calls for a referendum', 'Activists collected a million signatures for a public vote on a hot issue.',
  [['Hold the referendum', { a: 2, f: 2, risk: 0.4 }], ['Refuse', { a: -2, grp: { media: -2 } }]]);
E('corruptpolice', 'Politics', (n) => n.corruption > 0.35 ? 0.015 : 0.002, 'Police take bribes', 'A hidden camera shows traffic police taking bribes.',
  [['Fire them all and raise police pay', { $: 0.05, s: 1, grp: { police: -2 } }], ['Quietly reassign them', { a: -1 }]]);
E('tax evasion', 'Politics', (n) => n.tax.income > 35 ? 0.008 : 0.002, 'Tax dodgers exposed', 'Leaked papers show hundreds of rich people hiding money abroad.',
  [['Chase every cent', { $: -0.15, a: 3, grp: { elite: -6, workers: 4 } }], ['Offer an amnesty if they pay now', { $: -0.08, a: -1 }]]);
E('flagdebate', 'Politics', () => 0.002, 'Should we change the flag?', 'A campaign to redesign the national flag is going viral.',
  [['Hold a design contest', { a: 1, grp: { youth: 3, retirees: -3 } }], ['The flag stays', { grp: { retirees: 3, military: 1 } }]]);
E('capitalclean', 'Politics', (n) => n.dev < 0.5 ? 0.004 : 0.001, 'Capital buried in rubbish', 'Garbage collectors have not been paid for months.',
  [['Pay them from the national budget', { $: 0.02, a: 2 }], ['Blame the mayor', { a: -1 }]]);
E('hunger', 'Politics', (n) => !GOV[n.gov].free ? 0.005 : 0.001, 'Hunger strike', 'A jailed activist has refused food for 30 days. The world is watching.',
  [['Release them', { f: 3, abroad: 3, grp: { police: -2, students: 3 } }], ['Keep them in prison', { abroad: -5, grp: { students: -4 } }]]);
E('immigrantsjob', 'Politics', (n) => n.laws && n.laws.immig >= 2 ? 0.008 : 0.002, 'Row over migrant workers', 'Some say migrants take jobs; businesses say they cannot find workers.',
  [['More work visas', { g: 0.08, grp: { business: 4, workers: -4 } }], ['Fewer visas', { g: -0.05, grp: { workers: 3, business: -4, minorities: -3 } }]]);
// society
E('school', 'Society', (n) => n.spend.education < n.base.spend.education ? 0.02 : 0.003, 'Teachers walk out', 'Schools closed as teachers demand better pay.',
  [['Raise teacher pay', { $: 0.1, grp: { students: 4, workers: 3 } }], ['Hire temporary teachers', { a: -2, grp: { students: -3 } }]], { crowd: 'workers' });
E('hospital', 'Society', (n) => n.spend.health < n.base.spend.health ? 0.02 : 0.003, 'Hospital waiting lists explode', 'Patients wait months for operations.',
  [['Emergency health funding', { $: 0.2, a: 3, grp: { retirees: 5 } }], ['Use private hospitals', { $: 0.1, grp: { business: 3, workers: -3 } }]]);
E('pensions', 'Society', (n) => n.dev > 0.6 ? 0.004 : 0.001, 'Pension fund running dry', 'Experts warn the pension system will be empty in 15 years.',
  [['Raise the retirement age', { $: -0.3, a: -3, grp: { retirees: -6, workers: -4 } }], ['Raise payroll taxes', { $: -0.2, g: -0.05, grp: { workers: -3 } }], ['Leave it for the next government', { a: 1 }]]);
E('drugcrisis', 'Society', (n) => 0.003, 'Drug crisis', 'Overdoses are rising fast in {city}.',
  [['Treatment centres', { $: 0.05, s: 1, grp: { youth: 2 } }], ['Crack down on dealers', { s: 1, grp: { police: 3 } }]]);
E('language', 'Society', (n, c) => c.langs.length > 1 ? 0.004 : 0, 'Language row', 'Speakers of a minority language say they are ignored.',
  [['Make it an official language', { s: 1, grp: { minorities: 6, retirees: -2 } }], ['One country, one language', { grp: { minorities: -6 } }]]);
E('heritage', 'Society', () => 0.002, 'Ancient ruins found', 'Builders in {city} uncovered a 2,000 year old city.',
  [['Stop building and dig', { $: 0.01, x: 2, g: -0.01 }], ['Record it and keep building', { grp: { business: 2 } }]]);
E('marathon', 'Society', () => 0.002, 'World record!', 'A runner from {city} broke the marathon world record.',
  [['National hero ceremony', { a: 1, x: 1 }], ['Fund running tracks in every town', { $: 0.01, grp: { youth: 2 } }]], { party: 1 });
E('chess', 'Society', () => 0.0015, 'Chess world champion', 'A 17-year-old from our country is the new chess world champion.',
  [['Chess in every school', { $: 0.005, grp: { students: 3 } }], ['Congratulate her', { a: 1, x: 1 }]]);
E('heatgreen', 'Society', (n) => n.groups && n.groups.green < 35 ? 0.015 : 0.002, 'Climate activists glue themselves to roads', 'Traffic is blocked in the capital.',
  [['Talk to them', { grp: { green: 4, retirees: -2 } }], ['Arrest them', { f: -1, grp: { green: -6, retirees: 3 } }]], { crowd: 'green' });
// foreign & war
E('ceasefire', 'Foreign', () => G.wars.length ? 0.008 : 0, 'Calls for a ceasefire', 'World leaders ask everyone to stop the fighting in an ongoing war.',
  [['Back the peace plan', { abroad: 3, x: 1 }], ['Stay out of it', {}]]);
E('peacekeep', 'Foreign', (n) => n.army && n.army.troops > 50000 ? 0.004 : 0, 'UN asks for peacekeepers', 'The UN asks us to send soldiers to keep peace in a broken country.',
  [['Send 2,000 troops', { $: 0.03, x: 2, abroad: 3, grp: { military: 2 } }], ['Decline', { abroad: -1 }]]);
E('olympicsbid', 'Foreign', (n) => n.dev > 0.5 ? 0.003 : 0, 'Host the Olympics?', 'The Olympic committee invites us to bid for the games.',
  [['Bid! We want the world here', { $: 0.3, x: 3, a: 2 }], ['Too expensive', { a: -1 }]]);
E('stateguest', 'Foreign', (n, c, ctx) => ctx.friend ? 0.005 : 0, 'State visit from {friend}', 'The leader of {friend} is coming. Where do we take them?',
  [['A grand banquet at the palace', { $: 0.002, r: 6, friendSide: 1 }], ['A football match', { r: 4, friendSide: 1, a: 1 }]], { needFriend: true });
E('fishing', 'Foreign', (n, c, ctx) => COAST(c) && ctx.rival ? 0.004 : 0, 'Fishing boats seized', '{rival} seized our fishing boats in disputed waters.',
  [['Send the navy', { r: -15, grp: { military: 4, farmers: 2 } }], ['Protest through diplomats', { r: -3 }]], { needRival: true });
E('kidnap', 'Foreign', () => 0.002, 'Citizens kidnapped abroad', 'Three of our aid workers were kidnapped in a war zone.',
  [['Negotiate quietly', { $: 0.002, a: 1 }], ['Rescue mission', { a: 4, x: 1, risk: 0.35 }]]);
E('sanctionsbite', 'Foreign', (n) => G.sanctions.some(s => s.on === n.idx) ? 0.02 : 0, 'Sanctions bite', 'Shops are short of medicine and spare parts because of sanctions.',
  [['Find new trade partners', { g: 0.1, pc: -2 }], ['Smuggle through third countries', { g: 0.15, abroad: -3, scandalRisk: 0.3 }], ['Blame the foreigners', { a: 2, s: 1 }]]);
E('debttrapcall', 'Foreign', (n) => n.debtTrap != null ? 0.01 : 0, 'The loan comes due', 'The country that built our port wants its money, or the port.',
  [['Pay up', { $: 0.4 }], ['Hand over the port for 99 years', { a: -4, x: -2, grp: { military: -4 } }]]);
// tech & future
E('robots', 'Technology', (n) => (n.techLv || 0) > 15 ? 0.005 : 0, 'Self-driving cars', 'Companies want to put driverless taxis on our roads.',
  [['Allow them', { g: 0.1, grp: { business: 4, workers: -4 } }], ['Ban them', { grp: { workers: 3, business: -3 } }]]);
E('labmeat', 'Technology', (n) => (n.techLv || 0) > 20 ? 0.004 : 0, 'Lab-grown meat', 'Scientists can grow meat without animals.',
  [['Support it', { $: 0.05, grp: { green: 5, farmers: -6 } }], ['Protect our farmers', { grp: { farmers: 5, green: -3 } }]]);
E('mars', 'Technology', (n) => n.projects && n.projects.some(p => p.id === 'moon' && p.done) ? 0.01 : 0, 'Mars mission ready', 'Our space agency says it can send people to Mars.',
  [['Go to Mars!', { $: 1, x: 10, a: 5, t: 5 }], ['Not yet', {}]]);
E('quantum', 'Technology', (n) => n.dev > 0.75 ? 0.002 : 0, 'Quantum computer', 'Our lab built a quantum computer that can break old codes.',
  [['Give it to the intelligence service', { mil: 0.02, t: 2 }], ['Publish the research', { x: 2, t: 1 }]]);
