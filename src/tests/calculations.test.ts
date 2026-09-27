import { describe, it, expect } from 'vitest';
import {
  calcProfitSplit,
  calcInvestorShare,
  calcLotOrder,
  calcListingExpiry,
} from '@/lib/calculations';

describe('calcProfitSplit', () => {
  it('respects 60/40 split and sum equals gross', () => {
    const result = calcProfitSplit(1000000, 60);
    expect(result.raia).toBe(600000);
    expect(result.investor).toBe(400000);
    expect(result.raia + result.investor).toBe(1000000);
  });

  it('handles odd amounts without losing rupiah', () => {
    const result = calcProfitSplit(1000001, 60);
    // raia gets floor(1000001 * 60 / 100) = 600000
    // investor gets remainder 400001
    expect(result.raia).toBe(600000);
    expect(result.investor).toBe(400001);
    expect(result.raia + result.investor).toBe(1000001);
  });

  it('handles 100% raia share', () => {
    const result = calcProfitSplit(500000, 100);
    expect(result.raia).toBe(500000);
    expect(result.investor).toBe(0);
    expect(result.raia + result.investor).toBe(500000);
  });

  it('handles 0% raia share', () => {
    const result = calcProfitSplit(500000, 0);
    expect(result.raia).toBe(0);
    expect(result.investor).toBe(500000);
    expect(result.raia + result.investor).toBe(500000);
  });

  it('throws on negative gross amount', () => {
    expect(() => calcProfitSplit(-1000, 60)).toThrow('grossAmount tidak boleh negatif');
  });

  it('throws on invalid raia percent', () => {
    expect(() => calcProfitSplit(1000, -5)).toThrow('raiaPercent harus 0-100');
    expect(() => calcProfitSplit(1000, 101)).toThrow('raiaPercent harus 0-100');
  });
});

describe('calcInvestorShare', () => {
  it('calculates proportional share correctly', () => {
    // 1000000 total investor share, investor owns 50 of 100 lots
    const share = calcInvestorShare(1000000, 50, 100);
    expect(share).toBe(500000);
  });

  it('floors to avoid losing rupiah', () => {
    // 1000001 total, 50 of 100 lots
    const share = calcInvestorShare(1000001, 50, 100);
    expect(share).toBe(500000); // floor of 500000.5
  });

  it('handles single lot ownership', () => {
    const share = calcInvestorShare(1000000, 1, 100);
    expect(share).toBe(10000);
  });

  it('returns 0 for 0 lots owned', () => {
    const share = calcInvestorShare(1000000, 0, 100);
    expect(share).toBe(0);
  });

  it('returns 0 when total lots is 0', () => {
    const share = calcInvestorShare(1000000, 50, 0);
    expect(share).toBe(0);
  });

  it('throws when investor lots exceed total', () => {
    expect(() => calcInvestorShare(1000000, 150, 100)).toThrow(
      'investorLotCount melebihi totalLots'
    );
  });
});

describe('calcLotOrder', () => {
  it('accepts order meeting minimum checkout', () => {
    const result = calcLotOrder(5, 10000, 50000);
    expect(result.ok).toBe(true);
    expect(result.subtotal).toBe(50000);
    expect(result.error).toBeUndefined();
  });

  it('accepts order above minimum', () => {
    const result = calcLotOrder(10, 10000, 50000);
    expect(result.ok).toBe(true);
    expect(result.subtotal).toBe(100000);
  });

  it('rejects order below minimum checkout', () => {
    const result = calcLotOrder(4, 10000, 50000);
    expect(result.ok).toBe(false);
    expect(result.subtotal).toBe(40000);
    expect(result.error).toContain('Minimum pembelian Rp50.000');
    expect(result.error).toContain('5 lot');
  });

  it('rejects non-integer lot count', () => {
    const result = calcLotOrder(5.5, 10000, 50000);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Jumlah lot tidak valid');
  });

  it('rejects zero or negative lot count', () => {
    expect(calcLotOrder(0, 10000, 50000).ok).toBe(false);
    expect(calcLotOrder(-1, 10000, 50000).ok).toBe(false);
  });
});

describe('calcListingExpiry', () => {
  it('adds exactly N days to listedAt', () => {
    const listedAt = new Date('2026-01-01T10:00:00Z');
    const expiry = calcListingExpiry(listedAt, 7);
    expect(expiry.toISOString()).toBe(new Date('2026-01-08T10:00:00Z').toISOString());
  });

  it('handles month boundaries', () => {
    const listedAt = new Date('2026-01-28T10:00:00Z');
    const expiry = calcListingExpiry(listedAt, 7);
    expect(expiry.toISOString()).toBe(new Date('2026-02-04T10:00:00Z').toISOString());
  });

  it('handles year boundaries', () => {
    const listedAt = new Date('2025-12-30T10:00:00Z');
    const expiry = calcListingExpiry(listedAt, 7);
    expect(expiry.toISOString()).toBe(new Date('2026-01-06T10:00:00Z').toISOString());
  });

  it('throws on non-positive days', () => {
    const listedAt = new Date('2026-01-01T10:00:00Z');
    expect(() => calcListingExpiry(listedAt, 0)).toThrow('days harus positif');
    expect(() => calcListingExpiry(listedAt, -1)).toThrow('days harus positif');
  });

  it('throws on non-finite days', () => {
    const listedAt = new Date('2026-01-01T10:00:00Z');
    expect(() => calcListingExpiry(listedAt, NaN)).toThrow('days harus positif');
    expect(() => calcListingExpiry(listedAt, Infinity)).toThrow('days harus positif');
  });
});
