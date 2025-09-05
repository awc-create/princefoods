// src/app/admin/change-password/page.tsx
'use client';

import { useState } from 'react';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Updating...');

    const res = await fetch('/api/admin/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // add proper header
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (res.ok) {
      setStatus('✅ Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } else {
      let message = 'Something went wrong.';
      try {
        const data = await res.json();
        message = data.message ?? message;
      } catch {
        /* ignore JSON parse errors */
      }
      setStatus(`❌ ${message}`);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '50px auto' }}>
      <h2>Change Password</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="password"
          placeholder="Current Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <button type="submit">Update Password</button>
        {status && <p>{status}</p>}
      </form>
    </div>
  );
}
