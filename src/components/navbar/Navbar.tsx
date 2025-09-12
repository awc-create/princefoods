// src/components/navbar/Navbar.tsx  (adjust the path if yours differs)
'use client';

import { NAV_LINKS } from '@/config/menu.config';
import { Menu, Search, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import styles from './Navbar.module.scss';

const CartIcon = dynamic(() => import('@/components/ecommerce/basket/CartIcon'), { ssr: false });
const LoginButton = dynamic(() => import('@/components/ecommerce/login/LoginButton'), {
  ssr: false
});

export default function Navbar({ isEcommerce = true }: { isEcommerce?: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  const shopLink = NAV_LINKS.find((link) => link.slug === 'shop');
  const mainLinks = NAV_LINKS.filter((link) => link.slug !== 'shop');

  return (
    <header className={styles.navbar}>
      <div className={styles.topRow}>
        <div />

        <div className={styles.logo}>
          <Image
            src="/assets/prince-foods-logo.png"
            alt="Prince Foods"
            width={260}
            height={140}
            priority
          />
        </div>

        <div className={styles.searchWrapper}>
          <div className={styles.ribbonAbove}>
            <Image src="/assets/royal-treat.png" alt="A Royal Treat" width={200} height={120} />
          </div>
          <div className={styles.search}>
            <input type="text" placeholder="Search..." aria-label="Search" />
            <Search width={20} height={20} aria-hidden />
          </div>
        </div>

        <button className={styles.hamburger} onClick={toggleMenu} aria-label="Toggle menu">
          {menuOpen ? <X width={28} height={28} /> : <Menu width={28} height={28} />}
        </button>
      </div>

      <nav className={styles.navRow}>
        <div className={styles.links}>
          {mainLinks.map(({ slug, label }) => {
            const href = `/${slug}`;
            const isActive = pathname === href;
            return (
              <Link key={slug} href={href} className={isActive ? styles.active : ''}>
                {label}
              </Link>
            );
          })}
        </div>

        {shopLink && (
          <div className={styles.shopLink}>
            <Link
              href={`/${shopLink.slug}`}
              className={pathname === `/${shopLink.slug}` ? styles.active : ''}
            >
              {shopLink.label}
            </Link>
          </div>
        )}

        {isEcommerce && (
          <div className={styles.actions}>
            <CartIcon />
            <LoginButton />
          </div>
        )}
      </nav>

      {menuOpen && (
        <nav className={styles.mobileMenu}>
          {NAV_LINKS.map(({ slug, label }) => {
            const href = `/${slug}`;
            const isActive = pathname === href;
            return (
              <Link
                key={slug}
                href={href}
                onClick={closeMenu}
                className={isActive ? styles.active : ''}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
