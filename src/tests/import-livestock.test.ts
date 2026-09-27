import { describe, it, expect } from 'vitest';

import {
  TEMPLATE_COLUMNS,
  parseCsv,
  validateRows,
  buildTemplateCsv,
  toLivestockCreateInputs,
} from '@/lib/import-livestock';

function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    kode_paket: 'PAKET-01',
    tagNumber: 'K-001',
    nama: 'Domba Sehat',
    jenis_ternak: 'KAMBING',
    jenis_kelamin: 'BETINA',
    breed: 'Peranakan Ettawa',
    tanggal_lahir: '2024-05-10',
    bobot_kg: '12.5',
    tag_induk: 'K-000',
    ...overrides,
  };
}

describe('TEMPLATE_COLUMNS', () => {
  it('menyediakan kolom sesuai format template impor ternak', () => {
    expect([...TEMPLATE_COLUMNS]).toEqual([
      'kode_paket',
      'tagNumber',
      'nama',
      'jenis_ternak',
      'jenis_kelamin',
      'breed',
      'tanggal_lahir',
      'bobot_kg',
      'tag_induk',
    ]);
  });
});

describe('parseCsv', () => {
  it('menangani nilai quoted dengan koma', () => {
    const text = 'kode_paket,nama\nPAKET-01,"Sapi, Limousin"\n';
    const rows = parseCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].nama).toBe('Sapi, Limousin');
  });

  it('menangani nilai quoted dengan newline', () => {
    const text = 'kode_paket,nama\nPAKET-01,"Baris Satu\nBaris Dua"\n';
    const rows = parseCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].nama).toBe('Baris Satu\nBaris Dua');
  });

  it('menangani tanda kutip ganda di dalam quoted value', () => {
    const text = 'kode_paket,nama\nPAKET-01,"Kandang ""Utara"""\n';
    const rows = parseCsv(text);
    expect(rows[0].nama).toBe('Kandang "Utara"');
  });

  it('menangani baris CRLF', () => {
    const text = 'kode_paket,nama\r\nPAKET-01,Sapi\r\nPAKET-02,Kambing\r\n';
    const rows = parseCsv(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].nama).toBe('Sapi');
    expect(rows[1].kode_paket).toBe('PAKET-02');
  });

  it('melewati baris kosong', () => {
    const text = 'kode_paket,nama\n\nPAKET-01,Sapi\n\n\nPAKET-02,Kambing\n';
    const rows = parseCsv(text);
    expect(rows).toHaveLength(2);
    expect(rows[1].nama).toBe('Kambing');
  });

  it('mengembalikan array kosong untuk teks kosong', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('   \n  \n')).toEqual([]);
  });
});

describe('validateRows', () => {
  it('menerima baris valid dan menormalkan nilainya', () => {
    const { valid, errors } = validateRows([makeRow()], []);

    expect(errors).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(valid[0].tagNumber).toBe('K-001');
    expect(valid[0].name).toBe('Domba Sehat');
    expect(valid[0].sex).toBe('BETINA');
    expect(valid[0].animalType).toBe('KAMBING');
    expect(valid[0].packageCode).toBe('PAKET-01');
    expect(valid[0].birthDate).toBeInstanceOf(Date);
    expect(valid[0].weightKg).toBe(12.5);
  });

  it('melaporkan kolom wajib yang kosong', () => {
    const { valid, errors } = validateRows(
      [makeRow({ tagNumber: '', kode_paket: '' })],
      []
    );

    expect(valid).toHaveLength(0);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 1, column: 'tagNumber' }),
        expect.objectContaining({ row: 1, column: 'kode_paket' }),
      ])
    );
    const tagError = errors.find((e) => e.column === 'tagNumber');
    expect(tagError?.message).toContain('wajib');
  });

  it('menolak tanggal_lahir yang bukan format ISO/tanggal', () => {
    const { valid, errors } = validateRows(
      [makeRow({ tanggal_lahir: 'bukan-tanggal' })],
      []
    );

    expect(valid).toHaveLength(0);
    expect(errors[0]).toMatchObject({ row: 1, column: 'tanggal_lahir' });
    expect(errors[0].message).toContain('Tanggal lahir');
  });

  it('menolak tanggal_lahir yang tidak nyata', () => {
    const { errors } = validateRows([makeRow({ tanggal_lahir: '2024-13-45' })], []);
    expect(
      errors.some((e) => e.column === 'tanggal_lahir')
    ).toBe(true);
  });

  it('menolak jenis_ternak di luar enum', () => {
    const { valid, errors } = validateRows(
      [makeRow({ jenis_ternak: 'KERBAU' })],
      []
    );

    expect(valid).toHaveLength(0);
    expect(errors[0]).toMatchObject({ row: 1, column: 'jenis_ternak' });
    expect(errors[0].message).toContain('tidak valid');
  });

  it('menolak jenis_kelamin di luar enum', () => {
    const { valid, errors } = validateRows(
      [makeRow({ jenis_kelamin: 'ANAK' })],
      []
    );
    expect(valid).toHaveLength(0);
    expect(errors[0].column).toBe('jenis_kelamin');
  });

  it('menolak tagNumber ganda di dalam file yang sama', () => {
    const rows = [
      makeRow({ tagNumber: 'K-001' }),
      makeRow({ tagNumber: 'K-001', nama: 'Duplikat' }),
    ];
    const { valid, errors } = validateRows(rows, []);

    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ row: 2, column: 'tagNumber' });
    expect(errors[0].message).toContain('duplikat');
  });

  it('menolak tagNumber yang sudah ada di existingTags', () => {
    const { valid, errors } = validateRows([makeRow()], ['K-001']);

    expect(valid).toHaveLength(0);
    expect(errors[0]).toMatchObject({ row: 1, column: 'tagNumber' });
    expect(errors[0].message).toContain('sudah terdaftar');
  });

  it('mencampur baris valid dan invalid dalam satu impor', () => {
    const rows = [
      makeRow({ tagNumber: 'K-100' }),
      makeRow({ tagNumber: '', nama: 'Tanpa Tag' }),
      makeRow({ tagNumber: 'K-101', jenis_ternak: 'UNTA' }),
    ];
    const { valid, errors } = validateRows(rows, []);

    expect(valid).toHaveLength(1);
    expect(valid[0].tagNumber).toBe('K-100');
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.row).sort()).toEqual([2, 3]);
    for (const error of errors) {
      expect(typeof error.message).toBe('string');
      expect(error.message.length).toBeGreaterThan(0);
    }
  });

  it('menolak lebih dari 1000 baris dengan satu error berbahasa Indonesia', () => {
    const rows = Array.from({ length: 1001 }, (_, i) =>
      makeRow({ tagNumber: `K-${i}` })
    );
    const { valid, errors } = validateRows(rows, []);

    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('Maksimal 1000 baris per impor.');
  });
});

describe('buildTemplateCsv', () => {
  it('menghasilkan string dengan baris header sesuai TEMPLATE_COLUMNS', () => {
    const csv = buildTemplateCsv();

    expect(typeof csv).toBe('string');
    const firstLine = csv.split(/\r?\n/)[0];
    expect(firstLine).toBe(TEMPLATE_COLUMNS.join(','));
  });

  it('template dapat di-parse kembali menjadi baris contoh', () => {
    const rows = parseCsv(buildTemplateCsv());
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].tagNumber).toBeTruthy();
  });
});

describe('toLivestockCreateInputs', () => {
  it('memetakan baris valid ke input prisma dengan packageId', () => {
    const { valid } = validateRows([makeRow()], []);
    const { data, errors } = toLivestockCreateInputs(valid, {
      'PAKET-01': 'pkg_123',
    });

    expect(errors).toEqual([]);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      packageId: 'pkg_123',
      tagNumber: 'K-001',
      name: 'Domba Sehat',
      sex: 'BETINA',
      breed: 'Peranakan Ettawa',
      weightKg: 12.5,
      motherTag: 'K-000',
    });
    expect(data[0].birthDate).toBeInstanceOf(Date);
  });

  it('melaporkan error bila kode paket tidak ditemukan', () => {
    const { valid } = validateRows([makeRow()], []);
    const { data, errors } = toLivestockCreateInputs(valid, {});

    expect(data).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].column).toBe('kode_paket');
    expect(errors[0].message).toContain('PAKET-01');
  });
});
