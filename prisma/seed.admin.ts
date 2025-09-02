import { PrismaClient, Role, UserSource } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@princefoods.com';
  const hashed = await bcrypt.hash('supersecurepassword', 12);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: 'Jacob Varghese',
      email,
      password: hashed,
      role: Role.HEAD,
      source: UserSource.LOCAL,
      firstName: 'Jacob',
      lastName: 'Varghese',
    },
  });

  console.log('✅ Head admin created:', email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
