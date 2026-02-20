// src/app/page.tsx
import { prisma } from '@/lib/prisma';
import type { HomeSectionsResolvedDTO } from '@/types/homeResolved';
import type { HomeSectionRow } from '@/types/homeSections';
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
import { headers } from 'next/headers';

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
  ribbon: string | null;
  discountMode: string | null;
  discountValue: number | null;
}

// What ProductSlider expects
interface SliderProduct {
  id: string;
  name: string;
  price: number;
  productImageUrl: string | null;
}

const normalizeProducts = (rows: ProductRow[]): SliderProduct[] =>
  rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price ?? 0,
    productImageUrl: p.productImageUrl?.trim() ? p.productImageUrl : '/assets/prince-foods-logo.png'
  }));

const inWindow = (start?: string | null, end?: string | null, now = new Date()) => {
  // if either missing, treat as always-on
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

function isSectionsOk(x: unknown): x is { ok: true; data: HomeSectionsResolvedDTO } {
  if (!x || typeof x !== 'object') return false;
  const rec = x as Record<string, unknown>;
  if (rec.ok !== true) return false;

  const data = rec.data as unknown;
  if (!data || typeof data !== 'object') return false;

  const d = data as Record<string, unknown>;
  return Array.isArray(d.sections);
}

async function originFromHeaders(): Promise<string> {
  // ✅ in your Next version, headers() is async
  const h = await headers();

  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';

  return host ? `${proto}://${host}` : '';
}

async function getResolvedHomeSections(): Promise<
  Array<{ section: HomeSectionRow; productIds: string[] }>
> {
  try {
    // ✅ server-side fetch needs absolute URL sometimes; this handles both
    const origin = await originFromHeaders();
    const url = origin ? `${origin}/api/site/home/sections` : '/api/site/home/sections';

    const res = await fetch(url, { cache: 'no-store' });
    const json = (await res.json()) as unknown;

    if (!isSectionsOk(json)) return [];
    return json.data.sections;
  } catch {
    return [];
  }
}

async function productsByIds(ids: string[]): Promise<ProductRow[]> {
  const clean = ids.filter(Boolean);
  if (clean.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: { id: { in: clean }, visible: true },
    select: {
      id: true,
      name: true,
      price: true,
      productImageUrl: true,
      ribbon: true,
      discountMode: true,
      discountValue: true
    }
  });

  // ✅ preserve resolver ordering
  const map = new Map(rows.map((r) => [r.id, r]));
  return clean.map((id) => map.get(id)).filter((x): x is ProductRow => !!x);
}

export default async function Home() {
  noStore();

  // 1) Settings
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

  // 2) Sections (DB-backed)
  const resolved = await getResolvedHomeSections();

  const sliders = await Promise.all(
    resolved.map(async ({ section, productIds }) => {
      const rows = await productsByIds(productIds);
      return {
        id: section.id,
        title: section.title,
        subtitle: section.subtitle ?? null,
        enabled: section.enabled !== false,
        products: normalizeProducts(rows)
      };
    })
  );

  const enabledSliders = sliders.filter((s) => s.enabled);

  // fallback products (only if no enabled sliders)
  const FALLBACK_PRODUCTS: SliderProduct[] = [
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
    }
  ];

  // 3) Derive props
  const now = new Date();

  const heroBase = settings?.hero;
  const heroWithinGlobal = heroBase
    ? inWindow(heroBase.overrideStart ?? null, heroBase.overrideEnd ?? null, now)
    : true;

  const heroTitle =
    pickTimed(heroWithinGlobal ? heroBase?.title : undefined, heroBase?.titleOverride) ??
    'South Asian Groceries, Delivered.';

  const heroSubtitle =
    pickTimed(heroWithinGlobal ? heroBase?.subtitle : undefined, heroBase?.subtitleOverride) ??
    'Since 2007—authentic Indian & Sri Lankan favourites with fast UK & Ireland delivery.';

  const heroImages =
    heroBase?.images && heroBase.images.length > 0
      ? heroBase.images
      : [heroBase?.imageUrl ?? DEFAULT_HERO_IMAGE];

  const deliveryBase = settings?.delivery;
  const deliveryWithinGlobal = deliveryBase
    ? inWindow(deliveryBase.overrideStart ?? null, deliveryBase.overrideEnd ?? null, now)
    : true;

  const deliveryMessage =
    pickTimed(
      deliveryWithinGlobal ? deliveryBase?.message : undefined,
      deliveryBase?.messageOverride
    ) ?? 'No hidden fees. Frozen items are insulated for freshness.';

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

  const gbOverride = deliveryBase?.cards?.find((c) => c.id === 'gb');
  const niOverride = deliveryBase?.cards?.find((c) => c.id === 'ni');
  const customCards = deliveryBase?.cards?.filter((c) => c.id !== 'gb' && c.id !== 'ni') ?? [];

  const cardsForDelivery = [
    gbOverride ?? lockedDefaults[0],
    niOverride ?? lockedDefaults[1],
    ...customCards
  ].filter((c) => c.enabled !== false);

  const instagramUsernameUrl =
    settings?.instagram?.usernameUrl ?? 'https://www.instagram.com/princefoodsuk/';

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

      {enabledSliders.length > 0 ? (
        enabledSliders.map((s) => (
          <ProductSlider
            key={s.id}
            title={s.title}
            subtitle={s.subtitle ?? undefined}
            products={s.products}
          />
        ))
      ) : (
        <ProductSlider
          title="Best Sellers"
          subtitle="Popular picks right now"
          products={FALLBACK_PRODUCTS}
        />
      )}

      <ReviewStrip
        autoplay={settings?.reviews?.autoplay ?? true}
        showCount={settings?.reviews?.showCount ?? 4}
        items={settings?.reviews?.items ?? []}
      />
    </main>
  );
}
