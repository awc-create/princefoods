// src/lib/shipping.ts
import { prisma } from '@/lib/prisma';

export type ShippingTemp = 'DRY' | 'FROZEN';
export type ShippingService = 'STANDARD' | 'EXPRESS';

export interface QuoteItem {
  productId: string | null;
  quantity: number;
  unitPricePence: number;
}

export interface ShippingQuoteInput {
  country: string;
  postcode: string;
  currency?: string;
  service?: ShippingService; // (we'll ignore EXPRESS if you want)
  items: QuoteItem[];
}

interface BreakdownRow {
  temp: ShippingTemp;
  weightGrams: number;
  subtotalPence: number;
  freeOverPence: number | null;
  tierMatched: {
    minExclusive: number;
    maxInclusive: number | null;
    pricePence: number;
  } | null;
  shippingPence: number;
}

export type ShippingQuoteResult =
  | {
      ok: true;
      country: string;
      postcode: string;
      currency: string;
      service: ShippingService;
      zone: { id: string; name: string };
      totals: {
        weightGramsDry: number;
        weightGramsFrozen: number;
        subtotalPenceDry: number;
        subtotalPenceFrozen: number;
        shippingPenceDry: number;
        shippingPenceFrozen: number;
        shippingPenceTotal: number;
      };
      breakdown: BreakdownRow[];
    }
  | { ok: false; error: string };

function normCountry(v: string) {
  return (v ?? '').trim().toUpperCase();
}
function normPostcode(v: string) {
  return (v ?? '').trim().toUpperCase();
}

function safeInt(n: unknown, fallback = 0) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function matchesRule(args: {
  country: string;
  postcode: string;
  rule: { countryCode: string; postcodePrefix: string | null; postcodeRegex: string | null };
}) {
  if (normCountry(args.rule.countryCode) !== args.country) return false;

  const pc = args.postcode;

  if (args.rule.postcodePrefix) {
    const prefix = args.rule.postcodePrefix.trim().toUpperCase();
    if (prefix && pc.startsWith(prefix)) return true;
  }

  if (args.rule.postcodeRegex) {
    try {
      const re = new RegExp(args.rule.postcodeRegex, 'i');
      if (re.test(pc)) return true;
    } catch {
      // invalid regex -> ignore it
    }
  }

  // If neither prefix nor regex exists, country-only rule matches
  if (!args.rule.postcodePrefix && !args.rule.postcodeRegex) return true;

  return false;
}

function pickTier(
  weightGrams: number,
  tiers: Array<{ minGramsExclusive: number; maxGramsInclusive: number | null; pricePence: number }>
) {
  const w = Math.max(0, Math.trunc(weightGrams));
  return (
    tiers.find((t) => {
      const minOk = w > (t.minGramsExclusive ?? 0);
      const maxOk = t.maxGramsInclusive == null ? true : w <= t.maxGramsInclusive;
      return minOk && maxOk;
    }) ?? null
  );
}

export async function quoteShipping(input: ShippingQuoteInput): Promise<ShippingQuoteResult> {
  const country = normCountry(input.country);
  const postcode = normPostcode(input.postcode);
  const currency = (input.currency ?? 'GBP').trim().toUpperCase();

  // ✅ REMOVE NEXT DAY: force STANDARD always
  const service: ShippingService = 'STANDARD';

  if (!country) return { ok: false, error: 'Missing country.' };
  if (!postcode) return { ok: false, error: 'Missing postcode.' };
  if (!Array.isArray(input.items) || input.items.length === 0)
    return { ok: false, error: 'Cart is empty.' };

  const productIds = input.items.map((i) => i.productId).filter(Boolean) as string[];

  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, shippingTemp: true, shippingWeightGrams: true }
        })
      : [];

  const byId = new Map(products.map((p) => [p.id, p]));

  let weightGramsDry = 0;
  let weightGramsFrozen = 0;
  let subtotalPenceDry = 0;
  let subtotalPenceFrozen = 0;

  for (const it of input.items) {
    const qty = Math.max(0, safeInt(it.quantity, 0));
    if (qty <= 0) continue;

    const unitPrice = Math.max(0, safeInt(it.unitPricePence, 0));
    const lineSubtotal = unitPrice * qty;

    const p = it.productId ? byId.get(it.productId) : undefined;
    const temp: ShippingTemp = (p?.shippingTemp as ShippingTemp) ?? 'DRY';
    const unitWeight = Math.max(0, safeInt(p?.shippingWeightGrams ?? 0, 0));

    if (temp === 'FROZEN') {
      weightGramsFrozen += unitWeight * qty;
      subtotalPenceFrozen += lineSubtotal;
    } else {
      weightGramsDry += unitWeight * qty;
      subtotalPenceDry += lineSubtotal;
    }
  }

  const zones = await prisma.shippingZone.findMany({
    where: { isActive: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    include: { rules: true }
  });

  const matchedZone =
    zones.find((z) => z.rules.some((r) => matchesRule({ country, postcode, rule: r }))) ?? null;

  if (!matchedZone) {
    return { ok: false, error: `No shipping zone matches ${country} ${postcode}.` };
  }

  const rates = await prisma.shippingRate.findMany({
    where: { zoneId: matchedZone.id, currency, service },
    include: { tiers: { orderBy: [{ minGramsExclusive: 'asc' }] } }
  });

  const rateDry = rates.find((r) => r.temp === 'DRY') ?? null;
  const rateFrozen = rates.find((r) => r.temp === 'FROZEN') ?? null;

  const computeTemp = (
    temp: ShippingTemp,
    weightGrams: number,
    subtotalPence: number
  ): BreakdownRow => {
    const rate = temp === 'DRY' ? rateDry : rateFrozen;

    if (weightGrams <= 0) {
      return {
        temp,
        weightGrams,
        subtotalPence,
        freeOverPence: rate?.freeOverPence ?? null,
        tierMatched: null,
        shippingPence: 0
      };
    }

    if (!rate) {
      // If you want hard failure instead, change this to throw / return error above.
      return {
        temp,
        weightGrams,
        subtotalPence,
        freeOverPence: null,
        tierMatched: null,
        shippingPence: 0
      };
    }

    const freeOver = rate.freeOverPence ?? null;
    if (freeOver != null && subtotalPence >= freeOver) {
      return {
        temp,
        weightGrams,
        subtotalPence,
        freeOverPence: freeOver,
        tierMatched: null,
        shippingPence: 0
      };
    }

    const tier = pickTier(weightGrams, rate.tiers);
    const shippingPence = tier ? Math.max(0, safeInt(tier.pricePence, 0)) : 0;

    return {
      temp,
      weightGrams,
      subtotalPence,
      freeOverPence: freeOver,
      tierMatched: tier
        ? {
            minExclusive: tier.minGramsExclusive,
            maxInclusive: tier.maxGramsInclusive,
            pricePence: tier.pricePence
          }
        : null,
      shippingPence
    };
  };

  const dry = computeTemp('DRY', weightGramsDry, subtotalPenceDry);
  const frozen = computeTemp('FROZEN', weightGramsFrozen, subtotalPenceFrozen);

  const shippingPenceTotal = dry.shippingPence + frozen.shippingPence;

  return {
    ok: true,
    country,
    postcode,
    currency,
    service,
    zone: { id: matchedZone.id, name: matchedZone.name },
    totals: {
      weightGramsDry,
      weightGramsFrozen,
      subtotalPenceDry,
      subtotalPenceFrozen,
      shippingPenceDry: dry.shippingPence,
      shippingPenceFrozen: frozen.shippingPence,
      shippingPenceTotal
    },
    breakdown: [dry, frozen]
  };
}
