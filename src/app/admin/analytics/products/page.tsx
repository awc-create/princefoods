// src/app/admin/analytics/products/page.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link'; // ⬅ add (used for accessibility on the image/name)
import { useRouter } from 'next/navigation'; // ⬅ add
import { useEffect, useMemo, useState } from 'react';

type Dir = 'asc' | 'desc';
type Sort =
  | 'views'
  | 'clicks'
  | 'units'
  | 'revenue'
  | 'ctr'
  | 'conv'
  | 'aov'
  | 'rev_per_view'
  | 'price'
  | 'name';

interface Item {
  id: string;
  name: string;
  price: number | null;
  productImageUrl: string | null;
  views: number;
  clicks: number;
  unitsSold: number;
  revenuePence: number;
  ctr: number;
  conv: number;
  aov: number;
  revPerView: number;
}

interface Daily {
  day: string;
  views: number;
  clicks: number;
  unitsSold: number;
  revenuePence: number;
}

interface ApiResp {
  ok: boolean;
  meta: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
    sort: string;
    dir: Dir;
    from: string;
    to: string;
  };
  totals: { views: number; clicks: number; unitsSold: number; revenuePence: number };
  daily: Daily[];
  items: Item[];
}

export default function ProductsAnalyticsPage() {
  const router = useRouter(); // ⬅ add
  const [q, setQ] = useState('');
  const [days, setDays] = useState(30);
  const [sort, setSort] = useState<Sort>('units');
  const [dir, setDir] = useState<Dir>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const [items, setItems] = useState<Item[]>([]);
  const [totals, setTotals] = useState<ApiResp['totals'] | null>(null);
  const [_daily, setDaily] = useState<Daily[]>([]);
  const [meta, setMeta] = useState<ApiResp['meta'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          q,
          days: String(days),
          sort,
          dir,
          page: String(page),
          limit: String(limit)
        }).toString();
        const res = await fetch(`/api/admin/analytics/products?${qs}`, { cache: 'no-store' });
        const j: ApiResp = await res.json();
        if (cancelled) return;
        if (j && j.ok) {
          setItems(j.items);
          setTotals(j.totals);
          setDaily(j.daily);
          setMeta(j.meta);
        } else {
          setItems([]);
          setTotals({ views: 0, clicks: 0, unitsSold: 0, revenuePence: 0 });
          setDaily([]);
          setMeta(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [q, days, sort, dir, page, limit]);

  const formatGBP = (pence: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
      (pence ?? 0) / 100
    );

  const totalsStrip = useMemo(
    () => (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 16
        }}
      >
        <Card label="Views" value={totals?.views ?? 0} />
        <Card label="Clicks" value={totals?.clicks ?? 0} />
        <Card label="Units" value={totals?.unitsSold ?? 0} />
        <Card label="Revenue" value={formatGBP(totals?.revenuePence ?? 0)} />
      </div>
    ),
    [totals]
  );

  const downloadCSV = () => {
    const header = [
      'id',
      'name',
      'price',
      'views',
      'clicks',
      'ctr',
      'units',
      'revenuePence',
      'revenueGBP',
      'conv',
      'aovGBP',
      'revPerViewGBP'
    ];
    const rows = items.map((r) => [
      r.id,
      r.name.replace(/"/g, '""'),
      r.price ?? '',
      r.views,
      r.clicks,
      r.ctr.toFixed(4),
      r.unitsSold,
      r.revenuePence,
      (r.revenuePence / 100).toFixed(2),
      r.conv.toFixed(4),
      (r.aov / 100).toFixed(2),
      (r.revPerView / 100).toFixed(4)
    ]);
    const csv =
      header.join(',') +
      '\n' +
      rows
        .map((r) =>
          r.map((c) => (typeof c === 'string' && c.includes(',') ? `"${c}"` : String(c))).join(',')
        )
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product-analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 12 }}>Product Analytics</h1>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <input
          placeholder="Search name or SKU"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          style={{ padding: '6px 8px', minWidth: 220 }}
        />
        <label>
          Range:&nbsp;
          <select
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
        <label>
          Sort:&nbsp;
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as Sort);
              setPage(1);
            }}
          >
            <option value="units">Units sold</option>
            <option value="revenue">Revenue</option>
            <option value="clicks">Clicks</option>
            <option value="views">Views</option>
            <option value="ctr">CTR</option>
            <option value="conv">Conversion (units/views)</option>
            <option value="aov">AOV (rev/units)</option>
            <option value="rev_per_view">Rev / View</option>
            <option value="price">Price</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label>
          Order:&nbsp;
          <select value={dir} onChange={(e) => setDir(e.target.value as Dir)}>
            <option value="desc">High to low</option>
            <option value="asc">Low to high</option>
          </select>
        </label>
        <button onClick={downloadCSV} type="button">
          Export CSV
        </button>
      </div>

      {totalsStrip}

      {/* Table */}
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Price</th>
              <th style={th}>Views</th>
              <th style={th}>Clicks</th>
              <th style={th}>CTR</th>
              <th style={th}>Units</th>
              <th style={th}>Revenue</th>
              <th style={th}>Conv</th>
              <th style={th}>AOV</th>
              <th style={th}>Rev/View</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ padding: 16, opacity: 0.7 }}>
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 16, opacity: 0.7 }}>
                  No data
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderTop: '1px solid #222',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease-in-out'
                  }}
                  onClick={() => router.push(`/admin/analytics/products/${r.id}`)} // ⬅ navigate
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') router.push(`/admin/analytics/products/${r.id}`);
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open analytics for ${r.name}`}
                >
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{ position: 'relative', width: 48, height: 48, flex: '0 0 auto' }}
                      >
                        <Image
                          src={r.productImageUrl ?? '/assets/prince-foods-logo.png'}
                          alt={r.name}
                          fill
                          sizes="48px"
                          style={{ objectFit: 'contain' }}
                        />
                      </div>
                      <div>
                        {/* Provide an explicit link for accessibility without nesting <a> inside <a> */}
                        <div style={{ fontWeight: 600 }}>
                          <Link
                            href={`/admin/analytics/products/${r.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                          >
                            {r.name}
                          </Link>
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{r.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={td}>{r.price != null ? formatGBP(Math.round(r.price * 100)) : '—'}</td>
                  <td style={td}>{r.views}</td>
                  <td style={td}>{r.clicks}</td>
                  <td style={td}>{r.ctr.toFixed(3)}</td>
                  <td style={td}>{r.unitsSold}</td>
                  <td style={td}>{formatGBP(r.revenuePence)}</td>
                  <td style={td}>{r.conv.toFixed(3)}</td>
                  <td style={td}>{formatGBP(r.aov)}</td>
                  <td style={td}>{formatGBP(r.revPerView)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && meta.pageCount > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <div style={{ padding: '6px 10px' }}>
            Page {meta.page} / {meta.pageCount}
          </div>
          <button
            type="button"
            disabled={page >= meta.pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid #222', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  fontWeight: 600,
  borderBottom: '1px solid #333',
  whiteSpace: 'nowrap'
};
const td: React.CSSProperties = {
  padding: '10px 8px',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap'
};
