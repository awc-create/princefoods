import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import AccountClient from './AccountClient';
import styles from './TabsAccount.module.scss';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect('/?modal=login&next=/account');

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

  if (!user) redirect('/?modal=signup&next=/account');

  // Optionally load recent orders when you add an Order model
  // const orders = await prisma.order.findMany({ where: { userId: user.id }, take: 5, orderBy: { createdAt: 'desc' } });

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <AccountClient user={JSON.parse(JSON.stringify(user))} />
      </div>
    </main>
  );
}
