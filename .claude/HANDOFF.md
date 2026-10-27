# Handoff (updated 2026-10-24)

## Where things stand
- Live: **r46** or newer (check `latest.json` on `main`). r40 added in-game pop-ups and chat on T; r41 fixed game-save sync. r39 made the whole launcher wear
  Grapevine's theme; r37 made Grapevine the launcher; r36/r38 shipped Sovereign. Everything above is on **`main`** in both repos (huntington-games and grapevine).
  Anyone (including other bots) can branch from `main`, change things and release; there are no private branches holding released work any more.
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
| Blocky Shooter V2 | 4.0 | released in r35 (classes, new weapons, Mall + Military Base, challenges, prestige) plus Grapevine names/friends on `main`; the wip copy is OLDER, do not restore it | source split into `Blocky Shooter V2/src/` (see below); next: the big update |
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

## Grapevine in the launcher + relay (on `main` in both repos; server runs the grapevine repo's `main`)
- Grapevine's server was reachable only over WebRTC, which school networks block. The fix is in the **grapevine** repo: `relay/` (HGNet over public MQTT relays
  on 443, end-to-end encrypted, raced against PeerJS) plus PeerJS TURN servers. The server is a $5 Vultr box (Atlanta); hosting guide: grapevine `deploy/DEPLOY.md`;
  database (Supabase): migrations run by themselves at server start (archive.js `migrate()`).
  **The server updates itself**: a systemd timer runs grapevine `deploy/update.sh` every 2 minutes; it follows grapevine `main`, restarts
  only when server files changed, rolls back a version that does not come up, and restarts a hung server. So to change the server:
  push to grapevine `main`, wait ~3 minutes. Never ask the owner to use a terminal. Machine setup lives in `deploy/provision.sh`
  (re-applied on every update). Test the updater with `bash test/update-test.sh` before pushing changes to it: if it breaks, nobody
  can fix the server without a terminal.
- Direct door: Caddy (auto-HTTPS on `<server IP>.sslip.io`) passes `/gv` to `relay/direct.js`; browsers learn the address from the
  signed relay key exchange and connect straight there afterwards (~0.3 s instead of seconds), falling back to the relays where blocked.
  GVLink (`relay/gvlink.js`, copied to `gv/vendor/gvlink.js`) does this by itself; `HGGrapevine.status().via` says 'direct' or 'relay'.
- Only servers that actually run belong in the archive lists (`CONFIG.archiveIds` in client.html, `archives` in gv/core.js): a missing
  one costs seconds whenever it is tried.
- The launcher IS Grapevine (`gv/`, see gv/README.md): an account gates the launcher, the Grapevine tab runs the full app signed in as the same account
  (`gv/app.html`, copied from grapevine `client.html` with `tools/sync-grapevine.sh`; rebuild `gv/account.js` with `tools/build-gv.sh`; the vendor copies in
  `gv/vendor/` come from grapevine `relay/`). Games read the account as `parent.HGGrapevine` (or `opener` in the New-tab copy).
- Game saves sync to the account (`HGGrapevine.sync`, core.js). Rules that matter: only keys matching `GAME_KEYS` travel (add a new game's key prefix there);
  a device meeting the account for the first time lets the cloud win (old value kept as `hgv:bak:<key>`); nothing is written into localStorage while a game is open;
  and `index.html` `gvBeforePlay` holds a game back (up to 25 s, with a skip button) until this visit's first sync has finished, because a game reads its save
  the moment it starts. Do not start a game before that: it would write a fresh save over the account's.
- In-game pop-ups and chat: `HG_notify` (called by the embedded app's `maybeNotify` and by core 'notify' events for friend requests) draws cards over the game;
  T opens a chat window (its own small iframe so the game never sees the keys) using `GVEmbed` from grapevine `client.html`. Per-game flags in the GAMES list:
  `chatShift` (Frontline: Shift+T because T is its tech tree) and `noChat` (the four Neon Dash games).
- Cards: Neon Dash 2.0 (folder "Levi Dash By Levi 2.0") is the last main game; credits: Levi (Neon Dash, Neon Drift), Robbie (Bean & Brew Classic, original Market & Life).
- Release: `tools/release.sh prepare` copies only named game folders, so for launcher-only changes do it by hand: `git worktree add --detach /home/user/hg-release origin/main`,
  merge/copy your work in, `HG_ROOT=/home/user/hg-release HG_TOOLS=/tmp/hg-tools python3 tools/build-release.py N`, write `latest.json` (`{"release":N}`), run
  `tools/tests/gate.js` and `gate2.js` (env `HG_BUILD=N HG_SECRET=$(cat /tmp/hg-tools/hg_secret.txt) HG_ROOT=... HG_TOOLS=... NODE_PATH=/opt/node22/lib/node_modules`),
  commit and `git push origin HEAD:main` (an Action tags rN). Run `tools/sync-grapevine.sh` and `tools/build-gv.sh` first so `gv/app.html` matches the server's client.
- Tests (need the Grapevine rig, grapevine test/README.md): `tools/tests/gv.mjs` (gate, accounts, friends, saves incl. the game-waits-for-saves check, Grapevine tab,
  cards, new tab), `tools/tests/gv-notify.mjs` (menu buttons, pop-ups, chat on T), `tools/tests/gv-games.mjs blocky|frontline` (run them one at a time).
- Achievements (`gv/ach.js`, built into gv/account.js): ~72 across all games, worked out from each game's own save keys (no game code needed;
  add one = one line). Unlocks in 'hgach:v1' (synced), summary sent to the server (`achSet`) and shown on Grapevine profile cards; Account >
  Achievements lists them and shares one into a chat ("... hg-ach:<game>:<id>" renders as a card). Sovereign writes 'sov.hgach' for its ones.
- Game invites: launcher API `HG_inviteTargets/HG_sendInvite/HG_takeJoin` (+ `HG_inviteGames/HG_hostInvite/HG_takeHost` for Grapevine's
  + menu "Invite to a game"); games implement `__hgJoin(code)` / `__hgHost(convId)` (Blocky 28b-mp-lan.js, Frontline). Messages end in
  "hg-invite:<game>:<code>" and render as Join cards. Test: tools/tests/gv-invite.mjs (also gv-ach.mjs, gv-saves.mjs).
- Server saves: if the DB role cannot use user_saves (no GRANT / row-level security) archive.js keeps saves in the settings table instead
  (`SAVES` in archive.js) - nothing to fix by hand.
- Sovereign 1.2 (src/js/67b-sim-conquest.js): conquest/controlled lands (nation.owner, tribute, unrest, uprisings), weekly fronts
  (`warWeek`), strikes push fronts (`f.push`), detailed fronts when zoomed in (`drawFronts`, Cam.alt < 0.75), World Domination.
- Connection speed: Account > Connection shows a step-by-step timeline of the last connection (milliseconds per step); ask a slow user for it.
## Blocky Shooter V2 source (split 2026-10-24)
- `Blocky Shooter V2/src/shell.html` (page HTML), `src/css/00-tailwind.css` + `10-game.css`, `src/js/00-imports.js` ... `28-mp-ui.js`
  (one ES module, joined in name order; files are unindented, `<!--@js indent=8-->` re-indents). Files follow the old section
  headers: state, ranks/classes/prestige, audio, engine, world, maps, Mall/Base, nav/collision, effects, view models, state machine,
  input/combat, 4.0 weapons, secondaries/gadgets, class abilities, enemies, waves/damage/XP, challenges, saved run, enemy AI,
  bosses, pickups/power-ups, physics/render, UI/shop, settings/menu (debug hook `window.__blocky`), multiplayer net/game/UI.
- `node tools/build-game.js "Blocky Shooter V2" --check` writes `index.html` (keeps the HG block). `release.sh prepare` rebuilds and
  ships the sources of any game that has `src/shell.html`.

## Blocky Shooter 5.0 (in progress on branch claude/pensive-planck-h9xqbg)
- Owner asked (2026-10-25): perf + lighting (Chromebook can't hold 60 on LOW), realistic guns, model upgrades, one UI theme
  (restyle CONTINUE SAVE), new start screen, Campaign (3 chapters), power-ups removed, same-wifi game scan, Grapevine invites. One 5.0 release.
- Round 1 built (game-finish run 2026-10-25, play-test 60/79 claims OK): all of the above. Still weak / to do: perf only
  ~10-20% better (draw calls 158->~132, enemy loop makes ~75 KB garbage/frame, LOW p95 17-18 ms at 4x CPU throttle on
  swiftshader); bosses kept old models; gun hand fit and screen position (overlaps HUD cards) need polish; flat map lighting;
  new enemies/final boss not in multiplayer; campaign difficulty untuned; wifi scan only tested with a fake transport.
- Launcher side of invites is in the hub `index.html` (HG_inviteTargets / HG_sendInvite / HG_takeJoin, invite pop-up with JOIN).
  The hub is NOT copied by `release.sh prepare`: port that block into `$W/index.html` by hand when releasing 5.0.

## Blocky Shooter 5.1 performance (r47, 2026-10-27)
- Owner: LOW could not hold 45 FPS on a Chromebook with other tabs open; Auto useless; no 50% resolution. Diagnosis: the
  Chromebook is CPU-bound (dropping to 50% res did not help), so the fixes cut per-frame processor work:
  zombies draw ONE instanced mesh per type (`ZM` in 16-enemies.js: merged parts + a float texture of part matrices, WebGL2;
  the old per-part `ZI` sets are the fallback), `scene.matrixWorldAutoUpdate = false` (frame() updates once, before the
  instances), hidden gun models skip matrix updates, limb pivots hidden from the renderer walk, effect meshes upload only
  used instances (`instUpload`) and hide when empty (`instFlush`), sky drawn after the world, Lambert gun on Low.
  With 32 zombies at 5x CPU throttle: 22-25 ms -> 13-15 ms per frame.
- Resolution: Low 85% (floor 70%); a step down is kept only if FPS rises 7% (`RES` in 23-physics-render.js), else it
  reverts (CPU-bound). Auto drops a tier when res can't help (between waves, or at once after 6 s under 40) and saves
  `blocky_autotier_fps` so the next launch only tries a better tier if fights held 58+. FPS overlay shows cpu ms.
- Probes (not in the repo): CDP `Emulation.setCPUThrottlingRate` 5 + a 480x270 viewport approximates a Chromebook CPU.

## Sovereign (grand strategy, released in r36)
Plan: `deliverables/sovereign-plan.md` (10 chunks, section 15). Owner decided: name Sovereign, REAL world leaders.
- Source is many files: `Sovereign/src/shell.html`, `src/css/*.css`, `src/js/*.js` (joined in name order into ONE
  ES module, so top-level names are shared), data in `Sovereign/data/*.json` (embedded as JSON script tags, read with
  `readData(id)`). `node tools/build-game.js Sovereign --check` writes `Sovereign/index.html` (the only file the Launcher
  loads; keeps the HG licence block). Always rebuild and commit index.html with source changes.
- Data: `node tools/sovereign-data.js` (npm packs world-atlas, world-countries, all-the-cities into $HG_TOOLS/sov-src;
  needs `npm i pbf@3` in $HG_TOOLS).
- Engine: three.js globe (radius 1), camera = lon/lat/alt with auto tilt, 110m map at boot, 50m built in background,
  one land mesh with a per-vertex country index + 256x1 colour texture (map modes = `MapModes.add(id, name, c => '#hex')`),
  2D overlay canvas for labels. Debug: `window.__sov` (`ready`, `detailed`, `info()`, `pick(lon,lat)`, `select(id)`, `flyTo`).
- Test locally: serve repo on a port, open `/Sovereign/index.html`, route three@0.160.0 as in CLAUDE.md.
- Chunk 2 done: sim in `src/js/60-62` (state, formulas, time/actions/saves), UI in `70-74`. Effects are measured
  against each nation's start (`n.base`) so the 2026 data is the starting point; AI nations run the same formulas plus
  `aiFiscal`. Balance check: run 120 x `__sov.worldMonth(true)` after `__sov.newGame(...)` and look for NaN/extremes.
  All chunks done (v1.0): 21-life (living map), 63 politics, 64 reaction, 65 elections, 66 diplomacy, 67 war, 68/68b events,
  69 progress, 75-79 screens. Systems register with SYSTEM_INITS / DAILY / MONTHLY (60-sim-state.js); ensureSystems() fills
  missing state so old saves keep working. Top-level code in a file may only use names from files that sort before it.
  Full-game check: start a game, call __sov.nextDay() in a loop and answer any #modal (see the play-through test idea in
  the plan). Release: `tools/release.sh prepare N Sovereign` now also copies Sovereign/src, data, tools and hub/sovereign.jpg.
- In the Launcher since r36 (card + `hub/sovereign.jpg`, 'Sovereign' in `tools/build-release.py` GAMES).