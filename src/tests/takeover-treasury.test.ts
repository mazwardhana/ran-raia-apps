import { beforeEach, describe, expect, it, vi } from 'vitest';

import { expireStaleListings } from '@/lib/secondary';

// ---------------------------------------------------------------------------
// Mocks — state in-memory meniru filter `where` Prisma supaya efek perpindahan
// kepemilikan benar-benar terverifikasi: baris penjual pindah ke treasury,
// baris investor lain pada paket yang sama TIDAK boleh ikut pindah (Ruling 17).
// ---------------------------------------------------------------------------

type LotRow = {
  id: string;
  packageId: string;
  userId: string;
  lotStart: number;
  lotEnd: number;
};

type FullRow = {
  id: string;
  packageId: string;
  userId: string;
};

const mocks = vi.hoisted(() => {
  const state = {
    lots: [] as LotRow[],
    fulls: [] as FullRow[],
    listingStatus: 'ACTIVE' as string,
    listingClaimCount: 1 as number,
  };

  const tx = {
    secondaryListing: {
      // Jalur lama yang tak ber-guard; harus TIDAK dipakai lagi (Ruling 18).
      update: vi.fn(async () => ({ id: 'lst_stale' })),
      updateMany: vi.fn(
        async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
          if (
            where.id !== 'lst_stale' ||
            where.status !== 'ACTIVE' ||
            state.listingStatus !== 'ACTIVE' ||
            state.listingClaimCount === 0
          ) {
            return { count: 0 };
          }
          state.listingStatus = String(data.status);
          return { count: 1 };
        }
      ),
    },
    lotOwnership: {
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: { userId: string } }) => {
          let count = 0;
          for (const row of state.lots) {
            const matches =
              (where.packageId === undefined || row.packageId === where.packageId) &&
              (where.userId === undefined || row.userId === where.userId) &&
              (where.lotStart === undefined || row.lotStart === where.lotStart) &&
              (where.lotEnd === undefined || row.lotEnd === where.lotEnd);
            if (matches) {
              row.userId = data.userId;
              count += 1;
            }
          }
          return { count };
        }
      ),
    },
    fullOwnership: {
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: { userId: string } }) => {
          let count = 0;
          for (const row of state.fulls) {
            const matches =
              (where.packageId === undefined || row.packageId === where.packageId) &&
              (where.userId === undefined || row.userId === where.userId);
            if (matches) {
              row.userId = data.userId;
              count += 1;
            }
          }
          return { count };
        }
      ),
    },
    secondarySale: { create: vi.fn(async () => ({ id: 'sale_1' })) },
    transaction: { create: vi.fn(async () => ({ id: 'trx_takeover' })) },
    investorBalance: { upsert: vi.fn(async () => ({})) },
  };

  const prisma = {
    secondaryListing: { findMany: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  };

  return { prisma, tx, state };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/treasury', () => ({
  TREASURY_USERNAME: 'raia_treasury',
  ensureTreasuryUser: vi.fn(async () => ({ id: 'treasury_1' })),
}));

const staleListing = (overrides: Record<string, unknown> = {}) => ({
  id: 'lst_stale',
  sellerId: 'seller_1',
  packageId: 'pkg_1',
  ownershipType: 'LOT',
  lotStart: 1,
  lotEnd: 10,
  listingPrice: 100000,
  status: 'ACTIVE',
  expiresAt: new Date(Date.now() - 1000),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();

  mocks.state.lots = [];
  mocks.state.fulls = [];
  mocks.state.listingStatus = 'ACTIVE';
  mocks.state.listingClaimCount = 1;

  mocks.prisma.$transaction.mockImplementation(
    async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx)
  );
  mocks.tx.secondaryListing.updateMany.mockImplementation(
    async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
      if (
        where.id !== 'lst_stale' ||
        where.status !== 'ACTIVE' ||
        mocks.state.listingStatus !== 'ACTIVE' ||
        mocks.state.listingClaimCount === 0
      ) {
        return { count: 0 };
      }
      mocks.state.listingStatus = String(data.status);
      return { count: 1 };
    }
  );

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ===========================================================================
// LOT — hanya baris penjual yang pindah ke treasury
// ===========================================================================

describe('takeover LOT — aset pindah ke treasury', () => {
  it('baris LotOwnership penjual menjadi milik treasury, penjual tidak lagi memilikinya', async () => {
    mocks.state.lots = [
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'seller_1', lotStart: 1, lotEnd: 10 },
    ];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expireStaleListings();

    expect(mocks.state.lots).toEqual([
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'treasury_1', lotStart: 1, lotEnd: 10 },
    ]);
    expect(mocks.state.lots.some((r) => r.userId === 'seller_1')).toBe(false);
  });

  it('memakai updateMany ber-guard userId penjual + rentang lot', async () => {
    mocks.state.lots = [
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'seller_1', lotStart: 1, lotEnd: 10 },
    ];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expireStaleListings();

    expect(mocks.tx.lotOwnership.updateMany).toHaveBeenCalledWith({
      where: {
        packageId: 'pkg_1',
        userId: 'seller_1',
        lotStart: 1,
        lotEnd: 10,
      },
      data: { userId: 'treasury_1' },
    });
  });
});

// ===========================================================================
// FULL — hanya baris penjual yang pindah ke treasury
// ===========================================================================

describe('takeover FULL — aset pindah ke treasury', () => {
  it('baris FullOwnership penjual menjadi milik treasury', async () => {
    mocks.state.fulls = [
      { id: 'full_seller', packageId: 'pkg_1', userId: 'seller_1' },
    ];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([
      staleListing({ ownershipType: 'FULL', lotStart: null, lotEnd: null }),
    ]);

    await expireStaleListings();

    expect(mocks.state.fulls).toEqual([
      { id: 'full_seller', packageId: 'pkg_1', userId: 'treasury_1' },
    ]);
    expect(mocks.tx.fullOwnership.updateMany).toHaveBeenCalledWith({
      where: { packageId: 'pkg_1', userId: 'seller_1' },
      data: { userId: 'treasury_1' },
    });
  });
});

// ===========================================================================
// Ruling 17 — baris investor lain pada paket yang sama tidak boleh ikut pindah
// ===========================================================================

describe('takeover — hanya baris penjual yang berpindah (Ruling 17)', () => {
  it('kepemilikan investor lain pada paket yang sama tidak tersentuh', async () => {
    mocks.state.lots = [
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'seller_1', lotStart: 1, lotEnd: 10 },
      { id: 'lot_other', packageId: 'pkg_1', userId: 'investor_lain', lotStart: 11, lotEnd: 20 },
    ];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expireStaleListings();

    expect(mocks.state.lots).toEqual([
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'treasury_1', lotStart: 1, lotEnd: 10 },
      { id: 'lot_other', packageId: 'pkg_1', userId: 'investor_lain', lotStart: 11, lotEnd: 20 },
    ]);
  });

  it('FULL: baris investor lain pada paket yang sama tidak tersentuh', async () => {
    mocks.state.fulls = [
      { id: 'full_seller', packageId: 'pkg_1', userId: 'seller_1' },
      { id: 'full_other', packageId: 'pkg_1', userId: 'investor_lain' },
    ];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([
      staleListing({ ownershipType: 'FULL', lotStart: null, lotEnd: null }),
    ]);

    await expireStaleListings();

    expect(mocks.state.fulls).toEqual([
      { id: 'full_seller', packageId: 'pkg_1', userId: 'treasury_1' },
      { id: 'full_other', packageId: 'pkg_1', userId: 'investor_lain' },
    ]);
  });
});

// ===========================================================================
// Perilaku lama tetap: penjual dikredit 100%, sale SYSTEM, transaksi TAKEOVER
// ===========================================================================

describe('takeover — kredit penjual 100% tetap dipertahankan', () => {
  it('mencatat sale SYSTEM tanpa fee dan transaksi TAKEOVER PAID sebesar par', async () => {
    mocks.state.lots = [
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'seller_1', lotStart: 1, lotEnd: 10 },
    ];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expireStaleListings();

    expect(mocks.tx.secondarySale.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        listingId: 'lst_stale',
        buyerId: 'SYSTEM',
        adminFee: 0,
        finalPrice: 100000,
      }),
    });
    expect(mocks.tx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'seller_1',
        packageId: 'pkg_1',
        type: 'TAKEOVER',
        status: 'PAID',
        amount: 100000,
        adminFee: 0,
      }),
    });
  });

  it('mengkredit penjual 100% par tanpa potongan', async () => {
    mocks.state.lots = [
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'seller_1', lotStart: 1, lotEnd: 10 },
    ];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expireStaleListings();

    expect(mocks.tx.investorBalance.upsert).toHaveBeenCalledWith({
      where: { userId: 'seller_1' },
      create: expect.objectContaining({
        userId: 'seller_1',
        availableBalance: 100000,
        totalEarned: 100000,
      }),
      update: expect.objectContaining({
        availableBalance: { increment: 100000 },
        totalEarned: { increment: 100000 },
      }),
    });
  });
});

// ===========================================================================
// Ruling 18 — klaim listing ber-guard; count 0 melewati takeover
// ===========================================================================

describe('takeover — klaim listing ber-guard (Ruling 18)', () => {
  it('transisi ACTIVE→TAKEOVER memakai updateMany ber-guard status ACTIVE', async () => {
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expireStaleListings();

    expect(mocks.tx.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_stale', status: 'ACTIVE' },
      data: { status: 'TAKEOVER', takeoverByRaia: true },
    });
    expect(mocks.tx.secondaryListing.update).not.toHaveBeenCalled();
  });

  it('klaim listing dilakukan sebelum memindahkan aset', async () => {
    mocks.state.lots = [
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'seller_1', lotStart: 1, lotEnd: 10 },
    ];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expireStaleListings();

    const claimOrder =
      mocks.tx.secondaryListing.updateMany.mock.invocationCallOrder[0];
    const moveOrder = mocks.tx.lotOwnership.updateMany.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(moveOrder);
  });

  it('count 0 melewati takeover: aset, sale, transaksi, dan kredit tidak disentuh', async () => {
    mocks.state.lots = [
      { id: 'lot_seller', packageId: 'pkg_1', userId: 'seller_1', lotStart: 1, lotEnd: 10 },
    ];
    mocks.state.listingClaimCount = 0;
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expireStaleListings();

    expect(mocks.state.lots[0].userId).toBe('seller_1');
    expect(mocks.tx.lotOwnership.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.secondarySale.create).not.toHaveBeenCalled();
    expect(mocks.tx.transaction.create).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Baris kepemilikan penjual tidak ada — jangan bayar tanpa aset berpindah
// ===========================================================================

describe('takeover — baris penjual tidak ditemukan', () => {
  it('LOT: rollback, penjual tidak dikredit bila tidak ada baris lot yang cocok', async () => {
    mocks.state.lots = [];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([staleListing()]);

    await expect(expireStaleListings()).resolves.toBeUndefined();

    expect(mocks.tx.lotOwnership.updateMany).toHaveBeenCalled();
    expect(mocks.tx.secondarySale.create).not.toHaveBeenCalled();
    expect(mocks.tx.transaction.create).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
  });

  it('FULL: rollback, penjual tidak dikredit bila tidak ada baris full yang cocok', async () => {
    mocks.state.fulls = [];
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([
      staleListing({ ownershipType: 'FULL', lotStart: null, lotEnd: null }),
    ]);

    await expect(expireStaleListings()).resolves.toBeUndefined();

    expect(mocks.tx.fullOwnership.updateMany).toHaveBeenCalled();
    expect(mocks.tx.secondarySale.create).not.toHaveBeenCalled();
    expect(mocks.tx.transaction.create).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
  });
});
