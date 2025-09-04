// src/lib/auth-options.ts
import type { NextAuthOptions, DefaultSession, User as NextAuthUser } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { JWT } from 'next-auth/jwt';
import type { AdapterUser } from 'next-auth/adapters';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

// Extend token/session shapes locally without module augmentation
type AppJWT = JWT & {
  id?: string;
  role?: Role;
};

type AppSessionUser = DefaultSession['user'] & {
  id?: string;
  role?: Role;
};

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function isAdapterUser(u: NextAuthUser | AdapterUser): u is AdapterUser {
  return 'id' in u && typeof (u as AdapterUser).id === 'string';
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
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

        // Return minimal user with role for JWT
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as AppJWT;

      if (user) {
        // First login for the session
        if (isAdapterUser(user)) {
          t.id = user.id;
        }
        // Credentials provider returns object with role
        const maybeRole = (user as Partial<{ role: Role }>).role;
        if (maybeRole) t.role = maybeRole;
      }

      // If we still don't have role/id, fetch minimal from DB by email
      if ((!t.role || !t.id) && token.email) {
        const db = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true },
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
      // On first Google sign-in, lightly enrich name parts
      if (account?.provider === 'google' && isAdapterUser(user)) {
        const u = await prisma.user.findUnique({ where: { id: user.id } });
        if (u) {
          const parts = (user.name ?? '').trim().split(/\s+/);
          const first = u.firstName ?? parts[0] ?? null;
          const last = u.lastName ?? (parts.length > 1 ? parts.slice(1).join(' ') : null);
          const fullName = first && last ? `${first} ${last}` : first ?? u.name ?? user.name ?? '';
          await prisma.user.update({
            where: { id: u.id },
            // IMPORTANT: do not pass null to a non-nullable Prisma string field
            data: { firstName: first, lastName: last, name: fullName || u.name || undefined },
          });
        }
      }
      return true;
    },
  },
  pages: { signIn: '/login' },
  events: {
    async createUser({ user }) {
      // Ensure role is set for social signups (no any)
      if (isAdapterUser(user)) {
        await prisma.user
          .update({ where: { id: user.id }, data: { role: 'VIEWER' } })
          .catch(() => { /* ignore race */ });
      }
    },
  },
};
