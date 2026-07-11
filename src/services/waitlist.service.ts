import { config } from '../config/env.js';
import { Allocation, Drop, Hold, Waitlist, WaitlistSequence } from '../repositories/drop.repository.js';
import { ApiError } from '../utils/api-error.js';
import { withTransaction } from './transaction.service.js';

/** Promotes sequentially: every reservation and waitlist state change commits atomically. */
export async function promote(dropId: string) {
  while (true) {
    const made = await withTransaction(async (session) => {
      const drop = await Drop.findById(dropId).session(session);
      if (!drop || drop.available! < 1 || drop.liveAt! > new Date()) return false;
      const entry = await Waitlist.findOne({ dropId: drop._id, status: 'WAITING' })
        .sort({ sequence: 1 })
        .session(session);
      if (!entry) return false;
      const allocation = await Allocation.findOne({ dropId: drop._id, userId: entry.userId }).session(
        session
      );
      if ((allocation?.held ?? 0) + (allocation?.purchased ?? 0) >= drop.maxPerUser!) {
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

export async function joinWaitlist(dropId: string, userId: string) {
  const drop = await Drop.findById(dropId);
  if (!drop) throw new ApiError(404, 'Drop not found');
  if (drop.available! > 0) throw new ApiError(409, 'Stock is currently available; claim it directly');
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
