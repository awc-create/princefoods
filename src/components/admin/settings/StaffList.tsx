'use client'

import { useEffect, useState } from 'react'
import styles from './Settings.module.scss'
import type { StaffUser } from './types'

export default function StaffList() {
  const [staffList, setStaffList] = useState<StaffUser[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/staff')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch staff')
        return res.json()
      })
      .then(data => setStaffList(data))
      .catch(err => {
        console.error(err)
        setError('Unable to load staff list.')
      })
  }, [])

  const handleDelete = async (id: string) => {
    const confirm = window.confirm('Are you sure you want to delete this staff user?')
    if (!confirm) return

    const res = await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setStaffList(prev => prev.filter(user => user.id !== id))
    } else {
      const err = await res.json()
      alert(`❌ ${err.message}`)
    }
  }

  if (error) return <p>{error}</p>

  return (
    <ul className={styles.staffList}>
      {staffList.map(user => (
        <li key={user.id}>
          {user.name} ({user.role}) — {user.email}
          <button
            onClick={() => handleDelete(user.id)}
            className={styles.deleteBtn}
            title="Delete staff"
          >
            ✖
          </button>
        </li>
      ))}
    </ul>
  )
}
