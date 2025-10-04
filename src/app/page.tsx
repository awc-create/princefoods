// src/app/page.tsx
import { prisma } from '@/lib/prisma';
import type {
  DeliverySettings,
  HeroSettings,
  HomeSettingsDTO,
  InstagramSettings,
  ProductShowcaseSettings,
  Promotion,
  ReviewsSettings
} from '@/types/homeSettings';
import { unstable_noStore as noStore } from 'next/cache';

import Delivery from '@/components/home/delivery/Delivery';
import Hero from '@/components/home/hero/Hero';
import InstagramGrid from '@/components/home/instagram/InstagramGrid';
import ReviewStrip from '@/components/home/reviews/ReviewStrip';
import ProductSlider from '@/components/products/ProductSlider';
import styles from './page.module.scss';

export const dynamic = 'force-dynamic';

interface ProductRow {
  id: string;
  name: string;
  price: number | null;
  productImageUrl: string | null;
}

const normalizeProducts = (rows: ProductRow[]) =>
  rows.map((p) => ({
    ...p,
    price: p.price ?? 0,
    productImageUrl: p.productImageUrl?.trim() ? p.productImageUrl : '/assets/prince-foods-logo.png'
  }));

// Helpers
const inWindow = (start?: string | null, end?: string | null, now = new Date()) => {
  if (!start || !end) return true; // if no window, treat as always-on base
  const s = new Date(start);
  const e = new Date(end);
  return now >= s && now <= e;
};

const pickTimed = (
  base: string | undefined,
  override?: { text?: string; startAt?: string | null; endAt?: string | null }
) => {
  if (!override?.text) return base;
  return inWindow(override.startAt ?? null, override.endAt ?? null) ? override.text : base;
};

export default async function Home() {
  noStore();

  // 1) Load settings
  let settings: HomeSettingsDTO | null = null;
  try {
    const row = await prisma.homeSettings.findUnique({ where: { id: 1 } });
    if (row) {
      settings = {
        hero: row.hero as unknown as HeroSettings,
        delivery: row.delivery as unknown as DeliverySettings,
        instagram: row.instagram as unknown as InstagramSettings,
        promotions: row.promotions as unknown as Promotion[],
        productShowcase: row.productShowcase as unknown as ProductShowcaseSettings,
        reviews: row.reviews as unknown as ReviewsSettings
      };
    }
  } catch {
    settings = null;
  }

  // 2) Products
  let products: ProductRow[] = [];
  try {
    products = await prisma.product.findMany({
      where: { visible: true },
      take: 16,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, price: true, productImageUrl: true }
    });
  } catch {
    products = [];
  }

  const displayProducts = normalizeProducts(products);

  // 3) Derive props for existing components (they do NOT accept `settings`)
  const now = new Date();

  const heroBase = settings?.hero;
  const heroWithinGlobal = heroBase
    ? inWindow(heroBase.overrideStart ?? null, heroBase.overrideEnd ?? null, now)
    : true;

  const heroTitle = heroBase
    ? (pickTimed(heroWithinGlobal ? heroBase.title : undefined, heroBase.titleOverride) ??
      'South Asian Groceries, Delivered.')
    : 'South Asian Groceries, Delivered.';

  const heroSubtitle = heroBase
    ? (pickTimed(heroWithinGlobal ? heroBase.subtitle : undefined, heroBase.subtitleOverride) ??
      'Since 2007—authentic Indian & Sri Lankan favourites with fast UK & Ireland delivery.')
    : 'Since 2007—authentic Indian & Sri Lankan favourites with fast UK & Ireland delivery.';

  const heroTag = heroBase
    ? (pickTimed(
        heroWithinGlobal ? heroBase.floatingTag : undefined,
        heroBase.floatingTagOverride
      ) ?? 'New • Onam Favourites')
    : 'New • Onam Favourites';

  const heroImage = heroBase?.imageUrl ?? '/assets/slider1.jpg';

  // Delivery
  const deliveryBase = settings?.delivery;
  const deliveryWithinGlobal = deliveryBase
    ? inWindow(deliveryBase.overrideStart ?? null, deliveryBase.overrideEnd ?? null, now)
    : true;

  const deliveryMessage = deliveryBase
    ? (pickTimed(
        deliveryWithinGlobal ? deliveryBase.message : undefined,
        deliveryBase.messageOverride
      ) ?? 'No hidden fees. Frozen items are insulated for freshness.')
    : 'No hidden fees. Frozen items are insulated for freshness.';

  const deliveryProps = {
    gbFreeThreshold: deliveryBase?.gbFreeThreshold ?? 30,
    niFreeThreshold: deliveryBase?.niFreeThreshold ?? 40,
    frozenFee: deliveryBase?.frozenFee ?? 3.99,
    message: deliveryMessage
  };

  // Instagram (component only needs username URL in your original)
  const instagramUsernameUrl =
    settings?.instagram?.usernameUrl ?? 'https://www.instagram.com/princefoodsuk/';

  // Product Showcase title
  const showcaseTitle = settings?.productShowcase?.title ?? 'Best Sellers';

  return (
    <main className={styles.homeContainer}>
      <Hero
        title={heroTitle}
        subtitle={heroSubtitle}
        primaryCta={{
          label: heroBase?.primaryCtaLabel ?? 'Shop Best Sellers',
          href: heroBase?.primaryCtaHref ?? '/shop'
        }}
        secondaryCta={
          heroBase?.secondaryCtaLabel || heroBase?.secondaryCtaHref
            ? {
                label: heroBase?.secondaryCtaLabel ?? 'Browse Collections',
                href: heroBase?.secondaryCtaHref ?? '/collections'
              }
            : undefined
        }
        floatingTag={heroTag}
        imageUrl={heroImage}
      />

      <Delivery
        gbFreeThreshold={deliveryProps.gbFreeThreshold}
        niFreeThreshold={deliveryProps.niFreeThreshold}
        frozenFee={deliveryProps.frozenFee}
        message={deliveryProps.message}
      />

      <InstagramGrid usernameUrl={instagramUsernameUrl} />

      <ProductSlider title={showcaseTitle} products={displayProducts} />

      <ReviewStrip
        autoplay={settings?.reviews?.autoplay ?? true}
        showCount={settings?.reviews?.showCount ?? 4}
        items={settings?.reviews?.items ?? []}
      />
    </main>
  );
}
