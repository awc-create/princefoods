'use client';

import { useEffect, useState } from 'react';
import styles from './CreateProduct.module.scss';
import AdditionalInfoModal from './AdditionalInfoModal';
import AddProductOptionModal from './AddProductOptionModal';
import ProductImageUpload from '@/components/image/ProductImageUpload';
import CategorySelector, { CategoryMap } from '@/components/category/CategorySelector';

export default function CreateProductPage() {
  const [categories, setCategories] = useState<CategoryMap>({});

  const [form, setForm] = useState({
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
    productImageUrls: [] as string[],
    collection: [] as string[],
    additionalInfo: {} as Record<string, string | string[]>,
    productOptions: [] as {
      name: string;
      type: 'List' | 'Color';
      values: string[];
    }[]
  });

  const [showModal, setShowModal] = useState(false);
  const [showOptionModal, setShowOptionModal] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then(setCategories);
  }, []);

  const update = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(form),
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
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
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
          {form.discountMode && (
            <>
              <label>
                Discount
                <div className={styles.discountGroup}>
                  <input
                    type="number"
                    value={form.discountValue}
                    onChange={(e) => update('discountValue', e.target.value)}
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
              {form.price && form.discountValue && (
                <p className={styles.salePrice}>
                  Sale price: £
                  {form.discountMode === 'PERCENT'
                    ? (parseFloat(form.price) * (1 - parseFloat(form.discountValue) / 100)).toFixed(
                        2
                      )
                    : (parseFloat(form.price) - parseFloat(form.discountValue)).toFixed(2)}
                </p>
              )}
            </>
          )}
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
            <select value={form.inventory} onChange={(e) => update('inventory', e.target.value)}>
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
              value={form.weight}
              onChange={(e) => update('weight', e.target.value)}
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
