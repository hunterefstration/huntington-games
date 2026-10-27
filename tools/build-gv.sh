#!/bin/sh
# Builds gv/account.js (Grapevine: the relay client, account core and tab UI) from gv/*.js and gv/vendor/*.
# vendor/gvlink.js and vendor/hgnet.js are copies of relay/gvlink.js and relay/hgnet.js in the Grapevine repo;
# vendor/ed25519.js is parts/ed25519.js there. Re-copy them when those change, then run this.
set -e
cd "$(dirname "$0")/.."
T=$(mktemp)
npx --yes terser gv/vendor/hgnet.js -c -m --comments false -o "$T"
{
  echo "/* Grapevine - built by tools/build-gv.sh from gv/*.js. Do not edit. */"
  cat "$T"; echo
  echo "(function(){"
  cat gv/vendor/ed25519.js gv/vendor/gvlink.js gv/core.js gv/ach.js gv/ui.js
  echo "})();"
} > gv/account.js
rm -f "$T"
node --check gv/account.js
echo "gv/account.js $(wc -c < gv/account.js) bytes"
