import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/secondary/buy/route';
import { getCurrentUser } from '@/lib/auth';
import { expireStaleListings, expireStalePendingPayments, calculateFee } from '@/lib/secondary';
import { createSnapToken, isSimulateMode } from '@/lib/midtrans';

// ---------------------------------------------------------------------------
// Mocks — prisma sekaligus tx (dilewatkan langsung oleh $transaction) supaya
// perubahan status yang dibuat lewat jalur route terbaca kembali oleh penguji.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const prisma = {
    secondaryListing: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    fullOwnership: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    lotOwnership: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    secondarySale: {
      create: vi.fn(),
    },
    investorBalance: {
      upsert: vi.fn(),
    },
    setting: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  return { prisma };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/secondary', () => ({
  expireStaleListings: vi.fn(),
  expireStalePendingPayments: vi.fn(),
  calculateFee: vi.fn(),
}));
vi.mock('@/lib/midtrans', () => ({
  createSnapToken: vi.fn(),
  isSimulateMode: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getCurrentUser).mockResolvedValue(buyer);
  vi.mocked(expireStaleListings).mockResolvedValue(undefined);
  vi.mocked(calculateFee).mockResolvedValue({ feePercent: 0, feeFlat: 0, adminFee: 0 });
  vi.mocked(isSimulateMode).mockReturnValue(false);
  vi.mocked(createSnapToken).mockResolvedValue({
    token: 'snap-token-123',
    redirect_url: 'https://app.sandbox.midtrans.com/snap/redirect/123',
  });

  mocks.prisma.secondaryListing.findUnique.mockResolvedValue(makeListing());
  mocks.prisma.fullOwnership.findFirst.mockResolvedValue(null);
  mocks.prisma.lotOwnership.findFirst.mockResolvedValue(null);
  mocks.prisma.setting.findUnique.mockResolvedValue(null);
  mocks.prisma.user.findUnique.mockResolvedValue({ email: 'buyer@test.com' });

  mocks.prisma.secondaryListing.updateMany.mockResolvedValue({ count: 1 });
  mocks.prisma.transaction.create.mockResolvedValue({ id: 'tx_1', orderId: 'SEC-test-123' });
  mocks.prisma.transaction.update.mockResolvedValue({ id: 'tx_1', orderId: 'SEC-test-123' });
  mocks.prisma.transaction.updateMany.mockResolvedValue({ count: 1 });

  // $transaction melewatkan prisma sebagai tx supaya tx.* === prisma.*
  mocks.prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mocks.prisma) => unknown) => callback(mocks.prisma)
  );
});

// ===========================================================================
// BRIEF TESTS (harus lulus persis seperti di task brief)
// ===========================================================================

describe('POST /api/secondary/buy — brief tests', () => {
  it('mengunci listing dan tidak memindahkan kepemilikan saat bayar', async () => {
    const res = await POST(buyRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orderId).toBeTruthy();
    expect(mocks.prisma.secondaryListing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lst_1', status: 'ACTIVE' },
        data: { status: 'PENDING_PAYMENT' },
      })
    );
    expect(mocks.prisma.lotOwnership.update).not.toHaveBeenCalled();
    expect(mocks.prisma.investorBalance.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.secondarySale.create).not.toHaveBeenCalled();
  });

  it('menolak saat listing sudah bukan ACTIVE', async () => {
    mocks.prisma.secondaryListing.updateMany.mockResolvedValue({ count: 0 });
    expect((await POST(buyRequest())).status).toBe(409);
  });
});

// ===========================================================================
// GUARD TESTS
// ===========================================================================

describe('POST /api/secondary/buy — guards', () => {
  it('menolak jika tidak login (401)', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await POST(buyRequest());
    expect(res.status).toBe(401);
  });

  it('menolak jika listingId tidak valid (400)', async () => {
    const res = await POST(buyRequest(''));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('ID listing');
  });

  it('menolak jika listing tidak ditemukan (404)', async () => {
    mocks.prisma.secondaryListing.findUnique.mockResolvedValue(null);
    const res = await POST(buyRequest());
    expect(res.status).toBe(404);
  });

  it('menolak jika status bukan ACTIVE (400)', async () => {
    mocks.prisma.secondaryListing.findUnique.mockResolvedValue(
      makeListing({ status: 'PENDING_PAYMENT' })
    );
    const res = await POST(buyRequest());
    expect(res.status).toBe(400);
  });

  it('menolak jika listing sudah expired (400)', async () => {
    mocks.prisma.secondaryListing.findUnique.mockResolvedValue(
      makeListing({ expiresAt: new Date(Date.now() - 1000) })
    );
    const res = await POST(buyRequest());
    expect(res.status).toBe(400);
  });

  it('menolak jika pembeli adalah penjual (400)', async () => {
    mocks.prisma.secondaryListing.findUnique.mockResolvedValue(
      makeListing({ sellerId: 'buyer_1' })
    );
    const res = await POST(buyRequest());
    expect(res.status).toBe(400);
  });

  it('menolak jika pembeli sudah punya FULL pada paket yang sama (400)', async () => {
    mocks.prisma.secondaryListing.findUnique.mockResolvedValue(
      makeListing({ ownershipType: 'FULL', lotStart: null, lotEnd: null })
    );
    mocks.prisma.fullOwnership.findFirst.mockResolvedValue({
      id: 'fo_buyer',
      packageId: 'pkg_1',
      userId: 'buyer_1',
    });

    const res = await POST(buyRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Anda sudah memiliki aset pada paket ini');
  });
});

// ===========================================================================
// PAYMENT FLOW TESTS
// ===========================================================================

describe('POST /api/secondary/buy — payment flow', () => {
  it('membuat transaksi SECONDARY_BUY dengan status PENDING', async () => {
    await POST(buyRequest());

    expect(mocks.prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'SECONDARY_BUY',
          status: 'PENDING',
          userId: 'buyer_1',
          packageId: 'pkg_1',
          amount: 100000,
          secondaryListingId: 'lst_1',
        }),
      })
    );
  });

  it('mengembalikan response dengan orderId dan total', async () => {
    const res = await POST(buyRequest());
    const body = await res.json();
    expect(body.orderId).toBeTruthy();
    expect(body.total).toBe(100000);
  });

  it('memanggil calculateFee dengan listingPrice', async () => {
    await POST(buyRequest());
    expect(calculateFee).toHaveBeenCalledWith(100000, expect.anything());
  });

  it('membersihkan listing kedaluwarsa sebelum memproses', async () => {
    await POST(buyRequest());
    expect(expireStaleListings).toHaveBeenCalledOnce();
  });

  it('melepas pembelian PENDING kedaluwarsa sebelum memproses', async () => {
    await POST(buyRequest());
    expect(expireStalePendingPayments).toHaveBeenCalledOnce();
  });
});

// ===========================================================================
// SIMULATE MODE TESTS
// ===========================================================================

describe('POST /api/secondary/buy — simulate mode', () => {
  it('mengembalikan snapToken: null dan simulate: true', async () => {
    vi.mocked(isSimulateMode).mockReturnValue(true);

    const res = await POST(buyRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.snapToken).toBeNull();
    expect(body.simulate).toBe(true);
    expect(body.redirectUrl).toContain('/app/bayar-simulasi/');
    expect(body.orderId).toBeTruthy();
    expect(body.total).toBe(100000);
  });

  it('tidak memanggil createSnapToken saat simulate', async () => {
    vi.mocked(isSimulateMode).mockReturnValue(true);
    await POST(buyRequest());
    expect(createSnapToken).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// SNAP TOKEN FLOW TESTS
// ===========================================================================

describe('POST /api/secondary/buy — snap token flow', () => {
  it('mengembalikan snapToken dan redirectUrl saat mode nyata', async () => {
    const res = await POST(buyRequest());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.snapToken).toBe('snap-token-123');
    expect(body.redirectUrl).toBeTruthy();
    expect(body.simulate).toBe(false);
  });

  it('memanggil createSnapToken dengan orderId dan grossAmount yang benar', async () => {
    await POST(buyRequest());

    expect(createSnapToken).toHaveBeenCalledWith(
      expect.objectContaining({
        grossAmount: 100000,
        customerDetails: expect.objectContaining({
          first_name: 'pembeli',
          email: 'buyer@test.com',
        }),
      })
    );
  });

  it('memperbarui transaction dengan snapToken', async () => {
    await POST(buyRequest());

    expect(mocks.prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx_1' },
        data: expect.objectContaining({
          snapToken: 'snap-token-123',
        }),
      })
    );
  });

  it('mengembalikan 502 dengan pesan khusus saat createSnapToken gagal', async () => {
    vi.mocked(createSnapToken).mockRejectedValue(new Error('Midtrans timeout'));

    const res = await POST(buyRequest());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe(
      'Gagal membuat sesi pembayaran. Listing Anda masih aktif dan bisa dicoba lagi.'
    );
  });

  it('mengembalikan listing ke ACTIVE saat createSnapToken gagal', async () => {
    vi.mocked(createSnapToken).mockRejectedValue(new Error('Midtrans timeout'));

    await POST(buyRequest());

    expect(mocks.prisma.secondaryListing.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lst_1', status: 'PENDING_PAYMENT' },
        data: { status: 'ACTIVE' },
      })
    );
  });

  it('membatalkan transaksi dan melepas tautan listing saat Snap gagal, sehingga retry berhasil', async () => {
    // Mock stateful: `secondaryListingId` benar-benar unik seperti constraint DB.
    const linkedListingIds = new Map<string, string>();
    let seq = 0;

    mocks.prisma.transaction.create.mockImplementation(
      async (args: {
        data?: { secondaryListingId?: string | null; orderId?: string };
      }) => {
        const listingId = args?.data?.secondaryListingId;
        const alreadyLinked = listingId
          ? Array.from(linkedListingIds.values()).some(
              (linked) => linked === listingId
            )
          : false;
        if (alreadyLinked) {
          throw Object.assign(
            new Error('Unique constraint failed on the fields: (`secondaryListingId`)'),
            { code: 'P2002' }
          );
        }
        const id = `tx_${++seq}`;
        if (listingId) linkedListingIds.set(id, listingId);
        return { id, orderId: args?.data?.orderId ?? 'SEC-test-123' };
      }
    );

    mocks.prisma.transaction.updateMany.mockImplementation(
      async (args: {
        where?: { id?: string; status?: string };
        data?: { secondaryListingId?: string | null };
      }) => {
        if (args?.data?.secondaryListingId === null && args?.where?.id) {
          linkedListingIds.delete(args.where.id);
        }
        return { count: 1 };
      }
    );

    vi.mocked(createSnapToken).mockRejectedValueOnce(new Error('Midtrans timeout'));

    const res1 = await POST(buyRequest());
    expect(res1.status).toBe(502);

    // Transaksi lama dibatalkan ber-guard (hanya PENDING) dan tautannya
    // dilepas supaya tidak P2002.
    expect(mocks.prisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'tx_1', status: 'PENDING' },
      data: { status: 'CANCELLED', secondaryListingId: null },
    });
    expect(mocks.prisma.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_1', status: 'PENDING_PAYMENT' },
      data: { status: 'ACTIVE' },
    });

    // Retry dengan listing yang sama harus bisa membuat transaksi baru.
    const res2 = await POST(buyRequest());
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.orderId).toBeTruthy();
  });
});