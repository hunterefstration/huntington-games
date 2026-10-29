// ----- goals -----
function staffCount(role) { let n = 0; state.locations.forEach(l => l.staff.forEach(s => { if (!role || s.role === role) n++; })); return n; }
function upgradeLevels() { let n = 0; for (const k in state.upgrades) n += state.upgrades[k]; return n; }
function maxCounters() { let m = 0; state.locations.forEach(l => { m = Math.max(m, C(l).counters.length); }); return m; }
function decorCount() { let n = 0; state.locations.forEach(l => { n += C(l).decor; }); return n; }
function maxStaffLv() { let m = 0; state.locations.forEach(l => l.staff.forEach(s => { if (s.lv > m) m = s.lv; })); return m; }
function maxMenu() { let m = 0; state.locations.forEach(l => { m = Math.max(m, l.menu.length); }); return m; }
function cityCount() { const c = {}; state.locations.forEach(l => { c[l.city] = 1; }); state.franchises.forEach(f => { c[f.city] = 1; }); return Object.keys(c).length; }
function bestRating() { let m = 0; state.locations.forEach(l => { m = Math.max(m, rating(l)); }); return m; }
const GOALS = [
  { id: 'first', n: 'First Sale', d: 'Serve your first customer.', m: () => state.stats.served, t: 1, r: 10 },
  { id: 'barista', n: 'Hands-Free Brewing', d: 'Hire a Barista.', m: () => staffCount('barista'), t: 1, r: 30 },
  { id: 'cashier', n: 'Open Register', d: 'Hire a Cashier.', m: () => staffCount('cashier'), t: 1, r: 40 },
  { id: 'restocker', n: 'Never Run Out', d: 'Hire a Restocker.', m: () => staffCount('restocker'), t: 1, r: 50 },
  { id: 's25', n: 'Regulars', d: 'Serve 25 customers.', m: () => state.stats.served, t: 25, r: 50 },
  { id: 's100', n: 'Busy Bee', d: 'Serve 100 customers.', m: () => state.stats.served, t: 100, r: 150 },
  { id: 'e500', n: 'Pocket Change', d: 'Earn $500 in total.', m: () => state.stats.earned, t: 500, r: 60 },
  { id: 'decor', n: 'Cozy Corner', d: 'Place 5 decorations (plants, tables, lamps...).', m: decorCount, t: 5, r: 100 },
  { id: 'recipe1', n: 'Mad Scientist', d: 'Discover a recipe in the Recipe Lab.', m: recipesKnown, t: 1, r: 80 },
  { id: 'menu3', n: 'Daily Specials', d: 'Put 3 specials on one shop menu.', m: maxMenu, t: 3, r: 300 },
  { id: 'lv5', n: 'Star Employee', d: 'Get a staff member to level 5.', m: maxStaffLv, t: 5, r: 400 },
  { id: 'city2', n: 'Road Trip', d: 'Open a shop or franchise in a second city.', m: cityCount, t: 2, r: 600 },
  { id: 'fav50', n: 'Their Favorite', d: 'Serve 50 customers their favorite special.', m: () => state.stats.favs, t: 50, r: 500 },
  { id: 'choices10', n: 'Crisis Manager', d: 'Make 10 event decisions.', m: () => state.stats.choices, t: 10, r: 800 },
  { id: 'manager', n: 'Delegator', d: 'Hire a shop Manager.', m: () => staffCount('manager'), t: 1, r: 500 },
  { id: 'fr1', n: 'Franchise Owner', d: 'Open a franchise outlet.', m: () => state.franchises.length, t: 1, r: 900 },
  { id: 'rating4', n: 'Four Stars', d: 'Get any shop to a 4.0 star rating.', m: bestRating, t: 4, r: 1500 },
  { id: 'recipe8', n: 'Recipe Book', d: 'Discover 8 recipes.', m: recipesKnown, t: 8, r: 1500 },
  { id: 'lv10', n: 'Master Barista', d: 'Get a staff member to level 10.', m: maxStaffLv, t: 10, r: 4000 },
  { id: 'cities4', n: 'Coast to Coast', d: 'Do business in 4 different cities.', m: cityCount, t: 4, r: 6000 },
  { id: 'fr6', n: 'Franchise King', d: 'Own 6 franchise outlets.', m: () => state.franchises.length, t: 6, r: 12000 },
  { id: 'rating5', n: 'Five Stars', d: 'Get any shop to a 4.8 star rating.', m: bestRating, t: 4.8, r: 8000 },
  { id: 'recipeall', n: 'Master Chef', d: 'Discover all ' + CLASSIC_N + ' classic recipes.', m: classicKnown, t: CLASSIC_N, r: 20000 },
  { id: 'cities6', n: 'Coffee Everywhere', d: 'Do business in all 6 cities.', m: cityCount, t: 6, r: 30000 },
  { id: 'shop2', n: 'Going Places', d: 'Own 2 shops.', m: () => state.locations.length, t: 2, r: 300 },
  { id: 'streak10', n: 'Happy Streak', d: 'Serve 10 customers in a row without losing one.', m: () => state.stats.bestStreak, t: 10, r: 100 },
  { id: 'upg5', n: 'Investor', d: 'Buy 5 upgrade levels.', m: upgradeLevels, t: 5, r: 200 },
  { id: 'rep200', n: 'Local Celebrity', d: 'Reach 200 reputation.', m: () => state.reputation, t: 200, r: 200 },
  { id: 'e5k', n: 'Small Business', d: 'Earn $5,000 in total.', m: () => state.stats.earned, t: 5000, r: 400 },
  { id: 'counters', n: 'Long Bar', d: 'Have 5 counters in one shop.', m: maxCounters, t: 5, r: 250 },
  { id: 'lux', n: 'Fancy Pants', d: 'Serve 10 Luxury coffees.', m: () => state.stats.lux, t: 10, r: 300 },
  { id: 'critic', n: 'Five-Star Review', d: 'Impress a Coffee Critic.', m: () => state.stats.critics, t: 1, r: 500 },
  { id: 's500', n: 'Rush Hour Hero', d: 'Serve 500 customers.', m: () => state.stats.served, t: 500, r: 600 },
  { id: 'team', n: 'Full Crew', d: 'Have 10 staff members.', m: () => staffCount(), t: 10, r: 600 },
  { id: 'days10', n: 'Ten Days Strong', d: 'Run your cafe for 10 days.', m: () => state.stats.days, t: 10, r: 400 },
  { id: 'shop4', n: 'Mini Chain', d: 'Own 4 shops.', m: () => state.locations.length, t: 4, r: 2000 },
  { id: 'e50k', n: 'Big Money', d: 'Earn $50,000 in total.', m: () => state.stats.earned, t: 50000, r: 4000 },
  { id: 'streak50', n: 'Flawless', d: 'Serve 50 customers in a row without losing one.', m: () => state.stats.bestStreak, t: 50, r: 1500 },
  { id: 'upg25', n: 'Fully Loaded', d: 'Buy 25 upgrade levels.', m: upgradeLevels, t: 25, r: 5000 },
  { id: 'rep400', n: 'Coffee Royalty', d: 'Reach 400 reputation.', m: () => state.reputation, t: 400, r: 3000 },
  { id: 's5000', n: 'Coffee Machine', d: 'Serve 5,000 customers.', m: () => state.stats.served, t: 5000, r: 15000 },
  { id: 'shop8', n: 'Coffee Empire', d: 'Own 8 shops.', m: () => state.locations.length, t: 8, r: 40000 },
  { id: 'e250k', n: 'Legend', d: 'Earn $250,000 in total.', m: () => state.stats.earned, t: 250000, r: 50000 },
  { id: 'decor25', n: 'Garden Cafe', d: 'Place 25 decorations.', m: decorCount, t: 25, r: 2500 },
  { id: 'critic5', n: 'Critics Choice', d: 'Impress 5 Coffee Critics.', m: () => state.stats.critics, t: 5, r: 4000 },
  { id: 'streak200', n: 'Unstoppable', d: 'Serve 200 customers in a row without losing one.', m: () => state.stats.bestStreak, t: 200, r: 10000 },
  { id: 'rep500', n: 'Perfect Reputation', d: 'Reach 500 reputation.', m: () => state.reputation, t: 500, r: 10000 },
  { id: 'days50', n: 'Fifty Days', d: 'Run your cafe for 50 days.', m: () => state.stats.days, t: 50, r: 6000 },
  { id: 'upgmax', n: 'Maxed Out', d: 'Buy every upgrade level (' + UPGRADE_TOTAL + ' total).', m: upgradeLevels, t: UPGRADE_TOTAL, r: 50000 },
  { id: 'e1m', n: 'Millionaire', d: 'Earn $1,000,000 in total.', m: () => state.stats.earned, t: 1000000, r: 150000 },
  // 2.0: seasons, latte art, championships, story
  { id: 'art1', n: 'Latte Artist', d: 'Pour your first latte art cup (L).', m: () => state.stats.art, t: 1, r: 80 },
  { id: 'holiday', n: 'Holiday Spirit', d: 'Serve 25 customers on holidays.', m: () => state.stats.holServed, t: 25, r: 400 },
  { id: 'artp', n: 'Perfect Pour', d: 'Pour a latte art that scores 85 or more.', m: () => state.stats.artBest, t: 85, r: 600 },
  { id: 'story4', n: 'Page Turner', d: 'Finish 4 career chapters.', m: () => state.career.ch, t: 4, r: 1500 },
  { id: 'champ1', n: 'Champion', d: 'Win a barista championship.', m: () => state.stats.champs, t: 1, r: 1000 },
  { id: 'art50', n: 'Milk Maestro', d: 'Pour 50 latte art cups.', m: () => state.stats.art, t: 50, r: 1500 },
  { id: 'year1', n: 'A Full Year', d: 'Play through all four seasons (16 days).', m: () => state.stats.days, t: YEAR_DAYS, r: 2500 },
  { id: 'seasonal4', n: 'Seasonal Chef', d: 'Discover 4 seasonal recipes.', m: seasonalKnown, t: 4, r: 3000 },
  { id: 'seasonalall', n: 'Four Seasons', d: 'Discover all ' + SEASONAL_N + ' seasonal recipes.', m: seasonalKnown, t: SEASONAL_N, r: 15000 },
  { id: 'story8', n: 'The End', d: 'Finish the whole career story.', m: () => state.career.ch, t: CAREER.length, r: 20000 },
  { id: 'champ3', n: 'World Class', d: 'Win all 3 barista championships.', m: () => state.stats.champs, t: 3, r: 25000 }
];
function checkGoals() {
  GOALS.forEach(g => {
    if (state.goals[g.id]) return;
    if (g.m() >= g.t) {
      state.goals[g.id] = true;
      state.globalMoney += g.r;
      toast('Goal complete: ' + g.n + '! +' + money(g.r), 'goal', 'trophy');
      log('Goal complete: ' + g.n + ' (+' + money(g.r) + ')', 'good');
      Snd.play('goal');
      rt.dirtyUI = true; rt.goalsDirty = true;
    }
  });
}
function nextGoal() {
  let best = null;
  GOALS.forEach(g => {
    if (state.goals[g.id]) return;
    const frac = clamp(g.m() / g.t, 0, 1);
    if (!best || g.r < best.g.r) best = { g: g, frac: frac };     // cheapest reward = nearest milestone
  });
  return best;
}
function goalCur(g) { const v = Math.min(g.t, g.m()); return g.t % 1 || g.m === bestRating ? Math.floor(v * 10) / 10 : Math.floor(v); }
function goalFmt(g, v) { return (g.t % 1 || g.m === bestRating) ? v.toFixed(1) : fmt(v); }
function goalsDone() { let n = 0; GOALS.forEach(g => { if (state.goals[g.id]) n++; }); return n; }

// ----- rank, day, rescue, away -----
const RANK_PERKS = [
  '', 'Luxury beans, cafe tables, Business customers and a 3rd shop slot are unlocked!',
  'You can now own up to 4 shops.', 'You can now own up to 5 shops.', 'You can now own up to 6 shops.',
  'You can now own up to 7 shops.', 'You can now own up to 8 shops!', 'You have reached the top. You are a legend!'
];
function onRankUp(r) {
  Snd.play('rank');
  log('Rank up! You are now: ' + RANKS[r].n, 'good');
  toast('Rank up: ' + RANKS[r].n + '!', 'goal', 'star');
  rt.rankUp = { rank: r };
  rt.dirtyUI = true;
}
function rentPerDay() { let r = 0; state.locations.forEach(l => { r += cityOf(l).rent; }); return r; }
function newDay() {
  const st = state.stats;
  st.days++;
  const day = Math.floor(state.tick / DAY_TICKS);
  const sat = satisfaction();
  // rent for shops outside the hometown is due every morning
  const rent = rentPerDay();
  let rentTxt = '';
  if (rent > 0) {
    const paid = Math.min(rent, Math.max(0, Math.floor(state.globalMoney)));
    state.globalMoney -= paid; st.spent += paid; st.rentPaid += paid;
    rentTxt = ', rent ' + money(paid);
    if (paid < rent) { modifyReputation(-5); log('You could not pay all the rent (' + money(rent) + ')! The landlords are grumpy: reputation -5.', 'bad'); }
  }
  toast('Day ' + day + ' complete: ' + money(st.dayEarned) + ' earned, ' + st.dayServed + ' served' + (st.dayAngry ? ', ' + st.dayAngry + ' lost' : '') + rentTxt + '.', 'info', 'sun');
  log('Day ' + day + ' report: ' + money(st.dayEarned) + ' earned, ' + st.dayServed + ' customers' + (sat !== null ? ', ' + sat + '% happy' : '') + rentTxt + '.', '');
  st.dayEarned = 0; st.dayServed = 0; st.dayAngry = 0;
  calendarNews(true);
  writeSave('day');
}
// A new day started: announce a new season, a new year or today's holiday, and refresh the seasonal looks.
function calendarNews(loud) {
  const d = dayIdx(), si = seasonIdx(), S = SEASONS[si], h = holidayOn(d);
  if (d % SEASON_DAYS === 0) {
    state.locations.forEach(l => { l._d = true; });      // seasonal decorations change their ambience
    gfx.staticDirty = true;
    const ing = PANTRY.filter(k => SUPPLY[k].season === si).map(k => SUPPLY[k].name);
    if (d % YEAR_DAYS === 0 && d > 0) { log('Happy New Year! Year ' + yearNum() + ' begins.', 'good'); if (loud) toast('Happy New Year! Year ' + yearNum() + ' begins.', 'goal', 'sparkle'); }
    log(S.name + ' is here! ' + S.desc + (ing.length ? ' In season: ' + ing.join(', ') + '.' : ''), 'event');
    if (loud) toast(S.name + ' is here! ' + (ing.length ? ing.join(', ') + ' is in season.' : S.desc), 'event', S.icon);
  }
  if (h) {
    state.stats.holidays++;
    gfx.staticDirty = true;
    log('Today is ' + h.name + '! ' + h.desc, 'event');
    if (loud) { toast('Today is ' + h.name + '! ' + h.desc, 'event', h.icon); Snd.play('event'); }
  } else if (holidayOn(d - 1)) gfx.staticDirty = true;    // yesterday's decorations come down
  rt.dirtyUI = true;
}
function rescueCheck() {
  // Never let the player get stuck with no money and no way to make coffee.
  let canMake = false, anyBuilt = false, need = 1e9;
  state.locations.forEach(l => {
    const c = C(l), inv = l.inventory;
    if (c.doors.length || c.counters.length || c.brewers.length) anyBuilt = true;
    if (stockTotal(l) > 0 || brewingCount(l) > 0) canMake = true;
    if (c.brewers.length && inv.milk > 0 && inv.cups > 0 && (inv.beans + inv.beans_premium + inv.beans_luxury) > 0) canMake = true;
  });
  const money0 = state.globalMoney;
  if (!anyBuilt) return;
  if (!canMake) {
    // cheapest way back into business: some supplies (or a missing building piece)
    need = 10;
    const l = state.locations[0], c = C(l);
    if (!c.brewers.length && !state.locations.some(x => C(x).brewers.length)) need = Math.max(need, toolCost(l, 'brewer'));
  } else return;
  if (money0 >= need) { state.rescue = 0; return; }
  state.rescue++;
  if (state.rescue >= 4) {
    const gift = Math.ceil(need - money0 + 15);
    state.globalMoney += gift; state.rescue = 0;
    toast('A friendly regular lends you ' + money(gift) + ' to get going again.', 'info', 'coin');
    log('A friendly regular lent you ' + money(gift) + '.', 'good');
  }
}
// ----- franchises: outlets run by their own manager that pay passive income -----
function frMax() { const r = rankIdx(); return r < 2 ? 0 : Math.min(FR_CAP, (r - 1) * 2); }
function frGross(f) {
  const ci = CITY_BY_ID[f.city];
  return FR_INCOME[f.lv] * ci.frMult * (1 + 0.12 * (f.mgr - 1)) * clamp(0.6 + state.reputation / 400, 0.6, 1.85) * (1 + 0.02 * recipesKnown()) * (1 + 0.08 * U('frsupport'));
}
function frRent(f) { return CITY_BY_ID[f.city].rent / 8; }
function frNet(f) { return Math.max(0, frGross(f) - frRent(f)); }
function frTotal() { let t = 0; state.franchises.forEach(f => { t += frNet(f); }); return t; }
function frOpenCost(cityId) { return Math.round(CITY_BY_ID[cityId].fr * Math.pow(1.35, state.franchises.length) / 50) * 50; }
function frUpCost(f) { return Math.round(CITY_BY_ID[f.city].fr * 0.75 * f.lv / 50) * 50; }
function frTrainCost(f) { return Math.round(300 * f.mgr * f.mgr * CITY_BY_ID[f.city].frMult / 10) * 10; }
function frSellValue(f) { return Math.round(f.paid * 0.5 / 10) * 10; }
function frTick() {
  // called once per game second
  for (let i = 0; i < state.franchises.length; i++) {
    const f = state.franchises[i];
    f.acc = (f.acc || 0) + frNet(f) / 60;
    if (f.acc >= 1) { const a = Math.floor(f.acc); f.acc -= a; f.earned += a; state.stats.frEarned += a; earn(null, a); }
  }
}
// Estimated earnings while the game was closed: fully automated shops (barista + cashier + restocker or manager) and franchises earn.
function applyAway(seconds) {
  const mins = Math.min(seconds, 2 * 3600) / 60;
  let total = 0, shops = 0;
  state.locations.forEach(l => {
    const has = r => l.staff.some(s => s.role === r);
    const c = C(l), mg = l.staff.find(s => s.role === 'manager');
    if (has('barista') && has('cashier') && (has('restocker') || mg) && c.reachCount && c.brewers.length && l.rate > 0) {
      total += l.rate * (mg ? 0.35 + 0.06 * sk(mg, 'qua') : 0.2) * mins; shops++;
    }
  });
  const fr = Math.floor(frTotal() * 0.5 * mins);
  total = Math.floor(total) + fr;
  if (total > 0) {
    state.globalMoney += total; state.stats.earned += total; state.stats.frEarned += fr;
    rt.rank = rankIdx();
  }
  state.tick += Math.floor(seconds * 5 * 0.0);   // the clock does not run while away
  return { seconds: seconds, money: total, shops: shops, fr: fr, frN: state.franchises.length };
}

// ----- main tick -----
function slowTick() {
  // 1 per second
  const idx = Math.floor(state.tick / 25) % 12;
  while (rt.incIdx !== idx) { rt.incIdx = (rt.incIdx + 1) % 12; rt.inc[rt.incIdx] = 0; }
  state.locations.forEach(l => {
    const inst = (l.earnAcc || 0) * 60 / 1;     // per second -> per minute
    l.earnAcc = 0;
    l.rate = l.rate * 0.97 + inst * 0.03;
    computeRating(l);
  });
  frTick();
  checkGoals();
  careerCheck();
  tutorialCheck();
  if (state.tick % 25 === 0) rescueCheck();
  rt.dirtyUI = true;
}
function tick() {
  state.tick++;
  state.stats.playTicks++;
  for (let i = 0; i < state.locations.length; i++) simLoc(state.locations[i], i);
  updateEvent();
  if (state.tick % 5 === 0) slowTick();
  if (state.tick % DAY_TICKS === 0) newDay();
  rt.dirtyUI = true;
}


// ======================================================================
// RENDERING (canvas) + EFFECTS + INPUT
// ======================================================================
const gfx = { cv: null, ctx: null, stat: null, sctx: null, k: 1, side: 0, staticDirty: true, hover: null, dragging: false, lastKey: '', arrow: null, t: 0 };
const fx = { texts: [], parts: [] };

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function rrect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}
function fitCanvas() {
  const cv = gfx.cv, stage = $('stage');
  if (!cv || !stage) return;
  const w = stage.clientWidth, h = stage.clientHeight;
  const side = Math.max(120, Math.floor(Math.min(w, h)));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(side * dpr);
  if (cv.width !== px || gfx.side !== side) {
    gfx.side = side;
    cv.style.width = side + 'px'; cv.style.height = side + 'px';
    cv.width = px; cv.height = px;
    gfx.stat.width = px; gfx.stat.height = px;
    gfx.k = px / CANVAS_PX;
    gfx.staticDirty = true;
  }
}

// ----- static layer: ground, floors, buildings -----
function drawGround(c, x, y, loc) {
  const px = x * TS, py = y * TS, r = hash2(x, y, loc.seed), r2 = hash2(x, y, loc.seed + 7);
  if (r < 0.28) { c.fillStyle = 'rgba(255,255,255,0.055)'; c.fillRect(px, py, TS, TS); }
  else if (r < 0.52) { c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(px, py, TS, TS); }
  const th = THEMES.find(t => t.name === loc.theme.name) || THEMES[0];
  const ox = px + 6 + hash2(x, y, 5) * 18, oy = py + 8 + hash2(x, y, 9) * 16;
  if (th.deco === 'flowers') {
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.5; c.beginPath();
    c.moveTo(px + 6, py + 24); c.lineTo(px + 8, py + 20); c.moveTo(px + 22, py + 10); c.lineTo(px + 24, py + 6); c.stroke();
    if (r2 < 0.2) {
      const col = ['#fda4af', '#fde047', '#f9fafb', '#c4b5fd'][Math.floor(hash2(x, y, 3) * 4)];
      c.fillStyle = '#166534'; c.fillRect(ox - 0.5, oy, 1.5, 6);
      c.fillStyle = col; c.beginPath(); c.arc(ox, oy, 2.6, 0, 6.3); c.fill();
      c.fillStyle = '#facc15'; c.beginPath(); c.arc(ox, oy, 1, 0, 6.3); c.fill();
    }
  } else if (th.deco === 'cactus') {
    if (r2 < 0.09) { c.fillStyle = '#15803d'; rrect(c, ox - 2, oy - 4, 5, 13, 2); c.fill(); rrect(c, ox - 6, oy, 4, 3, 1.5); c.fill(); rrect(c, ox + 3, oy - 2, 4, 3, 1.5); c.fill(); }
    else if (r2 < 0.22) { c.fillStyle = 'rgba(120,53,15,0.35)'; c.beginPath(); c.ellipse(ox, oy, 4, 2.4, 0, 0, 6.3); c.fill(); }
  } else if (th.deco === 'trees') {
    if (r2 < 0.2) {
      c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(px + 17, py + 27, 9, 3, 0, 0, 6.3); c.fill();
      c.fillStyle = '#713f12'; c.fillRect(px + 14, py + 18, 4, 9);
      c.fillStyle = '#14532d'; c.beginPath(); c.arc(px + 16, py + 13, 9, 0, 6.3); c.fill();
      c.fillStyle = '#166534'; c.beginPath(); c.arc(px + 13, py + 11, 5, 0, 6.3); c.fill();
    }
  } else if (th.deco === 'stars') {
    if (r2 < 0.14) { c.fillStyle = 'rgba(255,255,255,0.75)'; c.fillRect(ox, oy, 2, 2); c.fillStyle = 'rgba(147,197,253,0.6)'; c.fillRect(ox + 8, oy - 5, 1.5, 1.5); }
  } else if (th.deco === 'rocks') {
    if (r2 < 0.17) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(ox, oy + 2, 7, 4, 0, 0, 6.3); c.fill(); c.fillStyle = '#a8a29e'; c.beginPath(); c.ellipse(ox, oy, 6, 4, 0, 0, 6.3); c.fill(); c.fillStyle = '#d6d3d1'; c.beginPath(); c.ellipse(ox - 1.5, oy - 1.5, 3, 1.8, 0, 0, 6.3); c.fill(); }
  } else if (th.deco === 'snow') {
    if (r2 < 0.2) { c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.ellipse(ox, oy + 2, 8, 4, 0, 0, 6.3); c.fill(); }
    else if (r2 < 0.26) { c.fillStyle = '#166534'; c.beginPath(); c.moveTo(px + 16, py + 4); c.lineTo(px + 24, py + 24); c.lineTo(px + 8, py + 24); c.closePath(); c.fill(); c.fillStyle = '#f8fafc'; c.beginPath(); c.moveTo(px + 16, py + 4); c.lineTo(px + 20, py + 13); c.lineTo(px + 12, py + 13); c.closePath(); c.fill(); }
  }
}
function drawFloor(c, x, y) {
  const px = x * TS, py = y * TS;
  c.fillStyle = ((x + y) & 1) ? '#e4b66b' : '#dcab5b';
  c.fillRect(px, py, TS, TS);
  c.strokeStyle = 'rgba(120,70,20,0.22)'; c.lineWidth = 1;
  c.beginPath();
  c.moveTo(px, py + 10.5); c.lineTo(px + TS, py + 10.5);
  c.moveTo(px, py + 21.5); c.lineTo(px + TS, py + 21.5);
  const o = ((x * 7 + y * 3) % 3) * 8 + 6;
  c.moveTo(px + o, py); c.lineTo(px + o, py + 10.5);
  c.moveTo(px + (o + 14) % 32, py + 10.5); c.lineTo(px + (o + 14) % 32, py + 21.5);
  c.moveTo(px + (o + 5) % 32, py + 21.5); c.lineTo(px + (o + 5) % 32, py + TS);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
}
function drawDoor(c, x, y) {
  const px = x * TS, py = y * TS;
  c.fillStyle = '#c99a55'; c.fillRect(px, py, TS, TS);
  c.fillStyle = '#4a2f1b'; rrect(c, px + 4, py + 1, 24, 27, 3); c.fill();
  c.fillStyle = '#8a5a2e'; rrect(c, px + 7, py + 4, 18, 22, 2); c.fill();
  c.fillStyle = '#9fd0f0'; rrect(c, px + 10, py + 7, 12, 8, 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(px + 11, py + 8, 4, 2);
  c.fillStyle = '#facc15'; c.beginPath(); c.arc(px + 22, py + 20, 1.8, 0, 6.3); c.fill();
  c.fillStyle = '#b91c1c'; rrect(c, px + 6, py + 27, 20, 4, 1.5); c.fill();
  c.fillStyle = '#fca5a5'; c.fillRect(px + 9, py + 28.5, 14, 1);
}
function drawCounter(c, x, y, loc) {
  const px = x * TS, py = y * TS, g = loc.grid;
  const L = x > 0 && g[y][x - 1] === TILE.COUNTER, R = x < GRID_W - 1 && g[y][x + 1] === TILE.COUNTER;
  const x0 = L ? 0 : 2, x1 = R ? TS : TS - 2;
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px + x0, py + 27, x1 - x0, 4);
  c.fillStyle = '#6b2f0c'; rrect(c, px + x0, py + 8, x1 - x0, 20, 3); c.fill();
  c.fillStyle = '#8a4313'; c.fillRect(px + x0 + (L ? 0 : 2), py + 14, x1 - x0 - (L ? 0 : 2) - (R ? 0 : 2), 11);
  c.fillStyle = '#d68a2d'; rrect(c, px + x0, py + 3, x1 - x0, 11, 3); c.fill();
  c.fillStyle = '#f0b259'; c.fillRect(px + x0 + 1, py + 4, x1 - x0 - 2, 2);
  // little till on every counter
  c.fillStyle = '#1f2937'; rrect(c, px + 9, py + 1, 14, 9, 2); c.fill();
  c.fillStyle = '#34d399'; c.fillRect(px + 11, py + 3, 10, 3);
  c.fillStyle = '#9ca3af'; c.fillRect(px + 11, py + 7, 10, 2);
}
function drawBrewer(c, x, y) {
  const px = x * TS, py = y * TS;
  c.fillStyle = 'rgba(0,0,0,0.28)'; rrect(c, px + 4, py + 6, 26, 25, 5); c.fill();
  const gr = c.createLinearGradient(px, py, px + TS, py);
  gr.addColorStop(0, '#9aa7b8'); gr.addColorStop(0.5, '#dbe3ee'); gr.addColorStop(1, '#8e9bad');
  c.fillStyle = gr; rrect(c, px + 3, py + 2, 26, 27, 5); c.fill();
  c.fillStyle = '#334155'; rrect(c, px + 6, py + 5, 20, 9, 2); c.fill();
  c.fillStyle = '#0f172a'; c.fillRect(px + 14, py + 14, 4, 5);
  c.fillStyle = '#475569'; rrect(c, px + 7, py + 23, 18, 4, 1.5); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; rrect(c, px + 3.5, py + 2.5, 25, 26, 5); c.stroke();
}
function drawParking(c, x, y, loc) {
  const px = x * TS, py = y * TS;
  c.fillStyle = '#4b5563'; c.fillRect(px, py, TS, TS);
  c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(px, py, TS, 2);
  c.strokeStyle = 'rgba(243,244,246,0.75)'; c.lineWidth = 1.5; c.setLineDash([4, 3]);
  c.strokeRect(px + 2.5, py + 2.5, TS - 5, TS - 5); c.setLineDash([]);
  if (hash2(x, y, loc.seed + 3) < 0.55) {
    const col = ['#ef4444', '#3b82f6', '#eab308', '#f8fafc', '#10b981', '#a855f7'][Math.floor(hash2(x, y, loc.seed + 4) * 6)];
    c.fillStyle = 'rgba(0,0,0,0.3)'; rrect(c, px + 8, py + 6, 17, 23, 5); c.fill();
    c.fillStyle = col; rrect(c, px + 7, py + 4, 17, 23, 5); c.fill();
    c.fillStyle = 'rgba(15,23,42,0.75)'; rrect(c, px + 9, py + 9, 13, 6, 2); c.fill(); rrect(c, px + 9, py + 20, 13, 4, 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(px + 9, py + 5, 4, 2);
  } else {
    c.fillStyle = 'rgba(243,244,246,0.5)'; c.font = 'bold 14px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', px + 16, py + 17);
  }
}
function drawPlant(c, x, y) {
  const px = x * TS, py = y * TS;
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(px + 16, py + 28, 9, 3, 0, 0, 6.3); c.fill();
  c.fillStyle = '#16a34a'; c.beginPath(); c.arc(px + 11, py + 12, 6, 0, 6.3); c.arc(px + 21, py + 12, 6, 0, 6.3); c.arc(px + 16, py + 7, 6.5, 0, 6.3); c.fill();
  c.fillStyle = '#22c55e'; c.beginPath(); c.arc(px + 14, py + 9, 3.5, 0, 6.3); c.arc(px + 20, py + 11, 2.5, 0, 6.3); c.fill();
  c.fillStyle = '#b45309'; c.beginPath(); c.moveTo(px + 8, py + 16); c.lineTo(px + 24, py + 16); c.lineTo(px + 21, py + 28); c.lineTo(px + 11, py + 28); c.closePath(); c.fill();
  c.fillStyle = '#d97706'; c.fillRect(px + 8, py + 16, 16, 3);
}
function drawTable(c, x, y) {
  const px = x * TS, py = y * TS;
  c.fillStyle = '#7c2d12'; c.beginPath(); c.arc(px + 5, py + 16, 4, 0, 6.3); c.arc(px + 27, py + 16, 4, 0, 6.3); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(px + 16, py + 20, 11, 8, 0, 0, 6.3); c.fill();
  c.fillStyle = '#92400e'; c.beginPath(); c.ellipse(px + 16, py + 15, 11, 9, 0, 0, 6.3); c.fill();
  c.fillStyle = '#b45309'; c.beginPath(); c.ellipse(px + 16, py + 14, 9.5, 7.5, 0, 0, 6.3); c.fill();
  c.fillStyle = '#fff'; c.fillRect(px + 13, py + 10, 6, 5);
  c.fillStyle = '#78350f'; c.fillRect(px + 13.5, py + 10.5, 5, 1.5);
  c.strokeStyle = '#e5e7eb'; c.lineWidth = 1; c.beginPath(); c.arc(px + 20, py + 12.5, 1.8, -1.5, 1.5); c.stroke();
}
