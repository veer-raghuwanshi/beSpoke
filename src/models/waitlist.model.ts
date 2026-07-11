import { model, Schema } from 'mongoose';
import { integer, objectId, schemaOptions, userId } from './shared.js';

export const Waitlist = model(
  'Waitlist',
  new Schema(
    {
      dropId: objectId(),
      userId: userId(),
      status: {
        type: String,
        required: true,
        enum: ['WAITING', 'PROMOTED', 'SKIPPED'],
        default: 'WAITING',
      },
      sequence: integer(1),
    },
    schemaOptions
  )
    .index({ dropId: 1, userId: 1 }, { unique: true })
    .index({ dropId: 1, status: 1, sequence: 1 })
);
