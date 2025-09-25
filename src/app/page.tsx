import { prisma } from '@/lib/prisma';
import { unstable_noStore as noStore } from 'next/cache';

import Delivery from '@/components/home/delivery/Delivery';
import Hero from '@/components/home/hero/Hero';
import InstagramGrid from '@/components/home/instagram/InstagramGrid';
import ReviewStrip from '@/components/home/reviews/ReviewStrip';
import ProductSlider from '@/components/products/ProductSlider';
import styles from './page.module.scss';

export const dynamic = 'force-dynamic';

const normalizeProducts = (
  raw:
    | Array<{ id: string; name: string; price: number | null; productImageUrl: string | null }>
    | []
) =>
  raw.map((p) => ({
    ...p,
    price: p.price ?? 0,
    productImageUrl:
      p.productImageUrl && p.productImageUrl.trim() !== ''
        ? p.productImageUrl
        : '/assets/prince-foods-logo.png'
  }));

export default async function Home() {
  noStore();

  let rawProducts:
    | Array<{ id: string; name: string; price: number | null; productImageUrl: string | null }>
    | [] = [];

  try {
    rawProducts = await prisma.product.findMany({
      where: { visible: true },
      take: 16,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, price: true, productImageUrl: true }
    });
  } catch {
    rawProducts = [];
  }

  const products = normalizeProducts(rawProducts);

  return (
    <main className={styles.homeContainer}>
      <Hero />
      <Delivery />
      <InstagramGrid />
      <ProductSlider title="Best Sellers" products={products} />
      <ReviewStrip />
    </main>
  );
}
