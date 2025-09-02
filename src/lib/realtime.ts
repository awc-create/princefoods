import { Server as IOServer } from 'socket.io';

let ioRef: IOServer | null = null;
export function setIO(io: IOServer) { ioRef = io; }
export function getIO() { return ioRef; }

// Called from an API route that has access to res.socket.server.io
export function broadcastToAdmins(io: IOServer, payload: any) {
  io.to('admins').emit('new_escalation', payload);
}
export function broadcastToThread(io: IOServer, threadId: string, msg: any) {
  io.to(`thread-${threadId}`).emit('message', msg);
}
