import { createTheme, CSSVariablesResolver, MantineColorsTuple } from '@mantine/core';

// Shade 6+ digelapkan dari ramp Tailwind default supaya teks putih di atasnya
// lulus WCAG AA 4.5:1. green-6 #15803d = 5.02:1 dan green-7 #166534 = 7.13:1,
// sementara green-6 lama #16a34a hanya 3.30:1 (gagal). Shade 0-5 tetap karena
// dipakai sebagai latar terang, bukan latar teks putih.
const green: MantineColorsTuple = [
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
  '#22c55e', '#15803d', '#166534', '#14532d', '#052e16',
];

// teal Mantine bawaan shade 7 #0ca678 hanya 3.12:1 di putih (gagal AA).
// Ramp kustom ini menurunkan shade 6+ : teal-6 #0f766e = 5.47:1 dan
// teal-7 #115e59 = 7.58:1, jadi link, ikon, dan badge tetap terbaca.
const teal: MantineColorsTuple = [
  '#e6fcf5', '#c3fae8', '#96f2d7', '#63e6be', '#38d9a9',
  '#14b8a6', '#0f766e', '#115e59', '#134e4a', '#042f2e',
];

// #5C6370 di putih = 6.05:1, lulus WCAG AA untuk teks sekunder.
// Ditimpa sekali di sini, bukan di 133 pemakaian c="dimmed".
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: { '--mantine-color-dimmed': '#5C6370' },
  dark: {},
});

export const theme = createTheme({
  primaryColor: 'green',
  colors: { green, teal },
  // --font-jakarta di-set oleh next/font di layout.tsx.
  fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
  defaultRadius: 'md',
  components: {
    // Jangan paksa `centered` di sini: BaseModal memakai Drawer bottom sheet
    // di mobile dan hanya memusatkan modal di layar >= 768px.
    Modal: {
      defaultProps: {
        overlayProps: { backgroundOpacity: 0.55, blur: 3 },
      },
    },
    Card: {
      // Border default supaya kartu terpisah dari latar yang warnanya berdekatan;
      // tanpa ini batas kartu hilang dan konten terlihat menyatu dengan background.
      defaultProps: { shadow: 'md', radius: 'lg', withBorder: true },
    },
    Button: {
      defaultProps: { radius: 'md' },
      // Target sentuh minimum 44px (WCAG 2.5.8 / Apple HIG) sebagai default,
      // supaya tidak perlu ditulis manual di ratusan tombol.
      styles: { root: { minHeight: 44 } },
    },
    ActionIcon: {
      defaultProps: { size: 44 },
    },
    Input: {
      styles: {
        // fontSize 16 mencegah auto-zoom iOS saat input difokus.
        input: { minHeight: 44, fontSize: 16 },
      },
    },
  },
});
