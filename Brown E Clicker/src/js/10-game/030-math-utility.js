       // --- MATH / UTILITY ---
       // Every win adds +100% to ALL production (1 win = 2x, 2 wins = 3x, 3 wins = 4x...)
       function winBoost(wins) { return 1 + wins; }

       function getMultiplierCost(level) {
           // Lowered growth from 3.0 to 1.8 so upgrades don't instantly cost 1Q!
           return Math.floor(10000 * Math.pow(1.8, level));
       }

       // Price of the next `n` copies of a building (each copy costs costMultiplier more than the last)
       function bulkCost(item, n) {
           let c = item.cost, total = 0;
           const g = buildingGrowth(item);
           for (let i = 0; i < n; i++) {
               total += c;
               c = Math.ceil(c * g);
           }
           return total;
       }

       function totalBuildings() {
           let n = 0;
           for (let i = 0; i < shopItems.length; i++) n += shopItems[i].owned;
           return n;
       }

       function upgradesOwned(kind) {
           let n = 0;
           for (const id in state.upgrades) {
               const u = UPGRADE_BY_ID[id];
               if (u && (!kind || u.kind === kind)) n++;
           }
           return n;
       }

       function achievementCount() {
           let n = 0;
           for (const id in state.achievements) if (ACH_BY_ID[id]) n++;
           return n;
       }

       // How much production each achievement gives (1% base, more with Trophy upgrades)
       function achievementEach() {
           let boost = 1 + PRES.achX;
           for (let i = 0; i < UPGRADES.length; i++) {
               const u = UPGRADES[i];
               if (u.kind === 'ach' && state.upgrades[u.id]) boost += u.pct;
           }
           return (0.01 + PRES.achEach) * boost;
       }
       function achievementMultiplier() {
           if (challengeIs('amnesia')) return 1;
           return 1 + achievementCount() * achievementEach();
       }

       // Golden E timing (seconds)
       function goldenSettings() {
           let freq = PRES.goldFreq * (GFX.goldFreq || 1), life = PRES.goldLife, dur = PRES.goldDur * (GFX.goldDur || 1);
           if (state.upgrades.gold1) life *= 1.5;
           if (state.upgrades.gold2) freq *= 1.2;
           if (state.upgrades.gold3) freq *= 1.2;
           if (state.upgrades.gold4) dur *= 2;
           return { minGap: 75 / freq, maxGap: 165 / freq, life: 13 * life, dur };
       }

       // Offline earnings: a share of E's per second while the game is closed, capped in hours
       function offlineSettings() {
           let eff = 0.25 + PRES.offEff + (GFX.offEff || 0), capHours = 8 + PRES.offCap;
           if (state.upgrades.off1) eff += 0.15;
           if (state.upgrades.off2) eff += 0.20;
           if (state.upgrades.off3) capHours = 24;
           return { eff, capHours };
       }

       // Golden E buff types (click ones boost click power, the rest boost E/s)
       const BUFF_TYPES = ['frenzy', 'click', 'rush', 'elder', 'trick', 'love', 'lovec', 'heat', 'party', 'pie'];
       const CLICK_BUFFS = { click: true, lovec: true };

       // Multipliers used by the stats page (filled in by recalculateStats)
       const MULTS = { win: 1, ach: 1, global: 1, bpsLevel: 1, clickLevel: 1, clickUpg: 1, touch: 0, buffProd: 1, buffClick: 1, chips: 1, treeProd: 1, treeClick: 1, garden: 1, gardenClick: 1, challenge: 1, eggs: 1 };

       // Recalculate totals based on owned items, upgrades, achievements and buffs
       function recalculateStats() {
           const achMult = achievementMultiplier();
           const winMultiplier = winBoost(state.wins);
           let globalMult = 1, clickUpg = 1, touch = 0;

           for (let i = 0; i < shopItems.length; i++) shopItems[i].mult = 1;
           for (let i = 0; i < UPGRADES.length; i++) {
               const u = UPGRADES[i];
               if (!state.upgrades[u.id]) continue;
               if (u.kind === 'tier') BUILDING[u.b].mult *= PRES.tierX;
               else if (u.kind === 'syn') BUILDING[u.t].mult *= 1 + u.pct * PRES.synX * (u.s === 'all' ? totalBuildings() : BUILDING[u.s].owned);
               else if (u.kind === 'global') globalMult *= 1 + u.pct;
               else if (u.kind === 'click') clickUpg *= 2;
               else if (u.kind === 'touch') touch += u.pct;
           }
           touch += PRES.touch;

           // Golden E buffs
           let buffProd = 1, buffClick = 1;
           for (let i = 0; i < state.buffs.length; i++) {
               const b = state.buffs[i];
               if (CLICK_BUFFS[b.type]) buffClick *= b.mult;
               else buffProd *= b.mult;
           }

           let baseClick = 1;
           let baseBps = 0;
           for (let i = 0; i < shopItems.length; i++) {
               const item = shopItems[i];
               if (item.type === 'click') baseClick += item.amount * item.mult * item.owned;
               if (item.type === 'bps') baseBps += item.amount * item.mult * item.owned;
           }

           const clickMulti = 1 + (state.clickMultiLevel * 0.10);
           const bpsMulti = 1 + (state.bpsMultiLevel * 0.10);
           // 2.0: Heavenly Chips, the Prestige Tree / challenge rewards, the garden, Egg Hunt eggs, and challenge handicaps
           const chipMult = chipMultiplier();
           const gardenProd = GFX.prod || 1, gardenClick = GFX.click || 1;
           const eggMult = 1 + Math.min(10, state.run.eggs) * 0.02;
           const handicap = challengeIs('slowmo') ? 0.1 : 1;
           const prodMult = bpsMulti * winMultiplier * achMult * globalMult * chipMult * PRES.prodX * gardenProd * eggMult * handicap;
           const clickMult = clickMulti * clickUpg * winMultiplier * achMult * chipMult * PRES.clickX * gardenClick * handicap;

           state.bpsBase = baseBps * prodMult;
           state.bps = state.bpsBase * buffProd;
           state.clickPower = Math.floor((baseClick * clickMult + state.bps * touch) * buffClick);
           if (!isFinite(state.bpsBase)) state.bpsBase = Number.MAX_VALUE;
           if (!isFinite(state.bps)) state.bps = Number.MAX_VALUE;
           if (!isFinite(state.clickPower)) state.clickPower = Number.MAX_VALUE;

           // Per-copy output shown in the shop
           for (let i = 0; i < shopItems.length; i++) {
               const item = shopItems[i];
               if (item.type === 'bps') item.eff = item.amount * item.mult * prodMult * buffProd;
               else if (item.type === 'click') item.eff = item.amount * item.mult * clickMult * buffClick;
           }

           MULTS.win = winMultiplier; MULTS.ach = achMult; MULTS.global = globalMult;
           MULTS.bpsLevel = bpsMulti; MULTS.clickLevel = clickMulti; MULTS.clickUpg = clickUpg;
           MULTS.touch = touch; MULTS.buffProd = buffProd; MULTS.buffClick = buffClick;
           MULTS.chips = chipMult; MULTS.treeProd = PRES.prodX; MULTS.treeClick = PRES.clickX; MULTS.garden = gardenProd; MULTS.gardenClick = gardenClick;
           MULTS.challenge = handicap; MULTS.eggs = eggMult;
       }

       // Lucky Golden E: 15% of your bank or 15 minutes of production, whichever is smaller
       function luckyAmount() {
           const big = PRES.luckBig;
           return Math.min(state.brownEs * (big ? 0.25 : 0.15), state.bps * (big ? 1800 : 900)) * (GFX.lucky || 1) + 13;
       }

       // === PURE GAME LOGIC END ===


       // --- DOM ELEMENTS ---
       const scoreEl = document.getElementById('score');
       const bpsEl = document.getElementById('bps');
       const bpsBuffEl = document.getElementById('bps-buff');
       const clickPowerEl = document.getElementById('click-power');
       const bigEContainer = document.getElementById('big-e-container');
       const clickArea = document.getElementById('click-area');
       const shopContainer = document.getElementById('shop-container');
       const saveStatusEl = document.getElementById('save-status');
       const gameScreen = document.getElementById('game-screen');


       // Multiplier DOM Elements
       const upgradeClickBtn = document.getElementById('upgrade-click-btn');
       const upgradeBpsBtn = document.getElementById('upgrade-bps-btn');
       const clickMultiDisplay = document.getElementById('click-multi-display');
       const bpsMultiDisplay = document.getElementById('bps-multi-display');
       const upgradeClickCost = document.getElementById('upgrade-click-cost');
       const upgradeBpsCost = document.getElementById('upgrade-bps-cost');


       // Win DOM Elements
       const mainMenuWins = document.getElementById('main-menu-wins');
       const mainMenuWinsCount = document.getElementById('main-menu-wins-count');
       const inGameWins = document.getElementById('in-game-wins');
       const inGameWinsCount = document.getElementById('in-game-wins-count');
       const winModal = document.getElementById('win-modal');


       // Upgrades / achievements / golden E DOM Elements
       const upgradeGrid = document.getElementById('upgrade-grid');
       const upgradeEmpty = document.getElementById('upgrade-empty');
       const upgAvailEl = document.getElementById('upg-avail');
       const buyAllUpgBtn = document.getElementById('buy-all-upg');
       const achBtnCount = document.getElementById('ach-count');
       const achModal = document.getElementById('ach-modal');
       const achGrid = document.getElementById('ach-grid');
       const statsModal = document.getElementById('stats-modal');
       const statsBody = document.getElementById('stats-body');
       const welcomeModal = document.getElementById('welcome-modal');
       const goldenEl = document.getElementById('golden-e');
       const goldenMsgEl = document.getElementById('golden-msg');
       const buffBar = document.getElementById('buff-bar');
       const toastBox = document.getElementById('toast-box');
       const tooltipEl = document.getElementById('tooltip');


       // Only touch the DOM when something actually changed
       function setText(el, text) {
           if (el._text !== text) {
               el._text = text;
               el.textContent = text;
           }
       }
       function setDisabled(el, disabled) {
           if (el._disabled !== disabled) {
               el._disabled = disabled;
               el.disabled = disabled;
           }
       }


       // --- EARNING / SPENDING ---
       function earn(amount, source) {
           if (!(amount > 0)) return;
           state.brownEs += amount;
           state.run.earned += amount;
           state.life.earned += amount;
           if (source === 'click') {
               state.run.handmade += amount;
               state.life.handmade += amount;
           }
           if (!isFinite(state.brownEs)) state.brownEs = Number.MAX_VALUE;
           if (!isFinite(state.run.earned)) state.run.earned = Number.MAX_VALUE;
           if (!isFinite(state.life.earned)) state.life.earned = Number.MAX_VALUE;
       }

       function spend(cost) {
           state.brownEs -= cost;
           if (state.brownEs < 0) state.brownEs = 0;
       }


       // Start a fresh run in place (works even where the browser blocks saving)
       // keepWins = ascend after winning (keeps wins, achievements, lifetime stats); false = full wipe
       function resetRun(keepWins) {
           const old = state;
           // Heirlooms: golden E + offline upgrades survive ascending
           const kept = {};
           if (keepWins && PRES.keepUpg) {
               for (const id in old.upgrades) {
                   const u = UPGRADE_BY_ID[id];
                   if (u && (u.kind === 'golden' || u.kind === 'offline')) kept[id] = true;
               }
           }
           state = {
               brownEs: 0, clickPower: 1, bps: 0, bpsBase: 0, clickMultiLevel: 0, bpsMultiLevel: 0,
               wins: keepWins ? old.wins : 0,
               pendingWin: false,
               upgrades: kept,
               achievements: keepWins ? old.achievements : {},
               buffs: [],
               run: freshRun(),
               life: keepWins ? old.life : freshLife(),
               meta: keepWins ? old.meta : freshMeta()
           };
           state.meta.challenge = null;
           if (typeof resetMinigames === 'function') resetMinigames(keepWins);
           shopItems.forEach(item => { item.owned = 0; });
           recalcPrestige();
           if (typeof recalcGarden === 'function') recalcGarden();
           repriceBuildings();
           hideGolden();
           golden.timer = firstGoldenDelay();
           renderBuffBar();
           saveGame();
           recalculateStats();
           initShop();
           refreshUpgrades(true);
           refreshAchievementUI();
           refreshChallengeUI();
           refreshToolbar();
           if (typeof applySkin === 'function') applySkin();
           updateDisplay();
       }


       // --- CORE LOGIC ---
       // Update the main UI numbers
       let lastWinsShown = -1;
       function updateDisplay() {
           setText(scoreEl, formatNumber(state.brownEs));
           setText(bpsEl, formatRate(state.bps));
           setText(bpsBuffEl, MULTS.buffProd > 1 ? `(x${formatShort(MULTS.buffProd)})` : '');
           setText(clickPowerEl, formatNumber(state.clickPower));

           // Update Multiplier UI
           setText(clickMultiDisplay, `x${(1 + state.clickMultiLevel * 0.1).toFixed(1)}`);
           setText(bpsMultiDisplay, `x${(1 + state.bpsMultiLevel * 0.1).toFixed(1)}`);

           const nextClickCost = getMultiplierCost(state.clickMultiLevel);
           const nextBpsCost = getMultiplierCost(state.bpsMultiLevel);

           setText(upgradeClickCost, formatShort(nextClickCost));
           setText(upgradeBpsCost, formatShort(nextBpsCost));


           const strike = challengeIs('noupgrades');
           setDisabled(upgradeClickBtn, strike || state.brownEs < nextClickCost);
           setDisabled(upgradeBpsBtn, strike || state.brownEs < nextBpsCost);


           // Update Wins UI
           if (lastWinsShown !== state.wins) {
               lastWinsShown = state.wins;
               if (state.wins > 0) {
                   const winMultiValue = formatNumber(winBoost(state.wins));
                   mainMenuWins.classList.remove('hidden');
                   mainMenuWinsCount.textContent = state.wins;
                   document.getElementById('main-menu-win-buff').textContent = `(x${winMultiValue} Production Boost)`;

                   inGameWins.classList.remove('hidden');
                   inGameWinsCount.textContent = state.wins;
                   document.getElementById('in-game-win-buff').textContent = `x${winMultiValue} Boost`;
               } else {
                   mainMenuWins.classList.add('hidden');
                   inGameWins.classList.add('hidden');
               }
           }

           // Check shop buttons affordabilty
           updateShopUI();
           updateUpgradeAffordability();
       }


       // Handle clicking the Big E
       const recentClicks = new Array(16).fill(0);
       let recentClickIdx = 0;
       let noClickMsgAt = 0;
       function clickBigE(event) {
           if (state.meta.heaven) return;
           if (challengeIs('noclick')) {
               const t = performance.now();
               if (t - noClickMsgAt > 600 && !settings.reduced) { noClickMsgAt = t; createFloatingText(event, '🙅 Hands off!'); }
               return;
           }
           // Add currency (Lucky Strike: a few clicks are critical hits)
           const crit = PRES.crit > 0 && Math.random() < PRES.crit;
           earn(crit ? state.clickPower * 25 : state.clickPower, 'click');
           state.run.clicks++;
           state.life.clicks++;
           if (crit) state.life.crits++;

           // Speed Demon: 15 clicks inside one second
           const now = performance.now();
           recentClicks[recentClickIdx] = now;
           recentClickIdx = (recentClickIdx + 1) % recentClicks.length;
           const fifteenAgo = recentClicks[(recentClickIdx + recentClicks.length - 15) % recentClicks.length];
           if (fifteenAgo > 0 && now - fifteenAgo <= 1000) unlockAchievement('mspeed');

           // Visual feedback (Floating Text)
           if (!settings.reduced) createFloatingText(event, crit ? `CRIT! +${formatShort(state.clickPower * 25)}` : undefined);

           // Update UI immediately
           updateDisplay();
       }


       // Create the floating number animation (a small pool of reused elements, so spam-clicking stays cheap)
       const FLOAT_POOL = [];
       const FLOAT_MAX = 24;
       let floatIdx = 0;
       function createFloatingText(event, text) {
           let floatEl = FLOAT_POOL[floatIdx];
           if (!floatEl) {
               floatEl = document.createElement('div');
               floatEl.className = 'floating-text';
               document.body.appendChild(floatEl);
               FLOAT_POOL[floatIdx] = floatEl;
           }
           floatIdx = (floatIdx + 1) % FLOAT_MAX;
           floatEl.textContent = text || `+${formatShort(state.clickPower)}`;
           floatEl.classList.toggle('frenzy', MULTS.buffClick > 1);

           // If it's a simulated click (no event passed) just spawn it in the middle
           let x, y;
           if (event && event.clientX) {
               // Add some randomness to the click position so they don't perfectly overlap
               const randomXOffset = (Math.random() - 0.5) * 40;
               x = event.clientX + randomXOffset;
               y = event.clientY;
           } else {
               const rect = bigEContainer.getBoundingClientRect();
               x = rect.left + rect.width / 2;
               y = rect.top + rect.height / 2;
           }


           floatEl.style.left = `${x}px`;
           floatEl.style.top = `${y}px`;
           // Switching between two identical keyframes restarts the animation without a reflow
           floatEl.style.animationName = floatEl.style.animationName === 'floatUp' ? 'floatUp2' : 'floatUp';
       }


