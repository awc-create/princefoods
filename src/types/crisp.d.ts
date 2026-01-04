// src/types/crisp.d.ts
export {};

declare global {
  type CrispColor =
    | 'red'
    | 'orange'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'purple'
    | 'pink'
    | 'brown'
    | 'grey'
    | 'black';

  type CrispOnEvent =
    | 'chat:opened'
    | 'chat:closed'
    | 'message:sent'
    | 'message:received'
    | 'session:loaded';

  type CrispSetKey =
    | 'session:data'
    | 'session:event'
    | 'user:email'
    | 'user:nickname'
    | 'user:avatar'
    | 'user:phone';

  type CrispPushPayload =
    | ['on', CrispOnEvent, (...args: unknown[]) => void]
    | ['set', CrispSetKey, unknown]
    | ['do', string, ...unknown[]]
    | [string, ...unknown[]];

  interface Window {
    $crisp?: CrispPushPayload[];
    CRISP_WEBSITE_ID?: string;
  }
}
