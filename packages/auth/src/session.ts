import crypto from 'node:crypto';
import { eq, and, gt } from 'drizzle-orm';
import { getDb } from '@atlas/core';
import { sessions, type Session, type NewSession } from '@atlas/db';

const ABSOLUTE_TTL_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_TTL_MS = 8 * 60 * 60 * 1000;

export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<Session> {
  const db = getDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ABSOLUTE_TTL_MS);
  const csrfToken = crypto.randomBytes(32).toString('hex');

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      csrfToken,
      ipAddress,
      userAgent,
      expiresAt,
    } satisfies NewSession)
    .returning();

  return session!;
}

export async function validateSession(
  sessionId: string,
): Promise<Session | null> {
  const db = getDb();
  const now = new Date();
  const inactivityThreshold = new Date(now.getTime() - INACTIVITY_TTL_MS);

  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, now),
        gt(sessions.lastActiveAt, inactivityThreshold),
      ),
    )
    .limit(1);

  if (!session) return null;

  await db
    .update(sessions)
    .set({ lastActiveAt: now })
    .where(eq(sessions.id, sessionId));

  return session;
}

export async function destroySession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function destroyUserSessions(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
