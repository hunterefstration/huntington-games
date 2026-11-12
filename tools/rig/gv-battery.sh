#!/bin/bash
# Grapevine's whole test battery (about 35 minutes), run the right way: with the database password the battery's
# resets need (without it every reset fails quietly and the results mean nothing), with the rig's own server stopped
# (some suites start their own), and with the rig brought back up afterwards.
#   bash tools/rig/gv-battery.sh            prints each suite name, every FAIL line and the total
. "$(dirname "$0")/env.sh"
cd "$GV" || exit 1
test/up.sh stop a >/dev/null 2>&1
test/battery.sh 2>&1 | grep --line-buffered -E "^== |^FAIL|TOTAL|psql: error"
rc=${PIPESTATUS[0]}
test/up.sh stop a >/dev/null 2>&1; bash "$HG/tools/rig/up.sh" >/dev/null 2>&1
exit $rc
