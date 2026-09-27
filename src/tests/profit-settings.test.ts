import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { calcProfitSplit } from '@/lib/calculations';
import { requireRole } from '@/lib/auth';
import {
  GET as profitGET,
  POST as profitPOST,
} from '@/app/api/admin/profit/route';
import {
  GET as taawunGET,
  POST as taawunPOST,
} from '@/app/api/admin/taawun/route';
import {
  GET as settingsGET,
  PUT as settingsPUT,
} from '@/app/api/admin/settings/route';

// Prisma mock — tx dan prisma berbagi objek yang sama supaya assert bisa
// dilakukan dari satu tempat.
const mocks = vi.hoisted(() => {
  const setting = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const profitDistribution = {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const taawunClaim = {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  };
  const transaction = { findMany: vi.fn(), create: vi.fn() };
  const user = { findMany: vi.fn(), findUnique: vi.fn() };
  const investorBalance = { upsert: vi.fn() };
  const packageCost = { aggregate: vi.fn() };
  const package_ = { findUnique: vi.fn(), findMany: vi.fn() };

  const tx = {
    setting,
    profitDistribution,
    taawunClaim,
    transaction,
    user,
    investorBalance,
    packageCost,
    package: package_,
  };

  const prisma = {
    setting,
    profitDistribution,
    taawunClaim,
    transaction,
    user,
    investorBalance,
    packageCost,
    package: package_,
    $transaction: vi.fn(async (callback: (t: typeof tx) => unknown) =>
      callback(tx)
    ),
  };

  return {
    prisma,
    setting,
    profitDistribution,
    taawunClaim,
    transaction,
    user,
    investorBalance,
    packageCost,
    package: package_,
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ requireRole: vi.fn() }));

function jsonRequest(
  url: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue({
    id: 'op_1',
    role: 'OPERATOR',
    username: 'operator',
    kycStatus: 'VERIFIED',
  });
});

describe('POST /api/admin/profit — pembagian profit sesuai settings', () => {
  it('membagi gross 60/40 memakai calcProfitSplit (raia 60, investor 40)', async () => {
    mocks.setting.findMany.mockResolvedValue([
      { id: 'raia_share_percent', value: '60' },
      { id: 'investor_share_percent', value: '40' },
    ]);
    mocks.package.findUnique.mockResolvedValue({ id: 'pkg_1' });
    mocks.profitDistribution.create.mockResolvedValue({ id: 'pd_1' });

    const res = await profitPOST(
      jsonRequest('http://localhost/api/admin/profit', 'POST', {
        packageId: 'pkg_1',
        amount: 1000000,
        source: 'MILK',
      })
    );

    expect(res.status).toBe(201);
    expect(mocks.profitDistribution.create).toHaveBeenCalledTimes(1);

    const data = mocks.profitDistribution.create.mock.calls[0][0].data;
    expect(data.grossAmount).toBe(1000000);
    expect(data.raiaShare).toBe(600000);
    expect(data.investorShare).toBe(400000);
    expect(data.packageId).toBe('pkg_1');
    // sama persis dengan hasil calcProfitSplit
    expect({ raia: data.raiaShare, investor: data.investorShare }).toEqual(
      calcProfitSplit(1000000, 60)
    );
  });

  it('pembulatan mengikuti calcProfitSplit (raia floor, sisa ke investor)', async () => {
    mocks.setting.findMany.mockResolvedValue([
      { id: 'raia_share_percent', value: '60' },
      { id: 'investor_share_percent', value: '40' },
    ]);
    mocks.package.findUnique.mockResolvedValue({ id: 'pkg_1' });
    mocks.profitDistribution.create.mockResolvedValue({ id: 'pd_2' });

    const res = await profitPOST(
      jsonRequest('http://localhost/api/admin/profit', 'POST', {
        packageId: 'pkg_1',
        amount: 333333,
      })
    );

    expect(res.status).toBe(201);
    const data = mocks.profitDistribution.create.mock.calls[0][0].data;
    expect(data.raiaShare).toBe(199999); // floor(333333 * 60 / 100)
    expect(data.investorShare).toBe(133334);
    expect(data.raiaShare + data.investorShare).toBe(333333);
  });

  it('menolak amount bukan bilangan bulat positif', async () => {
    const res = await profitPOST(
      jsonRequest('http://localhost/api/admin/profit', 'POST', {
        packageId: 'pkg_1',
        amount: -5000,
      })
    );

    expect(res.status).toBe(400);
    expect(mocks.profitDistribution.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/taawun — klaim ta\'awun 100%', () => {
  beforeEach(() => {
    mocks.user.findUnique.mockResolvedValue({ id: 'usr_1' });
    mocks.package.findUnique.mockResolvedValue({ id: 'pkg_1' });
    mocks.setting.findMany.mockResolvedValue([
      { id: 'taawun_year_1', value: '300000' },
      { id: 'taawun_year_2_plus', value: '150000' },
    ]);
    mocks.taawunClaim.create.mockResolvedValue({ id: 'tc_1' });
    mocks.transaction.create.mockResolvedValue({ id: 'trx_1' });
  });

  it('membuat Transaction TAAWUN_CLAIM berstatus PAID dan mengkredit saldo 100%', async () => {
    const res = await taawunPOST(
      jsonRequest('http://localhost/api/admin/taawun', 'POST', {
        userId: 'usr_1',
        packageId: 'pkg_1',
        amount: 300000,
        year: 1,
        reason: 'Biaya pengobatan',
      })
    );

    expect(res.status).toBe(201);

    // klaim dicatat
    expect(mocks.taawunClaim.create).toHaveBeenCalledTimes(1);
    expect(mocks.taawunClaim.create.mock.calls[0][0].data).toMatchObject({
      packageId: 'pkg_1',
      claimAmount: 300000,
      status: 'PAID',
    });

    // transaksi payout
    expect(mocks.transaction.create).toHaveBeenCalledTimes(1);
    expect(mocks.transaction.create.mock.calls[0][0].data).toMatchObject({
      userId: 'usr_1',
      packageId: 'pkg_1',
      type: 'TAAWUN_CLAIM',
      status: 'PAID',
      amount: 300000,
    });

    // saldo investor bertambah penuh, tanpa pembagian
    expect(mocks.investorBalance.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.investorBalance.upsert.mock.calls[0][0]).toMatchObject({
      where: { userId: 'usr_1' },
      update: { availableBalance: { increment: 300000 } },
      create: { userId: 'usr_1', availableBalance: 300000 },
    });

    const json = await res.json();
    expect(json.claim.id).toBe('tc_1');
  });

  it('menolak klaim melebihi rate ta\'awun tahun 2+ (Rp150.000)', async () => {
    const res = await taawunPOST(
      jsonRequest('http://localhost/api/admin/taawun', 'POST', {
        userId: 'usr_1',
        packageId: 'pkg_1',
        amount: 300000,
        year: 2,
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('ta');
    expect(json.error).toContain('150');
    expect(mocks.transaction.create).not.toHaveBeenCalled();
    expect(mocks.investorBalance.upsert).not.toHaveBeenCalled();
  });

  it('menolak investor yang tidak ditemukan', async () => {
    mocks.user.findUnique.mockResolvedValue(null);

    const res = await taawunPOST(
      jsonRequest('http://localhost/api/admin/taawun', 'POST', {
        userId: 'usr_tidak_ada',
        packageId: 'pkg_1',
        amount: 150000,
      })
    );

    expect(res.status).toBe(404);
    expect(mocks.investorBalance.upsert).not.toHaveBeenCalled();
  });
});

describe('PUT /api/admin/settings', () => {
  it('menolak pembagian profit yang tidak berjumlah 100% dengan pesan Indonesia', async () => {
    mocks.setting.findUnique.mockResolvedValue({
      id: 'investor_share_percent',
      value: '40',
    });

    const res = await settingsPUT(
      jsonRequest('http://localhost/api/admin/settings', 'PUT', {
        key: 'raia_share_percent',
        value: '70',
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('100');
    expect(mocks.setting.update).not.toHaveBeenCalled();
  });

  it('meng-update nilai setting yang valid', async () => {
    mocks.setting.update.mockResolvedValue({ id: 'min_checkout' });

    const res = await settingsPUT(
      jsonRequest('http://localhost/api/admin/settings', 'PUT', {
        key: 'min_checkout',
        value: '60000',
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.setting.update).toHaveBeenCalledWith({
      where: { id: 'min_checkout' },
      data: { value: '60000' },
    });
    const json = await res.json();
    expect(json).toMatchObject({ key: 'min_checkout', value: '60000' });
  });

  it('menolak nilai non-angka untuk key numerik', async () => {
    const res = await settingsPUT(
      jsonRequest('http://localhost/api/admin/settings', 'PUT', {
        key: 'min_checkout',
        value: 'bukan-angka',
      })
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/angka/i);
    expect(mocks.setting.update).not.toHaveBeenCalled();
  });

  it('menolak key pengaturan yang tidak dikenal', async () => {
    const res = await settingsPUT(
      jsonRequest('http://localhost/api/admin/settings', 'PUT', {
        key: 'tidak_ada',
        value: '1',
      })
    );

    expect(res.status).toBe(400);
    expect(mocks.setting.update).not.toHaveBeenCalled();
  });
});

describe('GET routes', () => {
  it('GET /api/admin/profit mengembalikan daftar distribusi berpaginasi', async () => {
    mocks.profitDistribution.findMany.mockResolvedValue([
      { id: 'pd_1', grossAmount: 1000000, package: { code: 'PKT-1', title: 'Kambing Etawa' } },
    ]);
    mocks.profitDistribution.count.mockResolvedValue(1);

    const res = await profitGET(
      jsonRequest('http://localhost/api/admin/profit?page=1', 'GET')
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].packageTitle).toBe('Kambing Etawa');
    expect(json.total).toBe(1);
    expect(json.page).toBe(1);
  });

  it('GET /api/admin/taawun mengembalikan daftar klaim', async () => {
    mocks.taawunClaim.findMany.mockResolvedValue([
      { id: 'tc_1', claimAmount: 300000, package: { code: 'PKT-1', title: 'Kambing Etawa' } },
    ]);
    mocks.taawunClaim.count.mockResolvedValue(1);
    mocks.transaction.findMany.mockResolvedValue([
      { orderId: 'TAAWUN-tc_1', userId: 'usr_1', amount: 300000 },
    ]);
    mocks.user.findMany.mockResolvedValue([
      { id: 'usr_1', name: 'Budi', username: 'budi' },
    ]);

    const res = await taawunGET(
      jsonRequest('http://localhost/api/admin/taawun?page=1', 'GET')
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0].investorName).toBe('Budi');
    expect(json.total).toBe(1);
  });

  it('GET /api/admin/settings mengembalikan daftar setting + label', async () => {
    mocks.setting.findMany.mockResolvedValue([
      { id: 'raia_share_percent', value: '60', updatedAt: new Date() },
      { id: 'investor_share_percent', value: '40', updatedAt: new Date() },
    ]);

    const res = await settingsGET();

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(2);
    expect(json.items[0].label).toBeTruthy();
    expect(json.items[0].key).toBe('raia_share_percent');
  });
});

describe('Otorisasi', () => {
  it('membalas 401 saat operator belum login', async () => {
    vi.mocked(requireRole).mockRejectedValue(
      Object.assign(new Error('UNAUTHENTICATED'), { code: 'UNAUTHENTICATED' })
    );

    const res = await profitPOST(
      jsonRequest('http://localhost/api/admin/profit', 'POST', {
        packageId: 'pkg_1',
        amount: 1000,
      })
    );

    expect(res.status).toBe(401);
    expect(mocks.profitDistribution.create).not.toHaveBeenCalled();
  });
});
