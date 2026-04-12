import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { createLogger } from '@atlas/core';

const logger = createLogger('error-handler');

export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const traceId = crypto.randomUUID().slice(0, 8);

  logger.error({ traceId, err: err.message, stack: err.stack }, 'Unhandled error');

  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev
        ? err.message
        : 'Algo deu errado. Contate o suporte com o código de rastreio.',
      traceId,
    },
  });
}
