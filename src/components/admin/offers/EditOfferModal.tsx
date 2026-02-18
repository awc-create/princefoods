// src/components/admin/offers/EditOfferModal.tsx
'use client';

import type { OfferAdminForm, OfferKind, OfferStatus } from '@/types/offers';
import { useEffect, useMemo, useState } from 'react';
import styles from './offers.module.scss';

interface _ApiErr {
  error: string;
}

function fmtErr(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function apiError(x: unknown): string | null {
  if (typeof x !== 'object' || x === null) return null;
  const r = x as Record<string, unknown>;
  return typeof r.error === 'string' && r.error.trim() ? r.error : null;
}

function clampInt(raw: string | number, min: number, max: number) {
  const n = typeof raw === 'number' ? raw : Number(raw);
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}

function penceToPounds(pence: number | null | undefined): string {
  const v = typeof pence === 'number' && Number.isFinite(pence) ? pence : 0;
  return (v / 100).toFixed(2);
}

function poundsToPence(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

// Admin UI only supports these 3 kinds for now
type AdminKind = 'BOGOF' | 'X_FOR_Y' | 'X_FOR_FIXED_PRICE';

function isSupportedKind(k: OfferKind): k is AdminKind {
  return k === 'BOGOF' || k === 'X_FOR_Y' || k === 'X_FOR_FIXED_PRICE';
}

export default function EditOfferModal({
  open,
  offerId,
  onClose,
  onSaved
}: {
  open: boolean;
  offerId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [original, setOriginal] = useState<OfferAdminForm | null>(null);

  // editable fields
  const [name, setName] = useState('');
  const [status, setStatus] = useState<OfferStatus>('ACTIVE');
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [priority, setPriority] = useState<number>(0);

  // rule editor fields (for supported kinds)
  const [kind, setKind] = useState<AdminKind>('BOGOF');
  const [buyQty, setBuyQty] = useState(2);
  const [getQty, setGetQty] = useState(1);
  const [payQty, setPayQty] = useState(1);
  const [fixedPricePence, setFixedPricePence] = useState(100);

  // reset on open
  useEffect(() => {
    if (!open) return;

    setLoadErr(null);
    setSaveErr(null);
    setOriginal(null);

    setName('');
    setStatus('ACTIVE');
    setStartsAt(null);
    setEndsAt(null);
    setPriority(0);

    setKind('BOGOF');
    setBuyQty(2);
    setGetQty(1);
    setPayQty(1);
    setFixedPricePence(100);
  }, [open]);

  // load offer
  useEffect(() => {
    if (!open) return;

    if (!offerId) {
      setLoadErr('No offer selected.');
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadErr(null);

      try {
        const res = await fetch(`/api/admin/offers/${offerId}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as unknown;

        if (!res.ok) {
          throw new Error(apiError(json) ?? 'Failed to load offer.');
        }

        if (typeof json !== 'object' || json === null) {
          throw new Error('Failed to load offer.');
        }

        const r = json as Record<string, unknown>;
        const offer = r.offer;

        if (typeof offer !== 'object' || offer === null) {
          throw new Error('Failed to load offer.');
        }

        const o = offer as OfferAdminForm;

        if (cancelled) return;

        setOriginal(o);

        setName(o.name ?? '');
        setStatus(o.status ?? 'ACTIVE');
        setStartsAt(o.startsAt ?? null);
        setEndsAt(o.endsAt ?? null);
        setPriority(Number.isFinite(o.priority) ? Math.trunc(o.priority) : 0);

        const pk = o.payload?.kind;

        // If unsupported kind, still allow changing name/status/window/priority,
        // but lock kind/rule section.
        if (pk && isSupportedKind(pk)) {
          setKind(pk);

          if (pk === 'BOGOF') {
            setBuyQty(clampInt(o.payload.data.buyQty, 1, 999));
            setGetQty(clampInt(o.payload.data.getQty, 1, 999));
          }

          if (pk === 'X_FOR_Y') {
            setBuyQty(clampInt(o.payload.data.buyQty, 1, 999));
            setPayQty(clampInt(o.payload.data.payQty, 1, 999));
          }

          if (pk === 'X_FOR_FIXED_PRICE') {
            setBuyQty(clampInt(o.payload.data.qty, 1, 999));
            setFixedPricePence(
              typeof o.payload.data.pricePence === 'number'
                ? Math.max(0, Math.trunc(o.payload.data.pricePence))
                : 0
            );
          }
        }
      } catch (e) {
        if (!cancelled) setLoadErr(fmtErr(e, 'Failed to load offer.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, offerId]);

  const supported = useMemo(() => {
    const pk = original?.payload?.kind;
    return pk ? isSupportedKind(pk) : true;
  }, [original]);

  const canSubmit = useMemo(() => {
    if (loading || saving) return false;
    if (!offerId) return false;
    if (!name.trim()) return false;
    if (!original) return false;
    return true;
  }, [loading, saving, offerId, name, original]);

  // keep rule fields consistent when kind changes (within supported editor)
  useEffect(() => {
    if (!open) return;

    if (kind === 'BOGOF') {
      setPayQty(1);
      setFixedPricePence(100);
      setGetQty((v) => (v ? v : 1));
      setBuyQty((v) => (v ? v : 2));
    }

    if (kind === 'X_FOR_Y') {
      setGetQty(1);
      setFixedPricePence(100);
      setPayQty((v) => (v ? v : 1));
      setBuyQty((v) => (v ? v : 2));
    }

    if (kind === 'X_FOR_FIXED_PRICE') {
      setGetQty(1);
      setPayQty(1);
      setFixedPricePence((v) => (v ? v : 100));
      setBuyQty((v) => (v ? v : 2));
    }
  }, [open, kind]);

  async function save() {
    if (!canSubmit) return;
    if (!offerId) return;
    if (!original) return;

    setSaveErr(null);
    setSaving(true);

    try {
      // Start from original (so we don’t accidentally drop fields the server expects)
      const next: OfferAdminForm = {
        ...original,
        name: name.trim(),
        status,
        startsAt: startsAt?.trim() ? startsAt.trim() : null,
        endsAt: endsAt?.trim() ? endsAt.trim() : null,
        priority: Number.isFinite(priority) ? Math.trunc(priority) : 0,
        exclusions: original.exclusions ?? {}
      };

      // Only rewrite payload if it’s a supported kind (or if it was supported).
      // If the original kind is unsupported, we leave payload untouched.
      if (supported) {
        const buy = clampInt(buyQty, 1, 999);

        next.payload =
          kind === 'BOGOF'
            ? {
                kind: 'BOGOF',
                data: {
                  buyQty: buy,
                  getQty: clampInt(getQty, 1, 999),
                  buyPool: original.payload.kind === 'BOGOF' ? original.payload.data.buyPool : [],
                  getPool: original.payload.kind === 'BOGOF' ? original.payload.data.getPool : [],
                  warnIfGetMoreExpensive:
                    original.payload.kind === 'BOGOF'
                      ? original.payload.data.warnIfGetMoreExpensive
                      : true,
                  autoAddGetItem:
                    original.payload.kind === 'BOGOF' ? original.payload.data.autoAddGetItem : false
                }
              }
            : kind === 'X_FOR_Y'
              ? {
                  kind: 'X_FOR_Y',
                  data: {
                    buyQty: buy,
                    payQty: clampInt(payQty, 1, 999),
                    pool: original.payload.kind === 'X_FOR_Y' ? original.payload.data.pool : []
                  }
                }
              : {
                  kind: 'X_FOR_FIXED_PRICE',
                  data: {
                    qty: buy,
                    pricePence: Math.max(0, Math.trunc(fixedPricePence ?? 0)),
                    pool:
                      original.payload.kind === 'X_FOR_FIXED_PRICE'
                        ? original.payload.data.pool
                        : []
                  }
                };
      }

      const res = await fetch(`/api/admin/offers/${offerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });

      const json = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        throw new Error(apiError(json) ?? 'Failed to save.');
      }

      onSaved();
      onClose();
    } catch (e) {
      setSaveErr(fmtErr(e, 'Failed to save offer.'));
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <div className={styles.modalTitle}>Edit offer</div>
            <div className={styles.modalSub}>Update and save changes.</div>
          </div>

          <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {loadErr && <div className={styles.bannerError}>{loadErr}</div>}
          {saveErr && <div className={styles.bannerError}>{saveErr}</div>}

          <div className={styles.formGrid}>
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Basics</div>
                  <div className={styles.sectionHint}>Name, status, priority and window.</div>
                </div>
              </div>

              <div className={styles.split2}>
                <div className={styles.field}>
                  <label className={styles.label}>Offer name</label>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OfferStatus)}
                    disabled={loading || saving}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Priority</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(clampInt(e.target.value, -999999, 999999))}
                    disabled={loading || saving}
                  />
                  <div className={styles.hint}>Higher runs first if stacking requires.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Starts at (ISO)</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 2026-02-12T10:00:00.000Z"
                    value={startsAt ?? ''}
                    onChange={(e) => setStartsAt(e.target.value.trim() ? e.target.value : null)}
                    disabled={loading || saving}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Ends at (ISO)</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 2026-03-01T23:59:59.000Z"
                    value={endsAt ?? ''}
                    onChange={(e) => setEndsAt(e.target.value.trim() ? e.target.value : null)}
                    disabled={loading || saving}
                  />
                </div>
              </div>
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Rule</div>
                  <div className={styles.sectionHint}>
                    {supported
                      ? 'Edit the deal mechanics.'
                      : 'This offer kind is not editable in the UI yet (payload will be preserved).'}
                  </div>
                </div>
              </div>

              <div className={styles.split2}>
                <div className={styles.field}>
                  <label className={styles.label}>Offer type</label>
                  <select
                    className={styles.select}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as AdminKind)}
                    disabled={!supported || loading || saving}
                  >
                    <option value="BOGOF">BOGOF (Buy X get Y free)</option>
                    <option value="X_FOR_Y">X for Y (Buy X pay for Y)</option>
                    <option value="X_FOR_FIXED_PRICE">X for £ (Buy X for fixed price)</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>
                    {kind === 'X_FOR_FIXED_PRICE' ? 'Quantity (X)' : 'Buy quantity'}
                  </label>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={buyQty}
                    onChange={(e) => setBuyQty(clampInt(e.target.value, 1, 999))}
                    disabled={!supported || loading || saving}
                  />
                </div>

                {kind === 'BOGOF' && (
                  <div className={styles.field}>
                    <label className={styles.label}>Get free</label>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={getQty}
                      onChange={(e) => setGetQty(clampInt(e.target.value, 1, 999))}
                      disabled={!supported || loading || saving}
                    />
                  </div>
                )}

                {kind === 'X_FOR_Y' && (
                  <div className={styles.field}>
                    <label className={styles.label}>Pay for (Y)</label>
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      value={payQty}
                      onChange={(e) => setPayQty(clampInt(e.target.value, 1, 999))}
                      disabled={!supported || loading || saving}
                    />
                  </div>
                )}

                {kind === 'X_FOR_FIXED_PRICE' && (
                  <div className={styles.field}>
                    <label className={styles.label}>Fixed price (total)</label>

                    <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 8 }}>
                      <div
                        className={styles.input}
                        style={{ display: 'grid', placeItems: 'center', padding: 0, opacity: 0.9 }}
                        aria-hidden
                      >
                        £
                      </div>

                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        step="0.01"
                        value={penceToPounds(fixedPricePence)}
                        onChange={(e) => setFixedPricePence(poundsToPence(e.target.value))}
                        disabled={!supported || loading || saving}
                      />
                    </div>

                    <div className={styles.hint} style={{ marginTop: 6 }}>
                      Example: “2 for £1” → quantity 2, fixed price £1.00
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.secondaryBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>

          <button className={styles.primaryBtn} onClick={save} disabled={!canSubmit}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
