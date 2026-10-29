       // --- SHOP LOGIC ---
       let buyAmount = 1;
       const rowEls = []; // cached DOM refs per shop row

       // A building is revealed once you've earned half its price this run (or own one)
       function rowMode(index) {
           const item = shopItems[index];
           if (item.type === 'win') return 'shown';
           if (index === 0 || item.owned > 0 || state.run.earned >= BASE_COSTS[index] * 0.5) return 'shown';
           return 'locked';
       }

       // Initialize the shop UI
       function initShop() {
           hideTooltip();
           shopContainer.innerHTML = ''; // Clear container
           rowEls.length = 0;

           shopItems.forEach((item, index) => {
               const itemEl = document.createElement('div');
               itemEl.className = 'shop-row bg-stone-800 rounded-xl p-3 shadow-sm border border-stone-700 flex justify-between items-center transition-all duration-200';
               itemEl.id = `shop-item-${index}`;
               itemEl.dataset.row = index;

               // Give the final E a special gold glow
               const isWinItem = item.type === 'win';
               if (isWinItem) {
                   itemEl.classList.add('border-yellow-600', 'bg-yellow-900/20');
               }


               itemEl.innerHTML = `
                   <div class="flex items-center gap-3 min-w-0">
                       <div class="row-icon text-3xl ${isWinItem ? 'bg-yellow-800/50 border-yellow-600' : 'bg-stone-700 border-stone-600'} w-14 h-14 rounded-lg flex items-center justify-center border shadow-inner shrink-0" id="icon-${index}">
                           ${item.icon}
                       </div>
                       <div class="min-w-0">
                           <h3 class="font-bold text-lg ${isWinItem ? 'text-yellow-400' : 'text-stone-100'} leading-tight truncate" id="name-${index}">${item.name}</h3>
                           <p class="text-xs text-stone-400 font-medium mb-1 truncate" id="desc-${index}">${item.desc}</p>
                           <p class="text-xs font-bold ${isWinItem ? 'text-yellow-900 bg-yellow-400' : 'text-[#5C4033] bg-white'} inline-block px-2 py-0.5 rounded whitespace-nowrap" id="stat-${index}"></p>
                       </div>
                   </div>
                   <div class="flex flex-col items-end gap-2 shrink-0 ml-2">
                       ${isWinItem ? '' : `<div class="text-3xl font-black ${item.owned > 0 ? 'text-white' : 'text-stone-600'}" id="owned-${index}">${item.owned}</div>`}
                       <button id="buy-btn-${index}" class="${isWinItem ? 'bg-yellow-600 hover:bg-yellow-500 text-stone-900' : 'bg-[#5C4033] hover:bg-[#4A332A] text-white'} font-bold py-2 px-3 rounded-lg shadow disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-1 border ${isWinItem ? 'border-yellow-400' : 'border-stone-600'} whitespace-nowrap">
                           <span id="buy-label-${index}">Cost:</span> <span id="cost-${index}">${formatShort(item.cost)}</span>
                       </button>
                   </div>
               `;

               shopContainer.appendChild(itemEl);
               rowEls[index] = {
                   row: itemEl,
                   icon: itemEl.querySelector(`#icon-${index}`),
                   name: itemEl.querySelector(`#name-${index}`),
                   desc: itemEl.querySelector(`#desc-${index}`),
                   stat: itemEl.querySelector(`#stat-${index}`),
                   owned: itemEl.querySelector(`#owned-${index}`),
                   btn: itemEl.querySelector(`#buy-btn-${index}`),
                   label: itemEl.querySelector(`#buy-label-${index}`),
                   cost: itemEl.querySelector(`#cost-${index}`),
                   mode: null,
                   price: item.cost
               };

               // Add purchase event listener
               rowEls[index].btn.addEventListener('click', () => buyItem(index));
           });

           refreshReveals();
           refreshRowStats();
           refreshCosts();
           updateShopUI();
       }

       // Show / hide / "???" each building row as you progress
       function refreshReveals() {
           let lockedShown = 0;
           for (let index = 0; index < shopItems.length; index++) {
               const r = rowEls[index];
               if (!r) continue;
               let mode = rowMode(index);
               if (mode === 'locked') {
                   // Tease the next two buildings as "???", hide the rest
                   mode = lockedShown < 2 ? 'mystery' : 'hidden';
                   lockedShown++;
               }
               if (r.mode === mode) continue;
               r.mode = mode;
               r.row.dataset.mode = mode;
               r.row.classList.toggle('hidden', mode === 'hidden');
               const item = shopItems[index];
               if (mode === 'mystery') {
                   setText(r.name, '???');
                   setText(r.desc, 'Earn more Brown E\'s to reveal this.');
               } else {
                   setText(r.name, item.name);
                   setText(r.desc, item.desc);
               }
               r.stat.classList.toggle('invisible', mode === 'mystery');
           }
       }

       // The white "+X E/sec" pill shows what ONE more copy adds right now (all bonuses included)
       function refreshRowStats() {
           for (let index = 0; index < shopItems.length; index++) {
               const r = rowEls[index];
               if (!r) continue;
               const item = shopItems[index];
               let statsText = '';
               if (item.type === 'bps') statsText = `+${formatShort(item.eff)} E/sec`;
               else if (item.type === 'click') statsText = `+${formatShort(item.eff)} Click Power`;
               else if (item.type === 'win') statsText = `Win The Game`;
               setText(r.stat, statsText);
           }
       }

       // Challenge runs can block buildings ('' = allowed)
       function buildingBlocked(item) {
           if (item.type === 'click' && challengeIs('noclick')) return 'Blocked';
           if (item.type === 'bps' && challengeIs('clicksonly')) return 'Blocked';
           if (item.type !== 'win' && challengeIs('minimal') && item.owned >= 10) return 'Max 10';
           return '';
       }
       // How many copies the buy button buys (Minimalist caps each building at 10)
       function buyCount(item) {
           if (item.type === 'win') return 1;
           if (challengeIs('minimal')) return Math.max(1, Math.min(buyAmount, 10 - item.owned));
           return buyAmount;
       }

       // Prices for the current buy amount (x1 / x10 / x100)
       function refreshCosts() {
           for (let index = 0; index < shopItems.length; index++) {
               const r = rowEls[index];
               if (!r) continue;
               const item = shopItems[index];
               const n = buyCount(item);
               const blocked = buildingBlocked(item);
               r.blocked = !!blocked;
               r.n = n;
               r.price = n === 1 ? item.cost : bulkCost(item, n);
               if (r.row._blocked !== r.blocked) { r.row._blocked = r.blocked; r.row.dataset.blocked = r.blocked ? '1' : '0'; }
               setText(r.label, blocked || (n === 1 ? 'Cost:' : `x${n}:`));
               setText(r.cost, blocked ? '' : formatShort(r.price));
           }
       }


       // Handle buying an item
       function buyItem(index) {
           const item = shopItems[index];
           const r = rowEls[index];
           if (r && (r.mode === 'mystery' || r.mode === 'hidden')) return;

           if (item.type === 'win') {
               if (state.brownEs >= item.cost) {
                   // Deduct cost
                   spend(item.cost);
                   triggerWin();
               }
               return;
           }

           if (buildingBlocked(item) || state.meta.heaven) return;
           const n = buyCount(item);
           const cost = n === 1 ? item.cost : bulkCost(item, n);
           if (state.brownEs >= cost) {
               // Deduct cost
               spend(cost);

               // Increase owned amount and cost
               const g = buildingGrowth(item);
               for (let i = 0; i < n; i++) {
                   item.owned += 1;
                   item.cost = Math.ceil(item.cost * g);
               }
               state.life.buildings += n;
               if (n >= 100) unlockAchievement('mbulk');

               // Recalculate stats dynamically
               recalculateStats();


               // Update specific DOM elements for this item to avoid full re-render
               const ownedEl = document.getElementById(`owned-${index}`);
               if (ownedEl) {
                   ownedEl.textContent = item.owned;
                   ownedEl.classList.remove('text-stone-600');
                   ownedEl.classList.add('text-white'); // Highlight when owned
               }
               refreshCosts();
               refreshRowStats();
               refreshReveals();
               refreshUpgrades();
               checkAchievements();
               updateDisplay();
               if (tooltipAnchor === r.row) showBuildingTooltip(index);
           }
       }


       // Enable/Disable shop buttons based on current funds
       function updateShopUI() {
           for (let index = 0; index < rowEls.length; index++) {
               const r = rowEls[index];
               if (!r) continue;
               setDisabled(r.btn, r.mode === 'mystery' || r.blocked || state.brownEs < r.price);
           }
       }

       // Buy amount toggle (x1 / x10 / x100)
       const buyAmtBtns = document.querySelectorAll('.buy-amt');
       function setBuyAmount(n) {
           buyAmount = n === 10 || n === 100 ? n : 1;
           buyAmtBtns.forEach(btn => {
               const on = Number(btn.dataset.amt) === buyAmount;
               btn.classList.toggle('bg-[#8B4513]', on);
               btn.classList.toggle('text-white', on);
               btn.classList.toggle('bg-stone-800', !on);
               btn.classList.toggle('text-stone-400', !on);
           });
           refreshCosts();
           updateShopUI();
       }
       buyAmtBtns.forEach(btn => btn.addEventListener('click', () => setBuyAmount(Number(btn.dataset.amt))));


       // --- ONE-TIME UPGRADES ---
       let availableUpgrades = [];
       let availableKey = '';
       const upgradeTiles = {}; // id -> tile element

       function upgradeIconHtml(u) {
           const size = 'w-11 h-11 text-xl';
           let badge = '';
           if (u.badge) {
               badge = u.badgeIcon
                   ? `<span class="absolute -top-1 -left-1 text-xs leading-none bg-stone-900 rounded-full p-0.5">${u.badge}</span>`
                   : `<span class="absolute -bottom-1 -right-1 text-[0.6rem] font-black bg-stone-900 text-white rounded px-1 leading-tight border border-stone-600">${u.badge}</span>`;
           }
           return { size, badge };
       }

       // Work out which upgrades are on sale; rebuild the grid only when that list changes
       function refreshUpgrades(force) {
           const list = [];
           const strike = challengeIs('noupgrades');
           for (let i = 0; !strike && i < UPGRADES.length; i++) {
               const u = UPGRADES[i];
               if (!state.upgrades[u.id] && u.unlock()) list.push(u);
           }
           list.sort((a, b) => a.cost - b.cost);
           const key = list.map(u => u.id).join(',');
           if (!force && key === availableKey) return;
           availableKey = key;
           availableUpgrades = list;

           upgradeGrid.innerHTML = '';
           for (const id in upgradeTiles) delete upgradeTiles[id];
           list.forEach(u => {
               const { size, badge } = upgradeIconHtml(u);
               const tile = document.createElement('button');
               tile.className = `upg-tile relative ${size} rounded-lg bg-stone-700 border-2 ${u.style} flex items-center justify-center shrink-0`;
               tile.dataset.upg = u.id;
               tile.dataset.afford = '0';
               tile.innerHTML = `<span class="pointer-events-none">${u.icon}</span>${badge}`;
               upgradeGrid.appendChild(tile);
               upgradeTiles[u.id] = tile;
           });
           upgradeEmpty.classList.toggle('hidden', list.length > 0);
           setText(upgradeEmpty, strike ? '🚫 Upgrade Strike: no upgrades allowed this run!' : upgradesOwned() >= UPGRADES.length ? 'You own every upgrade. Legendary!' : 'Keep making Brown E\'s to unlock upgrades!');
           upgradeGrid.classList.toggle('hidden', list.length === 0);
           setText(upgAvailEl, list.length ? `(${list.length})` : '');
           if (tooltipAnchor && tooltipAnchor.dataset && tooltipAnchor.dataset.upg && !upgradeTiles[tooltipAnchor.dataset.upg]) hideTooltip();
           updateUpgradeAffordability();
       }

       function updateUpgradeAffordability() {
           let any = false;
           for (let i = 0; i < availableUpgrades.length; i++) {
               const u = availableUpgrades[i];
               const tile = upgradeTiles[u.id];
               if (!tile) continue;
               const ok = state.brownEs >= upgCost(u);
               if (ok) any = true;
               const v = ok ? '1' : '0';
               if (tile._afford !== v) {
                   tile._afford = v;
                   tile.dataset.afford = v;
               }
           }
           setDisabled(buyAllUpgBtn, !any);
       }

       function buyUpgrade(id, quiet) {
           const u = UPGRADE_BY_ID[id];
           if (!u || state.upgrades[id] || !u.unlock() || challengeIs('noupgrades') || state.brownEs < upgCost(u)) return false;
           spend(upgCost(u));
           state.upgrades[id] = true;
           state.life.upgrades++;
           if (quiet) return true;
           afterUpgradeBought();
           return true;
       }
       function afterUpgradeBought() {
           recalculateStats();
           refreshRowStats();
           refreshUpgrades();
           checkAchievements();
           updateDisplay();
       }

       // Buy every affordable upgrade, cheapest first
       function buyAllUpgrades() {
           let bought = 0;
           const list = availableUpgrades.slice();
           for (let i = 0; i < list.length; i++) {
               if (state.brownEs < upgCost(list[i])) break;
               if (buyUpgrade(list[i].id, true)) bought++;
           }
           if (bought) afterUpgradeBought();
           return bought;
       }

       upgradeGrid.addEventListener('click', (e) => {
           const tile = e.target.closest('[data-upg]');
           if (!tile) return;
           const id = tile.dataset.upg;
           if (buyUpgrade(id)) hideTooltip();
       });
       buyAllUpgBtn.addEventListener('click', () => { buyAllUpgrades(); hideTooltip(); });


