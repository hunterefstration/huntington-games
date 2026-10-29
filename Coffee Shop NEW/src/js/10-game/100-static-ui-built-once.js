// ----- static UI built once -----
const SUP_COL = { beans: '#78350f', beans_premium: '#b45309', beans_luxury: '#7e22ce', milk: '#2563eb', cups: '#6b7280',
  choc: '#5b3a1e', caramel: '#c2410c', cinnamon: '#9a3412', ice: '#0891b2', flour: '#a8a29e', vanilla: '#ca8a04', berries: '#be185d', matcha: '#4d7c0f',
  honey: '#d97706', lemon: '#a16207', pumpkin: '#ea580c', mint: '#dc2626' };
function buildStaticUI() {
  const toolBtn = t => '<button class="tool" data-act="tool" data-tool="' + t.id + '" id="tool-' + t.id + '" title="' + esc(t.tip) + '">' + icon(t.icon) + '<span>' + t.name + '</span><small id="tc-' + t.id + '"></small></button>';
  $('tools').innerHTML = MAIN_TOOLS.map(toolBtn).join('');
  $('decor').innerHTML = TOOLS.filter(t => t.deco).map(toolBtn).join('');
  $('hire').innerHTML = Object.keys(ROLES).map(r => '<button class="hrow" data-act="hire" data-role="' + r + '" id="hire-' + r + '"><span class="ico" style="background:' + ROLES[r].col + '">' + icon(ROLES[r].icon) + '</span><span class="nm"><b>' + ROLES[r].name + ' <small id="hc-' + r + '"></small></b><small>' + ROLES[r].desc + '</small></span><span class="pr" id="hp-' + r + '"></span></button>').join('');
  $('seg-brew').innerHTML = [['auto', 'Auto'], ['beans', 'Basic'], ['beans_premium', 'Premium'], ['beans_luxury', 'Luxury']].map(a => '<button data-act="brewpref" data-v="' + a[0] + '">' + a[1] + '</button>').join('');
  $('seg-blend').innerHTML = [['beans', 'Basic'], ['beans_premium', 'Premium'], ['beans_luxury', 'Luxury']].map(a => '<button data-act="blend" data-v="' + a[0] + '">' + a[1] + '</button>').join('');
  $('ready').innerHTML = [0, 1, 2].map(t => '<div class="chip"><b id="rc' + t + '">0</b><small style="color:' + (t === 0 ? '#d6a15a' : TIER_COLOR[t]) + '">' + TIER_NAME[t] + '</small></div>').join('');
  $('supplies').innerHTML = MAIN_SUP.map(k => {
    const s = SUPPLY[k];
    return '<div class="sup" id="sup-' + k + '"><span class="ico" style="background:' + SUP_COL[k] + '">' + icon(s.icon) + '</span><div class="nm"><b>' + s.name + '</b><div class="meter"><i id="sm-' + k + '"></i></div></div><span class="cnt" id="sc-' + k + '">0</span><div class="btns"><button class="btn" data-act="buy" data-type="' + k + '" data-n="1" id="sb1-' + k + '"></button><button class="btn" data-act="buy" data-type="' + k + '" data-n="5" id="sb5-' + k + '"></button></div></div>';
  }).join('');
  $('pantry').innerHTML = PANTRY.map(k => {
    const s = SUPPLY[k];
    return '<div class="sup mini" id="sup-' + k + '"><span class="ico" style="background:' + SUP_COL[k] + '">' + icon(s.icon) + '</span><div class="nm"><b>' + s.name + '</b></div><span class="cnt" id="sc-' + k + '">0</span><button class="btn" data-act="buy" data-type="' + k + '" data-n="1" id="sb1-' + k + '"></button></div>';
  }).join('');
}

// ----- shop health -----
function healthItems(loc) {
  const cc = C(loc), inv = loc.inventory, items = [];
  const bad = t => items.push({ k: 'bad', t: t });
  if (!cc.doors.length) bad('No Door. Place a Door so customers can come in.');
  if (!cc.counters.length) bad('No Counter. Customers need a Counter to order at.');
  else if (cc.doors.length && !cc.reachCount) bad('Customers cannot reach a Counter. Lay Floor from a Door to a tile touching a Counter.');
  else if (cc.doors.length && cc.reachCount < cc.counters.length) bad((cc.counters.length - cc.reachCount) + ' Counter(s) unreachable (red !). Connect them with Floor.');
  if (!cc.brewers.length) bad('No Brewer. Build one to make coffee.');
  if (inv.milk < 1) bad('Out of Milk!');
  if (inv.cups < 1) bad('Out of Cups!');
  if (inv.beans + inv.beans_premium + inv.beans_luxury < 1) bad('Out of Beans!');
  const waiting = loc.customers.filter(c => c.state === 'waiting').length;
  if (!items.length && waiting && stockTotal(loc) < 1 && brewingCount(loc) < 1) items.push({ k: 'info', t: 'Customers are waiting but no coffee is ready. Brew some!' });
  if (!items.length) items.push({ k: 'good', t: 'Everything looks good here.' });
  return items;
}
function shopAlert(loc) { if (state.locations.length === 1 && state.tutorial >= 0) return 0; return healthItems(loc).some(i => i.k === 'bad') ? 1 : (loc.customers.some(c => c.kind === 'critic') ? 2 : 0); }

// ----- main UI refresh -----
function updateUI() {
  if (!state || !running) return;
  const loc = curLoc(), cc = C(loc);
  const m = Math.floor(state.globalMoney);
  if (V.money !== m) {
    T('v-money', money(m)); $('v-money').title = '$' + m.toLocaleString();
    if (V.money !== undefined && m !== V.money) flash($('v-money'), m > V.money ? 'flashup' : 'flashdown');
    V.money = m;
  }
  const rep = Math.round(state.reputation);
  if (V.rep !== rep) { T('v-rep', String(rep)); if (V.rep !== undefined) { $('v-rep').classList.remove('pop'); void $('v-rep').offsetWidth; $('v-rep').classList.add('pop'); } V.rep = rep; }
  T('v-rate', money(incomePerMin()));
  const sat = satisfaction();
  $('v-rep').parentNode.title = 'Reputation (0-500): more customers and fancier orders.' + (sat === null ? '' : ' Customer happiness lately: ' + sat + '%.');
  const ri = rankIdx(), nxt = RANKS[ri + 1];
  T('v-rank', RANKS[ri].n);
  const pct = nxt ? clamp((state.stats.earned - RANKS[ri].at) / (nxt.at - RANKS[ri].at), 0, 1) * 100 : 100;
  const rb = E['v-rankbar'] || (E['v-rankbar'] = $('v-rankbar'));
  const pw = pct.toFixed(1) + '%'; if (V.rankw !== pw) { V.rankw = pw; rb.style.width = pw; }
  $('st-rank').title = nxt ? 'Rank: ' + RANKS[ri].n + '. Earn ' + money(nxt.at - state.stats.earned) + ' more to reach ' + nxt.n : 'Top rank reached!';
  const hr = (state.tick % DAY_TICKS) / DAY_TICKS * 24, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60 / 10) * 10;
  T('v-clock', ((hh % 12) || 12) + ':' + (mm < 10 ? '0' : '') + mm + (hh < 12 ? ' AM' : ' PM'));
  const si = seasonIdx(), hol = curHoliday(), dk = dayIdx() + '|' + si;
  if (V.dayKey !== dk) {
    V.dayKey = dk;
    const S = SEASONS[si], el = $('v-season');
    el.innerHTML = icon(hol ? hol.icon : S.icon); el.style.color = S.col;
    T('v-day', hol ? hol.name : S.name + ' ' + (seasonDay() + 1));
    $('v-day').style.color = hol ? '#fde68a' : '';
    $('st-clock').title = 'Day ' + (dayIdx() + 1) + ' - ' + S.name + ', day ' + (seasonDay() + 1) + ' of ' + SEASON_DAYS + ', year ' + yearNum() + (hol ? '. Today: ' + hol.name + '!' : '') + ' Click for the calendar.';
    toggleCls($('st-clock'), 'hol', !!hol);
  }
  const night = hh < 6 || hh >= 20;
  if (V.night !== night) { V.night = night; $('v-sun').innerHTML = icon(night ? 'moon' : 'sun'); }
  // pause / speed
  const bp = $('b-pause'); if (V.paused !== paused) { V.paused = paused; bp.innerHTML = icon(paused ? 'play' : 'pause'); bp.classList.toggle('on', paused); $('pausedtag').classList.toggle('hidden', !paused); }
  T('b-speed', speed + 'x');
  uiShops(); uiBuild(loc, cc); uiStaff(loc); uiSupply(loc, cc); uiEventBar(); uiGoalBar();
  gfx.arrow = tutArrow(loc);
  if (!gfx.hover && performance.now() - (V.statusAt || 0) > 7000) { V.tipI = ((V.tipI || 0) + 1) % TIPS.length; T('status-text', TIPS[V.tipI]); V.statusAt = performance.now() - 2000; }
  if (rt.rankUp && !dlgKind && !askCb) { openDlg('rank'); }
  else if (state.pendingEv && !dlgKind && !askCb) { openDlg('event'); }
  else if (rt.careerPop && !dlgKind && !askCb && $('menu').classList.contains('hidden')) { rt.careerPop = false; if (careerOn()) openDlg('career'); }
  if (dlgKind && (dlgKind === 'goals' || dlgKind === 'stats') && state.tick % 5 === 0) refreshDlg();
  if (dlgKind === 'upgrades') document.querySelectorAll('#dlg-body [data-act="upgrade"]').forEach(b => { const u = UPGRADES.find(x => x.id === b.dataset.id); const can = u && state.globalMoney >= upgradeCost(u); b.classList.toggle('primary', can); b.classList.toggle('dis', !can); });
  if (dlgKind) liveDlg();
  const nk = recipesKnown(), slots = menuSlots(), free = nk > loc.menu.length && loc.menu.length < slots;
  const be = E['b-rec-n'] || (E['b-rec-n'] = $('b-rec-n'));
  if (be && V.recBadge !== free) { V.recBadge = free; be.textContent = '!'; be.classList.toggle('hidden', !free); $('b-rec').title = free ? 'Recipes (R): you have a free menu slot here!' : 'Recipes and lab (R)'; }
  const cr = careerOn() && chapterReady();
  if (V.carBadge !== cr) { V.carBadge = cr; toggleCls($('b-car-n'), 'hidden', !cr); toggleCls($('b-career'), 'glow', cr); $('b-career').title = cr ? 'Career (K): chapter complete, claim your reward!' : 'Career story and championships (K)'; }
  const an = loc.art.length, ac = artCap(), asig = an + '/' + ac;
  if (V.artSig !== asig) {
    V.artSig = asig;
    let h = ''; for (let i = 0; i < ac; i++) h += '<i class="' + (i < an ? 'on' : '') + '"></i>';
    H('artcups', h + '<small>' + an + '/' + ac + '</small>');
    $('artcups').title = an + ' latte art cup' + (an === 1 ? '' : 's') + ' ready at this shop (max ' + ac + '). Each one gives a customer a bonus tip.';
  }
  rt.dirtyUI = false;
}
// Cheap live refresh for open dialogs: affordability on [data-cost] buttons plus a few changing numbers.
function liveDlg() {
  const body = $('dlg-body');
  const bs = body.querySelectorAll('[data-cost]');
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i], can = state.globalMoney >= +b.dataset.cost && !b.dataset.lock;
    b.classList.toggle('dis', !can);
    if (b.dataset.pri) b.classList.toggle('primary', can);
  }
  if (dlgKind === 'staff') {
    const s = curLoc().staff.find(x => x.id === rt.staffSel);
    if (!s) return;
    const sig = s.lv + ':' + s.pts + ':' + (s.train ? 1 : 0);
    if (V.sdSig !== sig) { V.sdSig = sig; renderDlg(true); return; }
    const xb = $('sd-xp'); if (xb) xb.style.width = (s.lv >= STAFF_MAX_LV ? 100 : clamp(s.xp / xpNeed(s.lv) * 100, 0, 100)).toFixed(1) + '%';
    const xt = $('sd-xpt'); if (xt) xt.textContent = s.lv >= STAFF_MAX_LV ? 'Max level' : Math.floor(s.xp) + ' / ' + xpNeed(s.lv) + ' XP';
    const tt = $('sd-train'); if (tt && s.train) tt.textContent = 'At training: back in ' + Math.ceil(s.train / 5) + 's with a new level.';
  } else if (dlgKind === 'chain' && state.tick % 5 === 0) {
    const t = $('ch-inc'); if (t) t.textContent = money(chainIncome()) + '/min';
    state.franchises.forEach(f => { const el = $('fr-inc-' + f.id); if (el) el.textContent = money(frNet(f)) + '/min'; const ee = $('fr-earn-' + f.id); if (ee) ee.textContent = money(f.earned); });
  }
}
function uiShops() {
  const n = state.locations.length;
  const sig = n + '|' + cur + '|' + state.locations.map((l, i) => locName(l, i) + shopAlert(l)).join(',');
  if (V.shopSig !== sig) {
    V.shopSig = sig;
    $('shoptabs').innerHTML = state.locations.map((l, i) => {
      const a = shopAlert(l);
      return '<button class="stab' + (i === cur ? ' on' : '') + '" data-act="shop" data-i="' + i + '" title="' + esc(locName(l, i) + ' - ' + cityOf(l).name) + '">' + icon('store') + esc(locName(l, i)) + '<span class="dot' + (a ? (a === 2 ? ' crit' : '') : ' ok') + '" title="' + (a === 2 ? 'A critic is here!' : 'Needs attention') + '"></span></button>';
    }).join('');
  }
  const b = $('b-expand');
  let label, lock = false;
  if (n >= MAX_SHOPS) { label = 'Max shops'; lock = true; }
  else if (n >= maxShopsAllowed()) { label = 'Rank ' + RANKS[n - 1].n; lock = true; }
  else label = 'Shop ' + (n + 1) + ' - ' + money(shopCost(n));
  T('expand-txt', label);
  toggleCls(b, 'lock', lock || state.globalMoney < shopCost(n));
}
function uiBuild(loc, cc) {
  TOOLS.forEach(t => {
    const btn = E['tool-' + t.id] || (E['tool-' + t.id] = $('tool-' + t.id));
    let txt = '', free = false, locked = false, poor = false;
    if ((t.rank && rankIdx() < t.rank) || (t.need && !t.need())) { txt = 'Locked'; locked = true; }
    else if (t.tile !== undefined) { const c = toolCost(loc, t.id); free = (c === 0); txt = c ? money(c) : 'Free'; poor = c > state.globalMoney; }
    else if (t.id === 'erase') txt = '50% back';
    else txt = ' ';
    T('tc-' + t.id, txt);
    const sm = $('tc-' + t.id); toggleCls(sm, 'free', free);
    toggleCls(btn, 'locked', locked); toggleCls(btn, 'poor', poor);
  });
  const amb = cc.amb, rtg = rating(loc), city = cityOf(loc), rp = loc._rp || [0, 0, 0, 0];
  const rtip = 'Decorations +' + rp[0].toFixed(1) + ', barista Quality +' + rp[1].toFixed(1) + ', stocked specials +' + rp[2].toFixed(1) + ', happy customers +' + rp[3].toFixed(1) + '. Higher rating = higher prices and more customers.';
  H('ambience', 'Ambience <b>' + amb + '/' + AMB_CAP + '</b> - customers wait ' + amb + '% longer and come ' + amb + '% more often<div class="bar"><i style="width:' + (amb / AMB_CAP * 100) + '%"></i></div>' +
    '<div class="rating" title="' + esc(rtip) + '">Shop rating ' + starsHtml(rtg) + '<b>' + rtg.toFixed(1) + '</b></div>' +
    '<div class="cityline">' + icon('pin') + ' <b>' + esc(city.name) + '</b>' + (city.price !== 1 ? ' - prices x' + city.price : '') + (city.rent ? ' - rent ' + money(city.rent) + '/day' : ' - no rent') + '</div>');
  const hs = healthItems(loc);
  H('health', hs.map(i => '<div class="hitem ' + i.k + '">' + icon(i.k === 'good' ? 'check' : 'warn') + '<span>' + esc(i.t) + '</span></div>').join(''));
}
function starsHtml(r) {
  let h = '<span class="stars">';
  for (let i = 1; i <= 5; i++) h += r >= i - 0.25 ? '&#9733;' : '<span class="off">&#9733;</span>';
  return h + '</span>';
}
function uiStaff(loc) {
  const sig = cur + '|' + loc.staff.map(s => s.id + s.name + s.lv + ':' + s.pts + (s.train ? 't' : '')).join('|');
  if (V.staffSig !== sig) {
    V.staffSig = sig;
    $('stafflist').innerHTML = loc.staff.length ? loc.staff.map(s => '<div class="srow' + (s.train ? ' away' : '') + '"><span class="dotc" style="background:' + ROLES[s.role].col + '"></span><span class="who"><b>' + esc(s.name) + '</b><span class="lv' + (s.pts > 0 ? ' pts' : '') + '" title="' + (s.pts > 0 ? s.pts + ' skill point(s) to spend!' : 'Level') + '">Lv ' + s.lv + (s.pts > 0 ? ' +' + s.pts : '') + '</span> <small style="display:inline">' + ROLES[s.role].name + '</small><small id="ss-' + s.id + '"></small></span><button class="sk" data-act="staffdlg" data-id="' + s.id + '" title="Skills and training">Skills</button><button class="fire" data-act="fire" data-id="' + s.id + '">Fire</button></div>').join('') : '<div class="empty">No staff here yet.</div>';
    for (const k in E) if (k.indexOf('ss-') === 0) delete E[k];
  }
  loc.staff.forEach(s => T('ss-' + s.id, s.status || 'Getting ready...'));
  const rk = rankIdx();
  Object.keys(ROLES).forEach(r => {
    const R = ROLES[r], cost = getStaffCost(loc, r), n = loc.staff.filter(s => s.role === r).length, lock = R.rank && rk < R.rank;
    T('hp-' + r, lock ? 'Locked' : (n >= R.max ? 'Hired' : money(cost))); T('hc-' + r, n ? 'x' + n : '');
    toggleCls($('hire-' + r), 'dis', lock || state.globalMoney < cost || n >= R.max);
  });
  document.querySelectorAll('#seg-brew button').forEach(b => b.classList.toggle('on', b.dataset.v === (loc.brewPref || 'auto')));
  document.querySelectorAll('#seg-blend button').forEach(b => b.classList.toggle('on', b.dataset.v === loc.restockerTargetBean));
  document.querySelectorAll('#seg-brew button, #seg-blend button').forEach(b => { b.classList.toggle('lock', b.dataset.v === 'beans_luxury' && !unlocked('beans_luxury')); });
}
function uiSupply(loc, cc) {
  const inv = loc.inventory;
  for (let t = 0; t < 3; t++) T('rc' + t, String(inv[COFFEE[t]]));
  const pk = packSize();
  MAIN_SUP.forEach(k => {
    const price = supplyPrice(k, loc), lk = !unlocked(k);
    T('sc-' + k, String(inv[k]));
    const w = Math.min(100, inv[k] / 60 * 100).toFixed(0) + '%';
    const mi = E['sm-' + k] || (E['sm-' + k] = $('sm-' + k)); if (mi._w !== w) { mi._w = w; mi.style.width = w; }
    const row = E['sup-' + k] || (E['sup-' + k] = $('sup-' + k));
    toggleCls(row, 'low', inv[k] < 6); toggleCls(row, 'lockd', lk);
    T('sb1-' + k, lk ? 'Locked' : '+' + pk + '  ' + money(price));
    T('sb5-' + k, lk ? '' : 'x5');
    toggleCls($('sb1-' + k), 'dis', lk || state.globalMoney < price);
    toggleCls($('sb5-' + k), 'dis', lk || state.globalMoney < price);
    $('sb5-' + k).style.display = lk ? 'none' : '';
    $('sb5-' + k).title = 'Buy up to 5 orders (' + money(price * 5) + ')';
  });
  const pp = packSize('choc');
  const si = seasonIdx();
  PANTRY.forEach(k => {
    const S = SUPPLY[k], price = supplyPrice(k, loc), lk = !unlocked(k), sea = S.season !== undefined;
    const row = E['sup-' + k] || (E['sup-' + k] = $('sup-' + k));
    const hide = sea && lk && inv[k] < 1;                 // out-of-season ingredients only show while some are left
    if (row._hide !== hide) { row._hide = hide; row.style.display = hide ? 'none' : ''; }
    if (hide) return;
    T('sc-' + k, lk && !inv[k] ? '' : String(inv[k]));
    T('sb1-' + k, lk ? (sea ? 'Off season' : 'Locked') : '+' + pp + ' ' + money(price));
    toggleCls(row, 'lockd', lk);
    toggleCls(row, 'insea', sea && S.season === si);
    toggleCls($('sb1-' + k), 'dis', lk || state.globalMoney < price);
    const tt = lk ? lockWhy(k) : (sea ? 'In season now! Only sold in ' + SEASONS[S.season].name + '.' : '');
    const b1 = $('sb1-' + k); if (b1._tt !== tt) { b1._tt = tt; b1.title = tt; }
  });
  const sale = state.event && state.event.type === 'sale';
  toggleCls($('sale-tag'), 'hidden', !sale);
  T('supply-note', 'Supplies belong to the shop on screen. Each coffee uses 1 bean, 1 milk and 1 cup.' + (cityOf(loc).supply !== 1 ? ' Prices here are x' + cityOf(loc).supply + '.' : ''));
  const idle = cc.brewers.filter(b => !loc.activeBrews[b.key]).length;
  toggleCls($('b-brewall'), 'dis', !idle);
}
function uiEventBar() {
  const el = $('evbar'), ev = state.event;
  if (!ev) { if (!el.classList.contains('hidden')) { el.classList.add('hidden'); } V.evt = null; return; }
  const E0 = EVENTS[ev.type];
  const pct = (ev.left / ev.total * 100).toFixed(0);
  const sig = ev.type + ev.opt + ev.shop + cur;
  if (V.evt !== sig) {
    V.evt = sig; el.className = E0.cls;
    const where = ev.shop >= 0 && state.locations[ev.shop] ? (ev.shop === cur ? ' here' : ' at ' + locName(state.locations[ev.shop], ev.shop)) : '';
    el.innerHTML = icon(E0.icon) + '<span>' + esc(E0.name + where) + '</span>' + (ev.label ? '<small>' + esc(ev.label) + '</small>' : '') + '<div class="bar"><i id="ev-i" style="width:100%"></i></div>';
    E['ev-i'] = null;
  }
  const bi = E['ev-i'] || (E['ev-i'] = $('ev-i')); if (bi) bi.style.width = pct + '%';
  el.classList.remove('hidden');
}
function uiGoalBar() {
  const el = $('goalbar');
  if (state.tutorial >= 0) { el.classList.add('hidden'); return; }
  const c = chapter();
  toggleCls(el, 'story', !!c);
  if (c) {
    // career mode: the bar follows the story chapter
    el.classList.remove('hidden');
    const ready = chapterReady(c), num = state.career.ch + 1;
    toggleCls(el, 'ready', ready);
    let i = 0; while (i < c.obj.length - 1 && objGot(i)) i++;
    const o = c.obj[i], v = Math.min(o.t, o.m());
    H('goalbar', ready ? icon('flag') + '<span>Chapter ' + num + ': <b>' + esc(c.n) + '</b> - all objectives done!</span><span class="rw">Click to claim +' + money(c.r) + '</span>'
      : icon('flag') + '<span>Chapter ' + num + ': <b>' + esc(o.d) + '</b></span><div class="bar"><i style="width:' + clamp(v / o.t * 100, 0, 100).toFixed(0) + '%"></i></div><span>' + objFmt(o, v) + '/' + objFmt(o, o.t) + '</span><span class="rw">+' + money(c.r) + '</span>');
    el.title = 'Career chapter ' + num + ': ' + c.n + '. Click to open the Career window.';
    return;
  }
  toggleCls(el, 'ready', false); el.title = 'Next goal. Click to see all goals.';
  const g = nextGoal();
  if (!g) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const cur_ = goalCur(g.g);
  H('goalbar', icon('trophy') + '<span>Goal: <b>' + esc(g.g.n) + '</b> - ' + esc(g.g.d) + '</span><div class="bar"><i style="width:' + (g.frac * 100).toFixed(0) + '%"></i></div><span>' + goalFmt(g.g, cur_) + '/' + goalFmt(g.g, g.g.t) + '</span><span class="rw">+' + money(g.g.r) + '</span>');
}

// ----- tutorial -----
const TUT = [
  { title: 'Welcome to Bean & Brew!', text: 'Let us open your first cafe. Pick the <b>Door</b> tool and click a tile at the edge of the map. Customers will walk in through it.', tool: 'door', tab: 'build', done: () => C(state.locations[0]).doors.length > 0 },
  { title: 'Lay down a Floor', text: 'People only walk on <b>Floor</b> tiles. Click and drag to paint a path starting at your door. The first few floors are free!', tool: 'floor', tab: 'build', done: () => C(state.locations[0]).floors >= 3 },
  { title: 'Add a Counter', text: 'Place a <b>Counter</b> so it touches your floor path. Customers line up next to it to order. A red ! means they cannot reach it yet.', tool: 'counter', tab: 'build', done: () => C(state.locations[0]).reachCount > 0 },
  { title: 'Build a Brewer', text: 'A <b>Brewer</b> turns beans, milk and a cup into coffee. Place one anywhere inside your shop.', tool: 'brewer', tab: 'build', done: () => C(state.locations[0]).brewers.length > 0 },
  { title: 'Brew your first coffee', text: 'Switch to <b>Interact</b> (press 1) and click the Brewer. Watch the progress bar fill up!', tool: 'cursor', tab: 'build', done: () => state.stats.brews >= 1 },
  { title: 'Serve a customer', text: 'When a customer waits at the counter, click the <b>glowing Counter</b> to hand over their coffee. First sales pay double!', tool: 'cursor', tab: 'build', done: () => state.stats.served >= 1 },
  { title: 'Hire a Barista', text: 'Keep brewing and serving until you have <b>$100</b>, then hire a <b>Barista</b> in the Staff panel. They brew automatically. Tip: a second Counter and Brewer lets you serve more people at once.', tab: 'staff', pulse: 'hire-barista', done: () => staffCount('barista') >= 1 },
  { title: 'Hire a Cashier', text: 'A <b>Cashier</b> ($150) stands at a counter and serves customers for you. Customers who wait too long leave angry!', tab: 'staff', pulse: 'hire-cashier', done: () => staffCount('cashier') >= 1 },
  { title: 'Keep the shelves stocked', text: 'Supplies run out! Order more in the <b>Supplies</b> panel, or hire a <b>Restocker</b> ($200) to re-order automatically.', tab: 'supply', pulse: 'hire-restocker', done: () => staffCount('restocker') >= 1 },
  { title: 'Buy an upgrade', text: 'Open <b>Upgrades</b> (the arrow button, or press U) and buy your first upgrade. Then watch Goals for what to do next!', pulseBtn: 'b-upg', done: () => upgradeLevels() >= 1 }
];
function tutorialCheck() {
  if (state.tutorial < 0) return;
  let changed = false;
  while (state.tutorial >= 0 && state.tutorial < TUT.length && TUT[state.tutorial].done()) {
    state.tutorial++; changed = true;
    if (state.tutorial < TUT.length) { toast('Nice work!', 'goal', 'check'); Snd.play('hire'); }
  }
  if (state.tutorial >= TUT.length) {
    state.tutorial = -1; changed = true;
    state.nextEvent = Math.max(state.nextEvent, state.tick + 500);     // a short breather before the first event
    toast(careerOn() ? 'Tutorial complete! Your story begins: open Career (K) for the chapters.' : 'Tutorial complete! Check Goals (G) for milestones, and watch out for Rush Hours.', 'goal', 'trophy');
    if (careerOn()) rt.careerPop = true;
    log('Tutorial complete. You are on your own now - good luck!', 'good');
    Snd.play('goal');
  }
  if (changed) { renderTutorial(); rt.dirtyUI = true; }
}
function renderTutorial() {
  const el = $('tut');
  document.querySelectorAll('.pulse').forEach(x => x.classList.remove('pulse'));
  const s = state.tutorial;
  if (s < 0 || s >= TUT.length) { el.classList.add('hidden'); return; }
  const st = TUT[s];
  el.classList.remove('hidden');
  el.innerHTML = '<div class="tn">' + (s + 1) + '</div><div class="tx"><b>' + esc(st.title) + '</b><p>' + st.text + '</p><div class="tbar"><i style="width:' + (s / TUT.length * 100) + '%"></i></div></div><button class="tskip" data-act="tutskip">Skip</button>';
  if (st.tool && $('tool-' + st.tool) && tool !== st.tool) $('tool-' + st.tool).classList.add('pulse');
  if (st.pulse && $(st.pulse)) $(st.pulse).classList.add('pulse');
  if (st.pulseBtn && $(st.pulseBtn)) $(st.pulseBtn).classList.add('pulse');
  if (layoutMode !== 'wide' && st.tab) { setTab(st.tab); const tb = document.querySelector('#tabs button[data-tab="' + st.tab + '"]'); if (tb && (st.pulse)) tb.classList.add('pulse'); }
  fitCanvas();
}
function tutArrow(loc) {
  const s = state.tutorial;
  if (s !== 4 && s !== 5) return null;
  const cc = C(loc);
  if (s === 4 && cc.brewers.length && tool === 'cursor') return cc.brewers[0];
  if (s === 5) { for (let i = 0; i < cc.counters.length; i++) if (stationOf(loc, cc.counters[i].key)) return cc.counters[i]; }
  return null;
}

