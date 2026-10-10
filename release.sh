#!/bin/sh
# Publish: commit everything, point latest.json at that commit, push, and refresh jsDelivr's copy of latest.json.
# Usage: ./release.sh "message"
set -e
cd "$(dirname "$0")"
git add -A
git commit -qm "${1:-update}" || true
SHA=$(git rev-parse HEAD)
printf '{"sha":"%s"}\n' "$SHA" > latest.json
git add latest.json
git commit -qm "latest.json -> $SHA" || true
git push -q
sleep 20
curl -s "https://purge.jsdelivr.net/gh/hunterefstration/huntington-games@main/latest.json" | grep -E '"throttled"'
curl -s "https://cdn.jsdelivr.net/gh/hunterefstration/huntington-games@main/latest.json"
