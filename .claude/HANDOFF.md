# Handoff (updated 2026-11-14)
Current state and the facts you need to change things. What each round did and why: `.claude/HISTORY.md` (grep it, do not read it all).

## Where things stand
- Live: **r72** (`latest.json` on `main`). r72: Steel Storm 2.1, admin powers the owner picks, progress editor, nicknames, Owner/Admin tags (section below). r71: cleanup (below). Every game in the launcher is released.
- r70: admin "Rebuild from leaderboards" (`launcher/js/10-hub/098-rebuild.js`, suite `gv-rebuild`). r69: saves never lost (other-tab
  guard, mass-delete guard, server copies, admin lookup/restore, device backups; Saves tab "Look for older saves"; suite `gv-recover`).
- 2026-11-14 cleanup: launcher `001-util.js` (`hubShown`, `hubWake`, `setHtml`): hub repaint/poll timers skip work while a game is open or
  the tab is hidden and repaint when the hub is back. Removed the old `release.sh prepare/finish` path and Divergent's stale duplicate files.
- Back up unreleased work to `wip/content-wave` without touching HEAD or `main`:
  `GIT_INDEX_FILE=/tmp/wip-index sh -c 'git read-tree HEAD && git add -A && T=$(git write-tree) && P=$(git ls-remote origin refs/heads/wip/content-wave | cut -f1) && C=$(git commit-tree $T -p HEAD ${P:+-p $P} -m "WIP snapshot") && git push -q -f origin $C:refs/heads/wip/content-wave'`

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
