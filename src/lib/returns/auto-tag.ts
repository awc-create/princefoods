import { prisma } from '@/lib/prisma';

type ReturnTagSlug = 'return-open' | 'return-received' | 'return-resolved' | 'delivery-issue';

async function ensureTag(slug: ReturnTagSlug, label: string, color?: string) {
  return prisma.tag.upsert({
    where: { slug },
    update: { label, color: color ?? undefined },
    create: { slug, label, color: color ?? undefined }
  });
}

async function setOrderTag(orderId: string, slug: ReturnTagSlug, label: string, color?: string) {
  const tag = await ensureTag(slug, label, color);

  await prisma.orderTag.upsert({
    where: { orderId_tagId: { orderId, tagId: tag.id } },
    update: {},
    create: { orderId, tagId: tag.id }
  });
}

async function removeOrderTag(orderId: string, slug: ReturnTagSlug) {
  const tag = await prisma.tag.findUnique({ where: { slug } });
  if (!tag) return;
  await prisma.orderTag
    .delete({ where: { orderId_tagId: { orderId, tagId: tag.id } } })
    .catch(() => null);
}

/**
 * Keep tagging rules simple:
 * - OPEN -> return-open + delivery-issue
 * - RECEIVED -> return-received + delivery-issue
 * - RESOLVED -> return-resolved (and remove open/received)
 */
export async function applyReturnTags(args: {
  orderId: string;
  status: 'OPEN' | 'RECEIVED' | 'RESOLVED';
}) {
  const { orderId, status } = args;

  // Always keep "delivery-issue" while not resolved
  if (status !== 'RESOLVED') {
    await setOrderTag(orderId, 'delivery-issue', 'Delivery issue');
  } else {
    await removeOrderTag(orderId, 'delivery-issue');
  }

  if (status === 'OPEN') {
    await setOrderTag(orderId, 'return-open', 'Return open');
    await removeOrderTag(orderId, 'return-received');
    await removeOrderTag(orderId, 'return-resolved');
    return;
  }

  if (status === 'RECEIVED') {
    await setOrderTag(orderId, 'return-received', 'Return received');
    await removeOrderTag(orderId, 'return-open');
    await removeOrderTag(orderId, 'return-resolved');
    return;
  }

  // RESOLVED
  await setOrderTag(orderId, 'return-resolved', 'Return resolved');
  await removeOrderTag(orderId, 'return-open');
  await removeOrderTag(orderId, 'return-received');
}
