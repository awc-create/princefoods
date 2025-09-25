// src/app/ClientShell.tsx
'use client';

import PrinceChat from '@/components/chat/PrinceChat';
import CartDrawer from '@/components/ecommerce/basket/CartDrawer';
import Footer from '@/components/footer/Footer';
import Navbar from '@/components/navbar/Navbar';
import { usePathname } from 'next/navigation';
import React from 'react';

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
      <Navbar />
      <main>{children}</main>
      {modal}
      {!isAdmin && <PrinceChat />}
      <Footer />
      {/* Basket drawer lives globally */}
      <CartDrawer />
    </>
  );
}
