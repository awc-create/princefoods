import { readJsonOrText } from '@/lib/http/response-body';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApcEnv = 'training' | 'live';

// ✅ rate limit: block if shipment updated recently
const RECHECK_COOLDOWN_MS = Number(process.env.SHIPMENT_RECHECK_COOLDOWN_MS ?? 60_000);

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

/**
 * Convert ANY value into Prisma InputJsonValue:
 * - removes undefined keys
 * - converts non-JSON types to strings
 * - guards circular refs
 * - ensures top-level is never null
 */
function toPrismaInputJsonValue(input: unknown): Prisma.InputJsonValue {
  const seen = new WeakSet<object>();

  const walk = (v: unknown): Prisma.InputJsonValue => {
    if (v === undefined) return {};
    if (v === null) return {};

    const t = typeof v;

    if (t === 'string' || t === 'number' || t === 'boolean') return v;

    if (t === 'bigint') return v.toString();
    if (t === 'symbol') return String(v);
    if (t === 'function') return String(v);

    if (v instanceof Date) return v.toISOString();

    if (Array.isArray(v)) {
      return v.map((x) => walk(x)) as unknown as Prisma.InputJsonValue;
    }

    if (t === 'object') {
      const obj = v as Record<string, unknown>;

      if (seen.has(obj)) return '[Circular]';
      seen.add(obj);

      const out: Record<string, Prisma.InputJsonValue> = {};
      for (const [k, val] of Object.entries(obj)) {
        if (val === undefined) continue;
        // allow nested nulls (prisma will accept inside JSON)
        out[k] = (val === null ? (null as unknown) : walk(val)) as Prisma.InputJsonValue;
      }
      return out as unknown as Prisma.InputJsonValue;
    }

    return String(v);
  };

  const out = walk(input);
  return (out ?? {}) as Prisma.InputJsonValue;
}

/**
 * Best-effort flatten of strings from unknown trackingEvents shapes,
 * and best-effort date extraction.
 */
function flattenTracking(trackingEvents: unknown): {
  textBlob: string;
  lastEventAt: Date | null;
} {
  const strings: string[] = [];
  const dates: Date[] = [];
  const seen = new WeakSet<object>();

  const tryDate = (v: unknown) => {
    if (typeof v === 'string') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    } else if (typeof v === 'number') {
      const ms = v < 2_000_000_000 ? v * 1000 : v;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    }
  };

  const visit = (node: unknown, depth = 0) => {
    if (depth > 7) return;
    if (node === null || node === undefined) return;

    if (typeof node === 'string') {
      strings.push(node);
      tryDate(node);
      return;
    }

    if (typeof node === 'number') {
      tryDate(node);
      return;
    }

    if (Array.isArray(node)) {
      for (const it of node) visit(it, depth + 1);
      return;
    }

    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (seen.has(obj)) return;
      seen.add(obj);

      for (const [k, v] of Object.entries(obj)) {
        const lk = k.toLowerCase();

        if (
          lk.includes('status') ||
          lk.includes('event') ||
          lk.includes('message') ||
          lk.includes('description') ||
          lk.includes('detail')
        ) {
          if (typeof v === 'string') strings.push(v);
        }

        if (lk.includes('time') || lk.includes('date') || lk.includes('at')) {
          tryDate(v);
        }

        visit(v, depth + 1);
      }
    }
  };

  visit(trackingEvents);

  dates.sort((a, b) => a.getTime() - b.getTime());
  const lastEventAt = dates.length ? dates[dates.length - 1] : null;

  return { textBlob: strings.join(' • '), lastEventAt };
}

type DeliveryIssueType =
  | 'DELIVERY_FAILED'
  | 'RETURN_TO_DEPOT'
  | 'RETURN_TO_SENDER'
  | 'LOST'
  | 'DAMAGED'
  | 'UNKNOWN';

/**
 * Map text signals → DeliveryIssueType.
 * Keep conservative; if unsure return UNKNOWN.
 */
function detectIssueType(textBlob: string): { issueType: DeliveryIssueType; evidence: string } {
  const t = textBlob.toLowerCase();
  const has = (s: string) => t.includes(s);

  if (has('return to sender') || has('returned to sender') || has('rts')) {
    return { issueType: 'RETURN_TO_SENDER', evidence: 'Matched RTS text' };
  }
  if (has('return to depot') || has('returned to depot') || has('held at depot') || has('depot')) {
    return { issueType: 'RETURN_TO_DEPOT', evidence: 'Matched depot/return text' };
  }
  if (
    has('delivery failed') ||
    has('failed delivery') ||
    has('recipient not home') ||
    has('not delivered') ||
    has('refused')
  ) {
    return { issueType: 'DELIVERY_FAILED', evidence: 'Matched delivery failed text' };
  }
  if (has('lost') || has('missing')) {
    return { issueType: 'LOST', evidence: 'Matched lost/missing text' };
  }
  if (has('damaged') || has('damage')) {
    return { issueType: 'DAMAGED', evidence: 'Matched damaged text' };
  }

  return { issueType: 'UNKNOWN', evidence: 'No confident match' };
}

/**
 * Upsert ReturnCase for an order based on tracking signals.
 * Uses your NEW schema:
 * - status: OPEN|RECEIVED|RESOLVED
 * - issueType: DeliveryIssueType
 * - shipmentId: Shipment FK
 * - meta: JSON
 *
 * IMPORTANT:
 * - If case is already RESOLVED, we do not overwrite it.
 */
async function upsertReturnCaseFromTracking(args: {
  orderId: string;
  shipmentId: string;
  trackingEvents: unknown;
}) {
  const { textBlob, lastEventAt } = flattenTracking(args.trackingEvents);
  const detected = detectIssueType(textBlob);

  // only create/open cases when we detect something meaningful (not UNKNOWN)
  if (detected.issueType === 'UNKNOWN') return;

  const meta = toPrismaInputJsonValue({
    evidence: detected.evidence,
    snippet: textBlob.slice(0, 500),
    lastEventAt: lastEventAt ? lastEventAt.toISOString() : null
  });

  const existing = await prisma.returnCase.findUnique({
    where: { orderId: args.orderId },
    select: { id: true, status: true, issueType: true }
  });

  if (existing?.status === 'RESOLVED') return;

  const now = new Date();

  const rc = await prisma.returnCase.upsert({
    where: { orderId: args.orderId }, // UNIQUE in your migration
    create: {
      orderId: args.orderId,
      shipmentId: args.shipmentId,
      status: 'OPEN',
      issueType: detected.issueType,
      detectedAt: now,
      lastEventAt: lastEventAt ?? null,
      meta
    },
    update: {
      shipmentId: args.shipmentId,
      status: existing?.status ?? 'OPEN', // keep RECEIVED if already received
      issueType: detected.issueType,
      lastEventAt: lastEventAt ?? undefined,
      meta
    }
  });

  // activity (only log open the first time or if it changed from not-open)
  if (!existing) {
    await prisma.orderActivity.create({
      data: {
        orderId: args.orderId,
        type: 'RETURN_OPENED',
        note: `Return case opened: ${detected.issueType}`,
        meta: toPrismaInputJsonValue({ returnCaseId: rc.id, shipmentId: args.shipmentId })
      }
    });
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id: shipmentId } = await ctx.params;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      orderId: true,
      carrier: true,
      waybill: true,
      trackingNumber: true,
      status: true,
      updatedAt: true
    }
  });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: 'Shipment not found' }, { status: 404 });
  }

  // ✅ cooldown rate limit (uses updatedAt as cheap shared state)
  const ageMs = Date.now() - shipment.updatedAt.getTime();
  if (ageMs < RECHECK_COOLDOWN_MS) {
    const retryAfterMs = RECHECK_COOLDOWN_MS - ageMs;
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return NextResponse.json(
      { ok: false, error: 'Recheck rate-limited', retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  const carrierWaybill = shipment.trackingNumber ?? shipment.waybill;

  if (!carrierWaybill) {
    return NextResponse.json(
      { ok: false, error: 'Shipment has no trackingNumber/waybill to recheck' },
      { status: 400 }
    );
  }

  const { env, baseUrl } = pickBaseUrl();

  const username = process.env.APC_USERNAME ?? '';
  const password = process.env.APC_PASSWORD ?? '';

  if (!baseUrl) {
    return NextResponse.json(
      { ok: false, error: 'Missing APC base URL (APC_TRAINING_BASE/APC_LIVE_BASE)', env },
      { status: 500 }
    );
  }

  if (!username || !password) {
    return NextResponse.json(
      { ok: false, error: 'Missing APC credentials (APC_USERNAME/APC_PASSWORD)', env },
      { status: 500 }
    );
  }

  const trackUrl =
    `${baseUrl}/Tracks/${encodeURIComponent(carrierWaybill)}.json` +
    `?searchtype=CarrierWaybill&history=yes`;

  try {
    const res = await fetch(trackUrl, {
      method: 'GET',
      headers: {
        'remote-user': basicAuthHeader(username, password),
        Accept: 'application/json'
      },
      cache: 'no-store'
    });

    const latencyMs = Date.now() - started;
    const httpStatus = res.status;

    const parsed = await readJsonOrText(res);

    const wrapped = toPrismaInputJsonValue({
      source: 'apc',
      environment: env,
      fetchedAt: new Date().toISOString(),
      latencyMs,
      httpStatus,
      request: { CarrierWaybill: carrierWaybill },
      response: parsed
    });

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        trackingEvents: wrapped,
        trackingNumber: shipment.trackingNumber ?? carrierWaybill
      }
    });

    // ✅ returns detection (new schema)
    await upsertReturnCaseFromTracking({
      orderId: shipment.orderId,
      shipmentId,
      trackingEvents: wrapped
    });

    return NextResponse.json({
      ok: res.ok,
      shipmentId,
      env,
      latencyMs,
      httpStatus
    });
  } catch (err) {
    const latencyMs = Date.now() - started;
    return NextResponse.json(
      {
        ok: false,
        shipmentId,
        env,
        latencyMs,
        error: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 200 }
    );
  }
}
