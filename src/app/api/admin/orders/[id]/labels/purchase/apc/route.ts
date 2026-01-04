// src/app/api/admin/orders/[id]/labels/purchase/apc/route.ts
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import {
  getLabelWithPolling,
  getServiceAvailability,
  placeOrder,
  type ApcCreateOrderPayload,
  type ServiceOption
} from '@/lib/shipping/apc';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- Max field lengths ---------- */
const APC_MAX = { name: 35, addr: 64, city: 32, email: 64, reference: 35 };

/* ---------- Cleaning helpers ---------- */
const clean = (v?: string | null, max = 35) =>
  (v ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s\-\/&.,']/gu, '')
    .trim()
    .slice(0, max);

const titleCase = (s?: string | null) =>
  (s ?? '')
    .toLowerCase()
    .split(/([\s\-\/&.,]+)/)
    .map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join('');

const compactPunct = (s?: string | null) =>
  (s ?? '')
    .replace(/,+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const cleanLine = (v?: string | null, max = APC_MAX.addr) =>
  compactPunct(clean(v, max)).slice(0, max);

const cleanCity = (v?: string | null) => titleCase(clean(v, APC_MAX.city));
const cleanPostcode = (v?: string | null) => (v ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

const cleanPhoneGB = (v?: string | null) => {
  const digits = String(v ?? '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return digits.slice(0, 15);
  if (digits.startsWith('44')) return ('0' + digits.slice(2)).slice(0, 15);
  return ('0' + digits).slice(0, 15);
};

const cleanEmail = (v?: string | null, max = APC_MAX.email) => {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/\s+/g, '').replace(/[^\w.+@-]/g, '');
  return cleaned.slice(0, max);
};
const hasAt = (e: string) => e.includes('@');
const hasDotTLD = (e: string) => /\.[A-Za-z]{2,}$/.test(e);

const cleanRef = (v?: string | null, max = APC_MAX.reference) =>
  (v ?? '')
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}\-_.]/gu, '')
    .slice(0, max);

/* ---------- Helpers ---------- */
type ApcItemType = 'PARCEL' | 'LIQUIDS';

function gramsToKg(g?: number | null): number {
  const kg = (g ?? 0) / 1000;
  return Math.max(0.01, Number.isFinite(kg) ? kg : 0.01);
}
function todayUk(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function toUkFromISO(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : todayUk();
}
function isValidISODate(iso?: string | null): boolean {
  if (!iso) return false;
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(iso);
}
function isAfterTodayISO(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const cand = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return cand.getTime() > today.getTime();
}

function buildTrackingUrl(waybill: string) {
  return `https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(waybill)}`;
}

function makeIdempotencyKey(args: {
  orderId: string;
  displayId?: string | null;
  productCode: string;
  collectionDate: string; // DD/MM/YYYY
}) {
  const base = `${args.displayId ?? args.orderId}:${args.productCode}:${args.collectionDate}`;
  return `apc:${base}`.slice(0, 190);
}

interface PickupOverride {
  companyName?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address1?: string;
  address2?: string;
  city?: string;
  postcode?: string;
  countryCode?: string;
}
interface DeliveryOverride {
  name?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  address1?: string;
  address2?: string;
  city?: string;
  town?: string;
  county?: string;
  instructions?: string;
  postcode?: string;
  countryCode?: string;
}
interface GoodsOverride {
  valuePounds: number;
  description: string;
}
interface RequestBody {
  productCode?: string;
  weightGrams?: number;
  itemType?: ApcItemType;
  pickupOverride?: PickupOverride;
  collectionDateISO?: string;
  deliveryOverride?: DeliveryOverride;
  goodsOverride?: GoodsOverride;
}
interface OrderItemWeightShape {
  unitWeightGrams?: number | null;
  quantity: number;
}

/**
 * ServiceOption sometimes lacks ProductCode in its TS type depending on your apc helper typing.
 * We avoid `any` using `unknown` fields + runtime checks.
 */
type ServiceOptionLoose = ServiceOption & { ProductCode?: unknown };
function pickProductCode(s: ServiceOptionLoose): string {
  return typeof s.ProductCode === 'string' ? s.ProductCode : '';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, shippingAddress: true }
    });

    if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    if (!order.shippingAddress) {
      return NextResponse.json({ ok: false, error: 'Missing shipping address' }, { status: 400 });
    }

    const ship = order.shippingAddress;

    const shipCountry = (ship.country ?? '').toUpperCase().trim();
    if (!ship.line1?.trim() || !ship.postcode?.trim() || !shipCountry) {
      return NextResponse.json(
        { ok: false, error: 'Shipping address missing required fields' },
        { status: 400 }
      );
    }
    if (shipCountry === 'GB' && !(ship.town ?? '').trim()) {
      return NextResponse.json(
        { ok: false, error: 'Shipping address missing Town (Post Town)' },
        { status: 400 }
      );
    }
    if (!cleanPhoneGB(ship.phoneE164)) {
      return NextResponse.json(
        { ok: false, error: 'Shipping address missing valid phone number' },
        { status: 400 }
      );
    }

    // NOTE: this route expects warehouse config via overrides/env for now.
    // If you *do* have getWarehouseSettings you can re-add it and merge.
    const summedItemsG = order.items.reduce(
      (sum: number, it: OrderItemWeightShape) => sum + (it.unitWeightGrams ?? 0) * it.quantity,
      0
    );

    const weightGrams = body.weightGrams ?? order.totalWeightGrams ?? summedItemsG ?? 0;
    const weightKg = gramsToKg(weightGrams);

    let collectionDate = todayUk();
    if (isValidISODate(body.collectionDateISO) && isAfterTodayISO(body.collectionDateISO!)) {
      collectionDate = toUkFromISO(body.collectionDateISO!);
    }

    const itemType: ApcItemType = body.itemType ?? 'PARCEL';
    let productCode = body.productCode ?? '';

    const collectionPostcode = cleanPostcode(
      body.pickupOverride?.postcode ?? process.env.WAREHOUSE_POSTCODE ?? ''
    );

    const collectionCountry = (body.pickupOverride?.countryCode ?? 'GB').toUpperCase();

    let services: ServiceOptionLoose[] = [];
    if (!productCode) {
      const res = await getServiceAvailability({
        collectionDate,
        readyAt: '09:00',
        closedAt: '18:00',
        collectionPostcode,
        deliveryPostcode: ship.postcode ?? '',
        collectionCountry,
        deliveryCountry: ship.country ?? 'GB',
        items: [
          {
            type: itemType,
            weight: weightKg,
            length: 20,
            width: 10,
            height: 10,
            value: 15,
            description: body.goodsOverride?.description ?? 'Food and drink'
          }
        ]
      });

      services = res as ServiceOptionLoose[];

      const prefer = new Set(['APCND16', 'APCND12', 'APCND10', 'UB16']);
      productCode =
        services.find((s) => prefer.has(pickProductCode(s)))?.ProductCode?.toString() ??
        pickProductCode(services[0] as ServiceOptionLoose) ??
        '';
    }

    if (!productCode) {
      return NextResponse.json(
        { ok: false, error: 'No APC service productCode available' },
        { status: 400 }
      );
    }

    const idempotencyKey = makeIdempotencyKey({
      orderId: order.id,
      displayId: order.displayId,
      productCode,
      collectionDate
    });

    const existingPurchased = await prisma.shipment.findFirst({
      where: {
        orderId: order.id,
        carrier: { contains: 'APC', mode: 'insensitive' },
        OR: [{ labelBase64: { not: null } }, { labelUrl: { not: null } }]
      },
      orderBy: { createdAt: 'desc' }
    });

    if (
      existingPurchased?.waybill &&
      (existingPurchased.labelBase64 || existingPurchased.labelUrl)
    ) {
      return NextResponse.json({
        ok: true,
        status: 'READY',
        waybill: existingPurchased.waybill,
        trackingUrl: existingPurchased.trackingUrl ?? buildTrackingUrl(existingPurchased.waybill),
        shipment: existingPurchased,
        label: existingPurchased.labelBase64
          ? {
              mime: existingPurchased.labelMime ?? 'application/pdf',
              base64: existingPurchased.labelBase64
            }
          : null
      });
    }

    const reference = cleanRef(order.displayId ?? order.id, APC_MAX.reference);

    const pickupCityRaw = body.pickupOverride?.city ?? process.env.WAREHOUSE_CITY ?? 'Uxbridge';

    const pickupEmail = (() => {
      const e = cleanEmail(body.pickupOverride?.email ?? process.env.WAREHOUSE_EMAIL);
      return hasAt(e) && hasDotTLD(e) ? e : 'noreply@prince-v.com';
    })();

    const pickup = {
      name: titleCase(clean(body.pickupOverride?.companyName ?? 'Warehouse')),
      contact: titleCase(clean(body.pickupOverride?.contactName ?? 'Warehouse')),
      phone: cleanPhoneGB(body.pickupOverride?.phone ?? process.env.WAREHOUSE_PHONE),
      email: pickupEmail,
      address1: cleanLine(body.pickupOverride?.address1 ?? process.env.WAREHOUSE_ADDR1),
      address2: cleanLine(body.pickupOverride?.address2 ?? process.env.WAREHOUSE_ADDR2),
      city: cleanCity(pickupCityRaw),
      postcode: collectionPostcode,
      countryCode: collectionCountry
    };

    const delOv = body.deliveryOverride ?? {};

    const baseName =
      (delOv.name ?? '').trim() ||
      [ship.firstName ?? '', ship.lastName ?? ''].filter(Boolean).join(' ').trim() ||
      'Customer';

    const deliveryPostcode = cleanPostcode(delOv.postcode ?? ship.postcode ?? '');

    const deliveryTown = (delOv.town ?? ship.town ?? '').trim();
    const deliveryCityValue =
      shipCountry === 'GB' ? deliveryTown : (delOv.city ?? ship.city ?? '').trim() || deliveryTown;

    const delivery = {
      name: titleCase(clean(baseName)),
      contact: titleCase(clean(baseName)),
      phone: cleanPhoneGB(delOv.phone ?? ship.phoneE164),
      email: (() => {
        const e = cleanEmail(delOv.email ?? order.contactEmail ?? '');
        return hasAt(e) && hasDotTLD(e) ? e : pickup.email;
      })(),
      address1: cleanLine(delOv.address1 ?? ship.line1 ?? ''),
      address2: cleanLine(delOv.address2 ?? ship.line2 ?? ''),
      city: cleanCity(deliveryCityValue),
      postcode: deliveryPostcode,
      countryCode: (delOv.countryCode ?? ship.country ?? 'GB').toUpperCase()
    };

    const apcPayload: ApcCreateOrderPayload = {
      Orders: {
        Order: {
          CollectionDate: collectionDate,
          ReadyAt: '09:00',
          ClosedAt: '18:00',
          ProductCode: productCode,
          Reference: reference,
          Collection: {
            CompanyName: pickup.name,
            AddressLine1: pickup.address1,
            AddressLine2: pickup.address2 || undefined,
            PostalCode: pickup.postcode,
            City: pickup.city,
            CountryCode: pickup.countryCode,
            Contact: {
              PersonName: pickup.contact,
              PhoneNumber: pickup.phone,
              Email: pickup.email
            }
          },
          Delivery: {
            CompanyName: delivery.name,
            AddressLine1: delivery.address1,
            AddressLine2: delivery.address2 || undefined,
            PostalCode: delivery.postcode,
            City: delivery.city,
            CountryCode: delivery.countryCode,
            Contact: {
              PersonName: delivery.contact,
              PhoneNumber: delivery.phone,
              MobileNumber: delivery.phone,
              Email: delivery.email
            }
          },
          GoodsInfo: {
            GoodsValue: String(body.goodsOverride?.valuePounds ?? 15),
            GoodsDescription: body.goodsOverride?.description ?? 'Food and drink',
            PremiumInsurance: 'false',
            Fragile: 'false',
            Security: 'false',
            IncreasedLiability: 'false'
          },
          ShipmentDetails: {
            NumberOfPieces: '1',
            Items: {
              Item: {
                Type: 'PARCEL',
                Weight: String(weightKg),
                Length: '20',
                Width: '10',
                Height: '10',
                Value: String(body.goodsOverride?.valuePounds ?? 15),
                Description: body.goodsOverride?.description ?? 'Food and drink'
              }
            }
          }
        }
      }
    };

    const reserved = await prisma.shipment.upsert({
      where: { idempotencyKey },
      create: {
        idempotencyKey,
        orderId: order.id,
        carrier: 'APC Overnight',
        service: null,
        serviceCode: productCode,
        waybill: null,
        trackingNumber: null,
        trackingUrl: null,
        labelUrl: null,
        labelMime: null,
        labelBase64: null,
        weightGrams,
        costPence: null,
        status: 'BOOKED'
      },
      update: {
        serviceCode: productCode,
        weightGrams
      }
    });

    if (reserved.waybill) {
      return NextResponse.json({
        ok: true,
        status: reserved.labelBase64 || reserved.labelUrl ? 'READY' : 'PENDING_LABEL',
        waybill: reserved.waybill,
        trackingUrl: reserved.trackingUrl ?? buildTrackingUrl(reserved.waybill),
        shipment: reserved
      });
    }

    const placed = await placeOrder(apcPayload);
    const waybill = placed.waybill;
    const trackingUrl = buildTrackingUrl(waybill);

    await prisma.shipment.update({
      where: { id: reserved.id },
      data: {
        waybill,
        trackingNumber: waybill,
        trackingUrl,
        status: 'BOOKED'
      }
    });

    await Activity.shipmentCreated(order.id, {
      carrier: 'APC Overnight',
      productCode,
      collectionDate,
      waybill,
      trackingUrl,
      shipmentId: reserved.id
    });

    try {
      const label = await getLabelWithPolling(waybill, {
        delayMs: Number(process.env.APC_LABEL_DELAY_MS ?? 3500),
        attempts: Number(process.env.APC_LABEL_RETRY ?? 40)
      });

      const updated = await prisma.shipment.update({
        where: { id: reserved.id },
        data: { labelMime: label.mime, labelBase64: label.base64, status: 'LABEL_READY' }
      });

      await Activity.labelPurchased(order.id, {
        carrier: 'APC Overnight',
        productCode,
        waybill,
        trackingUrl,
        shipmentId: updated.id,
        labelMime: label.mime
      });

      return NextResponse.json({
        ok: true,
        status: 'READY',
        waybill,
        trackingUrl,
        shipment: updated,
        label
      });
    } catch {
      await Activity.shipmentCreated(order.id, {
        carrier: 'APC Overnight',
        productCode,
        waybill,
        trackingUrl,
        shipmentId: reserved.id,
        labelStatus: 'PENDING'
      });

      return NextResponse.json(
        { ok: true, status: 'PENDING_LABEL', waybill, trackingUrl, shipment: reserved },
        { status: 202 }
      );
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : 'Unknown APC error';
    console.error('APC purchase error:', err);

    await Activity.shipmentCancelled(orderId, {
      carrier: 'APC Overnight',
      error: raw
    });

    return NextResponse.json({ ok: false, error: raw }, { status: 502 });
  }
}
