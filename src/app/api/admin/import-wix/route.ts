import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { parse } from "csv-parse/sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "No file" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const rows = parse(buf, { columns: true, skip_empty_lines: true, trim: true });

  let created = 0, updated = 0;

  for (const r of rows as any[]) {
    const email = (r["Email"] || r["email"] || "").toLowerCase().trim();
    if (!email) continue;

    const createdAtStr = r["Created At (UTC+0)"] || r["Created At"];
    const lastActDateStr = r["Last Activity Date (UTC+0)"] || r["Last Activity Date"];

    const wixCreatedAt = createdAtStr ? new Date(createdAtStr) : null;
    const wixLastActivityAt = lastActDateStr ? new Date(lastActDateStr) : null;

    const data = {
      email,
      name: email, // fallback to satisfy required name
      source: "WIX" as const,
      role: "VIEWER" as const,
      wixSubscriberStatus: r["Email subscriber status"] || null,
      wixLanguage: r["Language"] || null,
      wixCreatedAt: wixCreatedAt ?? undefined,
      wixLastActivity: r["Last Activity"] || null,
      wixLastActivityAt: wixLastActivityAt ?? undefined,
      wixSource: r["Source"] || null,
      wixImportedAt: new Date(),
      welcomeStatus: "PENDING" as const,
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
          source: existing.source === "LOCAL" ? "LOCAL" : "WIX",
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
