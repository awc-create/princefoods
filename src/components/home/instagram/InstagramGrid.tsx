// src/components/home/instagram/InstagramGrid.tsx
'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import styles from './InstagramGrid.module.scss';

interface InstagramItem {
  id: string;
  url: string;
  img: string;
  caption: string;
}

interface InstagramApiResponse {
  items: InstagramItem[];
  error?: 'missing_token' | 'fetch_failed';
}

export default function InstagramGrid({
  usernameUrl = 'https://www.instagram.com/princefoodsuk/'
}: {
  usernameUrl?: string;
}) {
  const [data, setData] = useState<InstagramApiResponse>({ items: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/instagram', { signal: ac.signal });
        if (!res.ok) throw new Error('bad status');
        const json = (await res.json()) as InstagramApiResponse;
        setData(json);
      } catch {
        setData({ items: [], error: 'fetch_failed' });
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const items = data?.items ?? [];

  return (
    <section className={styles.wrap} aria-labelledby="ig-heading">
      <div className={styles.header}>
        <h2 id="ig-heading">
          Follow us on Instagram{' '}
          <a href={usernameUrl} target="_blank" rel="noreferrer" className={styles.viewAll}>
            #keralafoodies
          </a>
        </h2>
      </div>

      {loading ? (
        <div className={styles.fallback}>
          <p>Loading fresh posts…</p>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.fallback}>
          <p>
            Fresh cooking ideas and community features—see what customers are cooking this week.
          </p>
        </div>
      ) : (
        <div className={styles.grid} role="list">
          {items.map((it) => (
            <a
              key={it.id}
              href={it.url}
              target="_blank"
              rel="noreferrer"
              className={styles.card}
              role="listitem"
              aria-label="View on Instagram"
            >
              <div className={styles.image}>
                <Image
                  src={it.img}
                  alt={it.caption ?? 'Instagram post'}
                  fill
                  sizes="(max-width: 700px) 45vw, (max-width: 1200px) 22vw, 260px"
                />
              </div>
              <div className={styles.overlay}>
                <span>View</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
