// src/lib/shipping/apc-client.ts
type ApcEnv = 'training' | 'live';

function mustGet(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function apcBaseUrl(): string {
  const env = (process.env.APC_ENV || 'training') as ApcEnv;
  const raw = env === 'live' ? mustGet('APC_LIVE_BASE') : mustGet('APC_TRAINING_BASE');

  // normalize: no trailing slash
  return raw.replace(/\/+$/, '');
}

export function apcAuthHeaders(): Record<string, string> {
  const user = mustGet('APC_USERNAME');
  const pass = mustGet('APC_PASSWORD');

  // remote-user: Basic <base64(email:password)>
  const token = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');

  return {
    'remote-user': `Basic ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

export async function apcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apcBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...apcAuthHeaders(),
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg =
      data?.Orders?.Messages?.Description ||
      data?.ServiceAvailability?.Messages?.Description ||
      data?.Messages?.Description ||
      `APC error ${res.status}`;

    throw new Error(msg);
  }

  return data as T;
}
