import { headers } from 'next/headers';
import ReturnsClient from './returns-client';

export const dynamic = 'force-dynamic';

function baseUrl(h: Awaited<ReturnType<typeof headers>>) {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (env) return env;

  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function AdminReturnsPage() {
  const h = await headers();
  const base = baseUrl(h);

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 12px' }}>Return cases</h1>
      <ReturnsClient baseUrl={base} />
    </main>
  );
}
