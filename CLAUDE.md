# Huntington Games

Single-file browser games (each `<Game>/index.html`, inline JS/CSS) played on school Chromebooks through the
Launcher (`loader.html` pasted into jsfiddle/jsbin, which loads the hub `index.html` from jsDelivr tag `rN`).

## Usage limits are tight: work efficiently
- Never read a whole game file (they are 5k-20k lines). Grep with line numbers, then Read only the ranges you need.
- Make targeted edits. Do not rewrite or re-read large sections you already know.
- Verify in the browser through the game's debug hook (`window.__<slug>`) with `page.evaluate` assertions.
  Screenshots only for new UI layout, at most 2 per task.
- Keep tool output small: pipe logs through `tail`/`grep`, never print whole files or big JSON.
- Subagents: use `model: "sonnet"` and `effort: "medium"` unless a task truly needs more; at most 2 at a time;
  ask for short reports. One game at a time. Use the `game-finish` workflow (`.claude/workflows/game-finish.js`).
- Keep replies to the owner short and plain.

## Hard rules
- Never edit the `<!--HG-->...<!--/HG-->` licence block in any game; `tools/build-release.py` owns it.
- Never commit the licence secret (it lives only in `$HG_TOOLS/hg_secret.txt`, outside the repo, and rotates every release).
- Never commit unfinished game work to `main`: `main` is live (GitHub Pages) and releases are tagged from it.
  Back up work in progress to the `wip/content-wave` branch with a temporary index (see `.claude/HANDOFF.md`).
- Keep existing saves working: migrate, never wipe.

## Tools
- EVERY game is built from many files in `<game>/src/` (+ `data/`): edit those, never its `index.html`, then
  `node tools/build-game.js "<game dir>" --check` and commit the sources and the rebuilt `index.html` together.
  Sovereign, Blocky Shooter V2 and Last Light join `src/js/*.js` into one module (`<!--@js-->`); the older games were split
  by `tools/split-game.py` and paste their pieces back in verbatim (`<!--@inline js/10-game/-->`), plain scripts and all.
- The launcher hub too: edit `launcher/` (shell.html, css/, js/10-hub/ pieces), then `node tools/build-game.js . --src launcher --check`.
  Grapevine: edit `grapevine/src/`, then `node tools/build.mjs --check` there (see grapevine/CLAUDE.md), then `bash tools/sync-grapevine.sh` here.
  `gv/account.js` is built from `gv/core.js`, `ach.js`, `ui.js`: `bash tools/build-gv.sh`.
- STEEL STORM REMASTERED is the folder `Steel Storm Rebuilt/` (the old game's code on Blender models and new battlefields; no
  ships; own save `steelstormr_save`). The folder `Steel Storm Remastered/` is an abandoned first attempt, unlisted. Models:
  `node tools/ss-parts.mjs` (measurements), `tools/blender/make_ss_*.py`, `node tools/ss-check-model.mjs`, `node tools/ss-check-kit.mjs`.
  Its battlefield is ONE ISLAND in an open sea (`assets/island.hgm`, `tools/blender/make_ss_island.py`, export `node tools/export-art.mjs island`),
  drawn by HG3D under the old game; the sea and the border are code (`src/js/29-tiles.js`). Its menus wear the first remaster's look
  (`src/css/50-remaster.css`). `?tiles=0` (and three.js) uses the old game's own four grounds. The owner's bar for it: as realistic as possible.
  Tests: `tools/tests/ssx.mjs [grounds tiles battle models save]` and `live --build=N --repo=owner/name`, `tools/tests/light.mjs`,
  pictures and pixel probes with `tools/tests/ssx-shot.mjs`.
- ASHFALL is the zombie shooter (Blocky Shooter's successor): no crystals, no growth. Its maps and figures are built with `plain`
  (`blender -b art/ashfall/<map>.blend -P tools/blender/make_<map>.py -- plain`): without `plain` a script grows the crystals back.
  Its look is MIDDAY Blocky Shooter (the owner, 2026-11-25); SETTINGS has a time of day (`TIMES`, 20-world.js: the day bake regraded).
  New zombie models follow the image -> image-to-3D pipeline in HANDOFF (2026-11-25); the prompts are `art/ashfall/zombie-prompts.md`.
- THE LAB (`Lab/index.html`) is the owner's private test page. Lab games NEVER go into the real launcher without his word. Its fourth tile
  loads the launcher of release r79 from the CDN as it was; it hands the signed-in name to games as `window.HG_USER`.
- HIGHBEAM is the racing game's name on screen; its folder, save key, debug hook and tests still say NIGHTLINE (do not rename them).
  Handling is tuned by measurement: `node tools/tests/nl-feel.mjs`. P on its menu is a TEMPORARY admin unlock (remove or gate at release).
- NIGHTLINE (`Nightline/`, racing, HG3D only): a circuit is numbers (`art/nightline/tracks.json` -> `node tools/race-track.mjs` ->
  `src/js/13-trackdata.js`, never edited by hand) and its scenery is one baked file (`tools/blender/make_nl_<quay|skyway|ridge>.py`,
  export only by name: `node tools/export-art.mjs quay`). The twenty cars: `tools/blender/make_nl_cars.py` (writes `src/js/27-fleetdata.js`
  and one export description a car; `preview=1` for pictures). Tests: `tools/tests/nightline.mjs [track car race save garage draw circuits]`,
  pictures `tools/tests/nl-shot.mjs` (`circuit=skyway` in the query).
- Minigames share one lobby: edit `Minigames/_shared/mg.js|mg.css`, then `bash Minigames/build.sh`.
- The HG3D engine (our renderer; Mayhem Marathon and Steel Storm draw with it, three.js is their fallback): edit `engine/src/`,
  then `node tools/build-engine.js` (it copies `engine/hg3d.js` into each game's `src/js/05-hg3d.js`: never edit the copies)
  and rebuild those games. A game's `onBeforeCompile` patch needs its twin in `material.userData.hg` (HANDOFF, HG3D engine).
  Shafts of light: `renderer.rays()` after the last render and before `bloom()`, EVERY frame, when the sky is drawn open
  (`HG3D.skyDome(tex, r, { open: true })`): see 55-bloom.js. Test with `node tools/tests/hg3d.mjs`; compare with three.js with `node tools/bench/bench3d.mjs` (speed, and `--same` for the picture).

## Checking and testing (use these, do not reinvent them)
- `node tools/check.js` (2 s): every built file matches its sources, every launcher game is in the release list and has
  its picture. `--fix` rebuilds what is out of step. The pre-commit hook (`.githooks`) runs it for the games in the commit.
- `bash tools/verify.sh` (2 min, no rig): check + `tools/tests/smoke.mjs` (every game opens, no script error) +
  `tools/tests/load.mjs` (the CDN download path with slow/dead mirrors). `--full` adds every rig suite.
- The rig (Postgres, brokers, a Grapevine server, this repo on :8090) is scripted in `tools/rig/`:
  `setup.sh` once per container (the session-start hook runs it), `up.sh` after a restart, `reset.sh` before each launcher
  suite, `test.sh [suite...]` runs suites with one summary line each, `gv-suite.sh test/e2e-eco.mjs` runs one of Grapevine's.
  Grapevine's full battery (35 min): `bash tools/rig/gv-battery.sh` (sets the database password the battery needs,
  stops the rig's server first, brings the rig back after). Never run launcher suites while it runs.
- Launcher suites are `tools/tests/gv*.mjs` (copy the first 61 lines of `gv-saves.mjs` for the rig helpers).
  New launcher feature = a new or extended suite; a leaderboard change must keep `gv-lb.mjs` passing (it plants each
  game's save and checks the number on each board).
- Playwright: `NODE_PATH=/opt/node22/lib/node_modules`, launch Chromium with
  `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. No internet: route three@0.160.0
  to `/tmp/hg-tools/cdn/package/`, Tailwind to `/tmp/hg-tools/node_modules/tailwindcss-cdn/tailwindcss.js`.
- Serve locally with `python3 -m http.server <port>`; `localhost` skips the licence gate.
- Lab tickets: the owner writes them in the Lab, the scheduled task `lab-tickets` reads them hourly with `node tools/tickets.mjs`
  (HANDOFF, LAB TICKETS). A long job in a chat session takes the lock first: `node tools/tickets.mjs lock "what"`, then `unlock`.
- Playing without the launcher: `node tools/play.mjs` (or double-click `Play Huntington Games.cmd`) serves the folder on
  http://localhost:8090/ with a plain games menu (`tools/play.html`, filled from the launcher's GAMES list): no account,
  no codes. Test: `node tools/tests/play.mjs` (every game opens from the menu, no licence screen).

## Releasing
- `tools/release.sh ship <N> "<message>"` does the whole release from the work branch (clean tree, check.js, licence
  build in a worktree, gate tests, secret-not-in-diff, smoke test on the release build, push to main, fast-forward the
  branch, wait for tag rN). Set `HG_TRAILER` to the commit trailer lines. If Grapevine changed, push its HEAD to its
  `main` first (the server follows `main` and must be ahead of the launcher).
- Every release re-keys the licence inside every game, so a game copy from release N only runs under hub N.

## Things that have bitten before
- A new reply type from the Grapevine server must be added to `LITE_OK` (040-hello...js) or launcher sessions never get it.
- A new save key needs a prefix in `GAME_KEYS` (gv/core.js) or it does not sync; settings-like keys use `hgq:`.
- The launcher wraps `playNow`/`closePlayer`/`render` in later pieces: call them by name, never keep a reference.
- Leaderboard feeds (launcher `050-goons-feed.js`) read each game's save: when a game's save format changes, update the
  feed and `gv-lb.mjs` in the same commit.
- Brown E Clicker's Tailwind CSS is built ahead of time (`Brown E Clicker/tools/tailwind.sh`); a new Tailwind class
  there needs that script run (check.js notices). No game may load `cdn.tailwindcss.com` any more.
- Database egress is billed (free plan: 5 GB a month, ~7 MB an hour). Never read a list or a row per message, per sync, per
  connect or on a timer without caching it; check with `bash tools/rig/test.sh gv-egress` (see HANDOFF, Database egress).
- On the owner's Windows PC a hidden (headless) Chromium that locks the pointer really traps his mouse in a box at the top
  left of the screen. Ashfall, Steel Storm Remastered and Proof Slice skip the lock when `navigator.webdriver` is set
  (`lock()` in each `10-core.js`); a test of any other game that clicks into play must stub `requestPointerLock` first.
- A copy of a released game's folder carries that game's licence block in its `index.html` (`build-game.js` keeps it), and the
  copy then says "unauthorized copy" everywhere but localhost, where every test runs. A new game made from a copy: delete its
  `index.html` and build it from the sources. `tools/tests/ssx.mjs live` runs from a non-local host for this reason.
- `node tools/export-art.mjs` with no name exports EVERY art description and overwrites hand-repainted pictures (Ashfall's
  skies). Always name the description; tell every art helper so in its brief.
- Rate limits: launcher traffic classes are `soft` (refused, never punished). Pace bursts on the client (`paced`, `rpc`).

Current state and next steps: `.claude/HANDOFF.md`.
