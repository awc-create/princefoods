'use client';

import Link from 'next/link';
import { useState } from 'react';
import EditEmailInline from './EditEmailInline';

interface UserInit {
  id: string;
  name: string;
  email: string;
  phoneE164?: string | null;
}

export default function CustomerDetails({
  orderId,
  contactEmail,
  user
}: {
  orderId: string;
  contactEmail: string;
  user?: UserInit | null;
}) {
  return (
    <section>
      <h2 style={{ margin: '8px 0' }}>Customer</h2>

      <div
        style={{
          display: 'grid',
          gap: 12,
          border: '1px solid #222',
          borderRadius: 10,
          padding: 12
        }}
      >
        {/* Order-level contact (always present) */}
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ color: '#888', fontSize: 12, fontWeight: 600 }}>Order contact email</div>
          <EditEmailInline orderId={orderId} initial={contactEmail} />
          <div style={{ color: '#888', fontSize: 12 }}>
            This email is stored on the order and used for receipts/notifications for this order.
          </div>
        </div>

        {/* Linked user (if any) */}
        {user ? (
          <>
            <hr style={{ borderColor: '#eee' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <strong>Linked customer:</strong>
              <Link
                href={`/admin/customers/${user.id}`}
                style={{ color: '#007bff', textDecoration: 'none' }}
              >
                Open customer page →
              </Link>
            </div>
            <UserInlineEditor initial={user} />
          </>
        ) : (
          <>
            <hr style={{ borderColor: '#eee' }} />
            <div style={{ color: '#666' }}>
              This looks like a guest order (no linked customer record).
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function UserInlineEditor({ initial }: { initial: UserInit }) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phoneE164 ?? '');
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setOk(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${initial.id}/basic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phoneE164: phone.trim() || null
        })
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; user?: UserInit };
      if (!res.ok || j?.ok === false) throw new Error(j?.error ?? res.statusText);
      if (j.user) {
        setName(j.user.name);
        setEmail(j.user.email);
        setPhone(j.user.phoneE164 ?? '');
      }
      setOk('Saved ✓');
      setTimeout(() => setOk(null), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <label style={{ color: '#888', fontSize: 12, fontWeight: 600 }}>Customer name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
        />
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label style={{ color: '#888', fontSize: 12, fontWeight: 600 }}>Customer email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
        />
        <div style={{ color: '#888', fontSize: 12 }}>
          This email is on the customer record (affects future orders, login, etc).
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        <label style={{ color: '#888', fontSize: 12, fontWeight: 600 }}>
          Phone (E.164, optional)
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+447700900123"
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            background: '#111',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {ok && <span style={{ color: '#0a7', fontSize: 12 }}>{ok}</span>}
        {error && (
          <span style={{ color: '#b00020', fontSize: 12 }} title={error}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
