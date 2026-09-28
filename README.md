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

Skema dikunci lewat migrasi di `prisma/migrations/`:

```bash
npx prisma migrate deploy  # pasang migrasi (jalur aman, tanpa regenerasi skema)
npm run db:seed            # tsx prisma/seed.ts — isi data demo
```

`npm run db:migrate` (`prisma migrate dev`) hanya untuk mengembangkan skema —
ia bisa membuat migrasi baru dan tidak boleh dipakai di database produksi.
`npm run db:push` hanya untuk migrasi sekali jalan (tanpa file migrasi).

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

Site ini berdiri sendiri dan **tidak** menyentuh `raia.teknoloka.id`, container
`raia-app`, maupun project lain di server.

Alur trafik:

```
Cloudflare Tunnel -> teknoloka-nginx:80 -> container ran-app:3000 -> ran-postgres:5432
```

nginx berada di network `teknoloka-network`, jadi app Raia harus berada di
network yang sama. Container nginx **tidak bisa** menjangkau proses di host
(port yang di-publish ke host diblokir dari jaringan docker), sehingga app
dijalankan sebagai container — bukan `npm start` di host.

### Langkah deploy

1. **Database sendiri** (nama & volume terpisah dari project lain):

   ```bash
   docker network create ran-app-net
   docker run -d --name ran-postgres --restart unless-stopped \
     --network ran-app-net \
     -e POSTGRES_USER=raia -e POSTGRES_PASSWORD=raia_password -e POSTGRES_DB=raia \
     -p 127.0.0.1:5432:5432 -v ran_pgdata:/var/lib/postgresql/data \
     postgres:16-alpine
   ```

2. **Migrasi + seed** (dari host, `DATABASE_URL` menimpa nilai di `.env`):

   ```bash
   DATABASE_URL="postgresql://raia:raia_password@127.0.0.1:5432/raia" npx prisma migrate deploy
   DATABASE_URL="postgresql://raia:raia_password@127.0.0.1:5432/raia" npm run db:seed
   ```

3. **Build image.** `NEXT_PUBLIC_*` disuntikkan saat build, jadi harus lewat
   `--build-arg`:

   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_APP_URL="https://ran.teknoloka.id" \
     --build-arg NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="SB-Mid-client-dev" \
     -t ran-app:local .
   ```

4. **Jalankan app.** `AUTH_SECRET` hanya diberikan di sini (tidak dibakar ke
   image); simpan nilainya di `.env.production.local` yang di-gitignore:

   ```bash
   docker run -d --name ran-app --restart unless-stopped \
     --network ran-app-net \
     -e DATABASE_URL="postgresql://raia:raia_password@ran-postgres:5432/raia" \
     -e AUTH_SECRET="$(grep '^AUTH_SECRET=' .env.production.local | cut -d= -f2- | tr -d '\"')" \
     -e AUTH_URL="https://ran.teknoloka.id" \
     -e AUTH_TRUST_HOST="true" \
     -e MIDTRANS_SERVER_KEY="SB-Mid-server-dev" \
     -e MIDTRANS_CLIENT_KEY="SB-Mid-client-dev" \
     -e MIDTRANS_IS_PRODUCTION="false" \
     -e NEXT_PUBLIC_MIDTRANS_CLIENT_KEY="SB-Mid-client-dev" \
     ran-app:local
   docker network connect teknoloka-network ran-app
   ```

5. **nginx**: `/opt/teknoloka/nginx/conf.d/ran.conf` meneruskan
   `ran.teknoloka.id` ke `http://ran-app:3000`. `proxy_pass` memakai variabel
   (`set $ran_upstream` + `resolver 127.0.0.11`) supaya nginx tetap bisa start
   walau container `ran-app` sedang mati:

   ```bash
   docker exec teknoloka-nginx nginx -t && docker exec teknoloka-nginx nginx -s reload
   ```

6. **Cloudflare Tunnel** mengarahkan hostname `ran.teknoloka.id` ke
   `http://teknoloka-nginx:80`. DNS-nya di-proxy Cloudflare, jadi tidak perlu
   certbot di server.

### Catatan Dockerfile

- Basis image **Debian** (`node:20-slim`), bukan Alpine. Prisma 5 memilih engine
  berdasarkan OpenSSL yang terdeteksi; image `node:*slim` tidak menyertakan
  OpenSSL sehingga `openssl` dipasang eksplisit di semua stage. Tanpa itu
  Prisma memilih engine OpenSSL 1.1 yang gagal dimuat saat runtime.
- `next.config.mjs` wajib disalin ke stage runner, jika tidak konfigurasi PWA
  diabaikan saat `next start`.

### Kalau memakai Docker Compose

`docker-compose.yml` di repo ini memakai `container_name` tetap (`raia-postgres`,
`raia-nextjs`, ...). Nama-nama itu bisa bentrok dengan project lain di server
yang juga memakai nama serupa. Untuk deploy di server bersama, ikuti langkah
`docker run` di atas, bukan `docker compose up`.

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
