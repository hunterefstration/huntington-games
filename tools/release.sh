#!/bin/sh
# Release flow. Needs tools/setup-tools.sh once per container (tools/rig/setup.sh does it).
#   tools/release.sh ship <N> "<message>"            - THE NORMAL WAY: release the work branch as it is (see below)
# The two older steps (a release made from the last tag plus hand-picked game folders) are kept for that rare case:
#   tools/release.sh prepare <N> "<game dir>" ...  - worktree of the newest rN tag at $W, copies those game files
#                                                   from this checkout, renames the hub to Launcher.
#   (now edit $W/index.html game cards: name/version/desc/tags)
#   tools/release.sh finish <N> "<message>"         - rotates the licence secret, sets latest.json, runs the gate
#                                                   tests, commits and pushes to main (the Action creates tag rN).
set -e
R=$(cd "$(dirname "$0")/.." && pwd); W=${HG_RELEASE:-/home/user/hg-release}; T=${HG_TOOLS:-/tmp/hg-tools}
cmd=$1; N=$2; shift 2
case "$cmd" in
ship)
  # The whole release from the work branch, the way every release since r57 has been done:
  #   tools/release.sh ship <N> "<what is in it>"          (HG_TRAILER = extra commit trailer lines, e.g. the session link)
  # 0. the tree is clean, main is an ancestor, built files match sources (tools/check.js)
  # 1. a worktree of HEAD at $W gets the licence build N (secret rotated, kept outside the repo) and latest.json
  # 2. gate tests, the secret is not in the diff, every game opens from the release build (smoke test)
  # 3. commit, push to main (the Action tags rN), fast-forward this branch to it, wait for the tag
  # Grapevine first, if it changed: push its HEAD to its main yourself before this (the server follows main).
  MSG=$1; BR=$(git -C "$R" rev-parse --abbrev-ref HEAD)
  [ -n "$MSG" ] || { echo 'usage: tools/release.sh ship <N> "<message>"'; exit 1; }
  [ -z "$(git -C "$R" status --porcelain)" ] || { echo "commit or stash first: the tree is not clean"; exit 1; }
  git -C "$R" fetch -q origin main --tags
  git -C "$R" merge-base --is-ancestor origin/main HEAD || { echo "origin/main is not an ancestor of HEAD: merge it first"; exit 1; }
  LAST=$(git -C "$R" tag -l 'r*' | sed 's/^r//' | grep -E '^[0-9]+$' | sort -n | tail -1)
  [ "$N" -eq $((LAST + 1)) ] || { echo "next release should be r$((LAST + 1))"; exit 1; }
  node "$R/tools/check.js" || { echo "fix the problems above first"; exit 1; }
  git -C "$R" worktree remove --force "$W" 2>/dev/null || rm -rf "$W"; git -C "$R" worktree prune
  git -C "$R" worktree add -q --detach "$W" HEAD
  cd "$W"
  HG_ROOT="$W" HG_TOOLS="$T" python3 tools/build-release.py "$N"
  printf '{"release":%s}\n' "$N" > latest.json
  export HG_BUILD=$N HG_SECRET=$(cat "$T/hg_secret.txt") HG_ROOT="$W" HG_TOOLS="$T" NODE_PATH=/opt/node22/lib/node_modules
  node tools/tests/gate.js | tee /tmp/hg-gate.txt; node tools/tests/gate2.js | tee -a /tmp/hg-gate.txt
  if grep -q FAIL /tmp/hg-gate.txt || [ "$(grep -c '^PASS' /tmp/hg-gate.txt)" -lt 9 ]; then echo "GATE TESTS FAILED - not pushing (worktree left at $W)"; exit 1; fi
  git add -A
  if [ "$(git diff --cached | grep -c -F "$HG_SECRET")" != 0 ]; then echo "THE SECRET IS IN THE DIFF - not pushing"; exit 1; fi
  node "$R/tools/tests/smoke.mjs" | grep -v '^PASS' > /tmp/hg-smoke.txt; cat /tmp/hg-smoke.txt
  grep -q 'ALL PASSED' /tmp/hg-smoke.txt || { echo "SMOKE TEST FAILED on the release build - not pushing (worktree left at $W)"; exit 1; }
  git commit -q -m "Release r$N: $MSG${HG_TRAILER:+

$HG_TRAILER}"
  git push -q origin HEAD:main
  REL=$(git rev-parse HEAD); cd "$R"
  git merge -q --ff-only "$REL" && git push -q origin "HEAD:$BR"
  git worktree remove --force "$W"
  echo "pushed r$N to main; waiting for the tag"
  for i in $(seq 1 60); do git ls-remote --tags origin 2>/dev/null | grep -q "refs/tags/r$N$" && { echo "tagged r$N: live"; exit 0; }; sleep 15; done
  echo "no tag r$N after 15 minutes: check the repository's Actions"; exit 1 ;;
prepare)
  git -C "$R" fetch -q origin --tags
  LAST=$(git -C "$R" tag -l 'r*' | sed 's/^r//' | grep -E '^[0-9]+$' | sort -n | tail -1)
  [ "$N" -eq $((LAST + 1)) ] || { echo "next release should be r$((LAST + 1))"; exit 1; }
  git -C "$R" worktree remove --force "$W" 2>/dev/null || rm -rf "$W"
  git -C "$R" worktree add -q --detach "$W" "r$LAST"
  for d in "$@"; do
    mkdir -p "$W/$d"
    # games built from many source files (Sovereign, Blocky Shooter V2): rebuild, and ship the sources too (the Launcher still loads only index.html)
    if [ -f "$R/$d/src/shell.html" ]; then
      node "$R/tools/build-game.js" "$d" --check
      rm -rf "$W/$d/src"; cp -r "$R/$d/src" "$W/$d/"; [ -d "$R/$d/data" ] && cp -r "$R/$d/data" "$W/$d/"
      mkdir -p "$W/tools"; cp "$R/tools/build-game.js" "$R/tools/release.sh" "$W/tools/"
    fi
    cp "$R/$d/index.html" "$W/$d/index.html"; echo "copied $d"
  done
  case " $* " in *" Sovereign "*) cp "$R/tools/sovereign-data.js" "$R/tools/build-release.py" "$R/tools/release.sh" "$W/tools/"; cp "$R/hub/sovereign.jpg" "$W/hub/"; echo "copied Sovereign sources";; esac
  python3 "$R/tools/rebrand-hub.py" "$W/index.html"
  echo "prepared $W from r$LAST - edit the game cards in $W/index.html, then: tools/release.sh finish $N \"message\"" ;;
finish)
  cd "$W"
  HG_ROOT="$W" HG_TOOLS="$T" python3 "$R/tools/build-release.py" "$N"
  printf '{"release":%s}\n' "$N" > latest.json
  export HG_BUILD=$N HG_SECRET=$(cat "$T/hg_secret.txt") HG_ROOT="$W" HG_TOOLS="$T" NODE_PATH=/opt/node22/lib/node_modules
  node "$R/tools/tests/gate.js" | tee /tmp/hg-gate.txt; node "$R/tools/tests/gate2.js" | tee -a /tmp/hg-gate.txt
  if grep -q FAIL /tmp/hg-gate.txt; then echo "GATE TESTS FAILED - not pushing"; exit 1; fi
  git add -A && git commit -q -m "r$N: $1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>${HG_TRAILER:+
$HG_TRAILER}" && git push -q origin HEAD:main
  echo "pushed r$N; tag appears in ~1 min. Then update the doc's Latest Release (see .claude/HANDOFF.md)." ;;
*) echo "usage: tools/release.sh prepare|finish ..."; exit 1 ;;
esac
