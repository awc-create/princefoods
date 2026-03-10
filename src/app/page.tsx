import CelebrationSection from '@/components/home/celebration-section/CelebrationSection';
import Delivery from '@/components/home/delivery/Delivery';
import Hero from '@/components/home/hero/Hero';
import InstagramGrid from '@/components/home/instagram/InstagramGrid';
import HomePromotionBanner from '@/components/home/promotion-banner/HomePromotionBanner';
import ReviewStrip from '@/components/home/reviews/ReviewStrip';
import ProductSlider from '@/components/products/ProductSlider';
import { prisma } from '@/lib/prisma';
import type { HomeSectionsResolvedDTO } from '@/types/homeResolved';
import type { HomeSectionRow } from '@/types/homeSections';
import type {
  CelebrationSection as CelebrationSectionType,
  DeliveryCard,
  DeliverySettings,
  HeroSettings,
  HomePromotionBannerSettings,
  HomeSettingsDTO,
  InstagramSettings,
  ProductShowcaseSettings,
  Promotion,
  ReviewsSettings,
  TimedText
} from '@/types/homeSettings';
import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
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
  categoryId: string | null;
}

interface SliderProduct {
  id: string;
  name: string;
  price: number;
  productImageUrl: string | null;
}

interface PromotionBannerLite {
  id: string;
  name: string;
  code: string | null;
  status: string;
  type: string;
  applyMode: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

const DEFAULT_HERO_IMAGE = '/assets/96bfc4_3547f98fa8f54128b23c97aa34bf83b9~mv2.avif';

const DEFAULT_PROMOTION_BANNER: HomePromotionBannerSettings = {
  enabled: false,
  mode: 'SELECTED_PROMOTIONS',
  promotionIds: [],
  title: '',
  message: '',
  ctaLabel: '',
  ctaHref: '/shop',
  backgroundImageUrl: null
};

const DEFAULT_HERO_SETTINGS: HeroSettings = {
  title: 'South Asian Groceries, Delivered.',
  subtitle: 'Since 2007—authentic Indian & Sri Lankan favourites with fast UK & Ireland delivery.',
  primaryCtaLabel: 'Shop Best Sellers',
  primaryCtaHref: '/shop',
  secondaryCtaLabel: 'Browse Collections',
  secondaryCtaHref: '/collections',
  images: [DEFAULT_HERO_IMAGE],
  imageUrl: DEFAULT_HERO_IMAGE
};

const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  gbFreeThreshold: 30,
  niFreeThreshold: 40,
  frozenFee: 3.99,
  message: 'No hidden fees. Frozen items are insulated for freshness.',
  cards: [
    {
      id: 'gb',
      title: 'Delivery – Great Britain',
      freeThreshold: 30,
      frozenFee: 3.99,
      enabled: true
    },
    {
      id: 'ni',
      title: 'Delivery – Northern Ireland',
      freeThreshold: 40,
      frozenFee: 3.99,
      enabled: true
    }
  ]
};

const DEFAULT_INSTAGRAM_SETTINGS: InstagramSettings = {
  token: '',
  enabled: true,
  usernameUrl: 'https://www.instagram.com/princefoodsuk/'
};

const DEFAULT_PRODUCT_SHOWCASE: ProductShowcaseSettings = {
  title: 'Featured',
  kinds: ['best_sellers'],
  selectedKind: 'best_sellers'
};

const DEFAULT_REVIEWS_SETTINGS: ReviewsSettings = {
  autoplay: true,
  showCount: 4,
  items: []
};

function trimmedOrNull(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = trimmedOrNull(value);
    if (trimmed) return trimmed;
  }
  return null;
}

const normalizeProducts = (rows: ProductRow[]): SliderProduct[] =>
  rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price ?? 0,
    productImageUrl: p.productImageUrl?.trim() ? p.productImageUrl : '/assets/prince-foods-logo.png'
  }));

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

function isSectionsOk(x: unknown): x is { ok: true; data: HomeSectionsResolvedDTO } {
  if (!x || typeof x !== 'object') return false;
  const rec = x as Record<string, unknown>;
  if (rec.ok !== true) return false;

  const data = rec.data as unknown;
  if (!data || typeof data !== 'object') return false;

  const d = data as Record<string, unknown>;
  return Array.isArray(d.sections);
}

function inWindowLoose(start?: string | null, end?: string | null, now = new Date()) {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;

  if (s && !Number.isNaN(s.getTime()) && now < s) return false;
  if (e && !Number.isNaN(e.getTime()) && now > e) return false;
  return true;
}

function dbWindowActive(start?: Date | null, end?: Date | null, now = new Date()) {
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';

  return host ? `${proto}://${host}` : '';
}

async function getResolvedHomeSections(): Promise<
  Array<{ section: HomeSectionRow; productIds: string[] }>
> {
  try {
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
  const clean = [...new Set(ids.filter(Boolean))];
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
      discountValue: true,
      categoryId: true
    }
  });

  const map = new Map<string, ProductRow>(rows.map((r) => [r.id, r]));

  return clean.flatMap((id) => {
    const row = map.get(id);
    return row ? [row] : [];
  });
}

async function productIdsFromCategoryIds(categoryIds: string[]): Promise<string[]> {
  const clean = [...new Set(categoryIds.filter(Boolean))];
  if (clean.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: {
      visible: true,
      categoryId: { in: clean }
    },
    select: { id: true }
  });

  return rows.map((r) => r.id);
}

async function productIdsFromPromotionIds(promotionIds: string[]): Promise<string[]> {
  const clean = [...new Set(promotionIds.filter(Boolean))];
  if (clean.length === 0) return [];

  const rows = await prisma.promotionProduct.findMany({
    where: {
      promotionId: { in: clean }
    },
    select: {
      productId: true
    }
  });

  return rows.map((r) => r.productId);
}

async function productIdsFromOfferIds(_offerIds: string[]): Promise<string[]> {
  return [];
}

async function getResolvedCelebrationSections(
  sections: CelebrationSectionType[] | undefined,
  now: Date
): Promise<
  Array<{
    section: CelebrationSectionType;
    products: SliderProduct[];
  }>
> {
  const safeSections = Array.isArray(sections) ? sections : [];

  const activeSections = safeSections.filter(
    (section) =>
      section.enabled !== false &&
      inWindowLoose(section.startAt ?? null, section.endAt ?? null, now)
  );

  const resolved = await Promise.all(
    activeSections.map(async (section) => {
      const [promotionProductIds, offerProductIds, categoryProductIds] = await Promise.all([
        productIdsFromPromotionIds(section.promotionIds ?? []),
        productIdsFromOfferIds(section.offerIds ?? []),
        productIdsFromCategoryIds(section.categoryIds ?? [])
      ]);

      const mergedIds = [
        ...(Array.isArray(section.productIds) ? section.productIds : []),
        ...promotionProductIds,
        ...offerProductIds,
        ...categoryProductIds
      ];

      const uniqueIds = [...new Set(mergedIds.filter(Boolean))];
      const rows = await productsByIds(uniqueIds);

      return {
        section,
        products: normalizeProducts(rows)
      };
    })
  );

  return resolved.filter((x) => x.section.title.trim().length > 0);
}

async function getLivePromotionBanner(
  cfg: HomePromotionBannerSettings | undefined,
  now: Date
): Promise<{
  title: string;
  message?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  backgroundImageUrl?: string | null;
  promoCode?: string | null;
} | null> {
  if (!cfg?.enabled) return null;
  if (!inWindowLoose(cfg.startAt ?? null, cfg.endAt ?? null, now)) return null;

  const ids = Array.isArray(cfg.promotionIds) ? cfg.promotionIds.filter(Boolean) : [];
  if (ids.length === 0) return null;

  const promotions: PromotionBannerLite[] = await prisma.promotion.findMany({
    where: {
      id: { in: ids },
      status: 'ACTIVE'
    },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      type: true,
      applyMode: true,
      startsAt: true,
      endsAt: true
    }
  });

  const livePromotions = promotions.filter((promotion) =>
    dbWindowActive(promotion.startsAt, promotion.endsAt, now)
  );

  const selected = livePromotions[0];
  if (!selected) return null;

  const promoCode = trimmedOrNull(selected.code);
  const title = firstNonEmpty(cfg.title, selected.name, 'Limited-Time Offer');
  if (!title) return null;

  const defaultMessage = promoCode
    ? `Use code ${promoCode} at checkout for this week’s featured savings.`
    : 'Shop our latest featured promotion while it’s live.';

  return {
    title,
    message: firstNonEmpty(cfg.message, defaultMessage),
    ctaLabel: firstNonEmpty(cfg.ctaLabel, 'Shop the offer'),
    ctaHref: firstNonEmpty(cfg.ctaHref, '/shop'),
    backgroundImageUrl: cfg.backgroundImageUrl ?? null,
    promoCode
  };
}

export default async function Home() {
  noStore();

  let settings: HomeSettingsDTO | null = null;

  try {
    const row = await prisma.homeSettings.findUnique({ where: { id: 1 } });

    if (row) {
      settings = {
        hero: (row.hero as unknown as HeroSettings) ?? DEFAULT_HERO_SETTINGS,
        delivery: (row.delivery as unknown as DeliverySettings) ?? DEFAULT_DELIVERY_SETTINGS,
        instagram: (row.instagram as unknown as InstagramSettings) ?? DEFAULT_INSTAGRAM_SETTINGS,
        promotions: (row.promotions as unknown as Promotion[]) ?? [],
        promotionBanner:
          (row.promotionBanner as unknown as HomePromotionBannerSettings) ??
          DEFAULT_PROMOTION_BANNER,
        celebrationSections: (row.celebrationSections as unknown as CelebrationSectionType[]) ?? [],
        productShowcase:
          (row.productShowcase as unknown as ProductShowcaseSettings) ?? DEFAULT_PRODUCT_SHOWCASE,
        reviews: (row.reviews as unknown as ReviewsSettings) ?? DEFAULT_REVIEWS_SETTINGS
      };
    }
  } catch {
    settings = null;
  }

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

  const now = new Date();

  const heroBase = settings?.hero ?? DEFAULT_HERO_SETTINGS;
  const heroWithinGlobal = inWindow(
    heroBase.overrideStart ?? null,
    heroBase.overrideEnd ?? null,
    now
  );

  const heroTitle =
    pickTimed(heroWithinGlobal ? heroBase.title : undefined, heroBase.titleOverride) ??
    DEFAULT_HERO_SETTINGS.title;

  const heroSubtitle =
    pickTimed(heroWithinGlobal ? heroBase.subtitle : undefined, heroBase.subtitleOverride) ??
    DEFAULT_HERO_SETTINGS.subtitle;

  const heroImages =
    heroBase.images && heroBase.images.length > 0
      ? heroBase.images
      : [heroBase.imageUrl ?? DEFAULT_HERO_IMAGE];

  const promotionBanner = await getLivePromotionBanner(
    settings?.promotionBanner ?? DEFAULT_PROMOTION_BANNER,
    now
  );

  const celebrationBlocks = await getResolvedCelebrationSections(
    settings?.celebrationSections ?? [],
    now
  );

  const deliveryBase = settings?.delivery ?? DEFAULT_DELIVERY_SETTINGS;
  const deliveryWithinGlobal = inWindow(
    deliveryBase.overrideStart ?? null,
    deliveryBase.overrideEnd ?? null,
    now
  );

  const deliveryMessage =
    pickTimed(
      deliveryWithinGlobal ? deliveryBase.message : undefined,
      deliveryBase.messageOverride
    ) ?? DEFAULT_DELIVERY_SETTINGS.message;

  const lockedDefaults: DeliveryCard[] = [
    {
      id: 'gb',
      title: 'Delivery – Great Britain',
      freeThreshold: deliveryBase.gbFreeThreshold ?? 30,
      frozenFee: deliveryBase.frozenFee ?? 3.99,
      enabled: true
    },
    {
      id: 'ni',
      title: 'Delivery – Northern Ireland',
      freeThreshold: deliveryBase.niFreeThreshold ?? 40,
      frozenFee: deliveryBase.frozenFee ?? 3.99,
      enabled: true
    }
  ];

  const gbOverride = deliveryBase.cards?.find((c) => c.id === 'gb');
  const niOverride = deliveryBase.cards?.find((c) => c.id === 'ni');
  const customCards = deliveryBase.cards?.filter((c) => c.id !== 'gb' && c.id !== 'ni') ?? [];

  const cardsForDelivery = [
    gbOverride ?? lockedDefaults[0],
    niOverride ?? lockedDefaults[1],
    ...customCards
  ].filter((c) => c.enabled !== false);

  const instagramUsernameUrl =
    settings?.instagram?.usernameUrl ?? DEFAULT_INSTAGRAM_SETTINGS.usernameUrl;

  return (
    <main className={styles.homeContainer}>
      {promotionBanner ? (
        <HomePromotionBanner
          title={promotionBanner.title}
          message={promotionBanner.message}
          ctaLabel={promotionBanner.ctaLabel}
          ctaHref={promotionBanner.ctaHref}
          backgroundImageUrl={promotionBanner.backgroundImageUrl}
          promoCode={promotionBanner.promoCode}
        />
      ) : null}

      <Hero
        title={heroTitle}
        subtitle={heroSubtitle}
        primaryCta={{
          label: heroBase.primaryCtaLabel ?? 'Shop Best Sellers',
          href: heroBase.primaryCtaHref ?? '/shop'
        }}
        secondaryCta={
          heroBase.secondaryCtaLabel || heroBase.secondaryCtaHref
            ? {
                label: heroBase.secondaryCtaLabel ?? 'Browse Collections',
                href: heroBase.secondaryCtaHref ?? '/collections'
              }
            : undefined
        }
        images={heroImages}
      />

      {celebrationBlocks.map(({ section, products }) => (
        <CelebrationSection
          key={section.id}
          celebrationKey={section.key}
          badge={section.badge}
          title={section.title}
          description={section.description}
          imageUrl={section.imageUrl}
          ctaLabel={section.ctaLabel}
          ctaHref={section.ctaHref}
          backgroundColor={section.backgroundColor}
          products={products}
        />
      ))}

      <Delivery
        cards={cardsForDelivery}
        gbFreeThreshold={deliveryBase.gbFreeThreshold ?? 30}
        niFreeThreshold={deliveryBase.niFreeThreshold ?? 40}
        frozenFee={deliveryBase.frozenFee ?? 3.99}
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
