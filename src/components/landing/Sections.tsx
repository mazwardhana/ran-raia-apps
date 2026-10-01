import {
  Anchor,
  Box,
  Button,
  Card,
  Container,
  Grid,
  GridCol,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconCheck,
  IconChecklist,
  IconFileSearch,
  IconHeartHandshake,
  IconReceipt2,
  IconShieldCheck,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import type { Article } from '@prisma/client';
import { PackageImage } from '@/components/ui/PackageImage';
import { HOW_IT_WORKS, VALUE_PROPS, WHY_RAIA, type PackageCardData } from './data';
import { FaqAccordion } from './FaqAccordion';

// Warna identitas institusional: dipakai gradien hero dan teks tombol CTA.
const TEAL = '#0F766E';
// Nuansa teal-7 untuk ikon dekoratif di atas kartu terang; beda peran dari TEAL.
const TEAL_ICON = 'var(--mantine-color-teal-7)';

// Gradien identitas: teal institusional, bukan ungu default template.
// Putih di atas TEAL = 5.47:1 dan di atas #14513B = 9.25:1, lulus AA.
const HERO_BACKGROUND = `linear-gradient(135deg, ${TEAL} 0%, #14513B 100%)`;

// Langkah transparansi menggantikan testimoni. Kami tidak menampilkan kutipan
// pengguna yang belum ada; yang ditampilkan hanya hal yang bisa diperiksa.
const AUDIT_STEPS = [
  {
    icon: IconFileSearch,
    title: 'Legalitas site terbuka',
    description:
      'Setiap paket menampilkan badan hukum PT, lokasi site, dan jenis ternak. Semua bisa Anda periksa sebelum membeli.',
  },
  {
    icon: IconReceipt2,
    title: 'Rincian biaya sebelum bayar',
    description:
      'Komposisi harga (ternak, ta\'awun, sewa kandang, pakan, tenaga kerja, obat) tampil rinci di halaman paket, sebelum checkout.',
  },
  {
    icon: IconHeartHandshake,
    title: 'Dana ta\'awun terpisah',
    description:
      'Iuran ta\'awun dicatat terpisah dan dipakai untuk mengganti nilai ternak bila ternak meninggal, sesuai prinsip syariah.',
  },
  {
    icon: IconChecklist,
    title: 'Laporan ternak bisa dipantau',
    description:
      'Dashboard investor menampilkan status kesehatan, laporan produksi, dan riwayat profit yang bisa Anda buka kapan saja dari ponsel.',
  },
];

export function Hero() {
  return (
    <Box py={{ base: 48, md: 72 }} style={{ background: HERO_BACKGROUND }}>
      <Container size="lg">
        <Grid align="center" gutter="xl">
          <GridCol span={{ base: 12, md: 7 }}>
            <Stack gap="xl">
              <Title
                order={1}
                c="white"
                fw={700}
                style={{
                  fontSize: 'clamp(28px, 7vw, 44px)',
                  lineHeight: 1.15,
                  textWrap: 'balance',
                }}
              >
                Investasi Ternak Digital Transparan dan Aman
              </Title>
              <Text size="lg" c="white" maw={620}>
                Mulai dari Rp10.000 dengan sistem gotong royong. Dikelola operator profesional,
                laporan real-time, likuiditas terjamin 7 hari.
              </Text>
              <Group>
                <Button
                  component={Link}
                  href="/register"
                  size="xl"
                  color="white"
                  radius="md"
                  style={{ color: TEAL, fontWeight: 700 }}
                >
                  Daftar Sekarang
                </Button>
              </Group>
            </Stack>
          </GridCol>
          <GridCol span={{ base: 12, md: 5 }}>
            <Image
              src="/images/default-kambing.svg"
              alt="Ilustrasi contoh kambing menghadap ke kiri, bukan foto asli"
              width={600}
              height={400}
              priority
              unoptimized
              style={{ width: '100%', height: 'auto', borderRadius: 16 }}
            />
            <Text size="xs" mt="xs" ta="center" c="white">
              Ilustrasi contoh. Foto asli ternak dan kandang segera menyusul.
            </Text>
          </GridCol>
        </Grid>
      </Container>
    </Box>
  );
}

export function ValuePropositions() {
  return (
    <Container size="lg" py={60}>
      <Stack gap="xl">
        <Title order={2} ta="center">Kenapa Investasi Ternak di Raia?</Title>
        <Grid>
          {VALUE_PROPS.map((prop, i) => (
            <GridCol key={i} span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" h="100%" withBorder bg="white">
                <Stack gap="md">
                  <IconCheck size={32} color={TEAL_ICON} />
                  <Text fw={600} size="lg">{prop.title}</Text>
                  <Text size="sm" c="dimmed">{prop.description}</Text>
                </Stack>
              </Card>
            </GridCol>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}

export function HowItWorksSection() {
  return (
    <Box py={60} style={{ backgroundColor: 'var(--mantine-color-white)' }}>
      <Container size="lg">
        <Stack gap="xl">
          <Title order={2} ta="center">Cara Kerja</Title>
          <Stack gap="lg">
            {HOW_IT_WORKS.map((item, i) => (
              <Card key={i} shadow="sm" padding="lg" radius="md" withBorder bg="white">
                <Group align="flex-start">
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: TEAL_ICON,
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </Box>
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Text fw={600} size="lg">{item.step}</Text>
                    <Text size="sm" c="dimmed">{item.description}</Text>
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

export function WhyRaiaSection() {
  const icons = [IconTrendingUp, IconShieldCheck, IconUsers];

  return (
    <Container size="lg" py={60}>
      <Stack gap="xl">
        <Title order={2} ta="center">Diferensiasi Raia</Title>
        <Grid>
          {WHY_RAIA.map((item, i) => {
            const Icon = icons[i] ?? IconCheck;
            return (
              <GridCol key={i} span={{ base: 12, md: 4 }}>
                <Card shadow="sm" padding="lg" radius="md" h="100%" withBorder bg="white">
                  <Stack gap="md">
                    <Icon size={32} color={TEAL_ICON} />
                    <Text fw={600} size="lg">{item.title}</Text>
                    <Text size="sm" c="dimmed">{item.description}</Text>
                  </Stack>
                </Card>
              </GridCol>
            );
          })}
        </Grid>
      </Stack>
    </Container>
  );
}

export function TransparencySection() {
  return (
    <Box py={60} style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
      <Container size="lg">
        <Stack gap="xl">
          <Stack gap="xs">
            <Title order={2} ta="center">Transparansi dan Audit</Title>
            <Text size="sm" c="dimmed" ta="center" maw={720} mx="auto">
              Kami belum menampilkan testimoni pengguna karena belum ada yang bisa kami
              pertanggungjawabkan ke publik. Yang kami tampilkan adalah hal yang bisa Anda
              periksa sendiri di dalam aplikasi.
            </Text>
          </Stack>
          <Grid>
            {AUDIT_STEPS.map((step) => (
              <GridCol key={step.title} span={{ base: 12, sm: 6 }}>
                <Card shadow="sm" padding="lg" radius="md" h="100%" withBorder bg="white">
                  <Group align="flex-start" wrap="nowrap">
                    <step.icon size={32} color={TEAL_ICON} aria-hidden="true" />
                    <Stack gap="xs">
                      <Text fw={600} size="lg">{step.title}</Text>
                      <Text size="sm" c="dimmed">{step.description}</Text>
                    </Stack>
                  </Group>
                </Card>
              </GridCol>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}

// Nama lama dipertahankan sebagai alias supaya halaman landing tetap komposisinya
// tanpa mengubah page.tsx. Isinya sudah bukan testimoni, melainkan transparansi.
export const TestimonialsSection = TransparencySection;

export function FaqSection() {
  return (
    <Container size="lg" py={60}>
      <Stack gap="xl">
        <Title order={2} ta="center">Pertanyaan Umum</Title>
        <FaqAccordion />
      </Stack>
    </Container>
  );
}

export function FinalCta() {
  return (
    <Box py={60} style={{ background: HERO_BACKGROUND }}>
      <Container size="lg">
        <Stack gap="xl" align="center" ta="center">
          <Title order={2} c="white" style={{ fontSize: 'clamp(24px, 6vw, 40px)', textWrap: 'balance' }}>
            Siap Mulai Investasi Ternak?
          </Title>
          <Text size="lg" c="white" maw={600}>
            Buka akun dalam 5 menit, pilih paket, dan pantau investasi Anda langsung dari ponsel.
          </Text>
          <Button
            component={Link}
            href="/register"
            size="xl"
            color="white"
            radius="md"
            style={{ color: TEAL, fontWeight: 700 }}
          >
            Daftar Sekarang
          </Button>
        </Stack>
      </Container>
    </Box>
  );
}

export function FeaturedPackages({ packages }: { packages: PackageCardData[] }) {
  return (
    <Box py={60} style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
      <Container size="lg">
        <Stack gap="xl">
          <Title order={2} ta="center">Paket Unggulan</Title>
          <Grid>
            {packages.slice(0, 3).map((pkg) => (
              <GridCol key={pkg.code} span={{ base: 12, md: 4 }}>
                <Card shadow="sm" padding="lg" radius="md" h="100%" withBorder bg="white">
                  <Stack gap="md">
                    <PackageImage
                      src={pkg.coverImage}
                      animalType={pkg.animalType}
                      alt={`Ilustrasi ${pkg.animalType === 'KAMBING' ? 'kambing' : 'sapi'} paket ${pkg.title}`}
                      height={160}
                    />
                    <Text fw={600} size="lg">{pkg.title}</Text>
                    <Text size="sm" c="dimmed">{pkg.description || 'Paket investasi ternak'}</Text>
                    <Group justify="space-between">
                      <Box>
                        <Text size="xs" c="dimmed">Harga Paket</Text>
                        <Text fw={700} size="lg">Rp{pkg.price.toLocaleString('id-ID')}</Text>
                      </Box>
                      <Box>
                        <Text size="xs" c="dimmed">ROI Estimasi</Text>
                        <Text fw={700} size="lg" c="teal.7">{pkg.estimatedRoi || 0}%</Text>
                      </Box>
                    </Group>
                    <Text size="xs" c="dimmed">{pkg.legalEntity} • {pkg.location}</Text>
                    <Button component={Link} href="/paket" variant="light" fullWidth>
                      Lihat Detail
                    </Button>
                  </Stack>
                </Card>
              </GridCol>
            ))}
          </Grid>
          <Group justify="center">
            <Button component={Link} href="/paket" variant="outline" size="md">
              Lihat Semua Paket
            </Button>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}

export function LatestArticles({ articles }: { articles: Article[] }) {
  return (
    <Box py={60} style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
      <Container size="lg">
        <Stack gap="xl">
          <Title order={2} ta="center">Artikel Terbaru</Title>
          <Grid>
            {articles.slice(0, 3).map((article) => (
              <GridCol key={article.slug} span={{ base: 12, md: 4 }}>
                <Card className="card-hover" shadow="sm" padding="lg" radius="md" h="100%" withBorder bg="white" component={Link} href={`/artikel/${article.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Stack gap="md">
                    <Text fw={600} size="md" lineClamp={2}>{article.title}</Text>
                    <Text size="sm" c="dimmed" lineClamp={3}>{article.excerpt}</Text>
                    <Anchor component="span" size="sm">Baca selengkapnya</Anchor>
                  </Stack>
                </Card>
              </GridCol>
            ))}
          </Grid>
          <Group justify="center">
            <Button component={Link} href="/artikel" variant="outline" size="md">
              Lihat Semua Artikel
            </Button>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
