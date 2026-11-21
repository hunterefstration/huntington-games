# Handoff (updated 2026-11-16)
Current state and the facts you need to change things. What each round did and why: `.claude/HISTORY.md` (grep it, do not read it all).

## Where things stand
- Live: **r79** (`latest.json` on `main`). r79 (Round 11): Admin menu (`launcher/js/10-hub/100-admin-menu.js`, top-bar tab `#tab-admin`, `#view-admin`; reuses 098-admin's data-padm buttons through 040's click handler); reports answered from it (grapevine 078 `reportAdmin op:'resolve'` act dismiss|warn|mute|tempban|ban + note to reporter); stored warnings + notices that wait for sign-in (grapevine `084-warn.js`, `~mod warn`, delivered from memory 3 s after hello; smod ops `info`, `clearwarns`); Rules dialog with TOS + what you can report (`099-rules.js`; keep in step with the Doc's TOS tab); report reasons slur/sexual/alt; casino rebalance (edges 1-3%, blackjack: tie on 21 wins, tie on 20 wins half, natural pays 1:1, H17, double hard 9-11, split aces one card, `view.tip` = bjTip); Eastern time (`estDay`/`estHour`/`estClock` in grapevine 010; ecoDay/statsDay/songDay; launcher `hgTime`); AFK 30 min (`HG_IDLE_MS`, `hgIdle()` in 050: play/goons/MP bonus; idle games pause via `AFK_MS`, `window.__hgAfkMs` in tests). Suites: gv-adminmenu, afk-idle. r78: Training in six games. r77: Beat Lab tutorials. r76: Beat Lab share codes. r75: content updates. r74: Round 10.
- Before `release.sh ship`, the hub `index.html` must hold the plain launcher build (one licence line after `HG_BUILD_N`), not a released copy (two lines): rebuild it with `node tools/build-game.js . --src launcher`. A released copy gives a doubled `})();` and the gate tests fail ("Unexpected token '}'").
- r70: admin "Rebuild from leaderboards" (`launcher/js/10-hub/098-rebuild.js`, suite `gv-rebuild`). r69: saves never lost (other-tab
  guard, mass-delete guard, server copies, admin lookup/restore, device backups; Saves tab "Look for older saves"; suite `gv-recover`).
- 2026-11-14 cleanup: launcher `001-util.js` (`hubShown`, `hubWake`, `setHtml`): hub repaint/poll timers skip work while a game is open or
  the tab is hidden and repaint when the hub is back. Removed the old `release.sh prepare/finish` path and Divergent's stale duplicate files.
- Back up unreleased work to `wip/content-wave` without touching HEAD or `main`:
  `GIT_INDEX_FILE=/tmp/wip-index sh -c 'git read-tree HEAD && git add -A && T=$(git write-tree) && P=$(git ls-remote origin refs/heads/wip/content-wave | cut -f1) && C=$(git commit-tree $T -p HEAD ${P:+-p $P} -m "WIP snapshot") && git push -q -f origin $C:refs/heads/wip/content-wave'`

## Playing on localhost (2026-11-21, branch `engine/hg3d`)
- The launcher's account ("recovery key") system is off and the public page is the r80 shut-down page, so the way to play now is local:
  `Play Huntington Games.cmd` (or `node tools/play.mjs [port] [--no-open]`) starts a server on 127.0.0.1:8090 and opens
  http://localhost:8090/. `/` is a plain menu (`tools/play.html`: cards, search, tag chips, "Jump back in"), filled at each request from the
  launcher's `GAMES` + `EXPERIMENTAL` lists; a game opens in a fresh iframe under a small bar (All games / Full screen / own tab).
- Games skip the licence gate on `localhost`. Saves are the browser's localStorage for `localhost:8090`: another port or browser starts fresh,
  which is why a busy port is an error. The built launcher itself still runs locally but stops at the Grapevine sign-in, so it is not used.
- Not there: accounts, leaderboards, launcher chat, saves from the old site. The 3D games still fetch three.js from jsDelivr.
- Test: `node tools/tests/play.mjs` (`HG_LIVE_CDN=1` on this PC).

## HG3D engine (branch `engine/hg3d`, 2026-11-21: NOT released, nothing pushed; `main` is still the r80 shut-down page)
- **What**: our own WebGL2 renderer for 4 GB Chromebooks. `engine/src/*.js` -> `engine/hg3d.js` (`const HG3D`); `node tools/build-engine.js`
  builds it and copies it into each game in its `TARGETS` list (`check.js` keeps the copies in step, `--fix` rebuilds). A game keeps making
  three.js objects (math, geometry, Mesh / InstancedMesh, lights); only the renderer object changes:
  `HG3D.pick('<game>') === 'hg' ? HG3D.createRenderer({ canvas }) : null`, else `new THREE.WebGLRenderer`. Same calls afterwards
  (`render`, `setSize`, `setPixelRatio`, `shadowMap`, `info`, `getContext`, `clear`).
- **Why it is faster**: lighting per vertex (the finished colour leaves the vertex shader when nothing is needed per pixel), one uniform
  block per frame and one `uniform4fv` per material, instance buffers uploaded only when changed and only their live part, the shadow map
  read with hardware comparison (4 taps; three uses 9-17), the sky drawn last, no scene-graph work beyond one flat walk. About 40% fewer GL calls.
- **A game's `onBeforeCompile` patches do not run under HG3D.** Each has a twin in `material.userData.hg = { vDecl, vPos, vAlbedo, vMain, fDecl,
  fAlbedo, fFinal, uniforms, customMap, sky }` (hook points: top of `engine/src/20-shaders.js`). Mayhem: `tumMat`, the fruit plates. Steel Storm:
  `HG_TERRAIN`, `HG_WATER`, `vehMat`. Change both when a patched shader changes. A `ShaderMaterial` runs unchanged.
- **Which renderer**: `?r=three` / `?r=hg` for one visit; Settings > Graphics engine (New / Classic) is kept per device in `hgdev_r_<game>`
  (`hgdev_` keys do not sync; never `hgq:`, those do). If HG3D cannot start (no WebGL2, a shader fails) `HG3D.bail` reloads the game on three.js.
- **Gate** (decided before measuring): median AND 95th-percentile frame time at least 20% lower in one run type, no worse in the others, same picture.
  Run types: cpu = main thread slowed 6x, gpu = an 8K picture on this PC's real GPU (pixel-bound), fill = software GL (SwiftShader).
  - **Mayhem Marathon: adopted.** cpu Medium 13.0 -> 7.6 ms (42%), Low 6.1 -> 4.2 (31%); gpu 18% / 5%; fill 32% / 20%. Picture 0.1-0.6 of 255 off
    three.js in all 21 rounds. Also gets `HG3D.governor` (picture size down to 70% under 50 FPS, back up when that does not help).
  - **Steel Storm: adopted.** cpu Low 7.3 -> 5.3 ms (27%), Medium 13.8 -> 8.8 (36%); gpu 2-7% (equal); fill 2-7%. Picture 0.07-1.0 of 255
    across Low/Medium/High x four weathers x town/shore and the 3D lobby. Vehicle bump maps are not drawn (Medium/High only, barely visible).
  - **Frontline: not adopted** (untouched). Median 22% faster on cpu but its slow frames (20 Hz sim ticks) only 3-16%, gpu equal. The working
    port is on branch `engine/hg3d-frontline`.
  - **Sovereign: not adopted** (untouched). Pixel-identical but 11% on cpu, nothing on gpu: its time is its own globe shaders and the sim.
  - **Blocky Shooter V2: not ported yet.** Biggest likely win (rendering is 70-75% of its cpu frame at its Chromebook tiers) and the biggest
    job: environment-map reflections for the gun (Standard + PMREM even on lite tiers), six `onBeforeCompile` patches (`worldLighting`, enemy
    glow / flash, matrix-texture zombies, smoke), two scenes per frame, layers, bloom tiers that must stay on three.js.
- **Tests**: `node tools/tests/hg3d.mjs` (governor logic, the no-three.js demo `engine/demo.html`, lost-context recovery, both games on both
  renderers, the speed test, the fallback). On this Windows PC there is no local three.js copy and no Python: `HG_LIVE_CDN=1` lets the tests use
  the real CDN (also `Mayhem Marathon/tools/test.mjs`, and `tools/tests/ss-menus.mjs http://127.0.0.1:8090 --solo` with `node tools/bench/serve.mjs 8090`).
- **Bench**: `node tools/bench/bench3d.mjs <game|all> --r ab --mode cpu,gpu,fill [--scn a,b] [--arg x]` (old vs new, interleaved, 3 runs).
  `--same [png] --scn <s> --arg a+b` draws the SAME paused scene with both renderers in one page and compares the pixels: the look check.
  A battle scene's camera wanders, so judge pixel cost (gpu) on fixed views (`steel --scn view --arg low,noon,town,0`).
- **Before any release**: check on a real Chromebook. In each adopted game, Settings > Speed test (20 s, times each frame including the wait for
  the graphics chip); run it once per engine (switch engine, reopen the game, run again) and the card shows both. If the new engine does not
  win there, set that game back (remove it from `TARGETS`, drop its `05-hg3d.js`, keep its three.js path).
- Also in the engine, unused by the games so far: a native API (`HG3D.node / mesh / instanced / geo / material / light / camera`) for a future
  game with no three.js download (three.module.js is 1.2 MB; the engine is 96 KB).

## Round 10 (r74, 2026-11-16): Beat Lab, Steel Storm 2.2 menus, multiplayer, game chat, Grapevine sidebar, moderation, activity
- **Beat Lab** (new game, `Beat Lab/src/`): Simple song grid + FL-style Studio on a DOM-free engine (`src/js/10-16-engine-*.js`,
  API at the top of `10-engine.js`). `tools/check.js --fix` joins the engine into `Beat Lab/engine.js`, which the launcher's music
  player (`080-music.js`) loads only when a player picks "Launcher music" in Beat Lab (`beatlab_launcher` = project id). Own test:
  `node "Beat Lab/tools/test.mjs"`. Saves `beatlab_p_<id>` (in GAME_KEYS).
- **Loading screen**: `launcher/boot.css` + `boot.html`, inlined into the hub and copied into `loader.html` (check.js keeps them in
  step, `--fix` copies). The loader hands its progress to the hub (`HG_LOAD_P`). Game loading screen in `097-loading.js` (card + tips).
  When `loader.html` changes, paste it into the Google Doc's Launcher tab (see HISTORY: The Google Doc).
- **Official rooms** (grapevine `010` OFFICIAL): #main, #announcements (read-only but Server/admins with announce), #multiplayer-codes
  (daily reset like #main), #music, #bugs-and-ideas. Everyone joins them at hello (one insert); they cannot be left or deleted.
- **Moderation** (grapevine `080-moderation.js`, frame `smod`; `mod` is a ROOM's own moderation in 060, do not reuse the name):
  Server account (`user_id 'server'`, name reserved), `banUser` (timed bans carry `[until <ms>]` in the reason; lifted at sign-in),
  n-word ladder `slurStrike` (1 day, 3, 7, for good; Server announces from the second; counts in `~mod slur:<uid>`), effects
  (mute, slow, nick, uwu, caps, backwards, mime, pirate, clown) in memory + one `~mod fx` row. Launcher panel: `098-admin.js` paMod.
  Suite `gv-mod`.
- **Spam**: `GUARD.tidy` (server applies before storing: char/chunk/blank-line walls, 12 lines) and a volume limit in `GUARD.spam`
  (3000 chars of long messages a minute); long messages compared by word pairs. GUARD is identical in grapevine 020 and client 060.
  Client folds messages over 600 chars / 8 lines.
- **Grapevine sidebar** (`client 030 paintSidebarNow`): chips, folding sections, pins/recency in localStorage (`gv:side:*`), no DB cost.
- **Multiplayer tab** (`090-parties.js`, shell `#mp-home`) and **multiplayer bonus** (grapevine `076`: same game party code, 2+ devices,
  2 goons / 10 min, double 3-5 pm Eastern, 20/day; `mpStatus`/`mpBonus`). Joining a party records its code (`030 joinInvite`).
- **Game chat** over launcher games (`097-gamechat.js`, grapevine `081-gamechat.js`): memory-only rooms `p:<gid>:<code>` or
  `g:<game>`; T opens it (games with `chatShift` use Shift+T). API `HGGrapevine.party.chatRoom/chatSay`.
- **Activity tab** (`098-activity.js`, grapevine `082-stats.js`): counts in memory, one `~stats` row saved every 10 min, answer cached 30 s.
- **One-time jobs** (grapevine `079-once.js`, `~once`): the BOBERTODAROBERTO rebuild ran from there.
- Auto-click guards (Brown E Clicker 095, Market Life 090): warn first, near-perfect timing over 40 fast clicks or 16+/s for 6 s.
- Suites added: `gv-mod`, `gv-social`.
- **r75 content**: Blocky 5.5 (`07d-maps-55.js`, HUNTED mode, 4 weapons, protocol bump: 5.4 and 5.5 refuse each other; test
  `tools/tests/blocky-55.mjs`). Last Light 1.5 (Frostveil 6-1..6-11, Glide, Trials with ghosts in `lumighost`; boards `lumi:lv6-*`,
  `lumi:medals` in grapevine 074; rebuild knows world 6). Sovereign 1.4 (`69b-sim-council.js`, `69c-sim-scenarios.js`, `68f-sim-events5.js`,
  online protocol 14). Mayhem 1.1 (21 rounds, save v2, protocol 2; test `Mayhem Marathon/tools/test.mjs`, `mp` for two players).
  Steel Storm 2.2 menus (`82-menu.js`, showcase `87-showcase.js`, test `tools/tests/ss-menus.mjs`).
- Launchers per account: 4 (grapevine 040); a launcher dropped for too many sessions waits 30-60 s (`gv/core.js` kickedAt), or two
  would knock each other off forever (each hello ~60 queries).
- `tools/tests/smoke.mjs` now lets three.js through (the block-all route used to win), so the 3D games really start in smoke.

## Admin powers, progress editor, nicknames, tags (r72, 2026-11-15)
- **Powers** (`ADMIN_PERMS` in grapevine `020`): reports, moderate, ban, announce, inspect, peek, rooms, titles, goons,
  accounts, progress, leaderboards, shop, dbuse, admins. The owner (`isFounder`) has all; each admin has a list in the save
  store (`~perm` / `map`); an admin with no list keeps the old "everything but admins". Check with `adminCan(uid, power)`
  (cached 30 s, cleared on change), never `isAdmin` for a power. `isDev` = the `shop` power. Handler `permsAdmin`.
  The eco view carries `perms` and `owner`; the launcher's Admin tools (`098-admin.js`, `paRender`) only draw what you may use.
- **Progress editor**: `savesAdminGet` (no keys = the list) / `savesAdminPut` (keeps the replaced copy under `~pre:<user>`,
  `freeze` = board prefixes to keep off the leaderboards, then nudges the player's launcher to sync: `savesNudge`).
- **Leaderboard freeze** (`lbMeta.freeze[uid][prefix]`, `lbFrozen`, handler `lbAdmin` freeze/unfreeze/remove): a frozen
  player keeps their places; their game's numbers stop counting until unfrozen.
- **Nicknames** (`nickSet`, `profile.nick`, cos `nn`): any words, other people's names too; the account name shows on hover
  and on the profile card. **Tags** (`tagSet`, `profile.tags`, cos `tg`): Owner/Admin, re-checked by `tagsOf` every time,
  so a nickname can never fake one. Shown in chat (`roleTagsHtml`), the launcher (`cosRoles`, `lbWho`). Games still use
  account names in their own multiplayer.
- Suite: `gv-admin.mjs` (22 checks).
- Steel Storm 2.1 (r72): BALANCE/ORD/RL_K/CHAR/ROLE tables in `Steel Storm/src/js/10-data.js`, missile steering in 40-sim.js, BOT_GEAR (bot gear by difficulty) in 60-match.js.

## Map
- **Launcher** = hub `index.html`, built from `launcher/` (shell.html, css/10-style.css, js/10-hub/NNN-*.js joined in name order).
  010 GAMES list + mirrors; 020 play/close, saves check (`gvBeforePlay`), Grapevine frame; 030 pop-ups over games, invites (`INVITE_GAMES`);
  040 profile, shop, leaderboards, admin tools; 050 goons/leaderboard feed (reads each game's save); 060 tour; 070 chat dock; 080 music;
  090 parties; 095 home; 096 games page + QoL (`WHATSNEW`: change its `id` and items every release; `NEW_NOW` features a game);
  097 loading; 098 game pop-ups, rebuild; 099 reports. A new game needs only its GAMES entry (+ `hub/<img>.jpg`, + `tools/build-release.py` GAMES).
- **Account layer** `gv/`: `core.js` (connect, save sync, `GAME_KEYS`), `ach.js` (achievements from save keys, one line each), `ui.js`
  -> `gv/account.js` (`bash tools/build-gv.sh`). `gv/app.html` = Grapevine's client (`bash tools/sync-grapevine.sh`). Games use `parent.HGGrapevine`.
- **Grapevine** repo (server + client): `src/archive/NNN-*.js` -> `archive.js`, `src/client/` -> `client.html` (`node tools/build.mjs --check`).
  Server pieces: 030 fan-out, 040 hello (`LITE_OK`), 060/070 saves, 074 catalog, 075 economy + leaderboards, 076 parties, 077 casino
  (contract `Casino/API.md`), 078 reports. **The server updates itself** from grapevine `main` every ~2 min (`deploy/update.sh`; test changes
  to it with `bash test/update-test.sh`). Never ask the owner to use a terminal. Migrations run at server start.
- **Games**: each `<Game>/src/` -> `index.html`. Debug hooks: `__blocky`, `__sov`, `__lumi` (Last Light), `__mayhem`, `__steelstorm`,
  `__td`, `__fl` (`?debug`), `__tg` (`?debug`), `__clicker`. Per-game tools: Last Light levels are generated (`Last Light/tools/levels.py`,
  never hand-edit `70-levels.js`); Brown E Clicker numbers in `src/js/10-game/005-balance.js` (`tools/sim.js` re-tests) and prebuilt
  Tailwind (`tools/tailwind.sh`, must stay after the game's own styles); Element Lab reactions in `data/reactions.tsv`; Sovereign data via
  `node tools/sovereign-data.js`, systems register with SYSTEM_INITS/DAILY/MONTHLY and `ensureSystems()` keeps old saves working.
- Divergent Project is the one game outside the build: the launcher loads its self-contained `jsbin.html`.
- **Beat Lab** (music studio): `src/js/10-16-engine-*.js` are a standalone Web Audio engine (API documented at the top of
  10-engine.js; `BeatLabEngine.fromSave(localStorage beatlab_p_<id>)` plays any saved song, e.g. for the launcher's music
  player). Saves: one project per `beatlab_p_<id>` key. Debug hook `__beatlab`; test: `node "Beat Lab/tools/test.mjs"`.
  1.2 tutorials: `src/js/80-tutor.js` (coach-mark engine `Tutor`, API at its top; lessons; Learn hub; "?" helper). Lessons run in
  practice projects whose ids are in `A.temp` (Store.save skips them); done lessons in `beatlab_set` `.tut`. Reuse its look for other games.

## Rules that matter
- **Saves**: only keys matching `GAME_KEYS` sync. Sync is a three-way merge (`meta[k].b` base hash; both changed -> more progress wins,
  `saveScore`); the server refuses a put with clearly less progress unless `base` matches (`saveLess`). Nothing is written to localStorage
  while a game is open, and a game never starts before this visit's first sync (`gvBeforePlay`): it would overwrite the account's save.
  `roomForSaves()` keeps ~1 MB of localStorage free (chat caches share the origin).
- **Rate limits**: launcher traffic classes are `soft`; clients pace bursts (`lbSubmit`/`ecoClaim` 3/s, save rpcs 350 ms apart).
- **Archive lists** (`CONFIG.archiveIds` in client.html, `archives` in gv/core.js): only servers that run; a dead one costs seconds.
- **Owner decisions**: goons have no real-money value (casino says so; keep it). No name colours or buyable custom titles (retire shop items
  with `removedPrice()`). Earned (`ra`) titles cannot be given, not even to admins; keep them out of patch notes. Real world leaders in Sovereign.

## Database egress (free plan: 5 GB a month, about 7 MB an hour)
Supabase bills every byte the database sends to our one server. r68 cut it from ~280 KB to ~12 KB per player-minute by keeping things in
memory (grapevine `src/archive/`): save lists (`SAVES`/`listOf` in 070, 10 min), message backstop reads only numbers (`fannedSeq`, 030),
member lists only for people connected here (`memberIds`, 30 s, dropped by `MEMBER_CHANGE`), one shared online-list read per burst
(`pushRosterSoon`), profiles (`PROF_C`, 5 min), room members (`snapMembers`, 1 min), backlogs (`BACKC`, dropped by `MSG_CHANGE`); other
archives are notified only while someone is on them (`archCheck`). q() weighs every answer (`dbWeigh`); admins see MB/h in Profile, Admin,
"Database use". **Any new query per message, per sync, per connect or on a timer must be cached; check with `bash tools/rig/test.sh gv-egress`.**

## Releasing
1. Grapevine changed? Push its HEAD to its `main` first (the server must be ahead of the launcher).
2. `HG_TRAILER="<trailer lines>" tools/release.sh ship <N> "<message>"` from the clean work branch (does everything; see the script header).
   A hotfix that must leave out other work: branch from `origin/main`, cherry-pick, ship from there.
3. Google Doc `1mldLgaLnYbVsh87x216u8YCePpBOO0OgunbunqaWA08`, Information tab `t.spxklapold80` (Patch Notes `t.2nj6za60e3b8`): replace the
   two lines under "Latest Release" ("Launcher build rN, released <weekday, Month D, YYYY at H:MM AM/PM> Eastern Time (EDT/EST)." and
   "Newest update: ...") with `replaceAllText` scoped to that tab. Time:
   `TZ=America/New_York git log -1 --format=%cd --date=format-local:'%A, %B %-d, %Y at %-I:%M %p %Z' rN`.
   Other tabs: Terms `t.1e55unjqj026`, Launcher code `t.ji1wotvgzga4`, Setup `t.ppvs6ddwlyfo`.

## Tests worth knowing
- Launcher suites (rig): `gv-lb` (every board), `gv-saves`, `gv-recover`, `gv-rebuild`, `gv-qol`, `gv-shop`, `gv-casino` (+ `gv-casino-ui`,
  4 min), `gv-report`, `gv-flood`, `gv-merge`, `gv-ban`, `gv-hub`, `gv-invite`, `gv-egress`. No rig: `blocky-classes*.mjs`, `load.mjs`, `smoke.mjs`.
- Known stale Grapevine failures (old code fails them too): e2e-polish (/help, /shrug, new-account offer x2), e2e-v2 (two image tests).

## Open
- Blocky 5.4: most specialisations, bots' class effects and the Elite mid-wave switch were never play-tested. The 6-digit-code automatic
  reconnect needs PeerJS (not reachable offline) and is untested.
- Possible next win: minify built files at release (esbuild, whitespace+syntax only) cuts downloads ~13% after gzip, but release commits
  are fast-forwarded into the work branch, so `tools/check.js` would need to compare un-minified output first.
