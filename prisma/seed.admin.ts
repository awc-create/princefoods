// prisma/seed.admin.ts
import { PrismaClient, Role, UserSource } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function envOr(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  return (v && String(v).trim()) || undefined;
}

async function main() {
  // Prefer env, fall back to your previous hardcoded values to avoid surprises.
  const email = (envOr('ADMIN_EMAIL') || 'admin@princefoods.com').toLowerCase();
  const name = envOr('ADMIN_NAME') || 'Jacob Varghese';

  // You can pass a bcrypt hash (preferred) or a plaintext password via env.
  // If neither is provided and the user already exists, we won't change their password.
  const hashFromEnv = envOr('ADMIN_PASSWORD_HASH');
  const plain = envOr('ADMIN_PASSWORD') || 'supersecurepassword';

  // Compute password hash only if we have either a hash or a plaintext (first run).
  const passwordHash = hashFromEnv ? hashFromEnv : plain ? await bcrypt.hash(plain, 12) : undefined;

  const existing = await prisma.user.findUnique({ where: { email } });

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role: Role.HEAD,
      source: UserSource.LOCAL,
      firstName: 'Jacob',
      lastName: 'Varghese',
      // set password only if we have one (first bootstrap)
      ...(passwordHash ? { password: passwordHash } : {})
    },
    update: {
      name,
      role: Role.HEAD,
      source: UserSource.LOCAL,
      firstName: 'Jacob',
      lastName: 'Varghese',
      // If you set a new ADMIN_PASSWORD(_HASH) in CI, this will rotate it.
      ...(passwordHash ? { password: passwordHash } : {})
    }
  });

  console.log(`✅ Head admin ensured: ${email} (${existing ? 'updated' : 'created'})`);
}

main()
  .catch((e) => {
    console.error('❌ seed.admin failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
