'use client';

import styles from './Pagination.module.scss';

type Props = {
  page: number;          // current page (1-based)
  pageCount: number;     // total pages
  onChange: (p: number) => void;
};

export default function Pagination({ page, pageCount, onChange }: Props) {
  if (!pageCount || pageCount <= 1) return null;

  const go = (p: number) => {
    if (p < 1 || p > pageCount || p === page) return;
    onChange(p);
  };

  // Build compact list: 1 … (page-1, page, page+1) … last
  const list: Array<number | '…'> = [];
  const first = 1;
  const last = pageCount;
  const win = 1; // neighbors around current

  list.push(first);

  const start = Math.max(first + 1, page - win);
  const end   = Math.min(last - 1, page + win);

  if (start > first + 1) list.push('…');
  for (let i = start; i <= end; i++) list.push(i);
  if (end < last - 1) list.push('…');

  if (last > first) list.push(last);

  return (
    <nav className={styles.pager} aria-label="Pagination">
      <button
        className={styles.nav}
        onClick={() => go(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        ‹ Previous
      </button>

      {list.map((it, idx) =>
        it === '…' ? (
          <span key={`e${idx}`} className={styles.ellipsis} aria-hidden>…</span>
        ) : (
          <button
            key={it}
            className={`${styles.pageBtn} ${page === it ? styles.active : ''}`}
            onClick={() => go(it)}
            aria-current={page === it ? 'page' : undefined}
            aria-label={`Page ${it}`}
          >
            {it}
          </button>
        )
      )}

      <button
        className={styles.nav}
        onClick={() => go(page + 1)}
        disabled={page === pageCount}
        aria-label="Next page"
      >
        Next ›
      </button>
    </nav>
  );
}
