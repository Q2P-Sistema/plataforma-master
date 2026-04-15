import { getRedis, createLogger } from '@atlas/core';

const logger = createLogger('breakingpoint:cache');

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<{ data: T; hit: boolean }> {
  try {
    const redis = getRedis();
    const raw = await redis.get(key);
    if (raw) return { data: JSON.parse(raw) as T, hit: true };

    const data = await fetchFn();
    redis.setex(key, ttlSeconds, JSON.stringify(data)).catch((err) => {
      logger.warn({ err, key }, 'Falha ao escrever cache');
    });
    return { data, hit: false };
  } catch (err) {
    logger.warn({ err, key }, 'Redis indisponível, usando fetch direto');
    const data = await fetchFn();
    return { data, hit: false };
  }
}

export async function invalidate(pattern: string): Promise<number> {
  try {
    const redis = getRedis();
    if (!pattern.includes('*')) {
      return await redis.del(pattern);
    }
    let cursor = '0';
    let total = 0;
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) total += await redis.del(...keys);
    } while (cursor !== '0');
    return total;
  } catch (err) {
    logger.warn({ err, pattern }, 'Falha ao invalidar cache');
    return 0;
  }
}
