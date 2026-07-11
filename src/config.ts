import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bespoke?replicaSet=rs0',
  holdTtlMs: Number(process.env.HOLD_TTL_SECONDS ?? 120) * 1000,
  reconcileIntervalMs: Number(process.env.RECONCILE_INTERVAL_MS ?? 5000)
};
