// src/components/admin/offers/SendOfferEmailModal.tsx
'use client';

/**
 * Standalone "email this offer" modal. Works on an EXISTING offer, so a failed
 * blast can be retried safely without re-creating the offer.
 */

import MultiPicker from '@/components/admin/promotions/MultiPicker';
import type { PickerOption as CustomerPickerOption } from '@/components/admin/promotions/types';
import { urlFrom } from '@/lib/url';
import { useEffect, useState } from 'react';
import styles from './offers.module.scss';

type Scope = 'ALL_CUSTOMERS' | 'SELECTED_USERS';

function isCustomerOptionsOk(x: unknown): x is { options: CustomerPickerOption[] } {
  return (
    typeof x === 'object' &&
    x !== null &&
    Array.isArray((x as { options?: unknown }).options)
  );
}

export interface SendOfferEmailResult {
  recipients?: number;
}

export default function SendOfferEmailModal({
  open,
  offerId,
  offerName,
  initialSubject,
  onClose,
  onSent
}: {
  open: boolean;
  offerId: string | null;
  offerName?: string | null;
  initialSubject?: string | null;
  onClose: () => void;
  onSent: (r: SendOfferEmailResult) => void;
}) {
  const [scope, setScope] = useState<Scope>('ALL_CUSTOMERS');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [userIds, setUserIds] = useState<string[]>([]);

  const [customerOptions, setCustomerOptions] = useState<CustomerPickerOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope('ALL_CUSTOMERS');
    setSubject(initialSubject ?? (offerName ? `New offer: ${offerName}` : ''));
    setMessage('');
    setUserIds([]);
    setErr(null);
  }, [open, offerName, initialSubject]);

  async function searchCustomers(q: string) {
    setCustomerError(null);
    setCustomerLoading(true);
    try {
      const url = urlFrom('/api/admin/options/customers');
      url.searchParams.set('q', q);
      url.searchParams.set('take', '200');

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as unknown;

      if (!res.ok || !isCustomerOptionsOk(json)) {
        throw new Error('Failed to load customers.');
      }
      setCustomerOptions(json.options);
    } catch (e) {
      setCustomerError(e instanceof Error ? e.message : 'Failed to load customers.');
      setCustomerOptions([]);
    } finally {
      setCustomerLoading(false);
    }
  }

  async function send() {
    if (!offerId) return;
    const subj = subject.trim();
    if (!subj) {
      setErr('Email subject is required.');
      return;
    }
    if (scope === 'SELECTED_USERS' && userIds.length === 0) {
      setErr('Pick at least one customer, or send to all customers.');
      return;
    }

    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/offers/${offerId}/email-blast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          userIds: scope === 'SELECTED_USERS' ? userIds : [],
          subject: subj,
          message: message.trim() || null
        })
      });

      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        recipients?: number;
        error?: string;
        run?: { ok?: boolean; error?: string };
      } | null;

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? `Email blast failed (${res.status}).`);
      }
      if (json.run && json.run.ok === false) {
        throw new Error(json.run.error ?? 'Blast created but sending failed — try again.');
      }

      onSent({ recipients: json.recipients });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Email blast failed.');
    } finally {
      setSending(false);
    }
  }

  if (!open || !offerId) return null;

  return (
    <div
      className={styles.modalBackdrop ?? undefined}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Email offer to customers"
        style={{
          background: '#fff',
          color: '#111827',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '85vh',
          overflow: 'auto',
          padding: 20
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>
          Email offer{offerName ? `: ${offerName}` : ''}
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b7280' }}>
          Sends the offer email now. Safe to retry — this never re-creates the offer.
        </p>

        {err && (
          <div
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              borderRadius: 8,
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#991b1b',
              fontWeight: 600,
              fontSize: 13
            }}
          >
            {err}
          </div>
        )}

        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Send to
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
            >
              <option value="ALL_CUSTOMERS">All customers</option>
              <option value="SELECTED_USERS">Selected customers</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Email subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Prince Foods new offer"
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
            Message (optional)
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Optional message shown above the offer"
              rows={4}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db' }}
            />
          </label>

          {scope === 'SELECTED_USERS' && (
            <MultiPicker
              title="Select customers"
              placeholder="Search customers…"
              options={customerOptions}
              selectedIds={userIds}
              onChange={setUserIds}
              remote
              minChars={0}
              onRemoteSearch={searchCustomers}
              remoteLoading={customerLoading}
              remoteError={customerError}
            />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #111827',
              background: '#111827',
              color: '#fff',
              fontWeight: 600,
              cursor: sending ? 'not-allowed' : 'pointer',
              opacity: sending ? 0.6 : 1
            }}
          >
            {sending ? 'Sending…' : 'Send email'}
          </button>
        </div>
      </div>
    </div>
  );
}
