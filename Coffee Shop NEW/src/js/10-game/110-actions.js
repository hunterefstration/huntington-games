// ----- actions -----
function interact(loc, x, y) {
  const v = loc.grid[y][x], key = x + ',' + y, px = x * TS + 16, py = y * TS;
  if (v === TILE.BREWER) {
    const r = startBrew(loc, x, y);
    if (r === 'ok') {
      const b = loc.activeBrews[key];
      fxText(px, py - 2, 'Brewing ' + TIER_NAME[Math.max(0, BEANS.indexOf(b.type))] + '...', '#fbbf24', 12);
      fxSteam(px, py + 8, 3); Snd.play('brew'); updateUI(); tutorialCheck();
    } else if (r === 'busy') { fxText(px, py - 2, 'Busy...', '#d6d3d1', 11); Snd.play('click'); }
    else {
      const msg = { nomilk: 'Out of milk!', nocups: 'Out of cups!', nobeans: 'Out of beans!', nopower: 'No power!', nopref: 'No ' + TIER_NAME[Math.max(0, BEANS.indexOf(loc.brewPref))] + ' beans!' }[r] || 'Cannot brew';
      fxText(px, py - 2, msg, '#f87171', 12); Snd.play('error'); setStatus(r === 'nopower' ? 'The power is out here. Brewers work again when the outage ends.' : msg + ' Order more in the Supplies panel.');
      const sup = { nomilk: 'milk', nocups: 'cups', nobeans: 'beans' }[r];
      if (sup) flashSupply(sup);
    }
  } else if (v === TILE.COUNTER) {
    const c = stationOf(loc, key);
    if (!c) { fxText(px, py - 2, 'No customer', '#d6d3d1', 11); Snd.play('click'); return; }
    const r = trySell(loc, c, true);
    if (r === 'none') { fxText(px, py - 2, 'Need coffee!', '#f87171', 12); Snd.play('error'); setStatus(c.want ? 'They want ' + orderName(c) + ', but you are out of ingredients and coffee. Brew some coffee!' : 'No coffee ready. Click a Brewer first!'); }
    else { updateUI(); tutorialCheck(); requestSave(); }
  }
}
function flashSupply(k) {
  const row = $('sup-' + k); if (!row) return;
  if (layoutMode !== 'wide') { const tb = document.querySelector('#tabs button[data-tab="supply"]'); if (tb) { tb.classList.add('pulse'); setTimeout(() => tb.classList.remove('pulse'), 2500); } }
  row.classList.add('pulse'); setTimeout(() => row.classList.remove('pulse'), 2500);
}
function buildTile(loc, id, x, y, first) {
  const cb = canBuild(loc, id, x, y);
  const px = x * TS + 16, py = y * TS;
  if (!cb.ok) {
    if (first && cb.why && cb.why !== 'Already here') {
      fxText(px, py - 2, cb.poor ? 'Need ' + money(cb.cost) : 'Blocked', '#f87171', 12);
      Snd.play('error'); setStatus(cb.why);
    }
    return;
  }
  if (cb.cost === 0) { loc.free[id] = (loc.free[id] || 0) + 1; fxText(px, py - 2, 'Free!', '#4ade80', 12); }
  else { state.globalMoney -= cb.cost; state.stats.spent += cb.cost; fxText(px, py - 2, '-' + money(cb.cost), '#fca5a5', 12); }
  loc.grid[y][x] = TOOL_BY_ID[id].tile;
  markDirty(loc);
  fxSteam(px, py + 18, 2);
  Snd.play('build');
  if (id !== 'floor') log('Built ' + TOOL_BY_ID[id].name + (cb.cost ? ' for ' + money(cb.cost) : ' (free)') + '.', '');
  tutorialCheck(); updateUI(); requestSave();
}
function eraseTile(loc, x, y, first) {
  const v = loc.grid[y][x];
  if (v === TILE.EMPTY) return;
  const tid = TILE_TOOL[v], refund = Math.floor((BASE_PRICES[tid] || 0) * 0.5);
  delete loc.activeBrews[x + ',' + y];
  loc.grid[y][x] = TILE.EMPTY;
  if (refund) { state.globalMoney += refund; fxText(x * TS + 16, y * TS - 2, '+' + money(refund), '#86efac', 12); }
  markDirty(loc);
  Snd.play('erase');
  updateUI(); requestSave();
}
function clickTile(x, y, first) {
  const loc = curLoc();
  gfx.lastKey = x + ',' + y;
  if (tool === 'cursor') { if (first) interact(loc, x, y); return; }
  if (tool === 'erase') eraseTile(loc, x, y, first);
  else buildTile(loc, tool, x, y, first);
}
function brewAll() {
  const loc = curLoc(), cc = C(loc);
  let n = 0, last = '';
  cc.brewers.forEach(b => { const r = startBrew(loc, b.x, b.y); if (r === 'ok') { n++; fxText(b.x * TS + 16, b.y * TS - 2, 'Brewing...', '#fbbf24', 11); } else if (r !== 'busy') last = r; });
  if (n) { Snd.play('brew'); updateUI(); tutorialCheck(); }
  else {
    Snd.play('error');
    toast(last === 'nopower' ? 'The power is out here!' : last === 'nomilk' ? 'Out of milk!' : last === 'nocups' ? 'Out of cups!' : last ? 'Out of beans!' : (cc.brewers.length ? 'All machines are busy.' : 'Build a Brewer first.'), 'bad', 'warn');
  }
}
function hireStaff(role) {
  const loc = curLoc(), n = loc.staff.filter(s => s.role === role).length, R = ROLES[role];
  if (R.rank && rankIdx() < R.rank) { toast(R.name + 's unlock at rank: ' + RANKS[R.rank].n, 'bad', 'lock'); Snd.play('error'); return; }
  if (n >= R.max) { toast(R.max === 1 ? 'This shop already has a ' + R.name + '.' : 'That is the most ' + R.name + 's one shop can use.', 'bad', 'warn'); Snd.play('error'); return; }
  const cost = getStaffCost(loc, role);
  if (state.globalMoney < cost) { toast('You need ' + money(cost) + ' to hire a ' + ROLES[role].name + '.', 'bad', 'coin'); Snd.play('error'); return; }
  state.globalMoney -= cost; state.stats.spent += cost;
  const cc = C(loc);
  let sx = 7, sy = 7;
  if (cc.doors.length) { sx = cc.doors[0].x; sy = cc.doors[0].y; }
  else { outer: for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (loc.grid[y][x] === TILE.FLOOR) { sx = x; sy = y; break outer; } }
  const used = loc.staff.map(s => s.name);
  const names = STAFF_NAMES.filter(x => used.indexOf(x) < 0);
  const s = newStaffObj(uid(role), role, sx, sy, pick(names.length ? names : STAFF_NAMES));
  loc.staff.push(s);
  log('Hired ' + s.name + ' the ' + ROLES[role].name + '.', 'good');
  fxText(sx * TS + 16, sy * TS - 4, 'Welcome, ' + s.name + '!', '#fbbf24', 12);
  Snd.play('hire'); tutorialCheck(); updateUI(); requestSave();
}
function fireStaff(id) {
  const loc = curLoc(), s = loc.staff.find(x => x.id === id);
  if (!s) return;
  const go = () => { loc.staff = loc.staff.filter(x => x.id !== id); log(s.name + ' the ' + ROLES[s.role].name + ' left the team.', ''); Snd.play('erase'); if (dlgKind === 'staff') closeDlg(); updateUI(); requestSave(); };
  if (settings.confirm) ask('Fire ' + s.name + '?', 'This ' + ROLES[s.role].name.toLowerCase() + ' will leave and you will not get the hiring cost back.', 'Fire', go, true);
  else go();
}
function buyPack(type, packs) {
  const loc = curLoc();
  if (!SUPPLY[type]) return;
  const price = supplyPrice(type, loc);
  if (!unlocked(type)) { toast(lockWhy(type), 'bad', 'lock'); Snd.play('error'); return; }
  if (state.globalMoney < price) { Snd.play('error'); toast('Not enough money (' + money(price) + ' needed).', 'bad', 'coin'); return; }
  const n = buySupplies(type, loc, packs);
  if (n) { Snd.play('coin'); updateUI(); requestSave(); if (dlgKind === 'recipes') renderDlg(true); }
}
function tryExpand() {
  const n = state.locations.length;
  if (n >= MAX_SHOPS) { toast('You own the maximum of ' + MAX_SHOPS + ' shops. Keep growing with franchises!', 'info', 'store'); openDlg('chain'); return; }
  openDlg('city');      // the picker explains rank limits and still lets you unlock cities
}
// Open a new full shop in a city you have unlocked.
function openShopIn(cityId) {
  const ci = CITY_BY_ID[cityId], n = state.locations.length;
  if (!ci) return;
  if (!state.cities[cityId]) { toast('Unlock ' + ci.name + ' first.', 'bad', 'lock'); Snd.play('error'); return; }
  if (n >= MAX_SHOPS || n >= maxShopsAllowed()) { toast(n >= MAX_SHOPS ? 'You already own the maximum of ' + MAX_SHOPS + ' shops! Try a franchise instead.' : 'Reach the rank "' + RANKS[n - 1].n + '" to open shop ' + (n + 1) + '.', 'bad', 'lock'); Snd.play('error'); return; }
  const cost = shopCost(n);
  if (state.globalMoney < cost) { toast('Shop ' + (n + 1) + ' costs ' + money(cost) + '.', 'bad', 'coin'); Snd.play('error'); return; }
  const go = () => {
    if (state.globalMoney < cost || state.locations.length !== n) return;
    state.globalMoney -= cost; state.stats.spent += cost;
    const loc = newLocation(themeIdx(ci.theme), cityId);
    if (cityId !== 'home') {
      const same = state.locations.filter(l => l.city === cityId).length;
      loc.name = ci.short + (same ? ' ' + (same + 1) : '');
    }
    state.locations.push(loc); state.unlockedLocations = state.locations.length;
    const nm = locName(loc, state.locations.length - 1);
    log('Opened ' + nm + ' in ' + ci.name + '! It comes with a free starter kit (door, floors, counter, brewer).', 'good');
    toast(nm + ' is open in ' + ci.name + '! A free starter kit is included.', 'goal', 'store');
    Snd.play('goal');
    if (dlgKind) closeDlg();
    switchShop(state.locations.length - 1);
    requestSave();
  };
  if (settings.confirm) ask('Open shop ' + (n + 1) + ' in ' + ci.name + '?', 'A new location costs ' + money(cost) + '. It has its own supplies and staff, and comes with a free starter kit.' + (ci.rent ? ' Rent here is ' + money(ci.rent) + ' per day.' : ''), 'Open for ' + money(cost), go);
  else go();
}
function unlockCity(cityId) {
  const ci = CITY_BY_ID[cityId];
  if (!ci || state.cities[cityId]) return;
  if (rankIdx() < ci.rank) { toast(ci.name + ' unlocks at rank: ' + RANKS[ci.rank].n, 'bad', 'lock'); Snd.play('error'); return; }
  if (state.globalMoney < ci.unlock) { toast('Unlocking ' + ci.name + ' costs ' + money(ci.unlock) + '.', 'bad', 'coin'); Snd.play('error'); return; }
  state.globalMoney -= ci.unlock; state.stats.spent += ci.unlock;
  state.cities[cityId] = true;
  log('You can now do business in ' + ci.name + '!', 'good');
  toast(ci.name + ' unlocked! Open a shop or a franchise there.', 'goal', 'pin');
  Snd.play('upgrade'); renderDlg(true); updateUI(); requestSave();
}
// ----- franchise actions -----
function openFranchise(cityId) {
  const ci = CITY_BY_ID[cityId];
  if (!ci) return;
  if (!state.cities[cityId]) { toast('Unlock ' + ci.name + ' first.', 'bad', 'lock'); Snd.play('error'); return; }
  if (state.franchises.length >= frMax()) { toast(frMax() ? 'Rank up to open more franchises (max ' + frMax() + ' right now).' : 'Franchises unlock at rank: ' + RANKS[2].n, 'bad', 'lock'); Snd.play('error'); return; }
  const cost = frOpenCost(cityId);
  if (state.globalMoney < cost) { toast('A franchise in ' + ci.name + ' costs ' + money(cost) + '.', 'bad', 'coin'); Snd.play('error'); return; }
  const go = () => {
    if (state.globalMoney < cost || state.franchises.length >= frMax()) return;
    state.globalMoney -= cost; state.stats.spent += cost;
    const used = state.franchises.map(f => f.name);
    let name = ci.short + ' ' + pick(FR_NAMES), guard = 0;
    while (used.indexOf(name) >= 0 && guard++ < 20) name = ci.short + ' ' + pick(FR_NAMES);
    const f = { id: uid('f'), city: cityId, name: name, lv: 1, mgr: 1, mname: pick(STAFF_NAMES), paid: cost, earned: 0, acc: 0 };
    state.franchises.push(f);
    log('Opened the franchise ' + f.name + ' in ' + ci.name + ', run by ' + f.mname + '.', 'good');
    toast(f.name + ' franchise is open! It earns ' + money(frNet(f)) + '/min for you.', 'goal', 'building');
    Snd.play('goal'); renderDlg(true); updateUI(); requestSave();
  };
  if (settings.confirm) ask('Open a franchise in ' + ci.name + '?', 'Costs ' + money(cost) + '. A franchise manager runs it for you and it pays about ' + money(frNet({ city: cityId, lv: 1, mgr: 1 })) + '/min (more with reputation, recipes and upgrades).', 'Open for ' + money(cost), go);
  else go();
}
function franchiseAct(kind, id) {
  const f = state.franchises.find(x => x.id === id);
  if (!f) return;
  if (kind === 'up') {
    if (f.lv >= FR_MAX_LV) return;
    const cost = frUpCost(f);
    if (state.globalMoney < cost) { toast('Expanding costs ' + money(cost) + '.', 'bad', 'coin'); Snd.play('error'); return; }
    state.globalMoney -= cost; state.stats.spent += cost; f.paid += cost; f.lv++;
    log(f.name + ' expanded to level ' + f.lv + '.', 'good'); Snd.play('upgrade');
  } else if (kind === 'train') {
    if (f.mgr >= FR_MGR_MAX) return;
    const cost = frTrainCost(f);
    if (state.globalMoney < cost) { toast('Training costs ' + money(cost) + '.', 'bad', 'coin'); Snd.play('error'); return; }
    state.globalMoney -= cost; state.stats.spent += cost; f.paid += cost; f.mgr++;
    log(f.mname + ', manager of ' + f.name + ', is now level ' + f.mgr + '.', 'good'); Snd.play('upgrade');
  } else if (kind === 'sell') {
    const val = frSellValue(f);
    const go = () => {
      const i = state.franchises.indexOf(f); if (i < 0) return;
      state.franchises.splice(i, 1); state.globalMoney += val;
      log('Sold the franchise ' + f.name + ' for ' + money(val) + '.', ''); Snd.play('coin'); renderDlg(true); updateUI(); requestSave();
    };
    ask('Sell ' + f.name + '?', 'You get ' + money(val) + ' back (half of what you invested) and lose its income.', 'Sell for ' + money(val), go, true);
    return;
  }
  renderDlg(true); updateUI(); requestSave();
}
function chainIncome() { let t = frTotal(); state.locations.forEach(l => { t += l.rate; }); return t; }
// ----- staff skill actions -----
function trainStaff(id) {
  const loc = curLoc(), s = loc.staff.find(x => x.id === id);
  if (!s || s.train) return;
  if (s.lv >= STAFF_MAX_LV) { toast(s.name + ' is already at the max level.', 'info', 'star'); return; }
  const cost = trainCost(s);
  if (state.globalMoney < cost) { toast('Training costs ' + money(cost) + '.', 'bad', 'coin'); Snd.play('error'); return; }
  state.globalMoney -= cost; state.stats.spent += cost;
  s.train = trainTicks(loc, s); s.job = null; s.counter = null; s.act = 'idle'; s.path = []; s.status = 'At training';
  log(s.name + ' went to training (' + money(cost) + ').', '');
  Snd.play('hire'); renderDlg(true); updateUI(); requestSave();
}
function learnSkill(id, b) {
  const s = curLoc().staff.find(x => x.id === id);
  if (!s || !SKILLS[b] || s.pts < 1 || s.sk[b] >= 5) return;
  s.pts--; s.sk[b]++;
  if (s.sk[b] === 5) toast(s.name + ' unlocked a perk: ' + SKILL_FX[s.role][b][1].split(':')[0] + '!', 'goal', SKILLS[b].icon);
  Snd.play('upgrade'); computeRating(curLoc()); renderDlg(true); updateUI(); requestSave();
}
// ----- recipe actions -----
function labToggle(k) {
  const L = rt.lab, i = L.ing.indexOf(k);
  if (i >= 0) L.ing.splice(i, 1);
  else {
    if (!unlocked(k) && curLoc().inventory[k] < 1) { toast(lockWhy(k), 'bad', 'lock'); Snd.play('error'); return; }
    if (L.ing.length >= 3) { toast('Pick up to 3 ingredients.', 'info', 'flask'); return; }
    L.ing.push(k);
  }
  Snd.play('click'); renderDlg(true);
}
function labFee(base) { return base >= 2 ? 40 : (base === 1 ? 20 : 10); }
function experiment() {
  const L = rt.lab, loc = curLoc(), inv = loc.inventory;
  const say = (msg, cls) => { L.msg = msg; L.cls = cls; renderDlg(true); };
  if (!L.ing.length) { Snd.play('error'); return say('Pick at least one ingredient first.', 'bad'); }
  if (L.base === 2 && !unlocked('beans_luxury')) { Snd.play('error'); return say('Luxury coffee unlocks at rank: ' + RANKS[1].n + '.', 'bad'); }
  const fee = labFee(L.base);
  if (state.globalMoney < fee) { Snd.play('error'); return say('You need ' + money(fee) + ' to run an experiment.', 'bad'); }
  const miss = L.ing.filter(k => inv[k] < 1);
  if (miss.length) { Snd.play('error'); return say(locName(loc, cur) + ' has no ' + miss.map(k => SUPPLY[k].name).join(' or ') + '. Buy some below or in the Pantry.', 'bad'); }
  state.globalMoney -= fee; state.stats.spent += fee;
  L.ing.forEach(k => { inv[k]--; });
  const same = (a, b) => a.length === b.length && a.every(x => b.indexOf(x) >= 0);
  const hit = RECIPES.find(r => r.base === L.base && same(r.ing, L.ing));
  if (hit && state.recipes[hit.id]) { Snd.play('click'); return say('Tasty, but you already know this one: ' + hit.name + '.', 'info'); }
  if (hit) {
    state.recipes[hit.id] = true;
    modifyReputation(3);
    let added = '';
    if (loc.menu.length < menuSlots() && loc.menu.indexOf(hit.id) < 0) { loc.menu.push(hit.id); added = ' It is now on the menu at ' + locName(loc, cur) + '.'; }
    log('New recipe discovered: ' + hit.name + '!', 'good');
    toast('New recipe: ' + hit.name + '!', 'goal', 'flask');
    Snd.play('goal'); computeRating(loc); requestSave();
    return say('Eureka! You invented ' + hit.name + ' (sells for ' + money(hit.price) + ', loved by customers who like ' + hit.tags.map(t => TAG_NAME[t]).join(' or ') + ').' + added, 'good');
  }
  // no match: give a useful clue
  let best = 0, close = null;
  RECIPES.forEach(r => {
    if (state.recipes[r.id]) return;
    const common = L.ing.filter(k => r.ing.indexOf(k) >= 0).length;
    if (!common) return;
    const sc = common * 2 - (L.ing.length - common) - (r.ing.length - common) + (r.base === L.base ? 2 : 0);
    if (sc > best) { best = sc; close = r; }
  });
  Snd.play('error');
  if (!close) return say('Yuck! Nobody would order that. Try other flavors.', 'bad');
  const common = L.ing.filter(k => close.ing.indexOf(k) >= 0).length;
  if (common === close.ing.length && L.ing.length === close.ing.length) return say('Great flavors, wrong base! Try it with ' + BASE_NAME[close.base + 1].toLowerCase() + '.', 'info');
  if (close.base === L.base && common === L.ing.length) return say('So close! It needs ' + (close.ing.length - common) + ' more ingredient' + (close.ing.length - common > 1 ? 's' : '') + '.', 'info');
  if (close.base === L.base) return say('Something in here works, but something else does not belong.', 'info');
  return say('Interesting... one of these flavors could work with a different base.', 'info');
}
function menuToggle(id) {
  const loc = curLoc(), r = RECIPE_BY_ID[id];
  if (!r || !state.recipes[id]) return;
  const i = loc.menu.indexOf(id);
  if (i >= 0) loc.menu.splice(i, 1);
  else {
    if (loc.menu.length >= menuSlots()) { toast('The menu is full (' + menuSlots() + ' slots). Remove a special or buy the Specials Board upgrade.', 'bad', 'book'); Snd.play('error'); return; }
    if (r.base === 2 && !unlocked('beans_luxury')) { toast('Luxury drinks unlock at rank: ' + RANKS[1].n, 'bad', 'lock'); Snd.play('error'); return; }
    loc.menu.push(id);
  }
  Snd.play('click'); computeRating(loc); renderDlg(true); updateUI(); requestSave();
}
function hintCost(r) { return 40 * (1 + (state.rhint[r.id] || 0)) * (r.base + 2); }
function buyHint(id) {
  const r = RECIPE_BY_ID[id];
  if (!r || state.recipes[id]) return;
  const h = state.rhint[id] || 0;
  if (h >= r.ing.length - 1 && r.ing.length > 1) return;
  if (r.ing.length === 1 && h >= 1) return;
  const cost = hintCost(r);
  if (state.globalMoney < cost) { toast('A hint costs ' + money(cost) + '.', 'bad', 'coin'); Snd.play('error'); return; }
  state.globalMoney -= cost; state.stats.spent += cost;
  state.rhint[id] = h + 1;
  Snd.play('coin'); renderDlg(true); updateUI(); requestSave();
}
function switchShop(i) {
  if (i < 0 || i >= state.locations.length) return;
  cur = i; fxClear(); gfx.staticDirty = true; gfx.hover = null; V.shopSig = null; V.staffSig = null;
  Snd.play('click'); updateUI();
}
function buyUpgrade(id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u) return;
  const lv = U(id);
  if (lv >= u.max) return;
  const cost = upgradeCost(u);
  if (state.globalMoney < cost) { Snd.play('error'); toast('Not enough money (' + money(cost) + ').', 'bad', 'coin'); return; }
  state.globalMoney -= cost; state.stats.spent += cost;
  state.upgrades[id] = lv + 1;
  log('Upgraded ' + u.name + ' to level ' + (lv + 1) + '.', 'good');
  Snd.play('upgrade'); tutorialCheck(); updateUI(); refreshDlg(); requestSave();
}
function togglePause() { paused = !paused; if (!paused) lastSim = performance.now(); updateUI(); Snd.play('click'); }
function cycleSpeed() { speed = speed === 1 ? 2 : (speed === 2 ? 3 : 1); updateUI(); Snd.play('click'); }

