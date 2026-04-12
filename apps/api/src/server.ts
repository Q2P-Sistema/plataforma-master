import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { loadConfig, createLogger } from '@atlas/core';
import { globalErrorHandler } from './error-handler.js';
import healthRouter from './health.js';

const config = loadConfig();
const logger = createLogger('api');
const app = express();

// Global middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Routes
app.use(healthRouter);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Start
app.listen(config.API_PORT, () => {
  logger.info(
    { port: config.API_PORT, env: config.NODE_ENV },
    'Atlas API started',
  );
});

export default app;
