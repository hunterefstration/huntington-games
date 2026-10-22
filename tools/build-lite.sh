#!/bin/sh
# Builds lite/lite.js (Grapevine Lite: the relay client, account core and tab UI) from lite/*.js and lite/vendor/*.
# vendor/gvlink.js and vendor/hgnet.js are copies of relay/gvlink.js and relay/hgnet.js in the Grapevine repo;
# vendor/ed25519.js is parts/ed25519.js there. Re-copy them when those change, then run this.
set -e
cd "$(dirname "$0")/.."
T=$(mktemp)
npx --yes terser lite/vendor/hgnet.js -c -m --comments false -o "$T"
{
  echo "/* Grapevine Lite - built by tools/build-lite.sh from lite/*.js. Do not edit. */"
  cat "$T"; echo
  echo "(function(){"
  cat lite/vendor/ed25519.js lite/vendor/gvlink.js lite/core.js lite/ui.js
  echo "})();"
} > lite/lite.js
rm -f "$T"
node --check lite/lite.js
echo "lite/lite.js $(wc -c < lite/lite.js) bytes"
