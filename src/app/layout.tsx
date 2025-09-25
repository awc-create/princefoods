// src/app/layout.tsx (SERVER)
import { absUrl } from '@/lib/abs-url';
import { urlFrom } from '@/lib/url';
import '@/styles/Global.scss';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ClientShell from './ClientShell';
import ModalLayer from './ModalLayer';
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

export default function RootLayout({
  children,
  modal
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="page-wrapper">
            {/* Guard everything that might use useSearchParams (Navbar, etc.) */}
            <Suspense fallback={<div style={{ height: 64 }} />}>
              <ClientShell modal={modal}>{children}</ClientShell>
            </Suspense>

            {/* Guard ModalLayer too if it reads ?from or other params */}
            <Suspense fallback={null}>
              <ModalLayer />
            </Suspense>
          </div>
        </Providers>
      </body>
    </html>
  );
}
