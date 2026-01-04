// src/lib/order-ui.ts

export function safeCaps(s: string) {
  return (s ?? '').toString().trim().toUpperCase();
}

export function statusClass(status: string) {
  // fallback if new statuses appear
  return `status_${safeCaps(status) || 'UNKNOWN'}`;
}

export function paymentClass(paymentStatus: string) {
  return `pay_${safeCaps(paymentStatus) || 'UNKNOWN'}`;
}

export interface AddressLike {
  firstName?: string | null;
  lastName?: string | null;
  line1?: string | null;
  line2?: string | null;
  town?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  phoneE164?: string | null;
}

export function formatAddressLines(a: AddressLike) {
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();

  const lines: string[] = [];
  if (name) lines.push(name);

  if (a.line1) lines.push(a.line1);
  if (a.line2) lines.push(a.line2);

  const townCity = [a.town, a.city].filter(Boolean).join(', ').trim();
  if (townCity) lines.push(townCity);

  if (a.postcode) lines.push(a.postcode);
  if (a.country) lines.push(a.country);

  if (a.phoneE164) lines.push(`Phone: ${a.phoneE164}`);

  return lines;
}
