import express from 'express';
import { z } from 'zod';
import { Drop, Hold, Purchase, Wallet } from './models.js';
import { ApiError, errorHandler } from './errors.js';
import { claim, confirm, joinWaitlist, releaseHold } from './services/drops.js';

const user = (req: express.Request) => { const value = req.header('x-user-id'); if (!value) throw new ApiError(401, 'x-user-id header is required'); return value; };
const key = (req: express.Request) => { const value = req.header('idempotency-key'); if (!value) throw new ApiError(400, 'Idempotency-Key header is required'); return value; };
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const app = express();
app.use(express.json());

app.post('/v1/admin/drops', async (req, res, next) => { try {
  if (req.header('x-admin-key') !== 'dev-admin') throw new ApiError(401, 'Admin key required');
  const body = z.object({ item: z.string().min(1), totalStock: z.number().int().positive(), liveAt: z.coerce.date(), price: z.number().int().positive(), maxPerUser: z.number().int().positive() }).parse(req.body);
  const drop = await Drop.create({ ...body, available: body.totalStock }); res.status(201).json(drop);
} catch (e) { next(e); } });

app.get('/v1/drops/:dropId', async (req, res, next) => { try { objectId.parse(req.params.dropId); const drop = await Drop.findById(req.params.dropId); if (!drop) throw new ApiError(404, 'Drop not found'); res.json(drop); } catch (e) { next(e); } });
app.post('/v1/drops/:dropId/claims', async (req, res, next) => { try { objectId.parse(req.params.dropId); const body = z.object({ quantity: z.number().int().positive() }).parse(req.body); const hold = await claim(req.params.dropId, user(req), body.quantity, key(req)); res.status(201).json(hold); } catch (e) { next(e); } });
app.post('/v1/holds/:holdId/confirm', async (req, res, next) => { try { objectId.parse(req.params.holdId); const purchase = await confirm(req.params.holdId, user(req)); res.status(201).json(purchase); } catch (e) { next(e); } });
app.delete('/v1/holds/:holdId', async (req, res, next) => { try { objectId.parse(req.params.holdId); const hold = await Hold.findOne({ _id: req.params.holdId, userId: user(req) }); if (!hold) throw new ApiError(404, 'Hold not found'); const changed = await releaseHold(req.params.holdId, 'CANCELLED'); if (!changed) throw new ApiError(409, 'Hold is no longer active'); res.status(204).end(); } catch (e) { next(e); } });
app.post('/v1/drops/:dropId/waitlist', async (req, res, next) => { try { objectId.parse(req.params.dropId); const entry = await joinWaitlist(req.params.dropId, user(req)); res.status(201).json(entry); } catch (e) { next(e); } });
app.get('/v1/me', async (req, res, next) => { try { const userId = user(req); const [wallet, holds, purchases] = await Promise.all([Wallet.findOne({ userId }), Hold.find({ userId }).sort({ createdAt: -1 }), Purchase.find({ userId }).sort({ createdAt: -1 })]); res.json({ wallet: wallet?.balance ?? 0, holds, purchases }); } catch (e) { next(e); } });
app.get('/openapi.json', (_req, res) => res.json({ openapi: '3.0.3', info: { title: 'BeSpoke Drops API', version: '1.0.0' }, paths: {
  '/v1/admin/drops': { post: { summary: 'Create drop (x-admin-key: dev-admin)' } },
  '/v1/drops/{dropId}/claims': { post: { summary: 'Claim stock; x-user-id and Idempotency-Key required' } },
  '/v1/holds/{holdId}/confirm': { post: { summary: 'Confirm a hold' } },
  '/v1/holds/{holdId}': { delete: { summary: 'Cancel a hold' } },
  '/v1/drops/{dropId}/waitlist': { post: { summary: 'Join FIFO waitlist' } }, '/v1/me': { get: { summary: 'Wallet, holds, purchases' } }
} }));
app.use(errorHandler);
