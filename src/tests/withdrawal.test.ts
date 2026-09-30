import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { createWithdrawal, settleWithdrawal } from '@/lib/withdrawal';
import { POST as withdrawalPOST } from '@/app/api/withdrawals/route';
import { PATCH as withdrawalPATCH } from '@/app/api/admin/withdrawals/[id]/route';

// ---------------------------------------------------------------------------
// Mocks — tx dan prisma berbagi objek yang sama supaya perubahan status yang
// dibuat lewat jalur route terbaca kembali oleh pembaca berikutnya.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const tx = {
    investorBalance: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    withdrawal: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const prisma = {
    investorBalance: tx.investorBalance,
    withdrawal: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  };

  return { prisma, tx };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));

vi.mock('@/lib/auth', () => {
  class AuthenticationError extends Error {
    readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';

    constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
      super(code === 'UNAUTHENTICATED' ? 'Authentication required' : 'Insufficient role');
      this.name = 'AuthenticationError';
      this.code = code;
    }
  }

  return {
    AuthenticationError,
    requireRole: vi.fn(),
    getCurrentUser: vi.fn(),
  };
});

const destination = {
  bankName: 'Bank Syariah Indonesia',
  bankAccount: '1234567890',
  bankHolder: 'Budi Santoso',
};

const operator = {
  id: 'op_1',
  role: 'OPERATOR',
  username: 'operator',
  kycStatus: 'VERIFIED',
};

const investor = {
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

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.prisma.$transaction.mockImplementation(
    async (callback: (client: typeof mocks.tx) => unknown) => callback(mocks.tx)
  );
  // Saldo cukup + klaim berhasil adalah jalur normal.
  mocks.tx.investorBalance.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.investorBalance.update.mockResolvedValue({});
  mocks.tx.withdrawal.updateMany.mockResolvedValue({ count: 1 });
  mocks.tx.withdrawal.create.mockResolvedValue({ id: 'wd_1' });
  mocks.tx.withdrawal.findUnique.mockResolvedValue({
    id: 'wd_1',
    userId: 'usr_1',
    amount: 100000,
    status: 'PENDING',
    reservedAt: new Date('2026-01-01T00:00:00Z'),
  });

  const { requireRole, getCurrentUser } = await import('@/lib/auth');
  vi.mocked(requireRole).mockResolvedValue(operator);
  vi.mocked(getCurrentUser).mockResolvedValue(investor);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ---------------------------------------------------------------------------
// createWithdrawal — reservasi saldo atomik
// ---------------------------------------------------------------------------

describe('createWithdrawal', () => {
  it('menolak amount > availableBalance dengan SALDO_TIDAK_CUKUP', async () => {
    mocks.tx.investorBalance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createWithdrawal('usr_1', 500000, destination)
    ).rejects.toThrow('SALDO_TIDAK_CUKUP');

    expect(mocks.tx.withdrawal.create).not.toHaveBeenCalled();
  });

  it('dua pengajuan bersaing: guard gte mengembalikan count 0 → throw, tidak membuat baris', async () => {
    // Pembalap sudah menghabiskan saldo; updateMany ber-guard menemukan 0 baris.
    mocks.tx.investorBalance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      createWithdrawal('usr_1', 500000, destination)
    ).rejects.toThrow('SALDO_TIDAK_CUKUP');

    expect(mocks.tx.investorBalance.updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr_1', availableBalance: { gte: 500000 } },
      data: { availableBalance: { decrement: 500000 } },
    });
    expect(mocks.tx.withdrawal.create).not.toHaveBeenCalled();
  });

  it('saldo cukup: men-decrement saldo lalu membuat Withdrawal PENDING', async () => {
    const created = { id: 'wd_9', status: 'PENDING' };
    mocks.tx.withdrawal.create.mockResolvedValue(created);

    const result = await createWithdrawal('usr_1', 100000, destination);

    expect(result).toEqual(created);
    expect(mocks.tx.investorBalance.updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr_1', availableBalance: { gte: 100000 } },
      data: { availableBalance: { decrement: 100000 } },
    });
    expect(mocks.tx.withdrawal.create).toHaveBeenCalledWith({
      data: {
        userId: 'usr_1',
        amount: 100000,
        bankName: destination.bankName,
        bankAccount: destination.bankAccount,
        bankHolder: destination.bankHolder,
        status: 'PENDING',
        reservedAt: expect.any(Date),
      },
    });
  });
});

// ---------------------------------------------------------------------------
// settleWithdrawal — mesin status (RULING 12)
// ---------------------------------------------------------------------------

describe('settleWithdrawal', () => {
  it('APPROVED: klaim PENDING → APPROVED, saldo tidak disentuh', async () => {
    await settleWithdrawal(mocks.tx as never, 'wd_1', 'APPROVED', 'op_1');

    expect(mocks.tx.withdrawal.updateMany).toHaveBeenCalledWith({
      where: { id: 'wd_1', status: 'PENDING' },
      data: {
        status: 'APPROVED',
        approvedAt: expect.any(Date),
        approvedById: 'op_1',
      },
    });
    expect(mocks.tx.investorBalance.update).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.updateMany).not.toHaveBeenCalled();
  });

  it('REJECTED: mengembalikan saldo (increment) dan mencatat note', async () => {
    mocks.tx.withdrawal.findUnique.mockResolvedValue({
      id: 'wd_1',
      userId: 'usr_1',
      amount: 100000,
      status: 'PENDING',
      reservedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await settleWithdrawal(mocks.tx as never, 'wd_1', 'REJECTED', 'op_1');

    expect(mocks.tx.withdrawal.updateMany).toHaveBeenCalledWith({
      where: { id: 'wd_1', status: 'PENDING' },
      data: { status: 'REJECTED', note: 'Ditolak operator' },
    });
    expect(mocks.tx.investorBalance.update).toHaveBeenCalledWith({
      where: { userId: 'usr_1' },
      data: { availableBalance: { increment: 100000 } },
    });
  });

  it('REJECTED pada baris warisan (reservedAt null) TIDAK mengembalikan saldo', async () => {
    // Baris PENDING lama dibuat sebelum reservasi diberlakukan: saldo tidak
    // pernah dipotong, jadi tidak boleh dikembalikan. Status tetap berpindah.
    mocks.tx.withdrawal.findUnique.mockResolvedValue({
      id: 'wd_lama',
      userId: 'usr_1',
      amount: 100000,
      status: 'PENDING',
      reservedAt: null,
    });

    await settleWithdrawal(mocks.tx as never, 'wd_lama', 'REJECTED', 'op_1');

    expect(mocks.tx.withdrawal.updateMany).toHaveBeenCalledWith({
      where: { id: 'wd_lama', status: 'PENDING' },
      data: { status: 'REJECTED', note: 'Ditolak operator' },
    });
    expect(mocks.tx.investorBalance.update).not.toHaveBeenCalled();
  });

  it('REJECTED: amount diambil dari baca sebelum update (urutan findUnique → updateMany)', async () => {
    // Bila implementasi membaca ulang setelah update, amount bisa berubah dan
    // pengembalian jadi salah. Pastikan findUnique mendahului updateMany dan
    // nominal yang dipakai adalah hasil baca awal.
    mocks.tx.withdrawal.findUnique.mockResolvedValueOnce({
      id: 'wd_1',
      userId: 'usr_1',
      amount: 100000,
      status: 'PENDING',
      reservedAt: new Date('2026-01-01T00:00:00Z'),
    });
    // Bila kode salah membaca ulang, nilai kedua yang berbeda ini akan terpakai.
    mocks.tx.withdrawal.findUnique.mockResolvedValue({
      id: 'wd_1',
      userId: 'usr_1',
      amount: 999999,
      status: 'REJECTED',
      reservedAt: new Date('2026-01-01T00:00:00Z'),
    });

    await settleWithdrawal(mocks.tx as never, 'wd_1', 'REJECTED', 'op_1');

    expect(mocks.tx.withdrawal.findUnique.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.tx.withdrawal.updateMany.mock.invocationCallOrder[0]
    );
    expect(mocks.tx.investorBalance.update).toHaveBeenCalledWith({
      where: { userId: 'usr_1' },
      data: { availableBalance: { increment: 100000 } },
    });
  });

  it('PAID: hanya dari APPROVED, saldo tidak disentuh lagi', async () => {
    await settleWithdrawal(mocks.tx as never, 'wd_1', 'PAID', 'op_1');

    expect(mocks.tx.withdrawal.updateMany).toHaveBeenCalledWith({
      where: { id: 'wd_1', status: 'APPROVED' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    });
    expect(mocks.tx.investorBalance.update).not.toHaveBeenCalled();
    expect(mocks.tx.investorBalance.updateMany).not.toHaveBeenCalled();
  });

  it('transisi tidak sah (PAID dari PENDING) → throw TRANSISI_TIDAK_SAH', async () => {
    mocks.tx.withdrawal.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      settleWithdrawal(mocks.tx as never, 'wd_1', 'PAID', 'op_1')
    ).rejects.toThrow('TRANSISI_TIDAK_SAH');

    expect(mocks.tx.investorBalance.update).not.toHaveBeenCalled();
  });

  it('REJECTED yang kalah balapan tidak mengembalikan saldo', async () => {
    mocks.tx.withdrawal.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      settleWithdrawal(mocks.tx as never, 'wd_1', 'REJECTED', 'op_1')
    ).rejects.toThrow('TRANSISI_TIDAK_SAH');

    expect(mocks.tx.investorBalance.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/withdrawals — memakai createWithdrawal
// ---------------------------------------------------------------------------

describe('POST /api/withdrawals', () => {
  it('membuat penarikan PENDING lewat createWithdrawal (201)', async () => {
    mocks.tx.withdrawal.create.mockResolvedValue({ id: 'wd_1' });

    const res = await withdrawalPOST(
      jsonRequest('http://localhost/api/withdrawals', {
        amount: 100000,
        ...destination,
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe('wd_1');
    expect(mocks.tx.investorBalance.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.tx.withdrawal.create).toHaveBeenCalledTimes(1);
  });

  it('memetakan SALDO_TIDAK_CUKUP menjadi 400', async () => {
    mocks.tx.investorBalance.updateMany.mockResolvedValue({ count: 0 });

    const res = await withdrawalPOST(
      jsonRequest('http://localhost/api/withdrawals', {
        amount: 100000,
        ...destination,
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Saldo tidak mencukupi');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/withdrawals/[id] — operator/admin
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/withdrawals/[id]', () => {
  function patchRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/admin/withdrawals/wd_1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  const params = { params: { id: 'wd_1' } };

  it('operator boleh menyetujui (200 { success: true })', async () => {
    const { requireRole } = await import('@/lib/auth');
    vi.mocked(requireRole).mockResolvedValue(operator);

    const res = await withdrawalPATCH(patchRequest({ action: 'APPROVED' }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(vi.mocked(requireRole)).toHaveBeenCalledWith(['ADMIN', 'OPERATOR']);
    expect(mocks.tx.withdrawal.updateMany).toHaveBeenCalledWith({
      where: { id: 'wd_1', status: 'PENDING' },
      data: expect.objectContaining({ status: 'APPROVED' }),
    });
  });

  it('admin juga boleh', async () => {
    const { requireRole } = await import('@/lib/auth');
    vi.mocked(requireRole).mockResolvedValue({ ...operator, role: 'ADMIN' });

    const res = await withdrawalPATCH(patchRequest({ action: 'PAID' }), params);

    expect(res.status).toBe(200);
  });

  it('investor ditolak 403', async () => {
    const { requireRole, AuthenticationError } = await import('@/lib/auth');
    vi.mocked(requireRole).mockRejectedValue(
      new AuthenticationError('FORBIDDEN')
    );

    const res = await withdrawalPATCH(patchRequest({ action: 'APPROVED' }), params);

    expect(res.status).toBe(403);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('belum login ditolak 401', async () => {
    const { requireRole, AuthenticationError } = await import('@/lib/auth');
    vi.mocked(requireRole).mockRejectedValue(
      new AuthenticationError('UNAUTHENTICATED')
    );

    const res = await withdrawalPATCH(patchRequest({ action: 'APPROVED' }), params);

    expect(res.status).toBe(401);
  });

  it('action tidak valid ditolak 400', async () => {
    const res = await withdrawalPATCH(patchRequest({ action: 'NOPE' }), params);

    expect(res.status).toBe(400);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('transisi tidak sah dipetakan menjadi 409', async () => {
    mocks.tx.withdrawal.updateMany.mockResolvedValue({ count: 0 });

    const res = await withdrawalPATCH(patchRequest({ action: 'PAID' }), params);

    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('Status penarikan tidak sesuai untuk aksi ini');
  });
});
