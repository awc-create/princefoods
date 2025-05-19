import styles from "./Cookies.module.scss";

export const metadata = {
  title: "Cookie Policy",
  description: "Details on the cookies we use and your choices.",
};

export default function CookiePolicyPage() {
  return (
    <div className={styles.wrapper}>
      <h1>Cookie Policy</h1>
      <p>We use cookies to personalize content and analyze traffic. Some cookies are essential for functionality.</p>

      <h2>Types of Cookies</h2>
      <ul>
        <li><strong>Essential:</strong> Required for site to work</li>
        <li><strong>Analytics:</strong> Help us understand how visitors use our site</li>
        <li><strong>Preference:</strong> Remember your choices</li>
      </ul>

      <h2>How to Manage Cookies</h2>
      <p>You can control cookies via your browser settings. Some features may not function properly if disabled.</p>
    </div>
  );
}
