import { Schema } from 'mongoose';
import { config } from '../config/env.js';

const timestamps = { createdAt: true, updatedAt: true };
export const schemaOptions = {
  timestamps,
  versionKey: false as const,
  id: false,
  strict: 'throw' as const,
  autoIndex: !config.isProduction,
  autoCreate: !config.isProduction,
};

const isSafeInteger = (value: number) => Number.isSafeInteger(value);
export const integer = (minimum: number, defaultValue?: number) => ({
  type: Number,
  required: defaultValue === undefined,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
  min: minimum,
  validate: { validator: isSafeInteger, message: 'must be a safe integer' },
});

export const userId = () => ({
  type: String,
  required: true,
  trim: true,
  minlength: 1,
  maxlength: 128,
});
export const objectId = () => ({
  type: Schema.Types.ObjectId,
  required: true,
  immutable: true,
});
