import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST as profitPOST } from '@/app/api/admin/profit/route';
import { PUT as settingsPUT } from '@/app/api/admin/settings/route';
import { PATCH as userPATCH } from '@/app/api/admin/users/[id]/route';

// Mock requireRole yang benar-benar menegakkan argumen role yang diminta route,
// sehingga tes ini membuktikan guard-nya, bukan sekadar bahwa route memanggil auth.
const mocks = vi.hoisted(() => {
  const state = { role: 'OPERATOR' as 'OPERATOR' | 'ADMIN' | 'INVESTOR' };

  const setting = { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const profitDistribution = {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  const package_ = { findUnique: vi.fn() };
  const user = { findUnique: vi.fn(), update: vi.fn() };
  const transaction = { create: vi.fn() };
  const investorBalance = { upsert: vi.fn() };
  const lotOwnership = { findMany: vi.fn() };
  const fullOwnership = { findMany: vi.fn() };

  const tx = {
    setting,
    profitDistribution,
    package: package_,
    user,
    transaction,
    investorBalance,
    lotOwnership,
    fullOwnership,
  };

  const prisma = {
    setting,
    profitDistribution,
    package: package_,
    user,
    transaction,
    investorBalance,
    lotOwnership,
    fullOwnership,
    $transaction: vi.fn(async (callback: (t: typeof tx) => unknown) =>
      callback(tx)
    ),
  };

  return {
    state,
    prisma,
    setting,
    profitDistribution,
    package: package_,
    user,
    transaction,
    investorBalance,
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }));

vi.mock('@/lib/auth', () => {
  class AuthenticationError extends Error {
    readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN';

    constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN') {
      super(
        code === 'UNAUTHENTICATED'
          ? 'Authentication required'
          : 'Insufficient role'
      );
      this.name = 'AuthenticationError';
      this.code = code;
    }
  }

  return {
    AuthenticationError,
    requireRole: vi.fn(async (role: string | string[]) => {
      const allowed = Array.isArray(role) ? role : [role];
      if (!allowed.includes(mocks.state.role)) {
        throw new AuthenticationError('FORBIDDEN');
      }
      return {
        id: 'usr_1',
        role: mocks.state.role,
        username: 'operator',
        kycStatus: 'VERIFIED',
      };
    }),
  };
});

function jsonRequest(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH',
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const ADMIN_ONLY_SETTING_KEYS = [
  'raia_share_percent',
  'investor_share_percent',
  'secondary_admin_fee_percent',
  'secondary_admin_fee_flat',
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.role = 'OPERATOR';
});

describe('POST /api/admin/profit — hanya ADMIN', () => {
  it('operator ditolak 403 pada cabang create-distribution', async () => {
    const res = await profitPOST(
      jsonRequest('http://localhost/api/admin/profit', 'POST', {
        packageId: 'pkg_1',
        amount: 1000000,
        source: 'MILK',
      })
    );

    expect(res.status).toBe(403);
    expect(mocks.profitDistribution.create).not.toHaveBeenCalled();
  });

  it('operator ditolak 403 pada cabang aksi distribute/markPaid', async () => {
    const res = await profitPOST(
      jsonRequest('http://localhost/api/admin/profit', 'POST', {
        action: 'markPaid',
        id: 'pd_1',
      })
    );

    expect(res.status).toBe(403);
    expect(mocks.profitDistribution.findUnique).not.toHaveBeenCalled();
  });

  it('admin lolos guard pada cabang create-distribution (201)', async () => {
    mocks.state.role = 'ADMIN';
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

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(201);
  });

  it('admin lolos guard pada cabang aksi distribute/markPaid', async () => {
    mocks.state.role = 'ADMIN';
    mocks.profitDistribution.findUnique.mockResolvedValue(null);

    const res = await profitPOST(
      jsonRequest('http://localhost/api/admin/profit', 'POST', {
        action: 'markPaid',
        id: 'pd_tidak_ada',
      })
    );

    expect(res.status).not.toBe(403);
  });
});

describe('PUT /api/admin/settings — kunci sensitif hanya ADMIN', () => {
  for (const key of ADMIN_ONLY_SETTING_KEYS) {
    it(`operator ditolak 403 untuk kunci sensitif ${key}`, async () => {
      const res = await settingsPUT(
        jsonRequest('http://localhost/api/admin/settings', 'PUT', {
          key,
          value: '2',
        })
      );

      expect(res.status).toBe(403);
      expect(mocks.setting.update).not.toHaveBeenCalled();
    });
  }

  it('admin boleh mengubah kunci sensitif', async () => {
    mocks.state.role = 'ADMIN';
    mocks.setting.update.mockResolvedValue({ id: 'secondary_admin_fee_percent' });

    const res = await settingsPUT(
      jsonRequest('http://localhost/api/admin/settings', 'PUT', {
        key: 'secondary_admin_fee_percent',
        value: '2',
      })
    );

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it('admin boleh mengubah kunci pembagian profit bila total 100%', async () => {
    mocks.state.role = 'ADMIN';
    mocks.setting.findUnique.mockResolvedValue({
      id: 'investor_share_percent',
      value: '40',
    });
    mocks.setting.update.mockResolvedValue({ id: 'raia_share_percent' });

    const res = await settingsPUT(
      jsonRequest('http://localhost/api/admin/settings', 'PUT', {
        key: 'raia_share_percent',
        value: '60',
      })
    );

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it('operator tetap boleh mengubah kunci non-sensitif', async () => {
    mocks.setting.update.mockResolvedValue({ id: 'min_checkout' });

    const res = await settingsPUT(
      jsonRequest('http://localhost/api/admin/settings', 'PUT', {
        key: 'min_checkout',
        value: '60000',
      })
    );

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it('operator tetap boleh mengubah secondary_market_days', async () => {
    mocks.setting.update.mockResolvedValue({ id: 'secondary_market_days' });

    const res = await settingsPUT(
      jsonRequest('http://localhost/api/admin/settings', 'PUT', {
        key: 'secondary_market_days',
        value: '30',
      })
    );

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/admin/users/[id] — ubah role hanya ADMIN', () => {
  const params = { params: { id: 'usr_target' } };

  it('operator ditolak 403 saat mengirim field role', async () => {
    const res = await userPATCH(
      jsonRequest('http://localhost/api/admin/users/usr_target', 'PATCH', {
        role: 'ADMIN',
      }),
      params
    );

    expect(res.status).toBe(403);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it('admin boleh mengubah role', async () => {
    mocks.state.role = 'ADMIN';
    mocks.user.findUnique.mockResolvedValue({
      id: 'usr_target',
      role: 'INVESTOR',
    });
    mocks.user.update.mockResolvedValue({
      id: 'usr_target',
      username: 'target',
      name: 'Target',
      email: 'target@example.com',
      role: 'OPERATOR',
      kycStatus: 'VERIFIED',
    });

    const res = await userPATCH(
      jsonRequest('http://localhost/api/admin/users/usr_target', 'PATCH', {
        role: 'OPERATOR',
      }),
      params
    );

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });
});
