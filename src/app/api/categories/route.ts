import { prisma } from '@/lib/prisma';
import { parseCategories } from '@/utils/parseCategories';

export async function GET() {
  const products = await prisma.product.findMany({
    select: { collection: true }
  });

  const collections = products
    .map(p => p.collection)
    .filter((val): val is string => typeof val === 'string');

  const categories = parseCategories(collections);

  return new Response(JSON.stringify(categories), {
    headers: { 'Content-Type': 'application/json' }
  });
}
