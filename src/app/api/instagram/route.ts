import { NextResponse } from 'next/server';

const IG_TOKEN = process.env.INSTAGRAM_TOKEN; // Long-lived token
const LIMIT = 12;

interface GraphMedia {
  id: string;
  permalink: string;
  media_url?: string;
  thumbnail_url?: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;
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

export async function GET() {
  if (!IG_TOKEN) {
    return NextResponse.json({ items: [], error: 'missing_token' as const });
  }

  try {
    const url =
      `https://graph.instagram.com/me/media` +
      `?fields=id,permalink,media_url,thumbnail_url,caption,media_type` +
      `&access_token=${IG_TOKEN}&limit=${LIMIT}`;

    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      return NextResponse.json({ items: [], error: 'fetch_failed' as const });
    }

    const json = (await res.json()) as GraphResponse;
    const raw = Array.isArray(json?.data) ? json.data : [];

    const items: InstagramItem[] = raw
      .filter((m) => ['IMAGE', 'CAROUSEL_ALBUM', 'VIDEO'].includes(m.media_type))
      .map((m) => ({
        id: m.id,
        url: m.permalink,
        img: m.thumbnail_url ?? m.media_url ?? '',
        caption: m.caption ?? ''
      }))
      .filter((x) => x.img !== '');

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: 'fetch_failed' as const });
  }
}
