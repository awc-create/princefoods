// src/app/api/admin/categories/[id]/image/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';

import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type SessionUserWithRole = { role?: Role | null };
type Params = { params: { id: string } };

const isAuthed = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

/** Map a MIME type to a safe extension, fallback to 'jpg'. */
function extFromMime(mime: string | null | undefined): string {
  const m = (mime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/avif') return 'avif';
  return 'jpg';
}

/** Get extension from filename safely. */
function extFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const idx = name.lastIndexOf('.');
  if (idx === -1) return null;
  const ext = name.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext || null;
}

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!isAuthed(session?.user) || !session.user.role) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    // (Optional) tighten auth to HEAD/STAFF only
    if (session.user.role !== 'HEAD' && session.user.role !== 'STAFF') {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 });
    }

    // Basic validation
    const mime = file.type || '';
    if (!mime.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Only images are allowed' }, { status: 400 });
    }

    const id = params.id;

    // Ensure target dir exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'categories');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Choose extension
    const guessedFromName = extFromName(file.name);
    const guessedFromMime = extFromMime(mime);
    const ext = (guessedFromName || guessedFromMime) || 'jpg';

    // Unique filename
    const unique = crypto.randomBytes(4).toString('hex');
    const name = `${id}-${Date.now()}-${unique}.${ext}`;
    const fullPath = path.join(uploadsDir, name);

    // Persist file
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(fullPath, buf);

    // Public URL (served from /public)
    const url = `/uploads/categories/${name}`;

    // Update category record
    await prisma.category.update({
      where: { id },
      data: { imageUrl: url },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
