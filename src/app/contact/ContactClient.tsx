"use client";

import styles from "./Contact.module.scss";
import dynamic from "next/dynamic";
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
import mailAnim from "../../assets/lottie/mail.json"; // adjust path if needed

export default function ContactClient() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.left}>
        <h1>Let's Talk</h1>
        <p>Drop us a message and we’ll get back to you fast 🚀</p>
        <form>
          <input type="text" placeholder="Your Name" required />
          <input type="email" placeholder="Your Email" required />
          <textarea placeholder="Your Message" rows={4} required />
          <button type="submit">Send Message</button>
        </form>
      </div>
      <div className={styles.right}>
        <Lottie animationData={mailAnim} loop autoplay style={{ height: 300 }} />
      </div>
    </div>
  );
}
