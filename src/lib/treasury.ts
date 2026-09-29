import { randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';

export const TREASURY_USERNAME = 'raia_treasury';

const TREASURY_EMAIL = 'treasury@raia.internal';
const TREASURY_NAME = 'Raia Treasury';
const PASSWORD_ROUNDS = 10;

/**
 * Kontrak minimal yang dipenuhi baik oleh PrismaClient, Prisma.TransactionClient,
 * maupun mock vitest — supaya `ensureTreasuryUser` bisa dipakai di dalam `$transaction`
 * (Task 10) tanpa menarik seluruh tipe PrismaClient.
 */
interface TreasuryClient {
  user: {
    upsert(args: {
      where: { username: string };
      create: {
        username: string;
        email: string;
        name: string;
        passwordHash: string;
        role: 'SYSTEM';
      };
      update: { role: 'SYSTEM' };
    }): Promise<{ id: string }>;
  };
}

export async function ensureTreasuryUser(client: TreasuryClient): Promise<{ id: string }> {
  // Kata sandi 32 byte acak yang hanya di-hash, tidak pernah disimpan maupun
  // dibagikan — akun treasury tidak bisa dipakai untuk masuk (login memakai
  // bcrypt.compare terhadap hash ini, dan tidak ada seorang pun yang tahu
  // plaintext-nya).
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), PASSWORD_ROUNDS);

  return client.user.upsert({
    where: { username: TREASURY_USERNAME },
    create: {
      username: TREASURY_USERNAME,
      email: TREASURY_EMAIL,
      name: TREASURY_NAME,
      passwordHash,
      role: 'SYSTEM',
    },
    update: { role: 'SYSTEM' },
  });
}
