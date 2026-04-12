import type { Request, Response, NextFunction } from 'express';

const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const sessionCsrf = (req as any).session?.csrfToken;
  if (!sessionCsrf) {
    next();
    return;
  }

  const headerToken = req.headers[CSRF_HEADER];
  if (!headerToken || headerToken !== sessionCsrf) {
    res.status(403).json({
      data: null,
      error: { code: 'CSRF_INVALID', message: 'Token CSRF inválido' },
    });
    return;
  }

  next();
}
