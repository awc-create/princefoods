export type ShippingKind = 'DRY' | 'FROZEN' | 'MIXED';

export interface LineDiscount {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  amountPence: number;
  reason?: 'FREE' | 'DISCOUNT';
}

export interface LineParticipant {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  role?: 'BUY' | 'GET' | 'ELIGIBLE' | 'FREE';
}

export interface OfferCard {
  offerId: string;
  name: string;
  kind: string;
  discountPence: number;
  meta?: {
    lineDiscounts?: LineDiscount[];
    lineParticipants?: LineParticipant[];
    groups?: number;
    freeCount?: number;
    samePool?: boolean;
  } | null;
}

export interface OffersSnapshot {
  discountPence: number;
  applied: OfferCard[];
  eligible?: OfferCard[];
  autoAdd: {
    reasonOfferId: string;
    productId?: string | null;
    sku?: string | null;
    name: string;
    qty: number;
  }[];
}

export interface EvalItem {
  productId?: string | null;
  sku?: string | null;
  unitPrice: number;
  quantity: number;
}

export interface EvaluateOk {
  ok: true;
  currency: string;
  promotionId: string;
  code: string;
  name: string;
  discountPence: number;
  shippingDiscountPence: number;
}

export interface EvaluateErr {
  ok: false;
  error: string;
}

export type EvaluateResp = EvaluateOk | EvaluateErr;
