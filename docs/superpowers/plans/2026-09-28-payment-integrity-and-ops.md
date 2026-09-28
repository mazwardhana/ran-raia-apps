# Rencana: Integritas Pembayaran, Operasional, dan Foto KTP — 2026-09-28

## Konteks

Repo `/opt/projects/ran-project`, branch `feature/raia-mvp` (bukan `main`), working tree bersih di `63d52ed`.

Aplikasi sudah **live** di `https://ran.teknoloka.id` dengan arsitektur:
Cloudflare Tunnel → `teknoloka-nginx:80` → container `ran-app:3000` → container `ran-postgres:5432`.

Fakta teknis yang dipakai semua task:

- Next.js 14 App Router, TypeScript, Mantine v7, Prisma 5.22.0, next-auth beta (JWT).
- Test: vitest + jsdom, file di `src/tests/**`, timeout 20000ms.
- Prisma di test **selalu** dimock lewat `vi.mock('@/lib/prisma', ...)` — test tidak menyentuh database.
- `DATABASE_URL` (dev/host) menunjuk `127.0.0.1:5432` = container `ran-postgres` (data seed produksi).
- `npx prisma migrate status` → *Database schema is up to date*, 1 migrasi (`20260927140921_init`).
- `UserProfile` tidak punya kolom gambar. Tidak ada UI approval KYC di operator.

## Global Constraints (berlaku untuk SEMUA task)

1. Semua teks antarmuka **bahasa Indonesia**.
2. **Jangan pernah `git add -A` atau `git add .`** — stage hanya file eksplisit milik task Anda.
3. **Jangan** menjalankan `npx tsc`, `npm run build`, `npm run lint`, atau `npm test` (suite penuh). Task lain mengerjakan tree yang sama secara bersamaan. Jalankan hanya test skop Anda: `npx vitest run src/tests/<berkas-anda>.test.ts[x]`.
4. **Jangan pernah** `prisma migrate dev` tanpa `--create-only`, dan **jangan pernah** `prisma migrate reset` atau `prisma db push` — keduanya menghapus data seed produksi.
5. Jangan mengubah file **di luar daftar "File yang dimiliki task Anda"**.
6. Off-limits: `/opt/teknoloka/nginx/conf.d/ran.conf`, dan container milik proyek lain (`raia-app`, `raia-postgres`, `raia-*`, `9router`).
7. 158 test yang sudah ada harus tetap hijau — jangan mengubah perilaku yang mereka asumsikan.
8. Halaman yang membaca database tetap memakai `export const dynamic = 'force-dynamic'`.
9. TDD wajib: tulis test yang **gagal dulu**, jalankan, lihat gagal, **baru** tulis kode.

---

## Task 1: Perbaiki kebocoran slot lot, rumus nomor lot, dan tambah mode simulasi pembayaran

### File yang dimiliki task ini

- `src/lib/reservations.ts` **(baru)**
- `src/lib/midtrans.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/payments/midtrans/callback/route.ts`
- `src/app/api/payments/simulate/route.ts` **(baru)**
- `src/app/app/checkout/[id]/page.tsx`
- `src/app/app/bayar-simulasi/[orderId]/page.tsx` **(baru)**
- `src/tests/reservations.test.ts` **(baru)**
- `src/tests/checkout.test.ts` (boleh ditambah; jangan mengubah ekspektasi test lama)

**Jangan** sentuh `prisma/schema.prisma`, `Dockerfile`, `.gitignore`, `src/app/api/kyc/*`, `src/app/kyc/*`, `src/tests/kyc.test.tsx` — itu milik task lain.

### Fakta: apa yang rusak sekarang

**(A) Slot lot bocor saat token Midtrans gagal dibuat.**

`src/app/api/checkout/route.ts` baris 117–172: `prisma.$transaction` melakukan
`tx.package.updateMany({ data: { soldLots: { increment: requestedLots } } })`, lalu membuat
`Transaction` (status `PENDING`, `expiredAt` = +24 jam), lalu membuat `LotOwnership`/`FullOwnership`.
Transaksi itu **commit** lebih dulu. Baru setelahnya, di baris 176, `await createSnapToken(...)`
dipanggil **di luar** transaksi itu. Kalau panggilan itu gagal, blok `catch` mengembalikan
`500 {"error":"Terjadi kesalahan saat memproses checkout"}` **tanpa mengembalikan slot**.

**(B) Rumus nomor lot salah.**

Baris 158–159:

```ts
const lotStart = pkg.soldLots - requestedLots + 1;
const lotEnd = pkg.soldLots;
```

`pkg.soldLots` adalah nilai **sebelum** inkrement. Rentang yang seharusnya baru dikuasai adalah
`[pkg.soldLots + 1, pkg.soldLots + requestedLots]`. Saat ini, untuk paket `soldLots = 0`
membeli 5 lot hasilnya `[-4, 0]`; untuk `soldLots = 10` membeli 5 lot hasilnya `[6, 10]`
— **bertumpuk dengan pemilik sebelumnya**. Pembanding: `prisma/seed.ts` baris 299 memakai
`lotStart: lotsAssigned + 1` (benar). Belum ada baris runtime yang terdampak
(`select count(*) from "Transaction" where "orderId" like 'TRX-%'` = 0).

**(C) Callback Midtrans melepas status tetapi tidak melepas slot.**

`src/app/api/payments/midtrans/callback/route.ts` sudah menangani `expire`/`deny`/`cancel`
dan menyetel status `EXPIRED`/`CANCELLED`, tetapi **tidak pernah** menurunkan `soldLots`
dan **tidak pernah** menghapus baris kepemilikan.

**(D) `Transaction.expiredAt` tidak pernah dibaca siapa pun.**

`grep -rn "expiredAt" src` hanya menemukan penulisan di checkout route. Tidak ada cron dan
tidak ada pembersih. Enum `TransactionStatus` sudah punya `EXPIRED`/`CANCELLED` dan kolom
`lotCount` sudah ada — **tidak ada migrasi yang diperlukan** untuk perbaikan ini.

**(E) Fallback bisa melempar pengguna ke `/undefined`.**

`src/app/app/checkout/[id]/page.tsx` baris 206–213: bila `window.snap?.pay` tidak tersedia,
kode langsung `window.location.href = data.redirectUrl`. `redirectUrl` bisa `undefined`
untuk order yang gagal, sehingga pengguna diarahkan ke `/undefined`.

**Konvensi yang sudah ada di proyek:** `expireStaleListings()` dari `src/lib/secondary.ts`
dipanggil oportunistik di awal `GET /api/secondary` dan `POST /api/secondary/buy`. Tidak ada
infrastruktur cron di proyek ini.

### Persyaratan

**RED — tulis test yang gagal dulu di `src/tests/reservations.test.ts`**, jalankan
`npx vitest run src/tests/reservations.test.ts`, dan pastikan gagal karena perilakunya belum ada
(bukan karena typo atau error import). Pakai pola mock yang sama dengan `src/tests/checkout.test.ts`
(`vi.mock('@/lib/prisma', ...)`, `vi.mock('@/lib/midtrans', ...)`, `vi.mock('@/lib/auth', ...)`).

Perilaku yang harus diuji:

1. Saat `createSnapToken` melempar error, `soldLots` **kembali** ke nilai semula, status transaksi
   menjadi `CANCELLED`, dan baris `LotOwnership`/`FullOwnership` milik pesanan itu dihapus.
2. `releaseReservation` **idempoten** — dipanggil dua kali hanya menurunkan `soldLots` satu kali.
3. Callback `expire` menurunkan `soldLots` dan menghapus baris kepemilikan, bukan hanya status.
4. `expireStaleTransactions()` melepas pesanan `PENDING` yang `expiredAt`-nya sudah lewat,
   dan **tidak** menyentuh pesanan `PAID` atau yang belum jatuh tempo.
5. Rumus nomor lot: `pkg.soldLots = 10`, `requestedLots = 5` → `lotStart = 11`, `lotEnd = 15`.
6. Mode simulasi: `MIDTRANS_MODE=simulate` membuat checkout melewati Midtrans; nilai lain memakai
   Midtrans. Endpoint simulasi menolak (`404`) saat mode bukan `simulate`.

**GREEN — tulis kode minimal yang membuat semua test itu hijau.**

1. **`src/lib/reservations.ts`** dengan dua fungsi:
   - `releaseReservation(tx, transactionId)` — menerima Prisma *transaction client*, mencari pesanan,
     melepas **hanya bila status masih `PENDING`**, menurunkan `Package.soldLots` sebesar
     `transaction.lotCount ?? (pemilikannya FULL ? package.totalLots : 0)`, menghapus baris
     kepemilikan milik pesanan itu, lalu menyetel status.
   - `expireStaleTransactions()` — menyapu semua `PENDING` dengan `expiredAt < now` dan memanggil
     `releaseReservation` untuk tiap baris. Tanpa argumen.
2. **Perbaiki rumus lot** baris 158–159 menjadi rentang yang baru dikuasai.
3. **Kabel ke tiga jalur:**
   - `/api/checkout`: bungkus `createSnapToken` dengan `try/catch`; bila gagal → `releaseReservation`
     dan status `CANCELLED`, lalu kembalikan error yang jujur ke pengguna.
   - callback: pada `expire`/`deny`/`cancel` → `releaseReservation`.
   - panggil `expireStaleTransactions()` di awal `POST /api/checkout`, mengikuti pola
     `expireStaleListings()`.
4. **Perbaiki fallback** (E): hanya `window.location.href` bila `data.redirectUrl` adalah string
   non-kosong; selain itu tampilkan tautan yang bisa diklik.
5. **Mode simulasi**, dikendalikan env `MIDTRANS_MODE` (`simulate` = aktif; selain itu = mati,
   termasuk bila tidak diset):
   - `/api/checkout` saat mode simulasi **melewati** `createSnapToken` dan mengembalikan
     `simulate: true` plus `redirectUrl` internal ke `/app/bayar-simulasi/<orderId>`.
   - Halaman baru `src/app/app/bayar-simulasi/[orderId]/page.tsx` dengan dua tombol
     **"Bayar berhasil"** dan **"Batalkan"**, keduanya memanggil endpoint simulasi.
   - Endpoint baru `src/app/api/payments/simulate/route.ts` yang **hanya bekerja bila
     `MIDTRANS_MODE=simulate`** dan hanya untuk pesanan milik pengguna yang login; bila mode nyata
     balas `404`, supaya tidak pernah menjadi celah "tandai lunas sendiri".
   - Halaman mengikuti pola halaman lain (Mantine, `export const dynamic = 'force-dynamic'` bila membaca DB).

### Kriteria selesai

- `npx vitest run src/tests/reservations.test.ts src/tests/checkout.test.ts src/tests/checkout-page.test.tsx` hijau.
- Test lama tidak berubah kecuali ada penambahan.
- Tidak ada file di luar daftar kepemilikan yang diubah.

### Laporan

Tulis laporan lengkap ke `.superpowers/sdd/2026-09-28-payment-integrity-and-ops/task-1-report.md`,
lalu kembalikan hanya: status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED),
ringkasan satu baris test, hash commit, dan kekhawatiran.

---

## Task 2: Skrip deploy otomatis dan backup database harian

### File yang dimiliki task ini

- `deploy/deploy.sh` **(baru)**
- `deploy/backup.sh` **(baru)**
- `deploy/README.md` **(baru)**

Jangan sentuh file lain sama sekali — termasuk `Dockerfile`, `.gitignore`, dan `src/**`.
Secara khusus **jangan** membaca atau mengubah `/opt/teknoloka/nginx/conf.d/ran.conf`.

### Fakta: cara deploy yang sudah terbukti bekerja

Semua perintah dijalankan dari direktori repo. Deploy memang **tidak** memakai `docker compose up`,
karena `docker-compose.yml` di repo memakai `container_name` tetap yang bisa bentrok dengan
proyek lain di server yang sama.

1. Jaringan dan database (sekali saja, sudah berjalan — jangan jalankan ulang):
   ```sh
   docker network create ran-app-net
   docker run -d --name ran-postgres --restart unless-stopped \
     --network ran-app-net -e POSTGRES_USER=raia -e POSTGRES_PASSWORD=raia_password \
     -e POSTGRES_DB=raia -p 127.0.0.1:5432:5432 \
     -v ran_pgdata:/var/lib/postgresql/data postgres:16-alpine
   ```
2. Build image:
   ```sh
   docker build \
     --build-arg NEXT_PUBLIC_APP_URL=https://ran.teknoloka.id \
     --build-arg NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=<klien> \
     -t ran-app:local .
   ```
3. Menjalankan kontainer (image lama disimpan dulu untuk rollback):
   ```sh
   docker tag ran-app:local ran-app:previous
   docker rm -f ran-app
   docker run -d --name ran-app --restart unless-stopped --network ran-app-net \
     -v ran_kycdata:/app/data/kyc \
     -e DATABASE_URL=postgresql://raia:raia_password@ran-postgres:5432/raia \
     -e AUTH_SECRET=... -e AUTH_URL=https://ran.teknoloka.id -e AUTH_TRUST_HOST=true \
     ran-app:local
   docker network connect teknoloka-network ran-app
   ```
   Semua nilai `-e` dibaca dari `.env.production.local` (sudah di-ignore git, sudah berisi
   `AUTH_SECRET`), **bukan** ditulis keras di skrip. Skrip wajib berhenti bila file itu tidak ada.
4. Migrasi: `DATABASE_URL=...@127.0.0.1:5432/raia npx prisma migrate deploy`
   (jalan di host, sebelum kontainer dijalankan ulang; **tidak** pakai `migrate dev`).
5. Uji kesehatan: `curl -fsS https://ran.teknoloka.id/` dan `curl -fsS https://ran.teknoloka.id/api/packages`
   harus HTTP 200.

### Persyaratan

**RED — buktikan dulu bahwa skripnya belum ada.** Jalankan `test -f deploy/deploy.sh`
(harus gagal sekarang) dan catat keluarnya di laporan.

**GREEN — tulis skripnya, lalu uji.**

`deploy/deploy.sh` harus:

- `set -euo pipefail`, dan berhenti dengan pesan jelas (bahasa Indonesia) bila langkah gagal.
- Membaca runtime env dari `.env.production.local`; bila tidak ada, keluar dengan kode ≠ 0 dan
  pesan yang menyebut nama filenya.
- Menjalankan langkah 2 → 3 → 4 di atas berurutan, menyimpan image sebelumnya sebagai
  `ran-app:previous`, dan **berhenti sebelum `docker rm -f`** bila build gagal (agar kontainer
  yang sedang melayani tidak mati karena build rusak).
- Menjalankan `docker network connect teknoloka-network ran-app` bila belum terhubung (aman bila
  perintahnya bilang sudah terhubung).
- Mengulang uji kesehatan secara bertahap, lalu **mengembalikan ke `ran-app:previous`** bila
  kesehatan tidak pernah terpenuhi, supaya situs tidak ditinggal 502.
- Mencetak langkah yang sedang berjalan.

`deploy/backup.sh` harus:

- `set -euo pipefail`.
- `mkdir -p` direktori tujuan (default `/opt/ran-backups/ran`, bisa ditimpa lewat argumen `$1`
  atau env `RAN_BACKUP_DIR`).
- `docker exec ran-postgres pg_dump -U raia raia | gzip` ke file `ran-<YYYYMMDD-HHMMSS>.sql.gz`.
- Retensi **14 hari**: hapus file `.sql.gz` yang lebih tua; fungsi ini harus bisa diuji terpisah.
- Keluar dengan kode ≠ 0 bila `pg_dump` gagal, dan **menghapus** file parsial yang rusak.

Pengujian yang harus dijalankan dan dilaporkan:

- `bash -n deploy/deploy.sh` dan `bash -n deploy/backup.sh` → sukses.
- `shellcheck` bila tersedia (`command -v shellcheck`); bila tidak, catat tidak terpasang.
- Uji fungsi retensi: buat direktori sementara berisi file berumur 20 hari, jalankan fungsinya,
  pastikan file lama terhapus dan file baru tersisa, lalu bersihkan.
- `backup.sh` **boleh** dijalankan sungguhan selama `RAN_BACKUP_DIR` diarahkan ke `mktemp -d`.
  Tujuan default jangan dijalankan saat pengujian.
- **Jangan jalankan `deploy.sh`** — ia me-restart kontainer yang sedang melayani `ran.teknoloka.id`.

`deploy/README.md` menjelaskan prasyarat, pemakaian kedua skrip, baris cron harian yang eksplisit,
lokasi backup, dan cara rollback ke `ran-app:previous`. Bahasa Indonesia.

### Kriteria selesai

- `bash -n` lolos untuk kedua skrip; keluaran pengujian retensi dilaporkan.
- Tidak ada file di luar `deploy/` yang diubah.

### Laporan

Tulis laporan ke `.superpowers/sdd/2026-09-28-payment-integrity-and-ops/task-2-report.md`,
lalu kembalikan: status, ringkasan satu baris pengujian, hash commit, kekhawatiran.

---

## Task 3: Upload foto KTP yang benar-benar berfungsi

### File yang dimiliki task ini

- `prisma/schema.prisma`
- `prisma/migrations/<stamp>_add_kyc_image_paths/` **(baru)**
- `src/app/api/kyc/route.ts`
- `src/app/api/kyc/photo/route.ts` **(baru)**
- `src/app/kyc/page.tsx`
- `src/tests/kyc.test.tsx`
- `Dockerfile` (hanya tahap `runner`)
- `.gitignore`

Jangan sentuh `src/app/api/checkout/**`, `src/app/app/checkout/**`, `src/lib/**`,
`src/tests/checkout*`, `src/tests/reservations*`, `src/app/api/payments/**`, `deploy/**`
— itu milik task lain.

### Fakta

- `src/app/api/kyc/route.ts`: fungsi `POST()` **tidak menerima argumen `request`** — ia mengabaikan
  body, langsung `prisma.user.update({ data: { kycStatus: 'VERIFIED' } })`, lalu membuat notifikasi.
- `src/app/kyc/page.tsx`: tombol **"Unggah Foto KTP"** tidak punya `onClick` (tombol mati).
  `handleAutoFill` mengisi `ktpImage: 'placeholder-ktp.jpg'` dan `selfieImage: 'placeholder-selfie.jpg'`.
  `handleVerify` melakukan `fetch('/api/kyc', { method: 'POST', body: JSON.stringify(formData) })`.
- `src/app/op/page.tsx` baris 59 **hanya** menghitung `kycStatus: 'PENDING'` untuk statistik.
  **Tidak ada UI approval KYC di operator** — karena itu, **pertahankan perilaku verifikasi
  langsung** (`kycStatus: 'VERIFIED'` saat submit). Mengubahnya menjadi `PENDING` akan mengunci
  demo karena tidak ada yang bisa menyetujui.
- Model `UserProfile` tidak punya kolom gambar; migrasi hanya satu (`20260927140921_init`), *up to date*.
- Tahap `runner` `Dockerfile` berakhir dengan `USER nextjs` dan isi `/app` disalin sebagai root —
  pengguna `nextjs` **tidak bisa menulis** ke `/app` saat ini.
- Kontainer `ran-app` saat ini **tidak punya volume**. Deploy berikutnya akan menambahkan
  `-v ran_kycdata:/app/data/kyc` (dikerjakan Task 2).
- `.gitignore` sudah meng-ignore `.env*.local`.

### Persyaratan

**RED — tulis test yang gagal dulu di `src/tests/kyc.test.tsx`**, jalankan
`npx vitest run src/tests/kyc.test.tsx`, pastikan gagal karena perilakunya belum ada.
Uji minimal:

1. `POST /api/kyc` **menyimpan** path foto KTP dan selfie dari payload (bukan mengabaikannya).
2. Endpoint menolak tipe file selain `image/jpeg` dan `image/png`.
3. Endpoint menolak file lebih dari 5 MB.
4. Endpoint menolak permintaan tanpa payload KYC yang valid.
5. `GET /api/kyc/photo` mengembalikan **401** untuk pengguna yang tidak login, dan **404**
   bila pengguna itu tidak punya foto yang diminta.

**GREEN — tulis kode minimalnya.**

1. **Skema**: tambahkan `ktpImagePath String?` dan `selfieImagePath String?` ke `UserProfile`.
   Buat migrasi dengan **`npx prisma migrate dev --create-only --name add_kyc_image_paths`**,
   periksa SQL-nya (dua kolom `TEXT` nullable, tanpa `DROP`), lalu terapkan dengan
   **`npx prisma migrate deploy`**. Bila `--create-only` gagal karena shadow database, tulis
   `migration.sql` dengan tangan lalu `npx prisma generate`, dan laporkan cara yang dipakai.
2. **Penyimpanan**: direktori dari env `KYC_STORAGE_DIR`, bawaan `./data/kyc` (dalam kontainer
   menjadi `/app/data/kyc`). Simpan **di luar `public/`** supaya berkas KTP tidak bisa diambil
   publik lewat URL. Tambahkan `data/kyc/` ke `.gitignore`.
3. **Unggah**: `POST /api/kyc` menerima `multipart/form-data` berisi field teks KYC
   (`nik`, `placeOfBirth`, `dateOfBirth`, `address`) plus berkas `ktpImage` dan `selfieImage`.
   Validasi **di server**: hanya `image/jpeg`/`image/png`, maksimal 5 MB per berkas, dan
   tolak bila berkas wajib tidak ada. Simpan dengan nama berkas aman (jangan pakai nama dari
   klien apa adanya — sanitasi, atau pakai nama tetap per pengguna), lalu simpan path relatifnya
   ke `ktpImagePath`/`selfieImagePath` dan set `kycStatus: 'VERIFIED'` seperti sekarang.
4. **Penyajian**: `GET /api/kyc/photo?type=ktp|selfie` mengembalikan berkas milik pengguna yang
   login saja, dengan `Content-Type` yang benar; `401` bila belum login, `404` bila tidak ada.
5. **Halaman**: aktifkan tombol unggah (input file tersembunyi + tombol), tampilkan pratinjau
   nama berkas setelah dipilih, dan kirim lewat `FormData` di `handleVerify`. Pertahankan
   tombol "Isi otomatis" yang sudah ada (dipakai untuk demo) — bila dipakai, isi field teks dan
   tandai foto sebagai sudah terisi agar alur demo tidak berubah.
6. **Dockerfile**: pada tahap `runner`, sebelum `USER nextjs`, buat direktori unggahan dan
   berikan kepemilikannya ke pengguna aplikasi, misalnya
   `RUN mkdir -p /app/data/kyc && chown -R nextjs:nodejs /app/data`. Ini yang membuat volume
   `ran_kycdata` bisa ditulis saat runtime.

### Kriteria selesai

- `npx vitest run src/tests/kyc.test.tsx` hijau.
- SQL migrasi diperiksa dan dilaporkan isinya; `npx prisma migrate status` tetap bersih.
- Tidak ada file di luar daftar kepemilikan yang diubah.

### Laporan

Tulis laporan ke `.superpowers/sdd/2026-09-28-payment-integrity-and-ops/task-3-report.md`,
lalu kembalikan: status, ringkasan satu baris test, hash commit, kekhawatiran.
