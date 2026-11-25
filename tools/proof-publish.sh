#!/bin/sh
# Publish the working tree as the next test build: see tools/proof-publish.mjs (code tag + asset pack tags + WIP snapshot).
#   sh tools/proof-publish.sh "what is in it"
exec node "$(dirname "$0")/proof-publish.mjs" "$@"
