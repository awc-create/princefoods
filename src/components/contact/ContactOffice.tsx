import Image from 'next/image';
import styles from './ContactOffice.module.scss';

export default function ContactOffices() {
  return (
    <section className={styles.offices} aria-labelledby="office-heading">
      <h2 id="office-heading" className={styles.heading}>
        Our Office Locations
      </h2>

      <div className={styles.grid}>
        <article className={styles.office}>
          <div className={styles.body}>
            <Image
              src="/assets/uk-flag.avif"
              alt="UK Flag"
              width={240}
              height={160}
              className={styles.flag}
            />

            <h3 className={styles.title}>Prince Foods (UK) Ltd</h3>

            <p className={styles.line}>Unit C, 45 Riverside Way</p>
            <p className={styles.line}>Uxbridge, Greater London, UB8 2YF</p>
          </div>

          <div className={styles.footer}>
            <a className={styles.email} href="mailto:info.uk@prince-foods.com">
              info.uk@prince-foods.com
            </a>
          </div>
        </article>

        <article className={styles.office}>
          <div className={styles.body}>
            <Image
              src="/assets/canada-flag.avif"
              alt="Canada Flag"
              width={240}
              height={160}
              className={styles.flag}
            />

            <h3 className={styles.title}>Prince Foods International Ltd</h3>

            <p className={styles.line}>17-1365 Neilson Road</p>
            <p className={styles.line}>Scarborough, ON M1B 0C6</p>
          </div>

          <div className={styles.footer}>
            <a className={styles.email} href="mailto:info.ca@prince-foods.com">
              info.ca@prince-foods.com
            </a>
          </div>
        </article>
      </div>
    </section>
  );
}
