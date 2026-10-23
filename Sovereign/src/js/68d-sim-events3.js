// Events, third batch: everyday life, oddities, war at home, regions, money, culture. Many have several wordings.
const ISLAND = c => !c.borders.length;
const atWar = n => G.wars.some(w => w.a.includes(n.idx) || w.d.includes(n.idx));
// ---- daily life
E('pothole', 'Society', () => 0.004, 'The pothole that ate a bus', ['A pothole in {city} is now so big a bus fell in. Nobody was hurt, but the photo is everywhere.', 'Residents of {city} planted flowers in a giant pothole and named it after you.'],
  [['Fix every road in {city}', { $: 0.02, a: 2 }], ['Make a joke about it on TV', { a: 1, grp: { youth: 2 } }], ['Blame the city council', { a: -1 }]]);
E('traffic', 'Society', (n) => n.dev > 0.4 ? 0.005 : 0.002, 'Gridlock', ['Traffic in {capital} has not moved for four hours. People are eating dinner in their cars.', 'A broken traffic light caused a 30 km jam outside {city}.'],
  [['Build a new ring road', { $: 0.15, infra: 0.02, grp: { workers: 2, green: -3 } }], ['Free public transport for a month', { $: 0.03, a: 2, grp: { green: 4 } }], ['Tell people to work from home', { g: -0.02 }]]);
E('heatbeach', 'Society', (n, c) => !c.landlocked ? 0.003 : 0, 'Beach overcrowding', ['So many people went to the beach near {city} that nobody could see the sand.', 'A heat-wave weekend: two million people at the seaside and not one parking space.'],
  [['Open the military beaches to the public', { a: 2, grp: { military: -2 } }], ['Do nothing, it is summer', {}]]);
E('wifi', 'Society', (n) => n.dev > 0.3 ? 0.003 : 0, 'Internet outage', ['The whole country lost internet for six hours. Teenagers discovered board games.', 'A cable cut by a fishing boat took {country} offline for an afternoon.'],
  [['Build a backup cable', { $: 0.05, t: 0.5 }], ['Tweet an apology (once the internet is back)', { a: 1, grp: { youth: 1 } }]]);
E('bread', 'Society', (n) => n.infl > 5 ? 0.01 : 0.002, 'The price of {food}', ['The price of {food} doubled this year. Families are angry.', 'Queues for subsidised {food} stretch around the block in {city}.'],
  [['Subsidise {food}', { $: 0.1, i: -0.3, a: 3, grp: { workers: 4 } }], ['Cut import taxes on food', { $: 0.03, i: -0.2, grp: { farmers: -3 } }], ['Say prices will fall soon', { a: -2 }]]);
E('school-lunch', 'Society', () => 0.003, 'Free school lunches?', ['A celebrity chef starts a campaign for free school lunches for every child.', 'A video of a child sharing lunch with a hungry classmate made the whole country cry.'],
  [['Free lunches for all', { $: 0.1, a: 3, grp: { women: 4, workers: 3 } }], ['Only for poor families', { $: 0.03, a: 1 }], ['Not the state’s job', { a: -2 }]]);
E('dogs', 'Society', () => 0.002, 'Stray dogs', ['Packs of stray dogs roam the streets of {city}.', 'Animal lovers and angry parents argue about the stray dogs of {city}.'],
  [['Shelters and adoption drive', { $: 0.005, a: 1, grp: { youth: 2 } }], ['Round them up', { grp: { youth: -3, retirees: 2 } }]]);
E('noise', 'Society', () => 0.002, 'Noise war', ['Neighbours in {city} are suing a nightclub for noise. The case is on every talk show.'],
  [['Nightlife is culture: back the club', { grp: { youth: 3, retirees: -3 } }], ['Quiet hours after 11 pm', { grp: { retirees: 3, youth: -3 } }]]);
E('lottery', 'Society', () => 0.002, 'Record lottery jackpot', ['A cleaner from {city} won the biggest lottery prize in history and gave half of it to her neighbours.', 'The national lottery jackpot is now bigger than the budget of some ministries.'],
  [['Invite the winner to the palace', { a: 1 }], ['Tax big lottery wins', { $: -0.01, grp: { workers: -2 } }]]);
E('wedding', 'Society', () => 0.002, 'Wedding of the year', ['Two of the country’s biggest stars are getting married in {city}. Helicopters circle overhead.'],
  [['Send a gift from the nation', { a: 1 }], ['Stay out of celebrity gossip', {}]]);
E('ghost', 'Society', () => 0.0015, 'Haunted palace?', ['Staff at the presidential palace swear they hear footsteps at night. The story is everywhere.', 'A TV show claims the ghost of a former leader walks the halls of power.'],
  [['Hold a public "ghost tour"', { a: 2, $: -0.001, grp: { youth: 2 } }], ['Call it nonsense', {}]]);
E('ufo', 'Society', () => 0.0015, 'Lights in the sky', ['Thousands film strange lights over {city}.', 'Pilots report a glowing object following their plane near {city}.'],
  [['Open the military files', { f: 1, grp: { military: -2, youth: 3 } }], ['"Weather balloons"', { a: -1 }]]);
E('fashion', 'Society', () => 0.002, 'Your outfit goes viral', ['Your jacket at a summit sold out in every shop in {country} within hours.', 'Fashion magazines put you on their worst-dressed list.'],
  [['Wear it again tomorrow', { a: 1, grp: { youth: 2 } }], ['Hire a stylist', { $: 0.0001, pc: -1 }]]);
E('selfie', 'Society', () => 0.002, 'Selfie with a stranger', ['You stopped your car to take a selfie with a crying fan. It has 40 million views.'],
  [['Do more walkabouts', { a: 2, grp: { youth: 2, police: -1 } }], ['Security says no more stops', {}]]);
E('pets', 'Society', () => 0.0015, 'First pet', ['Children write thousands of letters asking you to adopt a dog.'],
  [['Adopt a shelter dog', { a: 2 }], ['Adopt a cat, to be different', { a: 1, grp: { youth: 2 } }], ['No time for pets', { a: -1 }]]);
// ---- money and business
E('bankrun', 'Economy', (n) => n.yield > 8 ? 0.012 : 0.002, 'Rumours of a bank run', ['A message spreads on phones: "Take your money out now." Queues form at banks in {city}.', 'A small bank in {city} closed its doors early. Panic spread by lunchtime.'],
  [['Guarantee all savings', { $: 0.2, s: 2, a: 1 }], ['Close banks for a "holiday"', { g: -0.2, s: -1, a: -2 }], ['Arrest the rumour-makers', { f: -2, grp: { media: -4 } }]]);
E('unicorn2', 'Economy', (n) => n.dev > 0.4 ? 0.003 : 0.001, 'Tech giant wants a HQ', ['{company} is choosing a country for its new headquarters. {city} is on the shortlist.', 'A tech billionaire tours {city} looking for a place to build.'],
  [['Offer a 10-year tax holiday', { $: 0.05, g: 0.2, grp: { business: 4, workers: -1 } }], ['Offer land and fast visas', { g: 0.1, grp: { business: 2 } }], ['We don’t bribe companies', { grp: { workers: 2 } }]]);
E('coffee', 'Economy', (n) => n.res.includes('food') ? 0.004 : 0, 'Crop prices crash', ['World prices for our main crop fell by half. Farmers are selling below cost.'],
  [['Buy the surplus', { $: 0.1, grp: { farmers: 6 } }], ['Help farmers switch crops', { $: 0.05, g: -0.05, grp: { farmers: 2 } }], ['The market decides', { grp: { farmers: -6 } }]]);
E('shipping', 'Economy', (n, c) => !c.landlocked ? 0.003 : 0, 'Giant ship stuck', ['A huge container ship is stuck in the main shipping lane. Prices of everything imported are rising.'],
  [['Send every tugboat we have', { $: 0.005, x: 1 }], ['Wait for high tide', { i: 0.2 }]]);
E('counterfeit', 'Economy', () => 0.002, 'Fake money', ['Police found a printing press making perfect fake banknotes in {city}.'],
  [['Print new, safer notes', { $: 0.03 }], ['Keep it quiet', { scandalRisk: 0.2 }]]);
E('brain', 'Economy', (n) => n.dev < 0.6 ? 0.005 : 0.001, 'Brain drain', ['Half of last year’s medical graduates have left for jobs abroad.', 'Our best engineers are leaving {country}. "There is no future here," says one.'],
  [['Pay young doctors and engineers more', { $: 0.08, a: 1, t: 0.5 }], ['Make graduates work here for five years', { f: -1, grp: { students: -5 } }], ['Let them go and send money home', { g: 0.03 }]]);
E('boomtown', 'Economy', (n) => n.growth > 3 ? 0.006 : 0, 'Boomtown {city}', ['{city} is growing so fast that people sleep in shipping containers.', 'Rents in {city} tripled in two years. Everyone wants to live there.'],
  [['Build a new district', { $: 0.2, g: 0.05, a: 2 }], ['Slow it down with taxes', { $: -0.03, g: -0.03 }]]);
E('ghosttown', 'Economy', (n) => n.growth < 1 ? 0.004 : 0, 'Ghost town', ['The mine closed and now half of the houses in a small town near {city} are empty.'],
  [['Move a government agency there', { $: 0.02, a: 2 }], ['Pay people to move away', { $: 0.01 }]]);
E('stockrecord', 'Economy', (n) => (n.stocks || 100) > 120 ? 0.01 : 0, 'Stock market record', ['The stock market hit an all-time high. Bankers in {capital} are buying champagne.'],
  [['Take the credit', { a: 1, grp: { business: 2 } }], ['Warn about a bubble', { grp: { business: -1 }, pc: 1 }]]);
E('mobilemoney', 'Economy', (n) => n.dev < 0.5 ? 0.004 : 0, 'Phone banking revolution', ['Millions of people in {country} now send money by text message.'],
  [['Support it with clear rules', { g: 0.08, c: -0.01, grp: { youth: 3 } }], ['Tax every transfer', { $: -0.03, grp: { youth: -4, workers: -2 } }]]);
// ---- politics, people, government life
E('speechleak', 'Politics', () => 0.003, 'Hot mic', ['A microphone you thought was off caught you calling a minister "useless".', 'A recording of you complaining about voters leaked.'],
  [['Apologise', { a: -1, pc: -2 }], ['Laugh it off', { a: -2, grp: { youth: 2 } }], ['Say it was edited', { a: -3, grp: { media: -3 } }]]);
E('oldfriend', 'Politics', () => 0.003, 'An old friend wants a favour', ['Your school friend {person} wants a government contract for his company.'],
  [['Say no', { a: 1 }], ['Give him the contract', { pc: 2, scandalRisk: 0.4 }]]);
E('protestor', 'Politics', () => 0.003, 'A protester at your speech', ['A woman interrupted your speech in {city} shouting about the cost of {food}.'],
  [['Invite her on stage to talk', { a: 2, grp: { workers: 2 } }], ['Have security remove her', { a: -2, grp: { media: -2 } }]]);
E('book', 'Politics', () => 0.002, 'Tell-all book', ['A former adviser wrote a book about working for you. It is a bestseller.', '{opp} reads passages from an ex-minister’s book on live TV.'],
  [['Ignore it', { a: -1 }], ['Sue the author', { f: -1, grp: { media: -3 } }], ['Write your own book', { pc: -2, a: 1 }]]);
E('debatetv', 'Politics', (n) => GOV[n.gov].free ? 0.003 : 0, 'TV grilling', ['A famous interviewer asks you live on air: "Why should anyone trust you?"'],
  [['Answer with facts and numbers', { a: 1, grp: { business: 2 } }], ['Tell a personal story', { a: 2, grp: { women: 2 } }], ['Walk out of the studio', { a: -3, grp: { military: 1 } }]]);
E('regionbonus', 'Politics', () => 0.003, '{city} feels forgotten', ['People in {city} say the capital gets everything and they get nothing.'],
  [['Move a ministry to {city}', { $: 0.02, a: 2 }], ['Promise a new hospital', { $: 0.03, a: 1 }], ['Say the whole country matters equally', {}]]);
E('ministersleep', 'Politics', () => 0.002, 'Minister caught napping', ['{minister} was photographed asleep in parliament during a debate on the budget.'],
  [['Fire them', { pc: -1, a: 1, fire: 1 }], ['Everyone gets tired', { a: -1 }]]);
E('youthparl', 'Politics', () => 0.002, 'Youth parliament', ['Teenagers from every region want to hold a youth parliament in the real chamber.'],
  [['Open the doors to them', { a: 2, grp: { youth: 4, students: 3 } }], ['Parliament is for adults', { grp: { youth: -2 } }]]);
E('anthem', 'Politics', () => 0.0015, 'New national anthem?', ['A rap version of the national anthem is number one. Some love it, some are furious.'],
  [['Play it at the next state event', { grp: { youth: 5, retirees: -4, military: -2 } }], ['Ban it from official events', { grp: { retirees: 3, youth: -4 } }]]);
E('statue', 'Politics', () => 0.002, 'Statue row', ['Protesters want a statue of a 19th-century general removed from {city}.'],
  [['Move it to a museum', { grp: { minorities: 4, students: 3, retirees: -3, military: -2 } }], ['Keep it', { grp: { retirees: 3, minorities: -4 } }], ['Let {city} vote on it', { f: 1, a: 1 }]]);
E('corruptmayor', 'Politics', (n) => n.corruption > 0.25 ? 0.006 : 0.001, 'Mayor arrested', ['The mayor of {city} was arrested with a suitcase of cash.'],
  [['Let justice take its course', { a: 2, grp: { media: 2 } }], ['He is our ally: get him out', { pc: 2, scandalRisk: 0.5, f: -1 }]]);
E('electioncount', 'Politics', (n) => GOV[n.gov].free ? 0.002 : 0, 'Local elections', ['Your party won the city hall in {city} for the first time in 40 years!', 'Your party lost the city hall in {city}, its old stronghold.'],
  [['Celebrate', { a: 1, pc: 2 }], ['Stay humble', {}]]);
E('spyminister', 'Politics', () => 0.0015, 'Is a minister a spy?', ['Intelligence officers whisper that {minister} meets a foreign diplomat every week.'],
  [['Quietly remove them', { pc: -2, fire: 1 }], ['Ignore gossip', { risk: 0.2 }]]);
E('lifecoach', 'Politics', () => 0.0015, 'Your astrologer', ['A newspaper claims you take advice from an astrologer. Is it true?'],
  [['Deny it firmly', { a: -1 }], ['"The stars are on my side"', { a: 1, grp: { youth: 2, religious: -2 } }]]);
// ---- war at home
E('warbonds', 'War', (n) => atWar(n) ? 0.02 : 0, 'War bonds', ['The treasury wants to sell "victory bonds" to citizens to pay for the war.'],
  [['Launch a big campaign', { $: -0.3, a: 1, grp: { retirees: 2 } }], ['Borrow abroad instead', { y: 0.2 }]]);
E('draftdodge', 'War', (n) => atWar(n) && n.army.mobilized ? 0.02 : 0, 'Draft dodgers', ['Thousands of young men are crossing the border to avoid being called up.'],
  [['Close the border to men of fighting age', { f: -2, s: 1, grp: { youth: -6 } }], ['Let them go', { mil: -0.02, grp: { military: -3 } }], ['Offer non-combat service', { grp: { youth: 3, military: -1 } }]]);
E('wargrief', 'War', (n) => atWar(n) ? 0.015 : 0, 'A mother’s letter', ['A mother who lost two sons in the war wrote you a letter. A newspaper printed it.', 'A grieving father stood silently outside the palace for three days.'],
  [['Meet her privately', { a: 2, pc: -1 }], ['Answer in a public speech', { a: 1 }], ['Ignore it', { a: -3, grp: { women: -3 } }]]);
E('warrations', 'War', (n) => atWar(n) ? 0.012 : 0, 'Shortages at home', ['Shops are running out of fuel and sugar because of the war.'],
  [['Introduce ration cards', { i: -0.5, s: 1, a: -1 }], ['Let prices rise', { i: 1, a: -2 }]]);
E('warhero2', 'War', (n) => atWar(n) ? 0.01 : 0, 'A hero from {city}', ['A young soldier from {city} saved her whole unit. The country wants to meet her.'],
  [['Give her the highest medal on live TV', { a: 3, grp: { military: 4 } }], ['A quiet ceremony', { a: 1 }]]);
E('warpropaganda', 'War', (n) => atWar(n) ? 0.01 : 0, 'War films', ['The culture ministry wants to fund patriotic films about the war.'],
  [['Fund them', { $: 0.01, a: 1, grp: { military: 3, media: -2 } }], ['Art should be free', { f: 1, grp: { media: 2 } }]]);
E('warprisoners', 'War', (n) => atWar(n) ? 0.01 : 0, 'Prisoner exchange', ['The enemy offers to swap 500 prisoners of war.'],
  [['Accept the swap', { a: 3, s: 1 }], ['Refuse: they may fight again', { a: -2, grp: { military: 2 } }]]);
E('warjournal', 'War', (n) => atWar(n) ? 0.008 : 0, 'Reporters at the front', ['Foreign journalists want to visit the front line.'],
  [['Let them see everything', { abroad: 3, grp: { military: -2 } }], ['Escort them to safe areas only', {}], ['Keep them out', { abroad: -3, grp: { media: -3 } }]]);
E('peacemarch', 'War', (n) => atWar(n) ? 0.01 : 0, 'March for peace', ['Two hundred thousand people marched through {capital} asking for peace.'],
  [['Meet the organisers', { a: 2, grp: { students: 3, military: -2 } }], ['Ban the marches', { f: -3, grp: { students: -6, police: 2 } }]], { crowd: 'students' });
// ---- abroad and diplomacy
E('summitgift', 'Foreign', (n, c, ctx) => ctx.friend ? 0.004 : 0, 'Gift from {friend}', ['{friend} sent you a gift: a rare animal for the national zoo.', '{friend} sent your country a famous painting on loan.'],
  [['Send a lavish gift back', { $: 0.002, r: 5, friendSide: 1 }], ['Send a thank-you letter', { r: 1, friendSide: 1 }]], { needFriend: true });
E('diplomatgaffe', 'Foreign', (n, c, ctx) => ctx.friend ? 0.003 : 0, 'Diplomatic gaffe', ['Our ambassador called {friend}’s food "boring" on live TV.', 'Our foreign minister mixed up {friend} with its neighbour in a speech.'],
  [['Recall the ambassador and apologise', { r: 4, friendSide: 1, pc: -1 }], ['Make a joke about it', { r: -3, friendSide: 1, a: 1 }]], { needFriend: true });
E('exile', 'Foreign', (n, c, ctx) => ctx.rival ? 0.003 : 0, 'Dissident asks for asylum', ['A famous critic of the government of {rival} is at our airport asking for protection.'],
  [['Grant asylum', { r: -12, f: 2, abroad: 3 }], ['Send them back', { r: 8, f: -2, abroad: -4 }], ['Quietly fly them to a third country', { r: -3 }]], { needRival: true });
E('cheese', 'Foreign', (n, c, ctx) => ctx.friend ? 0.002 : 0, 'Food fight', ['{friend} claims our national dish was invented there. Social media is at war.'],
  [['Propose a joint cooking show', { r: 4, friendSide: 1, a: 1 }], ['Defend our honour', { r: -4, friendSide: 1, a: 2 }]], { needFriend: true });
E('airspace', 'Foreign', (n, c, ctx) => ctx.rival ? 0.006 : 0, 'Spy plane over our airspace', ['A military plane from {rival} crossed into our airspace for 30 seconds.'],
  [['Scramble jets and protest', { r: -6, grp: { military: 3 } }], ['Downplay it', { a: -1, grp: { military: -2 } }]], { needRival: true });
E('aidworkers', 'Foreign', () => 0.003, 'Aid workers praised', ['Our doctors abroad saved thousands of lives in a cholera outbreak. The UN thanks {country}.'],
  [['Expand the programme', { $: 0.02, x: 2, abroad: 3 }], ['Bring them home, we need them here', { a: 1 }]]);
E('summitphoto', 'Foreign', () => 0.003, 'The awkward handshake', ['Your handshake with another leader lasted 19 seconds. Experts are analysing it.'],
  [['Laugh about it', { a: 1 }], ['Say you won the handshake', { a: 1, grp: { military: 1 }, abroad: -1 }]]);
E('worldexpo', 'Foreign', (n) => n.dev > 0.4 ? 0.002 : 0, 'Host the World Expo?', ['{city} could host the next World Expo, with pavilions from every country.'],
  [['Bid for it', { $: 0.2, x: 3, g: 0.05, tour: 1 }], ['Too expensive', {}]]);
E('migrantboat', 'Foreign', (n, c) => !c.landlocked ? 0.005 : 0, 'Boat in distress', ['A small boat with 80 migrants is sinking off our coast near {city}.'],
  [['Rescue them all', { $: 0.001, abroad: 3, grp: { minorities: 2, workers: -1 } }], ['Rescue, then send them back', { abroad: -1 }], ['Not our problem', { abroad: -6, grp: { religious: -3 } }]]);
// ---- science, nature, culture
E('comet', 'Society', () => 0.0012, 'Comet visible tonight', ['A bright comet is visible over {country} for the first time in 300 years.'],
  [['Turn off city lights for an hour', { a: 2, grp: { green: 2 } }], ['Enjoy it', { a: 1 }]]);
E('eclipse', 'Society', () => 0.0012, 'Total solar eclipse', ['A total eclipse will cross {city}. Hotels are fully booked.'],
  [['Hand out free eclipse glasses', { $: 0.001, a: 1 }], ['Make it a holiday', { a: 2, g: -0.01 }]]);
E('dinosaur', 'Society', () => 0.0015, 'Dinosaur found', ['Farmers near {city} dug up an almost complete dinosaur skeleton.'],
  [['Build a museum', { $: 0.01, x: 2, tour: 1 }], ['Sell it to a foreign museum', { $: -0.01, grp: { students: -2 } }]]);
E('whale', 'Society', (n, c) => !c.landlocked ? 0.002 : 0, 'Whale in the harbour', ['A lost whale swam into the harbour of {city}. Thousands came to watch.'],
  [['Navy guides it back to sea', { a: 2, grp: { green: 3 } }], ['Leave it to nature', {}]]);
E('robotdog', 'Technology', (n) => n.dev > 0.5 ? 0.002 : 0, 'Robot police dogs', ['The police want robot dogs to patrol {city}.'],
  [['Try them in one city', { $: 0.005, t: 0.2, grp: { police: 2, youth: -2 } }], ['Too creepy', { grp: { youth: 2 } }]]);
E('aiart', 'Technology', (n) => n.dev > 0.5 ? 0.003 : 0.001, 'AI wins art prize', ['A painting made by an AI won the national art prize. Artists are furious.'],
  [['Ban AI from art prizes', { grp: { students: 2, business: -1 } }], ['Art is art', { grp: { youth: 2, students: -3 } }]]);
E('deepfake', 'Technology', () => 0.004, 'Deepfake of you', ['A fake video shows you saying you will cancel pensions. Millions believe it.', 'A fake video shows you dancing badly at a wedding. It is very convincing.'],
  [['Go on TV with the real facts', { a: 1, pc: -1 }], ['New law against deepfakes', { f: -1, grp: { media: -1, retirees: 2 } }], ['Ignore it', { a: -2 }]]);
E('gameboom', 'Technology', (n) => n.dev > 0.4 ? 0.002 : 0, 'Our game is a hit', ['A video game made in {city} sold ten million copies worldwide.'],
  [['Tax breaks for game studios', { $: 0.005, g: 0.03, grp: { youth: 3 } }], ['Congratulate them', { x: 1 }]]);
E('blackmarket', 'Economy', (n) => n.infl > 20 || G.sanctions.some(s => s.on === n.idx) ? 0.015 : 0, 'Black market boom', ['Everything from medicine to dollars is sold on the black market in {city}.'],
  [['Crack down', { s: 1, g: -0.05, grp: { police: 2, workers: -2 } }], ['Legalise and tax some of it', { $: -0.03, c: 0.01 }]]);
E('oilprice', 'Economy', (n) => n.res.includes('oil') ? 0.004 : 0, 'Oil workers want a share', ['Workers in the oil fields say the profits go to the capital, not to them.'],
  [['Share oil money with oil regions', { $: 0.05, s: 2, grp: { workers: 3 } }], ['Send the police', { s: -2, grp: { workers: -5 } }]]);
// ---- government dilemmas
E('budgethole', 'Politics', (n) => (n.budget || budgetOf(n)).deficit > 6 ? 0.012 : 0, 'A hole in the budget', ['The treasury found the deficit is bigger than reported. Somebody hid it.'],
  [['Publish the true numbers', { a: -2, y: -0.2, grp: { media: 3 } }], ['Fix it quietly next year', { scandalRisk: 0.3 }]]);
E('pensionprotest', 'Politics', (n) => n.groups && n.groups.retirees < 35 ? 0.015 : 0.002, 'Pensioners on the march', ['Thousands of pensioners with walking sticks blocked the main square of {capital}.'],
  [['Raise pensions', { $: 0.2, grp: { retirees: 7 } }], ['Explain the money is not there', { a: -2, grp: { retirees: -3 } }]], { crowd: 'retirees' });
E('businessstrike', 'Politics', (n) => n.groups && n.groups.business < 30 ? 0.012 : 0.001, 'Business leaders revolt', ['The biggest companies say they will stop investing until you change course.'],
  [['Meet them and promise stability', { pc: -2, grp: { business: 5, workers: -2 } }], ['Call it blackmail', { g: -0.1, grp: { workers: 3, business: -3 } }]]);
E('militarygrumble', 'Politics', (n) => n.groups && n.groups.military < 35 ? 0.012 : 0.001, 'Officers grumble', ['Junior officers are complaining in private chats that the government "does not respect the army".'],
  [['Pay rise for soldiers', { $: 0.05, grp: { military: 6 } }], ['Visit a base and listen', { pc: -1, grp: { military: 3 } }], ['Ignore it', { coup: 0.05 }]]);
E('greenvote', 'Politics', (n) => n.groups && n.groups.green < 35 ? 0.01 : 0.001, 'Greens threaten to leave the coalition', ['Environmental groups say they will campaign against you unless you act on climate.'],
  [['Announce a climate plan', { g: -0.05, grp: { green: 7, business: -2 } }], ['Say the economy comes first', { grp: { green: -4, business: 2 } }]]);
E('mediawar', 'Politics', (n) => n.groups && n.groups.media < 35 ? 0.012 : 0.002, 'War with the press', ['Every newspaper in the country attacked you on the same day.'],
  [['Give a long, open interview', { pc: -2, grp: { media: 5 } }], ['Start your own TV channel', { $: 0.01, f: -1, grp: { media: -3 } }], ['Call them enemies of the people', { f: -2, a: 1, grp: { media: -8, police: 1 } }]]);
