"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import styles from "./Slider.module.scss";
import { FaArrowRight, FaArrowLeft } from "react-icons/fa";

interface Slide {
  image: string;
  siteLink: string;
  techStack: string;
  description: string;
  review: string;
}

const Slider = ({ slides }: { slides: Slide[] }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = () => emblaApi?.scrollPrev();
  const scrollNext = () => emblaApi?.scrollNext();

  useEffect(() => {
    const interval = setInterval(() => {
      emblaApi?.scrollNext();
    }, 10000);
    return () => clearInterval(interval);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const updateSelected = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", updateSelected);
    updateSelected();
  }, [emblaApi]);

  return (
    <div className={styles.sliderWrapper}>
      <button className={styles.arrowLeft} onClick={scrollPrev} aria-label="Previous">
        <FaArrowLeft />
      </button>

      <div className={styles.sliderContainer} ref={emblaRef}>
        <div className={styles.emblaContainer}>
          {slides.map((slide, index) => (
            <div key={index} className={styles.emblaSlide}>
              <Image
                src={slide.image}
                alt={`Slide ${index + 1}`}
                fill
                className={styles.image}
              />
            </div>
          ))}
        </div>
      </div>

      <button className={styles.arrowRight} onClick={scrollNext} aria-label="Next">
        <FaArrowRight />
      </button>

      <div className={styles.dots}>
        {slides.map((_, index) => (
          <button
            key={index}
            className={`${styles.dot} ${index === selectedIndex ? styles.active : ""}`}
            onClick={() => emblaApi?.scrollTo(index)}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default Slider;
