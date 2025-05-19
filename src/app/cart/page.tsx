import styles from "./CartPage.module.scss";

export default function CartPage() {
  return (
    <div className={styles.container}>
      <h1>Your Cart</h1>
      <p>No items in your cart.</p>
    </div>
  );
}
