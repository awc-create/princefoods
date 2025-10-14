import ProductAnalyticsClient from './product-analytics-client';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductAnalyticsClient id={id} />;
}
