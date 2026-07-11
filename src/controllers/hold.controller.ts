import { RequestHandler } from 'express';
import { Hold } from '../repositories/drop.repository.js';
import { confirm, releaseHold } from '../services/index.js';
import { ApiError } from '../utils/api-error.js';
import { userIdFrom } from '../middleware/auth.js';
import { objectId } from '../validators/common.validator.js';

export const confirmHold: RequestHandler = async (req, res, next) => {
  try {
    const { error } = objectId.validate(req.params.holdId);
    if (error) throw error;
    res.status(201).json(await confirm(req.params.holdId, userIdFrom(req)));
  } catch (error) {
    next(error);
  }
};

export const cancelHold: RequestHandler = async (req, res, next) => {
  try {
    const { error } = objectId.validate(req.params.holdId);
    if (error) throw error;
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
