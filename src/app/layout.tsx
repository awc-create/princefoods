// src/app/layout.tsx (SERVER)
// ❌ no "use client" here
import { absUrl } from '@/lib/abs-url';
import { urlFrom } from '@/lib/url';
import '@/styles/Global.scss';
import type { Metadata } from 'next';
import ClientShell from './ClientShell';

export const metadata: Metadata = {
  // ✅ safe even if env is missing
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
