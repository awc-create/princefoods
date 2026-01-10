// src/lib/shipping/quote.ts
import { prisma } from '@/lib/prisma';

/* -----------------------------
   Types
----------------------------- */

type ShippingService = 'STANDARD' | 'EXPRESS';
type ShippingTemp = 'DRY' | 'FROZEN';

export interface QuoteItem {
  productId: string | null;
  quantity: number;
  unitPricePence: number;
}

interface ShippingTier {
  minGramsExclusive: number;
  maxGramsInclusive: number | null;
  pricePence: number;
}

interface QuoteOk {
  ok: true;
  zone: { id: string; name: string };
  weights: {
    dryGrams: number;
    frozenGrams: number;
  };
  totals: {
    shippingDryPence: number;
    shippingFrozenPence: number;
    shippingTotalPence: number;
    subtotalPence: number;
  };
}

interface QuoteErr {
  ok: false;
  error: string;
}

export type ShippingQuote = QuoteOk | QuoteErr;

/* -----------------------------
   Helpers
----------------------------- */

function normalizePostcode(postcode: string) {
  return postcode.trim().toUpperCase().replace(/\s+/g, '');
}

function ruleMatches(
  country: string,
  postcode: string,
  rule: {
    countryCode: string;
    postcodePrefix: string | null;
    postcodeRegex: string | null;
  }
) {
  if (rule.countryCode !== country) return false;

  if (rule.postcodePrefix && !postcode.startsWith(rule.postcodePrefix)) {
    return false;
  }

  if (rule.postcodeRegex) {
    try {
      const re = new RegExp(rule.postcodeRegex, 'i');
      if (!re.test(postcode)) return false;
    } catch {
      return false;
    }
  }

  return true;
}

function pickTier(weightGrams: number, tiers: ShippingTier[]) {
  return tiers.find((t) => {
    const aboveMin = weightGrams > t.minGramsExclusive;
    const belowMax = t.maxGramsInclusive == null || weightGrams <= t.maxGramsInclusive;
    return aboveMin && belowMax;
  });
}

/* -----------------------------
   Main engine
----------------------------- */

export async function quoteShipping(args: {
  country: string;
  postcode: string;
  currency?: string;
  service: ShippingService;
  items: QuoteItem[];
}): Promise<ShippingQuote> {
  const country = args.country.trim().toUpperCase();
  const postcode = normalizePostcode(args.postcode);

  if (!country || !postcode) return { ok: false, error: 'Invalid address.' };
  if (!args.items.length) return { ok: false, error: 'Cart is empty.' };

  const subtotalPence = args.items.reduce((sum, i) => sum + i.unitPricePence * i.quantity, 0);

  /* ---- Load products ---- */

  const productIds = args.items.map((i) => i.productId).filter((id): id is string => Boolean(id));

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      shippingTemp: true,
      shippingWeightGrams: true
    }
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  let dryGrams = 0;
  let frozenGrams = 0;

  for (const item of args.items) {
    if (!item.productId) continue;
    const product = productMap.get(item.productId);
    if (!product) continue;

    const grams = (product.shippingWeightGrams ?? 0) * item.quantity;
    if (product.shippingTemp === 'FROZEN') frozenGrams += grams;
    else dryGrams += grams;
  }

  /* ---- Match zone ---- */

  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    include: { rules: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
  });

  const matchedZone = zones.find((z) => z.rules.some((r) => ruleMatches(country, postcode, r)));

  if (!matchedZone) {
    return { ok: false, error: 'No shipping zone matched this address.' };
  }

  const zone = matchedZone; // <-- non-null guarantee

  /* ---- Pricing ---- */

  async function priceFor(temp: ShippingTemp, grams: number) {
    if (grams <= 0) return 0;

    const rate = await prisma.shippingRate.findUnique({
      where: {
        zoneId_temp_service: {
          zoneId: zone.id,
          temp,
          service: args.service
        }
      },
      include: {
        tiers: {
          orderBy: { minGramsExclusive: 'asc' }
        }
      }
    });

    if (!rate) {
      throw new Error(`Missing ${temp} ${args.service} rate for zone.`);
    }

    if (rate.freeOverPence != null && subtotalPence >= rate.freeOverPence) {
      return 0;
    }

    const tier = pickTier(grams, rate.tiers);
    if (!tier) {
      throw new Error(`No ${temp} shipping tier for ${grams}g.`);
    }

    return tier.pricePence;
  }

  try {
    const shippingDryPence = await priceFor('DRY', dryGrams);
    const shippingFrozenPence = await priceFor('FROZEN', frozenGrams);

    return {
      ok: true,
      zone: { id: zone.id, name: zone.name },
      weights: { dryGrams, frozenGrams },
      totals: {
        shippingDryPence,
        shippingFrozenPence,
        shippingTotalPence: shippingDryPence + shippingFrozenPence,
        subtotalPence
      }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Shipping calculation failed.';
    return { ok: false, error: message };
  }
}
