import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { BASE_URL } from '@/lib/seo';

// Sitemap menyentuh database, jadi jangan di-prerender saat build.
export const dynamic = 'force-dynamic';

const staticRoutes: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1 },
  { url: `${BASE_URL}/paket`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE_URL}/artikel`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE_URL}/login`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/register`, changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/syarat-ketentuan`, changeFrequency: 'yearly', priority: 0.3 },
  { url: `${BASE_URL}/kebijakan-privasi`, changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let articleRoutes: MetadataRoute.Sitemap = [];
  let packageRoutes: MetadataRoute.Sitemap = [];

  try {
    const [articles, packages] = await Promise.all([
      prisma.article.findMany({
        where: { publishedAt: { not: null } },
        select: { slug: true, updatedAt: true },
      }),
      prisma.package.findMany({
        where: { status: 'OPEN' },
        select: { id: true, updatedAt: true },
      }),
    ]);

    articleRoutes = articles.map((article) => ({
      url: `${BASE_URL}/artikel/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: 'monthly',
      priority: 0.7,
    }));

    packageRoutes = packages.map((pkg) => ({
      url: `${BASE_URL}/paket/${pkg.id}`,
      lastModified: pkg.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch {
    // Database tidak tersedia: sitemap tetap menyajikan rute statis.
  }

  return [...staticRoutes, ...articleRoutes, ...packageRoutes];
}
