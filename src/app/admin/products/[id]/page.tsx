'use client';

import { optionTypeLabel } from '@/lib/admin-labels';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';
import MediaField from '@/components/media/MediaField';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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

const INVENTORY_OPTIONS = ['In Stock', 'Out of Stock'];
const OPTION_TYPES = ['DROP_DOWN', 'RADIO', 'CHECKBOX'];

export default function ProductEditPage() {
  const params = useParams() as { id?: string } | null;
  const id = params?.id;
  const router = useRouter();
  const { toast, confirm } = useAdminUi();

  const [p, setP] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Snapshot of the last loaded/saved state, for dirty checking.
  const savedRef = useRef<string>('');
  const isDirty = p !== null && JSON.stringify(p) !== savedRef.current;

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
      setLoadErr(null);
      try {
        const res = await fetch(`/api/admin/products/${id}`);
        if (!res.ok) {
          setLoadErr(res.status === 404 ? 'Product not found.' : `Failed to load (${res.status}).`);
          return;
        }
        const data = await res.json();
        if (ignore) return;
        setP(data.product as Product);
        savedRef.current = JSON.stringify(data.product);
      } catch {
        if (!ignore) setLoadErr('Network error — could not load product.');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const set = <K extends keyof Product>(k: K, v: Product[K]) =>
    setP((prev) => (prev ? { ...prev, [k]: v } : prev));

  const parentCats = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childCats = useMemo(() => categories.filter((c) => c.parentId), [categories]);

  async function save(close: boolean) {
    if (!id || !p) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p)
      });
      if (res.ok) {
        savedRef.current = JSON.stringify(p);
        toast.success('Product saved.');
        if (close) router.push('/admin/products');
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message ?? `Save failed (${res.status}).`);
      }
    } catch {
      toast.error('Network error — could not save.');
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    if (isDirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        message: 'Your edits to this product will be lost.',
        confirmLabel: 'Discard',
        danger: true
      });
      if (!ok) return;
    }
    router.push('/admin/products');
  }

  if (!id || loading) return <div className={styles.wrap}>Loading…</div>;
  if (loadErr || !p) {
    return (
      <div className={styles.wrap}>
        <p>⚠️ {loadErr ?? 'Not found.'}</p>
        <Link href="/admin/products">← Back to products</Link>
      </div>
    );
  }

  // Inventory select: include the current value if it's non-standard so it isn't lost.
  const inventoryChoices = INVENTORY_OPTIONS.includes(p.inventory ?? '')
    ? INVENTORY_OPTIONS
    : p.inventory
      ? [p.inventory, ...INVENTORY_OPTIONS]
      : INVENTORY_OPTIONS;

  return (
    <div className={styles.wrap}>
      <div style={{ marginBottom: 8 }}>
        <Link
          href="/admin/products"
          style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none', color: '#007bff' }}
        >
          ← Back to products
        </Link>
      </div>

      <h1>
        Edit: {p.name}
        {isDirty && (
          <span style={{ fontSize: 13, fontWeight: 600, color: '#b45309', marginLeft: 10 }}>
            • Unsaved changes
          </span>
        )}
      </h1>

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
              <select
                value={p.inventory ?? ''}
                onChange={(e) => set('inventory', e.target.value || null)}
              >
                <option value="">— Not set —</option>
                {inventoryChoices.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
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
              Legacy collection path
              <input
                value={p.collection ?? ''}
                placeholder="e.g. Bakery; Savouries"
                title="Old free-text taxonomy kept for imported products. Prefer Category above."
                onChange={(e) => set('collection', e.target.value || null)}
              />
            </label>
            <label>
              Ribbon / badge
              <input
                value={p.ribbon ?? ''}
                placeholder="e.g. NEW, HOT, SALE"
                onChange={(e) => set('ribbon', e.target.value || null)}
              />
            </label>

            <MediaField
              value={p.productImageUrl}
              onChange={(url) => set('productImageUrl', url)}
              pathSegments={['products', p.name || 'product']}
              itemName="main"
              label="Product image"
              modalTitle="Choose product image"
              accept="image/*"
            />

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
              Discount value {p.discountMode === 'PERCENT' ? '(%)' : p.discountMode === 'AMOUNT' ? '(£)' : ''}
              <input
                type="number"
                step="0.01"
                min="0"
                max={p.discountMode === 'PERCENT' ? 100 : undefined}
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
            const currentType = String(p[typeKey] ?? '');
            const typeChoices =
              currentType && !OPTION_TYPES.includes(currentType)
                ? [currentType, ...OPTION_TYPES]
                : OPTION_TYPES;
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
                    <select
                      value={currentType}
                      onChange={(e) => set(typeKey, e.target.value || null)}
                    >
                      <option value="">— Select —</option>
                      {typeChoices.map((t) => (
                        <option key={t} value={t}>
                          {optionTypeLabel(t)}
                        </option>
                      ))}
                    </select>
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

      <div
        className={styles.actions}
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#fff',
          padding: '12px 0',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end'
        }}
      >
        <button onClick={() => void cancel()} className={styles.secondary}>
          Cancel
        </button>
        <button onClick={() => void save(false)} disabled={saving} className={styles.secondary}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => void save(true)} disabled={saving} className={styles.primary}>
          {saving ? 'Saving…' : 'Save & close'}
        </button>
      </div>
    </div>
  );
}
