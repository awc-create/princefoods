import { prisma } from '@/lib/prisma';
import { addOrderTag, ensureTag } from '@/lib/tags';
import type { DeliveryIssueType, ReturnCaseStatus } from '@prisma/client';

export function detectIssueType(textBlob: string): {
  issueType: DeliveryIssueType | null;
  evidence: string;
} {
  const t = textBlob.toLowerCase();
  const has = (s: string) => t.includes(s);

  if (has('return to sender') || has('returned to sender') || has('rts')) {
    return { issueType: 'RETURN_TO_SENDER', evidence: 'Matched RTS text' };
  }
  if (has('return to depot') || has('returned to depot') || has('held at depot') || has('depot')) {
    return { issueType: 'RETURN_TO_DEPOT', evidence: 'Matched depot/return text' };
  }
  if (
    has('delivery failed') ||
    has('failed delivery') ||
    has('not delivered') ||
    has('recipient not home') ||
    has('refused')
  ) {
    return { issueType: 'DELIVERY_FAILED', evidence: 'Matched delivery failed text' };
  }
  if (has('lost') || has('missing')) {
    return { issueType: 'LOST', evidence: 'Matched lost/missing text' };
  }
  if (has('damaged') || has('damage')) {
    return { issueType: 'DAMAGED', evidence: 'Matched damaged text' };
  }

  return { issueType: null, evidence: '' };
}

/**
 * Open or update the order's single ReturnCase when a return/failure is detected.
 * - Never overwrites RESOLVED
 * - Always keeps status OPEN until staff resolves
 */
export async function upsertReturnCaseFromSignal(args: {
  orderId: string;
  shipmentId: string;
  issueType: DeliveryIssueType;
  evidence: { textBlob: string; lastEventAt: Date | null; note: string };
  meta?: unknown;
}) {
  // Ensure global tag exists
  await ensureTag('return-issue', 'Return / Delivery issue', '#f59e0b');

  const existing = await prisma.returnCase.findUnique({
    where: { orderId: args.orderId },
    select: { id: true, status: true }
  });

  if (existing?.status === 'RESOLVED') return;

  const meta = {
    ...((args.meta ?? {}) as object),
    note: args.evidence.note,
    sample: args.evidence.textBlob.slice(0, 500)
  };

  const row = await prisma.returnCase.upsert({
    where: { orderId: args.orderId },
    update: {
      status: 'OPEN' as ReturnCaseStatus,
      issueType: args.issueType,
      shipmentId: args.shipmentId,
      lastEventAt: args.evidence.lastEventAt ?? undefined,
      meta
    },
    create: {
      orderId: args.orderId,
      status: 'OPEN',
      issueType: args.issueType,
      shipmentId: args.shipmentId,
      detectedAt: new Date(),
      lastEventAt: args.evidence.lastEventAt ?? undefined,
      meta
    }
  });

  // Auto-tag order
  await addOrderTag(args.orderId, 'return-issue');

  // Activity
  await prisma.orderActivity.create({
    data: {
      orderId: args.orderId,
      type: 'RETURN_OPENED',
      note: `Return case opened: ${args.issueType}`,
      meta: { returnCaseId: row.id, shipmentId: args.shipmentId, issueType: args.issueType }
    }
  });

  return row;
}
