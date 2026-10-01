import { Stack } from '@mantine/core';
import { prisma } from '@/lib/prisma';
import { generateSeo, organizationJsonLd } from '@/lib/seo';
import { articles as articleFixtures } from '../../../prisma/seed-data/articles';
import { packages as packageFixtures } from '../../../prisma/seed-data/packages';
import type { PackageCardData } from '@/components/landing/data';
import {
  Hero,
  ValuePropositions,
  FeaturedPackages,
  HowItWorksSection,
  TestimonialsSection,
  WhyRaiaSection,
  LatestArticles,
  FaqSection,
  FinalCta,
} from '@/components/landing/Sections';

export const dynamic = 'force-dynamic';

export const metadata = generateSeo({
  title: 'Raia - Investasi Ternak Digital Transparan dan Aman',
  description:
    'Platform investasi ternak gotong royong mulai Rp10.000. Dikelola operator profesional, ta\'awun 100%, likuiditas 7 hari, laporan real-time dari ponsel.',
  path: '/',
  keywords: [
    'investasi ternak',
    'jasa gaduh',
    'kambing etawa',
    'sapi limosin',
    'investasi syariah',
    'gotong royong',
    'ta\'awun',
    'secondary market',
  ],
});

export default async function LandingPage() {
  let articles = await prisma.article.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  });

  if (articles.length === 0) {
    articles = articleFixtures.slice(0, 3).map((a) => ({
      id: a.slug,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      content: a.content,
      coverImage: a.coverImage,
      authorName: a.authorName,
      publishedAt: a.publishedAt,
      viewCount: 0,
      metaTitle: a.metaTitle,
      metaDescription: a.metaDescription,
      keywords: a.keywords,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  const packagesFromDb = await prisma.package.findMany({
    where: { status: 'OPEN' },
    include: { siteProject: true },
    take: 3,
    orderBy: { createdAt: 'desc' },
  });

  let packages: PackageCardData[] = packagesFromDb.map((pkg) => ({
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

  if (packages.length === 0) {
    packages = packageFixtures.slice(0, 3).map((p) => ({
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

  const jsonLd = organizationJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Stack gap={0}>
        <Hero />
        <ValuePropositions />
        <FeaturedPackages packages={packages} />
        <HowItWorksSection />
        <TestimonialsSection />
        <WhyRaiaSection />
        <LatestArticles articles={articles} />
        <FaqSection />
        <FinalCta />
      </Stack>
    </>
  );
}
