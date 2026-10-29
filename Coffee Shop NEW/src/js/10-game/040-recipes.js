// ----- recipes -----
function canMake(loc, r) {
  const inv = loc.inventory;
  for (let i = 0; i < r.ing.length; i++) if (inv[r.ing[i]] < 1) return false;
  if (r.base >= 0) { for (let t = r.base; t < 3; t++) if (inv[COFFEE[t]] > 0) return true; return false; }
  return r.food || (inv.milk > 0 && inv.cups > 0);
}
function recipesKnown() { let n = 0; for (const k in state.recipes) if (state.recipes[k]) n++; return n; }
function menuSlots() { return 2 + U('specials'); }
// what a new customer orders from the menu: their favorite flavor first, sometimes anything that sounds good
function pickWant(loc, kn, lt) {
  if (kn === 'critic' || !loc.menu.length || state.stats.served < 3) return null;
  let fav = null, n = 0, sea = null, ns = 0, any = null, na = 0;
  for (let i = 0; i < loc.menu.length; i++) {
    const r = RECIPE_BY_ID[loc.menu[i]];
    if (!r || !sellsHere(r, loc)) continue;                // out-of-season (or out-of-town) specials are not ordered
    na++; if (Math.random() * na < 1) any = r;
    if (r.season !== undefined || r.city) { ns++; if (Math.random() * ns < 1) sea = r; }
    if (r.tags.indexOf(lt) < 0) continue;
    n++; if (Math.random() * n < 1) fav = r;
  }
  if (fav && Math.random() < 0.65) return fav;
  if (sea && Math.random() < 0.25) return sea;              // everyone wants to try the seasonal special
  if (any && Math.random() < 0.18 + 0.04 * na) return any;
  return null;
}

// ----- selling -----
function trySell(loc, c, manual, who) {
  const inv = loc.inventory, vis = (loc === state.locations[cur]);
  let rec = c.want ? RECIPE_BY_ID[c.want] : null;
  if (rec && !canMake(loc, rec)) {
    // out of an ingredient: the customer settles for a plain coffee (no favorite bonus)
    if (vis) fxText(c.x * TS + 16, c.y * TS - 34, 'No ' + rec.name + ' left', '#fdba74', 11);
    rec = null; c.want = null; c.fav = false; c.miss = true;
  }
  let idx = -1, q = '';
  if (rec) {
    if (rec.base >= 0) for (let t = rec.base; t < 3; t++) if (inv[COFFEE[t]] > 0) { idx = t; break; }
    q = 'special';
  } else if (inv[COFFEE[c.tier]] > 0) { idx = c.tier; q = 'exact'; }
  else {
    for (let t = c.tier + 1; t < 3; t++) if (inv[COFFEE[t]] > 0) { idx = t; q = 'up'; break; }
    if (idx < 0 && (manual || c.wait >= c.maxWait * 0.35)) {
      for (let t = c.tier - 1; t >= 0; t--) if (inv[COFFEE[t]] > 0) { idx = t; q = 'down'; break; }
    }
  }
  if (idx < 0 && !rec) return 'none';
  if (idx >= 0) inv[COFFEE[idx]]--;
  const K = KINDS[c.kind], cash = (who && who.role === 'cashier') ? who : null;
  const pm = priceMult(loc) * (1 + 0.08 * U('menu'));
  let pay, rep;
  if (rec) {
    for (let i = 0; i < rec.ing.length; i++) inv[rec.ing[i]]--;
    if (rec.base < 0 && !rec.food) { inv.milk--; inv.cups--; }
    pay = rec.price * K.pay * pm * (c.fav ? 1.4 : 1) * (bestSkill(loc, 'barista', 'qua') >= 5 ? 1.15 : 1) * (bestSkill(loc, 'manager', 'qua') >= 5 ? 1.1 : 1) * seasonBonus(rec) * (rec.city ? 1.2 : 1);
    rep = c.fav ? 2 + (bestSkill(loc, 'manager', 'cha') >= 5 ? 1 : 0) : 1;
    state.stats.specials++; if (c.fav) state.stats.favs++;
    state.rsold[rec.id] = (state.rsold[rec.id] || 0) + 1;
  } else {
    const base = (q === 'down') ? SALE[idx] * 0.8 : SALE[c.tier] * (q === 'up' ? 1.12 : 1);
    pay = base * K.pay * pm;
    rep = (q === 'exact') ? 1 : (q === 'up' ? 2 : 0);
    if (c.miss) rep = 0;
  }
  if (cash) pay *= 1 + 0.03 * sk(cash, 'qua');
  if (state.stats.served < 5) pay *= 2;          // welcome bonus for the very first sales
  let critic = false;
  const art = (loc.art.length && !(rec && rec.food)) ? loc.art.shift() : null;     // a latte art cup goes out with this drink
  if (c.kind === 'critic') {
    critic = true;
    // served by staff (event choice or Critic Ready perk): it only goes well if the shop is good (great latte art helps)
    const odds = manual ? 1 : clamp(0.35 + 0.13 * (rating(loc) - 1) + 0.05 * sk(cash, 'qua') + (art && art.q >= 0.75 ? 0.15 : 0), 0.3, 0.97);
    if (idx >= 1 && Math.random() < odds) { pay = SALE[idx] * 3.5 * cityOf(loc).price * (c.vip ? 1.5 : 1); rep = 25; state.stats.critics++; }
    else { pay = 3; rep = -10; idx = Math.min(idx, 0); }
  } else if (c.kind === 'star') rep += 2;
  pay = Math.max(1, Math.round(pay));
  let tip = 0;
  const tc = K.tip + 0.06 * U('tips') + evm('tip', loc, 0) + (c.fav ? 0.15 : 0) + 0.04 * sk(cash, 'cha') + seasonTip();
  if (!critic && Math.random() < tc) tip = Math.max(1, Math.round(pay * (0.15 + Math.random() * 0.25) * (sk(cash, 'cha') >= 5 ? 1.5 : 1)));
  let artTip = 0;
  if (art && !critic) { artTip = Math.max(1, Math.round(pay * (0.2 + 0.5 * art.q) * art.m)); if (art.q >= 0.75) rep += 1; state.stats.artTips += artTip; }
  earn(loc, pay + tip + artTip);
  state.stats.tips += tip + artTip;
  const st = state.stats;
  st.served++; st.dayServed++; loc.served++;
  if (curHoliday()) st.holServed++;
  st.streak++; if (st.streak > st.bestStreak) st.bestStreak = st.streak;
  if (idx === 2) st.lux++;
  pushRecent(1);
  loc.hap += ((rep > 0 ? 1 : 0.55) - loc.hap) * 0.05;
  modifyReputation(rep);
  if (cash) gainXP(loc, cash, c.fav ? 4 : 3);
  c.state = 'leaving'; c.mood = 'happy'; c.counter = null; c.path = leavePath(loc, c); c.cd = 0;
  if (vis) {
    const px = c.x * TS + 16, py = c.y * TS;
    fxText(px, py - 6, '+' + money(pay), '#4ade80', 15);
    if (tip) fxText(px, py - 20, '+' + money(tip) + ' tip!', '#fde047', 12);
    if (artTip) fxText(px + 22, py - 46, 'Latte art! +' + money(artTip), '#f5d0fe', 12);
    if (critic) fxText(px, py - 34, rep > 0 ? 'Critic loves it!' : 'Critic is disappointed', rep > 0 ? '#fde047' : '#f87171', 13);
    else if (rec) fxText(px, py - 20 - (tip ? 14 : 0), c.fav ? 'Favorite! ' + rec.name : rec.name, c.fav ? '#f9a8d4' : '#fde68a', 11);
    else if (q === 'up') fxText(px, py - 20 - (tip ? 14 : 0), 'Upgrade!', '#c084fc', 11);
    fxCoins(px, py + 8, Math.min(7, 2 + Math.floor(pay / 12)));
    fxHeart(px, py - 4);
    Snd.play('coin');
  }
  if (critic) log(rep > 0 ? 'The critic loved your coffee! +' + rep + ' reputation, ' + money(pay) + ' paid.' : 'The critic was unimpressed. Reputation -10.', rep > 0 ? 'good' : 'bad');
  rt.dirtyUI = true;
  return 'sold';
}
function pushRecent(v) { state.recent.push(v); if (state.recent.length > 40) state.recent.shift(); }
function satisfaction() {
  if (!state.recent.length) return null;
  let s = 0; state.recent.forEach(v => { s += v; });
  return Math.round(100 * s / state.recent.length);
}
function modifyReputation(a) {
  const old = state.reputation;
  state.reputation = clamp(state.reputation + a, 0, 500);
  if (Math.floor(state.reputation) !== Math.floor(old)) rt.repPulse = performance.now();
}
function leavePath(loc, c) {
  const g = loc.grid;
  return bfs(g, c.x, c.y, (x, y) => g[y][x] === TILE.DOOR, (x, y) => walkable(g, x, y)) || [];
}
function customerLeave(loc, c, angry) {
  c.state = 'leaving'; c.mood = angry ? 'angry' : 'lost'; c.counter = null; c.cd = 0;
  c.path = leavePath(loc, c);
}

// ----- customers -----
function pickKind(loc, cc) {
  const earned = state.stats.earned, city = cityOf(loc);
  const w = {};
  for (const k in city.kinds) w[k] = city.kinds[k];
  if (earned < 300) delete w.business;
  const S = curSeason(), h = curHoliday();
  if (w.tourist) w.tourist *= (cc.parking > 0 ? 1 + Math.min(10, cc.parking * 2) / 10 : 0.25) * evm('tourist', loc, 1) * S.tourist * (h && h.tourist ? h.tourist : 1);
  if (w.student && S.student) w.student *= S.student;      // back to school
  const inf = evm('influencer', loc, 0);
  if (inf) w.influencer = (w.influencer || 0) + 15 * inf;
  if (state.reputation >= 150 && earned >= 1500) w.star = (w.star || 0) + 1.2;
  let sum = 0; for (const k in w) sum += w[k];
  let r = Math.random() * sum;
  for (const k in w) { r -= w[k]; if (r <= 0) return k; }
  return 'regular';
}
function pickTier(kind, loc) {
  if (state.stats.served < 3) return 0;              // first customers always order the basic coffee you can make
  const rep = state.reputation, rank = rankIdx(), city = loc ? cityOf(loc) : CITIES[0];
  if (kind === 'critic') return rank >= 1 ? 2 : 1;
  let pPrem = clamp(0.08 + (rep - 80) / 600, 0.05, 0.4) + (city.prem || 0);
  let pLux = rank >= 1 ? clamp((rep - 110) / 900, 0, 0.22) + (city.lux || 0) : 0;
  if (kind === 'student') { pPrem *= 0.5; pLux *= 0.3; }
  if (kind === 'business' || kind === 'influencer') { pPrem *= 1.6; pLux *= 1.3; }
  if (kind === 'skier') { pPrem *= 1.4; pLux *= 1.6; }
  if (kind === 'star') pLux = Math.max(pLux, 0.6);
  const r = Math.random();
  if (r < pLux) return 2;
  if (r < pLux + pPrem) return 1;
  return 0;
}
function demandCurve() {
  const h = (state.tick % DAY_TICKS) / DAY_TICKS * 24;
  if (h < 5) return 0.55;
  if (h < 6) return 0.8;
  if (h < 10) return 1.4;
  if (h < 12) return 1.0;
  if (h < 14) return 1.35;
  if (h < 17) return 0.9;
  if (h < 19) return 1.25;
  if (h < 22) return 0.85;
  return 0.6;
}
function spawnChance(loc) {
  const cc = C(loc);
  let p = 0.04 + state.reputation / 6000 + Math.min(8, cc.parking) * 0.012;
  p *= (1 + 0.08 * U('ads')) * (1 + cc.amb * 0.01) * demandCurve();
  p *= cityOf(loc).spawn * (0.9 + 0.05 * rating(loc)) * evm('spawn', loc, 1) * seasonSpawn(loc);
  p *= (1 + 0.03 * bestSkill(loc, 'manager', 'cha')) * (bestSkill(loc, 'barista', 'cha') >= 5 ? 1.1 : 1);
  if (state.stats.served < 3) p = Math.max(p, 0.25);   // no waiting around for the very first customers
  return p;
}
function spawnCustomer(loc, kindName, force) {
  const cc = C(loc);
  if (!cc.doors.length || !cc.reachCount) return false;
  const cnt = {};
  loc.customers.forEach(c => { if (c.counter) cnt[c.counter] = (cnt[c.counter] || 0) + 1; });
  const lim = (kindName === 'critic') ? 1 : QUEUE_PER_COUNTER;
  let free = cc.counters.filter(k => cc.reach[k.key] && (cnt[k.key] || 0) < lim);
  if (!free.length) return false;
  let least = 99; free.forEach(k => { least = Math.min(least, cnt[k.key] || 0); });
  free = free.filter(k => (cnt[k.key] || 0) === least);          // fill empty counters first, then start a line
  const k = pick(free);
  const used = {};
  loc.customers.forEach(c => { if (c.counter === k.key && c.stand) used[c.stand.x + ',' + c.stand.y] = true; });
  const st = cc.stands[k.key].find(p => !used[p.x + ',' + p.y]) || cc.stands[k.key][0];
  const g = loc.grid;
  const door = pick(cc.doors);
  const path = bfs(g, door.x, door.y, (x, y) => x === st.x && y === st.y, (x, y) => walkable(g, x, y));
  if (!path) return false;
  const kn = kindName || pickKind(loc, cc), K = KINDS[kn];
  const c = {
    id: uid('c'), kind: kn, x: door.x, y: door.y, ox: door.x, oy: door.y, mt: state.tick, md: 1, cd: 0,
    state: 'walking', mood: '', counter: k.key, stand: st, path: path, wait: 0, tier: pickTier(kn, loc),
    look: Math.floor(Math.random() * 6), want: null, fav: false, lt: pick(K.likes)
  };
  const cr = craving();
  if (kn !== 'critic' && Math.random() < cr.crave) c.lt = pick(cr.likes);   // seasonal / holiday cravings
  if (evm('iced', loc, 0) && Math.random() < 0.6) c.lt = 'iced';             // heat wave: everyone craves something cold
  const r = pickWant(loc, kn, c.lt);
  if (r) { c.want = r.id; c.fav = r.tags.indexOf(c.lt) >= 0; c.tier = Math.max(0, r.base); }
  c.maxWait = Math.round(WAIT_TICKS * K.wait * (1 + 0.1 * U('chairs')) * (1 + cc.amb * 0.01) * (1 + 0.05 * bestSkill(loc, 'barista', 'cha')));
  if (kn === 'critic' && evm('critic', loc, '') === 'vip') { c.vip = true; c.maxWait *= 2; }
  loc.customers.push(c);
  return true;
}
// how fast a waiting customer loses patience this tick (events, cashier Speed skill)
function waitStep(loc, c) {
  let f = 1 / evm('wait', loc, 1);
  for (let i = 0; i < loc.staff.length; i++) {
    const s = loc.staff[i];
    if (s.role === 'cashier' && s.counter === c.counter && s.act === 'at' && !s.train) {
      const sp = s.sk.spd;
      if (sp) f *= (1 - 0.08 * sp) * (sp >= 5 ? 0.7 : 1);
      break;
    }
  }
  return f;
}
function customersTick(loc, idx) {
  const g = loc.grid, vis = (idx === cur);
  for (let i = loc.customers.length - 1; i >= 0; i--) {
    const c = loc.customers[i];
    if (c.state === 'walking') {
      const cp = c.counter.split(',');
      if (g[+cp[1]][+cp[0]] !== TILE.COUNTER) { customerLeave(loc, c, false); continue; }
      const r = stepEntity(c, 2, (x, y) => walkable(g, x, y));
      if (r === 'done') c.state = 'waiting';
      else if (r === 'blocked') {
        const p = bfs(g, c.x, c.y, (x, y) => x === c.stand.x && y === c.stand.y, (x, y) => walkable(g, x, y));
        if (p) c.path = p; else customerLeave(loc, c, false);
      }
    } else if (c.state === 'waiting') {
      const [cx, cy] = c.counter.split(',').map(Number);
      if (g[cy][cx] !== TILE.COUNTER) { customerLeave(loc, c, false); continue; }
      c.wait += waitStep(loc, c);
      if (c.wait >= c.maxWait) {
        customerLeave(loc, c, true);
        const crit = c.kind === 'critic';
        loc.hap += (0 - loc.hap) * 0.08;
        modifyReputation(crit ? -25 : -5);
        state.stats.angry++; state.stats.dayAngry++; state.stats.streak = 0;
        pushRecent(0);
        if (vis) { fxText(c.x * TS + 16, c.y * TS - 4, crit ? 'The critic left!' : 'Too slow!', '#f87171', 13); Snd.play('angry'); }
        if (crit) log('The critic left angry! Reputation -25.', 'bad');
        rt.dirtyUI = true;
      }
    } else if (c.state === 'leaving') {
      const r = stepEntity(c, 2, (x, y) => walkable(g, x, y));
      if (r === 'done') { loc.customers.splice(i, 1); }
      else if (r === 'blocked') {
        const p = leavePath(loc, c);
        if (p.length) c.path = p; else loc.customers.splice(i, 1);
      }
    }
  }
}

// ----- staff -----
function stationOf(loc, key) {
  let best = null;                                   // the customer who has waited longest is served first
  for (let i = 0; i < loc.customers.length; i++) {
    const c = loc.customers[i];
    if (c.counter === key && c.state === 'waiting' && (!best || c.wait > best.wait)) best = c;
  }
  return best;
}
function staffTick(loc, idx) {
  for (let i = 0; i < loc.staff.length; i++) {
    const s = loc.staff[i];
    if (s.train > 0) {
      // away at training: back with a new level when it is done
      s.train--;
      s.status = 'At training (' + Math.ceil(s.train / 5) + 's)';
      if (s.train <= 0) { s.train = 0; state.stats.trained++; levelUp(loc, s); if (s.lv >= STAFF_MAX_LV) s.xp = 0; toast(s.name + ' finished training: level ' + s.lv + '!', 'goal', 'star'); }
      continue;
    }
    if (s.role === 'barista') baristaAI(loc, s, idx);
    else if (s.role === 'cashier') cashierAI(loc, s, idx);
    else if (s.role === 'manager') managerAI(loc, s, idx);
    else restockerAI(loc, s, idx);
  }
}
function baristaAI(loc, s, idx) {
  const g = loc.grid, cc = C(loc), vis = (idx === cur);
  const walk = (x, y) => walkable(g, x, y);
  if (s.act === 'work') {
    s.status = s.job ? 'Brewing' : 'Ready';
    s.timer--;
    if (s.timer <= 0) {
      s.act = 'idle';
      if (s.job) {
        const [bx, by] = s.job.split(',').map(Number);
        const r = startBrew(loc, bx, by, s);
        if (r === 'ok') { gainXP(loc, s, 3); if (vis) { fxText(bx * TS + 16, by * TS - 2, 'Brewing...', '#fbbf24', 11); Snd.play('brew'); } }
      }
      s.job = null;
    }
    return;
  }
  if (s.act === 'walk') {
    s.status = s.job ? 'Heading to brewer' : 'Moving';
    const r = stepEntity(s, 1, walk);
    if (r === 'done') { s.act = 'work'; s.timer = 2; }
    else if (r === 'blocked') { s.act = 'idle'; s.job = null; s.path = []; }
    return;
  }
  // idle: look for work
  if (s.cd > 0) { s.cd--; return; }
  if (!cc.brewers.length) { s.status = 'Needs a Brewer'; return; }
  if (evm('power', loc, 1) <= 0) { s.status = 'Power is out!'; return; }
  const inv = loc.inventory;
  const cap = Math.min(40, 4 + cc.counters.length * 3);
  if (stockTotal(loc) + brewingCount(loc) >= cap) { s.status = 'Idle (plenty of coffee)'; baristaHover(loc, s); return; }
  if (inv.milk < 1 || inv.cups < 1 || !pickBean(loc)) { s.status = 'Out of supplies!'; baristaHover(loc, s); return; }
  const taken = {};
  loc.staff.forEach(o => { if (o !== s && o.job) taken[o.job] = true; });
  const stands = {};
  cc.brewers.forEach(b => {
    if (loc.activeBrews[b.key] || taken[b.key]) return;
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(d => {
      const nx = b.x + d[0], ny = b.y + d[1];
      if (walkable(g, nx, ny) && !stands[nx + ',' + ny]) stands[nx + ',' + ny] = b.key;
    });
  });
  let any = false; for (const k in stands) { any = true; break; }
  if (!any) {
    const busy = cc.brewers.some(b => loc.activeBrews[b.key] || taken[b.key]);
    s.status = busy ? 'Waiting for brewers' : 'No path to a Brewer';
    baristaHover(loc, s); return;
  }
  const p = bfs(g, s.x, s.y, (x, y) => !!stands[x + ',' + y], walk);
  if (!p) { s.status = 'No path to a Brewer'; s.cd = 10; return; }
  const endX = p.length ? p[p.length - 1].x : s.x, endY = p.length ? p[p.length - 1].y : s.y;
  s.job = stands[endX + ',' + endY];
  s.path = p; s.act = p.length ? 'walk' : 'work'; s.timer = 2;
  s.status = 'Heading to brewer';
}
function baristaHover(loc, s) {
  // stay near the machines so work starts instantly
  const g = loc.grid, cc = C(loc);
  if (Math.random() > 0.15 || !cc.brewers.length) return;
  const near = {};
  cc.brewers.forEach(b => [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(d => { if (walkable(g, b.x + d[0], b.y + d[1])) near[(b.x + d[0]) + ',' + (b.y + d[1])] = 1; }));
  if (near[s.x + ',' + s.y]) return;
  const p = bfs(g, s.x, s.y, (x, y) => !!near[x + ',' + y], (x, y) => walkable(g, x, y));
  if (p && p.length) { s.path = p; s.act = 'walk'; s.job = null; }
}
function cashierAI(loc, s, idx) {
  const g = loc.grid, cc = C(loc);
  if (!cc.counters.length) { s.status = 'Needs a Counter'; return; }
  // validate / assign a counter (spread cashiers out)
  if (s.counter && g[s.counter.split(',')[1]][s.counter.split(',')[0]] !== TILE.COUNTER) s.counter = null;
  const load = {};
  loc.staff.forEach(o => { if (o !== s && o.role === 'cashier' && o.counter) load[o.counter] = (load[o.counter] || 0) + 1; });
  if (!s.counter || (load[s.counter] && cc.counters.some(k => !load[k.key]))) {
    const free = cc.counters.filter(k => !load[k.key] && cc.reach[k.key]);
    const pool = free.length ? free : cc.counters;
    s.counter = pick(pool).key; s.act = 'idle'; s.path = [];
  }
  const [tx, ty] = s.counter.split(',').map(Number);
  const onIt = (s.x === tx && s.y === ty);
  if (!onIt) {
    if (s.act !== 'walk') {
      const p = bfs(g, s.x, s.y, (x, y) => x === tx && y === ty, (x, y) => walkable(g, x, y) || (x === tx && y === ty));
      if (!p) { s.status = 'No path to counter'; return; }
      s.path = p; s.act = 'walk';
    }
    s.status = 'Walking to counter';
    const r = stepEntity(s, 1, (x, y) => walkable(g, x, y) || (x === tx && y === ty));
    if (r === 'blocked') { s.act = 'idle'; s.path = []; }
    if (r === 'done') s.act = 'idle';
    return;
  }
  s.act = 'at';
  const c = stationOf(loc, s.counter);
  if (c && (c.kind !== 'critic' || evm('critic', loc, '') === 'staff' || sk(s, 'qua') >= 5)) {
    s.timer = (s.timer || 0) + 1;
    s.status = 'Serving customer';
    if (s.timer >= 2) {
      const r = trySell(loc, c, false, s);
      if (r === 'sold') s.timer = 0; else s.status = c.want ? 'Waiting for ' + RECIPE_BY_ID[c.want].name : 'Waiting for coffee';
    }
  } else if (c) { s.status = 'Critic! Serve them yourself'; s.timer = 0; }
  else { s.status = 'Ready at counter'; s.timer = 0; }
}
// Restockers (and managers) re-order milk, cups, the house blend and every pantry item the menu needs.
function restockRun(loc, s, vis, mgr) {
  const sp = mgr ? 1 : sk(s, 'spd'), qa = mgr ? 0 : sk(s, 'qua'), ch = mgr ? 0 : sk(s, 'cha');
  const lim = 6 + 4 * sp, packs = sp >= 5 ? 2 : 1, disc = 1 - 0.04 * qa - (qa >= 5 ? 0.15 : 0);
  const list = ['milk', 'cups', loc.restockerTargetBean];
  for (let i = 0; i < loc.menu.length; i++) {
    const r = RECIPE_BY_ID[loc.menu[i]];
    if (r) for (let j = 0; j < r.ing.length; j++) if (list.indexOf(r.ing[j]) < 0) list.push(r.ing[j]);
  }
  for (let i = 0; i < list.length; i++) {
    const ing = list[i], lowAt = SUPPLY[ing].pantry ? Math.ceil(lim / 2) + 1 : lim;
    if (loc.inventory[ing] >= lowAt || !unlocked(ing, loc) || state.globalMoney < supplyPrice(ing, loc) * disc) continue;
    if (buySupplies(ing, loc, packs, true, disc)) {
      let bonus = '';
      if (ch && Math.random() < 0.03 * ch * (ch >= 5 ? 2 : 1)) { loc.inventory[ing] += packSize(ing); bonus = ' (free pack!)'; }
      gainXP(loc, s, 3);
      if (vis) fxText(s.x * TS + 16, s.y * TS - 6, 'Restocked ' + SUPPLY[ing].short + '!' + bonus, '#34d399', 11);
    }
  }
}
function wander(loc, s) {
  const g = loc.grid;
  if (s.path && s.path.length) { stepEntity(s, 2, (x, y) => walkable(g, x, y)); return; }
  if (s.cd > 0) { s.cd--; return; }
  if (Math.random() < 0.08) {
    const adj = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(d => ({ x: s.x + d[0], y: s.y + d[1] })).filter(p => walkable(g, p.x, p.y));
    if (adj.length) s.path = [pick(adj)];
  }
}
function managerAI(loc, s, idx) {
  s.status = 'Running the shop';
  if ((loc.tickCount + s.id.length) % 5 === 0) restockRun(loc, s, idx === cur, true);
  if (loc.tickCount % 10 === 0) gainXP(loc, s, 1);
  wander(loc, s);
}
function restockerAI(loc, s, idx) {
  const vis = (idx === cur);
  s.status = 'Watching supplies';
  if ((loc.tickCount + s.id.length) % 5 === 0) restockRun(loc, s, vis, false);
  const g = loc.grid;
  if (s.path && s.path.length) { stepEntity(s, 2, (x, y) => walkable(g, x, y)); return; }
  if (s.cd > 0) { s.cd--; return; }
  if (Math.random() < 0.08) {
    const adj = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(d => ({ x: s.x + d[0], y: s.y + d[1] })).filter(p => walkable(g, p.x, p.y));
    if (adj.length) s.path = [pick(adj)];
  }
}
function buySupplies(type, loc, packs, silent, disc) {
  loc = loc || curLoc();
  packs = packs || 1;
  if (!SUPPLY[type] || !unlocked(type, loc)) return 0;
  const price = Math.max(1, Math.round(supplyPrice(type, loc) * (disc || 1)));
  let n = 0;
  for (let i = 0; i < packs; i++) {
    if (state.globalMoney < price) break;
    state.globalMoney -= price; state.stats.spent += price;
    loc.inventory[type] += packSize(type); n++;
  }
  if (n) rt.dirtyUI = true;
  return n;
}

