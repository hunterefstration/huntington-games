
       // === PURE GAME LOGIC START === (no DOM in this section)

       // --- NUMBER FORMATTING ---
       // Format large numbers nicely: 12,345 / 1.50M / 2.30B / 4.00T / 1.00Qa ... then scientific (1.23e66)
       const NUMBER_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg'];
       const SUFFIX_NAMES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion',
           'undecillion', 'duodecillion', 'tredecillion', 'quattuordecillion', 'quindecillion', 'sexdecillion', 'septendecillion', 'octodecillion', 'novemdecillion', 'vigintillion'];
       // Player preferences (kept in their own save slot, so a save wipe never resets them)
       const settings = { numFormat: 'short', reduced: false, ticker: true, events: true };

       // The word for a big number's suffix (1e24 -> "septillion"), for tooltips
       function numberWord(num) {
           if (typeof num !== 'number' || !(num >= 1e6) || !isFinite(num)) return '';
           const m = suffixNumber(num, false).match(/[A-Za-z]+$/);
           const i = m ? NUMBER_SUFFIXES.indexOf(m[0]) : -1;
           return i > 1 ? SUFFIX_NAMES[i] : '';
       }
       // 1.23e45 style
       function sciNumber(num, digits) {
           let exp = Math.floor(Math.log10(num));
           let m = num / Math.pow(10, exp);
           if (Number(m.toFixed(digits)) >= 10) { m /= 10; exp++; }
           return m.toFixed(digits) + 'e' + exp;
       }
       // 1.23 billion style (falls back to scientific past vigintillion)
       function wordNumber(num) {
           const s = suffixNumber(num, false);
           const m = s.match(/^([\d.]+)([A-Za-z]+)$/);
           const i = m ? NUMBER_SUFFIXES.indexOf(m[2]) : -1;
           return i > 0 ? `${m[1]} ${SUFFIX_NAMES[i]}` : s;
       }
       function suffixNumber(num, sig) {
           let tier = Math.floor(Math.log10(num) / 3);
           if (tier >= NUMBER_SUFFIXES.length) {
               let exp = Math.floor(Math.log10(num));
               let m = num / Math.pow(10, exp);
               if (Number(m.toFixed(2)) >= 10) { m /= 10; exp++; }
               return m.toFixed(2) + 'e' + exp;
           }
           let mant = num / Math.pow(10, tier * 3);
           let digits = sig ? (mant >= 100 ? 0 : mant >= 10 ? 1 : 2) : 2;
           if (Number(mant.toFixed(digits)) >= 1000) {
               tier++;
               mant /= 1000;
               digits = 2;
               if (tier >= NUMBER_SUFFIXES.length) return suffixNumber(num * 1.000001, sig);
           }
           return mant.toFixed(digits) + NUMBER_SUFFIXES[tier];
       }
       function formatNumber(num) {
           if (typeof num !== 'number' || num !== num) return '0';
           if (num < 0) return '-' + formatNumber(-num);
           if (num === Infinity) return '∞';
           if (num < 1e6) return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
           if (settings.numFormat === 'sci') return sciNumber(num, 2);
           if (settings.numFormat === 'words') return wordNumber(num);
           return suffixNumber(num, false);
       }
       // Compact version for buttons and labels: 950 / 12.5K / 340K / 1.25M
       function formatShort(num) {
           if (typeof num !== 'number' || num !== num) return '0';
           if (num < 0) return '-' + formatShort(-num);
           if (num === Infinity) return '∞';
           if (num < 1000) return Math.floor(num).toString();
           if (num >= 1e6 && settings.numFormat === 'sci') return sciNumber(num, 2);
           return suffixNumber(num, true).replace(/\.0+(?=[A-Za-z])|(\.\d*?)0+(?=[A-Za-z])/, '$1');
       }
       // E's per second can be fractional early on
       function formatRate(num) {
           if (typeof num === 'number' && num > 0 && num < 100) return (Math.floor(num * 10) / 10).toFixed(1);
           return formatNumber(num);
       }
       function formatTime(sec) {
           sec = Math.max(0, Math.floor(sec || 0));
           const d = Math.floor(sec / 86400), h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, s = sec % 60;
           if (d > 0) return `${d}d ${h}h`;
           if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
           if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
           return `${s}s`;
       }



       // --- GAME STATE ---
       function freshRun() {
           return { earned: 0, clicks: 0, handmade: 0, golden: 0, time: 0, start: Date.now(), bestBase: 0, eggs: 0 };
       }

       // Things that survive ascending (but not a save wipe)
       function freshMeta() {
           return {
               chips: 0, chipsTotal: 0, ascensions: 0, bestRunChips: 0,
               tree: {}, // prestige tree upgrades owned (id -> true)
               challenge: null, // id of the challenge being played this run
               challengesDone: {}, // id -> time completed
               heaven: false, // ascended, choosing the next run
               skin: 'classic', bg: 'plain',
               seasons: {} // seasonal events seen (id -> true)
           };
       }

       function freshLife() {
           return {
               earned: 0, clicks: 0, handmade: 0, golden: 0, goldenMissed: 0,
               frenzy: 0, clickFrenzy: 0, lucky: 0, rush: 0, biggestLucky: 0,
               played: 0, bestBps: 0, bestClick: 0, offlineEarned: 0, longestAway: 0,
               upgrades: 0, buildings: 0, fastestWin: 0, started: Date.now(),
               crits: 0, autoClicked: 0, elder: 0, doubleGold: 0, harvests: 0, mutations: 0, marketProfit: 0, marketTrades: 0, eventGolden: 0, fastestAscend: 0
           };
       }

       let state = {
           brownEs: 0,
           clickPower: 1,
           bps: 0, // Brown E's Per Second (including Golden E buffs)
           bpsBase: 0, // Brown E's Per Second without temporary buffs
           clickMultiLevel: 0,
           bpsMultiLevel: 0,
           wins: 0,
           pendingWin: false, // bought The Final E but hasn't ascended yet
           upgrades: {}, // one-time upgrades bought this run (id -> true)
           achievements: {}, // kept forever (id -> time unlocked)
           buffs: [], // active Golden E effects
           run: freshRun(),
           life: freshLife(),
           meta: freshMeta()
       };


       // --- SHOP DATA ---
       // type 'bps' = produces E's every second, 'click' = adds click power, 'win' = beats the game.
       // New buildings unlock as you earn E's; `ach` is the name of the "own 50" (25 for click items) achievement.
       const shopItems = [
           { id: 'pointer', name: 'Pointer Finger', desc: 'Auto-clicks the E for you.', cost: 15, type: 'bps', amount: 1, owned: 0, costMultiplier: 1.15, icon: '👆', ach: 'Pointing Champion' },
           { id: 'crayon', name: 'Brown Crayon', desc: 'Scribbles tiny brown E\'s on every wall.', cost: 60, type: 'bps', amount: 3, owned: 0, costMultiplier: 1.15, icon: '🖍️', ach: 'Wall Artist' },
           { id: 'mouse', name: 'Bigger Mouse', desc: 'Makes your manual clicks stronger.', cost: 100, type: 'click', amount: 2, owned: 0, costMultiplier: 1.35, icon: '🖱️', ach: 'Mouse Trap' },
           { id: 'farm', name: 'E-Farm', desc: 'Harvests free-range Brown E\'s.', cost: 350, type: 'bps', amount: 10, owned: 0, costMultiplier: 1.15, icon: '🌾', ach: 'Old McBrown' },
           { id: 'mech', name: 'Mech Keyboard', desc: 'Loud clicks generate more E.', cost: 800, type: 'click', amount: 8, owned: 0, costMultiplier: 1.35, icon: '⌨️', ach: 'Clackety Clack' },
           { id: 'factory', name: 'E-Factory', desc: 'Mass-produces Brown E\'s on a belt.', cost: 1500, type: 'bps', amount: 35, owned: 0, costMultiplier: 1.15, icon: '🏭', ach: 'Assembly Required' },
           { id: 'bakery', name: 'E-Bakery', desc: 'Bakes warm, flaky, E-shaped pastries.', cost: 2800, type: 'bps', amount: 55, owned: 0, costMultiplier: 1.15, icon: '🥐', ach: 'Master Baker' },
           { id: 'gaming', name: 'Gaming Mouse', desc: 'RGB lighting makes clicks huge.', cost: 4000, type: 'click', amount: 25, owned: 0, costMultiplier: 1.35, icon: '🖱️✨', ach: 'Pro Gamer Move' },
           { id: 'router', name: 'E-nternet Router', desc: 'Downloads Brown E\'s from the web.', cost: 6000, type: 'bps', amount: 100, owned: 0, costMultiplier: 1.15, icon: '🌐', ach: 'Full Bars' },
           { id: 'glove', name: 'Brown Gloves', desc: 'Grippy gloves for maximum E-traction.', cost: 15000, type: 'click', amount: 70, owned: 0, costMultiplier: 1.35, icon: '🧤', ach: 'Glove Story' },
           { id: 'bank', name: 'E-Bank', desc: 'Generates interest in Brown E\'s.', cost: 25000, type: 'bps', amount: 300, owned: 0, costMultiplier: 1.15, icon: '🏦', ach: 'Too Big To Fail' },
           { id: 'implant', name: 'Brain Implant', desc: 'Think of E, and it appears.', cost: 60000, type: 'click', amount: 200, owned: 0, costMultiplier: 1.35, icon: '🧠', ach: 'Big Brain' },
           { id: 'temple', name: 'Temple of E', desc: 'Pray to the big brown letter.', cost: 100000, type: 'bps', amount: 900, owned: 0, costMultiplier: 1.15, icon: '🏛️', ach: 'High Priest of E' },
           { id: 'school', name: 'E-cademy', desc: 'Teaching young minds the ancient art of E.', cost: 250000, type: 'bps', amount: 1800, owned: 0, costMultiplier: 1.15, icon: '🏫', ach: 'Valedictorian' },
           { id: 'corp', name: 'Mega E-Corp', desc: 'Synergistic corporate E generation.', cost: 500000, type: 'bps', amount: 3000, owned: 0, costMultiplier: 1.15, icon: '🏢', ach: 'CEO of E' },
           { id: 'stadium', name: 'E-Stadium', desc: 'Thousands of fans chanting "E! E! E!"', cost: 1200000, type: 'bps', amount: 6000, owned: 0, costMultiplier: 1.15, icon: '🏟️', ach: 'Sold Out Show' },
           { id: 'planet', name: 'Planet E', desc: 'An entire world made of E.', cost: 2500000, type: 'bps', amount: 10000, owned: 0, costMultiplier: 1.15, icon: '🌍', ach: 'Planet Collector' },
           { id: 'robohand', name: 'Robo-Hand', desc: 'A hydraulic hand that never gets tired.', cost: 5000000, type: 'click', amount: 6000, owned: 0, costMultiplier: 1.35, icon: '🦾', ach: 'Hand Over Hand' },
           { id: 'rocket', name: 'E-Rocket', desc: 'Delivers Brown E\'s to orbit and back.', cost: 7000000, type: 'bps', amount: 23000, owned: 0, costMultiplier: 1.15, icon: '🚀', ach: 'Liftoff' },
           { id: 'galaxy', name: 'Galactic E-Empire', desc: 'Conquering the stars for E.', cost: 15000000, type: 'bps', amount: 42000, owned: 0, costMultiplier: 1.15, icon: '🌌', ach: 'Star Lord of E' },
           { id: 'moonbase', name: 'Lunar E-Base', desc: 'Mining the brown craters of the moon.', cost: 45000000, type: 'bps', amount: 95000, owned: 0, costMultiplier: 1.15, icon: '🌙', ach: 'Moonwalker' },
           { id: 'blackhole', name: 'E-Black Hole', desc: 'Spaghettifying matter into E.', cost: 100000000, type: 'bps', amount: 180000, owned: 0, costMultiplier: 1.15, icon: '🕳️', ach: 'Event Horizon' },
           { id: 'timemachine', name: 'E-Time Machine', desc: 'Borrows E\'s from next Tuesday.', cost: 300000000, type: 'bps', amount: 420000, owned: 0, costMultiplier: 1.15, icon: '⏳', ach: 'Back to the E-ture' },
           { id: 'dimension', name: 'Dimensional E-Rift', desc: 'Pulling E\'s from the multiverse.', cost: 800000000, type: 'bps', amount: 890000, owned: 0, costMultiplier: 1.15, icon: '🌀', ach: 'Rift Raider' },
           { id: 'clonelab', name: 'E-Clone Lab', desc: 'Every E is now two E\'s. Probably.', cost: 3000000000, type: 'bps', amount: 2500000, owned: 0, costMultiplier: 1.15, icon: '🧬', ach: 'Attack of the Clones' },
           { id: 'dyson', name: 'E-Dyson Sphere', desc: 'Harnessing a star for pure E.', cost: 10000000000, type: 'bps', amount: 6200000, owned: 0, costMultiplier: 1.15, icon: '☀️', ach: 'Sun Eater' },
           { id: 'telekinesis', name: 'Telekinetic Tap', desc: 'Click the E without touching anything.', cost: 25000000000, type: 'click', amount: 4200000, owned: 0, costMultiplier: 1.35, icon: '🔮', ach: 'Mind Over Matter' },
           { id: 'nebula', name: 'E-Nebula Forge', desc: 'Forging fresh E\'s in clouds of stardust.', cost: 70000000000, type: 'bps', amount: 28000000, owned: 0, costMultiplier: 1.15, icon: '🎇', ach: 'Stardust Smith' },
           { id: 'pulsar', name: 'Pulsar E-Beacon', desc: 'Spins 700 times a second, flinging E\'s.', cost: 200000000000, type: 'bps', amount: 63000000, owned: 0, costMultiplier: 1.15, icon: '💫', ach: 'Lighthouse Keeper' },
           { id: 'multiverse', name: 'E-Multiverse', desc: 'Infinite realities of Brown E.', cost: 500000000000, type: 'bps', amount: 130000000, owned: 0, costMultiplier: 1.15, icon: '🌠', ach: 'Many Worlds' },
           { id: 'timeline', name: 'E-Timeline Loom', desc: 'Weaves alternate timelines full of E.', cost: 3000000000000, type: 'bps', amount: 500000000, owned: 0, costMultiplier: 1.15, icon: '🧵', ach: 'Thread Master' },
           { id: 'simulation', name: 'The E-Simulation', desc: 'What if everything is secretly E\'s?', cost: 10000000000000, type: 'bps', amount: 1300000000, owned: 0, costMultiplier: 1.15, icon: '🖥️', ach: 'Brown Pill' },
           { id: 'quantum', name: 'Quantum E-Matrix', desc: 'E exists everywhere at once.', cost: 25000000000000, type: 'bps', amount: 2600000000, owned: 0, costMultiplier: 1.15, icon: '⚛️', ach: 'Schrödinger\'s E' },
           { id: 'cosmicstring', name: 'Cosmic E-Strings', desc: 'Strings of reality humming in E-flat.', cost: 150000000000000, type: 'bps', amount: 10000000000, owned: 0, costMultiplier: 1.15, icon: '🎻', ach: 'String Section' },
           { id: 'paradox', name: 'E-Paradox Engine', desc: 'Runs on E\'s it hasn\'t made yet.', cost: 400000000000000, type: 'bps', amount: 22000000000, owned: 0, costMultiplier: 1.15, icon: '♾️', ach: 'Impossible Machine' },
           { id: 'bigbang', name: 'E-Big Bang', desc: 'The creation of a new E universe.', cost: 800000000000000, type: 'bps', amount: 37000000000, owned: 0, costMultiplier: 1.15, icon: '💥', ach: 'In The Beginning' },
           { id: 'omniverse', name: 'E-Omniverse', desc: 'Every universe, all at once, all brown.', cost: 6e15, type: 'bps', amount: 180000000000, owned: 0, costMultiplier: 1.15, icon: '🪐', ach: 'All of It' },
           { id: 'entropy', name: 'E-ntropy Reverser', desc: 'Un-burns dead stars back into E\'s.', cost: 6e16, type: 'bps', amount: 1000000000000, owned: 0, costMultiplier: 1.15, icon: '🔄', ach: 'Rewind' },
           { id: 'archive', name: 'Akashic E-Archive', desc: 'The record of every E ever clicked.', cost: 7e17, type: 'bps', amount: 6800000000000, owned: 0, costMultiplier: 1.15, icon: '📜', ach: 'Librarian' },
           { id: 'dreamforge', name: 'E-Dream Forge', desc: 'Mass-produces E\'s out of sweet dreams.', cost: 9e18, type: 'bps', amount: 49000000000000, owned: 0, costMultiplier: 1.15, icon: '💭', ach: 'Sweet Dreams' },
           { id: 'concept', name: 'The Concept of E', desc: 'E is no longer a letter. It\'s a feeling.', cost: 1.2e20, type: 'bps', amount: 360000000000000, owned: 0, costMultiplier: 1.15, icon: '💡', ach: 'Big Idea' },
           { id: 'alphabet', name: 'The E-lphabet', desc: 'Replaces all 26 letters with E.', cost: 1.8e21, type: 'bps', amount: 2900000000000000, owned: 0, costMultiplier: 1.15, icon: '🔤', ach: 'A to E' },
           { id: 'author', name: 'The Author of E', desc: 'Whoever is writing this... only writes E.', cost: 3e22, type: 'bps', amount: 2.5e16, owned: 0, costMultiplier: 1.15, icon: '✒️', ach: 'The End?' },
           { id: 'god', name: 'The Final E', desc: 'Buy this to beat the game.', cost: 1e24, type: 'win', amount: 0, owned: 0, costMultiplier: 1, icon: '🏆' }
       ];

       const BUILDING = {};
       shopItems.forEach(item => { BUILDING[item.id] = item; item.mult = 1; item.eff = 0; });
       const BASE_COSTS = shopItems.map(i => i.cost);
       // Saves from before the big update stored buildings by their position in this list
       const OLD_SHOP_ORDER = ['pointer', 'mouse', 'farm', 'mech', 'factory', 'gaming', 'router', 'bank', 'implant', 'temple', 'corp', 'planet', 'galaxy', 'blackhole', 'dimension', 'dyson', 'multiverse', 'quantum', 'bigbang', 'god'];


       // --- UPGRADE DATA ---
       // Every upgrade is bought once per run. kind: tier | syn | click | touch | global | golden | ach | offline
       const UPGRADES = [];
       const TIER_NAMES = ['Polished', 'Turbo', 'Golden', 'Diamond', 'Cosmic'];
       const TIER_FLAVOR = ['A fresh coat of brown paint.', 'Now with racing stripes.', 'Gold-plated, obviously.', 'Unbreakable and extremely shiny.', 'Powered by the heart of the universe.'];
       const TIER_STYLE = ['border-amber-700', 'border-sky-400', 'border-yellow-400', 'border-cyan-300', 'border-fuchsia-400'];
       const TIER_BADGE = ['I', 'II', 'III', 'IV', 'V'];
       const TIER_AT = { bps: [1, 10, 25, 50, 100], click: [1, 5, 10, 20, 35] };
       const TIER_COST_X = { bps: [10, 50, 500, 50000, 5000000], click: [10, 40, 400, 10000, 300000] };

       // Per-building upgrades: each tier doubles that building's output
       shopItems.forEach((item, index) => {
           if (item.type === 'win') return;
           const at = TIER_AT[item.type], costX = TIER_COST_X[item.type];
           for (let t = 0; t < 5; t++) {
               UPGRADES.push({
                   id: `t_${item.id}_${t + 1}`, kind: 'tier', b: item.id, tier: t,
                   name: `${TIER_NAMES[t]} ${item.name}`, icon: item.icon, style: TIER_STYLE[t], badge: TIER_BADGE[t],
                   cost: BASE_COSTS[index] * costX[t],
                   desc: `${item.name} ${item.type === 'click' ? 'click power' : 'output'} x2.`,
                   flavor: TIER_FLAVOR[t],
                   req: `Own ${at[t]} ${item.name}`,
                   unlock: () => item.owned >= at[t]
               });
           }
       });

       // Synergies: [target, source, bonus per source owned, name, flavor]
       const SYNERGIES = [
           ['pointer', 'all', 0.03, 'Many Hands', 'Every building lends a finger.'],
           ['farm', 'pointer', 0.02, 'Pointy Pitchforks', 'Farmers point at the E\'s they want.'],
           ['factory', 'farm', 0.02, 'Farm-to-Factory', 'Fresh E\'s straight off the field.'],
           ['bakery', 'farm', 0.03, 'E-Wheat Flour', 'Grown on the farm, baked into pastries.'],
           ['router', 'factory', 0.02, 'Smart Factory Wi-Fi', 'Every conveyor belt is online now.'],
           ['bank', 'router', 0.02, 'Online E-Banking', 'Tap to deposit. Tap again for more E.'],
           ['temple', 'bank', 0.02, 'Golden Collection Plates', 'Donations are strictly in E\'s.'],
           ['school', 'crayon', 0.03, 'Crayon Curriculum', 'Lesson one: how to draw an E.'],
           ['corp', 'temple', 0.02, 'Corporate Worship', 'Mandatory E-appreciation meetings.'],
           ['stadium', 'school', 0.02, 'Varsity E-Team', 'Graduates go pro.'],
           ['planet', 'corp', 0.02, 'Planetary Franchise', 'Now open on every continent.'],
           ['rocket', 'factory', 0.01, 'Rocket Assembly Line', 'Factories switch to rocket parts.'],
           ['galaxy', 'planet', 0.02, 'Galactic Expansion', 'One planet was never enough.'],
           ['moonbase', 'rocket', 0.03, 'Lunar Shuttle Service', 'Leaves every 5 minutes. Bring snacks.'],
           ['blackhole', 'galaxy', 0.02, 'Galactic Appetite', 'Black holes eat galaxies for breakfast.'],
           ['timemachine', 'bank', 0.02, 'Interest From The Future', 'Compound interest, but backwards.'],
           ['dimension', 'blackhole', 0.02, 'Event Horizon Gate', 'Fall in one side, E\'s come out the other.'],
           ['clonelab', 'timemachine', 0.02, 'Paradox Clones', 'Clone yourself from yesterday.'],
           ['dyson', 'dimension', 0.02, 'Rift-Fed Reactor', 'Pipes in starlight from other dimensions.'],
           ['nebula', 'dyson', 0.02, 'Stellar Nursery', 'Baby stars, already brown.'],
           ['pulsar', 'nebula', 0.03, 'Nebula Beacons', 'Lighting the way through E-dust.'],
           ['multiverse', 'dyson', 0.02, 'Starlight Exports', 'Shipping sunshine to every reality.'],
           ['timeline', 'timemachine', 0.02, 'Timeline Splicing', 'Snip, snip. Now there are two Tuesdays.'],
           ['simulation', 'clonelab', 0.02, 'Simulated Clones', 'Clones running on clones running on clones.'],
           ['quantum', 'multiverse', 0.02, 'Entangled Realities', 'Spooky E\'s at a distance.'],
           ['cosmicstring', 'simulation', 0.02, 'Coded Strings', 'The universe is just very long code.'],
           ['paradox', 'timeline', 0.02, 'Grandfather E-Paradox', 'Don\'t think about it too hard.'],
           ['bigbang', 'quantum', 0.02, 'Quantum Ignition', 'Every big bang starts small.'],
           ['omniverse', 'bigbang', 0.02, 'Big Bang Bundle', 'Universes come in packs of ten now.'],
           ['entropy', 'paradox', 0.02, 'Reverse Engineering', 'It runs backwards. On purpose.'],
           ['archive', 'omniverse', 0.02, 'Omniversal Index', 'Filed under E. Everything is filed under E.'],
           ['dreamforge', 'archive', 0.02, 'Bedtime Stories', 'Read from the Archive, dreamt into E.'],
           ['concept', 'dreamforge', 0.02, 'Lucid Thinking', 'A dream so real it became an idea.'],
           ['alphabet', 'concept', 0.02, 'Spelling Bee', 'E. E-E. E-E-E. Correct!'],
           ['author', 'alphabet', 0.02, 'Plot Twist', 'The author was an E all along.'],
           ['gaming', 'mech', 0.03, 'RGB Keycaps', 'Keyboards and mice, now in matching colors.'],
           ['implant', 'gaming', 0.03, 'Neural RGB', 'Your thoughts glow in rainbow colors.'],
           ['robohand', 'glove', 0.03, 'Robo-Gloves', 'Grippy gloves on a hydraulic hand.']
       ];
       SYNERGIES.forEach(([t, s, pct, name, flavor]) => {
           const target = BUILDING[t];
           const source = s === 'all' ? null : BUILDING[s];
           const base = Math.max(target.cost, source ? source.cost : 0);
           UPGRADES.push({
               id: `s_${t}_${s}`, kind: 'syn', t, s, pct,
               name, icon: target.icon, style: 'border-purple-400', badge: source ? source.icon : '🏘️', badgeIcon: true,
               cost: source ? base * 75 : 100000,
               desc: source
                   ? `${target.name} +${Math.round(pct * 100)}% for every ${source.name} you own.`
                   : `${target.name} +${Math.round(pct * 100)}% for every building you own.`,
               flavor,
               req: source ? `Own 5 ${target.name} and 15 ${source.name}` : `Own 10 ${target.name} and 50 buildings`,
               unlock: source ? () => target.owned >= 5 && source.owned >= 15 : () => target.owned >= 10 && totalBuildings() >= 50
           });
       });

       // Click upgrades: each one doubles click power (unlocked by lifetime clicks)
       [
           [100, 500, 'Calloused Fingertip', '☝️', 'Tough skin for tough clicking.'],
           [500, 10000, 'Ambidextrous', '🙌', 'Two hands, twice the E.'],
           [1000, 300000, 'Wrist Brace', '💪', 'Safety first. Clicking second.'],
           [2500, 20000000, 'Turbo Knuckles', '👊', 'Vroom vroom.'],
           [5000, 2000000000, 'Finger Gym Membership', '🏋️', 'Never skip finger day.'],
           [10000, 300000000000, 'Hydraulic Knuckles', '🦿', 'Pssssht. Click. Pssssht. Click.'],
           [25000, 50000000000000, 'Ludicrous Clicking', '⚡', 'Your mouse is starting to smoke.'],
           [50000, 1e16, 'The Clicking Hand of E', '🖐️', 'Legends say it never stopped clicking.']
       ].forEach(([n, cost, name, icon, flavor], i) => {
           UPGRADES.push({ id: `clk${i + 1}`, kind: 'click', name, icon, style: 'border-orange-400', cost, desc: 'Click power x2.', flavor, req: `Click the E ${n} times (all time)`, unlock: () => state.life.clicks >= n });
       });

       // E-ssence Touch: clicks also earn a % of your E's per second
       [
           [50000, 100000, 'Brown Touch', '🤎'],
           [5000000, 10000000, 'Cocoa Contact', '🍫'],
           [500000000, 1000000000, 'Mocha Momentum', '☕'],
           [50000000000, 100000000000, 'Espresso Strike', '🥤'],
           [5000000000000, 10000000000000, 'Dark Roast Smash', '🔥'],
           [500000000000000, 1e15, 'Black Hole Brew', '🕳️']
       ].forEach(([n, cost, name, icon], i) => {
           UPGRADES.push({ id: `touch${i + 1}`, kind: 'touch', pct: 0.01, name, icon, style: 'border-amber-500', cost, desc: 'Each click also gives +1% of your E\'s per second.', flavor: 'Your fingers smell like chocolate.', req: `Earn ${formatShort(n)} E's this run`, unlock: () => state.run.earned >= n });
       });

       // Flavor upgrades that boost ALL E's per second
       [
           [1000, 0.05, 'Brown Sugar', '🍬', 'Sweet, sweet production.'],
           [100000, 0.10, 'Cocoa Beans', '🌰', 'The building blocks of brown.'],
           [10000000, 0.15, 'Milk Chocolate', '🍫', 'Smooth and creamy E\'s.'],
           [1000000000, 0.20, 'Dark Chocolate', '🍫', 'For sophisticated E connoisseurs.'],
           [100000000000, 0.25, 'Fudge Core', '🧁', 'Gooey in the middle.'],
           [10000000000000, 0.30, 'Molten Mocha', '🌋', 'Hot enough to melt a planet.'],
           [1e15, 0.40, 'Mud Pie Supreme', '🥧', 'Do not actually eat this.'],
           [1e18, 0.50, 'Brownie Singularity', '🌑', 'A brownie so dense, light cannot escape.'],
           [1e21, 0.75, 'The Brownest Brown', '🟤', 'Scientists say it can\'t get browner.'],
           [1e24, 1.00, 'E Pluribus E', '🌟', 'Out of many E\'s, one E.']
       ].forEach(([n, pct, name, icon, flavor], i) => {
           UPGRADES.push({ id: `glob${i + 1}`, kind: 'global', pct, name, icon, style: 'border-green-500', cost: n * 5, desc: `All E's per second +${Math.round(pct * 100)}%.`, flavor, req: `Earn ${formatShort(n)} E's this run`, unlock: () => state.run.earned >= n });
       });

       // Golden E upgrades
       UPGRADES.push(
           { id: 'gold1', kind: 'golden', effect: 'life', name: 'Golden Glow', icon: '✨', style: 'border-yellow-300', cost: 7777, desc: 'Golden E\'s stay on screen 50% longer.', flavor: 'Shiny things like to be looked at.', req: 'Click 1 Golden E', unlock: () => state.life.golden >= 1 },
           { id: 'gold2', kind: 'golden', effect: 'freq', name: 'Lucky Day', icon: '🍀', style: 'border-yellow-300', cost: 777777, desc: 'Golden E\'s appear 20% more often.', flavor: 'Four leaves, one E.', req: 'Click 3 Golden E\'s', unlock: () => state.life.golden >= 3 },
           { id: 'gold3', kind: 'golden', effect: 'freq', name: 'Serendipi-E', icon: '🌈', style: 'border-yellow-300', cost: 777777777, desc: 'Golden E\'s appear 20% more often.', flavor: 'Happy accidents, on purpose.', req: 'Click 10 Golden E\'s', unlock: () => state.life.golden >= 10 },
           { id: 'gold4', kind: 'golden', effect: 'dur', name: 'Get Lucky', icon: '🎰', style: 'border-yellow-300', cost: 77777777777, desc: 'Golden E effects last twice as long.', flavor: 'Jackpot! Jackpot! Jackpot!', req: 'Click 27 Golden E\'s', unlock: () => state.life.golden >= 27 }
       );

       // Achievement boosters
       UPGRADES.push(
           { id: 'achup1', kind: 'ach', pct: 0.5, name: 'Trophy Polish', icon: '🏆', style: 'border-yellow-600', cost: 1000000, desc: 'Achievements give 50% more production.', flavor: 'Gleaming, glorious, brown.', req: 'Unlock 15 achievements', unlock: () => achievementCount() >= 15 },
           { id: 'achup2', kind: 'ach', pct: 0.5, name: 'Trophy Case', icon: '🏅', style: 'border-yellow-600', cost: 1000000000000, desc: 'Achievements give 50% more production.', flavor: 'Lit from below, for drama.', req: 'Unlock 40 achievements', unlock: () => achievementCount() >= 40 },
           { id: 'achup3', kind: 'ach', pct: 1, name: 'Hall of E-Fame', icon: '🎖️', style: 'border-yellow-600', cost: 1e18, desc: 'Achievements give 100% more production.', flavor: 'Your name, carved in brown marble.', req: 'Unlock 75 achievements', unlock: () => achievementCount() >= 75 }
       );

       // Offline earnings upgrades
       UPGRADES.push(
           { id: 'off1', kind: 'offline', effect: 'eff', pct: 0.15, name: 'Night Shift', icon: '🌃', style: 'border-indigo-400', cost: 250000, desc: 'While you\'re away, buildings work at 40% instead of 25%.', flavor: 'Somebody has to watch the E\'s.', req: 'Earn 100K E\'s this run', unlock: () => state.run.earned >= 100000 },
           { id: 'off2', kind: 'offline', effect: 'eff', pct: 0.20, name: 'Sleepwalking Fingers', icon: '😴', style: 'border-indigo-400', cost: 2500000000, desc: 'While you\'re away, buildings work at 60%.', flavor: 'Click... click... zzz... click.', req: 'Earn 1B E\'s this run', unlock: () => state.run.earned >= 1000000000 },
           { id: 'off3', kind: 'offline', effect: 'cap', name: 'Dream Factory', icon: '💤', style: 'border-indigo-400', cost: 2500000000000, desc: 'Away earnings count for up to 24 hours (was 8).', flavor: 'The night shift never ends.', req: 'Earn 1T E\'s this run', unlock: () => state.run.earned >= 1000000000000 }
       );

       const UPGRADE_BY_ID = {};
       UPGRADES.forEach(u => { UPGRADE_BY_ID[u.id] = u; });


