# Handoff (updated 2026-11-21)
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

## Next big thing: realistic shooter + Steel Storm upgrade (plan agreed 2026-11-21; step 1, the proof slice, is built: next section)
- Owner's decisions: **Chromebook first** (4 GB, integrated graphics must run it smoothly); art from **Blender through the Blender MCP**
  plus **free-licence libraries** (Poly Haven, ambientCG, Quaternius need no account; Mixamo needs the owner's free Adobe login, he signs in
  himself in the Browser pane). He offered to set up further tools on request.
- Blender MCP: `uvx mcp-for-blender`, add-on listening on 127.0.0.1:9876 (answered `get_scene_info`). Registered for this folder and
  `Claude Work` on 2026-11-21 (`claude mcp add blender -- uvx mcp-for-blender`): a session started after that has the Blender tools,
  with Blender open and the add-on connected.
- The approach: do the expensive lighting offline in Blender (lightmaps, ambient occlusion, light probes, baked reflections), ship real models
  with 3 detail levels and texture sheets, mocap animation with GPU skinning (Blocky's matrix-texture trick), cheap atmosphere/effects/sound.
  HG3D needs: an asset loader (binary models, compressed textures), lightmaps + probes, skinned animation, detail levels + culling, streaming,
  a memory budget. Starting Chromebook budgets to tune on the real device: ~100 MB textures, ~150 draw calls, ~150k triangles in view,
  30 FPS floor / 60 target. Games stop being one HTML file: assets ship beside them (fine on localhost).
- New shooter: Blocky's game (waves, classes, bosses, Hunted, campaign, multiplayer) with a realistic look; working title "Holdout"
  (owner has not picked the name). Steel Storm: real vehicle models, sculpted terrain with baked light, then systems in this order:
  armour and ballistics with module damage, vehicle physics and flight model, spotting and sound, combined-arms objectives, smarter bots.
- Order: (1) proof slice: one small map + one gun + one enemy, and one tank on one terrain tile, must look right and hold 30+ FPS on the
  owner's real Chromebook before any content at scale; (2) engine features + one-command Blender-to-game pipeline; (3) shooter content;
  (4) Steel Storm.
- **Blocky port to HG3D (owner: "finish it after the plan")**: unfinished, on branch `engine/hg3d-blocky` (one WIP commit, never run to the
  end). Scope: the lite levels only (Low, Auto tiers 2-3: Lambert, no reflections, no shadows); three.js keeps the others. Next step there:
  `node tools/bench/bench3d.mjs blocky --scn look --same f.png --arg 3`, fix the picture, run its tests, then the speed gate. Still open:
  Auto's "try one tier better" would bounce between renderers across starts; and a note in Settings when a level needs the other renderer.

## ASHFALL (the realistic shooter; started the night of 2026-11-21 on branch `engine/hg3d`, NOT on main, NOT in the launcher yet)
- **The owner's words (2026-11-21, after the proof slice ran at 60 FPS on his Chromebook)**: "Build out the games tonight... They should
  feel as 'hype' as possible from launch, in comparison to blocky shooter. Maybe have an intro for the first time you start the game, with
  a typewriter effect text undertale style: Are you there? / We made it...? / Mission B. Shooter was a success, it seems... / We move /
  not to Blocky Shooter 2 / but / to / ASHFALL [game logo]... as impressive as possible for any first impression... Focus on Ashfall...
  then Steel Storm Remastered... we do need multiplayer support like in blocky shooter as well. All of the good features without shitty
  fluff (there wasn't much but STILL) and too huge of a weapon shop. Still most of it but not all. Also we need aim with e because
  chromebook users use a trackpad." One subagent at a time while the main session also works ("Stick to the agent rule").
- **Where**: `Ashfall/` (`src/shell.html`, `src/css/10-style.css`, `src/js/*.js` joined into one module, `assets/`). Build:
  `node tools/build-game.js Ashfall`. Engine copy: `Ashfall/src/js/05-hg3d.js` (a `tools/build-engine.js` target). Open:
  `http://localhost:8090/Ashfall/index.html` (banner at the top of the play menu). `?menu=1` skips the opening, `?go=yard` starts a run,
  `?intro=1` replays the opening, `?stats=1` or F3 shows numbers. Debug hook `window.__ash`.
- **Files**: `10-core` (page, renderer, input incl. E-to-aim, synthesised sound + a step-sequencer music, the loop), `15-save` (key
  `ashfall_save`, `v` + fill-in migration; ranks from XP), `20-world` (a map: collision, flows, sparks/smoke/tracers/casings/shadows,
  ash and embers, the menu fly-by), `30-weapons` (WEAPONS numbers, `Gun`: the viewmodel, fire/reload/aim/melee/switch), `40-enemies`
  (FOES kinds as tint+size+behaviour on the one rigged figure, `Foes`), `50-holdout` (`Game`: waves, cash, classes, perks, grenades,
  pickups, HUD, also the deathmatch rules), `60-ui` (opening, menu, panels, supply crate, pause, results), `70-net` (multiplayer).
- **What it is**: HOLDOUT = waves (walker, runner, brute, spitter, cinder; THE FURNACE boss every 5th wave), cash from kills with a combo
  multiplier, the SUPPLY CRATE between waves (B): weapons, 3 upgrade levels per weapon, armour, medkit, grenades, 6 perks x 3 levels; all
  of it for this run only. Kept between runs: rank (XP), which unlocks weapons and classes, bests, settings. 4 classes with an X ability
  (Assault, Medic, Heavy, Recon). Carry two main guns + a sidearm (1/2/3, Q, wheel). E toggles aim (or hold: a setting), right button
  also aims; V strike, G grenade. No jumping, no campaign, no Hunted, no tournament yet (Blocky has them).
- **Weapons**: numbers in `WEAPONS` (30-weapons.js). A weapon is offered only when its model exists: `assets/w_<id>.hgm` (skin
  "viewmodel", pieces vm_arms + vm_gun, clips vm_idle/fire/reload/draw/run/melee) and an entry in `assets/weapons.json` (eye, sight,
  muzzle, eject, seat...), both written by `tools/blender/make_weapons.py` (`art/ashfall/weapons.blend`, not in git; log:
  `art/ashfall/WEAPONS.md`). A minigun's barrels must spin inside its fire clip (60 degrees a loop): bone matrices are baked.
- **Multiplayer** (70-net.js; Blocky's design, own code): PeerJS (`cdn.jsdelivr.net/npm/peerjs@1.5.4`), 6-digit code = peer id
  `ashfall-v1-<code>`, host is referee, two pipes (PeerJS's reliable channel + a negotiated id-50 unreliable one), JSON messages.
  SQUAD HOLDOUT (4): host simulates the ashen, guests draw snapshots (15 Hz players, 7.5 Hz ashen) and report hits (`h`), host sends
  damage (`d`), kills (`k`), wave/clear/over. DEATHMATCH (6, bots fill): shooter decides the hit (`ph`), the one hit owns their health
  (`pd`, `dead`), host keeps score and ends the match. Other players are drawn with the hooded enemy figure in a team colour until a
  soldier model exists. Not done: late join, host leaving mid-match (guests go to the menu), hidden-tab ticker, launcher party hooks
  (`HG_partyOpen`...), team modes.
- **Tests**: `node tools/tests/ashfall.mjs [solo] [ui] [mp] [loader]` (mp uses the real PeerJS server: internet needed; `loader --live`
  = the real CDN). Pictures of any state: `node tools/tests/ashfall-shot.mjs "go=yard" out.png "js"`.
- **Test builds**: the owner's Google Doc code (Proof Slice/loader.html) loads the newest `proofN` tag; from build 3 the slice's page
  hands over to Ashfall (inline script in `Proof Slice/src/shell.html`, `?proof=1` keeps the slice). Build 3 = `b7fac73` (2026-11-22).
- **Before a release** (not done): launcher GAMES entry + `tools/build-release.py` GAMES + `hub/ashfall.jpg`; the hub must tell a game
  run from a blob where its files are (`window.HG_BASE`, as the test loader does); `ashfall_` in `GAME_KEYS` (gv/core.js, then
  `bash tools/build-gv.sh`); a leaderboard feed if wanted (`Save.data.stats.best`, `xp`).
- **Gotchas found**: the Bash tool eats backslashes inside heredocs (write patch scripts with the Write tool); closing the supply crate
  re-locks the mouse and the late echo of the unlock used to pause the game (`App.lockAt`); one map per visit (the engine cannot yet
  free a map's memory: add `asset.dispose()` before a second map).

- **Later the same night**: figures per kind (`assets/foe_<id>.hgm`, skin `enemy`, clips idle/walk/attack/die; `Foes.crowds`, the map's
  own figure is only the stand-in for kinds without a file) and `assets/soldier.hgm` (skin `soldier`: idle/run/fire/die) for other
  players; `Weapons.init` asks for every model file by name (HEAD) and `HAVE` says what exists, so maps/weapons/figures appear when their
  file does; maps can be changed (`World.unload` + the engine's new `renderer.release(node, textures)`); a weapon that is dropped frees
  its memory (`Gun.drop`), all weapons share one arms picture (`Gun.armsTex`); `Ticker` (a worker clock) keeps a multiplayer game
  stepping in a hidden tab; first-run key hints; wind and groans; the ashen climb out of the ash where they appear. `node
  tools/tests/ashfall.mjs soak` = a long careless run (every key, every purchase, through the first boss). `sh tools/proof-publish.sh
  "message"` publishes the next test build (WIP snapshot + tag proofN). Art queue given to the Blender helper: weapons (log
  `art/ashfall/WEAPONS.md`), figures (`FIGURES.md`), the map MAIN STREET (`street.hgm`, `tools/blender/make_street.py`, `MAPS.md`).

- **And after that**: TEAM DEATHMATCH (`tdm`: `roster[].team`, no friendly fire, a side wins at twice the kill goal, `Net.leader()` on
  time); Space fires as well as the click (trackpads); a MORTAR STRIKE on C after 12 kills in a row unhurt (Blocky's airstrike);
  maps `street` and `depot` are registered in `MAPS` and appear when `assets/<name>.hgm` exists. Asked of the art helper and maybe not
  done yet: figures re-exported at 512 (memory: 102 MB with all six loaded, the budget is 100), THE DEPOT interior map, the rest of
  the weapons (revolver, dmr, rpg, minigun, knife). The owner's Google Doc text was updated to describe Ashfall (same code in it).
  Test builds so far: 3 = first Ashfall, 4, 5 (+ Steel Storm Remastered), 6 (figures, TDM), 7.

- **State at test build 12 (2026-11-22, small hours)**: all 11 weapons are in (`make_weapons.py`; the minigun's fire clip loops,
  `W.spin`), six enemy figures + the soldier (`make_figures.py`; five of them at 512), three maps: THE YARD, MAIN STREET, THE DEPOT
  (`make_street.py`, `make_depot.py`; `indoors: true` = no falling ash; `hold: true` in `MAPS` keeps an unfinished map off the menu,
  `?all=1` shows it; `node tools/blender/check_map.mjs` checks an exported map's walkable share, flood fill and probes; a map must have
  NOTHING below z = 0 and things standing on the ground must start a few mm above it, or the collision map comes out wrong).
  Holdout rules CLASSIC / RUSH / BOSS RUSH (`RULES`), a speed test in Settings (`UI.speedTest`, the game plays itself: `G.demo`).
  Memory with everything loaded: 85 MB. Tests: `node tools/tests/ashfall.mjs [solo] [soak] [maps] [ui] [mp] [loader]`.
  Launcher card pictures exist: `hub/ashfall.jpg`, `hub/steelstormr.jpg`. Still asked of the Blender helper when this was written:
  IRON VALLEY + light and heavy tank models for Steel Storm Remastered (`art/steelstorm/`, `make_valley.py`), a detail pass on the
  street and the depot (they are boxy, 6-7k triangles), the soldier's die clip on the ground.
  Not built: Blocky's campaign, Hunted, Gun Game, KOTH/CTF/Infection, gadgets beyond the grenade, attachments, jumping, saved runs.

- **jsDelivr refuses a tag whose whole tree is over 50 MB** ("Package size exceeded the configured limit of 50 MB": every file it
  has not already cached answers 403). The repo with these asset folders is about 65 MB, so test builds 11-15 were missing their newer
  files on the CDN. From build 16 `tools/proof-publish.sh` tags a SLIM commit (only `latest.json`, `Proof Slice/index.html`, and the
  `index.html` + `assets/` of Ashfall and Steel Storm Remastered: 32 MB) on top of the full WIP snapshot. **This is a release blocker
  for the launcher**: a release tag `rN` of a `main` that contains these assets would break the launcher for everyone. Before either
  game is released the assets have to live somewhere else (their own repo with its own tags, with `HG_BASE` pointing there), or the
  release has to be tagged from a slimmed tree. `node tools/tests/ashfall.mjs loader --live` is the check that the CDN serves a build.
- Two map loads at once used to be possible (the menu loads one behind itself; DEPLOY before that finished started a second):
  `World.load` now queues (`World.busy`) in both games.

## STEEL STORM REMASTERED: the proving ground (2026-11-22, branch `engine/hg3d`; a preview, not the whole of Steel Storm)
- **Where**: `Steel Storm Remastered/` (same skeleton as Ashfall: its `10-core.js` and CSS are copies of Ashfall's with other colours;
  `15-save` key `steelstorm_remaster`; `20-range` the terrain; `30-units` tanks; `40-battle` the skirmish; `60-ui`). Build:
  `node tools/build-game.js "Steel Storm Remastered"`. Open `http://localhost:8090/Steel%20Storm%20Remastered/index.html` (`?menu=1`,
  `?go=1`), or from Ashfall's menu (top right; `leaveTo(dir)` in 10-core.js swaps games inside a loader page). Debug hook `window.__ssr`.
  Test: `node tools/tests/ssr.mjs`; pictures: `node tools/tests/ssr-shot.mjs "go=1" out.png "js"`.
- **What it is**: your tank against waves of AI tanks on the Range tile (`assets/range.hgm`, the proof slice's). Every tank is
  `asset.copy('tank_hull')` (new engine call: a copy of a part tree with its own materials, so each is probe-lit and tintable; wrecks
  are pooled and reused). Aiming as in the proof slice (line of sight, the gun lays itself at `slew`/`lift` to the ballistic angle,
  the ring shows the landing point), E/right button/Shift = gun sight. Armour: the plate is the hull face the shell is at (front 0.5,
  side 1, rear 1.6, turret 0.8), AP glances off below 0.34 "squareness", HE ignores angle and has a blast. AI: closes to a range it
  likes, circles, leads the player with an error that shrinks each wave. Score, repair kits (R), best score saved.
- **Added later that night**: three tank kinds (`KINDS`: light, medium, heavy; picked before the skirmish; the enemy brings lights from
  wave 2 and heavies from wave 4), a field upgrade to pick after each wave (`UPGRADES`, `UI.upgrade`), Space fires. A kind uses its own
  model when the terrain file has `light_hull`/`heavy_hull` (+ `_turret`, `_barrel`, `_lod1` twins: `Units.setup` measures each), else the
  medium's with a shade. More than one terrain: `MAPS` in 20-range.js (`range`, `valley`), offered when `assets/<file>.hgm` exists
  (`World.check`), `World.unload` frees the old one.
- **IRON VALLEY and the light/heavy tank models arrived (test build 14)**: `assets/valley.hgm` (`tools/blender/make_valley.py`, config
  `art/steelstorm/valley.export.json`, notes `art/steelstorm/NOTES.md`, check `node tools/blender/check_heights.mjs`): 420 m, ridges,
  a ruined village, woods, 91k triangles in the file (81k in view at most so far, 23 draws, 88 MB). It is the default ground when
  its file is there (`?ground=range` or the Where tiles pick the other). Its own sky was baked plain grey, so the game draws the
  range's clear sky over it (`MAPS.valley.sky`). The start spot needs 8 m clear all round and faces the longest clear run (the
  middle of the valley is the village). Test: `node tools/tests/ssr.mjs` covers both grounds.
- **Polish round (test build 17)**: the valley has its own clear sky now (range 2.96; the `MAPS.valley.sky` stand-in only applies
  to a file whose sky range is under 1.6), houses with gables and rafters, layered trees, a neutral repainted medium tank (so the
  player's side is tinted olive when the file has the new models: `Units.make`). Memory: the valley's pictures were 104 MB, so
  `HG3D.load(url, { shrink(file, w, h) })` (new: a picture can be made smaller as it is read) halves the prop pictures: 96k triangles,
  26 draws, under 100 MB. Hostile tanks appear only where 8 m round them is clear (`Game.clear`). On hilly ground a shell can
  rightly meet a crest before the aim point: the gun-laying tests run on the flat range (`?ground=range`).
- **Not there yet (the owner's plan for Steel Storm)**: real models for more vehicles (one tank model, sand tint for the enemy),
  a bigger sculpted terrain, module damage, aircraft and helicopters, the garage, multiplayer, Steel Storm 2.3's menus and modes. The
  old `Steel Storm/` game is untouched.

## Proof slice (step 1 of the plan above; built 2026-11-21 on branch `engine/hg3d`, waiting for the owner's Chromebook)
- **What**: `Proof Slice/` (`src/` + `assets/`), drawn by HG3D alone (no three.js download). Menu: **the Yard** (`20-yard.js`: a 40 m walled
  yard with a brick building, a first-person carbine, a hooded infected figure in waves) and **the Range** (`30-tank.js`: a tank, hull >
  turret > barrel with a far model, on a 200 m terrain tile), plus a 20 s **speed test** for each (the slice plays itself; the result table
  stays on the menu, `hgdev_proof` in localStorage). Verdict wanted: **30 FPS at the slowest** on the real Chromebook.
- **Open it**: http://localhost:8090/Proof%20Slice/index.html (link at the bottom of the play menu). On a Chromebook in the same network:
  `node tools/play.mjs --lan` (or `Play Huntington Games.cmd --lan`) prints the address to type (Windows asks once to allow the network).
- On any Chromebook, the Launcher way: `Proof Slice/loader.html` is pasted into jsfiddle/jsbin (the owner's copy is the Google Doc
  "Proof Slice: Chromebook speed test code"). It finds the newest git tag `proofN` on jsDelivr, writes that build's
  `Proof Slice/index.html` into the page and sets `HG_BASE` (where the assets are) and `HG_PROOF` (the build number).
  Build 1 = tag `proof1` = the WIP snapshot commit `b243b76` on `wip/content-wave` (2026-11-21). Build 2 = tag `proof2` = `1fda730` (arms and hands, aim down sight, tank aiming). A new test build: rebuild, make the
  WIP snapshot commit as above, and push it to `refs/tags/proof<N+1>` as well; the pasted code never changes. The menu's grey
  "Report:" line (build, FPS, picture size, graphics chip) is what the owner sends back. Keep the loader free of `//` comments
  (it is copied out of a doc). Test: `node tools/tests/proof.mjs loader` (fake CDN), `loader --live` (the real one).
  `?stats=0` hides the numbers, F3 toggles them, `?exp=1.2` brightens, `?aniso=1` turns the sharper-ground filter off (try it if slow), `?go=yard&demo=1` starts the self-playing round.
- **How it looks real cheaply**: all light is worked out in Blender (Cycles) and baked: the static world is `colour picture x light picture`
  (second UV set), nothing per pixel but two texture reads, tone mapping and fog. Moving things (gun, figures, tank) are lit per vertex by
  a sun + sky pair for shape and scaled by **the baked light where they stand** (a grid baked 1 m above the ground: ambient colour + how much
  sun reaches the spot), so a figure walking into the building's shadow goes dark with it. Figures drop a blob at their feet and a long
  one away from the sun (only where the sun reaches). Sky = the Blender world rendered all the way round; the sun glow sits where the
  baked shadows say the sun is.
- **Engine pieces added** (`engine/src/85-assets.js`, exports `load, loadTexture, place, skyDome`): `HG3D.load(url)` reads an `.hgm`
  (JSON + raw arrays; pictures beside it as WebP, decoded off the main thread, the decoded copy dropped once on the GPU and fetched again
  after a lost context); `asset.scene` (static world), `asset.objects.<name>` (parts with `.local`/`.rest`; `HG3D.place(node, matrix)`
  walks parents), `asset.crowd(name, max)` (GPU-skinned figures: bone matrices in a float texture, one row per frame, two bones per vertex,
  one instanced draw per detail level, per-instance frame + light), `asset.probe(x, z, out)`, `asset.view(...)` for the raw grids.
  Shader hooks gained `vNormal` and `key` (same key = one program for many materials). `renderer.info.memory.textureBytes` counts picture
  memory. Fixed: a texture uploaded in the middle of a draw left itself on unit 0 for that one draw (a hook's texture showed as the colour
  map for one frame).
- **Blender -> game, one command**: `node tools/export-art.mjs [yard] [range]` runs Blender headless on `art/proof/*.blend` with the
  `*.export.json` beside it (`tools/blender/hg_export.py`; its header lists every option). It writes the `.hgm`, converts pictures, bakes
  the light grid, renders the sky, and builds the **collision map** (per 25 cm column: which heights are solid; the Yard's walking, bullets
  and enemy paths all read it) or the **height maps** (ground, and tops of what stands on it; the tank reads both).
  Art contract: collections by name; world meshes carry UV layers `UVMap` (tiling colour) + `Lightmap` (unique) and a baked float EXR
  (diffuse direct + indirect, no colour); an object can name its own EXR in the custom property `hg_lightmap`; final materials are
  Principled + ONE image; `emissive_*` materials are drawn full-bright; figures: one mesh + `<name>_lod1/2`, an armature, actions by name.
  Blender gotcha that cost an hour: whatever is hidden in the viewport when the file is saved is not evaluated headless (objects come out
  at the origin); the exporter un-hides everything in memory first.
- **Art sources are NOT in git** (`.gitignore`: `art/**/*.blend`, `art/**/tex/`, caches; one light EXR is 38 MB and git history is forever):
  they are in this folder only (OneDrive). The exported `Proof Slice/assets/` and the `*.export.json` are meant to be committed.
  Decide where sources live (Git LFS, another repo, as now) before content at scale. A session in a fresh clone can run and test the
  slice but cannot re-export.
- **Art made so far** (all modelled and baked in Blender through the MCP, nothing downloaded: the add-on's asset libraries were off):
  `art/proof/shooter.blend` (map 25k triangles in 8 materials, one 2048 light picture; gun 3.7k; figure 3.9k / 1.5k / 0.5k, 19 bones,
  idle / walk / attack / die), `art/proof/range.blend` (terrain 33k triangles with colour x light in one 2048 picture and a grey detail
  picture on top, a far backdrop ring, 21 prop groups 13k, tank 8.4k / 3.4k with a 2048 atlas shipped at 1024). Known weak: the figure is smooth ("onesie"), its
  walk has 5 key poses and no blending between clips (Mixamo mocap is the plan, the owner signs in); no hands on the gun; the yard has no
  decals; lossy WebP on light pictures.
- **Measured here** (not a Chromebook): Yard 16 draw calls, 87k triangles at most with 24 figures, 67 MB of pictures; Range 15 draw
  calls, 57k triangles, 56 MB; the processor's share with the main thread slowed 6x is about 1 ms a frame in both. So the open question on the Chromebook is pixels only (the governor
  shrinks the picture down to 60% by itself).
- **Tests**: `node tools/tests/proof.mjs [yard] [tank] [speed] [cpu]` (no rig, no internet; `gpu` when named: pixel cost at 8K on this
  PC's chip; `--shot=x.png` saves pictures). Budgets asserted: 150 draws, 150k triangles, 100 MB.
- **Blender state to know**: the tank scene was built with Blender run from the command line, because `read_factory_settings` in the
  live Blender switches the MCP add-on off (do not call it there: clear the scene by hand instead). If the live window still shows an
  early, empty `range.blend`, close it WITHOUT saving, reopen the file, and re-enable the add-on (Preferences > Add-ons).
- **Owner's Chromebook result (build 1, 2026-11-21)**: AMD Radeon R3 (Stoney Ridge), 4 GB, 2 cores, 1366x599: Yard 59.8 average /
  59.5 slowest, Range 60 / 59.5, about 11.5 ms of work a frame, picture at 100%. Speed is settled. His complaints were about the game,
  not the speed: no arms or hands on the gun ("realistic and animated with the gun"), and tank aiming with no up/down control.
- **After that feedback (2026-11-21, same branch)**:
  - *Tank aiming* (30-tank.js): the mouse turns a line of sight (yaw AND pitch); `tankAim` finds where it meets the ground or a target;
    `tankLay` turns the turret (`TD.slew`) and lifts the gun (`TD.lift`, limits `elevMin..elevMax`) to the ballistic angle that lands a
    shell there, worked out in the hull's own leaning space; `tankFall` predicts the landing of the gun as it points now and the HUD
    ring (`#gunmark`: amber = still turning, green = laid, red dashed = the gun cannot dip/rise that far) shows it. Right button or
    Shift = the gunner's sight (15 degree view). Five steel targets (`Tank.targets`) stand at ringed distances; HUD shows HITS, RANGE, GUN angle.
  - *Arms and gun* (20-yard.js): one skinned model "viewmodel" (`"together": true` in the export config = its meshes `vm_arms` + `vm_gun`
    are pieces of one model, not detail levels), built by `tools/blender/make_viewmodel.py` (re-runnable; the .blend is not in git),
    clips `vm_idle`, `vm_fire`, `vm_reload`, `vm_draw`, `vm_run`. The game picks the clip (`vmPlay`), fades between clips and between
    frames (`vmPose`; the shader blends two poses: `aAnim` = frame, flash, second frame, blend; `asset.frame2`). Reload time comes from
    the clip's length. An asset file with no "viewmodel" still shows the bare gun parts.
  - *Gun handling*: right button aims down the sight (the gun comes to the eye, view narrows, the sight's dot shows; `Yard.sight` is found
    from the highest vertices of the gun), spread grows with fast fire and movement and shrinks when aiming, casings fly out (one
    instanced draw). `node tools/tests/proof-shot.mjs yard out.png "js"` takes a picture of any state (used to check the hold pose).
- **Not built yet** (step 2): GPU-compressed textures (needs a transcoder or per-chip files), streaming, bullet decals, Poly Haven /
  Mixamo art (the owner switches the libraries on in the Blender add-on, or signs in).

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
