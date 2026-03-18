// src/app/api/admin/upload/list/route.ts
import { listFilesFromStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parsePathSegments(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).filter(Boolean);
}

function getFileKindFromUrl(url: string): 'image' | 'video' | 'unknown' {
  const clean = url.split('?')[0].toLowerCase();

  if (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.avif')
  ) {
    return 'image';
  }

  if (clean.endsWith('.mp4') || clean.endsWith('.webm') || clean.endsWith('.mov')) {
    return 'video';
  }

  return 'unknown';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      pathSegments?: string[];
    };

    const pathSegments = parsePathSegments(body?.pathSegments);

    const prefixParts = ['prince-foods-b2c', ...pathSegments.map((x) => slugify(x))];
    const prefix = `${prefixParts.join('/')}/`;

    const files = await listFilesFromStorage(prefix);

    return NextResponse.json({
      ok: true,
      files: files
        .map((file) => ({
          ...file,
          type: getFileKindFromUrl(file.url)
        }))
        .sort((a, b) => {
          const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
          const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
          return bTime - aTime;
        })
    });
  } catch (error) {
    console.error('List files failed:', error);
    return NextResponse.json({ ok: false, error: 'Failed to list files' }, { status: 500 });
  }
}
