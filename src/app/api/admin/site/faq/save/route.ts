import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';

interface FaqItemDTO {
  id: string;
  question: string;
  answer: string;
  visible?: boolean;
}
interface SaveDTO {
  heading?: string;
  subheading?: string;
  items: FaqItemDTO[];
}

export async function POST(req: Request) {
  let body: SaveDTO;
  try {
    body = (await req.json()) as SaveDTO;
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const heading = (body.heading ?? 'FAQs').trim();
  const subheading = (body.subheading ?? 'Get answers to common questions.').trim();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Upsert settings row
      await tx.faqSettings.upsert({
        where: { id: 1 },
        update: { heading, subheading },
        create: { id: 1, heading, subheading }
      });

      // Sync items (delete missing, then upsert rest with new positions)
      const existing = await tx.faq.findMany({ select: { id: true } });
      const incomingIds = new Set(items.map((i) => i.id));
      const toDelete = existing.filter((e) => !incomingIds.has(e.id));
      if (toDelete.length > 0) {
        await tx.faq.deleteMany({ where: { id: { in: toDelete.map((d) => d.id) } } });
      }

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const data = {
          question: it.question.trim(),
          answer: it.answer,
          active: it.visible !== false,
          position: i
        };
        const exists = await tx.faq.findUnique({ where: { id: it.id } });
        if (exists) {
          await tx.faq.update({ where: { id: it.id }, data });
        } else {
          await tx.faq.create({ data: { id: it.id, ...data } });
        }
      }

      // Notify (make meta strictly InputJsonValue)
      const nextArray = items.map<Prisma.InputJsonObject>((i) => ({
        id: i.id,
        question: i.question,
        answer: i.answer,
        visible: i.visible !== false
      }));
      const meta: Prisma.InputJsonValue = {
        entity: 'faqSettings',
        count: items.length,
        hash: randomUUID(),
        next: nextArray as Prisma.InputJsonArray
      };

      const notif = await tx.notification.create({
        data: {
          kind: 'faq.update',
          title: 'FAQ updated',
          body: `Edited ${items.length} item${items.length === 1 ? '' : 's'}.`,
          link: '/admin/site/faq',
          meta
        }
      });

      return { notificationId: notif.id };
    });

    return NextResponse.json({ ok: true, notificationId: result.notificationId });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED_TO_SAVE_FAQ' }, { status: 500 });
  }
}
