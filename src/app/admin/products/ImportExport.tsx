// src/app/admin/products/ImportExport.tsx
'use client';

import { useRef, useState } from 'react';
import styles from './ImportExport.module.scss';

interface ImportError {
  ok: false;
  message?: string;
  errors?: { row: number; message: string }[];
}

interface ImportSuccess {
  ok: true;
  results?: { action: 'created' | 'updated' | string }[];
  errors?: { row: number; message: string }[];
}

// Type guards without `any`
function isImportError(v: unknown): v is ImportError {
  return typeof v === 'object' && v !== null && 'ok' in v && (v as { ok?: unknown }).ok === false;
}
function isImportSuccess(v: unknown): v is ImportSuccess {
  return typeof v === 'object' && v !== null && 'ok' in v && (v as { ok?: unknown }).ok === true;
}

export default function ImportExport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ row: number; message: string }[] | null>(null);

  function exportCsv() {
    window.location.href = '/api/admin/products/export';
  }

  async function importCsv(file: File) {
    setBusy(true);
    setNote(null);
    setErrors(null);

    const fd = new FormData();
    fd.set('file', file);

    const res = await fetch('/api/admin/products/import', { method: 'POST', body: fd });
    const raw: unknown = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok || isImportError(raw)) {
      const msg = isImportError(raw) && raw.message ? raw.message : res.statusText;
      setNote(`❌ Import failed: ${msg}`);
      setErrors(isImportError(raw) && raw.errors?.length ? raw.errors : null);
      return;
    }

    const results = isImportSuccess(raw) && raw.results ? raw.results : [];
    const created = results.filter((r) => r.action === 'created').length;
    const updated = results.filter((r) => r.action === 'updated').length;

    setNote(`✅ Import complete – ${created} created, ${updated} updated.`);
    setErrors(isImportSuccess(raw) && raw.errors?.length ? raw.errors : null);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <button onClick={exportCsv} className={styles.primary} disabled={busy}>
          Export CSV
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          className={styles.secondary}
          disabled={busy}
        >
          {busy ? 'Importing…' : 'Import CSV'}
        </button>
        <input
          type="file"
          accept=".csv,text/csv"
          ref={inputRef}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importCsv(f);
            e.currentTarget.value = '';
          }}
        />
        <a
          className={styles.link}
          href="/api/admin/products/export"
          onClick={(_e) => {
            /* also serves as a template */
          }}
        >
          Download current CSV (use as template)
        </a>
      </div>

      {note && <p className={styles.note}>{note}</p>}
      {errors && errors.length > 0 && (
        <div className={styles.card}>
          <strong>Rows with errors</strong>
          <ul className={styles.errList}>
            {errors.map((e, i) => (
              <li key={`${e.row}-${i}`}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className={styles.card}>
        <summary>
          <strong>CSV columns</strong> (first row must be headers)
        </summary>
        <p className={styles.muted}>
          Minimal columns: <code>name, price, visible</code>. Optional: everything you see in the
          export. If you include <code>id</code>, rows will update; otherwise they’ll be created.
        </p>
      </details>
    </div>
  );
}
