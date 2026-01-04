// src/app/api/admin/orders/[id]/shipments/apc/services/route.ts
import { getApcServices } from '@/lib/shipping/apc-serviceAvailability';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function upper(s: string) {
  return s.toUpperCase();
}

function toDdMmYyyyFromIso(iso: string): string {
  // iso: YYYY-MM-DD
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('Invalid collectionDateISO');
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}

function safeNum(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

interface Body {
  collectionDateISO: string; // YYYY-MM-DD
  pickupPostcode: string;
  deliveryPostcode: string;
  weightGrams?: number | null;
  itemType?: 'PARCEL' | 'LIQUIDS';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ctx.params; // orderId not needed here, but keeps route shape consistent

  try {
    const body = (await req.json()) as Body;

    const collectionDateISO = (body.collectionDateISO ?? '').trim();
    const pickupPostcode = upper((body.pickupPostcode ?? '').trim());
    const deliveryPostcode = upper((body.deliveryPostcode ?? '').trim());

    if (!collectionDateISO) {
      return NextResponse.json(
        { ok: false, error: 'collectionDateISO is required' },
        { status: 400 }
      );
    }
    if (!pickupPostcode) {
      return NextResponse.json({ ok: false, error: 'pickupPostcode is required' }, { status: 400 });
    }
    if (!deliveryPostcode) {
      return NextResponse.json(
        { ok: false, error: 'deliveryPostcode is required' },
        { status: 400 }
      );
    }

    // APC expects kg
    const grams = safeNum(body.weightGrams ?? null);
    const weightKg = grams && grams > 0 ? grams / 1000 : 1; // default 1kg if not supplied

    const ddmmyyyy = toDdMmYyyyFromIso(collectionDateISO);

    // Keep sensible defaults (you can expose these in UI later if needed)
    const readyAt = '10:00';
    const closedAt = '17:00';

    // Map your itemType to APC request Type. "ALL" gives broad services; PARCEL/LIQUIDS also OK.
    const type = body.itemType === 'LIQUIDS' ? 'LIQUIDS' : 'PARCEL';

    const services = await getApcServices({
      collectionPostcode: pickupPostcode,
      deliveryPostcode,
      collectionDate: ddmmyyyy,
      readyAt,
      closedAt,
      weightKg,
      lengthCm: 0,
      widthCm: 0,
      heightCm: 0,
      type
    });

    return NextResponse.json({ ok: true, services });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch APC services';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
