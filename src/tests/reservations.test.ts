import type { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as checkoutPOST } from '@/app/api/checkout/route';
import { POST as callbackPOST } from '@/app/api/payments/midtrans/callback/route';
import { POST as simulatePOST } from '@/app/api/payments/simulate/route';
import { getCurrentUser, type CurrentUser } from '@/lib/auth';
import { createSnapToken, verifySignature } from '@/lib/midtrans';
import {
  calcLotRange,
  expireStaleTransactions,
  releaseReservation,
} from '@/lib/reservations';

// ---------------------------------------------------------------------------
// Mocks — pola sama dengan src/tests/checkout.test.ts + profit-settings.test.ts
// (tx dan prisma berbagi satu objek supaya perubahan status yang dibuat lewat
// jalur route terbaca kembali oleh pembaca berikutnya.)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const tx = {
    transaction: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    package: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    lotOwnership: { create: vi.fn(), deleteMany: vi.fn() },
    fullOwnership: { create: vi.fn(), deleteMany: vi.fn() },
    investorBalance: { upsert: vi.fn() },
  };

  const prisma = {
    transaction: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    package: tx.package,
    lotOwnership: tx.lotOwnership,
    fullOwnership: tx.fullOwnership,
    investorBalance: tx.investorBalance,
    setting: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  };

  return { prisma, tx };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/midtrans', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/midtrans')>();
  return {
    ...actual,
    createSnapToken: vi.fn(),
    verifySignature: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const pkg = {
  id: 'pkg_1',
  code: 'PKT-001',
  title: 'Paket Kambing Etawa Sleman',
  price: 100000000,
  lotPrice: 10000,
  totalLots: 100,
  soldLots: 10,
  status: 'OPEN',
};

const user: CurrentUser = {
  id: 'usr_1',
  role: 'INVESTOR',
  username: 'budi',
  kycStatus: 'VERIFIED',
};

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function checkoutRequest(body: unknown): NextRequest {
  return jsonRequest('http://localhost/api/checkout', body);
}

function callbackRequest(body: Record<string, unknown>): NextRequest {
  return jsonRequest(
    'http://localhost/api/payments/midtrans/callback',
    body
  );
}

function simulateRequest(body: unknown): NextRequest {
  return jsonRequest('http://localhost/api/payments/simulate', body);
}

/**
 * Pasang `soldLots` pada paket yang benar-benar berubah saat inkrement/dekrement
 * terjadi, supaya tes bisa mengklaim "kembali ke nilai semula" berdasarkan state
 * nyata, bukan sekadar argumen pemanggilan.
 */
function installStatefulPackage(initialSoldLots: number) {
  const state = { soldLots: initialSoldLots };

  mocks.prisma.package.findUnique.mockResolvedValue({
    ...pkg,
    soldLots: initialSoldLots,
  });

  mocks.tx.package.updateMany.mockImplementation(
    async ({ data }: { data: { soldLots: { increment: number } } }) => {
      state.soldLots += data.soldLots.increment;
      return { count: 1 };
    }
  );

  mocks.tx.package.update.mockImplementation(
    async ({ data }: { data: { soldLots: { decrement: number } } }) => {
      state.soldLots -= data.soldLots.decrement;
      return {};
    }
  );

  return state;
}

/** Transaksi PENDING milik pembeli LOT, siap dilepas oleh releaseReservation. */
function pendingLotTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trx_1',
    orderId: 'TRX-1',
    userId: 'usr_1',
    packageId: 'pkg_1',
    type: 'BUY',
    status: 'PENDING',
    lotCount: 5,
    package: { totalLots: 100 },
    lotOwnership: { id: 'lo_1' },
    fullOwnership: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.prisma.$transaction.mockImplementation(
    async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx)
  );
  vi.mocked(getCurrentUser).mockResolvedValue(user);
  vi.mocked(verifySignature).mockReturnValue(true);
  mocks.prisma.setting.findUnique.mockResolvedValue(null);
  // Email pembeli yang dibaca route checkout untuk customer_details Midtrans.
  mocks.prisma.user.findUnique.mockResolvedValue({
    email: 'budi@example.com',
  });
  mocks.prisma.transaction.findMany.mockResolvedValue([]);
  // Gerbang atomik: jalur normal selalu menemukan baris berstatus PENDING.
  mocks.tx.transaction.updateMany.mockResolvedValue({ count: 1 });
  delete process.env.MIDTRANS_MODE;
  // Banyak kasus ini sengaja memicu jalur galat; jaga agar keluaran tes bersih.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 5. Rumus nomor lot — fungsi murni yang diekstrak dari dalam route
// ---------------------------------------------------------------------------

describe('calcLotRange — rumus nomor lot', () => {
  it('rentang yang baru dikuasai: soldLots 10, beli 5 → [11, 15]', () => {
    expect(calcLotRange(10, 5)).toEqual({ lotStart: 11, lotEnd: 15 });
  });

  it('paket kosong: soldLots 0, beli 5 → [1, 5]', () => {
    expect(calcLotRange(0, 5)).toEqual({ lotStart: 1, lotEnd: 5 });
  });
});

// ---------------------------------------------------------------------------
// 1. Kebocoran slot saat token Midtrans gagal dibuat
// ---------------------------------------------------------------------------

describe('POST /api/checkout — kebocoran slot saat createSnapToken gagal', () => {
  it('mengembalikan slot, membatalkan pesanan, dan menghapus kepemilikan', async () => {
    const state = installStatefulPackage(10);

    mocks.tx.transaction.create.mockResolvedValue({
      id: 'trx_1',
      orderId: 'TRX-1',
    });
    vi.mocked(createSnapToken).mockRejectedValue(new Error('Midtrans error'));
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingLotTransaction()
    );

    const res = await checkoutPOST(
      checkoutRequest({
        packageId: 'pkg_1',
        ownershipType: 'LOT',
        lotCount: 5,
      })
    );

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    expect(createSnapToken).toHaveBeenCalledTimes(1);

    // slot kembali persis ke nilai semula
    expect(state.soldLots).toBe(10);
    expect(mocks.tx.package.update).toHaveBeenCalledWith({
      where: { id: 'pkg_1' },
      data: { soldLots: { decrement: 5 } },
    });

    // status transaksi menjadi CANCELLED lewat gerbang atomik
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    // baris kepemilikan milik pesanan dihapus
    expect(mocks.tx.lotOwnership.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'trx_1' },
    });
    expect(mocks.tx.fullOwnership.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'trx_1' },
    });
  });

  it('melepas reservasi FULL dengan totalLots paket (lotCount null)', async () => {
    mocks.prisma.package.findUnique.mockResolvedValue({ ...pkg, soldLots: 0 });
    mocks.tx.package.updateMany.mockImplementation(async () => {
      return { count: 1 };
    });
    mocks.tx.transaction.create.mockResolvedValue({
      id: 'trx_f',
      orderId: 'TRX-F',
    });
    vi.mocked(createSnapToken).mockRejectedValue(new Error('Midtrans error'));
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingLotTransaction({
        id: 'trx_f',
        orderId: 'TRX-F',
        lotCount: null,
        lotOwnership: null,
        fullOwnership: { id: 'fo_1' },
      })
    );
    const updateSpy = mocks.tx.package.update;
    updateSpy.mockImplementation(async () => ({}));

    const res = await checkoutPOST(
      checkoutRequest({ packageId: 'pkg_1', ownershipType: 'FULL' })
    );

    expect(res.status).toBe(502);
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'pkg_1' },
      data: { soldLots: { decrement: 100 } },
    });
    expect(mocks.tx.fullOwnership.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'trx_f' },
    });
  });
});

// ---------------------------------------------------------------------------
// 2. releaseReservation idempoten
// ---------------------------------------------------------------------------

describe('releaseReservation', () => {
  it('dipanggil dua kali hanya menurunkan soldLots satu kali', async () => {
    const state = { status: 'PENDING', soldLots: 10 };

    mocks.tx.transaction.findUnique.mockImplementation(async () =>
      pendingLotTransaction({ status: state.status })
    );
    mocks.tx.package.update.mockImplementation(
      async ({ data }: { data: { soldLots: { decrement: number } } }) => {
        state.soldLots -= data.soldLots.decrement;
        return {};
      }
    );
    mocks.tx.transaction.updateMany.mockImplementation(
      async ({ data }: { data: { status: string } }) => {
        state.status = data.status;
        return { count: 1 };
      }
    );

    await releaseReservation(mocks.tx as unknown as Prisma.TransactionClient, 'trx_1');
    await releaseReservation(mocks.tx as unknown as Prisma.TransactionClient, 'trx_1');

    expect(mocks.tx.package.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.lotOwnership.deleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledTimes(1);
    expect(state.soldLots).toBe(5);
    expect(state.status).toBe('CANCELLED');
  });

  it('tidak menyentuh pesanan yang sudah PAID', async () => {
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingLotTransaction({ status: 'PAID', lotCount: null })
    );

    await releaseReservation(mocks.tx as unknown as Prisma.TransactionClient, 'trx_1');

    expect(mocks.tx.package.update).not.toHaveBeenCalled();
    expect(mocks.tx.lotOwnership.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('gerbang atomik: bila updateMany tidak menemukan baris PENDING, tidak ada yang dilepas', async () => {
    // findUnique sengaja masih melihat PENDING (baca basi), tetapi gerbang
    // atomik menemukan 0 baris karena pembalap sudah menyetel statusnya.
    mocks.tx.transaction.findUnique.mockResolvedValue(pendingLotTransaction());
    mocks.tx.transaction.updateMany.mockResolvedValue({ count: 0 });

    await releaseReservation(mocks.tx as unknown as Prisma.TransactionClient, 'trx_1');

    expect(mocks.tx.package.update).not.toHaveBeenCalled();
    expect(mocks.tx.lotOwnership.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.fullOwnership.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_1', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Callback Midtrans: expire melepas slot, bukan hanya status
// ---------------------------------------------------------------------------

describe('POST /api/payments/midtrans/callback', () => {
  it('expire menurunkan soldLots dan menghapus baris kepemilikan', async () => {
    const state = installStatefulPackage(10);

    mocks.prisma.transaction.findFirst.mockResolvedValue({
      id: 'trx_2',
      orderId: 'TRX-2',
      midtransOrderId: 'MID-TRX-2',
      userId: 'usr_1',
      status: 'PENDING',
      lotCount: 5,
      package: { totalLots: 100 },
      lotOwnership: { id: 'lo_2' },
      fullOwnership: null,
    });
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingLotTransaction({
        id: 'trx_2',
        orderId: 'TRX-2',
        lotOwnership: { id: 'lo_2' },
      })
    );

    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-TRX-2',
        status_code: '200',
        gross_amount: '50000.00',
        signature_key: 'sig',
        transaction_status: 'expire',
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('expired');

    expect(state.soldLots).toBe(5);
    expect(mocks.tx.package.update).toHaveBeenCalledWith({
      where: { id: 'pkg_1' },
      data: { soldLots: { decrement: 5 } },
    });
    expect(mocks.tx.lotOwnership.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'trx_2' },
    });
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_2', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
  });

  it('cancel menurunkan soldLots dan menghapus baris kepemilikan', async () => {
    const state = installStatefulPackage(10);

    mocks.prisma.transaction.findFirst.mockResolvedValue({
      id: 'trx_3',
      orderId: 'TRX-3',
      midtransOrderId: 'MID-TRX-3',
      userId: 'usr_1',
      status: 'PENDING',
      lotCount: 5,
      package: { totalLots: 100 },
      lotOwnership: { id: 'lo_3' },
      fullOwnership: null,
    });
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingLotTransaction({
        id: 'trx_3',
        orderId: 'TRX-3',
        lotOwnership: { id: 'lo_3' },
      })
    );

    const res = await callbackPOST(
      callbackRequest({
        order_id: 'MID-TRX-3',
        status_code: '200',
        gross_amount: '50000.00',
        signature_key: 'sig',
        transaction_status: 'cancel',
      })
    );

    expect(res.status).toBe(200);
    expect(state.soldLots).toBe(5);
    expect(mocks.tx.lotOwnership.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'trx_3' },
    });
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_3', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Penyapu pesanan kedaluwarsa
// ---------------------------------------------------------------------------

describe('expireStaleTransactions', () => {
  it('melepas PENDING yang lewat jatuh tempo, tanpa menyentuh PAID atau belum jatuh tempo', async () => {
    const now = Date.now();
    const all = [
      {
        ...pendingLotTransaction({ id: 'stale_pending' }),
        expiredAt: new Date(now - 1000),
      },
      {
        ...pendingLotTransaction({ id: 'pending_not_due' }),
        expiredAt: new Date(now + 60 * 60 * 1000),
      },
      {
        ...pendingLotTransaction({ id: 'paid' }),
        status: 'PAID',
        expiredAt: new Date(now - 1000),
      },
    ];

    mocks.prisma.transaction.findMany.mockImplementation(
      async ({
        where,
      }: {
        where: {
          status: string;
          type?: { not: string };
          expiredAt: { lt: Date };
        };
      }) =>
        all.filter(
          (t) =>
            t.status === where.status &&
            (!where.type || t.type !== where.type.not) &&
            t.expiredAt.getTime() < where.expiredAt.lt.getTime()
        )
    );
    mocks.tx.transaction.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        pendingLotTransaction({
          id: where.id,
          orderId: where.id,
          lotOwnership: { id: `lo_${where.id}` },
        })
    );

    await expireStaleTransactions();

    // kueri menyaring tepat status PENDING + expiredAt lewat waktu, dan
    // mengecualikan pesanan secondary (ditangani sapuan terpisah)
    expect(mocks.prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'PENDING',
          type: { not: 'SECONDARY_BUY' },
          expiredAt: { lt: expect.any(Date) },
        },
      })
    );

    // hanya pesanan kedaluwarsa yang dilepas
    expect(mocks.tx.transaction.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.tx.transaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'stale_pending' } })
    );
    expect(mocks.tx.package.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.package.update).toHaveBeenCalledWith({
      where: { id: 'pkg_1' },
      data: { soldLots: { decrement: 5 } },
    });
    expect(mocks.tx.lotOwnership.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'stale_pending' },
    });
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'stale_pending', status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
  });

  it('tidak melempar bila kueri gagal (ikuti pola expireStaleListings)', async () => {
    mocks.prisma.transaction.findMany.mockRejectedValue(new Error('db down'));

    await expect(expireStaleTransactions()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. Mode simulasi pembayaran
// ---------------------------------------------------------------------------

describe('MIDTRANS_MODE=simulate', () => {
  it('checkout melewati Midtrans dan mengembalikan URL internal', async () => {
    process.env.MIDTRANS_MODE = 'simulate';
    installStatefulPackage(10);
    mocks.tx.transaction.create.mockResolvedValue({
      id: 'trx_4',
      orderId: 'TRX-4',
    });

    const res = await checkoutPOST(
      checkoutRequest({
        packageId: 'pkg_1',
        ownershipType: 'LOT',
        lotCount: 5,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.simulate).toBe(true);
    expect(json.redirectUrl).toBe('/app/bayar-simulasi/TRX-4');
    expect(createSnapToken).not.toHaveBeenCalled();
    expect(json.snapToken).toBeNull();

    // nomor lot benar pada pembuatan baris kepemilikan
    expect(mocks.tx.lotOwnership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ lotStart: 11, lotEnd: 15 }),
    });
  });

  it('mode selain simulate tetap memakai Midtrans', async () => {
    process.env.MIDTRANS_MODE = 'sandbox';
    installStatefulPackage(10);
    mocks.tx.transaction.create.mockResolvedValue({
      id: 'trx_5',
      orderId: 'TRX-5',
    });
    vi.mocked(createSnapToken).mockResolvedValue({
      token: 'snap-token-abc',
      redirect_url: 'https://app.sandbox.midtrans.com/snap/vtweb/abc',
    });

    const res = await checkoutPOST(
      checkoutRequest({
        packageId: 'pkg_1',
        ownershipType: 'LOT',
        lotCount: 5,
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.simulate).toBe(false);
    expect(createSnapToken).toHaveBeenCalledTimes(1);
    expect(json.snapToken).toBe('snap-token-abc');
    expect(json.redirectUrl).toBe(
      'https://app.sandbox.midtrans.com/snap/vtweb/abc'
    );
    expect(mocks.prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'trx_5' },
      data: { snapToken: 'snap-token-abc' },
    });
  });
});

describe('POST /api/payments/simulate', () => {
  it('menolak 404 saat mode bukan simulate', async () => {
    process.env.MIDTRANS_MODE = 'sandbox';

    const res = await simulatePOST(
      simulateRequest({ orderId: 'TRX-4', action: 'success' })
    );

    expect(res.status).toBe(404);
    expect(mocks.prisma.transaction.findUnique).not.toHaveBeenCalled();
  });

  it('menolak 404 saat MIDTRANS_MODE tidak diset sama sekali', async () => {
    delete process.env.MIDTRANS_MODE;

    const res = await simulatePOST(
      simulateRequest({ orderId: 'TRX-4', action: 'success' })
    );

    expect(res.status).toBe(404);
  });

  it('menolak 401 untuk pengguna yang belum login', async () => {
    process.env.MIDTRANS_MODE = 'simulate';
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const res = await simulatePOST(
      simulateRequest({ orderId: 'TRX-4', action: 'success' })
    );

    expect(res.status).toBe(401);
  });

  it('menandai PAID untuk pesanan milik pengguna sendiri', async () => {
    process.env.MIDTRANS_MODE = 'simulate';
    mocks.prisma.transaction.findUnique.mockResolvedValue({
      id: 'trx_6',
      orderId: 'TRX-6',
      userId: 'usr_1',
      packageId: 'pkg_1',
      status: 'PENDING',
      lotCount: 5,
      amount: 50000,
    });

    const res = await simulatePOST(
      simulateRequest({ orderId: 'TRX-6', action: 'success' })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('success');

    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'trx_6', status: 'PENDING' },
        data: expect.objectContaining({ status: 'PAID' }),
      })
    );
    expect(mocks.tx.investorBalance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'usr_1' } })
    );
  });

  it('menolak 409 bila gerbang atomik tidak menemukan pesanan masih PENDING', async () => {
    process.env.MIDTRANS_MODE = 'simulate';
    mocks.prisma.transaction.findUnique.mockResolvedValue({
      id: 'trx_9',
      orderId: 'TRX-9',
      userId: 'usr_1',
      packageId: 'pkg_1',
      status: 'PENDING',
      lotCount: 5,
      amount: 50000,
    });
    // Pembalap (cancel) sudah menang: gerbang tidak menemukan baris PENDING.
    mocks.tx.transaction.updateMany.mockResolvedValue({ count: 0 });

    const res = await simulatePOST(
      simulateRequest({ orderId: 'TRX-9', action: 'success' })
    );

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    expect(mocks.tx.investorBalance.upsert).not.toHaveBeenCalled();
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_9', status: 'PENDING' },
      data: expect.objectContaining({ status: 'PAID' }),
    });
  });

  it('menolak 404 untuk pesanan milik pengguna lain', async () => {
    process.env.MIDTRANS_MODE = 'simulate';
    mocks.prisma.transaction.findUnique.mockResolvedValue({
      id: 'trx_7',
      orderId: 'TRX-7',
      userId: 'usr_lain',
      packageId: 'pkg_1',
      status: 'PENDING',
    });

    const res = await simulatePOST(
      simulateRequest({ orderId: 'TRX-7', action: 'success' })
    );

    expect(res.status).toBe(404);
    expect(mocks.tx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('action cancel melepas slot lewat releaseReservation', async () => {
    process.env.MIDTRANS_MODE = 'simulate';
    const state = installStatefulPackage(10);

    mocks.prisma.transaction.findUnique.mockResolvedValue({
      id: 'trx_8',
      orderId: 'TRX-8',
      userId: 'usr_1',
      packageId: 'pkg_1',
      status: 'PENDING',
      lotCount: 5,
      amount: 50000,
    });
    mocks.tx.transaction.findUnique.mockResolvedValue(
      pendingLotTransaction({ id: 'trx_8', orderId: 'TRX-8' })
    );

    const res = await simulatePOST(
      simulateRequest({ orderId: 'TRX-8', action: 'cancel' })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('cancelled');
    expect(state.soldLots).toBe(5);
    expect(mocks.tx.lotOwnership.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: 'trx_8' },
    });
    expect(mocks.tx.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'trx_8', status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  });
});
