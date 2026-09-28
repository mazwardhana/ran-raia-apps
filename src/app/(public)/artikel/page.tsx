import { Badge, Card, Container, Grid, GridCol, Group, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { generateSeo } from '@/lib/seo';
import { articles as fixtureArticles } from '../../../../prisma/seed-data/articles';
import type { SeedArticle } from '../../../../prisma/seed-data/articles';

export const dynamic = 'force-dynamic';

export const metadata = generateSeo({
  title: 'Artikel Investasi Ternak | Raia',
  description:
    'Panduan lengkap investasi ternak: jasa gaduh, lot gotong royong, ta\'awun, cara memilih platform, dan panduan secondary market.',
  path: '/artikel',
  keywords: ['artikel investasi ternak', 'jasa gaduh', 'panduan investasi ternak', 'ta\'awun'],
});

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default async function ArtikelListPage() {
  let items: SeedArticle[] = [];

  try {
    const fromDb = await prisma.article.findMany({
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    items = fromDb.map((a) => ({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt ?? '',
      content: a.content,
      coverImage: a.coverImage ?? '',
      authorName: a.authorName ?? '',
      publishedAt: a.publishedAt ?? new Date(),
      metaTitle: a.metaTitle ?? '',
      metaDescription: a.metaDescription ?? '',
      keywords: a.keywords,
    }));
  } catch {
    items = [];
  }

  if (items.length === 0) items = fixtureArticles;

  return (
    <Container size="lg" py={60}>
      <Stack gap="xl">
        <div>
          <Title order={1} mb="xs">Artikel</Title>
          <Text c="dimmed" size="lg">
            Panduan memahami investasi ternak, dari jasa gaduh hingga secondary market.
          </Text>
        </div>

        <Grid>
          {items.map((article) => (
            <GridCol key={article.slug} span={{ base: 12, md: 6, lg: 4 }}>
              <Card
                shadow="sm"
                padding="lg"
                radius="md"
                h="100%"
                component={Link}
                href={`/artikel/${article.slug}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <Stack gap="sm">
                  <Group gap="xs">
                    <Badge variant="light" color="grape">Artikel</Badge>
                    <Text size="xs" c="dimmed">{formatDate(article.publishedAt)}</Text>
                  </Group>
                  <Text fw={600} size="md" lineClamp={2} inherit>
                    {article.title}
                  </Text>
                  <Text size="sm" c="dimmed" lineClamp={3}>
                    {article.excerpt}
                  </Text>
                  <Text size="xs" c="dimmed" component="span">
                    {article.authorName}
                  </Text>
                </Stack>
              </Card>
            </GridCol>
          ))}
        </Grid>

        {items.length === 0 && (
          <Text c="dimmed" ta="center">Belum ada artikel.</Text>
        )}
      </Stack>
    </Container>
  );
}
