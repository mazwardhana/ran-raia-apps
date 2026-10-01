'use client';

import { Image, type MantineRadius } from '@mantine/core';

const DEFAULT_BY_ANIMAL: Record<string, string> = {
  KAMBING: '/images/default-kambing.svg',
  SAPI: '/images/default-sapi.svg',
};

export interface PackageImageProps {
  src?: string | null;
  animalType: string;
  alt: string;
  height?: number | string;
  radius?: MantineRadius;
  fit?: React.CSSProperties['objectFit'];
}

// Satu tempat untuk memutuskan gambar mana yang dipakai. Mantine Image sudah
// menangani dua kasus sekaligus: src kosong dan src gagal dimuat (404), jadi
// tidak perlu onError manual di setiap halaman.
export function PackageImage({
  src,
  animalType,
  alt,
  height = 160,
  radius = 'sm',
  fit = 'cover',
}: PackageImageProps) {
  const fallbackSrc = DEFAULT_BY_ANIMAL[animalType] ?? DEFAULT_BY_ANIMAL.KAMBING;

  return (
    <Image
      src={src || fallbackSrc}
      fallbackSrc={fallbackSrc}
      alt={alt}
      height={height}
      fit={fit}
      radius={radius}
    />
  );
}
