// src/app/layout.tsx (SERVER ONLY – no "use client")
import '@/instrument/url-guard'; // activates only when BUILD_URL_GUARD=1
import { absUrl } from '@/lib/abs-url';
import { urlFrom } from '@/lib/url';
import '@/styles/Global.scss';
import type { Metadata } from 'next';
import ClientShell from './ClientShell';

export const metadata: Metadata = {
  // metadataBase expects a URL object – urlFrom('/') returns URL
  metadataBase: urlFrom('/'),
  title: {
    default: 'Prince Foods',
    template: '%s — Prince Foods'
  },
  description: 'South Asian groceries at unbeatable everyday prices.',
  openGraph: {
    images: [absUrl('/og.png')]
  },
  twitter: {
    images: [absUrl('/og.png')]
  },
  icons: {
    icon: absUrl('/favicon.ico')
  },
  alternates: {
    canonical: absUrl('/')
  }
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
        <ClientShell modal={modal}>{children}</ClientShell>
      </body>
    </html>
  );
}
