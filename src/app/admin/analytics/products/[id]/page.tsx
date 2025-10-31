// src/app/admin/analytics/products/[id]/page.tsx
import ProductAnalyticsClient from './product-analytics-client';

export const dynamic = 'force-dynamic'; // keeps this route from being statically captured

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductAnalyticsClient id={id} />;
}
