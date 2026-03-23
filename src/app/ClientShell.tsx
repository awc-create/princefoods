'use client';

import { usePathname } from 'next/navigation';
import React, { useEffect, useState } from 'react';

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
  const _pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setIsAdmin(
      host.startsWith('admin.') || host === 'admin.localhost' || host === 'admin.127.0.0.1'
    );
  }, []);

  return (
    <>
      {!isAdmin && <Navbar />}
      <main>{children}</main>
      {!isAdmin && modal}
      {!isAdmin && (
        <>
          <CrispChat />
          <CrispTriggers />
        </>
      )}
      {!isAdmin && <Footer />}
      {!isAdmin && <CartDrawer />}
    </>
  );
}
