// src/app/api/admin/upload/route.ts
import { buildObjectKey, uploadBufferToStorage } from '@/lib/storage';
import { NextResponse } from 'next/server';

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024; // 150MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

function resolveMediaType(mimeType: string): 'images' | 'videos' {
  if (mimeType.startsWith('video/')) return 'videos';
  return 'images';
}

function parsePathSegments(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x)).filter(Boolean);
    }
  } catch {
    return value
      .split('/')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  return [];
}

function isAllowedImageType(mimeType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_TYPES)[number]);
}

function isAllowedVideoType(mimeType: string): boolean {
  return ALLOWED_VIDEO_TYPES.includes(mimeType as (typeof ALLOWED_VIDEO_TYPES)[number]);
}

function getAllowedTypesMessage(): string {
  return 'Unsupported file type. Allowed image types: JPG, PNG, WEBP. Allowed video types: MP4, WEBM.';
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get('file');
    const itemName = String(formData.get('itemName') ?? '').trim();
    const pathSegments = parsePathSegments(formData.get('pathSegments'));

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    if (!itemName) {
      return NextResponse.json({ ok: false, error: 'Missing itemName' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ ok: false, error: 'Empty file' }, { status: 400 });
    }

    const mimeType = file.type || 'application/octet-stream';
    const isImage = isAllowedImageType(mimeType);
    const isVideo = isAllowedVideoType(mimeType);

    if (!isImage && !isVideo) {
      return NextResponse.json({ ok: false, error: getAllowedTypesMessage() }, { status: 400 });
    }

    if (isImage && file.size > MAX_IMAGE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Image too large. Maximum allowed size is 8MB.' },
        { status: 400 }
      );
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: 'Video too large. Maximum allowed size is 150MB.' },
        { status: 400 }
      );
    }

    const mediaType = resolveMediaType(mimeType);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const objectKey = buildObjectKey({
      root: 'prince-foods-b2c',
      pathSegments,
      mediaType,
      itemName,
      filename: file.name
    });

    const uploaded = await uploadBufferToStorage({
      buffer,
      objectKey,
      contentType: mimeType
    });

    return NextResponse.json({
      ok: true,
      file: {
        name: file.name,
        size: file.size,
        type: mimeType,
        objectKey: uploaded.objectKey,
        url: uploaded.url
      }
    });
  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({ ok: false, error: 'Upload failed' }, { status: 500 });
  }
}
