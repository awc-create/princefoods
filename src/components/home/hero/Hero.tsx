"use client";

import React from "react";
import Head from "next/head";
import Slider from "@/components/slider/Slider";
import styles from "./Hero.module.scss";
import { Oswald } from "next/font/google";

// Scoped Oswald for heading
const oswald = Oswald({
  weight: "500",
  subsets: ["latin"],
});

const slides = [
  { image: "/assets/slider1.jpg", siteLink: "", techStack: "", description: "", review: "" },
  { image: "/assets/slider2.jpg", siteLink: "", techStack: "", description: "", review: "" },
  { image: "/assets/slider3.jpg", siteLink: "", techStack: "", description: "", review: "" },
];

export default function Hero() {
  return (
    <>
      <Head>
        <link rel="preload" href="/assets/slider1.jpg" as="image" type="image/jpeg" />
      </Head>

      <section className={styles.hero}>
        <div className={styles.textContainer}>
          <h1 className={oswald.className}>About Prince Foods</h1>
          <p>
            Since 2007, Prince Foods has been London’s premier online South Asian grocery,
            bringing authentic Indian &amp; Sri Lankan staples—from premium spices and pulses
            to snacks and frozen specialties—direct to your door across England, Scotland,
            Wales and Ireland. With curated collections, intuitive filters and reliable UK-
            &amp; Ireland-wide delivery, home cooks can easily explore new flavours and stock
            their pantries at consistently low prices. Shop now to taste the difference of
            high-quality Prince Foods groceries!
          </p>
        </div>

        <div className={styles.sliderSection}>
          <Slider slides={slides} />
        </div>
      </section>
    </>
  );
}
