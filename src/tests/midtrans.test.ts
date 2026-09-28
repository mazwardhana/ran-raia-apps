import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSnapToken, type CreateSnapTokenParams } from '@/lib/midtrans';

// `src/lib/midtrans.ts` membaca `MIDTRANS_SERVER_KEY` lewat const tingkat modul,
// jadi nilainya harus disiapkan sebelum modul diimpor. `vi.hoisted` dieksekusi
// lebih awal daripada `import`. Nilai aslinya dipulihkan setelah tes.
const originalServerKey = vi.hoisted(() => {
  const original = process.env.MIDTRANS_SERVER_KEY;
  process.env.MIDTRANS_SERVER_KEY = 'RAIA_TEST_SERVER_KEY';
  return original;
});

const TEST_AUTH_HEADER = `Basic ${Buffer.from(
  'RAIA_TEST_SERVER_KEY:'
).toString('base64')}`;
const SNAP_REDIRECT_URL = 'https://app.sandbox.midtrans.com/snap/vtweb/abc';

interface SnapRequestPayload {
  transaction_details: { order_id: string; gross_amount: number };
  item_details: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  customer_details: Record<string, unknown>;
}

const fetchMock = vi.fn();

function sentRequest() {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    { headers: Record<string, string>; body: string }
  ];
  return {
    url,
    headers: init.headers,
    body: JSON.parse(init.body) as SnapRequestPayload,
  };
}

/**
 * Detail pelanggan yang memang dikirim pengujian: hanya `first_name`,
 * tanpa kunci email apa pun. Kasus-kasus di bawah menambahkan email sendiri.
 */
function paramsWithoutEmail(): CreateSnapTokenParams {
  return {
    orderId: 'MID-TRX-1',
    grossAmount: 50000,
    itemDetails: [
      {
        id: 'PKT-001',
        name: 'Paket Kambing Etawa Sleman',
        price: 10000,
        quantity: 5,
      },
    ],
    customerDetails: { first_name: 'budi_santoso' },
  };
}

/** Bagian payload yang tidak boleh berubah oleh penanganan email. */
function expectBasePayloadCorrect() {
  const sent = sentRequest();
  expect(sent.headers.Authorization).toBe(TEST_AUTH_HEADER);
  expect(sent.body.transaction_details.order_id).toBe('MID-TRX-1');
  expect(sent.body.transaction_details.gross_amount).toBe(50000);
  expect(sent.body.customer_details.first_name).toBe('budi_santoso');
  return sent;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({
      token: 'snap-token-abc',
      redirect_url: SNAP_REDIRECT_URL,
    }),
    text: async () => '',
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(() => {
  if (originalServerKey === undefined) {
    delete process.env.MIDTRANS_SERVER_KEY;
  } else {
    process.env.MIDTRANS_SERVER_KEY = originalServerKey;
  }
});

describe('createSnapToken — customer_details.email', () => {
  it('email kosong: kunci email tidak ikut dikirim', async () => {
    const params = paramsWithoutEmail();
    params.customerDetails.email = '';

    const result = await createSnapToken(params);

    const sent = expectBasePayloadCorrect();
    expect('email' in sent.body.customer_details).toBe(false);
    expect(result).toEqual({
      token: 'snap-token-abc',
      redirect_url: SNAP_REDIRECT_URL,
    });
  });

  it('email berisi spasi saja: kunci email tidak ikut dikirim', async () => {
    const params = paramsWithoutEmail();
    params.customerDetails.email = '   ';

    const result = await createSnapToken(params);

    const sent = expectBasePayloadCorrect();
    expect('email' in sent.body.customer_details).toBe(false);
    expect(result).toEqual({
      token: 'snap-token-abc',
      redirect_url: SNAP_REDIRECT_URL,
    });
  });

  it('email undefined: kunci email tidak ikut dikirim', async () => {
    const params = paramsWithoutEmail();
    params.customerDetails.email = undefined;

    const result = await createSnapToken(params);

    const sent = expectBasePayloadCorrect();
    expect('email' in sent.body.customer_details).toBe(false);
    expect(result).toEqual({
      token: 'snap-token-abc',
      redirect_url: SNAP_REDIRECT_URL,
    });
  });

  it('customer_details tanpa kunci email: kunci email tidak ikut dikirim', async () => {
    const result = await createSnapToken(paramsWithoutEmail());

    const sent = expectBasePayloadCorrect();
    expect('email' in sent.body.customer_details).toBe(false);
    expect(result).toEqual({
      token: 'snap-token-abc',
      redirect_url: SNAP_REDIRECT_URL,
    });
  });

  it('email valid: dikirim apa adanya', async () => {
    const params = paramsWithoutEmail();
    params.customerDetails.email = 'budi@example.com';

    const result = await createSnapToken(params);

    const sent = expectBasePayloadCorrect();
    expect(sent.body.customer_details).toHaveProperty(
      'email',
      'budi@example.com'
    );
    expect(result).toEqual({
      token: 'snap-token-abc',
      redirect_url: SNAP_REDIRECT_URL,
    });
  });

  it('respons non-ok tetap melempar error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () =>
        '{"error_messages":["customer_details.email format is invalid"]}',
    });

    await expect(createSnapToken(paramsWithoutEmail())).rejects.toThrow(
      'Midtrans API error: 400'
    );
  });
});
