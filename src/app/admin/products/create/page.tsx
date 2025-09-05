'use client';

import CategorySelector, { CategoryMap } from '@/components/category/CategorySelector';
import ProductImageUpload from '@/components/image/ProductImageUpload';
import { useEffect, useMemo, useState } from 'react';
import AdditionalInfoModal from './AdditionalInfoModal';
import AddProductOptionModal from './AddProductOptionModal';
import styles from './CreateProduct.module.scss';

type DiscountMode = '' | 'PERCENT' | 'AMOUNT';

interface ProductOption {
  name: string;
  type: 'List' | 'Color';
  values: string[];
}

type AdditionalInfo = Record<string, string | string[]>;

interface FormState {
  name: string;
  ribbon: string;
  description: string;
  price: number | '';
  surcharge: number | '';
  visible: boolean;
  sku: string;
  discountMode: DiscountMode;
  discountValue: number | '';
  weight: number | '';
  inventory: 'InStock' | 'OutOfStock' | 'Preorder';
  trackInventory: boolean;
  clickCount: number;
  purchaseCount: number;
  productImageUrls: string[];
  collection: string[];
  additionalInfo: AdditionalInfo;
  productOptions: ProductOption[];
}

export default function CreateProductPage() {
  const [categories, setCategories] = useState<CategoryMap>({});
  const [form, setForm] = useState<FormState>({
    name: '',
    ribbon: '',
    description: '',
    price: '',
    surcharge: '',
    visible: true,
    sku: '',
    discountMode: '',
    discountValue: '',
    weight: '',
    inventory: 'InStock',
    trackInventory: false,
    clickCount: 0,
    purchaseCount: 0,
    productImageUrls: [],
    collection: [],
    additionalInfo: {},
    productOptions: []
  });

  const [showModal, setShowModal] = useState(false);
  const [showOptionModal, setShowOptionModal] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data: CategoryMap) => setCategories(data))
      .catch(() => setCategories({}));
  }, []);

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const num = (v: string) => (v === '' ? '' : Number(v));
  const isNum = (v: number | ''): v is number => typeof v === 'number' && !Number.isNaN(v);

  const salePrice = useMemo(() => {
    if (!isNum(form.price) || !isNum(form.discountValue) || !form.discountMode) return null;
    return form.discountMode === 'PERCENT'
      ? (form.price * (1 - form.discountValue / 100)).toFixed(2)
      : (form.price - form.discountValue).toFixed(2);
  }, [form.price, form.discountMode, form.discountValue]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = {
      ...form,
      price: isNum(form.price) ? form.price : 0,
      surcharge: isNum(form.surcharge) ? form.surcharge : 0,
      weight: isNum(form.weight) ? form.weight : 0,
      discountValue: isNum(form.discountValue) ? form.discountValue : 0
    };

    const res = await fetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });
    res.ok ? alert('Product created') : alert('Failed to create product');
  };

  return (
    <div className={styles.wrapper}>
      <h1>Product Info</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Basic Info */}
        <div className={styles.section}>
          <h2>Basic Info</h2>
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Add a product name"
            />
          </label>
          <label>
            Ribbon
            <input
              value={form.ribbon}
              onChange={(e) => update('ribbon', e.target.value)}
              placeholder="e.g., New Arrival"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Enter a product description"
            />
          </label>
        </div>

        {/* Product Images */}
        <div className={styles.section}>
          <h2>Images</h2>
          <ProductImageUpload
            images={form.productImageUrls}
            setImages={(urls: string[]) => update('productImageUrls', urls)}
          />
        </div>

        {/* Categories */}
        <div className={styles.section}>
          <h2>Categories</h2>
          <CategorySelector
            categories={categories}
            selected={form.collection}
            onChange={(value: string[]) => update('collection', value)}
          />
        </div>

        {/* Pricing */}
        <div className={styles.section}>
          <h2>Pricing</h2>
          <label>
            Price (£)
            <input
              type="number"
              inputMode="decimal"
              value={form.price}
              onChange={(e) => update('price', num(e.target.value))}
              placeholder="e.g., 3.49"
            />
          </label>

          <label className={styles.inlineCheckbox}>
            <input
              type="checkbox"
              checked={form.discountMode !== ''}
              onChange={(e) => {
                update('discountMode', e.target.checked ? 'PERCENT' : '');
                update('discountValue', '');
              }}
            />
            On sale
          </label>

          {form.discountMode !== '' ? (
            <>
              <label>
                Discount
                <div className={styles.discountGroup}>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.discountValue}
                    onChange={(e) => update('discountValue', num(e.target.value))}
                  />
                  <div className={styles.discountMode}>
                    <button
                      type="button"
                      className={form.discountMode === 'PERCENT' ? styles.active : ''}
                      onClick={() => update('discountMode', 'PERCENT')}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      className={form.discountMode === 'AMOUNT' ? styles.active : ''}
                      onClick={() => update('discountMode', 'AMOUNT')}
                    >
                      £
                    </button>
                  </div>
                </div>
              </label>

              {salePrice ? <p className={styles.salePrice}>Sale price: £{salePrice}</p> : null}
            </>
          ) : null}
        </div>

        {/* Inventory */}
        <div className={styles.section}>
          <h2>Inventory and Shipping</h2>
          <label className={styles.inlineCheckbox}>
            <input
              type="checkbox"
              checked={form.trackInventory}
              onChange={(e) => update('trackInventory', e.target.checked)}
            />
            Track inventory
          </label>
          <label>
            Status
            <select
              value={form.inventory}
              onChange={(e) => update('inventory', e.target.value as FormState['inventory'])}
            >
              <option value="InStock">In stock</option>
              <option value="OutOfStock">Out of stock</option>
              <option value="Preorder">Preorder</option>
            </select>
          </label>
          <label>
            SKU
            <input
              value={form.sku}
              onChange={(e) => update('sku', e.target.value)}
              placeholder="e.g., SKU-001"
            />
          </label>
          <label>
            Shipping weight (kg)
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={form.weight}
              onChange={(e) => update('weight', num(e.target.value))}
            />
          </label>
        </div>

        {/* Additional Info */}
        <div className={styles.section}>
          <h2>Additional Info</h2>
          <button type="button" onClick={() => setShowModal(true)}>
            + Add Info Section
          </button>
          {Object.keys(form.additionalInfo).length > 0 && (
            <ul style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              {Object.entries(form.additionalInfo).map(([key, val]) => (
                <li key={key}>
                  <strong>{key}:</strong> {Array.isArray(val) ? val.join(', ') : val}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Product Options */}
        <div className={styles.section}>
          <h2>Product Options</h2>
          <button type="button" onClick={() => setShowOptionModal(true)}>
            + Add Option
          </button>
          {form.productOptions.length > 0 && (
            <ul style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
              {form.productOptions.map((opt, idx) => (
                <li key={idx}>
                  <strong>{opt.name}</strong> ({opt.type}): {opt.values.join(', ')}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="submit">Create Product</button>
      </form>

      {showModal && (
        <AdditionalInfoModal
          onClose={() => setShowModal(false)}
          onSave={(info) => update('additionalInfo', info)}
        />
      )}

      {showOptionModal && (
        <AddProductOptionModal
          onClose={() => setShowOptionModal(false)}
          onSave={(option) =>
            setForm((prev) => ({
              ...prev,
              productOptions: [...prev.productOptions, option]
            }))
          }
        />
      )}
    </div>
  );
}
