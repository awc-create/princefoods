'use client';

import '@/styles/Global.scss';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/navbar/Navbar';
import Footer from '@/components/footer/Footer';
import PrinceChat from '@/components/chat/PrinceChat';
import Providers from './providers';

const isEcommerce = process.env.NEXT_PUBLIC_SITE_MODE === 'ecommerce';

export default function RootLayout({
  children,
  modal,                        // parallel route slot
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar isEcommerce={isEcommerce} />
          <main>{children}</main>
          {modal}
          {!isAdmin && <PrinceChat />}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
