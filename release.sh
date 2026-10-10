#!/bin/sh
# Publish: commit everything, tag the next release (r1, r2, ...) and push. The hub and loader find the newest
# tag on jsDelivr by themselves; tags are served fresh immediately (unlike @main, which can lag 12 hours).
# Usage: ./release.sh "message"
set -e
cd "$(dirname "$0")"
git fetch -q --tags
N=$(( $(git tag -l 'r*' | sed 's/^r//' | grep -E '^[0-9]+$' | sort -n | tail -1) + 1 ))
printf '{"release":%s}\n' "$N" > latest.json
git add -A
git commit -qm "${1:-update} (r$N)" || true
git tag "r$N"
git push -q && git push -q origin "r$N"
echo "released r$N"
