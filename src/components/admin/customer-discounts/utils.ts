// src/components/admin/customer-discounts/utils.ts
import type { DiscountStatus } from './types';

export function clampInt(n: number, min: number, max: number) {
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

export function toIntOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const x = Number(t);
  if (!Number.isFinite(x)) return null;
  return Math.trunc(x);
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

export function computeStatus(
  startsAt: Date | null,
  endsAt: Date | null,
  now = new Date()
): DiscountStatus {
  const startOk = !startsAt || startsAt <= now;
  const endOk = !endsAt || endsAt >= now;

  if (startOk && endOk) return 'ACTIVE';
  if (startsAt && startsAt > now) return 'UPCOMING';
  return 'EXPIRED';
}

export function statusLabel(s: DiscountStatus) {
  if (s === 'ACTIVE') return 'Active';
  if (s === 'UPCOMING') return 'Upcoming';
  return 'Expired';
}
