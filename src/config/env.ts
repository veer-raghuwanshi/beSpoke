import 'dotenv/config';

const numberEnv = (name: string, fallback: number, minimum = 1) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${name} must be a number >= ${minimum}`);
  return value;
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const adminKey = process.env.ADMIN_KEY ?? (nodeEnv === 'production' ? '' : 'dev-admin');
if (nodeEnv === 'production' && !adminKey) throw new Error('ADMIN_KEY is required in production');

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: numberEnv('PORT', 3000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/bespoke?replicaSet=rs0',
  mongoMaxPoolSize: numberEnv('MONGO_MAX_POOL_SIZE', 20),
  holdTtlMs: numberEnv('HOLD_TTL_SECONDS', 120) * 1000,
  reconcileIntervalMs: numberEnv('RECONCILE_INTERVAL_MS', 5000),
  adminKey,
  corsOrigins: (
    process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5501,http://127.0.0.1:5501'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};
