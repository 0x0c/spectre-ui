#!/usr/bin/env bash
# Demo 2: the authoring and delivery API (packages/server, SU-0004).
#
# Starts PostgreSQL (via Docker if nothing is listening on 5432 already), runs the
# migrations, starts the server, then walks through the same loop an author drives from
# the editor: create a draft from examples/screens/product-detail.json, validate it,
# publish it to the "internal" channel, and fetch it back through the delivery API. See
# docs/demo.md for what each step demonstrates.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
ROOT="$(demo_repo_root)"
cd "$ROOT"

demo_require_cmd node "Install Node.js 22 or newer: https://nodejs.org"
demo_require_cmd pnpm "Install pnpm: https://pnpm.io/installation"
demo_require_cmd curl "Install curl."

PORT="${PORT:-3000}"
DATABASE_URL="${DATABASE_URL:-postgres://spectre:spectre@localhost:5432/spectre_dev}"
DB_HOST="$(node -e "console.log(new URL(process.argv[1]).hostname)" "$DATABASE_URL")"
DB_PORT="$(node -e "console.log(new URL(process.argv[1]).port || 5432)" "$DATABASE_URL")"

DOCKER_CONTAINER="spectre-ui-demo-postgres"
STARTED_DOCKER_POSTGRES=0
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    demo_log "Stopping the server"
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [ "$STARTED_DOCKER_POSTGRES" = "1" ]; then
    demo_log "Stopping the demo PostgreSQL container"
    docker rm -f "$DOCKER_CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

port_is_open() {
  (exec 3<>"/dev/tcp/$1/$2") 2>/dev/null && exec 3>&- 3<&-
}

wait_for_port() {
  local host="$1" port="$2" tries=30
  until port_is_open "$host" "$port"; do
    tries=$((tries - 1))
    [ "$tries" -le 0 ] && demo_die "Timed out waiting for $host:$port"
    sleep 1
  done
}

wait_for_http() {
  local url="$1" tries=30
  until curl -fsS -o /dev/null "$url" 2>/dev/null; do
    tries=$((tries - 1))
    [ "$tries" -le 0 ] && demo_die "Timed out waiting for $url"
    sleep 1
  done
}

json_get() {
  # json_get '<js expression on `d`>' reads a JSON document from stdin.
  node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log($1)"
}

pretty_json() {
  node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync(0,'utf8')), null, 2))"
}

if port_is_open "$DB_HOST" "$DB_PORT"; then
  demo_log "Found PostgreSQL already listening on $DB_HOST:$DB_PORT — reusing it"
else
  demo_require_cmd docker "Nothing is listening on $DB_HOST:$DB_PORT, and Docker is needed to start one. Install Docker, or point DATABASE_URL at an existing PostgreSQL instance."
  docker info >/dev/null 2>&1 || demo_die "Docker is installed but not running. Start Docker Desktop (or the docker daemon), or point DATABASE_URL at an existing PostgreSQL instance."
  demo_log "Starting a throwaway PostgreSQL 16 container ($DOCKER_CONTAINER)"
  docker run --rm -d --name "$DOCKER_CONTAINER" \
    -e POSTGRES_USER=spectre -e POSTGRES_PASSWORD=spectre -e POSTGRES_DB=spectre_dev \
    -p "$DB_PORT:5432" postgres:16 >/dev/null
  STARTED_DOCKER_POSTGRES=1
  wait_for_port "$DB_HOST" "$DB_PORT"
fi

if [ ! -d node_modules ] || [ ! -d packages/server/node_modules ]; then
  demo_log "Installing dependencies (pnpm install)"
  pnpm install
fi

demo_log "Running migrations"
DATABASE_URL="$DATABASE_URL" pnpm --filter @spectre-ui/server run migrate

demo_log "Starting the server on port $PORT"
DATABASE_URL="$DATABASE_URL" PORT="$PORT" pnpm --filter @spectre-ui/server run start \
  > /tmp/spectre-ui-demo-server.log 2>&1 &
SERVER_PID=$!
wait_for_http "http://localhost:$PORT/healthz"
demo_log "Server is up (log: /tmp/spectre-ui-demo-server.log)"

BASE_URL="http://localhost:$PORT"
BODY_FILE="examples/screens/product-detail.json"

echo
demo_log "1/4 Creating a draft document from $BODY_FILE"
CREATE_RESPONSE="$(
  node -e '
    const fs = require("fs");
    const body = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(JSON.stringify({ screenId: "product-detail-demo", name: "Product detail (demo)", body, actor: "demo-script" }));
  ' "$BODY_FILE" |
    curl -fsS -X POST "$BASE_URL/api/documents" -H 'content-type: application/json' --data-binary @-
)"
DOCUMENT_ID="$(echo "$CREATE_RESPONSE" | json_get 'd.document.id')"
echo "  document id : $DOCUMENT_ID"

echo
demo_log "2/4 Validating the draft"
curl -fsS -X POST "$BASE_URL/api/documents/$DOCUMENT_ID/validate" \
  -H 'content-type: application/json' --data '{"seq":1}' | pretty_json | sed 's/^/  /'

echo
demo_log "3/4 Publishing to the \"internal\" channel"
PUBLISH_RESPONSE="$(
  curl -fsS -X POST "$BASE_URL/api/documents/$DOCUMENT_ID/publish" \
    -H 'content-type: application/json' \
    --data '{"seq":1,"channel":"internal","actor":"demo-script"}'
)"
RELEASE_ID="$(echo "$PUBLISH_RESPONSE" | json_get 'd.release.id')"
echo "  release id  : $RELEASE_ID"

echo
demo_log "4/4 Fetching it back through the delivery API"
curl -si "$BASE_URL/screens/product-detail-demo?channel=internal" | sed 's/^/  /'

cat <<EOF

Try it yourself while the server keeps running:
  curl $BASE_URL/screens/product-detail-demo?channel=internal
  curl $BASE_URL/api/documents/$DOCUMENT_ID
  curl $BASE_URL/api/documents/$DOCUMENT_ID/audit

Stop: Ctrl+C
EOF

wait "$SERVER_PID"
