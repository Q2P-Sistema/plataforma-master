import Redis from 'ioredis';
import { getConfig } from './config.js';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const config = getConfig();
  _redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5_000);
      return delay;
    },
    lazyConnect: true,
  });
  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}
