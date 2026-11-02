// src/app/api/admin/upload/delete/route.ts
import { deleteFromStorage, getObjectKeyFromPublicUrl } from '@/lib/storage';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export async function POST(req: Request) {
  const guard = await requireAdmin({ write: true });
  if (!guard.ok) return guard.response;

  try {
    const body = (await req.json()) as {
      objectKey?: string;
      url?: string;
    };

    const objectKey =
      typeof body.objectKey === 'string' && body.objectKey.trim()
        ? body.objectKey.trim()
        : typeof body.url === 'string' && body.url.trim()
          ? getObjectKeyFromPublicUrl(body.url.trim())
          : null;

    if (!objectKey) {
      return NextResponse.json(
        { ok: false, error: 'Missing objectKey or valid storage URL' },
        { status: 400 }
      );
    }

    await deleteFromStorage(objectKey);

    return NextResponse.json({
      ok: true,
      deleted: {
        objectKey
      }
    });
  } catch (error) {
    console.error('Delete failed:', error);
    return NextResponse.json({ ok: false, error: 'Delete failed' }, { status: 500 });
  }
}
