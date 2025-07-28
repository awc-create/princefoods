'use client';

import Image from 'next/image';
import { useState } from 'react';
import styles from './ProductSlider.module.scss';

interface Product {
  id: string;
  name: string;
  price: number;
  productImageUrl: string | null;
}

export default function ProductSlider({ title, products }: { title: string; products: Product[] }) {
  const visibleCount = 4;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(products.map((p) => [p.id, 1]))
  );

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta)
    }));
  };

  const next = () => {
    if (currentIndex + visibleCount < products.length) {
      setCurrentIndex((prev) => prev + visibleCount);
    }
  };

  const prev = () => {
    if (currentIndex - visibleCount >= 0) {
      setCurrentIndex((prev) => prev - visibleCount);
    }
  };

  const getImagePath = (img: string | null): string => {
    if (!img) return '/assets/prince-foods-logo.png';
    if (img.startsWith('http')) return img;
    return `/images/${img}`;
  };

  return (
    <div className={styles.sliderWrapper}>
      <h2 className={styles.heading}>{title}</h2>
      <div className={styles.carousel}>
        {currentIndex > 0 && (
          <button className={styles.arrow} onClick={prev}>
            ‹
          </button>
        )}
        <div className={styles.cards}>
          {products.slice(currentIndex, currentIndex + visibleCount).map((product) => (
            <div key={product.id} className={styles.card}>
              <div className={styles.imageSection}>
                <Image
                  src={getImagePath(product.productImageUrl)}
                  alt={product.name}
                  width={300}
                  height={300}
                />
              </div>

              <div className={styles.details}>
                <p className={styles.name}>{product.name}</p>
                <p className={styles.price}>£{product.price.toFixed(2)}</p>

                <div className={styles.hoverActions}>
                  <div className={styles.qtyControl}>
                    <button onClick={() => updateQty(product.id, -1)}>-</button>
                    <span>{quantities[product.id]}</span>
                    <button onClick={() => updateQty(product.id, 1)}>+</button>
                  </div>
                  <button className={styles.quickView}>Quick View</button>
                  <button className={styles.addToCart}>Add to Cart</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {currentIndex + visibleCount < products.length && (
          <button className={styles.arrow} onClick={next}>
            ›
          </button>
        )}
      </div>
    </div>
  );
}
