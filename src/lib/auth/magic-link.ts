// lib/auth/magic-link.ts

/**
 * Build a NextAuth EmailProvider callback URL that will LOG THE USER IN when clicked.
 * It must contain:
 *   - email (identifier)
 *   - token (raw, unprefixed — the one we stored for NextAuth)
 *   - callbackUrl (where to land after sign-in)
 */
export function buildNextAuthMagicLink(
  origin: string,
  email: string,
  tokenRawNextAuth: string,
  afterUrl?: string
) {
  const callbackUrl = encodeURIComponent(afterUrl ?? origin);
  const emailParam = encodeURIComponent(email);
  const tokenParam = encodeURIComponent(tokenRawNextAuth);

  return `${origin}/api/auth/callback/email?email=${emailParam}&token=${tokenParam}&callbackUrl=${callbackUrl}`;
}

/**
 * Decide which base URL to use (public vs admin) from request Host header or config.
 * Falls back to env if header is missing.
 */
export function resolveAuthOrigin(hostHeader?: string | null) {
  const isAdminHost =
    (hostHeader?.toLowerCase() ?? '').startsWith('admin.') ||
    (process.env.NEXTAUTH_URL_ADMIN ?? '').includes(hostHeader ?? '_');

  if (isAdminHost) {
    return (
      process.env.NEXTAUTH_URL_ADMIN ??
      process.env.NEXT_PUBLIC_ADMIN_URL ??
      `https://admin.${process.env.DOMAIN ?? 'example.com'}`
    );
  }

  return (
    process.env.NEXTAUTH_URL_PUBLIC ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    `https://${process.env.DOMAIN ?? 'example.com'}`
  );
}
