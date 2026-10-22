# Handoff (updated 2026-10-15)

## Where things stand
- Live: release **r33** (100 Levels of Spikes 2.0), released Oct 14 2026, 6:16 AM EDT. Launcher code in `loader.html`.
- Unreleased content updates live on branch **`wip/content-wave`** (not on `main`). Restore them into a checkout of `main` with:
  `git fetch origin wip/content-wave && git checkout origin/wip/content-wave -- "Blocky Shooter V2" "Tower Defense 2.0" Frontline Tetris "Coffee Shop NEW" "Brown E Clicker" "Market Life 1.9" "50 Levels Of Spikes 1.2" src/hgnet.js src/hgnet-test.html src/hgnet-README.md`
  then `git reset -q` so nothing is staged. Do not commit these to `main` until each game passes its play-test.
- Back up work in progress (leaves HEAD and `main` alone):
  `GIT_INDEX_FILE=/tmp/wip-index sh -c 'git read-tree HEAD && git add -A && T=$(git write-tree) && P=$(git ls-remote origin refs/heads/wip/content-wave | cut -f1) && C=$(git commit-tree $T -p HEAD ${P:+-p $P} -m "WIP snapshot") && git push -q -f origin $C:refs/heads/wip/content-wave'`

| Game | Version | Built | Left to do |
|---|---|---|---|
| Frontline | 3.0 | Iron Legion faction, navy + 5 maps, night/weather, General perks | play-test + fix |
| Tetris | 2.0 | ranks, perks, bosses, daily, achievements, 70 puzzles, themes, tutorial | play-test + fix |
| Coffee Shop NEW (Bean & Brew) | 2.0 | cities, recipes, staff skills, events, franchises, seasons, story, latte art | play-test + fix |
| Tower Defense 2.0 | 3.0 | heroes, 18 towers, alien era, 12 maps, stars, bosses, daily, map editor | play-test found issues; fix + re-test |
| Blocky Shooter V2 | 4.0 | 4 classes, 5 weapons (+ attachments?) | chunk "Maps and progression", then play-test |
| Brown E Clicker | 2.0 | 24 buildings, 287 upgrades, golden E, 126 achievements, offline earnings | chunk "Ascension 2.0...", then play-test |
| Market Life 1.9 (Market & Life) | 2.0 | life sim: education, careers, housing, cars, health, family, retirement | chunk "Market and business depth", then play-test |
| 50 Levels Of Spikes 1.2 | 2.0 | released in r33 (the wip copy matches) | nothing |

Plan: run ONE game at a time with the `game-finish` workflow, release it (`tools/release.sh`), update the doc, repeat.

## Running a game through `game-finish`
`Workflow({name: 'game-finish', args: {chains: [ <one entry below> ]}})`. Entries with `chunks: []` only play-test and fix.
```
{"slug":"frontline","title":"Frontline: Command (3D RTS, three.js; debug via ?debug -> window.__fl)","dir":"Frontline","port":8803,"version":"3.0","claims":["Iron Legion faction (24 units, shields, upgrades, AI commander Kael, online faction pick NETV=2)","5 new maps incl. 2 coastal with Shipyard, Gunboat, Landing Craft, Destroyer and naval AI","Night battles and rain/fog/snow weather options","General perk tree (18 perks, 3 branches), off online","What's New 3.0 screen, new achievements, Field Guide/lore"],"chunks":[]}
{"slug":"tetris","title":"Tetris Surge (canvas; debug via ?debug -> window.__tg)","dir":"Tetris","port":8804,"version":"2.0","claims":["Rank ladder for Surge/Sprint/Ultra/Marathon with promotion animation and Ranks screen","14 new perks, 5 new bosses","Daily challenge with streaks and history","48 achievements page","70-puzzle Puzzle mode with stars, undo and hints","12 block skins, 8 backgrounds, Customize screen","Hold and T-spin tutorial"],"chunks":[]}
{"slug":"coffee","title":"Bean & Brew Tycoon","dir":"Coffee Shop NEW","port":8805,"version":"2.0","claims":["5 new cities with rent and customer types","Recipe Lab crafting, recipe book, menu specials","Staff levels and skill trees, training","Random events with choices","Franchises with managers and chain overview","Decorations","Seasons and holidays","Story/career chapters","Latte art mini-game"],"chunks":[]}
{"slug":"td","title":"Tower Defense (2D canvas; debug window.__td)","dir":"Tower Defense 2.0","port":8802,"version":"3.0","claims":["6 heroes with 2 abilities each","18 new towers incl. Alien tab","7 alien enemies and Mothership boss","12 new maps with terrain, map select with stars","Campaign length and boss waves every 10","Daily challenge","Map editor with share codes"],"chunks":[]}
{"slug":"blocky","title":"Blocky Shooter (3D zombie FPS, three.js; debug window.__blocky)","dir":"Blocky Shooter V2","port":8801,"version":"4.0","claims":["4 classes with X abilities and upgrade trees","Dual Pistols, Katana, Grenade Launcher, Tesla Gun, Railgun"],"chunks":[{"name":"Maps and progression","brief":"Add 2 new maps with the existing map system (working navigation, spawns, lighting): MALL (two floors, stores, stairs/escalators, food court) and MILITARY BASE (hangars, watchtowers, bunkers, fences, helipad). Add CHALLENGES: 3 daily + 3 weekly rotating challenges tracked across runs, saved, with XP/cash rewards and a Challenges panel showing progress and time left. Add PRESTIGE at max rank (rank resets, prestige badge in menu/HUD, small permanent bonus). Update Bestiary/stats/controls pages. Partial work for this chunk may already be in the file."}]}
{"slug":"clicker","title":"Brown E Clicker (Tailwind UI; debug window.__clicker)","dir":"Brown E Clicker","port":8806,"version":"2.0","claims":["24 new buildings, progressive unlocks, buy x1/x10/x100","287 upgrades incl. tiers and synergies","Golden E with 4 effects and timers","126 achievements, stats page","Offline earnings with welcome-back popup"],"chunks":[{"name":"Ascension 2.0, minigames, events, skins","brief":"Ascending gives Heavenly Chips spent in a PRESTIGE TREE of 30+ permanent upgrades (tree screen). CHALLENGE RUNS (restricted ascensions with permanent rewards). 2 MINIGAMES unlocked by buildings: E-GOODS MARKET (buy low, sell high) and E GARDEN (seeds grow, give buffs, mutations). Timed seasonal EVENTS with special golden E effects, E SKINS/backgrounds unlocked by achievements, a funny NEWS TICKER, settings (reduced effects, number format). First ascension in about 30-60 minutes."}]}
{"slug":"market","title":"Market & Life (life + stock market sim)","dir":"Market Life 1.9","port":8807,"version":"2.0","claims":["Tabbed UI; character creation; aging to retirement with Life Score summary and Hall of Lives","22 education programs with loans","Careers with promotion ladders","Housing with mortgages, cars, health/happiness, family, random life events"],"chunks":[{"name":"Market and business depth","brief":"30+ stocks across sectors with sector NEWS EVENTS, per-stock price CHARTS, DIVIDENDS, SAVINGS and BONDS with interest, volatile CRYPTO, LIMIT ORDERS, PORTFOLIO screen with P/L. Several business types with employees, upgrades, marketing and monthly reports, plus the existing corporation flow. 20+ ACHIEVEMENTS and a stats page. Keep the economy challenging and saves compatible."}]}
```

## Releasing a finished game
1. `sh tools/setup-tools.sh` (once per container).
2. `tools/release.sh prepare <N> "<game dir>"` (N = newest tag + 1). The first release after r33 also renames the hub to "Launcher".
3. Edit that game's card in `/home/user/hg-release/index.html` (name with version, `desc` starting "NEW x.y: ...", `tags` with 'New').
4. `HG_TRAILER="Claude-Session: <session url>" tools/release.sh finish <N> "<Game x.y: summary>"`: runs the 9 licence tests and pushes only if all pass.
5. Update the doc (below).

## The Google Doc
ID `1mldLgaLnYbVsh87x216u8YCePpBOO0OgunbunqaWA08`. Tabs: Terms of Service `t.1e55unjqj026`, Launcher (code) `t.ji1wotvgzga4`,
How to Set Up the Launcher `t.ppvs6ddwlyfo`, Information `t.spxklapold80` (Patch Notes child `t.2nj6za60e3b8`).
After each release, replace the two lines under "Latest Release" at the top of Information:
"Launcher build rN, released <weekday, Month D, YYYY at H:MM AM/PM> Eastern Time (EDT/EST)." and "Newest update: ...".
Get the time with `TZ=America/New_York git log -1 --format=%cd --date=format-local:'%A, %B %-d, %Y at %-I:%M %p %Z' rN`.
Use `replaceAllText` scoped to the Information tab (cheaper than reading the whole doc). The Docs API cannot rename tabs.

## Multiplayer library (src/hgnet.js, not integrated in any game yet)
Built, 324 local checks pass. Stress test found, still to fix:
- BLOCKER: host tab hidden more than 5 minutes (Chrome throttling) makes the room vanish, kicks hidden guests.
- major: one-way WebRTC failure keeps guest sending into a dead channel for 30 s.
- minor: phantom join/leave when a guest leaves right after joining; ~10 s recovery after an outage; a spoofed goodbye ends the room; README advice for hidden hosts gives guests ~1 snapshot/s.
Real cross-network test (two Chromebooks, different states) still needed before games switch to it.

## Grapevine Lite + Grapevine relay (branch claude/intelligent-goodall-akekpu, NOT released)
- Why Grapevine failed at school: its server is a home Mac reached over WebRTC; school networks block that. Blocky works because two
  browsers just need to find each other. Fix lives in the **grapevine** repo (same branch name): `relay/` (HGNet over public MQTT relays on 443,
  end-to-end encrypted, raced against PeerJS) + the same PeerJS TURN servers Blocky uses. The owner must restart `archive.js` and paste the new client.html.
- **Grapevine Lite** = the launcher's second tab (`lite/` here; `tools/build-lite.sh` builds `lite/lite.js`). Same account/recovery key, relay link to the
  real server. `window.HGLite` is what games read as `window.parent.HGLite`: `me()`, `friendState()`, `addFriend()`, `prove()`/`check()`.
  The hub (index.html) was restyled to Grapevine's amber/dark theme (CSS variables at the top); the licence block is untouched.
- Games with multiplayer (Blocky Shooter, Frontline): name locked to the Lite name, host and guest prove their account to each other
  (challenge -> signed proof, checked against the server's public key for that name), verified players get a check mark and a +Friend button.
  Their transports are unchanged. Other games have no multiplayer.
- Release: `tools/release.sh prepare` copies only the named game folders from the checkout; the hub (index.html) and `lite/` must be copied into
  the worktree by hand before `finish` (they are not game folders), and the release must also add `Blocky Shooter V2` and `Frontline`.
- Tests: `tools/tests/lite.mjs` (tab, accounts, friends, proofs) and `tools/tests/lite-games.mjs` need the Grapevine rig (see its test/README.md and relay notes).
- Lite config (archive ids, pinned server key) is copied in `lite/core.js`; keep in step with Grapevine's `client.html` CONFIG.
