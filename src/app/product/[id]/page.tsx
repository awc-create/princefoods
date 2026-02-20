// src/app/product/[id]/page.tsx
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import ProductBuyBox from './product-buy-box';
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
      inventory: true,
      ribbon: true,
      discountMode: true,
      discountValue: true
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
  const priceText = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
    p.price ?? 0
  );

  return (
    <main className={styles.page}>
      <ViewTracker productId={p.id} />

      <div className={styles.container}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href="/shop" className={styles.crumbLink}>
            Shop
          </Link>
          <span className={styles.crumbSep}>/</span>
          <span className={styles.crumbCurrent}>{p.name}</span>
        </nav>

        <div className={styles.grid}>
          {/* LEFT: media */}
          <section className={styles.mediaCard} aria-label="Product images">
            <div className={styles.imageWrap}>
              <Image
                src={img}
                alt={p.name}
                fill
                sizes="(max-width: 960px) 92vw, 560px"
                className={styles.image}
                priority
              />
            </div>
          </section>

          {/* RIGHT: details */}
          <aside className={styles.panelCard}>
            <header className={styles.header}>
              <h1 className={styles.title}>{p.name}</h1>

              <div className={styles.priceRow}>
                <div className={styles.price}>{priceText}</div>

                {(p.ribbon ?? (p.discountMode && typeof p.discountValue === 'number')) && (
                  <div className={styles.badges}>
                    {p.ribbon && <span className={styles.pill}>{p.ribbon}</span>}
                    {p.discountMode && typeof p.discountValue === 'number' && (
                      <span className={`${styles.pill} ${styles.pillSecondary}`}>Offer</span>
                    )}
                  </div>
                )}
              </div>

              {(p.sku ?? p.brand ?? typeof p.inventory === 'number') && (
                <div className={styles.metaRow}>
                  {p.sku && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaKey}>SKU</span>
                      <span className={styles.metaVal}>{p.sku}</span>
                    </div>
                  )}
                  {p.brand && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaKey}>Brand</span>
                      <span className={styles.metaVal}>{p.brand}</span>
                    </div>
                  )}
                  {typeof p.inventory === 'number' && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaKey}>Stock</span>
                      <span className={styles.metaVal}>{p.inventory}</span>
                    </div>
                  )}
                </div>
              )}
            </header>

            {p.description && (
              <section className={styles.description}>
                <h2 className={styles.sectionTitle}>Description</h2>
                <p className={styles.desc}>{p.description}</p>
              </section>
            )}

            <section className={styles.buyArea} aria-label="Purchase options">
              <ProductBuyBox
                product={{
                  id: p.id,
                  title: p.name,
                  price: p.price ?? 0,
                  imageUrl: p.productImageUrl ?? null,
                  sku: p.sku ?? null,
                  inventory: typeof p.inventory === 'number' ? p.inventory : null,
                  ribbon: p.ribbon ?? null,
                  discountMode: p.discountMode ?? null,
                  discountValue: typeof p.discountValue === 'number' ? p.discountValue : null
                }}
              />

              <div className={styles.actions}>
                <Link href="/shop" className={styles.ghost}>
                  Back to Shop
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
