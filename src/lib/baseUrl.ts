export function getBaseUrl() {
  const envUrl =
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  if (envUrl) return envUrl.replace(/\/$/, '');
  const port = process.env.PORT ?? 3000;
  return `http://localhost:${port}`;
}
