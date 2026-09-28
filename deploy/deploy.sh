#!/usr/bin/env bash
#
# deploy/deploy.sh — deploy otomatis aplikasi Raia ke server produksi.
#
# Urutan operasi (lihat deploy/README.md):
#   1. Prasyarat: docker, curl, dan file .env.production.local.
#   2. Simpan image lama sebagai ran-app:previous SEBELUM build.
#   3. Build image baru.
#   4. Jalankan migrasi database dari host SEBELUM kontainer diganti.
#   5. Ganti kontainer ran-app.
#   6. Pastikan ran-app tersambung ke jaringan teknoloka-network.
#   7. Uji kesehatan; bila gagal, rollback ke ran-app:previous.
#
# JANGAN dijalankan tanpa pemahaman: skrip ini me-restart kontainer produksi.
#
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env.production.local}"

IMAGE="ran-app:local"
PREVIOUS_IMAGE="ran-app:previous"
CONTAINER="ran-app"
APP_NET="ran-app-net"
EDGE_NET="teknoloka-network"
APP_URL="${APP_URL:-https://ran.teknoloka.id}"

HEALTH_RETRIES=12
HEALTH_DELAY=5

# Wajib ada di .env.production.local. Deploy ditolak bila salah satu kosong.
REQUIRED_KEYS=(DATABASE_URL AUTH_SECRET MIDTRANS_SERVER_KEY MIDTRANS_CLIENT_KEY)

log() { printf '\n[deploy] %s\n' "$*"; }
warn() { printf '[deploy] PERINGATAN: %s\n' "$*" >&2; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# --- Pembacaan .env.production.local sebagai DATA (tidak dieksekusi) -----------
declare -A ENV_MAP=()

load_env_file() {
  local file="$1" line key val
  ENV_MAP=()

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue          # baris kosong
    [[ "$line" =~ ^[[:space:]]*# ]] && continue          # komentar
    [[ "$line" == *"="* ]] || continue                   # bukan KEY=VALUE

    key="$(trim "${line%%=*}")"
    val="$(trim "${line#*=}")"

    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    # Buang TEPAT satu pasang kutip pembungkus, jika ada.
    if (( ${#val} >= 2 )); then
      if [[ "$val" == \"*\" ]]; then
        val="${val:1:${#val}-2}"
      elif [[ "$val" == \'*\' ]]; then
        val="${val:1:${#val}-2}"
      fi
    fi

    ENV_MAP["$key"]="$val"
  done < "$file"
}

env_get() { printf '%s' "${ENV_MAP[$1]:-}"; }

env_has() { [[ -n "${ENV_MAP[$1]:-}" ]]; }

# Ganti host:port pada URL database. Dipakai dua kali:
#   runtime  -> ran-postgres:5432  (cara kontainer menjangkau postgres)
#   migrasi  -> 127.0.0.1:5432     (cara host menjangkau postgres yang di-publish)
rewrite_db_host() {
  local url="$1" host="$2"
  printf '%s' "$url" | sed -E "s#@[^/]+/#@${host}/#"
}

# --- Prasyarat ----------------------------------------------------------------
check_prerequisites() {
  log "Memeriksa prasyarat"
  command -v docker >/dev/null 2>&1 || die "'docker' tidak ditemukan di PATH."
  command -v curl >/dev/null 2>&1 || die "'curl' tidak ditemukan di PATH."

  [[ -f "$ENV_FILE" ]] || die "File env '$ENV_FILE' tidak ditemukan. Buat file tersebut dengan ${REQUIRED_KEYS[*]} sebelum deploy."

  load_env_file "$ENV_FILE"

  # Fail-fast seperti DATABASE_URL: satu kunci wajib yang kosong berarti deploy akan
  # menimpa kontainer yang sedang bekerja dengan kontainer tanpa kredensial (mis. tanpa
  # kunci pembayaran), jadi berhenti SEBELUM menyentuh Docker apa pun.
  local missing=()
  local k
  for k in "${REQUIRED_KEYS[@]}"; do
    env_has "$k" || missing+=("$k")
  done
  if (( ${#missing[@]} > 0 )); then
    die "Kunci wajib berikut kosong atau tidak ada di '$ENV_FILE': ${missing[*]}. Isi dulu kunci tersebut sebelum deploy — tanpa itu kontainer baru akan berjalan tanpa kredensial pembayaran/database dan pembayaran di produksi akan rusak. Kunci wajib: ${REQUIRED_KEYS[*]}."
  fi

  local net
  for net in "$APP_NET" "$EDGE_NET"; do
    docker network inspect "$net" >/dev/null 2>&1 \
      || die "Jaringan docker '$net' tidak ada. Jaringan 'ran-app-net' dibuat saat instalasi awal; '$EDGE_NET' dipakai oleh teknoloka-nginx (lihat deploy/README.md)."
  done

  log "Prasyarat OK (env: $ENV_FILE)"
}

# --- Build args ---------------------------------------------------------------
build_args() {
  local app_url midtrans_key

  app_url="$(env_get NEXT_PUBLIC_APP_URL)"
  [[ -n "$app_url" ]] || app_url="$APP_URL"

  if env_has NEXT_PUBLIC_MIDTRANS_CLIENT_KEY; then
    midtrans_key="$(env_get NEXT_PUBLIC_MIDTRANS_CLIENT_KEY)"
  elif env_has MIDTRANS_CLIENT_KEY; then
    midtrans_key="$(env_get MIDTRANS_CLIENT_KEY)"
  else
    midtrans_key=""
    warn "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY dan MIDTRANS_CLIENT_KEY tidak ada di '$ENV_FILE'; build tanpa kunci Midtrans."
  fi

  BUILD_ARGS=(--build-arg "NEXT_PUBLIC_APP_URL=$app_url")
  if [[ -n "$midtrans_key" ]]; then
    BUILD_ARGS+=(--build-arg "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=$midtrans_key")
  fi
}

# --- Argumen runtime kontainer ------------------------------------------------
build_run_env() {
  local runtime_db_url auth_url k

  runtime_db_url="$(rewrite_db_host "$(env_get DATABASE_URL)" "ran-postgres:5432")"
  [[ -n "$runtime_db_url" ]] || die "Gagal menurunkan DATABASE_URL runtime dari '$ENV_FILE'."

  RUN_ENV=()
  for k in "${!ENV_MAP[@]}"; do
    if [[ "$k" == "DATABASE_URL" ]]; then
      continue
    fi
    RUN_ENV+=(-e "$k=${ENV_MAP[$k]}")
  done
  RUN_ENV+=(-e "DATABASE_URL=$runtime_db_url")

  # Nilai bawaan agar kontainer tidak kehilangan env penting yang tidak ditulis di file.
  # AUTH_URL dan AUTH_TRUST_HOST wajib ada agar login NextAuth bekerja di belakang nginx.
  if ! env_has AUTH_URL; then
    auth_url="$(env_get NEXT_PUBLIC_APP_URL)"
    [[ -n "$auth_url" ]] || auth_url="$APP_URL"
    RUN_ENV+=(-e "AUTH_URL=$auth_url")
    warn "AUTH_URL tidak ada di '$ENV_FILE'; memakai nilai bawaan '$auth_url'."
  fi
  if ! env_has AUTH_TRUST_HOST; then
    RUN_ENV+=(-e "AUTH_TRUST_HOST=true")
    warn "AUTH_TRUST_HOST tidak ada di '$ENV_FILE'; memakai nilai bawaan 'true'."
  fi

  if ! env_has MIDTRANS_IS_PRODUCTION; then
    RUN_ENV+=(-e "MIDTRANS_IS_PRODUCTION=false")
    warn "MIDTRANS_IS_PRODUCTION tidak ada di '$ENV_FILE'; memakai nilai bawaan 'false' (mode sandbox, sama dengan kontainer yang sedang berjalan)."
  fi
}

# --- Kontainer dan jaringan ---------------------------------------------------
edge_connected() {
  local nets
  nets="$(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$CONTAINER" 2>/dev/null)" || return 1
  [[ " $nets " == *" $EDGE_NET "* ]]
}

ensure_edge_network() {
  if edge_connected; then
    log "'$CONTAINER' sudah tersambung ke '$EDGE_NET'; lewati."
  else
    log "Menyambungkan '$CONTAINER' ke '$EDGE_NET'"
    docker network connect "$EDGE_NET" "$CONTAINER"
  fi
}

start_container() {
  local image="$1"
  if ! docker run -d --name "$CONTAINER" --restart unless-stopped --network "$APP_NET" \
    -v ran_kycdata:/app/data/kyc \
    "${RUN_ENV[@]}" \
    "$image"; then
    warn "Gagal menjalankan kontainer '$CONTAINER' dengan image '$image'."
    return 1
  fi
  if ! ensure_edge_network; then
    warn "Gagal menyambungkan '$CONTAINER' ke '$EDGE_NET'."
    return 1
  fi
  return 0
}

# --- Uji kesehatan ------------------------------------------------------------
health_ok() {
  local url code
  for url in "$APP_URL/" "$APP_URL/api/packages"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)"
    if [[ "$code" != "200" ]]; then
      printf '[deploy]   %s -> HTTP %s\n' "$url" "${code:-000}" >&2
      return 1
    fi
  done
  return 0
}

wait_healthy() {
  local attempt
  for (( attempt = 1; attempt <= HEALTH_RETRIES; attempt++ )); do
    if health_ok; then
      log "Uji kesehatan lulus pada percobaan $attempt/$HEALTH_RETRIES."
      return 0
    fi
    log "Uji kesehatan belum lulus ($attempt/$HEALTH_RETRIES); tunggu ${HEALTH_DELAY}s..."
    sleep "$HEALTH_DELAY"
  done
  return 1
}

rollback() {
  warn "Uji kesehatan tidak pernah lulus."

  if ! docker image inspect "$PREVIOUS_IMAGE" >/dev/null 2>&1; then
    warn "Image '$PREVIOUS_IMAGE' tidak tersedia; rollback otomatis mustahil. Perbaiki segera secara manual (lihat deploy/README.md)."
    exit 1
  fi

  warn "Mengembalikan ke '$PREVIOUS_IMAGE'."
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  if ! start_container "$PREVIOUS_IMAGE"; then
    warn "Rollback gagal: kontainer '$PREVIOUS_IMAGE' tidak bisa dijalankan. Perbaiki segera secara manual (lihat deploy/README.md)."
    exit 1
  fi
  if wait_healthy; then
    warn "Rollback selesai; situs kembali dilayani '$PREVIOUS_IMAGE'."
  else
    warn "Rollback dijalankan, tetapi uji kesehatan tetap gagal. Perlu intervensi manual."
  fi
  exit 1
}

# --- main ---------------------------------------------------------------------
main() {
  check_prerequisites
  build_run_env
  build_args

  log "Menyimpan image lama sebagai '$PREVIOUS_IMAGE' (sebelum build)"
  if docker image inspect "$IMAGE" >/dev/null 2>&1; then
    docker tag "$IMAGE" "$PREVIOUS_IMAGE"
  else
    warn "Image '$IMAGE' belum ada; tidak ada rollback otomatis untuk deploy ini."
  fi

  log "Build image '$IMAGE'"
  if ! docker build "${BUILD_ARGS[@]}" -t "$IMAGE" "$REPO_DIR"; then
    die "Build gagal. Kontainer produksi TIDAK disentuh."
  fi

  log "Menjalankan migrasi database (host 127.0.0.1:5432)"
  local migrate_db_url
  migrate_db_url="$(rewrite_db_host "$(env_get DATABASE_URL)" "127.0.0.1:5432")"
  if ! ( cd "$REPO_DIR" && DATABASE_URL="$migrate_db_url" npx prisma migrate deploy ); then
    die "Migrasi gagal. Kontainer produksi TIDAK disentuh."
  fi

  log "Mengganti kontainer '$CONTAINER' dengan image baru"
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  if ! start_container "$IMAGE"; then
    warn "Kontainer baru gagal dijalankan atau gagal tersambung ke jaringan edge."
    rollback
  fi

  log "Menguji kesehatan $APP_URL"
  if ! wait_healthy; then
    rollback
  fi

  log "Deploy selesai. '$APP_URL' melayani HTTP 200."
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
