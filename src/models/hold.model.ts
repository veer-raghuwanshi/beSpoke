import { model, Schema } from 'mongoose';
import { integer, objectId, schemaOptions, userId } from './shared.js';

export const Hold = model(
  'Hold',
  new Schema(
    {
      dropId: objectId(),
      userId: userId(),
      quantity: integer(1),
      status: {
        type: String,
        required: true,
        enum: ['ACTIVE', 'CONFIRMED', 'EXPIRED', 'CANCELLED'],
        default: 'ACTIVE',
      },
      expiresAt: { type: Date, required: true },
      idempotencyKey: { type: String, trim: true, maxlength: 256 },
      source: {
        type: String,
        required: true,
        enum: ['CLAIM', 'WAITLIST'],
        default: 'CLAIM',
      },
    },
    schemaOptions
  )
    .index(
      { dropId: 1, userId: 1, idempotencyKey: 1 },
      {
        unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      }
    )
    .index({ status: 1, expiresAt: 1 })
    .index({ userId: 1, createdAt: -1 })
);
