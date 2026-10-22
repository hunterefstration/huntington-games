#!/bin/sh
# Release flow (replaces the old root release.sh). Needs tools/setup-tools.sh once per container.
#   tools/release.sh prepare <N> "<game dir>" ...  - worktree of the newest rN tag at $W, copies those game files
#                                                   from this checkout, renames the hub to Launcher.
#   (now edit $W/index.html game cards: name/version/desc/tags)
#   tools/release.sh finish <N> "<message>"         - rotates the licence secret, sets latest.json, runs the gate
#                                                   tests, commits and pushes to main (the Action creates tag rN).
set -e
R=$(cd "$(dirname "$0")/.." && pwd); W=${HG_RELEASE:-/home/user/hg-release}; T=${HG_TOOLS:-/tmp/hg-tools}
cmd=$1; N=$2; shift 2
case "$cmd" in
prepare)
  git -C "$R" fetch -q origin --tags
  LAST=$(git -C "$R" tag -l 'r*' | sed 's/^r//' | grep -E '^[0-9]+$' | sort -n | tail -1)
  [ "$N" -eq $((LAST + 1)) ] || { echo "next release should be r$((LAST + 1))"; exit 1; }
  git -C "$R" worktree remove --force "$W" 2>/dev/null || rm -rf "$W"
  git -C "$R" worktree add -q --detach "$W" "r$LAST"
  for d in "$@"; do mkdir -p "$W/$d"; cp "$R/$d/index.html" "$W/$d/index.html"; echo "copied $d"; done
  # Sovereign is built from many source files: ship them too (the Launcher still loads only index.html)
  case " $* " in *" Sovereign "*) cp -r "$R/Sovereign/src" "$R/Sovereign/data" "$W/Sovereign/"; cp "$R/tools/build-sovereign.js" "$R/tools/sovereign-data.js" "$R/tools/build-release.py" "$R/tools/release.sh" "$W/tools/"; cp "$R/hub/sovereign.jpg" "$W/hub/"; echo "copied Sovereign sources";; esac
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
