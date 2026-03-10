// src/lib/shipping/apc-client.ts
export type ApcEnv = 'training' | 'live';
export type ApcMode = 'live' | 'test';

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

function pickEnv(raw: string | undefined): ApcEnv {
  const v = (raw ?? 'training').toLowerCase();
  return v === 'live' ? 'live' : 'training';
}

/**
 * Read APC config from env.
 * mode="live" uses APC_* vars
 * mode="test" uses APC_*_TEST vars
 *
 * IMPORTANT: Returns null if not configured.
 */
export function getApcConfig(mode: ApcMode = 'live'): ApcConfig | null {
  const isTest = mode === 'test';

  const env = pickEnv(isTest ? process.env.APC_ENV_TEST : process.env.APC_ENV);

  const trainingBase =
    (isTest ? process.env.APC_TRAINING_BASE_TEST : process.env.APC_TRAINING_BASE) ?? null;
  const liveBase = (isTest ? process.env.APC_LIVE_BASE_TEST : process.env.APC_LIVE_BASE) ?? null;

  const base = env === 'live' ? liveBase : trainingBase;

  const username = (isTest ? process.env.APC_USERNAME_TEST : process.env.APC_USERNAME) ?? null;
  const password = (isTest ? process.env.APC_PASSWORD_TEST : process.env.APC_PASSWORD) ?? null;

  if (!base || !username || !password) return null;

  const timeoutRaw = (process.env.APC_TIMEOUT_MS ?? '').trim();
  const timeoutMs = Number(timeoutRaw || '25000');

  return {
    env,
    baseUrl: base.replace(/\/+$/, ''),
    username,
    password,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 25_000
  };
}

/**
 * APC expects:
 *   remote-user: Basic <base64(email:password)>
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function extractApcMessage(parsed: unknown): string | null {
  if (!isRecord(parsed)) return null;

  const descFrom = (root: unknown): string | null => {
    if (!isRecord(root)) return null;
    const msgObj = root['Messages'];
    if (!isRecord(msgObj)) return null;
    const d = msgObj['Description'];
    return typeof d === 'string' ? d : null;
  };

  return (
    descFrom(parsed) ??
    descFrom(parsed['Orders']) ??
    descFrom(parsed['ServiceAvailability']) ??
    null
  );
}

/**
 * Fetch raw text from APC (useful for endpoints that may return XML).
 */
export async function apcFetchText(
  path: string,
  init?: RequestInit,
  mode: ApcMode = 'live'
): Promise<{ status: number; ok: boolean; contentType: string; text: string }> {
  const cfg = getApcConfig(mode);
  if (!cfg) {
    throw new ApcNotConfiguredError(
      `APC is not configured for mode="${mode}" (missing base/username/password).`
    );
  }

  const url = `${cfg.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

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
export async function apcFetch<T>(
  path: string,
  init?: RequestInit,
  mode: ApcMode = 'live'
): Promise<T> {
  const out = await apcFetchText(path, init, mode);

  const parsed = out.text ? safeJsonParse(out.text) : null;

  if (!out.ok) {
    const msg = extractApcMessage(parsed) ?? `APC error ${out.status}`;
    throw new Error(msg);
  }

  return parsed as T;
}

/** Utility for routes: read the mode from header */
export function apcModeFromRequest(req: Request): ApcMode {
  const h = (req.headers.get('x-apc-env') ?? '').toLowerCase().trim();
  return h === 'test' ? 'test' : 'live';
}
