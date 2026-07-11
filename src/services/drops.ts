import { ClientSession, Types } from 'mongoose';
import {
  Allocation,
  Drop,
  Hold,
  Purchase,
  Waitlist,
  WaitlistSequence,
  Wallet,
} from '../repositories/drop.repository.js';
import { config } from '../config/env.js';
import { mongoose } from '../config/database.js';
import { ApiError } from '../utils/api-error.js';

const id = (value: string) => new Types.ObjectId(value);
const retryTxn = async <T>(work: (session: ClientSession) => Promise<T>) =>
  mongoose.connection.transaction(work, {
    readPreference: 'primary',
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
  });

export async function claim(dropId: string, userId: string, quantity: number, key: string) {
  return retryTxn(async (session) => {
    const existing = await Hold.findOne({
      dropId: id(dropId),
      userId,
      idempotencyKey: key,
    }).session(session);
    if (existing) {
      if (existing.quantity !== quantity)
        throw new ApiError(409, 'Idempotency-Key was already used with a different quantity');
      return existing;
    }
    const drop = await Drop.findById(dropId).session(session);
    if (!drop) throw new ApiError(404, 'Drop not found');
    if (drop.liveAt! > new Date()) throw new ApiError(409, 'Drop is not live');
    const allocation = await Allocation.findOne({
      dropId: drop._id,
      userId,
    }).session(session);
    if ((allocation?.held ?? 0) + (allocation?.purchased ?? 0) + quantity > drop.maxPerUser!)
      throw new ApiError(409, 'Per-user limit exceeded');
    const reserved = await Drop.findOneAndUpdate(
      { _id: drop._id, available: { $gte: quantity } },
      { $inc: { available: -quantity } },
      { new: true, session }
    );
    if (!reserved) throw new ApiError(409, 'Drop is sold out');
    await Allocation.updateOne(
      { dropId: drop._id, userId },
      { $inc: { held: quantity }, $setOnInsert: { purchased: 0 } },
      { upsert: true, session }
    );
    return Hold.create(
      [
        {
          dropId: drop._id,
          userId,
          quantity,
          expiresAt: new Date(Date.now() + config.holdTtlMs),
          idempotencyKey: key,
        },
      ],
      { session }
    ).then((x) => x[0]);
  });
}

export async function confirm(holdId: string, userId: string) {
  return retryTxn(async (session) => {
    const already = await Purchase.findOne({
      holdId: id(holdId),
      userId,
    }).session(session);
    if (already) return already;
    const hold = await Hold.findOne({ _id: holdId, userId }).session(session);
    if (!hold) throw new ApiError(404, 'Hold not found');
    if (hold.status !== 'ACTIVE' || hold.expiresAt! <= new Date())
      throw new ApiError(409, 'Hold is no longer active');
    const drop = await Drop.findById(hold.dropId).session(session);
    if (!drop) throw new ApiError(404, 'Drop not found');
    const total = hold.quantity! * drop.price!;
    const charged = await Wallet.findOneAndUpdate(
      { userId, balance: { $gte: total } },
      { $inc: { balance: -total } },
      { new: true, session }
    );
    if (!charged) throw new ApiError(409, 'Insufficient BSP balance');
    const claimed = await Hold.findOneAndUpdate(
      { _id: hold._id, status: 'ACTIVE', expiresAt: { $gt: new Date() } },
      { $set: { status: 'CONFIRMED' } },
      { new: true, session }
    );
    if (!claimed) throw new ApiError(409, 'Hold is no longer active');
    await Allocation.updateOne(
      { dropId: hold.dropId, userId },
      { $inc: { held: -hold.quantity!, purchased: hold.quantity! } },
      { session }
    );
    return Purchase.create(
      [
        {
          holdId: hold._id,
          dropId: hold.dropId,
          userId,
          quantity: hold.quantity,
          unitPrice: drop.price,
          total,
        },
      ],
      { session }
    ).then((x) => x[0]);
  });
}

export async function releaseHold(holdId: string, status: 'EXPIRED' | 'CANCELLED') {
  const released = await retryTxn(async (session) => {
    const hold = await Hold.findById(holdId).session(session);
    if (!hold || hold.status !== 'ACTIVE') return false;
    if (status === 'EXPIRED' && hold.expiresAt! > new Date()) return false;
    const changed = await Hold.findOneAndUpdate(
      { _id: hold._id, status: 'ACTIVE' },
      { $set: { status } },
      { session }
    );
    if (!changed) return false;
    await Drop.updateOne({ _id: hold.dropId }, { $inc: { available: hold.quantity! } }, { session });
    await Allocation.updateOne(
      { dropId: hold.dropId, userId: hold.userId },
      { $inc: { held: -hold.quantity! } },
      { session }
    );
    return String(hold.dropId);
  });
  if (released) await promote(String(released));
  return Boolean(released);
}

/** FIFO promotion reserves one unit (the waitlist has no requested quantity) in the same transaction. */
export async function promote(dropId: string) {
  while (true) {
    const made = await retryTxn(async (session) => {
      const drop = await Drop.findById(dropId).session(session);
      if (!drop || drop.available! < 1 || drop.liveAt! > new Date()) return false;
      const entry = await Waitlist.findOne({
        dropId: drop._id,
        status: 'WAITING',
      })
        .sort({ sequence: 1 })
        .session(session);
      if (!entry) return false;
      const a = await Allocation.findOne({
        dropId: drop._id,
        userId: entry.userId,
      }).session(session);
      if ((a?.held ?? 0) + (a?.purchased ?? 0) >= drop.maxPerUser!) {
        await Waitlist.updateOne(
          { _id: entry._id, status: 'WAITING' },
          { $set: { status: 'SKIPPED' } },
          { session }
        );
        return true;
      }
      const reserved = await Drop.findOneAndUpdate(
        { _id: drop._id, available: { $gte: 1 } },
        { $inc: { available: -1 } },
        { session }
      );
      if (!reserved) return false;
      await Allocation.updateOne(
        { dropId: drop._id, userId: entry.userId },
        { $inc: { held: 1 }, $setOnInsert: { purchased: 0 } },
        { upsert: true, session }
      );
      await Hold.create(
        [
          {
            dropId: drop._id,
            userId: entry.userId,
            quantity: 1,
            expiresAt: new Date(Date.now() + config.holdTtlMs),
            source: 'WAITLIST',
          },
        ],
        { session }
      );
      await Waitlist.updateOne(
        { _id: entry._id, status: 'WAITING' },
        { $set: { status: 'PROMOTED' } },
        { session }
      );
      return true;
    });
    if (!made) return;
  }
}

export async function reconcile() {
  const expired = await Hold.find({
    status: 'ACTIVE',
    expiresAt: { $lte: new Date() },
  })
    .select('_id')
    .limit(100);
  for (const hold of expired) await releaseHold(String(hold._id), 'EXPIRED');
  const drops = await Drop.find({
    available: { $gt: 0 },
    liveAt: { $lte: new Date() },
  })
    .select('_id')
    .limit(100);
  for (const drop of drops) await promote(String(drop._id));
}

export async function joinWaitlist(dropId: string, userId: string) {
  const drop = await Drop.findById(dropId);
  if (!drop) throw new ApiError(404, 'Drop not found');
  if (drop.available! > 0) throw new ApiError(409, 'Stock is currently available; claim it directly');
  // A counter, unlike a timestamp/random suffix, cannot reorder simultaneous joins.
  const counter = await WaitlistSequence.findByIdAndUpdate(
    drop._id,
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
  return Waitlist.findOneAndUpdate(
    { dropId: drop._id, userId },
    { $setOnInsert: { status: 'WAITING', sequence: counter.value } },
    { upsert: true, new: true }
  );
}
