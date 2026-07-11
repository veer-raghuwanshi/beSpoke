import { config } from '../config/env.js';
import { Allocation, Drop, Hold } from '../repositories/drop.repository.js';
import { ApiError } from '../utils/api-error.js';
import { toObjectId, withTransaction } from './transaction.service.js';

export const claim = (
  dropId: string,
  userId: string,
  quantity: number,
  key: string
) =>
  withTransaction(async (session) => {
    const existing = await Hold.findOne({
      dropId: toObjectId(dropId),
      userId,
      idempotencyKey: key,
    }).session(session);
    if (existing) {
      if (existing.quantity !== quantity)
        throw new ApiError(
          409,
          'Idempotency-Key was already used with a different quantity'
        );
      return existing;
    }
    const drop = await Drop.findById(dropId).session(session);
    if (!drop) throw new ApiError(404, 'Drop not found');

    if (drop.liveAt! > new Date())
       throw new ApiError(409, 'Drop is not live');
    const allocation = await Allocation.findOne({
      dropId: drop._id,
      userId,
    }).session(session);
    if (
      (allocation?.held ?? 0) + (allocation?.purchased ?? 0) + quantity >
      drop.maxPerUser!
    )
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
    ).then(([hold]) => hold);
  });
