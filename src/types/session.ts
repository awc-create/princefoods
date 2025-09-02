import { IronSession } from 'iron-session';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

// ✅ Provide SessionUser as the generic argument to IronSession
export type SessionWithUser = IronSession<{ user?: SessionUser }>;
