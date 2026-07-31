import Link from 'next/link';
import React from 'react';
import styles from './ui.module.scss';

interface Action {
  label: string;
  /** Provide either href (link) or onClick (button). */
  href?: string;
  onClick?: () => void;
}

export default function EmptyState({
  title,
  hint,
  action
}: {
  title: string;
  hint?: string;
  action?: Action;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.emptyTitle}>{title}</p>
      {hint && <p className={styles.emptyHint}>{hint}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className={styles.emptyAction}>
            {action.label}
          </Link>
        ) : (
          <button type="button" className={styles.emptyAction} onClick={action.onClick}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
