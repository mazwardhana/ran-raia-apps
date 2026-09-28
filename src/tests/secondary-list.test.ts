import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as listPOST } from '@/app/api/secondary/list/route';
import { GET as secondaryGET } from '@/app/api/secondary/route';
import { getCurrentUser, type CurrentUser } from '@/lib/auth';

// ---------------------------------------------------------------------------
// Mocks — pola yang sama dengan src/tests/reservations.test.ts.
// Prisma selalu di-mock; tidak pernah menyentuh DB nyata.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const prisma = {
    secondaryListing: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    lotOwnership: { findFirst: vi.fn(), findMany: vi.fn() },
    fullOwnership: { findFirst: vi.fn(), findMany: vi.fn() },
    package: { findUnique: vi.fn(), findMany: vi.fn() },
    setting: { findUnique: vi.fn() },
  };
  return { prisma };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/secondary', () => ({ expireStaleListings: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const user: CurrentUser = {
  id: 'usr_1',
  role: 'INVESTOR',
  username: 'budi',
  kycStatus: 'VERIFIED',
};

const pkg = {
  id: 'pkg_1',
  code: 'PKT-001',
  title: 'Paket Kambing Etawa Sleman',
  animalType: 'KAMBING',
  price: 10000000,
  siteProject: { name: 'Proyek Sleman' },
};

// Dua holding LOT untuk paket & user yang sama — hasil aturan akumulasi.
const holdingA = {
  id: 'own_A',
  packageId: 'pkg_1',
  lotStart: 421,
  lotEnd: 425,
  createdAt: new Date('2026-09-01T00:00:00Z'),
};
const holdingB = {
  id: 'own_B',
  packageId: 'pkg_1',
  lotStart: 600,
  lotEnd: 604,
  createdAt: new Date('2026-09-02T00:00:00Z'),
};

const existingListingA = {
  id: 'lst_A',
  sellerId: 'usr_1',
  packageId: 'pkg_1',
  ownershipType: 'LOT',
  lotStart: 421,
  lotEnd: 425,
  listingPrice: 10000000,
  status: 'ACTIVE',
};

const existingFullListing = {
  id: 'lst_F',
  sellerId: 'usr_1',
  packageId: 'pkg_1',
  ownershipType: 'FULL',
  lotStart: null,
  lotEnd: null,
  listingPrice: 10000000,
  status: 'ACTIVE',
};

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function listRequest(body: unknown): NextRequest {
  return jsonRequest('http://localhost/api/secondary/list', body);
}

/**
 * Emulasi pencocokan `where` Prisma untuk listing yang sudah ada.
 * Sengaja tidak menganggap `lotStart`/`lotEnd` yang absen sebagai wildcard:
 * query lama (tanpa field lot) akan cocok dengan holding A, query baru
 * (dengan lot 600-604) tidak boleh cocok.
 */
function findExistingListing(where: Record<string, unknown>) {
  const candidates = [existingListingA, existingFullListing];
  return (
    candidates.find((listing) => {
      if (where.packageId && where.packageId !== listing.packageId) return false;
      if (where.ownershipType && where.ownershipType !== listing.ownershipType)
        return false;
      if (where.status && where.status !== listing.status) return false;
      if (where.lotStart !== undefined && where.lotStart !== listing.lotStart)
        return false;
      if (where.lotEnd !== undefined && where.lotEnd !== listing.lotEnd)
        return false;
      return true;
    }) ?? null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue(user);

  mocks.prisma.secondaryListing.findFirst.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) =>
      findExistingListing(where)
  );
  mocks.prisma.secondaryListing.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'lst_new',
      ...data,
    })
  );
  mocks.prisma.setting.findUnique.mockResolvedValue({ value: '7' });
  mocks.prisma.package.findUnique.mockResolvedValue({ price: pkg.price });
  mocks.prisma.package.findMany.mockResolvedValue([pkg]);
});

// ---------------------------------------------------------------------------
// 1. `listed` badge — harus presisi per holding, bukan per paket
// ---------------------------------------------------------------------------

describe('GET /api/secondary — badge `listed` per holding', () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);

    // Hanya holding B (600-604) yang punya listing aktif.
    const activeListingB = {
      ...existingListingA,
      id: 'lst_B',
      lotStart: 600,
      lotEnd: 604,
    };

    // Public listings: kosong.
    // "Aset Saya": dua holding LOT, hanya holding B yang aktif.
    mocks.prisma.secondaryListing.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) => {
        if (where?.sellerId) return [activeListingB];
        return [];
      }
    );
    mocks.prisma.lotOwnership.findMany.mockResolvedValue([holdingA, holdingB]);
    mocks.prisma.fullOwnership.findMany.mockResolvedValue([]);
  });

  it('menandai hanya holding yang benar-benar terdaftar', async () => {
    const response = await secondaryGET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.myAssets).toHaveLength(2);

    const cardA = body.myAssets.find(
      (a: { ownershipId: string }) => a.ownershipId === 'own_A'
    );
    const cardB = body.myAssets.find(
      (a: { ownershipId: string }) => a.ownershipId === 'own_B'
    );

    // Holding A (421-425) tidak dijual → tidak boleh ikut menyala.
    expect(cardA.listed).toBe(false);
    // Holding B (600-604) sedang dijual → hanya kartu ini yang menyala.
    expect(cardB.listed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. POST /api/secondary/list — satu listing aktif per holding, bukan per paket
// ---------------------------------------------------------------------------

describe('POST /api/secondary/list — satu listing per holding', () => {
  it('mengizinkan listing holding LOT kedua yang berbeda', async () => {
    mocks.prisma.lotOwnership.findFirst.mockResolvedValue(holdingB);

    const response = await listPOST(
      listRequest({ ownershipType: 'LOT', ownershipId: 'own_B' })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.listing.id).toBe('lst_new');
    expect(mocks.prisma.secondaryListing.create).toHaveBeenCalledTimes(1);
  });

  it('tetap menolak holding LOT yang sama didaftarkan dua kali', async () => {
    mocks.prisma.lotOwnership.findFirst.mockResolvedValue(holdingA);

    const response = await listPOST(
      listRequest({ ownershipType: 'LOT', ownershipId: 'own_A' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Aset sudah terdaftar di secondary market');
    expect(mocks.prisma.secondaryListing.create).not.toHaveBeenCalled();
  });

  it('tetap menolak FULL kedua untuk paket yang sama', async () => {
    mocks.prisma.fullOwnership.findFirst.mockResolvedValue({
      id: 'own_F2',
      packageId: 'pkg_1',
    });

    const response = await listPOST(
      listRequest({ ownershipType: 'FULL', ownershipId: 'own_F2' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Aset sudah terdaftar di secondary market');
    expect(mocks.prisma.secondaryListing.create).not.toHaveBeenCalled();
  });
});
