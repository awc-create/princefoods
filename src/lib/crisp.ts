// src/lib/crisp.ts
type CrispColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'brown'
  | 'grey'
  | 'black';

export function crispPush(cmd: CrispPushPayload) {
  if (typeof window === 'undefined') return;
  window.$crisp = window.$crisp ?? [];
  window.$crisp.push(cmd);
}

/**
 * This is SAFE in your workspace (no "Invalid data" errors).
 * We'll use this for debugging + optional routing/timeline.
 */
export function crispSessionEvent(
  text: string,
  data?: Record<string, unknown>,
  color: CrispColor = 'blue'
) {
  crispPush(['set', 'session:event', [[[text, data ?? {}, color]]]]);
}
