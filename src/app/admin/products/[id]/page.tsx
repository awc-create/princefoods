'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './Edit.module.scss';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  caseQty: number | null;
  inventory: string | null;
  collection: string | null;
  categoryId: string | null;
  productImageUrl: string | null;
  description: string | null;
  visible: boolean;
  brand: string | null;
  ribbon: string | null;
  discountMode: string | null;
  discountValue: number | null;
  shippingWeightGrams: number | null;
  shippingTemp: string;
  tags: string[];
  // Product options (up to 6 shown, 15 in schema)
  productOptionName1: string | null;
  productOptionType1: string | null;
  productOptionDescription1: string | null;
  productOptionName2: string | null;
  productOptionType2: string | null;
  productOptionDescription2: string | null;
  productOptionName3: string | null;
  productOptionType3: string | null;
  productOptionDescription3: string | null;
  productOptionName4: string | null;
  productOptionType4: string | null;
  productOptionDescription4: string | null;
  productOptionName5: string | null;
  productOptionType5: string | null;
  productOptionDescription5: string | null;
  productOptionName6: string | null;
  productOptionType6: string | null;
  productOptionDescription6: string | null;
  // Additional info (up to 10)
  additionalInfoTitle1: string | null;
  additionalInfoDescription1: string | null;
  additionalInfoTitle2: string | null;
  additionalInfoDescription2: string | null;
  additionalInfoTitle3: string | null;
  additionalInfoDescription3: string | null;
  additionalInfoTitle4: string | null;
  additionalInfoDescription4: string | null;
  additionalInfoTitle5: string | null;
  additionalInfoDescription5: string | null;
  additionalInfoTitle6: string | null;
  additionalInfoDescription6: string | null;
  additionalInfoTitle7: string | null;
  additionalInfoDescription7: string | null;
  additionalInfoTitle8: string | null;
  additionalInfoDescription8: string | null;
  additionalInfoTitle9: string | null;
  additionalInfoDescription9: string | null;
  additionalInfoTitle10: string | null;
  additionalInfoDescription10: string | null;
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export default function ProductEditPage() {
  const params = useParams() as { id?: string } | null;
  const id = params?.id;
  const router = useRouter();

  const [p, setP] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((d: { categories?: Category[] }) => setCategories(d.categories ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ignore = false;
    if (!id) return;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/products/${id}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (ignore) return;
      setP(data.product as Product);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  if (!id || loading) return <div className={styles.wrap}>Loading…</div>;
  if (!p) return <div className={styles.wrap}>Not found.</div>;

  async function save() {
    if (!id || !p) return;
    setSaving(true);
    setSaveErr(null);
    setSaveOk(false);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
      if (res.ok) {
        setSaveOk(true);
        setTimeout(() => router.push('/admin/products'), 800);
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveErr(err?.message ?? `Save failed (${res.status})`);
      }
    } catch {
      setSaveErr('Network error — could not save.');
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Product>(k: K, v: Product[K]) =>
    setP((prev) => (prev ? { ...prev, [k]: v } : prev));

  // Flat category list for dropdown
  const parentCats = categories.filter((c) => !c.parentId);
  const childCats = categories.filter((c) => c.parentId);

  return (
    <div className={styles.wrap}>
      <h1>Edit: {p.name}</h1>

      {saveErr && <div className={styles.errBanner}>⚠️ {saveErr}</div>}
      {saveOk && <div className={styles.okBanner}>✅ Saved! Redirecting…</div>}

      <div className={styles.sections}>
        {/* ── Core ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Core details</h2>
          <div className={styles.form}>
            <label>
              Name
              <input value={p.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label>
              SKU
              <input value={p.sku ?? ''} onChange={(e) => set('sku', e.target.value || null)} />
            </label>
            <label>
              Brand
              <input
                value={p.brand ?? ''}
                placeholder="e.g. Prince Foods"
                onChange={(e) => set('brand', e.target.value || null)}
              />
            </label>
            <label>
              Price (£)
              <input
                type="number"
                step="0.01"
                min="0"
                value={p.price ?? ''}
                onChange={(e) => set('price', e.target.value ? Number(e.target.value) : null)}
              />
            </label>
            <label>
              Units per case (caseQty)
              <input
                type="number"
                min="1"
                value={p.caseQty ?? ''}
                onChange={(e) =>
                  set('caseQty', e.target.value ? Math.trunc(Number(e.target.value)) : null)
                }
              />
            </label>
            <label>
              Inventory
              <input
                value={p.inventory ?? ''}
                placeholder="e.g. In Stock"
                onChange={(e) => set('inventory', e.target.value || null)}
              />
            </label>
            <label>
              Collection
              <input
                value={p.collection ?? ''}
                placeholder="e.g. Snacks"
                onChange={(e) => set('collection', e.target.value || null)}
              />
            </label>
            <label>
              Category
              <select
                value={p.categoryId ?? ''}
                onChange={(e) => set('categoryId', e.target.value || null)}
              >
                <option value="">— None —</option>
                {parentCats.map((cat) => (
                  <optgroup key={cat.id} label={cat.name}>
                    <option value={cat.id}>{cat.name} (parent)</option>
                    {childCats
                      .filter((c) => c.parentId === cat.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          ↳ {c.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              Ribbon / badge
              <input
                value={p.ribbon ?? ''}
                placeholder="e.g. NEW, HOT, SALE"
                onChange={(e) => set('ribbon', e.target.value || null)}
              />
            </label>
            <label>
              Image URL
              <input
                value={p.productImageUrl ?? ''}
                onChange={(e) => set('productImageUrl', e.target.value || null)}
              />
            </label>
            <label>
              Description
              <textarea
                rows={4}
                value={p.description ?? ''}
                onChange={(e) => set('description', e.target.value || null)}
              />
            </label>
            <label>
              Tags (comma separated)
              <input
                value={p.tags?.join(', ') ?? ''}
                placeholder="e.g. gluten-free, vegan"
                onChange={(e) =>
                  set(
                    'tags',
                    e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label className={styles.inline}>
              <input
                type="checkbox"
                checked={p.visible}
                onChange={(e) => set('visible', e.target.checked)}
              />
              Visible in store
            </label>
          </div>
        </section>

        {/* ── Pricing / Offers ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Discount (product-level)</h2>
          <div className={styles.form}>
            <label>
              Discount mode
              <select
                value={p.discountMode ?? ''}
                onChange={(e) => set('discountMode', e.target.value || null)}
              >
                <option value="">— None —</option>
                <option value="PERCENT">% off</option>
                <option value="AMOUNT">£ off</option>
              </select>
            </label>
            <label>
              Discount value
              <input
                type="number"
                step="0.01"
                min="0"
                value={p.discountValue ?? ''}
                onChange={(e) =>
                  set('discountValue', e.target.value ? Number(e.target.value) : null)
                }
              />
            </label>
          </div>
        </section>

        {/* ── Shipping ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Shipping</h2>
          <div className={styles.form}>
            <label>
              Shipping weight (grams)
              <input
                type="number"
                min="0"
                value={p.shippingWeightGrams ?? ''}
                onChange={(e) =>
                  set(
                    'shippingWeightGrams',
                    e.target.value ? Math.trunc(Number(e.target.value)) : null
                  )
                }
              />
            </label>
            <label>
              Shipping temperature
              <select
                value={p.shippingTemp ?? 'DRY'}
                onChange={(e) => set('shippingTemp', e.target.value)}
              >
                <option value="DRY">Dry / ambient</option>
                <option value="FROZEN">Frozen / chilled</option>
              </select>
            </label>
          </div>
        </section>

        {/* ── Product Options ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Product options{' '}
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6b7280' }}>
              (e.g. Size, Flavour)
            </span>
          </h2>
          {[1, 2, 3, 4, 5, 6].map((i) => {
            const nameKey = `productOptionName${i}` as keyof Product;
            const typeKey = `productOptionType${i}` as keyof Product;
            const descKey = `productOptionDescription${i}` as keyof Product;
            if (i > 1 && !p[`productOptionName${i - 1}` as keyof Product]) return null;
            return (
              <div
                key={i}
                style={{
                  marginBottom: 12,
                  padding: '10px 12px',
                  background: '#f9fafb',
                  borderRadius: 8,
                  border: '1px solid #f0ede6'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#374151' }}>
                  Option {i}
                </div>
                <div className={styles.form} style={{ gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
                  <label style={{ gap: 4 }}>
                    Name
                    <input
                      placeholder="e.g. Size"
                      value={String(p[nameKey] ?? '')}
                      onChange={(e) => set(nameKey, e.target.value || null)}
                    />
                  </label>
                  <label style={{ gap: 4 }}>
                    Type
                    <input
                      placeholder="e.g. DROP_DOWN"
                      value={String(p[typeKey] ?? '')}
                      onChange={(e) => set(typeKey, e.target.value || null)}
                    />
                  </label>
                  <label style={{ gap: 4 }}>
                    Choices
                    <input
                      placeholder="e.g. Small,Medium,Large"
                      value={String(p[descKey] ?? '')}
                      onChange={(e) => set(descKey, e.target.value || null)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </section>

        {/* ── Additional Info ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Additional info{' '}
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6b7280' }}>
              (e.g. Ingredients, Allergens)
            </span>
          </h2>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => {
            const titleKey = `additionalInfoTitle${i}` as keyof Product;
            const descKey = `additionalInfoDescription${i}` as keyof Product;
            if (i > 1 && !p[`additionalInfoTitle${i - 1}` as keyof Product]) return null;
            return (
              <div
                key={i}
                style={{
                  marginBottom: 8,
                  padding: '8px 12px',
                  background: '#f9fafb',
                  borderRadius: 8,
                  border: '1px solid #f0ede6'
                }}
              >
                <div className={styles.form} style={{ gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                  <label style={{ gap: 4 }}>
                    Title
                    <input
                      placeholder="e.g. Ingredients"
                      value={String(p[titleKey] ?? '')}
                      onChange={(e) => set(titleKey, e.target.value || null)}
                    />
                  </label>
                  <label style={{ gap: 4 }}>
                    Content
                    <textarea
                      rows={2}
                      placeholder="e.g. Sugar, Cocoa..."
                      value={String(p[descKey] ?? '')}
                      onChange={(e) => set(descKey, e.target.value || null)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <div className={styles.actions}>
        <button onClick={() => router.back()} className={styles.secondary}>
          Cancel
        </button>
        <button onClick={save} disabled={saving} className={styles.primary}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
