       // --- TRAINING (2.1) --- three lessons on the Tutor engine (098-tutor.js), the Training list, the first-visit offer.
       // Every lesson runs in a SANDBOX: the real run is saved and kept as a string (TUT.snap), the game is reset in memory to a
       // practice state, saveGame() writes nothing while TUT.sandbox is on, and when the lesson ends the real run is loaded back
       // from that string. So nothing done in a lesson reaches the save, life.earned, ascensions, chips or the leaderboards, and
       // clicks in a lesson skip the auto-click guard (no strikes in brownEClicker_ac). Lessons done: save field `tut`
       // ({ id: 1 }, in brownEClickerSave or brownEClickerSave_rb: each variant keeps its own), `tutOffer`: the offer was shown.
       // (var, not const: saveGame / acceptClick / the achievement toast look at TUT before this piece runs.)
       var TUT = { done: {}, offer: 0, sandbox: false, snap: null };
       function tutLoad(data) {
           if (!data || typeof data !== 'object') return;
           if (data.tut && typeof data.tut === 'object') for (const id in data.tut) if (data.tut[id]) TUT.done[id] = 1;
           if (data.tutOffer) TUT.offer = 1;
           tutBadge();
       }
       function tutField() { const o = {}; for (const id in TUT.done) if (TUT.done[id]) o[id] = 1; return o; }
       Tutor.config({
           done: id => !!TUT.done[id],
           mark: id => {
               TUT.done[id] = 1;
               if (TUT.sandbox) {          // keep the mark even if the tab closes mid-lesson: patch the kept real save
                   try { const o = JSON.parse(TUT.snap); o.tut = tutField(); TUT.snap = JSON.stringify(o); localStorage.setItem(SAVE_KEY, TUT.snap); } catch (e) { /* storage blocked */ }
               } else saveGame(true);
               tutBadge();
           },
           z: 9000
       });

       const tq = id => document.getElementById(id);
       const tShown = el => !!el && !el.classList.contains('hidden');
       function tutShowGame() {
           tq('main-menu').classList.add('hidden');
           gameScreen.classList.remove('hidden');
       }
       function tutClosePanels() {
           ['stats-modal', 'market-modal', 'garden-modal', 'tree-modal', 'ascend-modal', 'skins-modal', 'settings-modal', 'ach-modal', 'welcome-modal', 'news-modal', 'reset-modal']
               .forEach(id => { const e = tq(id); if (e) e.classList.add('hidden'); });
           hideGolden();
           hideTooltip();
       }
       // Enter the sandbox: save the real run, keep it, reset to a practice state (prep() sets up a later point in the game)
       function tutSandbox(prep) {
           if (!TUT.sandbox) {
               saveGame(true);
               TUT.snap = JSON.stringify(buildSaveData());
               TUT.sandbox = true;
           }
           tutClosePanels();
           resetRun(false);                 // in memory only: saveGame() is off in the sandbox
           setBuyAmount(1);
           golden.timer = 99999;            // no surprise Golden E's; the lesson that needs one makes it
           if (prep) prep();
           repriceBuildings();
           recalculateStats();
           state.run.bestBase = state.bpsBase;
           initShop();
           refreshUpgrades(true);
           refreshToolbar();
           updateDisplay();
           tutShowGame();
           return true;
       }
       // Leave the sandbox: throw the practice state away and load the real run back exactly as it was
       function tutRestore() {
           if (!TUT.sandbox) return;
           tutClosePanels();
           resetRun(false);
           TUT.sandbox = false;
           let d = null;
           try { d = JSON.parse(TUT.snap); } catch (e) { /* never happens: we made it */ }
           TUT.snap = null;
           if (d) { d.t = Date.now(); loadGame(JSON.stringify(d)); }   // (t = now: the lesson's minutes are not "away" time)
           saveGame(true);
           if (state.meta.heaven) openTree();
       }
       // a practice game further along: these buildings, this many E's
       function tutOwn(own) { for (const id in own) if (BUILDING[id]) BUILDING[id].owned = own[id]; }
       // make sure the player can afford the cheapest thing in a list (a practice gift)
       function tutAfford(cost) { if (cost > 0 && state.brownEs < cost) { earn(cost - state.brownEs + 1, 'gift'); updateDisplay(); refreshCosts(); } }
       const tPanel = id => () => { const e = tq(id); return e && e.closest('.rounded-xl'); };
       const tUpgN = () => Object.keys(state.upgrades).length;

       Tutor.define({
           id: 'start', title: 'Getting started', blurb: 'Click the E, buy your first building, upgrades and the stats page', next: 'grow',
           begin: () => tutSandbox(null), finish: () => tutRestore(), alive: () => TUT.sandbox,
           end: 'That is the whole idea: click, buy buildings, buy upgrades, repeat. This was a practice game, so your real save is just as you left it. Next, <b>Growing</b> shows Golden E\'s, synergies and the market.',
           steps: [
               { title: 'Click the E', text: 'This is a practice game that starts from zero. <b>Click the big brown E</b>: every click gives you Brown E\'s. Click until you have enough for a Pointer Finger.',
                   el: '#big-e-container', wait: () => state.brownEs >= BUILDING.pointer.cost },
               { title: 'Buy your first building', text: 'Buildings make E\'s for you. Press the <b>Cost</b> button to buy a <b>Pointer Finger</b>.', el: '#shop-item-0',
                   wait: () => BUILDING.pointer.owned >= 1 },
               { title: 'E\'s per second', text: 'Your Pointer now makes E\'s every second, all by itself. Buildings keep working (a bit slower) even while you are away.',
                   el: () => tq('bps').parentElement },
               { title: 'More buildings', text: 'Each building costs a little more than the last one. New kinds appear as you earn more: a <b>???</b> row is coming soon. Hover a building to see what it makes.',
                   el: '#shop-container' },
               { title: 'Buy an upgrade', text: 'Upgrades appear here as you play. Each is bought once and makes something stronger. We gave you some practice E\'s: <b>click an upgrade</b> to buy it.',
                   el: tPanel('upgrade-grid'), enter: () => { refreshUpgrades(true); const u = availableUpgrades[0]; if (u) tutAfford(u.cost); },
                   base: () => ({ n: tUpgN() }), wait: b => tUpgN() > b.n },
               { title: 'General upgrades', text: '<b>Click Power</b> and <b>E\'s Per Sec</b> can be raised again and again: each level adds a little more, and the price goes up each time.',
                   el: tPanel('upgrade-click-btn') },
               { title: 'Your stats', text: 'Open <b>📊 Stats</b>.', el: '#stats-btn', wait: () => tShown(statsModal) },
               { title: 'The stats page', text: 'This page shows everything you have done: this run, all time and your prestige. Close it with the <b>✕</b>.',
                   el: '#stats-close', wait: () => !tShown(statsModal) },
               { title: 'Achievements', text: '<b>🏆</b> lists your achievements. Each one you unlock gives <b>+1% production</b> for good.', el: '#ach-btn' },
               { title: 'Lessons any time', text: 'The <b>🎓</b> button opens these lessons again. Next ones: Golden E\'s, synergies, the market, and ascending.', el: '#tb-learn' }
           ]
       });
       Tutor.define({
           id: 'grow', title: 'Growing', blurb: 'Golden E\'s, buying 10 at once, synergies, the market, the garden and events', next: 'ascend',
           begin: () => tutSandbox(() => {
               tutOwn({ pointer: 20, crayon: 15, mouse: 10, farm: 15, mech: 5, factory: 12, bakery: 10, gaming: 3, router: 10, bank: 15 });
               garden.unlocked = true; market.unlocked = true;
               earn(BUILDING.bank.cost * 4, 'gift');
           }),
           finish: () => tutRestore(), alive: () => TUT.sandbox,
           end: 'You know how to grow fast: Golden E\'s, synergies and the minigames. Last lesson: <b>Ascending</b>, the way past the end of a run.',
           steps: [
               { title: 'A practice game further along', text: 'This practice game has some buildings already, so you can see the later parts of the game. Your real save is safe.' },
               { title: 'Golden E', text: 'Now and then a <b>Golden E</b> pops up. Click it before it fades for a bonus: lots of E\'s, a production frenzy or super clicks.',
                   el: '#golden-e', enter: () => { if (golden.life <= 0) spawnGolden(); },
                   base: () => ({ g: state.life.golden }),
                   wait: b => { if (state.life.golden > b.g) return true; if (golden.life <= 0) spawnGolden(); golden.life = Math.max(golden.life, 6); goldenEl.classList.remove('fading'); return false; } },
               { title: 'Buffs', text: 'A Golden E\'s effect shows up here with its timer. Effects from several Golden E\'s stack.', el: '#buff-bar', when: () => state.buffs.length > 0 },
               { title: 'Buy 10 at once', text: 'Press <b>x10</b> (or x100) to buy buildings ten at a time.', el: '#buy-amount', base: () => ({ a: buyAmount }), wait: b => buyAmount !== b.a },
               { title: 'Synergies', text: 'Upgrades with a <b>purple</b> border are <b>synergies</b>: one building gets stronger for every copy of another. Buy one.',
                   el: tPanel('upgrade-grid'), enter: () => { refreshUpgrades(true); const u = availableUpgrades.find(x => x.kind === 'syn'); if (u) tutAfford(u.cost); },
                   base: () => ({ n: upgradesOwned('syn') }), wait: b => upgradesOwned('syn') > b.n },
               { title: 'The market', text: 'Own 15 E-Banks and the <b>📈 E-Goods Market</b> opens. Open it.', el: '#tb-market', wait: () => tShown(marketModal) },
               { title: 'Buy low', text: 'Prices go up and down. <b>Buy</b> some of any good.', el: () => tq('market-rows'), enter: () => { if (!tShown(marketModal)) openMarket(); },
                   base: () => ({ n: market.goods.reduce((s, g) => s + g.own, 0) }), wait: b => market.goods.reduce((s, g) => s + g.own, 0) > b.n },
               { title: 'Sell high', text: 'Now <b>sell</b> it. For real profit, wait until the price is higher than what you paid.', el: () => tq('market-rows'), enter: () => { if (!tShown(marketModal)) openMarket(); },
                   base: () => ({ n: state.life.marketTrades }), wait: b => state.life.marketTrades > b.n },
               { title: 'The garden', text: 'Own 15 E-Farms and the <b>🌱 E Garden</b> opens: plant seeds that grow into buffs, and breed rare plants.', el: '#tb-garden',
                   enter: () => marketModal.classList.add('hidden') },
               { title: 'Seasonal events', text: 'On holidays an <b>event</b> shows up here, with its own Golden E effect, achievements and skins. You can turn events off in Settings.',
                   el: () => tShown(eventPill) ? eventPill : null }
           ]
       });
       Tutor.define({
           id: 'ascend', title: 'Ascending', blurb: 'What ascending and Heavenly Chips do, the Prestige Tree and challenge runs', next: null,
           begin: () => tutSandbox(() => {
               tutOwn({ pointer: 60, crayon: 50, mouse: 30, farm: 50, mech: 25, factory: 40, bakery: 40, gaming: 20, router: 40, bank: 30, temple: 20 });
               earn(CHIP_BASE * 40, 'gift');
               state.meta.chips = TREE_BY_ID.root.cost + 2; state.meta.chipsTotal = state.meta.chips;
               recalcPrestige();
           }),
           finish: () => tutRestore(), alive: () => TUT.sandbox,
           end: 'When a run slows down, ascend: you start again, but stronger every time. Nothing was reset here, it was all practice. Lessons stay under <b>🎓</b> if you want them again.',
           steps: [
               { title: 'The angel button', text: 'Once a run has earned enough, the <b>👼</b> button glows with the Heavenly Chips you would get. Open it.', el: '#tb-tree', wait: () => tShown(treeModal) },
               { title: 'Ascend', text: '<b>Ascending</b> ends this run: buildings, upgrades and E\'s go back to zero. In return you bank <b>Heavenly Chips</b>. You can ascend once a run has earned ' + formatShort(CHIP_BASE) + ' E\'s. (No need to press it now.)',
                   el: '#tree-ascend', enter: () => { if (!tShown(treeModal)) openTree(); } },
               { title: 'Heavenly Chips', text: 'Every chip you have ever earned gives <b>+' + CHIP_PCT + '% production</b> for good, and you can also spend chips here. Your next run starts faster.',
                   el: () => tq('tree-chips').parentElement, enter: () => { if (!tShown(treeModal)) openTree(); } },
               { title: 'Buy a tree upgrade', text: 'We gave you a few practice chips. Click the <b>👼 Heavenly E</b> in the middle of the tree to buy it.',
                   el: () => TREE_BY_ID.root.el, enter: () => { if (!tShown(treeModal)) openTree(); }, base: () => ({ n: treeOwned() }), wait: b => treeOwned() > b.n },
               { title: 'The branches', text: 'Each branch makes one thing stronger (production, clicking, Golden E\'s, the minigames...). A node needs the one before it. Hover a node to read it.',
                   el: '#tree-scroll', enter: () => { if (!tShown(treeModal)) openTree(); } },
               { title: 'Challenge runs', text: 'After ascending you pick your next run here. Buy the trial node and you can also start a <b>challenge run</b> with a twist (no clicking, no Golden E\'s...). Beat it for a permanent reward.',
                   el: () => tShown(treeModal) && tq('tree-side').offsetWidth > 2 ? tq('tree-side') : null, enter: () => { if (!tShown(treeModal)) openTree(); } },
               { title: 'Back to the game', text: 'Close the tree with the <b>✕</b>.', el: '#tree-close', when: () => !state.meta.heaven, wait: () => !tShown(treeModal) }
           ]
       });

       // the 🎓 button says NEW until a lesson is done
       function tutBadge() { const e = tq('tb-learn-badge'); if (e) e.classList.toggle('hidden', Tutor.list.some(l => Tutor.done(l.id))); }
       function tutHub() {
           Tutor.hub({ title: 'How to play Brown E Clicker', intro: 'Short lessons where you do each step yourself. They run in a practice game: your real save, leaderboard numbers and achievements are never touched. Esc or "Skip lesson" leaves at any time.' });
       }
       // a brand-new player's first START: offer the first lesson once (the answer, or just seeing it, is remembered)
       function tutOffer(force) {
           if (TUT.offer || Tutor.active || TUT.sandbox) return false;
           if (!force && (state.life.earned >= 1000 || state.meta.ascensions > 0 || state.meta.heaven)) return false;
           TUT.offer = 1; saveGame(true);
           Tutor.offer({ kicker: 'Welcome', time: '1 minute', les: 'start', title: 'New here? Learn the basics?', text: 'A quick practice game: click the E, buy a building and an upgrade. You do each step yourself, and your real game is not touched.',
               answer: () => tutBadge() });
           return true;
       }
       TOOLBAR_ACTIONS.learn = tutHub;
       TOOLBAR_TIPS.learn = ['🎓 How to play', 'Short hands-on lessons in a practice game: the basics, growing and ascending.'];
       tq('menu-learn').addEventListener('click', tutHub);
       tq('start-btn').addEventListener('click', () => setTimeout(() => { if (!gameScreen.classList.contains('hidden')) tutOffer(); }, 700));
       tutBadge();
       function tutHook() {
           return {
               start: id => Tutor.start(id), stop: how => Tutor.stop(how), next: () => Tutor.next(), back: () => Tutor.back(), hub: () => tutHub(), offer: f => tutOffer(f),
               get active() { return Tutor.active; }, get lesson() { return Tutor.lesson && Tutor.lesson.id; }, get i() { return Tutor.i; }, get title() { return Tutor.step && Tutor.step.title; },
               get finale() { return Tutor.finale; }, get stepDone() { return Tutor.stepDone; }, get hubOpen() { return Tutor.hubOpen; }, get offerOpen() { return Tutor.offerOpen; },
               get lessons() { return Tutor.list.map(l => ({ id: l.id, title: l.title, steps: l.steps.length, done: Tutor.done(l.id) })); },
               get sandbox() { return TUT.sandbox; }, get done() { return tutField(); }, get offered() { return !!TUT.offer; }
           };
       }
