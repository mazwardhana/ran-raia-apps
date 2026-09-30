import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: { user: { upsert: vi.fn() } } }));

describe('ensureTreasuryUser', () => {
  it('menetapkan username raia_treasury dan role SYSTEM', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { ensureTreasuryUser, TREASURY_USERNAME } = await import('@/lib/treasury');
    await ensureTreasuryUser(prisma as never);
    const args = vi.mocked(prisma.user.upsert).mock.calls[0][0];
    expect(TREASURY_USERNAME).toBe('raia_treasury');
    expect(args.where.username).toBe('raia_treasury');
    expect(args.create.role).toBe('SYSTEM');
    expect(args.update.role).toBe('SYSTEM');
    // Sandi acak baru ditulis ulang saat update supaya kredensial lama
    // (mis. didaftarkan lewat /api/auth/register) tidak pernah tersisa valid.
    expect(args.update.passwordHash).toBe(args.create.passwordHash);
    expect(typeof args.update.passwordHash).toBe('string');
  });
});
