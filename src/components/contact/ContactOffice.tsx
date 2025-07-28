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
          <Image
            src="/assets/uk-flag.avif"
            alt="UK Flag"
            width={240}
            height={160}
            className={styles.flag}
          />
          <h3>Prince Foods (UK) Ltd</h3>
          <p>Unit C, 45 Riverside Way</p>
          <p>Uxbridge, Greater London, UB8 2YF</p>
          <p>
            <a href="tel:+447912104109">+44 7912 104109</a>
          </p>
          <p>
            <a href="mailto:info.uk@prince-foods.com">info.uk@prince-foods.com</a>
          </p>
        </article>

        <article className={styles.office}>
          <Image
            src="/assets/canada-flag.avif"
            alt="Canada Flag"
            width={240}
            height={160}
            className={styles.flag}
          />
          <h3>Prince Foods International Ltd</h3>
          <p>17-1365 Neilson Road</p>
          <p>Scarborough, ON M1B 0C6</p>
          <p>
            <a href="tel:+19029890786">+1 902-989-0786</a>
          </p>
          <p>
            <a href="mailto:info.ca@prince-foods.com">info.ca@prince-foods.com</a>
          </p>
        </article>
      </div>
    </section>
  );
}
