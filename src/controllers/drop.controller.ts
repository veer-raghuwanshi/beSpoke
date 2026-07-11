import { RequestHandler } from 'express';
import { idempotencyKeyFrom, userIdFrom } from '../middleware/auth.js';
import { Drop } from '../repositories/drop.repository.js';
import { claim, joinWaitlist } from '../services/index.js';
import { ApiError } from '../utils/api-error.js';
import { claimSchema } from '../validators/claim.validator.js';
import { objectId } from '../validators/common.validator.js';

export const getDrop: RequestHandler = async (req, res, next) => {
  try {
    const { error } = objectId.validate(req.params.dropId);
    if (error) throw error;
    const drop = await Drop.findById(req.params.dropId);
    if (!drop) throw new ApiError(404, 'Drop not found');
    res.json(drop);
  } catch (error) {
    next(error);
  }
};

export const createClaim: RequestHandler = async (req, res, next) => {
  try {
    const { error: idError } = objectId.validate(req.params.dropId);
    if (idError) throw idError;
    const { value, error } = claimSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) throw error;
    const { quantity } = value;
    res
      .status(201)
      .json(
        await claim(
          req.params.dropId,
          userIdFrom(req),
          quantity,
          idempotencyKeyFrom(req)
        )
      );
  } catch (error) {
    next(error);
  }
};

export const addToWaitlist: RequestHandler = async (req, res, next) => {
  try {
    const { error } = objectId.validate(req.params.dropId);
    if (error) throw error;
    res
      .status(201)
      .json(await joinWaitlist(req.params.dropId, userIdFrom(req)));
  } catch (error) {
    next(error);
  }
};
