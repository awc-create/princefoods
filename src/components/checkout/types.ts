// src/components/checkout/types.ts
export type Role = 'HEAD' | 'STAFF' | 'VIEWER';

export interface Addr {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string; // locality/borough
  town?: string; // Royal Mail post town
  postcode: string;
  country: string; // e.g. GB
  phoneE164?: string;
}

export type Delivery = 'standard' | 'express';
export type Step = 'address' | 'payment';

export type AddrTouched = Partial<Record<keyof Addr, boolean>>;

export interface LookupState {
  status: 'idle' | 'loading' | 'ok' | 'err';
  message?: string;
}
