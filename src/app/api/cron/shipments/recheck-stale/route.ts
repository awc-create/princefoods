// src/app/api/cron/shipments/recheck-stale/route.ts
import { readJsonOrText } from '@/lib/http/response-body';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApcEnv = 'training' | 'live';

const DEFAULT_LIMIT = 50; // max shipments per run
const DEFAULT_OLDER_THAN_MIN = 180; // only recheck if not updated for 3h
const CONCURRENCY = 8; // tune: 5–10 safe

function pickBaseUrl(): { env: ApcEnv; baseUrl: string | null } {
  const raw = (process.env.APC_ENV ?? 'training').toLowerCase();
  const env: ApcEnv = raw === 'live' ? 'live' : 'training';

  const training = process.env.APC_TRAINING_BASE ?? '';
  const live = process.env.APC_LIVE_BASE ?? '';

  const base = env === 'live' ? live : training;
  const baseUrl = base ? base.replace(/\/$/, '') : null;

  return { env, baseUrl };
}

function basicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, tries = 4) {
  let wait = 500;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status === 429 || res.status === 408 || res.status >= 500) {
        throw new Error(`HTTP_${res.status}`);
      }
      return res;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(wait);
      wait *= 2;
    }
  }
  throw new Error('unreachable');
}

/** Remove undefined keys, stringify odd types, prevent circular refs. */
function toSafeJson(input: unknown) {
  const seen = new WeakSet<object>();

  const walk = (v: unknown): unknown => {
    if (v === null) return null;
    if (v === undefined) return null;

    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') return v;
    if (t === 'bigint') return v.toString();
    if (t === 'symbol' || t === 'function') return String(v);

    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map((x) => walk(x));

    if (t === 'object') {
      const obj = v as Record<string, unknown>;
      if (seen.has(obj)) return '[Circular]';
      seen.add(obj);

      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(obj)) {
        if (val === undefined) continue;
        out[k] = walk(val);
      }
      return out;
    }

    return String(v);
  };

  return walk(input);
}

async function advisoryLock(key: number) {
  const rows = await prisma.$queryRawUnsafe<Array<{ ok: boolean }>>(
    `SELECT pg_try_advisory_lock(${key}) as ok`
  );
  return rows?.[0]?.ok === true;
}

async function advisoryUnlock(key: number) {
  await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${key})`);
}

async function promisePool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>
) {
  const results: R[] = [];
  let i = 0;

  const runners = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);

  const limit = Math.max(1, Math.min(DEFAULT_LIMIT, Number(url.searchParams.get('limit') ?? '50')));
  const olderThanMin = Math.max(
    5,
    Number(url.searchParams.get('olderThanMin') ?? String(DEFAULT_OLDER_THAN_MIN))
  );
  const dryRun = (url.searchParams.get('dryRun') ?? '0') === '1';

  // One-at-a-time runner across server instances
  const LOCK_KEY = 918273; // arbitrary constant
  const gotLock = await advisoryLock(LOCK_KEY);
  if (!gotLock) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'LOCKED_ALREADY_RUNNING' });
  }

  const startedAt = Date.now();

  try {
    const { env, baseUrl } = pickBaseUrl();
    const username = process.env.APC_USERNAME ?? '';
    const password = process.env.APC_PASSWORD ?? '';

    if (!baseUrl) {
      return NextResponse.json({ ok: false, error: 'Missing APC base URL', env }, { status: 500 });
    }
    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: 'Missing APC credentials', env },
        { status: 500 }
      );
    }

    const cutoff = new Date(Date.now() - olderThanMin * 60_000);

    // Adjust statuses if your Shipment.status values differ
    const candidates = await prisma.shipment.findMany({
      where: {
        updatedAt: { lt: cutoff },
        status: { in: ['SHIPPED', 'IN_TRANSIT'] }
      },
      take: limit,
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        orderId: true,
        carrier: true,
        waybill: true,
        trackingNumber: true
      }
    });

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        count: candidates.length,
        sample: candidates.slice(0, 5)
      });
    }

    const results = await promisePool(candidates, CONCURRENCY, async (s) => {
      const carrierWaybill = s.trackingNumber ?? s.waybill;
      if (!carrierWaybill) {
        return { shipmentId: s.id, ok: false, error: 'NO_TRACKING' };
      }

      const trackUrl =
        `${baseUrl}/Tracks/${encodeURIComponent(carrierWaybill)}.json` +
        `?searchtype=CarrierWaybill&history=yes`;

      const t0 = Date.now();

      try {
        const res = await fetchWithRetry(trackUrl, {
          method: 'GET',
          headers: {
            'remote-user': basicAuthHeader(username, password),
            Accept: 'application/json'
          },
          cache: 'no-store'
        });

        const httpStatus = res.status;

        const parsed = await readJsonOrText(res);

        const wrapped = toSafeJson({
          source: 'apc',
          environment: env,
          fetchedAt: new Date().toISOString(),
          latencyMs: Date.now() - t0,
          httpStatus,
          request: { CarrierWaybill: carrierWaybill },
          response: parsed
        });

        await prisma.shipment.update({
          where: { id: s.id },
          data: {
            // If your schema type is Json, Prisma accepts a plain JS object.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            trackingEvents: wrapped as any,
            trackingNumber: s.trackingNumber ?? carrierWaybill
          }
        });

        return { shipmentId: s.id, ok: res.ok, httpStatus };
      } catch (e) {
        return {
          shipmentId: s.id,
          ok: false,
          error: e instanceof Error ? e.message : 'UNKNOWN_ERROR'
        };
      }
    });

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;

    return NextResponse.json({
      ok: true,
      env: pickBaseUrl().env,
      processed: results.length,
      okCount,
      failCount,
      olderThanMin,
      limit,
      ms: Date.now() - startedAt,
      results
    });
  } finally {
    await advisoryUnlock(LOCK_KEY);
  }
}
