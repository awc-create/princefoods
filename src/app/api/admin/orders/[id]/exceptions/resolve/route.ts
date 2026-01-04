// src/app/api/admin/orders/[id]/exceptions/resolve/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

const RESOLVED_TAG_SLUG = 'exceptions-resolved';

function slugifyExceptionType(t: string) {
  return `resolved-${t.toLowerCase().replace(/_/g, '-')}`;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const payload = (
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  ) as Record<string, unknown>;

  const action = String(payload.action ?? 'resolve'); // "resolve" | "unresolve"
  const exceptionType = String(payload.exceptionType ?? 'UNKNOWN');
  const noteRaw = payload.note;
  const note = typeof noteRaw === 'string' ? noteRaw.trim().slice(0, 1000) : '';

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, displayId: true }
  });

  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

  const resolvedTag = await prisma.tag.upsert({
    where: { slug: RESOLVED_TAG_SLUG },
    update: {},
    create: { slug: RESOLVED_TAG_SLUG, label: 'Exceptions resolved', color: '#22c55e' }
  });

  const perTypeSlug = slugifyExceptionType(exceptionType);
  const perTypeTag = await prisma.tag.upsert({
    where: { slug: perTypeSlug },
    update: {},
    create: { slug: perTypeSlug, label: `Resolved: ${exceptionType}`, color: '#22c55e' }
  });

  const isResolve = action !== 'unresolve';

  if (isResolve) {
    // Add tags (ignore duplicates)
    await prisma.orderTag.create({ data: { orderId, tagId: resolvedTag.id } }).catch(() => {});
    await prisma.orderTag.create({ data: { orderId, tagId: perTypeTag.id } }).catch(() => {});
  } else {
    // Remove tags (ignore missing)
    await prisma.orderTag
      .delete({ where: { orderId_tagId: { orderId, tagId: resolvedTag.id } } })
      .catch(() => {});
    await prisma.orderTag
      .delete({ where: { orderId_tagId: { orderId, tagId: perTypeTag.id } } })
      .catch(() => {});
  }

  // Write an activity note so ops history is visible
  await prisma.orderActivity.create({
    data: {
      orderId,
      type: 'NOTE',
      note: isResolve ? 'Exception resolved' : 'Exception reopened',
      meta: {
        kind: isResolve ? 'EXCEPTION_RESOLVED' : 'EXCEPTION_REOPENED',
        exceptionType,
        note: note || undefined
      }
    }
  });

  return NextResponse.json({
    ok: true,
    orderId,
    action: isResolve ? 'resolve' : 'unresolve'
  });
}
