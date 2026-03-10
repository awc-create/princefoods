// src/app/api/admin/options/customers/route.ts
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
        deletedAt: null,
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { name: { contains: q, mode: 'insensitive' as const } },
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } }
        ]
      }
    : { deletedAt: null };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take,
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true
    }
  });

  const options: PickerOption[] = users.map((u) => {
    const fullName =
      `${(u.firstName ?? '').trim()} ${(u.lastName ?? '').trim()}`.trim() || (u.name ?? '').trim();
    const label = fullName || u.email || '(Unnamed user)';
    const meta = u.email ? u.email : undefined;
    return { id: u.id, label, meta };
  });

  return NextResponse.json({ options });
}
