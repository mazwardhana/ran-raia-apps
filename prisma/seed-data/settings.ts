export interface SeedSetting {
  id: string;
  value: string;
}

// Konfigurasi bisnis default sesuai spesifikasi.
// Semua nilai dapat diubah dari dashboard operator (/op/settings).
export const settings: SeedSetting[] = [
  { id: 'raia_share_percent', value: '60' },
  { id: 'investor_share_percent', value: '40' },
  { id: 'min_checkout', value: '50000' },
  { id: 'default_lot_price', value: '10000' },
  { id: 'taawun_year_1', value: '300000' },
  { id: 'taawun_year_2_plus', value: '150000' },
  { id: 'secondary_market_days', value: '7' },
  { id: 'secondary_admin_fee_percent', value: '0' },
  { id: 'secondary_admin_fee_flat', value: '0' },
];
