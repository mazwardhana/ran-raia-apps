import crypto from 'crypto';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || '';
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || '';
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const SNAP_BASE_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1';

export interface MidtransItemDetail {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface MidtransCustomerDetails {
  first_name: string;
  email: string;
  phone?: string;
}

export interface CreateSnapTokenParams {
  orderId: string;
  grossAmount: number;
  itemDetails: MidtransItemDetail[];
  customerDetails: MidtransCustomerDetails;
}

export interface SnapTokenResponse {
  token: string;
  redirect_url: string;
}

/**
 * Mode simulasi pembayaran dikendalikan env `MIDTRANS_MODE`.
 * Hanya nilai `simulate` yang menyalakan mode ini; selain itu (termasuk
 * ketika tidak diset) checkout tetap memakai Midtrans sungguhan.
 * Dibaca saat dipanggil, bukan saat modul dimuat, supaya bisa diuji per kasus.
 */
export function isSimulateMode(): boolean {
  return process.env.MIDTRANS_MODE === 'simulate';
}

export async function createSnapToken(
  params: CreateSnapTokenParams
): Promise<SnapTokenResponse> {
  const { orderId, grossAmount, itemDetails, customerDetails } = params;

  const payload = {
    transaction_details: {
      order_id: orderId,
      gross_amount: grossAmount,
    },
    item_details: itemDetails,
    customer_details: customerDetails,
  };

  const authString = Buffer.from(MIDTRANS_SERVER_KEY + ':').toString('base64');

  const response = await fetch(`${SNAP_BASE_URL}/transactions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authString}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Midtrans API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  return {
    token: data.token,
    redirect_url: data.redirect_url,
  };
}

export function verifySignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signature: string
): boolean {
  const signatureString = orderId + statusCode + grossAmount + MIDTRANS_SERVER_KEY;
  const calculatedSignature = crypto
    .createHash('sha512')
    .update(signatureString)
    .digest('hex');

  return calculatedSignature === signature;
}

export function getClientKey(): string {
  return MIDTRANS_CLIENT_KEY;
}
