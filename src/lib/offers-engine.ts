// src/lib/offers-engine.ts
import type {
  OfferAdminForm,
  OfferAppliedMeta,
  OfferBOGOF,
  OfferLineDiscount,
  OfferLineParticipant,
  OfferPayload,
  OfferSpendXGetY,
  OfferTargetRule,
  OfferXForFixedPrice,
  OfferXForY
} from '@/types/offers';

export type Money = number; // pence

export interface CartLine {
  productId?: string | null;
  sku?: string | null;
  name: string;
  unitPricePence: Money;
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

export interface OfferApplied {
  offerId: string;
  name: string;
  kind: OfferPayload['kind'];

  mode: OfferAdminForm['mode'];
  codeUsed: string | null;

  discountPence: Money;

  meta?: OfferAppliedMeta;
}

export interface OfferEngineResult {
  subtotalPence: Money;

  // ✅ offers actually used (affects totals)
  applied: OfferApplied[];
  discountTotalPence: Money;

  // ✅ offers that WOULD apply (for preview UI)
  eligible: OfferApplied[];

  // ✅ auto-add free units (server will add as £0 lines)
  autoAdd: Array<{
    reasonOfferId: string;
    productId?: string | null;
    sku?: string | null;
    name: string;
    qty: number;
  }>;
}

/* ------------------------------------------------------------
  IMPORTANT BUSINESS RULES (customer-approved)
  - Percent / Amount: apply to entire basket (or configured pool)
  - X for Y: can mix products in pool, cheapest units become free
  - X for Fixed Price: can mix products in pool, highest priced grouped first
  - BOGOF-type: SAME PRODUCT ONLY, free items are EXTRA units auto-added
      Example "Buy 3 get 1 free": customer buys 3, system adds 1 more free
  - Spend X Get Y: applies once only
  - Offer stacking: ONLY BEST SINGLE OFFER APPLIES (no stacking)
------------------------------------------------------------ */

const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normCode = (s: string) => s.trim().toUpperCase().replace(/\s+/g, '');

function lineKey(x: { productId?: string | null; sku?: string | null; name: string }) {
  if (x.productId) return `pid:${x.productId}`;
  if (x.sku) return `sku:${x.sku}`;
  return `name:${normName(x.name)}`;
}

export function evaluateOffers(
  allOffers: OfferAdminForm[],
  input: OfferEvalInput
): OfferEngineResult {
  const now = input.now ?? new Date();
  const subtotal = sumSubtotal(input.lines);

  // 1) Evaluate every eligible offer (for preview + to pick the best one)
  const evaluated = allOffers
    .filter((o) => isOfferActive(o, now))
    .filter((o) => isModeEligible(o, input.code))
    .map((o) => ({ offer: o, eval: evalOffer(o, input.lines, subtotal) }))
    .filter((x) => x.eval.discountPence > 0 || x.eval.autoAdd.length > 0);

  // 2) Build "eligible" preview list (what would apply if chosen)
  const eligible: OfferApplied[] = evaluated.map((x) => {
    const o = x.offer;
    const codeUsed = resolveCodeUsed(o, input.code);

    const effective = applyOrderCaps({
      offer: o,
      subtotalPence: subtotal,
      alreadyDiscountedPence: 0,
      discountPence: x.eval.discountPence
    });

    return {
      offerId: o.id!,
      name: o.name,
      kind: o.payload.kind,
      mode: o.mode,
      codeUsed,
      discountPence: effective,
      meta: x.eval.meta
    };
  });

  // 3) Stacking rule: choose ONE winner only (best savings)
  const winner = pickBestSingleOffer(evaluated, subtotal);

  if (!winner) {
    return {
      subtotalPence: subtotal,
      applied: [],
      discountTotalPence: 0,
      eligible,
      autoAdd: []
    };
  }

  const o = winner.offer;
  const codeUsed = resolveCodeUsed(o, input.code);

  const disc = applyOrderCaps({
    offer: o,
    subtotalPence: subtotal,
    alreadyDiscountedPence: 0,
    discountPence: winner.eval.discountPence
  });

  const applied: OfferApplied[] =
    disc > 0
      ? [
          {
            offerId: o.id!,
            name: o.name,
            kind: o.payload.kind,
            mode: o.mode,
            codeUsed,
            discountPence: disc,
            meta: winner.eval.meta
          }
        ]
      : [];

  return {
    subtotalPence: subtotal,
    applied,
    discountTotalPence: disc,
    eligible,
    autoAdd: winner.eval.autoAdd
  };
}

/* ---------------- core helpers ---------------- */

function sumSubtotal(lines: CartLine[]): Money {
  return lines.reduce((sum, l) => sum + Math.max(0, l.unitPricePence) * Math.max(0, l.qty), 0);
}

function isOfferActive(o: OfferAdminForm, now: Date) {
  if (o.status !== 'ACTIVE') return false;

  if (o.startsAt) {
    const d = new Date(o.startsAt);
    if (!Number.isNaN(d.getTime()) && now < d) return false;
  }

  if (o.endsAt) {
    const d = new Date(o.endsAt);
    if (!Number.isNaN(d.getTime()) && now > d) return false;
  }

  return true;
}

function isModeEligible(o: OfferAdminForm, typedCode?: string | null) {
  if (o.mode === 'AUTO') return true;

  const typed = typedCode ? normCode(typedCode) : '';
  const offerCode = o.code ? normCode(o.code) : '';

  if (o.mode === 'CODE') return Boolean(typed && offerCode && typed === offerCode);

  // HYBRID: auto unless a code is present; if typed matches, allow
  if (!typed) return true;
  if (!offerCode) return true;
  return typed === offerCode;
}

function resolveCodeUsed(o: OfferAdminForm, typedCode?: string | null) {
  if (!typedCode || !o.code) return null;
  const t = normCode(typedCode);
  const c = normCode(o.code);
  return t && c && t === c ? t : null;
}

/** Apply maxDiscountPerOrder + preventFreeOrder (leave 1p) */
function applyOrderCaps(args: {
  offer: OfferAdminForm;
  subtotalPence: Money;
  alreadyDiscountedPence: Money;
  discountPence: Money;
}): Money {
  const { offer: o, subtotalPence, alreadyDiscountedPence } = args;
  let disc = Math.max(0, Math.trunc(args.discountPence));

  if (typeof o.maxDiscountPerOrderPence === 'number') {
    disc = Math.min(disc, Math.max(0, Math.trunc(o.maxDiscountPerOrderPence)));
  }

  if (o.preventFreeOrder) {
    const maxAllowedTotal = Math.max(0, subtotalPence - 1); // leave 1p
    disc = Math.min(disc, Math.max(0, maxAllowedTotal - alreadyDiscountedPence));
    disc = Math.max(0, disc);
  }

  return Math.max(0, Math.trunc(disc));
}

function pickBestSingleOffer(
  evaluated: Array<{ offer: OfferAdminForm; eval: Eval }>,
  subtotal: Money
) {
  if (!evaluated.length) return null;

  // compare by effective discount after caps; tiebreaker: priority
  let best = evaluated[0];
  let bestDisc = applyOrderCaps({
    offer: best.offer,
    subtotalPence: subtotal,
    alreadyDiscountedPence: 0,
    discountPence: best.eval.discountPence
  });

  for (let i = 1; i < evaluated.length; i++) {
    const cur = evaluated[i];
    const curDisc = applyOrderCaps({
      offer: cur.offer,
      subtotalPence: subtotal,
      alreadyDiscountedPence: 0,
      discountPence: cur.eval.discountPence
    });

    if (curDisc > bestDisc) {
      best = cur;
      bestDisc = curDisc;
      continue;
    }

    if (curDisc === bestDisc) {
      const bp = Number.isFinite(best.offer.priority) ? best.offer.priority : 0;
      const cp = Number.isFinite(cur.offer.priority) ? cur.offer.priority : 0;
      if (cp > bp) {
        best = cur;
        bestDisc = curDisc;
      }
    }
  }

  return best;
}

/* ---------------- evaluation ---------------- */

interface Eval {
  discountPence: Money;
  autoAdd: OfferEngineResult['autoAdd'];
  meta?: OfferAppliedMeta;
}

function evalOffer(o: OfferAdminForm, lines: CartLine[], subtotal: Money): Eval {
  const p = o.payload;

  switch (p.kind) {
    // 1) % off entire basket (or pool)
    case 'PERCENT_OFF': {
      const pool = p.data.pool ?? ([{ type: 'ALL_PRODUCTS' }] as OfferTargetRule[]);
      const matched = matchLines(lines, pool);
      const base = matched.reduce((sum, l) => sum + l.unitPricePence * l.qty, 0);

      const pct = clampInt((p.data as { percent: number }).percent, 0, 100);
      const discount = Math.floor((base * pct) / 100);

      const participants = toLineParticipants(explodeUnits(matched), 'ELIGIBLE');

      return {
        discountPence: Math.max(0, discount),
        autoAdd: [],
        meta: {
          basePence: base,
          pct,
          lineParticipants: participants,
          lineDiscounts: []
        }
      };
    }

    // 2) fixed amount off entire basket (or pool)
    case 'AMOUNT_OFF': {
      const pool = p.data.pool ?? ([{ type: 'ALL_PRODUCTS' }] as OfferTargetRule[]);
      const matched = matchLines(lines, pool);
      const base = matched.reduce((sum, l) => sum + l.unitPricePence * l.qty, 0);

      const amt = Math.max(0, (p.data as { amountPence: number }).amountPence);
      const discount = Math.min(amt, base);

      const participants = toLineParticipants(explodeUnits(matched), 'ELIGIBLE');

      return {
        discountPence: Math.max(0, discount),
        autoAdd: [],
        meta: {
          basePence: base,
          lineParticipants: participants,
          lineDiscounts: []
        }
      };
    }

    // 3) X for Y (mixed pool, cheapest units free)
    case 'X_FOR_Y': {
      const data = p.data as OfferXForY;
      const matched = matchLines(lines, data.pool);
      const units = explodeUnits(matched);

      const buyQty = Math.max(1, clampInt(data.buyQty, 1, 999));
      const payQty = Math.max(0, clampInt(data.payQty, 0, buyQty));

      if (units.length < buyQty) return { discountPence: 0, autoAdd: [] };

      const groups = Math.floor(units.length / buyQty);
      const freePerGroup = Math.max(0, buyQty - payQty);
      const freeCount = groups * freePerGroup;

      if (groups <= 0 || freeCount <= 0) return { discountPence: 0, autoAdd: [] };

      const usedCount = groups * buyQty;
      const participantsUnits = units.slice(0, usedCount);

      const cheapestFirst = [...units].sort((a, b) => a.unitPricePence - b.unitPricePence);
      const freeUnits = cheapestFirst.slice(0, freeCount);

      const discount = freeUnits.reduce((sum, u) => sum + u.unitPricePence, 0);
      const lineDiscounts = toLineDiscounts(freeUnits, 'FREE');
      const lineParticipants = toLineParticipants(participantsUnits, 'ELIGIBLE');

      return {
        discountPence: Math.max(0, discount),
        autoAdd: [],
        meta: { groups, freeCount, lineDiscounts, lineParticipants }
      };
    }

    // 4) X for fixed price (mixed pool; highest priced grouped first)
    case 'X_FOR_FIXED_PRICE': {
      const data = p.data as OfferXForFixedPrice;
      const matched = matchLines(lines, data.pool);
      const units = explodeUnits(matched);

      const qty = Math.max(1, clampInt(data.qty, 1, 999));
      const fixed = Math.max(0, Math.trunc(data.pricePence ?? 0));

      if (units.length < qty) return { discountPence: 0, autoAdd: [] };

      const groups = Math.floor(units.length / qty);
      if (groups <= 0) return { discountPence: 0, autoAdd: [] };

      // Highest priced grouped first
      const sortedDesc = [...units].sort((a, b) => b.unitPricePence - a.unitPricePence);

      let discount = 0;
      let idx = 0;

      const discountedUnits: Array<CartLine & { _unit?: true }> = [];
      const participantUnits: Array<CartLine & { _unit?: true }> = [];

      for (let g = 0; g < groups; g++) {
        const groupUnits = sortedDesc.slice(idx, idx + qty);
        idx += qty;

        participantUnits.push(...groupUnits);

        const groupSum = groupUnits.reduce((sum, u) => sum + u.unitPricePence, 0);

        if (groupSum > fixed) {
          discount += groupSum - fixed;
          discountedUnits.push(...groupUnits);
        }
      }

      const lineDiscounts = toLineDiscounts(discountedUnits, 'DISCOUNT');
      const lineParticipants = toLineParticipants(participantUnits, 'ELIGIBLE');

      return {
        discountPence: Math.max(0, discount),
        autoAdd: [],
        meta: { groups, lineDiscounts, lineParticipants }
      };
    }

    // 5) BOGOF-type: SAME PRODUCT ONLY + AUTO-ADD free units
    case 'BOGOF': {
      const data = p.data as OfferBOGOF;

      const buyQty = Math.max(1, clampInt(data.buyQty, 1, 999));
      const getQty = Math.max(1, clampInt(data.getQty, 1, 999));

      // We treat BOGOF as per-product only.
      // We respect buyPool as the product selection. (getPool is ignored for SAME PRODUCT rule)
      const matched = matchLines(lines, data.buyPool ?? []);
      if (!matched.length) return { discountPence: 0, autoAdd: [] };

      // group by product key
      const byKey = new Map<string, { line: CartLine; qty: number }>();
      for (const l of matched) {
        const key = lineKey(l);
        const prev = byKey.get(key);
        if (!prev) byKey.set(key, { line: l, qty: Math.max(0, Math.floor(l.qty)) });
        else prev.qty += Math.max(0, Math.floor(l.qty));
      }

      let totalDiscount = 0;
      const autoAdd: OfferEngineResult['autoAdd'] = [];
      const allParticipantUnits: Array<CartLine & { _unit?: true }> = [];
      const allFreeUnits: Array<CartLine & { _unit?: true }> = [];

      let groupsTotal = 0;
      let freeCountTotal = 0;

      for (const { line, qty } of byKey.values()) {
        if (qty < buyQty) continue;

        const groups = Math.floor(qty / buyQty);
        const freeQty = groups * getQty;

        if (groups <= 0 || freeQty <= 0) continue;

        groupsTotal += groups;
        freeCountTotal += freeQty;

        // Discount = freeQty * same product unit price
        const unit = Math.max(0, Math.trunc(line.unitPricePence));
        totalDiscount += unit * freeQty;

        // Auto-add the free units
        autoAdd.push({
          reasonOfferId: o.id!,
          productId: line.productId ?? null,
          sku: line.sku ?? null,
          name: line.name,
          qty: freeQty
        });

        // Meta participants: only the BUY units that qualified
        const usedBuyCount = groups * buyQty;
        const buyUnits = explodeUnits([{ ...line, qty: usedBuyCount }]);
        allParticipantUnits.push(...buyUnits);

        // Meta free units
        const freeUnits = explodeUnits([{ ...line, qty: freeQty }]);
        allFreeUnits.push(...freeUnits);
      }

      if (totalDiscount <= 0 && autoAdd.length === 0) return { discountPence: 0, autoAdd: [] };

      const lineDiscounts = toLineDiscounts(allFreeUnits, 'FREE');

      // roles: BUY and GET so it’s explainable in the UI/audit
      const lineParticipants: OfferLineParticipant[] = [
        ...toLineParticipants(allParticipantUnits, 'BUY'),
        ...toLineParticipants(allFreeUnits, 'GET')
      ];

      return {
        discountPence: Math.max(0, totalDiscount),
        autoAdd,
        meta: {
          groups: groupsTotal,
          freeCount: freeCountTotal,
          samePool: true,
          lineDiscounts,
          lineParticipants
        }
      };
    }

    // 6) Spend X get Y: applies once only
    case 'SPEND_X_GET_Y': {
      const data = p.data as OfferSpendXGetY;
      const spend = Math.max(0, Math.trunc(data.spendPence ?? 0));
      if (spend <= 0) return { discountPence: 0, autoAdd: [] };
      if (subtotal < spend) return { discountPence: 0, autoAdd: [] };

      const reward = data.reward;

      if (reward.type === 'AMOUNT_OFF') {
        const amt = Math.max(0, Math.trunc(reward.amountPence ?? 0));
        const discount = Math.min(amt, subtotal);
        return {
          discountPence: Math.max(0, discount),
          autoAdd: [],
          meta: { spend, lineParticipants: [], lineDiscounts: [] }
        };
      }

      if (reward.type === 'PERCENT_OFF') {
        const pct = clampInt(reward.percent, 0, 100);
        const discount = Math.floor((subtotal * pct) / 100);
        return {
          discountPence: Math.max(0, discount),
          autoAdd: [],
          meta: { spend, pct, lineParticipants: [], lineDiscounts: [] }
        };
      }

      return { discountPence: 0, autoAdd: [] };
    }

    default:
      return { discountPence: 0, autoAdd: [] };
  }
}

/* ---------------- small utils ---------------- */

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function explodeUnits(lines: CartLine[]) {
  const units: Array<CartLine & { _unit: true }> = [];
  for (const l of lines) {
    const qty = Math.max(0, Math.floor(l.qty));
    for (let i = 0; i < qty; i++) units.push({ ...l, _unit: true });
  }
  return units;
}

function toLineDiscounts(
  discountedUnits: Array<CartLine & { _unit?: true }>,
  reason: 'FREE' | 'DISCOUNT'
): OfferLineDiscount[] {
  const map = new Map<
    string,
    {
      productId?: string | null;
      sku?: string | null;
      name: string;
      qty: number;
      amountPence: number;
    }
  >();

  for (const u of discountedUnits) {
    const key = lineKey(u);
    const prev = map.get(key);

    const unit = Math.max(0, Math.trunc(u.unitPricePence));

    if (!prev) {
      map.set(key, {
        productId: u.productId ?? null,
        sku: u.sku ?? null,
        name: u.name,
        qty: 1,
        amountPence: unit
      });
    } else {
      prev.qty += 1;
      prev.amountPence += unit;
    }
  }

  return Array.from(map.values()).map((x) => ({ ...x, reason }));
}

function toLineParticipants(
  units: Array<CartLine & { _unit?: true }>,
  role: OfferLineParticipant['role']
): OfferLineParticipant[] {
  const map = new Map<
    string,
    {
      productId?: string | null;
      sku?: string | null;
      name: string;
      qty: number;
      role: OfferLineParticipant['role'];
    }
  >();

  for (const u of units) {
    const key = lineKey(u);
    const prev = map.get(key);

    if (!prev) {
      map.set(key, {
        productId: u.productId ?? null,
        sku: u.sku ?? null,
        name: u.name,
        qty: 1,
        role
      });
    } else {
      prev.qty += 1;
    }
  }

  return Array.from(map.values());
}

function matchLines(lines: CartLine[], rules: OfferTargetRule[]) {
  if (!rules?.length) return lines;
  return lines.filter((l) => rules.some((r) => matchRule(l, r)));
}

function matchRule(line: CartLine, rule: OfferTargetRule) {
  switch (rule.type) {
    case 'ALL_PRODUCTS':
      return true;
    case 'CATEGORY_IDS':
      return Boolean(line.categoryId && rule.ids.includes(line.categoryId));
    case 'PRODUCT_IDS':
      return Boolean(line.productId && rule.ids.includes(line.productId));
    case 'TAG_SLUGS':
      return Boolean(line.tags?.some((t) => rule.slugs.includes(t)));
    case 'COLLECTIONS':
      return Boolean(line.collection && rule.names.includes(line.collection));
    case 'NAME_PREFIX':
      return line.name.toLowerCase().startsWith(rule.prefix.toLowerCase());
    case 'SKU_PREFIX':
      return Boolean(line.sku && line.sku.toUpperCase().startsWith(rule.prefix.toUpperCase()));
    default:
      return false;
  }
}
