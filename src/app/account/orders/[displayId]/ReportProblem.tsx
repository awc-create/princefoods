'use client';

/**
 * "Report a problem" on a customer's own order.
 *
 * Opens the same ReturnCase that staff already triage in the admin, so the
 * customer finally has a route in rather than hunting for the contact form.
 */

import { useState } from 'react';

const ISSUES = [
  { value: 'DAMAGED', label: 'Something arrived damaged' },
  { value: 'MISSING', label: 'Something was missing' },
  { value: 'WRONG_ITEM', label: 'I received the wrong item' },
  { value: 'NOT_DELIVERED', label: "My order hasn't arrived" },
  { value: 'OTHER', label: 'Something else' }
] as const;

type Issue = (typeof ISSUES)[number]['value'];

export default function ReportProblem({ displayId }: { displayId: string }) {
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState<Issue | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!issue) {
      setErr('Please choose what went wrong.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/account/orders/${encodeURIComponent(displayId)}/report-problem`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue, note })
        }
      );
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? 'Could not submit that just now.');
      setDone(j.message ?? "Thanks — we've logged this and will be in touch shortly.");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not submit that just now.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={box('#ecfdf5', '#a7f3d0', '#065f46')} role="status">
        <strong style={{ display: 'block', marginBottom: 2 }}>Problem reported</strong>
        <span style={{ fontSize: 14 }}>{done}</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={linkBtn}>
        Report a problem with this order
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={box('#f9fafb', '#e5e7eb', '#111827')}>
      <strong style={{ display: 'block', marginBottom: 10 }}>
        What went wrong with order {displayId}?
      </strong>

      <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        {ISSUES.map((o) => (
          <label key={o.value} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input
              type="radio"
              name="issue"
              value={o.value}
              checked={issue === o.value}
              onChange={() => setIssue(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        Anything else we should know? <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="e.g. two of the frozen items had defrosted"
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          fontSize: 14,
          fontFamily: 'inherit'
        }}
      />

      {err && (
        <p role="alert" style={{ color: '#b91c1c', fontSize: 13, margin: '8px 0 0' }}>
          {err}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="submit" disabled={busy} style={primaryBtn(busy)}>
          {busy ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} style={secondaryBtn}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ── styles ── */
const box = (bg: string, border: string, fg: string): React.CSSProperties => ({
  padding: '14px 16px',
  borderRadius: 10,
  border: `1px solid ${border}`,
  background: bg,
  color: fg,
  marginTop: 16
});

const linkBtn: React.CSSProperties = {
  marginTop: 16,
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#007bff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline'
};

const primaryBtn = (busy: boolean): React.CSSProperties => ({
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #111827',
  background: '#111827',
  color: '#fff',
  fontWeight: 600,
  fontSize: 14,
  cursor: busy ? 'not-allowed' : 'pointer',
  opacity: busy ? 0.6 : 1
});

const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer'
};
