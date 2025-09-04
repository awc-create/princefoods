// src/app/api/admin/products/import-delete/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// --- tiny CSV helpers (same behavior as importer) ---
function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else cur += c;
    } else {
      if (c === ',') {
        out.push(cur);
        cur = '';
      } else if (c === '"') inQ = true;
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

type CsvRows = Record<string, string>[];
function parseCSV(text: string): { headers: string[]; rows: CsvRows } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  const rows: CsvRows = lines.slice(1).map((line) => {
    const cols = splitCSVLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim();
    });
    return obj;
  });
  return { headers, rows };
}

function normalizeKeys(o: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(o)) out[k.replace(/\s+/g, '').toLowerCase()] = o[k];
  return out;
}

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type SessionUserWithRole = { role?: Role | null };
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user) ? (session!.user.role ?? undefined) : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ message: 'Invalid form data' }, { status: 400 });

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ message: 'Missing file' }, { status: 400 });

  const text = await file.text();
  const { headers, rows } = parseCSV(text);
  if (rows.length === 0) return NextResponse.json({ message: 'Empty file' }, { status: 400 });

  // We accept any of these column headers (case/space insensitive):
  // id, handleId, sku
  const headerSet = new Set(headers.map((h) => h.replace(/\s+/g, '').toLowerCase()));
  const acceptsId = headerSet.has('id') || headerSet.has('handleid');
  const acceptsSku = headerSet.has('sku');

  if (!acceptsId && !acceptsSku) {
    return NextResponse.json(
      { message: 'CSV must include at least one of: id/handleId or sku' },
      { status: 400 }
    );
  }

  const ids: string[] = [];
  const skus: string[] = [];

  for (const r of rows) {
    const row = normalizeKeys(r);
    const id = (row.id || row.handleid || '').trim();
    const sku = (row.sku || '').trim();
    if (id) ids.push(id);
    else if (sku) skus.push(sku);
  }

  if (ids.length === 0 && skus.length === 0) {
    return NextResponse.json({ message: 'No ids or skus found' }, { status: 400 });
  }

  // Do deletes in a transaction. We return the count of actually deleted items.
  let deleted = 0;

  await prisma.$transaction(async (tx) => {
    if (ids.length) {
      const res = await tx.product.deleteMany({ where: { id: { in: ids } } });
      deleted += res.count;
    }
    if (skus.length) {
      const res = await tx.product.deleteMany({
        where: { sku: { in: skus } },
      });
      deleted += res.count;
    }
  });

  return NextResponse.json({
    ok: true,
    deleted,
    receivedIds: ids.length,
    receivedSkus: skus.length,
  });
}
