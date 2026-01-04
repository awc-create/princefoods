// src/app/admin/shipping/geo.ts

export type CountryCode = 'GB' | 'IE';

export type PresetKey = 'GB_ALL' | 'GB_ENGLAND' | 'GB_WALES' | 'GB_SCOTLAND' | 'GB_NI' | 'IE_ROI';

/**
 * Full UK postcode AREAS (leading letters).
 * Source concept: UK "postcode areas" list (e.g. B, SW, BT).
 * This is the canonical “prefix list” used for broad region matching.
 */
export const ALL_UK_POSTCODE_AREAS = [
  'AB',
  'AL',
  'B',
  'BA',
  'BB',
  'BD',
  'BH',
  'BL',
  'BN',
  'BR',
  'BS',
  'BT',
  'CA',
  'CB',
  'CF',
  'CH',
  'CM',
  'CO',
  'CR',
  'CT',
  'CV',
  'CW',
  'DA',
  'DD',
  'DE',
  'DG',
  'DH',
  'DL',
  'DN',
  'DT',
  'DY',
  'E',
  'EC',
  'EH',
  'EN',
  'EX',
  'FK',
  'FY',
  'G',
  'GL',
  'GU',
  'GY',
  'HA',
  'HD',
  'HG',
  'HP',
  'HR',
  'HS',
  'HU',
  'HX',
  'IG',
  'IM',
  'IP',
  'IV',
  'JE',
  'KA',
  'KT',
  'KW',
  'KY',
  'L',
  'LA',
  'LD',
  'LE',
  'LL',
  'LN',
  'LS',
  'LU',
  'M',
  'ME',
  'MK',
  'ML',
  'N',
  'NE',
  'NG',
  'NN',
  'NP',
  'NR',
  'NW',
  'OL',
  'OX',
  'PA',
  'PE',
  'PH',
  'PL',
  'PO',
  'PR',
  'RG',
  'RH',
  'RM',
  'S',
  'SA',
  'SE',
  'SG',
  'SK',
  'SL',
  'SM',
  'SN',
  'SO',
  'SP',
  'SR',
  'SS',
  'ST',
  'SW',
  'SY',
  'TA',
  'TD',
  'TF',
  'TN',
  'TQ',
  'TR',
  'TS',
  'TW',
  'UB',
  'W',
  'WA',
  'WC',
  'WD',
  'WF',
  'WN',
  'WR',
  'WS',
  'WV',
  'YO',
  'ZE'
] as const;

export type UkArea = (typeof ALL_UK_POSTCODE_AREAS)[number];

export const PRESET_LABELS: Record<PresetKey, string> = {
  GB_ALL: 'Great Britain (GB) — All UK postcodes',
  GB_ENGLAND: 'England (GB)',
  GB_WALES: 'Wales (GB)',
  GB_SCOTLAND: 'Scotland (GB)',
  GB_NI: 'Northern Ireland (GB)',
  IE_ROI: 'Ireland (IE) — Republic of Ireland'
};

/**
 * Best-practical presets by postcode area.
 * Borders can be imperfect; you have city/outcode overrides + priority.
 */
export const PRESET_AREAS: Record<PresetKey, ReadonlyArray<UkArea> | null> = {
  GB_ALL: [...ALL_UK_POSTCODE_AREAS],

  // England (broad)
  GB_ENGLAND: [
    'AL',
    'B',
    'BA',
    'BB',
    'BD',
    'BH',
    'BL',
    'BN',
    'BR',
    'BS',
    'CA',
    'CB',
    'CH',
    'CM',
    'CO',
    'CR',
    'CT',
    'CV',
    'CW',
    'DA',
    'DE',
    'DG',
    'DH',
    'DL',
    'DN',
    'DT',
    'DY',
    'E',
    'EC',
    'EN',
    'EX',
    'FY',
    'GL',
    'GU',
    'HA',
    'HD',
    'HG',
    'HP',
    'HR',
    'HU',
    'HX',
    'IG',
    'IP',
    'KT',
    'L',
    'LA',
    'LE',
    'LN',
    'LS',
    'LU',
    'M',
    'ME',
    'MK',
    'N',
    'NE',
    'NG',
    'NN',
    'NR',
    'NW',
    'OL',
    'OX',
    'PE',
    'PL',
    'PO',
    'PR',
    'RG',
    'RH',
    'RM',
    'S',
    'SE',
    'SG',
    'SK',
    'SL',
    'SM',
    'SN',
    'SO',
    'SP',
    'SR',
    'SS',
    'ST',
    'SW',
    'SY',
    'TA',
    'TF',
    'TN',
    'TQ',
    'TR',
    'TS',
    'TW',
    'UB',
    'W',
    'WA',
    'WC',
    'WD',
    'WF',
    'WN',
    'WR',
    'WS',
    'WV',
    'YO'
  ],

  // Wales (broad)
  GB_WALES: ['CF', 'LD', 'LL', 'NP', 'SA', 'SY'],

  // Scotland (broad)
  GB_SCOTLAND: [
    'AB',
    'DD',
    'DG',
    'EH',
    'FK',
    'G',
    'HS',
    'IV',
    'KA',
    'KW',
    'KY',
    'ML',
    'PA',
    'PH',
    'TD',
    'ZE'
  ],

  // Northern Ireland
  GB_NI: ['BT'],

  // ROI is country-only here
  IE_ROI: null
};

export function normalizeAreaPrefix(v: string): string {
  return (v ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export function normalizeOutcode(v: string): string {
  return (v ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** Leading 1–2 letters. */
export function ukPostcodeToArea(postcode: string): string {
  const s = (postcode ?? '').trim().toUpperCase();
  const m = s.match(/^([A-Z]{1,2})/);
  return m ? m[1] : '';
}

/** Outcode: letters + digit + optional alnum (SW1A, B21, M1). */
export function ukPostcodeToOutcode(postcode: string): string {
  const s = (postcode ?? '').trim().toUpperCase();
  const m = s.match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
  return m ? m[1] : '';
}
