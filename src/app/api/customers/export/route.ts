import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join(
    '\n'
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') ?? 'csv').toLowerCase(); // csv | json
  const status = searchParams.get('status'); // active|restricted|anonymized|all

  const where: Prisma.UserWhereInput = {};
  if (status === 'restricted') where.deletedAt = { not: null };
  else if (status === 'anonymized') where.isAnonymized = true;
  else if (status !== 'all') where.deletedAt = null;

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phoneRaw: true,
      role: true,
      source: true,
      deletedAt: true,
      restrictedAt: true,
      isAnonymized: true,
      anonymizedAt: true,
      deletionReason: true,
      restrictionNote: true,
      createdAt: true
    }
  });

  if (format === 'json') {
    return NextResponse.json({ items: users });
  }

  const rows: Array<Record<string, unknown>> = users.map((u) => ({ ...u }));
  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customers_${status ?? 'active'}.csv"`
    }
  });
}
