#!/bin/bash
# A clean Grapevine for the next launcher suite: empty database, freshly started server (the signup limit and the
# "first account is the owner" rule both need it). Run before every tools/tests/gv*.mjs.
. "$(dirname "$0")/env.sh"
cd "$GV" || exit 1
test/up.sh stop a >/dev/null 2>&1; test/up.sh reset >/dev/null
DATABASE_URL="$RIG_DB_URL" test/up.sh a $RIG_ARCHIVE_ENV >/dev/null; sleep 2
