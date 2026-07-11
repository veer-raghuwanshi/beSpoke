import { model, Schema } from 'mongoose';

const options = { timestamps: true, versionKey: false as const };

/** Source of truth for sellable inventory. `available` changes only in a transaction. */
export const Drop = model(
  'Drop',
  new Schema(
    {
      item: { type: String, required: true },
      totalStock: { type: Number, required: true, min: 1 },
      available: { type: Number, required: true, min: 0 },
      liveAt: { type: Date, required: true },
      price: { type: Number, required: true, min: 1 },
      maxPerUser: { type: Number, required: true, min: 1 },
    },
    options
  ).index({ liveAt: 1, available: 1 })
);

export const Wallet = model(
  'Wallet',
  new Schema(
    {
      userId: { type: String, unique: true },
      balance: { type: Number, min: 0, required: true },
    },
    options
  )
);

/** Fast, transactional per-user cap check; unique index prevents duplicate counters. */
export const Allocation = model(
  'Allocation',
  new Schema(
    {
      dropId: { type: Schema.Types.ObjectId, required: true },
      userId: { type: String, required: true },
      held: { type: Number, default: 0 },
      purchased: { type: Number, default: 0 },
    },
    options
  ).index({ dropId: 1, userId: 1 }, { unique: true })
);

/** Active-hold query is used by the reconciliation worker; user query powers /v1/me. */
export const Hold = model(
  'Hold',
  new Schema(
    {
      dropId: { type: Schema.Types.ObjectId, required: true },
      userId: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      status: {
        type: String,
        enum: ['ACTIVE', 'CONFIRMED', 'EXPIRED', 'CANCELLED'],
        default: 'ACTIVE',
      },
      expiresAt: { type: Date, required: true },
      idempotencyKey: String,
      source: { type: String, enum: ['CLAIM', 'WAITLIST'], default: 'CLAIM' },
    },
    options
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

/** `holdId` uniqueness guarantees that confirmation can debit at most once. */
export const Purchase = model(
  'Purchase',
  new Schema(
    {
      holdId: { type: Schema.Types.ObjectId, unique: true },
      dropId: Schema.Types.ObjectId,
      userId: String,
      quantity: Number,
      unitPrice: Number,
      total: Number,
    },
    options
  ).index({ userId: 1, createdAt: -1 })
);

/** The compound index is the FIFO promotion query: first waiting entry for a drop. */
export const Waitlist = model(
  'Waitlist',
  new Schema(
    {
      dropId: { type: Schema.Types.ObjectId, required: true },
      userId: { type: String, required: true },
      status: {
        type: String,
        enum: ['WAITING', 'PROMOTED', 'SKIPPED'],
        default: 'WAITING',
      },
      sequence: { type: Number, required: true },
    },
    options
  )
    .index({ dropId: 1, userId: 1 }, { unique: true })
    .index({ dropId: 1, status: 1, sequence: 1 })
);
