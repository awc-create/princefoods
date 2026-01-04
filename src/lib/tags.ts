import { prisma } from '@/lib/prisma';

export async function ensureTag(slug: string, label: string, color?: string) {
  const existing = await prisma.tag.findUnique({ where: { slug } });
  if (existing) return existing;

  return prisma.tag.create({
    data: { slug, label, color: color ?? null }
  });
}

export async function addOrderTag(orderId: string, tagSlug: string) {
  const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
  if (!tag) return;

  await prisma.orderTag.upsert({
    where: { orderId_tagId: { orderId, tagId: tag.id } },
    update: {},
    create: { orderId, tagId: tag.id }
  });
}

export async function removeOrderTag(orderId: string, tagSlug: string) {
  const tag = await prisma.tag.findUnique({ where: { slug: tagSlug } });
  if (!tag) return;

  await prisma.orderTag.deleteMany({
    where: { orderId, tagId: tag.id }
  });
}
