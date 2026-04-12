import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig, createLogger } from '@atlas/core';
import { globalErrorHandler } from './error-handler.js';
import healthRouter from './health.js';
import authRouter from './routes/auth.routes.js';
import adminRouter from './routes/admin.routes.js';
import { registerModuleRoutes } from './modules.js';
import { seedAdmin } from './seed.js';

const config = loadConfig();
const logger = createLogger('api');
const app: express.Express = express();

// Global middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Routes
app.use(healthRouter);
app.use(authRouter);
app.use(adminRouter);

// Module routes (feature-flag gated)
registerModuleRoutes(app);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Start
app.listen(config.API_PORT, async () => {
  logger.info(
    { port: config.API_PORT, env: config.NODE_ENV },
    'Atlas API started',
  );
  await seedAdmin();
});

export default app;
