// src/app/ClientShell.tsx (CLIENT)
'use client';

import PrinceChat from '@/components/chat/PrinceChat';
import Footer from '@/components/footer/Footer';
import Navbar from '@/components/navbar/Navbar';
import { usePathname } from 'next/navigation';
import Providers from './providers';

const isEcommerce = process.env.NEXT_PUBLIC_SITE_MODE === 'ecommerce';

export default function ClientShell({
  children,
  modal
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') ?? false;

  return (
    <Providers>
      <Navbar isEcommerce={isEcommerce} />
      <main>{children}</main>
      {modal}
      {!isAdmin && <PrinceChat />}
      <Footer />
    </Providers>
  );
}
