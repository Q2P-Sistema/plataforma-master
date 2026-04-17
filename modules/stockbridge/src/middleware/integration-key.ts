import type { Request, Response, NextFunction } from 'express';
import { getConfig, createLogger } from '@atlas/core';

const logger = createLogger('stockbridge:integration-key');

/**
 * Middleware que valida o header `X-Atlas-Integration-Key` contra a env
 * `ATLAS_INTEGRATION_KEY`. Usado em endpoints consumidos por n8n (ex: saidas
 * automaticas). Retorna 401 se header ausente/invalido.
 *
 * Se a env nao estiver configurada, retorna 503 — endpoint desabilitado.
 */
export function requireIntegrationKey(req: Request, res: Response, next: NextFunction): void {
  const config = getConfig();
  const expected = config.ATLAS_INTEGRATION_KEY;

  if (!expected) {
    logger.warn('ATLAS_INTEGRATION_KEY nao configurada — endpoint de integracao recusando chamadas');
    res.status(503).json({
      data: null,
      error: { code: 'INTEGRATION_DISABLED', message: 'Endpoint de integracao desabilitado (ATLAS_INTEGRATION_KEY ausente)' },
    });
    return;
  }

  const provided = req.header('X-Atlas-Integration-Key');
  if (!provided || provided !== expected) {
    logger.warn({ provided: provided ? 'present-invalid' : 'missing' }, 'Integration key invalida ou ausente');
    res.status(401).json({
      data: null,
      error: { code: 'INVALID_INTEGRATION_KEY', message: 'Header X-Atlas-Integration-Key invalido ou ausente' },
    });
    return;
  }

  next();
}
