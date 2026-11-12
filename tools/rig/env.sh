# Shared settings of the local test rig (sourced by the other scripts in tools/rig).
# The rig is: Postgres on :55432 (db grapevine_test), a PeerJS broker on :9000, an MQTT broker on :9001, Grapevine's own
# page server on :8080, this repo served on :8090, and one Grapevine server ("archive a") with the direct door on :8787.
HG="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GV="${GV:-$(cd "$HG/.." && pwd)/grapevine}"
RIG_HOME="${RIG_HOME:-$(cd "$HG/.." && pwd)}"                 # where the brokers' npm packages live (node_modules)
export HG GV RIG_HOME
export PGPASSWORD="${PGPASSWORD:-x}" PGPORT=55432 PGHOST=127.0.0.1
export HG_TOOLS="${HG_TOOLS:-/tmp/hg-tools}"
export NODE_PATH="/opt/node22/lib/node_modules:$RIG_HOME/node_modules:$GV/node_modules"
export RIG_DB_URL="postgres://grapevine_archive:rigpass123@127.0.0.1:55432/grapevine_test"
export ADMIN_URL="postgres://postgres@127.0.0.1:55432/grapevine_test"
RIG_ARCHIVE_ENV="POW_BITS=8 NEW_ACCOUNT_MS=0 GV_DIRECT_PORT=8787 GV_DIRECT_URL=ws://127.0.0.1:8787/gv"
rig_up() { curl -s -m 2 -o /dev/null "$1"; }
