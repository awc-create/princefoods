"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.scss";
import { NAV_LINKS } from "@/config/menu.config";

export default function Navbar({ isEcommerce = false }: { isEcommerce?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [CartIcon, setCartIcon] = useState<React.FC | null>(null);
  const [LoginButton, setLoginButton] = useState<React.FC | null>(null);
  const pathname = usePathname();

  const toggleMenu = () => setMenuOpen((prev) => !prev);
  const closeMenu = () => setMenuOpen(false);

  const navItems = NAV_LINKS;

  useEffect(() => {
    const loadIcons = async () => {
      if (isEcommerce && typeof window !== "undefined") {
        try {
          const cart = await import("@/components/ecommerce/basket/CartIcon").then(mod => mod.default);
          const login = await import("@/components/ecommerce/login/LoginButton").then(mod => mod.default);
          setCartIcon(() => cart);
          setLoginButton(() => login);
        } catch (err) {
          console.warn("⚠️ E-commerce components not found. Skipping...");
        }
      }
    };

    loadIcons();
  }, [isEcommerce]);

  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} onClick={closeMenu}>
          <Image
            src="/assets/navbar.png"
            alt="Logo"
            width={350}
            height={350}
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <div className={styles.desktopLinks}>
          {navItems.map(({ slug, label }) => {
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
        </div>

        {/* Ecommerce Icons */}
        {isEcommerce && CartIcon && LoginButton && (
          <div className={styles.actions}>
            <CartIcon />
            <LoginButton />
          </div>
        )}

        {/* Mobile Toggle */}
        <button
          className={styles.hamburger}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <Icon icon={menuOpen ? "mdi:close" : "mdi:menu"} width="28" height="28" />
        </button>
      </div>

      {/* Mobile Menu */}
      <div className={`${styles.mobileMenu} ${menuOpen ? styles.open : ""}`}>
        {navItems.map(({ slug, label }) => {
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
      </div>
    </nav>
  );
}
