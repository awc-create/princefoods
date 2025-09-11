// src/app/layout.tsx (SERVER)
import { absUrl } from '@/lib/abs-url';
import { urlFrom } from '@/lib/url';
import '@/styles/Global.scss';
import type { Metadata } from 'next';
import ClientShell from './ClientShell';
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
          <ClientShell modal={modal}>{children}</ClientShell>
        </Providers>
      </body>
    </html>
  );
}
