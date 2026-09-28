import { prisma } from '@/lib/prisma';

export type NotificationType = 'PAYMENT' | 'KYC' | 'PROFIT' | 'LISTING' | 'TAAWUN';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Menulis notifikasi untuk user. Selalu dibungkus try/catch supaya kegagalan
 * database tidak pernah merusak alur utama (pembayaran, KYC, dsb).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ? JSON.stringify(input.data) : null,
      },
    });
  } catch (error) {
    console.error('[notifications] gagal membuat notifikasi:', error);
  }
}
