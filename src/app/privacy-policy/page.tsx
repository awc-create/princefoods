import styles from "./Privacy.module.scss";

export const metadata = {
  title: "Privacy Policy",
  description: "Learn how we collect, use, and protect your personal data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className={styles.wrapper}>
      <h1>Privacy Policy</h1>
      <p>This Privacy Policy explains how we handle your personal data when you visit our website.</p>

      <h2>Information We Collect</h2>
      <p>We collect basic contact information (name, email) and usage data through cookies and analytics.</p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To respond to inquiries and provide support</li>
        <li>To improve our services and website experience</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2>GDPR Rights</h2>
      <p>If you're located in the UK or EU, you have rights under GDPR:</p>
      <ul>
        <li>Access your data</li>
        <li>Request corrections</li>
        <li>Request deletion</li>
        <li>Object to processing</li>
      </ul>

      <p>To exercise your rights, contact us at <strong>privacy@yourdomain.com</strong>.</p>

      <h2>Cookie Usage</h2>
      <p>We use cookies to enhance your experience. Learn more on our <a href="/cookies">Cookie Policy</a> page.</p>
    </div>
  );
}
