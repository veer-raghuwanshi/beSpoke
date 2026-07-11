import Joi from 'joi';

export const objectId = Joi.string()
  .pattern(/^[a-f\d]{24}$/i)
  .messages({
    'string.pattern.base': 'Invalid id',
  });
