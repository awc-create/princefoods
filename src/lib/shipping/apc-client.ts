// src/lib/shipping/apc-client.ts

export type ApcEnv = 'training' | 'live';

export class ApcNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApcNotConfiguredError';
  }
}

interface ApcConfig {
  env: ApcEnv;
  baseUrl: string;
  username: string;
  password: string;
  timeoutMs: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function _getStr(o: unknown, k: string): string | null {
  if (!isRecord(o)) return null;
  const v = o[k];
  return typeof v === 'string' ? v : null;
}

/**
 * Read APC config from env.
 * IMPORTANT: Returns null if not configured. Does NOT throw at import-time.
 * This prevents Next build / Docker builds from failing during "collecting page data".
 */
export function getApcConfig(): ApcConfig | null {
  const envRaw = (process.env.APC_ENV ?? 'training').toLowerCase();
  const env: ApcEnv = envRaw === 'live' ? 'live' : 'training';

  const base =
    env === 'live' ? (process.env.APC_LIVE_BASE ?? null) : (process.env.APC_TRAINING_BASE ?? null);

  const username = process.env.APC_USERNAME ?? null;
  const password = process.env.APC_PASSWORD ?? null;

  // If any are missing, treat as "not configured"
  if (!base || !username || !password) return null;

  const timeoutMs = Number(process.env.APC_TIMEOUT_MS ?? 25_000);

  // normalize: no trailing slash
  const baseUrl = base.replace(/\/+$/, '');

  return {
    env,
    baseUrl,
    username,
    password,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 25_000
  };
}

/**
 * APC expects:
 *   remote-user: Basic <base64(email:password)>
 * NOT Authorization.
 */
function remoteUserHeaderValue(username: string, password: string) {
  const token = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

function buildHeaders(username: string, password: string, extra?: Record<string, string>) {
  return {
    Accept: 'application/json, text/xml, application/xml, */*',
    'Content-Type': 'application/json',
    'remote-user': remoteUserHeaderValue(username, password),
    ...(extra ?? {})
  };
}

function withTimeout(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractApcMessage(parsed: unknown): string | null {
  // APC sometimes returns nested messages in different shapes
  if (!isRecord(parsed)) return null;

  const orders = parsed['Orders'];
  const svc = parsed['ServiceAvailability'];
  const messages = parsed['Messages'];

  // Above line won't work for nested object (Messages is object). We'll safely handle below.

  // helper to read Description from { Messages: { Description } }
  const descFrom = (root: unknown): string | null => {
    if (!isRecord(root)) return null;
    const msgObj = root['Messages'];
    if (!isRecord(msgObj)) return null;
    const d = msgObj['Description'];
    return typeof d === 'string' ? d : null;
  };

  return (
    descFrom(parsed) ??
    descFrom(orders) ??
    descFrom(svc) ??
    (typeof (messages as unknown) === 'string' ? (messages as string) : null) ??
    null
  );
}

/**
 * Fetch raw text from APC (useful for endpoints that may return XML).
 */
export async function apcFetchText(
  path: string,
  init?: RequestInit
): Promise<{ status: number; ok: boolean; contentType: string; text: string }> {
  const cfg = getApcConfig();
  if (!cfg) {
    throw new ApcNotConfiguredError(
      'APC is not configured (missing APC_TRAINING_BASE/APC_LIVE_BASE and/or APC_USERNAME/APC_PASSWORD).'
    );
  }

  const url = `${cfg.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  // RequestInit["signal"] can be AbortSignal | null in TS DOM types
  const { signal, clear } = withTimeout(cfg.timeoutMs, init?.signal ?? undefined);

  try {
    const res = await fetch(url, {
      ...init,
      signal,
      headers: {
        ...buildHeaders(cfg.username, cfg.password),
        ...(init?.headers ?? {})
      },
      cache: 'no-store'
    });

    const text = await res.text();
    return {
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get('content-type') ?? '',
      text
    };
  } finally {
    clear();
  }
}

/**
 * Fetch JSON from APC. Throws with a meaningful APC error message if possible.
 */
export async function apcFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const out = await apcFetchText(path, init);

  const parsed = out.text ? safeJsonParse(out.text) : null;

  if (!out.ok) {
    const msg = extractApcMessage(parsed) ?? `APC error ${out.status}`;
    throw new Error(msg);
  }

  return parsed as T;
}
