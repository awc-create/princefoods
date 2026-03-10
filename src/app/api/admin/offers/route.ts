import { createOffer, getOffers } from '@/lib/offers-store';
import { requireAdmin } from '@/lib/route-ctx';
import type { OfferAdminForm } from '@/types/offers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authFail(e: unknown) {
  const msg = e instanceof Error ? e.message : 'UNAUTHENTICATED';
  const status = msg === 'FORBIDDEN' ? 403 : 401;
  return NextResponse.json({ error: msg }, { status });
}

function isIsoDateString(x: unknown): x is string {
  if (typeof x !== 'string') return false;
  const t = new Date(x).getTime();
  return Number.isFinite(t);
}

function normStr(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t ? t : null;
}

function toIsoOrNull(x: unknown): string | null {
  if (!x) return null;
  if (!isIsoDateString(x)) return null;
  return new Date(x).toISOString();
}

function clampBool(x: unknown): boolean {
  return x === true;
}

function asRecord(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) {
    throw new Error('INVALID_JSON');
  }
  return x as Record<string, unknown>;
}

/**
 * Ensures banner/email fields are consistent before saving.
 * Also strips UI-only blast fields so they do not get persisted on the offer itself.
 *
 * Rules:
 * - if bannerEnabled=false => all banner fields null
 * - if emailEnabled=false => emailSubject/emailMessage null
 * - validates required fields when enabled
 * - removes blastEnabled / blastScope / blastUserIds
 */
function normalizeAndValidateOfferBody(raw: unknown): OfferAdminForm {
  const obj = asRecord(raw);

  const name = normStr(obj.name);
  if (!name) {
    throw new Error('Offer name is required.');
  }

  if (!obj.payload || typeof obj.payload !== 'object') {
    throw new Error('Offer payload is required.');
  }

  // banner
  const bannerEnabled = clampBool(obj.bannerEnabled);
  const bannerTitle = bannerEnabled ? normStr(obj.bannerTitle) : null;
  const bannerMessage = bannerEnabled ? normStr(obj.bannerMessage) : null;
  const bannerCtaLabel = bannerEnabled ? normStr(obj.bannerCtaLabel) : null;
  const bannerCtaHref = bannerEnabled ? normStr(obj.bannerCtaHref) : null;
  const bannerStartsAt = bannerEnabled ? toIsoOrNull(obj.bannerStartsAt) : null;
  const bannerEndsAt = bannerEnabled ? toIsoOrNull(obj.bannerEndsAt) : null;

  if (bannerEnabled) {
    if (!bannerTitle) {
      throw new Error('Banner title is required when banner is enabled.');
    }

    if (bannerStartsAt && bannerEndsAt) {
      const s = new Date(bannerStartsAt).getTime();
      const e = new Date(bannerEndsAt).getTime();

      if (Number.isFinite(s) && Number.isFinite(e) && e < s) {
        throw new Error('bannerEndsAt must be after bannerStartsAt.');
      }
    }
  }

  // stored email template fields (not the blast queue itself)
  const emailEnabled = clampBool(obj.emailEnabled);
  const emailSubject = emailEnabled ? normStr(obj.emailSubject) : null;
  const emailMessage = emailEnabled ? normStr(obj.emailMessage) : null;

  if (emailEnabled && !emailSubject) {
    throw new Error('Email subject is required when email is enabled.');
  }

  // Strip UI-only blast fields so they are NOT persisted with the offer
  const {
    blastEnabled: _blastEnabled,
    blastScope: _blastScope,
    blastUserIds: _blastUserIds,
    ...rest
  } = obj;

  return {
    ...(rest as unknown as OfferAdminForm),

    name,

    bannerEnabled,
    bannerTitle,
    bannerMessage,
    bannerCtaLabel,
    bannerCtaHref,
    bannerStartsAt,
    bannerEndsAt,

    emailEnabled,
    emailSubject,
    emailMessage
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const offers = await getOffers();
    return NextResponse.json({ offers });
  } catch (e) {
    return authFail(e);
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const raw = (await req.json().catch(() => null)) as unknown;
    const body = normalizeAndValidateOfferBody(raw);

    const offer = await createOffer(body);

    return NextResponse.json({ offer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'BAD_REQUEST';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
