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
| active | 5 | 35 min a day (one school-day session) | 75% | best payback, waits for a better item when it is worth it | >= 2 chips and >= 75% of the chips so far |
| optimizer | 8 | 2 x 30 min a day | 97% | same as active | >= 3 chips and >= 50% of the chips so far |
| autoclick15 | 15 (the guard's cap) | as active | 75% | as active | as active |

Every player also ascends after 4 hours in one run if that adds 10%, and buys The Final E as soon as it can.
"Day" = calendar day of the career (day 1 = the first day played). Not modelled: garden, market,
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
  6-20 seconds. All three model players hit the simulator's 25-win stop on day 1-2.
- **Challenges are trivial** after a few ascensions (all goals reached in under a minute, except
  Hands Off at 12 min).
- **Offline doesn't matter** for active players (0-2% of playing per hour, because play explodes), and
  late-game click upgrades (Hydraulic Knuckles and up) are never worth buying.
- Early pacing is fine: something new every 30-70 s in the first 10 minutes (no dead zone early).

## What rb changes (all data in `BALANCE.rb`, classic numbers untouched)
Second tuning pass (school kids, 20-40 min a day): first win in about a week, no mid-game waits.

| | classic | rb | why |
| --- | --- | --- | --- |
| building output | fixed list (~cost/15 ... cost/1.2M) | payback curve: output = cost / (15 x (cost/15)^0.45), same costs | bigger buildings pay back slower: steady growth instead of an explosion |
| click buildings (+click power) | 2, 8, 25, 70, 200, 6000, 4.2M | 1, 4, 8, 13, 24, 120, 3000 | clicking helps but doesn't carry the game |
| click tier upgrades | at 1/5/10/20/35 owned, x10..x300K cost | at 1/5/15/25/40, x20..x20M | slower click snowball |
| click upgrades | x2 each, from 500 E's | x1.5 each, from 2K | same |
| E-ssence Touch / Click Frenzy | +1% / x777 | +0.5% / x77 | late clicks stay modest |
| building tiers II-V cost | x50, x500, x50K, x5M | x25, x100, x1000, x100K | no long saving-up waits |
| synergies / flavor upgrades | 75x / 5x the unlock amount | 15x / 0.05x | same |
| general multipliers | +10%, cost x1.8 per level | +5%, cost x1.35 per level | smaller, more frequent steps |
| Trophy Case / Hall of Fame / Get Lucky / Dream Factory | 1T / 1e18 / 77.8B / 2.5T | 10B / 1e15 / 7.8B / 250B | were the long mid-game waits |
| ascension | 1 B, cube root, +1%/chip | 120 B, 5th root, +20%/chip | chips grow slower than the production they give (no runaway), but each one matters |
| prestige tree | 1..25,000 chips | about half (1..10,000) | early nodes come fast |
| The Final E | always 1e24 | 300 T x 150^wins | first win in about a week; every win is a new, bigger goal |
| offline | 25% for 8 h | 20% for 8 h | useful, clearly weaker than playing |
| challenge goals | 1e9..1e15 | 2e11..1e16 (35-110 min after 5 ascensions) | fit the new pace |

## Before / after
- **First run (active, 5 clicks/s):** 1e12 at 60 min, ascension unlocks at 35 min, first ascension at
  **61 min** (classic: 3e12 at 10 min, ascension at 6 min, The Final E at ~1 h).
- **Something new to buy all the time:** longest gap between purchases for the active player 35 s
  (0-10 min), 45 s (10-30), 65 s (30-60), 99 s (60-120). Classic: 55 / 100 / 180 / 590 s.
- **Later runs get faster, smoothly:** minutes into the run until ascension unlocks, runs #1-#10:
  active 36 15 13 11 8 3 2 1 1 1; optimizer 31 17 12 5 5 2 3 1 1 1 (16-day tuning runs).
- **The Final E (wins), by career day:** active 8.7, 10.7, ..., #5 on day 14.7 (each later win 1-3 days);
  optimizer 4.8, 5.3, ..., #5 on day 7.3 (about one win per session after the first);
  casual 19.8, then 25.8 (~3 weeks). Classic: 25+ wins on day 1-2, then every run wins in seconds.
- **Clicking:** share of E's from clicks in the first run (active) 36% at 5 min, 38% at 30 min,
  14% at 1 h and 2 h (classic 100/74/60/52%). Over a whole career it is 37% for the active player
  because Angel Fingers auto-clicks and Click Frenzies count as clicks.
- **Auto-clicker advantage:** a 15/s clicker reaches the active player's 60-minute total 1.18x faster,
  and buys its first Final E on day 6.7 instead of 8.7 (1.3x). Classic: 2.5x faster to ascension.
- **No traps:** every building and every upgrade is bought in the 30-day active and optimizer careers.
- **Offline:** 0.5-9% of playing per hour; 29% of an active player's income, 90% of a casual player's.
- **Challenges (after 5 ascensions):** Speedrun 9 min (10 min limit), Hands Off 36, Clicks Only 44,
  Inflation 50, Minimalist 50, Brown-out 100, Upgrade Strike 101, Amnesia 103, Fool's Gold 110 min.

## Known limits / ideas for later
- After about 8 wins the ladder slows a lot (the optimizer's 9th win took ~19 days): Final E prices pass
  what the top buildings can make (The Author of E). Fine for this audience; a later update could add
  buildings or lower the growth after win 8.
- The simulator's buyer is a payback greedy bot; real players buy differently (x10/x100, favourites).
- Garden, market and seasonal events are not modelled (they add a few % and some Lucky).
- The optimizer and auto-clicker bots still have some 2.5-5 min waits (their economy moves faster
  than the upgrade lists); the active player, the target, does not.

## Full table (`node tools/summary.js`)
| metric | classic | rb |
| --- | --- | --- |
| **casual: first run** |  |  |
| ascension unlocked (min of play) | 12.3 | 64.3 |
| longest wait for something new, first 10 min (s) | 60 | 60 |
| new things bought in first 10 min | 40 | 31 |
| longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s) | 31 / 30 / 30 / 30 | 31 / 30 / 30 / 30 |
| share of E from clicking at 5 / 10 / 30 / 60 / 120 min | 28% / 99% / 15% / 12% / 13% | 5% / 1% / 3% / 4% / 4% |
| E earned at 10 / 60 / 120 min | 5.0e+7 / 2.3e+18 / 2.9e+21 | 2.5e+6 / 9.7e+10 / 2.4e+12 |
| first copy of pointer, mouse, farm, factory, bank, temple, planet, galaxy, dimension, multiverse, bigbang, entropy, author (min) | 0.5 1.5 2.0 3.5 11.5 11.5 12.5 13.5 14.5 17.5 35.0 51.5 207.5 | 0.5 2.0 2.5 4.0 10.5 11.0 21.0 26.0 63.5 - - - - |
| affordable buildings never bought | none | multiverse timeline simulation quantum |
| **active: first run** |  |  |
| ascension unlocked (min of play) | 4.7 | 35.4 |
| longest wait for something new, first 10 min (s) | 55 | 40 |
| new things bought in first 10 min | 125 | 79 |
| longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s) | 55 / 100 / 180 / 590 | 35 / 45 / 65 / 99 |
| share of E from clicking at 5 / 10 / 30 / 60 / 120 min | 100% / 99% / 74% / 60% / 52% | 36% / 8% / 38% / 14% / 14% |
| E earned at 10 / 60 / 120 min | 3.3e+12 / 7.2e+22 / 6.2e+26 | 1.6e+8 / 1.1e+12 / 2.7e+13 |
| first copy of pointer, mouse, farm, factory, bank, temple, planet, galaxy, dimension, multiverse, bigbang, entropy, author (min) | 0.1 0.4 4.3 4.9 5.0 5.3 5.8 5.8 10.5 12.7 18.7 21.6 61.4 | 0.1 0.4 1.6 3.2 7.3 7.8 12.8 16.0 36.1 145.1 - - - |
| affordable buildings never bought | none | timeline simulation quantum |
| **optimizer: first run** |  |  |
| ascension unlocked (min of play) | 2.9 | 30.6 |
| longest wait for something new, first 10 min (s) | 70 | 34 |
| new things bought in first 10 min | 261 | 98 |
| longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s) | 44 / 200 / 318 / 398 | 24 / 84 / 166 / 128 |
| share of E from clicking at 5 / 10 / 30 / 60 / 120 min | 100% / 72% / 37% / 81% / 54% | 33% / 51% / 23% / 37% / 17% |
| E earned at 10 / 60 / 120 min | 9.6e+17 / 1.4e+26 / 1.7e+27 | 1.2e+9 / 2.8e+12 / 6.6e+13 |
| first copy of pointer, mouse, farm, factory, bank, temple, planet, galaxy, dimension, multiverse, bigbang, entropy, author (min) | 0.1 0.3 3.3 3.4 3.5 3.5 4.8 5.0 7.5 8.2 8.3 9.8 53.5 | 0.1 0.3 2.1 3.6 5.5 6.8 9.6 12.0 31.4 114.8 - - - |
| affordable buildings never bought | none | timeline simulation quantum cosmicstring |
| **autoclick15: first run** |  |  |
| ascension unlocked (min of play) | 1.9 | 27.3 |
| longest wait for something new, first 10 min (s) | 60 | 35 |
| new things bought in first 10 min | 231 | 83 |
| longest gap between purchases 0-10 / 10-30 / 30-60 / 60-120 min (s) | 55 / 120 / 135 / 685 | 30 / 160 / 90 / 339 |
| share of E from clicking at 5 / 10 / 30 / 60 / 120 min | 99% / 55% / 89% / 80% / 86% | 99% / 58% / 68% / 42% / 33% |
| E earned at 10 / 60 / 120 min | 1.2e+16 / 2.8e+25 / 5.5e+27 | 3.6e+8 / 2.8e+12 / 7.2e+13 |
| first copy of pointer, mouse, farm, factory, bank, temple, planet, galaxy, dimension, multiverse, bigbang, entropy, author (min) | 0.0 0.2 2.3 2.3 2.4 3.7 3.8 3.9 4.5 5.0 10.3 17.6 32.4 | 0.0 0.2 2.3 5.0 5.8 8.3 12.3 18.7 30.4 109.1 - - - |
| affordable buildings never bought | none | timeline simulation quantum cosmicstring |
| **casual: career (30 days)** |  |  |
| ascension #1: play min (run min, chips) | 13 (13, +1) | 31 (31, +1) |
| ascension #2: play min (run min, chips) | 23 (10, +1) | 51 (20, +1) |
| ascension #5: play min (run min, chips) | 44 (7, +15) | 151 (40, +10) |
| ascension #10: play min (run min, chips) | 71 (2, +1676) | - |
| min into the run until ascension unlocks, runs #1 / #2 / #5 / #10 | 13 / 10 / 4 / 1 | 31 / 20 / 10 / - |
| Final E #1 / #2 / #5 bought on day | 8.8 / 9.8 / 9.8 | 19.8 / 25.8 / - |
| wins (The Final E) / ascensions | 25 / 37 | 3 / 9 |
| income share click / buildings / golden / offline | 0% / 0% / 0% / 100% | 1% / 8% / 0% / 90% |
| chips after day 1 / 7 / 30 | 0 / 807 / 1.5e+8 | 0 / 2 / 184 |
| **active: career (30 days)** |  |  |
| ascension #1: play min (run min, chips) | 6 (6, +2) | 61 (61, +2) |
| ascension #2: play min (run min, chips) | 9 (3, +6) | 93 (32, +2) |
| ascension #5: play min (run min, chips) | 18 (3, +74) | 245 (59, +15) |
| ascension #10: play min (run min, chips) | 23.4 (0.4, +2.4e+6) | 420 (32, +238) |
| min into the run until ascension unlocks, runs #1 / #2 / #5 / #10 | 5 / 2 / 1 / - | 36 / 15 / 8 / 1 |
| Final E #1 / #2 / #5 bought on day | 1.7 / 1.7 / 1.7 | 8.7 / 10.7 / 14.7 |
| wins (The Final E) / ascensions | 25 / 34 | 8 / 19 |
| income share click / buildings / golden / offline | 55% / 45% / 0% / 0% | 37% / 30% / 5% / 29% |
| chips after day 1 / 7 / 30 | 2.3e+8 / 2.3e+8 / 2.3e+8 | 0 / 14 / 9.0e+4 |
| **optimizer: career (30 days)** |  |  |
| ascension #1: play min (run min, chips) | 4 (4, +3) | 61 (61, +3) |
| ascension #2: play min (run min, chips) | 5 (1, +396) | 91 (30, +3) |
| ascension #5: play min (run min, chips) | 7.6 (0.6, +2.1e+5) | 181 (30, +10) |
| ascension #10: play min (run min, chips) | 8.3 (0.1, +9.9e+5) | 296 (21, +67) |
| min into the run until ascension unlocks, runs #1 / #2 / #5 / #10 | 3 / 1 / - / - | 31 / 17 / 5 / 1 |
| Final E #1 / #2 / #5 bought on day | 1.3 / 1.3 / 1.3 | 4.8 / 5.3 / 7.3 |
| wins (The Final E) / ascensions | 25 / 29 | 9 / 29 |
| income share click / buildings / golden / offline | 63% / 37% / 0% / 0% | 69% / 20% / 4% / 7% |
| chips after day 1 / 7 / 30 | 4.4e+8 / 4.4e+8 / 4.4e+8 | 0 / 9732 / 3.3e+5 |
| **autoclick15: career (10 days)** |  |  |
| ascension #1: play min (run min, chips) | 3 (3, +5) | 44 (44, +2) |
| ascension #2: play min (run min, chips) | 4 (1, +357) | 68 (24, +2) |
| ascension #5: play min (run min, chips) | 8 (1, +2.6e+5) | 185.2 (40.2, +10) |
| ascension #10: play min (run min, chips) | 9.7 (0.3, +4.7e+6) | 316 (12.7, +180) |
| min into the run until ascension unlocks, runs #1 / #2 / #5 / #10 | 2 / 1 / 1 / - | 28 / 14 / 6 / 0.7 |
| Final E #1 / #2 / #5 bought on day | 1.7 / 1.7 / 1.7 | 6.7 / 8.7 / - |
| wins (The Final E) / ascensions | 25 / 30 | 4 / 11 |
| income share click / buildings / golden / offline | 73% / 27% / 0% / 0% | 79% / 5% / 0% / 16% |
| chips after day 1 / 7 / 30 | 4.8e+8 / 4.8e+8 / 4.8e+8 | 0 / 50 / 661 |
| **offline** (away E/hour vs playing E/hour, at 30 / 60 / 120 min) | 0.0% / 0.0% / 2.0% | 0.5% / 2.8% / 9.1% |
| **challenges** after 5 ascensions (min to goal, - = not in 3h) | noclick 12.4, clicksonly 0, noupgrades 0, nogold 0, inflation 0, speedrun 0, minimal 0, slowmo 0, amnesia 0 | noclick 35.6, clicksonly 43.8, noupgrades 100.7, nogold 109.8, inflation 49.5, speedrun 9.3, minimal 50.1, slowmo 99.9, amnesia 102.7 |
