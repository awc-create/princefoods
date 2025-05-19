import Hero from "@/components/home/hero/Hero";
import styles from "./page.module.scss";

export default function Home() {
  return (
    <main className={styles.homeContainer}>
      <Hero />
    </main>
  );
}