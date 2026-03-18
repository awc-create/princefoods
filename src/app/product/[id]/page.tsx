// src/app/product/[id]/page.tsx
import ProductSlider from '@/components/products/ProductSlider';
import { prisma } from '@/lib/prisma';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductBuyBox from './product-buy-box';
import styles from './product.module.scss';
import ViewTracker from './view-tracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.product.findUnique({
    where: { id, visible: true },
    select: { name: true, description: true, productImageUrl: true }
  });
  if (!p) return { title: 'Product not found' };
  const img = p.productImageUrl?.trim() ? p.productImageUrl : null;
  return {
    title: p.name,
    description:
      p.description?.slice(0, 155) ?? `Buy ${p.name} from Prince Foods — fast UK delivery.`,
    openGraph: {
      title: p.name,
      description: p.description?.slice(0, 155) ?? `Buy ${p.name} from Prince Foods.`,
      ...(img ? { images: [{ url: img }] } : {})
    }
  };
}

function parseInventory(inv: string | null): number | null {
  if (!inv) return null;
  const n = Number(inv);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

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
      visible: true,
      categoryId: true
    }
  });

  if (!p || !p.visible) notFound();

  const img = p.productImageUrl?.trim() ? p.productImageUrl : '/assets/prince-foods-logo.png';
  const inventoryCount = parseInventory(p.inventory);

  const category = p.categoryId
    ? await prisma.category.findUnique({
        where: { id: p.categoryId },
        select: {
          name: true,
          slug: true,
          parentId: true,
          parent: { select: { name: true, slug: true } }
        }
      })
    : null;

  const relatedRows = p.categoryId
    ? await prisma.product.findMany({
        where: { categoryId: p.categoryId, visible: true, NOT: { id: p.id } },
        orderBy: { unitsSold: 'desc' },
        take: 8,
        select: { id: true, name: true, price: true, productImageUrl: true }
      })
    : [];

  const relatedProducts = relatedRows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price ?? 0,
    productImageUrl: r.productImageUrl
  }));

  return (
    <main className={styles.page}>
      <ViewTracker productId={p.id} />

      <div className={styles.hero}>
        <div className={styles.container}>
          {/* Breadcrumb */}
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/shop" className={styles.crumbLink}>
              Shop
            </Link>
            {category?.parent && (
              <>
                <span className={styles.crumbSep}>/</span>
                <Link
                  href={`/shop?collection=${category.parent.slug}`}
                  className={styles.crumbLink}
                >
                  {category.parent.name}
                </Link>
              </>
            )}
            {category && (
              <>
                <span className={styles.crumbSep}>/</span>
                <Link href={`/shop?collection=${category.slug}`} className={styles.crumbLink}>
                  {category.name}
                </Link>
              </>
            )}
            <span className={styles.crumbSep}>/</span>
            <span className={styles.crumbCurrent}>{p.name}</span>
          </nav>

          <div className={styles.grid}>
            {/* LEFT: image */}
            <div className={styles.mediaCol}>
              <div className={styles.imageMain}>
                <Image
                  src={img}
                  alt={p.name}
                  fill
                  sizes="(max-width: 860px) 92vw, 50vw"
                  className={styles.image}
                  priority
                />
              </div>
            </div>

            {/* RIGHT: info */}
            <div className={styles.infoCol}>
              {/* Category link */}
              {category && (
                <Link href={`/shop?collection=${category.slug}`} className={styles.categoryTag}>
                  ↗ {category.parent ? `${category.parent.name} · ` : ''}
                  {category.name}
                </Link>
              )}

              <h1 className={styles.title}>{p.name}</h1>

              {/* Meta chips */}
              {(p.sku ?? p.brand) && (
                <div className={styles.metaRow}>
                  {p.sku && (
                    <span className={styles.metaChip}>
                      <span className={styles.metaKey}>SKU</span>
                      <span className={styles.metaVal}>{p.sku}</span>
                    </span>
                  )}
                  {p.brand && (
                    <span className={styles.metaChip}>
                      <span className={styles.metaKey}>Brand</span>
                      <span className={styles.metaVal}>{p.brand}</span>
                    </span>
                  )}
                  {inventoryCount != null && (
                    <span className={styles.metaChip}>
                      <span className={styles.metaKey}>Stock</span>
                      <span className={styles.metaVal}>{inventoryCount}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Description */}
              {p.description && <p className={styles.description}>{p.description}</p>}

              <div className={styles.divider} />

              {/* Buy box — handles live price + offer fetch */}
              <ProductBuyBox
                product={{
                  id: p.id,
                  title: p.name,
                  price: p.price ?? 0,
                  imageUrl: p.productImageUrl ?? null,
                  sku: p.sku ?? null,
                  inventory: inventoryCount,
                  ribbon: p.ribbon ?? null,
                  discountMode: null,
                  discountValue: null
                }}
              />

              {/* Trust strip */}
              <div className={styles.trust}>
                <div className={styles.trustItem}>
                  <span>🚚</span>
                  <span>Fast UK delivery</span>
                </div>
                <div className={styles.trustItem}>
                  <span>❄️</span>
                  <span>Insulated frozen packing</span>
                </div>
                <div className={styles.trustItem}>
                  <span>✅</span>
                  <span>Established 2007</span>
                </div>
              </div>

              <div className={styles.actions}>
                <Link href="/shop" className={styles.ghost}>
                  ← Back to Shop
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <div className={styles.relatedSection}>
          <ProductSlider
            title="You might also like"
            subtitle={category ? `More from ${category.name}` : undefined}
            products={relatedProducts}
          />
        </div>
      )}
    </main>
  );
}
