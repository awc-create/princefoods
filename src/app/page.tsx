// src/app/page.tsx
import { prisma } from '@/lib/prisma';
import { unstable_noStore as noStore } from 'next/cache';

import Delivery from '@/components/home/delivery/Delivery';
import Hero from '@/components/home/hero/Hero';
import ProductSlider from '@/components/products/ProductSlider';
import styles from './page.module.scss';

export const dynamic = 'force-dynamic'; // don’t prerender at build

export default async function Home() {
  noStore(); // avoid static caching/prerender

  let rawProducts:
    | Array<{ id: string; name: string; price: number | null; productImageUrl: string | null }>
    | [] = [];

  try {
    rawProducts = await prisma.product.findMany({
      where: { visible: true },
      take: 8,
      select: { id: true, name: true, price: true, productImageUrl: true }
    });
  } catch {
    // If DATABASE_URL isn’t set during build, fail soft with no products
    rawProducts = [];
  }

  const products = rawProducts.map((p) => ({
    ...p,
    price: p.price ?? 0,
    productImageUrl:
      p.productImageUrl && p.productImageUrl.trim() !== ''
        ? p.productImageUrl
        : '/assets/prince-foods-logo.png'
  }));

  return (
    <main className={styles.homeContainer}>
      <Hero />
      <Delivery />
      <ProductSlider title="Best Sellers" products={products} />
    </main>
  );
}
