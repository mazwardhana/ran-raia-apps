import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DELETE } from '@/app/api/secondary/[id]/route';
import { getCurrentUser, type CurrentUser } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Mocks — pola yang sama dengan src/tests/secondary-list.test.ts.
// Prisma selalu di-mock; tidak pernah menyentuh DB nyata.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const prisma = {
    secondaryListing: { updateMany: vi.fn(), update: vi.fn() },
    lotOwnership: { update: vi.fn(), updateMany: vi.fn() },
    fullOwnership: { update: vi.fn(), updateMany: vi.fn() },
  };
  return { prisma };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));

const owner: CurrentUser = {
  id: 'usr_owner',
  role: 'INVESTOR',
  username: 'budi',
  kycStatus: 'VERIFIED',
};

function deleteRequest(id = 'lst_1'): NextRequest {
  return new NextRequest(`http://localhost/api/secondary/${id}`, {
    method: 'DELETE',
  });
}

function deleteContext(id = 'lst_1') {
  return { params: { id } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(owner);
  mocks.prisma.secondaryListing.updateMany.mockResolvedValue({ count: 1 });
});

// ---------------------------------------------------------------------------
// 1. Pemilik membatalkan listing ACTIVE-nya sendiri
// ---------------------------------------------------------------------------

describe('DELETE /api/secondary/[id] — pemilik membatalkan listing ACTIVE', () => {
  it('menandai listing CANCELLED dengan guard sellerId + ACTIVE', async () => {
    const response = await DELETE(deleteRequest('lst_1'), deleteContext('lst_1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });

    expect(mocks.prisma.secondaryListing.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_1', sellerId: owner.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });
  });

  it('tidak menyentuh kepemilikan lot/full sama sekali', async () => {
    await DELETE(deleteRequest('lst_1'), deleteContext('lst_1'));

    expect(mocks.prisma.lotOwnership.update).not.toHaveBeenCalled();
    expect(mocks.prisma.lotOwnership.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.fullOwnership.update).not.toHaveBeenCalled();
    expect(mocks.prisma.fullOwnership.updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Bukan pemilik / status bukan ACTIVE → 409, kepemilikan tetap utuh
// ---------------------------------------------------------------------------

describe('DELETE /api/secondary/[id] — transisi tidak sah → 409', () => {
  it('menolak bila guard tidak cocok (bukan pemilik)', async () => {
    // updateMany dengan sellerId pemilik tidak menemukan baris milik penyerang.
    mocks.prisma.secondaryListing.updateMany.mockResolvedValue({ count: 0 });

    const response = await DELETE(deleteRequest('lst_1'), deleteContext('lst_1'));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Listing tidak bisa dibatalkan');
    expect(mocks.prisma.lotOwnership.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.fullOwnership.updateMany).not.toHaveBeenCalled();
  });

  it('menolak listing PENDING_PAYMENT (bukan ACTIVE)', async () => {
    mocks.prisma.secondaryListing.updateMany.mockResolvedValue({ count: 0 });

    const response = await DELETE(deleteRequest('lst_pay'), deleteContext('lst_pay'));

    expect(response.status).toBe(409);
    // Guard tetap meminta status ACTIVE, jadi listing PENDING_PAYMENT tidak pernah cocok.
    expect(mocks.prisma.secondaryListing.updateMany).toHaveBeenCalledWith({
      where: { id: 'lst_pay', sellerId: owner.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Tanpa autentikasi → 401
// ---------------------------------------------------------------------------

describe('DELETE /api/secondary/[id] — tanpa autentikasi', () => {
  it('mengembalikan 401 dan tidak menyentuh DB', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await DELETE(deleteRequest('lst_1'), deleteContext('lst_1'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mocks.prisma.secondaryListing.updateMany).not.toHaveBeenCalled();
  });
});
