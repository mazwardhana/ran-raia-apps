/**
 * Fungsi kalkulasi bisnis murni untuk Raia.
 * Semua nilai dalam Rupiah (integer, tanpa desimal).
 */

export interface ProfitSplitResult {
  raia: number;
  investor: number;
}

/**
 * Split profit bersih sesuai persentase Raia/Investor.
 * Raia mendapat floor, sisa ke investor → jumlah selalu tepat sama gross.
 * Default: 60/40.
 */
export function calcProfitSplit(
  grossAmount: number,
  raiaPercent: number
): ProfitSplitResult {
  if (grossAmount < 0) throw new Error('grossAmount tidak boleh negatif');
  if (raiaPercent < 0 || raiaPercent > 100)
    throw new Error('raiaPercent harus 0-100');

  const raia = Math.floor((grossAmount * raiaPercent) / 100);
  const investor = grossAmount - raia;
  return { raia, investor };
}

/**
 * Bagi share investor per lot secara proporsional.
 * Pembulatan bawah agar tidak kehilangan rupiah (sisa ke porsi terbesar).
 */
export function calcInvestorShare(
  investorShareTotal: number,
  investorLotCount: number,
  totalLots: number
): number {
  if (totalLots <= 0) return 0;
  if (investorLotCount <= 0) return 0;
  if (investorLotCount > totalLots)
    throw new Error('investorLotCount melebihi totalLots');

  return Math.floor((investorShareTotal * investorLotCount) / totalLots);
}

export interface LotOrderResult {
  ok: boolean;
  subtotal: number;
  error?: string;
}

/**
 * Hitung subtotal beli lot, validasi minimum checkout.
 * Default minCheckout = 50000, lotPrice = 10000.
 */
export function calcLotOrder(
  lotCount: number,
  lotPrice: number,
  minCheckout: number
): LotOrderResult {
  if (!Number.isInteger(lotCount) || lotCount <= 0) {
    return { ok: false, subtotal: 0, error: 'Jumlah lot tidak valid' };
  }

  const subtotal = lotCount * lotPrice;

  if (subtotal < minCheckout) {
    return {
      ok: false,
      subtotal,
      error: `Minimum pembelian Rp${minCheckout.toLocaleString('id-ID')} (${Math.ceil(
        minCheckout / lotPrice
      )} lot)`,
    };
  }

  return { ok: true, subtotal };
}

/**
 * Hitung expiry listing secondary market: listedAt + days.
 * Default days = 7.
 */
export function calcListingExpiry(listedAt: Date, days: number): Date {
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('days harus positif');
  }
  const expiry = new Date(listedAt.getTime());
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Format rupiah untuk display.
 */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
