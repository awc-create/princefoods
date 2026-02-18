// src/app/api/checkout/place-order/route.ts
import { authOptions } from '@/lib/auth-options';
import { logOfferAttemptsBulk } from '@/lib/offer-attempts';
import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { quoteShipping, type ShippingService, type ShippingTemp } from '@/lib/shipping';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

// ✅ Offers engine (JSON offers from AppSetting)
import { evaluateOffers, type CartLine as OfferCartLine } from '@/lib/offers-engine';
import { getOffers } from '@/lib/offers-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Human-friendly short code (avoid 0/O/1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function isPrismaKnownError(e: unknown): e is { code: string; message?: string } {
  return (
    typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).code === 'string'
  );
}
function isUniqueViolation(e: unknown): boolean {
  return isPrismaKnownError(e) && e.code === 'P2002';
}

interface Line {
  id?: string;
  sku?: string | null;
  name: string;
  unitPrice: number; // pence
  quantity: number;
  imageUrl?: string | null;
  productId?: string | null;
  options?: unknown;
}

interface Totals {
  subtotal: number;
  shipping: number;
  discount: number;
  tax: number;
  grandTotal: number;
}

interface AddressDTO {
  firstName?: string;
  lastName?: string;
  line1: string;
  line2?: string;
  city?: string;
  town?: string;
  postcode: string;
  country: string;
  phoneE164?: string;
}

function nonEmpty(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

function isValidMoney(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && Number.isInteger(n);
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function requireCourierFields(addr: AddressDTO, label: 'shipping' | 'billing') {
  if (!nonEmpty(addr.firstName)) return `${label}: firstName is required.`;
  if (!nonEmpty(addr.lastName)) return `${label}: lastName is required.`;
  if (!nonEmpty(addr.line1)) return `${label}: line1 is required.`;
  if (!nonEmpty(addr.postcode)) return `${label}: postcode is required.`;
  if (!nonEmpty(addr.country)) return `${label}: country is required.`;
  if (!nonEmpty(addr.phoneE164)) return `${label}: phoneE164 is required.`;

  const cc = addr.country.trim().toUpperCase();
  if (cc === 'GB' && !nonEmpty(addr.town))
    return `${label}: town (Post Town) is required for UK addresses.`;

  return null;
}

type AddressKind = 'SHIPPING' | 'BILLING' | 'BOTH';

function normalizeCountry(c: string) {
  return c.trim().toUpperCase();
}

function cleanOptional(v: string | undefined) {
  const t = (v ?? '').trim();
  return t ? t : undefined;
}

/**
 * ✅ Offers engine applied-line helpers
 * Your engine's OfferApplied doesn't have `.id`, so we resolve a stable id safely.
 */
function offerAppliedId(o: unknown): string {
  if (!o || typeof o !== 'object') return 'OFFER_UNKNOWN';

  const r = o as Record<string, unknown>;

  const direct =
    (typeof r.offerId === 'string' && r.offerId) ||
    (typeof r.key === 'string' && r.key) ||
    (typeof r.code === 'string' && r.code) ||
    (typeof r.name === 'string' && r.name);

  if (direct) return String(direct).trim().slice(0, 80).toUpperCase().replace(/\s+/g, '_');

  try {
    const s = JSON.stringify(o);
    return `OFFER_${s.length}_${Buffer.from(s).toString('base64').slice(0, 24)}`;
  } catch {
    return 'OFFER_UNKNOWN';
  }
}

function offerAppliedKind(o: unknown): string | null {
  if (!o || typeof o !== 'object') return null;
  const r = o as Record<string, unknown>;
  return typeof r.kind === 'string' ? r.kind : null;
}

function offerAppliedDiscountPence(o: unknown): number {
  if (!o || typeof o !== 'object') return 0;
  const r = o as Record<string, unknown>;
  const v = r.discountPence;
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
}

/**
 * ✅ Best-effort address book save (non-blocking)
 */
async function saveAddressBookBestEffort(args: {
  userId: string;
  label: string;
  kind: AddressKind;
  addr: AddressDTO;
}) {
  const label = args.label.trim().slice(0, 80);
  if (!label) return;

  const country = normalizeCountry(args.addr.country);
  const line1 = args.addr.line1.trim().slice(0, 200);
  const postcode = args.addr.postcode.trim().slice(0, 32);

  const existingCount = await prisma.addressBook.count({ where: { userId: args.userId } });
  const shouldDefault = existingCount === 0;

  const existing = await prisma.addressBook.findFirst({
    where: { userId: args.userId, label, kind: args.kind },
    select: { id: true }
  });

  if (shouldDefault) {
    await prisma.addressBook.updateMany({
      where: { userId: args.userId },
      data: { isDefault: false }
    });
  }

  const data = {
    userId: args.userId,
    label,
    isDefault: shouldDefault,
    kind: args.kind as AddressKind,
    firstName: cleanOptional(args.addr.firstName)?.slice(0, 80),
    lastName: cleanOptional(args.addr.lastName)?.slice(0, 80),
    line1,
    line2: cleanOptional(args.addr.line2)?.slice(0, 200),
    town: cleanOptional(args.addr.town)?.slice(0, 120),
    city: (args.addr.city ?? '').trim().slice(0, 120),
    postcode,
    country,
    phoneE164: cleanOptional(args.addr.phoneE164)?.slice(0, 32)
  };

  if (existing) {
    await prisma.addressBook.update({ where: { id: existing.id }, data });
    return;
  }

  await prisma.addressBook.create({ data });
}

function normalizePromoCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

// ✅ logs ORDER_* promo attempt rows (linked to orderId when created)
async function logPromoOrderAttempt(args: {
  checkoutId?: string | null;
  code: string;
  promotionId?: string | null;
  userId?: string | null;
  email?: string | null;
  orderId?: string | null;
  outcome: 'ORDER_APPLIED' | 'ORDER_NOT_APPLIED' | 'ORDER_REJECTED';
  errorCode?: string | null;
  currency: string;
  subtotalPence?: number | null;
  shippingPence?: number | null;
  discountPence?: number;
  shippingDiscountPence?: number;
}) {
  try {
    await prisma.promotionAttempt.create({
      data: {
        checkoutId: args.checkoutId ?? null,
        code: args.code,
        promotionId: args.promotionId ?? null,
        userId: args.userId ?? null,
        email: args.email ?? null,
        orderId: args.orderId ?? null,
        outcome: args.outcome,
        errorCode: args.errorCode ?? null,
        currency: args.currency,
        subtotalPence: args.subtotalPence ?? null,
        shippingPence: args.shippingPence ?? null,
        discountPence: Math.max(0, Math.trunc(args.discountPence ?? 0)),
        shippingDiscountPence: Math.max(0, Math.trunc(args.shippingDiscountPence ?? 0))
      }
    });
  } catch {
    // ignore
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    const body = (await req.json()) as {
      items: Line[];
      shippingAddress: AddressDTO;
      billingSameAsShipping?: boolean;
      billingAddress?: AddressDTO;
      totals: Totals;
      currency?: string;
      contactEmail?: string;

      // kept for backwards compat, but we do NOT use it now
      delivery?: 'standard' | 'express';

      saveAddress?: boolean;
      saveAddressLabel?: string;

      // client may send these, but server will re-validate & compute discounts itself
      promotionId?: string;
      promotionCode?: string;

      shippingQuote?: { zoneId?: string; rateId?: string };

      // ✅ correlation id from client
      checkoutId?: string | null;
    };

    const checkoutId = typeof body.checkoutId === 'string' ? body.checkoutId.trim() : null;

    if (!body?.items?.length) return bad('No items in order.');

    // ✅ Validate lines + compute trusted subtotal (PAID items only)
    let computedSubtotal = 0;
    for (const it of body.items) {
      if (!nonEmpty(it.name)) return bad('Invalid line item: name is required.');
      if (!isValidMoney(it.unitPrice))
        return bad('Invalid line item: unitPrice must be an integer (pence).');
      if (!isValidMoney(it.quantity) || it.quantity < 1)
        return bad('Invalid line item: quantity must be >= 1.');
      computedSubtotal += it.unitPrice * it.quantity;
    }

    const t = body.totals;
    if (!t || !isValidMoney(t.tax)) return bad('Invalid totals.');

    const s = body.shippingAddress;
    if (!s) return bad('Missing shipping address.');
    const shipErr = requireCourierFields(s, 'shipping');
    if (shipErr) return bad(shipErr);

    const billingSameAsShipping = body.billingSameAsShipping ?? true;
    const b = body.billingAddress;

    if (!billingSameAsShipping) {
      if (!b) return bad('Billing address is required when billingSameAsShipping is false.');
      const billErr = requireCourierFields(b, 'billing');
      if (billErr) return bad(billErr);
    }

    const currency = nonEmpty(body.currency) ? body.currency.trim().toUpperCase() : 'GBP';

    const maybeUserId: string | undefined =
      (session?.user as { id?: string } | null)?.id ?? undefined;

    // ✅ only connect Address/User if the user actually exists in DB.
    let safeUserId: string | null = null;
    if (maybeUserId) {
      const exists = await prisma.user.findUnique({
        where: { id: maybeUserId },
        select: { id: true }
      });
      safeUserId = exists?.id ?? null;
    }

    const contactEmailTrimmed =
      typeof body.contactEmail === 'string' ? body.contactEmail.trim() : '';
    const sessionEmail = typeof session?.user?.email === 'string' ? session.user.email.trim() : '';

    const emailForOrder = contactEmailTrimmed || sessionEmail || 'guest@prince-v.com';
    const emailNorm = emailForOrder.trim().toLowerCase();

    // ✅ always STANDARD
    const service: ShippingService = 'STANDARD';

    // Snapshot product shipping + offer targeting inputs
    const ids = body.items.map((i) => i.productId).filter(Boolean) as string[];

    const products: Array<{
      id: string;
      name: string;
      sku: string | null;
      categoryId: string | null;
      shippingTemp: ShippingTemp;
      shippingWeightGrams: number | null;
    }> =
      ids.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: ids } },
            select: {
              id: true,
              name: true,
              sku: true,
              categoryId: true,
              shippingTemp: true,
              shippingWeightGrams: true
            }
          })
        : [];

    const byId = new Map(products.map((p) => [p.id, p]));
    const catById = new Map(products.map((p) => [p.id, p.categoryId]));

    type EnrichedLine = Line & {
      unitWeightGrams: number;
      temp: ShippingTemp;
      isFree?: boolean;
    };

    let enriched: EnrichedLine[] = body.items.map((it) => {
      const p = it.productId ? byId.get(it.productId) : undefined;

      const unitWeightGrams =
        p?.shippingWeightGrams != null && Number.isFinite(p.shippingWeightGrams)
          ? Math.max(0, Math.trunc(p.shippingWeightGrams))
          : 0;

      const temp: ShippingTemp = (p?.shippingTemp as ShippingTemp) ?? 'DRY';

      return { ...it, unitWeightGrams, temp };
    });

    // -------- OFFERS ENGINE (JSON offers) --------
    // We evaluate offers BEFORE shipping so BOGOF auto-add can influence shipping weight/price.
    const codeRaw = typeof body.promotionCode === 'string' ? body.promotionCode : '';
    const normalizedCode = normalizePromoCode(codeRaw);

    const offersAll = await getOffers();

    const offerLines: OfferCartLine[] = enriched.map((it) => ({
      productId: it.productId ?? undefined,
      sku: it.sku ?? undefined,
      name: it.name,
      unitPricePence: it.unitPrice,
      qty: it.quantity,
      categoryId: it.productId ? (catById.get(it.productId) ?? undefined) : undefined
    }));

    const offerResult = evaluateOffers(offersAll, {
      lines: offerLines,
      code: normalizedCode || null
    });

    // If BOGOF wants auto-add free items, add them as £0 lines (server truth)
    if (offerResult.autoAdd.length) {
      const extra: EnrichedLine[] = offerResult.autoAdd.map((a) => {
        const p = a.productId ? byId.get(a.productId) : undefined;

        const unitWeightGrams =
          p?.shippingWeightGrams != null && Number.isFinite(p.shippingWeightGrams)
            ? Math.max(0, Math.trunc(p.shippingWeightGrams))
            : 0;

        const temp: ShippingTemp = (p?.shippingTemp as ShippingTemp) ?? 'DRY';

        return {
          name: a.name,
          quantity: Math.max(1, Math.trunc(a.qty)),
          unitPrice: 0,
          productId: a.productId ?? null,
          sku: a.sku ?? null,
          imageUrl: null,
          unitWeightGrams,
          temp,
          isFree: true,
          options: {
            free: true,
            autoAddedByOfferId: a.reasonOfferId
          }
        };
      });

      enriched = [...enriched, ...extra];
    }

    const totalWeightGrams = enriched.reduce(
      (sum, it) => sum + it.unitWeightGrams * it.quantity,
      0
    );

    // ✅ Enforce shipping server-side (includes any auto-added free items)
    const shipCountry = s.country.trim().toUpperCase();
    const shipPostcode = s.postcode.trim();

    const quote = await quoteShipping({
      country: shipCountry,
      postcode: shipPostcode,
      currency,
      service,
      items: enriched.map((it) => ({
        productId: it.productId ?? null,
        quantity: it.quantity,
        unitPricePence: it.unitPrice
      }))
    });

    if (!quote.ok) return bad(quote.error);

    const baseShippingTotal = Math.max(0, Math.trunc(quote.totals.shippingPenceTotal ?? 0));

    // Determine shipping kind for promo (best-effort)
    const kind: 'DRY' | 'FROZEN' | 'MIXED' =
      quote.totals.weightGramsFrozen > 0 && quote.totals.weightGramsDry > 0
        ? 'MIXED'
        : quote.totals.weightGramsFrozen > 0
          ? 'FROZEN'
          : 'DRY';

    // -------- PROMOTION (DB) evaluation --------
    let promotionId: string | null = null;
    let promotionCode: string | null = null;

    let promoItemDiscountPence = 0;
    let promoShippingDiscountPence = 0;

    if (normalizedCode) {
      const promo = await prisma.promotion.findUnique({
        where: { code: normalizedCode },
        select: {
          id: true,
          code: true,
          status: true,
          startsAt: true,
          endsAt: true,
          lockedToUserId: true,
          lockedToEmail: true,
          maxUsesTotal: true,
          maxUsesPerUser: true,
          discountType: true,
          percentOff: true,
          amountOffPence: true,
          applyShippingDiscount: true,
          shippingPercentOffDry: true,
          shippingPercentOffFrozen: true,
          targetType: true,
          categories: { select: { categoryId: true } },
          products: { select: { productId: true } }
        }
      });

      if (promo && promo.status === 'ACTIVE') {
        const now = new Date();

        const okTime =
          (!promo.startsAt || now >= promo.startsAt) && (!promo.endsAt || now <= promo.endsAt);
        const okLockUser = !promo.lockedToUserId || promo.lockedToUserId === safeUserId;
        const okLockEmail =
          !promo.lockedToEmail || promo.lockedToEmail.trim().toLowerCase() === emailNorm;

        if (okTime && okLockUser && okLockEmail) {
          // ✅ usage gates
          let okTotalUses = true;
          if (promo.maxUsesTotal != null && promo.maxUsesTotal >= 0) {
            const used = await prisma.promotionRedemption.count({
              where: { promotionId: promo.id }
            });
            okTotalUses = used < promo.maxUsesTotal;
          }

          let okPerUser = true;
          if (promo.maxUsesPerUser != null && promo.maxUsesPerUser >= 0) {
            if (safeUserId) {
              const usedU = await prisma.promotionRedemption.count({
                where: { promotionId: promo.id, userId: safeUserId }
              });
              okPerUser = usedU < promo.maxUsesPerUser;
            } else if (emailNorm) {
              const usedE = await prisma.promotionRedemption.count({
                where: { promotionId: promo.id, emailUsed: emailNorm }
              });
              okPerUser = usedE < promo.maxUsesPerUser;
            }
          }

          if (okTotalUses && okPerUser) {
            // only PAID items should be eligible for item discount (ignore free auto-add lines)
            const paidItems = enriched.filter((x) => !x.isFree);

            const itemsForPromo = paidItems.map((it) => ({
              productId: it.productId ?? undefined,
              unitPrice: it.unitPrice,
              quantity: it.quantity
            }));

            let matched = itemsForPromo;

            if (promo.targetType === 'PRODUCTS') {
              const allowed = new Set(promo.products.map((p) => p.productId));
              matched = itemsForPromo.filter((it) => !!it.productId && allowed.has(it.productId));
            } else if (promo.targetType === 'CATEGORIES') {
              const allowedCats = new Set(promo.categories.map((c) => c.categoryId));
              matched = itemsForPromo.filter((it) => {
                if (!it.productId) return false;
                const cid = catById.get(it.productId) ?? null;
                return !!cid && allowedCats.has(cid);
              });
            }

            const matchedSubtotal = matched.reduce(
              (sum, it) => sum + it.unitPrice * it.quantity,
              0
            );

            let itemDiscount = 0;
            if (promo.discountType === 'PERCENT') {
              itemDiscount = Math.round((matchedSubtotal * clampPct(promo.percentOff ?? 0)) / 100);
            } else if (promo.discountType === 'AMOUNT') {
              itemDiscount = Math.max(0, Math.min(matchedSubtotal, promo.amountOffPence ?? 0));
            } else if (promo.discountType === 'PRODUCT_100') {
              itemDiscount = matchedSubtotal;
            }

            itemDiscount = Math.max(0, Math.min(itemDiscount, computedSubtotal));

            let shipDiscount = 0;
            if (promo.applyShippingDiscount) {
              const pctDry = clampPct(promo.shippingPercentOffDry ?? 0);
              const pctFrozen = clampPct(promo.shippingPercentOffFrozen ?? 0);

              // MIXED: pick the bigger discount
              const pct =
                kind === 'FROZEN'
                  ? pctFrozen
                  : kind === 'DRY'
                    ? pctDry
                    : Math.max(pctDry, pctFrozen);

              shipDiscount = Math.round((baseShippingTotal * pct) / 100);
              shipDiscount = Math.max(0, Math.min(shipDiscount, baseShippingTotal));
            }

            promotionId = promo.id;
            promotionCode = promo.code;
            promoItemDiscountPence = itemDiscount;
            promoShippingDiscountPence = shipDiscount;
          }
        }
      }
    }

    // -------- Decide: Offers vs Promotion (BEST SAVINGS WINS) --------
    const offerItemDiscountPence = Math.max(0, Math.trunc(offerResult.discountTotalPence ?? 0));
    const promoTotalSavings = promoItemDiscountPence + promoShippingDiscountPence;
    const offerTotalSavings = offerItemDiscountPence; // offers currently don’t do shipping discount

    // Use offers if they save more OR they auto-added free items (even if discount is 0)
    const offersHaveImpact = offerTotalSavings > 0 || offerResult.autoAdd.length > 0;
    const promoApplied = Boolean(promotionId && promotionCode);

    const useOffers = offersHaveImpact && (!promoApplied || offerTotalSavings > promoTotalSavings);

    // ✅ Optional: if offers evaluated but didn't win, log ORDER_NOT_APPLIED (best-effort)
    if (!useOffers && (offerResult.applied.length || offerResult.autoAdd.length)) {
      await logOfferAttemptsBulk(
        [
          ...offerResult.applied.map((o) => ({
            checkoutId,
            offerId: offerAppliedId(o),
            offerName: (o as { name?: string }).name ?? 'Offer',
            offerKind: offerAppliedKind(o),
            userId: safeUserId,
            email: emailNorm || null,
            orderId: null,
            outcome: 'ORDER_NOT_APPLIED' as const,
            errorCode: promoApplied ? 'LOST_TO_PROMO' : 'NO_IMPACT',
            currency,
            subtotalPence: computedSubtotal,
            shippingPence: null,
            discountPence: offerAppliedDiscountPence(o),
            shippingDiscountPence: 0
          })),
          ...offerResult.autoAdd.map((a) => ({
            checkoutId,
            offerId: a.reasonOfferId ?? 'AUTO_ADD',
            offerName: 'Auto-added free items',
            offerKind: 'AUTO_ADD',
            userId: safeUserId,
            email: emailNorm || null,
            orderId: null,
            outcome: 'ORDER_NOT_APPLIED' as const,
            errorCode: promoApplied ? 'LOST_TO_PROMO' : 'NO_IMPACT',
            currency,
            subtotalPence: computedSubtotal,
            shippingPence: null,
            discountPence: 0,
            shippingDiscountPence: 0
          }))
        ].slice(0, 50)
      );
    }

    // If offers win, drop promo on the order (promo code is still logged as rejected)
    if (useOffers) {
      promotionId = null;
      promotionCode = null;
      promoItemDiscountPence = 0;
      promoShippingDiscountPence = 0;
    }

    // ✅ totals (trusted)
    const shippingAfterDiscount = Math.max(0, baseShippingTotal - promoShippingDiscountPence);

    const discountTotal = Math.max(
      0,
      (useOffers ? offerItemDiscountPence : promoItemDiscountPence) + promoShippingDiscountPence
    );

    const itemDiscountUsed = useOffers ? offerItemDiscountPence : promoItemDiscountPence;

    const grandTotal = Math.max(
      0,
      computedSubtotal + shippingAfterDiscount - itemDiscountUsed + t.tax
    );

    // ✅ Create addresses snapshot
    const shipTown = (s.town ?? '').trim();
    const shipCity = (s.city ?? '').trim() || shipTown;

    const createdShipping = await prisma.address.create({
      data: {
        firstName: s.firstName?.trim() ?? undefined,
        lastName: s.lastName?.trim() ?? undefined,
        line1: s.line1.trim(),
        line2: s.line2?.trim() ? s.line2.trim() : undefined,
        city: shipCity,
        town: shipTown ? shipTown : undefined,
        postcode: s.postcode.trim(),
        country: shipCountry,
        phoneE164: s.phoneE164?.trim() ? s.phoneE164.trim() : undefined,
        ...(safeUserId ? { user: { connect: { id: safeUserId } } } : {})
      }
    });

    const createdBillingAddr = billingSameAsShipping
      ? createdShipping
      : await prisma.address.create({
          data: {
            firstName: b!.firstName?.trim() ?? undefined,
            lastName: b!.lastName?.trim() ?? undefined,
            line1: b!.line1.trim(),
            line2: b!.line2?.trim() ? b!.line2.trim() : undefined,
            city: ((b!.city ?? '').trim() || (b!.town ?? '').trim()).slice(0, 120),
            town: (b!.town ?? '').trim() ? (b!.town ?? '').trim().slice(0, 120) : undefined,
            postcode: b!.postcode.trim(),
            country: b!.country.trim().toUpperCase(),
            phoneE164: b!.phoneE164?.trim() ? b!.phoneE164.trim() : undefined,
            ...(safeUserId ? { user: { connect: { id: safeUserId } } } : {})
          }
        });

    // ✅ Create order WITH displayId; retry on collision
    const MAX_TRIES = 5;

    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        const displayId = makeCode(8);

        const created = await prisma.order.create({
          data: {
            displayId,
            contactEmail: emailForOrder,

            ...(safeUserId ? { user: { connect: { id: safeUserId } } } : {}),

            status: 'PLACED',
            paymentStatus: 'PENDING',
            currency,

            subtotal: computedSubtotal,
            shippingTotal: shippingAfterDiscount,
            discountTotal,
            taxTotal: t.tax,
            grandTotal,

            shippingAddress: { connect: { id: createdShipping.id } },
            billingAddress: { connect: { id: createdBillingAddr.id } },

            notes: contactEmailTrimmed && !sessionEmail ? 'Guest checkout' : null,
            totalWeightGrams,

            ...(promotionId ? { promotion: { connect: { id: promotionId } } } : {}),
            ...(promotionCode ? { promotionCode } : {}),

            shippingZoneId: quote.zone.id,
            shippingRateId: undefined,
            shippingService: service,
            shippingTemp:
              quote.totals.weightGramsFrozen > 0 && quote.totals.weightGramsDry === 0
                ? 'FROZEN'
                : 'DRY',

            items: {
              create: enriched.map((it) => ({
                ...(it.productId ? { productId: it.productId } : {}),
                ...(it.sku ? { sku: it.sku } : {}),
                name: it.name,
                ...(it.imageUrl ? { imageUrl: it.imageUrl } : {}),
                unitPrice: it.unitPrice,
                quantity: it.quantity,
                lineTotal: it.unitPrice * it.quantity,
                unitWeightGrams: it.unitWeightGrams,
                ...(it.options != null ? { options: it.options } : {})
              }))
            }
          },
          select: {
            id: true,
            displayId: true,
            userId: true,
            promotionId: true,
            promotionCode: true,
            currency: true,
            subtotal: true,
            shippingTotal: true,
            discountTotal: true
          }
        });

        await logActivity(created.id, 'PLACED');

        // ✅ Offers audit trail
        if (useOffers && (offerResult.applied.length || offerResult.autoAdd.length)) {
          await prisma.orderActivity.create({
            data: {
              orderId: created.id,
              type: 'NOTE',
              note: `Offers applied: ${
                offerResult.applied
                  .map((x) => (x as { name?: string }).name ?? 'Offer')
                  .join(', ') || 'BOGOF auto-add'
              }`,
              meta: {
                applied: offerResult.applied,
                autoAdd: offerResult.autoAdd,
                discountPence: offerItemDiscountPence
              } as unknown as object
            }
          });
        }

        // ✅ Persist offer usage (queryable: for customer page + order detail)
        if (useOffers && (offerResult.applied.length || offerResult.autoAdd.length)) {
          const userId = created.userId ?? null;

          const rows = offerResult.applied.length
            ? offerResult.applied.map((o) => ({
                orderId: created.id,
                userId,
                emailUsed: emailNorm || null,
                offerId: offerAppliedId(o),
                offerName: (o as { name?: string }).name ?? 'Offer',
                offerKind: offerAppliedKind(o),
                discountPence: offerAppliedDiscountPence(o),
                meta: { applied: o, autoAdd: offerResult.autoAdd } as unknown as object
              }))
            : [
                {
                  orderId: created.id,
                  userId,
                  emailUsed: emailNorm || null,
                  offerId: offerResult.autoAdd[0]?.reasonOfferId ?? 'AUTO_ADD',
                  offerName: 'Auto-added free items',
                  offerKind: 'AUTO_ADD',
                  discountPence: Math.max(0, Math.trunc(offerItemDiscountPence)),
                  meta: { autoAdd: offerResult.autoAdd } as unknown as object
                }
              ];

          await prisma.orderOffer.createMany({ data: rows });

          // ✅ OfferAttempt: record what happened on place-order (order-linked) - BULK
          await logOfferAttemptsBulk(
            rows.map((r) => ({
              checkoutId,
              offerId: r.offerId,
              offerName: r.offerName,
              offerKind: r.offerKind ?? null,

              userId,
              email: emailNorm || null,
              orderId: created.id,

              outcome: 'ORDER_APPLIED' as const,
              errorCode: null,

              currency: created.currency ?? 'GBP',
              subtotalPence: created.subtotal ?? null,
              shippingPence: created.shippingTotal ?? null,
              discountPence: r.discountPence ?? 0,
              shippingDiscountPence: 0
            }))
          );
        }

        // ✅ Log promo attempt against the order (so usage table can join it)
        if (normalizedCode) {
          const applied = !!(created.promotionId && created.promotionCode);

          await logPromoOrderAttempt({
            checkoutId,
            code: normalizedCode,
            promotionId: created.promotionId ?? null,
            userId: created.userId ?? null,
            email: emailNorm,
            orderId: created.id,
            outcome: applied ? 'ORDER_APPLIED' : 'ORDER_REJECTED',
            errorCode: applied ? null : 'NOT_APPLIED_ON_ORDER',
            currency: created.currency ?? 'GBP',
            subtotalPence: created.subtotal ?? null,
            shippingPence: created.shippingTotal ?? null,
            discountPence: Math.max(0, Math.trunc(created.discountTotal ?? 0)),
            shippingDiscountPence: 0
          });
        }

        if (created.promotionId && created.promotionCode) {
          await logActivity(created.id, 'NOTE', `Promotion applied: ${created.promotionCode}`);
        }

        // ✅ Save to AddressBook (best-effort, never blocks placing)
        try {
          const save = body.saveAddress === true;
          const label =
            typeof body.saveAddressLabel === 'string' ? body.saveAddressLabel.trim() : '';

          if (save && label && created.userId) {
            await saveAddressBookBestEffort({
              userId: created.userId,
              label,
              kind: billingSameAsShipping ? 'BOTH' : 'SHIPPING',
              addr: s
            });

            if (!billingSameAsShipping && b) {
              await saveAddressBookBestEffort({
                userId: created.userId,
                label: `${label} (Billing)`,
                kind: 'BILLING',
                addr: b
              });
            }
          }
        } catch (e) {
          console.warn('[place-order] addressBook save failed (ignored):', e);
        }

        return NextResponse.json({ ok: true, orderId: created.id, displayId: created.displayId });
      } catch (e) {
        if (isUniqueViolation(e)) continue;
        console.error('[place-order] create failed:', e);
        throw e;
      }
    }

    return NextResponse.json(
      { ok: false, error: 'Failed to place order (displayId collisions).' },
      { status: 500 }
    );
  } catch (e) {
    const msg =
      process.env.NODE_ENV !== 'production' && e instanceof Error
        ? e.message
        : 'Failed to place order.';
    console.error('[POST /api/checkout/place-order]', e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
