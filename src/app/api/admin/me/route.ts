import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type SessionUser = { id?: string | null; email?: string | null; name?: string | null; role?: Role | null };

function isSessionUser(u: unknown): u is SessionUser {
  return !!u && typeof u === 'object';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSessionUser(session.user)) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const { id = null, email = null, name = null, role = null } = session.user;

  return NextResponse.json({
    user: { id, email, name, role },
  });
}
