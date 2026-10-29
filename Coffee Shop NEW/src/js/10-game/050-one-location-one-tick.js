// ----- one location, one tick -----
function simLoc(loc, idx) {
  loc.tickCount++;
  const vis = (idx === cur);
  // brewing
  const power = evm('power', loc, 1);
  for (const key in loc.activeBrews) {
    const b = loc.activeBrews[key];
    b.ticks -= power;
    if (b.ticks <= 0) {
      const t = Math.max(0, BEANS.indexOf(b.type));
      loc.inventory[COFFEE[t]] += b.x2 ? 2 : 1;
      if (b.art && loc.art.length < artCap()) loc.art.push({ q: 0.5, m: 1 });
      delete loc.activeBrews[key];
      if (vis) {
        const [bx, by] = key.split(',').map(Number);
        fxText(bx * TS + 16, by * TS - 2, b.x2 ? '+2 coffee! Double shot' : '+1 coffee', '#4ade80', 11);
        fxSteam(bx * TS + 16, by * TS + 6, 5);
        Snd.play('ready');
      }
      rt.dirtyUI = true;
    }
  }
  // spawn
  const cc = C(loc);
  if (cc.doors.length && cc.reachCount && loc.customers.length < 6 + cc.counters.length * 3) {
    if (Math.random() < spawnChance(loc)) spawnCustomer(loc);
  }
  customersTick(loc, idx);
  staffTick(loc, idx);
}

// ----- events -----
// m = modifiers while the event runs (see evm): spawn, price, wait, brew, power, tip, tourist, influencer, iced, supply, critic.
// Events with choices pause the game and ask the player what to do; each choice has a cost and consequences.
const EVENTS = {
  rush: {
    name: 'Rush Hour!', desc: 'Customers are pouring in. How do you handle it?', dur: 250, icon: 'bolt', w: 30, cls: 'good',
    choices: [
      { n: 'Call in extra help', d: 'Staff brew 35% faster and customers stay 15% more patient.', cost: 60, perShop: true, m: { spawn: 2.2, brew: 0.65, wait: 1.15 } },
      { n: 'Surge pricing', d: 'Everything sells for 30% more, but customers are 25% less patient.', m: { spawn: 2.2, price: 1.3, wait: 0.75 } },
      { n: 'Ride it out', d: 'Twice the customers, no changes. Keep the coffee flowing!', m: { spawn: 2.2 } }
    ]
  },
  sale: { name: 'Bean Sale!', desc: 'All supplies are 40% off. Stock up!', dur: 400, icon: 'tag', w: 22, cls: 'good', m: { supply: 0.6 } },
  festival: {
    name: 'Local Festival', desc: 'A street festival is in town. Tourists everywhere, and they tip big!', dur: 300, icon: 'star', w: 18, cls: 'gold',
    choices: [
      { n: 'Run a festival stall', d: '90% more customers and +30% tip chance.', cost: 250, m: { spawn: 1.9, tourist: 4, tip: 0.3 } },
      { n: 'Sponsor the festival', d: '+25 reputation right now and 60% more customers.', cost: 500, rep: 25, m: { spawn: 1.6, tourist: 4, tip: 0.2 } },
      { n: 'Business as usual', d: '50% more customers and better tips.', m: { spawn: 1.5, tourist: 4, tip: 0.2 } }
    ]
  },
  critic: {
    name: 'Food Critic Visit', desc: 'A famous food critic is coming to {shop}. They want Premium or Luxury coffee.', dur: 300, icon: 'eye', w: 18, cls: '', shop: 'critic',
    need: () => state.stats.earned >= 500,
    choices: [
      { n: 'Roll out the red carpet', d: 'The critic waits twice as long and a good review pays 50% more. Serve them yourself.', cost: 150, m: { critic: 'vip' } },
      { n: 'Let a cashier handle it', d: 'Your cashier serves the critic. Success chance depends on the shop rating ({odds}%).', m: { critic: 'staff' },
        req: p => (state.locations[p.shop] && state.locations[p.shop].staff.some(s => s.role === 'cashier')) ? '' : 'No cashier there' },
      { n: 'I will serve them myself', d: 'Click the counter yourself when the critic is waiting.', m: {} }
    ]
  },
  outage: {
    name: 'Power Outage', desc: 'The power just went out at {shop}! The brewers stopped.', dur: 220, icon: 'plug', w: 14, cls: '', shop: 'any',
    choices: [
      { n: 'Rent a generator', d: 'The brewers keep running at half speed.', cost: 150, m: { power: 0.5 } },
      { n: 'Hand out free cookies', d: 'No brewing, but customers there stay 80% more patient. +10 reputation.', cost: 40, rep: 10, m: { power: 0, wait: 1.8 } },
      { n: 'Wait it out', d: 'No brewing until the power is back. Sell what you already made.', m: { power: 0 } }
    ]
  },
  viral: {
    name: 'Viral Post!', desc: 'A photo of your coffee is going viral online!', dur: 300, icon: 'phone', w: 14, cls: 'gold',
    choices: [
      { n: 'Launch a hashtag promo', d: 'Prices 15% lower, but 2.6x customers and +15 reputation.', rep: 15, m: { spawn: 2.6, price: 0.85 } },
      { n: 'Team up with the influencer', d: '+30 reputation, 2.1x customers and lots of Influencers.', cost: 400, rep: 30, m: { spawn: 2.1, influencer: 2 } },
      { n: 'Just enjoy it', d: '1.7x customers for a while.', m: { spawn: 1.7 } }
    ]
  },
  badpost: {
    name: 'Bad Review Online', desc: 'Someone posted a grumpy review of your coffee and it is spreading fast.', dur: 260, icon: 'warn', w: 9, cls: '',
    need: () => state.stats.served >= 60,
    choices: [
      { n: 'Apologize with free coffee', d: '+20 reputation and customers come back as normal.', cost: 150, rep: 20, m: { spawn: 1.1 } },
      { n: 'Post a funny reply', d: 'A gamble: 50% it goes viral (+20 reputation, more customers), 50% it backfires (-20 reputation).', gamble: true },
      { n: 'Ignore it', d: '-10 reputation and 40% fewer customers for a while.', rep: -10, m: { spawn: 0.6 } }
    ]
  },
  heat: {
    name: 'Heat Wave', desc: 'It is scorching outside! Everyone wants something iced and patience is short.', dur: 300, icon: 'sun', w: 10, cls: 'gold',
    choices: [
      { n: 'Buy ice for every shop', d: '+30 Ice in every shop (for iced specials) and 15% more customers.', cost: 25, perShop: true, give: { ice: 30 }, m: { wait: 0.85, iced: 1, spawn: 1.15 } },
      { n: 'Free water for everyone', d: '+10 reputation and customers stay patient.', cost: 30, rep: 10, m: { iced: 1 } },
      { n: 'Stay cool', d: 'Customers are 15% less patient.', m: { wait: 0.85, iced: 1 } }
    ]
  },
  inspect: {
    name: 'Health Inspection', desc: 'A health inspector is checking all your shops today.', dur: 0, icon: 'check', w: 8, cls: '', instant: true,
    need: () => state.stats.served >= 40,
    choices: [
      { n: 'Deep clean everything', d: 'Guaranteed to pass, +15 reputation.', cost: 60, perShop: true, rep: 15 },
      { n: 'Hope for the best', d: 'Pass chance {pass}% (better with a high shop rating). Pass: +10 reputation. Fail: -20 reputation and a fine.', gamble: true }
    ]
  }
};
function operating() { return state.locations.some(l => { const c = C(l); return c.doors.length && c.reachCount && c.brewers.length; }); }
function avgRating() { let s = 0; state.locations.forEach(l => { s += rating(l); }); return s / state.locations.length; }
function inspectOdds() { return Math.round(clamp(0.25 + avgRating() * 0.15, 0.3, 0.95) * 100); }
function criticOdds() {
  const p = state.pendingEv || state.event, l = p && p.shop >= 0 ? state.locations[p.shop] : curLoc();
  return Math.round(clamp(0.35 + 0.13 * (rating(l) - 1), 0.3, 0.97) * 100);
}
function choiceCost(ch) { return ch.cost ? ch.cost * (ch.perShop ? state.locations.length : 1) : 0; }
function evText(t, p) {
  const sh = p && p.shop >= 0 && state.locations[p.shop] ? locName(state.locations[p.shop], p.shop) : 'your shop';
  return t.replace('{shop}', sh).replace('{odds}', criticOdds()).replace('{pass}', inspectOdds());
}
// Something happens: choice events wait for the player (dialog), the rest start right away.
function triggerEvent(type) {
  const E = EVENTS[type];
  if (!E) return false;
  let shop = -1;
  if (E.shop) {
    const ok = [];
    state.locations.forEach((l, i) => {
      const c = C(l);
      if (!c.reachCount || !c.doors.length) return;
      if (E.shop === 'critic' && l.customers.some(x => x.kind === 'critic')) return;
      if (E.shop === 'any' && !c.brewers.length) return;
      ok.push(i);
    });
    if (!ok.length) return false;
    shop = pick(ok);
  }
  if (E.choices) {
    state.pendingEv = { type: type, shop: shop };
    Snd.play('event');
    log(E.name + ' ' + evText(E.desc, state.pendingEv), 'event');
    rt.dirtyUI = true;
    return true;
  }
  beginEvent(type, -1, shop);
  return true;
}
function beginEvent(type, opt, shop) {
  const E = EVENTS[type], ch = opt >= 0 ? E.choices[opt] : null;
  const ev = { type: type, left: E.dur, total: E.dur, opt: opt, shop: shop, m: (ch && ch.m) || E.m || {}, label: ch ? ch.n : '' };
  state.event = ev;
  if (type === 'critic') { ev.spawned = false; spawnEventCritic(ev); }
  else if (!ch) toast(E.name + ' ' + evText(E.desc, ev), 'event', E.icon);
  if (!ch) { log(E.name + ' ' + evText(E.desc, ev), 'event'); Snd.play('event'); }
  rt.dirtyUI = true;
}
function spawnEventCritic(ev) {
  const loc = state.locations[ev.shop];
  if (!loc || !spawnCustomer(loc, 'critic')) return false;
  ev.spawned = true;
  toast('The food critic arrived at ' + locName(loc, ev.shop) + (ev.m.critic === 'staff' ? '. Your cashier will handle it.' : '! Serve them Premium or Luxury coffee yourself.'), 'event', 'eye');
  return true;
}
// The player picked an option (or closed the dialog: then the last, free option is used).
function resolveEvent(i, auto) {
  const p = state.pendingEv;
  if (!p) return false;
  const E = EVENTS[p.type], ch = E.choices[i];
  if (!ch) return false;
  const cost = choiceCost(ch), why = ch.req ? ch.req(p) : '';
  if (why) { toast(why + '.', 'bad', 'warn'); Snd.play('error'); return false; }
  if (cost > state.globalMoney) { toast('You need ' + money(cost) + ' for that.', 'bad', 'coin'); Snd.play('error'); return false; }
  state.pendingEv = null;
  if (cost) { state.globalMoney -= cost; state.stats.spent += cost; }
  if (!auto) state.stats.choices++;
  let rep = ch.rep || 0, m = ch.m, msg = E.name + ': ' + ch.n + '.';
  if (ch.give) state.locations.forEach(l => { for (const k in ch.give) l.inventory[k] = (l.inventory[k] || 0) + ch.give[k]; });
  if (p.type === 'badpost' && ch.gamble) {
    if (Math.random() < 0.5) { rep = 20; m = { spawn: 1.5 }; msg = 'Your funny reply went viral! +20 reputation.'; }
    else { rep = -20; m = { spawn: 0.7 }; msg = 'Your reply backfired... -20 reputation.'; }
  }
  if (p.type === 'inspect') {
    if (ch.gamble) {
      if (Math.random() * 100 < inspectOdds()) { rep = 10; msg = 'You passed the inspection! +10 reputation.'; }
      else {
        const fine = Math.min(Math.floor(state.globalMoney), 100 * state.locations.length);
        state.globalMoney -= fine; state.stats.spent += fine; rep = -20;
        msg = 'You failed the inspection: -20 reputation and a ' + money(fine) + ' fine.';
      }
    } else msg = 'Spotless! You passed with flying colors. +15 reputation.';
  }
  if (rep) modifyReputation(rep);
  toast(msg, rep < 0 ? 'bad' : 'event', EVENTS[p.type].icon);
  log(msg.indexOf(E.name) === 0 ? msg : E.name + ': ' + msg, rep < 0 ? 'bad' : 'event');
  if (E.instant) {
    state.stats.events++;
    state.nextEvent = state.tick + 900 + Math.floor(Math.random() * 900);
  } else {
    beginEvent(p.type, i, p.shop);
    if (m !== ch.m) state.event.m = m;
  }
  Snd.play(rep < 0 ? 'angry' : 'upgrade');
  rt.dirtyUI = true;
  requestSave();
  return true;
}
function updateEvent() {
  const ev = state.event;
  if (ev) {
    ev.left--;
    if (ev.type === 'critic') {
      if (!ev.spawned) { if (state.tick % 5 === 0) spawnEventCritic(ev); }
      else if (ev.left > 1 && !state.locations.some(l => l.customers.some(c => c.kind === 'critic'))) ev.left = 1;   // critic has left
    }
    if (ev.left <= 0) {
      state.stats.events++;
      if (ev.type === 'critic' && !ev.spawned) {
        const back = choiceCost(EVENTS.critic.choices[ev.opt] || {});
        if (back) { state.globalMoney += back; log('The critic never made it, so the red carpet money (' + money(back) + ') was refunded.', ''); }
      }
      log(EVENTS[ev.type].name + ' is over.' + (ev.type === 'outage' ? ' The power is back on.' : ''), '');
      state.event = null;
      state.nextEvent = state.tick + 900 + Math.floor(Math.random() * 900);
      rt.dirtyUI = true;
    }
    return;
  }
  if (state.pendingEv) return;
  if (state.tutorial !== -1 || state.stats.served < 10 || state.tick < state.nextEvent) return;
  if (!operating()) { state.nextEvent = state.tick + 100; return; }
  const types = Object.keys(EVENTS).filter(t => !EVENTS[t].need || EVENTS[t].need());
  let sum = 0; types.forEach(t => { sum += EVENTS[t].w; });
  let r = Math.random() * sum, chosen = types[0];
  for (let i = 0; i < types.length; i++) { r -= EVENTS[types[i]].w; if (r <= 0) { chosen = types[i]; break; } }
  if (!triggerEvent(chosen)) state.nextEvent = state.tick + 150;
}

// ----- career: a story in chapters. Each chapter has 3 objectives and a reward you claim in the Career window. -----
const CAREER = [
  { id: 'cart', n: 'A Cart and a Dream', who: 'rosa',
    intro: 'Grandma Rosa hands you the keys to her little coffee shop. "Make people smile, one cup at a time," she says. "Show me you can run it!"',
    outro: '"Look at all those happy faces!" Rosa beams. "You are a natural."',
    obj: [{ d: 'Serve 15 customers', m: () => state.stats.served, t: 15 }, { d: 'Hire a Barista', m: () => staffCount('barista'), t: 1 }, { d: 'Earn $300 in total', m: () => state.stats.earned, t: 300 }], r: 250 },
  { id: 'cafe', n: 'The Corner Cafe', who: 'rosa',
    intro: 'Word is spreading! Rosa thinks you are ready for a real menu. "And learn some latte art," she winks. "People love a heart in their cup."',
    outro: '"A heart in every cup!" Rosa claps. "Now the whole town will talk about you."',
    obj: [{ d: 'Reach the Corner Cafe rank', m: () => rankIdx(), t: 1 }, { d: 'Discover a recipe in the Recipe Lab', m: () => recipesKnown(), t: 1 }, { d: 'Pour a latte art that scores 60 or more', m: () => state.stats.artBest, t: 60, latte: true }], r: 600, rep: 10 },
  { id: 'rival', n: 'A Rival Appears', who: 'victor',
    intro: 'A shiny MegaBucks Coffee just opened across the street. Its owner, Victor Vane, smirks: "Cute little cafe. It will be mine by summer." Show him what cozy really means!',
    outro: 'Victor walks past your packed tables and frowns. "Lucky week," he mutters.',
    obj: [{ d: 'Get a shop to a 3.0 star rating', m: () => bestRating(), t: 3 }, { d: 'Place 8 decorations', m: () => decorCount(), t: 8 }, { d: 'Put 3 specials on one menu', m: () => maxMenu(), t: 3 }], r: 1500, rep: 15 },
  { id: 'road', n: 'Road Trip', who: 'rosa',
    intro: '"Victor is opening shops all over the map," Rosa warns. "Do not let him take every town. Go beyond Maple Grove!"',
    outro: 'Your coffee is now a road trip tradition. Rosa pins a new city on her old map.',
    obj: [{ d: 'Do business in 2 cities', m: () => cityCount(), t: 2 }, { d: 'Get a staff member to level 5', m: () => maxStaffLv(), t: 5 }, { d: 'Serve 30 customers their favorite special', m: () => state.stats.favs, t: 30 }], r: 3000 },
  { id: 'champ1', n: 'The Barista Championship', who: 'victor',
    intro: 'The Regional Barista Championship is in town. "My barista Bianca never loses," Victor brags. Rosa just smiles: "Practice your pours, dear."',
    outro: 'You lift the regional trophy! Victor storms out. Rosa wipes away a happy tear.',
    obj: [{ d: 'Get a shop to a 4.0 star rating', m: () => bestRating(), t: 4 }, { d: 'Know 6 recipes', m: () => recipesKnown(), t: 6 }, { d: 'Win the Regional Barista Championship', m: () => champWon('regional'), t: 1, champ: 'regional' }], r: 5000, rep: 20 },
  { id: 'seasons', n: 'Seasons of Change', who: 'rosa',
    intro: '"A great cafe changes with the seasons," says Rosa. "Celebrate the holidays with your town and try every seasonal treat."',
    outro: 'The whole town celebrates at your cafes now. Victor was not invited.',
    obj: [{ d: 'Serve 40 customers on holidays', m: () => state.stats.holServed, t: 40 }, { d: 'Discover a seasonal recipe', m: () => seasonalKnown(), t: 1 }, { d: 'Open a franchise outlet', m: () => state.franchises.length, t: 1 }], r: 12000, rep: 20 },
  { id: 'empire', n: 'Coffee Empire', who: 'victor',
    intro: 'MegaBucks is losing customers to you. Victor is desperate: he hired the famous Marco Rossi for the National Championship.',
    outro: 'National champion! MegaBucks closes half its shops. Victor sends a very grumpy "congrats".',
    obj: [{ d: 'Do business in 4 cities', m: () => cityCount(), t: 4 }, { d: 'Own 4 shops', m: () => state.locations.length, t: 4 }, { d: 'Win the National Barista Championship', m: () => champWon('national'), t: 1, champ: 'national' }], r: 30000, rep: 30 },
  { id: 'legend', n: 'Legend of the Bean', who: 'rosa',
    intro: 'One last stage: the World Barista Championship. Victor will compete himself! Rosa hands you her old milk pitcher. "For luck."',
    outro: 'World champion! Victor shakes your hand: "Your coffee is better. There, I said it." Rosa hugs you. THE END - but your empire keeps growing!',
    obj: [{ d: 'Get a shop to a 4.8 star rating', m: () => bestRating(), t: 4.8 }, { d: 'Earn $250,000 in total', m: () => state.stats.earned, t: 250000 }, { d: 'Win the World Barista Championship', m: () => champWon('world'), t: 1, champ: 'world' }], r: 80000, rep: 50 }
];
CAREER.forEach(c => c.obj.forEach(o => { if (/star rating/.test(o.d)) o.f = 'r'; else if (/^Earn /.test(o.d)) o.f = '$'; }));
const PEOPLE = {
  rosa: { n: 'Grandma Rosa', col: '#f59e0b', ini: 'R' },
  victor: { n: 'Victor Vane, MegaBucks Coffee', col: '#7c3aed', ini: 'V' }
};
// Barista championships: 3 latte art rounds against a rival. ch = story chapter that opens it, rank = Free Play requirement.
const CHAMPS = [
  { id: 'regional', n: 'Regional Barista Championship', ch: 4, rank: 3, fee: 300, prize: 3000, rep: 20, rival: 'Bianca of MegaBucks', base: 56, pats: ['heart', 'tulip', 'rosetta'], tol: 1 },
  { id: 'national', n: 'National Barista Championship', ch: 6, rank: 5, fee: 2500, prize: 15000, rep: 35, rival: 'Marco Rossi', base: 64, pats: ['tulip', 'rosetta', 'swan'], tol: 0.92 },
  { id: 'world', n: 'World Barista Championship', ch: 7, rank: 6, fee: 10000, prize: 60000, rep: 60, rival: 'Victor Vane', base: 72, pats: ['rosetta', 'swan', 'swan'], tol: 0.85 }
];
const CHAMP_BY_ID = {}; CHAMPS.forEach(c => { CHAMP_BY_ID[c.id] = c; });
function careerOn() { return state.mode === 'career'; }
function chapter() { return careerOn() && state.career.ch < CAREER.length ? CAREER[state.career.ch] : null; }
function objGot(i) { return !!(state.career.got && state.career.got[i]); }
function chapterReady(c) { c = c || chapter(); if (!c) return false; for (let i = 0; i < c.obj.length; i++) if (!objGot(i)) return false; return true; }
function champWon(id) { return state.champs[id] && state.champs[id].won ? 1 : 0; }
function champOpen(c) { return champWon(c.id) || (careerOn() ? state.career.ch >= c.ch : rankIdx() >= c.rank); }
function champLockText(c) { return careerOn() ? 'Opens in story chapter ' + (c.ch + 1) : 'Reach rank ' + RANKS[c.rank].n; }
function champRested(c) { const r = state.champs[c.id]; return !!(r && r.won && r.day === dayIdx()); }     // a title can be defended once per game day
// Called every game second: objectives tick off once reached (they stay done even if a number drops later).
function careerCheck() {
  const c = chapter();
  if (!c) return;
  const got = state.career.got || (state.career.got = []);
  for (let i = 0; i < c.obj.length; i++) {
    if (got[i] || c.obj[i].m() < c.obj[i].t) continue;
    got[i] = true;
    log('Story objective done: ' + c.obj[i].d + '.', 'good');
    if (!chapterReady(c)) toast('Objective done: ' + c.obj[i].d + '!', 'info', 'flag');
    rt.dirtyUI = true;
  }
  if (chapterReady(c) && !state.career.ready) {
    state.career.ready = true;
    toast('Chapter ' + (state.career.ch + 1) + ' complete! Open Career (K) to claim ' + money(c.r) + '.', 'goal', 'flag');
    log('Chapter ' + (state.career.ch + 1) + ' (' + c.n + ') complete! Claim the reward in the Career window.', 'good');
    Snd.play('goal');
  }
}
function claimChapter() {
  const c = chapter();
  if (!c || !chapterReady(c)) return;
  state.globalMoney += c.r;
  if (c.rep) modifyReputation(c.rep);
  rt.careerJust = { n: c.n, outro: c.outro, r: c.r, rep: c.rep || 0, who: c.who, num: state.career.ch + 1 };
  state.career.ch++; state.career.got = []; state.career.ready = false; state.career.seen = state.career.ch;
  log('Chapter ' + rt.careerJust.num + ' complete: ' + c.n + '. ' + c.outro + ' (+' + money(c.r) + ')', 'good');
  toast(state.career.ch >= CAREER.length ? 'You finished the story! +' + money(c.r) : 'Chapter reward: +' + money(c.r) + '! A new chapter begins.', 'goal', 'flag');
  Snd.play('rank');
  rt.goalsDirty = true;
  if (dlgKind === 'career') renderDlg(); updateUI(); requestSave();
}
function startCareer() {
  state.mode = 'career'; state.career = newCareer();
  log('The story begins! Follow the chapters in the Career window (K).', 'good');
  Snd.play('goal'); renderDlg(); updateUI(); requestSave();
}

