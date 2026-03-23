'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

import CrispChat from '@/components/chat/CrispChat';
import CrispTriggers from '@/components/chat/CrispTriggers';
import CartDrawer from '@/components/ecommerce/basket/CartDrawer';
import Footer from '@/components/footer/Footer';
import Navbar from '@/components/navbar/Navbar';

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
    <>
      {!isAdmin && <Navbar />}
      <main>{children}</main>
      {!isAdmin && modal}

      {/* Crisp web widget (hide in admin) */}
      {!isAdmin && (
        <>
          <CrispChat />
          <CrispTriggers />
        </>
      )}
      {!isAdmin && <Footer />}

      {/* Basket drawer lives globally (not needed in admin) */}
      {!isAdmin && <CartDrawer />}
    </>
  );
}
