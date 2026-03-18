'use client';
import React from 'react';

import Link from 'next/link';
import { FaFacebookF, FaInstagram } from 'react-icons/fa';
import styles from './Footer.module.scss';

const Footer: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Footer Navigation Links */}
        <nav className={styles.footerLinks}>
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-of-service">Terms of Service</Link>
          <Link href="/faq">FAQs</Link>
          <Link href="/contact">Contact</Link>
        </nav>

        {/* Social Icons */}
        <div className={styles.socialIcons}>
          <a
            href="https://www.facebook.com/princefoodsuk"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
          >
            <FaFacebookF />
          </a>
          <a
            href="https://www.instagram.com/princefoodsuk/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
          >
            <FaInstagram />
          </a>
        </div>

        {/* Copyright */}
        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} Prince Foods. All rights reserved.
        </p>

        {/* Credit */}
        <p className={styles.credit}>
          Website created by{' '}
          <a href="https://adaptiveworks.net" target="_blank" rel="noopener noreferrer">
            AWC
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
