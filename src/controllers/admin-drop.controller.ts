import { RequestHandler } from 'express';
import { config } from '../config/env.js';
import { Drop } from '../repositories/drop.repository.js';
import { ApiError } from '../utils/api-error.js';
import { createDropSchema } from '../validators/drop.validator.js';

export const createDrop: RequestHandler = async (req, res, next) => {
  try {
    if (req.header('x-admin-key') !== config.adminKey)

      throw new ApiError(401, 'Admin key required');

    const { value: body, error } = createDropSchema.validate(req.body,
       {
      abortEarly: false,
    });
    if (error) throw error;
    res
      .status(201)
      .json(await Drop.create({ ...body, available: body.totalStock }));
  } catch (error) {
    next(error);
  }
};
