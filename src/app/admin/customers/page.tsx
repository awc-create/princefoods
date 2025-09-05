'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './Customers.module.scss';

interface Row {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'HEAD' | 'STAFF' | 'VIEWER';
  conversations: number;
  lastActivity?: string | null;
}

export default function CustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/customers?search=${encodeURIComponent(q)}&page=${page}`);
      const data = await res.json();
      if (ignore) return;
      setRows(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [q, page]);

  const staff = rows.filter((r) => r.role === 'STAFF' || r.role === 'HEAD');
  const customers = rows.filter((r) => r.role === 'VIEWER');

  function renderTable(title: string, data: Row[]) {
    return (
      <div className={styles.block}>
        <h2>{title}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th className={styles.hideSm}>Email</th>
                <th className={styles.hideSm}>Phone</th>
                <th>Role</th>
                <th>Conversations</th>
                <th className={styles.hideSm}>Last interaction</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    Loading…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.muted}>
                    None found
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className={styles.hideSm}>{r.email}</td>
                    <td className={styles.hideSm}>{r.phone ?? '—'}</td>
                    <td>{r.role}</td>
                    <td>{r.conversations}</td>
                    <td className={styles.hideSm}>{r.lastActivity ?? '—'}</td>
                    <td>
                      <Link href={`/admin/customers/${r.id}`} className={styles.viewLink}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <h1>Customers</h1>

      <div className={styles.toolbar}>
        <input
          placeholder="Search name, email, phone…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
      </div>

      {renderTable('Staff Users', staff)}
      {renderTable('Customers', customers)}

      <div className={styles.pager}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
