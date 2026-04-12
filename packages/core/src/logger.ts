import pino from 'pino';
import { getConfig } from './config.js';

const REDACTED_FIELDS = [
  'password',
  'senha',
  'token',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'cpf',
  'cnpj',
  'api_key',
  'x-api-key',
  'totp_secret',
  'password_hash',
  'password_reset_token',
];

let _logger: pino.Logger | null = null;

export function createLogger(name?: string): pino.Logger {
  if (_logger && !name) return _logger;

  const config = getConfig();
  const logger = pino({
    name: name ?? 'atlas',
    level: config.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: {
      paths: REDACTED_FIELDS.flatMap((f) => [f, `*.${f}`, `*.*.${f}`]),
      censor: '[REDACTED]',
    },
    transport:
      config.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });

  if (!name) _logger = logger;
  return logger;
}
