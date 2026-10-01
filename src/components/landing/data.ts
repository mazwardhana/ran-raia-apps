export interface FaqItem {
  question: string;
  answer: string;
}

export interface ValueProp {
  title: string;
  description: string;
}

export interface PackageCardData {
  code: string;
  title: string;
  animalType: string;
  periodMonths: number;
  price: number;
  lotPrice: number;
  totalLots: number;
  soldLots: number;
  status: string;
  description: string | null;
  coverImage: string | null;
  estimatedRoi: number | null;
  siteName: string;
  legalEntity: string;
  location: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Apa itu jasa gaduh pada investasi ternak?',
    answer:
      'Jasa gaduh adalah sistem penitipan ternak: Anda menyetorkan modal, ternak dirawat peternak, lalu hasilnya dibagi. Di Raia, praktik tradisional ini dicatat digital, dengan rasio bagi hasil 60% Raia dan 40% investor tercantum di setiap paket sebelum Anda membayar.',
  },
  {
    question: 'Bagaimana cara kerja lot gotong royong?',
    answer:
      'Satu paket dipecah menjadi lot, harga default Rp10.000 per lot. Anda membeli mulai 5 lot (Rp50.000) dan profit dibagi proporsional terhadap jumlah lot yang Anda miliki. Paket utuh tetap tersedia jika ingin kepemilikan penuh.',
  },
  {
    question:
      'Bagaimana sistem ta\'awun melindungi investasi saya?',
    answer:
      "Ta'awun adalah dana tolong-menolong sesuai prinsip syariah. Iuran dibayar saat membeli paket (tahun pertama Rp300.000, tahun berikutnya Rp150.000). Jika ternak meninggal, klaim diganti 100% nilai ternak dari dana tersebut.",
  },
  {
    question: 'Kapan saya bisa menjual atau keluar dari investasi?',
    answer:
      'Melalui secondary market setelah aset Anda aktif. Harga listing selalu di harga par (bukan bursa fluktuatif). Jika dalam 7 x 24 jam tidak ada pembeli, Raia mengambil alih 100% tanpa potongan. Fee jual-beli saat ini 0%.',
  },
  {
    question: 'Siapa yang mengelola ternak dan dana saya?',
    answer:
      'Raia bertindak sebagai operator vertikal: karyawan internal Raia mengelola operasional harian, sedangkan SDM lapangan dan bibit diambil dari warga serta peternak di sekitar site. Setiap site project berbadan hukum PT sendiri yang dapat Anda cek.',
  },
  {
    question: 'Bagaimana saya memantau kondisi ternak dari kota?',
    answer:
      'Dashboard investor menampilkan status kesehatan ternak, laporan produksi susu, kelahiran, dan riwayat distribusi profit, semuanya bisa dibuka dari ponsel tanpa perlu datang ke site.',
  },
];

export const VALUE_PROPS: ValueProp[] = [
  {
    title: 'Mulai dari Rp10.000',
    description:
      'Paket gotong royong dipecah menjadi lot. Cocok untuk mencoba tanpa modal besar.',
  },
  {
    title: 'Biaya terbuka sebelum bayar',
    description:
      'Komposisi biaya paket (ternak, ta\'awun, sewa kandang, pakan, tenaga kerja, obat) ditampilkan rinci sebelum checkout.',
  },
  {
    title: 'Dikelola operator profesional',
    description:
      'Anda tidak perlu merawat ternak. Karyawan internal Raia menjalankan operasional harian di site.',
  },
  {
    title: 'Jelas jalur keluarnya',
    description:
      'Aset bisa dijual di secondary market dengan harga par, dan Raia mengambil alih bila tidak ada pembeli dalam 7 hari.',
  },
];

export const HOW_IT_WORKS = [
  {
    step: 'Daftar dan verifikasi akun',
    description:
      'Buat akun, lengkapi data, selesaikan verifikasi KYC langsung dari ponsel.',
  },
  {
    step: 'Pilih paket atau lot',
    description:
      'Bandingkan paket berdasarkan jenis ternak, site, periode, dan estimasi return.',
  },
  {
    step: 'Bayar dan pantau ternak',
    description:
      'Pembayaran via QRIS, Virtual Account, atau transfer. Lihat laporan ternak di dashboard.',
  },
  {
    step: 'Terima profit berkala',
    description:
      'Profit dari kelahiran anak ternak dan susu dibagi sesuai porsi lot Anda.',
  },
  {
    step: 'Jual saat butuh dana',
    description:
      'List aset di secondary market atau tunggu ambil alih oleh Raia setelah 7 hari.',
  },
];

export const WHY_RAIA = [
  {
    title: 'Transparansi penuh',
    description:
      'Rincian biaya, laporan ternak, dan riwayat profit tercatat di dashboard. Tidak ada klaim return tanpa sumber: angka di setiap paket adalah estimasi yang bisa Anda periksa.',
  },
  {
    title: "Ta'awun 100%",
    description:
      "Dana tolong-menolong sesuai prinsip syariah mengganti 100% nilai ternak bila ternak meninggal selama masa investasi.",
  },
  {
    title: 'Secondary market 7 hari',
    description:
      'Jual aset di harga par kapan saja. Tanpa pembeli dalam 7 x 24 jam, Raia mengambil alih 100% tanpa potongan.',
  },
];
