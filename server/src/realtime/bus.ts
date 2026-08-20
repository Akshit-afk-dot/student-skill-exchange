/**
 * Indirection between business services and the Socket.IO server.
 *
 * Services need to push events to a user, but importing the socket server from a service
 * (which the socket handlers themselves import) would create a cycle. The socket layer
 * registers its emitter here at startup; before that, and in unit tests, emits are no-ops.
 */

export type RealtimeEmitter = (userId: string, event: string, payload: unknown) => void;

let emitter: RealtimeEmitter | null = null;

export function registerEmitter(fn: RealtimeEmitter): void {
  emitter = fn;
}

export function clearEmitter(): void {
  emitter = null;
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  emitter?.(userId, event, payload);
}

/** Socket event names, shared with the mobile client. */
export const RT = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  TYPING: 'chat:typing',
  PRESENCE: 'presence:update',
  NOTIFICATION: 'notification:new',
  REQUEST_NEW: 'request:new',
  REQUEST_UPDATED: 'request:updated',
  SESSION_UPDATED: 'session:updated',
} as const;
