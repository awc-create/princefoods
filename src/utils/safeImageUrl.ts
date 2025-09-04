// src/utils/safeImageUrl.ts
/**
 * Image URL detection + normalization (Wix, Drive/Photos, etc.)
 * - detectImageUrl: returns { url, source } for richer handling
 * - safeImageUrl:  legacy helper returning just string | null (compat)
 */

export type Source =
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

export function detectImageUrl(input?: string | null): { url: string | null; source: Source } {
  if (!input) return { url: null, source: 'invalid' };
  let s = String(input).trim();
  if (!s) return { url: null, source: 'invalid' };

  // protocol-relative → https
  if (s.startsWith('//')) s = 'https:' + s;

  // 1) Bare Wix media id
  if (WIX_ID_RE.test(s)) return { url: WIX_MEDIA_PREFIX + s, source: 'wix-id' };

  // 2) Wix /media/... path
  if (s.startsWith('/media/')) return { url: WIX_MEDIA_HOST + s, source: 'wix-media' };

  // 3) wix:image://v1/... tail usually the media id with extension
  if (s.startsWith('wix:image://v1/')) {
    const last = s.split('/').pop();
    if (last && WIX_ID_RE.test(last)) return { url: WIX_MEDIA_PREFIX + last, source: 'wix-image-v1' };
  }

  // Try to ensure a valid URL string
  if (!/^https?:\/\//i.test(s)) {
    try { new URL(s); } catch { s = encodeURI(s); }
  }

  let u: URL;
  try { u = new URL(s); } catch { return { url: null, source: 'invalid' }; }

  const host = u.hostname.toLowerCase();

  // 4) Google Drive → direct "view"
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
      return { url: direct.toString(), source: 'google-drive' };
    }
    return { url: null, source: 'invalid' };
  }

  // 5) Google Photos / accounts CDN
  if (host.endsWith('googleusercontent.com') || host.endsWith('ggpht.com')) {
    return { url: u.toString(), source: 'google-photos' };
  }

  // 6) Static Google assets
  if (host.endsWith('gstatic.com')) {
    return { url: u.toString(), source: 'google-static' };
  }

  // 7) Wix absolute
  if (host === 'static.wixstatic.com' || host.endsWith('.wixstatic.com')) {
    return { url: u.toString(), source: 'wix' };
  }

  // 8) Other valid http(s)
  if (u.protocol === 'http:' || u.protocol === 'https:') {
    return { url: u.toString(), source: 'other' };
  }

  return { url: null, source: 'invalid' };
}

/** Legacy helper for compatibility with existing callers. */
export function safeImageUrl(input?: string | null): string | null {
  return detectImageUrl(input).url;
}
