import { RequestHandler } from 'express';
import { idempotencyKeyFrom, userIdFrom } from '../middleware/auth.js';
import { Drop } from '../repositories/drop.repository.js';
import { claim, joinWaitlist } from '../services/index.js';
import { ApiError } from '../utils/api-error.js';
import { claimSchema } from '../validators/claim.validator.js';
import { objectId } from '../validators/common.validator.js';

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

export const addToWaitlist: RequestHandler = async (req, res, next) => {
  try {
    objectId.parse(req.params.dropId);
    res.status(201).json(await joinWaitlist(req.params.dropId, userIdFrom(req)));
  } catch (error) {
    next(error);
  }
};
