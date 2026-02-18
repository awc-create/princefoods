import type {
  DiscountType,
  PromoKindUI,
  PromotionRow,
  PromotionStatus,
  UsageAttemptRow
} from './types';

export function normCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function fmtDate(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString();
}

export function fmtDateTime(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString();
}

export function clampInt(n: number, min: number, max: number) {
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

export function poundsToPence(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const x = Number(t);
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.round(x * 100);
}

export function toIntOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const x = Number(t);
  if (!Number.isFinite(x)) return null;
  return Math.trunc(x);
}

export function discountLabel(p: PromotionRow) {
  if (p.discountType === 'PERCENT') return `${p.percentOff ?? 0}% OFF`;
  if (p.discountType === 'AMOUNT') return `£${((p.amountOffPence ?? 0) / 100).toFixed(2)} OFF`;
  if (p.discountType === 'PRODUCT_100') return `100% OFF`;
  return '—';
}

export function targetLabel(p: PromotionRow) {
  if (p.targetType === 'SITE_WIDE') return 'All products';
  if (p.targetType === 'CATEGORIES') return 'Categories';
  if (p.targetType === 'PRODUCTS') return 'Products';
  return '—';
}

export function statusPillClass(s: PromotionStatus, styles: Record<string, string>) {
  if (s === 'ACTIVE') return styles.pillActive;
  if (s === 'PAUSED') return styles.pillPaused;
  return styles.pillExpired;
}

export function kindToDiscountType(kind: PromoKindUI): DiscountType {
  if (kind === 'PERCENT_OFF') return 'PERCENT';
  if (kind === 'AMOUNT_OFF') return 'AMOUNT';
  return 'AMOUNT';
}

export function isoToDateInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function penceToGBP(p: number) {
  const x = Math.max(0, Math.trunc(p));
  return `£${(x / 100).toFixed(2)}`;
}

export function usageStatusLabel(a: UsageAttemptRow) {
  if (a.outcome === 'REJECTED') return 'Rejected';
  if (!a.orderId) return 'Applied (no order)';
  if (!a.orderPaymentStatus) return 'Applied (order created)';
  if (a.orderPaymentStatus !== 'CAPTURED') return `Applied (order ${a.orderPaymentStatus})`;
  return a.redeemedOnOrder ? 'Redeemed' : 'Applied (not used on payment)';
}

export function dedupeIds(ids: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const k = id.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
