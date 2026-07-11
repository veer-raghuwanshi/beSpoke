import { model, Schema } from 'mongoose';
import { integer, schemaOptions } from './shared.js';

/** Atomic per-drop sequence makes FIFO promotion deterministic under concurrent joins. */
export const WaitlistSequence = model(
  'WaitlistSequence',
  new Schema({ _id: { type: Schema.Types.ObjectId, required: true }, value: integer(0, 0) }, schemaOptions)
);
