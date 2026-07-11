import { config } from '../config/env.js';
import { reconcile } from '../services/drops.js';

export async function startReconciliationWorker() {
  await reconcile();
  setInterval(
    () => void reconcile().catch((error) => console.error('reconcile failed', error)),
    config.reconcileIntervalMs
  ).unref();
}
