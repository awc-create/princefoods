// src/app/api/admin/shipments/[shipmentId]/label/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asFilename(v: string) {
  return v.replace(/[^\w\-_.]/g, '_').slice(0, 80) || 'label';
}

function base64ToUint8Array(b64: string) {
  // strip data URL prefix if someone stored it like: data:application/pdf;base64,...
  const raw = b64.includes('base64,') ? (b64.split('base64,').pop() ?? '') : b64;
  const buf = Buffer.from(raw, 'base64');
  return new Uint8Array(buf);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await ctx.params;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      orderId: true,
      carrier: true,
      waybill: true,
      trackingNumber: true,
      labelMime: true,
      labelBase64: true,
      labelUrl: true,
      createdAt: true
    }
  });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: 'Shipment not found' }, { status: 404 });
  }

  const mime = shipment.labelMime ?? 'application/pdf';
  const ext =
    mime === 'application/pdf'
      ? 'pdf'
      : mime === 'image/png'
        ? 'png'
        : mime === 'application/zpl'
          ? 'zpl'
          : 'bin';

  const fileBase = asFilename(
    `label_${shipment.carrier ?? 'carrier'}_${shipment.waybill ?? shipment.trackingNumber ?? shipment.id}`
  );
  const filename = `${fileBase}.${ext}`;

  const url = new URL(req.url);
  const download = url.searchParams.get('download') === '1';

  // ✅ Prefer DB base64
  if (shipment.labelBase64) {
    const bytes = base64ToUint8Array(shipment.labelBase64);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': download ? `attachment; filename="${filename}"` : 'inline',
        'Cache-Control': 'no-store'
      }
    });
  }

  // ✅ Fallback to URL (proxy it)
  if (shipment.labelUrl) {
    try {
      const res = await fetch(shipment.labelUrl, { cache: 'no-store' });
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `Failed to fetch label (${res.status})` },
          { status: 502 }
        );
      }

      const buf = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') ?? mime;

      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(buf.byteLength),
          'Content-Disposition': download ? `attachment; filename="${filename}"` : 'inline',
          'Cache-Control': 'no-store'
        }
      });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : 'Failed to fetch label' },
        { status: 502 }
      );
    }
  }

  return NextResponse.json(
    { ok: false, error: 'No label available for this shipment' },
    { status: 404 }
  );
}
