       // --- SKINS ---
       // ach = achievement that unlocks it (null = always yours)
       const SKINS = [
           { id: 'classic', kind: 'e', name: 'Classic Brown', ach: null },
           { id: 'milk', kind: 'e', name: 'Milk Chocolate', ach: 'clk2' },
           { id: 'dark', kind: 'e', name: 'Dark Chocolate', ach: 'earn3' },
           { id: 'pixel', kind: 'e', name: 'Retro Pixel', ach: 'clk4' },
           { id: 'gold', kind: 'e', name: 'Solid Gold', ach: 'gold2' },
           { id: 'neon', kind: 'e', name: 'Neon Glow', ach: 'bps5' },
           { id: 'galaxy', kind: 'e', name: 'Galaxy', ach: 'b_galaxy' },
           { id: 'rainbow', kind: 'e', name: 'Rainbow', ach: 'upg4' },
           { id: 'angel', kind: 'e', name: 'Ascended', ach: 'asc1' },
           { id: 'ruby', kind: 'e', name: 'Challenger', ach: 'chal1' },
           { id: 'leafy', kind: 'e', name: 'Leafy', ach: 'gard2' },
           { id: 'money', kind: 'e', name: 'Market Mogul', ach: 'mkt2' },
           { id: 'diamond', kind: 'e', name: 'Diamond', ach: 'win3' },
           { id: 'pumpkin', kind: 'e', name: 'Jack-o\'-E', ach: 'ev_halloween' },
           { id: 'frost', kind: 'e', name: 'Frosty', ach: 'ev_winter' },
           { id: 'candy', kind: 'e', name: 'Candy Heart', ach: 'ev_valentine' },
           { id: 'plain', kind: 'bg', name: 'Stone', ach: null },
           { id: 'kitchen', kind: 'bg', name: 'Cozy Kitchen', ach: 'earn2' },
           { id: 'farm', kind: 'bg', name: 'Cocoa Fields', ach: 'b_farm' },
           { id: 'night', kind: 'bg', name: 'Night Sky', ach: 'mback' },
           { id: 'space', kind: 'bg', name: 'Deep Space', ach: 'b_rocket' },
           { id: 'vault', kind: 'bg', name: 'Gold Vault', ach: 'gjack' },
           { id: 'matrix', kind: 'bg', name: 'The Simulation', ach: 'b_simulation' },
           { id: 'heaven', kind: 'bg', name: 'Heaven', ach: 'asc1' },
           { id: 'garden', kind: 'bg', name: 'Garden', ach: 'gard1' },
           { id: 'spooky', kind: 'bg', name: 'Spooky Night', ach: 'ev_halloween' },
           { id: 'snow', kind: 'bg', name: 'Snowfall', ach: 'ev_winter' },
           { id: 'beach', kind: 'bg', name: 'Beach Day', ach: 'ev_summer' }
       ];
       const SKIN_BY_ID = {};
       SKINS.forEach(sk => { SKIN_BY_ID[sk.kind + ':' + sk.id] = sk; });
       const skinsModal = document.getElementById('skins-modal');
       const bigEText = document.getElementById('big-e');
       function skinUnlocked(sk) { return !sk.ach || !!state.achievements[sk.ach]; }
       function applySkin() {
           const m = state.meta;
           let e = SKIN_BY_ID['e:' + m.skin], bg = SKIN_BY_ID['bg:' + m.bg];
           if (!e || !skinUnlocked(e)) { e = SKIN_BY_ID['e:classic']; m.skin = 'classic'; }
           if (!bg || !skinUnlocked(bg)) { bg = SKIN_BY_ID['bg:plain']; m.bg = 'plain'; }
           const eCls = `e-skin-${e.id} text-9xl md:text-[15rem] font-black relative z-10`;
           if (bigEText.className !== eCls) bigEText.className = eCls;
           SKINS.forEach(sk => { if (sk.kind === 'bg') clickArea.classList.toggle(`cbg-${sk.id}`, sk.id === bg.id); });
       }
       function renderSkins() {
           const tile = (sk) => {
               const open = skinUnlocked(sk);
               const on = (sk.kind === 'e' ? state.meta.skin : state.meta.bg) === sk.id;
               const a = sk.ach ? ACH_BY_ID[sk.ach] : null;
               const preview = sk.kind === 'e'
                   ? `<div class="h-14 flex items-center justify-center"><span class="e-skin-${sk.id} text-5xl font-black" style="line-height:1">E</span></div>`
                   : `<div class="h-14 rounded-lg cbg-${sk.id} border border-stone-700"></div>`;
               return `<button class="skin-tile" data-skin="${sk.kind}:${sk.id}" data-on="${on ? 1 : 0}" data-locked="${open ? 0 : 1}">${preview}<div class="text-xs font-black text-white mt-1 leading-tight">${open ? '' : '🔒 '}${sk.name}</div><div class="text-[0.65rem] text-stone-400 leading-tight">${open ? (on ? 'Wearing' : 'Click to wear') : a ? `${a.name}: ${a.desc}` : ''}</div></button>`;
           };
           const es = SKINS.filter(sk => sk.kind === 'e'), bgs = SKINS.filter(sk => sk.kind === 'bg');
           document.getElementById('skins-e').innerHTML = es.map(tile).join('');
           document.getElementById('skins-bg').innerHTML = bgs.map(tile).join('');
           setText(document.getElementById('skins-e-count'), `(${es.filter(skinUnlocked).length}/${es.length} unlocked)`);
           setText(document.getElementById('skins-bg-count'), `(${bgs.filter(skinUnlocked).length}/${bgs.length} unlocked)`);
       }
       skinsModal.addEventListener('click', (e) => {
           const t = e.target.closest('[data-skin]');
           if (!t) return;
           const sk = SKIN_BY_ID[t.dataset.skin];
           if (!sk || !skinUnlocked(sk)) return;
           if (sk.kind === 'e') state.meta.skin = sk.id; else state.meta.bg = sk.id;
           if (sk.id !== 'classic' && sk.id !== 'plain') unlockAchievement('mskin');
           applySkin();
           renderSkins();
           saveGame(true);
       });
       function openSkins() {
           hideTooltip();
           renderSkins();
           skinsModal.classList.remove('hidden');
       }
       document.getElementById('skins-close').addEventListener('click', () => skinsModal.classList.add('hidden'));
       skinsModal.addEventListener('mousedown', (e) => { if (e.target === skinsModal) skinsModal.classList.add('hidden'); });
       TOOLBAR_ACTIONS.skins = openSkins;
       TOOLBAR_TIPS.skins = () => {
           const n = SKINS.filter(skinUnlocked).length;
           return ['🎨 Skins', `New looks for the E and the background, unlocked by achievements. ${n}/${SKINS.length} unlocked.`];
       };


       // --- GOLDEN E ---
       const golden = { timer: 0, life: 0, shownAt: 0 };
       function firstGoldenDelay() { return 25 + Math.random() * 20; }
       function nextGoldenDelay() {
           const g = goldenSettings();
           return g.minGap + Math.random() * (g.maxGap - g.minGap);
       }
       golden.timer = firstGoldenDelay();

       function spawnGolden() {
           const w = clickArea.clientWidth, h = clickArea.clientHeight;
           if (!w || !h) return false;
           const size = 88;
           // Anywhere in the clicking area, below the score box
           const x = 10 + Math.random() * Math.max(0, w - size - 20);
           const y = h * 0.3 + Math.random() * Math.max(0, h * 0.62 - size);
           goldenEl.style.left = `${x}px`;
           goldenEl.style.top = `${y}px`;
           goldenEl.classList.remove('hidden', 'fading');
           golden.life = goldenSettings().life;
           golden.shownAt = performance.now();
           return true;
       }

       function hideGolden() {
           golden.life = 0;
           goldenEl.classList.add('hidden');
       }

       function goldenTick(dt) {
           if (golden.life > 0) {
               golden.life -= dt;
               if (golden.life <= 2) goldenEl.classList.add('fading');
               if (golden.life <= 0) {
                   hideGolden();
                   state.life.goldenMissed++;
                   unlockAchievement('gmiss');
                   golden.timer = nextGoldenDelay();
               }
               return;
           }
           // Only count down while you can actually see it (and never in the Fool's Gold challenge)
           if (document.hidden || gameScreen.classList.contains('hidden') || state.meta.heaven || challengeIs('nogold')) return;
           golden.timer -= dt;
           if (golden.timer <= 0) {
               if (!spawnGolden()) golden.timer = 5;
           }
       }

       function pickGoldenEffect() {
           // Seasonal events add their own effect (Festive Spirit makes it twice as likely)
           if (typeof eventGoldenChance === 'function' && Math.random() < eventGoldenChance()) return 'event';
           if (PRES.elder && Math.random() < 0.08) return 'elder';
           const r = Math.random();
           let type = r < 0.42 ? 'frenzy' : r < 0.77 ? 'lucky' : r < 0.88 ? 'click' : 'rush';
           if (type === 'rush' && !shopItems.some(i => i.type === 'bps' && i.owned > 0)) type = 'lucky';
           return type;
       }

       function clickGolden(event, forcedType) {
           if (golden.life <= 0) return;
           if (performance.now() - golden.shownAt <= 1000) unlockAchievement('gquick');
           hideGolden();
           golden.timer = nextGoldenDelay();
           // Golden Twins: sometimes another one shows up right away
           if (PRES.twins > 0 && Math.random() < PRES.twins) golden.timer = 3;
           const first = forcedType || pickGoldenEffect();
           const msgs = [goldenEffect(first, event)];
           // Double Gold: a second, different effect
           if (PRES.doubleGold > 0 && Math.random() < PRES.doubleGold) {
               let second = pickGoldenEffect();
               if (second === first) second = first === 'lucky' ? 'frenzy' : 'lucky';
               msgs.push(goldenEffect(second, event));
               state.life.doubleGold++;
           }
           state.run.golden++;
           state.life.golden++;
           if (hasBuff('frenzy') && hasBuff('click')) unlockAchievement('gcombo');
           showGoldenMessage(msgs.map(m => m.title).join(' + '), msgs.map(m => m.sub).join(' · '));
           checkAchievements();
           updateDisplay();
       }
       // One golden E effect; returns the message to show
       function goldenEffect(type, event) {
           const g = goldenSettings();
           // A rush needs at least one producing building
           if (type === 'rush' && !shopItems.some(i => i.type === 'bps' && i.owned > 0)) type = 'lucky';
           if (type === 'event' && typeof eventGoldenEffect === 'function') {
               const m = eventGoldenEffect(event, g);
               if (m) return m;
               type = 'frenzy';
           }
           let title = '', sub = '';
           if (type === 'elder') {
               const dur = Math.round(6 * g.dur);
               addBuff('elder', '🌋', 'Elder Frenzy', 111, dur);
               state.life.elder++;
               title = 'ELDER FRENZY!';
               sub = `E's per second x111 for ${dur} seconds`;
           } else if (type === 'frenzy') {
               const dur = Math.round(66 * g.dur);
               addBuff('frenzy', '🔥', 'Frenzy', 7, dur);
               state.life.frenzy++;
               title = 'FRENZY!';
               sub = `E's per second x7 for ${dur} seconds`;
           } else if (type === 'click') {
               const dur = Math.round(13 * g.dur);
               addBuff('click', '👆', 'Click Frenzy', 777, dur);
               state.life.clickFrenzy++;
               title = 'CLICK FRENZY!';
               sub = `Click power x777 for ${dur} seconds - click fast!`;
           } else if (type === 'rush') {
               const owned = shopItems.filter(i => i.type === 'bps' && i.owned > 0);
               const item = owned[Math.floor(Math.random() * owned.length)];
               const mult = 1 + item.owned * 0.1;
               const dur = Math.round(30 * g.dur);
               addBuff('rush', item.icon, `${item.name} Rush`, mult, dur, item.id);
               state.life.rush++;
               title = `${item.name.toUpperCase()} RUSH!`;
               sub = `E's per second x${mult.toFixed(1)} for ${dur} seconds (+10% per ${item.name})`;
           } else {
               const amount = luckyAmount();
               earn(amount, 'golden');
               state.life.lucky++;
               if (amount > state.life.biggestLucky) state.life.biggestLucky = amount;
               title = 'LUCKY!';
               sub = `+${formatNumber(amount)} Brown E's`;
               createFloatingText(event, `+${formatShort(amount)}`);
           }
           return { title, sub };
       }

       function showGoldenMessage(title, sub) {
           setText(document.getElementById('golden-msg-title'), title);
           setText(document.getElementById('golden-msg-sub'), sub);
           goldenMsgEl.style.animationName = goldenMsgEl.style.animationName === 'goldenMsg' ? 'goldenMsg2' : 'goldenMsg';
       }

       goldenEl.addEventListener('mousedown', (e) => {
           e.preventDefault();
           e.stopPropagation();
           clickGolden(e);
       });
       goldenEl.addEventListener('touchstart', (e) => {
           e.preventDefault();
           e.stopPropagation();
           clickGolden(e.touches[0]);
       });


       // --- BUFFS (Golden E effects with timers) ---
       function hasBuff(type) {
           for (let i = 0; i < state.buffs.length; i++) if (state.buffs[i].type === type) return true;
           return false;
       }

       function addBuff(type, icon, name, mult, time, building) {
           // Same effect again just restarts its timer
           state.buffs = state.buffs.filter(b => b.type !== type);
           state.buffs.push({ type, icon, name, mult, time, max: time, building: building || null });
           recalculateStats();
           refreshRowStats();
           renderBuffBar();
       }

       function buffTick(dt) {
           let expired = false;
           for (let i = 0; i < state.buffs.length; i++) {
               const b = state.buffs[i];
               b.time -= dt;
               if (b.time <= 0) expired = true;
           }
           if (expired) {
               state.buffs = state.buffs.filter(b => b.time > 0);
               recalculateStats();
               refreshRowStats();
               renderBuffBar();
           }
           // Update the timers in place
           for (let i = 0; i < state.buffs.length; i++) {
               const b = state.buffs[i];
               if (!b.el) continue;
               setText(b.timeEl, `${Math.ceil(b.time)}s`);
               const pct = Math.max(0, Math.min(100, b.time / b.max * 100)).toFixed(1) + '%';
               if (b.barEl._w !== pct) {
                   b.barEl._w = pct;
                   b.barEl.style.width = pct;
               }
           }
       }

       function renderBuffBar() {
           buffBar.innerHTML = '';
           state.buffs.forEach(b => {
               const isClick = !!CLICK_BUFFS[b.type];
               const el = document.createElement('div');
               el.className = `rounded-lg bg-stone-800/95 border ${isClick ? 'border-orange-400 text-orange-300' : 'border-yellow-500 text-yellow-300'} px-2 py-1 text-xs font-bold min-w-[150px] shadow-lg`;
               el.dataset.buff = b.type;
               el.innerHTML = `<div class="flex items-center justify-between gap-2"><span class="truncate">${b.icon} ${b.name} x${formatShort(b.mult)}</span><span class="text-white tabular-nums" data-t>${Math.ceil(b.time)}s</span></div><div class="h-1 bg-stone-700 rounded mt-1 overflow-hidden"><div data-bar class="h-1 ${isClick ? 'bg-orange-400' : 'bg-yellow-400'} rounded" style="width:100%"></div></div>`;
               buffBar.appendChild(el);
               b.el = el;
               b.timeEl = el.querySelector('[data-t]');
               b.barEl = el.querySelector('[data-bar]');
           });
       }


       // --- WIN LOGIC ---
       function triggerWin() {
           state.wins += 1;
           state.pendingWin = true;
           const runTime = state.run.time;
           if (!state.life.fastestWin || runTime < state.life.fastestWin) state.life.fastestWin = runTime;
           if (runTime < 1800) unlockAchievement('wfast');
           if (state.run.clicks <= 100) unlockAchievement('whands');
           checkAchievements();
           recalculateStats();
           saveGame(); // Save the win immediately
           showWinModal();
       }

       function showWinModal() {
           setText(document.getElementById('win-run-time'), `This run took ${formatTime(state.run.time)}. Next run: x${winBoost(state.wins)} production from wins.`);
           setText(document.getElementById('win-chips'), `+${formatNumber(pendingChips())} Heavenly Chips`);
           winModal.classList.remove('hidden');
       }


       document.getElementById('play-again-btn').addEventListener('click', () => {
           // Keep wins (and everything permanent), bank the chips, then pick the next run
           winModal.classList.add('hidden');
           state.pendingWin = false;
           ascend();
       });


