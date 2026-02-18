// src/lib/offers-store.ts
import { prisma } from '@/lib/prisma';
import type { OfferAdminForm, OfferPayload } from '@/types/offers';
import type { Prisma } from '@prisma/client';

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

export function rowToAdminForm(row: {
  id: string;
  name: string;
  mode: string;
  code: string | null;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  stackingMode: string;
  priority: number;
  maxDiscountPerOrderPence: number | null;
  preventFreeOrder: boolean;
  visibility: string;
  exclusions: unknown;
  payload: unknown;
}): OfferAdminForm {
  const payload = asPayload(row.payload);
  if (!payload) throw new Error(`BAD_OFFER_PAYLOAD:${row.id}`);

  return {
    id: row.id,
    name: row.name,

    mode: row.mode as OfferAdminForm['mode'],
    code: row.code,

    status: row.status as OfferAdminForm['status'],
    startsAt: toIso(row.startsAt),
    endsAt: toIso(row.endsAt),

    stackingMode: row.stackingMode as OfferAdminForm['stackingMode'],
    priority: row.priority,

    maxDiscountPerOrderPence: row.maxDiscountPerOrderPence,
    preventFreeOrder: Boolean(row.preventFreeOrder),

    visibility: row.visibility as OfferAdminForm['visibility'],

    exclusions: asObject(row.exclusions) ?? {},
    payload
  };
}

export async function getOffers(): Promise<OfferAdminForm[]> {
  const rows = await prisma.offer.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
  });

  const out: OfferAdminForm[] = [];
  for (const r of rows) {
    try {
      out.push(
        rowToAdminForm({
          ...r,
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
  const row = await prisma.offer.findUnique({ where: { id } });
  if (!row) return null;
  return rowToAdminForm({
    ...row,
    exclusions: row.exclusions ?? {},
    payload: row.payload
  });
}

export async function createOffer(body: OfferAdminForm): Promise<OfferAdminForm> {
  if (!body?.name?.trim()) throw new Error('NAME_REQUIRED');
  if (!body?.payload?.kind) throw new Error('PAYLOAD_REQUIRED');

  const created = await prisma.offer.create({
    data: {
      name: body.name.trim(),

      mode: body.mode,
      code: body.code ? body.code.trim() : null,

      status: body.status,
      startsAt: parseIso(body.startsAt),
      endsAt: parseIso(body.endsAt),

      stackingMode: body.stackingMode,
      priority: Number.isFinite(body.priority) ? Math.trunc(body.priority) : 0,

      maxDiscountPerOrderPence:
        typeof body.maxDiscountPerOrderPence === 'number'
          ? Math.max(0, Math.trunc(body.maxDiscountPerOrderPence))
          : null,

      preventFreeOrder: Boolean(body.preventFreeOrder),
      visibility: body.visibility,

      exclusions: asJson(body.exclusions ?? {}),
      payload: asJson(body.payload)
    }
  });

  return rowToAdminForm({
    ...created,
    exclusions: created.exclusions ?? {},
    payload: created.payload
  });
}

export async function updateOffer(id: string, body: OfferAdminForm): Promise<OfferAdminForm> {
  if (!id?.trim()) throw new Error('ID_REQUIRED');
  if (!body?.name?.trim()) throw new Error('NAME_REQUIRED');
  if (!body?.payload?.kind) throw new Error('PAYLOAD_REQUIRED');

  const updated = await prisma.offer.update({
    where: { id },
    data: {
      name: body.name.trim(),

      mode: body.mode,
      code: body.code ? body.code.trim() : null,

      status: body.status,
      startsAt: parseIso(body.startsAt),
      endsAt: parseIso(body.endsAt),

      stackingMode: body.stackingMode,
      priority: Number.isFinite(body.priority) ? Math.trunc(body.priority) : 0,

      maxDiscountPerOrderPence:
        typeof body.maxDiscountPerOrderPence === 'number'
          ? Math.max(0, Math.trunc(body.maxDiscountPerOrderPence))
          : null,

      preventFreeOrder: Boolean(body.preventFreeOrder),
      visibility: body.visibility,

      exclusions: asJson(body.exclusions ?? {}),
      payload: asJson(body.payload)
    }
  });

  return rowToAdminForm({
    ...updated,
    exclusions: updated.exclusions ?? {},
    payload: updated.payload
  });
}

export async function deleteOffer(id: string) {
  if (!id?.trim()) return;
  await prisma.offer.delete({ where: { id } });
}
