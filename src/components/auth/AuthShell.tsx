import { Box, Card, Group, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

// Gradien identitas Raia, sama dengan hero landing. Putih di atas #0F766E = 5.47:1
// dan di atas #14513B = 9.25:1, jadi semua teks di panel ini lulus WCAG AA.
const BRAND_BACKGROUND = 'linear-gradient(135deg, #0F766E 0%, #14513B 100%)';

// Poin nilai jujur, senada dengan VALUE_PROPS di landing. Tanpa klaim return
// yang tidak bisa diperiksa.
const VALUE_POINTS = [
  'Mulai dari Rp10.000 per lot gotong royong',
  "Ta'awun 100% mengganti nilai ternak bila ternak meninggal",
  'Secondary market 7 hari, tanpa potongan saat diambil alih',
];

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <Box mih="100vh" bg="gray.0">
      <Group gap={0} align="stretch" wrap="nowrap" mih="100vh">
        {/* Panel brand desktop. `visibleFrom` menyembunyikannya di bawah 768px
            supaya mobile memakai header ringkas, bukan gradien penuh layar. */}
        <Box
          visibleFrom="md"
          w="42%"
          p={{ base: 32, lg: 56 }}
          style={{
            background: BRAND_BACKGROUND,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <Text c="white" fw={700} fz={32}>
            Raia
          </Text>

          <Stack gap="xl">
            <Text c="white" fw={700} fz={{ base: 28, lg: 34 }} style={{ lineHeight: 1.2 }}>
              Investasi ternak yang bisa Anda periksa
            </Text>
            <Text c="white" fz="lg">
              Kelola paket ternak, pantau laporan, dan jual aset kapan saja langsung dari ponsel.
            </Text>

            <Stack gap="md" mt="md">
              {VALUE_POINTS.map((point) => (
                <Group key={point} gap="sm" align="flex-start" wrap="nowrap">
                  <Box
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      marginTop: 8,
                      flexShrink: 0,
                    }}
                  />
                  <Text c="white">{point}</Text>
                </Group>
              ))}
            </Stack>
          </Stack>

          <Text c="white" fz="sm" opacity={0.85}>
            Platform investasi ternak gotong royong
          </Text>
        </Box>

        {/* Kolom form: latar halaman gray.0 dan kartu putih terpisah. */}
        <Box
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 'clamp(20px, 5vw, 48px)',
          }}
        >
          {/* Header ringkas mobile: brand + satu kalimat nilai, tanpa gradien penuh. */}
          <Box hiddenFrom="md" w="100%" maw={440} mb="lg">
            <Text c="teal.7" fw={700} fz="xl">
              Raia
            </Text>
            <Text c="dimmed" fz="sm" mt={4}>
              Investasi ternak yang bisa Anda periksa
            </Text>
          </Box>

          <Card w="100%" maw={440} padding="lg">
            <Stack gap="xs" mb="lg">
              <Title order={1} fz={{ base: 24, sm: 28 }}>
                {title}
              </Title>
              {subtitle ? (
                <Text c="dimmed" fz="sm">
                  {subtitle}
                </Text>
              ) : null}
            </Stack>

            {children}
          </Card>
        </Box>
      </Group>
    </Box>
  );
}
