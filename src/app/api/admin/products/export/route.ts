import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

export const runtime = 'nodejs';

const HEADERS = [
  'id',
  'name',
  'sku',
  'brand',
  'price',
  'caseQty',
  'inventory',
  'collection',
  'category',
  'categoryId',
  'ribbon',
  'discountMode',
  'discountValue',
  'shipping_weight_grams',
  'shippingTemp',
  'visible',
  'description',
  'imageUrl',
  'tags',
  // Offer info (read-only reference — what offer is applied via the offers engine)
  'activeOffer',
  'offerKind',
  'offerSummary'
] as const;
type CsvHeader = (typeof HEADERS)[number];

function esc(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids');
  const ids = idsParam
    ? idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
  const search = (searchParams.get('search') ?? '').trim();
  const collectionsParam = (searchParams.get('collections') ?? '').trim();
  const collections = collectionsParam
    ? collectionsParam
        .split(',')
        .map((s) => decodeURIComponent(s).trim())
        .filter(Boolean)
    : [];

  const where = ids?.length
    ? { id: { in: ids } }
    : {
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { sku: { contains: search, mode: 'insensitive' as const } },
                { brand: { contains: search, mode: 'insensitive' as const } }
              ]
            }
          : {}),
        ...(collections.length ? { collection: { in: collections } } : {})
      };

  const items = await prisma.product.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      sku: true,
      brand: true,
      price: true,
      caseQty: true,
      inventory: true,
      collection: true,
      categoryId: true,
      ribbon: true,
      discountMode: true,
      discountValue: true,
      shippingWeightGrams: true,
      shippingTemp: true,
      visible: true,
      description: true,
      productImageUrl: true,
      tags: true,
      category: { select: { name: true, parent: { select: { name: true } } } }
    }
  });

  // Fetch active offers to annotate products
  const offers = await prisma.offer.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, payload: true }
  });

  // Build a map of categoryId → offer info
  const offerByCatId = new Map<string, { name: string; kind: string; summary: string }>();
  for (const offer of offers) {
    const payload = offer.payload as Record<string, unknown> | null;
    if (!payload) continue;
    const kind = String(payload.kind ?? '');
    const pool = (payload.buyPool ?? payload.pool) as Record<string, unknown> | null;
    const catIds = Array.isArray((pool as Record<string, unknown>)?.categoryIds)
      ? ((pool as Record<string, unknown>).categoryIds as string[])
      : [];
    let summary = kind;
    if (kind === 'BOGOF') {
      summary = `Buy ${payload.buyQty ?? 2} get ${payload.getQty ?? 1} free`;
    } else if (kind === 'PERCENT_OFF') {
      summary = `${payload.percentOff ?? 0}% off`;
    } else if (kind === 'AMOUNT_OFF') {
      summary = `£${((Number(payload.amountOffPence) || 0) / 100).toFixed(2)} off`;
    }
    for (const cid of catIds) {
      if (!offerByCatId.has(cid)) {
        offerByCatId.set(cid, { name: offer.name, kind, summary });
      }
    }
  }

  const lines: string[] = [HEADERS.join(',')];

  for (const p of items) {
    const catPath = p.category
      ? p.category.parent
        ? `${p.category.parent.name} ; ${p.category.name}`
        : p.category.name
      : (p.collection ?? '');

    const offerInfo = p.categoryId ? offerByCatId.get(p.categoryId) : null;

    const row: Record<CsvHeader, unknown> = {
      id: p.id,
      name: p.name,
      sku: p.sku ?? '',
      brand: p.brand ?? '',
      price: p.price ?? '',
      caseQty: p.caseQty ?? '',
      inventory: p.inventory ?? '',
      collection: p.collection ?? '',
      category: catPath,
      categoryId: p.categoryId ?? '',
      ribbon: p.ribbon ?? '',
      discountMode: p.discountMode ?? '',
      discountValue: p.discountValue ?? '',
      shipping_weight_grams: p.shippingWeightGrams ?? '',
      shippingTemp: p.shippingTemp ?? 'DRY',
      visible: p.visible,
      description: p.description ?? '',
      imageUrl: p.productImageUrl ?? '',
      tags: (p.tags ?? []).join(', '),
      activeOffer: offerInfo?.name ?? '',
      offerKind: offerInfo?.kind ?? '',
      offerSummary: offerInfo?.summary ?? ''
    };

    lines.push(HEADERS.map((h) => esc(row[h])).join(','));
  }

  return new NextResponse(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="products-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
