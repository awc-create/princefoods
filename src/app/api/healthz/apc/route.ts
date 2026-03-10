// src/app/api/healthz/apc/route.ts
import { NextResponse } from 'next/server';

type ApcHealthStatus = 'UP' | 'DEGRADED' | 'DOWN';

function pickBaseUrl() {
  const env = (process.env.APC_ENV ?? 'training').toLowerCase();
  const training = process.env.APC_TRAINING_BASE;
  const live = process.env.APC_LIVE_BASE;

  const base = env === 'live' ? live : training;

  return {
    env: env === 'live' ? 'live' : 'training',
    baseUrl: base?.replace(/\/$/, '') ?? null
  };
}

function basicAuthHeader(username: string, password: string) {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  // APC expects auth in `remote-user` header
  return `Basic ${token}`;
}

function ddmmyyyy(d: Date) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export async function GET() {
  const started = Date.now();

  const { env, baseUrl } = pickBaseUrl();

  const username = process.env.APC_USERNAME ?? '';
  const password = process.env.APC_PASSWORD ?? '';

  const collectionPostcode = process.env.WAREHOUSE_POSTCODE ?? 'UB8 2YF';

  // Fail fast if config missing (but still return JSON)
  if (!baseUrl) {
    return NextResponse.json(
      {
        ok: false,
        apc: {
          status: 'DOWN' as ApcHealthStatus,
          environment: env,
          error: 'Missing APC base URL (APC_TRAINING_BASE / APC_LIVE_BASE)'
        }
      },
      { status: 200 }
    );
  }

  if (!username || !password) {
    return NextResponse.json(
      {
        ok: false,
        apc: {
          status: 'DOWN' as ApcHealthStatus,
          environment: env,
          error: 'Missing APC credentials (APC_USERNAME / APC_PASSWORD)'
        }
      },
      { status: 200 }
    );
  }

  const url = `${baseUrl}/ServiceAvailability.json`;

  // Minimal valid payload for availability check
  const payload = {
    CollectionDate: ddmmyyyy(new Date()),
    ReadyAt: '09:00',
    CloseAt: '17:00',
    Collection: {
      PostalCode: collectionPostcode,
      CountryCode: 'GB'
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'remote-user': basicAuthHeader(username, password),
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const latencyMs = Date.now() - started;

    // If APC responds non-2xx, we reached them (so "DEGRADED")
    if (!res.ok) {
      const text = await res.text().catch(() => '');

      return NextResponse.json(
        {
          ok: false,
          apc: {
            status: 'DEGRADED' as ApcHealthStatus,
            environment: env,
            latencyMs,
            httpStatus: res.status,
            error: (text.slice(0, 500) ?? '') || `APC HTTP ${res.status}`
          }
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        apc: {
          status: 'UP' as ApcHealthStatus,
          environment: env,
          latencyMs
        }
      },
      { status: 200 }
    );
  } catch (err) {
    const latencyMs = Date.now() - started;

    return NextResponse.json(
      {
        ok: false,
        apc: {
          status: 'DOWN' as ApcHealthStatus,
          environment: env,
          latencyMs,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      },
      { status: 200 }
    );
  }
}
