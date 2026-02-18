import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/route-ctx';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authFail(e: unknown) {
  const msg = e instanceof Error ? e.message : 'UNAUTHENTICATED';
  const status = msg === 'FORBIDDEN' ? 403 : 401;
  return NextResponse.json({ error: msg }, { status });
}

function splitCollection(full?: string | null) {
  const parts = (full ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const parent = parts[0] ?? '';
  const child = parts.length > 1 ? parts[parts.length - 1] : '';
  return { parent, child };
}

interface ApiChild {
  full: string;
  label: string;
  count: number;
}
interface ApiGroup {
  parent: string;
  total: number;
  children: ApiChild[];
}

export async function GET() {
  try {
    await requireAdmin();

    // Group by the exact collection string stored on Product.collection
    const rows = await prisma.product.groupBy({
      by: ['collection'],
      where: { collection: { not: null } },
      _count: { id: true }, // ✅ count by a real field
      orderBy: [{ _count: { id: 'desc' } }]
    });

    // Build parent -> children structure
    const groups = new Map<string, ApiGroup>();

    for (const r of rows) {
      const full = (r.collection ?? '').trim();
      if (!full) continue;

      const { parent, child } = splitCollection(full);
      const count = r._count.id;

      const groupKey = parent || 'Other';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { parent: groupKey, total: 0, children: [] });
      }

      const g = groups.get(groupKey)!;
      g.total += count;

      // label = child if exists else parent (so you don’t show "Groceries; Groceries")
      const label = child || parent || full;

      g.children.push({ full, label, count });
    }

    // Sort children A→Z, keep groups by total desc then A→Z
    const out = Array.from(groups.values())
      .map((g) => ({
        ...g,
        children: g.children.sort((a, b) => a.label.localeCompare(b.label))
      }))
      .sort((a, b) => b.total - a.total || a.parent.localeCompare(b.parent));

    return NextResponse.json({ groups: out });
  } catch (e) {
    return authFail(e);
  }
}
