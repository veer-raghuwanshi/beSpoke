import { config } from '../config/env.js';
import { reconcile } from '../services/index.js';

export async function startReconciliationWorker() {
  await reconcile();
  const timer = setInterval(
    () => void reconcile().catch((error) => console.error('reconcile failed', error)),
    config.reconcileIntervalMs
  );
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
