import { createTheme, MantineColorsTuple } from '@mantine/core';

const green: MantineColorsTuple = [
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
  '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
];

export const theme = createTheme({
  primaryColor: 'green',
  colors: { green },
  fontFamily: 'Inter, system-ui, sans-serif',
  defaultRadius: 'md',
  components: {
    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: { backgroundOpacity: 0.55, blur: 3 },
      },
    },
    Card: {
      defaultProps: { shadow: 'md', radius: 'lg' },
    },
    Button: {
      defaultProps: { radius: 'md' },
    },
  },
});
