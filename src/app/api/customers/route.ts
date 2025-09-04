import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phoneRaw: string | null;
  role: 'HEAD' | 'STAFF' | 'VIEWER';
  createdAt: Date;
}

interface GroupByUserKey {
  userKey: string;
  _count: { _all: number };
}
interface GroupByEmail {
  customerEmail: string | null;
  _count: { _all: number };
}
interface LatestThread {
  userKey: string | null;
  customerEmail: string | null;
  lastUserAt: Date | null;
  lastAdminAt: Date | null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('search') ?? '').trim();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit = 20;
  const skip = (page - 1) * limit;

  const where =
    q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { phoneRaw: { contains: q, mode: 'insensitive' as const } }
          ]
        }
      : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phoneRaw: true,
        role: true,
        createdAt: true
      }
    }) as unknown as Promise<UserRow[]>,
    prisma.user.count({ where })
  ]);

  const userIds = users.map((u: UserRow) => u.id);
  const emails = users.map((u: UserRow) => u.email);

  const [threadsByUserKey, threadsByEmail] = await Promise.all([
    prisma.chatThread.groupBy({
      by: ['userKey'],
      _count: { _all: true },
      where: { userKey: { in: userIds } }
    }) as unknown as Promise<GroupByUserKey[]>,
    prisma.chatThread.groupBy({
      by: ['customerEmail'],
      _count: { _all: true },
      where: { customerEmail: { in: emails } }
    }) as unknown as Promise<GroupByEmail[]>
  ]);

  const latestByUserId = (await prisma.chatThread.findMany({
    where: { OR: [{ userKey: { in: userIds } }, { customerEmail: { in: emails } }] },
    select: { userKey: true, customerEmail: true, lastUserAt: true, lastAdminAt: true },
    orderBy: [{ lastUserAt: 'desc' }, { lastAdminAt: 'desc' }]
  })) as LatestThread[];

  const items = users.map((u: UserRow) => {
    const byId = threadsByUserKey.find((t: GroupByUserKey) => t.userKey === u.id)?._count._all ?? 0;
    const byEmail =
      threadsByEmail.find((t: GroupByEmail) => t.customerEmail === u.email)?._count._all ?? 0;
    const conversations = byId + byEmail;

    const latest = latestByUserId.find(
      (t: LatestThread) => t.userKey === u.id || t.customerEmail === u.email
    );

    const lastActivity = latest
      ? new Date(
          Math.max(latest.lastUserAt?.getTime() ?? 0, latest.lastAdminAt?.getTime() ?? 0)
        ).toLocaleString()
      : null;

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phoneRaw ?? undefined,
      role: u.role,
      createdAt: u.createdAt,
      conversations,
      lastActivity
    };
  });

  return NextResponse.json({
    items,
    totalPages: Math.max(1, Math.ceil(total / limit))
  });
}
