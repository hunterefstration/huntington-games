#!/bin/bash
# One of Grapevine's own suites against a fresh server, the way grapevine/test/battery.sh runs the ordinary ones:
#   bash tools/rig/gv-suite.sh test/e2e-eco.mjs [ENV=value ...]
# (Suites that start their own server, e.g. e2e-offline, e2e-images, and the hostile/abuse suites that need their own
#  settings must be run through grapevine/test/battery.sh instead.)  Run tools/rig/up.sh afterwards for launcher tests.
. "$(dirname "$0")/env.sh"
cd "$GV" || exit 1
export ADMIN_POOL=1 RIG_CHROME="${RIG_CHROME:-$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)}"
suite="$1"; shift
test/up.sh stop a >/dev/null 2>&1; sleep 1; test/up.sh reset >/dev/null
DATABASE_URL="$RIG_DB_URL" test/up.sh a $RIG_ARCHIVE_ENV "$@" >/dev/null
sleep 1
PID_A=$(cat .a.pid) DATABASE_URL="$ADMIN_URL" timeout 600 node "$suite" 2>&1 | grep -E "^(PASS|FAIL)|ERROR|Error|    at " | grep -v "^PASS"
