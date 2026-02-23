// src/lib/http/response-body.ts
export function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Read a Response body ONCE (prevents "body already used" issues),
 * then best-effort parse JSON.
 */
export async function readResponseBody(res: Response): Promise<{
  text: string;
  json: unknown | null;
  contentType: string;
}> {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text().catch(() => '');
  const json = text ? safeJsonParse(text) : null;

  return { text, json, contentType };
}

/**
 * Convenience: returns JSON if parseable, otherwise returns a tagged object
 * carrying the raw text (useful for logging + storing).
 */
export async function readJsonOrText(res: Response): Promise<unknown> {
  const { text, json } = await readResponseBody(res);

  if (json !== null) return json;

  return {
    nonJson: true,
    body: text
  };
}
