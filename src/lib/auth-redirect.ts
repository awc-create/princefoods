// src/lib/auth-redirect.ts
/** Normalise callback URLs for the PUBLIC site (customers). */
export function safePublicCallbackUrl(raw?: string | null) {
  // Default to home (or change to '/account' if you add one)
  if (!raw) return '/';
  // Never bounce back to the admin login route
  return raw.startsWith('/admin/login') ? '/' : raw;
}

/** Normalise callback URLs for the ADMIN site (staff). */
export function safeAdminCallbackUrl(raw?: string | null) {
  // Default to the admin dashboard
  if (!raw) return '/admin';
  // Avoid loops to admin login
  return raw.startsWith('/admin/login') ? '/admin' : raw;
}
