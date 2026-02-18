// src/components/admin/offers/utils.ts
import type { OfferPayload } from '@/types/offers';

function penceToGBP(pence: number) {
  const v = Number.isFinite(pence) ? pence : 0;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v / 100);
}

export function offerLabel(o: { payload: OfferPayload }) {
  const p = o.payload;

  if (p.kind === 'BOGOF') return `Buy ${p.data.buyQty} get ${p.data.getQty} free`;
  if (p.kind === 'X_FOR_Y') return `Buy ${p.data.buyQty} pay ${p.data.payQty}`;
  if (p.kind === 'X_FOR_FIXED_PRICE') return `${p.data.qty} for ${penceToGBP(p.data.pricePence)}`;

  if (p.kind === 'PERCENT_OFF') return `${p.data.percent}% off`;
  if (p.kind === 'AMOUNT_OFF') return `${penceToGBP(p.data.amountPence)} off`;
  if (p.kind === 'SPEND_X_GET_Y') {
    if (p.data.reward.type === 'AMOUNT_OFF') {
      return `Spend ${penceToGBP(p.data.spendPence)} get ${penceToGBP(p.data.reward.amountPence)} off`;
    }
    return `Spend ${penceToGBP(p.data.spendPence)} get ${p.data.reward.percent}% off`;
  }

  return '—';
}

export function fmtDate(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString();
}

export function clampInt(n: number, min: number, max: number) {
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

export function dedupeIds(ids: string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}
