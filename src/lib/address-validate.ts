// src/lib/address-validate.ts

export interface AddressIn {
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  town?: string;
  postcode?: string;
  country?: string;
  phoneE164?: string;
}

function digitsOnly(s: string) {
  return s.replace(/[^\d]/g, '');
}

// Loose phone: accept +44... or digits, validate 6–15 digits.
export function normalizePhoneLoose(raw: string) {
  const t = (raw ?? '').trim();
  if (!t) return '';
  const d = digitsOnly(t);
  if (d.length < 6 || d.length > 15) return '';
  return t.startsWith('+') ? t : d;
}

// Minimal UK format; real validation can be stronger if you want.
export function formatUkPostcodeLoose(raw: string) {
  return (raw ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function normalizeAddress(input: AddressIn) {
  const country = (input.country ?? 'GB').trim().toUpperCase();
  const town = (input.town ?? '').trim();
  const cityTyped = (input.city ?? '').trim();

  const city = cityTyped || town; // ✅ never empty if town exists
  const postcode =
    country === 'GB' ? formatUkPostcodeLoose(input.postcode ?? '') : (input.postcode ?? '').trim();

  return {
    firstName: (input.firstName ?? '').trim(),
    lastName: (input.lastName ?? '').trim(),
    line1: (input.line1 ?? '').trim(),
    line2: (input.line2 ?? '').trim(),
    town,
    city,
    postcode,
    country,
    phoneE164: normalizePhoneLoose(input.phoneE164 ?? '')
  };
}

export function validateAddressNormalized(a: ReturnType<typeof normalizeAddress>) {
  if (!a.firstName) return 'FIRST_NAME_REQUIRED';
  if (!a.lastName) return 'LAST_NAME_REQUIRED';
  if (!a.line1) return 'ADDRESS_LINE1_REQUIRED';
  if (!a.country) return 'COUNTRY_REQUIRED';
  if (!a.postcode) return 'POSTCODE_REQUIRED';
  if (!a.phoneE164) return 'PHONE_REQUIRED';

  if (a.country === 'GB') {
    // Royal Mail post town required
    if (!a.town) return 'TOWN_REQUIRED_FOR_GB';
    // Ensure city not blank (should be guaranteed by normalization)
    if (!a.city) return 'CITY_REQUIRED_FOR_GB';
    // Very light sanity check (your client hook does proper check)
    if (a.postcode.length < 6) return 'POSTCODE_INVALID_FOR_GB';
  } else {
    // Non-GB: city required, town optional
    if (!a.city) return 'CITY_REQUIRED';
    if (a.postcode.length < 3) return 'POSTCODE_TOO_SHORT';
  }

  return null;
}
