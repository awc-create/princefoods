import { NextResponse } from 'next/server';
import { sendAdminPush } from '@/lib/push';

export const runtime = 'nodejs';

export async function POST() {
  await sendAdminPush('Test notification', 'If you see this, push works.');
  return NextResponse.json({ ok: true });
}
