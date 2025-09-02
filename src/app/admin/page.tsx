'use client';

import styles from './Admin.module.scss';
import SetupPush from './SetupPush';

export default function AdminDashboard() {
  return (
    <div>
      <SetupPush />
      <h1>Admin Dashboard</h1>
      <div className={styles.dashboardStats}>
        <div className={styles.statCard}>
          <h2>Products</h2>
          <p>124</p>
        </div>
        <div className={styles.statCard}>
          <h2>Customers</h2>
          <p>45</p>
        </div>
        <div className={styles.statCard}>
          <h2>Orders</h2>
          <p>320</p>
        </div>
        <div className={styles.statCard}>
          <h2>Revenue</h2>
          <p>£12,450</p>
        </div>
      </div>
    </div>
  );
}
