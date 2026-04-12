import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '@atlas/core';
import { users, type User, type Session } from '@atlas/db';
import { validateSession } from './session.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: Session;
    }
  }
}

const SESSION_COOKIE = 'atlas_session';

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  if (!sessionId) {
    res.status(401).json({
      data: null,
      error: { code: 'UNAUTHENTICATED', message: 'Sessão não encontrada' },
    });
    return;
  }

  validateSession(sessionId)
    .then(async (session) => {
      if (!session) {
        res.clearCookie(SESSION_COOKIE);
        res.status(401).json({
          data: null,
          error: { code: 'SESSION_EXPIRED', message: 'Sessão expirada' },
        });
        return;
      }

      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user || user.status !== 'active' || user.deletedAt) {
        res.clearCookie(SESSION_COOKIE);
        res.status(401).json({
          data: null,
          error: { code: 'ACCOUNT_INACTIVE', message: 'Conta desativada' },
        });
        return;
      }

      req.user = user;
      req.session = session;
      next();
    })
    .catch(next);
}

export function requireRole(...allowedRoles: Array<User['role']>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        data: null,
        error: { code: 'UNAUTHENTICATED', message: 'Não autenticado' },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        data: null,
        error: {
          code: 'FORBIDDEN',
          message: 'Acesso não autorizado para este perfil',
        },
      });
      return;
    }

    next();
  };
}
