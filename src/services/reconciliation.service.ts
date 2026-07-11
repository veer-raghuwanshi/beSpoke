import { Drop, Hold } from '../repositories/drop.repository.js';
import { releaseHold } from './hold.service.js';
import { promote } from './waitlist.service.js';

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
