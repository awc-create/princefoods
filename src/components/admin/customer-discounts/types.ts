// src/components/admin/customer-discounts/types.ts

export type DiscountStatus = 'ACTIVE' | 'UPCOMING' | 'EXPIRED';

export interface CustomerDiscountRow {
  id: string;

  userId: string;
  userLabel: string; // name/email for display
  userEmail: string;

  percentOff: number; // 1–100
  applyShippingDiscount: boolean;
  shippingPercentOffDry: number | null;
  shippingPercentOffFrozen: number | null;

  startsAt: string | null;
  endsAt: string | null;

  note: string | null;

  createdAt: string;
  updatedAt: string;

  status: DiscountStatus;
}

export interface ApiErr {
  ok: false;
  error: string;
}

export interface ListOk {
  ok: true;
  rows: CustomerDiscountRow[];
}

export interface CreateBody {
  userIds: string[]; // allow multiple users at once
  percentOff: number; // 1–100

  applyShippingDiscount: boolean;
  shippingPercentOffDry: number | null;
  shippingPercentOffFrozen: number | null;

  startsAt: string | null;
  endsAt: string | null;

  note?: string | null;
}

export type PatchBody = Partial<{
  percentOff: number;

  applyShippingDiscount: boolean;
  shippingPercentOffDry: number | null;
  shippingPercentOffFrozen: number | null;

  startsAt: string | null;
  endsAt: string | null;

  note: string | null;
}>;

export type CustomerOptionsResponse =
  | { ok: true; options: Array<{ id: string; label: string; meta?: string }> }
  | { ok: false; error: string }
  | { error?: string };

export interface PickerOption {
  id: string;
  label: string;
  meta?: string;
}
