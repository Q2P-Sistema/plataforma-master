import { z } from 'zod';
import 'dotenv/config';

const boolString = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  N8N_HEALTH_URL: z.string().url().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().optional(),
  API_PORT: z.coerce.number().default(3005),
  WEB_PORT: z.coerce.number().default(5173),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  MODULE_HEDGE_ENABLED: boolString,
  MODULE_STOCKBRIDGE_ENABLED: boolString,
  MODULE_BREAKINGPOINT_ENABLED: boolString,
  MODULE_CLEVEL_ENABLED: boolString,
  MODULE_COMEXINSIGHT_ENABLED: boolString,
  MODULE_COMEXFLOW_ENABLED: boolString,
  MODULE_FORECAST_ENABLED: boolString,
});

export type Env = z.infer<typeof envSchema>;

let _config: Env | null = null;

export function loadConfig(): Env {
  if (_config) return _config;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  _config = result.data;
  return _config;
}

export function getConfig(): Env {
  if (!_config) return loadConfig();
  return _config;
}
