import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig, createLogger, getPool, getRedis } from '@atlas/core';
import { globalErrorHandler } from './error-handler.js';
import { getModules } from './modules.js';

const config = loadConfig();
const logger = createLogger('api');
const app = express();

// Middleware global
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Health check (public)
app.get('/api/v1/health', async (_req, res) => {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

  // Postgres
  const pgStart = Date.now();
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    checks.postgres = { status: 'up', latency_ms: Date.now() - pgStart };
  } catch (err: any) {
    checks.postgres = { status: 'down', error: err.message };
  }

  // Redis
  const redisStart = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: 'up', latency_ms: Date.now() - redisStart };
  } catch (err: any) {
    checks.redis = { status: 'down', error: err.message };
  }

  // n8n
  if (config.N8N_HEALTH_URL) {
    const n8nStart = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      const resp = await fetch(config.N8N_HEALTH_URL, { signal: controller.signal });
      clearTimeout(timeout);
      checks.n8n = { status: resp.ok ? 'up' : 'degraded', latency_ms: Date.now() - n8nStart };
    } catch (err: any) {
      checks.n8n = { status: 'down', error: err.message };
    }
  } else {
    checks.n8n = { status: 'not_configured' };
  }

  const allUp = Object.values(checks).every((c) => c.status === 'up' || c.status === 'not_configured');
  const overallStatus = allUp ? 'healthy' : 'degraded';
  const httpStatus = checks.postgres?.status === 'down' ? 503 : 200;

  res.status(httpStatus).json({
    data: {
      status: overallStatus,
      version: '0.1.0',
      uptime_seconds: Math.floor(process.uptime()),
      dependencies: checks,
      modules: Object.fromEntries(
        getModules().map((m) => [m.id, { enabled: m.enabled }]),
      ),
    },
    error: null,
  });
});

// Global error handler
app.use(globalErrorHandler);

// Start
app.listen(config.API_PORT, () => {
  logger.info(
    { port: config.API_PORT, env: config.NODE_ENV },
    'Atlas API started',
  );
});

export default app;
