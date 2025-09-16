// src/lib/auth-redirect.ts
/** Normalise callback URLs for PUBLIC site (customers). */
export function safePublicCallbackUrl(raw?: string | null) {
  if (!raw) return '/';
  return raw.startsWith('/admin/login') ? '/' : raw;
}

/** Normalise callback URLs for ADMIN site (staff). */
export function safeAdminCallbackUrl(raw?: string | null) {
  if (!raw) return '/admin';
  return raw.startsWith('/admin/login') ? '/admin' : raw;
}
