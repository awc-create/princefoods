// src/types/offers.ts

export type OfferMode = 'AUTO' | 'CODE' | 'BOTH';

// UI status includes DRAFT for admin, but Prisma OfferStatus is ACTIVE/PAUSED/EXPIRED.
// We store DRAFT as PAUSED in DB.
export type OfferStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED';

export type OfferStackingMode = 'BEST_DISCOUNT_WINS' | 'HIGHEST_PRIORITY_WINS' | 'STACK_ALLOWED';

/**
 * IMPORTANT:
 * This is NOT eligibility.
 * This is placement / where it shows (badge/product/cart/all).
 * Prisma enum: ALL | BADGE_ONLY | PRODUCT_PAGE | CART_ONLY
 */
export type OfferVisibility = 'ALL' | 'BADGE_ONLY' | 'PRODUCT_PAGE' | 'CART_ONLY';

export type OfferEmailScope = 'ALL_CUSTOMERS' | 'SELECTED_USERS';

export type OfferTargetRule =
  | { type: 'ALL_PRODUCTS' }
  | { type: 'CATEGORY_IDS'; ids: string[] }
  | { type: 'PRODUCT_IDS'; ids: string[] }
  | { type: 'TAG_SLUGS'; slugs: string[] }
  | { type: 'COLLECTIONS'; names: string[] }
  | { type: 'NAME_PREFIX'; prefix: string }
  | { type: 'SKU_PREFIX'; prefix: string };

export const ruleAllProducts = (): OfferTargetRule => ({ type: 'ALL_PRODUCTS' });

export interface OfferPercentOff {
  percent: number; // 0..100
  pool?: OfferTargetRule[]; // optional (default all)
}

export interface OfferAmountOff {
  amountPence: number; // >= 0
  pool?: OfferTargetRule[]; // optional (default all)
}

export interface OfferXForY {
  buyQty: number; // X
  payQty: number; // Y
  pool: OfferTargetRule[];
}

export interface OfferXForFixedPrice {
  qty: number; // X
  pricePence: number; // total price in pence
  pool: OfferTargetRule[];
}

export interface OfferBOGOF {
  buyQty: number;
  getQty: number;
  buyPool: OfferTargetRule[];
  getPool: OfferTargetRule[];
  warnIfGetMoreExpensive?: boolean;
  autoAddGetItem?: boolean;
}

export type OfferSpendXGetYReward =
  | { type: 'AMOUNT_OFF'; amountPence: number }
  | { type: 'PERCENT_OFF'; percent: number };

export interface OfferSpendXGetY {
  spendPence: number;
  reward: OfferSpendXGetYReward;
}

export type OfferKind =
  | 'PERCENT_OFF'
  | 'AMOUNT_OFF'
  | 'X_FOR_Y'
  | 'X_FOR_FIXED_PRICE'
  | 'BOGOF'
  | 'SPEND_X_GET_Y'
  // reserved
  | 'FREE_GIFT'
  | 'FLASH_SALE'
  | 'BUNDLE';

export type OfferPayload =
  | { kind: 'PERCENT_OFF'; data: OfferPercentOff }
  | { kind: 'AMOUNT_OFF'; data: OfferAmountOff }
  | { kind: 'X_FOR_Y'; data: OfferXForY }
  | { kind: 'X_FOR_FIXED_PRICE'; data: OfferXForFixedPrice }
  | { kind: 'BOGOF'; data: OfferBOGOF }
  | { kind: 'SPEND_X_GET_Y'; data: OfferSpendXGetY }
  | { kind: 'FREE_GIFT'; data: Record<string, unknown> }
  | { kind: 'FLASH_SALE'; data: Record<string, unknown> }
  | { kind: 'BUNDLE'; data: Record<string, unknown> };

export interface OfferAdminForm {
  id?: string;

  name: string;
  mode: 'AUTO' | 'CODE' | 'BOTH';
  code: string | null;

  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  startsAt: string | null;
  endsAt: string | null;

  stackingMode:
    | 'BEST_DISCOUNT_WINS'
    | 'HIGHEST_PRIORITY_WINS'
    | 'STACK_ALLOWED'
    | 'HIGHEST_PRIORITY_WINS';
  priority: number;

  maxDiscountPerOrderPence: number | null;
  preventFreeOrder: boolean;

  visibility: OfferVisibility;

  exclusions: Record<string, unknown>;
  payload: OfferPayload;

  // banner defaults
  bannerEnabled: boolean;
  bannerTitle: string | null;
  bannerMessage: string | null;
  bannerCtaLabel: string | null;
  bannerCtaHref: string | null;
  bannerStartsAt: string | null;
  bannerEndsAt: string | null;

  // email defaults saved on offer
  emailEnabled: boolean;
  emailSubject: string | null;
  emailMessage: string | null;

  // ✅ Manual blast settings (admin-only, not stored on Offer table)
  blastEnabled?: boolean;
  blastScope?: OfferEmailScope;
  blastUserIds?: string[];
}

/* =========================================================
   Engine meta types (unchanged)
   ========================================================= */

export type OfferLineDiscountReason = 'FREE' | 'DISCOUNT';

export interface OfferLineDiscount {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  amountPence: number;
  reason: OfferLineDiscountReason;
}

export type OfferLineParticipantRole = 'BUY' | 'GET' | 'ELIGIBLE';

export interface OfferLineParticipant {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  role: OfferLineParticipantRole;
}

export interface OfferAppliedMeta {
  groups?: number;
  freeCount?: number;
  samePool?: boolean;

  lineDiscounts?: OfferLineDiscount[];
  lineParticipants?: OfferLineParticipant[];

  [k: string]: unknown;
}

export interface OfferDbRow {
  id: string;
  name: string;

  mode: OfferMode;
  code: string | null;

  status: OfferStatus;
  startsAt: string | null; // ISO
  endsAt: string | null; // ISO

  stackingMode: OfferStackingMode;
  priority: number;

  maxDiscountPerOrderPence: number | null;
  preventFreeOrder: boolean;

  visibility: OfferVisibility;

  exclusions: Record<string, unknown> | null;
  payload: OfferPayload;
}
