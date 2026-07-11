import { RequestHandler } from 'express';
import { Drop, Hold, Purchase, Wallet } from '../repositories/drop.repository.js';
import { idempotencyKeyFrom, userIdFrom } from '../middleware/auth.js';
import { claimSchema, createDropSchema, objectId } from '../validators/drop.validator.js';
import { ApiError } from '../utils/api-error.js';
import { claim, confirm, joinWaitlist, releaseHold } from '../services/drops.js';

export const createDrop: RequestHandler = async (req, res, next) => {
  try {
    if (req.header('x-admin-key') !== 'dev-admin') throw new ApiError(401, 'Admin key required');
    const body = createDropSchema.parse(req.body);
    res.status(201).json(await Drop.create({ ...body, available: body.totalStock }));
  } catch (error) {
    next(error);
  }
};

export const getDrop: RequestHandler = async (req, res, next) => {
  try {
    objectId.parse(req.params.dropId);
    const drop = await Drop.findById(req.params.dropId);
    if (!drop) throw new ApiError(404, 'Drop not found');
    res.json(drop);
  } catch (error) {
    next(error);
  }
};

export const createClaim: RequestHandler = async (req, res, next) => {
  try {
    objectId.parse(req.params.dropId);
    const { quantity } = claimSchema.parse(req.body);
    res.status(201).json(await claim(req.params.dropId, userIdFrom(req), quantity, idempotencyKeyFrom(req)));
  } catch (error) {
    next(error);
  }
};

export const confirmHold: RequestHandler = async (req, res, next) => {
  try {
    objectId.parse(req.params.holdId);
    res.status(201).json(await confirm(req.params.holdId, userIdFrom(req)));
  } catch (error) {
    next(error);
  }
};

export const cancelHold: RequestHandler = async (req, res, next) => {
  try {
    objectId.parse(req.params.holdId);
    const hold = await Hold.findOne({
      _id: req.params.holdId,
      userId: userIdFrom(req),
    });
    if (!hold) throw new ApiError(404, 'Hold not found');
    if (!(await releaseHold(req.params.holdId, 'CANCELLED')))
      throw new ApiError(409, 'Hold is no longer active');
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const addToWaitlist: RequestHandler = async (req, res, next) => {
  try {
    objectId.parse(req.params.dropId);
    res.status(201).json(await joinWaitlist(req.params.dropId, userIdFrom(req)));
  } catch (error) {
    next(error);
  }
};

export const getMyAccount: RequestHandler = async (req, res, next) => {
  try {
    const userId = userIdFrom(req);
    const [wallet, holds, purchases] = await Promise.all([
      Wallet.findOne({ userId }),
      Hold.find({ userId }).sort({ createdAt: -1 }),
      Purchase.find({ userId }).sort({ createdAt: -1 }),
    ]);
    res.json({ wallet: wallet?.balance ?? 0, holds, purchases });
  } catch (error) {
    next(error);
  }
};
