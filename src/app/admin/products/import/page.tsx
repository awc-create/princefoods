'use client';

import { useState } from 'react';
import styles from './Import.module.scss';
import Link from 'next/link';
import { Download } from 'lucide-react';

export default function ImportProductsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!file) return;

    const fd = new FormData();
    fd.append('file', file);

    setBusy(true);
    const res = await fetch('/api/admin/products/import', {
      method: 'POST',
      body: fd,
    });
    setBusy(false);

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage(`✅ Imported ${data.upserted} rows, ${data.skipped} skipped.`);
    } else {
      setMessage(`❌ ${data.message || 'Import failed'}`);
    }
  }

  return (
    <div className={styles.wrap}>
      <h1>Import Products</h1>

      <div className={styles.card}>
        <p>Upload a CSV with columns: <code>id</code>, <code>name</code>, <code>sku</code>, <code>price</code>, <code>inventory</code>, <code>collection</code>, <code>productImageUrl</code>, <code>visible</code>, <code>brand</code>, <code>description</code>.</p>
        <p>Tip: If <code>collection</code> contains multiple segments like <code>Bakery;Savouries B1G1F</code>, we’ll store the whole string. The list view shows only the last segment (“Savouries B1G1F”).</p>

        <div className={styles.actions}>
          <a href="/api/admin/products/export-template" className={styles.secondaryBtn}>
            <Download size={16} style={{ marginRight: 6 }}/> Download template
          </a>
          <Link href="/admin/products" className={styles.link}>Back to products</Link>
        </div>
      </div>

      <form onSubmit={onSubmit} className={styles.form} encType="multipart/form-data">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          required
        />
        <button type="submit" disabled={!file || busy} className={styles.primaryBtn}>
          {busy ? 'Importing…' : 'Import CSV'}
        </button>
      </form>

      {message && <p className={styles.note}>{message}</p>}
    </div>
  );
}
