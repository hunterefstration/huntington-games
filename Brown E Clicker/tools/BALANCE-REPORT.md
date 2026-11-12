# Brown E Clicker balance report (classic vs Rebalanced beta)

Made with `tools/sim.js`, a headless simulator that loads the game's own pure logic
(`src/js/10-game/*.js` up to `PURE GAME LOGIC END`) in a node vm, so every price, output, upgrade,
chip and offline formula is the real one. It then plays the game with model players.

Re-test after changing `BALANCE` in `src/js/10-game/005-balance.js`:

    node "Brown E Clicker/tools/sim.js"            # both variants, ~2 min, writes sim-results.json
    node "Brown E Clicker/tools/sim.js" rb         # one variant (merged into sim-results.json)
    node "Brown E Clicker/tools/summary.js"        # the table below
    node "Brown E Clicker/tools/sim.js" rb active  # quick look at one player

## Model players
| player | clicks/s | play | golden E's caught | buying | ascends when the run gives |
| --- | --- | --- | --- | --- | --- |
| casual | 2 | 10 min a day, rest offline | 40% | best payback among what is affordable now | >= 1 chip and >= the chips earned so far |
| active | 5 | 2 x 35 min a day | 75% | best payback, waits for a better item when it is worth it | >= 2 chips and >= 75% of the chips so far |
| optimizer | 8 | 2 x 50 min a day | 97% | same as active | >= 3 chips and >= 50% of the chips so far |
| autoclick15 | 15 (the guard's cap) | as active | 75% | as active | as active |

Every player also ascends after 4 hours in one run if that adds 10%. Not modelled: garden, market,
seasonal events, skins (they add small extras). "first run" rows are continuous play with no ascending
(3-4 h), "career" rows are 30 days of sessions with offline time in between.

## What classic does (the problems)
- **It explodes in the first hour.** Every building pays itself back in well under a second once you own a
  few (median payback of purchases in an active career: 0 s for almost every building and upgrade). Bigger
  buildings cost ~2.5x more but make ~2.2x more, so production grows exponentially with no brake:
  an active player has 3e12 E's at 10 min, 7e22 at 1 h, and can buy **The Final E (1e24) after 54-62 min**.
- **Clicking is everything.** Click buildings get x2 tiers at 1/5/10/20/35 owned, 8 x2 click upgrades and
  the general click multiplier: 99-100% of E's come from clicking for the first 10 minutes, still 50-60%
  after 2 hours. A 15/s auto-clicker reaches ascension in 1.9 min and wins in 49 min.
- **Ascension is meaningless.** It unlocks after 2-5 minutes (1 B). One winning run gives cbrt(1e24 / 1e9) =
  100,000 chips (+100,000% production), which buys the whole tree; from then on every run wins in
  6-20 seconds. The active and optimizer players hit the simulator's 25-win stop on day 1, the casual one within a week.
- **Challenges are trivial** after a few ascensions (all goals reached in under a minute, except
  Hands Off at 12 min).
- **Offline doesn't matter** for active players (0-2% of playing per hour, because play explodes), and
  late-game click upgrades (Hydraulic Knuckles and up) are never worth buying.
- Early pacing is fine: something new every 30-70 s in the first 10 minutes (no dead zone early).

## What rb changes (all data in `BALANCE.rb`, classic numbers untouched)
| | classic | rb | why |
| --- | --- | --- | --- |
| building output | fixed list (~cost/15 ... cost/1.2M) | payback curve: output = cost / (15 x (cost/15)^0.5), same costs | bigger buildings pay back slower: steady growth instead of an explosion |
| click buildings (+click power) | 2, 8, 25, 70, 200, 6000, 4.2M | 1, 2, 4, 7, 12, 60, 1500 | clicking helps but doesn't carry the game |
| click tier upgrades | at 1/5/10/20/35 owned, x10..x300K cost | at 1/5/15/25/40, x20..x20M | slower click snowball |
| click upgrades | x2 each, from 500 E's | x1.5 each, from 2K, unlock 100..100K clicks | same |
| E-ssence Touch | +1% of E/s per click each | +0.5% | late clicks scale with E/s, but stay modest |
| Click Frenzy | x777 for 13 s | x77 for 13 s | was worth ~25 Frenzies; now about one Lucky |
| ascension | 1 B, cube root, +1%/chip | 10 B, 4th root, +2%/chip | chips grow slower than the production they give, so no runaway loop |
| prestige tree | 1..25,000 chips | about half (1..10,000) | chips are rarer, early nodes come fast |
| The Final E | always 1e24 | 1e24 x 1000^wins | each win is a new goal, not a repeat |
| offline | 25% for 8 h | 25% for 10 h | a little more for idle players |
| challenge goals | 1e9..1e15 | 1e9..1e12 (tuned to 25-145 min) | fit the new pace |

The rb payback curve rounds the small click buildings to the same +1, so those are listed explicitly in
`BALANCE.rb.buildings`. Every other number (growth 1.15/1.35, building costs, golden E timing, Lucky,
general multipliers, synergies, achievements) is the same as classic.

## Before / after
- **Pacing:** active player, first run: 1e9 at 20 min, 1e10 (ascension) at 34 min, 1e11 at 73 min,
  1e12 at ~2.5 h (classic: 1e9 at 5 min, 1e24 at ~1 h). Ascension #1 (with the active player's rule):
  **58 min** (classic 6 min); optimizer 94 min (classic 4); casual day 3 (classic day 2).
- **Later runs get faster:** the time into a run until ascension unlocks goes 34 -> 13 -> 17 -> 2 min for
  the active player (runs #1/#2/#5/#10), 31 -> 16 -> 11 -> 2 for the optimizer. Runs themselves get longer
  because each ascension asks for more chips (this is the player's choice in the model).
- **No runaway:** median payback grows smoothly from ~1 min (Pointer) to hours (Omniverse) instead of 0 s.
  After 30 days: active 604 chips, 0 wins; optimizer reaches its first win around day 23 and has 2 wins
  (classic: 25+ wins on day 1 for the active and optimizer players). There is a faster stretch for the optimizer around days 18-25 once the big
  tree nodes (x3, x2, chip boosts) are bought, then each Final E (x1000 per win) slows it down again.
- **Clicking:** share of E's from clicking for the active player 35% at 5 min, 33% at 30 min, 20% at 1 h,
  14% at 2 h (classic 100/74/60/52%). A 15/s auto-clicker reaches 1e11 1.4x faster than the 5/s player
  (classic: ascension 2.5x faster, and the run explodes either way).
- **Early game:** something new every 30-65 s in the first 10 minutes (60+ purchases). Mid game the payback
  buyer waits up to ~5 min between purchases at 30-60 min (classic up to 3 min, but classic has nothing left
  to discover by then).
- **No traps:** every building and upgrade gets bought in a 30-day career (the last 4-5 buildings are simply
  not reached yet in the first 3 hours); classic never buys its late click upgrades.
- **Offline:** 2-13% of playing per hour (classic 0-2%); for a casual player it is 97% of income, as an idle
  game should be, and still much less per hour than playing.
- **Challenges (after 5 ascensions, ~24 chips):** Speedrun 8 min (10 min limit), Clicks Only 26, Minimalist 32,
  Hands Off 33, Inflation 38, Upgrade Strike 86, Brown-out ~110, Amnesia ~110, Fool's Gold 143 min.

## Known limits / ideas for later
- The simulator's buyer is a payback greedy bot; real players buy differently (x10/x100, favourites).
- Garden, market and seasonal events are not modelled (they add a few % and some Lucky).
- The mid-game (30-120 min) has some 4-6 min waits for the payback buyer; a few cheaper synergy
  upgrades there would smooth it if testers find it slow.

## Full table (`node tools/summary.js`)
| metric | classic | rb |
| --- | --- | --- |
| **casual: first run** |  |  |
| ascension unlocked (min of play) | 12.3 | 55.0 |
| longest wait for something new, first 10 min (s) | 60 | 60 |
| new things bought in first 10 min | 40 | 23 |
| longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s) | 31 / 30 / 30 / 30 | 31 / 30 / 30 / 30 |
| share of E from clicking at 5 / 10 / 30 / 60 / 120 min | 28% / 99% / 15% / 12% / 13% | 4% / 1% / 2% / 4% / 5% |
| E earned at 10 / 60 / 120 min | 5.0e+7 / 2.3e+18 / 2.9e+21 | 7.9e+5 / 1.2e+10 / 1.1e+11 |
| first copy of pointer, mouse, farm, factory, bank, temple, planet, galaxy, dimension, multiverse, bigbang, entropy, author (min) | 0.5 1.5 2.0 3.5 11.5 11.5 12.5 13.5 14.5 17.5 35.0 51.5 207.5 | 0.5 2.0 3.5 5.5 11.0 14.5 29.0 42.0 120.0 - - - - |
| affordable buildings never bought | none | dyson telekinesis nebula pulsar multiverse |
| **active: first run** |  |  |
| ascension unlocked (min of play) | 4.7 | 33.5 |
| longest wait for something new, first 10 min (s) | 55 | 65 |
| new things bought in first 10 min | 125 | 62 |
| longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s) | 55 / 100 / 180 / 590 | 45 / 80 / 320 / 255 |
| share of E from clicking at 5 / 10 / 30 / 60 / 120 min | 100% / 99% / 74% / 60% / 52% | 35% / 5% / 33% / 20% / 14% |
| E earned at 10 / 60 / 120 min | 3.3e+12 / 7.2e+22 / 6.2e+26 | 4.1e+7 / 5.2e+10 / 5.5e+11 |
| first copy of pointer, mouse, farm, factory, bank, temple, planet, galaxy, dimension, multiverse, bigbang, entropy, author (min) | 0.1 0.4 4.3 4.9 5.0 5.3 5.8 5.8 10.5 12.7 18.7 21.6 61.4 | 0.1 0.4 1.9 3.9 7.8 9.6 19.6 27.9 89.0 - - - - |
| affordable buildings never bought | none | dyson telekinesis nebula pulsar multiverse |
| **optimizer: first run** |  |  |
| ascension unlocked (min of play) | 2.9 | 30.3 |
| longest wait for something new, first 10 min (s) | 70 | 38 |
| new things bought in first 10 min | 261 | 62 |
| longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s) | 44 / 200 / 318 / 398 | 34 / 138 / 128 / 302 |
| share of E from clicking at 5 / 10 / 30 / 60 / 120 min | 100% / 72% / 37% / 81% / 54% | 51% / 64% / 23% / 29% / 20% |
| E earned at 10 / 60 / 120 min | 9.6e+17 / 1.4e+26 / 1.7e+27 | 4.0e+7 / 7.2e+10 / 7.0e+11 |
| first copy of pointer, mouse, farm, factory, bank, temple, planet, galaxy, dimension, multiverse, bigbang, entropy, author (min) | 0.1 0.3 3.3 3.4 3.5 3.5 4.8 5.0 7.5 8.2 8.3 9.8 53.5 | 0.1 0.3 2.3 4.5 8.3 8.7 15.9 26.2 85.8 - - - - |
| affordable buildings never bought | none | telekinesis nebula pulsar multiverse timeline |
| **autoclick15: first run** |  |  |
| ascension unlocked (min of play) | 1.9 | 25.0 |
| longest wait for something new, first 10 min (s) | 60 | 35 |
| new things bought in first 10 min | 231 | 66 |
| longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s) | 55 / 120 / 135 / 685 | 30 / 105 / 220 / 310 |
| share of E from clicking at 5 / 10 / 30 / 60 / 120 min | 99% / 55% / 89% / 80% / 86% | 96% / 40% / 81% / 50% / 38% |
| E earned at 10 / 60 / 120 min | 1.2e+16 / 2.8e+25 / 5.5e+27 | 8.1e+7 / 1.7e+11 / 1.5e+12 |
| first copy of pointer, mouse, farm, factory, bank, temple, planet, galaxy, dimension, multiverse, bigbang, entropy, author (min) | 0.0 0.2 2.3 2.3 2.4 3.7 3.8 3.9 4.5 5.0 10.3 17.6 32.4 | 0.0 0.2 2.6 5.3 7.7 9.8 18.6 25.5 71.8 - - - - |
| affordable buildings never bought | none | nebula pulsar multiverse timeline |
| **casual: career (30 days)** |  |  |
| ascension #1: play min (run min, chips) | 13 (13, +1) | 23 (23, +1) |
| ascension #2: play min (run min, chips) | 23 (10, +1) | 41 (18, +1) |
| ascension #5: play min (run min, chips) | 44 (7, +15) | 181 (60, +11) |
| ascension #10: play min (run min, chips) | 71 (2, +1676) | - |
| min into the run until ascension unlocks, runs #1 / #2 / #5 / #10 | 13 / 10 / 4 / 1 | 23 / 18 / 14 / - |
| wins (The Final E) / ascensions | 25 / 37 | 0 / 6 |
| income share click / buildings / golden / offline | 0% / 0% / 0% / 100% | 0% / 2% / 0% / 97% |
| chips after day 1 / 7 / 30 | 0 / 807 / 1.5e+8 | 0 / 2 / 42 |
| **active: career (30 days)** |  |  |
| ascension #1: play min (run min, chips) | 6 (6, +2) | 58 (58, +2) |
| ascension #2: play min (run min, chips) | 9 (3, +6) | 94 (36, +2) |
| ascension #5: play min (run min, chips) | 18 (3, +74) | 351 (108, +12) |
| ascension #10: play min (run min, chips) | 23.4 (0.4, +2.4e+6) | 1506 (241, +94) |
| min into the run until ascension unlocks, runs #1 / #2 / #5 / #10 | 5 / 2 / 1 / - | 34 / 13 / 17 / 2 |
| wins (The Final E) / ascensions | 25 / 34 | 0 / 12 |
| income share click / buildings / golden / offline | 55% / 45% / 0% / 0% | 32% / 28% / 4% / 35% |
| chips after day 1 / 7 / 30 | 2.3e+8 / 2.3e+8 / 2.3e+8 | 2 / 25 / 604 |
| **optimizer: career (30 days)** |  |  |
| ascension #1: play min (run min, chips) | 4 (4, +3) | 94 (94, +3) |
| ascension #2: play min (run min, chips) | 5 (1, +396) | 151 (57, +3) |
| ascension #5: play min (run min, chips) | 7.6 (0.6, +2.1e+5) | 351 (89, +9) |
| ascension #10: play min (run min, chips) | 8.3 (0.1, +9.9e+5) | 1181 (223, +61) |
| min into the run until ascension unlocks, runs #1 / #2 / #5 / #10 | 3 / 1 / - / - | 31 / 16 / 11 / 2 |
| wins (The Final E) / ascensions | 25 / 29 | 2 / 29 |
| income share click / buildings / golden / offline | 63% / 37% / 0% / 0% | 63% / 29% / 4% / 4% |
| chips after day 1 / 7 / 30 | 4.4e+8 / 4.4e+8 / 4.4e+8 | 3 / 54 / 9.3e+5 |
| **autoclick15: career (10 days)** |  |  |
| ascension #1: play min (run min, chips) | 3 (3, +5) | 36 (36, +2) |
| ascension #2: play min (run min, chips) | 4 (1, +357) | 69 (33, +2) |
| ascension #5: play min (run min, chips) | 8 (1, +2.6e+5) | 281 (105, +11) |
| ascension #10: play min (run min, chips) | 9.7 (0.3, +4.7e+6) | - |
| min into the run until ascension unlocks, runs #1 / #2 / #5 / #10 | 2 / 1 / 1 / - | 25 / 17 / 7 / - |
| wins (The Final E) / ascensions | 25 / 30 | 0 / 7 |
| income share click / buildings / golden / offline | 73% / 27% / 0% / 0% | 20% / 27% / 3% / 49% |
| chips after day 1 / 7 / 30 | 4.8e+8 / 4.8e+8 / 4.8e+8 | 4 / 42 / 71 |
| **offline** (away E/hour vs playing E/hour, at 30 / 60 / 120 min) | 0.0% / 0.0% / 2.0% | 2.1% / 6.4% / 12.7% |
| **challenges** after 5 ascensions (min to goal, - = not in 3h) | noclick 12.4, clicksonly 0, noupgrades 0, nogold 0, inflation 0, speedrun 0, minimal 0, slowmo 0, amnesia 0 | noclick 33, clicksonly 26, noupgrades 85.8, nogold 143.1, inflation 38.4, speedrun 7.8, minimal 31, slowmo 105.5, amnesia 105.5 |
