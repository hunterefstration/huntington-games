       // --- CHALLENGE RUNS ---
       const chalBanner = document.getElementById('chal-banner');
       let quitArmedAt = 0;
       function refreshChallengeUI() {
           const c = activeChallenge();
           chalBanner.classList.toggle('hidden', !c);
           document.getElementById('game-title').style.display = c ? 'none' : '';
           if (!c) return;
           setText(document.getElementById('chal-icon'), c.icon);
           setText(document.getElementById('chal-name'), `${c.name} challenge`);
           const pct = Math.min(100, state.run.earned / c.goal * 100);
           let prog = `Earn ${formatShort(c.goal)}: ${pct >= 99.95 ? '100' : pct.toFixed(1)}%`;
           if (c.limit) prog += ` · ${formatTime(Math.max(0, c.limit - state.run.time))} left`;
           setText(document.getElementById('chal-prog'), prog);
           setText(document.getElementById('chal-quit'), performance.now() - quitArmedAt < 3000 ? 'Sure?' : 'Give up');
       }
       document.getElementById('chal-quit').addEventListener('click', () => {
           if (performance.now() - quitArmedAt < 3000) endChallenge(false, 'You gave up. The rules are lifted for the rest of this run.');
           else { quitArmedAt = performance.now(); refreshChallengeUI(); }
       });
       function checkChallenge() {
           const c = activeChallenge();
           if (!c) return;
           if (state.run.earned >= c.goal) endChallenge(true);
           else if (c.limit && state.run.time > c.limit) endChallenge(false, 'Out of time! The rules are lifted for the rest of this run.');
           else refreshChallengeUI();
       }
       function endChallenge(won, why) {
           const c = activeChallenge();
           if (!c) return;
           state.meta.challenge = null;
           if (won) {
               const first = !state.meta.challengesDone[c.id];
               state.meta.challengesDone[c.id] = Date.now();
               showGoldenMessage('CHALLENGE COMPLETE!', first ? c.reward : `${c.name} beaten again!`);
           } else {
               showGoldenMessage('CHALLENGE OVER', why || '');
           }
           afterPrestigeChange();
           initShop();
           refreshChallengeUI();
           checkAchievements();
           saveGame(true);
       }

       TOOLBAR_ACTIONS.tree = openTree;
       TOOLBAR_TIPS.tree = () => {
           if (canAscend()) return ['👼 Ascend & Prestige Tree', `Ascending now gives <b class="text-purple-300">+${formatNumber(pendingChips())} Heavenly Chips</b>. Open the tree to ascend and spend chips.`];
           if (state.meta.chipsTotal > 0) return ['👼 Prestige Tree', `You have <b class="text-purple-300">${formatNumber(state.meta.chips)}</b> chips to spend. Earn ${formatShort(CHIP_BASE)} E's in a run to ascend again.`];
           return ['👼 Prestige Tree', `Earn ${formatShort(CHIP_BASE)} Brown E's in one run to unlock Ascension. You can look at the tree now.`];
       };


       // --- E GARDEN ---
       const gardenModal = document.getElementById('garden-modal');
       const gardenGrid = document.getElementById('garden-grid');
       const gardenSeedsEl = document.getElementById('garden-seeds');
       const gardenInfo = document.getElementById('garden-info');
       let gardenTool = 'bean'; // a seed id, or 'shovel'
       let gardenBuilt = false;
       const plotEls = [];

       function seedCost(sd) { return Math.max(50, sd.cost * state.bpsBase); }
       function seedHarvest(sd) { return Math.max(80, sd.harvest * state.bpsBase); }
       function plotStage(p) { return !p ? 'empty' : p.m ? 'grown' : p.age / SEED_BY_ID[p.s].grow < 0.5 ? 'young' : 'growing'; }

       function afterGardenChange() {
           recalcGarden();
           repriceBuildings();
           recalculateStats();
           refreshCosts();
           refreshRowStats();
           updateDisplay();
           if (!gardenModal.classList.contains('hidden')) renderGarden();
       }

       // Plants grow every second (and while you're away); mutations are rolled every 5 seconds
       function gardenTick(dt, offline) {
           if (!garden.unlocked) return;
           const speed = gardenSpeed();
           let changed = false;
           for (let i = 0; i < garden.plots.length; i++) {
               const p = garden.plots[i];
               if (!p || p.m || !plotOpen(i)) continue;
               const sd = SEED_BY_ID[p.s];
               p.age += dt * speed;
               if (p.age >= sd.grow) {
                   p.age = sd.grow;
                   p.m = 1;
                   changed = true;
                   if (!garden.seeds[p.s]) {
                       garden.seeds[p.s] = true;
                       gardenSeedsKey = '';
                       gardenToast(sd.icon, 'New seed discovered!', sd.name);
                   }
               }
           }
           if (!offline) {
               garden.tick += dt;
               if (garden.tick >= 5) { garden.tick = 0; if (gardenMutate()) changed = true; }
           }
           if (changed) afterGardenChange();
       }
       function gardenMutate() {
           let any = false;
           const counts = {};
           for (let i = 0; i < garden.plots.length; i++) {
               if (garden.plots[i] || !plotOpen(i)) continue;
               for (const k in counts) delete counts[k];
               const r = Math.floor(i / GARDEN_COLS), c = i % GARDEN_COLS;
               for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                   if (!dr && !dc) continue;
                   const rr = r + dr, cc = c + dc;
                   if (rr < 0 || cc < 0 || cc >= GARDEN_COLS || rr >= 4) continue;
                   const j = rr * GARDEN_COLS + cc;
                   const q = garden.plots[j];
                   if (q && q.m && plotOpen(j)) counts[q.s] = (counts[q.s] || 0) + 1;
               }
               const options = SEEDS.filter(sd => sd.parents && (sd.parents[0] === sd.parents[1] ? (counts[sd.parents[0]] || 0) >= 2 : counts[sd.parents[0]] && counts[sd.parents[1]]));
               if (!options.length || Math.random() >= 0.06 * PRES.mutation) continue;
               const sd = options[Math.floor(Math.random() * options.length)];
               garden.plots[i] = { s: sd.id, age: 0, m: 0, mut: 1 };
               state.life.mutations++;
               any = true;
               if (!garden.seeds[sd.id]) gardenToast('🧬', 'Something strange sprouted!', 'A mutation is growing in your garden');
           }
           return any;
       }
       function gardenToast(icon, title, text) {
           while (toastBox.children.length >= 3) toastBox.removeChild(toastBox.firstChild);
           const t = document.createElement('div');
           t.className = 'toast-in bg-stone-900 border-2 border-green-600 rounded-xl px-2.5 py-1.5 shadow-2xl flex items-center gap-2.5';
           t.innerHTML = `<div class="text-2xl">${icon}</div><div class="min-w-0"><div class="text-[0.6rem] font-black uppercase tracking-wide text-green-400 whitespace-nowrap">${title}</div><div class="font-black text-white leading-tight truncate">${text}</div></div>`;
           toastBox.appendChild(t);
           setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 4500);
       }

       function plantSeed(i, id) {
           const sd = SEED_BY_ID[id];
           if (!sd || !garden.seeds[id] || garden.plots[i] || !plotOpen(i)) return false;
           const cost = seedCost(sd);
           if (state.brownEs < cost) return false;
           spend(cost);
           garden.plots[i] = { s: id, age: 0, m: 0, mut: 0 };
           return true;
       }
       function harvestPlot(i) {
           const p = garden.plots[i];
           if (!p || !p.m) return false;
           const amount = seedHarvest(SEED_BY_ID[p.s]);
           earn(amount, 'garden');
           state.life.harvests++;
           garden.plots[i] = null;
           if (!settings.reduced) {
               const el = plotEls[i];
               if (el) { const b = el.getBoundingClientRect(); createFloatingText({ clientX: b.left + b.width / 2, clientY: b.top }, `+${formatShort(amount)}`); }
           }
           return true;
       }
       function plotAction(i) {
           const p = garden.plots[i];
           if (!plotOpen(i)) return;
           if (gardenTool === 'shovel') { if (p) { garden.plots[i] = null; afterGardenChange(); } return; }
           if (p && p.m) { harvestPlot(i); afterGardenChange(); return; }
           if (!p) {
               if (plantSeed(i, gardenTool)) afterGardenChange();
               else gardenInfoText(garden.seeds[gardenTool] ? `Not enough Brown E's: ${SEED_BY_ID[gardenTool].name} costs ${formatShort(seedCost(SEED_BY_ID[gardenTool]))}.` : 'Pick a seed first.');
           }
       }
       function gardenInfoText(t) { setText(gardenInfo, t); }

       function buildGarden() {
           gardenGrid.innerHTML = '';
           for (let i = 0; i < 16; i++) {
               const el = document.createElement('button');
               el.className = 'plot';
               el.dataset.plot = i;
               el.innerHTML = '<span class="plot-icon pointer-events-none"></span><div class="plot-bar pointer-events-none"><div></div></div>';
               gardenGrid.appendChild(el);
               plotEls[i] = el;
               el._icon = el.firstChild;
               el._bar = el.querySelector('.plot-bar');
               el._fill = el._bar.firstChild;
           }
           gardenBuilt = true;
       }
       let gardenSeedsKey = '';
       function renderGarden() {
           if (!gardenBuilt) buildGarden();
           // seed list (rebuilt only when something about it changes)
           const affordKey = SEEDS.map(sd => state.brownEs >= seedCost(sd) ? 1 : 0).join('');
           const key = [gardenTool, Object.keys(garden.seeds).join(), affordKey, settings.numFormat, Math.floor(Math.log10(state.bpsBase + 1) * 4)].join('|');
           if (key !== gardenSeedsKey) {
               gardenSeedsKey = key;
               gardenSeedsEl.innerHTML = SEEDS.map(sd => {
                   const found = !!garden.seeds[sd.id];
                   if (!found) {
                       const known = sd.parents && garden.seeds[sd.parents[0]] && garden.seeds[sd.parents[1]];
                       const hint = known ? `Grow ${SEED_BY_ID[sd.parents[0]].name} next to ${sd.parents[0] === sd.parents[1] ? 'another one' : SEED_BY_ID[sd.parents[1]].name}` : 'Undiscovered';
                       return `<div class="seed-btn" data-found="0"><span class="text-2xl w-8 text-center">❔</span><span class="min-w-0"><b class="text-stone-300 text-sm">???</b><br><span class="text-[0.7rem] text-stone-400 leading-tight">${hint}</span></span></div>`;
                   }
                   const afford = state.brownEs >= seedCost(sd);
                   return `<button class="seed-btn" data-seed="${sd.id}" data-on="${gardenTool === sd.id ? 1 : 0}" data-found="1"><span class="text-2xl w-8 text-center pointer-events-none">${sd.icon}</span><span class="min-w-0 pointer-events-none"><b class="text-white text-sm">${sd.name}</b><br><span class="text-[0.7rem] text-green-300 leading-tight">${sd.desc}</span><br><span class="text-[0.7rem] ${afford ? 'text-stone-300' : 'text-red-300'}">${formatShort(seedCost(sd))} E · ${formatTime(sd.grow / gardenSpeed())}</span></span></button>`;
               }).join('');
               setText(document.getElementById('garden-found'), `(${seedsFound()}/${SEEDS.length} found)`);
               document.getElementById('garden-shovel').dataset.on = gardenTool === 'shovel' ? '1' : '0';
           }
           for (let i = 0; i < 16; i++) {
               const el = plotEls[i];
               const p = garden.plots[i];
               const st = !plotOpen(i) ? 'locked' : plotStage(p);
               if (el._st !== st) { el._st = st; el.dataset.st = st; }
               const icon = st === 'locked' ? '🔒' : !p ? '' : st === 'grown' ? SEED_BY_ID[p.s].icon : st === 'young' ? '🌱' : '🌿';
               setText(el._icon, icon);
               const showBar = p && !p.m && st !== 'locked';
               if (el._bar._show !== showBar) { el._bar._show = showBar; el._bar.style.display = showBar ? '' : 'none'; }
               if (showBar) {
                   const w = `${Math.floor(p.age / SEED_BY_ID[p.s].grow * 100)}%`;
                   if (el._fill._w !== w) { el._fill._w = w; el._fill.style.width = w; }
               }
           }
           const fx = [];
           if (GFX.prod > 1) fx.push(`+${Math.round((GFX.prod - 1) * 100)}% E/s`);
           if (GFX.click > 1) fx.push(`+${Math.round((GFX.click - 1) * 100)}% clicks`);
           if (GFX.goldFreq > 1) fx.push(`Golden E's +${Math.round((GFX.goldFreq - 1) * 100)}% more often`);
           if (GFX.goldDur > 1) fx.push(`Golden effects +${Math.round((GFX.goldDur - 1) * 100)}% longer`);
           if (GFX.buildDisc < 1) fx.push(`buildings ${Math.round((1 - GFX.buildDisc) * 100)}% cheaper`);
           if (GFX.lucky > 1) fx.push(`Lucky +${Math.round((GFX.lucky - 1) * 100)}%`);
           if (GFX.offEff > 0) fx.push(`away earnings +${Math.round(GFX.offEff * 100)}%`);
           setText(document.getElementById('garden-fx'), fx.length ? `Grown plants: ${fx.join(' · ')}` : 'Fully grown plants give buffs. Harvest them for Brown E\'s.');
           setText(document.getElementById('garden-speed'), `Growth speed x${gardenSpeed().toFixed(2)} (+1% per E-Farm, max +100%) · ${grownPlants()} grown`);
       }

       function openGarden() {
           if (!garden.unlocked) return;
           hideTooltip();
           gardenSeedsKey = '';
           renderGarden();
           gardenInfoText(gardenTool === 'shovel' ? 'Shovel: click a plant to dig it up (no refund).' : 'Pick a seed, then click an empty plot. Click a grown plant to harvest it.');
           gardenModal.classList.remove('hidden');
       }
       document.getElementById('garden-close').addEventListener('click', () => { gardenModal.classList.add('hidden'); hideTooltip(); });
       gardenModal.addEventListener('mousedown', (e) => { if (e.target === gardenModal) { gardenModal.classList.add('hidden'); hideTooltip(); } });
       gardenSeedsEl.addEventListener('click', (e) => {
           const b = e.target.closest('[data-seed]');
           if (!b) return;
           gardenTool = b.dataset.seed;
           gardenInfoText(`${SEED_BY_ID[gardenTool].name} selected. Click an empty plot to plant it.`);
           renderGarden();
       });
       document.getElementById('garden-shovel').addEventListener('click', () => {
           gardenTool = gardenTool === 'shovel' ? (garden.seeds.bean ? 'bean' : 'cocoa') : 'shovel';
           gardenInfoText(gardenTool === 'shovel' ? 'Shovel: click a plant to dig it up (no refund).' : 'Pick a seed, then click an empty plot.');
           gardenSeedsKey = '';
           renderGarden();
       });
       document.getElementById('garden-harvest-all').addEventListener('click', () => {
           let n = 0;
           for (let i = 0; i < 16; i++) if (harvestPlot(i)) n++;
           gardenInfoText(n ? `Harvested ${n} plant${n === 1 ? '' : 's'}!` : 'Nothing is fully grown yet.');
           if (n) afterGardenChange();
       });
       document.getElementById('garden-plant-all').addEventListener('click', () => {
           if (gardenTool === 'shovel') return;
           let n = 0;
           for (let i = 0; i < 16; i++) if (plantSeed(i, gardenTool)) n++;
           gardenInfoText(n ? `Planted ${n} ${SEED_BY_ID[gardenTool].name}${n === 1 ? '' : 's'}.` : 'No empty plots, or not enough Brown E\'s.');
           if (n) afterGardenChange();
       });
       gardenGrid.addEventListener('click', (e) => {
           const el = e.target.closest('[data-plot]');
           if (!el) return;
           plotAction(Number(el.dataset.plot));
           showPlotTooltip(el);
       });
       function showPlotTooltip(el) {
           const i = Number(el.dataset.plot);
           const p = garden.plots[i];
           let html;
           if (!plotOpen(i)) html = `<div class="font-black text-white">🔒 Locked plot</div><div class="text-sm text-stone-300 mt-1">Unlock more plots with <b>Green Thumb</b> and <b>Garden Expansion</b> in the Prestige Tree.</div>`;
           else if (!p) html = `<div class="font-black text-white">Empty plot</div><div class="text-sm text-stone-300 mt-1">${gardenTool === 'shovel' ? 'Nothing to dig up.' : `Click to plant ${SEED_BY_ID[gardenTool].name} for ${formatShort(seedCost(SEED_BY_ID[gardenTool]))} E's.`}</div><div class="text-xs text-stone-500 mt-1">Empty plots next to two grown plants can sprout mutations.</div>`;
           else {
               const sd = SEED_BY_ID[p.s];
               const found = !!garden.seeds[p.s];
               const left = (sd.grow - p.age) / gardenSpeed();
               html = `<div class="flex items-center gap-2"><div class="text-3xl leading-none">${p.m || found ? sd.icon : '❔'}</div><div class="font-black text-white">${p.m || found ? sd.name : 'Mystery sprout'}</div></div>
                   <div class="text-sm text-green-400 font-bold mt-1">${p.m || found ? `When grown: ${sd.desc}` : 'A mutation! Let it grow to find out.'}</div>
                   <div class="text-sm mt-1">${p.m ? '<b class="text-green-300">Fully grown!</b> Click to harvest' : `Growing: ${Math.floor(p.age / sd.grow * 100)}% (${formatTime(left)} left)`}</div>
                   <div class="text-xs text-stone-400 mt-1">Harvest: +${formatShort(seedHarvest(sd))} E's${gardenTool === 'shovel' ? ' · Shovel: click to dig up' : ''}</div>`;
           }
           tooltipEl.innerHTML = html;
           tooltipAnchor = el;
           placeTooltip(el);
       }
       gardenGrid.addEventListener('mouseover', (e) => {
           const el = e.target.closest('[data-plot]');
           if (el && el !== tooltipAnchor) showPlotTooltip(el);
       });
       gardenGrid.addEventListener('mouseleave', hideTooltip);

       function saveGarden() {
           return {
               unlocked: garden.unlocked,
               plots: garden.plots.map(p => p ? [p.s, Math.round(p.age), p.m ? 1 : 0, p.mut ? 1 : 0] : 0),
               seeds: Object.keys(garden.seeds)
           };
       }
       function loadGarden(d) {
           if (!d || typeof d !== 'object') return;
           garden.unlocked = !!d.unlocked;
           if (Array.isArray(d.seeds)) d.seeds.forEach(id => { if (SEED_BY_ID[id]) garden.seeds[id] = true; });
           if (Array.isArray(d.plots)) {
               for (let i = 0; i < 16 && i < d.plots.length; i++) {
                   const p = d.plots[i];
                   if (Array.isArray(p) && SEED_BY_ID[p[0]]) {
                       const sd = SEED_BY_ID[p[0]];
                       garden.plots[i] = { s: p[0], age: Math.min(sd.grow, cleanNum(p[1])), m: p[2] ? 1 : 0, mut: p[3] ? 1 : 0 };
                   }
               }
           }
       }


