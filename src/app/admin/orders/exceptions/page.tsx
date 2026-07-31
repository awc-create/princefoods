'use client';

import { exceptionTypeLabel } from '@/lib/admin-labels';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import Link from 'next/link';
import React from 'react';
import styles from './exceptions.module.scss';

type ExceptionType =
  | 'NEEDS_LABEL'
  | 'LABEL_PENDING'
  | 'NO_TRACKING_EVENTS'
  | 'NO_SCAN_24H'
  | 'IN_TRANSIT_LONG'
  | 'STALE_ORDER';

type SortMode = 'WORST' | 'NEWEST' | 'OLDEST';

interface Item {
  orderId: string;
  displayId: string;
  createdAt: string;
  updatedAt: string;

  contactEmail: string;
  grandTotal: number;

  shipmentId: string | null;
  shipmentStatus: string | null;
  waybill: string | null;
  trackingNumber: string | null;
  labelUrl: string | null;

  lastScanAt: string | null;
  hoursSinceLastScan: number | null;

  exceptionType: ExceptionType;
  message: string;
  ageDays: number;

  isResolved: boolean;
  resolvedAt: string | null;
}

interface ApiResp {
  ok: boolean;
  count: number;
  items: Item[];
}

function formatGBP(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}


function scanSeverity(hours: number | null) {
  if (hours === null) return null;
  if (hours < 6) return 'good';
  if (hours < 24) return 'warn';
  return 'bad';
}

function exceptionRank(t: ExceptionType) {
  // higher = worse
  switch (t) {
    case 'NO_SCAN_24H':
      return 100;
    case 'IN_TRANSIT_LONG':
      return 90;
    case 'NO_TRACKING_EVENTS':
      return 80;
    case 'LABEL_PENDING':
      return 60;
    case 'NEEDS_LABEL':
      return 50;
    case 'STALE_ORDER':
      return 10;
  }
}

export default function ExceptionsPage() {
  const [items, setItems] = React.useState<Item[]>([]);
  const { toast } = useAdminUi();
  const [loading, setLoading] = React.useState(true);

  const [filter, setFilter] = React.useState<ExceptionType | 'ALL'>('ALL');
  const [showResolved, setShowResolved] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState<SortMode>('WORST');

  const [rechecking, setRechecking] = React.useState<Record<string, boolean>>({});
  const [resolving, setResolving] = React.useState<Record<string, boolean>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (showResolved) qs.set('includeResolved', '1');
      const res = await fetch(`/api/admin/orders/exceptions?${qs.toString()}`, {
        cache: 'no-store'
      });
      const data = (await res.json()) as ApiResp;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  React.useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (cancelled) return;
      await load();
    }

    boot();

    const id = window.setInterval(() => {
      if (!cancelled) load();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [load]);

  const filtered = React.useMemo(() => {
    let out = items;

    if (filter !== 'ALL') out = out.filter((x) => x.exceptionType === filter);

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((x) => {
        const tracking = (x.trackingNumber ?? x.waybill ?? '').toLowerCase();
        return (
          x.displayId.toLowerCase().includes(q) ||
          x.contactEmail.toLowerCase().includes(q) ||
          tracking.includes(q) ||
          x.exceptionType.toLowerCase().includes(q) ||
          x.message.toLowerCase().includes(q)
        );
      });
    }

    // sort
    const copy = [...out];
    copy.sort((a, b) => {
      if (sort === 'NEWEST')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'OLDEST')
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

      // WORST FIRST:
      const ra = exceptionRank(a.exceptionType);
      const rb = exceptionRank(b.exceptionType);
      if (rb !== ra) return rb - ra;

      // more hours since scan = worse (null treated as huge if tracking exists)
      const ha = typeof a.hoursSinceLastScan === 'number' ? a.hoursSinceLastScan : 9999;
      const hb = typeof b.hoursSinceLastScan === 'number' ? b.hoursSinceLastScan : 9999;
      if (hb !== ha) return hb - ha;

      // older order = worse
      return b.ageDays - a.ageDays;
    });

    return copy;
  }, [items, filter, query, sort]);

  async function recheck(shipmentId: string) {
    setRechecking((m) => ({ ...m, [shipmentId]: true }));
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}/recheck`, {
        method: 'POST',
        cache: 'no-store'
      });

      if (res.status === 429) {
        const j = (await res.json().catch(() => null)) as { retryAfterSec?: number } | null;
        const retry = j?.retryAfterSec ?? 60;
        toast.info(`Recheck rate-limited. Try again in ~${retry}s.`);
        return;
      }

      if (!res.ok) {
        toast.error(`Recheck failed (${res.status}).`);
        return;
      }

      await load();
    } finally {
      setRechecking((m) => ({ ...m, [shipmentId]: false }));
    }
  }

  async function toggleResolve(x: Item) {
    setResolving((m) => ({ ...m, [x.orderId]: true }));
    try {
      const note = (notes[x.orderId] ?? '').trim();

      const res = await fetch(`/api/admin/orders/${x.orderId}/exceptions/resolve`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: x.isResolved ? 'unresolve' : 'resolve',
          exceptionType: x.exceptionType,
          note
        })
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(j?.error ?? `Could not ${x.isResolved ? 'unresolve' : 'resolve'} (${res.status}).`);
        return;
      }

      setNotes((m) => ({ ...m, [x.orderId]: '' }));
      await load();
    } finally {
      setResolving((m) => ({ ...m, [x.orderId]: false }));
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.h1}>Delivery problems</h1>
          <p className={styles.sub}>Paid orders that need attention (labels, tracking, delays).</p>
        </div>

        <div className={styles.controls}>
          <label className={styles.inputLabel}>
            Search
            <input
              className={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email, order #, tracking, text…"
            />
          </label>

          <label className={styles.selectLabel}>
            Filter
            <select
              className={styles.select}
              value={filter}
              onChange={(e) => setFilter(e.target.value as ExceptionType | 'ALL')}
            >
              <option value="ALL">All</option>
              <option value="NEEDS_LABEL">No label bought yet</option>
              <option value="LABEL_PENDING">Waiting for label</option>
              <option value="NO_TRACKING_EVENTS">No tracking updates yet</option>
              <option value="NO_SCAN_24H">Not scanned in 24 hours</option>
              <option value="IN_TRANSIT_LONG">Taking longer than usual</option>
              <option value="STALE_ORDER">Sitting unshipped too long</option>
            </select>
          </label>

          <label className={styles.selectLabel}>
            Sort
            <select
              className={styles.select}
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="WORST">Worst first</option>
              <option value="NEWEST">Newest</option>
              <option value="OLDEST">Oldest</option>
            </select>
          </label>

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            Show resolved
          </label>

          <button type="button" className={styles.refreshBtn} onClick={load}>
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelTop}>
          <div className={styles.count}>
            {loading
              ? 'Loading…'
              : `${filtered.length} exception${filtered.length === 1 ? '' : 's'}`}
          </div>
          <div className={styles.hint}>Auto-refreshes every 60 seconds.</div>
        </div>

        {loading ? (
          <div className={styles.empty}>Fetching exceptions…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No exceptions 🎉</div>
        ) : (
          <ul className={styles.list}>
            {filtered.map((x) => {
              const tracking = x.trackingNumber ?? x.waybill;
              const sev = scanSeverity(x.hoursSinceLastScan);

              return (
                <li
                  key={x.orderId}
                  className={styles.row}
                  data-resolved={x.isResolved ? 'true' : 'false'}
                >
                  <div className={styles.left}>
                    <div className={styles.rowTop}>
                      <div className={styles.badges}>
                        <span className={styles.badge} data-kind={x.exceptionType}>
                          {exceptionTypeLabel(x.exceptionType)}
                        </span>

                        {x.isResolved ? (
                          <span
                            className={styles.resolvedBadge}
                            title={x.resolvedAt ? `Resolved at ${x.resolvedAt}` : ''}
                          >
                            Resolved
                          </span>
                        ) : null}
                      </div>

                      <div className={styles.rowActions}>
                        {x.shipmentId ? (
                          <button
                            type="button"
                            className={styles.recheckBtn}
                            onClick={() => recheck(x.shipmentId!)}
                            disabled={rechecking[x.shipmentId] === true}
                            title="Fetch latest tracking from APC and store it"
                          >
                            {rechecking[x.shipmentId] ? 'Rechecking…' : 'Recheck tracking'}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className={x.isResolved ? styles.unresolveBtn : styles.resolveBtn}
                          onClick={() => toggleResolve(x)}
                          disabled={resolving[x.orderId] === true}
                          title="Mark this exception resolved (adds tag + writes activity note)"
                        >
                          {resolving[x.orderId]
                            ? 'Saving…'
                            : x.isResolved
                              ? 'Unresolve'
                              : 'Resolve'}
                        </button>

                        <Link className={styles.orderLink} href={`/admin/orders/${x.orderId}`}>
                          View order →
                        </Link>
                      </div>
                    </div>

                    <div className={styles.mainLine}>
                      <span className={styles.orderId}>#{x.displayId}</span>
                      <span className={styles.dot}>•</span>
                      <span className={styles.customer}>{x.contactEmail}</span>
                      <span className={styles.dot}>•</span>
                      <span className={styles.total}>{formatGBP(x.grandTotal)}</span>
                    </div>

                    <div className={styles.msg}>{x.message}</div>

                    {/* ✅ note input */}
                    <div className={styles.noteRow}>
                      <input
                        className={styles.noteInput}
                        value={notes[x.orderId] ?? ''}
                        onChange={(e) => setNotes((m) => ({ ...m, [x.orderId]: e.target.value }))}
                        placeholder="Optional note (e.g. Called APC / customer confirmed address)…"
                      />
                      <span className={styles.noteHint}>
                        Saved into OrderActivity when you Resolve/Unresolve.
                      </span>
                    </div>

                    <div className={styles.meta}>
                      <span>Age: {x.ageDays}d</span>
                      {tracking ? <span>Tracking: {tracking}</span> : null}
                      {x.shipmentStatus ? <span>Status: {x.shipmentStatus}</span> : null}
                      {x.labelUrl ? <span>Label: saved</span> : null}

                      {/* ✅ Scan pill */}
                      {typeof x.hoursSinceLastScan === 'number' ? (
                        <span className={styles.scanPill} data-sev={sev ?? undefined}>
                          {x.hoursSinceLastScan}h since scan
                        </span>
                      ) : tracking ? (
                        <span className={styles.scanPill} data-sev="bad">
                          No scan yet
                        </span>
                      ) : null}

                      {/* ✅ Last scan time */}
                      {x.lastScanAt ? (
                        <span className={styles.scanAt}>
                          Last scan: {new Date(x.lastScanAt).toLocaleString('en-GB')}
                        </span>
                      ) : null}

                      {x.isResolved && x.resolvedAt ? (
                        <span className={styles.resolvedAt}>
                          Resolved at: {new Date(x.resolvedAt).toLocaleString('en-GB')}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
