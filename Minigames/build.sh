#!/bin/bash
# Copies the shared lobby (Minigames/_shared) into every minigame's src and builds them all.
cd "$(dirname "$0")/.."
for d in Minigames/*/; do
  g="${d%/}"; [ "$(basename "$g")" = "_shared" ] && continue; [ -d "$g/src" ] || continue
  mkdir -p "$g/src/js" "$g/src/css"
  cp Minigames/_shared/mg.js "$g/src/js/00-mg.js"; cp Minigames/_shared/mg.css "$g/src/css/00-mg.css"
  node tools/build-game.js "$g" --check | tail -1
done
