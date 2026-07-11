import { Request } from 'express';
import { ApiError } from '../utils/api-error.js';

export const userIdFrom = (req: Request) => { const value = req.header('x-user-id'); if (!value) throw new ApiError(401, 'x-user-id header is required'); return value; };
export const idempotencyKeyFrom = (req: Request) => { const value = req.header('idempotency-key'); if (!value) throw new ApiError(400, 'Idempotency-Key header is required'); return value; };
