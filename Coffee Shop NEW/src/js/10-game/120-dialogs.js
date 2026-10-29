// ----- dialogs -----
function bar(p) { return '<div class="bar"><i style="width:' + clamp(p, 0, 100).toFixed(0) + '%"></i></div>'; }
function openDlg(kind) {
  if (kind === 'rank' && !rt.rankUp) return;
  dlgKind = kind;
  if ((kind === 'rank' || kind === 'away' || kind === 'event' || kind === 'latte' || kind === 'career') && !paused && running) { paused = true; rt.autoPause = true; }   // celebrations, decisions and mini-games pause the game
  $('dlg').classList.remove('hidden');
  renderDlg();
  const body = $('dlg-body'); body.scrollTop = 0;
  Snd.play('click');
}
function closeDlg() {
  if (dlgKind === 'latte' && rt.latte && rt.latte.mode === 'contest' && rt.latte.phase !== 'final' && !rt.latteLeave) {
    ask('Leave the championship?', 'If you leave now you lose the entry fee and this try.', 'Leave', () => { rt.latteLeave = true; closeDlg(); rt.latteLeave = false; }, true);
    return;
  }
  if (dlgKind === 'event' && state && state.pendingEv) {
    // closed without choosing: take the last (free) option so the game never gets stuck
    const ch = EVENTS[state.pendingEv.type].choices;
    resolveEvent(ch.length - 1, true);
  }
  if (dlgKind === 'latte') latteClose();
  if (dlgKind === 'career') rt.careerJust = null;
  $('dlg').classList.add('hidden');
  if (dlgKind === 'rank') rt.rankUp = null;
  dlgKind = null;
  if (rt.autoPause) { rt.autoPause = false; paused = false; lastSim = performance.now(); }
  if (running) updateUI();
}
function refreshDlg() { if (dlgKind && dlgKind !== 'settings' && dlgKind !== 'help' && dlgKind !== 'latte') renderDlg(true); }
function renderDlg(keepScroll) {
  const body = $('dlg-body'), sc = body.scrollTop;
  const r = ({ goals: dlgGoals, upgrades: dlgUpgrades, stats: dlgStats, help: dlgHelp, settings: dlgSettings, away: dlgAway, rank: dlgRank, recipes: dlgRecipes, staff: dlgStaff, chain: dlgChain, city: dlgCity, event: dlgEvent,
    season: dlgSeason, latte: dlgLatte, career: dlgCareer, news: dlgNews })[dlgKind];
  if (!r) return;
  const res = r();
  $('dlg-title').textContent = res.title;
  body.innerHTML = res.html;
  if (dlgKind === 'settings') updateSaveInd();
  if (dlgKind === 'latte') latteMount();
  if (keepScroll) body.scrollTop = sc;
}
function dlgGoals() {
  const done = goalsDone();
  const list = GOALS.slice().sort((a, b) => (state.goals[a.id] ? 1 : 0) - (state.goals[b.id] ? 1 : 0));
  return {
    title: 'Goals - ' + done + '/' + GOALS.length,
    html: '<p>Complete goals to earn bonus cash. Rewards are paid automatically.</p><div class="grid2">' + list.map(g => {
      const d = !!state.goals[g.id], cu = goalCur(g);
      return '<div class="card' + (d ? ' done' : '') + '"><div class="row"><span class="ico">' + icon(d ? 'check' : 'trophy') + '</span><div style="min-width:0"><b>' + esc(g.n) + '</b><small>' + esc(g.d) + '</small></div></div>' + bar(d ? 100 : cu / g.t * 100) + '<div class="meta"><span>' + (d ? 'Done!' : goalFmt(g, cu) + ' / ' + goalFmt(g, g.t)) + '</span><span>' + (d ? 'Paid ' : 'Reward ') + money(g.r) + '</span></div></div>';
    }).join('') + '</div>'
  };
}
function dlgUpgrades() {
  const ri = rankIdx(), nxt = RANKS[ri + 1];
  let html = '<p>Upgrades apply to <b>every shop</b>. Your rank: <b style="color:var(--accent)">' + RANKS[ri].n + '</b>' + (nxt ? ' - earn ' + money(nxt.at - state.stats.earned) + ' more for <b>' + nxt.n + '</b>.' : ' (top rank!)') + '</p><div class="grid2">';
  UPGRADES.forEach(u => {
    const lv = U(u.id), maxed = lv >= u.max, cost = upgradeCost(u), can = state.globalMoney >= cost;
    let pips = ''; for (let i = 0; i < u.max; i++) pips += '<i class="' + (i < lv ? 'on' : '') + '"></i>';
    html += '<div class="card"><div class="row"><span class="ico">' + icon(u.icon) + '</span><div style="min-width:0"><b>' + esc(u.name) + '</b><small>' + esc(u.desc) + '</small></div></div><div class="pips">' + pips + '</div><div style="margin-top:8px">' +
      (maxed ? '<button class="btn wide dis" disabled>Maxed out</button>' : '<button class="btn wide ' + (can ? 'primary' : 'dis') + '" data-act="upgrade" data-id="' + u.id + '">Level ' + (lv + 1) + ' - ' + money(cost) + '</button>') + '</div></div>';
  });
  html += '</div><h4>Ranks</h4><div class="card">' + RANKS.map((r, i) => '<div style="display:flex;justify-content:space-between;padding:3px 0;' + (i === ri ? 'color:var(--accent);font-weight:800' : (i > ri ? 'color:var(--dim)' : '')) + '"><span>' + (i <= ri ? '&#10003; ' : '') + esc(r.n) + '</span><span>' + (r.at ? money(r.at) + ' earned' : 'Start') + '</span></div>').join('') + '</div>';
  return { title: 'Upgrades', html: html };
}
function dlgStats() {
  const st = state.stats, sat = satisfaction();
  const big = [[money(state.globalMoney), 'Money'], [money(incomePerMin()) + '/min', 'Income now'], [money(st.earned), 'Total earned'], [fmt(st.served), 'Customers served'], [sat === null ? '-' : sat + '%', 'Happy (last 40)'], [fmt(st.bestStreak), 'Best happy streak'], [fmt(st.days), 'Days played'], [money(st.tips), 'Tips earned'], [fmtTime(st.playTicks / 5), 'Play time']];
  let html = '<div class="bignum">' + big.map(b => '<div class="card"><b>' + b[0] + '</b><small>' + b[1] + '</small></div>').join('') + '</div>';
  html += '<h4>Your shops</h4><table class="t"><tr><th>Shop</th><th>Rating</th><th>$/min</th><th>Served</th><th>Earned</th><th>Staff</th></tr>' +
    state.locations.map((l, i) => '<tr><td>' + esc(locName(l, i)) + '</td><td>' + rating(l).toFixed(1) + '</td><td>' + money(l.rate) + '</td><td>' + fmt(l.served) + '</td><td>' + money(l.earned) + '</td><td>' + l.staff.length + '</td></tr>').join('') + '</table>';
  const more = [[fmt(recipesKnown()) + '/' + RECIPES.length, 'Recipes known'], [fmt(st.specials), 'Specials sold'], [fmt(st.favs), 'Favorites served'], [money(st.frEarned), 'Franchise income'], [money(st.rentPaid), 'Rent paid'], [fmt(st.choices), 'Event decisions']];
  html += '<h4>Chain</h4><div class="bignum">' + more.map(b => '<div class="card"><b>' + b[0] + '</b><small>' + b[1] + '</small></div>').join('') + '</div>';
  const v5 = [[curSeason().name + ', year ' + yearNum(), 'Season'], [fmt(st.holServed), 'Holiday customers'], [fmt(st.art), 'Latte art cups'], [st.artBest ? st.artBest + '/100' : '-', 'Best latte art'], [money(st.artTips), 'Latte art tips'], [fmt(st.champs) + '/' + CHAMPS.length, 'Championships won']];
  if (careerOn()) v5.push([Math.min(state.career.ch, CAREER.length) + '/' + CAREER.length, 'Story chapters']);
  html += '<h4>Seasons, art and story</h4><div class="bignum">' + v5.map(b => '<div class="card"><b>' + b[0] + '</b><small>' + b[1] + '</small></div>').join('') + '</div>';
  html += '<p style="margin-top:10px;color:var(--muted);font-size:12px">Reputation: ' + Math.round(state.reputation) + '/500. Serving the right coffee fast raises it; customers leaving angry lowers it. Higher reputation means more customers and fancier orders.</p>';
  return { title: 'Statistics', html: html };
}
function dlgHelp() {
  return {
    title: 'How to play', html:
      '<h4>The goal</h4><p>Build a coffee shop, brew coffee, serve customers and grow into a coffee empire. Earn money, rank up, open more shops!</p>' +
      '<h4>Open your shop</h4><ul><li><b>Door</b>: where customers enter and leave.</li><li><b>Floor</b>: people only walk on floors. Connect the door to your counter. Drag to paint.</li><li><b>Counter</b>: customers wait next to it. A red ! means no path.</li><li><b>Brewer</b>: makes coffee from 1 bean + 1 milk + 1 cup.</li></ul>' +
      '<h4>Make money</h4><ul><li>Use <b>Interact</b> (1): click a Brewer to brew, then click the glowing Counter to serve.</li><li>Customers show what they want above their head: brown = Basic, gold = Premium, purple = Luxury. Matching orders earn the most and the best reputation.</li><li>Impatient customers leave angry and hurt your reputation.</li></ul>' +
      '<h4>Automate</h4><ul><li><b>Barista</b> brews for you, <b>Cashier</b> serves for you, <b>Restocker</b> re-orders supplies when low.</li><li>Watch the Shop check panel for problems like missing supplies.</li></ul>' +
      '<h4>Grow</h4><ul><li><b>Upgrades</b> make every shop better. <b>Goals</b> pay bonus cash.</li><li><b>Decorations</b> (plants, tables, rugs, lamps, sofas, art, fountains, pianos, aquariums) raise <b>ambience</b> and your <b>shop rating</b>: customers wait longer, visit more and pay more. Different kinds of decorations add a variety bonus.</li><li>The <b>shop rating</b> (1-5 stars) comes from decorations, barista Quality, stocked specials and happy customers.</li></ul>' +
      '<h4>Recipes</h4><ul><li>Open <b>Recipes</b> (R). In the <b>Lab</b>, mix a coffee base with pantry ingredients (chocolate, caramel, ice, flour...) to discover drinks and pastries. Failed mixes give clues.</li><li>Put discovered recipes on a shop menu. Each customer has a favorite flavor (a heart over their head means they ordered it): favorites pay <b>40% more</b>. Buy pantry items in the Supplies panel.</li></ul>' +
      '<h4>Staff skills</h4><ul><li>Staff earn XP by working and level up. Press <b>Skills</b> next to a team member to spend skill points on <b>Speed</b>, <b>Quality</b> and <b>Charm</b> (rank 5 unlocks a perk), or pay to send them to <b>training</b> for an instant level.</li><li>A <b>Manager</b> (rank ' + esc(RANKS[2].n) + ') restocks everything and makes the shop earn more while you are away.</li></ul>' +
      '<h4>Cities and franchises</h4><ul><li>The Shop button above the map opens the <b>city picker</b>. Every city has different customers, prices and rent, and must be unlocked once.</li><li>Open <b>Chain</b> (C) for an overview of all shops and to open <b>franchises</b>: outlets run by their own manager that pay passive income, even while you are away.</li></ul>' +
      '<h4>Events</h4><ul><li>Rush hours, festivals, food critics, power outages, viral posts, heat waves and inspections happen from time to time. Most of them ask you to <b>choose</b> how to respond: spend money for a bigger reward, take a gamble or play it safe.</li><li>Critics must be served Premium or Luxury coffee, by you (or by a cashier if you choose that).</li></ul>' +
      '<h4>Seasons and holidays</h4><ul><li>The year has 4 seasons of ' + SEASON_DAYS + ' days. Each one changes how busy each city is, what customers crave and how your shops look. Click the <b>clock</b> for the calendar.</li><li><b>Holidays</b> (Blossom Festival, Summer Fireworks, Halloween, Winter Holidays, New Year\'s Eve) bring big crowds and tips.</li><li><b>Seasonal ingredients</b> (Honey, Lemon, Pumpkin, Peppermint) are only sold in their season. Seasonal specials sell for more, but customers only order them in season.</li><li>Seasonal decorations (Flowers, Parasol, Pumpkins, Snowman) give extra ambience in their own season.</li></ul>' +
      '<h4>Latte art</h4><ul><li>Press <b>Pour latte art</b> (L) in the Supplies panel. Hold the mouse button and trace the dashed pattern: stay in the light band, keep moving and do not over-pour.</li><li>Good pours become <b>art cups</b>: the next customers at that shop pay a bonus tip (bigger for harder patterns). Great art also helps with critics.</li></ul>' +
      '<h4>Career and championships</h4><ul><li><b>Career</b> (K) tells a story in ' + CAREER.length + ' chapters. Finish the 3 objectives of a chapter and claim its reward. Playing Free Play? You can start the story from the Career window.</li><li><b>Barista championships</b>: 3 latte art rounds against a rival. Your baristas\' Quality skill adds bonus points. Win prize money and a Trophy decoration.</li></ul>' +
      '<h4>Shortcuts</h4><ul><li>1-9: choose tool, Space: pause, B: brew on all idle machines, L: latte art, K: career, G: goals, U: upgrades, R: recipes, C: chain, H: help, M: mute, Esc: close or Interact tool.</li></ul>' +
      '<div class="dfoot"><span style="flex:1;align-self:center;font-size:12px;color:var(--dim)">Bean &amp; Brew Tycoon ' + GAME_VER + '</span><button class="btn" data-act="dlg" data-d="news">What\'s new</button>' + (running ? '<button class="btn" data-act="tutreplay">Replay tutorial</button>' : '') + '<button class="btn primary" data-act="close">Got it</button></div>'
  };
}
function saveSummary(raw) {
  try {
    const s = readSaveText(raw);
    return { money: s.globalMoney, shops: s.locations.length, rank: RANKS[rankIdx(s.stats.earned)].n, at: s.savedAt };
  } catch (e) { return null; }
}
function dlgSettings() {
  const tog = (k, name, desc) => '<div class="tog"><div><b>' + name + '</b><small>' + desc + '</small></div><button class="sw' + (settings[k] ? ' on' : '') + '" data-act="set" data-k="' + k + '" role="switch" aria-checked="' + !!settings[k] + '" aria-label="' + name + '"></button></div>';
  let html = '<h4>Game</h4>' + tog('sound', 'Sound effects', 'Coins, brewing, clicks and fanfares.') +
    '<div class="tog"><div><b>Volume</b><small id="vol-txt">' + Math.round(settings.volume * 100) + '%</small></div><input type="range" min="0" max="100" value="' + Math.round(settings.volume * 100) + '" id="vol" aria-label="Volume"></div>' +
    tog('lowfx', 'Reduce effects', 'Fewer animations and particles. Helps slow computers.') +
    tog('daynight', 'Day and night lighting', 'Darker evenings with glowing lamps.') +
    tog('numbers', 'Floating numbers', 'Show +$ and status text over the map.') +
    tog('confirm', 'Ask before important actions', 'Confirm when firing staff or opening new shops.');
  html += '<h4>Saving</h4><p id="save-status" style="margin-bottom:8px"></p><div class="dfoot" style="justify-content:flex-start;margin-top:0"><button class="btn" data-act="savenow">' + icon('download') + ' Save now</button><button class="btn" data-act="export">' + icon('download') + ' Export save</button></div>' +
    '<textarea id="save-box" placeholder="Export puts your save code here. To load a save, paste a code here and press Import." spellcheck="false" aria-label="Save code"></textarea><div class="dfoot" style="justify-content:flex-start;margin-top:8px"><button class="btn" data-act="copysave">Copy</button><button class="btn" data-act="import">' + icon('upload') + ' Import</button></div><div class="msg" id="save-msg"></div>';
  const slots = [[SAVE_KEY, 'Current save'], [PREV_KEY, 'Automatic backup'], [STASH_KEY, 'Game before your last New Game'], [LEGACY_KEY, 'Original save from before the update']];
  let rows = '';
  slots.forEach(sl => {
    const raw = store.get(sl[0]); if (!raw || (sl[0] === SAVE_KEY && !running)) { if (!raw) return; }
    const sm = saveSummary(raw);
    if (sl[0] === SAVE_KEY) return;
    rows += '<div class="card" style="margin-bottom:6px"><div class="row"><div style="flex:1;min-width:0"><b>' + sl[1] + '</b><small>' + (sm ? money(sm.money) + ' - ' + sm.shops + ' shop' + (sm.shops > 1 ? 's' : '') + ' - ' + esc(sm.rank) + (sm.at ? ' - ' + ago(Date.now() - sm.at) : '') : 'Unreadable') + '</small></div>' + (sm ? '<button class="btn" data-act="restore" data-k="' + sl[0] + '">Restore</button>' : '') + '</div></div>';
  });
  if (rows) html += '<h4>Backups</h4>' + rows;
  html += '<h4>Danger zone</h4><div class="dfoot" style="justify-content:flex-start;margin-top:0">' + (running ? '<button class="btn" data-act="tomenu">' + icon('home') + ' Main menu</button>' : '') + '<button class="btn danger" data-act="reset">Erase all progress</button></div>';
  return { title: 'Settings and save', html: html };
}
function dlgAway() {
  const a = rt.away || { seconds: 0, money: 0, shops: 0 };
  return {
    title: 'Welcome back!', html: '<div class="celebrate"><div class="ico">' + icon('coin') + '</div><div class="big">' + (a.money ? '+' + money(a.money) : 'Nothing earned') + '</div></div><p style="text-align:center">You were away for <b>' + fmtTime(a.seconds) + '</b>.' + (a.money - (a.fr || 0) > 0 ? ' Your fully staffed shops (' + a.shops + ') kept serving coffee while you were gone.' : ' Shops only earn while you are away when they have a Barista, a Cashier and a Restocker or Manager.') + (a.fr ? ' Your ' + a.frN + ' franchise' + (a.frN > 1 ? 's' : '') + ' earned ' + money(a.fr) + '.' : '') + '</p><div class="dfoot" style="justify-content:center"><button class="btn primary" data-act="close">Let us go!</button></div>'
  };
}
function dlgRank() {
  const r = rt.rankUp ? rt.rankUp.rank : rankIdx();
  return { title: 'Rank up!', html: '<div class="celebrate"><div class="ico">' + icon('star') + '</div><div class="big">' + esc(RANKS[r].n) + '</div></div><p style="text-align:center">' + esc(RANK_PERKS[r] || '') + '</p><div class="dfoot" style="justify-content:center"><button class="btn primary" data-act="close">Awesome!</button></div>' };
}

// ----- v4 dialogs: recipes, staff skills, chain overview, city picker, event choices -----
function recipeIngText(r) { return BASE_NAME[r.base + 1] + ' + ' + r.ing.map(k => SUPPLY[k].name).join(' + '); }
function hintMax(r) { return Math.max(1, r.ing.length - 1); }
function dlgRecipes() {
  const loc = curLoc(), known = recipesKnown(), slots = menuSlots();
  if (!rt.lab) rt.lab = { base: 0, ing: [], msg: '', cls: '' };
  const tab = rt.recTab || 'book';
  let html = '<div class="seg" style="margin-bottom:12px"><button data-act="rtab" data-v="book" class="' + (tab === 'book' ? 'on' : '') + '">' + icon('book') + ' Recipe book ' + known + '/' + RECIPES.length + '</button><button data-act="rtab" data-v="lab" class="' + (tab === 'lab' ? 'on' : '') + '">' + icon('flask') + ' Recipe lab</button></div>';
  if (tab === 'lab') {
    const L = rt.lab, inv = loc.inventory, fee = labFee(L.base);
    html += '<p>Mix a base with 1 to 3 pantry ingredients from <b>' + esc(locName(loc, cur)) + '</b> to invent new drinks and pastries. Each try uses 1 of each ingredient and costs a small fee. Wrong mixes give you clues!</p>';
    html += '<h4>1. Pick a base</h4><div class="seg">' + [-1, 0, 1, 2].map(b => '<button data-act="labbase" data-v="' + b + '" class="' + (L.base === b ? 'on' : '') + (b === 2 && !unlocked('beans_luxury') ? ' lock' : '') + '">' + BASE_NAME[b + 1] + '</button>').join('') + '</div>';
    html += '<h4>2. Pick ingredients (' + L.ing.length + '/3)</h4><div class="ingsel">' + PANTRY.map(k => {
      const S = SUPPLY[k], lk = !unlocked(k), on = L.ing.indexOf(k) >= 0, price = supplyPrice(k, loc), sea = S.season !== undefined;
      const lab = lk ? (inv[k] > 0 ? 'x' + inv[k] + ' left' : (sea ? SEASONS[S.season].name + ' only' : 'Locked')) : 'x' + inv[k] + ' here';
      return '<div class="ingc"><button class="ingt' + (on ? ' on' : '') + (sea ? ' sea' : '') + '" data-act="labing" data-k="' + k + '"' + (lk && !inv[k] ? ' style="opacity:.45"' : '') + ' title="' + esc(lk ? lockWhy(k) : (sea ? 'Seasonal: only sold in ' + SEASONS[S.season].name : S.name)) + '"><span style="color:' + SUP_COL[k] + ';filter:brightness(1.6)">' + icon(S.icon) + '</span>' + S.name + '<small>' + lab + '</small></button>' +
        (lk ? '' : '<button class="btn" data-act="buy" data-type="' + k + '" data-n="1" data-cost="' + price + '" title="Buy ' + packSize(k) + ' ' + S.name + ' for this shop">+' + packSize(k) + ' ' + money(price) + '</button>') + '</div>';
    }).join('') + '</div>';
    html += '<div class="dfoot" style="justify-content:flex-start"><button class="btn primary" data-act="experiment" data-cost="' + fee + '" data-pri="1">' + icon('flask') + ' Experiment - ' + money(fee) + '</button><button class="btn" data-act="labclear">Clear</button></div>';
    html += '<div class="labres ' + (L.cls || '') + '">' + (L.msg ? esc(L.msg) : 'Your mix: <b>' + BASE_NAME[L.base + 1] + (L.ing.length ? ' + ' + L.ing.map(k => SUPPLY[k].name).join(' + ') : '') + '</b>') + '</div>';
    return { title: 'Recipe lab', html: html };
  }
  html += '<p>Specials on the menu at <b>' + esc(locName(loc, cur)) + '</b>: <b>' + loc.menu.length + '/' + slots + '</b> slots. Every customer has a favorite flavor (heart over their head): they pay <b>40% more</b> for a special that matches it. Specials use pantry ingredients from this shop.</p>';
  html += '<div class="chips">' + (loc.menu.length ? loc.menu.map(id => {
    const r = RECIPE_BY_ID[id], sea = sellsHere(r, loc), ok = sea && canMake(loc, r);
    const why = !sea ? (r.city && inSeason(r) ? 'Local special: customers only order it in ' + CITY_BY_ID[r.city].name : 'Out of season: customers only order it in ' + SEASONS[r.season].name) : 'Missing ingredients or coffee: customers get plain coffee instead';
    return '<span class="rchip"' + (ok ? '' : ' style="border-color:#8b3030" title="' + esc(why) + '"') + '><span class="rdot" style="background:' + r.col + '"></span>' + esc(r.name) + (ok ? '' : ' <small style="color:var(--bad)">(' + (sea ? 'out' : r.city && inSeason(r) ? 'not sold here' : 'off season') + ')</small>') + '<button data-act="menutog" data-id="' + id + '" title="Remove from menu" aria-label="Remove">&times;</button></span>';
  }).join('') : '<span class="empty">No specials yet. Discover recipes in the lab, then add them here.</span>') + '</div>';
  html += '<h4>All recipes</h4><div class="grid2">' + RECIPES.map(r => {
    const k = !!state.recipes[r.id], on = loc.menu.indexOf(r.id) >= 0;
    const tags = r.tags.map(t => '<span class="tagl">' + TAG_NAME[t] + '</span>').join('') + (r.season !== undefined ? '<span class="tagl seat" style="color:' + SEASONS[r.season].col + '">' + icon(SEASONS[r.season].icon) + ' ' + SEASONS[r.season].name + (inSeason(r) ? ' - in season!' : ' only') + '</span>' : '') + (r.city ? '<span class="tagl seat" style="color:#fbbf24">' + icon('star') + ' ' + CITY_BY_ID[r.city].short + ' special' + (cityOf(loc).id === r.city ? ' - sells here!' : ' only') + '</span>' : '');
    if (k) {
      const ok = canMake(loc, r), full = !on && loc.menu.length >= slots;
      return '<div class="card' + (on ? ' onm' : '') + '"><div class="row"><span class="ico" style="background:' + r.col + ';color:#fff">' + icon(r.food ? 'cup' : 'coffee') + '</span><div style="min-width:0;flex:1"><b>' + esc(r.name) + '</b><small>' + esc(recipeIngText(r)) + '</small></div><b style="color:var(--good)">' + money(r.price) + '</b></div><div>' + tags + '</div>' +
        '<div class="meta"><span>' + (!inSeason(r) ? '<span style="color:var(--dim)">Back in ' + SEASONS[r.season].name + '</span>' : r.city && cityOf(loc).id !== r.city ? '<span style="color:var(--dim)">Only sold in ' + CITY_BY_ID[r.city].name + '</span>' : (ok ? 'Can make here' : '<span style="color:var(--bad)">Missing ingredients here</span>')) + '</span><span>Sold ' + fmt(state.rsold[r.id] || 0) + '</span></div>' +
        '<div class="btnrow"><button class="btn' + (on ? '' : (full ? ' dis' : ' primary')) + '" data-act="menutog" data-id="' + r.id + '">' + (on ? 'Remove from menu' : (full ? 'Menu full' : 'Add to menu')) + '</button></div></div>';
    }
    const h = state.rhint[r.id] || 0, shown = r.ing.slice(0, h).map(x => SUPPLY[x].name);
    const secret = r.ing.length - h;
    const canHint = h < hintMax(r), hc = hintCost(r);
    return '<div class="card unk"><div class="row"><span class="ico">' + icon('help') + '</span><div style="min-width:0;flex:1"><b>??? ' + (r.food ? 'pastry' : 'drink') + '</b><small>' + BASE_NAME[r.base + 1] + (shown.length ? ' + ' + shown.join(' + ') : '') + ' + ' + secret + ' secret ingredient' + (secret > 1 ? 's' : '') + '</small></div></div><div>' + tags + '</div>' +
      (canHint ? '<div class="btnrow"><button class="btn" data-act="hint" data-id="' + r.id + '" data-cost="' + hc + '">Buy a hint - ' + money(hc) + '</button></div>' : '<div class="meta"><span>Try it in the lab!</span></div>') + '</div>';
  }).join('') + '</div>';
  return { title: 'Recipes', html: html };
}
function dlgStaff() {
  const loc = curLoc(), s = loc.staff.find(x => x.id === rt.staffSel);
  if (!s) return { title: 'Staff', html: '<p>This staff member is no longer here.</p><div class="dfoot"><button class="btn primary" data-act="close">Close</button></div>' };
  const R = ROLES[s.role], maxed = s.lv >= STAFF_MAX_LV, need = xpNeed(s.lv);
  V.sdSig = s.lv + ':' + s.pts + ':' + (s.train ? 1 : 0);
  let html = '<div class="card"><div class="row"><span class="ico" style="background:' + R.col + ';color:#fff">' + icon(R.icon) + '</span><div style="flex:1;min-width:0"><b>' + esc(s.name) + ' the ' + R.name + '</b><small>Level ' + s.lv + (maxed ? ' (max)' : '') + ' - ' + (s.pts > 0 ? '<b style="color:var(--good)">' + s.pts + ' skill point' + (s.pts > 1 ? 's' : '') + ' to spend</b>' : 'no skill points to spend') + '</small></div></div>' +
    '<div class="bar"><i id="sd-xp" style="width:' + (maxed ? 100 : clamp(s.xp / need * 100, 0, 100)).toFixed(1) + '%"></i></div><div class="meta"><span id="sd-xpt">' + (maxed ? 'Max level' : Math.floor(s.xp) + ' / ' + need + ' XP') + '</span><span>Earns XP by working</span></div></div>';
  const tc = trainCost(s);
  html += '<h4>Training</h4><div class="card choice"><div class="tx"><b>Send to training</b><small id="sd-train">' + (s.train ? 'At training: back in ' + Math.ceil(s.train / 5) + 's with a new level.' : (maxed ? 'Nothing left to learn!' : 'Gain a level right away after ' + Math.round(trainTicks(loc, s) / 5) + 's away from work. Each level gives 1 skill point.')) + '</small></div>' +
    (s.train || maxed ? '<button class="btn dis" disabled>' + (s.train ? 'Training...' : 'Maxed') + '</button>' : '<button class="btn" data-act="train" data-id="' + s.id + '" data-cost="' + tc + '" data-pri="1">Train - ' + money(tc) + '</button>') + '</div>';
  html += '<h4>Skill tree</h4><div class="tree">' + Object.keys(SKILLS).map(b => {
    const S = SKILLS[b], rk = s.sk[b], fx = SKILL_FX[s.role][b];
    let pips = ''; for (let i = 0; i < 5; i++) pips += '<i class="' + (i < rk ? 'on' : '') + '"></i>';
    const can = s.pts > 0 && rk < 5;
    return '<div class="card"><b style="color:' + S.col + '">' + icon(S.icon) + ' ' + S.name + ' ' + rk + '/5</b><div class="node" style="color:' + S.col + '">' + pips + '</div><small>' + esc(fx[0]) + '</small><div class="perk' + (rk >= 5 ? ' on' : '') + '">' + (rk >= 5 ? '&#9733; ' : 'Rank 5: ') + esc(fx[1]) + '</div>' +
      '<button class="btn wide ' + (can ? 'primary' : 'dis') + '" data-act="learn" data-id="' + s.id + '" data-b="' + b + '">' + (rk >= 5 ? 'Mastered' : 'Learn rank ' + (rk + 1)) + '</button></div>';
  }).join('') + '</div>';
  html += '<div class="dfoot"><button class="btn danger" data-act="fire" data-id="' + s.id + '">Fire ' + esc(s.name) + '</button><button class="btn primary" data-act="close">Done</button></div>';
  return { title: 'Staff skills', html: html };
}
function cityCard(ci, mode) {
  const th = THEMES[themeIdx(ci.theme)], open = !!state.cities[ci.id], rk = rankIdx();
  const kinds = Object.keys(ci.kinds).sort((a, b) => ci.kinds[b] - ci.kinds[a]).map(k => KINDS[k].pl).join(', ');
  const shops = state.locations.filter(l => l.city === ci.id).length, frs = state.franchises.filter(f => f.city === ci.id).length;
  let btn;
  if (!open) {
    btn = rk < ci.rank ? '<button class="btn dis" disabled>' + icon('lock') + ' Rank: ' + esc(RANKS[ci.rank].n) + '</button>' : '<button class="btn" data-act="cityunlock" data-city="' + ci.id + '" data-cost="' + ci.unlock + '" data-pri="1">Unlock - ' + money(ci.unlock) + '</button>';
  } else if (mode === 'shop') {
    const n = state.locations.length, can = n < MAX_SHOPS && n < maxShopsAllowed();
    btn = can ? '<button class="btn" data-act="cityopen" data-city="' + ci.id + '" data-cost="' + shopCost(n) + '" data-pri="1">Open shop - ' + money(shopCost(n)) + '</button>' : '<button class="btn dis" disabled>' + (n >= MAX_SHOPS ? 'Max shops' : 'Rank up first') + '</button>';
  } else {
    const can = state.franchises.length < frMax();
    btn = can ? '<button class="btn" data-act="fropen" data-city="' + ci.id + '" data-cost="' + frOpenCost(ci.id) + '" data-pri="1">Franchise - ' + money(frOpenCost(ci.id)) + '</button>' : '<button class="btn dis" disabled>' + (frMax() ? 'Franchise limit' : 'Locked') + '</button>';
  }
  return '<div class="card" style="margin-bottom:8px' + (open ? '' : ';opacity:.85') + '"><div class="row"><span class="citysw" style="background:' + th.bg + '">' + icon(open ? 'pin' : 'lock') + '</span><div style="flex:1;min-width:0"><b>' + esc(ci.name) + '</b><small>' + esc(ci.desc) + '</small></div></div>' +
    '<div class="kv"><span>Prices <b>x' + ci.price + '</b></span><span>Crowds <b>x' + ci.spawn + '</b></span><span>Rent <b>' + (ci.rent ? money(ci.rent) + '/day' : 'none') + '</b></span><span>Supplies <b>x' + ci.supply + '</b></span>' + (shops || frs ? '<span>You have <b>' + shops + ' shop' + (shops === 1 ? '' : 's') + ', ' + frs + ' franchise' + (frs === 1 ? '' : 's') + '</b></span>' : '') + '</div>' +
    '<div class="kv"><span>Customers: ' + esc(kinds) + '</span></div><div class="btnrow">' + btn + '</div></div>';
}
function dlgCity() {
  const n = state.locations.length;
  let html = '<p>Pick a city for shop ' + (n + 1) + '. Each city has its own customers, prices and rent. Unlock a city once, then open shops and franchises there.</p>';
  if (n >= MAX_SHOPS) html += '<p style="color:var(--accent)">You own the maximum of ' + MAX_SHOPS + ' shops. Franchises (in the Chain window) let you keep growing!</p>';
  else if (n >= maxShopsAllowed()) html += '<p style="color:var(--accent)">Reach the rank "' + esc(RANKS[n - 1].n) + '" to open shop ' + (n + 1) + '. You can still unlock cities now.</p>';
  html += CITIES.map(ci => cityCard(ci, 'shop')).join('');
  return { title: 'Open a new shop', html: html };
}
function dlgChain() {
  const fm = frMax(), rent = rentPerDay();
  const big = [[state.locations.length + '/' + MAX_SHOPS, 'Shops'], [state.franchises.length + '/' + fm, 'Franchises'], ['<span id="ch-inc">' + money(chainIncome()) + '/min</span>', 'Chain income'], [money(rent) + '/day', 'Shop rent'], [money(state.stats.frEarned), 'Franchise earnings'], [Object.keys(state.cities).length + '/' + CITIES.length, 'Cities unlocked']];
  let html = '<div class="bignum">' + big.map(b => '<div class="card"><b>' + b[0] + '</b><small>' + b[1] + '</small></div>').join('') + '</div>';
  html += '<h4>Your shops</h4><table class="t"><tr><th>Shop</th><th>City</th><th>Rating</th><th>$/min</th><th>Staff</th><th></th></tr>' +
    state.locations.map((l, i) => {
      const mg = l.staff.find(s => s.role === 'manager');
      return '<tr><td>' + esc(locName(l, i)) + (mg ? ' <small style="display:inline" title="Managed by ' + esc(mg.name) + '">' + icon('briefcase') + '</small>' : '') + '</td><td>' + esc(cityOf(l).short) + '</td><td>' + rating(l).toFixed(1) + '</td><td>' + money(l.rate) + '</td><td>' + l.staff.length + '</td><td>' + (i === cur ? '<small>here</small>' : '<button class="btn" data-act="goshop" data-i="' + i + '">Go</button>') + '</td></tr>';
    }).join('') + '</table>';
  html += '<p style="margin-top:8px;font-size:12px;color:var(--muted)">Tip: hire a <b>Manager</b> (Staff panel, needs rank ' + esc(RANKS[2].n) + ') so a shop restocks itself and keeps earning more while you are away.</p>';
  html += '<h4>Franchise outlets</h4>';
  if (!fm) html += '<p>Franchises unlock at rank <b>' + esc(RANKS[2].n) + '</b>. A franchise is a shop run entirely by its own manager: you never build it, it just pays you passive income (more with reputation and recipes you know).</p>';
  else if (!state.franchises.length) html += '<p>No franchises yet. Open one in any unlocked city below: they earn money on their own, even while you are away.</p>';
  else html += '<div class="grid2">' + state.franchises.map(f => {
    const ci = CITY_BY_ID[f.city], uc = frUpCost(f), tc = frTrainCost(f);
    let pips = ''; for (let i = 0; i < FR_MAX_LV; i++) pips += '<i class="' + (i < f.lv ? 'on' : '') + '"></i>';
    return '<div class="card"><div class="row"><span class="citysw" style="background:' + THEMES[themeIdx(ci.theme)].bg + '">' + icon('store') + '</span><div style="flex:1;min-width:0"><b>' + esc(f.name) + '</b><small>' + esc(ci.name) + ' - manager ' + esc(f.mname) + ' (Lv ' + f.mgr + ')</small></div></div><div class="pips">' + pips + '</div>' +
      '<div class="meta"><span>Income <b id="fr-inc-' + f.id + '" style="color:var(--good)">' + money(frNet(f)) + '/min</b></span><span>Earned <b id="fr-earn-' + f.id + '">' + money(f.earned) + '</b></span></div>' +
      '<div class="btnrow">' + (f.lv < FR_MAX_LV ? '<button class="btn" data-act="frup" data-id="' + f.id + '" data-cost="' + uc + '" data-pri="1" title="Bigger outlet, more income">Expand ' + money(uc) + '</button>' : '<button class="btn dis" disabled>Max size</button>') +
      (f.mgr < FR_MGR_MAX ? '<button class="btn" data-act="frtrain" data-id="' + f.id + '" data-cost="' + tc + '" title="Manager level +1: +12% income">Train mgr ' + money(tc) + '</button>' : '') +
      '<button class="btn" data-act="frsell" data-id="' + f.id + '" title="Sell for ' + money(frSellValue(f)) + '">Sell</button></div></div>';
  }).join('') + '</div>';
  html += '<h4>Cities</h4>' + CITIES.map(ci => cityCard(ci, fm ? 'franchise' : 'shop')).join('');
  return { title: 'Your coffee chain', html: html };
}
// ----- v5 dialogs: calendar, latte art, career, what's new -----
function dlgSeason() {
  const d = dayIdx(), si = seasonIdx(), S = SEASONS[si], h = curHoliday(), loc = curLoc(), ci = cityOf(loc);
  const pct = v => (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%';
  let html = '<div class="seahead" style="border-color:' + S.col + '"><span class="ico" style="background:' + S.col + '">' + icon(h ? h.icon : S.icon) + '</span><div style="min-width:0"><b>' + S.name + (h ? ' - ' + esc(h.name) + '!' : '') + '</b><small>Day ' + (seasonDay() + 1) + ' of ' + SEASON_DAYS + ' - Year ' + yearNum() + ' - day ' + (d + 1) + ' of your cafe</small><p>' + esc(h ? h.desc : S.desc) + '</p></div></div>';
  const ing = PANTRY.filter(k => SUPPLY[k].season === si);
  const fx = ['Crowds at ' + esc(locName(loc, cur)) + ' (' + esc(ci.name) + '): <b>' + pct(seasonSpawn(loc)) + '</b>' + ((ci.sea || SEA_ONE)[si] !== 1 ? ' (' + esc(ci.name) + ' is ' + ((ci.sea[si] > 1) ? 'busy' : 'quiet') + ' in ' + S.name + ')' : ''),
    'Customers crave: <b>' + craving().likes.map(t => TAG_NAME[t]).join(' and ') + '</b>'];
  if (seasonTip()) fx.push('Tip chance: <b>+' + Math.round(seasonTip() * 100) + '%</b>');
  if (seasonPrice() !== 1) fx.push('Prices: <b>' + pct(seasonPrice()) + '</b>');
  if (S.student) fx.push('Students are back: <b>' + pct(S.student) + '</b> more of them');
  if (S.tourist !== 1) fx.push('Tourists: <b>' + pct(S.tourist) + '</b>');
  fx.push('In season: <b>' + ing.map(k => SUPPLY[k].name).join(', ') + '</b> (Pantry). Seasonal specials sell for <b>+' + Math.round((seasonBonus({ season: si }) - 1) * 100) + '%</b> and customers love to try them.');
  const deco = TOOLS.filter(t => t.season === si)[0];
  if (deco) fx.push('Seasonal decoration: <b>' + deco.name + '</b> gives +' + (TILE_AMB[deco.tile] + SEASON_AMB) + ' ambience now (Decorations palette).');
  html += '<h4>Right now</h4><ul>' + fx.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  const recs = RECIPES.filter(r => r.season === si);
  html += '<h4>' + S.name + ' specials</h4><div class="chips">' + recs.map(r => state.recipes[r.id]
    ? '<span class="rchip" style="padding-right:9px"><span class="rdot" style="background:' + r.col + '"></span>' + esc(r.name) + ' <small>' + money(r.price) + '</small></span>'
    : '<span class="rchip" style="padding-right:9px;border-style:dashed">' + icon('help') + ' ??? ' + (r.food ? 'pastry' : 'drink') + ' <small>uses ' + esc(SUPPLY[r.ing.filter(k => SUPPLY[k].season !== undefined)[0]].name) + '</small></span>').join('') + '</div>';
  // the whole year at a glance
  const y0 = d - (d % YEAR_DAYS);
  html += '<h4>Year ' + yearNum() + '</h4><div class="cal">' + SEASONS.map((s2, i) => {
    let row = '<div class="calrow"><span class="calname" style="color:' + s2.col + '">' + icon(s2.icon) + ' ' + s2.name + '</span>';
    for (let j = 0; j < SEASON_DAYS; j++) {
      const dd = y0 + i * SEASON_DAYS + j, hh = holidayOn(dd);
      row += '<span class="calday' + (dd === d ? ' now' : '') + (dd < d ? ' past' : '') + (hh ? ' hol' : '') + '" title="' + esc('Day ' + (dd + 1) + (hh ? ': ' + hh.name : '')) + '">' + (hh ? icon(hh.icon) : '') + '<small>' + (hh ? esc(hh.name) : 'Day ' + (j + 1)) + '</small></span>';
    }
    return row + '</div>';
  }).join('') + '</div>';
  const up = [];
  for (let k = 0; k < YEAR_DAYS && up.length < 3; k++) { const hh = holidayOn(d + k); if (hh) up.push((k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : 'In ' + k + ' days') + ': <b>' + esc(hh.name) + '</b> - ' + esc(hh.desc)); }
  html += '<h4>Coming up</h4><ul>' + up.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  html += '<p style="font-size:12px;color:var(--muted)">Each season lasts ' + SEASON_DAYS + ' game days (one day is 4 minutes at normal speed).</p>';
  return { title: 'Calendar', html: html };
}
function starRow(q) { let h = '<span class="stars big">'; for (let i = 1; i <= 3; i++) h += q >= i / 3 - 0.01 ? '&#9733;' : '<span class="off">&#9733;</span>'; return h + '</span>'; }
function dlgLatte() {
  const L = rt.latte;
  if (!L) return { title: 'Latte art', html: '<p>Nothing to pour right now.</p><div class="dfoot"><button class="btn primary" data-act="close">OK</button></div>' };
  const cv = '<div class="lattewrap"><canvas id="latte-cv" width="300" height="300" aria-label="A cup of coffee: hold and drag to pour milk"></canvas></div>';
  const help = '<p class="lathelp">Hold the mouse button (or your finger) on the coffee and trace the dashed pattern. Stay inside the light band, keep moving, and do not let the milk pile up in one spot!</p>';
  if (L.mode === 'serve') {
    const loc = L.loc, n = loc.art.length, cap = artCap(), P = PAT_BY_ID[L.pat];
    let html = '<div class="seg patsel">' + PATTERNS.map(p => {
      const ok = artPatOk(p);
      return '<button class="' + (L.pat === p.id ? 'on' : '') + (ok ? '' : ' lock') + '" data-act="latpat" data-id="' + p.id + '" title="' + esc(ok ? p.n + ': art tips x' + p.mult : p.n + ' unlocks at rank: ' + RANKS[p.rank].n) + '">' + (ok ? '' : icon('lock') + ' ') + p.n + '<small>' + (ok ? 'tips x' + p.mult : 'Locked') + '</small></button>';
    }).join('') + '</div>' + cv;
    if (L.phase === 'result') {
      const q = artQ(L.score);
      html += '<div class="latres"><div><b class="sc">' + L.score + '</b><small>/100</small></div><div style="flex:1;min-width:0">' + starRow(q) + '<b>' + artLabel(L.score) + '</b><small>' +
        (L.cup ? 'Art cup ready at ' + esc(locName(loc, state.locations.indexOf(loc))) + '! The next customer served there tips about +' + Math.round((0.2 + 0.5 * q) * P.mult * 100) + '% of the price.' : (L.score < 40 ? 'Too messy to serve. Try again!' : (L.practice ? 'Practice pour: nothing was served.' : 'The art cups are full.'))) + '</small></div></div>';
      html += '<div class="dfoot"><span class="latnote">Art cups: <b>' + n + '/' + cap + '</b></span><button class="btn" data-act="close">Done</button><button class="btn primary" data-act="latagain">' + icon('drop') + ' Pour another</button></div>';
    } else {
      html += help + '<div class="dfoot"><span class="latnote">' + (L.practice ? (n >= cap ? 'Art cups are full (' + n + '/' + cap + '): this is a practice pour.' : 'No milk here: this is a practice pour.') : 'Uses 1 milk. Art cups at ' + esc(locName(loc, state.locations.indexOf(loc))) + ': <b>' + n + '/' + cap + '</b>') + '</span><button class="btn primary" data-act="latdone">Done pouring</button></div>';
    }
    return { title: 'Latte art - ' + P.n, html: html };
  }
  // championship
  const C0 = CHAMP_BY_ID[L.champ], R = C0.pats.length;
  const table = () => '<table class="t"><tr><th>Round</th><th>You</th><th>' + esc(C0.rival.split(' ')[0]) + '</th></tr>' + C0.pats.map((p, i) => '<tr><td>' + (i + 1) + '. ' + PAT_BY_ID[p].n + '</td><td>' + (L.you[i] !== undefined ? '<b>' + L.you[i] + '</b>' + (L.bonus && L.raw[i] ? ' <small style="display:inline">(' + L.raw[i] + '+' + L.bonus + ')</small>' : '') : '-') + '</td><td>' + (L.rival[i] !== undefined ? L.rival[i] : '-') + '</td></tr>').join('') + '</table>';
  let html = '';
  if (L.phase === 'intro') {
    html += '<div class="evhead"><span class="ico" style="background:linear-gradient(#f59e0b,#b45309)">' + icon('trophy') + '</span><div><b style="font-size:17px;color:#ffe3b0">' + esc(C0.n) + '</b><p>Three latte art rounds: <b>' + C0.pats.map(p => PAT_BY_ID[p].n).join(', ') + '</b>. Your rival is <b>' + esc(C0.rival) + '</b>. The judges add up all three rounds.</p></div></div>';
    html += '<ul><li>Your team bonus: <b>+' + L.bonus + '</b> points per round (best barista Quality rank' + (L.bonus >= 3 ? ', Latte Art perk' : '') + ').</li><li>Championship judges are strict: the pattern band is narrower than at home.</li><li>Prize: <b>' + money(champWon(C0.id) ? Math.round(C0.prize * 0.25 / 50) * 50 : C0.prize) + '</b>' + (champWon(C0.id) ? ' for defending your title' : ' and a trophy decoration') + '. A tie goes to you.</li></ul>';
    html += '<div class="dfoot"><span class="latnote">Leaving now forfeits the entry fee.</span><button class="btn primary" data-act="latnext">Start round 1</button></div>';
  } else if (L.phase === 'pour') {
    html += '<div class="rndhead">Round ' + (L.round + 1) + ' of ' + R + ': <b>' + PAT_BY_ID[L.pat].n + '</b><span>vs ' + esc(C0.rival) + '</span></div>' + cv + help;
    html += '<div class="dfoot"><button class="btn primary" data-act="latdone">Done pouring</button></div>';
  } else if (L.phase === 'result') {
    const y = L.you[L.round], r = L.rival[L.round];
    html += '<div class="rndhead">Round ' + (L.round + 1) + ' of ' + R + ': <b>' + PAT_BY_ID[L.pat].n + '</b><span>' + (y >= r ? 'You win this round!' : esc(C0.rival.split(' ')[0]) + ' wins this round') + '</span></div>' + cv + table();
    html += '<div class="dfoot"><button class="btn primary" data-act="latnext">' + (L.round < R - 1 ? 'Next round' : 'See the results') + '</button></div>';
  } else {
    html += '<div class="celebrate"><div class="ico"' + (L.win ? '' : ' style="background:radial-gradient(#94a3b8,#475569);box-shadow:none"') + '>' + icon(L.win ? 'trophy' : 'x') + '</div><div class="big">' + (L.win ? 'You won!' : 'So close!') + '</div></div>';
    html += '<p style="text-align:center">' + (L.win ? 'The judges loved your pours: <b>' + L.total + '</b> to <b>' + L.rtotal + '</b>. Prize: <b>' + money(L.prize) + '</b>!' + (state.stats.champs === 1 && L.prize === C0.prize ? ' You can now build a <b>Trophy</b> decoration.' : '') : esc(C0.rival) + ' won <b>' + L.rtotal + '</b> to <b>' + L.total + '</b>. Practice with the Latte art button and try again!') + '</p>' + table();
    html += '<div class="dfoot">' + (L.win || champRested(C0) ? '' : '<button class="btn" data-act="champ" data-id="' + C0.id + '" data-cost="' + C0.fee + '">Try again - ' + money(C0.fee) + '</button>') + '<button class="btn primary" data-act="close">' + (L.win ? 'Hooray!' : 'OK') + '</button></div>';
  }
  return { title: C0.n, html: html };
}
function avatar(who) { const P = PEOPLE[who] || PEOPLE.rosa; return '<span class="avatar" style="background:' + P.col + '" title="' + esc(P.n) + '">' + P.ini + '</span>'; }
function objFmt(o, v) { return o.f === 'r' ? (Math.floor(v * 10) / 10).toFixed(1) : (o.f === '$' ? money(v) : fmt(v)); }
function dlgCareer() {
  let html = '';
  if (careerOn()) careerCheck();          // the game is paused while this is open, so tick objectives off right here
  const ch = state.career.ch;
  if (!careerOn()) {
    html += '<div class="card"><div class="row"><span class="ico">' + icon('flag') + '</span><div style="flex:1;min-width:0"><b>Free Play</b><small>You are playing without the story. Start it any time: ' + CAREER.length + ' chapters with objectives, rewards, championships and a rival to beat. Your shops and money stay as they are.</small></div></div><div class="btnrow"><button class="btn primary" data-act="careerstart">' + icon('flag') + ' Start the story</button></div></div>';
  } else {
    const J = rt.careerJust;
    if (J) html += '<div class="story done">' + avatar(J.who) + '<div class="bubble"><b>Chapter ' + J.num + ' complete: ' + esc(J.n) + '</b><p>' + esc(J.outro) + '</p><small>Reward: +' + money(J.r) + (J.rep ? ' and +' + J.rep + ' reputation' : '') + '</small></div></div>';
    const c = chapter();
    if (!c) {
      html += '<div class="celebrate"><div class="ico">' + icon('trophy') + '</div><div class="big">The End</div></div><p style="text-align:center">You finished the whole story and beat Victor Vane. Your coffee empire is a legend! Keep growing it, defend your titles and finish every goal.</p>';
    } else {
      state.career.seen = ch;
      html += '<div class="chaphead"><small>Chapter ' + (ch + 1) + ' of ' + CAREER.length + '</small><b>' + esc(c.n) + '</b></div>';
      html += '<div class="story">' + avatar(c.who) + '<div class="bubble"><small>' + esc(PEOPLE[c.who].n) + '</small><p>' + esc(c.intro) + '</p></div></div>';
      html += '<h4>Objectives</h4>' + c.obj.map((o, i) => {
        const got = objGot(i), v = Math.min(o.t, o.m());
        let extra = '';
        if (!got && o.champ) { const C0 = CHAMP_BY_ID[o.champ]; extra = champOpen(C0) ? '<button class="btn" data-act="champ" data-id="' + C0.id + '" data-cost="' + C0.fee + '" data-pri="1">Enter - ' + money(C0.fee) + '</button>' : ''; }
        else if (!got && o.latte) extra = '<button class="btn primary" data-act="latte">' + icon('drop') + ' Pour</button>';
        return '<div class="card obj' + (got ? ' done' : '') + '"><div class="row"><span class="ico">' + icon(got ? 'check' : (o.champ ? 'trophy' : 'flag')) + '</span><div style="flex:1;min-width:0"><b>' + esc(o.d) + '</b>' +
          (got ? '<small>Done!</small>' : (o.t > 1 ? bar(v / o.t * 100) + '<small>' + objFmt(o, v) + ' / ' + objFmt(o, o.t) + '</small>' : '<small>Not yet</small>')) + '</div>' + extra + '</div></div>';
      }).join('');
      const ready = chapterReady(c);
      html += '<div class="dfoot" style="justify-content:space-between;align-items:center"><span>Reward: <b style="color:var(--good)">' + money(c.r) + '</b>' + (c.rep ? ' and +' + c.rep + ' reputation' : '') + '</span><button class="btn ' + (ready ? 'primary' : 'dis') + '" data-act="careerclaim"' + (ready ? '' : ' disabled') + '>' + (ready ? icon('coin') + ' Claim reward' : 'Finish all objectives') + '</button></div>';
    }
    html += '<h4>Story</h4><div class="chlist">' + CAREER.map((c2, i) => '<div class="chrow' + (i < ch ? ' done' : (i === ch ? ' now' : '')) + '"><span class="num">' + (i < ch ? icon('check') : (i + 1)) + '</span><span>' + (i <= ch ? esc(c2.n) : '???') + '</span></div>').join('') + '</div>';
  }
  html += '<h4>Barista championships</h4><p style="font-size:12px;color:var(--muted)">Three latte art rounds against a rival barista. Your baristas\' Quality skill adds bonus points. Practice with the Latte art button (L) in the Supplies panel.</p>';
  html += CHAMPS.map(C0 => {
    const open = champOpen(C0), rec = state.champs[C0.id], won = rec && rec.won;
    return '<div class="card choice champ' + (won ? ' done' : '') + '" style="margin-bottom:8px"><span class="ico tro">' + icon('trophy') + '</span><div class="tx"><b>' + esc(C0.n) + (won ? ' - champion!' : '') + '</b><small>vs ' + esc(C0.rival) + '. Rounds: ' + C0.pats.map(p => PAT_BY_ID[p].n).join(', ') + '. Prize ' + money(won ? Math.round(C0.prize * 0.25 / 50) * 50 : C0.prize) + (rec && rec.best ? '. Your best: ' + rec.best : '') + '.</small></div>' +
      (!open ? '<button class="btn dis" disabled>' + icon('lock') + ' ' + esc(champLockText(C0)) + '</button>' : (champRested(C0) ? '<button class="btn dis" disabled>Back tomorrow</button>' : '<button class="btn" data-act="champ" data-id="' + C0.id + '" data-cost="' + C0.fee + '" data-pri="1">' + (won ? 'Defend' : 'Enter') + ' - ' + money(C0.fee) + '</button>')) + '</div>';
  }).join('');
  return { title: careerOn() ? 'Career' : 'Career and championships', html: html };
}
function dlgNews() {
  const sec = (t, items) => '<h4>' + t + '</h4><ul>' + items.map(x => '<li>' + x + '</li>').join('') + '</ul>';
  let html = '<p>Bean &amp; Brew Tycoon <b>' + GAME_VER + '</b> is the biggest update yet. Your old save keeps everything and simply gets the new stuff.</p>';
  html += sec('New in 2.0: Seasons and Stories', [
    '<b>Seasons and holidays</b>: Spring, Summer, Autumn and Winter (4 days each) change crowds, cravings, tips and the look of your shops (petals, leaves, snow). Holidays: Blossom Festival, Summer Fireworks, Halloween (customers in costume!), Winter Holidays and New Year\'s Eve. Click the clock for the calendar.',
    '<b>Seasonal menu</b>: Honey, Lemon, Pumpkin and Peppermint are only sold in their season. Discover 8 seasonal specials like the Pumpkin Spice Latte. They sell for more and everyone wants to try them.',
    '<b>Career mode</b>: an 8-chapter story with Grandma Rosa and your rival Victor Vane of MegaBucks Coffee. Every chapter has objectives and a reward (K). Prefer no story? Pick Free Play.',
    '<b>Latte art</b> (L): trace Heart, Tulip, Rosetta and Swan patterns with milk. Good pours make art cups that earn bonus tips and help with critics.',
    '<b>Barista championships</b>: Regional, National and World latte art contests with big prizes and a Trophy decoration.',
    '<b>Seasonal decorations</b>: Flowers, Parasol, Pumpkins and Snowman, extra cozy in their own season.',
    '<b>4 new upgrades</b>: Milk Steamer, Seasonal Menu, Barista Academy and Franchise Support. Plus 11 new goals.'
  ]);
  html += sec('Earlier in this update: Cities and Recipes', [
    '<b>5 new cities</b> (College Hill, Sunset Beach, Pine Ridge, Metro Downtown, Snowpeak Resort) with their own customers, prices and rent, and 5 new customer types.',
    '<b>Recipe Lab</b>: mix coffee with 8 pantry ingredients to discover drinks and pastries, then put specials on each shop menu. Customers have favorite flavors.',
    '<b>Staff skills</b>: staff level up, learn Speed, Quality and Charm perks, and can be sent to training. New <b>Manager</b> role.',
    '<b>Events with choices</b>: rush hours, festivals, food critics, power outages, viral posts, bad reviews, heat waves and inspections.',
    '<b>Franchises</b> and the <b>Chain</b> screen (C), 8 new <b>decorations</b> and a 1-5 star <b>shop rating</b>.'
  ]);
  html += '<div class="dfoot"><button class="btn primary" data-act="close">Let us brew!</button></div>';
  if (settings.seenVer !== GAME_VER) { settings.seenVer = GAME_VER; saveSettings(); const b = $('m-news-n'); if (b) b.classList.add('hidden'); }
  return { title: 'What\'s new in ' + GAME_VER, html: html };
}
function dlgEvent() {
  const p = state.pendingEv;
  if (!p) return { title: 'Event', html: '<p>Nothing is happening right now.</p><div class="dfoot"><button class="btn primary" data-act="close">OK</button></div>' };
  const E = EVENTS[p.type];
  let html = '<div class="evhead"><span class="ico">' + icon(E.icon) + '</span><div><b style="font-size:17px;color:#ffe3b0">' + esc(E.name) + '</b><p>' + esc(evText(E.desc, p)) + '</p></div></div><h4>What do you do?</h4>';
  html += E.choices.map((ch, i) => {
    const cost = choiceCost(ch), why = ch.req ? ch.req(p) : '';
    const btn = why ? '<button class="btn dis" data-act="evpick" data-i="' + i + '">' + esc(why) + '</button>' : '<button class="btn primary" data-act="evpick" data-i="' + i + '"' + (cost ? ' data-cost="' + cost + '" data-pri="1"' : '') + '>' + (cost ? money(cost) : 'Free') + '</button>';
    return '<div class="card choice" style="margin-bottom:8px"><div class="tx"><b>' + esc(ch.n) + '</b><small>' + esc(evText(ch.d, p)) + (ch.perShop && cost ? ' (' + money(ch.cost) + ' per shop)' : '') + '</small></div>' + btn + '</div>';
  }).join('');
  html += '<p style="font-size:12px;color:var(--muted);margin-top:4px">The game is paused while you decide. Closing this window picks the last option.</p>';
  return { title: 'Something is happening!', html: html };
}

