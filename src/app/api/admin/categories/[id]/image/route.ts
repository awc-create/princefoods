// src/app/api/admin/categories/[id]/image/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface SessionUserWithRole {
  role?: Role | null;
}

const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

const ADMIN_ROLES = new Set<Role>(['HEAD', 'STAFF']);

function extFromMime(mime: string | null | undefined): string {
  const m = (mime ?? '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/avif') return 'avif';
  return 'jpg';
}

function extFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const idx = name.lastIndexOf('.');
  if (idx === -1) return null;
  const ext = name
    .slice(idx + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return ext || null;
}

export async function POST(req: Request, ctx: unknown) {
  try {
    // ✅ Cast the 2nd arg inside (avoids Next’s validator complaint)
    const { params } = ctx as { params: { id: string } };
    const id = params.id;

    const session = await getServerSession(authOptions);
    const role = hasRole(session?.user) ? (session!.user.role ?? null) : null;
    if (!role) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 });
    }

    const mime = file.type ?? '';
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Only images are allowed' }, { status: 400 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'categories');
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = extFromName(file.name) ?? extFromMime(mime) ?? 'jpg';
    const unique = crypto.randomBytes(4).toString('hex');
    const name = `${id}-${Date.now()}-${unique}.${ext}`;
    const fullPath = path.join(uploadsDir, name);

    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(fullPath, buf);

    const url = `/uploads/categories/${name}`;

    await prisma.category.update({
      where: { id },
      data: { imageUrl: url },
      select: { id: true }
    });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
