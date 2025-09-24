// src/app/api/auth/[...nextauth]/route.ts
import { authOptions } from '@/lib/auth-options';
import NextAuth from 'next-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Spread authOptions and conditionally add trustHost
const handler = NextAuth({
  ...authOptions,
  ...(process.env.AUTH_TRUST_HOST === 'true' ? { trustHost: true } : {})
});

export { handler as GET, handler as POST };
