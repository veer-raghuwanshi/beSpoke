/** Integration tests: run against the Docker replica set described in README. */
import { connectDb, mongoose } from '../db.js';
import { Allocation, Drop, Hold, Purchase, Wallet, Waitlist } from '../models.js';
import { claim, confirm } from './drops.js';

const enabled = Boolean(process.env.MONGODB_URI);
(enabled ? describe : describe.skip)('transactional drop behaviour', () => {
  let dropId: string;
  beforeAll(connectDb);
  beforeEach(async () => {
    await Promise.all([Allocation.deleteMany({}), Hold.deleteMany({}), Purchase.deleteMany({}), Waitlist.deleteMany({}), Drop.deleteMany({}), Wallet.deleteMany({})]);
    const drop = await Drop.create({ item: 'test', totalStock: 3, available: 3, liveAt: new Date(Date.now() - 1000), price: 10, maxPerUser: 1 }); dropId = String(drop._id);
    await Wallet.insertMany(Array.from({ length: 20 }, (_, i) => ({ userId: `u${i}`, balance: 100 })));
  });
  afterAll(async () => { await mongoose.disconnect(); });

  test('concurrent claims cannot oversell', async () => {
    const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => claim(dropId, `u${i}`, 1, `key-${i}`)));
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(3);
    expect((await Drop.findById(dropId))!.available).toBe(0);
  });
  test('repeated confirmation debits once', async () => {
    const hold = await claim(dropId, 'u0', 1, 'claim');
    await Promise.all([confirm(String(hold._id), 'u0'), confirm(String(hold._id), 'u0')]);
    expect((await Wallet.findOne({ userId: 'u0' }))!.balance).toBe(90);
    expect(await Purchase.countDocuments({ holdId: hold._id })).toBe(1);
  });
});
