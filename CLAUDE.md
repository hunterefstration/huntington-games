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
- Minigames share one lobby: edit `Minigames/_shared/mg.js|mg.css`, then `bash Minigames/build.sh`.

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
- Rate limits: launcher traffic classes are `soft` (refused, never punished). Pace bursts on the client (`paced`, `rpc`).

Current state and next steps: `.claude/HANDOFF.md`.
