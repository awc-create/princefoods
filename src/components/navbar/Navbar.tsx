"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "./Navbar.module.scss";
import { NAV_LINKS } from "@/config/menu.config";

// Dynamic import with SSR disabled
const CartIcon = dynamic(() => import("@/components/ecommerce/basket/CartIcon"), { ssr: false });
const LoginButton = dynamic(() => import("@/components/ecommerce/login/LoginButton"), { ssr: false });

export default function Navbar({ isEcommerce = true }: { isEcommerce?: boolean }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => setMenuOpen(prev => !prev), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  // Dynamically identify the 'Shop' link
  const shopLink = NAV_LINKS.find(link => link.slug === "shop");
  const mainLinks = NAV_LINKS.filter(link => link.slug !== "shop");

  return (
    <header className={styles.navbar}>
      <div className={styles.topRow}>
        <div /> {/* Left spacer for centered logo */}

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
            <Icon icon="ic:round-search" width="20" />
          </div>
        </div>

        <button className={styles.hamburger} onClick={toggleMenu} aria-label="Toggle menu">
          <Icon icon={menuOpen ? "mdi:close" : "mdi:menu"} width="28" height="28" />
        </button>
      </div>

      <nav className={styles.navRow}>
        <div className={styles.links}>
          {mainLinks.map(({ slug, label }) => {
            const href = `/${slug}`;
            const isActive = pathname === href;
            return (
              <Link key={slug} href={href} className={isActive ? styles.active : ""}>
                {label}
              </Link>
            );
          })}
        </div>

        {shopLink && (
          <div className={styles.shopLink}>
            <Link
              href={`/${shopLink.slug}`}
              className={pathname === `/${shopLink.slug}` ? styles.active : ""}
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
                className={isActive ? styles.active : ""}
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
