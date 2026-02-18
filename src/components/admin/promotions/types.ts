export type PromotionStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED';
export type PromotionType = 'CODE' | 'GIFT';
export type DiscountType = 'PERCENT' | 'AMOUNT' | 'PRODUCT_100';
export type TargetType = 'SITE_WIDE' | 'CATEGORIES' | 'PRODUCTS';

export type PromoKindUI = 'AMOUNT_OFF' | 'PERCENT_OFF' | 'FREE_SHIPPING';

export interface PromotionRow {
  id: string;
  name: string;
  code: string;
  type: PromotionType;
  status: PromotionStatus;

  discountType: DiscountType;
  percentOff: number | null;
  amountOffPence: number | null;

  applyShippingDiscount: boolean;
  shippingPercentOffDry: number | null;
  shippingPercentOffFrozen: number | null;

  targetType: TargetType;

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

export interface CreateBody {
  name: string;
  code: string;
  type: PromotionType;
  status: PromotionStatus;
  startsAt: string | null;
  endsAt: string | null;

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
}

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

/** Promotion detail returned by GET /api/admin/promotions/[id] */
export interface PromotionDetail {
  id: string;
  name: string;
  code: string;
  status: PromotionStatus;
  startsAt: string | null;
  endsAt: string | null;
}

export type PromotionPatch = Partial<
  Pick<PromotionDetail, 'name' | 'status' | 'startsAt' | 'endsAt'>
>;

export interface PickerOption {
  id: string;
  label: string;
  meta?: string;
}

export interface OptionsApiOk {
  ok: true;
  categories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; sku: string | null }>;
}
