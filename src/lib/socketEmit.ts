import { getBaseUrl } from './baseUrl';

export async function socketEmit(room: string, event: string, payload: unknown): Promise<void> {
  const url = `${getBaseUrl()}/api/socket-emit`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SOCKET_EMIT_KEY ?? ''}`
      },
      body: JSON.stringify({ room, event, payload })
    });
  } catch (e: unknown) {
    // Don’t fail the request just because sockets are down.

    console.warn('[socket-emit] failed:', e instanceof Error ? e.message : String(e));
  }
}
