#!/bin/bash
# Bring the whole rig up (after a container restart, or any time something is down). Leaves what already runs alone,
# except the Grapevine server, which is always restarted so it runs the current build of grapevine/archive.js.
#   bash tools/rig/up.sh            bash tools/rig/up.sh relayonly   (no direct door: forces the relay path)
. "$(dirname "$0")/env.sh"
V=$(pg_lsclusters -h 2>/dev/null | awk '$3==55432{print $1}' | head -1); C=$(pg_lsclusters -h 2>/dev/null | awk '$3==55432{print $2}' | head -1)
[ -n "$V" ] || { echo "[rig] no Postgres on 55432: run tools/rig/setup.sh first"; exit 1; }
pg_ctlcluster "$V" "$C" start >/dev/null 2>&1; sleep 1
mkdir -p "$RIG_HOME/node_modules"; ln -sfn /opt/node22/lib/node_modules/playwright "$RIG_HOME/node_modules/playwright" 2>/dev/null
cd "$GV" || exit 1
rig_up http://127.0.0.1:9000/gv/ || { nohup node test/broker.mjs > /tmp/rig-peerbroker.log 2>&1 & }
ps -eo args | grep -q "[n]ode test/mqtt-broker.mjs" || { nohup node test/mqtt-broker.mjs > /tmp/rig-mqtt.log 2>&1 & }
(cd "$HG" && { rig_up http://127.0.0.1:8090/index.html || { nohup python3 -m http.server 8090 > /tmp/rig-hub.log 2>&1 & }; })
for p in $(ps -eo pid,args | grep -E "node (test/serve.mjs|archive.js)" | grep -v grep | awk '{print $1}'); do kill "$p" 2>/dev/null; done
sleep 1
[ "$1" = relayonly ] && export RIG_RELAY_ONLY=1
RIG_ARCHIVES=rig-archive-a nohup node test/serve.mjs > /tmp/rig-serve.log 2>&1 &
test/up.sh reset >/dev/null
DATABASE_URL="$RIG_DB_URL" test/up.sh a $RIG_ARCHIVE_ENV >/dev/null
sleep 2
for u in http://127.0.0.1:9000/gv/ http://127.0.0.1:8080/ http://127.0.0.1:8090/index.html http://127.0.0.1:8787/gv/health; do rig_up $u && echo "up   $u" || echo "DOWN $u"; done
