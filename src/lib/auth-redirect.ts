// src/lib/auth-redirect.ts
/** Normalise callback URLs for the PUBLIC site. */
export function safePublicCallbackUrl(raw?: string | null) {
  if (!raw) return '/'; // default after public login
  return raw.startsWith('/admin/login') ? '/' : raw; // avoid loops
}

/** Normalise callback URLs for the ADMIN area. */
export function safeAdminCallbackUrl(raw?: string | null) {
  if (!raw) return '/admin'; // default after admin login
  return raw.startsWith('/admin/login') ? '/admin' : raw; // avoid loops
}
