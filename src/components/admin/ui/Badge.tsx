import React from 'react';
import styles from './ui.module.scss';

export type BadgeTone = 'default' | 'ok' | 'warn' | 'danger' | 'muted' | 'info';

const toneClass: Record<BadgeTone, string> = {
  default: styles.badgeDefault,
  ok: styles.badgeOk,
  warn: styles.badgeWarn,
  danger: styles.badgeDanger,
  muted: styles.badgeMuted,
  info: styles.badgeInfo
};

export function Badge({
  children,
  tone = 'default',
  title
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  title?: string;
}) {
  return (
    <span className={`${styles.badge} ${toneClass[tone]}`} title={title}>
      {children}
    </span>
  );
}

/** Tone mapping for order statuses. */
export function orderStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'PAID':
    case 'FULFILLED':
      return 'ok';
    case 'PLACED':
      return 'warn';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'danger';
    default:
      return 'muted';
  }
}

/** Tone mapping for payment statuses. */
export function paymentStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'CAPTURED':
      return 'ok';
    case 'AUTHORIZED':
    case 'PENDING':
      return 'warn';
    case 'REFUNDED':
    case 'PARTIAL_REFUND':
    case 'FAILED':
      return 'danger';
    default:
      return 'muted';
  }
}

export default Badge;
