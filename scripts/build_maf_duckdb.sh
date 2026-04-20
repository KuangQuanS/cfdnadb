#!/usr/bin/env bash
set -euo pipefail

WAR_PATH="${1:-./backend/target/cfdnadb.war}"
DATA_DIR="${2:-/400T/cfdnaweb}"
SERVER_PORT="${3:-18081}"

DB_FILE="${DATA_DIR}/cfdnadb.duckdb"
BACKUP_FILE="${DB_FILE}.bak.$(date +%Y%m%d_%H%M%S)"

if [[ -f "${DB_FILE}" ]]; then
  echo "[backup] ${DB_FILE} -> ${BACKUP_FILE}"
  cp -p "${DB_FILE}" "${BACKUP_FILE}"
else
  echo "[backup] no existing duckdb at ${DB_FILE}, skipping backup"
fi

java -jar "${WAR_PATH}" \
  --server.port="${SERVER_PORT}" \
  --app.data-dir="${DATA_DIR}" \
  --app.query-db-file="cfdnadb.duckdb" \
  --app.maf-import.enabled=true \
  --app.maf-import.exit-after-run=true

echo "[done] rebuild finished. backup kept at: ${BACKUP_FILE:-<none>}"
echo "       verify the new db, then remove the backup manually:"
echo "         rm ${BACKUP_FILE:-<none>}"
