// src/lib/admin-labels.ts
/**
 * Plain-English labels for database enums.
 *
 * The database keeps its enums (PAID, LABEL_READY, BOGOF…). Staff should never
 * have to learn them. Everything shown in the admin UI goes through here.
 *
 * Rule of thumb: if a staff member would have to ask "what does that mean?",
 * it belongs in this file.
 */

/* ---------------- Orders ---------------- */

const ORDER_STATUS: Record<string, string> = {
  DRAFT: 'Draft',
  PLACED: 'Awaiting payment',
  PAID: 'Paid — ready to pack',
  FULFILLED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded'
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS[status] ?? titleise(status);
}

/** Short version for narrow table columns. */
const ORDER_STATUS_SHORT: Record<string, string> = {
  DRAFT: 'Draft',
  PLACED: 'Awaiting payment',
  PAID: 'Paid',
  FULFILLED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded'
};

export function orderStatusShortLabel(status: string): string {
  return ORDER_STATUS_SHORT[status] ?? titleise(status);
}

/* ---------------- Payments ---------------- */

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: 'Not paid yet',
  AUTHORIZED: 'Card authorised',
  CAPTURED: 'Paid',
  PARTIAL_REFUND: 'Partly refunded',
  REFUNDED: 'Refunded',
  FAILED: 'Payment failed'
};

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS[status] ?? titleise(status);
}

/* ---------------- Shipments ---------------- */

const SHIPMENT_STATUS: Record<string, string> = {
  PENDING: 'Being booked',
  BOOKED: 'Booked — waiting for label',
  LABEL_READY: 'Label ready to print',
  SHIPPED: 'On its way',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled'
};

export function shipmentStatusLabel(status: string): string {
  return SHIPMENT_STATUS[String(status ?? '').toUpperCase()] ?? titleise(status);
}

/* ---------------- Delivery exceptions ---------------- */

const EXCEPTION_TYPE: Record<string, string> = {
  NEEDS_LABEL: 'No label bought yet',
  LABEL_PENDING: 'Waiting for label',
  NO_TRACKING_EVENTS: 'No tracking updates yet',
  NO_SCAN_24H: 'Not scanned in 24 hours',
  IN_TRANSIT_LONG: 'Taking longer than usual',
  STALE_ORDER: 'Sitting unshipped too long'
};

export function exceptionTypeLabel(type: string): string {
  return EXCEPTION_TYPE[type] ?? titleise(type);
}

/* ---------------- Offers ---------------- */

const OFFER_KIND: Record<string, string> = {
  BOGOF: 'Buy one, get one free',
  X_FOR_Y: 'Buy X, pay for Y',
  X_FOR_FIXED_PRICE: 'X items for a fixed price',
  PERCENT_OFF: '% off',
  AMOUNT_OFF: '£ off'
};

export function offerKindLabel(kind: string): string {
  return OFFER_KIND[kind] ?? titleise(kind);
}

const OFFER_STATUS: Record<string, string> = {
  ACTIVE: 'Running',
  PAUSED: 'Paused',
  EXPIRED: 'Finished',
  SCHEDULED: 'Scheduled'
};

export function offerStatusLabel(status: string): string {
  return OFFER_STATUS[status] ?? titleise(status);
}

/* ---------------- Product options ---------------- */

const OPTION_TYPE: Record<string, string> = {
  DROP_DOWN: 'Dropdown list',
  RADIO: 'Pick one (buttons)',
  CHECKBOX: 'Tick boxes',
  COLOR: 'Colour swatches',
  LIST: 'Dropdown list'
};

export function optionTypeLabel(type: string): string {
  return OPTION_TYPE[String(type ?? '').toUpperCase()] ?? titleise(type);
}

/* ---------------- Returns ---------------- */

const RETURN_STATUS: Record<string, string> = {
  OPEN: 'Needs a decision',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RECEIVED: 'Goods received back',
  REFUNDED: 'Refunded',
  CLOSED: 'Closed'
};

export function returnStatusLabel(status: string): string {
  return RETURN_STATUS[String(status ?? '').toUpperCase()] ?? titleise(status);
}

/* ---------------- Shipping temperature ---------------- */

export function shippingTempLabel(temp: string): string {
  if (temp === 'FROZEN') return 'Frozen / chilled';
  if (temp === 'DRY') return 'Dry / ambient';
  return titleise(temp);
}

/* ---------------- fallback ---------------- */

/** LABEL_READY -> "Label ready". Used when we meet an enum we haven't mapped. */
function titleise(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '—';
  if (s !== s.toUpperCase()) return s; // already human
  const words = s.toLowerCase().split(/[_\s]+/).filter(Boolean);
  if (!words.length) return s;
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
}
