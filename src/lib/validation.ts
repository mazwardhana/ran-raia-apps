import { z } from 'zod';

// ======================
// USER / AUTH
// ======================

export const usernameSchema = z
  .string()
  .min(3, 'Username minimal 3 karakter')
  .max(30, 'Username maksimal 30 karakter')
  .regex(
    /^[a-z0-9_]+$/,
    'Username hanya boleh huruf kecil, angka, dan underscore'
  );

export const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  username: usernameSchema,
  email: z.string().email('Email tidak valid').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(100, 'Password maksimal 100 karakter'),
  phone: z
    .string()
    .min(8, 'Nomor telepon minimal 8 digit')
    .max(20)
    .regex(/^[0-9+\-\s]+$/, 'Nomor telepon tidak valid')
    .optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, 'Email atau username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  username: usernameSchema.optional(),
  phone: z.string().min(8).max(20).optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
});

// ======================
// CHECKOUT
// ======================

export const checkoutSchema = z.object({
  packageId: z.string().min(1),
  ownershipType: z.enum(['FULL', 'LOT']),
  lotCount: z.number().int().positive().optional(),
});

// ======================
// WITHDRAWAL
// ======================

export const withdrawalSchema = z.object({
  amount: z
    .number()
    .int('Harus bilangan bulat')
    .min(50000, 'Minimum penarikan Rp50.000'),
  bankName: z.string().min(1, 'Nama bank wajib diisi'),
  bankAccount: z.string().min(1, 'Nomor rekening wajib diisi'),
  bankHolder: z.string().min(1, 'Nama pemilik rekening wajib diisi'),
});

// ======================
// SITE PROJECT
// ======================

export const siteProjectSchema = z.object({
  name: z.string().min(3, 'Nama site minimal 3 karakter').max(100),
  legalEntity: z.string().min(3, 'Nama legalitas PT wajib diisi').max(200),
  legalNumber: z.string().max(100).optional(),
  npwp: z.string().max(30).optional(),
  address: z.string().min(5, 'Alamat wajib diisi').max(500),
  province: z.string().min(1, 'Provinsi wajib diisi'),
  city: z.string().min(1, 'Kabupaten/Kota wajib diisi'),
  village: z.string().optional(),
  contactPerson: z.string().max(100).optional(),
  contactPhone: z.string().max(20).optional(),
  description: z.string().max(2000).optional(),
  capacity: z.number().int().min(1).max(10000),
  status: z.enum(['ACTIVE', 'NONAKTIF']).default('ACTIVE'),
});

// ======================
// PACKAGE
// ======================

export const packageCostSchema = z.object({
  costType: z.enum([
    'ANIMAL',
    'TAAWUN',
    'RENT',
    'FEED',
    'LABOR',
    'MEDICINE',
    'OPERATIONAL',
  ]),
  amount: z.number().int().positive(),
  description: z.string().max(500).optional(),
});

export const packageSchema = z.object({
  title: z.string().min(3, 'Nama paket wajib diisi').max(200),
  animalType: z.enum(['KAMBING', 'SAPI']),
  siteProjectId: z.string().min(1, 'Site project wajib dipilih'),
  periodMonths: z
    .number()
    .int('Harus bilangan bulat')
    .min(1, 'Periode minimal 1 bulan')
    .max(60, 'Periode maksimal 60 bulan'),
  price: z
    .number()
    .int('Harus bilangan bulat')
    .min(10000, 'Harga minimal Rp10.000'),
  lotPrice: z
    .number()
    .int()
    .min(1000, 'Harga lot minimal Rp1.000'),
  totalLots: z
    .number()
    .int('Harus bilangan bulat')
    .min(1, 'Total lot minimal 1'),
  maxInvestors: z.number().int().min(1).default(100),
  description: z.string().max(5000).optional(),
  estimatedRoi: z.number().min(0).max(100).optional(),
  estimatedOffspring: z.number().int().min(0).optional(),
  estimatedOffspringPrice: z.number().int().min(0).optional(),
  estimatedMilkMonthly: z.number().min(0).optional(),
  estimatedMilkPrice: z.number().int().min(0).optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),
  costs: z.array(packageCostSchema).min(1, 'Minimal 1 komponen biaya'),
});

// ======================
// LIVESTOCK IMPORT
// ======================

export const livestockRowSchema = z.object({
  tagNumber: z.string().min(1, 'Tag number wajib diisi').max(50),
  name: z.string().max(100).optional().or(z.literal('')),
  animalType: z.string().refine(
    (v) => ['KAMBING', 'SAPI', 'kambing', 'sapi'].includes(v),
    'animalType harus KAMBING atau SAPI'
  ),
  sex: z.string().refine(
    (v) => ['JANTAN', 'BETINA', 'jantan', 'betina'].includes(v),
    'sex harus JANTAN atau BETINA'
  ),
  breed: z.string().max(100).optional().or(z.literal('')),
  birthDate: z
    .string()
    .refine((v) => {
      if (!v) return true;
      const d = new Date(v);
      return !isNaN(d.getTime());
    }, 'birthDate tidak valid')
    .optional()
    .or(z.literal('')),
  weightKg: z
    .string()
    .refine((v) => !v || !isNaN(parseFloat(v)), 'weightKg harus angka')
    .optional()
    .or(z.literal('')),
  motherTag: z.string().max(50).optional().or(z.literal('')),
  status: z.string().optional().or(z.literal('')),
  note: z.string().max(500).optional().or(z.literal('')),
});
