// src/app/page.tsx
import { prisma } from '@/lib/prisma';
import type {
  DeliveryCard,
  DeliverySettings,
  HeroSettings,
  HomeSettingsDTO,
  InstagramSettings,
  ProductShowcaseSettings,
  Promotion,
  ReviewsSettings,
  TimedText
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
  if (!start || !end) return true;
  const s = new Date(start);
  const e = new Date(end);
  return now >= s && now <= e;
};

const pickTimed = (base: string | undefined, override?: TimedText) => {
  if (!override?.text) return base;
  return inWindow(override.startAt ?? null, override.endAt ?? null) ? override.text : base;
};

const DEFAULT_HERO_IMAGE = '/assets/96bfc4_3547f98fa8f54128b23c97aa34bf83b9~mv2.avif';

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

  // Fallback: ONLY when DB is empty
  const FALLBACK_PRODUCTS = [
    {
      id: 'tmp-1',
      name: 'Prince Foods Nadan Chappathi 400g',
      price: 1.99,
      productImageUrl: '/assets/fallback/chappathi.jpg'
    },
    {
      id: 'tmp-2',
      name: 'Prince Foods Malabar Murukku 150g',
      price: 2.29,
      productImageUrl: '/assets/fallback/murukku.jpg'
    },
    {
      id: 'tmp-3',
      name: 'Prince Foods Sweet Banana Chips Sarkarra Varatti 150g',
      price: 1.49,
      productImageUrl: '/assets/fallback/banana-chips.jpg'
    },
    {
      id: 'tmp-4',
      name: 'Prince Foods Cassava Chips (Spicy) 150g',
      price: 2.29,
      productImageUrl: '/assets/fallback/cassava-chips.jpg'
    },
    {
      id: 'tmp-5',
      name: 'Prince Foods Plantain Chips 250g',
      price: 1.99,
      productImageUrl: '/assets/fallback/plantain-chips.jpg'
    },
    {
      id: 'tmp-6',
      name: 'Prince Foods Mixture 600g',
      price: 3.99,
      productImageUrl: '/assets/fallback/mixture.jpg'
    }
  ];
  const sliderProducts = displayProducts.length > 0 ? displayProducts : FALLBACK_PRODUCTS;

  // 3) Derive props
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

  // Prefer images[], fallback to legacy imageUrl, then default
  const heroImages =
    heroBase?.images && heroBase.images.length > 0
      ? heroBase.images
      : [heroBase?.imageUrl ?? DEFAULT_HERO_IMAGE];

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

  // Locked defaults (non-deletable, but can be disabled via admin)
  const lockedDefaults: DeliveryCard[] = [
    {
      id: 'gb',
      title: 'Delivery – Great Britain',
      freeThreshold: deliveryBase?.gbFreeThreshold ?? 30,
      frozenFee: deliveryBase?.frozenFee ?? 3.99,
      enabled: true
    },
    {
      id: 'ni',
      title: 'Delivery – Northern Ireland',
      freeThreshold: deliveryBase?.niFreeThreshold ?? 40,
      frozenFee: deliveryBase?.frozenFee ?? 3.99,
      enabled: true
    }
  ];

  // Use admin overrides when present
  const gbOverride = deliveryBase?.cards?.find((c) => c.id === 'gb');
  const niOverride = deliveryBase?.cards?.find((c) => c.id === 'ni');
  const customCards = deliveryBase?.cards?.filter((c) => c.id !== 'gb' && c.id !== 'ni') ?? [];

  const cardsForDelivery = [
    gbOverride ?? lockedDefaults[0],
    niOverride ?? lockedDefaults[1],
    ...customCards
  ].filter((c) => c.enabled !== false); // hide if disabled

  const instagramUsernameUrl =
    settings?.instagram?.usernameUrl ?? 'https://www.instagram.com/princefoodsuk/';

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
        // floatingTag intentionally omitted
        images={heroImages}
      />

      <Delivery
        cards={cardsForDelivery}
        gbFreeThreshold={deliveryBase?.gbFreeThreshold ?? 30}
        niFreeThreshold={deliveryBase?.niFreeThreshold ?? 40}
        frozenFee={deliveryBase?.frozenFee ?? 3.99}
        message={deliveryMessage}
      />

      <InstagramGrid usernameUrl={instagramUsernameUrl} />

      <ProductSlider title={showcaseTitle} products={sliderProducts} />

      <ReviewStrip
        autoplay={settings?.reviews?.autoplay ?? true}
        showCount={settings?.reviews?.showCount ?? 4}
        items={settings?.reviews?.items ?? []}
      />
    </main>
  );
}
