       // --- WHAT'S NEW ---
       const NEWS_ITEMS = [
           ['👼', 'Ascension 2.0', 'Earn 1 B in a run to ascend for Heavenly Chips. Every chip ever earned gives +1% production.'],
           ['🌳', 'Prestige Tree', '45 permanent upgrades to spend chips on: production, clicking, golden E\'s, minigames and more.'],
           ['⚔️', 'Challenge Runs', '9 runs with a twist (no clicking, inflation, no golden E\'s...). Beat one for a permanent reward.'],
           ['🌱', 'E Garden', 'Own 15 E-Farms. Plant seeds, harvest them, and breed 9 secret plants through mutations.'],
           ['📈', 'E-Goods Market', 'Own 15 E-Banks. Buy 8 goods low, sell them high.'],
           ['🎃', 'Seasonal events', 'Holiday themes with special Golden E effects, event achievements and skins.'],
           ['🎨', 'Skins', 'Unlock new looks for the E and new backgrounds with achievements.'],
           ['📰', 'News & settings', 'A news ticker, number formats, reduced effects and save codes to move your progress.'],
           ['🏗️', '44 buildings', '24 new buildings, from the Brown Crayon to The Author of E. They unlock as you earn.'],
           ['⬆️', '287 upgrades', 'Building tiers, synergies, click upgrades, production, Golden E, trophy and offline upgrades.'],
           ['🌟', 'Golden E\'s', 'Click them for Frenzy, Click Frenzy, Lucky and Building Rush.'],
           ['🏆', 'Achievements', 'Over 150 achievements, each worth +1% production. Plus a full stats page.'],
           ['🌙', 'Offline earnings', 'Your buildings keep working while you\'re away.'],
           ['🛒', 'Better shop', 'Buy x1/x10/x100, detailed tooltips and much bigger numbers.']
       ];
       const newsModal = document.getElementById('news-modal');
       document.getElementById('news-btn').addEventListener('click', () => {
           document.getElementById('news-body').innerHTML = NEWS_ITEMS.map(([icon, title, text]) =>
               `<div class="flex gap-3 py-2 border-b border-stone-800"><div class="text-2xl leading-none w-8 shrink-0 text-center">${icon}</div><div><div class="font-black text-white">${title}</div><div class="text-stone-400 text-xs leading-snug">${text}</div></div></div>`).join('');
           newsModal.classList.remove('hidden');
       });
       document.getElementById('news-close').addEventListener('click', () => newsModal.classList.add('hidden'));
       newsModal.addEventListener('mousedown', (e) => { if (e.target === newsModal) newsModal.classList.add('hidden'); });


       // --- NEWS TICKER ---
       const tickerEl = document.getElementById('ticker');
       const tickerText = document.getElementById('ticker-text');
       const HEADLINES = [
           'Local kid clicks the letter E 10,000 times, calls it "a normal Tuesday".',
           'Scientists confirm E is still the most common letter. Brown E\'s "working on it".',
           'Alphabet union files a complaint: "Why does E get all the clicks?"',
           'Breaking: the letter F is reportedly "fine with it".',
           'Weather forecast: cloudy with a chance of Brown E\'s.',
           '9 out of 10 dentists prefer Brown E\'s. The tenth was busy clicking.',
           'Computer mouse sales hit a record high in your area.',
           'Experts warn: clicking the E may cause extreme happiness.',
           'Local cat walks across keyboard, earns 3 Brown E\'s, demands a raise.',
           'Teacher finds 400 E\'s doodled on a math test. Student gets an A for effort.',
           'The vowels A, I, O and U hold an emergency meeting about E\'s popularity.',
           'New study: Brown E\'s are 100% fat-free and 0% edible.',
           'Historians discover the first Brown E was clicked in 1066. It was very slow.',
           'Someone typed "eeeeeeeeeee" and a Golden E appeared. Coincidence?',
           'Grandma says she clicked E\'s uphill both ways.',
           'Spelling bee champion disqualified for answering every word with "E".',
           'Click responsibly. Stretch your fingers. Drink some water.',
           'Rumors of a Purple E are "completely false", says Brown E spokesperson.',
           'Pigeons spotted carrying tiny Brown E\'s across town.',
           'Library replaces every book with one long E. Readers say "it gets good in the middle".',
           'Chef unveils E-shaped pancakes. The line goes around the block.',
           'Man asks "why E?" Is immediately handed 50 E\'s. Stops asking.',
           'Brown E\'s now available in "extra brown".',
           'Fact: if you stacked all your Brown E\'s, they would be very tall.',
           'Missing E found in the dictionary between D and F.',
           'Dog eats homework. Dog now produces 1 E per second.',
           'Study shows the letter E is 37% more clickable than the letter Q.',
           'Lowercase e demands equal rights. Talks are ongoing.',
           'Museum unveils "Mona E-sa". Critics call it "brown and mysterious".',
           'Kid tells parents the E game is "basically homework". Parents unconvinced.'
       ];
       const BUILDING_HEADLINES = {
           pointer: 'Pointer Fingers form a union, demand tiny gloves.',
           crayon: 'Walls across town covered in brown crayon E\'s. Parents "not amused".',
           farm: 'E-Farm reports a bumper crop. Scarecrows now click in their spare time.',
           factory: 'E-Factory workers go on break. E\'s keep coming out anyway.',
           bakery: 'E-Bakery croissants now 30% more E-shaped.',
           router: 'E-nternet speeds hit 1 E per millisecond. Gamers rejoice.',
           bank: 'E-Bank launches savings accounts with interest paid in E\'s.',
           temple: 'Monks at the Temple of E chant "eeeeee" for nine hours straight.',
           school: 'E-cademy adds a new class: Advanced Clicking 101.',
           corp: 'Mega E-Corp CEO: "Our quarterly earnings are... E."',
           stadium: 'E-Stadium crowd does the wave. The wave is shaped like an E.',
           planet: 'Planet E\'s moon renamed "Little e".',
           rocket: 'E-Rocket launch delayed: astronaut forgot to click.',
           galaxy: 'Astronomers discover a galaxy shaped like... you guessed it.',
           blackhole: 'E-Black Hole gets hungry, eats a slightly smaller black hole.',
           timemachine: 'Time traveller from next Tuesday says: "buy more E\'s".',
           clonelab: 'E-Clone Lab clones a clone of a clone. Nobody knows which one is real.',
           dyson: 'E-Dyson Sphere blocks the sun. Summer cancelled, replaced with E.',
           multiverse: 'Universe found where everything is a Purple E. Scientists close the portal immediately.',
           simulation: 'The E-Simulation crashes. Someone turns it off and on again.',
           quantum: 'Quantum E observed being clicked and not clicked at the same time.',
           bigbang: 'New universe created. Its first word: "E".',
           omniverse: 'E-Omniverse census: 100% of residents are Brown E\'s.',
           author: 'The Author of E writes a headline about the Author of E writing a headline.'
       };
       let lastHeadline = '';
       function headlinePool() {
           const pool = HEADLINES.slice();
           for (const id in BUILDING_HEADLINES) if (BUILDING[id] && BUILDING[id].owned > 0) pool.push(BUILDING_HEADLINES[id], BUILDING_HEADLINES[id]);
           if (state.bps < 10) pool.push('Small E business opens. Owner: "We all start somewhere."');
           if (state.bps > 1e9) pool.push('Economists can\'t count your E\'s per second fast enough. Now using their toes.');
           if (state.life.golden > 0) pool.push('Golden E sightings reported nearby. Citizens advised to click.');
           if (state.life.clicks > 10000) pool.push('Doctors warn of "Clicker\'s Wrist". You laugh and keep clicking.');
           if (state.wins > 0) pool.push('Legends speak of the one who bought The Final E.', 'Champion of the Final E spotted buying a regular E. "So humble," say fans.');
           if (typeof extraHeadlines === 'function') extraHeadlines(pool);
           return pool;
       }
       function nextHeadline() {
           const pool = headlinePool();
           let h = pool[Math.floor(Math.random() * pool.length)];
           if (h === lastHeadline && pool.length > 1) h = pool[(pool.indexOf(h) + 1) % pool.length];
           lastHeadline = h;
           tickerText.textContent = h;
           tickerTimer = 0;
           if (settings.reduced || !settings.ticker || tickerEl.offsetWidth === 0) return;
           // Scroll speed stays the same for long and short headlines
           const dist = tickerText.parentNode.offsetWidth + tickerText.scrollWidth;
           tickerText.style.animationDuration = `${Math.max(6, dist / 75).toFixed(1)}s`;
           tickerText.style.animationName = tickerText.style.animationName === 'tickerScroll' ? 'tickerScroll2' : 'tickerScroll';
       }
       let tickerTimer = 0;
       tickerText.addEventListener('animationend', nextHeadline);
       // Reduced effects / hidden screens: swap headlines on a timer instead
       function tickerSecond() {
           if (!settings.ticker) return;
           tickerTimer++;
           if (tickerText.textContent === '' || ((settings.reduced || tickerText.style.animationName === '') && tickerTimer >= 12)) nextHeadline();
       }
       tickerEl.addEventListener('mousedown', () => { unlockAchievement('mnews'); nextHeadline(); });


       // --- SIDE TOOLBAR ---
       const TOOLBAR_TIPS = {
           settings: ['⚙️ Settings', 'Number format, reduced effects, news ticker, events and save codes.']
       };
       const TOOLBAR_ACTIONS = { settings: openSettings };
       document.getElementById('toolbar').addEventListener('click', (e) => {
           const b = e.target.closest('[data-tb]');
           if (b && TOOLBAR_ACTIONS[b.dataset.tb]) TOOLBAR_ACTIONS[b.dataset.tb]();
       });
       document.getElementById('toolbar').addEventListener('mouseover', (e) => {
           const b = e.target.closest('[data-tb]');
           if (!b || b === tooltipAnchor) return;
           const tip = TOOLBAR_TIPS[b.dataset.tb];
           if (!tip) return;
           const t = typeof tip === 'function' ? tip() : tip;
           tooltipEl.innerHTML = `<div class="font-black text-white">${t[0]}</div><div class="text-sm text-stone-300 mt-1">${t[1]}</div>`;
           tooltipAnchor = b;
           placeTooltip(b);
       });
       document.getElementById('toolbar').addEventListener('mouseleave', hideTooltip);


       // --- ASCENSION + PRESTIGE TREE SCREEN ---
       const treeModal = document.getElementById('tree-modal');
       const treeBoard = document.getElementById('tree-board');
       const treeSide = document.getElementById('tree-side');
       const ascendModal = document.getElementById('ascend-modal');
       const TREE_CELL = 74, TREE_NODE = 52;
       const BRANCH_NAMES = { root: 'Heaven', prod: 'Production', click: 'Clicking', eco: 'Economy', gold: 'Golden E', chip: 'Heavenly Chips', idle: 'Away earnings', garden: 'E Garden', market: 'E-Goods Market', trial: 'Challenges' };
       let treeBuilt = false;
       let nextRun = ''; // challenge picked for the next run ('' = normal run)
       let treeSideKey = '';

       function pendingChips() { return chipsForRun(state.run.earned); }
       function canAscend() { return !state.meta.heaven && !state.pendingWin && pendingChips() >= 1; }
       // E's needed this run for one more chip than you'd get now
       function nextChipAt() {
           const n = pendingChips() + 1;
           return CHIP_BASE * Math.pow(n / PRES.chipX, 3);
       }

       function buildTree() {
           const W = 11 * TREE_CELL, H = 9 * TREE_CELL;
           treeBoard.style.width = `${W}px`;
           treeBoard.style.height = `${H + 16}px`;
           const lines = TREE.filter(n => n.p).map(n => {
               const a = TREE_BY_ID[n.p];
               const cx = (x) => x * TREE_CELL + TREE_CELL / 2;
               return `<line data-to="${n.id}" x1="${cx(a.x)}" y1="${cx(a.y)}" x2="${cx(n.x)}" y2="${cx(n.y)}" stroke-width="4" stroke-linecap="round"></line>`;
           }).join('');
           treeBoard.innerHTML = `<svg width="${W}" height="${H}" class="absolute inset-0 pointer-events-none" style="z-index:1">${lines}</svg>` +
               TREE.map(n => `<button class="tree-node" data-node="${n.id}" style="left:${n.x * TREE_CELL + (TREE_CELL - TREE_NODE) / 2}px;top:${n.y * TREE_CELL + (TREE_CELL - TREE_NODE) / 2 - 6}px;--c:${TREE_COLORS[n.br]}"><span class="pointer-events-none">${n.icon}</span><span class="tree-cost pointer-events-none"></span></button>`).join('');
           TREE.forEach(n => {
               n.el = treeBoard.querySelector(`[data-node="${n.id}"]`);
               n.costEl = n.el.querySelector('.tree-cost');
               n.lineEl = treeBoard.querySelector(`line[data-to="${n.id}"]`);
           });
           treeBuilt = true;
       }

       function refreshTreeUI() {
           if (!treeBuilt || treeModal.classList.contains('hidden')) return;
           const m = state.meta;
           const heaven = m.heaven;
           setText(document.getElementById('tree-chips'), formatNumber(m.chips));
           setText(document.getElementById('tree-total'), `${formatNumber(m.chipsTotal)} earned in total = +${formatNumber(m.chipsTotal)}% production · ${treeOwned()}/${TREE.length} upgrades`);
           setText(document.getElementById('tree-title'), heaven ? '👼 You ascended!' : '👼 Prestige Tree');
           const ascBtn = document.getElementById('tree-ascend');
           ascBtn.classList.toggle('hidden', heaven);
           setDisabled(ascBtn, !canAscend());
           setText(ascBtn, canAscend() ? `✨ Ascend (+${formatNumber(pendingChips())})` : '✨ Ascend');
           document.getElementById('tree-close').classList.toggle('hidden', heaven);
           for (let i = 0; i < TREE.length; i++) {
               const n = TREE[i];
               const st = m.tree[n.id] ? 'own' : treeAvailable(n) ? 'avail' : 'locked';
               const af = m.chips >= n.cost ? '1' : '0';
               if (n.el._st !== st) {
                   n.el._st = st;
                   n.el.dataset.st = st;
                   if (n.lineEl) n.lineEl.setAttribute('stroke', st === 'own' ? TREE_COLORS[n.br] : st === 'avail' ? '#78716c' : '#3f3a36');
               }
               if (n.el._af !== af) { n.el._af = af; n.el.dataset.afford = af; }
               setText(n.costEl, st === 'own' ? '✓' : formatShort(n.cost));
           }
           renderTreeSide();
       }

       // Right-hand panel: ascension info during a run, next-run picker while in heaven
       function renderTreeSide() {
           const m = state.meta;
           const c = activeChallenge();
           const key = [m.heaven, nextRun, PRES.trial, challengesDone(), canAscend(), pendingChips(), c ? c.id : '', Math.floor(state.run.earned / CHIP_BASE * 100), settings.numFormat].join('|');
           if (key === treeSideKey) return;
           treeSideKey = key;
           let html = '';
           if (m.heaven) {
               html += `<div class="text-purple-200 font-black text-lg mb-1">Choose your next run</div><div class="text-xs text-stone-400 mb-2">Spend your chips on the tree, then begin. Upgrades you buy apply right away.</div>`;
               html += `<button class="run-opt mb-1" data-run="" data-on="${nextRun === '' ? 1 : 0}"><span class="text-xl">▶️</span><span><b class="text-white">Normal run</b><br><span class="text-xs text-stone-400">Starting bonuses from the tree apply.</span></span></button>`;
               if (PRES.trial) {
                   html += `<div class="text-xs font-black uppercase tracking-widest text-red-300 mt-3 mb-1">⚔️ Challenge runs (${challengesDone()}/${CHALLENGES.length})</div>`;
                   CHALLENGES.forEach(ch => {
                       const done = !!m.challengesDone[ch.id];
                       html += `<button class="run-opt mb-1" data-run="${ch.id}" data-on="${nextRun === ch.id ? 1 : 0}"><span class="text-xl">${ch.icon}</span><span class="min-w-0"><b class="text-white">${ch.name}</b> ${done ? '<span class="text-green-400 text-xs font-black">✓ DONE</span>' : ''}<br><span class="text-xs text-stone-400">Goal: earn ${formatShort(ch.goal)}${ch.limit ? ' in 10 min' : ''}</span></span></button>`;
                   });
                   if (nextRun) {
                       const ch = CHALLENGE_BY_ID[nextRun];
                       html += `<div class="mt-2 p-2 rounded-xl border border-red-800 bg-red-950/40 text-xs"><div class="font-black text-red-200 text-sm">${ch.icon} ${ch.name}</div><div class="text-stone-300 mt-1"><b>Rule:</b> ${ch.rule}</div><div class="text-stone-300 mt-1"><b>Goal:</b> earn ${formatNumber(ch.goal)} Brown E's${ch.limit ? ' within 10 minutes' : ''}.</div><div class="text-green-300 mt-1"><b>Reward:</b> ${ch.reward}${m.challengesDone[ch.id] ? ' (already yours)' : ''}</div><div class="text-stone-500 mt-1">Starting bonuses are off in challenge runs.</div></div>`;
                   }
               } else {
                   html += `<div class="mt-3 text-xs text-stone-400 p-2 rounded-xl border border-stone-700">⚔️ Buy <b class="text-red-300">Trial Gate</b> in the tree to unlock Challenge Runs.</div>`;
               }
               html += `<button id="begin-run" class="w-full mt-3 py-3 rounded-xl bg-gradient-to-r from-[#5C4033] to-[#8B4513] hover:from-[#4A332A] hover:to-[#5C4033] text-white font-black text-lg border-2 border-[#D97706]">Begin ${nextRun ? 'challenge' : 'run'} ▶</button>`;
           } else {
               const gain = pendingChips();
               html += `<div class="text-purple-200 font-black text-lg mb-1">Ascension</div>`;
               if (gain >= 1) {
                   html += `<div class="text-stone-300">Ascending now gives <b class="text-purple-300">+${formatNumber(gain)} Heavenly Chips</b> (+${formatNumber(gain)}% production forever).</div><div class="text-xs text-stone-500 mt-1">Next chip at ${formatShort(nextChipAt())} E's earned this run.</div>`;
               } else {
                   const pct = Math.min(100, state.run.earned / CHIP_BASE * 100);
                   html += `<div class="text-stone-300">Earn <b class="text-white">${formatNumber(CHIP_BASE)}</b> Brown E's in one run to unlock ascension.</div><div class="h-2 bg-stone-800 rounded mt-2 overflow-hidden"><div class="h-2 bg-purple-500" style="width:${pct.toFixed(1)}%"></div></div><div class="text-xs text-stone-500 mt-1">${pct.toFixed(1)}% there this run</div>`;
               }
               html += `<div class="text-xs text-stone-400 mt-2">A run is worth more chips the further you get: the cube root of what you earned, in Qa. Buying The Final E ascends you too.</div>`;
               if (c) html += `<div class="mt-3 p-2 rounded-xl border border-red-800 bg-red-950/40 text-xs"><div class="font-black text-red-200 text-sm">${c.icon} Challenge: ${c.name}</div><div class="text-stone-300 mt-1">${c.rule}</div><div class="text-green-300 mt-1">Reward: ${c.reward}</div></div>`;
               if (PRES.trial) {
                   html += `<div class="text-xs font-black uppercase tracking-widest text-red-300 mt-3 mb-1">⚔️ Challenge rewards (${challengesDone()}/${CHALLENGES.length})</div>`;
                   CHALLENGES.forEach(ch => {
                       const done = !!m.challengesDone[ch.id];
                       html += `<div class="flex gap-2 items-start py-1 border-b border-stone-800 ${done ? '' : 'opacity-60'}"><span class="text-lg leading-none">${ch.icon}</span><span class="text-xs"><b class="text-white">${ch.name}</b> ${done ? '<span class="text-green-400 font-black">✓</span>' : ''}<br><span class="text-stone-400">${ch.reward}</span></span></div>`;
                   });
                   html += `<div class="text-xs text-stone-500 mt-1">Pick a challenge after you ascend.</div>`;
               } else {
                   html += `<div class="mt-3 text-xs text-stone-400 p-2 rounded-xl border border-stone-700">⚔️ Buy <b class="text-red-300">Trial Gate</b> to unlock Challenge Runs.</div>`;
               }
           }
           treeSide.innerHTML = html;
       }
       treeSide.addEventListener('click', (e) => {
           const opt = e.target.closest('[data-run]');
           if (opt) { nextRun = opt.dataset.run; renderTreeSide(); return; }
           if (e.target.closest('#begin-run')) beginRun(nextRun);
       });

       function openTree() {
           hideTooltip();
           if (!treeBuilt) buildTree();
           treeSideKey = '';
           treeModal.classList.remove('hidden');
           refreshTreeUI();
       }
       function closeTree() {
           if (state.meta.heaven) return; // pick your next run first
           treeModal.classList.add('hidden');
           hideTooltip();
       }
       document.getElementById('tree-close').addEventListener('click', closeTree);

       function showTreeTooltip(el) {
           const n = TREE_BY_ID[el.dataset.node];
           if (!n) return;
           const m = state.meta;
           const st = m.tree[n.id] ? 'own' : treeAvailable(n) ? 'avail' : 'locked';
           const status = st === 'own' ? '<span class="text-green-400 font-black">Owned</span>'
               : st === 'locked' ? `<span class="text-stone-400">Needs <b>${TREE_BY_ID[n.p].name}</b> first</span>`
               : m.chips >= n.cost ? '<span class="text-purple-300 font-black">Click to buy!</span>' : `<span class="text-red-300">Need ${formatNumber(n.cost - m.chips)} more chips</span>`;
           tooltipEl.innerHTML = `<div class="flex items-center gap-2"><div class="text-3xl leading-none">${n.icon}</div><div><div class="font-black text-white leading-tight">${n.name}</div><div class="text-[0.7rem] uppercase tracking-wider font-bold" style="color:${TREE_COLORS[n.br]}">${BRANCH_NAMES[n.br]}</div></div></div>
               <div class="text-sm text-green-400 font-bold mt-2">${n.desc}</div>
               <div class="mt-2 text-sm font-bold">Cost: <span class="text-purple-200">${formatNumber(n.cost)} Heavenly Chip${n.cost === 1 ? '' : 's'}</span></div>
               <div class="text-sm mt-1">${status}</div>`;
           tooltipAnchor = el;
           placeTooltip(el);
       }
       treeBoard.addEventListener('mouseover', (e) => {
           const el = e.target.closest('[data-node]');
           if (el && el !== tooltipAnchor) showTreeTooltip(el);
       });
       treeBoard.addEventListener('mouseleave', hideTooltip);
       document.getElementById('tree-scroll').addEventListener('scroll', hideTooltip, { passive: true });
       treeBoard.addEventListener('click', (e) => {
           const el = e.target.closest('[data-node]');
           if (!el) return;
           buyTreeNode(el.dataset.node);
           showTreeTooltip(el);
       });

       function buyTreeNode(id) {
           const n = TREE_BY_ID[id];
           if (!n || !treeAvailable(n) || state.meta.chips < n.cost) return false;
           state.meta.chips -= n.cost;
           state.meta.tree[id] = true;
           afterPrestigeChange();
           checkAchievements();
           refreshTreeUI();
           saveGame(true);
           return true;
       }
       // Re-apply everything that depends on the tree or challenge rewards
       function afterPrestigeChange() {
           recalcPrestige();
           if (typeof recalcGarden === 'function') recalcGarden();
           repriceBuildings();
           recalculateStats();
           refreshCosts();
           refreshRowStats();
           refreshUpgrades(true);
           refreshAchievementUI();
           updateDisplay();
           if (typeof refreshOpenPanels === 'function') refreshOpenPanels();
       }

       // Ascending: bank the chips, reset the run, then pick the next run in heaven
       function openAscendConfirm() {
           if (!canAscend()) return;
           setText(document.getElementById('asc-gain'), formatNumber(pendingChips()));
           ascendModal.classList.remove('hidden');
       }
       document.getElementById('tree-ascend').addEventListener('click', openAscendConfirm);
       document.getElementById('asc-cancel').addEventListener('click', () => ascendModal.classList.add('hidden'));
       document.getElementById('asc-confirm').addEventListener('click', () => {
           ascendModal.classList.add('hidden');
           if (canAscend()) ascend();
       });

       function ascend() {
           const gain = pendingChips();
           const m = state.meta;
           m.chips += gain;
           m.chipsTotal += gain;
           m.ascensions++;
           if (gain > m.bestRunChips) m.bestRunChips = gain;
           const runTime = state.run.time;
           if (!state.life.fastestAscend || runTime < state.life.fastestAscend) state.life.fastestAscend = runTime;
           resetRun(true);
           state.meta.heaven = true;
           nextRun = '';
           checkAchievements();
           saveGame(true);
           openTree();
           showGoldenMessage('ASCENDED!', `+${formatNumber(gain)} Heavenly Chips`);
       }

       // Leave heaven and start the next run (normal or a challenge)
       function beginRun(challengeId) {
           const ch = challengeId && PRES.trial ? CHALLENGE_BY_ID[challengeId] : null;
           state.meta.heaven = false;
           state.meta.challenge = ch ? ch.id : null;
           state.run = freshRun();
           state.brownEs = 0;
           shopItems.forEach(item => { item.owned = 0; });
           // Starting bonuses (off in challenge runs)
           if (!ch) {
               for (const id in PRES.start) if (BUILDING[id]) BUILDING[id].owned = PRES.start[id];
               state.clickMultiLevel = Math.max(state.clickMultiLevel, PRES.genStart);
               state.bpsMultiLevel = Math.max(state.bpsMultiLevel, PRES.genStart);
           }
           repriceBuildings();
           recalculateStats();
           if (!ch && PRES.startE > 0) earn(PRES.startE, 'gift');
           golden.timer = firstGoldenDelay();
           treeModal.classList.add('hidden');
           hideTooltip();
           initShop();
           refreshUpgrades(true);
           refreshChallengeUI();
           checkAchievements();
           updateDisplay();
           saveGame(true);
           if (ch) showGoldenMessage(`${ch.icon} ${ch.name.toUpperCase()}`, `${ch.rule} Goal: ${formatShort(ch.goal)} E's.`);
       }

       // Toolbar button glows with the chips you'd get
       let lastBadge = null;
       function refreshAscendBadge() {
           const gain = canAscend() ? pendingChips() : 0;
           const btn = document.getElementById('tb-tree');
           if (gain !== lastBadge) {
               lastBadge = gain;
               const badge = document.getElementById('tb-tree-badge');
               badge.classList.toggle('hidden', gain < 1);
               setText(badge, gain >= 1 ? `+${formatShort(gain)}` : '');
               btn.dataset.glow = gain >= 1 ? '1' : '0';
           }
           if (!treeModal.classList.contains('hidden')) refreshTreeUI();
       }

