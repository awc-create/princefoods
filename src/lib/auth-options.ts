import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter"; // <- v4 adapter
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
    Credentials({
      name: "Email & Password",
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role as any };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        (token as any).id = (user as any).id;
        (token as any).role = (user as any).role;
      } else if (!('role' in token) && token.email) {
        const db = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true },
        });
        if (db) {
          (token as any).id = db.id;
          (token as any).role = db.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = (token as any).id;
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        // Light enrichment on first sign-in
        const u = await prisma.user.findUnique({ where: { id: (user as any).id } });
        if (u) {
          const parts = (user.name ?? "").trim().split(/\s+/);
          const first = u.firstName ?? parts[0] ?? null;
          const last  = u.lastName  ?? (parts.length > 1 ? parts.slice(1).join(" ") : null);
          const name  = (first && last) ? `${first} ${last}` : (first ?? u.name ?? user.name ?? "");
          await prisma.user.update({
            where: { id: u.id },
            data: { firstName: first, lastName: last, name: name || u.name },
          });
        }
      }
      return true;
    },
  },
  pages: { signIn: "/login" },
  events: {
    async createUser({ user }) {
      // Safety: ensure role is set for social signups
      await prisma.user.update({ where: { id: user.id }, data: { role: 'VIEWER' as any } }).catch(() => {});
    },
  },
};
