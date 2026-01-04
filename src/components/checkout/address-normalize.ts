// src/components/checkout/address-normalize.ts

export interface LookupPatch {
  town?: string | null;
  city?: string | null;
}

/**
 * Merge typed + lookup values safely.
 * - Never overwrites user's typed values
 * - For GB: town is required (Royal Mail post town), city must not be empty
 * - For non-GB: city required, town optional
 */
export function mergeTownCity(args: {
  country: string;
  typedTown: string;
  typedCity: string;
  lookup?: LookupPatch | null;
}) {
  const cc = (args.country ?? '').toUpperCase();
  const typedTown = (args.typedTown ?? '').trim();
  const typedCity = (args.typedCity ?? '').trim();

  const lookupTown = (args.lookup?.town ?? '').trim();
  const lookupCity = (args.lookup?.city ?? '').trim();

  if (cc === 'GB') {
    const town = typedTown || lookupTown; // town required
    const city = typedCity || lookupCity || town; // city never empty (fallback to town)
    return { town, city };
  }

  const town = typedTown || lookupTown;
  const city = typedCity || lookupCity || town; // city required but can fallback
  return { town, city };
}

/** Minimal UK postcode formatting (keeps your hook as the real validator). */
export function formatUkPostcodeLoose(raw: string) {
  const t = (raw ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  return t;
}
