// src/app/api/admin/orders/[id]/returns/[returnId]/decide/route.ts
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Decision = 'RESHIP' | 'REFUND' | 'STORE_CREDIT' | 'NO_ACTION';

// Map route "Decision" → schema "ReturnResolution"
type ReturnResolution = 'RESHIP' | 'REFUND' | 'STORE_CREDIT' | 'CUSTOMER_COLLECT' | 'NO_ACTION';

function asDecision(v: unknown): Decision {
  const s = typeof v === 'string' ? v : 'NO_ACTION';
  const allowed = new Set<Decision>(['RESHIP', 'REFUND', 'STORE_CREDIT', 'NO_ACTION']);
  return allowed.has(s as Decision) ? (s as Decision) : 'NO_ACTION';
}

function toResolution(d: Decision): ReturnResolution {
  if (d === 'RESHIP') return 'RESHIP';
  if (d === 'REFUND') return 'REFUND';
  if (d === 'STORE_CREDIT') return 'STORE_CREDIT';
  return 'NO_ACTION';
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; returnId: string }> }
) {
  const { id: orderId, returnId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    decision?: string;
    note?: string;
    close?: boolean;

    // Keep accepting these so the client doesn’t break,
    // but we won’t write them unless you add fields to schema.
    refundAmountPence?: number | null;
    storeCreditPence?: number | null;
  };

  const rc = await prisma.returnCase.findFirst({
    where: { id: returnId, orderId },
    select: { id: true, status: true, resolution: true, resolutionNote: true }
  });

  if (!rc) return NextResponse.json({ ok: false, error: 'Return case not found' }, { status: 404 });

  const decision = asDecision(body.decision);
  const resolution = toResolution(decision);
  const close = Boolean(body.close);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';

  // If "close", mark as RESOLVED. Otherwise keep current status (usually OPEN/RECEIVED).
  const nextStatus = close ? 'RESOLVED' : rc.status;

  const updated = await prisma.returnCase.update({
    where: { id: returnId },
    data: {
      status: nextStatus,
      resolution,
      resolutionNote: note || undefined,
      resolvedAt: close ? new Date() : null
    }
  });

  // ✅ typed activity (aligned to your existing Activity helpers)
  if (decision === 'REFUND') {
    await Activity.returnDecideRefund(orderId, note || null, {
      returnCaseId: returnId,
      // kept for compatibility with your Activity signature
      refundAmountPence:
        typeof body.refundAmountPence === 'number' && Number.isFinite(body.refundAmountPence)
          ? Math.max(0, Math.floor(body.refundAmountPence))
          : null,
      close
    });
  } else if (decision === 'STORE_CREDIT') {
    await Activity.returnDecideStoreCredit(orderId, note || null, {
      returnCaseId: returnId,
      storeCreditPence:
        typeof body.storeCreditPence === 'number' && Number.isFinite(body.storeCreditPence)
          ? Math.max(0, Math.floor(body.storeCreditPence))
          : null,
      close
    });
  } else if (decision === 'NO_ACTION' && close) {
    await Activity.returnClosed(orderId, { returnCaseId: returnId, decision: 'NO_ACTION' });
  } else if (close) {
    await Activity.returnClosed(orderId, { returnCaseId: returnId, decision });
  } else {
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: 'NOTE',
        note: `Return decision saved: ${decision}`
      }
    });
  }

  return NextResponse.json({ ok: true, returnCase: updated, decision, close });
}
