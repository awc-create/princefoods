// src/app/admin/shipping/page.tsx

import ShippingAdminClient from './shipping-client';

export const metadata = {
  title: 'Shipping Zones'
};

export default function ShippingAdminPage() {
  return <ShippingAdminClient />;
}
