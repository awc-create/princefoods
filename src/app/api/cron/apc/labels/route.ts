// src/app/api/cron/apc/labels/route.ts
import { sendTrackingEmail, type ProductTeaser } from '@/lib/email';
import { createAdminNotification } from '@/lib/notify';
import { prisma } from '@/lib/prisma';
import { getLabelWithPolling } from '@/lib/shipping/apc';
import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET ?? '';
const DEFAULT_BATCH_LIMIT = 25;

interface OrderItemForEmail {
  id: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  productId: string | null;
  sku: string | null;
}

function json(ok: boolean, body: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok, ...body }, { status });
}

function isAuthorized(req: NextRequest) {
  if (!CRON_SECRET) return false;
  const got = req.headers.get('x-cron-secret') ?? '';
  return got === CRON_SECRET;
}

function guessMimeFromBase64(base64: string) {
  if (base64.startsWith('JVBERi0')) return 'application/pdf';
  return 'application/octet-stream';
}

function buildTrackingUrl(waybill: string) {
  return `https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(waybill)}`;
}

async function findCandidateShipments(limit: number) {
  return prisma.shipment.findMany({
    where: {
      AND: [
        {
          OR: [
            { carrier: { contains: 'APC', mode: 'insensitive' } },
            { carrier: { contains: 'APC Overnight', mode: 'insensitive' } }
          ]
        },
        { waybill: { not: null } },
        { OR: [{ labelBase64: null }, { labelBase64: '' }] },
        { OR: [{ status: 'PENDING' }, { status: 'BOOKED' }, { status: 'LABEL_PENDING' }] }
      ]
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: {
      order: {
        select: {
          id: true,
          displayId: true,
          contactEmail: true,
          items: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              unitPrice: true,
              productId: true,
              sku: true
            }
          }
        }
      }
    }
  });
}

function mapProductsForEmail(items: OrderItemForEmail[]): ProductTeaser[] {
  return (items ?? []).slice(0, 6).map((it) => {
    const slugOrId = (it.sku ?? it.productId ?? it.id).toString();
    return {
      id: it.productId ?? it.id,
      title: it.name,
      href: `/products/${encodeURIComponent(slugOrId)}`,
      image: it.imageUrl ?? '/assets/prince-foods-logo.png',
      price: Number.isFinite(it.unitPrice) ? it.unitPrice : null
    };
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return json(false, { error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(Number(url.searchParams.get('limit') ?? DEFAULT_BATCH_LIMIT), 100)
  );

  const startedAt = Date.now();

  const summary = {
    limit,
    found: 0,
    checked: 0,
    updated: 0,
    emailed: 0,
    skippedAlreadyLabeled: 0,
    skippedNoWaybill: 0,
    errors: 0
  };

  const shipments = await findCandidateShipments(limit);
  summary.found = shipments.length;

  for (const s of shipments) {
    summary.checked++;

    const waybill = s.waybill ?? '';
    if (!waybill) {
      summary.skippedNoWaybill++;
      continue;
    }

    if (s.labelBase64 && String(s.labelBase64).length > 20) {
      summary.skippedAlreadyLabeled++;
      continue;
    }

    try {
      // Cron = quick: check once; next cron will try again.
      const label = await getLabelWithPolling(waybill, { attempts: 1, delayMs: 0 });

      const mime = label.mime ?? guessMimeFromBase64(label.base64);
      const trackingUrl = s.trackingUrl ?? buildTrackingUrl(waybill);

      const updatedShipment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.shipment.update({
          where: { id: s.id },
          data: {
            labelMime: mime,
            labelBase64: label.base64,
            status: 'LABEL_READY',
            trackingNumber: s.trackingNumber ?? waybill,
            trackingUrl
          }
        });

        await tx.orderActivity.create({
          data: {
            orderId: s.orderId,
            type: 'NOTE',
            note: `APC label became ready (cron) • Waybill ${waybill}`
          }
        });

        return updated;
      });

      summary.updated++;

      await createAdminNotification({
        kind: 'label_ready',
        title: `APC label ready for ${s.order.displayId ?? s.order.id}`,
        body: `Waybill ${waybill}`,
        link: `/admin/orders/${s.order.id}`
      });

      // ✅ Customer tracking email ONCE
      if (!updatedShipment.trackingEmailSentAt) {
        const to = (s.order.contactEmail ?? '').trim();
        if (to) {
          await sendTrackingEmail({
            to,
            orderId: s.order.id,
            displayId: s.order.displayId ?? s.order.id,
            carrier: s.carrier || 'APC Overnight',
            trackingNumber: updatedShipment.trackingNumber ?? waybill,
            trackingUrl: updatedShipment.trackingUrl ?? trackingUrl,
            products: mapProductsForEmail(s.order.items)
          });

          await prisma.shipment.update({
            where: { id: s.id },
            data: { trackingEmailSentAt: new Date() }
          });

          await prisma.orderActivity.create({
            data: {
              orderId: s.orderId,
              type: 'NOTE',
              note: `Tracking email sent to ${to} • Waybill ${waybill}`
            }
          });

          summary.emailed++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const normalPending = /not\s*ready|pending|try\s*again|label/i.test(msg);
      if (!normalPending) {
        summary.errors++;
        console.error('[cron apc labels] error', { shipmentId: s.id, orderId: s.orderId, msg });
      }
    }
  }

  return json(true, { ...summary, ms: Date.now() - startedAt });
}
