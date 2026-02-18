'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './RangeSlider.module.scss';

interface Props {
  min: number;
  max: number;
  step?: number;
  value: { min: number; max: number };
  onChange: (next: { min: number; max: number }) => void;
  'aria-label'?: string;
}

type ActiveThumb = 'min' | 'max' | null;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function snapToStep(value: number, min: number, step: number) {
  const v = (value - min) / step;
  return min + Math.round(v) * step;
}

export default function RangeSlider({ min, max, step = 1, value, onChange, ...a11y }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<ActiveThumb>(null);

  // normalize incoming
  const lo = clamp(Math.min(value.min, value.max), min, max);
  const hi = clamp(Math.max(value.min, value.max), min, max);

  const span = Math.max(1, max - min);

  const loPct = useMemo(() => ((lo - min) / span) * 100, [lo, min, span]);
  const hiPct = useMemo(() => ((hi - min) / span) * 100, [hi, min, span]);

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return lo;

      const rect = el.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const ratio = rect.width > 0 ? x / rect.width : 0;
      const raw = min + ratio * (max - min);
      const snapped = snapToStep(raw, min, step);
      return clamp(snapped, min, max);
    },
    [lo, min, max, step]
  );

  // drag handling (global while dragging)
  useEffect(() => {
    if (!active) return;

    const onMove = (e: PointerEvent) => {
      const next = valueFromClientX(e.clientX);

      if (active === 'min') {
        const nextLo = Math.min(next, hi);
        onChange({ min: nextLo, max: hi });
      } else {
        const nextHi = Math.max(next, lo);
        onChange({ min: lo, max: nextHi });
      }
    };

    const onUp = () => setActive(null);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [active, hi, lo, onChange, valueFromClientX]);

  const onTrackClick = (e: React.PointerEvent) => {
    const next = valueFromClientX(e.clientX);

    const distToLo = Math.abs(next - lo);
    const distToHi = Math.abs(next - hi);

    if (distToLo <= distToHi) {
      onChange({ min: Math.min(next, hi), max: hi });
    } else {
      onChange({ min: lo, max: Math.max(next, lo) });
    }
  };

  // keyboard support
  const nudge = (which: 'min' | 'max', dir: -1 | 1) => {
    const delta = step * dir;
    if (which === 'min') {
      const nextLo = clamp(snapToStep(lo + delta, min, step), min, hi);
      onChange({ min: nextLo, max: hi });
    } else {
      const nextHi = clamp(snapToStep(hi + delta, min, step), lo, max);
      onChange({ min: lo, max: nextHi });
    }
  };

  return (
    <div className={styles.wrap} {...a11y}>
      <div ref={trackRef} className={styles.trackHit} onPointerDown={onTrackClick}>
        <div className={styles.track} />
        <div className={styles.fill} style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />

        <button
          type="button"
          className={`${styles.thumb} ${styles.min} ${active === 'min' ? styles.active : ''}`}
          style={{ left: `${loPct}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
            setActive('min');
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') nudge('min', -1);
            if (e.key === 'ArrowRight') nudge('min', 1);
          }}
          aria-label="Minimum price"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={lo}
          role="slider"
        />

        <button
          type="button"
          className={`${styles.thumb} ${styles.max} ${active === 'max' ? styles.active : ''}`}
          style={{ left: `${hiPct}%` }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
            setActive('max');
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') nudge('max', -1);
            if (e.key === 'ArrowRight') nudge('max', 1);
          }}
          aria-label="Maximum price"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={hi}
          role="slider"
        />
      </div>
    </div>
  );
}
