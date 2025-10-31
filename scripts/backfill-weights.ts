// src/scripts/backfill-weights.ts
import { parseWeightToGrams } from '@/lib/parse-weight';
import { prisma } from '@/lib/prisma';

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, weight: true }
  });

  let updates = 0;
  for (const p of products) {
    if (p.weight != null) continue; // skip already set
    const parsed = parseWeightToGrams(p.name);
    if (!parsed) continue;

    await prisma.product.update({
      where: { id: p.id },
      data: { weight: parsed.grams / 1000 }
    });
    updates++;
  }
  console.log(`Backfill complete. Updated ${updates} products.`);
}

main().finally(() => prisma.$disconnect());
