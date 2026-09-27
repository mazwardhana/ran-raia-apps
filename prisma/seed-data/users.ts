import { randomUUID } from 'node:crypto';

export interface SeedUser {
  username: string;
  email: string;
  name: string;
  phone: string;
  role: 'ADMIN' | 'OPERATOR' | 'INVESTOR';
  kycStatus: 'PENDING' | 'VERIFIED';
}

// Password demo universal: password123 (di-hash oleh seed.ts)
export const users: SeedUser[] = [
  {
    username: 'admin_raia',
    email: 'admin@raia.id',
    name: 'Admin Raia',
    phone: '081234567890',
    role: 'ADMIN',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'operator_wilayah_1',
    email: 'operator1@raia.id',
    name: 'Operator Wilayah 1',
    phone: '082345678901',
    role: 'OPERATOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'operator_wilayah_2',
    email: 'operator2@raia.id',
    name: 'Operator Wilayah 2',
    phone: '083456789012',
    role: 'OPERATOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'budi_santoso',
    email: 'budi@example.com',
    name: 'Budi Santoso',
    phone: '081111111111',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'siti_nurhaliza',
    email: 'siti@example.com',
    name: 'Siti Nurhaliza',
    phone: '082222222222',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'ahmad_fauzi',
    email: 'ahmad@example.com',
    name: 'Ahmad Fauzi',
    phone: '083333333333',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'rina_wijaya',
    email: 'rina@example.com',
    name: 'Rina Wijaya',
    phone: '084444444444',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'hendra_gunawan',
    email: 'hendra@example.com',
    name: 'Hendra Gunawan',
    phone: '085555555555',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'dewi_kartika',
    email: 'dewi@example.com',
    name: 'Dewi Kartika',
    phone: '086666666666',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'joko_prasetyo',
    email: 'joko@example.com',
    name: 'Joko Prasetyo',
    phone: '087777777777',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'mayang_sari',
    email: 'mayang@example.com',
    name: 'Mayang Sari',
    phone: '088888888888',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'andi_wijaya',
    email: 'andi@example.com',
    name: 'Andi Wijaya',
    phone: '089999999999',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'putri_ayu',
    email: 'putri@example.com',
    name: 'Putri Ayu',
    phone: '081010101010',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'dian_permata',
    email: 'dian@example.com',
    name: 'Dian Permata',
    phone: '082020202020',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'rudi_hartono',
    email: 'rudi@example.com',
    name: 'Rudi Hartono',
    phone: '083030303030',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'nina_laut',
    email: 'nina@example.com',
    name: 'Nina Laut',
    phone: '084040404040',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'yoga_pratama',
    email: 'yoga@example.com',
    name: 'Yoga Pratama',
    phone: '085050505050',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
  {
    username: 'farah_dina',
    email: 'farah@example.com',
    name: 'Farah Dina',
    phone: '086060606060',
    role: 'INVESTOR',
    kycStatus: 'PENDING',
  },
  {
    username: 'tono_susanto',
    email: 'tono@example.com',
    name: 'Tono Susanto',
    phone: '087070707070',
    role: 'INVESTOR',
    kycStatus: 'PENDING',
  },
  {
    username: 'sari_indah',
    email: 'sari@example.com',
    name: 'Sari Indah',
    phone: '088080808080',
    role: 'INVESTOR',
    kycStatus: 'VERIFIED',
  },
];

export function genId(): string {
  return randomUUID();
}
