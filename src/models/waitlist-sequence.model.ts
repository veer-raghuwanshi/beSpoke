import { model, Schema } from 'mongoose';
import { integer, schemaOptions } from './shared.js';

export const WaitlistSequence = model(
  'WaitlistSequence',
  new Schema(
    {
      _id: { type: Schema.Types.ObjectId, required: true },
      value: integer(0, 0),
    },
    schemaOptions
  )
);
