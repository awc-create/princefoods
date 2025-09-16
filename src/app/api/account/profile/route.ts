import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    await prisma.user.update({
      where: { email },
      data: {
        firstName: body.firstName?.toString().slice(0, 80) ?? null,
        lastName: body.lastName?.toString().slice(0, 80) ?? null,
        name: body.name?.toString().slice(0, 120) ?? null,
        phoneE164: body.phoneE164?.toString().slice(0, 32) ?? null
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[account.profile]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
