'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type * as RechartsType from 'recharts';

interface Daily {
  day: string;
  views: number;
  clicks: number;
  unitsSold: number;
  revenuePence: number;
}

interface Product {
  id: string;
  name: string;
  price: number | null;
  productImageUrl: string | null;
  views: number;
  clicks: number;
  unitsSold: number;
  revenuePence: number;
}

type Metric = 'views' | 'clicks' | 'unitsSold' | 'revenuePence';

function isMetric(v: string): v is Metric {
  return v === 'views' || v === 'clicks' || v === 'unitsSold' || v === 'revenuePence';
}

export default function ProductAnalyticsDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [daily, setDaily] = useState<Daily[]>([]);
  const [metric, setMetric] = useState<'views' | 'clicks' | 'unitsSold' | 'revenuePence'>('views');

  const R = useRef<typeof RechartsType | null>(null);
  const [hasCharts, setHasCharts] = useState(false);

  useEffect(() => {
    let mounted = true;
    import('recharts')
      .then((m) => {
        if (mounted) {
          R.current = m;
          setHasCharts(true);
        }
      })
      .catch(() => setHasCharts(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/analytics/products/${id}?days=90`, { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setProduct(data.product);
        setDaily(data.daily);
      }
      setLoading(false);
    })();
  }, [id]);

  const formatGBP = (pence: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);

  const ctr = useMemo(
    () => (product?.views ? (product.clicks / product.views) * 100 : 0),
    [product]
  );
  const conv = useMemo(
    () => (product?.views ? (product.unitsSold / product.views) * 100 : 0),
    [product]
  );
  const aov = useMemo(
    () => (product?.unitsSold ? product.revenuePence / product.unitsSold : 0),
    [product]
  );
  const revPerView = useMemo(
    () => (product?.views ? product.revenuePence / product.views : 0),
    [product]
  );

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!product) return <div style={{ padding: 24 }}>Product not found.</div>;

  return (
    <div style={{ padding: 24 }}>
      <button
        onClick={() => history.back()}
        style={{
          border: '1px solid #222',
          borderRadius: 8,
          padding: '6px 10px',
          background: 'transparent',
          marginBottom: 12
        }}
        type="button"
      >
        ← Back
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 72, height: 72 }}>
          <Image
            src={product.productImageUrl ?? '/assets/prince-foods-logo.png'}
            alt={product.name}
            fill
            sizes="72px"
            style={{ objectFit: 'contain' }}
          />
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{product.name}</h1>
          <div style={{ opacity: 0.6 }}>{product.id}</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
          gap: 12,
          marginTop: 16
        }}
      >
        <Tile label="Views" value={product.views} />
        <Tile label="Clicks" value={product.clicks} />
        <Tile label="CTR" value={`${ctr.toFixed(2)}%`} />
        <Tile label="Units" value={product.unitsSold} />
        <Tile label="Revenue" value={formatGBP(product.revenuePence)} />
        <Tile label="Conv" value={`${conv.toFixed(2)}%`} />
        <Tile label="AOV" value={formatGBP(aov)} />
        <Tile label="Rev/View" value={formatGBP(revPerView)} />
      </div>

      <div
        style={{
          marginTop: 24,
          border: '1px solid #222',
          borderRadius: 12,
          padding: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h3 style={{ margin: 0, flex: '0 0 auto' }}>Daily trend</h3>
          <label style={{ fontSize: 14 }}>
            Metric:&nbsp;
            <select
              value={metric}
              onChange={(e) => {
                const v = e.target.value;
                if (isMetric(v)) setMetric(v);
              }}
            >
              <option value="views">Views</option>
              <option value="clicks">Clicks</option>
              <option value="unitsSold">Units</option>
              <option value="revenuePence">Revenue</option>
            </select>
          </label>
        </div>

        {hasCharts ? (
          <Chart metric={metric} daily={daily} formatGBP={formatGBP} R={R} />
        ) : (
          <div style={{ opacity: 0.7, padding: 12 }}>Chart unavailable — showing table:</div>
        )}

        {!hasCharts && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={th}>Date</th>
                <th style={th}>Views</th>
                <th style={th}>Clicks</th>
                <th style={th}>Units</th>
                <th style={th}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.day} style={{ borderTop: '1px solid #222' }}>
                  <td style={td}>{d.day}</td>
                  <td style={td}>{d.views}</td>
                  <td style={td}>{d.clicks}</td>
                  <td style={td}>{d.unitsSold}</td>
                  <td style={td}>{formatGBP(d.revenuePence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ border: '1px solid #222', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Chart({
  metric,
  daily,
  formatGBP,
  R
}: {
  metric: 'views' | 'clicks' | 'unitsSold' | 'revenuePence';
  daily: Daily[];
  formatGBP: (p: number) => string;
  R: React.MutableRefObject<typeof RechartsType | null>;
}) {
  if (!R.current) return null;

  const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } =
    R.current;

  const data = daily.map((d) => ({
    date: d.day,
    views: d.views,
    clicks: d.clicks,
    units: d.unitsSold,
    revenue: d.revenuePence / 100
  }));

  const key =
    metric === 'views'
      ? 'views'
      : metric === 'clicks'
        ? 'clicks'
        : metric === 'unitsSold'
          ? 'units'
          : 'revenue';

  const yTickFmt = (v: number): string =>
    metric === 'revenuePence' ? formatGBP(Math.round(v * 100)) : String(v);

  return (
    <div style={{ height: 360 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={yTickFmt} />
          <Tooltip
            formatter={(val: number, _name: string) =>
              key === 'revenue' ? formatGBP(Math.round(val * 100)) : val
            }
          />
          <Legend />
          <Line type="monotone" dataKey={key} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 6px',
  borderBottom: '1px solid #333'
};
const td: React.CSSProperties = {
  padding: '8px 6px'
};
