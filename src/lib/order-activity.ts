// src/lib/order-activity.ts
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export type ActivityType = 'PLACED' | 'PAID' | 'FULFILLED' | 'REFUNDED' | 'CANCELLED' | 'NOTE';

export async function logActivity(
  orderId: string,
  type: ActivityType,
  note?: string,
  meta?: Prisma.InputJsonValue // 👈 matches Prisma JSON input type
) {
  try {
    await prisma.orderActivity.create({
      data: {
        orderId,
        type,
        ...(note ? { note } : {}),
        ...(meta !== undefined ? { meta } : {})
      }
    });
  } catch (e) {
    // Best-effort; never block the main flow
    console.error('logActivity failed', e);
  }
}
