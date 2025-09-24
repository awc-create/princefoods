// src/lib/auth-options.ts
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

async function checkPassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.password) return null;
  const ok = await bcrypt.compare(password, user.password);
  return ok ? user : null;
}

export const authOptions: NextAuthOptions = {
  // Keep adapter so Google OAuth can link accounts to your Prisma models
  adapter: PrismaAdapter(prisma),

  session: { strategy: 'jwt' },

  // Secure cookie for prod; in local dev, omit AUTH_COOKIE_DOMAIN and use HTTPS tunnel if needed
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {})
      }
    }
  },

  providers: [
    // Google OAuth (optional)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true
          })
        ]
      : []),

    // PUBLIC: customers — block if a live verification token exists
    Credentials({
      id: 'credentials',
      name: 'Email & Password',
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const { password } = parsed.data;

        // If there is an active VerificationToken for this email, prevent sign-in
        const pending = await prisma.verificationToken.findFirst({
          where: { identifier: email, expires: { gt: new Date() } }
        });
        if (pending) {
          // if you want to surface a specific error, you can:
          // throw new Error('EmailNotVerified');
          return null;
        }

        const user = await checkPassword(email, password);
        if (!user) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
      }
    }),

    // ADMIN: HEAD/STAFF only
    Credentials({
      id: 'admin-credentials',
      name: 'Admin Email & Password',
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const { password } = parsed.data;

        const user = await checkPassword(email, password);
        if (!user) return null;

        const role = (user.role as Role) ?? 'VIEWER';
        if (role !== 'HEAD' && role !== 'STAFF') return null;

        return { id: user.id, name: user.name, email: user.email, role };
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
      // Backfill from DB if needed
      if ((!t.role || !t.id) && token.email) {
        const db = await prisma.user.findUnique({
          where: { email: String(token.email).toLowerCase() },
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
        // Optional: light profile refresh
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

  events: {
    async createUser({ user }) {
      // make sure newly created users default to VIEWER
      if (isAdapterUser(user)) {
        await prisma.user
          .update({ where: { id: user.id }, data: { role: 'VIEWER' } })
          .catch(() => {});
      }
      // kick off your custom verification flow via Resend
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';
      const url = `${base}/api/auth/send-verify`;
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.name })
      }).catch(() => {});
    }
  },

  pages: {
    signIn: '/login',
    error: '/login'
  },

  secret: process.env.NEXTAUTH_SECRET
};
