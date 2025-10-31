// src/lib/notify.ts
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export interface NotificationInput {
  kind: string;
  title: string;
  body?: string | null; // ← make it optional + allow null
  link?: string;
  meta?: Record<string, unknown> | null;
  actorId?: string;
}

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      kind: input.kind,
      title: input.title,
      body: input.body ?? '', // ensure string in DB
      link: input.link,
      actorId: input.actorId,
      meta: input.meta as Prisma.InputJsonValue
    }
  });
}

export const createAdminNotification = createNotification;
