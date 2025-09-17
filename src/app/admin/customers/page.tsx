'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './Customers.module.scss';

interface Row {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'HEAD' | 'STAFF' | 'VIEWER';
  conversations: number;
  lastActivity?: string | null;
  restricted?: boolean;
  anonymized?: boolean;
}

export default function CustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // new filters (optional)
  const [status, setStatus] = useState<'active' | 'restricted' | 'anonymized' | 'all'>('active');
  const [roleFilter, setRoleFilter] = useState<'' | 'HEAD' | 'STAFF' | 'VIEWER'>('');
  const [sourceFilter, setSourceFilter] = useState<'' | 'LOCAL' | 'WIX'>('');

  // simple debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams({
        search: debouncedQ,
        page: String(page)
      });
      if (status) params.set('status', status);
      if (roleFilter) params.set('role', roleFilter);
      if (sourceFilter) params.set('source', sourceFilter);

      const url = `/api/customers?${params.toString()}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (ignore) return;
      setRows(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [debouncedQ, page, status, roleFilter, sourceFilter]);

  const staff = useMemo(() => rows.filter((r) => r.role === 'STAFF' || r.role === 'HEAD'), [rows]);
  const customers = useMemo(() => rows.filter((r) => r.role === 'VIEWER'), [rows]);

  function onSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPage(1);
    setQ(e.target.value);
  }
  function onStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPage(1);
    setStatus(e.target.value as 'active' | 'restricted' | 'anonymized' | 'all');
  }
  function onRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPage(1);
    setRoleFilter(e.target.value as '' | 'HEAD' | 'STAFF' | 'VIEWER');
  }
  function onSourceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPage(1);
    setSourceFilter(e.target.value as '' | 'LOCAL' | 'WIX');
  }

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
                    <td>
                      {r.name}{' '}
                      {r.restricted && <span className={styles.badgeMuted}>Restricted</span>}
                      {r.anonymized && <span className={styles.badgeMuted}>Anon</span>}
                    </td>
                    <td className={styles.hideSm}>
                      <a href={`mailto:${r.email}`} className={styles.link}>
                        {r.email}
                      </a>
                    </td>
                    <td className={styles.hideSm}>{r.phone ?? '—'}</td>
                    <td>
                      <span className={`${styles.role} ${styles[r.role.toLowerCase()]}`}>
                        {r.role}
                      </span>
                    </td>
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
        <input placeholder="Search name, email, phone…" value={q} onChange={onSearchChange} />

        <select value={status} onChange={onStatusChange} aria-label="Status">
          <option value="active">Active</option>
          <option value="restricted">Restricted</option>
          <option value="anonymized">Anonymized</option>
          <option value="all">All</option>
        </select>

        <select value={roleFilter} onChange={onRoleChange} aria-label="Role">
          <option value="">Any role</option>
          <option value="HEAD">HEAD</option>
          <option value="STAFF">STAFF</option>
          <option value="VIEWER">VIEWER</option>
        </select>

        <select value={sourceFilter} onChange={onSourceChange} aria-label="Source">
          <option value="">Any source</option>
          <option value="LOCAL">LOCAL</option>
          <option value="WIX">WIX</option>
        </select>
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
