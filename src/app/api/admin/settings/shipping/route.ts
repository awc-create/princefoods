// src/app/api/admin/settings/shipping/route.ts
import {
  getWarehouseSettings,
  upsertWarehouseSettings,
  type ApcWarehouseSettings
} from '@/lib/admin-settings';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getWarehouseSettings();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load shipping settings';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

type Body = Partial<ApcWarehouseSettings>;

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json()) as Body;

    // Light validation (you can swap to zod later)
    const missing: string[] = [];
    const reqd: (keyof ApcWarehouseSettings)[] = [
      'companyName',
      'contactName',
      'email',
      'phone',
      'address1',
      'city',
      'postcode',
      'countryCode'
    ];
    for (const k of reqd) {
      const v = b[k];
      if (!v || String(v).trim() === '') missing.push(k);
    }
    if (missing.length) {
      return NextResponse.json(
        { ok: false, error: `Missing ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Normalise/format for APC
    const payload: ApcWarehouseSettings = {
      companyName: String(b.companyName!).trim(),
      contactName: String(b.contactName!).trim(),
      email: String(b.email!).trim(),
      phone: String(b.phone!).trim(),
      address1: String(b.address1!).trim(),
      address2: (b.address2 ?? '').trim(),
      city: String(b.city!).trim(),
      postcode: String(b.postcode!).trim().toUpperCase(),
      countryCode: String(b.countryCode!).trim().toUpperCase()
    };

    const saved = await upsertWarehouseSettings(payload);
    return NextResponse.json({ ok: true, data: saved });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to save shipping settings';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
