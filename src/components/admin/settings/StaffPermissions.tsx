'use client'

import { useState } from 'react'
import styles from './Settings.module.scss'
import StaffForm from './StaffForm'
import StaffList from './StaffList'

export default function StaffPermissions() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [message, setMessage] = useState('')

  const handleSuccess = (msg: string) => {
    setMessage(msg)
    setRefreshKey(prev => prev + 1)
    setTimeout(() => setMessage(''), 4000)
  }

  return (
    <div className={styles.staffContainer}>
      <h2>Staff Users</h2>
      <StaffList key={refreshKey} />
      <h3>Add Staff</h3>
      <StaffForm onSuccess={handleSuccess} />
      {message && <p className={styles.toast}>{message}</p>}
    </div>
  )
}