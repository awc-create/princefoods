import Hero from '@/components/home/hero/Hero';
import ProductSlider from '@/components/products/ProductSlider';
import Delivery from '@/components/home/delivery/Delivery';
import styles from './page.module.scss';
import { prisma } from '@/lib/prisma';

export default async function Home() {
  const rawProducts = await prisma.product.findMany({
    where: { visible: true },
    take: 8,
    select: {
      id: true,
      name: true,
      price: true,
      productImageUrl: true
    }
  });

  const products = rawProducts.map((p) => ({
    ...p,
    price: p.price ?? 0,
    productImageUrl:
      p.productImageUrl && p.productImageUrl.trim() !== ''
        ? p.productImageUrl
        : 'assets/prince-foods-logo.png' // <- fallback image
  }));

  return (
    <main className={styles.homeContainer}>
      <Hero />
      <Delivery />
      <ProductSlider title="Best Sellers" products={products} />
    </main>
  );
}
