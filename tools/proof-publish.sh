#!/bin/sh
# Publish the working tree as the next test build. Two commits, neither touches HEAD or main:
#   1. a WIP snapshot of everything, pushed to wip/content-wave (the backup);
#   2. a SLIM commit on top of it holding only what the paste-in test loader fetches (the built pages and asset folders
#      of the test games), tagged proof<N>. Slim because jsDelivr refuses every new file of a tag whose whole tree is
#      over 50 MB ("Package size exceeded the configured limit of 50 MB"), and the repo with all the game assets is.
# The paste-in loader (Proof Slice/loader.html, the owner's Google Doc) loads the newest proof tag.
#   sh tools/proof-publish.sh "what is in it"
set -e
cd "$(dirname "$0")/.."
MSG="${1:-work in progress}"
N=$(git ls-remote --tags origin 'refs/tags/proof*' | sed -n 's/.*refs\/tags\/proof\([0-9]*\)$/\1/p' | sort -n | tail -1)
N=$((${N:-0} + 1))
export GIT_INDEX_FILE="$(mktemp -u)"
git read-tree HEAD
git add -A 2>/dev/null
if git diff --cached --name-only HEAD | grep -i -E 'secret|\.blend1?$|\.exr$|/_cache/|\.env$' ; then echo "refusing: the files above must not be published"; exit 1; fi
T=$(git write-tree)
P=$(git ls-remote origin refs/heads/wip/content-wave | cut -f1)
git cat-file -e "$P" 2>/dev/null || git fetch -q origin wip/content-wave
C=$(git commit-tree "$T" -p HEAD -p "$P" -m "WIP snapshot: test build $N ($MSG)

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>")
# the slim tree: only the files the loader and the games fetch
export GIT_INDEX_FILE="$(mktemp -u)"
git read-tree --empty
git ls-tree -r -z "$C" -- latest.json "Proof Slice/index.html" "Ashfall/index.html" "Ashfall/assets" "Steel Storm Remastered/index.html" "Steel Storm Remastered/assets" | git update-index -z --index-info
S=$(git write-tree)
BYTES=$(git ls-tree -r -l "$S" | awk '{ s += $4 } END { print s }')
echo "slim tree: $((BYTES / 1048576)) MB"
if [ "$BYTES" -gt 49000000 ]; then echo "refusing: the slim tree is over the CDN's 50 MB limit; prune assets first"; exit 1; fi
SC=$(git commit-tree "$S" -p "$C" -m "Test build $N: the files the test loader fetches ($MSG)

Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>")
git push -q origin "$C:refs/heads/wip/content-wave" "$SC:refs/tags/proof$N"
echo "published test build $N = $SC (snapshot $C)"
