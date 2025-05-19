"use client";

import Head from "next/head";
import React from "react";
import Image from "next/image";
import styles from "./Hero.module.scss";
import { FaChevronDown } from "react-icons/fa";

export default function Hero() {
  return (
    <>
      <Head>
        <link
          rel="preload"
          href="/assets/hero.png"
          as="image"
          type="image/png"
        />
      </Head>

      <header className={styles.hero} role="banner" aria-label="Homepage Hero">
        <div className={styles.imageWrapper}>
          <Image
            src="/assets/hero.png"
            alt="Hero background"
            fill
            priority
          />
        </div>

        <div className={styles.overlay} />

        <div className={styles.content}>
          <h1>Your Modern Website Starts Here</h1>
          <p>
            Crafted with performance and style in mind. This is your launchpad for a fast, clean, and responsive online presence — proudly created with the Web Dev Wizard CLI.
          </p>
        </div>

        <div className={styles.scrollDown} aria-hidden="true">
          <FaChevronDown />
        </div>
      </header>
    </>
  );
}
