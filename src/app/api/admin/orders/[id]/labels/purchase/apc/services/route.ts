// src/app/api/admin/orders/[id]/labels/purchase/apc/services/route.ts
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import { getServiceAvailability, type ServiceOption } from '@/lib/shipping/apc';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApcItemType = 'PARCEL' | 'LIQUIDS';

function gramsToKg(g?: number | null): number {
  const kg = (g ?? 0) / 1000;
  return Math.max(0.01, Number.isFinite(kg) ? kg : 0.01);
}

function todayUk(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Some builds of the APC helper return extra fields not present in the TS type (ServiceOption).
 * We avoid `any` by reading only "unknown" + checking keys at runtime.
 */
type ServiceOptionLoose = ServiceOption & {
  ProductCode?: unknown;
  ServiceName?: unknown;
  Name?: unknown;
  Carrier?: unknown;
  MinTransitDays?: unknown;
  MaxTransitDays?: unknown;
  TotalCost?: unknown;
  Total?: unknown;
  Cost?: unknown;
  TotalPrice?: unknown;
  Price?: unknown;
  Currency?: unknown;
  currency?: unknown;
};

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}
function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pickCost(s: ServiceOptionLoose): string {
  const candidates: unknown[] = [s.TotalCost, s.Total, s.Cost, s.TotalPrice, s.Price];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'number' && Number.isFinite(c)) return c.toFixed(2);
  }
  return '0.00';
}

function pickCurrency(s: ServiceOptionLoose): string {
  const c = asString(s.Currency) ?? asString(s.currency);
  return c?.trim() ? c : 'GBP';
}

function pickProductCode(s: ServiceOptionLoose): string | null {
  return asString(s.ProductCode);
}

function pickName(s: ServiceOptionLoose): string | null {
  return asString(s.ServiceName) ?? asString(s.Name);
}

function pickCarrier(s: ServiceOptionLoose): string | null {
  return asString(s.Carrier);
}

function pickMinDays(s: ServiceOptionLoose): number | null {
  return asNumber(s.MinTransitDays);
}
function pickMaxDays(s: ServiceOptionLoose): number | null {
  return asNumber(s.MaxTransitDays);
}

export async function GET(_req: NextRequest, ctx: unknown) {
  const { id: orderId } = getParams(ctx);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, shippingAddress: true }
  });

  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  if (!order.shippingAddress) {
    return NextResponse.json({ ok: false, error: 'Missing shipping address' }, { status: 400 });
  }

  const summedItemsG = order.items.reduce(
    (sum: number, it: { unitWeightGrams?: number | null; quantity: number }) =>
      sum + (it.unitWeightGrams ?? 0) * it.quantity,
    0
  );

  const weightGrams = order.totalWeightGrams ?? summedItemsG;
  const weightKg = gramsToKg(weightGrams);

  const itemType: ApcItemType = 'PARCEL';

  const servicesRaw = await getServiceAvailability({
    collectionDate: todayUk(),
    readyAt: '09:00',
    closedAt: '18:00',
    collectionPostcode: (process.env.WAREHOUSE_POSTCODE ?? '').trim(),
    deliveryPostcode: (order.shippingAddress.postcode ?? '').trim(),
    collectionCountry: 'GB',
    deliveryCountry: order.shippingAddress.country ?? 'GB',
    items: [
      {
        type: itemType,
        weight: weightKg,
        length: 20,
        width: 10,
        height: 10,
        value: 15,
        description: 'Food and drink'
      }
    ]
  });

  const services = servicesRaw as ServiceOptionLoose[];

  const rows = services.map((s) => ({
    productCode: pickProductCode(s),
    name: pickName(s),
    carrier: pickCarrier(s),
    minDays: pickMinDays(s),
    maxDays: pickMaxDays(s),
    total: pickCost(s),
    currency: pickCurrency(s)
  }));

  return NextResponse.json({ ok: true, services: rows });
}
