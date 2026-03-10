'use client';

import { useEffect, useRef, useState } from 'react';
import MultiPicker from './MultiPicker';
import styles from './promotions.module.scss';
import type { PickerOption } from './types';

type Scope = 'ALL_CUSTOMERS' | 'SELECTED_USERS';

export default function EmailPromoModal({
  open,
  onClose,
  promotionId,
  promoCode,
  promoName
}: {
  open: boolean;
  onClose: () => void;
  promotionId: string;
  promoCode: string | null;
  promoName: string;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const [scope, setScope] = useState<Scope>('ALL_CUSTOMERS');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // picker state (remote)
  const [customerOptions, setCustomerOptions] = useState<PickerOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // blast state
  const [blastId, setBlastId] = useState<string | null>(null);
  const [plannedCount, setPlannedCount] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setBlastId(null);
    setPlannedCount(null);
    setInfo(null);
    setErr(null);
    setScope('ALL_CUSTOMERS');
    setSelectedUserIds([]);
    setCustomerOptions([]);
    setCustomerError(null);
    setCustomerLoading(false);

    const code = promoCode ?? '';
    setSubject(code ? `Prince Foods promo code: ${code}` : `Prince Foods promotion: ${promoName}`);
    setMessage(
      code
        ? `Use code ${code} at checkout to claim this offer.`
        : `A new promotion is now available on Prince Foods.`
    );

    window.setTimeout(() => bodyRef.current?.scrollTo({ top: 0 }), 0);
  }, [open, promoCode, promoName]);

  async function remoteSearchCustomers(q: string) {
    setCustomerLoading(true);
    setCustomerError(null);
    try {
      const res = await fetch(`/api/admin/options/customers?q=${encodeURIComponent(q)}&take=200`);
      const data = (await res.json()) as { options?: PickerOption[]; error?: string };

      if (!res.ok) throw new Error(data?.error ?? 'Failed to load customers');

      setCustomerOptions(Array.isArray(data.options) ? data.options : []);
    } catch (e) {
      setCustomerError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setCustomerLoading(false);
    }
  }

  async function createBlast() {
    setErr(null);
    setInfo(null);

    if (!promoCode) return setErr('This promotion has no code, so it cannot be emailed as a code.');

    const subj = subject.trim();
    if (!subj) return setErr('Subject is required.');

    if (scope === 'SELECTED_USERS' && selectedUserIds.length === 0) {
      return setErr('Select at least 1 customer.');
    }

    try {
      const res = await fetch(`/api/admin/promotions/${promotionId}/email-blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          userIds: scope === 'SELECTED_USERS' ? selectedUserIds : undefined,
          subject: subj,
          message: message.trim() ? message.trim() : null
        })
      });

      const data = (await res.json()) as
        | { ok: true; blastId: string; plannedCount: number }
        | { ok: false; error: string };

      if (!res.ok || !data.ok) throw new Error('error' in data ? data.error : 'Failed');

      setBlastId(data.blastId);
      setPlannedCount(data.plannedCount);
      setInfo(
        `Blast created (${data.plannedCount} recipients). Click “Send batch” to start sending.`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create blast');
    }
  }

  async function runBatch() {
    if (!blastId) return;
    setRunning(true);
    setErr(null);

    try {
      const res = await fetch(`/api/admin/promotions/blasts/${blastId}/run?limit=120`, {
        method: 'POST'
      });

      const data = (await res.json()) as
        | { ok: true; done: boolean; sent: number; failed: number; remaining?: number }
        | { ok: false; error: string };

      if (!res.ok || !data.ok) throw new Error('error' in data ? data.error : 'Failed');

      const remaining = 'remaining' in data ? data.remaining : undefined;

      setInfo(
        `Sent ${data.sent}, failed ${data.failed}` +
          (typeof remaining === 'number' ? ` • Remaining: ${remaining}` : '') +
          (data.done ? ' • Finished ✅' : '')
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send batch');
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Email promo code</div>
            <div className={styles.modalSub}>
              Send to all customers or selected customers. You can send again later to missed users.
            </div>
          </div>

          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody} ref={bodyRef}>
          {!promoCode ? (
            <div className={styles.inlineError}>
              This promotion has no code. Set a code first to email it.
            </div>
          ) : null}

          <div className={styles.formGrid}>
            <div className={styles.split2}>
              <div className={styles.field}>
                <label className={styles.label}>Scope</label>
                <select
                  className={styles.select}
                  value={scope}
                  onChange={(e) => setScope(e.target.value as Scope)}
                >
                  <option value="ALL_CUSTOMERS">All customers</option>
                  <option value="SELECTED_USERS">Selected customers</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Promo code</label>
                <input className={styles.input} value={promoCode ?? ''} disabled />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Email subject</label>
              <input
                className={styles.input}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Prince Foods promo code: DIWALI10"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Message (optional)</label>
              <textarea
                className={styles.textarea}
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Optional message shown above the code"
              />
            </div>

            {scope === 'SELECTED_USERS' ? (
              <div className={styles.cardInset}>
                <MultiPicker
                  title="Select customers"
                  placeholder="Search customers…"
                  remote
                  minChars={0}
                  options={customerOptions}
                  selectedIds={selectedUserIds}
                  onChange={setSelectedUserIds}
                  onRemoteSearch={remoteSearchCustomers}
                  remoteLoading={customerLoading}
                  remoteError={customerError}
                />
              </div>
            ) : null}

            {err ? <div className={styles.inlineError}>{err}</div> : null}
            {info ? <div className={styles.mutedCell}>{info}</div> : null}

            {plannedCount != null ? (
              <div className={styles.hint}>Planned recipients: {plannedCount}</div>
            ) : null}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={running}
          >
            Close
          </button>

          {!blastId ? (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={createBlast}
              disabled={running || !promoCode}
            >
              Create blast
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={runBatch}
              disabled={running}
            >
              {running ? 'Sending…' : 'Send batch'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
