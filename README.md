# Raia — Investasi Ternak Berbasis Taawun

Raia adalah Progressive Web App (PWA) untuk investasi ternak (sapi & kambing) dengan
pola *taawun* (gotong royong). Investor membeli paket ternak secara utuh atau per lot,
mengikuti perkembangan ternak, menerima pembagian profit, dan bisa menjual kembali
asetnya lewat secondary market.

## Stack

| Lapisan | Teknologi |
| --- | --- |
| Framework | Next.js 14 (App Router) + TypeScript |
| UI | Mantine v7 |
| Database | PostgreSQL 16 + Prisma ORM |
| Auth | NextAuth v5 (credentials) |
| Pembayaran | Midtrans (sandbox) |
| Object storage | MinIO |
| Reverse proxy | nginx (`ran.teknoloka.id`) |
| Test | Vitest + Testing Library (jsdom) |
| Deploy | Docker Compose |

## Menjalankan Proyek

### 1. Docker Compose (jalur utama)

```bash
cp .env.example .env          # lalu isi nilai-nilainya
docker compose up -d --build
```

Layanan yang naik:

| Service | Port | Keterangan |
| --- | --- | --- |
| postgres | 5432 | Database `raia` (user `raia`) |
| minio | 9000 / 9001 | Object storage (console di 9001) |
| nextjs | 3000 | Aplikasi Next.js |
| nginx | 80 / 443 | Reverse proxy ke `nextjs:3000` |

### 2. Prisma: migrate & seed

Skema saat ini dipasangkan lewat `db push` (belum ada folder migrasi):

```bash
npm run db:push      # prisma db push — sinkronkan skema ke database
npm run db:seed      # tsx prisma/seed.ts — isi data demo
```

> Bila kelak sudah ada folder `prisma/migrations`, gunakan
> `npm run db:migrate` (`prisma migrate dev`).

### 3. Development lokal (tanpa Docker untuk app-nya)

```bash
npm install
npm run dev           # http://localhost:3000
```

## Akun Demo

Semua akun demo memakai password `password123` (lihat `prisma/seed.ts`).

| Role | Username | Email |
| --- | --- | --- |
| Admin | `admin_raia` | admin@raia.id |
| Operator | `operator_wilayah_1` | operator1@raia.id |
| Operator | `operator_wilayah_2` | operator2@raia.id |
| Investor | `budi_santoso` | budi@example.com |
| Investor | `siti_nurhaliza` | siti@example.com |

Masuk lewat `/login`, lalu pilih peran sesuai kebutuhan (admin/operator: panel
`/op`, investor: `/app`).

## Variabel Lingkungan

Salin `.env.example` ke `.env`:

| Variabel | Keterangan |
| --- | --- |
| `DATABASE_URL` | Koneksi PostgreSQL, contoh `postgresql://raia:raia_password@localhost:5432/raia` |
| `AUTH_SECRET` | Rahasia NextAuth — `openssl rand -base64 32` |
| `AUTH_URL` | URL publik aplikasi, mis. `http://localhost:3000` |
| `MIDTRANS_SERVER_KEY` | Server key Midtrans (`SB-Mid-server-…` di sandbox) |
| `MIDTRANS_CLIENT_KEY` | Client key Midtrans (`SB-Mid-client-…` di sandbox) |
| `MIDTRANS_IS_PRODUCTION` | `false` untuk sandbox, `true` untuk production |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Client key untuk SDK Snap di browser |
| `MINIO_ENDPOINT` | Host MinIO (contoh `localhost`) |
| `MINIO_PORT` | Port MinIO (contoh `9000`) |
| `MINIO_ACCESS_KEY` | User MinIO |
| `MINIO_SECRET_KEY` | Password MinIO |
| `MINIO_BUCKET` | Nama bucket (`raia`) |
| `NEXT_PUBLIC_APP_URL` | URL publik untuk SEO/canonical, default `http://localhost:3000` |

## Midtrans (Sandbox)

- Gunakan prefix key `SB-Mid-server-` dan `SB-Mid-client-` dari dashboard sandbox
  Midtrans, dan sisipkan client key ke **kedua** `MIDTRANS_CLIENT_KEY` dan
  `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`.
- `MIDTRANS_IS_PRODUCTION="false"` — transaksi hanya simulasi, tidak ada dana nyata.
- Notifikasi webhook Midtrans diarahkan ke `https://ran.teknoloka.id/api/payments/callback`
  (atau path serupa di `src/app/api/payments`). Untuk pengujian lokal gunakan
  IP tunnel (ngrok) karena Midtrans harus menjangkau URL publik.
- Kartu uji resmi Midtrans: `4811 1111 1111 1114` (Visa), masa berlaku bebas,
  CVC bebas.

## Deploy `ran.teknoloka.id`

1. Build & jalankan di server: `docker compose up -d --build`.
2. Pastikan DNS `ran.teknoloka.id` menunjuk ke IP server.
3. nginx (`nginx/nginx.conf`) sudah dikonfigurasi:
   - `server_name ran.teknoloka.id`
   - `proxy_pass http://nextjs:3000`
   - `client_max_body_size 20M`
4. HTTPS dengan certbot **di host** (bukan di container):
   ```bash
   certbot --nginx -d ran.teknoloka.id
   ```
   Certbot menambahkan blok `listen 443 ssl` + `ssl_certificate`; setelah itu
   aktifkan redirect `return 301 https://$host$request_uri;` yang sudah dikomentari
   di `nginx/nginx.conf`. Sertifikat tidak disimpan di repo.
5. Set `AUTH_URL=https://ran.teknoloka.id` dan `NEXT_PUBLIC_APP_URL=https://ran.teknoloka.id`
   di environment produksi.
6. Database & seed di production: `npm run db:push && npm run db:seed`
   (seed sengaja menghapus data turunan lalu mengisi ulang — jangan jalankan di DB produksi berisi data nyata).

## Perintah Test & Build

```bash
npm test             # vitest run (semua test)
npx vitest run src/tests/notifications.test.tsx   # satu file test
npm run test:watch   # vitest mode watch
npx tsc --noEmit     # type-check
npm run lint         # eslint (next lint)
npm run build        # production build (butuh DATABASE_URL aktif)
```

CI (`.github/workflows/ci.yml`) menjalankan urutan yang sama: `npm ci` →
`prisma generate` + `db push` → `tsc --noEmit` → `vitest run` → `lint` → `build`,
dengan service PostgreSQL 16.

## Struktur Penting

```
src/app/api/          # Route handler (auth, checkout, payments, notifications, …)
src/app/app/          # Dashboard investor (portofolio, notifikasi, checkout)
src/app/op/           # Panel operator/admin
src/lib/              # Helper (auth, prisma, notifications, midtrans)
prisma/schema.prisma  # Skema database
prisma/seed.ts        # Seed data demo
nginx/nginx.conf      # Reverse proxy
```
