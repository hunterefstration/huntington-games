#!/bin/bash
# Everything the tests need, from an empty container. Safe to run again (each step is skipped when already done).
#   bash tools/rig/setup.sh
# 1. release/test tools in $HG_TOOLS (obfuscator, offline three.js and Tailwind)   2. the brokers' npm packages
# 3. Postgres on :55432 with the grapevine_test database, schema and the server's role   4. Playwright link
. "$(dirname "$0")/env.sh"
say() { echo "[rig] $*"; }
[ -f "$HG_TOOLS/cdn/package/build/three.module.js" ] && [ -d "$HG_TOOLS/node_modules/javascript-obfuscator" ] || { say "installing release tools"; sh "$HG/tools/setup-tools.sh" >/dev/null || say "setup-tools failed"; }
if [ ! -d "$RIG_HOME/node_modules/aedes" ] || [ ! -d "$RIG_HOME/node_modules/peer" ] || [ ! -d "$RIG_HOME/node_modules/pg" ]; then
  say "installing broker packages in $RIG_HOME"; (cd "$RIG_HOME" && { [ -f package.json ] || npm init -y >/dev/null; } && npm install --no-audit --no-fund aedes@0.51 mqtt@5 peer@1 pg@8 ws@8 >/dev/null 2>&1) || say "npm install failed"
fi
[ -d "$GV" ] || { say "no Grapevine checkout at $GV (set GV=...): the rig needs it"; exit 1; }
[ -d "$GV/node_modules/pg" ] || { say "installing Grapevine's packages"; (cd "$GV" && npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1) || say "npm install in grapevine failed"; }
mkdir -p "$RIG_HOME/node_modules"; ln -sfn /opt/node22/lib/node_modules/playwright "$RIG_HOME/node_modules/playwright" 2>/dev/null
# Postgres
if ! command -v pg_lsclusters >/dev/null; then say "installing Postgres"; DEBIAN_FRONTEND=noninteractive apt-get install -y -q postgresql >/dev/null 2>&1 || { say "could not install Postgres"; exit 1; }; fi
if ! pg_lsclusters -h 2>/dev/null | awk '{print $3}' | grep -qx 55432; then
  V=$(ls /usr/lib/postgresql 2>/dev/null | sort -n | tail -1)
  if pg_lsclusters -h 2>/dev/null | grep -q .; then C=$(pg_lsclusters -h | head -1 | awk '{print $2}'); say "moving cluster $V/$C to port 55432"; pg_conftool "$V" "$C" set port 55432 >/dev/null
  else say "creating a Postgres cluster on 55432"; pg_createcluster "$V" main --port 55432 >/dev/null; fi
fi
V=$(pg_lsclusters -h | awk '$3==55432{print $1}' | head -1); C=$(pg_lsclusters -h | awk '$3==55432{print $2}' | head -1)
pg_ctlcluster "$V" "$C" start 2>/dev/null; sleep 2
PSQL() { su postgres -c "psql -p 55432 -v ON_ERROR_STOP=1 -q $*"; }
PSQL "-c \"ALTER USER postgres PASSWORD '$PGPASSWORD'\"" >/dev/null 2>&1 || { say "Postgres is not answering on 55432"; exit 1; }
DB="${RIG_DB:-grapevine_test}"
if ! su postgres -c "psql -p 55432 -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB'\"" | grep -q 1; then
  say "creating database $DB"
  su postgres -c "createdb -p 55432 $DB"
  su postgres -c "psql -p 55432 -tAc \"SELECT 1 FROM pg_roles WHERE rolname='grapevine_archive'\"" | grep -q 1 || PSQL "-d $DB -c \"CREATE ROLE grapevine_archive LOGIN PASSWORD 'rigpass123'\""
  for f in schema.sql migrate-v3.sql migrate-v4.sql migrate-v7.sql migrate-v8.sql migrate-v9.sql migrate-v10.sql migrate-v12.sql migrate-v13.sql; do
    [ -f "$GV/$f" ] && { psql -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 -f "$GV/$f" >/dev/null 2>/tmp/rig-sql.err || { say "$f failed: $(head -1 /tmp/rig-sql.err)"; }; }
  done
  sed -e '/CREATE ROLE/d' -e "s/CHANGE-ME/rigpass123/" "$GV/grants.sql" | psql -U postgres -d "$DB" -q >/dev/null 2>&1
  for f in migrate-v14.sql migrate-v15.sql; do [ -f "$GV/$f" ] && psql -U postgres -d "$DB" -q -f "$GV/$f" >/dev/null 2>&1; done
  psql -U postgres -d "$DB" -q -c "ALTER ROLE grapevine_archive PASSWORD 'rigpass123'" >/dev/null 2>&1
fi
say "ready: tools in $HG_TOOLS, Postgres $V/$C on 55432, database $DB ($(psql -U postgres -d "$DB" -tAc "SELECT count(*) FROM pg_tables WHERE schemaname='grapevine'" 2>/dev/null) tables)"
