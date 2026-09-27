import { Container, Stack, Text, Title, Anchor, Divider, Group } from '@mantine/core';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { articleJsonLd, generateSeo } from '@/lib/seo';
import { articles as fixtureArticles } from '../../../../../prisma/seed-data/articles';
import type { SeedArticle } from '../../../../../prisma/seed-data/articles';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

function toSeedShape(source: {
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  authorName: string | null;
  publishedAt: Date | null;
  metaTitle: string | null;
  metaDescription: string | null;
  keywords: string[];
}): SeedArticle {
  return {
    slug: source.slug,
    title: source.title,
    excerpt: source.excerpt ?? '',
    content: source.content,
    coverImage: source.coverImage ?? '',
    authorName: source.authorName ?? '',
    publishedAt: source.publishedAt ?? new Date(),
    metaTitle: source.metaTitle ?? '',
    metaDescription: source.metaDescription ?? '',
    keywords: source.keywords,
  };
}

async function getArticle(slug: string): Promise<SeedArticle | null> {
  try {
    const fromDb = await prisma.article.findUnique({ where: { slug } });
    if (fromDb) return toSeedShape(fromDb);
  } catch {
    // database tidak tersedia — jatuh ke fixture
  }
  return fixtureArticles.find((a) => a.slug === slug) ?? null;
}

function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export async function generateMetadata({ params }: PageProps) {
  const article = await getArticle(params.slug);
  if (!article) return {};

  return generateSeo({
    title: article.metaTitle || `${article.title} | Raia`,
    description:
      article.metaDescription ||
      article.excerpt ||
      'Artikel investasi ternak dari Raia.',
    path: `/artikel/${article.slug}`,
    keywords: article.keywords,
    type: 'article',
    ...(article.coverImage ? { ogImage: article.coverImage } : {}),
  });
}

export default async function ArtikelDetailPage({ params }: PageProps) {
  const article = await getArticle(params.slug);
  if (!article) notFound();

  const jsonLd = articleJsonLd({
    title: article.title,
    slug: article.slug,
    description: article.metaDescription || article.excerpt,
    publishedAt: article.publishedAt,
    authorName: article.authorName,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Container size="md" py={60}>
        <Stack gap="lg">
          <div>
            <Anchor href="/artikel" size="sm" mb="md" display="inline-block">
              ← Kembali ke Artikel
            </Anchor>
            <Title order={1} mb="sm">
              {article.title}
            </Title>
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Oleh {article.authorName || 'Tim Raia'}
              </Text>
              <Text size="sm" c="dimmed">•</Text>
              <Text size="sm" c="dimmed">
                {formatDate(article.publishedAt)}
              </Text>
            </Group>
            <Divider my="md" />
          </div>

          <div
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.7,
            }}
            dangerouslySetInnerHTML={{ __html: article.content }}
          />

          <Divider my="lg" />
          <Anchor href="/artikel" size="sm">
            ← Lihat artikel lainnya
          </Anchor>
        </Stack>
      </Container>
    </>
  );
}
