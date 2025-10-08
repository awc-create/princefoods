// src/lib/notify.ts
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface NotificationInput {
  kind: string;
  title: string;
  body: string;
  link?: string;
  meta?: Record<string, unknown> | null;
  actorId?: string;
}

/**
 * Creates an admin notification record.
 * You can call this from any API route or background job.
 */
export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      kind: input.kind,
      title: input.title,
      body: input.body,
      link: input.link,
      actorId: input.actorId,
      meta: input.meta as Prisma.InputJsonValue
    }
  });
}
