import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { getConfig } from './config.js';

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (_pool) return _pool;
  const config = getConfig();
  _pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return _pool;
}

export function getDb() {
  return drizzle(getPool());
}

export async function closePool(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}
