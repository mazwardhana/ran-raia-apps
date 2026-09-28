import { Anchor, Box, Button, Card, Container, Grid, GridCol, Group, Stack, Text, Title } from '@mantine/core';
import { IconCheck, IconShieldCheck, IconTrendingUp, IconUsers } from '@tabler/icons-react';
import Link from 'next/link';
import type { Article } from '@prisma/client';
import { FAQ_ITEMS, HOW_IT_WORKS, TESTIMONIALS, VALUE_PROPS, WHY_RAIA, type PackageCardData } from './data';

export function Hero() {
  return (
    <Box py={{ base: 60, md: 80 }} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Container size="lg">
        <Stack gap="xl" align="center" ta="center">
          <Title order={1} c="white" size={48} fw={700}>
            Investasi Ternak Digital Transparan dan Aman
          </Title>
          <Text size="xl" c="white" maw={700}>
            Mulai dari Rp10.000 dengan sistem gotong royong. Dikelola operator profesional, laporan real-time, likuiditas terjamin 7 hari.
          </Text>
          <Button
            component={Link}
            href="/register"
            size="xl"
            color="yellow"
            radius="md"
            style={{ color: '#000', fontWeight: 700 }}
          >
            Daftar Sekarang
          </Button>
        </Stack>
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
              <Card shadow="sm" padding="lg" radius="md" h="100%">
                <Stack gap="md">
                  <IconCheck size={32} color="#667eea" />
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
    <Box py={60} style={{ backgroundColor: '#f8f9fa' }}>
      <Container size="lg">
        <Stack gap="xl">
          <Title order={2} ta="center">Cara Kerja</Title>
          <Stack gap="lg">
            {HOW_IT_WORKS.map((item, i) => (
              <Card key={i} shadow="sm" padding="lg" radius="md">
                <Group align="flex-start">
                  <Box
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      backgroundColor: '#667eea',
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
  return (
    <Container size="lg" py={60}>
      <Stack gap="xl">
        <Title order={2} ta="center">Diferensiasi Raia</Title>
        <Grid>
          {WHY_RAIA.map((item, i) => (
            <GridCol key={i} span={{ base: 12, md: 4 }}>
              <Card shadow="sm" padding="lg" radius="md" h="100%">
                <Stack gap="md">
                  {i === 0 && <IconTrendingUp size={32} color="#667eea" />}
                  {i === 1 && <IconShieldCheck size={32} color="#667eea" />}
                  {i === 2 && <IconUsers size={32} color="#667eea" />}
                  <Text fw={600} size="lg">{item.title}</Text>
                  <Text size="sm" c="dimmed">{item.description}</Text>
                </Stack>
              </Card>
            </GridCol>
          ))}
        </Grid>
      </Stack>
    </Container>
  );
}

export function TestimonialsSection() {
  return (
    <Box py={60} style={{ backgroundColor: '#f8f9fa' }}>
      <Container size="lg">
        <Stack gap="xl">
          <Group justify="space-between" align="center">
            <Title order={2}>Testimoni Pengguna</Title>
            <Text size="xs" c="dimmed" fw={600}>Data demo</Text>
          </Group>
          <Grid>
            {TESTIMONIALS.map((testimonial, i) => (
              <GridCol key={i} span={{ base: 12, md: 4 }}>
                <Card shadow="sm" padding="lg" radius="md" h="100%">
                  <Stack gap="md">
                    <Text size="sm" style={{ fontStyle: 'italic' }}>&ldquo;{testimonial.quote}&rdquo;</Text>
                    <Box>
                      <Text fw={600} size="sm">{testimonial.name}</Text>
                      <Text size="xs" c="dimmed">{testimonial.role}</Text>
                    </Box>
                  </Stack>
                </Card>
              </GridCol>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}

export function FaqSection() {
  return (
    <Container size="lg" py={60}>
      <Stack gap="xl">
        <Title order={2} ta="center">Pertanyaan Umum</Title>
        <Stack gap="md">
          {FAQ_ITEMS.map((item, i) => (
            <Card key={i} shadow="sm" padding="lg" radius="md">
              <Stack gap="sm">
                <Text fw={600} size="md">{item.question}</Text>
                <Text size="sm" c="dimmed">{item.answer}</Text>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}

export function FinalCta() {
  return (
    <Box py={60} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Container size="lg">
        <Stack gap="xl" align="center" ta="center">
          <Title order={2} c="white" size={40}>
            Siap Mulai Investasi Ternak?
          </Title>
          <Text size="lg" c="white" maw={600}>
            Buka akun dalam 5 menit, pilih paket, dan pantau investasi Anda langsung dari ponsel.
          </Text>
          <Button
            component={Link}
            href="/register"
            size="xl"
            color="yellow"
            radius="md"
            style={{ color: '#000', fontWeight: 700 }}
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
    <Container size="lg" py={60}>
      <Stack gap="xl">
        <Title order={2} ta="center">Paket Unggulan</Title>
        <Grid>
          {packages.slice(0, 3).map((pkg) => (
            <GridCol key={pkg.code} span={{ base: 12, md: 4 }}>
              <Card shadow="sm" padding="lg" radius="md" h="100%">
                <Stack gap="md">
                  <Text fw={600} size="lg">{pkg.title}</Text>
                  <Text size="sm" c="dimmed">{pkg.description || 'Paket investasi ternak'}</Text>
                  <Group justify="space-between">
                    <Box>
                      <Text size="xs" c="dimmed">Harga Paket</Text>
                      <Text fw={700} size="lg">Rp{pkg.price.toLocaleString('id-ID')}</Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed">ROI Estimasi</Text>
                      <Text fw={700} size="lg" c="green">{pkg.estimatedRoi || 0}%</Text>
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
  );
}

export function LatestArticles({ articles }: { articles: Article[] }) {
  return (
    <Box py={60} style={{ backgroundColor: '#f8f9fa' }}>
      <Container size="lg">
        <Stack gap="xl">
          <Title order={2} ta="center">Artikel Terbaru</Title>
          <Grid>
            {articles.slice(0, 3).map((article) => (
              <GridCol key={article.slug} span={{ base: 12, md: 4 }}>
                <Card shadow="sm" padding="lg" radius="md" h="100%" component={Link} href={`/artikel/${article.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Stack gap="md">
                    <Text fw={600} size="md" lineClamp={2}>{article.title}</Text>
                    <Text size="sm" c="dimmed" lineClamp={3}>{article.excerpt}</Text>
                    <Anchor component="span" size="sm">Baca selengkapnya →</Anchor>
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
