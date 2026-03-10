// src/lib/offers-store.ts
import { prisma } from '@/lib/prisma';
import type { OfferAdminForm, OfferPayload } from '@/types/offers';
import type { Prisma } from '@prisma/client';
import { OfferStatus, OfferVisibility } from '@prisma/client';

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

function toIso(v: Date | null | undefined): string | null {
  return v ? v.toISOString() : null;
}

function parseIso(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function asPayload(v: unknown): OfferPayload | null {
  if (!v || typeof v !== 'object') return null;
  const obj = v as { kind?: unknown; data?: unknown };
  if (typeof obj.kind !== 'string') return null;
  if (obj.data === undefined) return null;
  return v as OfferPayload;
}

function normStr(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
}

/**
 * Prisma enum(s) are the source of truth:
 * - OfferStatus: ACTIVE | PAUSED | EXPIRED
 * - OfferVisibility: ALL | BADGE_ONLY | PRODUCT_PAGE | CART_ONLY
 */

/** UI → Prisma */
function toPrismaStatus(s: OfferAdminForm['status']): OfferStatus {
  // Prisma doesn't have DRAFT → store as PAUSED (safe)
  if (s === 'ACTIVE') return OfferStatus.ACTIVE;
  if (s === 'PAUSED') return OfferStatus.PAUSED;
  // DRAFT
  return OfferStatus.PAUSED;
}

function toPrismaVisibility(v: OfferAdminForm['visibility']): OfferVisibility {
  if (v === 'BADGE_ONLY') return OfferVisibility.BADGE_ONLY;
  if (v === 'PRODUCT_PAGE') return OfferVisibility.PRODUCT_PAGE;
  if (v === 'CART_ONLY') return OfferVisibility.CART_ONLY;
  return OfferVisibility.ALL;
}

/** Prisma → UI */
function fromPrismaStatus(s: OfferStatus): OfferAdminForm['status'] {
  if (s === OfferStatus.ACTIVE) return 'ACTIVE';
  if (s === OfferStatus.PAUSED) return 'PAUSED';
  // EXPIRED: show as PAUSED in admin (or add 'EXPIRED' to UI later)
  return 'PAUSED';
}

function fromPrismaVisibility(v: OfferVisibility): OfferAdminForm['visibility'] {
  if (v === OfferVisibility.BADGE_ONLY) return 'BADGE_ONLY';
  if (v === OfferVisibility.PRODUCT_PAGE) return 'PRODUCT_PAGE';
  if (v === OfferVisibility.CART_ONLY) return 'CART_ONLY';
  return 'ALL';
}

interface OfferRowSelected {
  id: string;
  name: string;
  mode: string;
  code: string | null;
  status: OfferStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  stackingMode: string;
  priority: number;
  maxDiscountPerOrderPence: number | null;
  preventFreeOrder: boolean;
  visibility: OfferVisibility;
  exclusions: unknown;
  payload: unknown;

  bannerEnabled: boolean;
  bannerTitle: string | null;
  bannerMessage: string | null;
  bannerCtaLabel: string | null;
  bannerCtaHref: string | null;
  bannerStartsAt: Date | null;
  bannerEndsAt: Date | null;

  emailEnabled: boolean;
  emailSubject: string | null;
  emailMessage: string | null;
}

const offerSelect = {
  id: true,
  name: true,
  mode: true,
  code: true,
  status: true,
  startsAt: true,
  endsAt: true,
  stackingMode: true,
  priority: true,
  maxDiscountPerOrderPence: true,
  preventFreeOrder: true,
  visibility: true,
  exclusions: true,
  payload: true,

  bannerEnabled: true,
  bannerTitle: true,
  bannerMessage: true,
  bannerCtaLabel: true,
  bannerCtaHref: true,
  bannerStartsAt: true,
  bannerEndsAt: true,

  emailEnabled: true,
  emailSubject: true,
  emailMessage: true
} satisfies Prisma.OfferSelect;

export function rowToAdminForm(row: OfferRowSelected): OfferAdminForm {
  const payload = asPayload(row.payload);
  if (!payload) throw new Error(`BAD_OFFER_PAYLOAD:${row.id}`);

  return {
    id: row.id,
    name: row.name,

    mode: row.mode as OfferAdminForm['mode'],
    code: row.code,

    status: fromPrismaStatus(row.status),
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),

    stackingMode: row.stackingMode as OfferAdminForm['stackingMode'],
    priority: row.priority,

    maxDiscountPerOrderPence: row.maxDiscountPerOrderPence,
    preventFreeOrder: Boolean(row.preventFreeOrder),

    visibility: fromPrismaVisibility(row.visibility),

    exclusions: asObject(row.exclusions) ?? {},
    payload,

    bannerEnabled: Boolean(row.bannerEnabled),
    bannerTitle: row.bannerTitle ?? null,
    bannerMessage: row.bannerMessage ?? null,
    bannerCtaLabel: row.bannerCtaLabel ?? null,
    bannerCtaHref: row.bannerCtaHref ?? null,
    bannerStartsAt: toIso(row.bannerStartsAt),
    bannerEndsAt: toIso(row.bannerEndsAt),

    emailEnabled: Boolean(row.emailEnabled),
    emailSubject: row.emailSubject ?? null,
    emailMessage: row.emailMessage ?? null
  };
}

export async function getOffers(): Promise<OfferAdminForm[]> {
  const rows = await prisma.offer.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    select: offerSelect
  });

  const out: OfferAdminForm[] = [];
  for (const r of rows) {
    try {
      out.push(
        rowToAdminForm({
          ...(r as OfferRowSelected),
          exclusions: r.exclusions ?? {},
          payload: r.payload
        })
      );
    } catch {
      // skip broken row
    }
  }
  return out;
}

export async function getOfferById(id: string): Promise<OfferAdminForm | null> {
  const row = await prisma.offer.findUnique({
    where: { id },
    select: offerSelect
  });

  if (!row) return null;

  return rowToAdminForm({
    ...(row as OfferRowSelected),
    exclusions: row.exclusions ?? {},
    payload: row.payload
  });
}

export async function createOffer(body: OfferAdminForm): Promise<OfferAdminForm> {
  if (!body?.name?.trim()) throw new Error('NAME_REQUIRED');
  if (!body?.payload?.kind) throw new Error('PAYLOAD_REQUIRED');

  const bannerEnabled = body.bannerEnabled === true;
  const emailEnabled = body.emailEnabled === true;

  const created = await prisma.offer.create({
    data: {
      name: body.name.trim(),

      mode: body.mode,
      code: body.code ? body.code.trim() : null,

      status: toPrismaStatus(body.status),
      startsAt: parseIso(body.startsAt),
      endsAt: parseIso(body.endsAt),

      stackingMode: body.stackingMode,
      priority: Number.isFinite(body.priority) ? Math.trunc(body.priority) : 0,

      maxDiscountPerOrderPence:
        typeof body.maxDiscountPerOrderPence === 'number'
          ? Math.max(0, Math.trunc(body.maxDiscountPerOrderPence))
          : null,

      preventFreeOrder: Boolean(body.preventFreeOrder),
      visibility: toPrismaVisibility(body.visibility),

      exclusions: asJson(body.exclusions ?? {}),
      payload: asJson(body.payload),

      bannerEnabled,
      bannerTitle: bannerEnabled ? normStr(body.bannerTitle) : null,
      bannerMessage: bannerEnabled ? normStr(body.bannerMessage) : null,
      bannerCtaLabel: bannerEnabled ? normStr(body.bannerCtaLabel) : null,
      bannerCtaHref: bannerEnabled ? normStr(body.bannerCtaHref) : null,
      bannerStartsAt: bannerEnabled ? parseIso(body.bannerStartsAt) : null,
      bannerEndsAt: bannerEnabled ? parseIso(body.bannerEndsAt) : null,

      emailEnabled,
      emailSubject: emailEnabled ? normStr(body.emailSubject) : null,
      emailMessage: emailEnabled ? normStr(body.emailMessage) : null
    },
    select: offerSelect
  });

  return rowToAdminForm({
    ...(created as OfferRowSelected),
    exclusions: created.exclusions ?? {},
    payload: created.payload
  });
}

export async function updateOffer(id: string, body: OfferAdminForm): Promise<OfferAdminForm> {
  if (!id?.trim()) throw new Error('ID_REQUIRED');
  if (!body?.name?.trim()) throw new Error('NAME_REQUIRED');
  if (!body?.payload?.kind) throw new Error('PAYLOAD_REQUIRED');

  const bannerEnabled = body.bannerEnabled === true;
  const emailEnabled = body.emailEnabled === true;

  const updated = await prisma.offer.update({
    where: { id },
    data: {
      name: body.name.trim(),

      mode: body.mode,
      code: body.code ? body.code.trim() : null,

      status: toPrismaStatus(body.status),
      startsAt: parseIso(body.startsAt),
      endsAt: parseIso(body.endsAt),

      stackingMode: body.stackingMode,
      priority: Number.isFinite(body.priority) ? Math.trunc(body.priority) : 0,

      maxDiscountPerOrderPence:
        typeof body.maxDiscountPerOrderPence === 'number'
          ? Math.max(0, Math.trunc(body.maxDiscountPerOrderPence))
          : null,

      preventFreeOrder: Boolean(body.preventFreeOrder),
      visibility: toPrismaVisibility(body.visibility),

      exclusions: asJson(body.exclusions ?? {}),
      payload: asJson(body.payload),

      bannerEnabled,
      bannerTitle: bannerEnabled ? normStr(body.bannerTitle) : null,
      bannerMessage: bannerEnabled ? normStr(body.bannerMessage) : null,
      bannerCtaLabel: bannerEnabled ? normStr(body.bannerCtaLabel) : null,
      bannerCtaHref: bannerEnabled ? normStr(body.bannerCtaHref) : null,
      bannerStartsAt: bannerEnabled ? parseIso(body.bannerStartsAt) : null,
      bannerEndsAt: bannerEnabled ? parseIso(body.bannerEndsAt) : null,

      emailEnabled,
      emailSubject: emailEnabled ? normStr(body.emailSubject) : null,
      emailMessage: emailEnabled ? normStr(body.emailMessage) : null
    },
    select: offerSelect
  });

  return rowToAdminForm({
    ...(updated as OfferRowSelected),
    exclusions: updated.exclusions ?? {},
    payload: updated.payload
  });
}

export async function deleteOffer(id: string) {
  if (!id?.trim()) return;
  await prisma.offer.delete({ where: { id } });
}
