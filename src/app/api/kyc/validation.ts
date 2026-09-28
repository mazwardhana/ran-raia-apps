import { extensionForImageType, sniffImageType, type SniffedImageType } from './storage';

export const MAX_KYC_IMAGE_BYTES = 5 * 1024 * 1024;

const TEXT_LABELS: Record<string, string> = {
  nik: 'NIK',
  placeOfBirth: 'Tempat lahir',
  dateOfBirth: 'Tanggal lahir',
  address: 'Alamat lengkap',
};

/**
 * Mengambil nilai form yang benar-benar berkas. Bila kirim balikan berkas
 * sebagai teks biasa, hasilnya dianggap tidak ada (null).
 */
export function asUploadedFile(value: FormDataEntryValue | null): File | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    typeof value.name !== 'string' ||
    typeof value.type !== 'string' ||
    typeof value.size !== 'number' ||
    typeof value.arrayBuffer !== 'function'
  ) {
    return null;
  }

  return value as File;
}

/**
 * Validasi field teks KYC. Mengembalikan pesan kesalahan berbahasa
 * Indonesia, atau null bila seluruh field wajib terisi.
 */
export function validateKycText(form: FormData): string | null {
  for (const [field, label] of Object.entries(TEXT_LABELS)) {
    const value = form.get(field);

    if (typeof value !== 'string' || value.trim() === '') {
      return `${label} wajib diisi.`;
    }
  }

  return null;
}

export type KycImageValidation =
  | { ok: true; contentType: SniffedImageType }
  | { ok: false; error: string };

/**
 * Validasi satu berkas foto di sisi server: hanya JPEG/PNG (dicek dari magic
 * bytes, bukan hanya MIME dari klien) dan maksimal 5 MB. Tipe yang
 * dikembalikan adalah hasil sniffing byte, dipakai untuk ekstensi & penyajian.
 */
export async function validateKycImage(
  file: File,
  label: string
): Promise<KycImageValidation> {
  if (!extensionForImageType(file.type)) {
    return { ok: false, error: `${label} hanya boleh berformat JPEG atau PNG.` };
  }

  if (file.size > MAX_KYC_IMAGE_BYTES) {
    return { ok: false, error: `${label} melebihi batas 5 MB.` };
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const contentType = sniffImageType(header);

  if (!contentType) {
    return { ok: false, error: `${label} bukan gambar JPEG atau PNG yang valid.` };
  }

  return { ok: true, contentType };
}
