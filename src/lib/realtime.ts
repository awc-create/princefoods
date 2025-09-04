import { Server as IOServer } from 'socket.io';

let ioRef: IOServer | null = null;

export function setIO(io: IOServer): void {
  ioRef = io;
}
export function getIO(): IOServer | null {
  return ioRef;
}

// Called from an API route that has access to res.socket.server.io
export function broadcastToAdmins<T>(io: IOServer, payload: T): void {
  io.to('admins').emit('new_escalation', payload);
}
export function broadcastToThread<T>(io: IOServer, threadId: string, msg: T): void {
  io.to(`thread-${threadId}`).emit('message', msg);
}
