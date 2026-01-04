// src/app/admin/returns/[id]/page.tsx
import { headers } from 'next/headers';
import ReturnDetailClient from './return-detail-client';

export const dynamic = 'force-dynamic';

function baseUrl(h: Awaited<ReturnType<typeof headers>>) {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env) return env;

  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function AdminReturnDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const h = await headers();
  const base = baseUrl(h);
  const { id } = await params;

  return (
    <main style={{ padding: 16, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 950, margin: 0 }}>Return case</h1>
          <p style={{ margin: '6px 0 0', opacity: 0.75, fontSize: 13 }}>
            Manage receive/decisions/reship/refund/resolve.
          </p>
        </div>

        <a
          href="/admin/returns"
          style={{
            alignSelf: 'flex-start',
            padding: '8px 12px',
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,.35)',
            textDecoration: 'none',
            fontWeight: 850
          }}
        >
          ← Back to returns
        </a>
      </div>

      <ReturnDetailClient baseUrl={base} id={id} />
    </main>
  );
}
