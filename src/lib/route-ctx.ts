// src/lib/route-ctx.ts
export type RouteParams = Record<string, string>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Safe extractor for Next.js route context without using `any`. */
export function getParams<T extends RouteParams = { id: string }>(ctx: unknown): T {
  if (isRecord(ctx) && 'params' in ctx) {
    const p = (ctx as { params?: unknown }).params;
    if (isRecord(p)) return p as T;
  }
  throw new Error('Route params missing');
}
