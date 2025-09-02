
'use client'

import { useState } from 'react'
import styles from './Settings.module.scss'

type Props = {
  onSuccess: (msg: string) => void
}

export default function StaffForm({ onSuccess }: Props) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF',
  })

  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')

    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(form),
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await res.json()
    if (res.ok) {
      onSuccess('✅ Staff user added')
      setForm({ name: '', email: '', password: '', role: 'STAFF' })
    } else {
      setMessage(`❌ ${data.message}`)
    }

    setTimeout(() => setMessage(''), 4000)
  }

  return (
    <form onSubmit={handleSubmit} className={styles.staffForm}>
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
        onChange={(e) => setForm({ ...form, role: e.target.value })}
      >
        <option value="STAFF">Staff</option>
      </select>
      <button type="submit">Add Staff</button>
      {message && <p>{message}</p>}
    </form>
  )
}