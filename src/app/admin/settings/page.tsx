'use client';

import { Clock, Lock, Package, Pencil, Save, Trash2, User, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './Settings.module.scss';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

type TabKey = 'account' | 'password' | 'staff' | 'orders' | 'shipping';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('account');
  const [userRole, setUserRole] = useState<Role | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/me')
      .then((res) => res.json())
      .then((data) => setUserRole((data.user?.role as Role) || null))
      .catch(() => setUserRole(null));
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  const canSeeHeadTabs = userRole === 'HEAD';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Admin Settings</h1>
        <button className={styles.logout} onClick={handleLogout}>
          Logout
        </button>
      </div>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'account' ? styles.active + ' active' : ''}
          onClick={() => setActiveTab('account')}
        >
          <User size={16} /> Account Info
        </button>
        <button
          className={activeTab === 'password' ? styles.active + ' active' : ''}
          onClick={() => setActiveTab('password')}
        >
          <Lock size={16} /> Change Password
        </button>

        {canSeeHeadTabs && (
          <>
            <button
              className={activeTab === 'staff' ? styles.active + ' active' : ''}
              onClick={() => setActiveTab('staff')}
            >
              <Users size={16} /> Staff Permissions
            </button>

            <button
              className={activeTab === 'orders' ? styles.active + ' active' : ''}
              onClick={() => setActiveTab('orders')}
              title="Order Settings"
            >
              <Clock size={16} /> Order Settings
            </button>

            <button
              className={activeTab === 'shipping' ? styles.active + ' active' : ''}
              onClick={() => setActiveTab('shipping')}
              title="APC Warehouse / Pickup"
            >
              <Package size={16} /> Shipping (APC)
            </button>
          </>
        )}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'account' && <AccountInfo />}
        {activeTab === 'password' && <ChangePassword />}
        {activeTab === 'staff' && canSeeHeadTabs && <StaffPermissions />}
        {activeTab === 'orders' && canSeeHeadTabs && <OrdersSettings />}
        {activeTab === 'shipping' && canSeeHeadTabs && <ShippingSettings />}
      </div>
    </div>
  );
}

/* ---------- Account Info ---------- */
function AccountInfo() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/me');
        if (!res.ok) throw new Error('Not logged in');
        const data = await res.json();
        setName(data.user?.name ?? '');
        setEmail(data.user?.email ?? '');
        setOriginalEmail(data.user?.email ?? '');
        setRole((data.user?.role as Role) ?? '');
      } catch {
        setError('Failed to load account info');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const emailChanged = email.trim().toLowerCase() !== originalEmail.toLowerCase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setToast('');
    try {
      const res = await fetch('/api/admin/update-account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? 'Update failed');
        return;
      }
      if (emailChanged) {
        // JWT still holds the old email — force re-login with new email
        setToast('✅ Email updated. Signing you out so you can log in with your new email…');
        setTimeout(() => {
          window.location.assign('/api/auth/signout?callbackUrl=/admin/login');
        }, 2500);
      } else {
        setToast('✅ Account updated.');
        setTimeout(() => setToast(''), 4000);
      }
    } catch {
      setError('Unexpected error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={styles.muted}>Loading account info…</p>;
  if (error && !name) return <p>{error}</p>;

  const roleLabels: Record<Role, string> = { HEAD: 'Head Admin', STAFF: 'Staff', VIEWER: 'Viewer' };

  return (
    <form onSubmit={handleSave} className={styles.passwordForm}>
      <label>
        Full Name:
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Email Address:
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {emailChanged && (
          <span style={{ fontSize: 12, color: '#d97706', marginTop: 4, display: 'block' }}>
            ⚠️ Changing your email will sign you out — you'll log back in with the new address.
          </span>
        )}
      </label>
      <label>
        Role:
        <input type="text" value={role ? roleLabels[role as Role] : ''} disabled />
      </label>
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {toast && <div className={styles.toast}>{toast}</div>}
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : emailChanged ? 'Save & sign out' : 'Save changes'}
      </button>
    </form>
  );
}

/* ---------- Change Password ---------- */
function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [toast, setToast] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast('');
    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
    const data = await res.json();
    if (res.ok) {
      setToast('✅ Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } else setToast(`❌ ${data.message}`);
    setTimeout(() => setToast(''), 5000);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.passwordForm}>
      <label>
        Current Password:
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </label>
      <label>
        New Password:
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </label>
      <button type="submit">Change Password</button>
      {toast && <div className={styles.toast}>{toast}</div>}
    </form>
  );
}

/* ---------- Order Settings (HEAD only) ---------- */
function OrdersSettings() {
  const [minutes, setMinutes] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/settings/orders');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = (await res.json()) as { cancelReversalMinutes?: number };
        setMinutes(
          typeof data.cancelReversalMinutes === 'number' ? data.cancelReversalMinutes : 1440
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const presets = [
    { label: '1h', value: 60 },
    { label: '4h', value: 240 },
    { label: '24h', value: 1440 },
    { label: '7d', value: 10080 }
  ];

  const previewDeadline = useMemo(() => {
    const n = Number(minutes);
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = new Date(Date.now() + n * 60 * 1000);
    return d.toLocaleString('en-GB');
  }, [minutes]);

  const humanised = useMemo(() => {
    const n = Number(minutes);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n % 10080 === 0) return `${n / 10080} week${n / 10080 === 1 ? '' : 's'}`;
    if (n % 1440 === 0) return `${n / 1440} day${n / 1440 === 1 ? '' : 's'}`;
    if (n % 60 === 0) return `${n / 60} hour${n / 60 === 1 ? '' : 's'}`;
    return `${n} minutes`;
  }, [minutes]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setToast('');
    setError('');
    const n = Number(minutes);
    if (!Number.isFinite(n) || n <= 0 || n > 40320) {
      setError('Invalid minutes');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancelReversalMinutes: n })
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error ?? 'Save failed');
      setToast('✅ Order settings saved.');
      setTimeout(() => setToast(''), 4000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={styles.muted}>Loading order settings…</p>;

  return (
    <form onSubmit={save} className={`${styles.card} ${styles.orderCard}`}>
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Order Settings</h2>
          <p className={styles.cardSub}>
            Configure how long a cancelled order can be reversed. Enforced in the cancel/refund
            flow.
          </p>
        </div>
        <button type="submit" disabled={saving} className={styles.primary}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && (
        <div
          className={styles.toast}
          style={{ background: '#fff1f1', color: '#991b1b', borderColor: '#fecaca' }}
        >
          ❌ {error}
        </div>
      )}

      <div className={styles.formGrid}>
        {/* LEFT */}
        <div className={styles.fieldset}>
          <div className={styles.fieldRow}>
            <label htmlFor="reversalMinutes" className={styles.label}>
              Reversal window
            </label>

            <div className={styles.inputWithUnits}>
              <input
                id="reversalMinutes"
                className={styles.numInput}
                inputMode="numeric"
                pattern="[0-9]*"
                type="number"
                min={1}
                max={40320}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 1440"
                required
                onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              />

              <div className={styles.stepper} aria-hidden="false">
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label="Increase minutes"
                  onClick={() => {
                    const n = Math.min(40320, Math.max(1, (Number(minutes) || 0) + 1));
                    setMinutes(n);
                  }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className={styles.stepBtn}
                  aria-label="Decrease minutes"
                  onClick={() => {
                    const n = Math.min(40320, Math.max(1, (Number(minutes) || 0) - 1));
                    setMinutes(n);
                  }}
                >
                  ▼
                </button>
              </div>

              <span className={styles.unit}>minutes</span>
            </div>

            <div className={styles.hintRow}>
              <span className={styles.help}>1440 = 24 hours. Max 40320 (28 days).</span>
              {humanised && <span className={styles.currentVal}>Currently: {humanised}</span>}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className={styles.fieldset}>
          <div className={styles.labelRow}>
            <span className={styles.label}>Quick presets</span>
          </div>
          <div className={styles.chips}>
            {presets.map((p) => {
              const active = minutes === p.value;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setMinutes(p.value)}
                  className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                  aria-pressed={active}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {previewDeadline && (
            <div className={styles.previewPanel}>
              <div>If cancelled now, reversal allowed until:</div>
              <strong className={styles.previewStrong}>{previewDeadline}</strong>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className={styles.toast} style={{ marginTop: 4 }}>
          {toast}
        </div>
      )}
    </form>
  );
}

/* ---------- Shipping (APC) Settings (HEAD only) ---------- */
interface ShipForm {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  postcode: string;
  countryCode: string;
}

function ShippingSettings() {
  const [form, setForm] = useState<ShipForm>({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    address1: '',
    address2: '',
    city: '',
    postcode: '',
    countryCode: 'GB'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/settings/shipping');
        const data = await res.json();
        if (res.ok && data?.data) setForm(data.data as ShipForm);
        else throw new Error(data?.error ?? 'Failed to load');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setToast('');
    try {
      const res = await fetch('/api/admin/settings/shipping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) throw new Error(data?.error ?? 'Save failed');
      setToast('✅ Shipping (APC) settings saved.');
      setTimeout(() => setToast(''), 3500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className={styles.muted}>Loading shipping settings…</p>;

  const field = (
    label: string,
    key: keyof ShipForm,
    opts: { type?: string; required?: boolean; maxLength?: number; placeholder?: string } = {}
  ) => (
    <div className={styles.shipField}>
      <label className={styles.shipLabel}>
        {label}
        {opts.required && <span className={styles.req}>*</span>}
      </label>
      <input
        className={styles.shipInput}
        type={opts.type ?? 'text'}
        value={form[key] ?? ''}
        placeholder={opts.placeholder}
        maxLength={opts.maxLength}
        required={opts.required}
        onChange={(e) =>
          setForm({
            ...form,
            [key]: opts.maxLength === 2 ? e.target.value.toUpperCase() : e.target.value
          })
        }
      />
    </div>
  );

  return (
    <form onSubmit={save} className={styles.shipForm}>
      {/* Header */}
      <div className={styles.shipHeader}>
        <div>
          <h2 className={styles.shipTitle}>🚚 APC Pickup Warehouse</h2>
          <p className={styles.shipSub}>
            Default warehouse address used when generating APC shipping labels. Can be overridden
            per shipment.
          </p>
        </div>
        <button type="submit" disabled={saving} className={styles.shipSaveBtn}>
          {saving ? 'Saving…' : '💾 Save changes'}
        </button>
      </div>

      {error && <div className={styles.shipError}>❌ {error}</div>}
      {toast && <div className={styles.shipToast}>{toast}</div>}

      {/* Contact section */}
      <div className={styles.shipSection}>
        <div className={styles.shipSectionTitle}>📋 Contact details</div>
        <div className={styles.shipGrid}>
          {field('Company name', 'companyName', {
            required: true,
            placeholder: 'Prince Foods Ltd'
          })}
          {field('Contact name', 'contactName', { required: true, placeholder: 'Jacob Varghese' })}
          {field('Phone', 'phone', { required: true, type: 'tel', placeholder: '+44 7700 900000' })}
          {field('Email', 'email', { type: 'email', placeholder: 'warehouse@princefoods.com' })}
        </div>
      </div>

      {/* Address section */}
      <div className={styles.shipSection}>
        <div className={styles.shipSectionTitle}>📍 Warehouse address</div>
        <div className={styles.shipGridFull}>
          {field('Address line 1', 'address1', {
            required: true,
            placeholder: '123 Warehouse Road'
          })}
          {field('Address line 2', 'address2', { placeholder: 'Unit 4, Industrial Estate' })}
        </div>
        <div className={styles.shipGrid} style={{ marginTop: 12 }}>
          {field('City', 'city', { required: true, placeholder: 'Birmingham' })}
          {field('Postcode', 'postcode', { required: true, placeholder: 'B1 1AA' })}
          {field('Country code', 'countryCode', {
            required: true,
            maxLength: 2,
            placeholder: 'GB'
          })}
        </div>
      </div>
    </form>
  );
}

/* ---------- Staff Permissions ---------- */
function StaffPermissions() {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF' as Role
  });
  const [message, setMessage] = useState('');

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    email: string;
    role: Role;
    password?: string;
  } | null>(null);

  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, []);
  async function refresh() {
    const res = await fetch('/api/admin/staff');
    const data = await res.json();
    setStaffList(data);
  }

  async function sendReset(u: StaffUser) {
    if (!confirm(`Send a password reset link to ${u.name} (${u.email})?`)) return;
    setResetting(u.id);
    try {
      const res = await fetch('/api/admin/staff/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: u.id })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessage(`✅ Reset link sent to ${u.email}`);
      } else {
        setMessage(`❌ ${data.message ?? 'Failed to send reset link'}`);
      }
    } catch {
      setMessage('❌ Unexpected error sending reset link');
    } finally {
      setResetting(null);
      setTimeout(() => setMessage(''), 5000);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    if (res.ok) {
      await refresh();
      setForm({ name: '', email: '', password: '', role: 'STAFF' as Role });
      setMessage(
        data.emailSent
          ? '✅ Staff user created. Welcome email sent.'
          : '✅ Staff user created (email disabled — share credentials manually).'
      );
    } else {
      setMessage(`❌ ${data.message}`);
    }
    setTimeout(() => setMessage(''), 5000);
  }

  const startEdit = (u: StaffUser) => {
    setEditingId(u.id);
    setEditDraft({
      name: u.name,
      email: u.email,
      role: u.role as Role
    });
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  async function saveEdit(id: string) {
    if (!editDraft) return;
    const res = await fetch(`/api/admin/staff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editDraft)
    });
    if (res.ok) {
      await refresh();
      cancelEdit();
      setMessage('✅ Staff user updated');
    } else {
      const err = await res.json();
      setMessage(`❌ ${err.message}`);
    }
    setTimeout(() => setMessage(''), 3500);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user?')) return;
    const res = await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refresh();
      setMessage('✅ Staff user deleted');
    } else {
      const err = await res.json();
      setMessage(`❌ ${err.message}`);
    }
    setTimeout(() => setMessage(''), 3500);
  }

  return (
    <div className={styles.staffContainer}>
      <div>
        <h2>Staff Users</h2>
        <h3>Manage STAFF &amp; VIEWER accounts</h3>
      </div>

      <ul className={styles.staffList}>
        {staffList.length === 0 && (
          <li className={styles.muted} style={{ padding: '12px 14px' }}>
            No staff yet.
          </li>
        )}

        {staffList.map((u) => (
          <li key={u.id} className={styles.itemRow}>
            {editingId === u.id && editDraft ? (
              <div className={styles.inlineEdit}>
                <input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                  placeholder="Name"
                />
                <input
                  value={editDraft.email}
                  onChange={(e) => setEditDraft({ ...editDraft, email: e.target.value })}
                  placeholder="Email"
                />
                <select
                  value={editDraft.role}
                  onChange={(e) => setEditDraft({ ...editDraft, role: e.target.value as Role })}
                >
                  <option value="HEAD">Head Admin</option>
                  <option value="STAFF">Staff</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button className={styles.iconBtn} onClick={() => saveEdit(u.id)} aria-label="Save">
                  <Save size={16} />
                </button>
                <button className={styles.iconBtn} onClick={cancelEdit} aria-label="Cancel">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className={styles.itemMeta}>
                  <span className="name">{u.name}</span>
                  <span className={styles.badge}>{u.role}</span>
                  <span className="email">{u.email}</span>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => sendReset(u)}
                    disabled={resetting === u.id}
                    aria-label="Send reset link"
                    title="Send password reset link"
                  >
                    {resetting === u.id ? '…' : '🔑'}
                  </button>
                  <button className={styles.iconBtn} onClick={() => startEdit(u)} aria-label="Edit">
                    <Pencil size={16} />
                  </button>
                  <button
                    className={styles.iconBtnDanger}
                    onClick={() => handleDelete(u.id)}
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate} className={styles.staffForm}>
        <h3>Add Staff</h3>
        <div className={styles.formRow}>
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password (optional — user will set via email)"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value="HEAD">Head Admin</option>
            <option value="STAFF">Staff</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button type="submit">Add</button>
        </div>
        {message && (
          <p className={styles.muted} style={{ marginTop: 8 }}>
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
