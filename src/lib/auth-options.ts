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
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });
  if (!user || !user.password) return null;

  const ok = await bcrypt.compare(password, user.password);
  return ok ? user : null;
}

// ✅ IMPORTANT: only set cookie domain in production real domains.
// For localhost/admin.localhost, DO NOT set Domain=... or browser may drop it.
const cookieDomain =
  process.env.NODE_ENV === 'production' && process.env.AUTH_COOKIE_DOMAIN
    ? process.env.AUTH_COOKIE_DOMAIN
    : undefined;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  debug: process.env.NEXTAUTH_DEBUG === 'true',

  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        ...(cookieDomain ? { domain: cookieDomain } : {})
      }
    },

    callbackUrl: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.callback-url'
          : 'next-auth.callback-url',
      options: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        ...(cookieDomain ? { domain: cookieDomain } : {})
      }
    },

    csrfToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Host-next-auth.csrf-token'
          : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
        // ✅ DO NOT set domain here (especially not for localhost)
      }
    }
  },

  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true
          })
        ]
      : []),

    Credentials({
      id: 'credentials',
      name: 'Email & Password',
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase();
        const { password } = parsed.data;

        const pending = await prisma.verificationToken.findFirst({
          where: { identifier: email, expires: { gt: new Date() } }
        });
        if (pending) return null;

        const user = await checkPassword(email, password);
        if (!user) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role as Role };
      }
    }),

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
    async signIn({ user, account }) {
      // For OAuth providers (Google etc.), manually upsert the user since
      // JWT strategy bypasses the adapter's createUser/linkAccount hooks
      if (
        account?.provider &&
        account.provider !== 'credentials' &&
        account.provider !== 'admin-credentials'
      ) {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;

        await prisma.user.upsert({
          where: { email },
          create: {
            email,
            name: user.name ?? email,
            emailVerified: new Date(), // OAuth email is pre-verified
            role: 'VIEWER'
          },
          update: {
            // Update name if not set, mark email verified
            name: user.name ? { set: user.name } : undefined,
            emailVerified: new Date()
          }
        });
      }
      return true;
    },

    async jwt({ token, user }) {
      const t = token as AppJWT;

      if (user) {
        if (isAdapterUser(user)) t.id = user.id;
        const maybeRole = (user as Partial<{ role: Role }>).role;
        if (maybeRole) t.role = maybeRole;
      }

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
    }
  },

  pages: {
    signIn: '/login',
    error: '/login'
  },

  secret: process.env.NEXTAUTH_SECRET
};

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      role?: 'HEAD' | 'STAFF' | 'VIEWER';
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'HEAD' | 'STAFF' | 'VIEWER';
  }
}
