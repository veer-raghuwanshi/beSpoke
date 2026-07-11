/**
 * Destructive integration tests. Explicit opt-in avoids deleting a developer's
 * Atlas data when `npm test` is run with a normal application .env file.
 */
import { connectDatabase, mongoose } from '../config/database.js';
import {
  Allocation,
  Drop,
  Hold,
  Purchase,
  Waitlist,
  WaitlistSequence,
  Wallet,
} from '../repositories/drop.repository.js';
import { claim, confirm, joinWaitlist, reconcile, releaseHold } from '../services/index.js';

const enabled = process.env.RUN_INTEGRATION_TESTS === 'true';
(enabled ? describe : describe.skip)('transactional drop behaviour', () => {
  let dropId: string;
  beforeAll(connectDatabase);
  beforeEach(async () => {
    await Promise.all([
      Allocation.deleteMany({}),
      Hold.deleteMany({}),
      Purchase.deleteMany({}),
      Waitlist.deleteMany({}),
      WaitlistSequence.deleteMany({}),
      Drop.deleteMany({}),
      Wallet.deleteMany({}),
    ]);
    const drop = await Drop.create({
      item: 'test',
      totalStock: 3,
      available: 3,
      liveAt: new Date(Date.now() - 1000),
      price: 10,
      maxPerUser: 1,
    });
    dropId = String(drop._id);
    await Wallet.insertMany(Array.from({ length: 20 }, (_, i) => ({ userId: `u${i}`, balance: 100 })));
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });

  test('concurrent claims cannot oversell', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => claim(dropId, `u${i}`, 1, `key-${i}`))
    );
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(3);
    expect((await Drop.findById(dropId))!.available).toBe(0);
  }, 20_000);

  test('claim creates an active hold and reserves inventory', async () => {
    const hold = await claim(dropId, 'u0', 1, 'claim-active');

    expect(hold.status).toBe('ACTIVE');
    expect((await Drop.findById(dropId))!.available).toBe(2);
  });

  test('same idempotency key returns the original hold without reserving again', async () => {
    const first = await claim(dropId, 'u0', 1, 'retry-key');
    const retry = await claim(dropId, 'u0', 1, 'retry-key');

    expect(String(retry._id)).toBe(String(first._id));
    expect((await Drop.findById(dropId))!.available).toBe(2);
  });

  test('a user cannot exceed the per-drop cap across separate claims', async () => {
    await claim(dropId, 'u0', 1, 'first');

    await expect(claim(dropId, 'u0', 1, 'second')).rejects.toMatchObject({ status: 409 });
    expect((await Drop.findById(dropId))!.available).toBe(2);
  });

  test('expiry returns stock exactly once even when the worker runs twice', async () => {
    const hold = await claim(dropId, 'u0', 1, 'expire');
    await Hold.updateOne({ _id: hold._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });

    await reconcile();
    await reconcile();

    expect((await Hold.findById(hold._id))!.status).toBe('EXPIRED');
    expect((await Drop.findById(dropId))!.available).toBe(3);
  });
  test('repeated confirmation debits once', async () => {
    const hold = await claim(dropId, 'u0', 1, 'claim');
    await Promise.all([confirm(String(hold._id), 'u0'), confirm(String(hold._id), 'u0')]);
    expect((await Wallet.findOne({ userId: 'u0' }))!.balance).toBe(90);
    expect(await Purchase.countDocuments({ holdId: hold._id })).toBe(1);
  });

  test('insufficient balance leaves the hold and wallet unchanged', async () => {
    await Wallet.updateOne({ userId: 'u0' }, { $set: { balance: 5 } });
    const hold = await claim(dropId, 'u0', 1, 'poor-wallet');

    await expect(confirm(String(hold._id), 'u0')).rejects.toMatchObject({ status: 409 });

    expect((await Wallet.findOne({ userId: 'u0' }))!.balance).toBe(5);
    expect((await Hold.findById(hold._id))!.status).toBe('ACTIVE');
    expect(await Purchase.countDocuments({ holdId: hold._id })).toBe(0);
  });

  test('waitlist promotion uses deterministic FIFO order', async () => {
    const waitingDrop = await Drop.create({
      item: 'waitlist test',
      totalStock: 1,
      available: 1,
      liveAt: new Date(Date.now() - 1000),
      price: 10,
      maxPerUser: 1,
    });
    const waitingDropId = String(waitingDrop._id);
    const soldHold = await claim(waitingDropId, 'u0', 1, 'sold');
    await joinWaitlist(waitingDropId, 'u1');
    await joinWaitlist(waitingDropId, 'u2');

    await releaseHold(String(soldHold._id), 'CANCELLED');

    const promoted = await Hold.findOne({ dropId: waitingDropId, status: 'ACTIVE', source: 'WAITLIST' });
    expect(promoted!.userId).toBe('u1');
  });
});
