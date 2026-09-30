import { beforeEach, describe, expect, it, vi } from 'vitest';

import { expireStaleListings, expireStalePendingPayments } from '@/lib/secondary';
import { expireStaleTransactions } from '@/lib/reservations';
import { releaseSecondaryPending } from '@/lib/secondary-settlement';

// ---------------------------------------------------------------------------
// Mocks — prisma dan tx berbagi satu objek supaya efek yang ditulis lewat
// `$transaction` terbaca kembali oleh penguji. `releaseSecondaryPending`
// di-mock agar sapuan secondary bisa diperiksa tanpa menyentuh DB nyata.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const tx = {
    secondaryListing: { update: vi.fn(), updateMany: vi.fn() },
    secondarySale: { create: vi.fn() },
    transaction: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    investorBalance: { upsert: vi.fn() },
  };

  const prisma = {
    secondaryListing: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    secondarySale: { create: vi.fn() },
    transaction: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    investorBalance: { upsert: vi.fn() },
    package: { update: vi.fn() },
    lotOwnership: { deleteMany: vi.fn() },
    fullOwnership: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  };

  return { prisma, tx };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/secondary-settlement', () => ({
  releaseSecondaryPending: vi.fn(),
}));

const staleListing = (overrides: Record<string, unknown> = {}) => ({
  id: 'lst_stale',
  sellerId: 'seller_1',
  packageId: 'pkg_1',
  listingPrice: 100000,
  status: 'ACTIVE',
  expiresAt: new Date(Date.now() - 1000),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma.$transaction.mockImplementation(
    async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx)
  );
  mocks.tx.secondaryListing.update.mockResolvedValue({});
  mocks.tx.secondarySale.create.mockResolvedValue({ id: 'sale_1' });
  mocks.tx.transaction.create.mockResolvedValue({ id: 'trx_takeover' });
  mocks.tx.investorBalance.upsert.mockResolvedValue({});
  vi.mocked(releaseSecondaryPending).mockResolvedValue(undefined);

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ===========================================================================
// expireStaleListings — hanya menyapu ACTIVE
// ===========================================================================

describe('expireStaleListings — hanya menyapu listing ACTIVE', () => {
  it('kuerinya menyaring status ACTIVE (mekanisme sebenarnya)', async () => {
    mocks.prisma.secondaryListing.findMany.mockResolvedValue([]);

    await expireStaleListings();

    expect(mocks.prisma.secondaryListing.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: expect.any(Date) },
      },
    });
  });

  it('mengambil-alih listing ACTIVE kedaluwarsa dan melewati PENDING_PAYMENT', async () => {
    // Emulasi filter `where` Prisma: baris PENDING_PAYMENT tidak pernah
    // kembali dari kueri, sehingga sapuan tidak boleh menyentuhnya.
    const all = [
      staleListing({ id: 'stale', status: 'ACTIVE' }),
      staleListing({ id: 'paying', status: 'PENDING_PAYMENT' }),
    ];
    mocks.prisma.secondaryListing.findMany.mockImplementation(
      async ({ where }: { where: { status: string; expiresAt: { lt: Date } } }) =>
        all.filter(
          (l) =>
            l.status === where.status &&
            l.expiresAt.getTime() < where.expiresAt.lt.getTime()
        )
    );

    await expireStaleListings();

    const takenOver = mocks.tx.secondaryListing.update.mock.calls.map(
      (call) => (call[0] as { where: { id: string } }).where.id
    );
    expect(takenOver).toContain('stale');
    expect(takenOver).not.toContain('paying');
  });
});

// ===========================================================================
// expireStalePendingPayments — sapuan pembelian secondary kedaluwarsa
// ===========================================================================

describe('expireStalePendingPayments', () => {
  it('menyapu transaksi SECONDARY_BUY PENDING yang lewat jatuh tempo', async () => {
    mocks.prisma.transaction.findMany.mockResolvedValue([{ id: 'trx_stale' }]);

    await expireStalePendingPayments();

    expect(mocks.prisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        type: 'SECONDARY_BUY',
        status: 'PENDING',
        expiredAt: { lt: expect.any(Date) },
      },
      select: { id: true },
    });
    expect(releaseSecondaryPending).toHaveBeenCalledWith(
      expect.anything(),
      'trx_stale',
      'EXPIRED'
    );
  });

  it('satu baris gagal tidak menghentikan sisanya', async () => {
    mocks.prisma.transaction.findMany.mockResolvedValue([
      { id: 'trx_bad' },
      { id: 'trx_good' },
    ]);
    vi.mocked(releaseSecondaryPending)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);

    await expect(expireStalePendingPayments()).resolves.toBeUndefined();

    expect(releaseSecondaryPending).toHaveBeenCalledTimes(2);
    expect(releaseSecondaryPending).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'trx_bad',
      'EXPIRED'
    );
    expect(releaseSecondaryPending).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'trx_good',
      'EXPIRED'
    );
  });

  it('tidak melempar bila kueri gagal', async () => {
    mocks.prisma.transaction.findMany.mockRejectedValue(new Error('db down'));

    await expect(expireStalePendingPayments()).resolves.toBeUndefined();
  });
});

// ===========================================================================
// expireStaleTransactions — harus melewati SECONDARY_BUY
// ===========================================================================

describe('expireStaleTransactions — melewati SECONDARY_BUY', () => {
  it('kuerinya mengecualikan transaksi SECONDARY_BUY', async () => {
    mocks.prisma.transaction.findMany.mockResolvedValue([]);

    await expireStaleTransactions();

    expect(mocks.prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PENDING',
          type: { not: 'SECONDARY_BUY' },
        }),
      })
    );
  });
});
