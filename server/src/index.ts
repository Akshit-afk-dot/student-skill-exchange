import http from 'node:http';
import type { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env, isProd } from './config/env';
import { logger } from './config/logger';
import { startJobs, stopJobs } from './jobs';
import { createSocketServer } from './realtime/socket';
import { ensureSeedData } from './seed/bootstrap';

async function main(): Promise<void> {
  await connectDatabase();

  // Categories and the bootstrap admin must exist before the first request arrives.
  await ensureSeedData();

  const app = createApp();
  const server = http.createServer(app);
  const io = createSocketServer(server);

  if (env.ENABLE_JOBS) startJobs();

  // A port clash is the most common local failure; say so plainly rather than
  // surfacing a raw EADDRINUSE stack through the uncaught-exception handler.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.fatal(`Port ${env.PORT} is already in use. Stop the other process or set PORT.`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, url: env.PUBLIC_URL },
      `${env.APP_NAME} API listening`,
    );
  });

  installShutdownHandlers(server, io);
}

/**
 * Graceful shutdown: stop accepting new work, let in-flight requests finish, then close
 * the database. A container orchestrator sends SIGTERM and waits, so draining properly
 * is what prevents dropped requests during a rolling deploy.
 */
function installShutdownHandlers(server: http.Server, io: SocketServer): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    void (async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal }, 'Shutting down');

      // Force-exit guard: if a socket refuses to drain, do not hang the deploy forever.
      const forceExit = setTimeout(() => {
        logger.error('Graceful shutdown timed out — forcing exit');
        process.exit(1);
      }, 15_000);
      forceExit.unref();

      try {
        await stopJobs();
        await io.close();
        await new Promise<void>((resolve, reject) => {
          // If startup failed before listen(), there is nothing to drain — that is a
          // clean outcome, not a shutdown error.
          if (!server.listening) return resolve();
          server.close((err) => (err ? reject(err) : resolve()));
        });
        await disconnectDatabase();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    })();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
    // A rejected promise leaves the process in an unknown state; in production the
    // supervisor should restart it rather than let it limp along.
    if (isProd) shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
}

void main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
