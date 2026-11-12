
       // === BALANCE === (pure data: every tunable number of the economy lives here)
       // Two variants share all code: 'classic' (the original numbers, the default) and 'rb' (Rebalanced beta).
       // The beta is picked with localStorage brownEClicker_variant = 'rb' (or ?variant=rb in the URL, which is then remembered).
       // Each variant keeps its own progress: every progress key gets KEY_SUFFIX ('' or '_rb').
       // Re-test the numbers with: node "Brown E Clicker/tools/sim.js" (see tools/BALANCE-REPORT.md).
       const VARIANT_KEY = 'brownEClicker_variant';
       const VARIANT = (function () {
           if (typeof __BEC_VARIANT__ !== 'undefined') return __BEC_VARIANT__ === 'rb' ? 'rb' : 'classic'; // the node simulator
           let v = '';
           try {
               const q = new URLSearchParams(location.search).get('variant');
               if (q === 'rb') { v = 'rb'; localStorage.setItem(VARIANT_KEY, 'rb'); }
               else if (q === 'classic') { v = 'classic'; localStorage.removeItem(VARIANT_KEY); }
           } catch (e) { /* no URL or storage */ }
           try { if (!v) v = localStorage.getItem(VARIANT_KEY) || ''; } catch (e) { /* storage blocked */ }
           return v === 'rb' ? 'rb' : 'classic';
       })();
       const IS_RB = VARIANT === 'rb';
       const KEY_SUFFIX = IS_RB ? '_rb' : '';

       const BALANCE = {
           classic: {
               // Buildings: costs and outputs are in the shop list; null = use them as they are
               buildings: null,
               growth: { bps: 1.15, click: 1.35 },        // each copy costs this much more than the last
               // Per-building tier upgrades: owned needed, cost (x base cost), output multiplier
               tierAt: { bps: [1, 10, 25, 50, 100], click: [1, 5, 10, 20, 35] },
               tierCostX: { bps: [10, 50, 500, 50000, 5000000], click: [10, 40, 400, 10000, 300000] },
               tierMult: 2,
               // Synergies: cost = (pricier building's base cost) x synCostX; 'all' synergy cost; bonus scale
               synCostX: 75, synAllCost: 100000, synPctX: 1,
               // Click upgrades: [lifetime clicks needed, cost], each one multiplies click power
               clickUpg: [[100, 500], [500, 10000], [1000, 300000], [2500, 20000000], [5000, 2000000000], [10000, 300000000000], [25000, 50000000000000], [50000, 1e16]],
               clickUpgMult: 2,
               // E-ssence Touch: [E's earned this run needed, cost]; each click also gives touchPct of E/s
               touch: [[50000, 100000], [5000000, 10000000], [500000000, 1000000000], [50000000000, 100000000000], [5000000000000, 10000000000000], [500000000000000, 1e15]],
               touchPct: 0.01,
               // Global flavor upgrades: [E's earned this run needed, E/s bonus]; cost = needed x globCostX
               glob: [[1000, 0.05], [100000, 0.10], [10000000, 0.15], [1000000000, 0.20], [100000000000, 0.25], [10000000000000, 0.30], [1e15, 0.40], [1e18, 0.50], [1e21, 0.75], [1e24, 1.00]],
               globCostX: 5,
               // Fixed-price upgrades (golden, trophy, offline)
               upgCost: { gold1: 7777, gold2: 777777, gold3: 777777777, gold4: 77777777777, achup1: 1000000, achup2: 1000000000000, achup3: 1e18, off1: 250000, off2: 2500000000, off3: 2500000000000 },
               // The two general multiplier buttons: cost = base x growth^level, each level +step
               gen: { base: 10000, growth: 1.8, step: 0.10 },
               achEach: 0.01,                              // production per achievement
               // Golden E: seconds between (min/max), seconds on screen, first one after first[0] + random first[1]
               golden: {
                   first: [25, 20], minGap: 75, maxGap: 165, life: 13,
                   weights: [0.42, 0.77, 0.88],            // cumulative: frenzy, lucky, click frenzy, rest = building rush
                   frenzy: [7, 66], click: [777, 13], elder: [111, 6], rush: [0.1, 30], // [multiplier (rush: per copy), seconds]
                   lucky: { bank: 0.15, secs: 900, bankBig: 0.25, secsBig: 1800, flat: 13 }
               },
               // Heavenly chips: floor((E's this run / base) ^ power x chip upgrades); each chip ever earned gives +bonus production
               chips: { base: 1e9, power: 1 / 3, bonus: 0.01 },
               // Offline: share of E/s while away and hours counted; upgrades add to them
               offline: { eff: 0.25, capHours: 8, off1: 0.15, off2: 0.20, off3Cap: 24 },
               tree: null,                                  // { nodeId: chip cost } overrides
               challengeGoals: null,                        // { challengeId: goal } overrides
               winCost: 1e24, winGrowth: 1, winBoost: 1     // The Final E (price x winGrowth per win so far), and +production per win
           },
           // Rebalanced beta: only what differs from classic. Evidence and before/after numbers: tools/BALANCE-REPORT.md
           rb: {
               payback: { p0: 15, k: 0.5, p0Click: 100, kClick: 0.6 },
               clickUpgMult: 1.5,
               tierAt: { bps: [1, 10, 25, 50, 100], click: [1, 5, 15, 25, 40] },
               tierCostX: { bps: [10, 50, 500, 50000, 5000000], click: [20, 200, 5000, 200000, 20000000] },
               clickUpg: [[100, 2000], [1000, 100000], [3000, 1e7], [6000, 1e9], [12000, 1e11], [25000, 1e13], [50000, 1e15], [100000, 1e17]],
               touchPct: 0.005,
               golden: { click: [77, 13] },
               chips: { base: 1e10, power: 0.25, bonus: 0.02 },
               tree: { prod1: 2, prod2: 15, prod3: 150, prod4: 1500, syn: 75, tierup: 250, capstone: 10000, click2: 5, click3: 25, click4: 200, click5: 2000, crit: 60,
                   eco1: 1, eco2: 8, eco3: 30, eco4: 300, haggle: 50, wholesale: 750, head: 20, heir: 120, gold1: 1, gold2: 6, gold3: 30, gold4: 120, gold5: 1200,
                   luck: 200, twins: 450, festive: 40, chip1: 3, chip2: 100, chip3: 2500, trophy: 12, trial: 2, off1: 2, off2: 20, off3: 150,
                   gard1: 5, gard2: 25, gard3: 120, gard4: 600, mkt1: 10, mkt2: 75, mkt3: 500 },
               offline: { capHours: 10 },
               challengeGoals: { noclick: 2e11, clicksonly: 1e10, noupgrades: 1e9, nogold: 1e12, inflation: 1e11, minimal: 1e10, slowmo: 1e10, amnesia: 1e12 },
               winGrowth: 1000
           }
       };
       // The active table: classic with the variant's overrides on top (one level deep for objects)
       const BAL = (function () {
           const base = BALANCE.classic, over = IS_RB ? BALANCE.rb : {};
           const out = {};
           for (const k in base) {
               const b = base[k], o = over[k];
               if (o === undefined) out[k] = b;
               else if (b && o && typeof b === 'object' && typeof o === 'object' && !Array.isArray(b) && !Array.isArray(o)) out[k] = Object.assign({}, b, o);
               else out[k] = o;
           }
           for (const k in over) if (!(k in out)) out[k] = over[k];
           return out;
       })();

