import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const faqs = [
    { question: 'WHAT IS YOUR RETURN POLICY?', answer: "We want you to be completely satisfied..." },
    { question: 'HOW MUCH IS THE MINIMUM ORDER?', answer: "The minimum order for free delivery..." },
    { question: 'HOW MUCH DOES SHIPPING COST?', answer: "For orders of £30 or more..." },
    { question: 'CAN I TRACK MY ORDER?', answer: "Yes, once your order ships..." },
    { question: 'WHAT PAYMENT METHODS DO YOU ACCEPT?', answer: "We accept all major credit and debit cards..." },
    { question: 'WHICH AREAS DO YOU DELIVER TO?', answer: "We deliver across all of Great Britain..." },
  ];

  for (const f of faqs) {
    await prisma.faq.upsert({
      where: { question: f.question },
      update: { answer: f.answer },
      create: f,
    });
  }

  await prisma.policyDoc.upsert({
    where: { slug: 'delivery-and-returns' },
    update: {
      title: 'Delivery & Returns',
      body: [
        '- Damaged/incorrect items: contact within 48 hours with photos.',
        '- Frozen/perishable goods: returns generally not accepted unless our error.',
        '- UK-wide delivery; frozen items ship next-day in food-grade rigifoam cartons with gel packs.',
      ].join('\n'),
    },
    create: {
      slug: 'delivery-and-returns',
      title: 'Delivery & Returns',
      body: [
        '- Damaged/incorrect items: contact within 48 hours with photos.',
        '- Frozen/perishable goods: returns generally not accepted unless our error.',
        '- UK-wide delivery; frozen items ship next-day in food-grade rigifoam cartons with gel packs.',
      ].join('\n'),
    },
  });

  console.log('✅ Seeded FAQs & Policy docs');
}

main().catch(console.error).finally(() => prisma.$disconnect());
