import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST() {
  const users = await prisma.user.findMany({
    where: { source: "WIX", welcomeStatus: "PENDING" },
    take: 1000,
  });

  for (const u of users) {
    const token = crypto.randomBytes(24).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
    await prisma.passwordToken.create({
      data: { userId: u.id, token, expiresAt: expires },
    });

    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/welcome?token=${token}`;

    await resend.emails.send({
      from: "Prince Foods <no-reply@prince-foods.com>",
      to: u.email,
      subject: "Welcome to Prince Foods — finish your account",
      html: `
        <p>Hi${u.firstName ? " " + u.firstName : ""},</p>
        <p>We’ve moved to our new site. Please finish setting up your account:</p>
        <p><a href="${url}">Set your password and complete your profile</a></p>
        <p>Thanks,<br/>Prince Foods Team</p>
      `,
    });

    await prisma.user.update({
      where: { id: u.id },
      data: { welcomeStatus: "SENT", welcomedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true, count: users.length });
}
