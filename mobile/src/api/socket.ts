import { io, type Socket } from 'socket.io-client';
import { BASE_URL, getAccessToken } from './client';

/**
 * Realtime connection.
 *
 * A single shared socket rather than one per screen: several screens listen at once
 * (chat, the unread badge, session updates), and multiple sockets would multiply both
 * the server's presence bookkeeping and the app's battery use.
 */

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

let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) return null;

  if (socket?.connected) return socket;

  // Tear down any half-open socket before opening a new one, so a token refresh does
  // not leave two connections fighting over the same user room.
  socket?.removeAllListeners();
  socket?.disconnect();

  socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect_error', (err) => {
    // An auth failure will not fix itself by retrying with the same token.
    if (err.message === 'UNAUTHORIZED' || err.message === 'ACCOUNT_SUSPENDED') {
      socket?.disconnect();
    }
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/**
 * Subscribes to an event and returns an unsubscribe function, so screens can wire this
 * straight into a `useEffect` cleanup and never leak a listener.
 */
export function onEvent<T = unknown>(event: string, handler: (payload: T) => void): () => void {
  const active = socket ?? connectSocket();
  if (!active) return () => undefined;

  active.on(event, handler as (...args: unknown[]) => void);
  return () => {
    active.off(event, handler as (...args: unknown[]) => void);
  };
}

export function emitTyping(conversationId: string, isTyping: boolean): void {
  socket?.emit(RT.TYPING, { conversationId, isTyping });
}

export function joinConversation(conversationId: string): void {
  socket?.emit('conversation:join', conversationId);
}

export function leaveConversation(conversationId: string): void {
  socket?.emit('conversation:leave', conversationId);
}
