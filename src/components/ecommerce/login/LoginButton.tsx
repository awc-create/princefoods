"use client";

import Link from "next/link";
import { FaUser } from "react-icons/fa";
import styles from "./LoginButton.module.scss";

export default function LoginButton() {
  return (
    <Link href="/login" className={styles.loginButton} aria-label="Login">
      <FaUser />
    </Link>
  );
}
