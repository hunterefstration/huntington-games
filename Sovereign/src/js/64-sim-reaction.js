// Public reaction to everything: each action moves every group, makes headlines and posts, fills streets, moves markets.
const OUTLETS = [
  { id: 'herald', name: 'The National Herald', lean: null },
  { id: 'biz', name: 'Business Times', lean: 'business' },
  { id: 'voice', name: "People's Voice", lean: 'workers' },
  { id: 'wire', name: 'World Wire', lean: 'abroad' }
];
const HEAD = {
  good: ['{t}: a win for the government', 'Cheers as {t}', '{t} - "about time", say supporters', 'Big day for the {c} leader: {t}'],
  bad: ['Anger grows over {t}', '{t} sparks fury', 'Critics slam {t}', '"A disaster": outrage as {t}'],
  mixed: ['{t} divides the nation', 'Winners and losers as {t}', '{t}: what it means for you', 'Mixed feelings after {t}']
};
const POST_TEXT = {
  workers: ['This helps working families. Finally! #{h}', 'Who pays for this? Us, as always. #{h}'], business: ['Good for jobs and investment. #{h}', 'Investors are nervous. This will cost jobs. #{h}'],
  farmers: ['Farmers will remember this. Thank you! #{h}', 'Nobody in the capital understands farming. #{h}'], retirees: ['At last someone thinks of us older folks. #{h}', 'Shameful. My pension buys less every month. #{h}'],
  youth: ['ok this is actually good 🔥 #{h}', 'they really don\'t care about our generation #{h}'], students: ['Students win today! #{h}', 'See you at the march tomorrow. #{h}'],
  women: ['A step forward. #{h}', 'We will not be silent. #{h}'], minorities: ['Feeling seen for once. #{h}', 'This hurts our communities. #{h}'],
  religious: ['Thankful for leaders with values. #{h}', 'A sad day for our faith and families. #{h}'], green: ['Good for the planet 🌍 #{h}', 'The planet can\'t wait. Shame! #{h}'],
  military: ['Strength and pride. #{h}', 'Our soldiers deserve better. #{h}'], police: ['Backing those who keep us safe. #{h}', 'Officers are angry. #{h}'],
  media: ['A good day for open debate. #{h}', 'This is an attack on the free press. #{h}'], elite: ['Sensible, finally. #{h}', 'Capital will leave the country. #{h}']
};
const FIRST = ['Sam', 'Alex', 'Jordan', 'Riya', 'Mo', 'Lina', 'Theo', 'Nia', 'Kai', 'Ari', 'Zoe', 'Ben', 'Ivy', 'Omar', 'Lea', 'Max'];
const tag = s => s.replace(/[^A-Za-z0-9]+/g, '').slice(0, 22);

function reactionPreview(n, stance, size) {
  const by = {}; let s = 0, w = 0;
  for (const gr of GROUPS) { const v = (stance[gr.id] || 0) * size * (1 + (n.polar || 30) / 100 * Math.abs(stance[gr.id] || 0) / 5); by[gr.id] = v; const sh = gr.share(n); s += v * sh; w += sh; }
  return { by, avg: s / w, angry: GROUPS.filter(g => by[g.id] <= -4).map(g => g.name), happy: GROUPS.filter(g => by[g.id] >= 4).map(g => g.name) };
}

// a: { title, stance:{group: -10..10}, size, mood (-1..1 for everyone), abroad, city, topic }
function react(n, a) {
  if (!n.groups) return null;
  const spin = n.spin || 0; n.spin = 0;
  const pre = reactionPreview(n, a.stance || {}, (a.size || 1) * (1 - spin * 0.5)), mood = (a.mood || 0) * (a.size || 1) * 2;
  const by = pre.by; let lo = 0, hi = 0;
  for (const gr of GROUPS) {
    const v = by[gr.id] + mood + (G.rng() - 0.5);
    by[gr.id] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
    n.gmem[gr.id] += v * 0.8; n.groups[gr.id] = clamp(n.groups[gr.id] + v * 0.35, 1, 99);
  }
  n.polar = clamp(n.polar + Math.min(hi, -lo) * 0.15, 5, 95); // when some cheer and others rage, society splits
  // markets react the same day
  const biz = by.business + by.elite * 0.5;
  n.stocks = (n.stocks || 100) * (1 + clamp(biz, -15, 15) * 0.004);
  if (n.mon.type === 'float') n.fx *= 1 + clamp(biz, -15, 15) * 0.0008;
  if (a.abroad) { n.view = clamp((n.view || 0) + a.abroad, -100, 100); if (typeof diploAbroad === 'function') diploAbroad(n, a.abroad); }
  // headlines and posts
  const c = World.countries[n.idx], title = a.title, avg = pre.avg + mood;
  const pick = arr => arr[Math.floor(G.rng() * arr.length)];
  const said = [];
  for (const o of OUTLETS) {
    const v = o.lean === 'abroad' ? (a.abroad || 0) * 2 + avg * 0.5 : o.lean ? by[o.lean] : avg;
    if (o.lean === 'abroad' && !a.abroad && (a.size || 1) < 1.5) continue;
    const kind = v > 2 ? 'good' : v < -2 ? 'bad' : 'mixed';
    said.push({ type: 'news', day: G.day, outlet: o.name, text: pick(HEAD[kind]).replace('{t}', title).replace('{c}', c.name), mood: Math.sign(Math.round(v / 2)) });
  }
  const loud = GROUPS.slice().sort((x, y) => Math.abs(by[y.id]) - Math.abs(by[x.id])).slice(0, 4).filter(g => Math.abs(by[g.id]) > 1.2);
  for (const g of loud) {
    const v = by[g.id], who = FIRST[Math.floor(G.rng() * FIRST.length)] + ' ' + g.icon;
    said.push({ type: 'post', day: G.day, author: who, group: g.name, text: POST_TEXT[g.id][v > 0 ? 0 : 1].replace('{h}', tag(a.topic || title)), likes: Math.round(Math.abs(v) * g.share(n) * 4e4 * (0.5 + G.rng())), mood: Math.sign(v) });
  }
  G.feed = (said.concat(G.feed || [])).slice(0, 120);
  // streets: angry or delighted groups gather
  const cap = World.cities.findIndex(x => x.c === n.idx && x.cap), city = a.city != null ? a.city : cap;
  for (const g of GROUPS) {
    const power = by[g.id] * Math.sqrt(g.share(n) * cloutOf(n, g.id)) * 3;
    if (power < -3 && (n.laws ? n.laws.protest > 0 : true)) addCrowd(n, city, 'protest', g, -power, title);
    else if (power > 4) addCrowd(n, city, 'rally', g, power, title);
  }
  Bus.emit('reaction', { title, by, said });
  return { by, avg };
}
function addCrowd(n, city, kind, g, power, why) {
  if (city < 0) return;
  n.crowds = n.crowds || [];
  const size = Math.round(clamp(power * 45, 40, 900));
  const ex = n.crowds.find(c => c.city === city && c.kind === kind);
  if (ex) { ex.size = Math.min(900, ex.size + size / 2); ex.until = G.day + 14; ex.group = g.name; ex.why = why; }
  else n.crowds.push({ city, kind, group: g.name, size, until: G.day + 10 + Math.floor(power * 2), why, seed: Math.floor(G.rng() * 1e9) });
  if (kind === 'protest' && size > 300) { n.evStab -= size / 300; newsLocal(n, (size > 600 ? 'Huge' : 'Big') + ' protest by ' + g.name.toLowerCase() + ' in ' + World.cities[city].name); }
  syncCrowds();
}
function newsLocal(n, text) { G.feed = [{ type: 'news', day: G.day, outlet: 'The National Herald', text, mood: -1 }].concat(G.feed || []).slice(0, 120); }
function syncCrowds() {
  if (!G) { Life.crowds = []; return; }
  const n = G.nations[G.player.idx];
  Globe.dirty = true;
  Life.crowds = (n.crowds || []).map(c => ({ city: World.cities[c.city], size: c.size, seed: c.seed, sign: c.kind === 'protest' ? [0.9, 0.15, 0.15] : [1, 0.85, 0.3], shirt: c.kind === 'protest' ? [0.45, 0.3, 0.3] : [0.3, 0.4, 0.6] }));
}
function reactionDay(n) {
  if (!n.crowds) return;
  const before = n.crowds.length;
  n.crowds = n.crowds.filter(c => c.until > G.day); for (const c of n.crowds) c.size = Math.max(30, c.size * 0.97);
  // unrest brings people out even without a trigger
  if (n.stability < 38 && G.rng() < (38 - n.stability) / 300) {
    const cities = World.cities.filter(x => x.c === n.idx), city = World.cities.indexOf(cities[Math.floor(G.rng() * Math.min(5, cities.length))]);
    const g = GROUPS.slice().sort((a, b) => n.groups[a.id] - n.groups[b.id])[0];
    addCrowd(n, city, 'protest', g, 2 + (38 - n.stability) / 6, 'the state of the country');
  }
  if (n.crowds.length !== before) syncCrowds();
  // everyday chatter about whatever hurts most
  if (G.rng() < 0.25) {
    const issues = [[n.infl - 4, 'prices', 'Everything costs so much now. #Prices'], [n.unemp - 6, 'jobs', 'Still looking for work. Anyone hiring? #Jobs'],
      [40 - n.stability, 'crime', 'Not safe out there anymore. #Safety'], [n.approval - 55, 'love', 'Say what you want, this government gets things done. #Proud'],
      [n.growth - 3, 'boom', 'Business is booming in my town! #Growth']].sort((a, b) => b[0] - a[0]);
    const [v, , text] = issues[0];
    G.feed = [{ type: 'post', day: G.day, author: FIRST[Math.floor(G.rng() * FIRST.length)], group: 'Citizen', text, likes: Math.round(200 + G.rng() * 5000), mood: v > 0 && issues[0][1] !== 'love' && issues[0][1] !== 'boom' ? -1 : 1 }].concat(G.feed || []).slice(0, 120);
  }
}
const Spin = {
  press() { return this.doSpin(4, 0.6, 0.1, 'Press conference'); },
  blame() { return this.doSpin(3, 0.4, 0.2, 'Blaming the opposition'); },
  bury() { return this.doSpin(2, 0.7, 0.25, 'Burying bad news on a holiday'); },
  doSpin(cost, power, risk, name) {
    const n = G.nations[G.player.idx]; if (n.pc < cost) return 'Not enough political capital.';
    n.pc -= cost;
    if (G.rng() < risk) { react(n, { title: name + ' backfires', stance: { media: -6 }, size: 1.2, mood: -0.6 }); Bus.emit('changed'); return name + ' backfired! The media saw through it.'; }
    n.spin = power; for (const g of GROUPS) n.gmem[g.id] += 1.5;
    Bus.emit('changed'); return name + ' went well. The next reaction will be softer.';
  }
};
