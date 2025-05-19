"use client";
import styles from "./LoginForm.module.scss";

export default function LoginForm({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2>Login</h2>
        <form className={styles.form}>
          <input type="email" placeholder="Email" required />
          <input type="password" placeholder="Password" required />
          <div className={styles.actions}>
            <button type="submit">Submit</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
