// src/app/api/healthz/route.ts
export async function GET() {
  // Don't render anything; just signal OK.
  return new Response(null, { status: 204 });
}

// If someone POSTs/HEADs, still say OK:
export const runtime = 'nodejs';
export async function HEAD() {
  return new Response(null, { status: 204 });
}
export async function POST() {
  return new Response(null, { status: 204 });
}
