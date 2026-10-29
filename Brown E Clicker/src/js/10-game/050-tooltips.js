       // --- TOOLTIPS ---
       let tooltipAnchor = null;
       function placeTooltip(anchor) {
           const a = anchor.getBoundingClientRect();
           tooltipEl.classList.remove('hidden');
           const tw = tooltipEl.offsetWidth, th = tooltipEl.offsetHeight;
           let x = a.left - tw - 10;
           if (x < 8) x = Math.min(a.right + 10, window.innerWidth - tw - 8);
           let y = Math.max(8, Math.min(a.top, window.innerHeight - th - 8));
           tooltipEl.style.left = `${x}px`;
           tooltipEl.style.top = `${y}px`;
       }
       function hideTooltip() {
           tooltipAnchor = null;
           tooltipEl.classList.add('hidden');
       }

       function showUpgradeTooltip(tile) {
           const u = UPGRADE_BY_ID[tile.dataset.upg];
           if (!u) return;
           const kindLabel = { tier: 'Building upgrade', syn: 'Synergy upgrade', click: 'Click upgrade', touch: 'Click upgrade', global: 'Production upgrade', golden: 'Golden E upgrade', ach: 'Achievement upgrade', offline: 'Offline upgrade' }[u.kind];
           const afford = state.brownEs >= upgCost(u);
           tooltipEl.innerHTML = `
               <div class="flex items-start gap-2">
                   <div class="text-3xl leading-none">${u.icon}</div>
                   <div class="min-w-0">
                       <div class="font-black text-white leading-tight">${u.name}</div>
                       <div class="text-[0.7rem] uppercase tracking-wider text-stone-500 font-bold">${kindLabel}</div>
                   </div>
               </div>
               <div class="text-sm text-green-400 font-bold mt-2">${u.desc}</div>
               <div class="text-xs italic text-stone-400 mt-1">"${u.flavor}"</div>
               <div class="mt-2 text-sm font-bold">Cost: <span class="${afford ? 'text-[#8B4513] bg-white' : 'text-red-300 bg-red-900/50'} px-1.5 rounded">${formatNumber(upgCost(u))}</span> <span class="text-xs text-stone-500 font-normal">${numberWord(upgCost(u))}</span></div>`;
           tooltipAnchor = tile;
           placeTooltip(tile);
       }

       function showBuildingTooltip(index) {
           const item = shopItems[index];
           const r = rowEls[index];
           if (!r) return;
           let html;
           if (r.mode === 'mystery') {
               html = `<div class="font-black text-white">???</div><div class="text-sm text-stone-400 mt-1">A mysterious building. Earn ${formatShort(BASE_COSTS[index] * 0.5)} Brown E's this run to reveal it.</div>`;
           } else if (item.type === 'win') {
               html = `<div class="font-black text-yellow-400 text-lg">🏆 The Final E</div><div class="text-sm text-stone-300 mt-1">Buy it to win! Winning starts a new run with <b class="text-green-400">+100% production</b> per win. Achievements and lifetime stats are kept.</div><div class="mt-2 text-sm font-bold">Cost: <span class="text-yellow-900 bg-yellow-400 px-1.5 rounded">${formatNumber(item.cost)}</span> <span class="text-xs text-stone-500 font-normal">${numberWord(item.cost)}</span></div>`;
           } else {
               const isClick = item.type === 'click';
               const unit = isClick ? 'click power' : 'E/sec';
               const total = item.eff * item.owned;
               const share = !isClick && state.bps > 0 ? ` (${(total / state.bps * 100).toFixed(1)}% of your E/sec)` : '';
               const tiers = UPGRADES.filter(u => u.kind === 'tier' && u.b === item.id && state.upgrades[u.id]).length;
               const syns = UPGRADES.filter(u => u.kind === 'syn' && u.t === item.id && state.upgrades[u.id]);
               let bonus = `<div class="text-xs text-stone-400 mt-2">Upgrades: <b class="text-white">${tiers}/5</b> tiers`;
               if (syns.length) bonus += ` &middot; synergy <b class="text-purple-300">x${(syns.reduce((m, u) => m * (1 + u.pct * (u.s === 'all' ? totalBuildings() : BUILDING[u.s].owned)), 1)).toFixed(2)}</b>`;
               bonus += ` &middot; building bonus <b class="text-white">x${formatShort(item.mult)}</b></div>`;
               html = `
                   <div class="flex items-center gap-2"><div class="text-3xl leading-none">${item.icon}</div><div class="font-black text-white leading-tight">${item.name}</div></div>
                   <div class="text-xs italic text-stone-400 mt-1">"${item.desc}"</div>
                   <div class="text-sm mt-2">Each one: <b class="text-green-400">+${formatNumber(item.eff)} ${unit}</b></div>
                   <div class="text-sm">Next costs: <b class="text-white">${formatNumber(r.price)}</b> <span class="text-xs text-stone-500">${numberWord(r.price)}${r.n > 1 ? ` (for ${r.n})` : ''}</span></div>
                   <div class="text-sm">Owned: <b class="text-white">${item.owned}</b>${item.owned ? ` making <b class="text-green-400">${formatNumber(total)} ${unit}</b>${share}` : ''}</div>
                   ${bonus}
                   ${r.blocked ? `<div class="text-xs text-red-300 font-bold mt-2">⚔️ ${activeChallenge() ? activeChallenge().name : 'Challenge'}: ${buildingBlocked(item) === 'Max 10' ? 'you can own at most 10.' : 'blocked this run.'}</div>` : ''}`;
           }
           tooltipEl.innerHTML = html;
           tooltipAnchor = r.row;
           placeTooltip(r.row);
       }

       upgradeGrid.addEventListener('mouseover', (e) => {
           const tile = e.target.closest('[data-upg]');
           if (tile && tile !== tooltipAnchor) showUpgradeTooltip(tile);
       });
       upgradeGrid.addEventListener('mouseleave', hideTooltip);
       shopContainer.addEventListener('mouseover', (e) => {
           const row = e.target.closest('[data-row]');
           if (row && row !== tooltipAnchor && !row.classList.contains('hidden')) showBuildingTooltip(Number(row.dataset.row));
       });
       shopContainer.addEventListener('mouseleave', hideTooltip);
       shopContainer.addEventListener('scroll', hideTooltip, { passive: true });
       upgradeGrid.addEventListener('scroll', hideTooltip, { passive: true });
       document.getElementById('shop-panel').addEventListener('scroll', hideTooltip, { passive: true });


       // Buy General Multipliers
       upgradeClickBtn.addEventListener('click', () => {
           const cost = getMultiplierCost(state.clickMultiLevel);
           if (state.brownEs >= cost && !challengeIs('noupgrades')) {
               spend(cost);
               state.clickMultiLevel++;
               recalculateStats();
               refreshRowStats();
               checkAchievements();
               updateDisplay();
           }
       });


       upgradeBpsBtn.addEventListener('click', () => {
           const cost = getMultiplierCost(state.bpsMultiLevel);
           if (state.brownEs >= cost && !challengeIs('noupgrades')) {
               spend(cost);
               state.bpsMultiLevel++;
               recalculateStats();
               refreshRowStats();
               checkAchievements();
               updateDisplay();
           }
       });


       // --- ACHIEVEMENTS ---
       let achGridBuilt = false;

       function unlockAchievement(id) {
           if (state.achievements[id] || !ACH_BY_ID[id]) return false;
           state.achievements[id] = Date.now();
           showAchievementToast(ACH_BY_ID[id]);
           recalculateStats();
           refreshRowStats();
           refreshAchievementUI();
           return true;
       }

       // Check every achievement that has a condition (runs once a second and after purchases)
       function checkAchievements() {
           let changed = false;
           for (let i = 0; i < ACHIEVEMENTS.length; i++) {
               const a = ACHIEVEMENTS[i];
               if (state.achievements[a.id] || !a.check) continue;
               if (a.check()) {
                   state.achievements[a.id] = Date.now();
                   showAchievementToast(a);
                   changed = true;
               }
           }
           if (changed) {
               recalculateStats();
               refreshRowStats();
               refreshAchievementUI();
           }
       }

       function showAchievementToast(a) {
           // Keep at most 3 toasts on screen
           while (toastBox.children.length >= 3) toastBox.removeChild(toastBox.firstChild);
           const t = document.createElement('div');
           t.className = 'toast-in bg-stone-900 border-2 border-yellow-600 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center gap-2.5';
           t.innerHTML = `<div class="text-2xl">${a.icon}</div><div class="min-w-0"><div class="text-[0.6rem] font-black uppercase tracking-wide text-yellow-500 whitespace-nowrap">Achievement unlocked</div><div class="font-black text-white leading-tight truncate">${a.name}</div><div class="text-xs text-green-400 font-bold">+${Math.round(achievementEach() * 100)}% production</div></div>`;
           toastBox.appendChild(t);
           setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 4500);
       }

       function refreshAchievementUI() {
           const n = achievementCount();
           if (typeof skinsModal !== 'undefined' && !skinsModal.classList.contains('hidden')) renderSkins();
           setText(achBtnCount, `${n}/${ACHIEVEMENTS.length}`);
           const menuAch = document.getElementById('main-menu-ach');
           menuAch.classList.toggle('hidden', n === 0);
           setText(document.getElementById('main-menu-ach-count'), `${n} / ${ACHIEVEMENTS.length}`);
           if (!achGridBuilt) return;
           setText(document.getElementById('ach-modal-count'), `${n} / ${ACHIEVEMENTS.length}`);
           setText(document.getElementById('ach-modal-each'), `+${Math.round(achievementEach() * 100)}%`);
           setText(document.getElementById('ach-modal-bonus'), `+${Math.round((achievementMultiplier() - 1) * 100)}%`);
           ACHIEVEMENTS.forEach(a => {
               const got = state.achievements[a.id] ? '1' : '0';
               if (a.el && a.el._got !== got) {
                   a.el._got = got;
                   a.el.dataset.got = got;
               }
           });
       }

       function buildAchievementGrid() {
           achGrid.innerHTML = '';
           ACHIEVEMENTS.forEach(a => {
               const el = document.createElement('div');
               el.className = 'ach-tile bg-stone-800 border-2 border-stone-700 rounded-xl p-2 flex items-center gap-2';
               el.innerHTML = `<div class="ach-icon text-2xl w-10 h-10 shrink-0 flex items-center justify-center bg-stone-900 rounded-lg">${a.icon}</div><div class="min-w-0"><div class="font-black text-white text-sm leading-tight">${a.name}</div><div class="text-[0.7rem] text-stone-400 leading-snug">${a.desc}</div></div>`;
               achGrid.appendChild(el);
               a.el = el;
           });
           achGridBuilt = true;
           refreshAchievementUI();
       }

       document.getElementById('ach-btn').addEventListener('click', () => {
           if (!achGridBuilt) buildAchievementGrid();
           hideTooltip();
           achModal.classList.remove('hidden');
           unlockAchievement('mach');
           refreshAchievementUI();
       });
       document.getElementById('ach-close').addEventListener('click', () => achModal.classList.add('hidden'));
       achModal.addEventListener('mousedown', (e) => { if (e.target === achModal) achModal.classList.add('hidden'); });


       // --- STATS PAGE ---
       function statRow(label, value) {
           return `<div class="flex justify-between gap-3 py-1 border-b border-stone-800"><span class="text-stone-400">${label}</span><span class="font-bold text-white text-right">${value}</span></div>`;
       }
       function renderStats() {
           const L = state.life, R = state.run;
           const owned = totalBuildings();
           const run = [
               statRow('Brown E\'s in bank', formatNumber(state.brownEs)),
               statRow('Earned this run', formatNumber(R.earned)),
               statRow('E\'s per second', `${formatRate(state.bps)}${MULTS.buffProd > 1 ? ` <span class="text-yellow-400">(x${formatShort(MULTS.buffProd)} buff)</span>` : ''}`),
               statRow('Click power', formatNumber(state.clickPower)),
               statRow('Clicks this run', formatNumber(R.clicks)),
               statRow('Hand-made E\'s this run', formatNumber(R.handmade)),
               statRow('Golden E\'s this run', formatNumber(R.golden)),
               statRow('Buildings owned', formatNumber(owned)),
               statRow('Upgrades owned', `${upgradesOwned()} / ${UPGRADES.length}`),
               statRow('Run time', formatTime(R.time))
           ].join('');
           const life = [
               statRow('Earned all time', formatNumber(L.earned)),
               statRow('Total clicks', formatNumber(L.clicks)),
               statRow('Hand-made E\'s', formatNumber(L.handmade)),
               statRow('Golden E\'s clicked', `${formatNumber(L.golden)} <span class="text-stone-500">(${formatNumber(L.goldenMissed)} missed)</span>`),
               statRow('Frenzy / Lucky / Click Frenzy / Rush', `${L.frenzy} / ${L.lucky} / ${L.clickFrenzy} / ${L.rush}`),
               statRow('Biggest Lucky', formatNumber(L.biggestLucky)),
               statRow('Best E\'s per second', formatNumber(L.bestBps)),
               statRow('Earned while away', formatNumber(L.offlineEarned)),
               statRow('Longest time away', formatTime(L.longestAway)),
               statRow('Wins', `${state.wins}${L.fastestWin ? ` <span class="text-stone-500">(fastest ${formatTime(L.fastestWin)})</span>` : ''}`),
               statRow('Critical clicks', formatNumber(L.crits)),
               statRow('Auto-clicks by angels', formatNumber(L.autoClicked)),
               statRow('Time played', formatTime(L.played)),
               statRow('Playing since', new Date(L.started).toLocaleDateString())
           ].join('');
           const off = offlineSettings();
           const M = state.meta;
           const pres = [
               statRow('Heavenly Chips', `${formatNumber(M.chips)} <span class="text-stone-500">(${formatNumber(M.chipsTotal)} earned)</span>`),
               statRow('Chips if you ascend now', formatNumber(pendingChips())),
               statRow('Ascensions', `${formatNumber(M.ascensions)}${L.fastestAscend ? ` <span class="text-stone-500">(fastest ${formatTime(L.fastestAscend)})</span>` : ''}`),
               statRow('Best run', `${formatNumber(M.bestRunChips)} chips`),
               statRow('Prestige Tree', `${treeOwned()} / ${TREE.length}`),
               statRow('Challenges beaten', `${challengesDone()} / ${CHALLENGES.length}${activeChallenge() ? ` <span class="text-red-300">(${activeChallenge().name} now)</span>` : ''}`)
           ].join('');
           const mult = [
               statRow(`Heavenly Chips (${formatNumber(M.chipsTotal)} x 1%)`, `x${formatShort(MULTS.chips)}`),
               statRow('Prestige Tree & challenge rewards', `x${formatShort(MULTS.treeProd)} E/s &middot; x${formatShort(MULTS.treeClick)} clicks`),
               statRow('Wins boost', `x${formatShort(MULTS.win)}`),
               statRow(`Achievements (${achievementCount()} / ${ACHIEVEMENTS.length})`, `x${MULTS.ach.toFixed(2)}`),
               statRow('Production upgrades', `x${MULTS.global.toFixed(2)}`),
               statRow('General E/s upgrade', `x${MULTS.bpsLevel.toFixed(1)}`),
               statRow('General click upgrade', `x${MULTS.clickLevel.toFixed(1)}`),
               statRow('Click upgrades', `x${formatShort(MULTS.clickUpg)}${MULTS.touch ? ` + ${Math.round(MULTS.touch * 100)}% of E/s` : ''}`),
               statRow('Golden E buffs', `x${formatShort(MULTS.buffProd)} E/s &middot; x${formatShort(MULTS.buffClick)} clicks`),
               statRow('Away earnings', `${Math.round(off.eff * 100)}% for up to ${off.capHours}h`),
               ...(MULTS.garden !== 1 || MULTS.gardenClick !== 1 ? [statRow('E Garden', `x${MULTS.garden.toFixed(2)} E/s &middot; x${MULTS.gardenClick.toFixed(2)} clicks`)] : []),
               ...(MULTS.eggs !== 1 ? [statRow('Golden eggs', `x${MULTS.eggs.toFixed(2)}`)] : []),
               ...(MULTS.challenge !== 1 ? [statRow('Challenge handicap', `x${MULTS.challenge}`)] : [])
           ].join('');
           statsBody.innerHTML = `
               <div><h4 class="text-sm font-black text-[#8B4513] bg-white inline-block px-2 rounded uppercase tracking-widest mb-2">This Run</h4>${run}
                    <h4 class="text-sm font-black text-[#8B4513] bg-white inline-block px-2 rounded uppercase tracking-widest mb-2 mt-4">Multipliers</h4>${mult}</div>
               <div><h4 class="text-sm font-black text-[#8B4513] bg-white inline-block px-2 rounded uppercase tracking-widest mb-2">All Time</h4>${life}
                    <h4 class="text-sm font-black text-purple-900 bg-purple-200 inline-block px-2 rounded uppercase tracking-widest mb-2 mt-4">Prestige</h4>${pres}</div>`;
       }
       document.getElementById('stats-btn').addEventListener('click', () => {
           hideTooltip();
           renderStats();
           statsModal.classList.remove('hidden');
           unlockAchievement('mstats');
       });
       document.getElementById('stats-close').addEventListener('click', () => statsModal.classList.add('hidden'));
       statsModal.addEventListener('mousedown', (e) => { if (e.target === statsModal) statsModal.classList.add('hidden'); });


       // --- SETTINGS ---
       const SETTINGS_KEY = 'brownEClickerSettings';
       const settingsModal = document.getElementById('settings-modal');
       function loadSettings() {
           try {
               const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
               if (s && typeof s === 'object') {
                   if (['short', 'words', 'sci'].includes(s.numFormat)) settings.numFormat = s.numFormat;
                   settings.reduced = !!s.reduced;
                   if (typeof s.ticker === 'boolean') settings.ticker = s.ticker;
                   if (typeof s.events === 'boolean') settings.events = s.events;
               }
           } catch (e) { /* storage blocked: keep the defaults */ }
           applySettings();
       }
       function saveSettings() {
           try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
       }
       function applySettings() {
           document.body.classList.toggle('reduced', settings.reduced);
           document.getElementById('ticker').classList.toggle('hidden', !settings.ticker);
           const marks = { 'set-numfmt': settings.numFormat, 'set-reduced': settings.reduced ? '1' : '0', 'set-ticker': settings.ticker ? '1' : '0', 'set-events': settings.events ? '1' : '0' };
           for (const id in marks) {
               document.querySelectorAll(`#${id} .opt-btn`).forEach(b => { b.dataset.on = b.dataset.val === marks[id] ? '1' : '0'; });
           }
       }
       // Numbers are cached as text in many places: redraw everything after a format change
       function refreshAllNumbers() {
           recalculateStats();
           initShop();
           setBuyAmount(buyAmount);
           refreshUpgrades(true);
           renderBuffBar();
           updateDisplay();
           if (typeof refreshOpenPanels === 'function') refreshOpenPanels();
       }
       function onSetting(groupId, fn) {
           document.getElementById(groupId).addEventListener('click', (e) => {
               const b = e.target.closest('.opt-btn');
               if (!b) return;
               fn(b.dataset.val);
               saveSettings();
               applySettings();
           });
       }
       onSetting('set-numfmt', v => { settings.numFormat = v; refreshAllNumbers(); });
       onSetting('set-reduced', v => { settings.reduced = v === '1'; });
       onSetting('set-ticker', v => { settings.ticker = v === '1'; if (settings.ticker) nextHeadline(); });
       onSetting('set-events', v => { settings.events = v === '1'; if (typeof refreshEvent === 'function') refreshEvent(); });
       function openSettings() {
           hideTooltip();
           applySettings();
           setText(document.getElementById('save-code-msg'), '');
           settingsModal.classList.remove('hidden');
       }
       document.getElementById('settings-close').addEventListener('click', () => settingsModal.classList.add('hidden'));
       settingsModal.addEventListener('mousedown', (e) => { if (e.target === settingsModal) settingsModal.classList.add('hidden'); });

       // Save codes: move progress between computers (base64 of the normal save)
       document.getElementById('save-export').addEventListener('click', () => {
           const box = document.getElementById('save-code');
           box.value = btoa(unescape(encodeURIComponent(JSON.stringify(buildSaveData()))));
           box.focus();
           box.select();
           setText(document.getElementById('save-code-msg'), 'Copy this code (Ctrl+C) and keep it somewhere safe.');
       });
       document.getElementById('save-import').addEventListener('click', () => {
           const msg = document.getElementById('save-code-msg');
           const code = document.getElementById('save-code').value.trim();
           let text = '';
           try {
               text = decodeURIComponent(escape(atob(code)));
               const data = JSON.parse(text);
               if (!data || typeof data !== 'object' || (!data.state && !data.shopItems)) throw new Error('not a save');
           } catch (e) {
               setText(msg, 'That code doesn\'t look like a Brown E Clicker save.');
               return;
           }
           winModal.classList.add('hidden');
           resetRun(false);
           loadGame(text);
           saveGame(true);
           setText(msg, 'Save loaded!');
       });


