import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';

import path from 'node:path';
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

/** ↓ Add these two lines ↓ */
type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type SessionUserWithRole = { role?: Role };

export async function POST(
  req: Request,
  { params }: { params: Record<string, string | string[]> }
) {
  try {
    const session = await getServerSession(authOptions);
    /** ↓ Replace any-cast with typed narrowing ↓ */
    const role = (session?.user as SessionUserWithRole)?.role;
    if (!role) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 });

    if (!file.type?.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Only images are allowed' }, { status: 400 });
    }

    const id = String(params.id);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'categories');
    await fs.mkdir(uploadsDir, { recursive: true });

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const name = `${id}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const fullPath = path.join(uploadsDir, name);

    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(fullPath, buf);

    const url = `/uploads/categories/${name}`;

    await prisma.category.update({
      where: { id },
      data: { imageUrl: url },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, url });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return NextResponse.json({ ok: false, error: err?.message || 'Upload failed' }, { status: 500 });
  }
}
