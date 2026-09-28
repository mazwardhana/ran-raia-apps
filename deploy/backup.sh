#!/usr/bin/env bash
#
# deploy/backup.sh — backup harian database Raia dari kontainer ran-postgres.
#
# Pemakaian:
#   ./deploy/backup.sh [direktori-tujuan]
#   RAN_BACKUP_DIR=/path/ke/backup ./deploy/backup.sh
#
# Tujuan backup: argumen $1, lalu $RAN_BACKUP_DIR, lalu default /opt/ran-backups/ran.
# Retensi: arsip *.sql.gz yang lebih tua dari 14 hari dihapus otomatis.
#
set -euo pipefail

CONTAINER="ran-postgres"
DB_USER="raia"
DB_NAME="raia"
RETENTION_DAYS=14
DEFAULT_BACKUP_DIR="/opt/ran-backups/ran"

log() { printf '[backup] %s\n' "$*"; }
err() { printf '[backup] ERROR: %s\n' "$*" >&2; }

# Tentukan direktori tujuan: argumen, lalu env, lalu default.
backup_dir() {
  if [[ -n "${1:-}" ]]; then
    printf '%s\n' "$1"
  elif [[ -n "${RAN_BACKUP_DIR:-}" ]]; then
    printf '%s\n' "$RAN_BACKUP_DIR"
  else
    printf '%s\n' "$DEFAULT_BACKUP_DIR"
  fi
}

# Hapus arsip *.sql.gz yang lebih tua dari batas hari di dalam direktori tujuan.
# Dipisah dari main() agar bisa di-source dan diuji pada direktori sementara:
#   apply_retention <direktori> [hari]
apply_retention() {
  local dir="$1"
  local days="${2:-$RETENTION_DAYS}"

  [[ -d "$dir" ]] || return 0

  find "$dir" -maxdepth 1 -type f -name '*.sql.gz' -mtime "+$days" -print -delete
}

main() {
  local dir tmp final

  dir="$(backup_dir "${1:-}")"
  mkdir -p "$dir"

  final="$dir/ran-$(date +%Y%m%d-%H%M%S).sql.gz"
  tmp="$final.part"

  # Jangan pernah meninggalkan arsip setengah jadi.
  trap 'rm -f "$tmp"' EXIT

  log "Mulai backup database '$DB_NAME' dari kontainer '$CONTAINER'"
  log "Tujuan: $final"

  if ! docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$tmp"; then
    err "pg_dump gagal. Arsip parsial dihapus, backup dibatalkan."
    rm -f "$tmp"
    trap - EXIT
    return 1
  fi

  if [[ ! -s "$tmp" ]]; then
    err "Hasil backup kosong. Arsip dibatalkan."
    rm -f "$tmp"
    trap - EXIT
    return 1
  fi

  mv "$tmp" "$final"
  trap - EXIT
  log "Backup selesai: $final ($(du -h "$final" | cut -f1))"

  log "Retensi: menghapus arsip lebih tua dari $RETENTION_DAYS hari"
  apply_retention "$dir"

  log "Selesai."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
