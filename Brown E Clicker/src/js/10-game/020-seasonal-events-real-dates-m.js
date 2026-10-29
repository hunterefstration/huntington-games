       // --- SEASONAL EVENTS --- (real dates, month/day, inclusive; winter wraps past New Year)
       const EVENTS = [
           { id: 'winter', name: 'Winter Wonderland', icon: '❄️', golden: '🎁', from: [12, 1], to: [1, 6], effect: 'Gift Box: free copies of one of your buildings.' },
           { id: 'valentine', name: 'Sweet E-Day', icon: '💝', golden: '💝', from: [2, 7], to: [2, 21], effect: 'Sweetheart: E/s and click power x3 for 60 seconds.' },
           { id: 'spring', name: 'the Egg Hunt', icon: '🥚', golden: '🥚', from: [3, 20], to: [4, 20], effect: 'Golden Egg: +2% E/s for the rest of the run (up to 10 eggs).' },
           { id: 'eday', name: 'E Day', icon: '🎂', golden: '🎂', from: [5, 1], to: [5, 7], effect: 'Party Time: a Frenzy and a Click Frenzy at once.' },
           { id: 'summer', name: 'Summer Splash', icon: '☀️', golden: '🏖️', from: [6, 15], to: [8, 31], effect: 'Heat Wave: E/s x5 for 77 seconds.' },
           { id: 'school', name: 'Back to E-School', icon: '📚', golden: '📚', from: [9, 1], to: [9, 21], effect: 'Extra Credit: a double Lucky, and the next Golden E arrives in 10 seconds.' },
           { id: 'halloween', name: 'Spooky Season', icon: '🎃', golden: '🎃', from: [10, 1], to: [11, 2], effect: 'Trick or Treat: a triple Lucky, or a Spooky Frenzy (E/s x13 for 30 seconds).' },
           { id: 'harvest', name: 'the Pie Festival', icon: '🥧', golden: '🥧', from: [11, 15], to: [11, 30], effect: 'Pie Rush: E/s x3 for 2 minutes.' }
       ];
       const EVENT_NAMES = {};
       EVENTS.forEach(e => { EVENT_NAMES[e.id] = e.name.replace(/^the /, 'the '); });
       function eventForDate(d) {
           const md = (d.getMonth() + 1) * 100 + d.getDate();
           for (let i = 0; i < EVENTS.length; i++) {
               const e = EVENTS[i];
               const a = e.from[0] * 100 + e.from[1], b = e.to[0] * 100 + e.to[1];
               if (a <= b ? md >= a && md <= b : md >= a || md <= b) return e;
           }
           return null;
       }

       // --- ACHIEVEMENT DATA ---
       // Each achievement gives +1% production forever (they survive winning, but not a save wipe).
       // check: () => bool, or null for achievements unlocked by an event.
       const ACHIEVEMENTS = [];
       function addAch(id, name, desc, icon, check) { ACHIEVEMENTS.push({ id, name, desc, icon, check }); }

       [[1, 'First Poke'], [100, 'Clicky'], [1000, 'Finger Workout'], [5000, 'Clickaholic'], [10000, 'Carpal Tunnel Speedrun'], [25000, 'The E Whisperer'], [50000, 'Ten-Finger Legend']]
           .forEach(([n, name], i) => addAch(`clk${i + 1}`, name, `Click the big E ${formatNumber(n)} time${n === 1 ? '' : 's'}.`, '👆', () => state.life.clicks >= n));
       [[1000, 'Hand Crafted'], [100000, 'Artisanal E\'s'], [10000000, 'Elbow Grease'], [1000000000, 'Mighty Mitts'], [1000000000000, 'Fists of Fury'], [1e15, 'The Hand of E']]
           .forEach(([n, name], i) => addAch(`hand${i + 1}`, name, `Make ${formatShort(n)} Brown E's by clicking.`, '✋', () => state.life.handmade >= n));
       [[100, 'Brown Beginnings'], [10000, 'Pocket Change'], [1000000, 'E-llionaire'], [100000000, 'Hundred Millionaire'], [10000000000, 'Billion Brown'], [1000000000000, 'Trillion Tycoon'],
        [1e15, 'Quadrillion Quest'], [1e18, 'Quintillion Crown'], [1e21, 'Sextillion Sensation'], [1e24, 'Septillion Supreme'], [1e27, 'Octillion Overlord']]
           .forEach(([n, name], i) => addAch(`earn${i + 1}`, name, `Earn ${formatShort(n)} Brown E's in total.`, '💰', () => state.life.earned >= n));
       [[10, 'Trickle'], [1000, 'Steady Stream'], [100000, 'Brown River'], [10000000, 'Waterfall of E'], [1000000000, 'E-Tsunami'], [100000000000, 'Ocean of E'],
        [10000000000000, 'E-Hurricane'], [1e15, 'Brown Hole'], [1e18, 'Unstoppable'], [1e21, 'Infinite Brown']]
           .forEach(([n, name], i) => addAch(`bps${i + 1}`, name, `Reach ${formatShort(n)} E's per second.`, '⚡', () => state.bps >= n));
       [[100, 'Strong Finger'], [100000, 'Power Poke'], [100000000, 'Megaclick'], [100000000000, 'Gigaclick'], [100000000000000, 'Teraclick']]
           .forEach(([n, name], i) => addAch(`cp${i + 1}`, name, `Reach ${formatShort(n)} click power.`, '💪', () => state.clickPower >= n));
       [[10, 'Landlord'], [50, 'Developer'], [100, 'Real E-state'], [250, 'Tycoon'], [500, 'Brown Empire'], [1000, 'Everything Everywhere']]
           .forEach(([n, name], i) => addAch(`own${i + 1}`, name, `Own ${n} buildings at once.`, '🏘️', () => totalBuildings() >= n));
       shopItems.forEach(item => {
           if (item.type === 'win') return;
           const n = item.type === 'click' ? 25 : 50;
           addAch(`b_${item.id}`, item.ach, `Own ${n} ${item.name}.`, item.icon, () => item.owned >= n);
       });
       addAch('set1', 'Full Set', 'Own at least 1 of every building.', '🧩', () => shopItems.every(i => i.type === 'win' || i.owned >= 1));
       addAch('set10', 'Ten of Everything', 'Own at least 10 of every building.', '🗂️', () => shopItems.every(i => i.type === 'win' || i.owned >= 10));
       [[10, 'Upgraded'], [25, 'Tinkerer'], [50, 'Engineer'], [100, 'Mad Scientist'], [200, 'Upgrade Everything']]
           .forEach(([n, name], i) => addAch(`upg${i + 1}`, name, `Own ${n} upgrades in one run.`, '🔧', () => upgradesOwned() >= n));
       addAch('syn1', 'Teamwork', 'Own 5 synergy upgrades in one run.', '🤝', () => upgradesOwned('syn') >= 5);
       addAch('syn2', 'Synergy Overload', 'Own 20 synergy upgrades in one run.', '🔗', () => upgradesOwned('syn') >= 20);
       addAch('gen1', 'Power Tuner', 'Raise the Click Power general upgrade to x2.0.', '🎚️', () => state.clickMultiLevel >= 10);
       addAch('gen2', 'Overclocked', 'Raise the E\'s Per Sec general upgrade to x2.0.', '🎛️', () => state.bpsMultiLevel >= 10);
       addAch('gen3', 'Maxed Out?', 'Raise both general upgrades to x3.5.', '📈', () => state.clickMultiLevel >= 25 && state.bpsMultiLevel >= 25);
       [[1, 'Shiny!'], [7, 'Gold Digger'], [27, 'Golden Touch'], [77, 'Midas'], [177, 'Gold Rush']]
           .forEach(([n, name], i) => addAch(`gold${i + 1}`, name, `Click ${n} Golden E${n === 1 ? '' : '\'s'}.`, '🌟', () => state.life.golden >= n));
       addAch('gcombo', 'Combo Breaker', 'Have a Frenzy and a Click Frenzy going at the same time.', '🎆', null);
       addAch('gquick', 'Quick Hands', 'Click a Golden E within 1 second of it appearing.', '⏱️', null);
       addAch('gmiss', 'Missed It!', 'Let a Golden E fade away.', '😢', null);
       addAch('gjack', 'Jackpot', 'Win 1B or more from one Lucky Golden E.', '🎰', () => state.life.biggestLucky >= 1000000000);
       [[1, 'The Final E'], [3, 'Again! Again!'], [5, 'E-ternal Champion'], [10, 'Ascended Master'], [25, 'Legend of the Brown E']]
           .forEach(([n, name], i) => addAch(`win${i + 1}`, name, `Win the game ${n} time${n === 1 ? '' : 's'}.`, '🏆', () => state.wins >= n));
       addAch('wfast', 'Speedrunner', 'Win a run in under 30 minutes.', '🏃', null);
       addAch('whands', 'Hands Off', 'Win a run with 100 clicks or fewer.', '🙅', null);
       addAch('mach', 'Trophy Hunter', 'Open the achievements panel.', '🔍', null);
       addAch('mstats', 'Number Cruncher', 'Open the stats page.', '🧮', null);
       addAch('mback', 'Welcome Back', 'Earn Brown E\'s while you were away.', '🌙', null);
       addAch('mnap', 'Long Nap', 'Come back after 4+ hours away.', '🛌', null);
       addAch('mhoard', 'Hoarder', 'Bank a full hour of E\'s per second (at least 1M).', '🐿️', () => state.bpsBase > 0 && state.brownEs >= 1000000 && state.brownEs >= state.bpsBase * 3600);
       addAch('mbulk', 'Bulk Buyer', 'Buy 100 of a building at once.', '📦', null);
       addAch('mspeed', 'Speed Demon', 'Click the big E 15 times in one second.', '🏎️', null);
       addAch('mplay1', 'Dedicated', 'Play for 1 hour in total.', '⌛', () => state.life.played >= 3600);
       addAch('mplay5', 'Devoted', 'Play for 5 hours in total.', '🕰️', () => state.life.played >= 18000);
       addAch('mplay20', 'Brown E Lifer', 'Play for 20 hours in total.', '📅', () => state.life.played >= 72000);

       // 2.0: ascension, prestige tree, challenges
       [[1, 'Ascended', '👼'], [5, 'Frequent Flyer', '🕊️'], [15, 'Stairway to Heaven', '🪜']]
           .forEach(([n, name, icon], i) => addAch(`asc${i + 1}`, name, n === 1 ? 'Ascend for the first time.' : `Ascend ${n} times.`, icon, () => state.meta.ascensions >= n));
       [[10, 'Chip Off the Old Block'], [1000, 'Heavenly Hoard'], [100000, 'Silicon Heaven']]
           .forEach(([n, name], i) => addAch(`chip${i + 1}`, name, `Earn ${formatNumber(n)} Heavenly Chips in total.`, '💠', () => state.meta.chipsTotal >= n));
       addAch('tree1', 'Branching Out', 'Own 5 Prestige Tree upgrades.', '🌿', () => treeOwned() >= 5);
       addAch('tree2', 'Family Tree', 'Own 20 Prestige Tree upgrades.', '🌳', () => treeOwned() >= 20);
       addAch('tree3', 'Enlightened', 'Own every Prestige Tree upgrade.', '🌟', () => treeOwned() >= TREE.length);
       addAch('chal1', 'Challenger', 'Complete a Challenge Run.', '⚔️', () => challengesDone() >= 1);
       addAch('chal2', 'Glutton for Punishment', 'Complete 5 Challenge Runs.', '🔥', () => challengesDone() >= 5);
       addAch('chal3', 'Trial Champion', 'Complete every Challenge Run.', '👑', () => challengesDone() >= CHALLENGES.length);
       addAch('mnews', 'Breaking News', 'Click the news ticker.', '📰', null);
       // 2.0: E Garden + E-Goods Market
       addAch('gard1', 'Green Thumbs Up', 'Harvest a plant in the E Garden.', '🧺', () => state.life.harvests >= 1);
       addAch('gard2', 'Seed Collector', 'Discover 4 new seeds through mutations.', '🧬', () => seedsFound() >= 6);
       addAch('gard3', 'Master Gardener', 'Discover every seed.', '🏵️', () => seedsFound() >= SEEDS.length);
       addAch('gard4', 'Full Bloom', 'Have 9 fully grown plants at once.', '🌼', () => grownPlants() >= 9);
       addAch('gard5', 'Harvest Moon', 'Harvest 100 plants.', '🌕', () => state.life.harvests >= 100);
       addAch('mkt1', 'First Trade', 'Sell goods at the E-Goods Market.', '🤝', () => state.life.marketTrades >= 1);
       addAch('mkt2', 'Buy Low, Sell High', 'Make $500 of profit at the market.', '💹', () => state.life.marketProfit >= 500);
       addAch('mkt3', 'Wolf of E Street', 'Make $25,000 of profit at the market.', '🐺', () => state.life.marketProfit >= 25000);
       addAch('mkt4', 'Full Warehouse', 'Fill the storage of any market good.', '📦', null);
       // 2.0: seasonal events (catch an event Golden E while the event is on)
       [['winter', 'Gift Unwrapper', '🎁'], ['valentine', 'Sweet on E', '💝'], ['spring', 'Egg Hunter', '🥚'], ['eday', 'Party Animal', '🎂'],
        ['summer', 'Sun Soaker', '☀️'], ['school', 'Teacher\'s Pet', '📚'], ['halloween', 'Trick or Treater', '🎃'], ['harvest', 'Pie Eyed', '🥧']]
           .forEach(([id, name, icon]) => addAch(`ev_${id}`, name, `Catch a special Golden E during ${EVENT_NAMES[id]}.`, icon, () => !!state.meta.seasons[id]));
       addAch('mskin', 'Fashion Statement', 'Wear a new E skin or background.', '🎨', null);
       addAch('mcrit', 'Critical Hit', 'Land 100 critical clicks.', '🎯', () => state.life.crits >= 100);

       const ACH_BY_ID = {};
       ACHIEVEMENTS.forEach(a => { ACH_BY_ID[a.id] = a; });

       // --- ASCENSION 2.0: HEAVENLY CHIPS ---
       // A run is worth cbrt(E's earned this run / 1 B) chips, so ascending unlocks at 1 B (1 billion).
       // Every chip ever earned gives +1% production; chips are also spent in the Prestige Tree.
       const CHIP_BASE = 1e9;
       const CHIP_BONUS = 0.01;
       function chipsForRun(earned) {
           if (!(earned >= CHIP_BASE)) return 0;
           return Math.floor(Math.cbrt(earned / CHIP_BASE) * PRES.chipX);
       }
       function chipMultiplier() { return 1 + state.meta.chipsTotal * CHIP_BONUS; }

       // --- PRESTIGE TREE --- (x, y = grid position on the tree screen; parent must be owned first)
       // fx keys: see recalcPrestige() for how each one stacks
       const TREE_COLORS = { root: '#FDE68A', prod: '#4ADE80', click: '#FB923C', eco: '#D97706', gold: '#FACC15', chip: '#C084FC', idle: '#818CF8', garden: '#2DD4BF', market: '#38BDF8', trial: '#F87171' };
       const TREE = [
           { id: 'root', x: 5, y: 4, p: null, cost: 1, br: 'root', icon: '👼', name: 'Heavenly E', desc: 'E/s and click power +10%. Opens the rest of the tree.', fx: { prodX: 1.1, clickX: 1.1 } },
           { id: 'prod1', x: 5, y: 3, p: 'root', cost: 3, br: 'prod', icon: '😇', name: 'Angelic Workers', desc: 'E/s +25%.', fx: { prodX: 1.25 } },
           { id: 'prod2', x: 5, y: 2, p: 'prod1', cost: 30, br: 'prod', icon: '🕊️', name: 'Seraphic Supply', desc: 'E/s +50%.', fx: { prodX: 1.5 } },
           { id: 'prod3', x: 5, y: 1, p: 'prod2', cost: 300, br: 'prod', icon: '⛪', name: 'Divine Factories', desc: 'E/s x2.', fx: { prodX: 2 } },
           { id: 'prod4', x: 5, y: 0, p: 'prod3', cost: 3000, br: 'prod', icon: '🎼', name: 'Cosmic Choir', desc: 'E/s x3.', fx: { prodX: 3 } },
           { id: 'syn', x: 4, y: 1, p: 'prod2', cost: 150, br: 'prod', icon: '🔗', name: 'Synergy Halo', desc: 'Synergy upgrades are 50% stronger.', fx: { synX: 1.5 } },
           { id: 'tierup', x: 6, y: 1, p: 'prod2', cost: 500, br: 'prod', icon: '💠', name: 'Divine Tiers', desc: 'Building tier upgrades give x2.25 instead of x2.', fx: { tierX: 2.25 } },
           { id: 'capstone', x: 6, y: 0, p: 'prod4', cost: 25000, br: 'prod', icon: '🌟', name: 'The Heavenly E', desc: 'E/s and click power x2, and Golden E\'s appear 25% more often.', fx: { prodX: 2, clickX: 2, goldFreq: 1.25 } },
           { id: 'click1', x: 4, y: 4, p: 'root', cost: 1, br: 'click', icon: '✋', name: 'Holy Finger', desc: 'Click power x2.', fx: { clickX: 2 } },
           { id: 'click2', x: 3, y: 4, p: 'click1', cost: 10, br: 'click', icon: '🪽', name: 'Angel Fingers', desc: 'Auto-clicks the big E once every second.', fx: { autoClick: 1 } },
           { id: 'click3', x: 2, y: 4, p: 'click2', cost: 50, br: 'click', icon: '✨', name: 'Divine Touch', desc: 'Each click also gives +3% of your E/s.', fx: { touch: 0.03 } },
           { id: 'click4', x: 1, y: 4, p: 'click3', cost: 400, br: 'click', icon: '👐', name: 'Archangel Fingers', desc: 'Auto-clicks 4 more times every second.', fx: { autoClick: 4 } },
           { id: 'click5', x: 0, y: 4, p: 'click4', cost: 4000, br: 'click', icon: '☄️', name: 'Miracle Click', desc: 'Click power x5.', fx: { clickX: 5 } },
           { id: 'crit', x: 2, y: 3, p: 'click3', cost: 120, br: 'click', icon: '🎯', name: 'Lucky Strike', desc: 'Every click has a 3% chance to be a x25 critical click.', fx: { crit: 0.03 } },
           { id: 'eco1', x: 5, y: 5, p: 'root', cost: 2, br: 'eco', icon: '🎒', name: 'Starter Kit', desc: 'Start every run with 10 Pointer Fingers, 10 Brown Crayons and 5 E-Farms.', fx: { start: { pointer: 10, crayon: 10, farm: 5 } } },
           { id: 'eco2', x: 5, y: 6, p: 'eco1', cost: 15, br: 'eco', icon: '💵', name: 'Seed Money', desc: 'Start every run with 1M Brown E\'s.', fx: { startE: 1e6 } },
           { id: 'eco3', x: 5, y: 7, p: 'eco2', cost: 60, br: 'eco', icon: '🏷️', name: 'Bargain Bin', desc: 'Buildings cost 5% less.', fx: { buildDisc: 0.95 } },
           { id: 'eco4', x: 5, y: 8, p: 'eco3', cost: 600, br: 'eco', icon: '💰', name: 'Trust Fund', desc: 'Start every run with 1T Brown E\'s.', fx: { startE: 1e12 } },
           { id: 'haggle', x: 4, y: 7, p: 'eco3', cost: 100, br: 'eco', icon: '🤝', name: 'Haggler', desc: 'One-time upgrades cost 10% less.', fx: { upgDisc: 0.9 } },
           { id: 'wholesale', x: 6, y: 7, p: 'eco3', cost: 1500, br: 'eco', icon: '📦', name: 'Wholesale', desc: 'Buildings cost another 7% less.', fx: { buildDisc: 0.93 } },
           { id: 'head', x: 4, y: 6, p: 'eco2', cost: 40, br: 'eco', icon: '🎚️', name: 'Head Start', desc: 'Both general upgrades start every run at x2.0.', fx: { genStart: 10 } },
           { id: 'heir', x: 6, y: 6, p: 'eco2', cost: 250, br: 'eco', icon: '🧳', name: 'Heirlooms', desc: 'Golden E and offline upgrades stay bought when you ascend.', fx: { keepUpg: 1 } },
           { id: 'gold1', x: 6, y: 4, p: 'root', cost: 2, br: 'gold', icon: '💫', name: 'Golden Halo', desc: 'Golden E\'s appear 10% more often.', fx: { goldFreq: 1.1 } },
           { id: 'gold2', x: 7, y: 4, p: 'gold1', cost: 12, br: 'gold', icon: '⏳', name: 'Lingering Gold', desc: 'Golden E\'s stay on screen 50% longer.', fx: { goldLife: 1.5 } },
           { id: 'gold3', x: 8, y: 4, p: 'gold2', cost: 60, br: 'gold', icon: '⏰', name: 'Golden Clock', desc: 'Golden E effects last 25% longer.', fx: { goldDur: 1.25 } },
           { id: 'gold4', x: 9, y: 4, p: 'gold3', cost: 250, br: 'gold', icon: '🌋', name: 'E-lder Frenzy', desc: 'Golden E\'s can give Elder Frenzy: E/s x111 for 6 seconds.', fx: { elder: 1 } },
           { id: 'gold5', x: 10, y: 4, p: 'gold4', cost: 2500, br: 'gold', icon: '🎲', name: 'Double Gold', desc: 'Golden E\'s have a 10% chance to give two effects at once.', fx: { doubleGold: 0.1 } },
           { id: 'luck', x: 8, y: 3, p: 'gold3', cost: 400, br: 'gold', icon: '🍀', name: 'Golden Avalanche', desc: 'Lucky gives up to 25% of your bank or 30 minutes of E/s (was 15% or 15 minutes).', fx: { luckBig: 1 } },
           { id: 'twins', x: 8, y: 5, p: 'gold3', cost: 900, br: 'gold', icon: '👯', name: 'Golden Twins', desc: 'After you click a Golden E, 8% chance another one appears 3 seconds later.', fx: { twins: 0.08 } },
           { id: 'festive', x: 7, y: 3, p: 'gold2', cost: 77, br: 'gold', icon: '🎉', name: 'Festive Spirit', desc: 'Seasonal event Golden E effects show up twice as often.', fx: { festive: 2 } },
           { id: 'chip1', x: 4, y: 3, p: 'root', cost: 5, br: 'chip', icon: '🧲', name: 'Chip Magnet', desc: '+10% Heavenly Chips when you ascend.', fx: { chipX: 1.1 } },
           { id: 'chip2', x: 3, y: 2, p: 'chip1', cost: 200, br: 'chip', icon: '🌪️', name: 'Chip Vacuum', desc: '+25% Heavenly Chips when you ascend.', fx: { chipX: 1.25 } },
           { id: 'chip3', x: 2, y: 1, p: 'chip2', cost: 5000, br: 'chip', icon: '🕳️', name: 'Chip Singularity', desc: '+50% Heavenly Chips when you ascend.', fx: { chipX: 1.5 } },
           { id: 'trophy', x: 3, y: 3, p: 'chip1', cost: 25, br: 'chip', icon: '🏆', name: 'Trophy Wings', desc: 'Achievements give 50% more production.', fx: { achX: 0.5 } },
           { id: 'trial', x: 6, y: 3, p: 'root', cost: 3, br: 'trial', icon: '⚔️', name: 'Trial Gate', desc: 'Unlocks Challenge Runs: pick one when you begin your next run.', fx: { trial: 1 } },
           { id: 'off1', x: 6, y: 5, p: 'root', cost: 4, br: 'idle', icon: '☁️', name: 'Cloud Nine', desc: 'Away earnings +10%.', fx: { offEff: 0.1 } },
           { id: 'off2', x: 7, y: 6, p: 'off1', cost: 40, br: 'idle', icon: '🛏️', name: 'Heavenly Hours', desc: 'Away earnings count for 24 more hours.', fx: { offCap: 24 } },
           { id: 'off3', x: 8, y: 7, p: 'off2', cost: 300, br: 'idle', icon: '🌌', name: 'Eternal Shift', desc: 'Away earnings +25%.', fx: { offEff: 0.25 } },
           { id: 'gard1', x: 4, y: 5, p: 'root', cost: 10, br: 'garden', icon: '🪴', name: 'Green Thumb', desc: 'E Garden: +3 plots.', fx: { gardenPlots: 3 } },
           { id: 'gard2', x: 3, y: 6, p: 'gard1', cost: 50, br: 'garden', icon: '💧', name: 'Fertilizer', desc: 'Garden plants grow 50% faster.', fx: { gardenSpeed: 1.5 } },
           { id: 'gard3', x: 2, y: 7, p: 'gard2', cost: 250, br: 'garden', icon: '🧪', name: 'Mutation Lab', desc: 'Garden mutations happen twice as often.', fx: { mutation: 2 } },
           { id: 'gard4', x: 1, y: 8, p: 'gard3', cost: 1200, br: 'garden', icon: '🏡', name: 'Garden Expansion', desc: 'E Garden: +4 plots.', fx: { gardenPlots: 4 } },
           { id: 'mkt1', x: 2, y: 5, p: 'gard1', cost: 20, br: 'market', icon: '🕴️', name: 'Insider Trading', desc: 'No market fee when you buy goods.', fx: { mktFee0: 1 } },
           { id: 'mkt2', x: 1, y: 6, p: 'mkt1', cost: 150, br: 'market', icon: '🏬', name: 'Big Warehouse', desc: 'Market storage x2.', fx: { mktCap: 2 } },
           { id: 'mkt3', x: 0, y: 7, p: 'mkt2', cost: 1000, br: 'market', icon: '📣', name: 'Market Hype', desc: 'Goods sell for 5% more.', fx: { mktSell: 1.05 } }
       ];
       const TREE_BY_ID = {};
       TREE.forEach(n => { TREE_BY_ID[n.id] = n; });

       // --- CHALLENGE RUNS --- (chosen when you begin a run after ascending; beat the goal for a permanent reward)
       const CHALLENGES = [
           { id: 'noclick', icon: '🙅', name: 'Hands Off', rule: 'The big E can\'t be clicked (no auto-clicks either) and click buildings are blocked.', goal: 1e12, reward: 'Idle Master: E/s +15% and away earnings +15%.', fx: { prodX: 1.15, offEff: 0.15 } },
           { id: 'clicksonly', icon: '👆', name: 'Clicks Only', rule: 'Buildings that make E\'s per second are blocked. Only clicking counts.', goal: 1e9, reward: 'Clicking Legend: click power x3.', fx: { clickX: 3 } },
           { id: 'noupgrades', icon: '🚫', name: 'Upgrade Strike', rule: 'No one-time upgrades and no general upgrades.', goal: 1e11, reward: 'Bargain Hunter: one-time upgrades cost 15% less.', fx: { upgDisc: 0.85 } },
           { id: 'nogold', icon: '🌑', name: 'Fool\'s Gold', rule: 'Golden E\'s never appear.', goal: 1e15, reward: 'Gold Fever: Golden E\'s appear 20% more often.', fx: { goldFreq: 1.2 } },
           { id: 'inflation', icon: '📈', name: 'Inflation', rule: 'Buildings get 25% pricier with every copy (normally 15%).', goal: 1e12, reward: 'Price Freeze: buildings cost 5% less.', fx: { buildDisc: 0.95 } },
           { id: 'speedrun', icon: '⏱️', name: 'Speedrun', rule: 'Reach the goal within 10 minutes, or the challenge fails.', goal: 1e9, limit: 600, reward: 'Turbo Gold: Golden E effects last 20% longer.', fx: { goldDur: 1.2 } },
           { id: 'minimal', icon: '🔟', name: 'Minimalist', rule: 'You can own at most 10 of each building.', goal: 1e10, reward: 'Less Is More: E/s +25%.', fx: { prodX: 1.25 } },
           { id: 'slowmo', icon: '🐢', name: 'Brown-out', rule: 'All E/s and click power is cut to 10%.', goal: 1e12, reward: 'Power Surge: E/s and click power +50%.', fx: { prodX: 1.5, clickX: 1.5 } },
           { id: 'amnesia', icon: '🫥', name: 'Amnesia', rule: 'Achievements give no production bonus.', goal: 1e15, reward: 'Total Recall: every achievement gives +1% more production.', fx: { achEach: 0.01 } }
       ];
       const CHALLENGE_BY_ID = {};
       CHALLENGES.forEach(c => { CHALLENGE_BY_ID[c.id] = c; });
       function activeChallenge() { return state.meta.challenge ? CHALLENGE_BY_ID[state.meta.challenge] || null : null; }
       function challengeIs(id) { return state.meta.challenge === id; }
       function challengesDone() { let n = 0; for (const id in state.meta.challengesDone) if (CHALLENGE_BY_ID[id]) n++; return n; }

       // Everything permanent (tree + challenge rewards) folded into one object; rebuilt only when they change
       const PRES_MULT = { prodX: 1, clickX: 1, buildDisc: 1, upgDisc: 1, goldFreq: 1, goldLife: 1, goldDur: 1, festive: 1, chipX: 1, synX: 1, gardenSpeed: 1, mutation: 1, mktCap: 1, mktSell: 1 };
       const PRES_MAX = { startE: 1, genStart: 1, tierX: 1 };
       const PRES = {};
       function recalcPrestige() {
           const p = { prodX: 1, clickX: 1, autoClick: 0, touch: 0, crit: 0, start: {}, startE: 0, buildDisc: 1, upgDisc: 1, genStart: 0, keepUpg: 0,
               goldFreq: 1, goldLife: 1, goldDur: 1, elder: 0, doubleGold: 0, luckBig: 0, twins: 0, festive: 1, chipX: 1, achX: 0, achEach: 0, synX: 1, tierX: 2,
               trial: 0, offEff: 0, offCap: 0, gardenPlots: 0, gardenSpeed: 1, mutation: 1, mktFee0: 0, mktCap: 1, mktSell: 1 };
           const add = (fx) => {
               for (const k in fx) {
                   const v = fx[k];
                   if (k === 'start') { for (const b in v) p.start[b] = Math.max(p.start[b] || 0, v[b]); }
                   else if (k in PRES_MULT) p[k] *= v;
                   else if (k in PRES_MAX) p[k] = Math.max(p[k], v);
                   else p[k] += v;
               }
           };
           for (let i = 0; i < TREE.length; i++) if (state.meta.tree[TREE[i].id]) add(TREE[i].fx);
           for (let i = 0; i < CHALLENGES.length; i++) if (state.meta.challengesDone[CHALLENGES[i].id]) add(CHALLENGES[i].fx);
           for (const k in PRES) delete PRES[k];
           Object.assign(PRES, p);
       }
       function treeOwned() { let n = 0; for (const id in state.meta.tree) if (TREE_BY_ID[id]) n++; return n; }
       function treeAvailable(n) { return !state.meta.tree[n.id] && (!n.p || !!state.meta.tree[n.p]); }

       // Building prices: discounts from the tree / challenges / garden, growth from the Inflation challenge
       function buildingGrowth(item) { return item.costMultiplier + (challengeIs('inflation') && item.type !== 'win' ? 0.1 : 0); }
       function buildingDiscount() { return PRES.buildDisc * (GFX.buildDisc || 1); }
       function repriceBuildings() {
           const disc = buildingDiscount();
           shopItems.forEach((item, i) => {
               if (item.type === 'win') { item.cost = BASE_COSTS[i]; return; }
               let c = Math.ceil(BASE_COSTS[i] * disc);
               const g = buildingGrowth(item);
               for (let k = 0; k < item.owned; k++) c = Math.ceil(c * g);
               item.cost = c;
           });
       }
       function upgCost(u) { return u.cost * PRES.upgDisc; }
       // Garden effects (filled in by the garden code; empty = no effect)
       const GFX = {};
       recalcPrestige();

       // --- E GARDEN DATA --- (unlocked by owning 15 E-Farms; grown plants give buffs, two grown plants side by side can mutate a new seed into an empty plot)
       // grow = seconds to grow; cost / harvest = seconds of your E/s; fx = buff while fully grown
       const GARDEN_UNLOCK = 15;
       const GARDEN_COLS = 4;
       const SEEDS = [
           { id: 'bean', icon: '🫘', name: 'E-Bean', grow: 180, cost: 30, harvest: 40, fx: { prod: 0.01 }, desc: '+1% E/s' },
           { id: 'cocoa', icon: '🌰', name: 'Cocoa Sprout', grow: 240, cost: 40, harvest: 55, fx: { click: 0.03 }, desc: '+3% click power' },
           { id: 'berry', icon: '🫐', name: 'Brownberry', grow: 300, cost: 60, harvest: 80, fx: { prod: 0.02 }, desc: '+2% E/s', parents: ['bean', 'bean'] },
           { id: 'rose', icon: '🌹', name: 'Choco Rose', grow: 360, cost: 80, harvest: 110, fx: { goldFreq: 0.03 }, desc: 'Golden E\'s appear 3% more often', parents: ['bean', 'cocoa'] },
           { id: 'tulip', icon: '🌷', name: 'Toffee Tulip', grow: 420, cost: 100, harvest: 135, fx: { goldDur: 0.04 }, desc: 'Golden E effects last 4% longer', parents: ['berry', 'cocoa'] },
           { id: 'shroom', icon: '🍄', name: 'Mud Mushroom', grow: 480, cost: 120, harvest: 165, fx: { buildDisc: 0.01 }, desc: 'Buildings cost 1% less', parents: ['berry', 'berry'] },
           { id: 'cactus', icon: '🌵', name: 'Click Cactus', grow: 540, cost: 150, harvest: 205, fx: { click: 0.08 }, desc: '+8% click power', parents: ['shroom', 'cocoa'] },
           { id: 'fern', icon: '🪴', name: 'Fudge Fern', grow: 600, cost: 200, harvest: 270, fx: { prod: 0.04 }, desc: '+4% E/s', parents: ['rose', 'shroom'] },
           { id: 'sunflower', icon: '🌻', name: 'Golden Sunflower', grow: 720, cost: 250, harvest: 340, fx: { lucky: 0.08 }, desc: 'Lucky Golden E\'s give 8% more', parents: ['tulip', 'rose'] },
           { id: 'lotus', icon: '🪷', name: 'Moon Lotus', grow: 900, cost: 300, harvest: 410, fx: { offEff: 0.03 }, desc: 'Away earnings +3%', parents: ['fern', 'tulip'] },
           { id: 'etree', icon: '🌳', name: 'Ancient E-Tree', grow: 1800, cost: 600, harvest: 820, fx: { prod: 0.08, click: 0.04 }, desc: '+8% E/s and +4% click power', parents: ['fern', 'sunflower'] }
       ];
       const SEED_BY_ID = {};
       SEEDS.forEach(sd => { SEED_BY_ID[sd.id] = sd; });
       function freshGarden() { return { unlocked: false, plots: new Array(16).fill(null), seeds: { bean: true, cocoa: true }, tick: 0 }; }
       let garden = freshGarden();
       // 9 plots, 12 with Green Thumb, 16 with Garden Expansion (a 4x4 grid filled row by row from the top-left 3x3)
       function plotOpen(i) {
           const r = Math.floor(i / GARDEN_COLS), c = i % GARDEN_COLS;
           const n = 9 + PRES.gardenPlots;
           if (r < 3 && c < 3) return true;
           if (r < 3 && c === 3) return n >= 12;
           return n >= 16;
       }
       // Growth speed: +1% per E-Farm (up to +100%), Fertilizer +50%
       function gardenSpeed() { return (1 + Math.min(100, BUILDING.farm.owned) / 100) * PRES.gardenSpeed; }
       function seedsFound() { let n = 0; for (const id in garden.seeds) if (SEED_BY_ID[id]) n++; return n; }
       function grownPlants() { let n = 0; for (let i = 0; i < garden.plots.length; i++) if (garden.plots[i] && garden.plots[i].m) n++; return n; }
       // Buffs from fully grown plants
       function recalcGarden() {
           let prod = 0, click = 0, gf = 0, gd = 0, bd = 0, lucky = 0, off = 0;
           for (let i = 0; i < garden.plots.length; i++) {
               const p = garden.plots[i];
               if (!p || !p.m || !plotOpen(i)) continue;
               const fx = SEED_BY_ID[p.s].fx;
               prod += fx.prod || 0; click += fx.click || 0; gf += fx.goldFreq || 0; gd += fx.goldDur || 0;
               bd += fx.buildDisc || 0; lucky += fx.lucky || 0; off += fx.offEff || 0;
           }
           GFX.prod = 1 + prod; GFX.click = 1 + click; GFX.goldFreq = 1 + gf; GFX.goldDur = 1 + gd;
           GFX.buildDisc = Math.max(0.8, 1 - bd); GFX.lucky = 1 + lucky; GFX.offEff = off;
       }

       // --- E-GOODS MARKET DATA --- (unlocked by owning 15 E-Banks)
       // Prices are in market dollars: $1 = one second of your best E/s this run
       const MARKET_UNLOCK = 15;
       const MARKET_TICK = 10; // seconds between price changes
       const MARKET_HIST = 60;
       const GOODS = [
           { id: 'choc', icon: '🍫', name: 'Choco Bars', sym: 'CHOC', rest: 10 },
           { id: 'brew', icon: '☕', name: 'E-Spresso', sym: 'BREW', rest: 15 },
           { id: 'mud', icon: '🧱', name: 'Mud Bricks', sym: 'MUD', rest: 20 },
           { id: 'pnut', icon: '🥜', name: 'Peanut Butter', sym: 'PNUT', rest: 28 },
           { id: 'tedy', icon: '🧸', name: 'Teddy Bears', sym: 'TEDY', rest: 36 },
           { id: 'nuts', icon: '🌰', name: 'Chestnuts', sym: 'NUTS', rest: 45 },
           { id: 'sock', icon: '🧦', name: 'Brown Socks', sym: 'SOCK', rest: 55 },
           { id: 'wood', icon: '🪵', name: 'Firewood', sym: 'WOOD', rest: 66 }
       ];
       const MARKET_MODES = ['Stable', 'Slowly rising', 'Slowly falling', 'Soaring', 'Crashing', 'Chaotic'];
       function freshMarket() {
           return {
               unlocked: false, tick: 0,
               goods: GOODS.map(g => {
                   const v = g.rest * (0.7 + Math.random() * 0.6);
                   return { v, d: 0, mode: 0, dur: 5, own: 0, avg: 0, hist: new Array(MARKET_HIST).fill(v), hi: 0 };
               })
           };
       }
       let market = freshMarket();
       function marketDollar() { return Math.max(1, state.run.bestBase); }
       function marketCap() { return Math.floor((5 + Math.floor(BUILDING.bank.owned / 5)) * PRES.mktCap); }
       function marketFee() { return PRES.mktFee0 ? 0 : 0.02; }
       // One price step for one good (d = trend as a fraction per step)
       function marketStep(g, rest) {
           g.d *= 0.85;
           const r = Math.random();
           if (g.mode === 1) g.d += 0.002;
           else if (g.mode === 2) g.d -= 0.002;
           else if (g.mode === 3) g.d += 0.006 + r * 0.005;
           else if (g.mode === 4) g.d -= 0.006 + r * 0.005;
           else if (g.mode === 5) g.d += (r - 0.5) * 0.03;
           let v = g.v * (1 + g.d + (Math.random() - 0.5) * 0.02);
           v += (rest - v) * 0.02; // drifts back toward its normal price
           if (v < rest * 0.25) { v = rest * 0.25 * (1 + Math.random() * 0.1); g.d = Math.abs(g.d) * 0.5; }
           if (v > rest * 3) { v = rest * 3 * (1 - Math.random() * 0.05); g.d = -Math.abs(g.d) * 0.5; }
           g.v = v;
           if (--g.dur <= 0) {
               const m = Math.random();
               g.mode = m < 0.3 ? 0 : m < 0.5 ? 1 : m < 0.7 ? 2 : m < 0.8 ? 3 : m < 0.9 ? 4 : 5;
               g.dur = g.mode >= 3 ? 3 + Math.floor(Math.random() * 8) : 6 + Math.floor(Math.random() * 25);
           }
           g.hist[g.hi] = v;
           g.hi = (g.hi + 1) % MARKET_HIST;
       }


