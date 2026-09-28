import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type KycPhotoType = 'ktp' | 'selfie';

/**
 * Satu-satunya sumber kebenaran untuk tipe gambar yang boleh disimpan.
 * Mengembalikan ekstensi berkas, atau null bila tipe tidak didukung.
 */
export function extensionForImageType(contentType: string): string | null {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    default:
      return null;
  }
}

export function contentTypeForPath(storedPath: string): string {
  return path.extname(storedPath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
}

/**
 * Direktori penyimpanan foto KTP, sengaja di luar `public/` supaya berkas
 * tidak bisa diambil publik lewat URL. Di kontainer nilainya `/app/data/kyc`.
 */
export function getKycStorageDir(): string {
  return process.env.KYC_STORAGE_DIR || path.join(process.cwd(), 'data', 'kyc');
}

/**
 * Menyimpan foto memakai nama tetap per pengguna & jenis foto. Nama berkas
 * dari klien tidak pernah dipakai, sehingga aman dari path traversal.
 * Mengembalikan path relatif terhadap direktori penyimpanan.
 */
export async function saveKycPhoto(
  userId: string,
  type: KycPhotoType,
  file: File
): Promise<string> {
  const extension = extensionForImageType(file.type);
  if (!extension) {
    throw new Error(`Tipe gambar tidak didukung: ${file.type}`);
  }

  const dir = getKycStorageDir();
  await mkdir(dir, { recursive: true });

  const filename = `${userId}-${type}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);

  return filename;
}

/**
 * Membaca foto dari penyimpanan. Mengembalikan null bila berkas tidak ada
 * atau path-nya keluar dari direktori penyimpanan.
 */
export async function readKycPhoto(storedPath: string): Promise<Buffer | null> {
  const dir = path.resolve(getKycStorageDir());
  const target = path.resolve(dir, storedPath);

  if (target !== path.join(dir, path.basename(target))) {
    return null;
  }

  try {
    return await readFile(target);
  } catch {
    return null;
  }
}
