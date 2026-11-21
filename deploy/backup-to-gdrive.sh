#!/usr/bin/env bash
set -euo pipefail

# Daily atomic snapshot of Playtested db.json -> compressed -> uploaded to your 5 TB Google Drive
# Requires rclone configured with a remote named "gdrive" (see deploy/DEPLOY_ORACLE_CLOUDFLARE.md)

APP_DIR="/opt/playtested"
DB_FILE="${APP_DIR}/db.json"
REMOTE_DIR="gdrive:Playtested-Backups"
RETENTION_DAYS=90
STAMP="$(date -u +%Y-%m-%d_%H%M%S)"
TMP_DIR="$(mktemp -d)"
ARCHIVE="${TMP_DIR}/playtested-db-${STAMP}.json.gz"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [[ ! -f "${DB_FILE}" ]]; then
  echo "[backup] ERROR: ${DB_FILE} not found." >&2
  exit 1
fi

# Atomic copy + gzip compression (validates JSON before uploading)
cp "${DB_FILE}" "${TMP_DIR}/db.json"
node -e "const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('[backup] Validated JSON:', d.games.length, 'games,', d.reviews.length, 'reviews');" "${TMP_DIR}/db.json"
gzip -9 -c "${TMP_DIR}/db.json" > "${ARCHIVE}"

# Upload timestamped backup + refresh latest pointer on Google Drive
rclone copyto "${ARCHIVE}" "${REMOTE_DIR}/playtested-db-${STAMP}.json.gz" --stats-one-line
rclone copyto "${ARCHIVE}" "${REMOTE_DIR}/playtested-db-latest.json.gz" --stats-one-line

# Prune backups older than RETENTION_DAYS (keeps latest intact)
rclone delete "${REMOTE_DIR}" --min-age "${RETENTION_DAYS}d" --include "playtested-db-20*.json.gz"

echo "[backup] Uploaded $(basename "${ARCHIVE}") to ${REMOTE_DIR} successfully."
