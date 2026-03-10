// src/components/admin/promotions/types.ts

export type PromotionStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED';
export type PromotionType = 'CODE' | 'GIFT';

export type DiscountType = 'PERCENT' | 'AMOUNT' | 'PRODUCT_100';
export type TargetType = 'SITE_WIDE' | 'CATEGORIES' | 'PRODUCTS';

// ✅ UI tabs (CUSTOMER_DISCOUNT = AUTO per-customer discount, % based, no code)
export type PromoKindUI = 'AMOUNT_OFF' | 'PERCENT_OFF' | 'FREE_SHIPPING' | 'CUSTOMER_DISCOUNT';

// ✅ customer eligibility (used for allow-list + later “send promo to customers”)
export type EligibleCustomerScope = 'ALL' | 'USERS';

// align with schema
export type PromotionApplyMode = 'AUTO' | 'CODE' | 'HYBRID';

export interface PromotionRow {
  id: string;
  name: string;
  code: string | null;
  type: PromotionType;
  status: PromotionStatus;

  applyMode: PromotionApplyMode;

  discountType: DiscountType;
  percentOff: number | null;
  amountOffPence: number | null;

  applyShippingDiscount: boolean;
  shippingPercentOffDry: number | null;
  shippingPercentOffFrozen: number | null;

  targetType: TargetType;

  eligibleCustomerScope: EligibleCustomerScope;
  eligibleUserIdsCount: number;

  startsAt: string | null;
  endsAt: string | null;
  maxUsesTotal: number | null;
  maxUsesPerUser: number | null;

  createdAt: string;
  updatedAt: string;

  redemptionCount: number;
}

export interface ApiListOk {
  ok: true;
  promotions: PromotionRow[];
}

export interface ApiErr {
  ok: false;
  error: string;
}

// NOTE: code is optional now (AUTO mode customer discounts)
export interface CreateBody {
  name: string;

  // CODE/HYBRID promos require a code; AUTO can omit
  code?: string | null;

  type: PromotionType;
  status: PromotionStatus;

  applyMode?: PromotionApplyMode;

  startsAt: string | null;
  endsAt: string | null;

  lockedToUserId?: string | null;
  lockedToEmail?: string | null;

  maxUsesTotal: number | null;
  maxUsesPerUser: number | null;

  targetType: TargetType;

  discountType: DiscountType;
  percentOff?: number | null;
  amountOffPence?: number | null;

  applyShippingDiscount?: boolean;
  shippingPercentOffDry?: number | null;
  shippingPercentOffFrozen?: number | null;

  categoryIds?: string[];
  productIds?: string[];

  eligibleCustomerScope?: EligibleCustomerScope;
  eligibleUserIds?: string[];
}

export interface PickerOption {
  id: string;
  label: string;
  meta?: string;
}

// options endpoint types (your /api/admin/promotions/options endpoint)
export interface OptionsApiOk {
  ok: true;
  categories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; sku: string | null }>;
}

// (optional) customers options endpoint if you use it
export interface CustomersOptionsApiOk {
  ok: true;
  customers: Array<{ id: string; name: string | null; email: string }>;
}

/** Promotion detail returned by GET /api/admin/promotions/[id] */
export interface PromotionDetail {
  id: string;
  name: string;
  code: string | null;
  status: PromotionStatus;

  applyMode: PromotionApplyMode;

  startsAt: string | null;
  endsAt: string | null;

  discountType: DiscountType;
  percentOff: number | null;
  amountOffPence: number | null;

  applyShippingDiscount: boolean;
  shippingPercentOffDry: number | null;
  shippingPercentOffFrozen: number | null;

  targetType: TargetType;

  eligibleCustomerScope: EligibleCustomerScope;
  eligibleUserIds: string[];
}

export type PromotionPatch = Partial<
  Pick<
    PromotionDetail,
    | 'name'
    | 'status'
    | 'startsAt'
    | 'endsAt'
    | 'eligibleCustomerScope'
    | 'eligibleUserIds'
    | 'applyShippingDiscount'
    | 'shippingPercentOffDry'
    | 'shippingPercentOffFrozen'
    | 'percentOff'
    | 'amountOffPence'
  >
> & {
  lockedToUserId?: string | null;
  lockedToEmail?: string | null;
};

// ---------------------
// Usage panel types
// ---------------------

export type UsageOutcome = 'APPLIED' | 'REJECTED';

export interface UsageAttemptRow {
  id: string;
  code: string;
  outcome: UsageOutcome;
  errorCode: string | null;
  email: string | null;
  userId: string | null;
  createdAt: string;

  currency: string;
  subtotalPence: number | null;
  shippingPence: number | null;
  discountPence: number;
  shippingDiscountPence: number;

  promotionId: string | null;
  promotionName: string | null;

  orderId: string | null;
  orderDisplayId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;

  redeemedOnOrder: boolean;
}

export interface UsageRedemptionRow {
  id: string;
  code: string;
  promotionId: string;
  promotionName: string | null;
  orderId: string;
  orderDisplayId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;
  email: string | null;
  userId: string | null;
  createdAt: string;
}

export interface UsageApiOk {
  ok: true;
  since: string;
  attempts: UsageAttemptRow[];
  redemptions: UsageRedemptionRow[];
}
