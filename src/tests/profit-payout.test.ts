import type { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as profitPOST } from '@/app/api/admin/profit/route';
import { requireRole } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import {
  distributeAndCredit,
  payoutOrderId,
  splitInvestorShare,
} from '@/lib/profit-payout';

// ---------------------------------------------------------------------------
// Mocks — tx dan prisma berbagi satu objek supaya efek yang ditulis lewat
// callback $transaction terbaca kembali oleh penguji.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const profitDistribution = {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  };
  const packageModel = { findUnique: vi.fn() };
  const lotOwnership = { findMany: vi.fn() };
  const fullOwnership = { findMany: vi.fn() };
  const transaction = { create: vi.fn() };
  const investorBalance = { upsert: vi.fn() };

  const tx = {
    profitDistribution,
    package: packageModel,
    lotOwnership,
    fullOwnership,
    transaction,
    investorBalance,
  };

  const prisma = {
    profitDistribution,
    package: packageModel,
    lotOwnership,
    fullOwnership,
    transaction,
    investorBalance,
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  };

  return { prisma, tx, profitDistribution, transaction, investorBalance };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ requireRole: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }));

const tx = mocks.tx as unknown as Prisma.TransactionClient;

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/profit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Distribusi PENDING dengan dua pemilik lot (a: 100 lot, b: 50 lot). */
function seedSuccessfulDistribution() {
  mocks.profitDistribution.updateMany.mockResolvedValue({ count: 1 });
  mocks.profitDistribution.findUnique.mockResolvedValue({
    id: 'd1',
    packageId: 'pkg_1',
    source: 'MILK',
    grossAmount: 1_000_000,
    raiaShare: 600_000,
    investorShare: 400_000,
    period: '2026-09',
    status: 'DISTRIBUTED',
    note: null,
    distributedAt: new Date(),
    createdAt: new Date(),
  });
  mocks.prisma.package.findUnique.mockResolvedValue({ totalLots: 1000 });
  mocks.prisma.lotOwnership.findMany.mockResolvedValue([
    { userId: 'a', lotStart: 1, lotEnd: 100 },
    { userId: 'b', lotStart: 101, lotEnd: 150 },
  ]);
  mocks.prisma.fullOwnership.findMany.mockResolvedValue([]);
  mocks.transaction.create.mockResolvedValue({ id: 'trx' });
  mocks.investorBalance.upsert.mockResolvedValue({});
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.prisma.$transaction.mockImplementation(
    async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx)
  );
  vi.mocked(requireRole).mockResolvedValue({
    id: 'op_1',
    role: 'OPERATOR',
    username: 'operator',
    kycStatus: 'VERIFIED',
  });
  vi.mocked(createNotification).mockResolvedValue(undefined);

  seedSuccessfulDistribution();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ===========================================================================
// splitInvestorShare
// ===========================================================================

describe('splitInvestorShare', () => {
  it('membagi pro-rata per lot', () => {
    const lines = splitInvestorShare({
      investorShare: 400_000,
      totalLots: 1000,
      lotOwners: [
        { userId: 'a', lotStart: 1, lotEnd: 100 },
        { userId: 'b', lotStart: 101, lotEnd: 150 },
      ],
      fullOwners: [],
    });

    expect(lines).toEqual([
      { userId: 'a', amount: 40_000 },
      { userId: 'b', amount: 20_000 },
    ]);
  });

  it('FULL mengambil 100% investorShare sebagai satu baris', () => {
    const lines = splitInvestorShare({
      investorShare: 400_000,
      totalLots: 1000,
      lotOwners: [{ userId: 'a', lotStart: 1, lotEnd: 100 }],
      fullOwners: [{ userId: 'full_1' }],
    });

    expect(lines).toEqual([{ userId: 'full_1', amount: 400_000 }]);
  });

  it('membuang baris bernilai nol dan totalLots <= 0 menghasilkan array kosong', () => {
    expect(
      splitInvestorShare({
        investorShare: 100,
        totalLots: 1000,
        lotOwners: [{ userId: 'kecil', lotStart: 1, lotEnd: 1 }],
        fullOwners: [],
      })
    ).toEqual([]);

    expect(
      splitInvestorShare({
        investorShare: 400_000,
        totalLots: 0,
        lotOwners: [{ userId: 'a', lotStart: 1, lotEnd: 100 }],
        fullOwners: [],
      })
    ).toEqual([]);
  });

  it('menggabungkan beberapa rentang lot milik pengguna yang sama menjadi satu baris', () => {
    // Pembelian lot menumpuk → beberapa baris LotOwnership untuk satu userId.
    // orderId payout hanya memakai userId, jadi harus digabung agar tidak P2002.
    const lines = splitInvestorShare({
      investorShare: 400_000,
      totalLots: 1000,
      lotOwners: [
        { userId: 'a', lotStart: 1, lotEnd: 100 },
        { userId: 'b', lotStart: 101, lotEnd: 150 },
        { userId: 'a', lotStart: 500, lotEnd: 550 },
      ],
      fullOwners: [],
    });

    expect(lines).toEqual([
      { userId: 'a', amount: 40_000 + 20_400 },
      { userId: 'b', amount: 20_000 },
    ]);

    const orderIds = lines.map((line) => payoutOrderId('d1', line.userId));
    expect(new Set(orderIds).size).toBe(orderIds.length);
  });
});

// ===========================================================================
// payoutOrderId
// ===========================================================================

describe('payoutOrderId', () => {
  it('orderId payout unik', () => {
    expect(payoutOrderId('d1', 'u1')).toBe('PAYOUT-d1-u1');
  });
});

// ===========================================================================
// distributeAndCredit
// ===========================================================================

describe('distributeAndCredit', () => {
  it('mengklaim PENDING lalu mengkredit satu baris per pemilik lot', async () => {
    const credited = await distributeAndCredit(tx, 'd1');

    expect(credited).toBe(true);

    expect(mocks.profitDistribution.updateMany).toHaveBeenCalledWith({
      where: { id: 'd1', status: 'PENDING' },
      data: { status: 'DISTRIBUTED', distributedAt: expect.any(Date) },
    });

    expect(mocks.transaction.create).toHaveBeenCalledTimes(2);
    expect(mocks.transaction.create).toHaveBeenNthCalledWith(1, {
      data: {
        orderId: 'PAYOUT-d1-a',
        userId: 'a',
        packageId: 'pkg_1',
        type: 'PAYOUT',
        status: 'PAID',
        amount: 40_000,
        adminFee: 0,
        paidAt: expect.any(Date),
      },
    });
    expect(mocks.transaction.create).toHaveBeenNthCalledWith(2, {
      data: {
        orderId: 'PAYOUT-d1-b',
        userId: 'b',
        packageId: 'pkg_1',
        type: 'PAYOUT',
        status: 'PAID',
        amount: 20_000,
        adminFee: 0,
        paidAt: expect.any(Date),
      },
    });

    expect(mocks.investorBalance.upsert).toHaveBeenCalledTimes(2);
    expect(mocks.investorBalance.upsert).toHaveBeenNthCalledWith(1, {
      where: { userId: 'a' },
      create: {
        userId: 'a',
        availableBalance: 40_000,
        withdrawnBalance: 0,
        totalEarned: 40_000,
      },
      update: {
        availableBalance: { increment: 40_000 },
        totalEarned: { increment: 40_000 },
      },
    });
    expect(mocks.investorBalance.upsert).toHaveBeenNthCalledWith(2, {
      where: { userId: 'b' },
      create: {
        userId: 'b',
        availableBalance: 20_000,
        withdrawnBalance: 0,
        totalEarned: 20_000,
      },
      update: {
        availableBalance: { increment: 20_000 },
        totalEarned: { increment: 20_000 },
      },
    });
  });

  it('bila klaim ber-guard count 0, mengembalikan false dan tidak mengkredit siapa pun', async () => {
    mocks.profitDistribution.updateMany.mockResolvedValue({ count: 0 });

    const credited = await distributeAndCredit(tx, 'd1');

    expect(credited).toBe(false);
    expect(mocks.profitDistribution.findUnique).not.toHaveBeenCalled();
    expect(mocks.transaction.create).not.toHaveBeenCalled();
    expect(mocks.investorBalance.upsert).not.toHaveBeenCalled();
  });

  it('idempoten: panggilan kedua mengembalikan false tanpa upsert tambahan', async () => {
    mocks.profitDistribution.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    expect(await distributeAndCredit(tx, 'd1')).toBe(true);
    const upsertsAfterFirst = mocks.investorBalance.upsert.mock.calls.length;
    expect(upsertsAfterFirst).toBe(2);

    expect(await distributeAndCredit(tx, 'd1')).toBe(false);
    expect(mocks.investorBalance.upsert.mock.calls.length).toBe(
      upsertsAfterFirst
    );
    expect(mocks.transaction.create).toHaveBeenCalledTimes(2);
  });

  it('P2002 pada transaction.create diteruskan dan tidak ada upsert sesudahnya', async () => {
    const duplicate = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
    });
    mocks.transaction.create.mockRejectedValueOnce(duplicate);

    await expect(distributeAndCredit(tx, 'd1')).rejects.toMatchObject({
      code: 'P2002',
    });

    // Kredit untuk baris yang gagal tidak pernah ditulis; sisa baris juga tidak
    // diproses karena error dibiarkan melempar (rollback oleh $transaction).
    expect(mocks.investorBalance.upsert).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Hook route POST /api/admin/profit
// ===========================================================================

describe('POST /api/admin/profit — aksi distribute', () => {
  it('mengkredit investor di dalam satu $transaction', async () => {
    const res = await profitPOST(
      jsonRequest({ action: 'distribute', id: 'd1' })
    );

    expect(res.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.transaction.create).toHaveBeenCalledTimes(2);
    expect(mocks.investorBalance.upsert).toHaveBeenCalledTimes(2);

    const json = await res.json();
    expect(json.id).toBe('d1');

    // Notifikasi baru dikirim setelah kredit sukses.
    expect(createNotification).toHaveBeenCalledTimes(2);
  });

  it('markPaid juga mengkredit lewat jalur yang sama', async () => {
    const res = await profitPOST(jsonRequest({ action: 'markPaid', id: 'd1' }));

    expect(res.status).toBe(200);
    expect(mocks.transaction.create).toHaveBeenCalledTimes(2);
    expect(mocks.investorBalance.upsert).toHaveBeenCalledTimes(2);
  });

  it('membalas 409 idempoten bila distribusi sudah pernah dibagikan', async () => {
    mocks.profitDistribution.updateMany.mockResolvedValue({ count: 0 });

    const res = await profitPOST(
      jsonRequest({ action: 'distribute', id: 'd1' })
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('Distribusi ini sudah pernah dibagikan');
    expect(mocks.transaction.create).not.toHaveBeenCalled();
    expect(mocks.investorBalance.upsert).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('membalas 404 bila id distribusi tidak ditemukan', async () => {
    mocks.profitDistribution.findUnique.mockResolvedValue(null);

    const res = await profitPOST(
      jsonRequest({ action: 'distribute', id: 'tidak_ada' })
    );

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Distribusi tidak ditemukan');
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.transaction.create).not.toHaveBeenCalled();
    expect(mocks.investorBalance.upsert).not.toHaveBeenCalled();
  });

  it('memetakan P2002 saat kredit ke 409, bukan 500', async () => {
    mocks.transaction.create.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    );

    const res = await profitPOST(
      jsonRequest({ action: 'distribute', id: 'd1' })
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('Distribusi ini sudah pernah dibagikan');
    expect(createNotification).not.toHaveBeenCalled();
  });
});
