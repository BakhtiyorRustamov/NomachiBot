#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NomachiBot — daily PostgreSQL backup
#
# Dumps the database into BACKUP_DIR (default /var/backups/nomachibot) with
# a timestamped filename and gzips it. Anything older than RETAIN_DAYS days
# (default 7) is removed so the disk doesn't fill.
#
# Designed to be invoked from cron:
#   0 3 * * *  /path/to/nomachibot-api/scripts/backup.sh >> /var/log/nomachibot-backup.log 2>&1
#
# Required environment:
#   DATABASE_URL   — same value the API uses, e.g.
#                    postgresql://user:pass@host:5432/dbname
#
# Optional:
#   BACKUP_DIR     — default /var/backups/nomachibot
#   RETAIN_DAYS    — default 7
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[backup] DATABASE_URL is not set" >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/nomachibot}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/nomachibot_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] dumping to ${OUT_FILE}"
# --no-owner / --no-privileges keep the dump portable across restore targets.
pg_dump --no-owner --no-privileges --format=plain "${DATABASE_URL}" \
  | gzip -9 > "${OUT_FILE}"

# Sanity check — never let a zero-byte dump pose as a real backup.
if [[ ! -s "${OUT_FILE}" ]]; then
  echo "[backup] FAILED: dump file is empty — leaving older backups in place" >&2
  rm -f "${OUT_FILE}"
  exit 2
fi

echo "[backup] success — $(du -h "${OUT_FILE}" | cut -f1)"

# Prune anything older than RETAIN_DAYS days.
find "${BACKUP_DIR}" -type f -name 'nomachibot_*.sql.gz' -mtime "+${RETAIN_DAYS}" -delete
echo "[backup] pruned backups older than ${RETAIN_DAYS} days"
