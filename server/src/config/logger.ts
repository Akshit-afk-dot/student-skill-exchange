import pino, { type LoggerOptions } from 'pino';
import { env, isProd, isTest } from './env';

const base: LoggerOptions = {
  level: isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      '*.password',
      '*.token',
    ],
    remove: true,
  },
};

/**
 * Pretty output is a development nicety; production ships newline-delimited JSON for
 * log shippers to parse.
 *
 * `pino-pretty` is a devDependency, so a production install (`npm ci --omit=dev`) run
 * with NODE_ENV unset would not have it. Falling back to plain JSON keeps that a
 * cosmetic difference rather than a failure to boot.
 */
function createLogger() {
  if (isProd || isTest) return pino(base);

  try {
    require.resolve('pino-pretty');
  } catch {
    return pino(base);
  }

  return pino({
    ...base,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
  });
}

export const logger = createLogger();
