"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaUser } from "react-icons/fa";
import styles from "./LoginButton.module.scss";

export default function LoginButton() {
  const pathname = usePathname() ?? "/";
  const callbackUrl = pathname;
  return (
    <Link
      href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
      className={styles.loginButton}
      aria-label="Sign in"
      title="Sign in"
    >
      <FaUser />
    </Link>
  );
}
