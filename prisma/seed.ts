import { Prisma, PrismaClient, Role, UserSource } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

const prisma = new PrismaClient();

function maskDb(url?: string) {
  if (!url) return 'unset';
  return url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}

function splitName(full: string) {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? null;
  const last = parts.slice(1).join(' ') || null;
  return { first, last };
}

async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@princefoods.com').trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? 'Head Admin').trim();

  const hashFromEnv = (process.env.ADMIN_PASSWORD_HASH ?? '').trim() || undefined;
  const plain = (process.env.ADMIN_PASSWORD ?? '').trim() || undefined;

  let passwordHash: string | undefined = hashFromEnv;
  if (!passwordHash && plain) {
    passwordHash = await bcrypt.hash(plain, 12);
  }

  const { first, last } = splitName(name);

  const createData: Prisma.UserCreateInput = {
    email,
    name,
    firstName: first,
    lastName: last,
    role: Role.HEAD,
    source: UserSource.LOCAL,
    ...(passwordHash ? { password: passwordHash } : {})
  };

  const updateData: Prisma.UserUpdateInput = {
    name,
    firstName: first,
    lastName: last,
    role: Role.HEAD,
    source: UserSource.LOCAL,
    ...(passwordHash ? { password: passwordHash } : {})
  };

  const existing = await prisma.user.findUnique({ where: { email } });

  await prisma.user.upsert({
    where: { email },
    create: createData,
    update: updateData
  });

  console.log(
    `✅ Admin ensured: ${email} (${existing ? 'updated' : 'created'}${passwordHash ? ', password set' : ''})`
  );
}

async function seedKb() {
  const faqs = [
    {
      question: 'WHAT IS YOUR RETURN POLICY?',
      answer: 'We want you to be completely satisfied...'
    },
    {
      question: 'HOW MUCH IS THE MINIMUM ORDER?',
      answer: 'The minimum order for free delivery...'
    },
    { question: 'HOW MUCH DOES SHIPPING COST?', answer: 'For orders of £30 or more...' },
    { question: 'CAN I TRACK MY ORDER?', answer: 'Yes, once your order ships...' },
    {
      question: 'WHAT PAYMENT METHODS DO YOU ACCEPT?',
      answer: 'We accept all major credit and debit cards...'
    },
    {
      question: 'WHICH AREAS DO YOU DELIVER TO?',
      answer: 'We deliver across all of Great Britain...'
    }
  ];

  for (const f of faqs) {
    await prisma.faq.upsert({
      where: { question: f.question },
      update: { answer: f.answer },
      create: f
    });
  }

  await prisma.policyDoc.upsert({
    where: { slug: 'delivery-and-returns' },
    update: {
      title: 'Delivery & Returns',
      body: [
        '- Damaged/incorrect items: contact within 48 hours with photos.',
        '- Frozen/perishable goods: returns generally not accepted unless our error.',
        '- UK-wide delivery; frozen items ship next-day in food-grade rigifoam cartons with gel packs.'
      ].join('\n')
    },
    create: {
      slug: 'delivery-and-returns',
      title: 'Delivery & Returns',
      body: [
        '- Damaged/incorrect items: contact within 48 hours with photos.',
        '- Frozen/perishable goods: returns generally not accepted unless our error.',
        '- UK-wide delivery; frozen items ship next-day in food-grade rigifoam cartons with gel packs.'
      ].join('\n')
    }
  });

  console.log('✅ Seeded FAQs & Policy docs');
}

async function main() {
  console.log('DB:', maskDb(process.env.DATABASE_URL));
  await ensureAdmin();
  await seedKb();
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('❌ seed failed:', e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
