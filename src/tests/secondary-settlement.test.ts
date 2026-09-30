import type { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as callbackPOST } from '@/app/api/payments/midtrans/callback/route';
import { verifySignature } from '@/lib/midtrans';
import { releaseReservation } from '@/lib/reservations';
import {
  completeSecondaryPurchase,
  releaseSecondaryPending,
} from '@/lib/secondary-settlement';

// ---------------------------------------------------------------------------
// Mocks — tx dan prisma berbagi satu objek supaya efek yang ditulis lewat
// callback terbaca kembali oleh penguji. `releaseReservation` di-mock agar
// penguji bisa membedakan jalur primary vs secondary.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const tx = {
    transaction: { findUnique: vi.fn(), updateMany: vi.fn() },
    secondaryListing: { updateMany: vi.fn() },
    lotOwnership: { findFirst: vi.fn(), update: vi.fn() },
    fullOwnership: { findFirst: vi.fn(), update: vi.fn() },
    secondarySale: { create: vi.fn() },
    investorBalance: { upsert: vi.fn() },
  };

  const prisma = {
    transaction: { findFirst: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  };

  return { prisma, tx };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/midtrans', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/midtrans')>();
  return { ...actual, verifySignature: vi.fn() };
});
vi.mock('@/lib/reservations', () => ({ releaseReservation: vi.fn() }));

const tx = mocks.tx as unknown as Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lst_1',
    sellerId: 'seller_1',
    packageId: 'pkg_1',
    ownershipType: 'LOT',
    lotStart: 426,
    lotEnd: 430,
    listingPrice: 100000,
    status: 'PENDING_PAYMENT',
    ...overrides,
  };
}

/** Transaksi PENDING SECONDARY_BUY; `userId` adalah PEMBELI. */
function pendingSecondaryTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trx_1',
    orderId: 'SEC-1',
    midtransOrderId: 'MID-SEC-1',
    userId: 'buyer_1',
    packageId: 'pkg_1',
    type: 'SECONDARY_BUY',
    status: 'PENDING',
    amount: 100000,
    adminFee: 5000,
    secondaryListingId: 'lst_1',
    secondaryListing: makeListing(),
    ...overrides,
  };
}

function callbackRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/payments/midtrans/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();

  mocks.prisma.$transaction.mockImplementation(
    async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx)
  );
  vi.mocked(verifySignature).mockReturnValue(true);

  mocks.tx.transaction.findUnique.mockResolvedValue(
    pendingSecondaryTransaction()
  );
  mocks.tx.transaction.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.lotOwnership.findFirst.mockResolvedValue({ id: 'own_seller_426' });
  mocks.tx.lotOwnership.update.mockResolvedValue({});
  mocks.tx.fullOwnership.findFirst.mockResolvedValue({ id: 'fo_seller' });
  mocks.tx.fullOwnership.update.mockResolvedValue({});
  mocks.tx.secondarySale.create.mockResolvedValue({ id: 'sale_1' });
  mocks.tx.secondaryListing.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.investorBalance.upsert.mockResolvedValue({});

  mocks.prisma.transaction.findFirst.mockResolvedValue(
    pendingSecondaryTransaction()
  );

  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ===========================================================================
// completeSecondaryPurchase
// ===========================================================================

describe('completeSecondaryPurchase', () => {
  it('memindahkan baris lot yang cocok rentang dan mengkredit penjual', async () => {
    await completeSecondaryPurchase(tx, 'trx_1');

    expect(mocks.tx.transaction.findUnique).toHaveBeenCalledWith({
      where: { id: 'trx_1' },
      include: { secondaryListing: true },
    });

    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: expect.any(Date),
        paymentChannel: null,
      },
    });

    expect(mocks.tx.lotOwnership.findFirst).toHaveBeenCalledWith({
      where: {
        packageId: 'pkg_1',
        userId: 'seller_1',
        lotStart: 426,
        lotEnd: 430,
      },
    });
    expect(mocks.tx.lotOwnership.update).toHaveBeenCalledWith({
      where: { id: 'own_seller_426' },
      data: { userId: 'buyer_1' },
    });

    expect(mocks.tx.secondarySale.create).toHaveBeenCalledWith({
      data: {
        listingId: 'lst_1',
        buyerId: 'buyer_1',
        adminFee: 5000,
        finalPrice: 100000,
      },
    });

    expect(mocks.tx.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_1', status: 'PENDING_PAYMENT' },
      data: { status: 'SOLD', soldAt: expect.any(Date) },
    });

    expect(mocks.tx.investorBalance.upsert).toHaveBeenCalledWith({
      where: { userId: 'seller_1' },
      create: {
        userId: 'seller_1',
        availableBalance: 95000,
        withdrawnBalance: 0,
        totalEarned: 95000,
      },
      update: {
        availableBalance: { increment: 95000 },
        totalEarned: { increment: 95000 },
      },
    });
  });

  it('mencatat paymentChannel yang diberikan', async () => {
    await completeSecondaryPurchase(tx, 'trx_1', 'bank_transfer');

    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: expect.any(Date),
        paymentChannel: 'bank_transfer',
      },
    });
  });

  it('melempar bila transaksi tidak punya listing secondary', async () => {
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingSecondaryTransaction({
        secondaryListing: null,
        secondaryListingId: null,
      })
    );

    await expect(completeSecondaryPurchase(tx, 'trx_1')).rejects.toThrow();

    expect(mocks.tx.transaction.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.secondarySale.create).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
  });

  it('melempar dan tidak menyelesaikan penjualan bila baris lot penjual tidak ada', async () => {
    mocks.tx.lotOwnership.findFirst.mockResolvedValue(null);

    await expect(completeSecondaryPurchase(tx, 'trx_1')).rejects.toThrow();

    expect(mocks.tx.lotOwnership.update).not.toHaveBeenCalled();
    expect(mocks.tx.secondarySale.create).not.toHaveBeenCalled();
    expect(mocks.tx.secondaryListing.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
  });

  it('memindahkan kepemilikan FULL penjual ke pembeli', async () => {
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingSecondaryTransaction({
        secondaryListing: makeListing({
          ownershipType: 'FULL',
          lotStart: null,
          lotEnd: null,
        }),
      })
    );

    await completeSecondaryPurchase(tx, 'trx_1');

    expect(mocks.tx.fullOwnership.findFirst).toHaveBeenCalledWith({
      where: { packageId: 'pkg_1', userId: 'seller_1' },
    });
    expect(mocks.tx.fullOwnership.update).toHaveBeenCalledWith({
      where: { id: 'fo_seller' },
      data: { userId: 'buyer_1' },
    });
    expect(mocks.tx.lotOwnership.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).toHaveBeenCalled();
  });

  it('melempar bila baris kepemilikan FULL penjual tidak ditemukan', async () => {
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingSecondaryTransaction({
        secondaryListing: makeListing({
          ownershipType: 'FULL',
          lotStart: null,
          lotEnd: null,
        }),
      })
    );
    mocks.tx.fullOwnership.findFirst.mockResolvedValue(null);

    await expect(completeSecondaryPurchase(tx, 'trx_1')).rejects.toThrow();

    expect(mocks.tx.fullOwnership.update).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
  });

  it('idempoten: bila klaim ber-guard count 0, tidak menyentuh aset maupun saldo', async () => {
    mocks.tx.transaction.updateMany.mockResolvedValue({ count: 0 });

    await completeSecondaryPurchase(tx, 'trx_1');

    expect(mocks.tx.lotOwnership.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.lotOwnership.update).not.toHaveBeenCalled();
    expect(mocks.tx.fullOwnership.findFirst).not.toHaveBeenCalled();
    expect(mocks.tx.fullOwnership.update).not.toHaveBeenCalled();
    expect(mocks.tx.secondarySale.create).not.toHaveBeenCalled();
    expect(mocks.tx.secondaryListing.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// releaseSecondaryPending
// ===========================================================================

describe('releaseSecondaryPending', () => {
  it('mengembalikan listing ke ACTIVE dan membatalkan transaksi tanpa menyentuh kepemilikan', async () => {
    await releaseSecondaryPending(tx, 'trx_1');

    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: { status: 'CANCELLED', secondaryListingId: null },
    });
    expect(mocks.tx.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_1', status: 'PENDING_PAYMENT' },
      data: { status: 'ACTIVE' },
    });

    expect(mocks.tx.lotOwnership.update).not.toHaveBeenCalled();
    expect(mocks.tx.fullOwnership.update).not.toHaveBeenCalled();
    expect(mocks.tx.secondarySale.create).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
  });

  it('menghormati finalStatus EXPIRED', async () => {
    await releaseSecondaryPending(tx, 'trx_1', 'EXPIRED');

    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: { status: 'EXPIRED', secondaryListingId: null },
    });
    expect(mocks.tx.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_1', status: 'PENDING_PAYMENT' },
      data: { status: 'ACTIVE' },
    });
  });

  it('idempoten: klaim count 0 berhenti tanpa mengubah listing', async () => {
    mocks.tx.transaction.updateMany.mockResolvedValue({ count: 0 });

    await releaseSecondaryPending(tx, 'trx_1');

    expect(mocks.tx.secondaryListing.updateMany).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Callback integration
// ===========================================================================

describe('POST /api/payments/midtrans/callback — settlement secondary', () => {
  it('settlement pada SECONDARY_BUY menyelesaikan pembelian (aset pindah + penjual dikredit)', async () => {
    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-SEC-1',
        status_code: '200',
        gross_amount: '100000.00',
        signature_key: 'sig',
        transaction_status: 'settlement',
        fraud_status: 'accept',
        payment_type: 'bank_transfer',
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.tx.lotOwnership.update).toHaveBeenCalledWith({
      where: { id: 'own_seller_426' },
      data: { userId: 'buyer_1' },
    });
    expect(mocks.tx.secondarySale.create).toHaveBeenCalled();
    expect(mocks.tx.investorBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'seller_1' } })
    );
    expect(mocks.tx.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_1', status: 'PENDING_PAYMENT' },
      data: { status: 'SOLD', soldAt: expect.any(Date) },
    });
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: {
        status: 'PAID',
        paidAt: expect.any(Date),
        paymentChannel: 'bank_transfer',
      },
    });
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it('capture (fraud accept) pada SECONDARY_BUY juga menyelesaikan pembelian', async () => {
    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-SEC-1',
        status_code: '200',
        gross_amount: '100000.00',
        signature_key: 'sig',
        transaction_status: 'capture',
        fraud_status: 'accept',
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.tx.secondarySale.create).toHaveBeenCalled();
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it('deny pada SECONDARY_BUY mengembalikan listing ACTIVE lewat releaseSecondaryPending', async () => {
    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-SEC-1',
        status_code: '200',
        gross_amount: '100000.00',
        signature_key: 'sig',
        transaction_status: 'deny',
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: { status: 'CANCELLED', secondaryListingId: null },
    });
    expect(mocks.tx.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_1', status: 'PENDING_PAYMENT' },
      data: { status: 'ACTIVE' },
    });
    expect(releaseReservation).not.toHaveBeenCalled();
    expect(mocks.tx.lotOwnership.update).not.toHaveBeenCalled();
  });

  it('cancel pada SECONDARY_BUY memakai releaseSecondaryPending(CANCELLED)', async () => {
    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-SEC-1',
        status_code: '200',
        gross_amount: '100000.00',
        signature_key: 'sig',
        transaction_status: 'cancel',
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: { status: 'CANCELLED', secondaryListingId: null },
    });
    expect(releaseReservation).not.toHaveBeenCalled();
  });

  it('expire pada SECONDARY_BUY memakai releaseSecondaryPending(EXPIRED)', async () => {
    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-SEC-1',
        status_code: '200',
        gross_amount: '100000.00',
        signature_key: 'sig',
        transaction_status: 'expire',
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: { status: 'EXPIRED', secondaryListingId: null },
    });
    expect(mocks.tx.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_1', status: 'PENDING_PAYMENT' },
      data: { status: 'ACTIVE' },
    });
    expect(releaseReservation).not.toHaveBeenCalled();
  });
});

describe('POST /api/payments/midtrans/callback — non-secondary tetap primary', () => {
  beforeEach(() => {
    mocks.prisma.transaction.findFirst.mockResolvedValue({
      id: 'trx_p',
      orderId: 'MID-P-1',
      midtransOrderId: 'MID-P-1',
      userId: 'buyer_1',
      packageId: 'pkg_1',
      type: 'BUY',
      status: 'PENDING',
      amount: 50000,
      adminFee: 0,
      secondaryListingId: null,
      lotCount: 5,
    });
  });

  it('expire pada transaksi non-secondary tetap memakai releaseReservation', async () => {
    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-P-1',
        status_code: '200',
        gross_amount: '50000.00',
        signature_key: 'sig',
        transaction_status: 'expire',
      })
    );

    expect(res.status).toBe(200);
    expect(releaseReservation).toHaveBeenCalledWith(tx, 'trx_p', 'EXPIRED');
    expect(mocks.tx.secondaryListing.updateMany).not.toHaveBeenCalled();
  });

  it('cancel pada transaksi non-secondary tetap memakai releaseReservation', async () => {
    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-P-1',
        status_code: '200',
        gross_amount: '50000.00',
        signature_key: 'sig',
        transaction_status: 'cancel',
      })
    );

    expect(res.status).toBe(200);
    expect(releaseReservation).toHaveBeenCalledWith(tx, 'trx_p', 'CANCELLED');
    expect(mocks.tx.secondaryListing.updateMany).not.toHaveBeenCalled();
  });
});
