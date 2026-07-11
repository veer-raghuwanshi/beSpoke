import { model, Schema } from 'mongoose';
import { integer, schemaOptions, userId } from './shared.js';

export const Wallet = model(
  'Wallet',
  new Schema({ userId: { ...userId(), unique: true }, balance: integer(0) }, schemaOptions)
);
