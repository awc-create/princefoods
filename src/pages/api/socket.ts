import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';

export const config = { api: { bodyParser: false } };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // @ts-expect-error: <brief reason>
  if (!res.socket.server.io) {
    // @ts-expect-error: <brief reason>
    const io = new IOServer(res.socket.server, { path: '/api/socket' });
    // @ts-expect-error: <brief reason>
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      socket.on('join', (room: string) => socket.join(room));   // 'admins' or `thread-<id>`
      socket.on('leave', (room: string) => socket.leave(room));  // ✅ allow leaving
    });
  }
  res.end();
}
