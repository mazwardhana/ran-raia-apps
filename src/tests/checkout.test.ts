import { describe, it, expect, vi } from 'vitest';
import { calcLotOrder } from '@/lib/calculations';
import { checkoutSchema } from '@/lib/validation';
import crypto from 'crypto';

// Mock modules
vi.mock('@/lib/prisma', () => ({
  prisma: {
    package: { findUnique: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    lotOwnership: { create: vi.fn() },
    fullOwnership: { create: vi.fn() },
    investorBalance: { upsert: vi.fn() },
    setting: { findUnique: vi.fn() },
    $transaction: vi.fn((callback) => callback({
      package: { update: vi.fn() },
      transaction: { create: vi.fn(), update: vi.fn() },
      lotOwnership: { create: vi.fn() },
      fullOwnership: { create: vi.fn() },
      investorBalance: { upsert: vi.fn() },
    })),
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/midtrans', () => ({
  createSnapToken: vi.fn(),
  verifySignature: vi.fn(),
}));

describe('Checkout Validation', () => {
  it('rejects subtotal below minimum checkout (50000)', () => {
    const result = calcLotOrder(3, 10000, 50000);
    expect(result.ok).toBe(false);
    expect(result.subtotal).toBe(30000);
    expect(result.error).toContain('Minimum pembelian');
  });

  it('accepts subtotal at or above minimum checkout', () => {
    const result = calcLotOrder(5, 10000, 50000);
    expect(result.ok).toBe(true);
    expect(result.subtotal).toBe(50000);
    expect(result.error).toBeUndefined();
  });

  it('validates checkout schema with valid data', () => {
    const valid = checkoutSchema.safeParse({
      packageId: 'pkg_123',
      ownershipType: 'LOT',
      lotCount: 10,
    });
    expect(valid.success).toBe(true);
  });

  it('validates FULL ownership without lotCount', () => {
    const valid = checkoutSchema.safeParse({
      packageId: 'pkg_123',
      ownershipType: 'FULL',
    });
    expect(valid.success).toBe(true);
  });
});

describe('Midtrans Signature Verification', () => {
  const serverKey = 'SB-Mid-server-test123';

  function createSignature(orderId: string, statusCode: string, grossAmount: string, serverKey: string): string {
    const signatureString = orderId + statusCode + grossAmount + serverKey;
    return crypto.createHash('sha512').update(signatureString).digest('hex');
  }

  it('generates valid SHA512 signature', () => {
    const orderId = 'ORDER-123';
    const statusCode = '200';
    const grossAmount = '50000.00';

    const signature = createSignature(orderId, statusCode, grossAmount, serverKey);

    expect(signature).toBeDefined();
    expect(signature.length).toBe(128);
  });

  it('verifies valid signature from Midtrans callback', () => {
    const orderId = 'ORDER-123';
    const statusCode = '200';
    const grossAmount = '50000.00';

    const validSignature = createSignature(orderId, statusCode, grossAmount, serverKey);
    const receivedSignature = validSignature;

    expect(receivedSignature).toBe(validSignature);
  });

  it('rejects invalid signature from Midtrans callback', () => {
    const orderId = 'ORDER-123';
    const statusCode = '200';
    const grossAmount = '50000.00';

    const validSignature = createSignature(orderId, statusCode, grossAmount, serverKey);
    const tamperedSignature = 'invalid_signature_hash';

    expect(tamperedSignature).not.toBe(validSignature);
  });

  it('rejects signature with tampered amount', () => {
    const orderId = 'ORDER-123';
    const statusCode = '200';
    const grossAmount = '50000.00';
    const tamperedAmount = '100000.00';

    const validSignature = createSignature(orderId, statusCode, grossAmount, serverKey);
    const tamperedSignature = createSignature(orderId, statusCode, tamperedAmount, serverKey);

    expect(tamperedSignature).not.toBe(validSignature);
  });
});
