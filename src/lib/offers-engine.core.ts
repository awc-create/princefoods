// src/lib/offers-engine.core.ts
import type { OfferAdminForm, OfferTargetRule } from '@/types/offers';

/**
 * Offers Engine (server-safe, deterministic)
 * - Supports: BOGOF (Buy X Get Y), X_FOR_Y, X_FOR_FIXED_PRICE, PERCENT_OFF, AMOUNT_OFF
 * - Emits:
 *   - discountTotalPence (order-level total)
 *   - applied[] with meta.lineDiscounts + meta.lineParticipants (for UI per-line display)
 *   - autoAdd[] for BxGy auto-add behaviour (free units added as extra units)
 *
 * IMPORTANT QUANTITY MODEL:
 * ✅ CartLine.qty is ALWAYS the PAID quantity (user-controlled).
 * ✅ Engine computes groups/free/total from paidQty.
 */

/* -------------------------------------------
   Types
------------------------------------------- */

export type Money = number; // pence

export interface CartLine {
  productId?: string | null;
  sku?: string | null;
  name: string;

  unitPricePence: Money;

  /**
   * ✅ PAID quantity (user-controlled)
   * Free units are NOT included here.
   */
  qty: number;

  categoryId?: string | null;
  tags?: string[] | null;
  collection?: string | null;
}

export interface OfferEvalInput {
  now?: Date;
  lines: CartLine[];
  code?: string | null;
}

// ✅ Engine only “applies” these kinds. Others are ignored safely.
type EngineOfferKind = 'BOGOF' | 'X_FOR_Y' | 'X_FOR_FIXED_PRICE' | 'PERCENT_OFF' | 'AMOUNT_OFF';

export interface LineDiscount {
  productId?: string | null;
  sku?: string | null;
  name: string;

  /**
   * For BxGy: qty is the FREE quantity that is discounted.
   * For other offers: qty is the affected (eligible) quantity.
   */
  qty: number;

  amountPence: number;
  reason?: 'FREE' | 'DISCOUNT';
}

export interface LineParticipant {
  productId?: string | null;
  sku?: string | null;
  name: string;

  /**
   * BUY => PAID units (CartLine.qty)
   * FREE => computed free units
   * ELIGIBLE => just informational (paid units)
   * GET => legacy / informational
   */
  qty: number;

  role?: 'BUY' | 'GET' | 'ELIGIBLE' | 'FREE';
}

export interface BxGyLineMath {
  productId?: string | null;
  sku?: string | null;
  name: string;
  paidQty: number;
  groups: number;
  freeQty: number;
  totalQty: number;
  unitPricePence: number;
  discountPence: number;
}

export interface OfferAppliedMeta {
  lineDiscounts?: LineDiscount[];
  lineParticipants?: LineParticipant[];

  groups?: number;
  freeCount?: number;
  samePool?: boolean;

  bxgyLines?: BxGyLineMath[];
}

export interface OfferApplied {
  offerId: string;
  name: string;
  kind: EngineOfferKind;
  discountPence: number;
  meta?: OfferAppliedMeta | null;
}

export interface AutoAddLine {
  reasonOfferId: string;
  productId?: string | null;
  sku?: string | null;
  name: string;

  /**
   * ✅ ALWAYS the FREE quantity computed from paidQty.
   */
  qty: number;
}

export interface OffersEvalResult {
  discountTotalPence: number;
  discountPence: number; // alias
  applied: OfferApplied[];
  eligible: OfferApplied[];
  autoAdd: AutoAddLine[];
}

/* -------------------------------------------
   Helpers
------------------------------------------- */

function normCode(v: string) {
  return v.trim().toUpperCase().replace(/\s+/g, '');
}

function clampInt(raw: unknown, min: number, max: number) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}

function safePence(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function safeQty(n: unknown): number {
  const q = typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : 0;
  return Math.max(0, q);
}

function parseIsoMaybe(s: string | null | undefined): Date | null {
  const t = (s ?? '').trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : null;
}

function isOfferActive(offer: OfferAdminForm, now: Date): boolean {
  const status = (offer.status ?? 'ACTIVE') as string;
  if (status !== 'ACTIVE') return false;

  const starts = parseIsoMaybe((offer.startsAt ?? null) as string | null);
  const ends = parseIsoMaybe((offer.endsAt ?? null) as string | null);

  if (starts && now < starts) return false;
  if (ends && now > ends) return false;
  return true;
}

function offerKey(o: OfferAdminForm): string {
  const id = String((o.id ?? '') as string).trim();
  if (id) return id;

  const priRaw = (o.priority ?? 0) as unknown;
  const pri = Number.isFinite(priRaw as number) ? Math.trunc(priRaw as number) : 0;

  const kind = String((o.payload?.kind ?? 'UNKNOWN') as string);
  const name = String((o.name ?? '') as string);

  return `${kind}:${name}:${pri}`.slice(0, 120);
}

/* -------------------------------------------
   Pool defaults + matching
------------------------------------------- */

// ✅ Typed default rule so TS knows it's a valid OfferTargetRule union member
const ALL_PRODUCTS_RULE = { type: 'ALL_PRODUCTS' } as const satisfies OfferTargetRule;

// ✅ Always return a valid OfferTargetRule[]
function poolOrAll(pool: unknown): OfferTargetRule[] {
  return Array.isArray(pool) && pool.length ? (pool as OfferTargetRule[]) : [ALL_PRODUCTS_RULE];
}

function ruleType(r: unknown): string {
  if (!r || typeof r !== 'object') return '';
  const t = (r as { type?: unknown }).type;
  return typeof t === 'string' ? t : '';
}

function ruleIds(r: unknown, key: 'ids' | 'productIds' | 'categoryIds'): string[] {
  if (!r || typeof r !== 'object') return [];
  const v = (r as Record<string, unknown>)[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim());
}

function ruleSlugs(r: unknown): string[] {
  if (!r || typeof r !== 'object') return [];
  const v = (r as Record<string, unknown>).slugs;
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim());
}

function ruleNames(r: unknown): string[] {
  if (!r || typeof r !== 'object') return [];
  const v = (r as Record<string, unknown>).names;
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim());
}

function rulePrefix(r: unknown): string {
  if (!r || typeof r !== 'object') return '';
  const v = (r as Record<string, unknown>).prefix;
  return typeof v === 'string' ? v.trim() : '';
}

function isLineInPool(line: CartLine, pool: OfferTargetRule[] | null | undefined): boolean {
  const rules: OfferTargetRule[] = poolOrAll(pool);

  for (const r of rules) {
    const t = ruleType(r);

    if (t === 'ALL_PRODUCTS') return true;

    // ✅ Product match
    if (t === 'PRODUCT_IDS') {
      const ids = ruleIds(r, 'ids');
      if (!ids.length) continue;

      if (line.productId && ids.includes(line.productId)) return true;
      if (line.sku && ids.includes(line.sku)) return true;
      continue;
    }

    // ✅ Category match
    if (t === 'CATEGORY_IDS') {
      const cids = ruleIds(r, 'ids');
      if (!cids.length) continue;

      if (line.categoryId && cids.includes(line.categoryId)) return true;
      continue;
    }

    // ✅ Tags match
    if (t === 'TAG_SLUGS') {
      const slugs = ruleSlugs(r);
      if (!slugs.length) continue;

      const tags = Array.isArray(line.tags) ? line.tags : [];
      if (tags.some((x) => slugs.includes(String(x)))) return true;
      continue;
    }

    // ✅ Collections match
    if (t === 'COLLECTIONS') {
      const names = ruleNames(r);
      if (!names.length) continue;

      if (line.collection && names.includes(line.collection)) return true;
      continue;
    }

    // ✅ Name prefix match (case-insensitive)
    if (t === 'NAME_PREFIX') {
      const prefix = rulePrefix(r).toLowerCase();
      if (!prefix) continue;

      if ((line.name ?? '').toLowerCase().startsWith(prefix)) return true;
      continue;
    }

    // ✅ SKU prefix match (case-insensitive)
    if (t === 'SKU_PREFIX') {
      const prefix = rulePrefix(r).toLowerCase();
      if (!prefix) continue;

      if ((line.sku ?? '').toLowerCase().startsWith(prefix)) return true;
      continue;
    }
  }

  return false;
}

function _sumLineSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, ln) => s + safePence(ln.unitPricePence) * safeQty(ln.qty), 0);
}

/**
 * % off allocation with largest-remainder so pennies don't vanish.
 */
function percentOffLineDiscounts(lines: CartLine[], pct: number): LineDiscount[] {
  const p = clampInt(pct, 0, 100);
  if (p <= 0) return [];

  const rows = lines.map((ln) => {
    const unit = safePence(ln.unitPricePence);
    const qty = safeQty(ln.qty);
    const sub = unit * qty;

    const exact = (sub * p) / 100;
    const floor = Math.floor(exact);
    const frac = exact - floor;

    return { ln, subtotal: sub, base: floor, frac };
  });

  const targetTotal = Math.round((rows.reduce((s, r) => s + r.subtotal, 0) * p) / 100);
  let baseTotal = rows.reduce((s, r) => s + r.base, 0);
  let remainder = Math.max(0, targetTotal - baseTotal);

  rows
    .slice()
    .sort((a, b) => b.frac - a.frac)
    .forEach((r) => {
      if (remainder <= 0) return;
      if (r.subtotal <= 0) return;
      r.base += 1;
      remainder -= 1;
      baseTotal += 1;
    });

  return rows
    .map((r) => {
      const amount = Math.max(0, Math.min(r.base, r.subtotal));
      return {
        productId: r.ln.productId ?? null,
        sku: r.ln.sku ?? null,
        name: r.ln.name,
        qty: safeQty(r.ln.qty),
        amountPence: amount,
        reason: 'DISCOUNT' as const
      };
    })
    .filter((d) => d.amountPence > 0);
}

/**
 * ✅ £ off PER UNIT (NOT once for the whole cart)
 */
function amountOffPerUnitLineDiscounts(lines: CartLine[], amountPence: number): LineDiscount[] {
  const perUnit = safePence(amountPence);
  if (perUnit <= 0) return [];

  const out: LineDiscount[] = [];

  for (const ln of lines) {
    const unit = safePence(ln.unitPricePence);
    const qty = safeQty(ln.qty);
    if (unit <= 0 || qty <= 0) continue;

    const unitDiscount = Math.min(perUnit, unit);
    const amount = unitDiscount * qty;
    if (amount <= 0) continue;

    out.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      qty,
      amountPence: amount,
      reason: 'DISCOUNT'
    });
  }

  return out;
}

/* -------------------------------------------
   Offer evaluators
------------------------------------------- */

function evalBOGOF(
  offer: OfferAdminForm,
  allLines: CartLine[]
): { applied: OfferApplied | null; autoAdd: AutoAddLine[] } {
  const data = offer.payload.data as Partial<{
    buyQty: number;
    getQty: number;
    buyPool: OfferTargetRule[];
    getPool: OfferTargetRule[];
    warnIfGetMoreExpensive: boolean;
    autoAddGetItem: boolean;
  }>;

  const buyQty = clampInt(data.buyQty, 1, 999);
  const getQty = clampInt(data.getQty, 1, 999);

  const buyPool = poolOrAll(data.buyPool);
  const getPool = poolOrAll(data.getPool);

  const eligible = allLines.filter(
    (ln) => isLineInPool(ln, buyPool) && isLineInPool(ln, getPool) && safeQty(ln.qty) > 0
  );

  if (!eligible.length) return { applied: null, autoAdd: [] };

  const lineDiscounts: LineDiscount[] = [];
  const participants: LineParticipant[] = [];
  const bxgyLines: BxGyLineMath[] = [];
  const autoAdd: AutoAddLine[] = [];

  let groupsTotal = 0;
  let freeTotal = 0;
  let discountTotal = 0;

  for (const ln of eligible) {
    const unit = safePence(ln.unitPricePence);
    const paidQty = safeQty(ln.qty);

    const groups = Math.floor(paidQty / buyQty);
    const freeQty = groups * getQty;
    const totalQty = paidQty + freeQty;

    participants.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      qty: paidQty,
      role: 'BUY'
    });

    if (groups <= 0 || freeQty <= 0) {
      participants.push({
        productId: ln.productId ?? null,
        sku: ln.sku ?? null,
        name: ln.name,
        qty: paidQty,
        role: 'ELIGIBLE'
      });

      bxgyLines.push({
        productId: ln.productId ?? null,
        sku: ln.sku ?? null,
        name: ln.name,
        paidQty,
        groups: 0,
        freeQty: 0,
        totalQty: paidQty,
        unitPricePence: unit,
        discountPence: 0
      });

      continue;
    }

    const discountPence = unit * freeQty;

    groupsTotal += groups;
    freeTotal += freeQty;
    discountTotal += discountPence;

    participants.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      qty: freeQty,
      role: 'FREE'
    });

    bxgyLines.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      paidQty,
      groups,
      freeQty,
      totalQty,
      unitPricePence: unit,
      discountPence
    });

    lineDiscounts.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      qty: freeQty,
      amountPence: discountPence,
      reason: 'FREE'
    });

    if (data.autoAddGetItem !== false) {
      autoAdd.push({
        reasonOfferId: offerKey(offer),
        productId: ln.productId ?? null,
        sku: ln.sku ?? null,
        name: ln.name,
        qty: freeQty
      });
    }
  }

  if (discountTotal <= 0 && autoAdd.length === 0) return { applied: null, autoAdd: [] };

  return {
    applied: {
      offerId: offerKey(offer),
      name: offer.name,
      kind: 'BOGOF',
      discountPence: discountTotal,
      meta: {
        lineDiscounts,
        lineParticipants: participants,
        groups: groupsTotal,
        freeCount: freeTotal,
        samePool: true,
        bxgyLines
      }
    },
    autoAdd
  };
}

function evalXForY(offer: OfferAdminForm, allLines: CartLine[]): OfferApplied | null {
  const data = offer.payload.data as Partial<{
    buyQty: number;
    payQty: number;
    pool: OfferTargetRule[];
  }>;

  const buyQty = clampInt(data.buyQty, 1, 999);
  const payQty = clampInt(data.payQty, 1, 999);
  if (payQty >= buyQty) return null;

  const pool = poolOrAll(data.pool);
  const eligible = allLines.filter((ln) => isLineInPool(ln, pool) && safeQty(ln.qty) > 0);
  if (!eligible.length) return null;

  const freePerGroup = buyQty - payQty;

  const lineDiscounts: LineDiscount[] = [];
  const participants: LineParticipant[] = [];

  let groupsTotal = 0;
  let freeTotal = 0;
  let discountTotal = 0;

  for (const ln of eligible) {
    const unit = safePence(ln.unitPricePence);
    const paidQty = safeQty(ln.qty);

    participants.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      qty: paidQty,
      role: 'ELIGIBLE'
    });

    const groups = Math.floor(paidQty / buyQty);
    const freeQty = groups * freePerGroup;
    if (groups <= 0 || freeQty <= 0) continue;

    groupsTotal += groups;
    freeTotal += freeQty;

    const amount = unit * freeQty;
    discountTotal += amount;

    lineDiscounts.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      qty: freeQty,
      amountPence: amount,
      reason: 'DISCOUNT'
    });
  }

  if (discountTotal <= 0) return null;

  return {
    offerId: offerKey(offer),
    name: offer.name,
    kind: 'X_FOR_Y',
    discountPence: discountTotal,
    meta: {
      lineDiscounts,
      lineParticipants: participants,
      groups: groupsTotal,
      freeCount: freeTotal
    }
  };
}

function evalXForFixedPrice(offer: OfferAdminForm, allLines: CartLine[]): OfferApplied | null {
  const data = offer.payload.data as Partial<{
    qty: number;
    pricePence: number;
    pool: OfferTargetRule[];
  }>;

  const qtyDeal = clampInt(data.qty, 1, 999);
  const fixed = safePence(data.pricePence);
  if (qtyDeal <= 0) return null;

  const pool = poolOrAll(data.pool);
  const eligible = allLines.filter((ln) => isLineInPool(ln, pool) && safeQty(ln.qty) > 0);
  if (!eligible.length) return null;

  const lineDiscounts: LineDiscount[] = [];
  const participants: LineParticipant[] = [];

  let groupsTotal = 0;
  let discountTotal = 0;

  for (const ln of eligible) {
    const unit = safePence(ln.unitPricePence);
    const paidQty = safeQty(ln.qty);

    participants.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      qty: paidQty,
      role: 'ELIGIBLE'
    });

    const groups = Math.floor(paidQty / qtyDeal);
    if (groups <= 0) continue;

    const normalPerGroup = unit * qtyDeal;
    const perGroupDiscount = Math.max(0, normalPerGroup - fixed);
    if (perGroupDiscount <= 0) continue;

    groupsTotal += groups;

    const amount = perGroupDiscount * groups;
    discountTotal += amount;

    lineDiscounts.push({
      productId: ln.productId ?? null,
      sku: ln.sku ?? null,
      name: ln.name,
      qty: groups * qtyDeal,
      amountPence: amount,
      reason: 'DISCOUNT'
    });
  }

  if (discountTotal <= 0) return null;

  return {
    offerId: offerKey(offer),
    name: offer.name,
    kind: 'X_FOR_FIXED_PRICE',
    discountPence: discountTotal,
    meta: { lineDiscounts, lineParticipants: participants, groups: groupsTotal }
  };
}

function evalPercentOff(offer: OfferAdminForm, allLines: CartLine[]): OfferApplied | null {
  const data = offer.payload.data as Partial<{ percent: number; pool: OfferTargetRule[] }>;
  const pct = clampInt(data.percent, 0, 100);
  if (pct <= 0) return null;

  const pool = poolOrAll(data.pool);
  const eligible = allLines.filter((ln) => isLineInPool(ln, pool) && safeQty(ln.qty) > 0);
  if (!eligible.length) return null;

  const lineDiscounts = percentOffLineDiscounts(eligible, pct);
  const discountTotal = lineDiscounts.reduce((s, d) => s + safePence(d.amountPence), 0);
  if (discountTotal <= 0) return null;

  const participants: LineParticipant[] = eligible.map((ln) => ({
    productId: ln.productId ?? null,
    sku: ln.sku ?? null,
    name: ln.name,
    qty: safeQty(ln.qty),
    role: 'ELIGIBLE'
  }));

  return {
    offerId: offerKey(offer),
    name: offer.name,
    kind: 'PERCENT_OFF',
    discountPence: discountTotal,
    meta: { lineDiscounts, lineParticipants: participants }
  };
}

/**
 * ✅ AMOUNT_OFF is now "£X OFF PER ITEM" (per unit).
 */
function evalAmountOff(offer: OfferAdminForm, allLines: CartLine[]): OfferApplied | null {
  const data = offer.payload.data as Partial<{ amountPence: number; pool: OfferTargetRule[] }>;
  const perUnitOff = safePence(data.amountPence);
  if (perUnitOff <= 0) return null;

  const pool = poolOrAll(data.pool);
  const eligible = allLines.filter((ln) => isLineInPool(ln, pool) && safeQty(ln.qty) > 0);
  if (!eligible.length) return null;

  const lineDiscounts = amountOffPerUnitLineDiscounts(eligible, perUnitOff);
  const discountTotal = lineDiscounts.reduce((s, d) => s + safePence(d.amountPence), 0);
  if (discountTotal <= 0) return null;

  const participants: LineParticipant[] = eligible.map((ln) => ({
    productId: ln.productId ?? null,
    sku: ln.sku ?? null,
    name: ln.name,
    qty: safeQty(ln.qty),
    role: 'ELIGIBLE'
  }));

  return {
    offerId: offerKey(offer),
    name: offer.name,
    kind: 'AMOUNT_OFF',
    discountPence: discountTotal,
    meta: { lineDiscounts, lineParticipants: participants }
  };
}

/* -------------------------------------------
   Public API
------------------------------------------- */

export function evaluateOffers(offers: OfferAdminForm[], input: OfferEvalInput): OffersEvalResult {
  const now = input.now ?? new Date();
  const code = input.code ? normCode(input.code) : null;

  const lines: CartLine[] = Array.isArray(input.lines) ? input.lines : [];
  const safeLines = lines
    .map((ln) => ({
      ...ln,
      unitPricePence: safePence(ln.unitPricePence),
      qty: Math.max(0, Math.trunc(ln.qty))
    }))
    .filter((ln) => ln.qty > 0);

  const active = (Array.isArray(offers) ? offers : [])
    .filter(
      (o) =>
        o &&
        typeof o === 'object' &&
        (o as OfferAdminForm).payload &&
        typeof (o as OfferAdminForm).payload === 'object'
    )
    .filter((o) => isOfferActive(o, now))
    .filter((o) => {
      const mode = String((o.mode ?? 'AUTO') as string).toUpperCase();
      const offerCode = String((o.code ?? '') as string).trim();

      if (!offerCode) return mode === 'AUTO' || mode === 'BOTH';

      if (mode === 'BOTH') {
        if (!code) return true;
        return normCode(offerCode) === code;
      }

      if (mode === 'CODE') {
        if (!code) return false;
        return normCode(offerCode) === code;
      }

      return false;
    })
    .sort(
      (a, b) => Math.trunc((b.priority ?? 0) as number) - Math.trunc((a.priority ?? 0) as number)
    );

  const applied: OfferApplied[] = [];
  const eligible: OfferApplied[] = [];
  const autoAdd: AutoAddLine[] = [];

  for (const offer of active) {
    const kind = String((offer.payload?.kind ?? '') as string);

    if (kind === 'BOGOF') {
      const r = evalBOGOF(offer, safeLines);
      if (r.applied) {
        eligible.push(r.applied);

        const hasDiscount = safePence(r.applied.discountPence) > 0;
        const hasAutoAdd = Array.isArray(r.autoAdd) && r.autoAdd.length > 0;

        if (hasDiscount || hasAutoAdd) {
          applied.push(r.applied);
          if (hasAutoAdd) autoAdd.push(...r.autoAdd);
        }
      }
      continue;
    }

    if (kind === 'X_FOR_Y') {
      const a = evalXForY(offer, safeLines);
      if (a) {
        eligible.push(a);
        if (safePence(a.discountPence) > 0) applied.push(a);
      }
      continue;
    }

    if (kind === 'X_FOR_FIXED_PRICE') {
      const a = evalXForFixedPrice(offer, safeLines);
      if (a) {
        eligible.push(a);
        if (safePence(a.discountPence) > 0) applied.push(a);
      }
      continue;
    }

    if (kind === 'PERCENT_OFF') {
      const a = evalPercentOff(offer, safeLines);
      if (a) {
        eligible.push(a);
        if (safePence(a.discountPence) > 0) applied.push(a);
      }
      continue;
    }

    if (kind === 'AMOUNT_OFF') {
      const a = evalAmountOff(offer, safeLines);
      if (a) {
        eligible.push(a);
        if (safePence(a.discountPence) > 0) applied.push(a);
      }
      continue;
    }
  }

  const discountTotalPence = applied.reduce((s, a) => s + safePence(a.discountPence), 0);

  return {
    discountTotalPence,
    discountPence: discountTotalPence,
    applied,
    eligible,
    autoAdd
  };
}
