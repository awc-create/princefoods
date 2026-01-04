// src/lib/shipping/apc-address.ts
// Types below match what your route/order shape looks like; adjust names if needed
interface Order {
  shippingAddress: {
    firstName?: string | null;
    lastName?: string | null;
    company?: string | null; // if you store a company field
    line1: string;
    line2?: string | null;
    city: string;
    postcode?: string | null;
    country?: string | null; // e.g. "GB"
    phoneE164?: string | null;
    phone?: string | null;
  };
  contactEmail?: string | null;
}

export interface ApcDeliveryInput {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address1: string;
  address2?: string;
  city: string;
  postcode: string;
  countryCode?: string;
}

const digits = (s?: string | null) => (s ? s.replace(/[^\d]/g, '') : '');

export function toApcDeliveryFromOrder(order: Order): ApcDeliveryInput {
  const ship = order.shippingAddress;
  const person = [ship.firstName ?? '', ship.lastName ?? ''].filter(Boolean).join(' ').trim();
  const company = (ship.company ?? '').trim();

  // APC "CompanyName" is required in the Orders payload we build later.
  // We’ll pass "name" here as CompanyName and "contact" as PersonName.
  // If there’s no company, use the person’s name as CompanyName (APC is okay with that).
  const companyName = company || person || 'Customer';

  const phoneRaw = ship.phoneE164 ?? ship.phone ?? '';
  return {
    name: companyName,
    contact: person || companyName,
    phone: digits(phoneRaw),
    email: order.contactEmail ?? '',
    address1: ship.line1,
    address2: ship.line2 ?? '',
    city: ship.city,
    postcode: (ship.postcode ?? '').trim(),
    countryCode: (ship.country ?? 'GB').toUpperCase()
  };
}
