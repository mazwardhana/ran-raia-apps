import { createTheme, CSSVariablesResolver, MantineColorsTuple } from '@mantine/core';

const green: MantineColorsTuple = [
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
  '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
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
  colors: { green },
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
      defaultProps: { shadow: 'md', radius: 'lg' },
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
