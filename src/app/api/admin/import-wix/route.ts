import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parse } from 'csv-parse/sync';

export const dynamic = 'force-dynamic';

type Row = Record<string, string>;

const get = (r: Row, k: string) => (r[k] ?? '').trim();
const getLower = (r: Row, k: string) => get(r, k).toLowerCase();

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const rows = parse(buf, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

  let created = 0;
  let updated = 0;

  for (const r of rows) {
    const email = (getLower(r, 'Email') || getLower(r, 'email'));
    if (!email) continue;

    const createdAtStr = get(r, 'Created At (UTC+0)') || get(r, 'Created At');
    const lastActDateStr = get(r, 'Last Activity Date (UTC+0)') || get(r, 'Last Activity Date');

    const wixCreatedAt = createdAtStr ? new Date(createdAtStr) : null;
    const wixLastActivityAt = lastActDateStr ? new Date(lastActDateStr) : null;

    const data = {
      email,
      name: email, // fallback to satisfy required name
      source: 'WIX' as const,
      role: 'VIEWER' as const,
      wixSubscriberStatus: get(r, 'Email subscriber status') || null,
      wixLanguage: get(r, 'Language') || null,
      wixCreatedAt: wixCreatedAt ?? undefined,
      wixLastActivity: get(r, 'Last Activity') || null,
      wixLastActivityAt: wixLastActivityAt ?? undefined,
      wixSource: get(r, 'Source') || null,
      wixImportedAt: new Date(),
      welcomeStatus: 'PENDING' as const,
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await prisma.user.create({ data });
      created++;
    } else {
      await prisma.user.update({
        where: { email },
        data: {
          // keep LOCAL if they already signed up here
          source: existing.source === 'LOCAL' ? 'LOCAL' : 'WIX',
          wixSubscriberStatus: data.wixSubscriberStatus,
          wixLanguage: data.wixLanguage,
          wixCreatedAt: data.wixCreatedAt ?? existing.wixCreatedAt,
          wixLastActivity: data.wixLastActivity ?? existing.wixLastActivity,
          wixLastActivityAt: data.wixLastActivityAt ?? existing.wixLastActivityAt,
          wixSource: data.wixSource ?? existing.wixSource,
          wixImportedAt: existing.wixImportedAt ?? new Date(),
          // don’t overwrite password or name unless missing
          name: existing.name ?? data.name,
        },
      });
      updated++;
    }
  }

  return NextResponse.json({ ok: true, created, updated });
}
