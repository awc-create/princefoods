// src/app/api/admin/options/products/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function safeLower(s: string | null | undefined) {
  return (s ?? '').trim().toLowerCase();
}

export interface PickerOption {
  id: string;
  label: string;
  meta?: string;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;

  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = safeLower(url.searchParams.get('q'));
  const takeRaw = Number(url.searchParams.get('take') ?? '200');
  const take = Math.max(20, Math.min(1000, Number.isFinite(takeRaw) ? Math.trunc(takeRaw) : 200));

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { sku: { contains: q, mode: 'insensitive' as const } }
        ]
      }
    : undefined;

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ visible: 'desc' }, { name: 'asc' }],
    take,
    select: {
      id: true,
      name: true,
      sku: true,
      visible: true
    }
  });

  const options: PickerOption[] = products.map((p) => ({
    id: p.id,
    label: p.name || '(Unnamed)',
    meta: `${p.sku ? `SKU: ${p.sku}` : ''}${p.visible === false ? `${p.sku ? ' • ' : ''}Hidden` : ''}`
      .trim()
      .replace(/^•\s*/, '')
  }));

  return NextResponse.json({ options });
}
