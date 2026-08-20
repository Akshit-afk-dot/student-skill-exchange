import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env, isProd } from '../config/env';
import { logger } from '../config/logger';
import { User } from '../models';
import { verifyAccessToken } from '../modules/auth/tokens';
import * as chatService from '../modules/chat/service';
import { setOnlineStatus } from '../modules/users/service';
import { RT, registerEmitter } from './bus';

interface AuthedSocket extends Socket {
  data: { userId: string };
}

/**
 * Realtime layer.
 *
 * Every socket joins a room named after its user id. Emitting to a user is then a room
 * emit, which works unchanged when several devices are signed in to the same account
 * and, with a Redis adapter, across multiple server instances.
 */
export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : isProd ? false : true,
      credentials: true,
    },
    // Sockets go idle on mobile when the app is backgrounded; a generous timeout avoids
    // churning reconnections every time the user switches apps.
    pingTimeout: 30_000,
    pingInterval: 25_000,
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

      if (!token) return next(new Error('UNAUTHORIZED'));

      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('status suspendedUntil').lean();
      if (!user || user.status === 'BANNED') return next(new Error('UNAUTHORIZED'));
      if (user.status === 'SUSPENDED') return next(new Error('ACCOUNT_SUSPENDED'));

      socket.data.userId = String(payload.sub);
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = (socket as AuthedSocket).data;
    void socket.join(userId);
    logger.debug({ userId, socketId: socket.id }, 'Socket connected');

    void setOnlineStatus(userId, true);
    socket.broadcast.emit(RT.PRESENCE, { userId, isOnline: true });

    /** Join a conversation room, after verifying membership. */
    socket.on('conversation:join', async (conversationId: unknown, ack?: (r: unknown) => void) => {
      if (typeof conversationId !== 'string') return ack?.({ ok: false, error: 'BAD_REQUEST' });
      try {
        await chatService.assertMember(conversationId, userId);
        await socket.join(`conversation:${conversationId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: 'FORBIDDEN' });
      }
    });

    socket.on('conversation:leave', (conversationId: unknown) => {
      if (typeof conversationId === 'string') void socket.leave(`conversation:${conversationId}`);
    });

    /**
     * Typing indicators are relayed, never stored. They are broadcast to the room rather
     * than persisted because a missed one is worthless a second later.
     */
    socket.on('chat:typing', async (payload: unknown) => {
      if (typeof payload !== 'object' || payload === null) return;
      const { conversationId, isTyping } = payload as {
        conversationId?: string;
        isTyping?: boolean;
      };
      if (typeof conversationId !== 'string') return;

      try {
        const conversation = await chatService.assertMember(conversationId, userId);
        const other = chatService.otherParticipant(conversation, userId);
        io.to(String(other)).emit(RT.TYPING, {
          conversationId,
          userId,
          isTyping: Boolean(isTyping),
        });
      } catch {
        // A non-member typing event is simply dropped.
      }
    });

    /** Sending over the socket mirrors POST /conversations/:id/messages exactly. */
    socket.on('message:send', async (payload: unknown, ack?: (r: unknown) => void) => {
      if (typeof payload !== 'object' || payload === null) {
        return ack?.({ ok: false, error: 'BAD_REQUEST' });
      }
      const { conversationId, body, type, attachment } = payload as {
        conversationId?: string;
        body?: string;
        type?: 'TEXT' | 'IMAGE' | 'FILE';
        attachment?: never;
      };
      if (typeof conversationId !== 'string') {
        return ack?.({ ok: false, error: 'BAD_REQUEST' });
      }

      try {
        const message = await chatService.sendMessage(conversationId, userId, {
          body,
          type: type ?? 'TEXT',
          attachment,
        });
        ack?.({ ok: true, message: message.toJSON() });
      } catch (err) {
        const code = err instanceof Error ? err.message : 'SEND_FAILED';
        ack?.({ ok: false, error: code });
      }
    });

    socket.on('message:read', async (conversationId: unknown, ack?: (r: unknown) => void) => {
      if (typeof conversationId !== 'string') return ack?.({ ok: false });
      try {
        const count = await chatService.markConversationRead(conversationId, userId);
        ack?.({ ok: true, markedRead: count });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on('disconnect', async () => {
      // Other devices may still hold a session; only report offline once the last
      // socket for this user goes away.
      const remaining = await io.in(userId).fetchSockets();
      if (remaining.length === 0) {
        void setOnlineStatus(userId, false);
        socket.broadcast.emit(RT.PRESENCE, { userId, isOnline: false });
      }
      logger.debug({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  // Let plain HTTP services push realtime events without importing this module.
  registerEmitter((targetUserId, event, payload) => {
    io.to(targetUserId).emit(event, payload);
  });

  return io;
}
