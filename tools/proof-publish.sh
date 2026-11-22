#!/bin/sh
# Publish the working tree as the next test build: a WIP snapshot commit on wip/content-wave (HEAD and main untouched)
# and a tag proof<N> on it. The paste-in test loader (Proof Slice/loader.html, the owner's Google Doc) loads the newest tag.
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
git push -q origin "$C:refs/heads/wip/content-wave" "$C:refs/tags/proof$N"
echo "published test build $N = $C"
