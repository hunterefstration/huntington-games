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
- `tools/setup-tools.sh` once per container (obfuscator, offline three.js and Tailwind for tests, in `/tmp/hg-tools`).
- `tools/release.sh prepare|finish` for releases; licence tests in `tools/tests/gate.js` and `gate2.js`.
- Playwright: `NODE_PATH=/opt/node22/lib/node_modules`, launch Chromium with
  `--use-gl=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`. No internet: route three@0.160.0
  to `/tmp/hg-tools/cdn/package/`, Tailwind to `/tmp/hg-tools/node_modules/tailwindcss-cdn/tailwindcss.js`.
- Serve locally with `python3 -m http.server <port>`; `localhost` skips the licence gate.

Current state and next steps: `.claude/HANDOFF.md`.
