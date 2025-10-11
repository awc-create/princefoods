'use client';

import type { AboutSettingsDTO } from '@/types/aboutSettings';
import Image from 'next/image';
import styles from './About.module.scss';

export default function AboutClient({ settings }: { settings: AboutSettingsDTO }) {
  const { hero, story, stats, values, cta } = settings;

  return (
    <main className={styles.page}>
      {/* Intro */}
      <section className={styles.intro} aria-labelledby="about-hero">
        <div className={styles.container}>
          <h1 id="about-hero">{hero.title}</h1>
          <p className={styles.kicker}>{hero.subtitle}</p>
        </div>
      </section>

      {/* Image Card */}
      <section className={styles.mediaWrap} aria-label="About hero image">
        <div className={styles.container}>
          <div className={styles.mediaCard}>
            <div className={styles.mediaInner}>
              <Image
                src={hero.imageUrl || '/assets/about.png'}
                alt="About hero"
                fill
                priority
                className={styles.mediaImg}
                sizes="(max-width: 1200px) 92vw, 800px"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Story + Stats */}
      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.split}>
            <div>
              <h2 className={styles.h2}>{story.heading}</h2>
              {story.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <aside className={styles.aside}>
              {stats.map((st) => (
                <div key={st.id} className={styles.statCard}>
                  <span className={styles.stat}>{st.title}</span>
                  {st.subtitle && <span className={styles.statLabel}>{st.subtitle}</span>}
                </div>
              ))}
            </aside>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className={styles.why}>
        <div className={styles.container}>
          <h2 className={styles.whyTitle}>Why Shop with Prince Foods?</h2>
          <ul className={styles.whyCards}>
            {values.map((v) => (
              <li key={v.id} className={styles.whyCard}>
                {v.icon && <span className={styles.whyIcon}>{v.icon}</span>}
                <div>
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <h3>Bringing Home Closer — One Meal at a Time.</h3>
          <a className={styles.button} href={cta.href || '/collections'}>
            {cta.text || 'Browse Our Collections'}
          </a>
        </div>
      </section>
    </main>
  );
}
