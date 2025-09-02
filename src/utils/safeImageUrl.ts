// src/utils/safeImageUrl.ts
/**
 * Turn whatever we get from imports (Wix IDs, /media paths, Drive links, etc.)
 * into a full, displayable URL for <Image/>.
 * Returns null if we can't confidently resolve it.
 */

type Source =
  | 'wix'
  | 'wix-id'
  | 'wix-media'
  | 'wix-image-v1'
  | 'google-drive'
  | 'google-photos'
  | 'google-static'
  | 'other'
  | 'invalid';

const WIX_MEDIA_HOST = 'https://static.wixstatic.com';
const WIX_MEDIA_PREFIX = `${WIX_MEDIA_HOST}/media/`;

// e.g. 96bfc4_a4613d3675074b0b97f11a2f8093f585~mv2.webp
const WIX_ID_RE = /^[0-9a-f]{6,}_[^/]+~mv2\.[a-z0-9]+$/i;

export function safeImageUrl(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  // protocol-relative → https
  if (s.startsWith('//')) s = 'https:' + s;

  // 1) Bare Wix media id
  if (WIX_ID_RE.test(s)) return WIX_MEDIA_PREFIX + s;

  // 2) Wix /media/... path
  if (s.startsWith('/media/')) return WIX_MEDIA_HOST + s;

  // 3) wix:image://v1/... try taking the tail which is usually the media id with extension
  if (s.startsWith('wix:image://v1/')) {
    const last = s.split('/').pop();
    if (last && WIX_ID_RE.test(last)) return WIX_MEDIA_PREFIX + last;
    // if it doesn't match, we can't safely resolve
  }

  // If it's not an http(s) URL yet, try to encode & validate
  if (!/^https?:\/\//i.test(s)) {
    try {
      // try interpreting as URL; if fails, encode
      new URL(s);
    } catch {
      s = encodeURI(s);
    }
  }

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }

  const host = u.hostname.toLowerCase();

  // 4) Google Drive → convert to direct "view" URL
  if (host === 'drive.google.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    const fileIdx = parts.indexOf('file');
    let id: string | null = null;
    if (fileIdx !== -1) {
      const dIdx = parts.indexOf('d', fileIdx);
      if (dIdx !== -1 && parts[dIdx + 1]) id = parts[dIdx + 1];
    }
    if (!id) id = u.searchParams.get('id');

    if (id) {
      const direct = new URL('https://drive.google.com/uc');
      direct.searchParams.set('export', 'view');
      direct.searchParams.set('id', id);
      return direct.toString();
    }
    return null;
  }

  // 5) Google Photos / accounts CDN
  if (host.endsWith('googleusercontent.com') || host.endsWith('ggpht.com')) {
    return u.toString();
  }

  // 6) Static Google assets
  if (host.endsWith('gstatic.com')) {
    return u.toString();
  }

  // 7) Wix absolute
  if (host === 'static.wixstatic.com' || host.endsWith('.wixstatic.com')) {
    return u.toString();
  }

  // 8) Other CDNs/sites: allow as-is
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    return u.toString();
  }

  return null;
}
