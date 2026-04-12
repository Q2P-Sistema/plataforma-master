import { eq } from 'drizzle-orm';
import { getConfig, getDb, createLogger } from '@atlas/core';
import { users } from '@atlas/db';
import { hashPassword } from '@atlas/auth';

const logger = createLogger('seed');

export async function seedAdmin(): Promise<void> {
  const config = getConfig();

  if (!config.SEED_ADMIN_EMAIL || !config.SEED_ADMIN_PASSWORD) {
    logger.debug('SEED_ADMIN_EMAIL/PASSWORD not set, skipping seed');
    return;
  }

  const db = getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .limit(1);

  if (existing) {
    logger.debug('Users table not empty, skipping seed');
    return;
  }

  const passwordHash = await hashPassword(config.SEED_ADMIN_PASSWORD);

  await db.insert(users).values({
    name: 'Admin',
    email: config.SEED_ADMIN_EMAIL,
    passwordHash,
    role: 'diretor',
    status: 'active',
    totpEnabled: false,
  });

  logger.info(
    { email: config.SEED_ADMIN_EMAIL },
    'Seed admin created successfully',
  );
}
