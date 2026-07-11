import { Allocation, Drop, Hold } from '../repositories/drop.repository.js';
import { withTransaction } from './transaction.service.js';
import { promote } from './waitlist.service.js';

export async function releaseHold(holdId: string, status: 'EXPIRED' | 'CANCELLED') {
  const released = await withTransaction(async (session) => {
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
  if (released) await promote(released);
  return Boolean(released);
}
