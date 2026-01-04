// src/components/checkout/helpers.ts
import type { Delivery } from './types';

export const DELIVERY_PRICE: Record<Delivery, number> = {
  standard: 399,
  express: 799
};

export const LS_CONTACT_KEY = 'pf_checkout_contact';
export const LS_ADDR_KEY = 'pf_checkout_addr';

/* =========================
   Postcode helpers
   ========================= */
export function formatUKPostcode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (s.length < 5) return s;
  const head = s.slice(0, -3);
  const tail = s.slice(-3);
  return `${head} ${tail}`;
}

export function isValidUKPostcode(raw: string): boolean {
  const pc = raw.trim().toUpperCase();
  if (!pc) return false;
  const re =
    /^(GIR 0AA|(?:[A-Z]{1,2}\d{1,2}|[A-Z]{1,2}\d[A-Z]|[A-Z]{1,2}\d{1,2}[A-Z])\s?\d[A-Z]{2})$/i;
  return re.test(pc);
}

export function postcodeValidForCountry(country: string, postcode: string): boolean {
  const cc = (country ?? '').trim().toUpperCase();
  const pc = postcode.trim();
  if (!pc) return false;
  if (cc === 'GB') return isValidUKPostcode(formatUKPostcode(pc));
  return pc.length >= 3;
}

/* =========================
   Phone helpers
   ========================= */
function digitsOnly(s: string) {
  return s.replace(/[^\d]/g, '');
}

// Keep it loose for checkout UX: accept +44..., or digits; validate 6–15 digits.
export function normalizePhoneLoose(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const d = digitsOnly(t);
  if (d.length < 6 || d.length > 15) return '';
  return t.startsWith('+') ? t : d;
}

export function normalizeTown(raw: string): string {
  return raw.trim();
}
