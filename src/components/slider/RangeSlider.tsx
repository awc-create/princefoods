'use client';

import { useMemo } from 'react';
import styles from './RangeSlider.module.scss';

interface Props {
  /** Absolute lower/upper limits of the control */
  min: number;
  max: number;
  /** Step size (default 1) */
  step?: number;
  /** Current selection */
  value: { min: number; max: number };
  /** Fired whenever either thumb moves */
  onChange: (next: { min: number; max: number }) => void;
  /** Optional a11y label for the whole control */
  'aria-label'?: string;
}

export default function RangeSlider({ min, max, step = 1, value, onChange, ...a11y }: Props) {
  // Normalize & clamp so thumbs never cross and always stay in [min,max]
  const lo = Math.max(min, Math.min(value.min, value.max));
  const hi = Math.min(max, Math.max(value.max, value.min));

  // % positions for the filled segment
  const { loPct, hiPct } = useMemo(() => {
    const span = Math.max(1, max - min);
    return {
      loPct: ((lo - min) / span) * 100,
      hiPct: ((hi - min) / span) * 100
    };
  }, [lo, hi, min, max]);

  return (
    <div className={styles.wrap} {...a11y}>
      {/* base track */}
      <div className={styles.track} />
      {/* selected fill */}
      <div className={styles.fill} style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />

      {/* left thumb (min) */}
      <input
        className={`${styles.range} ${styles.left}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        onChange={(e) => {
          const nextLo = Math.min(Number(e.target.value), hi);
          onChange({ min: nextLo, max: hi });
        }}
        aria-label="Minimum price"
      />

      {/* right thumb (max) */}
      <input
        className={`${styles.range} ${styles.right}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={hi}
        onChange={(e) => {
          const nextHi = Math.max(Number(e.target.value), lo);
          onChange({ min: lo, max: nextHi });
        }}
        aria-label="Maximum price"
      />
    </div>
  );
}
