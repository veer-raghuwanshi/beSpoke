import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { connectDatabase, mongoose } from '../src/config/database.js';
import { Drop, Hold, Wallet } from '../src/repositories/drop.repository.js';

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3100';
const virtualUsers = Number(process.env.LOAD_VUS ?? 100);
const stock = Number(process.env.LOAD_STOCK ?? 20);
const runId = `load-${Date.now()}`;

if (process.env.LOAD_TEST !== 'true')
   throw new Error('Set LOAD_TEST=true to run the load test.');
if (!Number.isSafeInteger(virtualUsers) || !Number.isSafeInteger(stock) || virtualUsers < stock || stock < 1)

  throw new Error('LOAD_VUS must be >= LOAD_STOCK and both must be positive integers.');

const percentile = (values: number[], ratio: number) => values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)] ?? 0;

await connectDatabase();
try {
  const drop = await Drop.create(
    { 
      item: runId, 
      totalStock: stock, 
      available: stock, 
      liveAt: new Date(Date.now() - 1000), 
      price: 10, maxPerUser: 1 
    });
  const users = Array.from(
    { length: virtualUsers }, 
    (_, index) => `${runId}-user-${index}`);
  await Wallet.insertMany(
    users.map((userId) => 
      ({ userId, balance: 100 }
    )));

  const results = await Promise.all(users.map(async (userId) => {
    const startedAt = performance.now();
    const response = await fetch(`${apiBaseUrl}/v1/drops/${drop._id}/claims`, 
      {
      method: 'POST', 
      headers: { 'content-type': 'application/json', 
      'x-user-id': userId, 'idempotency-key': `${runId}-${userId}` },
       body: JSON.stringify({ quantity: 1 }),
    });
    return { status: response.status, durationMs: performance.now() - startedAt };
  }));

  const durations = results.map(({ durationMs }) => durationMs).sort((a, b) => a - b);

  const successes = results.filter(({ status }) => status === 201).length;

  const conflicts = results.filter(({ status }) => status === 409).length;

  const finalDrop = await Drop.findById(drop._id).lean();

  const holds = await Hold.countDocuments({ dropId: drop._id, status: 'ACTIVE' });

  const passed = successes === stock && conflicts === virtualUsers - stock && finalDrop?.available === 0 && holds === stock;

  console.log(JSON.stringify(
    { runId, 
      virtualUsers, 
      stock,
      successes, 
      conflicts,
      finalAvailable: finalDrop?.available, activeHolds: holds,
       latencyMs: { min: Math.round(durations[0]), p50: Math.round(percentile(durations, .5)), p95: Math.round(percentile(durations, .95)), max: Math.round(durations.at(-1) ?? 0) }, passed }, null, 2));
  if (!passed) process.exitCode = 1;
} finally {
  await Hold.deleteMany({ userId: new RegExp(`^${runId}-`) });
  await Wallet.deleteMany({ userId: new RegExp(`^${runId}-`) });
  await Drop.deleteMany({ item: runId });
  await mongoose.disconnect();
}
