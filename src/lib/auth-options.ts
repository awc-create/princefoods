import { prisma } from '@/lib/prisma';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { DefaultSession, NextAuthOptions, User as NextAuthUser } from 'next-auth';
import type { AdapterUser } from 'next-auth/adapters';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type AppJWT = JWT & { id?: string; role?: Role };
type AppSessionUser = DefaultSession['user'] & { id?: string; role?: Role };

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

function isAdapterUser(u: NextAuthUser | AdapterUser): u is AdapterUser {
  return 'id' in u && typeof (u as AdapterUser).id === 'string';
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },

  // Ensure cookie sticks on admin host (Traefik forwards Host/Proto)
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        domain: 'admin.prince-v.com'
      }
    }
  },

  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
          })
        ]
      : []),
    Credentials({
      name: 'Email & Password',
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      const t = token as AppJWT;
      if (user) {
        if (isAdapterUser(user)) t.id = user.id;
        const maybeRole = (user as Partial<{ role: Role }>).role;
        if (maybeRole) t.role = maybeRole;
      }
      if ((!t.role || !t.id) && token.email) {
        const db = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true }
        });
        if (db) {
          t.id = t.id ?? db.id;
          t.role = (t.role ?? db.role) as Role;
        }
      }
      return t;
    },

    async session({ session, token }) {
      if (session.user) {
        const u = session.user as AppSessionUser;
        const t = token as AppJWT;
        if (t.id) u.id = t.id;
        if (t.role) u.role = t.role;
      }
      return session;
    },

    async signIn({ user, account }) {
      if (account?.provider === 'google' && isAdapterUser(user)) {
        const u = await prisma.user.findUnique({ where: { id: user.id } });
        if (u) {
          const parts = (user.name ?? '').trim().split(/\s+/);
          const first = u.firstName ?? parts[0] ?? null;
          const last = u.lastName ?? (parts.length > 1 ? parts.slice(1).join(' ') : null);
          const fullName =
            first && last ? `${first} ${last}` : (first ?? u.name ?? user.name ?? '');
          await prisma.user.update({
            where: { id: u.id },
            data: {
              firstName: first ?? undefined,
              lastName: last ?? undefined,
              name: fullName || u.name || undefined
            }
          });
        }
      }
      return true;
    }
  },

  // Trigger verification email on first user creation
  events: {
    async createUser({ user }) {
      if (isAdapterUser(user)) {
        await prisma.user
          .update({ where: { id: user.id }, data: { role: 'VIEWER' } })
          .catch(() => {});
      }

      // Fire-and-forget: call our API to generate token+code and send the email
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';
      const url = `${base}/api/auth/send-verify`;
      // no await on purpose
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.name })
      }).catch(() => {});
    }
  }
};
