import Joi from 'joi';

export const createDropSchema = Joi.object({
  item: Joi.string().min(1).required(),
  totalStock: Joi.number().integer().positive().required(),
  liveAt: Joi.date().required(),
  price: Joi.number().integer().positive().required(),
  maxPerUser: Joi.number().integer().positive().required(),
});
