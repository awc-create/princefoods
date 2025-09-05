'use client';

import { Lock, Pencil, Save, Trash2, User, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './Settings.module.scss';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'account' | 'password' | 'staff'>('account');
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
        {userRole === 'HEAD' && (
          <button
            className={activeTab === 'staff' ? styles.active + ' active' : ''}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={16} /> Staff Permissions
          </button>
        )}
      </div>

      <div className={styles.tabContent}>
        {activeTab === 'account' && <AccountInfo />}
        {activeTab === 'password' && <ChangePassword />}
        {activeTab === 'staff' && userRole === 'HEAD' && <StaffPermissions />}
      </div>
    </div>
  );
}

/* ---------- Account Info ---------- */
function AccountInfo() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/me');
        if (!res.ok) throw new Error('Not logged in');
        const data = await res.json();
        setName(data.user?.name ?? '');
        setEmail(data.user?.email ?? '');
        setRole((data.user?.role as Role) ?? '');
      } catch {
        setError('Failed to load account info');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className={styles.muted}>Loading account info…</p>;
  if (error) return <p>{error}</p>;

  const roleLabels: Record<Role, string> = { HEAD: 'Head Admin', STAFF: 'Staff', VIEWER: 'Viewer' };

  return (
    <form className={styles.passwordForm}>
      <label>
        Full Name:
        <input type="text" value={name} disabled />
      </label>
      <label>
        Email Address:
        <input type="email" value={email} disabled />
      </label>
      <label>
        Role:
        <input type="text" value={role ? roleLabels[role as Role] : ''} disabled />
      </label>
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

/* ---------- Staff Permissions ---------- */
function StaffPermissions() {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF' as 'STAFF' | 'VIEWER'
  });
  const [message, setMessage] = useState('');

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    email: string;
    role: 'STAFF' | 'VIEWER';
    password?: string;
  } | null>(null);

  useEffect(() => {
    refresh();
  }, []);
  async function refresh() {
    const res = await fetch('/api/admin/staff');
    const data = await res.json();
    setStaffList(data);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      await refresh();
      setForm({ name: '', email: '', password: '', role: 'STAFF' });
      setMessage('✅ Staff user created');
    } else {
      const err = await res.json();
      setMessage(`❌ ${err.message}`);
    }
    setTimeout(() => setMessage(''), 3500);
  }

  const startEdit = (u: StaffUser) => {
    setEditingId(u.id);
    setEditDraft({
      name: u.name,
      email: u.email,
      role: (u.role === 'HEAD' ? 'STAFF' : u.role) as 'STAFF' | 'VIEWER'
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
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, role: e.target.value as 'STAFF' | 'VIEWER' })
                  }
                >
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
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as 'STAFF' | 'VIEWER' })}
          >
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
