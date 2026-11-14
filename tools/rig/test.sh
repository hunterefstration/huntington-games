#!/bin/bash
# The launcher's browser suites, one after another on a clean rig, with one summary line each.
#   bash tools/rig/test.sh                 every suite (about 25 minutes)
#   bash tools/rig/test.sh gv gv-lb        only these
# Exit code 1 if any check failed. Details of a failing suite: /tmp/rig-<suite>.log
. "$(dirname "$0")/env.sh"
cd "$HG" || exit 1
ALL="gv gv-saves gv-merge gv-flood gv-lb gv-qol gv-hub gv-games gv-ach gv-profile gv-tour gv-dock gv-invite gv-notify gv-ban gv-casino gv-casino-ui gv-report gv-shop gv-egress gv-recover gv-rebuild"
bad=0
for s in ${*:-$ALL}; do
  bash "$HG/tools/rig/reset.sh" >/dev/null 2>&1
  timeout 600 node "tools/tests/$s.mjs" > "/tmp/rig-$s.log" 2>&1; rc=$?
  p=$(grep -c '^PASS' "/tmp/rig-$s.log"); f=$(grep -c '^FAIL' "/tmp/rig-$s.log")
  echo "== $s  pass $p  fail $f$([ $rc -ne 0 ] && [ "$f" = 0 ] && echo "  (exit $rc: see /tmp/rig-$s.log)")"
  grep -E '^FAIL|^ERROR|pageerror' "/tmp/rig-$s.log" | head -5 | cut -c1-220
  [ $rc -ne 0 ] && bad=1
done
exit $bad
