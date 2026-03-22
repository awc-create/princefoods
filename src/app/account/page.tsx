// src/app/account/page.tsx
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AccountClient from './AccountClient';
import styles from './TabsAccount.module.scss';

export const dynamic = 'force-dynamic';

type Tab = 'overview' | 'profile' | 'orders' | 'addresses' | 'security';

function isTab(v: unknown): v is Tab {
  return (
    v === 'overview' || v === 'profile' || v === 'orders' || v === 'addresses' || v === 'security'
  );
}

export default async function AccountPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect('/?modal=login&callbackUrl=/account');

  const sp = (await searchParams) ?? {};
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab: Tab = isTab(tabParam) ? tabParam : 'overview';

  // Load ONLY the current user (no admin logic)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      firstName: true,
      lastName: true,
      phoneE164: true,
      emailVerified: true,
      createdAt: true
    }
  });

  if (!user) redirect('/?modal=signup&callbackUrl=/account');

  // Fix 8: only pass isVerified bool, not the raw timestamp
  const userForClient = {
    id: user.id,
    email: user.email,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneE164: user.phoneE164,
    isVerified: !!user.emailVerified,
    createdAt: user.createdAt.toISOString()
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AccountClient user={userForClient} initialTab={initialTab} />
      </div>
    </main>
  );
}
