// src/app/api/admin/categories/diagnostics/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const total = await prisma.category.count();
    const parents = await prisma.category.count({ where: { parentId: null } });
    const children = await prisma.category.count({ where: { parentId: { not: null } } });

    const parentSamples = await prisma.category.findMany({
      where: { parentId: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        position: true,
        imageUrl: true,
        isActive: true,
        _count: { select: { children: true } },
      },
      take: 10,
    });

    const childSamples = await prisma.category.findMany({
      where: { parentId: { not: null } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, parentId: true, isActive: true },
      take: 10,
    });

    return NextResponse.json({
      ok: true,
      counts: { total, parents, children },
      samples: { parents: parentSamples, children: childSamples },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'diagnostics failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
