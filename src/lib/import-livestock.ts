/**
 * Parser CSV & validasi impor ternak.
 *
 * Kolom CSV diturunkan dari model Prisma `Livestock`:
 * - tagNumber   -> tagNumber (wajib, unique)
 * - nama        -> name (opsional)
 * - jenis_kelamin -> sex (String: JANTAN | BETINA, wajib)
 * - breed       -> breed (opsional)
 * - tanggal_lahir -> birthDate (opsional, ISO date)
 * - bobot_kg    -> weightKg (opsional, angka)
 * - tag_induk   -> motherTag (opsional)
 * Dua kolom tambahan untuk menempelkan ternak ke paket:
 * - kode_paket  -> resolusi packageId via kode Package (wajib)
 * - jenis_ternak -> enum AnimalType (KAMBING | SAPI), dicek sama dengan
 *   jenis kelamin paket yang dipilih (wajib)
 */

export const TEMPLATE_COLUMNS = [
  'kode_paket',
  'tagNumber',
  'nama',
  'jenis_ternak',
  'jenis_kelamin',
  'breed',
  'tanggal_lahir',
  'bobot_kg',
  'tag_induk',
] as const;

export const MAX_IMPORT_ROWS = 1000;

export const ANIMAL_TYPES = ['KAMBING', 'SAPI'] as const;
export const SEXES = ['JANTAN', 'BETINA'] as const;

export type Row = Record<string, string>;

export interface RowError {
  row: number;
  column: string;
  message: string;
}

export interface ValidLivestockRow {
  row: number;
  packageCode: string;
  animalType: string;
  tagNumber: string;
  name: string | null;
  sex: string;
  breed: string | null;
  birthDate: Date | null;
  weightKg: number | null;
  motherTag: string | null;
}

export interface LivestockCreateInput {
  packageId: string;
  tagNumber: string;
  name: string | null;
  sex: string;
  breed: string | null;
  birthDate: Date | null;
  weightKg: number | null;
  motherTag: string | null;
  status: string;
}

/**
 * Parser CSV hand-rolled (tanpa dependensi).
 * Mendukung quoted value (koma/newline di dalam kutip), kutip ganda (""),
 * baris CRLF/LF, dan melewati baris kosong. Baris pertama = header.
 */
export function parseCsv(text: string): Row[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;

  const endField = () => {
    record.push(field);
    field = '';
    fieldWasQuoted = false;
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === '') {
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (char === ',') {
      endField();
    } else if (char === '\r') {
      if (text[i + 1] === '\n') i++;
      endRecord();
    } else if (char === '\n') {
      endRecord();
    } else {
      field += char;
    }
  }

  if (field !== '' || record.length > 0 || fieldWasQuoted) {
    endRecord();
  }

  const nonEmpty = records.filter((cells) =>
    cells.some((cell) => cell.trim() !== '')
  );
  if (nonEmpty.length === 0) return [];

  const header = nonEmpty[0].map((cell) => cell.trim());
  return nonEmpty.slice(1).map((cells) => {
    const row: Row = {};
    header.forEach((key, index) => {
      if (key === '') return;
      row[key] = (cells[index] ?? '').trim();
    });
    return row;
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

function parseDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // Tangkap tanggal tidak nyata seperti 2024-13-45
  if (value.length === 10) {
    const [y, m, d] = value.split('-').map(Number);
    const check = new Date(Date.UTC(y, m - 1, d));
    if (
      check.getUTCFullYear() !== y ||
      check.getUTCMonth() !== m - 1 ||
      check.getUTCDate() !== d
    ) {
      return null;
    }
  }
  return date;
}

function parseNumber(value: string): number | null {
  if (value === '') return null;
  const normalized = value.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateRows(
  rows: Row[],
  existingTags: string[]
): { valid: ValidLivestockRow[]; errors: RowError[] } {
  if (rows.length > MAX_IMPORT_ROWS) {
    return {
      valid: [],
      errors: [
        {
          row: 0,
          column: 'file',
          message: `Maksimal ${MAX_IMPORT_ROWS} baris per impor.`,
        },
      ],
    };
  }

  const errors: RowError[] = [];
  const valid: ValidLivestockRow[] = [];
  const seenTags = new Set<string>();
  const knownTags = new Set(existingTags);

  rows.forEach((raw, index) => {
    const rowNumber = index + 1;
    const row: Row = {};
    for (const key of Object.keys(raw)) row[key] = (raw[key] ?? '').trim();

    const rowErrors: RowError[] = [];
    const fail = (column: string, message: string) =>
      rowErrors.push({ row: rowNumber, column, message });

    const tagNumber = row.tagNumber ?? '';
    const packageCode = row.kode_paket ?? '';
    const animalType = (row.jenis_ternak ?? '').toUpperCase();
    const sex = (row.jenis_kelamin ?? '').toUpperCase();

    if (tagNumber === '') {
      fail('tagNumber', 'Tag number wajib diisi.');
    } else {
      if (seenTags.has(tagNumber)) {
        fail('tagNumber', 'Tag number duplikat dalam file ini.');
      } else {
        seenTags.add(tagNumber);
      }
      if (knownTags.has(tagNumber)) {
        fail('tagNumber', 'Tag number sudah terdaftar di sistem.');
      }
    }

    if (packageCode === '') {
      fail('kode_paket', 'Kode paket wajib diisi.');
    }

    if (animalType === '') {
      fail('jenis_ternak', 'Jenis ternak wajib diisi.');
    } else if (!(ANIMAL_TYPES as readonly string[]).includes(animalType)) {
      fail(
        'jenis_ternak',
        `Jenis ternak tidak valid. Pilihan: ${ANIMAL_TYPES.join(', ')}.`
      );
    }

    if (sex === '') {
      fail('jenis_kelamin', 'Jenis kelamin wajib diisi.');
    } else if (!(SEXES as readonly string[]).includes(sex)) {
      fail(
        'jenis_kelamin',
        `Jenis kelamin tidak valid. Pilihan: ${SEXES.join(', ')}.`
      );
    }

    const birthRaw = row.tanggal_lahir ?? '';
    let birthDate: Date | null = null;
    if (birthRaw !== '') {
      birthDate = parseDate(birthRaw);
      if (!birthDate) {
        fail(
          'tanggal_lahir',
          'Tanggal lahir tidak valid. Gunakan format YYYY-MM-DD.'
        );
      }
    }

    const weightRaw = row.bobot_kg ?? '';
    let weightKg: number | null = null;
    if (weightRaw !== '') {
      weightKg = parseNumber(weightRaw);
      if (weightKg === null) {
        fail('bobot_kg', 'Bobot tidak valid. Gunakan angka dalam kg.');
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    valid.push({
      row: rowNumber,
      packageCode,
      animalType,
      tagNumber,
      name: row.nama !== undefined && row.nama !== '' ? row.nama : null,
      sex,
      breed: row.breed !== undefined && row.breed !== '' ? row.breed : null,
      birthDate,
      weightKg,
      motherTag:
        row.tag_induk !== undefined && row.tag_induk !== '' ? row.tag_induk : null,
    });
  });

  return { valid, errors };
}

function escapeCsv(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const TEMPLATE_SAMPLE: Row = {
  kode_paket: 'PAKET-01',
  tagNumber: 'K-001',
  nama: 'Domba Contoh',
  jenis_ternak: 'KAMBING',
  jenis_kelamin: 'BETINA',
  breed: 'Peranakan Ettawa',
  tanggal_lahir: '2024-01-01',
  bobot_kg: '12.5',
  tag_induk: 'K-000',
};

export function buildTemplateCsv(): string {
  const lines = [TEMPLATE_COLUMNS.join(',')];
  lines.push(TEMPLATE_COLUMNS.map((col) => escapeCsv(TEMPLATE_SAMPLE[col] ?? '')).join(','));
  return lines.join('\n');
}

/**
 * Konversi baris valid ke input `prisma.livestock.createMany`.
 * `packageIdByCode` memetakan kode paket (kolom kode_paket) -> Package.id.
 */
export function toLivestockCreateInputs(
  valid: ValidLivestockRow[],
  packageIdByCode: Record<string, string>
): { data: LivestockCreateInput[]; errors: RowError[] } {
  const data: LivestockCreateInput[] = [];
  const errors: RowError[] = [];

  for (const row of valid) {
    const packageId = packageIdByCode[row.packageCode];
    if (!packageId) {
      errors.push({
        row: row.row,
        column: 'kode_paket',
        message: `Paket dengan kode "${row.packageCode}" tidak ditemukan.`,
      });
      continue;
    }
    data.push({
      packageId,
      tagNumber: row.tagNumber,
      name: row.name,
      sex: row.sex,
      breed: row.breed,
      birthDate: row.birthDate,
      weightKg: row.weightKg,
      motherTag: row.motherTag,
      status: 'ACTIVE',
    });
  }

  return { data, errors };
}
