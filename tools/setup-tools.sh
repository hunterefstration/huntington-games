#!/bin/sh
# One-time setup for release builds and browser tests in a fresh container.
# Installs into $HG_TOOLS (default /tmp/hg-tools), outside the repo:
#   node_modules/javascript-obfuscator  (tools/obf.js, used by build-release.py)
#   node_modules/tailwindcss-cdn        (offline stand-in for cdn.tailwindcss.com in tests)
#   cdn/package/                        (three@0.160.0, served for cdn.jsdelivr.net/npm/three@0.160.0/ in tests)
# Playwright and Chromium are preinstalled (NODE_PATH=/opt/node22/lib/node_modules).
set -e
T=${HG_TOOLS:-/tmp/hg-tools}
mkdir -p "$T/cdn" "$T/tests"
cd "$T"
[ -f package.json ] || npm init -y >/dev/null
[ -d node_modules/javascript-obfuscator ] || npm install --no-audit --no-fund javascript-obfuscator@4 tailwindcss-cdn@3 >/dev/null
if [ ! -f cdn/package/build/three.module.js ]; then
  cd cdn && npm pack three@0.160.0 >/dev/null 2>&1 && tar xzf three-0.160.0.tgz && rm three-0.160.0.tgz
fi
echo "tools ready in $T"
