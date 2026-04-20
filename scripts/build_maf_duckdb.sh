#!/usr/bin/env bash
set -euo pipefail

WAR_PATH="${1:-/400T/cfdnaweb/cfdnadb.war}"
DATA_DIR="${2:-/400T/cfdnaweb}"
SERVER_PORT="${3:-18081}"

DB_FILE="${DATA_DIR}/cfdnadb.duckdb"
BACKUP_FILE="${DB_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
BACKUP_CREATED=false

if [[ ! -f "${WAR_PATH}" ]]; then
  echo "[error] war not found: ${WAR_PATH}" >&2
  exit 1
fi

if [[ -f "${DB_FILE}" ]]; then
  echo "[backup] ${DB_FILE} -> ${BACKUP_FILE}"
  cp -p "${DB_FILE}" "${BACKUP_FILE}"
  BACKUP_CREATED=true
else
  echo "[backup] no existing duckdb at ${DB_FILE}, skipping backup"
fi

java -jar "${WAR_PATH}" \
  --server.port="${SERVER_PORT}" \
  --app.data-dir="${DATA_DIR}" \
  --app.query-db-file="cfdnadb.duckdb" \
  --app.maf-import.enabled=true \
  --app.maf-import.exit-after-run=true

echo "[done] rebuild finished."
if [[ "${BACKUP_CREATED}" == "true" ]]; then
  echo "       backup kept at: ${BACKUP_FILE}"
  echo "       verify the new db, then remove the backup manually:"
  echo "         rm ${BACKUP_FILE}"
fi