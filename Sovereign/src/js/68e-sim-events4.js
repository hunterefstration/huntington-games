// Events, fourth batch: things that only happen in some parts of the world.
const sub = (c, ...s) => s.includes(c.sub) || s.includes(c.region);
E('monsoon', 'Disaster', (n, c) => sub(c, 'Southern Asia', 'South-Eastern Asia') ? 0.01 : 0, 'Monsoon fails', ['The monsoon rains are three weeks late. Rice fields are cracking.', 'The monsoon came all at once: a month of rain in two days.'],
  [['Emergency irrigation and food stocks', { $: 0.15, a: 2, grp: { farmers: 5 } }], ['Pray for rain', { grp: { religious: 2, farmers: -3 } }]], { disaster: '🌧' });
E('sandstorm', 'Disaster', (n, c) => sub(c, 'Northern Africa', 'Western Asia') || ['MLI', 'NER', 'TCD', 'MRT', 'SDN'].includes(c.id) ? 0.008 : 0, 'Sandstorm', ['A wall of sand swallowed {city}. Flights are cancelled and hospitals are full of coughing children.'],
  [['Plant a "green wall" of trees', { $: 0.05, grp: { green: 5 } }], ['Hand out masks', { $: 0.005, a: 1 }]], { disaster: '🌪' });
E('typhoonready', 'Disaster', (n, c) => ['PHL', 'JPN', 'TWN', 'VNM', 'CHN', 'KOR'].includes(c.id) ? 0.008 : 0, 'Super typhoon on the way', ['Forecasters say the strongest typhoon in years will hit near {city} in three days.'],
  [['Evacuate a million people', { $: 0.1, a: 3, g: -0.05 }], ['Shelter in place', { risk: 0.35 }]], { disaster: '🌀' });
E('permafrost', 'Disaster', (n, c) => ['RUS', 'CAN', 'ISL', 'NOR', 'FIN', 'SWE', 'MNG'].includes(c.id) ? 0.004 : 0, 'The ground is melting', ['Permafrost is thawing in the north. Roads and pipelines are cracking.'],
  [['Rebuild on stilts', { $: 0.1, infra: 0.02 }], ['Patch it up', { $: 0.02, g: -0.02 }]]);
E('reef', 'Society', (n, c) => ['AUS', 'FJI', 'MDV', 'PLW', 'IDN', 'PHL', 'BLZ', 'EGY', 'TON', 'WSM', 'SLB', 'VUT'].includes(c.id) ? 0.004 : 0, 'Coral reef bleaching', ['Divers say half of our coral reef has turned white.'],
  [['Ban fishing in the reef area', { g: -0.02, grp: { green: 5, farmers: -3 } }], ['Fund reef science', { $: 0.01, t: 0.3, grp: { green: 2 } }]]);
E('sealevel', 'Disaster', (n, c) => ['TUV', 'KIR', 'MHL', 'MDV', 'NRU', 'FSM', 'PLW', 'BGD', 'NLD'].includes(c.id) ? 0.008 : 0, 'King tide floods the streets', ['A very high tide flooded homes in {city}. Children paddle to school.'],
  [['Build sea walls', { $: 0.3, a: 2, infra: 0.02 }], ['Plead with the world at the UN', { abroad: 4, x: 1 }]], { disaster: '🌊' });
E('royalscandal', 'Politics', (n) => ['CMON', 'AMON'].includes(n.gov) ? 0.003 : 0, 'Royal scandal', ['A young royal was caught spending public money on a superyacht.', 'A royal cousin said something rude about farmers. Farmers did not like it.'],
  [['Cut the royal budget', { $: -0.002, grp: { workers: 2, retirees: -2 } }], ['Defend the royal family', { grp: { retirees: 3, youth: -3 } }]]);
E('jubilee', 'Society', (n) => ['CMON', 'AMON'].includes(n.gov) ? 0.002 : 0, 'Royal jubilee', ['The monarch celebrates 25 years on the throne. Street parties are planned.'],
  [['A huge national celebration', { $: 0.01, a: 3 }], ['A small dignified ceremony', { a: 1 }]], { party: 1 });
E('carnival', 'Society', (n, c) => ['BRA', 'TTO', 'COL', 'BOL', 'URY', 'ARG', 'DOM', 'HTI', 'CUB', 'PRY'].includes(c.id) ? 0.006 : 0, 'Carnival!', ['Carnival in {city} breaks records: two million people dance in the streets.'],
  [['Join the parade yourself', { a: 3, grp: { youth: 3, religious: -1 } }], ['Wave from a balcony', { a: 1 }]], { party: 1 });
E('cartel', 'Politics', (n, c) => ['MEX', 'COL', 'ECU', 'HND', 'GTM', 'SLV', 'VEN', 'PER', 'BRA'].includes(c.id) ? 0.008 : 0, 'Cartel violence', ['A drug cartel took over a town near {city}. Police officers have fled.', 'Gunmen attacked a police station in {city}. The cartel claims the area.'],
  [['Send in the army', { s: 2, f: -2, grp: { military: 2, minorities: -2 } }], ['Offer amnesty to low-level members', { s: 1, grp: { police: -3 } }], ['Hunt the cartel leaders', { $: 0.02, risk: 0.3, a: 2 }]]);
E('migrantcaravan', 'Foreign', (n, c) => ['MEX', 'GTM', 'USA'].includes(c.id) ? 0.006 : 0, 'Migrant caravan', ['Thousands of people from Central America are walking north through our country.'],
  [['Give them visas and buses', { abroad: 2, grp: { minorities: 2, workers: -2 } }], ['Block them at the border', { abroad: -3, grp: { police: 2, minorities: -4 } }]]);
E('safari', 'Economy', (n, c) => ['KEN', 'TZA', 'ZAF', 'BWA', 'NAM', 'ZMB', 'ZWE', 'UGA', 'RWA'].includes(c.id) ? 0.005 : 0, 'Poachers strike', ['Poachers killed three rhinos in our biggest national park.'],
  [['Ranger army with drones', { $: 0.01, x: 1, grp: { green: 5 } }], ['Let local villages profit from tourism', { g: 0.03, grp: { farmers: 3 } }]]);
E('afcon', 'Society', (n, c) => c.region === 'Africa' ? 0.004 : 0, 'Africa Cup glory', ['Our team reached the final of the Africa Cup of Nations! The whole country is dressed in national colours.'],
  [['Give everyone the day off for the final', { a: 4, g: -0.02 }], ['Watch with the fans in {city}', { a: 2 }]], { party: 1 });
E('mobileboom', 'Economy', (n, c) => c.region === 'Africa' && n.dev < 0.5 ? 0.004 : 0, 'Solar for every village', ['A company offers cheap solar panels to every village without power.'],
  [['Subsidise it', { $: 0.05, a: 3, g: 0.05, grp: { farmers: 4 } }], ['Let the market handle it', { g: 0.02 }]]);
E('silkroad', 'Economy', (n, c) => sub(c, 'Central Asia', 'Southern Asia', 'Eastern Africa') ? 0.004 : 0, 'Railway offer', ['China offers to build a high-speed railway through {country}, paid with loans.'],
  [['Sign the deal', { g: 0.2, debtTrap: 1, y: 0.1 }], ['Ask for better terms', { pc: -1 }], ['Decline', {}]]);
E('kpop', 'Society', (n, c) => sub(c, 'Eastern Asia', 'South-Eastern Asia') ? 0.004 : 0, 'Pop band breaks the internet', ['A boy band from {city} broke a world record for video views in one day.'],
  [['Make them cultural ambassadors', { x: 2, a: 1, grp: { youth: 4 } }], ['Exempt them from military service', { grp: { youth: 4, military: -4 } }]]);
E('cherry', 'Society', (n, c) => ['JPN', 'KOR', 'CHN', 'TWN'].includes(c.id) ? 0.003 : 0, 'Blossom season', ['The blossom came two weeks early this year. Parks in {city} are packed.'],
  [['Host a leaders’ picnic for foreign ambassadors', { x: 1, abroad: 2 }], ['Enjoy it with your family', { a: 1 }]]);
E('nordiccold', 'Society', (n, c) => ['NOR', 'SWE', 'FIN', 'ISL', 'DNK'].includes(c.id) ? 0.003 : 0, 'Polar night blues', ['Doctors say the long dark winter is making people sad.'],
  [['Free light-therapy lamps', { $: 0.002, a: 2 }], ['Build saunas in every town', { $: 0.01, a: 2, grp: { retirees: 2 } }]]);
E('eurovision', 'Society', (n, c) => c.region === 'Europe' ? 0.004 : 0, 'Song contest', ['Our singer won the European song contest! Next year the whole continent comes to {city}.', 'Our song got zero points at the European song contest. The nation is in mourning.'],
  [['Pay to host next year', { $: 0.01, x: 2, tour: 1 }], ['Make a joke about it', { a: 1 }]]);
E('gulfmega', 'Economy', (n, c) => ['SAU', 'ARE', 'QAT', 'KWT', 'BHR', 'OMN'].includes(c.id) ? 0.004 : 0, 'Mega-city in the desert', ['Planners propose a 170 km long city in a straight line through the desert.'],
  [['Build it!', { $: 1.5, x: 4, g: 0.1 }], ['Build something smaller', { $: 0.3, g: 0.05 }], ['Save the money', {}]]);
E('pilgrims', 'Society', (n, c) => ['SAU', 'IRQ', 'IND', 'ISR', 'VAT', 'NPL'].includes(c.id) ? 0.004 : 0, 'Millions of pilgrims', ['Millions of pilgrims are arriving for a great religious festival in {city}.'],
  [['Huge safety operation', { $: 0.02, s: 1, grp: { religious: 4 } }], ['Business as usual', { risk: 0.2 }]]);
E('pacificaid', 'Foreign', (n, c) => c.region === 'Oceania' && n.pop < 2e6 ? 0.006 : 0, 'Two giants want our friendship', ['Both China and the United States are offering to build us a new port.'],
  [['Take China’s offer', { g: 0.2, debtTrap: 1 }], ['Take the American offer', { g: 0.1, x: 1 }], ['Stay neutral and take neither', { x: 1 }]]);
E('oildip', 'Economy', (n) => n.res.includes('oil') && G.world.oil < 80 ? 0.02 : 0, 'Oil price slump', ['Oil prices fell below what it costs to pump it. The treasury is worried.'],
  [['Cut spending', { $: -0.3, a: -2 }], ['Borrow and wait for prices to recover', { y: 0.2 }], ['Diversify: invest in tourism and tech', { $: 0.2, g: 0.05 }]]);
