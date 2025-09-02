import type { SessionUser } from '@/types/session';

declare module 'iron-session' {
  interface IronSessionData {
    user?: SessionUser;
  }
}
