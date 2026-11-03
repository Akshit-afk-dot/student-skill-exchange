import path from 'node:path';
import compression from 'compression';
import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import mongoose from 'mongoose';
import { env, isProd, isTest, mailEnabled, storageDriver } from './config/env';
import { logger } from './config/logger';
import { errorHandler, globalLimiter, notFoundHandler } from './middleware';
import { ApiError } from './utils/errors';
import { mailDeliverable } from './modules/notifications/mail';
import { pagesRouter } from './modules/pages/router';
import { apiRouter } from './routes';

/**
 * Origin policy.
 *
 * Native mobile clients send no `Origin` header at all, so a request without one is
 * allowed through; browsers always send one, and those must appear in CORS_ORIGINS.
 * In development an empty allow-list means "anything", which keeps Expo web and the
 * Vite dev server working without configuration.
 */
function corsOptions(): CorsOptions {
  const allowed = env.CORS_ORIGINS;
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowed.length === 0) {
        if (!isProd) return callback(null, true);
        return callback(
          new ApiError(500, 'CORS_NOT_CONFIGURED', 'CORS_ORIGINS must be set in production'),
        );
      }
      if (allowed.includes(origin)) return callback(null, true);
      // An ApiError (not a bare Error) so the error handler renders a 403 rather than
      // reporting a rejected origin as an internal server failure.
      callback(
        new ApiError(
          403,
          'ORIGIN_NOT_ALLOWED',
          `Origin ${origin} is not permitted. Add it to CORS_ORIGINS.`,
        ),
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  };
}

export function createApp(): Express {
  const app = express();

  // Rate limiting and request logging both read the client IP; behind a load balancer
  // that is only correct once Express is told to trust the proxy's headers.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON and, in local mode, uploaded images; it renders no HTML of
      // its own that needs a strict CSP, but images must stay embeddable by the app.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cors(corsOptions()));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        // Health checks would otherwise dominate the log.
        autoLogging: { ignore: (req) => req.url === '/health' },
      }),
    );
  }

  app.use(globalLimiter);

  /** Liveness and readiness in one probe: reports the database connection state. */
  app.get('/health', (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const healthy = dbState === 1;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      database: ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown',
      email: !mailEnabled ? 'not configured' : mailDeliverable() ? 'ok' : 'unreachable',
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Locally-stored uploads are served straight from disk. With Cloudinary configured
  // this route is never hit, because stored URLs point at the CDN instead.
  if (storageDriver === 'local') {
    app.use(
      '/uploads',
      express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), {
        maxAge: '7d',
        // Uploaded files are user content: never let one be interpreted as a script.
        setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
      }),
    );
  }

  app.use('/api/v1', apiRouter);
  // Legal pages and web account deletion: linked from the stores, so they live at stable
  // top-level URLs rather than under the versioned API.
  app.use(pagesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
