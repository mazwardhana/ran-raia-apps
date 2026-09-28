# Deploy & Backup Raia

Skrip operasional untuk aplikasi Raia (`https://ran.teknoloka.id`).

- `deploy.sh` — build, migrasi, ganti kontainer, uji kesehatan, dan rollback otomatis.
- `backup.sh` — backup harian database PostgreSQL dari kontainer `ran-postgres`.

Arsitektur singkat: `ran-app` (aplikasi) + `ran-postgres` (database) berjalan sebagai
kontainer Docker. `ran-app` tersambung ke jaringan internal `ran-app-net` (ke database)
dan ke `teknoloka-network` (agar dijangkau `teknoloka-nginx`).

---

## Prasyarat

- Docker terpasang dan daemon berjalan.
- `curl` tersedia di PATH.
- `npx` / Node.js tersedia di PATH (untuk `prisma migrate deploy`).
- Repo sudah di-clone di server, semua perintah dijalankan dari direktori repo.
- Jaringan `ran-app-net` sudah ada, kontainer `ran-postgres` sudah berjalan.
- Jaringan `teknoloka-network` sudah ada (dibuat oleh nginx/edge).
- File `.env.production.local` ada di akar repo (di-ignore git, **jangan** di-commit).

### Kunci di `.env.production.local`

Empat kunci ini **wajib**. Bila salah satu kosong, `deploy.sh` berhenti dengan kode ≠ 0 sebelum
menyentuh Docker apa pun — tidak ada deploy yang bisa menghapus kredensial pembayaran dari kontainer.

| Kunci | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | **Ya** | URL koneksi PostgreSQL. Boleh memakai host `ran-postgres:5432` **atau** `127.0.0.1:5432`; skrip menormalkan hostnya sendiri (kontainer memakai `ran-postgres:5432`, migrasi host memakai `127.0.0.1:5432`). |
| `AUTH_SECRET` | **Ya** | Rahasia sesi NextAuth. |
| `MIDTRANS_SERVER_KEY` | **Ya** | Kunci server Midtrans. Tanpa ini pembayaran server-side gagal, jadi skrip menolak deploy. |
| `MIDTRANS_CLIENT_KEY` | **Ya** | Kunci klien Midtrans (nilai yang sama dengan `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`). |

Kunci berikut **punya nilai bawaan** — boleh tidak ditulis di file, skrip mengisinya sendiri dan
mencetak peringatan berisi nilai yang diasumsikan:

| Kunci | Wajib | Nilai bawaan |
| --- | --- | --- |
| `AUTH_URL` | Tidak (di-default) | `NEXT_PUBLIC_APP_URL` bila ada, selain itu `https://ran.teknoloka.id`. |
| `AUTH_TRUST_HOST` | Tidak (di-default) | `true` (wajib `true` di belakang nginx). |
| `MIDTRANS_IS_PRODUCTION` | Tidak (di-default) | `false` — mode sandbox, sama dengan kontainer `ran-app` yang sedang berjalan. |
| `NEXT_PUBLIC_APP_URL` | Tidak (di-default) | `https://ran.teknoloka.id`; dipakai sebagai build-arg dan sumber nilai `AUTH_URL`. |

Kunci build-only:

| Kunci | Wajib | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Tidak | Kunci klien yang dibundel ke browser. Bila kosong, skrip jatuh ke `MIDTRANS_CLIENT_KEY` (yang sudah wajib, jadi build selalu punya kunci klien). |
| `MIDTRANS_MODE` | Tidak | Mis. `simulate` / `production`. Tambahkan sendiri; skrip meneruskan semua kunci `KEY=VALUE` secara generik. |

> Kontainer `ran-app` saat ini membawa `AUTH_URL`, `AUTH_TRUST_HOST`, `MIDTRANS_SERVER_KEY`,
> `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`,
> `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `AUTH_SECRET`. Karena `.env.production.local` berisi
> **hanya** `AUTH_SECRET` hari ini, `deploy.sh` akan **menolak berjalan** sampai keempat kunci wajib
> (termasuk dua kunci Midtrans) diisi. Itu memang disengaja: kontainer lama tidak boleh diganti
> dengan kontainer yang kehilangan kredensial pembayaran.

Contoh:

```sh
DATABASE_URL="postgresql://raia:raia_password@ran-postgres:5432/raia"
AUTH_SECRET="ganti-dengan-rahasia-panjang"
MIDTRANS_SERVER_KEY="Mid-server-xxxxxxxx"
MIDTRANS_CLIENT_KEY="Mid-client-xxxxxxxx"
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="Mid-client-xxxxxxxx"
MIDTRANS_IS_PRODUCTION="false"
AUTH_URL="https://ran.teknoloka.id"
AUTH_TRUST_HOST="true"
NEXT_PUBLIC_APP_URL="https://ran.teknoloka.id"
```

Skrip membaca file ini **sebagai data**, bukan dengan `source`/`.`, jadi isinya tidak dieksekusi.
Tanda kutip pembungkus (`"..."`) dibuang otomatis.

> **Jangan menulis rahasia apa pun di dalam skrip.** Semua nilai berasal dari `.env.production.local`.

---

## `deploy/deploy.sh`

```sh
./deploy/deploy.sh
```

Urutan yang dijalankan:

1. **Prasyarat** — cek `docker`, `curl`, dan `.env.production.local`.
2. **Simpan image lama** — `ran-app:local` di-tag sebagai `ran-app:previous` **sebelum** build
   (build akan menimpa tag `ran-app:local`, jadi penag-an harus lebih dulu). Bila image lama
   belum ada, skrip memberi peringatan dan deploy berjalan tanpa rollback otomatis.
3. **Build** — `docker build` dengan `NEXT_PUBLIC_APP_URL` dan
   `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`. Bila build gagal, skrip berhenti dan **kontainer produksi
   tidak disentuh**.
4. **Migrasi** — `npx prisma migrate deploy` dijalankan **di host, sebelum** kontainer diganti,
   memakai host `127.0.0.1:5432`. Bila migrasi gagal, skrip berhenti dan kontainer produksi tetap
   berjalan.
5. **Ganti kontainer** — `docker rm -f ran-app` lalu `docker run ...` dengan image baru,
   termasuk volume `ran_kycdata:/app/data/kyc`.
6. **Jaringan edge** — sambungkan `ran-app` ke `teknoloka-network` bila belum tersambung.
7. **Uji kesehatan** — `https://ran.teknoloka.id/` dan `/api/packages` harus HTTP 200,
   diulang hingga 12 kali dengan jeda 5 detik.
8. **Rollback otomatis** — bila `docker run` gagal, sambungan ke `teknoloka-network` gagal, **atau**
   uji kesehatan tidak pernah lulus, kontainer dijalankan kembali dengan image `ran-app:previous`
   (dan disambungkan ulang ke edge) sehingga situs tidak dibiarkan 502. Skrip selalu keluar dengan
   kode ≠ 0 bila rollback terjadi.

Variabel yang bisa ditimpa saat memanggil: `ENV_FILE` (lokasi file env), `APP_URL`.

---

## `deploy/backup.sh`

```sh
# Tujuan default: /opt/ran-backups/ran
./deploy/backup.sh

# Tujuan lewat argumen
./deploy/backup.sh /mnt/backup/raia

# Tujuan lewat env
RAN_BACKUP_DIR=/mnt/backup/raia ./deploy/backup.sh
```

Prioritas tujuan: argumen `$1` → `RAN_BACKUP_DIR` → default `/opt/ran-backups/ran`.
Direktori dibuat otomatis (`mkdir -p`).

Hasil: `ran-<YYYYMMDD-HHMMSS>.sql.gz` (contoh `ran-20260928-013000.sql.gz`), berisi
`pg_dump -U raia raia` dari kontainer `ran-postgres` yang dikompres gzip.

- Bila `pg_dump` gagal atau hasilnya kosong, skrip keluar dengan kode ≠ 0 dan **menghapus arsip
  parsial** (ditulis ke `.part` dulu, baru dipindahkan setelah sukses).
- **Retensi 14 hari**: arsip `*.sql.gz` yang lebih tua dari 14 hari dihapus otomatis setiap kali
  backup berjalan.

### Cron harian

Backup setiap hari pukul 01:30, log ke `/var/log/ran-backup.log`:

```cron
30 1 * * * cd /opt/projects/ran-project && ./deploy/backup.sh >> /var/log/ran-backup.log 2>&1
```

Pasang dengan `crontab -e`. Pastikan direktori log ada dan bisa ditulis.

---

## Rollback manual ke `ran-app:previous`

Rollback otomatis sudah dilakukan `deploy.sh` saat uji kesehatan gagal. Untuk rollback manual,
jalankan perintah berikut dari akar repo:

```sh
cd /opt/projects/ran-project

# Memuat fungsi deploy.sh SAJA (main() tidak dijalankan karena diproteksi guard).
source deploy/deploy.sh

# Baca .env sebagai data (tanpa source), lalu susun -e dan jalankan image sebelumnya.
load_env_file "$ENV_FILE"
build_run_env

docker rm -f ran-app
start_container ran-app:previous

curl -fsS https://ran.teknoloka.id/ >/dev/null && echo "OK"
```

Cara ini memakai ulang pembacaan env yang sama dengan `deploy.sh`, jadi kutip pembungkus di
`.env.production.local` dibuang dan `DATABASE_URL` otomatis memakai host `ran-postgres:5432`.

> **Jangan** memakai `docker run --env-file` untuk rollback: Docker meneruskan tanda kutip
> apa adanya, sehingga nilai seperti `DATABASE_URL="postgresql://..."` menjadi rusak.

Setelah rollback, periksa log:

```sh
docker logs --tail 100 ran-app
```

---

## Berkas terkait

- `.env.production.local` — rahasia runtime (tidak di-commit).
- `deploy/deploy.sh`, `deploy/backup.sh` — skrip di dokumen ini.
