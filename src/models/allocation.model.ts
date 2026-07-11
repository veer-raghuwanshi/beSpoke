import { model, Schema } from 'mongoose';
import { integer, objectId, schemaOptions, userId } from './shared.js';

/** Materialized allocation makes the per-user cap check O(1) during a claim transaction. */
export const Allocation = model(
  'Allocation',
  new Schema(
    { dropId: objectId(), userId: userId(), held: integer(0, 0), purchased: integer(0, 0) },
    schemaOptions
  ).index({ dropId: 1, userId: 1 }, { unique: true })
);
