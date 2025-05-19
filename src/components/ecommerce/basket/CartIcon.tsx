"use client";

import Link from "next/link";
import { FaShoppingCart } from "react-icons/fa";
import styles from "./CartIcon.module.scss";

export default function CartIcon() {
  return (
    <Link href="/cart" className={styles.cartIcon} aria-label="Cart">
      <FaShoppingCart />
      {/* If you want a badge later:
      <span className={styles.badge}>3</span>
      */}
    </Link>
  );
}
