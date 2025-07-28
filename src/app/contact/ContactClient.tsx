'use client';

import styles from './Contact.module.scss';

export default function ContactClient() {
  return (
    <section className={styles.wrapper} aria-labelledby="contact-heading">
      <div className={styles.left}>
        <h1 id="contact-heading">Contact Us</h1>
        <p>
          Have questions about our South Asian groceries or frozen food delivery? Get in touch with
          Prince Foods today. Whether you're looking for product information, order support, or
          wholesale inquiries, our friendly team is ready to assist. Reach out and let’s find the
          right solution for your home or business.
        </p>
      </div>

      <div className={styles.right}>
        <form aria-label="Contact Form">
          <div className={styles.row}>
            <input type="text" placeholder="Name" name="name" required aria-label="Name" />
            <input type="email" placeholder="Email" name="email" required aria-label="Email" />
          </div>
          <div className={styles.row}>
            <input type="text" placeholder="Phone" name="phone" aria-label="Phone" />
            <input type="text" placeholder="Address" name="address" aria-label="Address" />
          </div>
          <input type="text" placeholder="Subject" name="subject" aria-label="Subject" />
          <textarea
            placeholder="Type your message here..."
            name="message"
            aria-label="Message"
            required
          />
          <button type="submit">Submit</button>
        </form>
      </div>
    </section>
  );
}
