       // --- OFFLINE EARNINGS ---
       let pendingWelcome = null;
       function grantOffline(seconds) {
           if (!(seconds > 0)) return;
           // Golden E buffs don't last while you're away
           state.buffs.forEach(b => { b.time -= seconds; });
           state.buffs = state.buffs.filter(b => b.time > 0);
           recalculateStats();
           renderBuffBar();
           if (seconds > state.life.longestAway) state.life.longestAway = seconds;
           gardenTick(seconds, true);
           if (market.unlocked) marketTick(Math.min(seconds, 30 * MARKET_TICK));
           const off = offlineSettings();
           const counted = Math.min(seconds, off.capHours * 3600);
           const amount = state.bpsBase * counted * off.eff;
           if (seconds >= 4 * 3600) unlockAchievement('mnap');
           if (amount > 0) {
               earn(amount, 'offline');
               state.life.offlineEarned += amount;
               unlockAchievement('mback');
               pendingWelcome = { seconds, counted, amount, off };
               showWelcomeIfReady();
           }
       }

       function showWelcomeIfReady() {
           if (!pendingWelcome || gameScreen.classList.contains('hidden')) return;
           const w = pendingWelcome;
           pendingWelcome = null;
           setText(document.getElementById('welcome-away'), formatTime(w.seconds));
           setText(document.getElementById('welcome-amount'), formatNumber(w.amount));
           setText(document.getElementById('welcome-detail'), `Your buildings kept working at ${Math.round(w.off.eff * 100)}% speed${w.seconds > w.counted ? ` for the first ${w.off.capHours} hours` : ''}.`);
           const tip = !state.upgrades.off1 ? 'Tip: the Night Shift upgrade makes buildings work harder while you\'re away.'
               : !state.upgrades.off3 ? 'Tip: Dream Factory lets away earnings count for up to 24 hours.' : '';
           setText(document.getElementById('welcome-tip'), tip);
           welcomeModal.classList.remove('hidden');
           updateDisplay();
       }
       document.getElementById('welcome-ok').addEventListener('click', () => welcomeModal.classList.add('hidden'));


       // --- LOCAL STORAGE SAVING ---
       const SAVE_KEY = 'brownEClickerSave';
       function saveGame(quiet) {
           try {
               localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
               if (!quiet) showSaveStatus();
           } catch (e) {
               console.error("Error saving game:", e);
           }
       }
       function buildSaveData() {
           const m = state.meta;
           return {
               v: 3,
               t: Date.now(),
               state: {
                   brownEs: state.brownEs,
                   clickMultiLevel: state.clickMultiLevel,
                   bpsMultiLevel: state.bpsMultiLevel,
                   wins: state.wins,
                   pendingWin: state.pendingWin
               },
               shopItems: shopItems.map(item => ({ id: item.id, owned: item.owned, cost: item.cost })),
               upgrades: Object.keys(state.upgrades),
               achievements: state.achievements,
               buffs: state.buffs.map(b => ({ type: b.type, icon: b.icon, name: b.name, mult: b.mult, time: b.time, max: b.max, building: b.building })),
               run: state.run,
               life: state.life,
               buyAmount: buyAmount,
               meta: {
                   chips: m.chips, chipsTotal: m.chipsTotal, ascensions: m.ascensions, bestRunChips: m.bestRunChips,
                   tree: Object.keys(m.tree), challenge: m.challenge, challengesDone: m.challengesDone, heaven: m.heaven,
                   skin: m.skin, bg: m.bg, seasons: m.seasons
               },
               garden: typeof saveGarden === 'function' ? saveGarden() : undefined,
               market: typeof saveMarket === 'function' ? saveMarket() : undefined
           };
       }

       // Copy only valid, finite numbers out of a saved object
       function cleanNum(v, fallback) {
           return (typeof v === 'number' && isFinite(v) && v >= 0) ? v : (fallback || 0);
       }
       function mergeNumbers(target, saved) {
           if (!saved || typeof saved !== 'object') return;
           for (const k in target) {
               if (typeof target[k] === 'number' && k in saved) target[k] = cleanNum(saved[k], target[k]);
           }
       }


       function loadGame(fromString) {
           let awaySeconds = 0;
           try {
               let savedString = fromString;
               if (savedString === undefined) savedString = localStorage.getItem(SAVE_KEY);
               if (savedString) {
                   const data = JSON.parse(savedString);
                   const isOldSave = !data.v; // saved before buildings were stored by id
                   // Merge state, ensuring new variables are captured if undefined in old save
                   if (data.state) {
                       state.brownEs = cleanNum(data.state.brownEs);
                       state.clickMultiLevel = Math.floor(cleanNum(data.state.clickMultiLevel));
                       state.bpsMultiLevel = Math.floor(cleanNum(data.state.bpsMultiLevel));
                       state.wins = Math.floor(cleanNum(data.state.wins));
                       state.pendingWin = !!data.state.pendingWin;
                       // Ignore saved clickPower and bps, we recalculate them
                   }
                   loadMeta(data);
                   if (Array.isArray(data.shopItems)) {
                       data.shopItems.forEach((savedItem, index) => {
                           if (!savedItem) return;
                           const id = savedItem.id || (isOldSave ? OLD_SHOP_ORDER[index] : null);
                           const item = BUILDING[id];
                           if (item && item.type !== 'win') item.owned = Math.floor(cleanNum(savedItem.owned));
                       });
                   }
                   if (typeof loadGarden === 'function') loadGarden(data.garden);
                   if (typeof loadMarket === 'function') loadMarket(data.market);
                   if (Array.isArray(data.upgrades)) data.upgrades.forEach(id => { if (UPGRADE_BY_ID[id]) state.upgrades[id] = true; });
                   if (data.achievements && typeof data.achievements === 'object') {
                       for (const id in data.achievements) if (ACH_BY_ID[id]) state.achievements[id] = cleanNum(data.achievements[id], Date.now()) || Date.now();
                   }
                   mergeNumbers(state.run, data.run);
                   mergeNumbers(state.life, data.life);
                   if (isOldSave) {
                       // Old saves never tracked lifetime earnings: estimate them from what was bought
                       let spent = 0;
                       shopItems.forEach((item, i) => {
                           let c = BASE_COSTS[i];
                           for (let k = 0; k < item.owned; k++) { spent += c; c = Math.ceil(c * item.costMultiplier); }
                       });
                       for (let l = 0; l < state.clickMultiLevel; l++) spent += getMultiplierCost(l);
                       for (let l = 0; l < state.bpsMultiLevel; l++) spent += getMultiplierCost(l);
                       state.run.earned = state.brownEs + spent;
                       state.life.earned = state.run.earned;
                   }
                   if (Array.isArray(data.buffs)) {
                       data.buffs.forEach(b => {
                           if (b && BUFF_TYPES.includes(b.type) && cleanNum(b.time) > 0 && cleanNum(b.mult) > 0) {
                               state.buffs.push({ type: b.type, icon: String(b.icon || '✨'), name: String(b.name || 'Buff'), mult: b.mult, time: b.time, max: cleanNum(b.max, b.time) || b.time, building: b.building || null });
                           }
                       });
                   }
                   if (data.buyAmount) buyAmount = Number(data.buyAmount) || 1;
                   if (typeof data.t === 'number' && isFinite(data.t)) awaySeconds = (Date.now() - data.t) / 1000;
               }
           } catch (e) {
               console.error("Error loading game:", e);
           }

           // Prices always follow from how many you own (and the tree / challenge discounts)
           recalcPrestige();
           if (typeof recalcGarden === 'function') recalcGarden();
           repriceBuildings();
           // Recalculate stats based on loaded items and levels
           recalculateStats();
           initShop();
           setBuyAmount(buyAmount);
           renderBuffBar();
           refreshUpgrades(true);
           checkAchievements();
           refreshAchievementUI();
           refreshChallengeUI();
           refreshToolbar();
           if (typeof applySkin === 'function') applySkin();
           if (awaySeconds > 60 && !state.meta.heaven) grantOffline(awaySeconds);
           updateDisplay();
           if (state.pendingWin) showWinModal();
       }

       // 2.0 save data: Heavenly Chips, the Prestige Tree, challenges, skins
       function loadMeta(data) {
           const m = state.meta;
           const d = data.meta;
           if (d && typeof d === 'object') {
               m.chips = Math.floor(cleanNum(d.chips));
               m.chipsTotal = Math.max(m.chips, Math.floor(cleanNum(d.chipsTotal)));
               m.ascensions = Math.floor(cleanNum(d.ascensions));
               m.bestRunChips = Math.floor(cleanNum(d.bestRunChips));
               if (Array.isArray(d.tree)) d.tree.forEach(id => { if (TREE_BY_ID[id]) m.tree[id] = true; });
               if (typeof d.challenge === 'string' && CHALLENGE_BY_ID[d.challenge]) m.challenge = d.challenge;
               if (d.challengesDone && typeof d.challengesDone === 'object') {
                   for (const id in d.challengesDone) if (CHALLENGE_BY_ID[id]) m.challengesDone[id] = cleanNum(d.challengesDone[id]) || Date.now();
               }
               m.heaven = !!d.heaven;
               if (typeof d.skin === 'string') m.skin = d.skin;
               if (typeof d.bg === 'string') m.bg = d.bg;
               if (d.seasons && typeof d.seasons === 'object') for (const id in d.seasons) m.seasons[id] = true;
           }
           // Players from before 2.0 get a thank-you for their wins: 10 Heavenly Chips per win (up to 250)
           if ((data.v || 0) < 3 && data.state && cleanNum(data.state.wins) > 0) {
               const gift = Math.min(250, Math.floor(cleanNum(data.state.wins)) * 10);
               m.chips += gift;
               m.chipsTotal += gift;
               veteranGift = gift;
           }
       }
       let veteranGift = 0;


       let saveStatusTimer = 0;
       function showSaveStatus() {
           saveStatusEl.style.opacity = '1';
           clearTimeout(saveStatusTimer);
           saveStatusTimer = setTimeout(() => {
               saveStatusEl.style.opacity = '0';
           }, 2000);
       }


       // Auto-save every 10 seconds, and when the tab is hidden or closed (so away time is accurate)
       setInterval(saveGame, 10000);
       document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(true); });
       window.addEventListener('pagehide', () => saveGame(true));


       // Load settings, then the game, on startup
       loadSettings();
       loadGame();
       refreshEvent();


       // Hard Reset Logic
       const resetModal = document.getElementById('reset-modal');
       document.getElementById('reset-btn').addEventListener('click', () => {
           resetModal.classList.remove('hidden');
       });

       document.getElementById('cancel-reset-btn').addEventListener('click', () => {
           resetModal.classList.add('hidden');
       });


       document.getElementById('confirm-reset-btn').addEventListener('click', () => {
           resetModal.classList.add('hidden');
           // Full wipe including wins
           resetRun(false);
       });




       // --- GAME LOOP ---
       // Runs 10 times a second, using real elapsed time so background tabs keep up
       const tickRate = 10;
       const OFFLINE_GAP = 120; // a gap longer than this (laptop asleep) counts as being away
       let lastTick = Date.now();
       let secondTimer = 0;

       function gameTick(dt) {
           // Between runs (in heaven) nothing happens until you begin the next run
           if (state.meta.heaven) { updateDisplay(); return; }
           if (state.bps > 0) {
               // Add a fraction of the BPS every tick
               earn(state.bps * dt, 'prod');
           }
           // Angel Fingers: automatic clicks on the big E
           if (PRES.autoClick > 0 && !challengeIs('noclick')) {
               earn(state.clickPower * PRES.autoClick * dt, 'click');
               state.life.autoClicked += PRES.autoClick * dt;
           }
           state.run.time += dt;
           state.life.played += dt;
           buffTick(dt);
           goldenTick(dt);
           marketTick(dt);
           secondTimer += dt;
           if (secondTimer >= 1) {
               secondTimer = 0;
               everySecond();
           }
           updateDisplay();
       }

       let eventCheck = 0;
       function everySecond() {
           if (state.meta.heaven) { tickerSecond(); return; }
           if (state.bps > state.life.bestBps) state.life.bestBps = state.bps;
           if (state.bpsBase > state.run.bestBase) state.run.bestBase = state.bpsBase;
           if (PRES.autoClick > 0 && !challengeIs('noclick') && !settings.reduced && !gameScreen.classList.contains('hidden')) createFloatingText(null, `👼 +${formatShort(state.clickPower * PRES.autoClick)}`);
           checkChallenge();
           refreshAscendBadge();
           checkMinigameUnlocks();
           if (++eventCheck >= 60) { eventCheck = 0; refreshEvent(); }
           gardenTick(1);
           if (!gardenModal.classList.contains('hidden')) renderGarden();
           else if (!marketModal.classList.contains('hidden')) renderMarket(false);
           if (state.clickPower > state.life.bestClick) state.life.bestClick = state.clickPower;
           checkAchievements();
           refreshReveals();
           refreshUpgrades();
           if (!statsModal.classList.contains('hidden')) renderStats();
           tickerSecond();
       }

       setInterval(() => {
           const now = Date.now();
           const dt = (now - lastTick) / 1000;
           lastTick = now;
           if (!(dt > 0)) return;
           if (dt > OFFLINE_GAP) {
               grantOffline(dt);
               updateDisplay();
               return;
           }
           gameTick(dt);
       }, 1000 / tickRate);




       // --- EVENT LISTENERS ---
       // Mouse/Touch events for the Big E
       bigEContainer.addEventListener('mousedown', (e) => {
           e.preventDefault();
           clickBigE(e);
       });


       bigEContainer.addEventListener('touchstart', (e) => {
           e.preventDefault();
           const touch = e.touches[0];
           clickBigE(touch);
       });


       // Initialize the game
       updateDisplay();


       // --- MAIN MENU START LOGIC ---
       document.getElementById('start-btn').addEventListener('click', () => {
           document.getElementById('main-menu').classList.add('hidden');
           document.getElementById('game-screen').classList.remove('hidden');
           showWelcomeIfReady();
           nextHeadline();
           if (state.meta.heaven) openTree();
           if (veteranGift > 0) {
               showGoldenMessage('WELCOME TO 2.0!', `+${veteranGift} Heavenly Chips for your ${state.wins} win${state.wins === 1 ? '' : 's'}. Spend them in the Prestige Tree 👼`);
               veteranGift = 0;
           }
       });


       // --- DEBUG / TEST HOOK ---
       window.__clicker = {
           get state() { return state; },
           shopItems, UPGRADES, ACHIEVEMENTS, BUILDING, MULTS,
           formatNumber, formatShort,
           give(n) { earn(n, 'debug'); updateDisplay(); },
           tick(seconds, step) {
               step = step || 1;
               for (let t = 0; t < seconds; t += step) gameTick(Math.min(step, seconds - t));
           },
           spawnGolden() { golden.timer = 0; return spawnGolden(); },
           clickGolden(type) { if (golden.life <= 0) spawnGolden(); clickGolden(null, type); },
           golden,
           away(seconds) { grantOffline(seconds); },
           buy: buyItem, buyUpgrade, buyAllUpgrades, setBuyAmount,
           recalc() { recalculateStats(); refreshRowStats(); updateDisplay(); },
           check() { checkAchievements(); refreshReveals(); refreshUpgrades(); },
           save: saveGame,
           available: () => availableUpgrades.map(u => u.id),
           TREE, CHALLENGES, PRES, GFX,
           pendingChips, canAscend, ascend, beginRun, buyTreeNode, openTree, endChallenge, checkChallenge,
           giveChips(n) { state.meta.chips += n; state.meta.chipsTotal += n; afterPrestigeChange(); refreshTreeUI(); },
           get garden() { return garden; }, get market() { return market; }, SEEDS, GOODS, EVENTS, SKINS,
           gardenTick, marketTick, plantSeed, harvestPlot, buyGood, sellGood, afterGardenChange, recalcGarden, checkMinigameUnlocks,
           setEvent(id) { forcedEvent = id; currentEvent = undefined; refreshEvent(); }, get currentEvent() { return currentEvent; },
           applySkin, settings
       };


   