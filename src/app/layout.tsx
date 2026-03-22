// src/app/layout.tsx (SERVER)
import { absUrl } from '@/lib/abs-url';
import { authOptions } from '@/lib/auth-options';
import { urlFrom } from '@/lib/url';
import '@/styles/Global.scss';
import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { Suspense } from 'react';
import ClientShell from './ClientShell';
import ModalLayer from './ModalLayer';
import MountedEffects from './mounted-effects';
import Providers from './providers';

export const metadata: Metadata = {
  metadataBase: urlFrom(absUrl('/')),
  title: { default: 'Prince Foods', template: '%s — Prince Foods' },
  description: 'South Asian groceries at unbeatable everyday prices.',
  openGraph: { images: [absUrl('/og.png')] },
  twitter: { images: [absUrl('/og.png')] },
  icons: { icon: absUrl('/favicon.ico') },
  alternates: { canonical: absUrl('/') }
};

export default async function RootLayout({
  children,
  modal
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  // Fetch the session on the server so SessionProvider can seed useSession()
  // immediately — no client-side fetch, no loading flash, nav shows the
  // correct state (AccountMenu vs LoginButton) on first render after OAuth.
  const session = await getServerSession(authOptions).catch(() => null);

  return (
    <html lang="en" suppressHydrationWarning>
      {/* ✅ suppress hydration warnings from extensions (Grammarly, etc.) */}
      <body className="no-transitions" suppressHydrationWarning>
        <Providers session={session}>
          <div className="page-wrapper">
            <Suspense fallback={<div style={{ height: 64 }} />}>
              <ClientShell modal={modal}>{children}</ClientShell>
            </Suspense>

            <Suspense fallback={null}>
              <ModalLayer />
            </Suspense>
          </div>

          {/* Runs only on client, after hydration */}
          <MountedEffects />
        </Providers>
      </body>
    </html>
  );
}
