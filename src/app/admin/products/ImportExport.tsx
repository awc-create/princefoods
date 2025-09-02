'use client';

import { useRef, useState } from 'react';
import styles from './ImportExport.module.scss';

export default function ImportExport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<{row:number; message:string}[] | null>(null);

  function exportCsv() {
    window.location.href = '/api/admin/products/export';
  }

  async function importCsv(file: File) {
    setBusy(true); setNote(null); setErrors(null);
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch('/api/admin/products/import', { method: 'POST', body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok || json?.ok === false) {
      setNote(`❌ Import failed: ${json?.message || res.statusText}`);
      return;
    }
    const created = (json.results || []).filter((r:any)=>r.action==='created').length;
    const updated = (json.results || []).filter((r:any)=>r.action==='updated').length;
    setNote(`✅ Import complete – ${created} created, ${updated} updated.`);
    setErrors(json.errors?.length ? json.errors : null);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <button onClick={exportCsv} className={styles.primary} disabled={busy}>Export CSV</button>
        <button onClick={()=>inputRef.current?.click()} className={styles.secondary} disabled={busy}>
          {busy ? 'Importing…' : 'Import CSV'}
        </button>
        <input
          type="file"
          accept=".csv,text/csv"
          ref={inputRef}
          style={{display:'none'}}
          onChange={(e)=>{ const f=e.target.files?.[0]; if (f) importCsv(f); e.currentTarget.value=''; }}
        />
        <a
          className={styles.link}
          href="/api/admin/products/export"
          onClick={(e)=>{ /* also serves as a template */ }}
        >
          Download current CSV (use as template)
        </a>
      </div>

      {note && <p className={styles.note}>{note}</p>}
      {errors && errors.length > 0 && (
        <div className={styles.card}>
          <strong>Rows with errors</strong>
          <ul className={styles.errList}>
            {errors.map((e,i)=>(<li key={i}>Row {e.row}: {e.message}</li>))}
          </ul>
        </div>
      )}

      <details className={styles.card}>
        <summary><strong>CSV columns</strong> (first row must be headers)</summary>
        <p className={styles.muted}>
          Minimal columns: <code>name, price, visible</code>. Optional: everything you see in the export.
          If you include <code>id</code>, rows will update; otherwise they’ll be created.
        </p>
      </details>
    </div>
  );
}
