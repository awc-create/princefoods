import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { subscription, adminEmail } = await req.json();
  await prisma.pushSubscription.create({
    data: { adminEmail, endpointJson: JSON.stringify(subscription) }
  });
  return NextResponse.json({ ok: true });
}
