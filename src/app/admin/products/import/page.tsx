// src/app/admin/products/import/page.tsx
'use client';

import { Download } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import styles from './Import.module.scss';

interface RowError {
  row: string;
  reason: string;
}

interface ImportResult {
  ok?: boolean;
  dry?: boolean;
  upserted?: number;
  skipped?: number;
  errors?: RowError[];
  errorsTruncated?: boolean;
  message?: string;
}

export default function ImportProductsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'validate' | 'import' | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [failMsg, setFailMsg] = useState<string | null>(null);

  async function run(dry: boolean) {
    if (!file) return;
    setFailMsg(null);
    setResult(null);

    const fd = new FormData();
    fd.append('file', file);
    if (dry) fd.append('dry', '1');

    setBusy(dry ? 'validate' : 'import');
    try {
      const res = await fetch('/api/admin/products/import', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as ImportResult;
      if (res.ok) {
        setResult(data);
      } else {
        setFailMsg(data.message ?? `Import failed (${res.status}).`);
      }
    } catch {
      setFailMsg('Network error — import did not run.');
    } finally {
      setBusy(null);
    }
  }

  function downloadErrorReport() {
    if (!result?.errors?.length) return;
    const lines = [
      'row,reason',
      ...result.errors.map((e) => `"${e.row}","${e.reason.replace(/"/g, '""')}"`)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.wrap}>
      <h1>Import Products</h1>

      <div className={styles.card}>
        <p>
          Upload a CSV with columns: <code>id</code>, <code>name</code>, <code>sku</code>,{' '}
          <code>price</code>, <code>inventory</code>, <code>collection</code>,{' '}
          <code>productImageUrl</code>, <code>visible</code>, <code>brand</code>,{' '}
          <code>description</code>.
        </p>
        <p>
          Tip: If <code>collection</code> contains multiple segments like{' '}
          <code>Bakery;Savouries B1G1F</code>, we’ll store the whole string. The list view shows
          only the last segment (“Savouries B1G1F”).
        </p>
        <p>
          Use <strong>Validate only</strong> first — it checks every row and reports problems
          without changing any data.
        </p>

        <div className={styles.actions}>
          <a href="/api/admin/products/export-template" className={styles.secondaryBtn}>
            <Download size={16} style={{ marginRight: 6 }} /> Download template
          </a>
          <Link href="/admin/products" className={styles.link}>
            Back to products
          </Link>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(false);
        }}
        className={styles.form}
        encType="multipart/form-data"
      >
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setResult(null);
            setFailMsg(null);
          }}
          required
        />
        <button
          type="button"
          disabled={!file || busy !== null}
          className={styles.secondaryBtn}
          onClick={() => void run(true)}
        >
          {busy === 'validate' ? 'Validating…' : 'Validate only'}
        </button>
        <button type="submit" disabled={!file || busy !== null} className={styles.primaryBtn}>
          {busy === 'import' ? 'Importing…' : 'Import CSV'}
        </button>
      </form>

      {failMsg && <p className={styles.note}>❌ {failMsg}</p>}

      {result && (
        <div className={styles.card} style={{ marginTop: 12 }}>
          <p>
            {result.dry ? '🔍 Validation result:' : '✅ Import result:'}{' '}
            <strong>{result.upserted ?? 0}</strong> row{(result.upserted ?? 0) === 1 ? '' : 's'}{' '}
            {result.dry ? 'would be imported' : 'imported'}, <strong>{result.skipped ?? 0}</strong>{' '}
            skipped.
          </p>

          {result.errors && result.errors.length > 0 && (
            <>
              <p style={{ fontWeight: 700, marginBottom: 6 }}>
                Problems{result.errorsTruncated ? ' (first 200 shown)' : ''}:
              </p>
              <div
                style={{
                  maxHeight: 260,
                  overflow: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Row / ID</th>
                      <th style={thStyle}>Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{e.row}</td>
                        <td style={tdStyle}>{e.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className={styles.secondaryBtn}
                style={{ marginTop: 10 }}
                onClick={downloadErrorReport}
              >
                <Download size={16} style={{ marginRight: 6 }} /> Download error report (CSV)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: '1px solid #e5e7eb',
  background: '#f9fafb'
};

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid #f3f4f6'
};
