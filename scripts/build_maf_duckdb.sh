#!/usr/bin/env bash
set -euo pipefail

WAR_PATH="${1:-./backend/target/cfdnadb.war}"
DATA_DIR="${2:-/400T/cfdnadb}"
SERVER_PORT="${3:-18081}"

java -jar "${WAR_PATH}" \
  --server.port="${SERVER_PORT}" \
  --app.data-dir="${DATA_DIR}" \
  --app.maf-import.enabled=true \
  --app.maf-import.exit-after-run=true
