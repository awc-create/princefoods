'use client';

/**
 * The admin front page, rebuilt around "what needs doing" rather than totals.
 *
 * Each row is both the count and the way in — clicking opens the right
 * pre-filtered list, so staff never have to learn what a filter is.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Worklist {
  toPack: number;
  labelsToPrint: number;
  openReturns: number;
  customerReports: number;
  unpaidStale: number;
}

interface Row {
  key: keyof Worklist;
  label: (n: number) => string;
  href: string;
  cta: string;
  tone: 'action' | 'warn' | 'muted';
  hideWhenZero?: boolean;
}

const ROWS: Row[] = [
  {
    key: 'toPack',
    label: (n) => `${n} order${n === 1 ? '' : 's'} to pack`,
    href: '/admin/orders?status=PAID&archived=active',
    cta: 'Start packing',
    tone: 'action'
  },
  {
    key: 'labelsToPrint',
    label: (n) => `${n} label${n === 1 ? '' : 's'} to print and send`,
    href: '/admin/shipments?hasLabel=1',
    cta: 'Open shipments',
    tone: 'action'
  },
  {
    key: 'customerReports',
    label: (n) => `${n} problem${n === 1 ? '' : 's'} reported by customers`,
    href: '/admin/returns',
    cta: 'Review',
    tone: 'warn'
  },
  {
    key: 'openReturns',
    label: (n) => `${n} return${n === 1 ? '' : 's'} to action`,
    href: '/admin/returns',
    cta: 'Review',
    tone: 'warn'
  },
  {
    key: 'unpaidStale',
    label: (n) => `${n} checkout${n === 1 ? '' : 's'} abandoned without payment`,
    href: '/admin/orders?status=PLACED&payment=PENDING',
    cta: 'View',
    tone: 'muted',
    hideWhenZero: true
  }
];

const TONE = {
  action: { bg: '#eff6ff', border: '#bfdbfe', chip: '#1d4ed8', fg: '#1e3a8a' },
  warn: { bg: '#fffbeb', border: '#fde68a', chip: '#b45309', fg: '#78350f' },
  muted: { bg: '#f9fafb', border: '#e5e7eb', chip: '#6b7280', fg: '#374151' }
} as const;

export default function WorkQueue() {
  const [data, setData] = useState<Worklist | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/worklist', { cache: 'no-store' });
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok || !j.ok) setFailed(true);
        else setData(j as Worklist);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = data ? data.toPack + data.labelsToPrint + data.openReturns : 0;
  const allClear = data !== null && total === 0;

  return (
    <section aria-label="Today's work" style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 4px' }}>Today</h2>
      <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: 13.5 }}>
        Everything waiting on you, in the order it usually gets done.
      </p>

      {failed && (
        <div
          role="alert"
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          Couldn&apos;t load your work list. Refresh to try again.
        </div>
      )}

      {!failed && allClear && (
        <div
          style={{
            padding: '16px 18px',
            borderRadius: 12,
            border: '1px solid #bbf7d0',
            background: '#f0fdf4',
            color: '#14532d',
            fontWeight: 700
          }}
        >
          ✅ All clear — nothing waiting. New orders will appear here.
        </div>
      )}

      {!failed && !allClear && (
        <div style={{ display: 'grid', gap: 8 }}>
          {ROWS.map((row) => {
            const n = data?.[row.key] ?? null;
            if (n === 0 && row.hideWhenZero) return null;
            if (data && n === 0 && row.tone !== 'action') return null;

            const t = TONE[row.tone];
            const loading = n === null;

            return (
              <Link
                key={row.key}
                href={row.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  background: t.bg,
                  color: t.fg,
                  textDecoration: 'none'
                }}
              >
                <span
                  aria-hidden
                  style={{
                    minWidth: 40,
                    height: 32,
                    padding: '0 10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    background: t.chip,
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 15
                  }}
                >
                  {loading ? '–' : n}
                </span>

                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  {loading ? 'Loading…' : row.label(n)}
                </span>

                <span
                  style={{
                    marginLeft: 'auto',
                    fontWeight: 700,
                    fontSize: 13.5,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {row.cta} →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
