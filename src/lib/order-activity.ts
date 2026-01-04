// src/lib/order-activity.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Keep this in sync with your Prisma enum ActivityType in schema.prisma.
 * (We keep it as a TS union so you don't depend on Prisma enum exports.)
 */
export type ActivityType =
  // existing
  | 'PLACED'
  | 'PAID'
  | 'FULFILLED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'NOTE'
  // shipping lifecycle
  | 'SHIPMENT_CREATED'
  | 'LABEL_PURCHASED'
  | 'SHIPMENT_SHIPPED'
  | 'SHIPMENT_CANCELLED'
  | 'SHIPMENT_DELIVERED'
  // returns lifecycle
  | 'RETURN_OPENED'
  | 'RETURN_RECEIVED'
  | 'RETURN_RESHIP_CREATED'
  | 'RETURN_DECIDED_REFUND'
  | 'RETURN_DECIDED_STORE_CREDIT'
  | 'RETURN_CLOSED'
  // tags
  | 'TAG_ADDED'
  | 'TAG_REMOVED';

type MetaJson = Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;

interface LogActivityInput {
  orderId: string;
  type: ActivityType;
  note?: string | null;
  meta?: unknown;
}

/**
 * Convert unknown to Prisma JSON input safely.
 *
 * IMPORTANT (Prisma v5):
 * - For Json? fields, you can't pass JS null.
 * - Use Prisma.DbNull to store DB NULL (recommended for "no meta").
 * - Use Prisma.JsonNull to store JSON null explicitly.
 */
function toMetaJson(v: unknown): MetaJson {
  if (v === null) return Prisma.DbNull;

  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;

  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'symbol') return v.toString();
  if (typeof v === 'function') return '[function]';

  if (typeof v === 'object') {
    try {
      return JSON.parse(
        JSON.stringify(v, (_k, val) => {
          if (typeof val === 'bigint') return val.toString();
          if (typeof val === 'symbol') return val.toString();
          if (typeof val === 'function') return '[function]';
          return val as unknown;
        })
      ) as Prisma.InputJsonValue;
    } catch {
      return String(v);
    }
  }

  return String(v);
}

/**
 * Best-effort logger. Never blocks main flow.
 */
export async function logActivity(
  orderId: string,
  type: ActivityType,
  note?: string | null,
  meta?: unknown
): Promise<void> {
  try {
    const data: Prisma.OrderActivityCreateInput = {
      order: { connect: { id: orderId } },
      type: type as unknown as Prisma.OrderActivityCreateInput['type'],
      ...(note ? { note } : {})
    };

    // Only write meta if explicitly provided (including null)
    if (meta !== undefined) {
      data.meta = toMetaJson(meta);
    }

    await prisma.orderActivity.create({ data });
  } catch (e) {
    console.error('logActivity failed', e);
  }
}

export async function logActivityEvent(input: LogActivityInput): Promise<void> {
  const { orderId, type, note = null, meta } = input;
  return logActivity(orderId, type, note, meta);
}

/**
 * Convenience helpers to keep messages consistent.
 */
export const Activity = {
  // shipping
  shipmentCreated: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'SHIPMENT_CREATED', 'Shipment created.', meta),

  labelPurchased: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'LABEL_PURCHASED', 'Label purchased.', meta),

  labelFailed: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'NOTE', 'Label purchase failed.', meta),

  shipmentShipped: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'SHIPMENT_SHIPPED', 'Shipment marked as shipped.', meta),

  shipmentDelivered: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'SHIPMENT_DELIVERED', 'Shipment marked as delivered.', meta),

  shipmentCancelled: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'SHIPMENT_CANCELLED', 'Shipment cancelled.', meta),

  // order lifecycle
  fulfilled: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'FULFILLED', 'Order fulfilled (all shipments shipped).', meta),

  // returns
  returnOpened: (orderId: string, note?: string | null, meta?: unknown) =>
    logActivity(orderId, 'RETURN_OPENED', note ?? 'Return case opened.', meta),

  returnReceived: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'RETURN_RECEIVED', 'Return received.', meta),

  returnReshipCreated: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'RETURN_RESHIP_CREATED', 'Reship shipment created.', meta),

  returnDecideRefund: (orderId: string, note?: string | null, meta?: unknown) =>
    logActivity(orderId, 'RETURN_DECIDED_REFUND', note ?? 'Return decision: refund.', meta),

  returnDecideStoreCredit: (orderId: string, note?: string | null, meta?: unknown) =>
    logActivity(
      orderId,
      'RETURN_DECIDED_STORE_CREDIT',
      note ?? 'Return decision: store credit.',
      meta
    ),

  returnClosed: (orderId: string, meta?: unknown) =>
    logActivity(orderId, 'RETURN_CLOSED', 'Return case closed.', meta),

  // tags
  tagAdded: (orderId: string, label: string, meta?: unknown) =>
    logActivity(orderId, 'TAG_ADDED', `Tag added: ${label}`, meta),

  tagRemoved: (orderId: string, label: string, meta?: unknown) =>
    logActivity(orderId, 'TAG_REMOVED', `Tag removed: ${label}`, meta)
};
