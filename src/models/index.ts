import { model, Schema } from 'mongoose';
import { config } from '../config/env.js';

const timestamps = { createdAt: true, updatedAt: true };
const schemaOptions = {
  timestamps,
  versionKey: false as const,
  id: false,
  strict: 'throw' as const,
  autoIndex: !config.isProduction,
  autoCreate: !config.isProduction,
};

const isSafeInteger = (value: number) => Number.isSafeInteger(value);
const integer = (minimum: number, defaultValue?: number) => ({
  type: Number,
  required: defaultValue === undefined,
  ...(defaultValue === undefined ? {} : { default: defaultValue }),
  min: minimum,
  validate: { validator: isSafeInteger, message: 'must be a safe integer' },
});
const userId = () => ({ type: String, required: true, trim: true, minlength: 1, maxlength: 128 });
const objectId = () => ({ type: Schema.Types.ObjectId, required: true, immutable: true });

/** Inventory source of truth. Availability is mutated only inside a MongoDB transaction. */
const dropSchema = new Schema(
  {
    item: { type: String, required: true, trim: true, minlength: 1, maxlength: 256 },
    totalStock: integer(1),
    available: integer(0),
    liveAt: { type: Date, required: true, index: true },
    price: integer(1), // BSP smallest unit; never use floating-point currency.
    maxPerUser: integer(1),
  },
  schemaOptions
).index({ liveAt: 1, available: 1 });
dropSchema.pre('validate', function validateBounds(next) {
  if (this.available > this.totalStock) return next(new Error('available cannot exceed totalStock'));
  if (this.maxPerUser > this.totalStock) return next(new Error('maxPerUser cannot exceed totalStock'));
  next();
});
export const Drop = model('Drop', dropSchema);

export const Wallet = model(
  'Wallet',
  new Schema({ userId: { ...userId(), unique: true }, balance: integer(0) }, schemaOptions)
);

/** Materialized allocation makes the per-user cap check O(1) during a claim transaction. */
export const Allocation = model(
  'Allocation',
  new Schema(
    { dropId: objectId(), userId: userId(), held: integer(0, 0), purchased: integer(0, 0) },
    schemaOptions
  ).index({ dropId: 1, userId: 1 }, { unique: true })
);

/** The expiry and account indexes match the worker and `/v1/me` hot paths. */
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
      source: { type: String, required: true, enum: ['CLAIM', 'WAITLIST'], default: 'CLAIM' },
    },
    schemaOptions
  )
    .index(
      { dropId: 1, userId: 1, idempotencyKey: 1 },
      { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
    )
    .index({ status: 1, expiresAt: 1 })
    .index({ userId: 1, createdAt: -1 })
);

/** A unique hold reference is the final idempotency guard for wallet debits. */
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

/** FIFO lookup is served by the `(dropId, status, sequence)` compound index. */
export const Waitlist = model(
  'Waitlist',
  new Schema(
    {
      dropId: objectId(),
      userId: userId(),
      status: { type: String, required: true, enum: ['WAITING', 'PROMOTED', 'SKIPPED'], default: 'WAITING' },
      sequence: integer(1),
    },
    schemaOptions
  )
    .index({ dropId: 1, userId: 1 }, { unique: true })
    .index({ dropId: 1, status: 1, sequence: 1 })
);

/** Atomic per-drop sequence makes FIFO promotion deterministic under concurrent joins. */
export const WaitlistSequence = model(
  'WaitlistSequence',
  new Schema({ _id: { type: Schema.Types.ObjectId, required: true }, value: integer(0, 0) }, schemaOptions)
);
