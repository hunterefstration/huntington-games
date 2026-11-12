#!/bin/bash
# The quick pre-commit / pre-release check. No rig needed, about two minutes:
#   bash tools/verify.sh            1. built files match sources, lists agree (tools/check.js)
#                                   2. every game opens without a script error (tools/tests/smoke.mjs)
#                                   3. the download path: mirrors, retries, saved copies (tools/tests/load.mjs)
#   bash tools/verify.sh --full     ...then every launcher suite on the rig (tools/rig/test.sh, about 25 minutes)
cd "$(dirname "$0")/.." || exit 1
export NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}"
bad=0
echo "== check"; node tools/check.js || bad=1
echo "== smoke"; timeout 600 node tools/tests/smoke.mjs | grep -v '^PASS' ; [ "${PIPESTATUS[0]}" = 0 ] || bad=1
echo "== load";  timeout 300 node tools/tests/load.mjs | grep -E '^FAIL|^ERROR|PASSED|FAILED'; [ "${PIPESTATUS[0]}" = 0 ] || bad=1
if [ "$1" = "--full" ]; then echo "== rig suites"; bash tools/rig/up.sh >/dev/null 2>&1; bash tools/rig/test.sh || bad=1; fi
[ $bad = 0 ] && echo "VERIFY OK" || echo "VERIFY FAILED"
exit $bad
