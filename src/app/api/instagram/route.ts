// src/app/api/instagram/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

type MediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;

interface GraphMedia {
  id: string;
  permalink: string;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  media_type: MediaType;
}

interface GraphResponse {
  data?: GraphMedia[];
}

interface InstagramItem {
  id: string;
  url: string;
  img: string;
  caption: string;
}

const ENV_TOKEN = process.env.INSTAGRAM_TOKEN; // optional fallback
const DEFAULT_LIMIT = 12;
export const revalidate = 900; // cache for 15 minutes

export async function GET() {
  try {
    // 1) Try to read token from DB (admin-managed)
    const row = await prisma.homeSettings.findUnique({ where: { id: 1 } });
    const ig = (row?.instagram ?? {}) as { token?: string; enabled?: boolean };

    if (ig?.enabled === false) {
      return NextResponse.json({ items: [], error: 'disabled' as const }, { status: 200 });
    }

    const token = (ig?.token?.trim() ?? ENV_TOKEN ?? '').trim();
    if (!token) {
      return NextResponse.json({ items: [], error: 'missing_token' as const }, { status: 200 });
    }

    // 2) Fetch from Instagram
    const url =
      `https://graph.instagram.com/me/media` +
      `?fields=id,permalink,media_url,thumbnail_url,caption,media_type` +
      `&access_token=${encodeURIComponent(token)}&limit=${DEFAULT_LIMIT}`;

    const res = await fetch(url, { cache: 'force-cache', next: { revalidate } });
    if (!res.ok) {
      return NextResponse.json({ items: [], error: 'fetch_failed' as const }, { status: 200 });
    }

    const json = (await res.json()) as GraphResponse;
    const raw = Array.isArray(json?.data) ? json.data : [];

    const items: InstagramItem[] = raw
      .filter((m) => ['IMAGE', 'CAROUSEL_ALBUM', 'VIDEO'].includes(m.media_type))
      .map((m) => ({
        id: m.id,
        url: m.permalink,
        // Prefer actual image; for VIDEO use thumbnail
        img:
          m.media_type === 'VIDEO' ? (m.thumbnail_url ?? m.media_url ?? '') : (m.media_url ?? ''),
        caption: m.caption ?? ''
      }))
      .filter((x) => x.img);

    return NextResponse.json({ items }, { status: 200 });
  } catch {
    return NextResponse.json({ items: [], error: 'fetch_failed' as const }, { status: 200 });
  }
}
