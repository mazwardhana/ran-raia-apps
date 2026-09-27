export interface SeedSiteProject {
  code: string;
  name: string;
  legalEntity: string;
  legalNumber: string;
  npwp: string;
  address: string;
  province: string;
  city: string;
  village: string;
  contactPerson: string;
  contactPhone: string;
  description: string;
  capacity: number;
  status: string;
}

export const siteProjects: SeedSiteProject[] = [
  {
    code: 'SP-001',
    name: 'Raia Farm Sukabumi',
    legalEntity: 'PT Raia Ternak Sukabumi Sejahtera',
    legalNumber: 'AHU-0012345.AH.01.01.TAHUN 2025',
    npwp: '01.234.567.8-901.000',
    address: 'Jl. Raya Cibadak No. 45, Sukabumi',
    province: 'Jawa Barat',
    city: 'Sukabumi',
    village: 'Desa Sukamanah',
    contactPerson: 'Asep Saepudin',
    contactPhone: '081234567890',
    description:
      'Site project dengan fokus peternakan kambing etawa perah. Luas lahan 2 hektar dengan kapasitas 200 ekor.',
    capacity: 2800,
    status: 'ACTIVE',
  },
  {
    code: 'SP-002',
    name: 'Raia Farm Boyolali',
    legalEntity: 'PT Raia Livestock Boyolali Mandiri',
    legalNumber: 'AHU-0067890.AH.01.01.TAHUN 2025',
    npwp: '02.345.678.9-012.000',
    address: 'Jl. Solo-Yogyakarta KM 8, Boyolali',
    province: 'Jawa Tengah',
    city: 'Boyolali',
    village: 'Desa Kemiri',
    contactPerson: 'Suryanto',
    contactPhone: '082345678901',
    description:
      'Site project sapi perah dan potong. Kapasitas kandang modern dengan sistem ventilasi alami.',
    capacity: 2500,
    status: 'ACTIVE',
  },
  {
    code: 'SP-003',
    name: 'Raia Farm Blitar',
    legalEntity: 'PT Raia Agro Blitar Makmur',
    legalNumber: 'AHU-0098765.AH.01.01.TAHUN 2025',
    npwp: '03.456.789.0-123.000',
    address: 'Jl. Raya Kanigoro KM 5, Blitar',
    province: 'Jawa Timur',
    city: 'Blitar',
    village: 'Desa Sananwetan',
    contactPerson: 'H. Subagyo',
    contactPhone: '083456789012',
    description:
      'Site project kambing etawa dan domba. Berlokasi di dataran rendah dengan akses pakan hijauan yang melimpah.',
    capacity: 3000,
    status: 'ACTIVE',
  },
  {
    code: 'SP-004',
    name: 'Raia Farm Banjarmasin',
    legalEntity: 'PT Raia Livestock Banjarmasin Perkasa',
    legalNumber: 'AHU-0123456.AH.01.01.TAHUN 2025',
    npwp: '04.567.890.1-234.000',
    address: 'Jl. A. Yani KM 10, Banjarmasin',
    province: 'Kalimantan Selatan',
    city: 'Banjarmasin',
    village: 'Desa Cempaka',
    contactPerson: 'Muhammad Rafi',
    contactPhone: '084567890123',
    description:
      'Site project sapi brahman dan kambing etawa. Berdekatan dengan sentra pakan di tepian sungai.',
    capacity: 2600,
    status: 'ACTIVE',
  },
  {
    code: 'SP-005',
    name: 'Raia Farm Sintang',
    legalEntity: 'PT Raia Agro Sintang Lestari',
    legalNumber: 'AHU-0156789.AH.01.01.TAHUN 2025',
    npwp: '05.678.901.2-345.000',
    address: 'Jl. Raya Sintang-Putussibau KM 3, Sintang',
    province: 'Kalimantan Barat',
    city: 'Sintang',
    village: 'Desa Merti Jaya',
    contactPerson: 'Yosep Hendra',
    contactPhone: '085678901234',
    description:
      'Site project kambing borneo dan sapi lokal. Areal kebun campuran dengan ruang pengembangan luas.',
    capacity: 2900,
    status: 'ACTIVE',
  },
  {
    code: 'SP-006',
    name: 'Raia Farm Kupang',
    legalEntity: 'PT Raia Livestock Kupang Sejahtera',
    legalNumber: 'AHU-0189012.AH.01.01.TAHUN 2025',
    npwp: '06.789.012.3-456.000',
    address: 'Jl. Raya Kupang-Soe KM 7, Kupang',
    province: 'Nusa Tenggara Timur',
    city: 'Kupang',
    village: 'Desa Noelbaki',
    contactPerson: 'Frans Benu',
    contactPhone: '086789012345',
    description:
      'Site project kambing dan sapi rakyat. Mendukung peternakan lokal dengan sistem silvopastura.',
    capacity: 2500,
    status: 'ACTIVE',
  },
  {
    code: 'SP-007',
    name: 'Raia Farm Ende',
    legalEntity: 'PT Raia Agro Ende Makmur',
    legalNumber: 'AHU-0212345.AH.01.01.TAHUN 2025',
    npwp: '07.890.123.4-567.000',
    address: 'Jl. Raya Ende-Maumere KM 5, Ende',
    province: 'Nusa Tenggara Timur',
    city: 'Ende',
    village: 'Desa Wolotopo',
    contactPerson: 'Kornelius Waa',
    contactPhone: '087890123456',
    description:
      'Site project sapi banteng dan kambing lokal. Berlokasi di pesisir dengan padang rumput alami.',
    capacity: 2700,
    status: 'ACTIVE',
  },
  {
    code: 'SP-008',
    name: 'Raia Farm Sumbawa',
    legalEntity: 'PT Raia Livestock Sumbawa Perkasa',
    legalNumber: 'AHU-0245678.AH.01.01.TAHUN 2025',
    npwp: '08.901.234.5-678.000',
    address: 'Jl. Raya Sumbawa-Reo KM 6, Sumbawa',
    province: 'Nusa Tenggara Barat',
    city: 'Sumbawa',
    village: 'Desa Brang Biji',
    contactPerson: 'H. Abdul Haris',
    contactPhone: '088901234567',
    description:
      'Site project kambing boer dan sapi brahman. Peternakan modern dengan kandang komunal.',
    capacity: 3000,
    status: 'ACTIVE',
  },
  {
    code: 'SP-009',
    name: 'Raia Farm Gowa',
    legalEntity: 'PT Raia Agro Gowa Lestari',
    legalNumber: 'AHU-0278901.AH.01.01.TAHUN 2025',
    npwp: '09.012.345.6-789.000',
    address: 'Jl. Raya Makassar-Takalar KM 9, Gowa',
    province: 'Sulawesi Selatan',
    city: 'Gowa',
    village: 'Desa Somba Opu',
    contactPerson: 'Andi Malik',
    contactPhone: '089012345678',
    description:
      'Site project sapi potong dan kambing etawa. Berdekatan dengan pasar hewan tradisional.',
    capacity: 2800,
    status: 'ACTIVE',
  },
  {
    code: 'SP-010',
    name: 'Raia Farm Poso',
    legalEntity: 'PT Raia Livestock Poso Sejahtera',
    legalNumber: 'AHU-0301234.AH.01.01.TAHUN 2025',
    npwp: '10.123.456.7-890.000',
    address: 'Jl. Raya Poso-Palulu KM 4, Poso',
    province: 'Sulawesi Tengah',
    city: 'Poso',
    village: 'Desa Kasintuwu',
    contactPerson: 'Marthen Lumban Gaol',
    contactPhone: '090123456789',
    description:
      'Site project sapi dan kambing dataran tinggi. Dikelola bersama kelompok tani setempat.',
    capacity: 2500,
    status: 'ACTIVE',
  },
];
