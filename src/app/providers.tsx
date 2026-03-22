'use client';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import React from 'react';

export default function Providers({
  children,
  session
}: {
  children: React.ReactNode;
  // Pre-fetched server session passed down from the root layout.
  // Seeding SessionProvider this way means useSession() is immediately
  // `authenticated` on first render — no client-side fetch needed, no
  // loading flash, and the nav correctly shows AccountMenu right after
  // a Google OAuth redirect without waiting for /api/auth/session.
  session?: Session | null;
}) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={true} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
