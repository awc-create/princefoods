// src/app/admin/customer-discounts/page.tsx
import CustomerDiscountsClient from './CustomerDiscounts-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return <CustomerDiscountsClient />;
}
