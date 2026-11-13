#!/bin/bash
# Small helpers for a suite that has to look inside the rig (used by tools/tests/gv-shop.mjs):
#   db.sh server-stop | server-start     stop / start the rig's Grapevine server, keeping the database
#   db.sh eco-row <userId>               print that user's wallet row (JSON), or nothing
#   db.sh sql-file <file.sql>            run a file of SQL as the database owner
. "$(dirname "$0")/env.sh"
case "$1" in
  server-stop) cd "$GV" && test/up.sh stop a >/dev/null 2>&1; sleep 1 ;;
  server-start) cd "$GV" && DATABASE_URL="$RIG_DB_URL" test/up.sh a $RIG_ARCHIVE_ENV >/dev/null; sleep 2 ;;
  eco-row) [[ "$2" =~ ^[A-Za-z0-9_-]+$ ]] || exit 1; psql "$ADMIN_URL" -At -c "SELECT v FROM grapevine.user_saves WHERE user_id = '~eco' AND k = '$2'" ;;
  sql-file) psql "$ADMIN_URL" -q -v ON_ERROR_STOP=1 -f "$2" ;;
  *) echo "usage: db.sh server-stop | server-start | eco-row <userId> | sql-file <file>"; exit 1 ;;
esac
