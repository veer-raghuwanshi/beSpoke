import { model, Schema } from 'mongoose';
import { integer, schemaOptions } from './shared.js';

const dropSchema = new Schema(
  {
    item: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 256,
    },
    totalStock: integer(1),
    available: integer(0),
    liveAt: { type: Date, required: true, index: true },
    price: integer(1),
    maxPerUser: integer(1),
  },
  schemaOptions
).index({ liveAt: 1, available: 1 });

dropSchema.pre('validate', function validateBounds(next) {
  if (this.available > this.totalStock)
    return next(new Error('available cannot exceed totalStock'));
  if (this.maxPerUser > this.totalStock)
    return next(new Error('maxPerUser cannot exceed totalStock'));
  next();
});

export const Drop = model('Drop', dropSchema);
