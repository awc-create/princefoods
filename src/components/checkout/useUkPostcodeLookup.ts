// src/components/checkout/useUkPostcodeLookup.ts
'use client';

import { useRef, useState } from 'react';
import type { Addr, LookupState } from './types';

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

export function useUkPostcodeLookup() {
  const [shipLookup, setShipLookup] = useState<LookupState>({ status: 'idle' });
  const [billLookup, setBillLookup] = useState<LookupState>({ status: 'idle' });

  const shipAbortRef = useRef<AbortController | null>(null);
  const billAbortRef = useRef<AbortController | null>(null);

  function reset(which: 'shipping' | 'billing') {
    if (which === 'shipping') setShipLookup({ status: 'idle' });
    else setBillLookup({ status: 'idle' });
  }

  async function lookupUKPostcode(
    postcodeRaw: string,
    which: 'shipping' | 'billing',
    apply: (patch: Partial<Addr>) => void
  ) {
    const pc = formatUKPostcode(postcodeRaw);
    if (!isValidUKPostcode(pc)) {
      reset(which);
      return;
    }

    const setState = which === 'shipping' ? setShipLookup : setBillLookup;
    const abortRef = which === 'shipping' ? shipAbortRef : billAbortRef;

    // cancel previous request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState({ status: 'loading', message: 'Looking up postcode…' });

    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`, {
        method: 'GET',
        signal: abortRef.current.signal,
        headers: { Accept: 'application/json' }
      });

      const data = (await res.json()) as {
        result?: {
          admin_district?: string | null;
          admin_ward?: string | null;
          parish?: string | null;
        } | null;
        error?: string;
      };

      if (!res.ok || !data?.result) {
        setState({ status: 'err', message: data?.error ?? 'Postcode not found.' });
        return;
      }

      const townGuess = (data.result.admin_district ?? '').trim();
      const localityGuess = (data.result.parish ?? data.result.admin_ward ?? '').trim();

      // Apply ONLY as suggestions – caller controls whether to override empty fields
      apply({
        town: townGuess || undefined,
        city: localityGuess || undefined
      });

      setState({
        status: 'ok',
        message: townGuess ? `Found: ${townGuess}` : 'Postcode found.'
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setState({ status: 'err', message: 'Lookup failed. Please enter town manually.' });
    }
  }

  return {
    shipLookup,
    billLookup,
    lookupUKPostcode,
    reset,
    formatUKPostcode
  };
}
