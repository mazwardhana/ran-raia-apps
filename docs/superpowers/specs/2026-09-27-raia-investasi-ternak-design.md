# Raia - Platform Investasi Ternak: Spesifikasi Desain

Tanggal: 2026-09-27
Status: Disetujui (disepakati melalui sesi brainstorming)

## 1. Ringkasan Produk

Raia adalah platform investasi ternak yang mempertemukan investor kota (yang memiliki modal tetapi tidak memiliki akses atau koneksi ke peternak) dengan lahan, SDM, dan sumber daya desa yang tidak produktif. Raia berperan ganda sebagai operator sekaligus pelaksana: pengelolaan operasional dijalankan oleh mitra karyawan internal Raia, sementara SDM lapangan dan bibit diambil dari warga serta peternak di sekitar site.

Pendekatan ini berbeda dari marketplace dua sisi. Raia adalah operator vertikal terintegrasi. Konsekuensinya, pengalaman utama yang dibangun adalah dari sudut pandang investor, sementara peternak tidak memerlukan aplikasi terpisah.

### Sasaran Fase ini

Aplikasi fungsional yang dapat digunakan sebagai bahan pitching investor. Alur investor berjalan 100% dari akun awal sampai penjualan aset di secondary market. Data operasional dapat dicatat oleh operator untuk menunjukkan bukti feasibility.

### Sasaran Sukses

1. Seorang calon investor dapat mendaftar, menyelesaikan KYC, membeli paket, memantau aset, dan menjualnya kembali tanpa bantuan manual.
2. Operator dapat membuat site project dan paket, menginput data ternak, serta mendistribusikan profit.
3. Seluruh demonstrasi berjalan di perangkat mobile dengan pengalaman menyerupai aplikasi native.
4. Aplikasi dapat dijalankan di server sendiri melalui Docker dan diakses melalui `ran.teknoloka.id`.
5. Repository dapat di-push ke `https://github.com/mazwardhana/ran-raia-apps.git`.

## 2. Peran dan Kebutuhan Pengguna

### 2.1 Investor

Investor adalah pengguna utama aplikasi. Profil utama adalah pekerja kantoran atau profesional kota yang memiliki dana tetapi tidak memiliki jaringan peternak dan tidak memiliki waktu mengelola ternak.

Sasaran investor:

- Menemukan peluang investasi yang dapat dipercaya.
- Memahami komposisi biaya dan pembagian hasil tanpa harus bertanya.
- Memantau kondisi ternak dan perkembangan nilai investasi dari ponsel.
- Mendapatkan kepastian keluar dari investasi.
- Mendapatkan profit yang dibagikan secara terukur.

### 2.2 Operator Raia

Operator mengelola operasional: site project, paket, data ternak, profit, klaim ta'awun, dan pengawasan secondary market.

### 2.3 Admin

Admin mengelola konfigurasi sistem dan akun.

### 2.4 Site Project dan Mitra Desa

Setiap site project merupakan entitas operasional dengan PT legalitas sendiri. Site bukan sekadar nama lokasi. Pada akhirnya kebutuhan site diwakili oleh operator karena mitra desa tidak memakai aplikasi terpisah dalam fase ini.

## 3. Model Bisnis

### 3.1 Paket Investasi

Satu paket memiliki harga penuh, misalnya Rp10.000.000. Komposisi biaya paket:

| Komponen | Keterangan |
|---|---|
| Biaya ternak | Pembelian bibit |
| Dana ta'awun | Proteksi jiwa ternak |
| Sewa kandang | Dibayar ke pihak pengelola site/desa |
| Pakan | Untuk satu periode |
| Tenaga kerja | Untuk satu periode |
| Obat dan vaksin | Untuk satu periode |
| Operasional lain | Transportasi, administrasi, dll |

### 3.2 Dua Mode Pembelian

1. Paket utuh: seluruh paket dimiliki satu orang investor.
2. Lot gotong royong: paket dipecah menjadi lot. Harga default per lot adalah Rp10.000.

Minimum checkout adalah Rp50.000. Dengan harga lot Rp10.000, pembelian minimum per transaksi adalah 5 lot.

### 3.3 Profit Split

Default pembagian profit bersih adalah 60% Raia dan 40% investor. Persentase ini disimpan pada tabel konfigurasi dan dapat diubah oleh operator.

Perhitungan investor bersifat proporsional terhadap jumlah lot yang dimiliki:

```text
Profit bersih paket:                Rp4.000.000
Raia (60%):                         Rp2.400.000
Investor (40%):                     Rp1.600.000
Investor A: 100 lot dari 1000 lot  Rp160.000
Investor B: 500 lot dari 1000 lot  Rp800.000
Investor C: 400 lot dari 1000 lot  Rp640.000
```

Sumber profit adalah kelahiran anak ternak dan penjualan hasil susu.

### 3.4 Dana Ta'awun

Ta'awun adalah proteksi berbasis prinsip tolong-menolong. Jika ternak meninggal, penggantian adalah 100%.

- Tahun pertama: Rp300.000 per paket.
- Tahun berikutnya: Rp150.000.

Nilai konfigurasi dan dapat diubah.

### 3.5 Secondary Market

Aset yang dimiliki investor dapat dijual kembali melalui secondary market.

- Harga listing adalah flat pada harga par (harga paket yang sama untuk penjual dan pembeli).
- Bukan bursa dengan fluktuasi harga. Ini adalah jalur likuiditas.
- Jika tidak ada pembeli dalam 7 x 24 jam, Raia mengambil alih 100% tanpa potongan.
- Fee jual-beli default 0%. Biaya administrasi flat atau persentase dapat diatur dari dashboard operator.

### 3.6 Site Project

Setiap site project memiliki satu PT atau entitas legalitas yang berbeda. Hubungan adalah 1:1. Site memiliki kapasitas ternak, alamat, penanggung jawab, dan dokumen legalitas.

## 4. Arsitektur dan Teknologi

### 4.1 Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend | Next.js 14 App Router | SSR, PWA, satu codebase |
| UI | Mantine v7 | Komponen lengkap, AppShell, theming |
| Styling | Mantine CSS-in-JS | Tidak perlu Tailwind sebagai sistem utama |
| PWA | next-pwa / service worker | Installable, offline asset caching |
| Database | PostgreSQL 16 di Docker | Self-hosted |
| ORM | Prisma | Type-safe, migration |
| Auth | NextAuth.js | Email/password dan Google OAuth |
| Storage | MinIO | S3-compatible, self-hosted |
| Payment | Midtrans Sandbox | QRIS, VA, transfer untuk demo |
| Charts | Recharts | Chart dashboard |
| Form | React Hook Form + Zod | Validasi |
| Reverse proxy | Nginx + Let's Encrypt | SSL di `ran.teknoloka.id` |
| Container | Docker Compose | Semua service |
| Hosting | Server milik sendiri | Sesuai permintaan |

### 4.2 Container Services

```text
nginx       reverse proxy, SSL, routing
nextjs      aplikasi Next.js
postgres    database
minio       file storage
```

### 4.3 Kualitas Antarmuka

Aturan antislop diterapkan selama pengerjaan (mode DURING). Artinya:

- Tidak ada klaim atau statistik yang tidak memiliki sumber nyata.
- Testimoni pada fase ini adalah data dummy yang jelas ditandai sebagai demo.
- Navigasi hanya menampilkan tujuan yang benar-benar ada.
- Setiap kontrol interaktif memiliki perilaku nyata.
- Semua data-driven UI memiliki state kosong, loading, dan error.
- Mobile responsif menjadi bagian dari desain, bukan tambahan.
- Kontras teks memenuhi WCAG AA.
- UI dapat dioperasikan dengan keyboard.

## 5. Standar UX Global

### 5.1 Modal

Seluruh form dan detail data menggunakan modal.

| Jenis | Desktop | Mobile |
|---|---|---|
| Form sederhana | 480px | Full width, slide-up |
| Form kompleks | 640px | Full width, slide-up |
| Tabel + filter | 720px | Full width, slide-up |
| Konfirmasi | 400px | Full width, slide-up |
| Preview besar | 900px | Full width, slide-up |

Perilaku:

- Backdrop blur.
- Tombol close.
- Scroll internal, body tidak scroll di belakang modal.
- Dapat ditutup dengan backdrop atau Escape.

### 5.2 Pencarian pada Select

Dropdown dengan lebih dari 5 opsi menggunakan searchable select atau autocomplete.

- Placeholder: `Ketik untuk mencari...`
- Search dapat digunakan sejak karakter pertama.
- Debounce 300ms.
- Maksimum 10 hasil sebelum lazy load.
- Empty state: `Tidak ditemukan`.

### 5.3 Tabel dengan Filter dan Pencarian

Setiap tabel data menyediakan:

- Search global.
- Filter status, site, periode, dan kategori yang relevan.
- Reset filter.
- Filter tersimpan pada URL query.
- Pagination dengan pilihan baris per halaman 10, 25, 50.
- Sort pada header kolom.
- Kolom responsif.

### 5.4 Akun Pengguna

Setiap akun memiliki `username` unik dan dapat dilihat pada profil.

- Format: huruf kecil, angka, underscore.
- Contoh: `budi_investor`.
- Dapat diubah dengan validasi unik.

### 5.5 State

Setiap tampilan data menyediakan:

- Loading state.
- Empty state.
- Error state.
- Success state bila relevan.

## 6. Landing Page dan SEO

### 6.1 Struktur Landing Page

1. Hero dengan value proposition dan CTA utama.
2. Statistik ringkas. Statistik hanya boleh tampil jika memiliki sumber. Untuk demo, nilai ditandai sebagai data seed.
3. Value proposition.
4. Alur penggunaan. Jangan dibatasi pada template tiga langkah bila konten membutuhkan bentuk lain.
5. Paket unggulan.
6. Testimoni. Karena fase ini demo, konten ditandai sebagai demo.
7. Diferensiasi Raia.
8. Artikel terbaru.
9. FAQ yang benar-benar menjawab kekhawatiran produk investasi ternak.
10. CTA akhir.
11. Footer.

### 6.2 Artikels

Landing page dan halaman artikel menampilkan artikel dummy untuk membangun SEO. Manajemen artikel tidak perlu dibangun di dashboard admin pada fase ini.

Rute:

- `/artikel`
- `/artikel/[slug]`

Konten artikel yang disepakati:

1. Apa itu jasa gaduh ternak.
2. Investasi ternak gotong royong mulai dari Rp10.000.
3. Cara memilih platform investasi ternak yang aman dan terpercaya.
4. Sistem ta'awun sebagai asuransi syariah untuk ternak.
5. Kambing Etawa versus sapi Limousin.
6. Panduan secondary market.
7. Investasi ternak untuk pekerja kantoran.

### 6.3 Meta SEO

Setiap halaman memiliki `title`, `description`, canonical, Open Graph, dan structured data yang relevan.

## 7. Pengalaman Investor (PWA)

### 7.1 Registrasi dan Autentikasi

Registrasi: name, unique username, email, password, phone. Login: email atau username, password. Guest tidak dapat membeli paket.

### 7.2 KYC Demo

Setelah registrasi, investor diarahkan ke `/kyc`.

Alur:

1. Halaman KYC menampilkan data kosong.
2. Tombol `Isi Otomatis (Demo)` mengisi formulir dengan template.
3. Tombol `Verifikasi Sekarang` menampilkan proses selama sekitar 3 detik.
4. Verifikasi berhasil.
5. Status berubah dari `PENDING` ke `VERIFIED`.
6. Investor dapat membeli paket.

Pada demo tidak ada integrasi dengan lembaga KYC eksternal.

### 7.3 Dashboard Investor

Widget:

- Total investasi.
- Total profit berjalan dan diterima.
- Jumlah lot.
- Distribusi portofolio per jenis ternak.
- Tren profit bulanan.
- Paket saya.
- Aktivitas ternak terbaru.
- Status KYC.

### 7.4 Katalog Paket

Halaman publik dan login memiliki katalog paket. Filter mencakup:

- Site project.
- Jenis ternak.
- Rentang harga.
- Periode.
- Status ketersediaan.

### 7.5 Detail Paket

Detail menampilkan:

- Identitas site project.
- Nama legalitas PT.
- Komposisi biaya.
- Estimasi return.
- Progress slot.
- Galeri foto.
- Deskripsi.
- Tombol beli.

Pilihan pembelian: paket utuh atau lot. Saat membeli lot, minimum transaksi Rp50.000.

### 7.6 Checkout

Checkout menggunakan Midtrans Sandbox.

- Ringkasan pembelian.
- Fee yang berlaku.
- Total checkout.
- Pilihan metode pembayaran.
- Callback memperbarui status transaksi.
- Status `PENDING`, `PAID`, `EXPIRED`, `CANCELLED`.

### 7.7 Portofolio

Portofolio menampilkan aset yang dimiliki, status ternak, timeline pembaruan, laporan profit, dan tombol jual.

### 7.8 Secondary Market

Halaman `/app/secondary` menampilkan listing aktif dan aset yang dapat dijual.

Listing:

- Harga flat di harga par.
- Batas waktu 7 x 24 jam.
- Jika kedaluwarsa, status berubah menjadi `TAKEOVER`.
- Pembeli membeli pada harga par.
- Fee dapat diatur pada konfigurasi.

### 7.9 Penarikan Profit

Investor dapat meminta penarikan dengan nominal minimum Rp50.000. Nominal minimum ini adalah konfigurasi.

## 8. Dashboard Operator

### 8.1 Widget Dashboard

Operator melihat:

- Jumlah site aktif.
- Jumlah paket aktif.
- Jumlah investor.
- Total pendapatan.
- Distribusi profit per paket.
- Pendapatan bulanan.
- Jumlah ternak dan status.
- Produksi susu harian.
- Klaim ta'awun.
- Listing secondary.
- Aktivitas terbaru.

### 8.2 Site Project

Operator dapat membuat dan mengelola site project:

- Kode.
- Nama site.
- Nama legalitas atau PT.
- Nomor legalitas.
- NPWP.
- Alamat operasional.
- Provinsi, kabupaten, desa, kecamatan.
- Penanggung jawab.
- Kontak.
- Deskripsi.
- Foto.
- Dokumen legalitas.
- Kapasitas ternak, antara 2.500 sampai 3.000 ekor.
- Status.

Hubungan site dan PT adalah 1:1.

### 8.3 Form Paket

Field yang diperlukan:

**Info dasar**

- Kode paket.
- Nama paket.
- Jenis ternak.
- Mode pembelian.

**Detail**

- Site project (searchable select).
- Entitas legal, read-only.
- Lokasi operasional, read-only.
- Jumlah ternak.
- Breed.
- Estimasi berat.
- Usia ternak.
- Deskripsi kandang.

**Keuangan**

- Harga paket.
- Harga lot.
- Total lot.
- Periode.
- Breakdown biaya:
  - ternak
  - ta'awun
  - sewa kandang
  - pakan
  - tenaga kerja
  - obat dan vaksin
  - operasional

**Estimasi return**

- Anak lahir per periode.
- Harga jual anak.
- Produksi susu per bulan.
- Harga susu per liter.
- ROI.

**Media**

- Foto cover.
- Galeri.
- Video.
- Deskripsi.
- Syarat dan ketentuan.

**Jadwal**

- Tanggal mulai.
- Tanggal berakhir.
- Kuota investor.
- Status: `DRAFT`, `OPEN`, `RUNNING`, `CLOSED`, `SOLD_OUT`.

### 8.4 Ternak dan Import

Operator dapat menambah ternak manual dan mengimpor data dari template.

Template unduhan:

```text
tag_number, name, animal_type, sex, breed, birth_date, weight_kg, mother_tag, status, note
```

Validasi:

- Tanggal.
- Tipe data.
- Duplikasi `tag_number`.
- Error per baris, bukan gagal seluruh file.
- Maksimum 1.000 baris per file.

Alur:

1. Unduh template.
2. Isi file.
3. Unggah.
4. Preview validasi.
5. Import.
6. Ringkasan berhasil dan gagal.

### 8.5 Profit dan Ta'awun

Operator menghitung profit dari kelahiran atau susu, lalu mendistribusikannya. Investor menerima persentase 40% dari pengaturan dan pembagian proporsional per lot.

Klaim ta'awun dapat disetujui dan dibayar. Klaim menutupi 100% nilai ternak yang hilang sesuai aturan yang disetujui.

### 8.6 Settings

Admin atau operator dapat mengubah:

- `raia_share_percent` = 60.
- `investor_share_percent` = 40.
- `min_checkout` = 50000.
- `default_lot_price` = 10000.
- `taawun_year_1` = 300000.
- `taawun_year_2_plus` = 150000.
- `secondary_market_days` = 7.
- `secondary_admin_fee_percent` = 0.
- `secondary_admin_fee_flat` = 0.

## 9. Data Model

### 9.1 Entitas Utama

- `users`
- `user_profiles`
- `site_projects`
- `packages`
- `package_costs`
- `transactions`
- `lot_ownerships`
- `full_ownerships`
- `livestocks`
- `livestock_events`
- `milk_logs`
- `profit_distributions`
- `investor_balances`
- `withdrawals`
- `taawun_claims`
- `secondary_listings`
- `secondary_sales`
- `articles`
- `notifications`
- `settings`

### 9.2 Aturan Penting

- `users.username` unik dan case-insensitive.
- `site_projects` memiliki `legal_entity` unik untuk setiap site.
- `packages.site_project_id` merujuk ke site project.
- `settings` menyimpan seluruh konfigurasi bisnis yang dapat berubah.
- `lot_ownerships` dan `full_ownerships` dipisah karena bentuk kepemilikan berbeda.
- `secondary_listings.listing_price` selalu par.
- `secondary_listings.expires_at` adalah `listed_at + secondary_market_days`.

## 10. Data Seed dan Import

### 10.1 Site Project

Seed membuat 10 site project dengan kapasitas 2.500 sampai 3.000 ekor, tersebar di:

- Jawa.
- Kalimantan.
- NTT.
- NTB.
- Sulawesi.

Setiap site memiliki PT legalitas sendiri.

### 10.2 Paket

Seed membuat:

- 10 paket `RUNNING`.
- 10 paket `OPEN`.
- Sebagian kecil `DRAFT` tidak diperlukan, kecuali bila diperlukan untuk demonstrasi.

### 10.3 Pengguna

Seed membuat sekitar 20 pengguna:

- 1 admin.
- 2 operator.
- 17 investor.
- Sebagian KYC `PENDING` untuk demonstrasi.
- Password demo: `password123`.
- Kepemilikan paket bervariasi: paket utuh, 50 lot, 300 lot, 1.000 lot.

### 10.4 Data Transaksional

Seed membuat riwayat transaksi, distribusi profit, saldo investor, listing secondary, dan data peternakan yang cukup untuk menghasilkan chart bermakna.

## 11. PWA

Syarat:

- Dapat diinstal ke home screen.
- Manifest lengkap.
- Icon ukuran PWA.
- Service worker untuk cache asset statis.
- Bottom navigation pada pengalaman investor.
- Layout nyaman pada lebar 360px.
- Touch target minimal 44px.
- Loading state dan navigasi state jelas.
- Halaman offline fallback bila service worker aktif.

## 12. Keamanan dan Lingkungan

- Secret disimpan di `.env`.
- `.env` tidak pernah di-commit.
- Gunakan environment variables untuk Midtrans, database, auth, dan storage.
- Middleware memeriksa role dan status KYC.
- Endpoint operator dilindungi role.
- Upload file dibatasi tipe dan ukuran.
- Input divalidasi pada server dan client.
- Tidak ada klaim keamanan di UI yang belum terbukti.

## 13. Testing

Minimal:

1. Unit test untuk kalkulasi profit split.
2. Unit test untuk perhitungan lot dan minimum checkout.
3. Unit test untuk expiry secondary market.
4. Test registrasi, login, dan proteksi route.
5. Test KYC state transition.
6. Test checkout dan callback.
7. Test import ternak, termasuk error per baris.
8. Test responsive layout pada viewport mobile.
9. Test keyboard navigation dan Escape pada modal.
10. Build produksi harus berhasil.

## 14. Definisi Selesai

Aplikasi selesai bila:

1. `npm run build` berhasil.
2. Seluruh test penting lulus.
3. Docker Compose dapat berjalan.
4. Seed dapat dijalankan.
5. Landing page, artikel, katalog paket, registrasi, KYC demo, pembelian, portofolio, secondary market, operator dashboard, import, dan profit distribution berfungsi.
6. Mobile viewport tidak mengalami overflow horizontal.
7. Tidak ada kontrol mati pada navigasi.
8. Repository dapat di-push ke GitHub.
9. Tidak ada secret produksi di repository.

## 15. Batasan Fase Pertama

Tidak dibangun pada fase ini:

- Integrasi eKYC nyata.
- Integrasi pembayaran produksi.
- Aplikasi pihak peternak.
- Manajemen artikel dari dashboard admin.
- RFID dan sensor kandang.
- Lab kualitas susu.
- Sistem silsilah lengkap.
- Aplikasi native iOS/Android.
