'use client';

import React from 'react';

interface Resp {
  ok: boolean;
  apc: {
    status: 'UP' | 'DEGRADED' | 'DOWN';
    environment?: string;
    latencyMs?: number;
    httpStatus?: number;
    error?: string;
  };
}

export default function ApcHealthBadge() {
  const [data, setData] = React.useState<Resp | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch('/api/healthz/apc', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (alive) setData(j);
      })
      .catch(() => {
        if (alive) setData({ ok: false, apc: { status: 'DOWN', error: 'Fetch failed' } });
      });

    return () => {
      alive = false;
    };
  }, []);

  if (!data) return <div>APC: checking…</div>;

  const label =
    data.apc.status === 'UP'
      ? '✅ APC UP'
      : data.apc.status === 'DEGRADED'
        ? '⚠️ APC DEGRADED'
        : '❌ APC DOWN';

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <strong>{label}</strong>
      {typeof data.apc.latencyMs === 'number' && <span>{data.apc.latencyMs}ms</span>}
      {data.apc.environment && <span>({data.apc.environment})</span>}
      {data.apc.status !== 'UP' && data.apc.error && (
        <span style={{ opacity: 0.8 }}>— {data.apc.error}</span>
      )}
    </div>
  );
}
