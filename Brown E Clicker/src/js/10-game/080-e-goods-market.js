       // --- E-GOODS MARKET ---
       const marketModal = document.getElementById('market-modal');
       const marketRows = document.getElementById('market-rows');
       const chartCanvas = document.getElementById('market-chart');
       const chartCtx = chartCanvas.getContext('2d');
       let marketSel = 0;
       let marketBuilt = false;
       const mkEls = [];

       function goodBuyPrice(i) { return market.goods[i].v * marketDollar() * (1 + marketFee()); }
       function goodSellPrice(i) { return market.goods[i].v * marketDollar() * PRES.mktSell; }
       function marketTick(dt) {
           if (!market.unlocked) return;
           market.tick += dt;
           let stepped = false;
           while (market.tick >= MARKET_TICK) {
               market.tick -= MARKET_TICK;
               for (let i = 0; i < GOODS.length; i++) marketStep(market.goods[i], GOODS[i].rest);
               stepped = true;
           }
           if (!marketModal.classList.contains('hidden')) renderMarket(stepped);
       }
       function buyGood(i, n) {
           const g = market.goods[i];
           const unit = goodBuyPrice(i);
           const room = marketCap() - g.own;
           if (n === 'max') n = Math.floor(state.brownEs / unit);
           n = Math.min(n, room);
           if (!(n >= 1) || state.brownEs < unit * n) return false;
           spend(unit * n);
           const paid = g.v * (1 + marketFee());
           g.avg = (g.avg * g.own + paid * n) / (g.own + n);
           g.own += n;
           if (g.own >= marketCap()) unlockAchievement('mkt4');
           return true;
       }
       function sellGood(i, n) {
           const g = market.goods[i];
           if (n === 'all') n = g.own;
           n = Math.min(n, g.own);
           if (!(n >= 1)) return false;
           const value = goodSellPrice(i) * n;
           earn(value, 'market');
           state.life.marketProfit += (g.v * PRES.mktSell - g.avg) * n;
           state.life.marketTrades++;
           g.own -= n;
           if (g.own === 0) g.avg = 0;
           if (!settings.reduced && mkEls[i]) { const b = mkEls[i].row.getBoundingClientRect(); createFloatingText({ clientX: b.left + b.width * 0.75, clientY: b.top }, `+${formatShort(value)}`); }
           return true;
       }

       function buildMarket() {
           marketRows.innerHTML = '';
           GOODS.forEach((gd, i) => {
               const row = document.createElement('div');
               row.className = 'mk-row flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1.5 rounded-lg border-b border-stone-800 cursor-pointer';
               row.dataset.good = i;
               row.innerHTML = `
                   <div class="flex items-center gap-2 w-40 shrink-0"><span class="text-2xl">${gd.icon}</span><span class="leading-tight"><b class="text-white text-sm">${gd.name}</b><br><span class="text-[0.65rem] text-stone-500 font-black tracking-widest">${gd.sym}</span></span></div>
                   <div class="w-28 shrink-0 leading-tight"><span data-k="price" class="font-black text-white text-sm"></span> <span data-k="chg" class="text-xs font-bold"></span><br><span data-k="eprice" class="text-[0.7rem] text-stone-400"></span></div>
                   <div class="w-24 shrink-0 leading-tight text-xs"><span data-k="own" class="font-bold text-white"></span><br><span data-k="avg" class="text-stone-400"></span></div>
                   <div class="flex gap-1 ml-auto">
                       <button class="mk-btn" data-act="b1">Buy 1</button><button class="mk-btn" data-act="b10">10</button><button class="mk-btn" data-act="bmax">Max</button>
                       <span class="w-1"></span>
                       <button class="mk-btn" data-act="s1">Sell 1</button><button class="mk-btn" data-act="s10">10</button><button class="mk-btn" data-act="sall">All</button>
                   </div>`;
               marketRows.appendChild(row);
               const q = (k) => row.querySelector(`[data-k="${k}"]`);
               mkEls[i] = { row, price: q('price'), chg: q('chg'), eprice: q('eprice'), own: q('own'), avg: q('avg'), btns: {} };
               row.querySelectorAll('[data-act]').forEach(b => { mkEls[i].btns[b.dataset.act] = b; });
           });
           marketBuilt = true;
       }
       function renderMarket(redrawChart) {
           if (!marketBuilt) buildMarket();
           const cap = marketCap();
           const dollar = marketDollar();
           for (let i = 0; i < GOODS.length; i++) {
               const g = market.goods[i], r = mkEls[i];
               const prev = g.hist[(g.hi + MARKET_HIST - 2) % MARKET_HIST];
               const chg = prev > 0 ? (g.v / prev - 1) * 100 : 0;
               setText(r.price, `$${g.v.toFixed(2)}`);
               setText(r.chg, `${chg >= 0 ? '▲' : '▼'}${Math.abs(chg).toFixed(1)}%`);
               const cls = chg >= 0 ? 'text-green-400' : 'text-red-400';
               if (r.chg._cls !== cls) { r.chg.className = `text-xs font-bold ${cls}`; r.chg._cls = cls; }
               setText(r.eprice, `${formatShort(goodBuyPrice(i))} E each`);
               setText(r.own, `${g.own} / ${cap}`);
               setText(r.avg, g.own ? `paid $${g.avg.toFixed(2)}` : '');
               const unit = goodBuyPrice(i);
               setDisabled(r.btns.b1, g.own >= cap || state.brownEs < unit);
               setDisabled(r.btns.b10, g.own + 10 > cap || state.brownEs < unit * 10);
               setDisabled(r.btns.bmax, g.own >= cap || state.brownEs < unit);
               setDisabled(r.btns.s1, g.own < 1);
               setDisabled(r.btns.s10, g.own < 10);
               setDisabled(r.btns.sall, g.own < 1);
               const sel = i === marketSel ? '1' : '0';
               if (r.row._sel !== sel) { r.row._sel = sel; r.row.dataset.sel = sel; }
           }
           setText(document.getElementById('market-dollar'), `$1 = 1 second of your best E/s this run = ${formatShort(dollar)} E's · storage ${cap} per good (+1 per 5 E-Banks) · ${marketFee() ? '2% fee when buying' : 'no buying fee'}`);
           setText(document.getElementById('market-next'), `Prices change in ${Math.ceil(MARKET_TICK - market.tick)}s`);
           setText(document.getElementById('market-foot'), `Market profit (all time): $${formatShort(Math.max(0, state.life.marketProfit))} · trades: ${formatNumber(state.life.marketTrades)} · goods are sold off when you ascend.`);
           if (redrawChart) drawMarketChart();
       }
       function drawMarketChart() {
           const g = market.goods[marketSel], gd = GOODS[marketSel];
           const W = chartCanvas.width, H = chartCanvas.height;
           const ctx = chartCtx;
           ctx.clearRect(0, 0, W, H);
           let lo = Infinity, hi = 0;
           for (let k = 0; k < MARKET_HIST; k++) { const v = g.hist[k]; if (v < lo) lo = v; if (v > hi) hi = v; }
           if (g.own) { lo = Math.min(lo, g.avg); hi = Math.max(hi, g.avg); }
           const pad = (hi - lo) * 0.15 + 0.01;
           lo -= pad; hi += pad;
           const y = (v) => H - 6 - (v - lo) / (hi - lo) * (H - 12);
           ctx.strokeStyle = '#292524';
           ctx.lineWidth = 1;
           for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, H * k / 4); ctx.lineTo(W, H * k / 4); ctx.stroke(); }
           if (g.own) {
               ctx.strokeStyle = '#FACC15';
               ctx.setLineDash([6, 5]);
               ctx.beginPath(); ctx.moveTo(0, y(g.avg)); ctx.lineTo(W, y(g.avg)); ctx.stroke();
               ctx.setLineDash([]);
           }
           const first = g.hist[g.hi], last = g.v;
           ctx.strokeStyle = last >= first ? '#4ADE80' : '#F87171';
           ctx.lineWidth = 2.5;
           ctx.beginPath();
           for (let k = 0; k < MARKET_HIST; k++) {
               const v = g.hist[(g.hi + k) % MARKET_HIST];
               const x = k / (MARKET_HIST - 1) * (W - 8) + 4;
               if (k === 0) ctx.moveTo(x, y(v)); else ctx.lineTo(x, y(v));
           }
           ctx.stroke();
           setText(document.getElementById('market-chart-title'), `${gd.icon} ${gd.name} (${gd.sym}) $${g.v.toFixed(2)}`);
           setText(document.getElementById('market-chart-sub'), `Last 10 minutes · normal price about $${gd.rest}${g.own ? ` · yellow line = what you paid` : ''}`);
       }
       marketRows.addEventListener('click', (e) => {
           const row = e.target.closest('[data-good]');
           if (!row) return;
           const i = Number(row.dataset.good);
           const b = e.target.closest('[data-act]');
           if (b) {
               const a = b.dataset.act;
               if (a === 'b1') buyGood(i, 1); else if (a === 'b10') buyGood(i, 10); else if (a === 'bmax') buyGood(i, 'max');
               else if (a === 's1') sellGood(i, 1); else if (a === 's10') sellGood(i, 10); else if (a === 'sall') sellGood(i, 'all');
               checkAchievements();
               updateDisplay();
           }
           marketSel = i;
           renderMarket(true);
       });
       function openMarket() {
           if (!market.unlocked) return;
           hideTooltip();
           marketModal.classList.remove('hidden');
           renderMarket(true);
       }
       document.getElementById('market-close').addEventListener('click', () => marketModal.classList.add('hidden'));
       marketModal.addEventListener('mousedown', (e) => { if (e.target === marketModal) marketModal.classList.add('hidden'); });

       const r2 = (v) => Math.round(v * 100) / 100;
       function saveMarket() {
           return {
               unlocked: market.unlocked, tick: r2(market.tick),
               goods: market.goods.map(g => ({ v: r2(g.v), d: Math.round(g.d * 1e5) / 1e5, mode: g.mode, dur: g.dur, own: g.own, avg: r2(g.avg), hi: g.hi, hist: g.hist.map(r2) }))
           };
       }
       function loadMarket(d) {
           if (!d || typeof d !== 'object') return;
           market.unlocked = !!d.unlocked;
           market.tick = Math.min(MARKET_TICK, cleanNum(d.tick));
           if (!Array.isArray(d.goods)) return;
           d.goods.forEach((s, i) => {
               const g = market.goods[i];
               if (!g || !s || typeof s !== 'object') return;
               const rest = GOODS[i].rest;
               if (cleanNum(s.v) > 0) g.v = Math.min(rest * 3, Math.max(rest * 0.25, s.v));
               g.d = typeof s.d === 'number' && isFinite(s.d) ? Math.max(-0.2, Math.min(0.2, s.d)) : 0;
               g.mode = Math.floor(cleanNum(s.mode)) % MARKET_MODES.length;
               g.dur = Math.max(1, Math.floor(cleanNum(s.dur, 5)));
               g.own = Math.floor(cleanNum(s.own));
               g.avg = cleanNum(s.avg);
               g.hi = Math.floor(cleanNum(s.hi)) % MARKET_HIST;
               if (Array.isArray(s.hist) && s.hist.length === MARKET_HIST) for (let k = 0; k < MARKET_HIST; k++) g.hist[k] = cleanNum(s.hist[k], rest) || rest;
           });
       }

       // Ascending sells off market goods; a save wipe resets both minigames
       function resetMinigames(keepWins) {
           if (!keepWins) {
               garden = freshGarden();
               market = freshMarket();
               gardenSeedsKey = '';
           } else {
               market.goods.forEach(g => { g.own = 0; g.avg = 0; });
           }
       }

       // Unlocking the minigames (forever) by owning enough of their building
       function checkMinigameUnlocks() {
           if (!garden.unlocked && BUILDING.farm.owned >= GARDEN_UNLOCK) {
               garden.unlocked = true;
               showGoldenMessage('E GARDEN UNLOCKED!', 'Click 🌱 next to the E to plant seeds that grow into buffs.');
           }
           if (!market.unlocked && BUILDING.bank.owned >= MARKET_UNLOCK) {
               market.unlocked = true;
               showGoldenMessage('E-GOODS MARKET UNLOCKED!', 'Click 📈 next to the E to buy goods low and sell them high.');
           }
           refreshToolbar();
       }
       function refreshToolbar() {
           const set = (id, locked, req) => { const b = document.getElementById(id); const v = locked ? '1' : '0'; if (b._locked !== v) { b._locked = v; b.dataset.locked = v; } if (locked && b.dataset.req !== req) b.dataset.req = req; };
           set('tb-garden', !garden.unlocked, `${BUILDING.farm.owned}/${GARDEN_UNLOCK} Farms`);
           set('tb-market', !market.unlocked, `${BUILDING.bank.owned}/${MARKET_UNLOCK} Banks`);
       }
       // Redraw panels that are open (after a number format change, tree purchase, etc.)
       function refreshOpenPanels() {
           if (!gardenModal.classList.contains('hidden')) { gardenSeedsKey = ''; renderGarden(); }
           if (!marketModal.classList.contains('hidden')) renderMarket(true);
           if (!treeModal.classList.contains('hidden')) { treeSideKey = ''; refreshTreeUI(); }
       }

       TOOLBAR_ACTIONS.garden = openGarden;
       TOOLBAR_ACTIONS.market = openMarket;
       TOOLBAR_TIPS.garden = () => garden.unlocked
           ? ['🌱 E Garden', `Plant seeds that grow into buffs, and breed new ones. ${grownPlants()} plants fully grown.`]
           : ['🌱 E Garden (locked)', `Own ${GARDEN_UNLOCK} E-Farms to unlock the garden (${BUILDING.farm.owned}/${GARDEN_UNLOCK}).`];
       TOOLBAR_TIPS.market = () => market.unlocked
           ? ['📈 E-Goods Market', 'Buy goods when they\'re cheap, sell them when the price goes up.']
           : ['📈 E-Goods Market (locked)', `Own ${MARKET_UNLOCK} E-Banks to unlock the market (${BUILDING.bank.owned}/${MARKET_UNLOCK}).`];


       // --- SEASONAL EVENTS ---
       let currentEvent = null;
       let forcedEvent = null; // debug / tests
       const eventPill = document.getElementById('event-pill');
       function refreshEvent() {
           const e = !settings.events ? null : forcedEvent ? EVENTS.find(x => x.id === forcedEvent) || null : eventForDate(new Date());
           if (e === currentEvent) return;
           currentEvent = e;
           eventPill.classList.toggle('hidden', !e);
           setText(eventPill, e ? `${e.icon} ${e.name.replace(/^the /, 'The ')}` : '');
           if (e) goldenEl.dataset.ev = e.id; else delete goldenEl.dataset.ev;
           setText(document.getElementById('golden-ev'), e ? e.golden : '');
       }
       // Chance that a golden E gives the event's special effect instead
       function eventGoldenChance() { return currentEvent ? Math.min(0.6, 0.25 * PRES.festive) : 0; }
       function eventGoldenEffect(event, g) {
           const e = currentEvent;
           if (!e) return null;
           state.meta.seasons[e.id] = true;
           state.life.eventGolden++;
           if (e.id === 'winter') {
               const pool = shopItems.filter(i => i.type === 'bps' && i.owned > 0 && !buildingBlocked(i));
               if (!pool.length) return luckyEffect(2, 'GIFT BOX!', event);
               const item = pool[Math.floor(Math.random() * pool.length)];
               let n = Math.max(1, Math.floor(item.owned * 0.05));
               if (challengeIs('minimal')) n = Math.min(n, 10 - item.owned);
               item.owned += n;
               repriceBuildings();
               recalculateStats();
               refreshCosts();
               refreshRowStats();
               const el = document.getElementById(`owned-${shopItems.indexOf(item)}`);
               if (el) el.textContent = item.owned;
               return { title: 'GIFT BOX!', sub: `+${n} free ${item.name}${n === 1 ? '' : 's'}` };
           }
           if (e.id === 'valentine') {
               const dur = Math.round(60 * g.dur);
               addBuff('love', '💝', 'Sweetheart', 3, dur);
               addBuff('lovec', '💘', 'Sweet Clicks', 3, dur);
               return { title: 'SWEETHEART!', sub: `E/s and click power x3 for ${dur} seconds` };
           }
           if (e.id === 'spring') {
               if (state.run.eggs >= 10) return luckyEffect(2, 'GOLDEN EGG!', event);
               state.run.eggs++;
               recalculateStats();
               refreshRowStats();
               return { title: 'GOLDEN EGG!', sub: `+2% E/s for the rest of this run (${state.run.eggs}/10 eggs)` };
           }
           if (e.id === 'eday') {
               addBuff('frenzy', '🔥', 'Frenzy', 7, Math.round(66 * g.dur));
               addBuff('click', '👆', 'Click Frenzy', 777, Math.round(13 * g.dur));
               return { title: 'PARTY TIME!', sub: 'Frenzy and Click Frenzy at the same time!' };
           }
           if (e.id === 'summer') {
               const dur = Math.round(77 * g.dur);
               addBuff('heat', '🔆', 'Heat Wave', 5, dur);
               return { title: 'HEAT WAVE!', sub: `E/s x5 for ${dur} seconds` };
           }
           if (e.id === 'school') {
               golden.timer = 10;
               return luckyEffect(2, 'EXTRA CREDIT!', event, ' (and another Golden E in 10s)');
           }
           if (e.id === 'halloween') {
               if (Math.random() < 0.5) return luckyEffect(3, 'TREAT!', event);
               const dur = Math.round(30 * g.dur);
               addBuff('trick', '👻', 'Spooky Frenzy', 13, dur);
               return { title: 'TRICK!', sub: `Spooky Frenzy: E/s x13 for ${dur} seconds` };
           }
           if (e.id === 'harvest') {
               const dur = Math.round(120 * g.dur);
               addBuff('pie', '🥧', 'Pie Rush', 3, dur);
               return { title: 'PIE RUSH!', sub: `E/s x3 for ${dur} seconds` };
           }
           return null;
       }
       function luckyEffect(times, title, event, extra) {
           const amount = luckyAmount() * times;
           earn(amount, 'golden');
           state.life.lucky++;
           if (amount > state.life.biggestLucky) state.life.biggestLucky = amount;
           createFloatingText(event, `+${formatShort(amount)}`);
           return { title, sub: `+${formatNumber(amount)} Brown E's${extra || ''}` };
       }
       eventPill.addEventListener('mouseover', () => {
           if (!currentEvent || tooltipAnchor === eventPill) return;
           tooltipEl.innerHTML = `<div class="font-black text-white">${currentEvent.icon} ${currentEvent.name.replace(/^the /, 'The ')} is on!</div><div class="text-sm text-stone-300 mt-1">Golden E's look different, and some give a special effect:</div><div class="text-sm text-green-400 font-bold mt-1">${currentEvent.effect}</div><div class="text-xs text-stone-500 mt-1">Catch one for an event achievement and skin. Turn events off in Settings.</div>`;
           tooltipAnchor = eventPill;
           placeTooltip(eventPill);
       });
       eventPill.addEventListener('mouseleave', hideTooltip);
       function extraHeadlines(pool) {
           if (currentEvent) {
               const ev = {
                   winter: ['Snow day! Schools closed, E production unaffected.', 'Santa\'s elves switch to making Brown E\'s. "Easier to wrap," they say.'],
                   valentine: ['Roses are brown, violets are brown, everything is brown.', 'Card sales soar: "You\'re E-mazing" is this year\'s top seller.'],
                   spring: ['Golden eggs spotted near the big E. Kids advised to click quickly.', 'Easter bunny admits all his eggs are actually Brown E\'s.'],
                   eday: ['Happy E Day! Cake shaped like a giant E feeds the whole town.', 'E Day parade: 5,000 marching E\'s and one confused F.'],
                   summer: ['Heat wave melts chocolate E\'s. Scientists: "still counts".', 'Beach closed after sandcastle shaped like an E becomes self-aware.'],
                   school: ['Back to school! Teachers report a suspicious number of E\'s in essays.', 'Pop quiz: what comes after D? (Hint: it\'s brown.)'],
                   halloween: ['Most popular costume this year: a large brown letter.', 'Haunted house reports ghosts that only say "EEEEEE".'],
                   harvest: ['Pie Festival record: one pie shaped like an E, 40 feet wide.', 'Farmers thankful for record E harvest.']
               }[currentEvent.id];
               if (ev) pool.push(ev[0], ev[1], ev[0], ev[1]);
           }
           if (activeChallenge()) pool.push(`Brave clicker attempts the "${activeChallenge().name}" challenge. Experts say "good luck".`);
           if (state.meta.ascensions > 0) pool.push('Angels report record Heavenly Chip deliveries this year.', 'Ascended clicker spotted in heaven, still clicking.');
           if (garden.unlocked && grownPlants() > 0) pool.push('Local garden wins "Brownest Lawn" award.', `Mutant ${SEEDS[Math.floor(Math.random() * SEEDS.length)].name} spotted in a nearby garden.`);
           if (market.unlocked) {
               for (let i = 0; i < GOODS.length; i++) {
                   const g = market.goods[i];
                   if (g.mode === 3) pool.push(`${GOODS[i].name} prices soaring! Everyone wants some ${GOODS[i].sym}.`);
                   else if (g.mode === 4) pool.push(`${GOODS[i].name} prices crash. Investors "a bit sad".`);
               }
           }
       }


