import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST as buyPOST } from '@/app/api/secondary/buy/route';
import { getCurrentUser } from '@/lib/auth';
import { expireStaleListings } from '@/lib/secondary';

// ---------------------------------------------------------------------------
// Mocks — tx dan prisma berbagi satu objek supaya perubahan status yang dibuat
// lewat jalur route terbaca kembali oleh pembaca berikutnya.
//
// $transaction di sini meniru rollback: setiap penulisan ditahan dulu di
// `pending` dan baru dipindah ke `committed` kalau callback selesai tanpa
// throw. Kalau callback throw (mis. baris kepemilikan tidak ditemukan), tidak
// ada penulisan yang "keluar" dari transaksi.
// ---------------------------------------------------------------------------

type Write = { model: string; op: string; args: unknown };

const mocks = vi.hoisted(() => {
  const tx = {
    secondarySale: { create: vi.fn() },
    secondaryListing: { update: vi.fn() },
    lotOwnership: { findFirst: vi.fn(), update: vi.fn() },
    fullOwnership: { findFirst: vi.fn(), update: vi.fn() },
    investorBalance: { upsert: vi.fn() },
    transaction: { create: vi.fn() },
  };

  const prisma = {
    secondaryListing: { findUnique: vi.fn() },
    fullOwnership: { findFirst: vi.fn() },
    lotOwnership: { findFirst: vi.fn() },
    setting: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };

  return { prisma, tx };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/secondary', () => ({ expireStaleListings: vi.fn() }));

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const buyer = {
  id: 'buyer_1',
  role: 'INVESTOR',
  username: 'pembeli',
  kycStatus: 'VERIFIED',
} as const;

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lst_1',
    sellerId: 'seller_1',
    packageId: 'pkg_1',
    ownershipType: 'LOT',
    lotStart: 600,
    lotEnd: 604,
    listingPrice: 100000,
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

function buyRequest(listingId = 'lst_1'): NextRequest {
  return new NextRequest('http://localhost/api/secondary/buy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ listingId }),
  });
}

const committed: Write[] = [];
let pending: Write[] = [];

function stageWrites() {
  const entries: Array<[string, string, ReturnType<typeof vi.fn>]> = [
    ['secondarySale', 'create', mocks.tx.secondarySale.create],
    ['secondaryListing', 'update', mocks.tx.secondaryListing.update],
    ['lotOwnership', 'update', mocks.tx.lotOwnership.update],
    ['fullOwnership', 'update', mocks.tx.fullOwnership.update],
    ['investorBalance', 'upsert', mocks.tx.investorBalance.upsert],
    ['transaction', 'create', mocks.tx.transaction.create],
  ];

  for (const [model, op, mock] of entries) {
    mock.mockImplementation(async (args: unknown) => {
      pending.push({ model, op, args });
      return { id: `${model}-result` };
    });
  }

  mocks.prisma.$transaction.mockImplementation(async (callback: (t: typeof mocks.tx) => unknown) => {
    pending = [];
    const result = await callback(mocks.tx);
    committed.push(...pending);
    pending = [];
    return result;
  });
}

function committedFor(model: string): Write[] {
  return committed.filter((w) => w.model === model);
}

beforeEach(() => {
  vi.clearAllMocks();
  committed.length = 0;
  pending = [];

  vi.mocked(getCurrentUser).mockResolvedValue(buyer);
  vi.mocked(expireStaleListings).mockResolvedValue(undefined);

  mocks.prisma.secondaryListing.findUnique.mockResolvedValue(makeListing());
  mocks.prisma.fullOwnership.findFirst.mockResolvedValue(null);
  mocks.prisma.lotOwnership.findFirst.mockResolvedValue(null);
  mocks.prisma.setting.findUnique.mockResolvedValue(null);

  mocks.tx.lotOwnership.findFirst.mockResolvedValue(null);
  mocks.tx.fullOwnership.findFirst.mockResolvedValue(null);

  stageWrites();
});

describe('POST /api/secondary/buy — pembeli yang sudah punya lot di paket yang sama', () => {
  it('menerima pembelian dan memindahkan baris lot ke pembeli (200)', async () => {
    // Pembeli sudah memegang baris lain (421–425) pada paket yang sama.
    mocks.prisma.lotOwnership.findFirst.mockResolvedValue({
      id: 'own_buyer_421',
      packageId: 'pkg_1',
      userId: 'buyer_1',
      lotStart: 421,
      lotEnd: 425,
    });

    // Baris penjual yang cocok dengan listing (600–604).
    mocks.tx.lotOwnership.findFirst.mockResolvedValue({
      id: 'own_seller_600',
      packageId: 'pkg_1',
      userId: 'seller_1',
      lotStart: 600,
      lotEnd: 604,
    });

    const res = await buyPOST(buyRequest());

    expect(res.status).toBe(200);

    // Baris yang dipindah harus menjadi milik pembeli.
    expect(mocks.tx.lotOwnership.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.lotOwnership.update).toHaveBeenCalledWith({
      where: { id: 'own_seller_600' },
      data: { userId: 'buyer_1' },
    });

    // Penjualan benar-benar tercatat di transaksi.
    expect(committedFor('secondarySale')).toHaveLength(1);
    expect(committedFor('secondaryListing')).toHaveLength(1);
  });
});

describe('POST /api/secondary/buy — penjual punya beberapa baris lot', () => {
  it('hanya memindahkan baris yang cocok dengan lotStart/lotEnd listing', async () => {
    const sellerRows = [
      { id: 'own_seller_421', packageId: 'pkg_1', userId: 'seller_1', lotStart: 421, lotEnd: 425 },
      { id: 'own_seller_600', packageId: 'pkg_1', userId: 'seller_1', lotStart: 600, lotEnd: 604 },
    ];

    // findFirst meniru DB: tanpa lotStart/lotEnd ia mengembalikan baris pertama
    // (arbitrer) — inilah perilaku lama yang salah.
    mocks.tx.lotOwnership.findFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      return (
        sellerRows.find(
          (r) =>
            r.packageId === where.packageId &&
            r.userId === where.userId &&
            (where.lotStart === undefined || r.lotStart === where.lotStart) &&
            (where.lotEnd === undefined || r.lotEnd === where.lotEnd)
        ) ?? null
      );
    });

    const res = await buyPOST(buyRequest());

    expect(res.status).toBe(200);

    // Pencarian penjual harus menyertakan lotStart/lotEnd listing.
    expect(mocks.tx.lotOwnership.findFirst).toHaveBeenCalledWith({
      where: {
        packageId: 'pkg_1',
        userId: 'seller_1',
        lotStart: 600,
        lotEnd: 604,
      },
    });

    expect(mocks.tx.lotOwnership.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.lotOwnership.update).toHaveBeenCalledWith({
      where: { id: 'own_seller_600' },
      data: { userId: 'buyer_1' },
    });
    expect(mocks.tx.lotOwnership.update).not.toHaveBeenCalledWith({
      where: { id: 'own_seller_421' },
      data: { userId: 'buyer_1' },
    });
  });
});

describe('POST /api/secondary/buy — baris penjual tidak ditemukan', () => {
  it('membatalkan seluruh transaksi dan mengembalikan 500', async () => {
    // Tidak ada baris penjual yang cocok dengan listing.
    mocks.tx.lotOwnership.findFirst.mockResolvedValue(null);

    const res = await buyPOST(buyRequest());

    expect(res.status).toBe(500);

    // Tidak ada penulisan yang keluar dari transaksi.
    expect(committedFor('secondarySale')).toHaveLength(0);
    expect(committedFor('secondaryListing')).toHaveLength(0);
    expect(committed).toHaveLength(0);
  });
});

describe('POST /api/secondary/buy — pembeli sudah memiliki FULL', () => {
  it('tetap menolak dengan 400 "Anda sudah memiliki aset pada paket ini"', async () => {
    mocks.prisma.secondaryListing.findUnique.mockResolvedValue(
      makeListing({ ownershipType: 'FULL', lotStart: null, lotEnd: null })
    );
    mocks.prisma.fullOwnership.findFirst.mockResolvedValue({
      id: 'fo_buyer',
      packageId: 'pkg_1',
      userId: 'buyer_1',
    });

    const res = await buyPOST(buyRequest());

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Anda sudah memiliki aset pada paket ini',
    });

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(committedFor('secondarySale')).toHaveLength(0);
  });
});
