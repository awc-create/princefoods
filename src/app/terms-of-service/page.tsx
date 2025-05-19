import styles from "./Terms.module.scss";

export const metadata = {
  title: "Terms of Service",
  description: "Understand the terms and conditions for using our website.",
};

export default function TermsPage() {
  return (
    <div className={styles.wrapper}>
      <h1>Terms of Service</h1>
      <p>By accessing our website, you agree to these terms:</p>

      <h2>Usage</h2>
      <p>You must not misuse our site. We may suspend access for abusive or illegal activity.</p>

      <h2>Intellectual Property</h2>
      <p>All content on this site is owned or licensed by us and may not be copied without permission.</p>

      <h2>Liability</h2>
      <p>We are not liable for damages arising from use of this site, including errors or service interruptions.</p>

      <h2>Changes to Terms</h2>
      <p>We may update these terms. Continued use implies acceptance of the updated version.</p>
    </div>
  );
}
