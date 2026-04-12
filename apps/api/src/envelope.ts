import type { Response } from 'express';

export interface ApiResponse<T = unknown> {
  data: T | null;
  error: ApiError | null;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
  traceId?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
): void {
  const body: ApiResponse<T> = { data, error: null };
  if (meta) body.meta = meta;
  res.status(status).json(body);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  status = 400,
  fields?: Record<string, string>,
  traceId?: string,
): void {
  const error: ApiError = { code, message };
  if (fields) error.fields = fields;
  if (traceId) error.traceId = traceId;
  res.status(status).json({ data: null, error } satisfies ApiResponse);
}
