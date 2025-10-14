// src/app/product/[id]/page.tsx
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import styles from './product.module.scss';
import ViewTracker from './view-tracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      productImageUrl: true,
      sku: true,
      brand: true,
      inventory: true
    }
  });

  if (!p) {
    return (
      <div style={{ padding: 24 }}>
        <p>Not found.</p>
        <Link href="/shop">Back to shop</Link>
      </div>
    );
  }

  const img = p.productImageUrl?.trim() ? p.productImageUrl : '/assets/prince-foods-logo.png';

  return (
    <div className={styles.wrap}>
      {/* Track a view when PDP mounts */}
      <ViewTracker productId={p.id} />

      <nav className={styles.breadcrumbs}>
        <Link href="/shop">Shop</Link>
        <span>/</span>
        <span>{p.name}</span>
      </nav>

      <div className={styles.grid}>
        <div className={styles.imageWrap}>
          <Image
            src={img}
            alt={p.name}
            fill
            sizes="(max-width: 900px) 90vw, 500px"
            style={{ objectFit: 'contain' }}
          />
        </div>

        <div className={styles.panel}>
          <h1 className={styles.title}>{p.name}</h1>
          <div className={styles.price}>
            {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
              p.price ?? 0
            )}
          </div>

          {p.sku && <div className={styles.meta}>SKU: {p.sku}</div>}
          {p.brand && <div className={styles.meta}>Brand: {p.brand}</div>}
          {p.inventory && <div className={styles.meta}>Inventory: {p.inventory}</div>}

          {p.description && <p className={styles.desc}>{p.description}</p>}

          <div className={styles.actions}>
            <Link href="/shop" className={styles.ghost}>
              Back to Shop
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
