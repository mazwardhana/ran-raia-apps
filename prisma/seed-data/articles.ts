export interface SeedArticle {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string;
  authorName: string;
  publishedAt: Date;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

export const articles: SeedArticle[] = [
  {
    slug: 'apa-itu-jasa-gaduh-ternak',
    title: 'Apa Itu Jasa Gaduh Ternak? Panduan Lengkap untuk Pemula',
    excerpt:
      'Jasa gaduh ternak adalah model investasi tradisional yang kini hadir dalam bentuk digital. Pelajari cara kerjanya di sini.',
    content: `
<h2>Pengertian Jasa Gaduh</h2>
<p>Jasa gaduh atau "boro" adalah sistem penitipan ternak di mana seorang pemilik modal menitipkan ternaknya kepada peternak untuk dirawat dan dikembangbiakkan. Keuntungan dari hasil ternak (anak, susu, atau penjualan) kemudian dibagi antara pemilik modal dan peternak.</p>

<h2>Sejarah Singkat</h2>
<p>Sistem gaduh telah berlangsung selama berabad-abad di berbagai komunitas peternak di Indonesia, Timur Tengah, dan Afrika Utara. Kata "gaduh" sendiri berasal dari bahasa Jawa yang berarti "titip" atau "percayakan".</p>

<h2>Cara Kerja Tradisional</h2>
<ul>
<li>Pemilik modal membeli ternak dan menitipkan ke peternak.</li>
<li>Peternak merawat ternak sehari-hari (pakan, kesehatan, kandang).</li>
<li>Hasil (anak, susu) dibagi sesuai kesepakatan awal.</li>
<li>Ternak yang mati menjadi tanggung jawab tertentu sesuai perjanjian.</li>
</ul>

<h2>Keuntungan Jasa Gaduh</h2>
<p>Bagi pemilik modal, keuntungan utamanya adalah tidak perlu repot merawat ternak sendiri tetapi tetap mendapat hasil dari pengembangbiakan. Bagi peternak, mereka mendapat pendapatan tambahan dari upah merawat ternak tanpa harus memiliki modal sendiri.</p>

<h2>Tantangan Sistem Tradisional</h2>
<ul>
<li>Sulit menemukan peternak yang terpercaya.</li>
<li>Kurangnya transparansi dalam pencatatan hasil.</li>
<li>Belum ada standar bagi hasil yang adil.</li>
<li>Risiko ternak sakit atau mati tanpa perlindungan.</li>
</ul>

<h2>Transformasi Digital: Platform Raia</h2>
<p>Platform Raia menghadirkan solusi modern untuk jasa gaduh ternak dengan transparansi penuh, pencatatan digital real-time, sistem bagi hasil yang jelas (60% Raia, 40% investor), serta proteksi dana ta'awun yang mengganti 100% kerugian jika ternak meninggal.</p>

<h2>Kesimpulan</h2>
<p>Jasa gaduh ternak adalah investasi yang memberikan akses ke peternakan bagi siapa pun tanpa harus merawat ternak sendiri. Dengan digitalisasi, prosesnya menjadi lebih transparan, aman, dan mudah dipantau dari smartphone.</p>
    `,
    coverImage: '/images/articles/jasa-gaduh.jpg',
    authorName: 'Tim Raia',
    publishedAt: new Date('2025-01-15'),
    metaTitle: 'Apa Itu Jasa Gaduh Ternak? Panduan Lengkap | Raia',
    metaDescription:
      'Pelajari apa itu jasa gaduh ternak, cara kerja, keuntungan, dan risiko investasi ternak melalui platform digital.',
    keywords: ['jasa gaduh', 'investasi ternak', 'ternak kambing', 'gaduh kambing'],
  },
  {
    slug: 'investasi-ternak-gotong-royong',
    title:
      'Keuntungan Investasi Ternak Gotong Royong Mulai dari 10 Ribu Rupiah',
    excerpt:
      'Dengan sistem lot gotong royong, investasi ternak tidak lagi hanya untuk orang kaya. Mulai dari Rp10.000 saja!',
    content: `
<h2>Apa Itu Lot Gotong Royong?</h2>
<p>Lot gotong royong adalah sistem pembagian paket investasi ternak menjadi bagian-bagian kecil (lot) sehingga investor dapat berpartisipasi dengan modal terjangkau. Sebagai contoh, satu paket senilai Rp10.000.000 dapat dipecah menjadi 1.000 lot dengan harga Rp10.000 per lot.</p>

<h2>Cara Kerja</h2>
<ol>
<li>Pilih paket investasi yang tersedia di platform Raia.</li>
<li>Tentukan jumlah lot yang ingin dibeli (minimum 5 lot atau Rp50.000).</li>
<li>Selesaikan pembayaran melalui QRIS, Virtual Account, atau transfer bank.</li>
<li>Pantau perkembangan ternak Anda melalui dashboard real-time.</li>
<li>Terima profit secara proporsional sesuai jumlah lot yang dimiliki.</li>
</ol>

<h2>Simulasi Profit</h2>
<p>Jika Anda membeli 100 lot dari total 1.000 lot (10% kepemilikan), dan paket tersebut menghasilkan profit bersih Rp4.000.000:</p>
<ul>
<li>Raia (60%): Rp2.400.000</li>
<li>Investor pool (40%): Rp1.600.000</li>
<li>Anda (10% dari investor pool): Rp160.000</li>
</ul>

<h2>Perbandingan dengan Investasi Lain</h2>
<table>
<tr><th>Jenis Investasi</th><th>Modal Minimum</th><th>Estimasi Return</th></tr>
<tr><td>Reksadana Pasar Uang</td><td>Rp10.000</td><td>4-6% per tahun</td></tr>
<tr><td>Emas</td><td>Rp10.000</td><td>5-10% per tahun</td></tr>
<tr><td>Investasi Ternak Raia</td><td>Rp10.000</td><td>15-25% per tahun</td></tr>
</table>

<h2>Mengapa Memilih Gotong Royong?</h2>
<ul>
<li>Modal terjangkau: mulai dari Rp10.000 per lot.</li>
<li>Transparansi penuh: pantau ternak via foto dan laporan harian.</li>
<li>Likuiditas terjamin: jual aset di secondary market dalam 7 hari.</li>
<li>Proteksi ta'awun: penggantian 100% jika ternak meninggal.</li>
</ul>
    `,
    coverImage: '/images/articles/gotong-royong.jpg',
    authorName: 'Tim Raia',
    publishedAt: new Date('2025-02-01'),
    metaTitle: 'Investasi Ternak Gotong Royong Mulai 10 Ribu | Raia',
    metaDescription:
      'Sistem lot gotong royong memungkinkan investasi ternak dengan modal kecil. ROI hingga 25% per tahun.',
    keywords: [
      'lot gotong royong',
      'investasi ternak murah',
      'modal kecil',
      'investasi 10 ribu',
    ],
  },
  {
    slug: 'memilih-platform-investasi-ternak',
    title: 'Cara Memilih Platform Investasi Ternak yang Aman dan Terpercaya',
    excerpt:
      'Jangan sampai salah pilih platform! Ini checklist penting sebelum Anda investasi ternak online.',
    content: `
<h2>7 Kriteria Platform Investasi Ternak Terpercaya</h2>

<h3>1. Legalitas Jelas</h3>
<p>Pastikan platform memiliki badan hukum yang terdaftar. Setiap site project di Raia memiliki PT sendiri dengan nomor AHU dan NPWP yang dapat diverifikasi.</p>

<h3>2. Transparansi Data</h3>
<p>Platform harus menyediakan akses real-time ke data ternak, laporan keuangan, dan riwayat transaksi. Raia menampilkan foto harian, laporan produksi susu, dan status kesehatan ternak Anda.</p>

<h3>3. Sistem Proteksi</h3>
<p>Cari platform yang memiliki sistem asuransi atau dana proteksi. Dana ta'awun di Raia mengganti 100% nilai ternak jika ternak meninggal dalam masa investasi.</p>

<h3>4. Track Record</h3>
<p>Lihat jumlah investor aktif, paket yang sudah berjalan, dan profit yang sudah didistribusikan. Semakin transparan semakin baik.</p>

<h3>5. Likuiditas</h3>
<p>Pastikan ada mekanisme untuk keluar dari investasi. Secondary market di Raia menjamin aset Anda terjual dalam 7 hari atau diambil alih perusahaan 100%.</p>

<h3>6. Biaya Transparan</h3>
<p>Semua biaya harus dijabarkan sebelum pembelian. Raia menampilkan komposisi biaya paket secara detail: biaya ternak, ta'awun, sewa kandang, pakan, tenaga kerja, obat, dan operasional.</p>

<h3>7. Customer Service</h3>
<p>Platform yang baik memiliki dukungan pelanggan yang responsif dan dapat dihubungi melalui berbagai kanal.</p>

<h2>Red Flag: Tanda-Tanda Platform Berisiko</h2>
<ul>
<li>Janji return yang tidak realistis (di atas 50% per tahun).</li>
<li>Tidak ada informasi legalitas yang jelas.</li>
<li>Tidak bisa menarik dana atau proses penarikan berbelit.</li>
<li>Tidak ada laporan transparan tentang penggunaan dana.</li>
</ul>

<h2>Kesimpulan</h2>
<p>Investasi ternak melalui platform digital dapat memberikan return menarik, asalkan Anda memilih platform yang tepat. Gunakan checklist di atas sebelum berinvestasi.</p>
    `,
    coverImage: '/images/articles/platform-aman.jpg',
    authorName: 'Tim Raia',
    publishedAt: new Date('2025-02-10'),
    metaTitle: 'Cara Memilih Platform Investasi Ternak Terpercaya | Raia',
    metaDescription:
      'Checklist lengkap memilih platform investasi ternak yang aman: legalitas, transparansi, asuransi, dan track record.',
    keywords: [
      'platform investasi ternak',
      'investasi ternak online',
      'ternak terpercaya',
      'investasi aman',
    ],
  },
  {
    slug: 'sistem-taawun-asuransi-syariah',
    title: "Mengenal Sistem Ta'awun: Asuransi Syariah untuk Investasi Ternak",
    excerpt:
      "Ta'awun memberikan proteksi 100% jika ternak meninggal. Begini cara kerjanya sesuai prinsip syariah.",
    content: `
<h2>Prinsip Ta'awun dalam Islam</h2>
<p>Ta'awun berasal dari kata "to" al-lingu awna" yang berarti tolong-menolong. Dalam konteks keuangan Islam, ta'awun adalah sistem gotong royong di mana peserta saling membantu ketika ada anggota yang mengalami musibah.</p>

<h2>Cara Kerja Dana Ta'awun di Raia</h2>
<ol>
<li>Setiap investor membayar iuran ta'awun saat membeli paket investasi.</li>
<li>Dana terkumpul dalam satu pool yang dikelola oleh Raia.</li>
<li>Jika ternak investor meninggal, klaim diajukan dan dana ta'awun digunakan untuk mengganti 100% kerugian.</li>
<li>Iuran ta'awun tahun pertama Rp300.000, tahun berikutnya turun menjadi Rp150.000 (karena pool sudah matang).</li>
</ol>

<h2>Perbedaan dengan Asuransi Konvensional</h2>
<table>
<tr><th>Aspek</th><th>Asuransi Konvensional</th><th>Ta'awun Raia</th></tr>
<tr><td>Dasar hukum</td><td>Undang-undang perasuransian</td><td>Syariah Islam (takaful)</td></tr>
<tr><td>Untung rugi</td><td>Perusahaan asuransi</td><td>Peserta (mudharabah)</td></tr>
<tr><td>Nilai klaim</td><td>Sesuai polis</td><td>100% nilai ternak</td></tr>
<tr><td>Prinsip</td><td>Jual-beli risiko</td><td>Tolong-menolong</td></tr>
</table>

<h2>Contoh Klaim</h2>
<p>Seorang investor memiliki kambing senilai Rp10.000.000 dalam paket investasi. Jika kambing tersebut meninggal karena penyakit dalam masa investasi:</p>
<ul>
<li>Investor mengajukan klaim dengan bukti foto/video.</li>
<li>Raia memverifikasi dalam 1x24 jam.</li>
<li>Dana ta'awun diganti: Rp10.000.000 (100%).</li>
<li>Investor tidak mengalami kerugian sama sekali.</li>
</ul>

<h2>Mengapa Ta'awun Penting untuk Investasi Ternak?</h2>
<p>Peternakan memiliki risiko alami: penyakit, bencana, dan kegagalan reproduksi. Tanpa proteksi, investor bisa kehilangan seluruh modalnya. Dana ta'awun memberikan rasa aman sehingga investasi ternak menjadi pilihan yang layak bagi investor pemula.</p>
    `,
    coverImage: '/images/articles/taawun.jpg',
    authorName: 'Tim Raia',
    publishedAt: new Date('2025-02-20'),
    metaTitle:
      "Sistem Ta'awun: Asuransi Syariah Investasi Ternak | Raia",
    metaDescription:
      "Pahami sistem ta'awun sebagai asuransi syariah pada investasi ternak. Proteksi 100% sesuai prinsip Islam.",
    keywords: [
      'taawun',
      'asuransi syariah ternak',
      'investasi halal',
      'takaful ternak',
    ],
  },
  {
    slug: 'kambing-etawa-vs-sapi-limosin',
    title:
      'Perbedaan Investasi Kambing Etawa vs Sapi Limosin: Mana yang Lebih Menguntungkan?',
    excerpt:
      'Kambing atau sapi? Simak perbandingan ROI, periode, dan risiko dari keduanya.',
    content: `
<h2>Perbandingan ROI</h2>
<table>
<tr><th>Jenis</th><th>Modal Minimum</th><th>Periode</th><th>Estimasi ROI</th></tr>
<tr><td>Kambing Etawa</td><td>Rp6.000.000</td><td>12 bulan</td><td>15-22%</td></tr>
<tr><td>Sapi Limosin</td><td>Rp25.000.000</td><td>18 bulan</td><td>20-25%</td></tr>
<tr><td>Domba Garut</td><td>Rp8.000.000</td><td>12 bulan</td><td>15-18%</td></tr>
</table>

<h2>Kambing Etawa: Untuk Pemula</h2>
<h3>Kelebihan:</h3>
<ul>
<li>Modal lebih terjangkau (mulai Rp6 juta).</li>
<li>Periode lebih pendek (12 bulan).</li>
<li>Hasil susu harian memberikan cashflow berkelanjutan.</li>
<li>Perawatan lebih sederhana.</li>
<li>Lahir anak 1-2 kali per tahun.</li>
</ul>
<h3>Kekurangan:</h3>
<ul>
<li>Nilai per ekor lebih rendah.</li>
<li>Produksi susu tergantung musim.</li>
</ul>

<h2>Sapi Limosin: Untuk Investor Serius</h2>
<h3>Kelebihan:</h3>
<ul>
<li>Nilai jual per ekor tinggi (Rp15-25 juta).</li>
<li>ROI lebih tinggi (20-25%).</li>
<li>Bobot naik signifikan dalam 18 bulan.</li>
<li>Pasaran daging sapi yang selalu tinggi.</li>
</ul>
<h3>Kekurangan:</h3>
<ul>
<li>Modal awal lebih besar (Rp25 juta per paket).</li>
<li>Periode lebih panjang (18 bulan).</li>
<li>Butuh kandang lebih luas.</li>
</ul>

<h2>Produksi Susu Kambing Etawa</h2>
<p>Kambing etawa produktif menghasilkan 1-2 liter susu per hari. Dengan harga susu Rp15.000/liter, satu ekor dapat menghasilkan Rp450.000-900.000 per bulan dari susu saja, belum termasuk anak yang lahir.</p>

<h2>Penggemukan Sapi Limosin</h2>
<p>Sapi bakalan masuk dengan berat 200-250 kg dan keluar dengan berat 400-500 kg setelah 18 bulan. Dengan harga daging Rp120.000/kg, satu ekor sapi menghasilkan Rp48-60 juta bruto.</p>

<h2>Rekomendasi</h2>
<ul>
<li>Investor pemula atau modal terbatas: pilih Kambing Etawa.</li>
<li>Investor dengan modal besar dan horizon panjang: pilih Sapi Limosin.</li>
<li>Diversifikasi: kombinasi kambing untuk cashflow + sapi untuk capital gain.</li>
</ul>
    `,
    coverImage: '/images/articles/kambing-vs-sapi.jpg',
    authorName: 'Tim Raia',
    publishedAt: new Date('2025-03-01'),
    metaTitle: 'Kambing Etawa vs Sapi Limosin: Mana Lebih Untung? | Raia',
    metaDescription:
      'Analisis lengkap perbandingan investasi kambing etawa dan sapi limosin dari sisi ROI, periode, dan modal.',
    keywords: [
      'investasi kambing',
      'investasi sapi',
      'kambing etawa',
      'sapi limosin',
      'perbandingan ternak',
    ],
  },
  {
    slug: 'panduan-secondary-market',
    title:
      'Panduan Lengkap Secondary Market: Cara Menjual Aset Ternak dengan Cepat',
    excerpt:
      'Butuh dana cepat? Jual aset ternak Anda di secondary market dan dijamin dibeli dalam 7 hari.',
    content: `
<h2>Apa Itu Secondary Market?</h2>
<p>Secondary market di platform Raia adalah pasar sekunder yang memungkinkan investor menjual kembali aset investasi ternaknya kepada investor lain. Jika dalam 7x24 jam tidak ada pembeli, perusahaan (Raia) akan mengambil alih aset tersebut 100% sesuai harga par.</p>

<h2>Cara Menjual Aset</h2>
<ol>
<li>Masuk ke halaman Portofolio di aplikasi Raia.</li>
<li>Pilih aset yang ingin dijual.</li>
<li>Klik tombol "Jual Aset".</li>
<li>Tentukan harga jual (sistem merekomendasikan harga par/paket).</li>
<li>Aset otomatis tampil di secondary market.</li>
<li>Investor lain dapat membeli, atau jika kedaluwarsa dalam 7 hari, Raia mengambil alih.</li>
</ol>

<h2>Aturan Harga</h2>
<ul>
<li>Harga listing selalu flat pada harga par (harga paket awal).</li>
<li>Tidak ada spekulasi harga seperti bursa saham.</li>
<li>Fee jual-beli saat ini 0%.</li>
<li>Take-over oleh Raia: 100% harga par (tanpa potongan).</li>
</ul>

<h2>Contoh Skenario</h2>
<p>Anda membeli 300 lot dari paket Kambing Etawa senilai Rp10.000.000 (total 1.000 lot). Nilai kepemilikan Anda: 300 x Rp10.000 = Rp3.000.000.</p>
<ul>
<li>Skenario 1: Investor lain membeli listing Anda dalam 3 hari → Anda menerima Rp3.000.000.</li>
<li>Skenario 2: Tidak ada pembeli dalam 7 hari → Raia take-over 100% → Anda tetap menerima Rp3.000.000.</li>
</ul>

<h2>FAQ</h2>
<h3>Berapa lama proses penjualan?</h3>
<p>Minimal 1 hari, maksimal 7 hari (take-over otomatis).</p>
<h3>Apakah ada biaya administrasi?</h3>
<p>Untuk saat ini fee adalah 0%. Biaya administrasi dapat diatur oleh operator di dashboard.</p>
<h3>Bisakah saya membatalkan listing?</h3>
<p>Ya, Anda dapat membatalkan listing kapan saja sebelum ada pembeli.</p>
    `,
    coverImage: '/images/articles/secondary-market.jpg',
    authorName: 'Tim Raia',
    publishedAt: new Date('2025-03-10'),
    metaTitle: 'Panduan Secondary Market Investasi Ternak | Raia',
    metaDescription:
      'Cara menjual aset investasi ternak dengan cepat melalui secondary market. Likuiditas terjamin 7 hari.',
    keywords: [
      'secondary market',
      'jual aset ternak',
      'likuiditas ternak',
      'jual investasi ternak',
    ],
  },
  {
    slug: 'investasi-ternak-untuk-pekerja-kantoran',
    title:
      'Investasi Ternak untuk Pekerja Kantoran: Passive Income Tanpa Ribet',
    excerpt:
      'Tidak perlu ke desa atau bau kandang. Investasi ternak bisa dilakukan 100% dari smartphone.',
    content: `
<h2>Kenapa Cocok untuk Pekerja Kantoran?</h2>
<ul>
<li>Tidak butuh waktu harian: Raia yang mengelola.</li>
<li>Tidak butuh keahlian peternakan: operator profesional yang merawat.</li>
<li>Modal terjangkau: mulai Rp10.000 per lot.</li>
<li>Pantau dari HP: dashboard real-time dengan foto dan laporan.</li>
<li>Passive income: profit masuk otomatis ke saldo Anda.</li>
</ul>

<h2>Perbandingan dengan Investasi Lain untuk Karyawan</h2>
<table>
<tr><th>Aspek</th><th>Saham</th><th>Reksadana</th><th>Properti</th><th>Ternak Raia</th></tr>
<tr><td>Modal minimum</td><td>Rp100rb</td><td>Rp10rb</td><td>Rp100jt</td><td>Rp10rb</td></tr>
<tr><td>Waktu monitoring</td><td>Harian</td><td>Waktu luang</td><td>Sesekali</td><td>Sesekali</td></tr>
<tr><td>Risiko</td><td>Tinggi</td><td>Sedang</td><td>Sedang</td><td>Rendah*</td></tr>
<tr><td>Return potensial</td><td>Fluktuatif</td><td>5-10%</td><td>5-15%</td><td>15-25%</td></tr>
<tr><td>Likuiditas</td><td>Instan</td><td>1-2 hari</td><td>Sulit</td><td>7 hari</td></tr>
</table>
<p><em>*Dilindungi dana ta'awun (penggantian 100% jika ternak meninggal).</em></p>

<h2>Cara Memulai dalam 5 Menit</h2>
<ol>
<li>Buka <a href="https://ran.teknoloka.id">ran.teknoloka.id</a> di browser HP.</li>
<li>Daftar akun (nama, username, email, password).</li>
<li>Lengkapi KYC (proses otomatis 3 detik dalam mode demo).</li>
<li>Pilih paket investasi sesuai budget.</li>
<li>Selesaikan pembayaran via QRIS/VA/transfer.</li>
<li>Pantau investasi Anda dari dashboard setiap hari.</li>
</ol>

<h2>Kisah Sukses Investor Raia</h2>
<p>Budi Santoso, seorang software engineer di Jakarta, mulai berinvestasi dengan Rp500.000 (50 lot) pada Januari 2025. Dalam 4 bulan pertama, ia menerima profit Rp64.000 dari kelahiran anak kambing. Setelah melihat hasilnya, ia menambah investasi menjadi 500 lot.</p>

<h2>Tips untuk Pemula</h2>
<ul>
<li>Mulai kecil dulu (50-100 lot) untuk memahami sistemnya.</li>
<li>Diversifikasi: jangan taruh semua di satu paket.</li>
<li>Pantau profit harian secara konsisten.</li>
<li>Manfaatkan fitur penarikan profit untuk cashflow bulanan.</li>
<li>Reinvest profit untuk compound effect.</li>
</ul>

<h2>Kesimpulan</h2>
<p>Investasi ternak adalah alternatif passive income yang realistis untuk pekerja kantoran. Modal kecil, monitoring mudah, dan return menarik menjadikan platform Raia pilihan tepat untuk memulai.</p>
    `,
    coverImage: '/images/articles/passive-income.jpg',
    authorName: 'Tim Raia',
    publishedAt: new Date('2025-03-15'),
    metaTitle: 'Investasi Ternak untuk Karyawan: Passive Income | Raia',
    metaDescription:
      'Panduan investasi ternak untuk pekerja kantoran. Passive income tanpa ribet, semua dari smartphone.',
    keywords: [
      'passive income',
      'investasi pasif',
      'investasi untuk karyawan',
      'investasi kantoran',
    ],
  },
];
