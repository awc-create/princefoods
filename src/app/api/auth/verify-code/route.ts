import { consumeVerificationByCode, consumeVerificationByToken } from '@/lib/verify';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { email, code, token } = (await req.json()) as {
      email?: string;
      code?: string;
      token?: string;
    };
    if (!email) return NextResponse.json({ ok: false, error: 'Missing email' }, { status: 400 });

    let result;
    if (token) {
      result = await consumeVerificationByToken(email, token);
    } else if (code) {
      result = await consumeVerificationByCode(email, String(code).trim());
    } else {
      return NextResponse.json({ ok: false, error: 'Missing code or token' }, { status: 400 });
    }

    if (!result.ok) {
      const map: Record<string, string> = {
        'no-user': 'No matching user',
        'bad-token': 'Invalid or expired link',
        'bad-code': 'Invalid or expired code'
      };
      return NextResponse.json(
        { ok: false, error: map[result.reason] ?? 'Verification failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[verify-code] error', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
