// src/app/admin/notifications/[id]/page.tsx
'use client';

import type { HomeSettingsDTO } from '@/types/homeSettings';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from '../../Admin.module.scss';

// ----- types returned by the API -----
interface BaseNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string; // ISO
  meta: unknown;
}

interface ApiOk<T> {
  ok: true;
  data: T;
}
interface ApiErr {
  ok: false;
  error: string;
}
type ApiResp<T> = ApiOk<T> | ApiErr;

// ----- meta shape we write in save/route.ts -----
interface HomeUpdateMeta {
  entity: 'homeSettings';
  prev: HomeSettingsDTO | null;
  next: HomeSettingsDTO;
  hash: string;
  source?: string;
}

function isHomeUpdateMeta(x: unknown): x is HomeUpdateMeta {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  return m.entity === 'homeSettings' && !!m.next;
}

// ---------- helpers ----------
interface Row {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

// safe key getter for unknown objects
function get(o: unknown, key: string): unknown {
  if (!o || typeof o !== 'object') return undefined;
  return (o as Record<string, unknown>)[key];
}

// build simple before/after rows for given keys
function makeRows(keys: string[], prevObj: unknown, nextObj: unknown): Row[] {
  return keys.map((k) => {
    const before = get(prevObj, k);
    const after = get(nextObj, k);
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    return { key: k, before, after, changed };
  });
}

const fmt = (v: unknown) =>
  v == null || v === ''
    ? '—'
    : typeof v === 'string'
      ? v
      : (() => {
          try {
            return JSON.stringify(v);
          } catch {
            return String(v);
          }
        })();

export default function NotificationDetailPage() {
  // ✅ Avoid params Promise warning
  const routeParams = useParams<{ id: string }>();
  const id = (routeParams?.id ?? '') as string;

  const [row, setRow] = useState<BaseNotification | null>(null);
  const [meta, setMeta] = useState<HomeUpdateMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);

  // load one notification
  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}`, {
          cache: 'no-store'
        });
        const j: ApiResp<BaseNotification> = await r.json();
        if (!alive) return;
        if (!j.ok) {
          setErr(j.error ?? 'NOT_FOUND');
          setLoading(false);
          return;
        }

        setRow(j.data);
        setMeta(isHomeUpdateMeta(j.data.meta) ? (j.data.meta as HomeUpdateMeta) : null);
        setLoading(false);

        // mark as read if not yet
        if (!j.data.readAt) {
          fetch(`/api/admin/notifications/${encodeURIComponent(id)}`, { method: 'PATCH' }).catch(
            () => {}
          );
        }
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : 'LOAD_FAILED');
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  // example: hero diff
  const heroDiff = useMemo(
    () =>
      makeRows(
        [
          'title',
          'subtitle',
          'floatingTag',
          'primaryCtaLabel',
          'primaryCtaHref',
          'secondaryCtaLabel',
          'secondaryCtaHref',
          'imageUrl'
        ],
        meta?.prev?.hero,
        meta?.next?.hero
      ),
    [meta]
  );

  const created = row ? new Date(row.createdAt).toLocaleString() : '';

  const onRevert = async () => {
    if (!meta?.prev) return;
    setReverting(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/notifications/${encodeURIComponent(id)}/revert`, {
        method: 'POST'
      });
      const j: ApiResp<unknown> = await r.json();
      if (!j.ok) throw new Error(j.error ?? 'REVERT_FAILED');
      // back to Site → Home after success
      window.location.assign('/admin/site/home');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'REVERT_FAILED');
      setReverting(false);
    }
  };

  if (!id) return <div style={{ padding: 16 }}>Invalid notification id.</div>;
  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ padding: 16, color: 'crimson' }}>Error: {err}</div>;
  if (!row) return <div style={{ padding: 16 }}>Not found.</div>;

  return (
    <div>
      <p>
        <Link href="/admin/notifications">← Back to notifications</Link>
      </p>

      <h1 style={{ margin: 0 }}>{row.title ?? 'Notification'}</h1>
      <div style={{ color: '#6b7280' }}>
        Kind: <strong>{row.kind}</strong> • Created: {created}
      </div>
      {row.body && <p style={{ marginTop: 8 }}>{row.body}</p>}

      {meta ? (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
            <strong>Home settings change</strong>
            <Link href="/admin/site/home" style={{ fontSize: 14 }}>
              Open page
            </Link>
          </div>

          {/* Hero table */}
          <h3 style={{ marginTop: 14 }}>Hero</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>
                  Field
                </th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>
                  Before
                </th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #eee' }}>
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              {heroDiff.map((r) => (
                <tr key={r.key} style={{ background: r.changed ? '#fff7f7' : 'transparent' }}>
                  <td style={{ padding: 8, width: 180, fontWeight: 700 }}>{r.key}</td>
                  <td style={{ padding: 8 }}>{fmt(r.before)}</td>
                  <td style={{ padding: 8 }}>{fmt(r.after)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onRevert}
              disabled={!meta.prev || reverting}
              className={styles.pill}
              style={{ background: '#ef4444', color: '#fff', border: 0 }}
              title={!meta.prev ? 'No previous snapshot' : 'Revert to previous'}
            >
              {reverting ? 'Reverting…' : 'Revert to previous'}
            </button>
            <a href="/admin/site/home" className={styles.pill} style={{ textDecoration: 'none' }}>
              Open page
            </a>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12, color: '#6b7280' }}>
          No detailed diff available for this notification type.
        </div>
      )}
    </div>
  );
}
