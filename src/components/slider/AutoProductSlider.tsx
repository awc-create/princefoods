'use client';

import { useEffect, useState } from 'react';
import ProductSlider, { SliderProduct } from './ProductSlider';

type Props = {
  title: string;
  limit?: number;
  categoryId?: string;
  categorySlug?: string;
  parentSlug?: string;
  collection?: string;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'random';
};

export default function AutoProductSlider(props: Props) {
  const { title, limit = 12, categoryId, categorySlug, parentSlug, collection, sort = 'newest' } = props;
  const [items, setItems] = useState<SliderProduct[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('sort', sort);
    if (categoryId) params.set('categoryId', categoryId);
    if (categorySlug) params.set('categorySlug', categorySlug);
    if (parentSlug) params.set('parentSlug', parentSlug);
    if (collection) params.set('collection', collection);

    fetch(`/api/products?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        const products = (data?.products ?? []) as SliderProduct[];
        setItems(products);
      })
      .finally(() => setReady(true));
  }, [limit, categoryId, categorySlug, parentSlug, collection, sort]);

  if (!ready) return null;
  if (!items.length) return null;

  return <ProductSlider title={title} products={items} />;
}
