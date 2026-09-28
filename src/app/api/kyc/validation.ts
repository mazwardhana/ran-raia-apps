import { extensionForImageType } from './storage';

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

/**
 * Validasi satu berkas foto di sisi server: hanya JPEG/PNG dan maksimal 5 MB.
 * Mengembalikan pesan kesalahan berbahasa Indonesia, atau null bila sah.
 */
export function validateKycImage(file: File, label: string): string | null {
  if (!extensionForImageType(file.type)) {
    return `${label} hanya boleh berformat JPEG atau PNG.`;
  }

  if (file.size > MAX_KYC_IMAGE_BYTES) {
    return `${label} melebihi batas 5 MB.`;
  }

  return null;
}
