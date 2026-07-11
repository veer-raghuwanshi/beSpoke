import { Allocation, Drop, Hold, Purchase, Wallet } from '../repositories/drop.repository.js';
import { ApiError } from '../utils/api-error.js';
import { toObjectId, withTransaction } from './transaction.service.js';

export const confirm = (holdId: string, userId: string) =>
  withTransaction(async (session) => {
    const already = await Purchase.findOne({ holdId: toObjectId(holdId), userId }).session(session);
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
    ).then(([purchase]) => purchase);
  });
