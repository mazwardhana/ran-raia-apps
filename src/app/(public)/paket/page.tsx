import { Badge, Box, Button, Card, Container, Divider, Grid, GridCol, Group, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { PackageImage } from '@/components/ui/PackageImage';
import { prisma } from '@/lib/prisma';
import { generateSeo } from '@/lib/seo';
import { packages as packageFixtures } from '../../../../prisma/seed-data/packages';
import type { PackageCardData } from '@/components/landing/data';

// Kartu publik perlu coverImage untuk gambar default; landing (Fase 3) belum
// memakainya, jadi perluas tipe di sini tanpa menyentuh kontrak landing.
type PublicPackageCardData = PackageCardData & { coverImage: string | null };

export const dynamic = 'force-dynamic';

export const metadata = generateSeo({
  title: 'Katalog Paket Investasi Ternak | Raia',
  description:
    'Jelajahi paket investasi ternak kambing dan sapi. Mulai dari Rp10.000 per lot atau beli paket utuh. Transparansi penuh, ta\'awun 100%.',
  path: '/paket',
  keywords: ['paket investasi ternak', 'kambing etawa', 'sapi limosin', 'investasi lot'],
});

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'gray',
    OPEN: 'green',
    RUNNING: 'blue',
    CLOSED: 'red',
    SOLD_OUT: 'orange',
  };
  return <Badge color={colors[status] || 'gray'}>{status}</Badge>;
}

export default async function PaketPublicPage() {
  let packages: PublicPackageCardData[] = [];

  try {
    const fromDb = await prisma.package.findMany({
      where: { status: { in: ['OPEN', 'RUNNING'] } },
      include: { siteProject: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    packages = fromDb.map((pkg) => ({
      code: pkg.code,
      title: pkg.title,
      animalType: pkg.animalType,
      periodMonths: pkg.periodMonths,
      price: pkg.price,
      lotPrice: pkg.lotPrice,
      totalLots: pkg.totalLots,
      soldLots: pkg.soldLots,
      status: pkg.status,
      description: pkg.description,
      coverImage: pkg.coverImage,
      estimatedRoi: pkg.estimatedRoi,
      siteName: pkg.siteProject.name,
      legalEntity: pkg.siteProject.legalEntity,
      location: `${pkg.siteProject.city}, ${pkg.siteProject.province}`,
    }));
  } catch {
    packages = [];
  }

  if (packages.length === 0) {
    packages = packageFixtures
      .filter((p) => p.status === 'OPEN' || p.status === 'RUNNING')
      .slice(0, 6)
      .map((p) => ({
        code: p.code,
        title: p.title,
        animalType: p.animalType,
        periodMonths: p.periodMonths,
        price: p.price,
        lotPrice: p.lotPrice,
        totalLots: p.totalLots,
        soldLots: p.soldLots,
        status: p.status,
        description: p.description,
        coverImage: p.coverImage,
        estimatedRoi: p.estimatedRoi,
        siteName: p.siteCode,
        legalEntity: 'PT Demo',
        location: 'Demo Location',
      }));
  }

  return (
    <Container size="lg" py={60}>
      <Stack gap="xl">
        <div>
          <Title order={1} mb="xs">
            Katalog Paket Investasi Ternak
          </Title>
          <Text c="dimmed" size="lg">
            Pilih paket ternak yang sesuai dengan budget dan tujuan investasi Anda.
          </Text>
        </div>

        <Box p="md" style={{ backgroundColor: '#e7f5ff', borderRadius: 8 }}>
          <Text size="sm" fw={600} mb="xs">
            Perlu akun untuk membeli paket
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            Daftar gratis untuk akses pembelian, dashboard investor, dan fitur lengkap lainnya.
          </Text>
          <Button component={Link} href="/register" size="sm">
            Daftar Sekarang
          </Button>
        </Box>

        <Grid>
          {packages.map((pkg) => (
            <GridCol key={pkg.code} span={{ base: 12, md: 6, lg: 4 }}>
              <Card shadow="sm" padding="lg" radius="md" h="100%">
                <Stack gap="md">
                  <PackageImage
                    src={pkg.coverImage}
                    animalType={pkg.animalType}
                    alt={`Ilustrasi ${pkg.animalType === 'KAMBING' ? 'kambing' : 'sapi'} paket ${pkg.title}`}
                    height={160}
                  />
                  <Group justify="space-between">
                    <StatusBadge status={pkg.status} />
                    <Badge variant="light">
                      {pkg.animalType === 'KAMBING' ? 'Kambing' : 'Sapi'}
                    </Badge>
                  </Group>

                  <div>
                    <Text fw={600} size="lg" mb="xs" lineClamp={2}>
                      {pkg.title}
                    </Text>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {pkg.description || 'Paket investasi ternak'}
                    </Text>
                  </div>

                  <Divider />

                  <Group justify="space-between">
                    <div>
                      <Text size="xs" c="dimmed">
                        Harga Paket
                      </Text>
                      <Text fw={700} size="md">
                        Rp{pkg.price.toLocaleString('id-ID')}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Estimasi ROI
                      </Text>
                      <Text fw={700} size="md" c="green">
                        {pkg.estimatedRoi || 0}%
                      </Text>
                    </div>
                  </Group>

                  <Group justify="space-between">
                    <div>
                      <Text size="xs" c="dimmed">
                        Harga per Lot
                      </Text>
                      <Text fw={600} size="sm">
                        Rp{pkg.lotPrice.toLocaleString('id-ID')}
                      </Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">
                        Slot Tersedia
                      </Text>
                      <Text fw={600} size="sm">
                        {pkg.totalLots - pkg.soldLots} / {pkg.totalLots}
                      </Text>
                    </div>
                  </Group>

                  <div>
                    <Text size="xs" c="dimmed" mb={2}>
                      Site Project
                    </Text>
                    <Text size="xs" fw={600}>
                      {pkg.legalEntity}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {pkg.location}
                    </Text>
                  </div>

                  <Button component={Link} href="/register" variant="light" fullWidth>
                    Daftar untuk Membeli
                  </Button>
                </Stack>
              </Card>
            </GridCol>
          ))}
        </Grid>

        {packages.length === 0 && (
          <Text c="dimmed" ta="center">
            Belum ada paket tersedia.
          </Text>
        )}
      </Stack>
    </Container>
  );
}
