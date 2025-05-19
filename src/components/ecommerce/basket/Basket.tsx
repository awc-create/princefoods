"use client";
import styles from "./Basket.module.scss";

export default function Basket({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Your Basket</h2>
        <div className={styles.empty}>
          <p>No items yet!</p>
        </div>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
