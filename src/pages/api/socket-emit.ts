import type { NextApiRequest, NextApiResponse } from 'next';

interface Envelope<T = unknown> {
  room: string;
  event: string;
  payload: T;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers.authorization ?? '';
  const key = auth.replace(/^Bearer\s+/i, '');
  if (key !== process.env.SOCKET_EMIT_KEY) return res.status(401).json({ error: 'unauthorized' });

  // @ts-expect-error: io is attached at runtime on the Node server object
  const io = res.socket.server.io;
  if (!io) return res.status(500).json({ error: 'io not ready' });

  const { room, event, payload } = req.body as Envelope;
  io.to(room).emit(event, payload);
  res.json({ ok: true });
}
