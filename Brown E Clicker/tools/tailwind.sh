#!/bin/bash
# Brown E Clicker used the Tailwind "Play CDN" script, which builds the page's CSS in the browser at every start (over a
# second on a school Chromebook, and one more server that can be blocked). This builds that CSS once instead, into
# src/css/05-tailwind.css, from every class name in src/ plus tools/tailwind-safelist.txt (class names that only exist
# at run time). Run it after adding or changing Tailwind classes, then rebuild the game:
#   bash "Brown E Clicker/tools/tailwind.sh" && node tools/build-game.js "Brown E Clicker" --check
# (node tools/check.js notices when this was forgotten; tools/tailwind-check.mjs finds run-time-only classes.)
# Needs tailwindcss 3.4 in $HG_TOOLS (installed here on first use).
set -e
D="$(cd "$(dirname "$0")/.." && pwd)"; T="${HG_TOOLS:-/tmp/hg-tools}"
[ -f "$T/node_modules/tailwindcss/package.json" ] || (mkdir -p "$T" && cd "$T" && { [ -f package.json ] || npm init -y >/dev/null; } && npm install --no-audit --no-fund tailwindcss@3.4.17 >/dev/null)
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$W/in.css"
cat > "$W/tailwind.config.js" <<CFG
module.exports = { content: ["$D/src/shell.html", "$D/src/js/**/*.js", "$D/tools/tailwind-safelist.txt"], theme: { extend: {} }, plugins: [] };
CFG
(cd "$T" && node node_modules/tailwindcss/lib/cli.js -c "$W/tailwind.config.js" -i "$W/in.css" -o "${OUT:-$D/src/css/05-tailwind.css}" --minify 2>/dev/null)
echo "built ${OUT:-src/css/05-tailwind.css} ($(wc -c < "${OUT:-$D/src/css/05-tailwind.css}") bytes)"
