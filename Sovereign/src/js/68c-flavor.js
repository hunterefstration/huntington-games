// Flavour text: more ways to say things, so the world feels alive and less predictable.
function pickLine(list, cname, n) {
  const s = list[Math.floor(G.rng() * list.length)];
  return s.replace(/\{c\}/g, cname).replace(/\{leader\}/g, n ? n.leader : 'their leader').replace(/\{title\}/g, n ? n.title : 'Leader').replace(/\{cap\}/g, n ? (capitalOf(n.idx).name || 'the capital') : 'the capital');
}
const FOODS = { Africa: 'maize flour', Americas: 'tortillas and beans', Asia: 'rice', Europe: 'bread', Oceania: 'fish', Antarctic: 'tinned food' };

// ---- war
const SURRENDER_NEWS = [
  '{c} surrenders. Church bells ring as the guns fall silent.', 'White flags over {cap}: {c} gives up the fight.', '{c} signs an unconditional surrender in a railway carriage outside {cap}.',
  '"We cannot go on": {title} {leader} announces that {c} will lay down its arms.', '{c}’s army collapses. Soldiers walk home in their thousands.', 'Generals of {c} tell their leader the war is lost. A surrender follows within hours.'];
const SURRENDER_LINES = [
  'A short statement from {cap}: "To save our people from more suffering, {c} accepts defeat."', '{title} {leader} spoke for two minutes and looked at no one: {c} will stop fighting.',
  'The radio in {cap} played a sad song, then announced the surrender.', 'With its army scattered and its cities dark, {c} asks for terms.', 'Envoys from {c} crossed the front under a white flag, asking to end the war today.'];
const REFUSE_LINES = [
  '{title} {leader} tore up your letter on live television.', '"Never!" shouts {leader}. {c} will fight on.', 'The parliament of {c} voted unanimously to keep fighting.',
  '{c} says your terms are "an insult to every soldier who has died".', 'No reply came from {cap} at all. The guns keep firing.', '{c} laughed at your offer: "Come and take it."',
  'Diplomats from {c} walked out of the talks after ten minutes.', '{leader} answered with a single word: "No."'];
const PEACE_LINES = [
  '{c} wants a ceasefire on the current lines.', '"Enough blood," says {leader}. {c} proposes to stop where the armies stand.', '{c} sends a quiet message through Swiss diplomats: a ceasefire, now.',
  'Mothers of soldiers march in {cap}. {c} offers to talk peace.'];
const PEACE_SIGNED = ['Crowds dance in the streets.', 'Soldiers on both sides threw their helmets in the air.', 'The pens used to sign it will go in a museum.', 'Nobody cheered. Everyone was simply tired.', 'The guns went quiet at noon.'];
const CITY_FALLS = ['{city} falls after a long siege.', 'Enemy flags fly over {city}.', 'The last defenders of {city} retreat across the river.', 'Residents flee as {city} changes hands.', '{city} is taken. {c} vows to win it back.'];

// ---- more headlines
HEAD.good.push('Polls soar after {t}', '"Finally, a leader who listens": {t}', 'Markets and voters cheer {t}', 'Hope returns as {t}', '{t}: the best week for the government in months',
  'Street parties as {t}', 'Analysts call {t} "a masterstroke"', '{t} wins praise from friend and foe', 'Taxi drivers approve: {t}', 'History in the making: {t}');
HEAD.bad.push('Furious crowds after {t}', '{t}: "the worst decision in a generation"', 'Resignations rumoured over {t}', 'Shock and anger: {t}', 'Even allies turn on government after {t}',
  'Pitchforks out: {t}', 'Opposition smells blood after {t}', '"Out of touch": {t}', 'Talk-radio meltdown over {t}', '{t}: grandmothers in tears, bankers in panic');
HEAD.mixed.push('{t}: who wins, who loses', 'The country argues about {t}', '{t}: experts are split', 'Cautious welcome for {t}', 'Five questions about {t}', 'Is {t} a gamble?',
  'Families at the kitchen table discuss {t}', '{t}: the fine print', 'Nobody is sure what {t} means yet', 'A big week in politics: {t}');

// ---- more social posts (first list: they like it, second: they hate it)
const MORE_POSTS = {
  workers: [['Overtime finally means something again #{h}', 'My union rep is crying happy tears #{h}', 'A decent day for decent work. #{h}'], ['They’ll find a way to make us pay for it. #{h}', 'Another win for the bosses. #{h}', 'Ask the night shift what they think of #{h}']],
  business: [['Order books are filling up. #{h}', 'Hiring 50 people this month thanks to #{h}', 'Finally some stability for investors. #{h}'], ['Moving our factory abroad. Thanks for nothing. #{h}', 'Red tape, red ink. #{h}', 'Investors read the news and left the room. #{h}']],
  farmers: [['The tractors can rest easy tonight. #{h}', 'Good news for the harvest. #{h}'], ['City people decided again what’s best for farms. #{h}', 'My cows are more organised than this government. #{h}']],
  retirees: [['My grandchildren explained it to me and I approve. #{h}', 'Fifty years of paying taxes and finally something. #{h}'], ['In my day leaders had manners. #{h}', 'My pension buys half a cabbage now. #{h}']],
  youth: [['no way this actually happened W #{h}', 'ok i’m voting next time fr #{h}', 'this is lowkey huge #{h}'], ['boomers did this #{h}', 'we can’t afford rent and they do THIS? #{h}', 'ratio + you fell off #{h}']],
  students: [['Study group cancelled, we’re celebrating. #{h}', 'Our professors are cheering too. #{h}'], ['Read the research. Nobody did. #{h}', 'Sit-in at the library at noon. #{h}']],
  women: [['Progress, slowly, but progress. #{h}', 'Our daughters will remember this. #{h}'], ['Nobody asked us. Again. #{h}', 'Fifty percent of the country, zero percent of the room. #{h}']],
  minorities: [['Our community is celebrating tonight. #{h}', 'Being heard feels strange. And good. #{h}'], ['Same story, different year. #{h}', 'They only remember us before elections. #{h}']],
  religious: [['A blessing for our families. #{h}', 'Prayers answered. #{h}'], ['We will pray for our leaders. They need it. #{h}', 'A nation that forgets its values loses its way. #{h}']],
  green: [['The trees say thank you 🌳 #{h}', 'A win for the planet and my anxiety. #{h}'], ['Somewhere a glacier just melted out of spite. #{h}', 'Greenwashing, as usual. #{h}']],
  military: [['The troops stand taller today. #{h}', 'Respect for those who serve. #{h}'], ['Our equipment is older than our recruits. #{h}', 'Politicians never served a day. #{h}']],
  police: [['Backup is finally on the way. #{h}', 'Good day on the beat. #{h}'], ['Try doing our job for one night. #{h}', 'Morale at the station is at rock bottom. #{h}']],
  media: [['A good day for the truth. #{h}', 'Front page tomorrow. #{h}'], ['Our sources say it’s worse than it looks. #{h}', 'Press freedom is not a favour. #{h}']],
  elite: [['A sensible move. Champagne at the club. #{h}', 'Confidence restored. #{h}'], ['My accountant called it "a disaster". #{h}', 'Moving the yacht to a friendlier harbour. #{h}']]
};
for (const g in MORE_POSTS) { const cur = POST_TEXT[g]; POST_TEXT[g] = [[].concat(cur[0], MORE_POSTS[g][0]), [].concat(cur[1], MORE_POSTS[g][1])]; }

// ---- everyday chatter, by what hurts most
const CHATTER = {
  prices: ['Everything costs so much now. #Prices', 'A coffee costs what lunch used to. #Prices', 'Paid for groceries with my savings today. #Inflation', 'My landlord raised the rent AGAIN. #Rent',
    'Filling the car is a luxury now. #Fuel', 'Kids asked why we stopped buying fruit. #CostOfLiving', 'Old lady at the shop put back the butter. Broke my heart. #Prices'],
  jobs: ['Still looking for work. Anyone hiring? #Jobs', '200 applications, 2 replies. #Jobs', 'Factory in my town closed. Whole street is quiet now. #Jobs', 'Degree, two languages, still unemployed. #Youth',
    'Started a food truck since nobody would hire me. #Hustle', 'Job fair had 30 jobs and 3,000 people. #Unemployment'],
  crime: ['Not safe out there anymore. #Safety', 'Third car stolen on our street this month. #Crime', 'Walked my daughter home from school. Never used to. #Safety', 'Shop owners chipping in for a guard. #Crime'],
  love: ['Say what you want, this government gets things done. #Proud', 'First time in years I feel hopeful. #Proud', 'The new bridge in our town is beautiful. #Progress', 'Our country is on the up. Feels good. #Pride',
    'Took my parents out for dinner. We could afford it! #Good', 'Tourists keep asking for directions. We must be doing something right. #Proud'],
  boom: ['Business is booming in my town! #Growth', 'Hired three people this week. #SmallBusiness', 'New café on every corner. #Boom', 'My cousin came home from abroad, says there’s work here now. #Growth',
    'Cranes everywhere downtown. #Building']
};

// ---- the wider world: odd, ordinary and remarkable things in other countries
const WORLD_FLAVOR = [
  '{c} wins a regional song contest with a ballad about a goat.', 'A heatwave in {c} melts a famous ice sculpture festival.', 'Scientists in {c} discover a new species of frog.', '{c} breaks the world record for the longest pizza.',
  'Floods close schools across {c}.', '{c}’s national team qualifies for the World Cup for the first time.', 'A royal baby is born in {c}.', 'Taxi drivers strike in {cap}, {c}.',
  'Archaeologists in {c} find a 3,000 year old shipwreck.', '{title} {leader} of {c} falls asleep during a summit. The internet notices.', 'Tourism in {c} hits a record high.',
  'Students in {c} protest against exam changes.', 'A bank in {c} loses customer data in a cyber attack.', 'Locusts sweep across farmland in {c}.', '{c} opens its longest ever bridge.',
  'A meteor lights up the sky over {cap}.', 'Fishermen in {c} catch a giant squid.', '{c} announces a four-day work week trial.', 'A famous chef from {c} opens a restaurant on a train.',
  'Elections in {c}: turnout is the highest in decades.', 'A political scandal shakes {cap}.', '{c} bans plastic bags.', 'A volcano rumbles in {c}. Villages are on alert.',
  'Power cuts in {c} last for 12 hours.', '{c} celebrates 100 years of its national airline.', 'A pop star from {c} tops charts worldwide.', '{c} launches its first satellite.',
  'Inflation in {c} hits a five-year high.', 'Doctors in {c} perform a world-first operation.', '{c} plants a million trees in one day.', 'A cyclone churns toward {c}.',
  'Diplomats from {c} walk out of a UN meeting.', 'Protesters in {cap} demand cheaper bread.', '{c}’s parliament holds an all-night debate.', 'A cat becomes mayor of a small town in {c}.',
  '{c} discovers natural gas off its coast.', 'An earthquake shakes {cap}. No one is hurt.', '{c} hosts a summit on climate change.', 'Teachers in {c} win a pay rise after a long strike.',
  'Record snowfall buries roads in {c}.', '{c} opens a giant solar farm in the desert.', 'Chess prodigy from {c}, aged 12, beats a grandmaster.'];
MONTHLY.push(() => {
  const k = G.rng() < 0.6 ? 1 : 2;
  for (let i = 0; i < k; i++) { const m = G.nations[1 + Math.floor(G.rng() * (G.nations.length - 1))]; if (m && m.idx !== G.player.idx) newsWorld(pickLine(WORLD_FLAVOR, World.countries[m.idx].name, m)); }
});
// a line of colour for the monthly report
function monthFlavor(n) {
  const c = World.countries[n.idx], cap = capitalOf(n.idx).name, lines = [];
  if (n.infl > 8) lines.push('Shoppers in ' + cap + ' compare prices like detectives.', 'Market traders change their price tags every week.');
  if (n.unemp > 9) lines.push('Job centres in ' + cap + ' have queues around the block.', 'Young people talk about leaving ' + c.name + ' for work abroad.');
  if (n.growth > 4) lines.push('New shops open faster than old ones close.', 'Builders cannot find enough workers.');
  if (n.growth < 0) lines.push('"For rent" signs are everywhere in ' + cap + '.', 'Restaurants are half empty on a Saturday night.');
  if (n.approval > 60) lines.push('Your face is on mugs and T-shirts in the souvenir shops.', 'People wave at your motorcade.');
  if (n.approval < 30) lines.push('Comedians on late-night TV have a new favourite target: you.', 'Your posters keep getting moustaches drawn on them.');
  if (n.stability < 35) lines.push('Shopkeepers board up their windows at night.', 'The army quietly guards the TV station.');
  if (n.atWar) lines.push('Families gather around radios for news from the front.', 'Every town has a new list of names on its memorial.');
  if (!lines.length) lines.push('Life goes on: football on Saturday, family lunch on Sunday.', 'A quiet month. Commuters complain about the trains as usual.', 'The weather is the main topic in the cafés.', 'Kids play in the parks of ' + cap + ' until it gets dark.');
  return lines[Math.floor(G.rng() * lines.length)];
}
// leaders' replies in diplomacy
const DIP_YES = ['"A historic day for our two nations," says {leader}.', '{leader} smiles for the cameras: "Friends help friends."', '"Let us shake hands on it," says {title} {leader}.', '{leader}: "My people will thank you."'];
const DIP_NO = ['{leader}: "Not now, and perhaps not ever."', '"We have other plans," says {c}.', '{title} {leader} did not even read the proposal.', '{c} says the timing is "very wrong".', '"Ask me again when you mean it," says {leader}.', '{leader} laughed and changed the subject.'];
