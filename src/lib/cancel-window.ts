// src/lib/cancel-window.ts
import { prisma } from '@/lib/prisma';

export interface CancelSettings {
  cancelReversalMinutes: number; // e.g. 1440 for 24h
}

function parseSettings(jsonStr: string): CancelSettings | null {
  try {
    const parsed = JSON.parse(jsonStr) as Partial<CancelSettings>;
    const n = parsed.cancelReversalMinutes;
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
      return { cancelReversalMinutes: Math.floor(n) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Load cancel/reversal settings from PolicyDoc('order-settings'), with a safe default.
 */
export async function getCancelSettings(): Promise<CancelSettings> {
  const doc = await prisma.policyDoc.findUnique({
    where: { slug: 'order-settings' },
    select: { body: true }
  });

  const fallback: CancelSettings = { cancelReversalMinutes: 1440 }; // 24h default

  if (!doc?.body) return fallback;

  // Prisma body is stored as string
  const parsed = parseSettings(doc.body as unknown as string);
  return parsed ?? fallback;
}

/**
 * Compute the reversible-until timestamp from a base time (default now).
 * Used when marking an order as cancelled to set `editableUntil`.
 */
export async function computeReversalUntil(base?: Date): Promise<Date> {
  const start = base ?? new Date();
  const { cancelReversalMinutes } = await getCancelSettings();
  return new Date(start.getTime() + cancelReversalMinutes * 60_000);
}
