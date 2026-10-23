#!/bin/sh
# Copies the Grapevine app (client.html from the grapevine repo) to gv/app.html, which the launcher's Grapevine tab runs.
# Usage: tools/sync-grapevine.sh [path to the grapevine checkout]   (default /home/user/grapevine)
set -e
cd "$(dirname "$0")/.."
SRC=${1:-/home/user/grapevine}/client.html
[ -f "$SRC" ] || { echo "no $SRC"; exit 1; }
cp "$SRC" gv/app.html
echo "gv/app.html $(wc -c < gv/app.html) bytes (from $SRC)"
