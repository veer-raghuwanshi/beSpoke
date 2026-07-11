import Joi from 'joi';

export const claimSchema = Joi.object({
  quantity: Joi.number().integer().positive().required(),
});
