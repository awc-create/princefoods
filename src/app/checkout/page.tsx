// src/app/checkout/page.tsx (server component)
import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import CheckoutClient from './CheckoutClient';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? null; // <- may be null for guests
  return <CheckoutClient email={email} />;
}
