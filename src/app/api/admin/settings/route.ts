import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Pengengatur bisnis (tabel Setting, key = id, value = string).
 * Tabel Setting tidak punya kolom label/deskripsi, jadi label Indonesia
 * didefinisikan di sini sebagai metadata tampilan.
 */

interface SettingMeta {
  label: string;
  description: string;
  unit: 'percent' | 'rupiah' | 'days' | 'number';
}

const SETTING_META: Record<string, SettingMeta> = {
  raia_share_percent: {
    label: 'Bagian Raia (%)',
    description: 'Persentase bagi hasil untuk Raia. Harus berjumlah 100% dengan bagian investor.',
    unit: 'percent',
  },
  investor_share_percent: {
    label: 'Bagian Investor (%)',
    description: 'Persentase bagi hasil untuk investor. Harus berjumlah 100% dengan bagian Raia.',
    unit: 'percent',
  },
  min_checkout: {
    label: 'Minimum checkout (Rp)',
    description: 'Nilai minimum pembelian lot dalam satu transaksi.',
    unit: 'rupiah',
  },
  default_lot_price: {
    label: 'Harga lot default (Rp)',
    description: 'Harga satu lot ketika paket tidak menentukan sendiri.',
    unit: 'rupiah',
  },
  taawun_year_1: {
    label: "Rate ta'awun tahun ke-1 (Rp)",
    description: 'Nilai klaim ta\'awun maksimal untuk tahun pertama.',
    unit: 'rupiah',
  },
  taawun_year_2_plus: {
    label: "Rate ta'awun tahun ke-2 (Rp)",
    description: 'Nilai klaim ta\'awun maksimal untuk tahun kedua dan seterusnya.',
    unit: 'rupiah',
  },
  secondary_market_days: {
    label: 'Masa tayang secondary (hari)',
    description: 'Berapa hari listing secondary market bertayang sebelum kedaluwarsa.',
    unit: 'days',
  },
  secondary_admin_fee_percent: {
    label: 'Biaya admin secondary (%)',
    description: 'Persentase biaya admin transaksi secondary market.',
    unit: 'percent',
  },
  secondary_admin_fee_flat: {
    label: 'Biaya admin secondary tetap (Rp)',
    description: 'Biaya admin secondary dalam rupiah tetap (0 = tanpa biaya tetap).',
    unit: 'rupiah',
  },
};

const SPLIT_KEYS = ['raia_share_percent', 'investor_share_percent'] as const;
const PERCENT_KEYS = ['raia_share_percent', 'investor_share_percent', 'secondary_admin_fee_percent'];

/**
 * Kunci yang mengubah pembagian uang dan biaya platform (RULING 24) — hanya
 * ADMIN yang boleh menulisnya. Kunci lain tetap bisa diubah OPERATOR.
 */
const ADMIN_ONLY_KEYS = [
  'raia_share_percent',
  'investor_share_percent',
  'secondary_admin_fee_percent',
  'secondary_admin_fee_flat',
];

const updateSchema = z.object({
  key: z.string().min(1, 'Key pengaturan wajib diisi'),
  value: z.string().min(1, 'Nilai pengaturan wajib diisi'),
});

function deny(error: unknown): NextResponse {
  const code = (error as { code?: string })?.code;
  if (code === 'UNAUTHENTICATED') {
    return NextResponse.json(
      { error: 'Silakan login terlebih dahulu' },
      { status: 401 }
    );
  }
  return NextResponse.json(
    { error: 'Anda tidak memiliki akses ke halaman operator' },
    { status: 403 }
  );
}

export async function GET() {
  try {
    await requireRole(['OPERATOR', 'ADMIN']);
  } catch (error) {
    return deny(error);
  }

  try {
    const rows = await prisma.setting.findMany({ orderBy: { id: 'asc' } });

    return NextResponse.json({
      items: rows.map((row) => {
        const meta = SETTING_META[row.id];
        return {
          key: row.id,
          value: row.value,
          label: meta?.label ?? row.id,
          description: meta?.description ?? null,
          unit: meta?.unit ?? 'text',
          updatedAt: row.updatedAt,
        };
      }),
      total: rows.length,
    });
  } catch (error) {
    console.error('GET /api/admin/settings error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat data pengaturan' },
      { status: 500 }
    );
  }
}

async function handleUpdate(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null);
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Data tidak valid' },
        { status: 400 }
      );
    }

    const { key, value } = validation.data;

    // Kunci sensitif (pembagian profit & biaya admin secondary) hanya ADMIN.
    // Kunci tak dikenal tetap jatuh ke guard default lalu ditolak 400 di bawah.
    try {
      await requireRole(
        ADMIN_ONLY_KEYS.includes(key) ? ['ADMIN'] : ['OPERATOR', 'ADMIN']
      );
    } catch (error) {
      return deny(error);
    }

    const meta = SETTING_META[key];

    if (!meta) {
      return NextResponse.json(
        { error: `Pengaturan "${key}" tidak dikenal` },
        { status: 400 }
      );
    }

    const numeric = Number(value);
    if (value.trim() === '' || !Number.isFinite(numeric)) {
      return NextResponse.json(
        { error: `Nilai "${meta.label}" harus berupa angka` },
        { status: 400 }
      );
    }

    if (!Number.isInteger(numeric) || numeric < 0) {
      return NextResponse.json(
        { error: `Nilai "${meta.label}" harus bilangan bulat positif` },
        { status: 400 }
      );
    }

    if (PERCENT_KEYS.includes(key) && numeric > 100) {
      return NextResponse.json(
        { error: `Nilai "${meta.label}" harus antara 0 dan 100` },
        { status: 400 }
      );
    }

    // Validasi pembagian profit harus berjumlah 100%
    if ((SPLIT_KEYS as readonly string[]).includes(key)) {
      const otherKey = key === SPLIT_KEYS[0] ? SPLIT_KEYS[1] : SPLIT_KEYS[0];
      const other = await prisma.setting.findUnique({ where: { id: otherKey } });
      const otherValue = other ? Number.parseInt(other.value, 10) : NaN;
      const safeOther = Number.isFinite(otherValue) ? otherValue : 0;
      const total = numeric + safeOther;

      if (total !== 100) {
        return NextResponse.json(
          {
            error: `Total pembagian profit harus 100%, saat ini ${numeric}% + ${safeOther}% = ${total}%`,
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.setting.update({
      where: { id: key },
      data: { value },
    });

    return NextResponse.json({
      key: updated.id ?? key,
      value,
      label: meta.label,
    });
  } catch (error) {
    console.error('PUT /api/admin/settings error:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan pengaturan' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return handleUpdate(request);
}

export async function POST(request: NextRequest) {
  return handleUpdate(request);
}
