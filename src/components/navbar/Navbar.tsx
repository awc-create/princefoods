// src/components/navbar/Navbar.tsx
'use client';

import { NAV_LINKS } from '@/config/menu.config';
import { Menu, Search, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './Navbar.module.scss';

const CartIcon = dynamic(() => import('@/components/ecommerce/basket/CartIcon'), { ssr: false });
const LoginOrAccount = dynamic(() => import('@/components/ecommerce/login/LoginOrAccount'), {
  ssr: false
});

interface SearchResult {
  id: string;
  title: string;
  price: number | null;
  productImageUrl: string | null;
}

export default function Navbar() {
  return (
    <Suspense fallback={<div className={styles.navSkeleton} />}>
      <NavbarInner />
    </Suspense>
  );
}

function NavbarInner() {
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams();
  const router = useRouter();

  const _current = useMemo(() => {
    const qs = sp?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, sp]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const mobileWrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const inDesktop = wrapperRef.current?.contains(e.target as Node);
      const inMobile = mobileWrapperRef.current?.contains(e.target as Node);
      if (!inDesktop && !inMobile) {
        setShowDrop(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      setShowDrop(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&limit=6`, {
          cache: 'no-store'
        });
        const data = (await res.json()) as { products?: SearchResult[] };
        const results = (data.products ?? []).slice(0, 6);
        setSuggestions(results);
        setShowDrop(results.length > 0);
        setActiveIdx(-1);
      } catch {
        setSuggestions([]);
        setShowDrop(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      setShowDrop(false);
      setSuggestions([]);
      router.push(`/shop?q=${encodeURIComponent(q)}`);
      setSearchQuery('');
      setMenuOpen(false);
    },
    [searchQuery, router]
  );

  const handleSelect = (id: string) => {
    setShowDrop(false);
    setSuggestions([]);
    setSearchQuery('');
    router.push(`/product/${id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDrop || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx].id);
    } else if (e.key === 'Escape') {
      setShowDrop(false);
      setActiveIdx(-1);
    }
  };

  const normalizeImg = (src: string | null) =>
    !src || !src.trim()
      ? '/assets/prince-foods-logo.png'
      : src.startsWith('//')
        ? `https:${src}`
        : src;

  const shopLink = NAV_LINKS.find((link) => link.slug === 'shop');
  const mainLinks = NAV_LINKS.filter((link) => link.slug !== 'shop');

  return (
    <header className={styles.navbar}>
      {/* ── DESKTOP top row ── */}
      <div className={`${styles.topRow} ${styles.desktopOnly}`}>
        <div />
        <div className={styles.logo}>
          <Link href="/">
            <Image
              src="/assets/prince-foods-logo.png"
              alt="Prince Foods"
              width={260}
              height={140}
              priority
            />
          </Link>
        </div>
        <div className={styles.searchWrapper} ref={wrapperRef}>
          <div className={styles.ribbonAbove}>
            <Image src="/assets/royal-treat.png" alt="A Royal Treat" width={200} height={120} />
          </div>
          <form className={styles.search} onSubmit={handleSearch} role="search">
            <input
              type="text"
              placeholder="Search products..."
              aria-label="Search products"
              aria-autocomplete="list"
              aria-expanded={showDrop}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
              autoComplete="off"
            />
            {searchQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery('');
                  setSuggestions([]);
                  setShowDrop(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#999'
                }}
              >
                <X width={16} height={16} />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Submit search"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <Search width={20} height={20} aria-hidden />
              </button>
            )}
          </form>
          {showDrop && suggestions.length > 0 && (
            <div className={styles.dropdown} role="listbox">
              {suggestions.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIdx}
                  className={`${styles.dropItem} ${idx === activeIdx ? styles.dropItemActive : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item.id);
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <div className={styles.dropImg}>
                    <Image
                      src={normalizeImg(item.productImageUrl)}
                      alt={item.title}
                      width={40}
                      height={40}
                      style={{ objectFit: 'contain' }}
                    />
                  </div>
                  <div className={styles.dropMeta}>
                    <span className={styles.dropName}>{item.title}</span>
                    {item.price != null && (
                      <span className={styles.dropPrice}>£{item.price.toFixed(2)}</span>
                    )}
                  </div>
                </button>
              ))}
              <button
                type="button"
                className={styles.dropViewAll}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSearch(e as unknown as React.FormEvent);
                }}
              >
                <Search width={13} height={13} />
                See all results for &ldquo;{searchQuery}&rdquo;
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE row 1: Logo + Cart + Hamburger ── */}
      <div className={`${styles.mobileRow1} ${styles.mobileOnly}`}>
        <div className={styles.logo}>
          <Link href="/">
            <Image
              src="/assets/prince-foods-logo.png"
              alt="Prince Foods"
              width={160}
              height={86}
              priority
            />
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CartIcon />
          <button
            className={styles.hamburgerBtn}
            onClick={toggleMenu}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X width={26} height={26} /> : <Menu width={26} height={26} />}
          </button>
        </div>
      </div>

      {/* ── MOBILE row 2: Account + Search ── */}
      <div className={`${styles.mobileRow2} ${styles.mobileOnly}`} ref={mobileWrapperRef}>
        <div className={styles.mobileIcons}>
          <LoginOrAccount />
        </div>
        <form className={styles.mobileSearchForm} onSubmit={handleSearch} role="search">
          <input
            type="text"
            placeholder="Search products..."
            aria-label="Search products"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowDrop(true)}
            autoComplete="off"
          />
          <button type="submit" aria-label="Search">
            <Search width={17} height={17} />
          </button>
        </form>
        {showDrop && suggestions.length > 0 && (
          <div className={styles.mobileDropdown} role="listbox">
            {suggestions.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.dropItem} ${idx === activeIdx ? styles.dropItemActive : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item.id);
                }}
              >
                <div className={styles.dropImg}>
                  <Image
                    src={normalizeImg(item.productImageUrl)}
                    alt={item.title}
                    width={36}
                    height={36}
                    style={{ objectFit: 'contain' }}
                  />
                </div>
                <div className={styles.dropMeta}>
                  <span className={styles.dropName}>{item.title}</span>
                  {item.price != null && (
                    <span className={styles.dropPrice}>£{item.price.toFixed(2)}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop nav row ── */}
      <nav className={`${styles.navRow} ${styles.desktopOnly}`}>
        <div className={styles.links}>
          {mainLinks.map(({ slug, label, key }) => {
            const href = `/${slug}`;
            return (
              <Link
                key={(key ?? slug) || 'home'}
                href={href}
                className={pathname === href ? styles.active : ''}
              >
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
        <div className={styles.actions}>
          <CartIcon />
          <LoginOrAccount />
        </div>
      </nav>

      {/* ── Mobile nav menu (hamburger) ── */}
      {menuOpen && (
        <nav className={`${styles.mobileMenu} ${styles.mobileOnly} ${styles.open}`}>
          {NAV_LINKS.map(({ slug, label, key }) => {
            const href = `/${slug}`;
            return (
              <Link
                key={(key ?? slug) || 'home'}
                href={href}
                onClick={closeMenu}
                className={pathname === href ? styles.active : ''}
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
