import type { Metadata } from 'next';

const SITE_NAME = 'Raia';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/**
 * Generate Metadata untuk halaman dengan defaults SEO yang baik.
 */
export function generateSeo(opts: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
  ogImage?: string;
  type?: 'website' | 'article';
}): Metadata {
  const {
    title,
    description,
    path = '/',
    keywords = [],
    ogImage,
    type = 'website',
  } = opts;

  const url = `${BASE_URL}${path}`;
  const image = ogImage || `${BASE_URL}/opengraph-image.png`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: image, width: 1200, height: 630 }],
      type,
      locale: 'id_ID',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

/**
 * JSON-LD untuk Article (SEO).
 */
export function articleJsonLd(article: {
  title: string;
  slug: string;
  description?: string;
  publishedAt?: Date | string | null;
  authorName?: string | null;
}) {
  const url = `${BASE_URL}/artikel/${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    url,
    datePublished: article.publishedAt
      ? new Date(article.publishedAt).toISOString()
      : undefined,
    author: article.authorName
      ? { '@type': 'Person', name: article.authorName }
      : undefined,
    publisher: { '@type': 'Organization', name: SITE_NAME },
  };
}

/**
 * JSON-LD untuk Organization (untuk landing page).
 */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/icons/icon-512.png`,
  };
}
