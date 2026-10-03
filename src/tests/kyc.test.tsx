import '@testing-library/jest-dom/vitest';

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signIn } from 'next-auth/react';
import { NextRequest } from 'next/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as kycPhotoGET } from '@/app/api/kyc/photo/route';
import { POST as kycPOST } from '@/app/api/kyc/route';
import { theme } from '@/theme/theme';

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

const apiMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createNotification: vi.fn(),
  prisma: {
    user: { update: vi.fn(), findUnique: vi.fn() },
    userProfile: { upsert: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: apiMocks.getCurrentUser }));
vi.mock('@/lib/notifications', () => ({
  createNotification: apiMocks.createNotification,
}));
vi.mock('@/lib/prisma', () => ({ prisma: apiMocks.prisma }));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, 'ResizeObserver', {
    configurable: true,
    value: ResizeObserverMock,
  });

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = '';
  global.fetch = fetch;
});

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>);
}

describe('Registration, Login, and KYC Flow', () => {
  it('register form shows username uniqueness validation error from server 409', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Username atau email sudah digunakan' }),
    });

    const { default: RegisterPage } = await import('@/app/(auth)/register/page');
    renderWithTheme(<RegisterPage />);

    await user.type(screen.getByLabelText(/nama/i), 'Budi Santoso');
    await user.type(screen.getByLabelText(/username/i), 'budi_investor');
    await user.type(screen.getByLabelText(/email/i), 'budi@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.type(screen.getByLabelText(/telepon/i), '081234567890');

    const submitButton = screen.getByRole('button', { name: /daftar/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/username atau email sudah digunakan/i)).toBeInTheDocument();
    });
  });

  it('login form accepts email OR username in single identifier field', async () => {
    const user = userEvent.setup();

    vi.mocked(signIn).mockResolvedValueOnce({
      ok: true,
      error: undefined,
      status: 200,
      url: null,
      code: undefined,
    });

    const { default: LoginPage } = await import('@/app/(auth)/login/page');
    renderWithTheme(<LoginPage />);

    const identifierInput = screen.getByLabelText(/email atau username/i);
    expect(identifierInput).toBeInTheDocument();

    await user.type(identifierInput, 'budi@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');

    const submitButton = screen.getByRole('button', { name: /masuk/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('credentials', {
        identifier: 'budi@example.com',
        password: 'password123',
        redirect: false,
      });
    });
  });

  it('KYC "Isi Otomatis (Demo)" button fills template fields', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ kycStatus: 'PENDING' }),
    });

    const { default: KycPage } = await import('@/app/kyc/page');
    renderWithTheme(<KycPage />);

    await waitFor(() => {
      expect(screen.getByText(/isi otomatis \(demo\)/i)).toBeInTheDocument();
    });

    const autoFillButton = screen.getByRole('button', { name: /isi otomatis \(demo\)/i });
    await user.click(autoFillButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('3201234567890001')).toBeInTheDocument();
    });
  });

  it('verify button shows progress ~3s then success state "Verifikasi berhasil!"', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kycStatus: 'PENDING' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true }),
      });

    const { default: KycPage } = await import('@/app/kyc/page');
    renderWithTheme(<KycPage />);

    await waitFor(() => {
      expect(screen.getByText(/isi otomatis \(demo\)/i)).toBeInTheDocument();
    });

    const autoFillButton = screen.getByRole('button', { name: /isi otomatis \(demo\)/i });
    await user.click(autoFillButton);

    const verifyButton = screen.getByRole('button', { name: /verifikasi sekarang/i });
    await user.click(verifyButton);

    // Progres tampil seketika, sebelum jeda 3 detik selesai.
    expect(screen.getByText(/sedang diverifikasi/i)).toBeInTheDocument();
    const startedAt = Date.now();

    await waitFor(
      () => {
        expect(screen.getByText(/verifikasi berhasil/i)).toBeInTheDocument();
      },
      { timeout: 8000, interval: 100 }
    );

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2500);
  }, 15000);
});

describe('Halaman KYC — unggah foto', () => {
  it('menampilkan nama berkas dan mengirim foto sebagai FormData multipart', async () => {
    const user = userEvent.setup();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ kycStatus: 'PENDING' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true }),
      });

    const { default: KycPage } = await import('@/app/kyc/page');
    const { container } = renderWithTheme(<KycPage />);

    await waitFor(() => {
      expect(screen.getByText(/isi otomatis \(demo\)/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /isi otomatis \(demo\)/i }));

    const fileInputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    expect(fileInputs).toHaveLength(2);

    await user.upload(
      fileInputs[0],
      new File(['ktp-bytes'], 'ktp-saya.png', { type: 'image/png' })
    );
    await user.upload(
      fileInputs[1],
      new File(['selfie-bytes'], 'selfie-saya.png', { type: 'image/png' })
    );

    await waitFor(() => {
      expect(screen.getByText('ktp-saya.png')).toBeInTheDocument();
      expect(screen.getByText('selfie-saya.png')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /verifikasi sekarang/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/verifikasi berhasil/i)).toBeInTheDocument();
      },
      { timeout: 8000, interval: 100 }
    );

    const verifyCall = vi.mocked(global.fetch).mock.calls[1];
    const body = verifyCall[1]?.body;
    expect(body).toBeInstanceOf(FormData);

    const form = body as FormData;
    expect(form.get('nik')).toBe('3201234567890001');
    expect((form.get('ktpImage') as File).name).toBe('ktp-saya.png');
    expect((form.get('selfieImage') as File).name).toBe('selfie-saya.png');
  }, 15000);
});

// ---------------------------------------------------------------------------
// API KYC — unggah foto KTP/selfie dan penyajian foto privat
// ---------------------------------------------------------------------------

interface UploadField {
  name: string;
  value: string;
}

interface UploadFile {
  name: string;
  filename: string;
  type: string;
  bytes: Uint8Array;
}

const BOUNDARY = '----raia-kyc-test-boundary';

function multipartBody(fields: UploadField[], files: UploadFile[]): Uint8Array {
  const chunks: Buffer[] = [];

  for (const field of fields) {
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\n` +
          `Content-Disposition: form-data; name="${field.name}"\r\n\r\n` +
          `${field.value}\r\n`
      )
    );
  }

  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\n` +
          `Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.type}\r\n\r\n`
      )
    );
    chunks.push(Buffer.from(file.bytes));
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return new Uint8Array(Buffer.concat(chunks));
}

function kycRequest(fields: UploadField[], files: UploadFile[]): NextRequest {
  return new NextRequest('http://localhost/api/kyc', {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
    // Uint8Array Node tidak assignable ke BodyInit DOM; salinan Uint8Array
    // (ArrayBuffer-backed) menyalin byte apa adanya tanpa mengubah isinya.
    body: new Uint8Array(multipartBody(fields, files)),
  });
}

const VALID_FIELDS: UploadField[] = [
  { name: 'nik', value: '3201234567890001' },
  { name: 'placeOfBirth', value: 'Jakarta' },
  { name: 'dateOfBirth', value: '1990-01-15' },
  { name: 'address', value: 'Jl. Contoh No. 123, Jakarta Selatan' },
];

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function file(
  name: string,
  filename: string,
  type: string,
  bytes: Uint8Array
): UploadFile {
  return { name, filename, type, bytes };
}

describe('POST /api/kyc — penyimpanan foto KTP', () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = mkdtempSync(path.join(tmpdir(), 'raia-kyc-'));
    process.env.KYC_STORAGE_DIR = storageDir;
    apiMocks.getCurrentUser.mockResolvedValue({
      id: 'usr_1',
      role: 'INVESTOR',
      username: 'budi',
      kycStatus: 'PENDING',
    });
    apiMocks.prisma.user.update.mockResolvedValue({ id: 'usr_1' });
    apiMocks.prisma.userProfile.upsert.mockResolvedValue({ id: 'prof_1' });
  });

  afterEach(() => {
    rmSync(storageDir, { recursive: true, force: true });
    delete process.env.KYC_STORAGE_DIR;
  });

  it('menyimpan path foto KTP dan selfie dari payload, bukan mengabaikannya', async () => {
    const res = await kycPOST(
      kycRequest(VALID_FIELDS, [
        file('ktpImage', 'ktp.png', 'image/png', PNG_BYTES),
        file('selfieImage', 'selfie.png', 'image/png', PNG_BYTES),
      ])
    );

    expect(res.status).toBe(200);

    expect(apiMocks.prisma.userProfile.upsert).toHaveBeenCalledTimes(1);
    const { where, update, create } = apiMocks.prisma.userProfile.upsert.mock.calls[0][0];
    expect(where).toEqual({ userId: 'usr_1' });

    // path relatif tersimpan, tanpa direktori induk (aman dari traversal)
    for (const payload of [update, create]) {
      expect(payload.ktpImagePath).toBeTruthy();
      expect(payload.selfieImagePath).toBeTruthy();
      expect(path.basename(payload.ktpImagePath)).toBe(payload.ktpImagePath);
      expect(path.basename(payload.selfieImagePath)).toBe(payload.selfieImagePath);
    }

    const { ktpImagePath, selfieImagePath } = update;

    // benar-benar ada di disk, dan isinya sama dengan yang diunggah
    expect(readdirSync(storageDir)).toContain(ktpImagePath);
    expect(readdirSync(storageDir)).toContain(selfieImagePath);
    expect(Array.from(readFileSync(path.join(storageDir, ktpImagePath)))).toEqual(
      Array.from(PNG_BYTES)
    );

    // status verifikasi tetap langsung VERIFIED seperti sebelumnya
    expect(apiMocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'usr_1' },
      data: { kycStatus: 'VERIFIED' },
    });
    expect(apiMocks.createNotification).toHaveBeenCalledTimes(1);
  });

  it('menolak tipe file selain image/jpeg dan image/png', async () => {
    const res = await kycPOST(
      kycRequest(VALID_FIELDS, [
        file('ktpImage', 'ktp.gif', 'image/gif', new Uint8Array([1, 2, 3])),
        file('selfieImage', 'selfie.png', 'image/png', PNG_BYTES),
      ])
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    expect(apiMocks.prisma.userProfile.upsert).not.toHaveBeenCalled();
    expect(apiMocks.prisma.user.update).not.toHaveBeenCalled();
    expect(readdirSync(storageDir)).toHaveLength(0);
  });

  it('menolak file lebih dari 5 MB', async () => {
    const res = await kycPOST(
      kycRequest(VALID_FIELDS, [
        file(
          'ktpImage',
          'ktp.png',
          'image/png',
          new Uint8Array(5 * 1024 * 1024 + 1)
        ),
        file('selfieImage', 'selfie.png', 'image/png', PNG_BYTES),
      ])
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    expect(apiMocks.prisma.userProfile.upsert).not.toHaveBeenCalled();
    expect(apiMocks.prisma.user.update).not.toHaveBeenCalled();
    expect(readdirSync(storageDir)).toHaveLength(0);
  });

  it('menolak file yang mengaku PNG tetapi isinya bukan gambar (magic bytes salah)', async () => {
    // Tipe MIME dinyatakan klien = image/png, tapi byte pertamanya bukan signature PNG.
    const spoofed = new Uint8Array(16).fill(0x41);

    const res = await kycPOST(
      kycRequest(VALID_FIELDS, [
        file('ktpImage', 'ktp.png', 'image/png', spoofed),
        file('selfieImage', 'selfie.png', 'image/png', PNG_BYTES),
      ])
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeTruthy();
    expect(apiMocks.prisma.userProfile.upsert).not.toHaveBeenCalled();
    expect(apiMocks.prisma.user.update).not.toHaveBeenCalled();
    expect(readdirSync(storageDir)).toHaveLength(0);
  });

  it('menolak permintaan tanpa payload KYC yang valid', async () => {
    // 1) tidak ada field sama sekali
    const empty = await kycPOST(kycRequest([], []));
    expect(empty.status).toBe(400);

    // 2) field teks valid tapi berkas wajib tidak ada
    const withoutFiles = await kycPOST(kycRequest(VALID_FIELDS, []));
    expect(withoutFiles.status).toBe(400);

    // 3) berkas ada tapi NIK kosong
    const withoutNik = await kycPOST(
      kycRequest(
        VALID_FIELDS.map((f) => (f.name === 'nik' ? { ...f, value: '' } : f)),
        [file('ktpImage', 'ktp.png', 'image/png', PNG_BYTES)]
      )
    );
    expect(withoutNik.status).toBe(400);

    expect(apiMocks.prisma.userProfile.upsert).not.toHaveBeenCalled();
    expect(apiMocks.prisma.user.update).not.toHaveBeenCalled();
    expect(readdirSync(storageDir)).toHaveLength(0);
  });

  it('menolak request tanpa login dengan 401', async () => {
    apiMocks.getCurrentUser.mockResolvedValue(null);

    const res = await kycPOST(
      kycRequest(VALID_FIELDS, [file('ktpImage', 'ktp.png', 'image/png', PNG_BYTES)])
    );

    expect(res.status).toBe(401);
    expect(apiMocks.prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/kyc/photo — penyajian foto privat', () => {
  let storageDir: string;

  beforeEach(() => {
    storageDir = mkdtempSync(path.join(tmpdir(), 'raia-kyc-photo-'));
    process.env.KYC_STORAGE_DIR = storageDir;
    apiMocks.getCurrentUser.mockResolvedValue({
      id: 'usr_1',
      role: 'INVESTOR',
      username: 'budi',
      kycStatus: 'PENDING',
    });
    apiMocks.prisma.userProfile.findUnique.mockResolvedValue({
      id: 'prof_1',
      userId: 'usr_1',
      ktpImagePath: null,
      selfieImagePath: null,
    });
  });

  afterEach(() => {
    rmSync(storageDir, { recursive: true, force: true });
    delete process.env.KYC_STORAGE_DIR;
  });

  it('mengembalikan 401 untuk pengguna yang tidak login', async () => {
    apiMocks.getCurrentUser.mockResolvedValue(null);

    const res = await kycPhotoGET(new NextRequest('http://localhost/api/kyc/photo?type=ktp'));

    expect(res.status).toBe(401);
    expect(apiMocks.prisma.userProfile.findUnique).not.toHaveBeenCalled();
  });

  it('mengembalikan 404 bila pengguna tidak punya foto yang diminta', async () => {
    const res = await kycPhotoGET(new NextRequest('http://localhost/api/kyc/photo?type=selfie'));

    expect(res.status).toBe(404);
    // selalu memakai user yang login, bukan user lain
    expect(apiMocks.prisma.userProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'usr_1' },
    });
  });

  it('mengembalikan berkas foto milik user yang login dengan Content-Type benar', async () => {
    writeFileSync(path.join(storageDir, 'usr_1-ktp.png'), PNG_BYTES);
    apiMocks.prisma.userProfile.findUnique.mockResolvedValue({
      id: 'prof_1',
      userId: 'usr_1',
      ktpImagePath: 'usr_1-ktp.png',
      selfieImagePath: null,
    });

    const res = await kycPhotoGET(new NextRequest('http://localhost/api/kyc/photo?type=ktp'));

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    const served = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(served)).toEqual(Array.from(PNG_BYTES));
  });

  it('mengembalikan 404 bila file tidak ada lagi di penyimpanan', async () => {
    apiMocks.prisma.userProfile.findUnique.mockResolvedValue({
      id: 'prof_1',
      userId: 'usr_1',
      ktpImagePath: 'usr_1-ktp.png',
      selfieImagePath: null,
    });

    const res = await kycPhotoGET(new NextRequest('http://localhost/api/kyc/photo?type=ktp'));

    expect(res.status).toBe(404);
  });
});
