import { ErrorRequestHandler } from 'express';

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) return void res.status(err.status).json({ error: err.message });
  if (err?.name === 'ZodError') return void res.status(400).json({ error: 'Invalid request', details: err.issues });
  if (err?.code === 11000) return void res.status(409).json({ error: 'Duplicate request' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
