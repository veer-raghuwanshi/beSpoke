import { model, Schema } from 'mongoose';
import { integer, objectId, schemaOptions, userId } from './shared.js';

export const Purchase = model(
  'Purchase',
  new Schema(
    {
      holdId: { ...objectId(), unique: true },
      dropId: objectId(),
      userId: userId(),
      quantity: integer(1),
      unitPrice: integer(1),
      total: integer(1),
    },
    schemaOptions
  ).index({ userId: 1, createdAt: -1 })
);
